import os
import sqlite3
import time
from typing import Any, Dict, Optional

from .llm import call_llm


def _db_path() -> str:
    return os.getenv("PROMPT_DB", "prompts.db")


def init_db() -> None:
    conn = sqlite3.connect(_db_path())
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS prompt_variations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              agent_name TEXT NOT NULL,
              prompt_text TEXT NOT NULL,
              score REAL DEFAULT 0.0,
              uses INTEGER DEFAULT 0,
              ts INTEGER NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def record_result(agent_name: str, prompt_text: str, rating: float) -> None:
    conn = sqlite3.connect(_db_path())
    try:
        conn.execute(
            "INSERT INTO prompt_variations (agent_name, prompt_text, score, uses, ts) VALUES (?,?,?,?,?)",
            (agent_name, prompt_text, float(rating), 1, int(time.time())),
        )
        conn.commit()
    finally:
        conn.close()


def suggest_better_prompt(agent_name: str) -> str:
    conn = sqlite3.connect(_db_path())
    try:
        cur = conn.execute(
            "SELECT prompt_text, score FROM prompt_variations WHERE agent_name=? ORDER BY score DESC LIMIT 5",
            (agent_name,),
        )
        rows = cur.fetchall()
        base = "\n\n".join([r[0] for r in rows]) if rows else ""
    finally:
        conn.close()

    prompt = (
        "You are optimizing a prompt for the given agent. Propose a refined prompt text "
        "that improves user satisfaction, clarity, and JSON adherence. Return plain text only.\n"
        f"Agent: {agent_name}\nExisting prompts:\n{base}\n"
    )
    out = call_llm(prompt, temperature=0.3, max_tokens=200)
    return out.strip()