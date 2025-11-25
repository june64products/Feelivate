"""
RQ tasks and helpers.

Start worker:
    rq worker

Ensure REDIS_URL is set in environment and this package is importable.
"""

import os
import time
from typing import Any, Dict

from loguru import logger
from redis import Redis
from rq import Queue

from .session_service import InMemorySessionService


import uuid
from dataclasses import dataclass

# Mock Job for SyncQueue
@dataclass
class MockJob:
    id: str

class SyncQueue:
    def __init__(self, *args, **kwargs):
        pass

    def enqueue(self, func, *args, **kwargs):
        # Run synchronously
        func(*args, **kwargs)
        return MockJob(str(uuid.uuid4()))

# Use SyncQueue instead of Redis/RQ
# REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
# redis_conn = Redis.from_url(REDIS_URL)
# queue = Queue("default", connection=redis_conn)
queue = SyncQueue()


_session_service = InMemorySessionService()


def long_healing_journey(session_id: str) -> Dict[str, Any]:
    stages = [
        "grounding",
        "awareness",
        "reflection",
        "reframing",
        "planning",
        "action",
        "integration",
    ]
    logger.info("journey_start", extra={"session_id": session_id})
    for i, name in enumerate(stages, 1):
        s = _session_service.get_session(session_id)
        if not s:
            logger.warning("session_missing", extra={"session_id": session_id})
            break
        if s.get("paused"):
            logger.info("journey_paused", extra={"session_id": session_id, "stage": name})
            time.sleep(1.0)
            continue
        _session_service.update_session(session_id, {"stage": name, "index": i})
        _session_service.add_checkpoint(session_id, {"stage": name, "status": "completed"})
        time.sleep(0.5)
    logger.info("journey_done", extra={"session_id": session_id})
    return {"status": "ok", "session_id": session_id}


def enqueue_long_healing_journey(session_id: str):
    return queue.enqueue(long_healing_journey, session_id)