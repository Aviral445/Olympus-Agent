"""
Thread-safe per-run log store for SSE streaming.
Imported by both server.py (to create/read runs) and core_graph.py (to push logs).
Avoids circular imports — neither server nor graph imports from each other via this module.
"""
import threading
from threading import Lock
from typing import Optional

_thread_local = threading.local()
_run_store: dict[str, dict] = {}
_store_lock = Lock()


def create_run(run_id: str) -> None:
    """Initialize storage for a new pipeline run."""
    with _store_lock:
        _run_store[run_id] = {"logs": [], "done": False, "result": None, "diff": ""}


def set_run_context(run_id: str) -> None:
    """Bind a run_id to the current background thread so push_log knows where to write."""
    _thread_local.run_id = run_id


def push_log(message: str) -> None:
    """Push a log line for the run bound to the calling thread. No-op if no context set."""
    run_id: Optional[str] = getattr(_thread_local, "run_id", None)
    if not run_id:
        return
    with _store_lock:
        entry = _run_store.get(run_id)
        if entry is not None:
            entry["logs"].append(message)


def complete_run(run_id: str, result: str, diff: str = "") -> None:
    """Mark a run as finished with a final result status and optional patch diff."""
    with _store_lock:
        entry = _run_store.get(run_id)
        if entry is not None:
            entry["done"] = True
            entry["result"] = result
            entry["diff"] = diff


def get_run_snapshot(run_id: str) -> dict:
    """Return a safe copy of the run state for the SSE reader."""
    with _store_lock:
        entry = _run_store.get(run_id)
        if entry is None:
            return {}
        return {
            "logs": list(entry["logs"]),
            "done": entry["done"],
            "result": entry["result"],
            "diff": entry["diff"],
        }
