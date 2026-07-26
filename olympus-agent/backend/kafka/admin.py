"""
Kafka topic administration for Project Olympus.

Called once during FastAPI startup to ensure required topics exist.
Uses the confluent-kafka AdminClient so no separate CLI tool is needed.

Topics created:
  - olympus.run.logs  (4 partitions, 24h retention)
"""
import os
from typing import List


TOPICS_CONFIG = [
    {
        "name": "olympus.run.logs",
        "num_partitions": 4,
        "replication_factor": 1,
        "config": {
            # 24 h retention — long enough for SSE replay of any reasonable run
            "retention.ms": str(24 * 60 * 60 * 1000),
            # 10 MB segment files
            "segment.bytes": str(10 * 1024 * 1024),
            # Compact + delete strategy: keep latest + enforce retention
            "cleanup.policy": "delete",
        },
    }
]


def _get_bootstrap_servers() -> str:
    return os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")


def ensure_topics() -> None:
    """
    Create Olympus Kafka topics if they do not already exist.

    Safe to call multiple times — existing topics are left untouched.
    Logs warnings on failure but never raises, so the server still starts
    even when Kafka is temporarily unavailable.
    """
    try:
        from confluent_kafka.admin import AdminClient, NewTopic
    except ImportError:
        print("⚠️ [Kafka Admin]: confluent-kafka not installed — skipping topic creation.")
        return

    admin = AdminClient({"bootstrap.servers": _get_bootstrap_servers()})

    # Fetch existing topic metadata (timeout 5 s)
    try:
        metadata = admin.list_topics(timeout=5)
        existing: List[str] = list(metadata.topics.keys())
    except Exception as e:
        print(f"⚠️ [Kafka Admin]: Cannot list topics — {e}")
        return

    new_topics = []
    for spec in TOPICS_CONFIG:
        if spec["name"] not in existing:
            new_topics.append(
                NewTopic(
                    spec["name"],
                    num_partitions=spec["num_partitions"],
                    replication_factor=spec["replication_factor"],
                    config=spec["config"],
                )
            )
        else:
            print(f"✅ [Kafka Admin]: Topic '{spec['name']}' already exists.")

    if not new_topics:
        return

    futures = admin.create_topics(new_topics)
    for topic_name, future in futures.items():
        try:
            future.result()  # Raises on error
            print(f"🆕 [Kafka Admin]: Created topic '{topic_name}'.")
        except Exception as e:
            # KafkaException with TOPIC_ALREADY_EXISTS is harmless
            if "TOPIC_ALREADY_EXISTS" in str(e):
                print(f"✅ [Kafka Admin]: Topic '{topic_name}' already exists (race).")
            else:
                print(f"⚠️ [Kafka Admin]: Failed to create topic '{topic_name}' — {e}")
