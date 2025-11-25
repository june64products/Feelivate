"""
Simple SQLite + FAISS memory module.

Functions:
- initialize_memory(db_path='memory.db')
- add_memory(user_id, text, summary, embedding, db_path='memory.db')
- search_memory(user_id, query_embedding, top_k=3, db_path='memory.db')
- compress_summary(text) -> 1-2 sentence plain text via LLM
"""

import os
import json
import sqlite3
import time
from typing import Any, Dict, List, Optional

from loguru import logger

from .llm import call_llm


def initialize_memory(db_path: str = "memory.db") -> None:
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT NOT NULL,
              text TEXT NOT NULL,
              summary TEXT NOT NULL,
              embedding TEXT NOT NULL,
              ts INTEGER NOT NULL
            )
            """
        )
        conn.commit()
        logger.info("memory_initialized", extra={"db_path": db_path})
    finally:
        conn.close()


def _index_path(user_id: str, db_path: str) -> str:
    base, _ = os.path.splitext(db_path)
    return f"{base}_{user_id}.faiss"


def _load_index(user_id: str, dim: Optional[int], db_path: str):
    try:
        import faiss  # type: ignore
    except Exception:
        raise RuntimeError("faiss-cpu is required. Install it or use Python 3.11.")

    path = _index_path(user_id, db_path)
    if os.path.exists(path):
        return faiss.read_index(path)
    if dim is None:
        raise RuntimeError("Embedding dimension required to create new FAISS index")
    index = faiss.IndexFlatL2(dim)
    id_index = faiss.IndexIDMap(index)
    return id_index


def _persist_index(index, user_id: str, db_path: str) -> None:
    try:
        import faiss  # type: ignore
    except Exception:
        raise RuntimeError("faiss-cpu is required. Install it or use Python 3.11.")
    path = _index_path(user_id, db_path)
    faiss.write_index(index, path)


def add_memory(user_id: str, text: str, summary: str, embedding: List[float], db_path: str = "memory.db") -> int:
    ts = int(time.time())
    conn = sqlite3.connect(db_path)
    try:
        if not summary:
            summary = compress_summary(text)
        emb_json = json.dumps(embedding)
        cur = conn.execute(
            "INSERT INTO memories (user_id, text, summary, embedding, ts) VALUES (?,?,?,?,?)",
            (user_id, text, summary, emb_json, ts),
        )
        row_id = cur.lastrowid
        conn.commit()

        try:
            import numpy as np  # type: ignore
        except Exception:
            raise RuntimeError("numpy is required for FAISS operations")

        dim = len(embedding)
        index = _load_index(user_id, dim, db_path)
        vec = np.array([embedding], dtype=np.float32)
        ids = np.array([row_id], dtype=np.int64)
        index.add_with_ids(vec, ids)
        _persist_index(index, user_id, db_path)
        logger.info("memory_added", extra={"user_id": user_id, "row_id": row_id})
        return int(row_id)
    finally:
        conn.close()


def search_memory(user_id: str, query_embedding: List[float], top_k: int = 3, db_path: str = "memory.db") -> List[str]:
    try:
        import numpy as np  # type: ignore
    except Exception:
        raise RuntimeError("numpy is required for FAISS operations")

    index = _load_index(user_id, len(query_embedding), db_path)
    if getattr(index, "ntotal", 0) == 0:
        return []

    q = np.array([query_embedding], dtype=np.float32)
    distances, ids = index.search(q, top_k)
    ids_list = [int(i) for i in ids[0] if int(i) != -1]

    conn = sqlite3.connect(db_path)
    try:
        summaries: List[str] = []
        for rid in ids_list:
            cur = conn.execute(
                "SELECT summary FROM memories WHERE id=? AND user_id=?",
                (rid, user_id),
            )
            row = cur.fetchone()
            if row:
                summaries.append(row[0])
        return summaries
    finally:
        conn.close()


def compress_summary(text: str) -> str:
    prompt = (
        "Summarize the following user entry in 1-2 concise sentences. "
        "Return plain text only.\n\n"
        f"Entry:\n{text}"
    )
    try:
        out = call_llm(prompt, temperature=0.2, max_tokens=120)
        return out.strip()
    except Exception:
        logger.exception("compress_summary_failed")
        raise


def delete_user_data(user_id: str, db_path: str = "memory.db") -> int:
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.execute("DELETE FROM memories WHERE user_id=?", (user_id,))
        conn.commit()
        count = cur.rowcount if cur.rowcount is not None else 0
        try:
            path = _index_path(user_id, db_path)
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            pass
        logger.info("memory_user_deleted", extra={"user_id": user_id, "count": count})
        return int(count)
    finally:
        conn.close()