"""
Push notifications — the phone-shaped half of the alerts the emails already send.

Every notification the Android app receives is one the backend already had a
reason to send: the morning task, the evening journal nudge, "your review is
in". This module only changes how it arrives, so the copy lives where the
email copy lives and nothing new decides *when* to interrupt someone.

FCM's HTTP v1 API wants an OAuth token for a Firebase service account. Two
ways to have one:

  1. FCM_SERVICE_ACCOUNT_JSON — a key file's contents in the environment; the
     token is minted here.
  2. A relayed token — the GitHub Actions workflow that already holds keyless
     (Workload Identity) access to the Firebase project mints a one-hour token
     every twenty minutes and PUTs it to /internal/fcm-token. The server keeps
     it in kv_settings and uses it until the next one arrives. This is the
     route when the organisation's policy forbids service-account keys.

With neither, every send is a logged no-op — an environment with no push
configured runs exactly as it did before.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from datetime import datetime
from typing import Optional

import requests
from loguru import logger
from sqlalchemy.orm import Session as DBSession

from .models import DeviceToken, KvSetting

# One kind per alert the emails already send; each has its own Android channel
# so a person can silence, say, the evening nudge without losing the review.
PUSH_KINDS = ("morning", "evening", "review", "recovery", "countdown")
CHANNELS = {
    "morning": "feelivate_daily",
    "evening": "feelivate_evening",
    "review": "feelivate_review",
    "recovery": "feelivate_daily",
    "countdown": "feelivate_daily",
}

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
FCM_TIMEOUT = 10          # seconds; the scheduler must not hang on Google
# The Firebase project phones are registered with. A key file names its own
# project; a relayed token says nothing, so this is where it is sent.
FCM_PROJECT_ID = os.environ.get("FCM_PROJECT_ID", "feelivate")
RELAY_KEY = "fcm_access_token"

# One lock so several scheduler threads can't each mint their own token.
_cred_lock = threading.Lock()
_credentials = None       # google.oauth2.service_account.Credentials
_project_id: Optional[str] = None
_warned = False


def _load_credentials():
    """The service-account credentials, or None when push isn't configured."""
    global _credentials, _project_id, _warned
    if _credentials is not None:
        return _credentials

    raw = os.environ.get("FCM_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        if not _warned:
            logger.info("[Push] FCM_SERVICE_ACCOUNT_JSON is not set — push notifications are off")
            _warned = True
        return None

    try:
        # Northflank's secret editor keeps the JSON as-is; a base64 paste is
        # also accepted because that is how the GitHub secret is stored.
        if not raw.lstrip().startswith("{"):
            import base64
            raw = base64.b64decode(raw).decode("utf-8")
        info = json.loads(raw)

        from google.oauth2 import service_account
        creds = service_account.Credentials.from_service_account_info(info, scopes=[FCM_SCOPE])
        _credentials = creds
        _project_id = info.get("project_id")
        logger.info(f"[Push] FCM ready for project {_project_id}")
        return creds
    except Exception as e:
        if not _warned:
            logger.error(f"[Push] FCM credentials could not be read: {e}")
            _warned = True
        return None


def _minted_token() -> Optional[str]:
    """Route 1: a token from the key file, refreshed when it expires."""
    creds = _load_credentials()
    if creds is None:
        return None
    with _cred_lock:
        try:
            if not creds.valid:
                from google.auth.transport.requests import Request as GoogleRequest
                creds.refresh(GoogleRequest())
            return creds.token
        except Exception as e:
            logger.error(f"[Push] token refresh failed: {e}")
            return None


# ── route 2: the relayed token ────────────────────────────────────────────

_relay_lock = threading.Lock()
_relay: dict = {"token": None, "expires_at": 0.0, "checked_at": 0.0}
RELAY_RECHECK_SECONDS = 60      # how often a process re-reads the row


def _read_relay(db: DBSession) -> None:
    try:
        row = db.query(KvSetting).filter(KvSetting.key == RELAY_KEY).first()
        if row and row.value:
            saved = json.loads(row.value)
            _relay["token"] = saved.get("token")
            _relay["expires_at"] = float(saved.get("expires_at") or 0)
        else:
            _relay["token"], _relay["expires_at"] = None, 0.0
    except Exception as e:
        logger.error(f"[Push] could not read the relayed token: {e}")
    _relay["checked_at"] = time.time()


def _relayed_token(db: Optional[DBSession]) -> Optional[str]:
    """The relayed token when one is held and has over a minute left."""
    with _relay_lock:
        stale = time.time() - _relay["checked_at"] > RELAY_RECHECK_SECONDS
        if stale and db is not None:
            _read_relay(db)
        elif stale:
            from .database import SessionLocal
            own = SessionLocal()
            try:
                _read_relay(own)
            finally:
                own.close()
        if _relay["token"] and _relay["expires_at"] - time.time() > 60:
            return _relay["token"]
        return None


def store_relayed_token(db: DBSession, token: str, expires_in: int) -> float:
    """Called by /internal/fcm-token once the token has proved it can reach FCM."""
    expires_at = time.time() + max(60, min(int(expires_in), 3600))
    row = db.query(KvSetting).filter(KvSetting.key == RELAY_KEY).first()
    value = json.dumps({"token": token, "expires_at": expires_at})
    if row:
        row.value = value
    else:
        db.add(KvSetting(key=RELAY_KEY, value=value))
    db.commit()
    with _relay_lock:
        _relay.update(token=token, expires_at=expires_at, checked_at=time.time())
    logger.info(f"[Push] relayed FCM token accepted, good for {int(expires_at - time.time())}s")
    return expires_at


def verify_fcm_capability(token: str) -> bool:
    """
    Proof that a token is worth keeping: FCM is asked to *validate* (not send)
    a message to a made-up device for our project. A token that can act on the
    project gets 400 for the bad device; one that can't gets 401/403.
    """
    try:
        r = requests.post(
            f"https://fcm.googleapis.com/v1/projects/{FCM_PROJECT_ID}/messages:send",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"validate_only": True, "message": {"token": "not-a-real-device", "notification": {"title": "x", "body": "y"}}},
            timeout=FCM_TIMEOUT,
        )
    except Exception as e:
        logger.warning(f"[Push] capability check failed to reach FCM: {e}")
        return False
    if r.status_code in (200, 400):
        return True
    logger.warning(f"[Push] relayed token refused by FCM: {r.status_code} {(r.text or '')[:160]}")
    return False


def _access_token(db: Optional[DBSession] = None) -> Optional[str]:
    return _minted_token() or _relayed_token(db)


def project_id() -> str:
    return _project_id or FCM_PROJECT_ID


def push_enabled(db: Optional[DBSession] = None) -> bool:
    """True when at least one route to FCM is open right now."""
    return _load_credentials() is not None or _relayed_token(db) is not None


# ── the device registry ────────────────────────────────────────────────────

def register_token(db: DBSession, user_id: str, token: str, platform: str = "android") -> None:
    """
    Remember this device for this user. A token can move between accounts when
    two people share a phone, so the row is keyed by the token, not the user.
    """
    token = (token or "").strip()
    if not token:
        return
    row = db.query(DeviceToken).filter(DeviceToken.token == token).first()
    now = datetime.utcnow()
    if row:
        row.user_id = user_id
        row.platform = platform
        row.last_seen_at = now
    else:
        db.add(DeviceToken(user_id=user_id, token=token, platform=platform, last_seen_at=now))
    db.commit()


def unregister_token(db: DBSession, token: str) -> None:
    """Called on logout — the phone should stop hearing from an account it left."""
    token = (token or "").strip()
    if not token:
        return
    db.query(DeviceToken).filter(DeviceToken.token == token).delete()
    db.commit()


def _drop(db: DBSession, token: str, why: str) -> None:
    logger.info(f"[Push] dropping a dead token ({why})")
    try:
        db.query(DeviceToken).filter(DeviceToken.token == token).delete()
        db.commit()
    except Exception:
        db.rollback()


# ── sending ────────────────────────────────────────────────────────────────

def _send_one(access_token: str, project_id: str, token: str, title: str, body: str,
              data: Optional[dict] = None, channel: str = "feelivate_default") -> tuple[bool, str]:
    payload = {
        "message": {
            "token": token,
            "notification": {"title": title, "body": body},
            "android": {
                "priority": "high",
                # No click_action: with none set, a tap on a tray notification
                # opens the launcher activity with the data keys as extras.
                "notification": {"channel_id": channel},
            },
            "data": {k: str(v) for k, v in (data or {}).items()},
        }
    }
    try:
        r = requests.post(
            f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send",
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json=payload, timeout=FCM_TIMEOUT,
        )
    except Exception as e:
        return False, f"network: {e}"
    if r.status_code == 200:
        return True, ""
    # 404 UNREGISTERED / 400 INVALID_ARGUMENT on the token = the app is gone.
    detail = (r.text or "")[:300]
    return False, f"{r.status_code} {detail}"


def send_to_user(db: DBSession, user_id: str, title: str, body: str,
                 data: Optional[dict] = None, channel: str = "feelivate_default") -> int:
    """
    Notify every device this user has registered. Returns how many got through.
    Never raises — a failed push must not stop the email that goes with it.
    """
    access_token = _access_token(db)
    if not access_token:
        return 0
    try:
        rows = db.query(DeviceToken).filter(DeviceToken.user_id == user_id).all()
    except Exception as e:
        logger.error(f"[Push] could not read device tokens for {user_id}: {e}")
        return 0
    if not rows:
        return 0

    sent = 0
    for row in rows:
        ok, err = _send_one(access_token, project_id(), row.token, title, body, data, channel)
        if ok:
            sent += 1
        elif "UNREGISTERED" in err or "INVALID_ARGUMENT" in err or err.startswith("404"):
            _drop(db, row.token, err[:60])
        else:
            logger.warning(f"[Push] send failed for {user_id}: {err}")
    return sent


def safe_send_to_user(user_id: str, title: str, body: str, data: Optional[dict] = None,
                      channel: str = "feelivate_default") -> int:
    """
    The version the email jobs call: opens its own session, swallows everything.
    The alert's whole value is that it is quiet about its own plumbing.
    """
    from .database import SessionLocal
    db = SessionLocal()
    try:
        if not push_enabled(db):
            return 0
        return send_to_user(db, user_id, title, body, data, channel)
    except Exception as e:
        logger.error(f"[Push] send_to_user crashed for {user_id}: {e}")
        return 0
    finally:
        db.close()


# ── preferences ────────────────────────────────────────────────────────────

def prefs_for(user) -> dict:
    """The user's push switches, every kind on unless they turned it off."""
    base = {"enabled": True, **{k: True for k in PUSH_KINDS}}
    raw = getattr(user, "push_prefs", None)
    if not raw:
        return base
    try:
        saved = json.loads(raw)
        if isinstance(saved, dict):
            base.update({k: bool(v) for k, v in saved.items() if k == "enabled" or k in PUSH_KINDS})
    except Exception:
        pass
    return base


def wants(user, kind: str) -> bool:
    p = prefs_for(user)
    return bool(p["enabled"] and p.get(kind, True))


def has_device(db: DBSession, user_id: str) -> bool:
    try:
        return db.query(DeviceToken.id).filter(DeviceToken.user_id == user_id).first() is not None
    except Exception:
        return False


def device_user_ids(db: DBSession) -> set:
    """
    Everyone with a phone registered — the set the schedulers add to the
    email subscribers. Empty when push isn't configured, so a backend without
    FCM credentials behaves exactly as it did before phones existed.
    """
    if not push_enabled(db):
        return set()
    try:
        return {row[0] for row in db.query(DeviceToken.user_id).distinct().all()}
    except Exception as e:
        logger.error(f"[Push] could not list device users: {e}")
        return set()


def push_alert(db: DBSession, user, kind: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    """
    The schedulers' one call: honours the user's switches, picks the channel
    for the kind, never raises. True when at least one phone took it.
    """
    try:
        if kind not in PUSH_KINDS or not wants(user, kind):
            return False
        return send_to_user(db, user.id, title, body, data, channel=CHANNELS[kind]) > 0
    except Exception as e:
        logger.error(f"[Push] {kind} alert failed for {getattr(user, 'id', '?')}: {e}")
        return False


# ── copy helpers ───────────────────────────────────────────────────────────

_TAGS = re.compile(r"<[^>]+>")


def plain_text(s: Optional[str], limit: int = 140) -> str:
    """Email copy can carry markup; a notification body cannot."""
    t = _TAGS.sub("", s or "").replace("&nbsp;", " ").replace("&amp;", "&").strip()
    t = " ".join(t.split())
    return t if len(t) <= limit else t[: limit - 1].rstrip() + "…"


def countdown_when(start_iso: Optional[str], today_iso: str) -> str:
    """'tomorrow', 'on Monday', 'in 3 days' — how the title says when a week begins."""
    try:
        from datetime import date as _date
        delta = (_date.fromisoformat(start_iso) - _date.fromisoformat(today_iso)).days
        if delta <= 0:
            return "today"
        if delta == 1:
            return "tomorrow"
        if delta < 7:
            return "on " + _date.fromisoformat(start_iso).strftime("%A")
        return f"in {delta} days"
    except Exception:
        return "soon"
