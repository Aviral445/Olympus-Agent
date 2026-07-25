import sys
import os
import re
import uuid
import json
import asyncio
import subprocess
from pathlib import Path
from fastapi import FastAPI, Request, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv, find_dotenv
from git import Repo  # Fixed case-sensitivity: lowercase 'git'

# Ensure backend pathing is cleanly resolved
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(find_dotenv(), override=True)

from src.agents.core_graph import app as graph_app
from database.db import init_db
from utils.github_pr import create_github_pull_request
from utils.run_logger import create_run, set_run_context, complete_run, get_run_snapshot

app = FastAPI(title="Project Olympus SRE API", version="2.0")

# Enable CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize persistent database
init_db()


# Unified Pydantic Request Model
class TriggerRequest(BaseModel):
    bug_description: str = "Automated bug report trigger"
    target_file: str = ""       # Optional: leave blank for Autonomous Fault Auto-Detection
    repo_url: str = ""          # e.g., "https://github.com/Aviral445/Imagex"
    repo_name: str = ""         # e.g., "Aviral445/Imagex"
    max_attempts: int = 5


def prepare_workspace(repo_url: str) -> tuple[str, str]:
    """Clones a remote repository into a temporary workspace if provided.
    Returns (workspace_dir, parsed_repo_name).
    """
    if not repo_url or not repo_url.startswith("http"):
        return "", ""

    # Clean URL and extract 'owner/repo'
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
        print(f"📥 [Workspace Manager]: Cloning remote repo {repo_url} into {workspace_dir}...")
        os.makedirs(os.path.dirname(workspace_dir), exist_ok=True)
        Repo.clone_from(repo_url, workspace_dir)

    return workspace_dir, repo_name


def auto_discover_target_file(workspace_dir: str) -> str:
    """Runs pytest in the workspace, parses failure stack trace, and returns the broken file path."""
    print(f"🔍 [Fault Localizer]: Running automated test discovery in {workspace_dir}...")
    
    try:
        # Execute pytest in the context of the cloned workspace
        result = subprocess.run(
            [sys.executable, "-m", "pytest"],
            cwd=workspace_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        output = result.stdout + "\n" + result.stderr
        
        # Parse output for failing Python file paths from tracebacks
        matches = re.findall(r'File\s+"([^"]+\.py)"', output)
        
        if matches:
            for file_path in matches:
                # Prioritize primary source files over test suite files
                if not os.path.basename(file_path).startswith("test_"):
                    abs_path = os.path.abspath(file_path) if os.path.isabs(file_path) else os.path.join(workspace_dir, file_path)
                    if os.path.exists(abs_path):
                        print(f"🎯 [Fault Localizer]: Identified culprit file from traceback: {abs_path}")
                        return abs_path
            
            # Fallback to first matched file
            first_match = matches[0]
            abs_path = os.path.abspath(first_match) if os.path.isabs(first_match) else os.path.join(workspace_dir, first_match)
            if os.path.exists(abs_path):
                return abs_path

    except Exception as e:
        print(f"⚠️ [Fault Localizer]: Test execution warning: {e}")

    # Fallback: Scan repository tree for main Python source files
    for root, _, files in os.walk(workspace_dir):
        for f in files:
            if f.endswith(".py") and not f.startswith("test_") and f != "setup.py":
                found_path = os.path.join(root, f)
                print(f"🎯 [Fault Localizer]: Auto-selected primary source file: {found_path}")
                return found_path

    return ""


def run_olympus_pipeline(
    run_id: str,
    target_file: str = "",
    repo_url: str = "",
    repo_name: str = "",
    max_attempts: int = 5
):
    """Executes the LangGraph repair loop and opens a PR on success."""
    # Bind this background thread to the run so push_log() knows where to write
    set_run_context(run_id)

    active_target = target_file
    target_repo = repo_name
    workspace_dir = ""

    # 1. Handle remote repo cloning & fault localization if repo_url is provided
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
                print(f"🔍 Target file '{target_file}' not specified or not found. Switching to Autonomous Fault Localizer...")
                active_target = auto_discover_target_file(workspace_dir)

    # 2. Fallback for local workspace if no active_target resolved
    if not active_target:
        active_target = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../target_app/app.py")
        )

    print(f"⚡ [Olympus Engine]: Initiating fix loop on target file: {active_target}")

    initial_state = {
        "bug_description": "Automated webhook/API trigger",
        "proposed_fix": "",
        "test_result": "Initial run required",
        "attempt_count": 0,
        "max_attempts": max_attempts,      # FIX: now threaded from API request
        "target_file": active_target,
        "workspace_dir": workspace_dir,    # FIX: passed for sandbox to mount correctly
        "last_diff": "",
        "history": [],
    }

    final_state = graph_app.invoke(initial_state)
    final_diff = final_state.get("last_diff", "")

    if "PASS" in final_state.get("test_result", ""):
        print("🎉 [Olympus Pipeline]: Patch succeeded! Opening GitHub Pull Request...")
        attempts = final_state.get("attempt_count", 1)
        patch_diff = final_diff
        branch_name = f"olympus/patch-attempt-{attempts}"

        final_repo = target_repo if target_repo else os.getenv("GITHUB_REPO", "")

        if final_repo:
            create_github_pull_request(
                repo_name=final_repo,
                branch_name=branch_name,
                patch_diff=patch_diff,
                target_file=active_target,
                attempts_taken=attempts,
            )

        complete_run(run_id, result="PASS", diff=patch_diff)
    else:
        complete_run(run_id, result="FAIL", diff=final_diff)


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Project Olympus SRE Engine"}


@app.get("/api/v1/stream/{run_id}")
async def stream_run_logs(run_id: str):
    """
    SSE endpoint: streams real-time log messages for a pipeline run to the frontend.
    The frontend connects here immediately after triggering a fix and reads until 'done'.
    """
    snapshot = get_run_snapshot(run_id)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")

    async def event_generator():
        last_idx = 0
        while True:
            snap = get_run_snapshot(run_id)
            logs = snap.get("logs", [])

            # Flush all newly arrived log lines
            while last_idx < len(logs):
                payload = json.dumps({"type": "log", "message": logs[last_idx]})
                yield f"data: {payload}\n\n"
                last_idx += 1

            if snap.get("done"):
                # Send final completion event with result + diff, then close
                final = json.dumps({
                    "type": "complete",
                    "result": snap.get("result"),
                    "diff": snap.get("diff", ""),
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
    """Manual or API-driven trigger endpoint. Returns a run_id for SSE log streaming."""
    run_id = str(uuid.uuid4())
    create_run(run_id)  # Reserve log store slot before background task starts

    background_tasks.add_task(
        run_olympus_pipeline,
        run_id=run_id,
        target_file=req.target_file,
        repo_url=req.repo_url,
        repo_name=req.repo_name,
        max_attempts=req.max_attempts,
    )
    return {
        "status": "initiated",
        "run_id": run_id,
        "message": "Olympus repair pipeline running. Connect to /api/v1/stream/{run_id} for live logs.",
        "target_file": req.target_file or "Autonomous Auto-Detect",
        "repo_url": req.repo_url,
    }


@app.post("/api/v1/github-webhook")
async def github_webhook(request: Request, background_tasks: BackgroundTasks):
    """Listens for GitHub Webhook events."""
    payload = await request.json()
    repo_name = payload.get("repository", {}).get("full_name", "")
    repo_url = payload.get("repository", {}).get("html_url", "")
    action = payload.get("action", "")

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