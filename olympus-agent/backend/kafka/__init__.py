"""
Kafka layer for Project Olympus — durable event streaming.

When KAFKA_ENABLED=true:
  - push_log() → OlympusProducer → topic: olympus.run.logs
  - SSE endpoint → OlympusConsumer → browser EventSource

When KAFKA_ENABLED=false (default):
  - Falls back to the in-memory run_logger store (current behaviour).
"""
