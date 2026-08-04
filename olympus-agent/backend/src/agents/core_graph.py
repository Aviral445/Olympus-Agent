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
from utils.code_graph import build_repository_map
from utils.telemetry import trace_span
from utils.sandbox import run_in_sandbox
from utils.git_manager import init_fix_branch, generate_patch_diff, commit_patch
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
            # FIX: corrected URL — was accidentally stored with markdown link syntax
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

# 2. Agent Nodes
def patch_agent(state: AgentState) -> Dict:
    current_attempts = state.get("attempt_count", 0) + 1

    with trace_span("patch_agent", {"attempt": current_attempts}):
        # ── Build the ordered list of files to patch this cycle ────────────────
        target_files: List[str] = state.get("target_files") or []
        primary_file = state.get("target_file", "")

        # Ensure primary_file is always first in the list (de-duplicated)
        if primary_file and primary_file not in target_files:
            target_files = [primary_file] + target_files

        # Final fallback — if nothing was resolved, use the default target_app file
        if not target_files or not any(os.path.exists(f) for f in target_files):
            fallback = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "../../target_app/app.py")
            )
            target_files = [fallback]

        # Filter to only files that actually exist on disk
        target_files = [f for f in target_files if os.path.exists(f)]
        active_primary = target_files[0] if target_files else primary_file

        header_msg = (
            f"\n🤖 [Patch Agent]: Attempt #{current_attempts} — "
            f"targeting {len(target_files)} file(s): "
            f"{[os.path.basename(f) for f in target_files]}"
        )
        print(header_msg)
        push_log(header_msg)

        # ── Shared RAG / Memory context (built once per attempt cycle) ─────────
        # Re-index using the directory of the primary target file
        target_dir = os.path.dirname(active_primary)
        index_codebase_rag(target_dir)

        rag_code_context = retrieve_relevant_code_context(state.get("test_result", ""))
        memory_lessons   = retrieve_similar_experiences(state.get("test_result", ""))

        # ── Per-file patch loop ────────────────────────────────────────────────
        combined_diff     = ""
        last_fixed_code   = ""
        patched_files: List[str] = []
        sast_blocked: List[str]  = []

        # Create/switch branch once before the loop so all file commits land together
        init_fix_branch(f"olympus/patch-attempt-{current_attempts}")

        for file_path in target_files:
            file_name = os.path.basename(file_path)
            push_log(f"🔧 [Patch Agent]: Patching {file_name}...")

            try:
                with open(file_path, "r", encoding="utf-8") as fh:
                    current_code = fh.read()
            except OSError as read_err:
                push_log(f"⚠️ [Patch Agent]: Cannot read {file_name} — {read_err}. Skipping.")
                continue

            # Select language-aware prompt template
            lang = state.get("detected_language", "python") or "python"
            lang_instruction = LANG_PROMPTS.get(lang, _DEFAULT_LANG_PROMPT)

            prompt = f"""
        {lang_instruction}

        {rag_code_context}

        {memory_lessons}

        Target File: {file_name}
        Code:
        {current_code}

        Failure Output & Error Traceback:
        {state['test_result']}

        INSTRUCTIONS:
        - Inspect the retrieved test assertions and error tracebacks carefully.
        - Pay close attention to boundary condition checks (e.g. return 0 vs raise ValueError).
        - Satisfy all test assertions at once without causing oscillation.
        - Only output the corrected code for {file_name}. Do not include any other files.
            """

            push_log(f"🧠 [LLM Engine]: Generating patch for {file_name}...")
            try:
                raw_response = invoke_llm_with_fallback(prompt)
            except Exception as llm_err:
                push_log(f"❌ [LLM Engine]: Failed for {file_name} — {llm_err}. Skipping.")
                continue

            fixed_code = clean_llm_code_output(raw_response)

            # SAST gate — scan proposed code in a temp file before writing
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
                continue  # Try remaining files in the list

            push_log(f"✅ [SAST Gate]: {file_name} passed. Applying...")
            os.replace(temp_path, file_path)  # Atomic swap after SAST pass

            file_diff = generate_patch_diff(file_path)
            if file_diff:
                combined_diff += f"\n# --- {file_name} ---\n{file_diff}"
                diff_msg = f"\n🔍 [Git Diff / {file_name}]:\n{file_diff}\n"
                print(diff_msg)
                push_log(diff_msg)

            sign_patch_attestation(file_diff or "", f"patch-attempt-{current_attempts}-{file_name}")
            commit_patch(file_path, current_attempts)

            patched_files.append(file_path)
            last_fixed_code = fixed_code
            push_log(f"📝 [Patch Agent]: Committed patch for {file_name}")

        # ── Summarise attempt results ─────────────────────────────────────────
        if not patched_files:
            # All files were SAST-blocked or errored
            fail_msg = (
                f"🚨 [Patch Agent]: Attempt #{current_attempts} — no files patched "
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
                "history":       state["history"] + [f"SAST gate blocked all patches v{current_attempts}"],
            }

        done_msg = (
            f"📝 [Patch Agent]: Attempt #{current_attempts} complete — "
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
            "history":       state["history"] + [f"Applied fix v{current_attempts} to {len(patched_files)} file(s)"],
        }


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

        # ── Re-discover culprit files from the new failure traceback ──────────
        # Parse ALL non-test .py references so the next patch cycle targets every
        # file that the new failure mentions — not just the original primary.
        base_dir = workspace_dir or os.path.dirname(target_file_path)

        updated_files: List[str] = []
        seen_paths: set = set()

        # Pattern 1 — pytest / CPython: File "path.py"
        # Pattern 2 — ruff/bandit style: path.py:lineno
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

        # Fall back to the current primary if nothing new was found
        if not updated_files:
            updated_files = [target_file_path]

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
    # FIX: use max_attempts from state (passed in by API) instead of hardcoded 5
    max_att = state.get("max_attempts", 5)
    if state["attempt_count"] >= max_att:
        push_log(f"🚨 [Olympus]: Max attempts ({max_att}) reached. Escalating to human review.")
        return "human_call"
    push_log(f"🔄 [Olympus]: Retrying... (attempt {state['attempt_count']} / {max_att})")
    return "try_again"

# 3. Graph Assembly
workflow = StateGraph(AgentState)
workflow.add_node("patcher", patch_agent)
workflow.add_node("validator", validation_agent)
workflow.add_node("human_gate", human_intervention)

workflow.set_entry_point("patcher")
workflow.add_edge("patcher", "validator")
workflow.add_conditional_edges(
    "validator",
    should_continue,
    {"try_again": "patcher", "human_call": "human_gate", END: END}
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
        "last_diff": "",
        "history": []
    }
    
    print("🚀 Starting Project Olympus Execution Pipeline with Tree-sitter RAG & Memory...")
    final_state = app.invoke(initial_state)
    
    if "PASS" in final_state.get("test_result", ""):
        print("\n" + "="*60)
        print("🎉 [STATUS]: SUCCESS - AUTOMATICALLY PATCHED & VERIFIED!")
        print("="*60)
        print(f"📌 Target File : {os.path.basename(final_state.get('target_file', ''))}")
        print(f"🔄 Attempts Taken: {final_state.get('attempt_count')}")
        print("\n🔍 [SUMMARY OF CHANGES (GIT DIFF)]:")
        print(final_state.get("last_diff") or "No visible diff.")
        print("="*60 + "\n")