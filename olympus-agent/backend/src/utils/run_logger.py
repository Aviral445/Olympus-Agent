"""
Thread-safe per-run log store for SSE streaming.

Imported by both server.py (to create/read runs) and core_graph.py (to push logs).
Avoids circular imports — neither server nor graph imports from each other via this module.

Dual-mode operation (controlled by KAFKA_ENABLED env var):
──────────────────────────────────────────────────────────
  KAFKA_ENABLED=true  → push_log() emits to Kafka topic 'olympus.run.logs'
                        complete_run() emits a terminal 'complete' Kafka event
                        In-memory store is still updated as a snapshot cache
                        for the /api/v1/status fallback.

  KAFKA_ENABLED=false (default)
                      → Identical to previous in-memory-only behaviour.
                        No Kafka dependency required at runtime.
"""
import os
import threading
from threading import Lock
from typing import Optional

# ─── In-memory run store (always active — used as snapshot cache) ─────────────
_thread_local = threading.local()
_run_store: dict[str, dict] = {}
_store_lock = Lock()

# ─── Kafka mode detection ──────────────────────────────────────────────────────
_KAFKA_ENABLED: bool = os.getenv("KAFKA_ENABLED", "false").lower() == "true"

if _KAFKA_ENABLED:
    try:
        # Lazy import — only required when Kafka mode is on
        from kafka.producer import get_producer as _get_kafka_producer
        _kafka_ok = True
        print("🔗 [run_logger]: Kafka mode ENABLED — events will be streamed via Kafka.")
    except ImportError:
        _kafka_ok = False
        _KAFKA_ENABLED = False
        print("⚠️ [run_logger]: KAFKA_ENABLED=true but confluent-kafka not installed — falling back to in-memory mode.")
else:
    _kafka_ok = False


# ─── Public API ───────────────────────────────────────────────────────────────

def create_run(run_id: str) -> None:
    """Initialize storage for a new pipeline run."""
    with _store_lock:
        _run_store[run_id] = {"logs": [], "done": False, "result": None, "diff": ""}


def set_run_context(run_id: str) -> None:
    """Bind a run_id to the current background thread so push_log knows where to write."""
    _thread_local.run_id = run_id


def push_log(message: str) -> None:
    """
    Push a log line for the run bound to the calling thread.

    In Kafka mode: emits a {"type": "log", "message": ...} event to Kafka.
    Always: appends to the in-memory store for snapshot/status queries.
    No-op if no run context is set on the calling thread.
    """
    run_id: Optional[str] = getattr(_thread_local, "run_id", None)
    if not run_id:
        return

    # Always update in-memory snapshot cache
    with _store_lock:
        entry = _run_store.get(run_id)
        if entry is not None:
            entry["logs"].append(message)

    # Optionally emit to Kafka
    if _KAFKA_ENABLED and _kafka_ok:
        try:
            _get_kafka_producer().emit(run_id, "log", {"message": message})
        except Exception as e:
            print(f"⚠️ [run_logger/Kafka]: push_log error — {e}")


def complete_run(run_id: str, result: str, diff: str = "") -> None:
    """
    Mark a run as finished.

    In Kafka mode: emits a {"type": "complete", "result": ..., "diff": ...} terminal event.
    Always: updates the in-memory snapshot so status polling still works.
    """
    with _store_lock:
        entry = _run_store.get(run_id)
        if entry is not None:
            entry["done"] = True
            entry["result"] = result
            entry["diff"] = diff

    if _KAFKA_ENABLED and _kafka_ok:
        try:
            _get_kafka_producer().emit(run_id, "complete", {"result": result, "diff": diff})
            # Flush immediately so the terminal event reaches the consumer before the
            # SSE generator's poll loop times out.
            _get_kafka_producer().flush(timeout=3.0)
        except Exception as e:
            print(f"⚠️ [run_logger/Kafka]: complete_run error — {e}")


def get_run_snapshot(run_id: str) -> dict:
    """Return a safe copy of the run state for the SSE reader / status API."""
    with _store_lock:
        entry = _run_store.get(run_id)
        if entry is None:
            return {}
        return {
            "logs":   list(entry["logs"]),
            "done":   entry["done"],
            "result": entry["result"],
            "diff":   entry["diff"],
        }


def is_kafka_enabled() -> bool:
    """Expose the effective Kafka mode flag for use in server.py."""
    return _KAFKA_ENABLED and _kafka_ok
