import sys
import io
import os
import re

# Force UTF-8 output on Windows for emojis
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from typing import Dict, TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv, find_dotenv

# Ensure backend directory and src are in sys.path dynamically
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '..'))
BACKEND_DIR = os.path.abspath(os.path.join(CURRENT_DIR, '../..'))

for p in [SRC_DIR, BACKEND_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

load_dotenv(find_dotenv(), override=True)

from utils.sast_scanner import run_sast_scan
from utils.attestation import sign_patch_attestation
from utils.code_graph import build_repository_map, build_import_graph, rank_by_fault_proximity
from utils.telemetry import trace_span
from utils.sandbox import run_in_sandbox
from utils.git_manager import init_fix_branch, generate_patch_diff, commit_patch, commit_patch_batch, generate_multi_file_diff
from utils.run_logger import push_log

from database.db import init_db
from rag.patch_memory import record_patch_experience, retrieve_similar_experiences
from rag.code_rag import index_codebase_rag, retrieve_relevant_code_context

# Initialize Database & Index Codebase RAG on graph startup
init_db()

# 1. State Definition
class AgentState(TypedDict):
    bug_description: str
    proposed_fix: str
    test_result: str
    attempt_count: int
    max_attempts: int          # Passed in from API; controls retry cap dynamically
    target_file: str           # Primary / first culprit (kept for single-file compat)
    target_files: List[str]    # All culprit files for this attempt cycle
    workspace_dir: str         # Root of cloned repo; used for sandbox test discovery
    detected_language: str     # Phase 2: primary language of the repo ("python", "javascript", etc.)
    history: List[str]
    last_diff: str
    error_class: str           # Phase 3: "ImportError" | "TypeError" | "LogicError"
    agent_used: str            # Phase 3: "ImportResolverAgent" | "TypeFixAgent" | "LogicRepairAgent"


# ─── Language-aware LLM prompt templates (Phase 2) ─────────────────────────────────────────────────────

LANG_PROMPTS: Dict[str, str] = {
    "python": (
        "You are an autonomous SRE agent. Fix the target Python file so ALL pytest tests pass simultaneously.\n"
        "Return ONLY valid, executable Python code for the target file. "
        "Do NOT use markdown formatting like ```python or any explanations."
    ),
    "javascript": (
        "You are an autonomous SRE agent. Fix the target JavaScript file so ALL Jest tests pass.\n"
        "Return ONLY valid, executable JavaScript code. "
        "Do NOT use markdown formatting like ```javascript or any explanations."
    ),
    "typescript": (
        "You are an autonomous SRE agent. Fix the target TypeScript file so ALL Jest/Vitest tests pass.\n"
        "Return ONLY valid, executable TypeScript code. "
        "Do NOT use markdown formatting like ```typescript or any explanations."
    ),
    "go": (
        "You are an autonomous SRE agent. Fix the target Go file so `go test ./...` passes.\n"
        "Return ONLY valid Go code. "
        "Do NOT use markdown formatting like ```go or any explanations."
    ),
    "java": (
        "You are an autonomous SRE agent. Fix the target Java file so all JUnit tests pass.\n"
        "Return ONLY valid Java code for the single target file. "
        "Do NOT use markdown formatting like ```java or any explanations."
    ),
    "rust": (
        "You are an autonomous SRE agent. Fix the target Rust file so `cargo test` passes.\n"
        "Return ONLY valid Rust code. "
        "Do NOT use markdown formatting like ```rust or any explanations."
    ),
}

_DEFAULT_LANG_PROMPT = LANG_PROMPTS["python"]


def clean_llm_code_output(raw_code: str) -> str:
    """Strips markdown code blocks from LLM responses."""
    cleaned = raw_code.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z]*\n", "", cleaned)
        cleaned = re.sub(r"\n```$", "", cleaned)
    return cleaned.strip()

def invoke_llm_with_fallback(prompt: str) -> str:
    """Multi-LLM Fallback: Groq -> OpenRouter -> Gemini Direct."""
    groq_key = os.getenv("GROQ_API_KEY")
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if groq_key and not groq_key.startswith("your_"):
        try:
            print("📡 [LLM Engine]: Requesting patch via Groq (llama-3.3-70b-versatile)...")
            from langchain_groq import ChatGroq
            llm_groq = ChatGroq(model="llama-3.3-70b-versatile", groq_api_key=groq_key, temperature=0.1)
            response = llm_groq.invoke(prompt)
            content = response.content if isinstance(response.content, str) else response.content[0].get("text", "")
            return content.strip()
        except Exception as e:
            print(f"⚠️ [Groq Limit/Error]: {e}\n🔄 [LLM Engine]: Switching to Tier 2 (OpenRouter)...")

    if openrouter_key and not openrouter_key.startswith("your_"):
        try:
            print("📡 [LLM Engine]: Requesting patch via OpenRouter (openrouter/auto)...")
            push_log("📡 [LLM Engine]: Requesting patch via OpenRouter (openrouter/auto)...")
            from langchain_openai import ChatOpenAI
            llm_openrouter = ChatOpenAI(
                model="openrouter/auto",
                openai_api_key=openrouter_key,
                openai_api_base="https://openrouter.ai/api/v1",
                temperature=0.1
            )
            response = llm_openrouter.invoke(prompt)
            content = response.content if isinstance(response.content, str) else response.content[0].get("text", "")
            return content.strip()
        except Exception as e:
            print(f"⚠️ [OpenRouter Limit/Error]: {e}\n🔄 [LLM Engine]: Switching to Tier 3 (Gemini Direct)...")
            push_log(f"⚠️ [OpenRouter]: {e} — switching to Gemini...")

    if gemini_key and not gemini_key.startswith("your_"):
        try:
            print("📡 [LLM Engine]: Requesting patch via Gemini Direct (gemini-2.0-flash)...")
            from langchain_google_genai import ChatGoogleGenerativeAI
            llm_gemini = ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=gemini_key)
            response = llm_gemini.invoke(prompt)
            content = response.content if isinstance(response.content, str) else response.content[0].get("text", "")
            return content.strip()
        except Exception as e:
            print(f"❌ [Gemini Direct Error]: {e}")
            raise e

    raise RuntimeError("No operational LLM key found across Groq, OpenRouter, or Gemini.")

# 2. Agent Router & Specialized Agent Nodes (Phase 3)

def agent_router(state: AgentState) -> Dict:
    """
    Classifies the error traceback and routes to the appropriate specialist sub-agent.
    """
    test_res = state.get("test_result", "")

    if re.search(r"ImportError|ModuleNotFoundError|Cannot find module|no required module|Package .* does not exist|missing require|npm ERR!|go: module .* not found", test_res, re.I):
        err_cls = "ImportError"
        agent_name = "ImportResolverAgent"
    elif re.search(r"TypeError|AttributeError|undefined is not a function|NullPointerException|ReferenceError|NoSuchMethodError|type mismatch", test_res, re.I):
        err_cls = "TypeError"
        agent_name = "TypeFixAgent"
    else:
        err_cls = "LogicError"
        agent_name = "LogicRepairAgent"

    log_msg = f"🔀 [Agent Router]: Classified error as '{err_cls}' → Routing to {agent_name}"
    print(log_msg)
    push_log(log_msg)

    return {
        "error_class": err_cls,
        "agent_used":  agent_name,
    }

def route_to_specialist(state: AgentState) -> str:
    """Conditional router function for StateGraph."""
    agent_used = state.get("agent_used", "LogicRepairAgent")
    if agent_used == "ImportResolverAgent":
        return "import_resolver"
    elif agent_used == "TypeFixAgent":
        return "type_fix"
    else:
        return "logic_repair"


def _run_specialist_patch(state: AgentState, agent_name: str, specialist_instructions: str) -> Dict:
    """Shared core patch execution engine for specialized agents."""
    current_attempts = state.get("attempt_count", 0) + 1

    with trace_span(agent_name.lower(), {"attempt": current_attempts}):
        target_files: List[str] = state.get("target_files") or []
        primary_file = state.get("target_file", "")

        if primary_file and primary_file not in target_files:
            target_files = [primary_file] + target_files

        if not target_files or not any(os.path.exists(f) for f in target_files):
            fallback = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "../../target_app/app.py")
            )
            target_files = [fallback]

        target_files = [f for f in target_files if os.path.exists(f)]
        active_primary = target_files[0] if target_files else primary_file

        header_msg = (
            f"\n🤖 [{agent_name}]: Attempt #{current_attempts} — "
            f"targeting {len(target_files)} file(s): "
            f"{[os.path.basename(f) for f in target_files]}"
        )
        print(header_msg)
        push_log(header_msg)

        target_dir = os.path.dirname(active_primary)
        index_codebase_rag(target_dir)

        rag_code_context = retrieve_relevant_code_context(state.get("test_result", ""))
        memory_lessons   = retrieve_similar_experiences(state.get("test_result", ""))

        combined_diff     = ""
        last_fixed_code   = ""
        patched_files: List[str] = []
        sast_blocked: List[str]  = []

        init_fix_branch(f"olympus/patch-attempt-{current_attempts}")

        for file_path in target_files:
            file_name = os.path.basename(file_path)
            push_log(f"🔧 [{agent_name}]: Patching {file_name}...")

            try:
                with open(file_path, "r", encoding="utf-8") as fh:
                    current_code = fh.read()
            except OSError as read_err:
                push_log(f"⚠️ [{agent_name}]: Cannot read {file_name} — {read_err}. Skipping.")
                continue

            lang = state.get("detected_language", "python") or "python"
            lang_instruction = LANG_PROMPTS.get(lang, _DEFAULT_LANG_PROMPT)

            prompt = f"""
        {lang_instruction}

        {specialist_instructions}

        {rag_code_context}

        {memory_lessons}

        Target File: {file_name}
        Code:
        {current_code}

        Failure Output & Error Traceback:
        {state['test_result']}

        INSTRUCTIONS:
        - Inspect the retrieved test assertions and error tracebacks carefully.
        - Only output the corrected code for {file_name}. Do not include any other files.
            """

            push_log(f"🧠 [LLM Engine]: Generating patch for {file_name} via {agent_name}...")
            try:
                raw_response = invoke_llm_with_fallback(prompt)
            except Exception as llm_err:
                push_log(f"❌ [LLM Engine]: Failed for {file_name} — {llm_err}. Skipping.")
                continue

            fixed_code = clean_llm_code_output(raw_response)

            temp_path = file_path + ".olympus_tmp"
            with open(temp_path, "w", encoding="utf-8") as tf:
                tf.write(fixed_code)

            sast_res = run_sast_scan(temp_path, language=state.get("detected_language", "python") or "python")

            if not sast_res["passed"]:
                os.remove(temp_path)
                block_msg = (
                    f"🚨 [SAST Gate]: Patch for {file_name} failed security scan — discarding.\n"
                    f"{sast_res['logs']}"
                )
                print(block_msg)
                push_log(block_msg)
                sast_blocked.append(file_path)
                continue

            push_log(f"✅ [SAST Gate]: {file_name} passed. Applying...")
            os.replace(temp_path, file_path)

            file_diff = generate_patch_diff(file_path)
            if file_diff:
                combined_diff += f"\n# --- {file_name} ---\n{file_diff}"
                diff_msg = f"\n🔍 [Git Diff / {file_name}]:\n{file_diff}\n"
                print(diff_msg)
                push_log(diff_msg)

            sign_patch_attestation(file_diff or "", f"patch-attempt-{current_attempts}-{file_name}")
            patched_files.append(file_path)
            last_fixed_code = fixed_code

        if patched_files:
            commit_patch_batch(patched_files, current_attempts)
            push_log(f"📝 [{agent_name}]: Atomic batch commit complete for {len(patched_files)} file(s).")
        else:
            fail_msg = (
                f"🚨 [{agent_name}]: Attempt #{current_attempts} — no files patched "
                f"(SAST blocked: {[os.path.basename(f) for f in sast_blocked]})."
            )
            print(fail_msg)
            push_log(fail_msg)
            return {
                "proposed_fix":  "",
                "attempt_count": current_attempts,
                "target_file":   active_primary,
                "target_files":  target_files,
                "last_diff":     "",
                "detected_language": state.get("detected_language", "python"),
                "error_class":   state.get("error_class", "LogicError"),
                "agent_used":    agent_name,
                "history":       state["history"] + [f"SAST gate blocked all patches v{current_attempts}"],
            }

        done_msg = (
            f"📝 [{agent_name}]: Attempt #{current_attempts} complete — "
            f"patched {len(patched_files)}/{len(target_files)} file(s)."
        )
        print(done_msg)
        push_log(done_msg)

        return {
            "proposed_fix":  last_fixed_code,
            "attempt_count": current_attempts,
            "target_file":   active_primary,
            "target_files":  target_files,
            "last_diff":     combined_diff.strip(),
            "detected_language": state.get("detected_language", "python"),
            "error_class":   state.get("error_class", "LogicError"),
            "agent_used":    agent_name,
            "history":       state["history"] + [f"Applied fix v{current_attempts} via {agent_name}"],
        }


def import_resolver_agent(state: AgentState) -> Dict:
    """Specialist Agent for ImportError, ModuleNotFoundError, and missing requirements/exports."""
    push_log("📦 [Import Resolver Agent]: Resolving missing modules and import edge mismatches...")
    spec_instr = (
        "SPECIALIST INSTRUCTION (Import Resolver Agent):\n"
        "Focus specifically on fixing module import statements, missing package dependencies, "
        "wrong relative import paths, or missing export declarations."
    )
    return _run_specialist_patch(state, "ImportResolverAgent", spec_instr)


def type_fix_agent(state: AgentState) -> Dict:
    """Specialist Agent for TypeError, AttributeError, null/undefined safety, and signature mismatches."""
    push_log("🏷️ [Type Fix Agent]: Resolving type mismatches, null safety, and method signatures...")
    spec_instr = (
        "SPECIALIST INSTRUCTION (Type Fix Agent):\n"
        "Focus specifically on resolving type mismatches, missing methods or attributes, "
        "null/undefined safety checks, and function parameter signature mismatches."
    )
    return _run_specialist_patch(state, "TypeFixAgent", spec_instr)


def logic_repair_agent(state: AgentState) -> Dict:
    """Specialist Agent for ValueError, IndexError, AssertionError, and general logic failures."""
    push_log("🧩 [Logic Repair Agent]: Repairing algorithmic logic, boundary conditions, and test assertions...")
    spec_instr = (
        "SPECIALIST INSTRUCTION (Logic Repair Agent):\n"
        "Focus specifically on resolving algorithmic logic errors, boundary condition failures, "
        "off-by-one errors, and test assertion mismatches."
    )
    return _run_specialist_patch(state, "LogicRepairAgent", spec_instr)


# Backward-compatible alias
patch_agent = logic_repair_agent


def validation_agent(state: AgentState) -> Dict:
    current_attempts = state.get("attempt_count", 1)

    with trace_span("validation_agent", {"attempt": current_attempts}):
        target_file_path = state.get("target_file") or os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../target_app/app.py")
        )
        workspace_dir = state.get("workspace_dir", "")

        push_log(f"🧪 [Validation Agent]: Running tests in Docker sandbox (Attempt #{current_attempts})...")

        sandbox_output = run_in_sandbox(target_file_path, test_dir=workspace_dir)
        git_diff = state.get("last_diff", "")

        if sandbox_output["exit_code"] == 0:
            msg = "\n✅ [Validation Agent]: All tests passed in sandbox!"
            print(msg)
            push_log(msg)
            record_patch_experience(
                target_file=os.path.basename(target_file_path),
                attempt=current_attempts,
                status="PASS",
                git_diff=git_diff,
                error_logs=sandbox_output["logs"],
            )
            return {
                "test_result":  "PASS",
                "target_files": state.get("target_files", [target_file_path]),
                "error_class":  state.get("error_class", ""),
                "agent_used":   state.get("agent_used", ""),
                "history":      state["history"] + ["Tests passed."],
            }

        logs = sandbox_output["logs"]
        fail_msg = f"❌ [Validation Agent]: Tests failed (Attempt #{current_attempts}).\n{logs[:800]}"
        print(fail_msg)
        push_log(fail_msg)

        record_patch_experience(
            target_file=os.path.basename(target_file_path),
            attempt=current_attempts,
            status="FAIL",
            git_diff=git_diff,
            error_logs=logs,
        )

        base_dir = workspace_dir or os.path.dirname(target_file_path)

        updated_files: List[str] = []
        seen_paths: set = set()

        trace_patterns = [
            r'File\s+"([^"]+\.py)"',
            r'([\w./\\-]+\.py):\d+',
        ]
        for pat in trace_patterns:
            for raw in re.findall(pat, logs):
                bname = os.path.basename(raw)
                if bname.startswith("test_") or bname in {"conftest.py", "setup.py"}:
                    continue
                clean_raw = raw.lstrip("/\\")
                abs_p = raw if os.path.isabs(raw) else os.path.normpath(os.path.join(base_dir, clean_raw))

                if abs_p in seen_paths or not os.path.isfile(abs_p):
                    continue
                seen_paths.add(abs_p)
                updated_files.append(abs_p)
                note = f"🎯 [ENGINE NOTE]: Traceback references: {bname}"
                print(note)
                push_log(note)

        if not updated_files:
            updated_files = [target_file_path]

        # Phase 3: Rank culprit files by proximity in the import graph
        if base_dir and os.path.exists(base_dir):
            try:
                graph = build_import_graph(base_dir)
                if graph and len(updated_files) > 1:
                    updated_files = rank_by_fault_proximity(updated_files[0], graph, updated_files)
                    push_log(f"🕸️ [Import Graph Proximity]: Re-ranked culprits -> {[os.path.basename(f) for f in updated_files]}")
            except Exception as graph_err:
                print(f"⚠️ [Import Proximity Ranking Error]: {graph_err}")

        new_primary = updated_files[0]

        return {
            "test_result":  f"FAIL\n{logs}",
            "target_file":  new_primary,
            "target_files": updated_files,
            "history":      state["history"] + [
                f"Failed. Retargeting {len(updated_files)} file(s): "
                f"{[os.path.basename(f) for f in updated_files]}"
            ],
        }

def human_intervention(state: AgentState) -> Dict:
    all_files = state.get("target_files") or [state.get("target_file", "")]
    print("\n" + "="*60)
    print("🚨 [STATUS]: HUMAN INTERVENTION REQUIRED")
    print("="*60)
    print(f"📌 Target File(s) : {[os.path.basename(f) for f in all_files if f]}")
    print(f"🔄 Total Attempts : {state.get('attempt_count')}")
    print(f"❌ Unresolved Error:\n{state.get('test_result')}")
    print("="*60 + "\n")
    return {
        "target_files": all_files,
        "history":      state["history"] + ["Handed over to human"],
    }

def should_continue(state: AgentState) -> str:
    if "PASS" in state["test_result"]:
        return END
    max_att = state.get("max_attempts", 5)
    if state["attempt_count"] >= max_att:
        push_log(f"🚨 [Olympus]: Max attempts ({max_att}) reached. Escalating to human review.")
        return "human_call"
    push_log(f"🔄 [Olympus]: Retrying... (attempt {state['attempt_count']} / {max_att})")
    return "try_again"

# 3. Graph Assembly (Phase 3 Multi-Agent Routing Topology)
workflow = StateGraph(AgentState)
workflow.add_node("agent_router", agent_router)
workflow.add_node("import_resolver", import_resolver_agent)
workflow.add_node("type_fix", type_fix_agent)
workflow.add_node("logic_repair", logic_repair_agent)
workflow.add_node("validator", validation_agent)
workflow.add_node("human_gate", human_intervention)

workflow.set_entry_point("agent_router")
workflow.add_conditional_edges(
    "agent_router",
    route_to_specialist,
    {
        "import_resolver": "import_resolver",
        "type_fix":        "type_fix",
        "logic_repair":    "logic_repair",
    }
)
workflow.add_edge("import_resolver", "validator")
workflow.add_edge("type_fix", "validator")
workflow.add_edge("logic_repair", "validator")

workflow.add_conditional_edges(
    "validator",
    should_continue,
    {"try_again": "agent_router", "human_call": "human_gate", END: END}
)
workflow.add_edge("human_gate", END)
app = workflow.compile()

if __name__ == "__main__":
    initial_state = {
        "bug_description": "Initial bug trace",
        "proposed_fix": "",
        "test_result": "Initial run required",
        "attempt_count": 0,
        "max_attempts": 5,
        "target_file": "",
        "target_files": [],       # Populated by fault_localizer in server.py at runtime
        "workspace_dir": "",
        "detected_language": "python",  # Default language for direct execution
        "last_diff": "",
        "error_class": "",
        "agent_used": "",
        "history": []
    }
    
    print("🚀 Starting Project Olympus Execution Pipeline with Phase 3 Agent Router...")
    final_state = app.invoke(initial_state)
    
    if "PASS" in final_state.get("test_result", ""):
        print("\n" + "="*60)
        print("🎉 [STATUS]: SUCCESS - AUTOMATICALLY PATCHED & VERIFIED!")
        print("="*60)
        print(f"📌 Target File : {os.path.basename(final_state.get('target_file', ''))}")
        print(f"🔄 Attempts Taken: {final_state.get('attempt_count')}")
        print(f"🤖 Specialist Used: {final_state.get('agent_used', '')}")
        print("\n🔍 [SUMMARY OF CHANGES (GIT DIFF)]:")
        print(final_state.get("last_diff") or "No visible diff.")
        print("="*60 + "\n")