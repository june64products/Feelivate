import os
import sqlite3
import time
from typing import Any, Dict, Optional


def _db_path() -> str:
    return os.getenv("EVAL_DB", "eval.db")


def init_eval_db() -> None:
    conn = sqlite3.connect(_db_path())
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS evaluations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              trace_id TEXT NOT NULL,
              user_id TEXT NOT NULL,
              rating INTEGER NOT NULL,
              comments TEXT,
              ts INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS consents (
              user_id TEXT PRIMARY KEY,
              consent INTEGER NOT NULL,
              ts INTEGER NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def submit_evaluation(trace_id: str, user_id: str, rating: int, comments: Optional[str]) -> int:
    conn = sqlite3.connect(_db_path())
    try:
        cur = conn.execute(
            "INSERT INTO evaluations (trace_id, user_id, rating, comments, ts) VALUES (?,?,?,?,?)",
            (trace_id, user_id, rating, comments or "", int(time.time())),
        )
        conn.commit()
        return int(cur.lastrowid)
    finally:
        conn.close()


def set_consent(user_id: str, consent: bool) -> None:
    conn = sqlite3.connect(_db_path())
    try:
        conn.execute(
            "REPLACE INTO consents (user_id, consent, ts) VALUES (?,?,?)",
            (user_id, 1 if consent else 0, int(time.time())),
        )
        conn.commit()
    finally:
        conn.close()


def daily_summary(user_id: str) -> Dict[str, Any]:
    conn = sqlite3.connect(_db_path())
    try:
        start = int(time.time()) - 86400
        cur = conn.execute(
            "SELECT rating FROM evaluations WHERE user_id=? AND ts>=?",
            (user_id, start),
        )
        rows = cur.fetchall()
        ratings = [r[0] for r in rows]
        avg = sum(ratings) / len(ratings) if ratings else 0.0
        return {
            "user_id": user_id,
            "satisfaction_avg": avg,
            "future_prediction_accuracy": None,
        }
    finally:
        conn.close()