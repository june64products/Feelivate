"""
The long-term memory store, exercised against an in-process Qdrant
(QdrantClient(':memory:')) so no network or cluster is needed.

These cover the two ways the feature was found silently dead in production:
the client API that no longer exists (.search), and a collection created at
the wrong vector size so every write was rejected.
"""
import random
import uuid

import pytest
from qdrant_client import QdrantClient
from qdrant_client.http import models

from app import vector_store as vs


def _vec(seed: int, dim: int = vs.EMBEDDING_DIM):
    r = random.Random(seed)
    return [r.random() for _ in range(dim)]


def _store() -> vs.VectorStore:
    return vs.VectorStore(client=QdrantClient(":memory:"))


def test_creates_collection_at_embedding_size():
    s = _store()
    assert s.collection_ok is True
    info = s.client.get_collection(vs.COLLECTION_NAME)
    assert info.config.params.vectors.size == vs.EMBEDDING_DIM


def test_write_search_export_delete_roundtrip():
    s = _store()
    v = _vec(1)
    assert s.add_memory("u1", "I practise guitar in the evenings", v, {"session_id": "s1"})
    assert s.add_memory("u2", "someone else's memory", _vec(2), {})

    hits = s.search_memories("u1", v, limit=5)
    assert hits and hits[0]["text"].startswith("I practise")
    assert all(h["metadata"]["user_id"] == "u1" for h in hits), "search must be scoped to the user"
    assert s.search_memories("u2", v, limit=5)[0]["text"] == "someone else's memory"

    # The chat path scopes recall to the current session via extra_filter and
    # reads the session back from "metadata"; both must line up.
    s.add_memory("u1", "a memory from another session", _vec(7), {"session_id": "s2"})
    scoped = s.search_memories("u1", v, limit=5, extra_filter={"session_id": "s1"})
    assert [h["metadata"]["session_id"] for h in scoped] == ["s1"]
    assert scoped[0]["text"].startswith("I practise")

    exported = s.export_user_memories("u1")
    assert len(exported) == 2 and {e["session_id"] for e in exported} == {"s1", "s2"}

    assert s.delete_user_memories("u1") is True
    assert s.export_user_memories("u1") == []
    assert s.export_user_memories("u2"), "erasure must not touch other users"


class _RecordingClient(QdrantClient):
    """In-memory Qdrant that records which payload indexes were requested."""

    def __init__(self):
        super().__init__(":memory:")
        self.indexed = []

    def create_payload_index(self, collection_name, field_name, *args, **kwargs):
        self.indexed.append(field_name)
        return super().create_payload_index(collection_name, field_name, *args, **kwargs)


def test_indexes_filtered_fields_on_a_fresh_collection():
    # Qdrant Cloud strict mode refuses filters on unindexed fields, so the
    # store must ask for the indexes itself rather than rely on the console.
    c = _RecordingClient()
    s = vs.VectorStore(client=c)
    assert s.collection_ok is True
    assert set(c.indexed) == set(vs.INDEXED_PAYLOAD_FIELDS)


def test_indexes_filtered_fields_on_an_existing_unindexed_collection():
    # The state a cluster is left in when the collection was created by an
    # older build: right size, no indexes, every filtered read failing.
    c = _RecordingClient()
    c.create_collection(vs.COLLECTION_NAME, vectors_config=models.VectorParams(size=vs.EMBEDDING_DIM, distance=models.Distance.COSINE))
    s = vs.VectorStore(client=c)
    assert s.collection_ok is True
    assert set(c.indexed) == set(vs.INDEXED_PAYLOAD_FIELDS)


def test_rejects_embedding_of_wrong_dimension():
    s = _store()
    assert s.add_memory("u1", "x", [0.1] * (vs.EMBEDDING_DIM - 1), {}) is False


def test_recreates_empty_collection_of_wrong_size():
    # The production state before the fix: created at 1536, embeddings are 3072.
    c = QdrantClient(":memory:")
    c.create_collection(vs.COLLECTION_NAME, vectors_config=models.VectorParams(size=1536, distance=models.Distance.COSINE))
    s = vs.VectorStore(client=c)
    assert s.collection_ok is True
    assert c.get_collection(vs.COLLECTION_NAME).config.params.vectors.size == vs.EMBEDDING_DIM
    assert s.add_memory("u1", "now it works", _vec(3), {})


def test_refuses_to_touch_nonempty_collection_of_wrong_size():
    c = QdrantClient(":memory:")
    c.create_collection(vs.COLLECTION_NAME, vectors_config=models.VectorParams(size=8, distance=models.Distance.COSINE))
    c.upsert(vs.COLLECTION_NAME, points=[models.PointStruct(id=str(uuid.uuid4()), vector=[0.1] * 8, payload={"user_id": "u", "text": "old"})])
    s = vs.VectorStore(client=c)
    assert s.collection_ok is False
    assert s.add_memory("u", "x", _vec(4), {}) is False
    assert s.search_memories("u", _vec(4)) == []
    # Reads that do not depend on vector shape still work, so nothing is hidden.
    assert s.export_user_memories("u") == [{"user_id": "u", "text": "old"}]


class _DeadCluster:
    """Behaves like a suspended Qdrant Cloud cluster: every call is refused."""

    def get_collections(self):
        raise ConnectionError("[Errno 54] Connection reset by peer")


def test_stands_down_after_repeated_failures_and_reports_erasure_honestly():
    s = vs.VectorStore(client=_DeadCluster())
    assert s.enabled and s.collection_ok is None  # configured, never verified

    # Each read re-attempts the collection check; after the threshold it backs off.
    for _ in range(vs.FAILURES_BEFORE_BACKOFF):
        assert s.search_memories("u", _vec(5)) == []
    assert not s._available(), "should be standing down, not hammering a dead cluster"

    # Unreachable is not the same as "nothing stored": erasure must not claim success.
    assert s.delete_user_memories("u") is False


def test_unconfigured_store_is_a_clean_noop(monkeypatch):
    monkeypatch.setattr(vs, "QDRANT_URL", None)
    s = vs.VectorStore()
    assert s.enabled is False
    assert s.search_memories("u", _vec(6)) == []
    assert s.add_memory("u", "x", _vec(6), {}) is False
    assert s.delete_user_memories("u") is True  # nothing could have been stored
