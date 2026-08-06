import sys
import io
import os
import re
import uuid
import json
import asyncio
import subprocess
from pathlib import Path
from typing import Optional

# Force UTF-8 output on Windows for emojis
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv, find_dotenv
from git import Repo

# ─── Path setup ───────────────────────────────────────────────────────────────
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(find_dotenv(), override=True)

from src.agents.core_graph import app as graph_app
from database.db import init_db, get_runs
from utils.github_pr import create_github_pull_request
from utils.run_logger import (
    create_run, set_run_context, complete_run,
    get_run_snapshot, is_kafka_enabled,
)
from utils.fault_localizer import discover_fault, extract_all_culprits
from utils.language_detector import detect_repo_language, LANGUAGE_META
from utils.code_graph import build_import_graph, graph_to_serializable


# ─── Global Stores ────────────────────────────────────────────────────────────
_graph_store: dict[str, dict] = {}


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Project Olympus SRE API", version="3.0.0")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database and, if Kafka mode is active, create required topics."""
    init_db()
    if is_kafka_enabled():
        try:
            from kafka.admin import ensure_topics
            ensure_topics()
            print("✅ [Startup]: Kafka topics verified.")
        except Exception as e:
            print(f"⚠️ [Startup]: Kafka topic setup warning — {e}")
    else:
        print("ℹ️  [Startup]: Kafka mode OFF — using in-memory SSE log bus.")


# ─── Pydantic models ──────────────────────────────────────────────────────────

class TriggerRequest(BaseModel):
    bug_description: str = "Automated bug report trigger"
    target_file: str = ""
    repo_url: str = ""
    repo_name: str = ""
    max_attempts: int = 5


class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 3
    collection: str = "codebase_chunks"   # "codebase_chunks" | "patch_experience"


def parse_github_url(url: str) -> tuple[str, str, str]:
    """
    Parses any GitHub URL variant into: (clean_repo_url, repo_name, extracted_target_file)
    Handles:
      https://github.com/owner/repo/blob/main/path/to/file.py
      https://github.com/owner/repo/tree/main/src/app.py
      https://github.com/owner/repo.git
      https://github.com/owner/repo
    """
    if not url or not url.startswith("http"):
        return url, "", ""

    clean = url.rstrip("/").removesuffix(".git")
    parts = clean.split("/")

    if len(parts) >= 5 and ("github.com" in parts[2] or "www.github.com" in parts[2]):
        owner = parts[3]
        repo = parts[4]
        repo_name = f"{owner}/{repo}"
        clean_repo_url = f"https://github.com/{owner}/{repo}"

        extracted_file = ""
        if len(parts) > 6 and parts[5] in ("blob", "tree"):
            extracted_file = "/".join(parts[7:])

        return clean_repo_url, repo_name, extracted_file

    return url, "", ""


def prepare_workspace(raw_repo_url: str) -> tuple[str, str, str]:
    """Clone or incrementally update a local workspace for a remote repo.

    Supports direct repo URLs and file blob URLs.
    Returns (workspace_dir, repo_name, extracted_target_file)
    """
    repo_url, repo_name, extracted_file = parse_github_url(raw_repo_url)
    if not repo_url or not repo_url.startswith("http"):
        return "", "", ""

    folder_name = repo_name.split("/")[-1] if "/" in repo_name else "workspace"

    workspace_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), f"../workspaces/{folder_name}")
    )

    if os.path.exists(workspace_dir):
        print(f"📂 [Workspace Manager]: Workspace found at {workspace_dir} — pulling latest changes...")
        try:
            repo = Repo(workspace_dir)
            origin = repo.remotes.origin
            pull_info = origin.pull()
            for info in pull_info:
                print(f"   ↳ {info.ref}: {info.note or 'up to date'}")
            print("✅ [Workspace Manager]: Workspace is up to date.")
        except Exception as pull_err:
            print(f"⚠️ [Workspace Manager]: git pull failed ({pull_err}) — proceeding with cached workspace.")
    else:
        print(f"📥 [Workspace Manager]: Cloning {repo_url} → {workspace_dir}...")
        os.makedirs(os.path.dirname(workspace_dir), exist_ok=True)
        Repo.clone_from(repo_url, workspace_dir)
        print("✅ [Workspace Manager]: Clone complete.")

    return workspace_dir, repo_name, extracted_file


# auto_discover_target_file() has been replaced by the multi-strategy
# discover_fault() imported from utils.fault_localizer — see that module.


# ─── Pipeline runner ──────────────────────────────────────────────────────────

def run_olympus_pipeline(
    run_id: str,
    target_file: str = "",
    repo_url: str = "",
    repo_name: str = "",
    max_attempts: int = 5,
):
    """Execute the LangGraph repair loop and open a PR on success."""
    set_run_context(run_id)

    active_target = target_file
    target_repo = repo_name
    workspace_dir = ""

    # Discovered error context from the multi-strategy fault localizer
    discovered_error_ctx = ""
    # All culprit files (multi-file patching)
    target_files: list[str] = []

    if repo_url:
        workspace_dir_result, parsed_repo_name, extracted_file = prepare_workspace(repo_url)
        if extracted_file and not target_file:
            target_file = os.path.normpath(extracted_file)


        if workspace_dir_result:
            workspace_dir = workspace_dir_result
            if not target_repo:
                target_repo = parsed_repo_name

            resolved_target = os.path.join(workspace_dir, target_file) if target_file else ""
            if resolved_target and os.path.exists(resolved_target):
                active_target = resolved_target
                # Still run the localizer for error context even if the target file is explicit
                _, discovered_error_ctx = discover_fault(workspace_dir)
            else:
                print("[Fault Localizer]: Target not specified/found — running multi-strategy discovery...")
                active_target, discovered_error_ctx = discover_fault(workspace_dir)

            # Extract ALL culprit files from the error context for multi-file patching
            if discovered_error_ctx:
                target_files = extract_all_culprits(discovered_error_ctx, workspace_dir)
                if active_target and active_target not in target_files:
                    target_files.insert(0, active_target)


    if not active_target:
        active_target = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../target_app/app.py")
        )

    if not target_files:
        target_files = [active_target]

    # ── Language Detection (Phase 2) ──────────────────────────────────────────────────────────────────────────────
    detected_language = "python"
    if workspace_dir:
        detected_language = detect_repo_language(workspace_dir)
        meta = LANGUAGE_META.get(detected_language, {})
        print(
            f"[Language Detector]: Primary language → {detected_language} "
            f"{meta.get('emoji', '')} | "
            f"Sandbox runner and SAST ruleset set accordingly."
        )



    # ── Dependency Graph Extraction (Phase 3) ───────────────────────────────────
    graph_target = workspace_dir or os.path.dirname(active_target)
    if graph_target and os.path.exists(graph_target):
        try:
            raw_g = build_import_graph(graph_target)
            _graph_store[run_id] = graph_to_serializable(raw_g, graph_target)
            print(f"🕸️ [Dependency Graph]: Stored import graph for run {run_id} ({len(_graph_store[run_id]['nodes'])} nodes).")
        except Exception as ge:
            print(f"⚠️ [Dependency Graph Error]: {ge}")

    # Seed the initial test_result with the discovered error context so the
    # patcher has a meaningful signal even before the first sandbox run.
    seed_error = discovered_error_ctx or "Initial run required"

    initial_state = {
        "bug_description":   discovered_error_ctx or "Automated webhook/API trigger",
        "proposed_fix":      "",
        "test_result":       seed_error,
        "attempt_count":     0,
        "max_attempts":      max_attempts,
        "target_file":       active_target,
        "target_files":      target_files,
        "workspace_dir":     workspace_dir,
        "detected_language": detected_language,
        "last_diff":         "",
        "error_class":       "",   # Populated by agent_router on first iteration
        "agent_used":        "",   # Populated by agent_router on first iteration
        "history":           [],
    }


    final_state = graph_app.invoke(initial_state)
    final_diff = final_state.get("last_diff", "")

    if "PASS" in final_state.get("test_result", ""):
        print("🎉 [Olympus Pipeline]: Patch succeeded! Opening GitHub PR...")
        attempts = final_state.get("attempt_count", 1)
        branch_name = f"olympus/patch-attempt-{attempts}"
        final_repo = target_repo if target_repo else os.getenv("GITHUB_REPO", "")

        if final_repo:
            create_github_pull_request(
                repo_name=final_repo,
                branch_name=branch_name,
                patch_diff=final_diff,
                target_file=active_target,
                attempts_taken=attempts,
            )

        complete_run(run_id, result="PASS", diff=final_diff)
    else:
        complete_run(run_id, result="FAIL", diff=final_diff)


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status":        "healthy",
        "service":       "Project Olympus SRE Engine",
        "version":       "3.0.0",
        "kafka_enabled": is_kafka_enabled(),
    }


@app.get("/api/v1/dependency-graph")
def get_dependency_graph(run_id: Optional[str] = None, workspace_dir: Optional[str] = None):
    """
    Returns the JSON import graph {nodes: [], edges: []} for the given run_id or workspace.
    """
    if run_id and run_id in _graph_store:
        return _graph_store[run_id]

    target_dir = workspace_dir
    if not target_dir:
        target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../target_app"))

    if target_dir and os.path.exists(target_dir):
        raw = build_import_graph(target_dir)
        return graph_to_serializable(raw, target_dir)

    return {"nodes": [], "edges": []}


@app.get("/api/v1/runs")
def list_runs(limit: int = 50):
    """Return paginated run history from the SQLite audit log."""
    runs = get_runs(limit=min(limit, 200))
    return {"runs": runs, "count": len(runs)}



@app.get("/api/v1/stream/{run_id}")
async def stream_run_logs(run_id: str):
    """
    SSE endpoint — streams real-time log messages for a pipeline run.

    Dual-mode:
      Kafka mode   → reads from olympus.run.logs Kafka topic (replay-safe)
      In-memory    → polls _run_store every 400 ms (current behaviour)
    """
    snapshot = get_run_snapshot(run_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

    if is_kafka_enabled():
        return _kafka_sse_response(run_id)
    else:
        return _inmemory_sse_response(run_id)


def _kafka_sse_response(run_id: str) -> StreamingResponse:
    """SSE generator backed by a Kafka consumer."""
    from kafka.consumer import OlympusConsumer

    async def event_generator():
        consumer = OlympusConsumer(run_id)
        loop = asyncio.get_event_loop()

        # Run the blocking Kafka poll in a thread pool to avoid blocking the event loop
        for event in await loop.run_in_executor(None, lambda: list(consumer.stream())):
            if event.get("type") == "log":
                payload = json.dumps({"type": "log", "message": event.get("message", "")})
                yield f"data: {payload}\n\n"
            elif event.get("type") == "complete":
                final = json.dumps({
                    "type":   "complete",
                    "result": event.get("result"),
                    "diff":   event.get("diff", ""),
                })
                yield f"data: {final}\n\n"
                break
            await asyncio.sleep(0)  # Yield control back to event loop

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _inmemory_sse_response(run_id: str) -> StreamingResponse:
    """SSE generator backed by the in-memory run store (original behaviour)."""
    async def event_generator():
        last_idx = 0
        while True:
            snap = get_run_snapshot(run_id)
            logs = snap.get("logs", [])

            while last_idx < len(logs):
                payload = json.dumps({"type": "log", "message": logs[last_idx]})
                yield f"data: {payload}\n\n"
                last_idx += 1

            if snap.get("done"):
                final = json.dumps({
                    "type":   "complete",
                    "result": snap.get("result"),
                    "diff":   snap.get("diff", ""),
                })
                yield f"data: {final}\n\n"
                break

            await asyncio.sleep(0.4)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.post("/api/v1/trigger")
def trigger_fix(req: TriggerRequest, background_tasks: BackgroundTasks):
    """Manual or API-driven trigger. Returns run_id for SSE log streaming."""
    run_id = str(uuid.uuid4())
    create_run(run_id)

    background_tasks.add_task(
        run_olympus_pipeline,
        run_id=run_id,
        target_file=req.target_file,
        repo_url=req.repo_url,
        repo_name=req.repo_name,
        max_attempts=req.max_attempts,
    )
    return {
        "status":      "initiated",
        "run_id":      run_id,
        "message":     "Olympus repair pipeline running. Connect to /api/v1/stream/{run_id} for live logs.",
        "target_file": req.target_file or "Autonomous Auto-Detect",
        "repo_url":    req.repo_url,
    }


@app.post("/api/v1/rag/query")
def rag_query(req: RAGQueryRequest):
    """
    Query the RAG knowledge base and return ranked code/experience chunks.

    Body:
        query      (str)  — search text (error log, code description, etc.)
        top_k      (int)  — number of results (default 3, max 20)
        collection (str)  — "codebase_chunks" or "patch_experience"

    Returns:
        {"results": [...], "query": str, "collection": str, "count": int}
    """
    try:
        from rag.rag_api import query_rag, VALID_COLLECTIONS
        if req.collection not in VALID_COLLECTIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid collection '{req.collection}'. Valid: {list(VALID_COLLECTIONS)}",
            )

        top_k = min(max(req.top_k, 1), 20)
        results = query_rag(
            query_text=req.query,
            top_k=top_k,
            collection_name=req.collection,
        )
        return {
            "results":    results,
            "query":      req.query,
            "collection": req.collection,
            "count":      len(results),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query error: {e}")


@app.post("/api/v1/github-webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """Listens for GitHub Webhook events and triggers the repair pipeline."""
    payload = await request.json()
    repo_name = payload.get("repository", {}).get("full_name", "")
    repo_url  = payload.get("repository", {}).get("html_url", "")
    action    = payload.get("action", "")

    print(f"📩 [Webhook Received]: Repo: '{repo_name}' | Action: '{action}'")

    run_id = str(uuid.uuid4())
    create_run(run_id)

    background_tasks.add_task(
        run_olympus_pipeline,
        run_id=run_id,
        repo_url=repo_url,
        repo_name=repo_name,
    )
    return {"status": "received", "repo": repo_name, "run_id": run_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)