"""
OlympusConsumer — per-SSE-connection Kafka consumer for Project Olympus.

Each SSE connection spawns a dedicated consumer that reads events from
the `olympus.run.logs` topic and filters by run_id (message key).

Design:
  - One consumer group per SSE connection (unique group.id = run_id)
  - Reads from the beginning of the topic (latest run events)
  - Yields events until a "complete" or "error" event is received

Usage (inside an async generator):
    consumer = OlympusConsumer(run_id)
    for event in consumer.stream():
        yield event
    consumer.close()
"""
import os
import json
from typing import Generator, Dict, Any

TOPIC = "olympus.run.logs"
_MAX_EMPTY_POLLS = 150   # ~30 s with 200 ms poll timeout before giving up


def _get_bootstrap_servers() -> str:
    return os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


class OlympusConsumer:
    """
    Reads events for a specific run_id from the Kafka log topic.

    Each instance owns an independent consumer group so replays are isolated
    and multiple SSE clients for the same run_id each get a full copy.
    """

    def __init__(self, run_id: str):
        self.run_id = run_id
        self._consumer = None
        try:
            from confluent_kafka import Consumer, TopicPartition, OFFSET_BEGINNING
            self._Consumer = Consumer
            self._TopicPartition = TopicPartition
            self._OFFSET_BEGINNING = OFFSET_BEGINNING

            self._consumer = Consumer({
                "bootstrap.servers": _get_bootstrap_servers(),
                # Unique group per connection — ensures full replay from start
                "group.id": f"olympus-sse-{run_id}",
                "auto.offset.reset": "earliest",
                "enable.auto.commit": True,
                "auto.commit.interval.ms": 1000,
                "session.timeout.ms": 10000,
                "max.poll.interval.ms": 30000,
            })
            self._consumer.subscribe([TOPIC])
        except Exception as e:
            print(f"⚠️ [Kafka Consumer]: Init failed for run {run_id} — {e}")
            self._consumer = None

    def stream(self) -> Generator[Dict[str, Any], None, None]:
        """
        Yield decoded event dicts for this run until a terminal event.

        Yields dicts matching the shape written by OlympusProducer.emit():
            {"run_id": str, "type": "log"|"complete"|"error", ...}

        Stops when:
          - A "complete" or "error" event for this run_id is received
          - The Kafka consumer is unavailable (graceful degradation)
        """
        if self._consumer is None:
            return

        empty_polls = 0

        try:
            while True:
                msg = self._consumer.poll(timeout=0.2)

                if msg is None:
                    empty_polls += 1
                    if empty_polls >= _MAX_EMPTY_POLLS:
                        # Timeout safety — stop if no messages for ~30 s
                        print(f"⏱️ [Kafka Consumer]: Timeout waiting for run {self.run_id}")
                        break
                    continue

                if msg.error():
                    print(f"⚠️ [Kafka Consumer]: Poll error — {msg.error()}")
                    continue

                empty_polls = 0  # Reset on successful message

                # Filter by run_id (message key)
                key = msg.key()
                if key and key.decode("utf-8") != self.run_id:
                    continue

                try:
                    event = json.loads(msg.value().decode("utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue

                yield event

                # Terminal events — stop consuming
                if event.get("type") in ("complete", "error"):
                    break

        finally:
            self.close()

    def close(self) -> None:
        """Cleanly close the consumer and release the group membership."""
        if self._consumer:
            try:
                self._consumer.close()
            except Exception:
                pass
            self._consumer = None
