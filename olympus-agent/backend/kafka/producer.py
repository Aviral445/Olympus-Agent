"""
OlympusProducer — thin Kafka producer wrapper for Project Olympus.

Emits structured JSON events to the `olympus.run.logs` topic.
Uses run_id as the Kafka message key so all events for a run land
on the same partition (ordered delivery guarantee).

Usage:
    from kafka.producer import get_producer
    get_producer().emit(run_id, "log", {"message": "..."})
"""
import os
import json
import threading
from typing import Any, Dict

_producer_lock = threading.Lock()
_producer_instance = None

TOPIC = "olympus.run.logs"


def _get_bootstrap_servers() -> str:
    return os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


def get_producer():
    """Return a process-level singleton OlympusProducer."""
    global _producer_instance
    if _producer_instance is None:
        with _producer_lock:
            if _producer_instance is None:
                _producer_instance = OlympusProducer()
    return _producer_instance


class OlympusProducer:
    """Wraps confluent-kafka Producer with a simple emit() interface."""

    def __init__(self):
        try:
            from confluent_kafka import Producer
            self._producer = Producer({
                "bootstrap.servers": _get_bootstrap_servers(),
                "client.id": "olympus-sre-engine",
                # Reliability: wait for leader ack
                "acks": "1",
                # Reduce latency for real-time log streaming
                "linger.ms": 5,
                "batch.size": 16384,
                # Retries on transient errors
                "retries": 3,
                "retry.backoff.ms": 200,
                # Compression
                "compression.type": "lz4",
            })
            print("🔗 [Kafka Producer]: Connected to", _get_bootstrap_servers())
        except Exception as e:
            print(f"⚠️ [Kafka Producer]: Initialisation failed — {e}")
            self._producer = None

    def emit(self, run_id: str, msg_type: str, payload: Dict[str, Any]) -> None:
        """
        Produce a single event to the olympus.run.logs topic.

        Args:
            run_id:   Unique pipeline run identifier (used as Kafka message key).
            msg_type: Event type — "log" | "complete" | "error"
            payload:  Arbitrary dict that will be JSON-serialised as the message value.
        """
        if self._producer is None:
            return

        event = {"run_id": run_id, "type": msg_type, **payload}
        try:
            self._producer.produce(
                topic=TOPIC,
                key=run_id.encode("utf-8"),
                value=json.dumps(event).encode("utf-8"),
                on_delivery=_delivery_report,
            )
            # Poll to trigger delivery callbacks without blocking
            self._producer.poll(0)
        except Exception as e:
            print(f"⚠️ [Kafka Producer]: Emit error — {e}")

    def flush(self, timeout: float = 5.0) -> None:
        """Flush all buffered messages (call on graceful shutdown)."""
        if self._producer:
            self._producer.flush(timeout)


def _delivery_report(err, msg):
    """Confluent-kafka delivery callback (fires in poll() context)."""
    if err:
        print(f"⚠️ [Kafka]: Delivery failed for key={msg.key()} — {err}")
