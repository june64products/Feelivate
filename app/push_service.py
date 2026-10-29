"""
Push notifications — the phone-shaped half of the alerts the emails already send.

Every notification the Android app receives is one the backend already had a
reason to send: the morning task, the evening journal nudge, "your review is
in". This module only changes how it arrives, so the copy lives where the
email copy lives and nothing new decides *when* to interrupt someone.

FCM's HTTP v1 API wants an OAuth token minted from a Firebase service account.
The key arrives as one environment variable, FCM_SERVICE_ACCOUNT_JSON, holding
the key file's contents. When it is missing every send is a logged no-op — an
environment with no push configured runs exactly as it did before.
"""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime
from typing import Optional

import requests
from loguru import logger
from sqlalchemy.orm import Session as DBSession

from .models import DeviceToken

FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
FCM_TIMEOUT = 10          # seconds; the scheduler must not hang on Google

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


def _access_token() -> Optional[str]:
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


def push_enabled() -> bool:
    return _load_credentials() is not None


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
                "notification": {
                    "channel_id": channel,
                    # The app is the whole point of the tap, so always open it.
                    "click_action": "FEELIVATE_OPEN",
                },
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
    access_token = _access_token()
    if not access_token or not _project_id:
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
        ok, err = _send_one(access_token, _project_id, row.token, title, body, data, channel)
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
    if not push_enabled():
        return 0
    from .database import SessionLocal
    db = SessionLocal()
    try:
        return send_to_user(db, user_id, title, body, data, channel)
    except Exception as e:
        logger.error(f"[Push] send_to_user crashed for {user_id}: {e}")
        return 0
    finally:
        db.close()
