import time
import uuid
from typing import Any, Dict, Optional

from loguru import logger


class InMemorySessionService:
    def __init__(self):
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def create_session(self, user_id: str) -> str:
        sid = str(uuid.uuid4())
        self._sessions[sid] = {
            "user_id": user_id,
            "state": {},
            "checkpoints": [],
            "paused": False,
            "created_ts": int(time.time()),
        }
        logger.info("session_created", extra={"session_id": sid, "user_id": user_id})
        return sid

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self._sessions.get(session_id)

    def update_session(self, session_id: str, state_dict: Dict[str, Any]) -> None:
        s = self._sessions.get(session_id)
        if not s:
            raise KeyError("Session not found")
        s["state"].update(state_dict)
        logger.info("session_updated", extra={"session_id": session_id})

    def add_checkpoint(self, session_id: str, checkpoint: Dict[str, Any]) -> None:
        s = self._sessions.get(session_id)
        if not s:
            raise KeyError("Session not found")
        s["checkpoints"].append({**checkpoint, "ts": int(time.time())})
        logger.info("checkpoint_added", extra={"session_id": session_id})

    def pause_session(self, session_id: str) -> None:
        s = self._sessions.get(session_id)
        if not s:
            raise KeyError("Session not found")
        s["paused"] = True
        logger.info("session_paused", extra={"session_id": session_id})

    def resume_session(self, session_id: str) -> None:
        s = self._sessions.get(session_id)
        if not s:
            raise KeyError("Session not found")
        s["paused"] = False
        logger.info("session_resumed", extra={"session_id": session_id})

    def delete_user(self, user_id: str) -> int:
        to_delete = [sid for sid, s in self._sessions.items() if s.get("user_id") == user_id]
        for sid in to_delete:
            del self._sessions[sid]
        logger.info("session_user_deleted", extra={"user_id": user_id, "count": len(to_delete)})
        return len(to_delete)


class SessionServiceDB:
    def __init__(self, db_path: str = "sessions.db"):
        self.db_path = db_path
        # TODO: Implement SQLite-backed persistence for sessions

    def create_session(self, user_id: str) -> str:
        raise NotImplementedError("DB-backed session service not implemented yet")

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        raise NotImplementedError

    def update_session(self, session_id: str, state_dict: Dict[str, Any]) -> None:
        raise NotImplementedError

    def add_checkpoint(self, session_id: str, checkpoint: Dict[str, Any]) -> None:
        raise NotImplementedError

    def pause_session(self, session_id: str) -> None:
        raise NotImplementedError

    def resume_session(self, session_id: str) -> None:
        raise NotImplementedError


"""
API usage examples:

svc = InMemorySessionService()
sid = svc.create_session("user-123")
svc.update_session(sid, {"stage": 1})
svc.add_checkpoint(sid, {"event": "started"})
svc.pause_session(sid)
svc.resume_session(sid)
"""