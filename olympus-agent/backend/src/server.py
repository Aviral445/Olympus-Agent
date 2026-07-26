import sys
import os
import re
import uuid
import json
import asyncio
import subprocess
from pathlib import Path
from typing import Optional

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

# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Project Olympus SRE API", version="2.1.0")

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


# ─── Workspace helpers ────────────────────────────────────────────────────────

def prepare_workspace(repo_url: str) -> tuple[str, str]:
    """Clone a remote repository into a local workspace if not already present."""
    if not repo_url or not repo_url.startswith("http"):
        return "", ""

    clean_url = repo_url.rstrip("/").removesuffix(".git")
    parts = clean_url.split("/")
    repo_name = f"{parts[-2]}/{parts[-1]}" if len(parts) >= 2 else parts[-1]
    folder_name = parts[-1]

    workspace_dir = os.path.abspath(
        os.path.join(os.path.dirname(__file__), f"../workspaces/{folder_name}")
    )

    if os.path.exists(workspace_dir):
        print(f"📂 [Workspace Manager]: Using existing workspace at {workspace_dir}")
    else:
        print(f"📥 [Workspace Manager]: Cloning {repo_url} → {workspace_dir}...")
        os.makedirs(os.path.dirname(workspace_dir), exist_ok=True)
        Repo.clone_from(repo_url, workspace_dir)

    return workspace_dir, repo_name


def auto_discover_target_file(workspace_dir: str) -> str:
    """Run pytest in workspace, parse failure traceback, return the culprit file."""
    print(f"🔍 [Fault Localizer]: Running automated test discovery in {workspace_dir}...")

    try:
        result = subprocess.run(
            [sys.executable, "-m", "pytest"],
            cwd=workspace_dir,
            capture_output=True,
            text=True,
            timeout=30,
        )
        output = result.stdout + "\n" + result.stderr
        matches = re.findall(r'File\s+"([^"]+\.py)"', output)

        if matches:
            for file_path in matches:
                if not os.path.basename(file_path).startswith("test_"):
                    abs_path = (
                        os.path.abspath(file_path)
                        if os.path.isabs(file_path)
                        else os.path.join(workspace_dir, file_path)
                    )
                    if os.path.exists(abs_path):
                        print(f"🎯 [Fault Localizer]: Culprit file: {abs_path}")
                        return abs_path

            first_match = matches[0]
            abs_path = (
                os.path.abspath(first_match)
                if os.path.isabs(first_match)
                else os.path.join(workspace_dir, first_match)
            )
            if os.path.exists(abs_path):
                return abs_path

    except Exception as e:
        print(f"⚠️ [Fault Localizer]: {e}")

    for root, _, files in os.walk(workspace_dir):
        for f in files:
            if f.endswith(".py") and not f.startswith("test_") and f != "setup.py":
                found_path = os.path.join(root, f)
                print(f"🎯 [Fault Localizer]: Auto-selected: {found_path}")
                return found_path

    return ""


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

    if repo_url:
        workspace_dir_result, parsed_repo_name = prepare_workspace(repo_url)
        if workspace_dir_result:
            workspace_dir = workspace_dir_result
            if not target_repo:
                target_repo = parsed_repo_name

            resolved_target = os.path.join(workspace_dir, target_file) if target_file else ""
            if resolved_target and os.path.exists(resolved_target):
                active_target = resolved_target
            else:
                print(f"🔍 Target file not found — switching to Autonomous Fault Localizer...")
                active_target = auto_discover_target_file(workspace_dir)

    if not active_target:
        active_target = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../target_app/app.py")
        )

    print(f"⚡ [Olympus Engine]: Initiating fix loop on: {active_target}")

    initial_state = {
        "bug_description": "Automated webhook/API trigger",
        "proposed_fix":    "",
        "test_result":     "Initial run required",
        "attempt_count":   0,
        "max_attempts":    max_attempts,
        "target_file":     active_target,
        "workspace_dir":   workspace_dir,
        "last_diff":       "",
        "history":         [],
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
        "version":       "2.1.0",
        "kafka_enabled": is_kafka_enabled(),
    }


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
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)