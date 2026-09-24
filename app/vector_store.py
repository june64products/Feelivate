"""
Long-term memory: one Qdrant collection of per-user chat embeddings.

Everything here is best-effort — the mentor works without memory — so no
method raises. But it also must not cost a live request more than a few
hundred milliseconds when the cluster is unreachable: Qdrant Cloud's free
tier suspends idle clusters, and a suspended cluster accepts the TCP
connection and then resets it. Calls are bounded by a short timeout, and
after a run of failures the store stands down for a minute instead of
retrying on every message.
"""
import os
import time
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime

from dotenv import load_dotenv
from loguru import logger
from qdrant_client import QdrantClient
from qdrant_client.http import models

load_dotenv()

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION_NAME = "user_memories"

# Must match the embedding model in app/llm.py (text-embedding-3-large → 3072).
# The collection used to be created at 1536, the size of an older model, so
# every upsert was rejected for a dimension mismatch and no memory was ever
# stored — silently, because writes are best-effort.
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "3072"))

REQUEST_TIMEOUT_S = float(os.getenv("QDRANT_TIMEOUT", "5"))
# After this many consecutive failures, skip the store for BACKOFF_S seconds.
FAILURES_BEFORE_BACKOFF = 3
BACKOFF_S = 60.0


class VectorStore:
    def __init__(self, client: Optional[QdrantClient] = None):
        """Pass a client to bypass the environment — tests use QdrantClient(':memory:')."""
        self.client: Optional[QdrantClient] = None
        self.enabled = False               # configured at all?
        self.collection_ok: Optional[bool] = None  # None = not verified yet
        self._failures = 0
        self._down_until = 0.0             # monotonic clock; calls skipped until then

        if client is not None:
            self.client = client
            self.enabled = True
            self._ensure_collection()
            return

        if QDRANT_URL and QDRANT_API_KEY:
            try:
                self.client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=REQUEST_TIMEOUT_S)
                self.enabled = True
                logger.info("Qdrant client configured")
                self._ensure_collection()
            except Exception as e:
                logger.error(f"Failed to configure Qdrant client: {e}")
                self.enabled = False
        else:
            logger.warning("QDRANT_URL or QDRANT_API_KEY not set. Memory features disabled.")

    # ── availability ────────────────────────────────────────────────────────

    def _available(self) -> bool:
        return self.enabled and self.client is not None and time.monotonic() >= self._down_until

    def _ready(self) -> bool:
        """Reachable AND the collection is verified to have the right shape.

        A collection check that failed at boot (cluster asleep) is retried
        lazily here, so memory comes back on its own once the cluster does.
        """
        if not self._available():
            return False
        if self.collection_ok is None:
            self._ensure_collection()
        return bool(self.collection_ok) and self._available()

    def _ok(self) -> None:
        self._failures = 0

    def _fail(self, what: str, e: Exception) -> None:
        self._failures += 1
        if self._failures >= FAILURES_BEFORE_BACKOFF:
            self._down_until = time.monotonic() + BACKOFF_S
            self._failures = 0
            logger.error(
                f"Qdrant {what} failed {FAILURES_BEFORE_BACKOFF}× in a row "
                f"({type(e).__name__}: {str(e)[:120]}) — standing down for {BACKOFF_S:.0f}s. "
                "If this keeps happening the cluster is probably suspended: resume it in Qdrant Cloud."
            )
        else:
            logger.warning(f"Qdrant {what} failed ({type(e).__name__}: {str(e)[:120]})")

    def _ensure_collection(self) -> None:
        """Create the collection if missing; verify its vector size if present."""
        if not self._available():
            return
        try:
            names = [c.name for c in self.client.get_collections().collections]
            if COLLECTION_NAME in names:
                info = self.client.get_collection(COLLECTION_NAME)
                vectors = info.config.params.vectors
                size = getattr(vectors, "size", None)  # None for named-vector configs
                if size != EMBEDDING_DIM:
                    count = info.points_count or 0
                    if count == 0:
                        logger.warning(
                            f"Qdrant collection {COLLECTION_NAME} has vector size {size}, "
                            f"embeddings are {EMBEDDING_DIM}; it is empty, so recreating it."
                        )
                        self.client.delete_collection(COLLECTION_NAME)
                        names.remove(COLLECTION_NAME)
                    else:
                        # Real data in an incompatible shape is a decision for a
                        # person, not a startup routine. Read paths still work.
                        logger.error(
                            f"Qdrant collection {COLLECTION_NAME} has vector size {size} but "
                            f"embeddings are {EMBEDDING_DIM}, and it holds {count} points — "
                            "not touching it. Memory writes and searches are disabled until resolved."
                        )
                        self.collection_ok = False
                        self._ok()
                        return
            if COLLECTION_NAME not in names:
                logger.info(f"Creating Qdrant collection {COLLECTION_NAME} ({EMBEDDING_DIM}-dim, cosine)")
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=models.VectorParams(size=EMBEDDING_DIM, distance=models.Distance.COSINE),
                )
            self.collection_ok = True
            self._ok()
        except Exception as e:
            self.collection_ok = None
            self._fail("collection check", e)

    # ── writes ──────────────────────────────────────────────────────────────

    def add_memory(self, user_id: str, text: str, embedding: List[float], metadata: Dict[str, Any]) -> bool:
        """Store one memory vector for a user. Never raises."""
        if not self._ready():
            return False
        if len(embedding) != EMBEDDING_DIM:
            logger.error(
                f"Refusing to store a {len(embedding)}-dim embedding in a {EMBEDDING_DIM}-dim collection "
                "— check OPENAI_EMBEDDING_MODEL / EMBEDDING_DIM."
            )
            return False
        try:
            payload = {
                "user_id": user_id,
                "text": text,
                "timestamp": datetime.now().isoformat(),
                **metadata,
            }
            self.client.upsert(
                collection_name=COLLECTION_NAME,
                points=[models.PointStruct(id=str(uuid.uuid4()), vector=embedding, payload=payload)],
            )
            self._ok()
            logger.info("Memory stored in Qdrant")
            return True
        except Exception as e:
            self._fail("upsert", e)
            return False

    # ── reads ───────────────────────────────────────────────────────────────

    def _user_filter(self, user_id: str, extra: Optional[Dict[str, Any]] = None) -> "models.Filter":
        must = [models.FieldCondition(key="user_id", match=models.MatchValue(value=user_id))]
        for k, v in (extra or {}).items():
            must.append(models.FieldCondition(key=k, match=models.MatchValue(value=v)))
        return models.Filter(must=must)

    def search_memories(
        self, user_id: str, embedding: List[float], limit: int = 5, extra_filter: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Nearest memories for one user. Never raises; [] when unavailable."""
        if not self._ready():
            return []
        try:
            # qdrant-client removed .search() in 1.13; query_points is the
            # replacement and returns the hits under .points.
            response = self.client.query_points(
                collection_name=COLLECTION_NAME,
                query=embedding,
                query_filter=self._user_filter(user_id, extra_filter),
                limit=limit,
                with_payload=True,
            )
            self._ok()
            return [
                {"text": (hit.payload or {}).get("text", ""), "metadata": hit.payload or {}, "score": hit.score}
                for hit in response.points
            ]
        except Exception as e:
            self._fail("search", e)
            return []

    def export_user_memories(self, user_id: str, limit: int = 10_000) -> List[Dict[str, Any]]:
        """Every stored memory payload for a user (GDPR Art 15/20).

        Vectors are omitted — they are a derived numeric representation of
        the text, which is included. Works even when the collection's shape
        is wrong, so an export never hides data.
        """
        if not self._available():
            return []
        results: List[Dict[str, Any]] = []
        offset = None
        try:
            while len(results) < limit:
                points, offset = self.client.scroll(
                    collection_name=COLLECTION_NAME,
                    scroll_filter=self._user_filter(user_id),
                    limit=min(256, limit - len(results)),
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
                if not points:
                    break
                results.extend(dict(p.payload or {}) for p in points)
                if offset is None:
                    break
            self._ok()
            return results
        except Exception as e:
            self._fail("export", e)
            return results

    # ── erasure ─────────────────────────────────────────────────────────────

    def delete_user_memories(self, user_id: str) -> bool:
        """Erase every vector belonging to a user (GDPR Art 17).

        True only when the store is unconfigured (nothing could be stored) or
        the delete succeeded. An unreachable store returns False so the
        caller reports an incomplete erasure instead of claiming success.
        """
        if not self.enabled:
            return True
        if not self._available():
            logger.error("Qdrant unreachable during account erasure — memories NOT confirmed deleted")
            return False
        try:
            self.client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=models.FilterSelector(filter=self._user_filter(user_id)),
                wait=True,
            )
            self._ok()
            logger.info("Qdrant memories deleted for account erasure")
            return True
        except Exception as e:
            self._fail("delete", e)
            return False


# Singleton instance
vector_store = VectorStore()
