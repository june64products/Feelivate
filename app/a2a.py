import os
import sqlite3
import time
import uuid
from typing import Any, Dict

from loguru import logger


def _db_path() -> str:
    return os.getenv("A2A_DB", "a2a.db")


def _ensure_table():
    conn = sqlite3.connect(_db_path())
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS a2a_messages (
              message_id TEXT PRIMARY KEY,
              conversation_id TEXT NOT NULL,
              from_agent TEXT NOT NULL,
              to_agent TEXT NOT NULL,
              intent TEXT NOT NULL,
              payload TEXT NOT NULL,
              confidence REAL NOT NULL,
              ts INTEGER NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def send_message(from_agent: str, to_agent: str, payload: Dict[str, Any], conversation_id: str, intent: str = "inform", confidence: float = 0.7) -> str:
    _ensure_table()
    mid = str(uuid.uuid4())
    ts = int(time.time())
    conn = sqlite3.connect(_db_path())
    try:
        conn.execute(
            "INSERT INTO a2a_messages (message_id, conversation_id, from_agent, to_agent, intent, payload, confidence, ts) VALUES (?,?,?,?,?,?,?,?)",
            (mid, conversation_id, from_agent, to_agent, intent, json_dumps(payload), confidence, ts),
        )
        conn.commit()
        logger.info("a2a_message_sent", extra={"message_id": mid, "conversation_id": conversation_id})
        return mid
    finally:
        conn.close()


def json_dumps(obj: Dict[str, Any]) -> str:
    import json

    return json.dumps(obj, separators=(",", ":"))