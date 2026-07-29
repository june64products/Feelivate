"""
Data-protection plumbing: consent ledger, subject access export, erasure and
retention.

This module is deliberately separate from main.py because these are legal
obligations with their own lifecycle, not product features:

  * Art 6 / Art 9  — a lawful basis must exist before processing. Journals,
                     voice transcripts and emotion scores reveal mental
                     wellbeing, so they sit in the Art 9 "special category"
                     band and need *explicit* consent, collected separately
                     from the general terms.
  * Art 7(1)       — we must be able to demonstrate that consent was given.
                     Hence the append-only UserConsent ledger.
  * Art 7(3)       — withdrawing consent must be as easy as giving it.
  * Art 15 / 20    — access and portability: build_user_export().
  * Art 17         — erasure: delete_user_data().
  * Art 5(1)(e)    — storage limitation: run_retention_sweep().
"""

import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session as DBSession

from .models import (
    ChatMessage,
    DailyCheckin,
    EmotionalState,
    Feedback,
    RoadmapTask,
    Session,
    User,
    UserConsent,
    UserStreak,
    VoiceJournal,
    WeeklyReport,
)

# ── Consent definitions ─────────────────────────────────────────────────────

# Bump this whenever the privacy policy or terms change in a way that affects
# what the user agreed to. Users whose latest consent predates the current
# version are re-prompted rather than assumed to still agree.
CONSENT_POLICY_VERSION = os.getenv("CONSENT_POLICY_VERSION", "2026-07-29")

# Every consent here must be granted before the account can be used.
# `explicit` marks the Art 9 consent, which the UI must present as its own
# unticked checkbox — never bundled with the terms acceptance.
REQUIRED_CONSENTS: Dict[str, Dict[str, Any]] = {
    "terms": {
        "label": "I agree to the Terms of Service.",
        "explicit": False,
    },
    "privacy": {
        "label": "I have read the Privacy Policy and understand how my data is processed.",
        "explicit": False,
    },
    "sensitive_data": {
        "label": (
            "I explicitly consent to Feelivate processing the wellbeing information I choose "
            "to share — my journal entries, voice notes and their transcripts, and the emotion "
            "labels derived from them — to personalise my plans and reports. This information "
            "is processed by our AI providers as described in the Privacy Policy."
        ),
        "explicit": True,
    },
    "age_18": {
        "label": "I confirm that I am 18 years of age or older.",
        "explicit": False,
    },
}

# Optional consents: absence never blocks the product.
OPTIONAL_CONSENTS: Dict[str, Dict[str, Any]] = {
    "daily_emails": {
        "label": "Send me my daily task email at the time I choose.",
        "explicit": False,
    },
}

ALL_CONSENTS = {**REQUIRED_CONSENTS, **OPTIONAL_CONSENTS}


def consent_catalogue() -> List[Dict[str, Any]]:
    """The consent list the frontend renders, in a stable order."""
    return [
        {
            "key": key,
            "label": spec["label"],
            "required": key in REQUIRED_CONSENTS,
            "explicit": spec["explicit"],
        }
        for key, spec in ALL_CONSENTS.items()
    ]


# ── Consent ledger ──────────────────────────────────────────────────────────

def record_consents(
    db: DBSession,
    user_id: str,
    decisions: Dict[str, bool],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    commit: bool = True,
) -> List[str]:
    """Append one ledger row per decision. Returns the keys actually recorded.

    Unknown keys are ignored rather than rejected so an older client can't be
    broken by a newer consent being added server-side.
    """
    recorded: List[str] = []
    for key, granted in decisions.items():
        if key not in ALL_CONSENTS:
            continue
        db.add(
            UserConsent(
                user_id=user_id,
                consent_type=key,
                granted=1 if granted else 0,
                policy_version=CONSENT_POLICY_VERSION,
                ip_address=ip_address,
                # Truncated: enough to evidence the consent, not a fingerprint.
                user_agent=(user_agent or "")[:255] or None,
            )
        )
        recorded.append(key)

    if commit:
        db.commit()
    return recorded


def current_consents(db: DBSession, user_id: str) -> Dict[str, Dict[str, Any]]:
    """Latest state per consent type for a user.

    The ledger is append-only, so "current" means the newest row per type.
    """
    rows = (
        db.query(UserConsent)
        .filter(UserConsent.user_id == user_id)
        .order_by(UserConsent.created_at.asc(), UserConsent.id.asc())
        .all()
    )
    state: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        # Later rows overwrite earlier ones, so the last write per type wins.
        state[row.consent_type] = {
            "granted": bool(row.granted),
            "policy_version": row.policy_version,
            "recorded_at": row.created_at.isoformat() if row.created_at else None,
        }
    return state


def missing_consents(db: DBSession, user_id: str) -> List[str]:
    """Required consents that are absent, withdrawn, or from an older policy.

    A user who agreed to an earlier policy version has not agreed to this one,
    so they are re-prompted. This is what makes the post-login consent screen
    appear for accounts created before consent was collected.
    """
    state = current_consents(db, user_id)
    outstanding = []
    for key in REQUIRED_CONSENTS:
        entry = state.get(key)
        if not entry or not entry["granted"] or entry["policy_version"] != CONSENT_POLICY_VERSION:
            outstanding.append(key)
    return outstanding


def withdraw_consent(
    db: DBSession,
    user_id: str,
    consent_type: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> bool:
    """Record a withdrawal (Art 7(3)). Returns False for unknown consent types.

    Withdrawal is not retroactive — processing done while consent was valid
    stays lawful — but it does stop further processing, which for a required
    consent means the account can no longer be used until it is re-granted or
    the account is deleted.
    """
    if consent_type not in ALL_CONSENTS:
        return False
    record_consents(db, user_id, {consent_type: False}, ip_address, user_agent)
    return True


# ── Art 15 / Art 20: subject access & portability ───────────────────────────

def _iso(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def build_user_export(db: DBSession, user: User) -> Dict[str, Any]:
    """Assemble everything held about a user as a portable JSON structure.

    Deliberately excluded:
      * the password hash — a credential, not information about the person, and
        exporting it only creates a new place for it to leak;
      * the Google refresh token — same reasoning, and it grants live calendar
        access to whoever holds the file.
    Both exclusions are noted in the payload so the export is honest about
    what it does not contain.
    """
    sessions = db.query(Session).filter(Session.user_id == user.id).all()
    session_ids = [s.id for s in sessions]

    messages_by_session: Dict[str, List[Dict[str, Any]]] = {sid: [] for sid in session_ids}
    tasks_by_session: Dict[str, List[Dict[str, Any]]] = {sid: [] for sid in session_ids}

    if session_ids:
        for m in (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id.in_(session_ids))
            .order_by(ChatMessage.created_at.asc())
            .all()
        ):
            messages_by_session.setdefault(m.session_id, []).append(
                {"role": m.role, "content": m.content, "created_at": _iso(m.created_at)}
            )

        for t in (
            db.query(RoadmapTask)
            .filter(RoadmapTask.session_id.in_(session_ids))
            .order_by(RoadmapTask.id.asc())
            .all()
        ):
            tasks_by_session.setdefault(t.session_id, []).append(
                {
                    "title": t.title,
                    "description": t.description,
                    "month": t.month,
                    "week": t.week,
                    "is_completed": bool(t.is_completed),
                    "created_at": _iso(t.created_at),
                }
            )

    streak = db.query(UserStreak).filter(UserStreak.user_id == user.id).first()

    export: Dict[str, Any] = {
        "export_metadata": {
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "format": "Feelivate account export v1 (JSON)",
            "policy_version": CONSENT_POLICY_VERSION,
            "excluded_for_security": [
                "password hash",
                "Google Calendar refresh token",
            ],
            "note": (
                "This file contains the personal data Feelivate holds about you. "
                "For data held by our processors on our behalf, see the Privacy Policy."
            ),
        },
        "account": {
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": _iso(user.created_at),
            "notification_email": user.notification_email,
            "email_notifications_enabled": bool(user.email_notifications_enabled),
            "preferred_notification_time": user.preferred_notification_time,
            "preferred_notification_timezone": user.preferred_notification_timezone,
            "calendar_sync_enabled": bool(user.calendar_sync_enabled),
        },
        "consents": [
            {
                "consent_type": c.consent_type,
                "granted": bool(c.granted),
                "policy_version": c.policy_version,
                "recorded_at": _iso(c.created_at),
                "ip_address": c.ip_address,
            }
            for c in db.query(UserConsent)
            .filter(UserConsent.user_id == user.id)
            .order_by(UserConsent.created_at.asc())
            .all()
        ],
        "sessions": [
            {
                "id": s.id,
                "title": s.title,
                "focus": s.focus,
                "vision": s.vision,
                "history": s.history,
                "phase": s.phase,
                "current_week": s.current_week,
                "plan_start_date": s.plan_start_date,
                "is_completed": bool(s.is_completed),
                "created_at": _iso(s.created_at),
                "updated_at": _iso(s.updated_at),
                "week_plan_json": s.week_plan_json,
                "week_review_json": s.week_review_json,
                "session_report_json": s.session_report_json,
                "result_json": s.result_json,
                "messages": messages_by_session.get(s.id, []),
                "tasks": tasks_by_session.get(s.id, []),
            }
            for s in sessions
        ],
        "voice_journals": [
            {
                "date": v.date,
                "session_id": v.session_id,
                "transcript": v.transcript,
                "emotion_label": v.emotion_label,
                "emotion_score": v.emotion_score,
                "one_liner": v.one_liner,
                "created_at": _iso(v.created_at),
            }
            for v in db.query(VoiceJournal)
            .filter(VoiceJournal.user_id == user.id)
            .order_by(VoiceJournal.date.asc())
            .all()
        ],
        "emotional_states": [
            {
                "session_id": e.session_id,
                "sentiment_score": e.sentiment_score,
                "dominant_emotion": e.dominant_emotion,
                "timestamp": _iso(e.timestamp),
            }
            for e in db.query(EmotionalState)
            .filter(EmotionalState.user_id == user.id)
            .order_by(EmotionalState.timestamp.asc())
            .all()
        ],
        "daily_checkins": [
            {
                "date": c.date,
                "session_id": c.session_id,
                "status": c.status,
                "note": c.note,
                "created_at": _iso(c.created_at),
            }
            for c in db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user.id)
            .order_by(DailyCheckin.date.asc())
            .all()
        ],
        "streak": (
            {
                "current_streak": streak.current_streak,
                "longest_streak": streak.longest_streak,
                "last_checkin": streak.last_checkin,
                "total_done": streak.total_done,
            }
            if streak
            else None
        ),
        "weekly_reports": [
            {
                "session_id": r.session_id,
                "week_number": r.week_number,
                "week_start": r.week_start,
                "week_end": r.week_end,
                "report_json": r.report_json,
                "created_at": _iso(r.created_at),
            }
            for r in db.query(WeeklyReport)
            .filter(WeeklyReport.user_id == user.id)
            .order_by(WeeklyReport.created_at.asc())
            .all()
        ],
        "feedback": [
            {
                "session_id": f.session_id,
                "rating": f.rating,
                "comments": f.comments,
                "created_at": _iso(f.created_at),
            }
            for f in db.query(Feedback)
            .filter(Feedback.user_id == user.id)
            .order_by(Feedback.created_at.asc())
            .all()
        ],
    }

    # Long-term memory stores are best-effort: if they are down we say so in the
    # file rather than quietly shipping an incomplete export.
    try:
        from .vector_store import vector_store

        export["long_term_memories"] = vector_store.export_user_memories(user.id)
    except Exception as e:
        logger.error(f"[Export] vector store export failed: {e}")
        export["long_term_memories"] = []
        export["export_metadata"]["warnings"] = [
            "Long-term memory store could not be read at export time. "
            "Contact us and we will supply it separately."
        ]

    return export


# ── Art 17: erasure ─────────────────────────────────────────────────────────

def delete_user_data(db: DBSession, user: User) -> Dict[str, Any]:
    """Permanently erase an account and everything attached to it.

    Deletion order follows the foreign keys inward-out: child rows first, then
    sessions, then the user. Nothing is soft-deleted — a row left behind with a
    `deleted` flag is still personal data under the GDPR.

    Returns per-table counts plus a `warnings` list. Warnings are non-fatal
    external failures (e.g. Qdrant unreachable); the caller surfaces them so
    an incomplete erasure is never reported as a clean success.
    """
    user_id = user.id
    warnings: List[str] = []

    session_ids = [row.id for row in db.query(Session.id).filter(Session.user_id == user_id).all()]

    counts: Dict[str, int] = {}

    if session_ids:
        counts["chat_messages"] = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id.in_(session_ids))
            .delete(synchronize_session=False)
        )
        counts["roadmap_tasks"] = (
            db.query(RoadmapTask)
            .filter(RoadmapTask.session_id.in_(session_ids))
            .delete(synchronize_session=False)
        )
    else:
        counts["chat_messages"] = 0
        counts["roadmap_tasks"] = 0

    for label, model in (
        ("weekly_reports", WeeklyReport),
        ("voice_journals", VoiceJournal),
        ("daily_checkins", DailyCheckin),
        ("emotional_states", EmotionalState),
        ("feedbacks", Feedback),
        ("user_streaks", UserStreak),
        ("user_consents", UserConsent),
    ):
        counts[label] = db.query(model).filter(model.user_id == user_id).delete(synchronize_session=False)

    counts["sessions"] = db.query(Session).filter(Session.user_id == user_id).delete(synchronize_session=False)
    counts["users"] = db.query(User).filter(User.id == user_id).delete(synchronize_session=False)

    db.commit()

    # External stores, after the primary DB commit so a failure here cannot roll
    # back the account deletion the user asked for.
    try:
        from .vector_store import vector_store

        if not vector_store.delete_user_memories(user_id):
            warnings.append("long_term_memory_store")
    except Exception as e:
        logger.error(f"[Erasure] vector store deletion failed: {e}")
        warnings.append("long_term_memory_store")

    try:
        from .memory import delete_user_data as delete_local_memory

        counts["local_memories"] = delete_local_memory(user_id)
    except Exception as e:
        # The SQLite/FAISS store is a local-dev fallback; absent in production.
        logger.debug(f"[Erasure] local memory store skipped: {e}")

    logger.info(f"[Erasure] account deleted | rows={sum(v for v in counts.values())} warnings={warnings}")
    return {"deleted": counts, "warnings": warnings}


# ── Art 5(1)(e): storage limitation ─────────────────────────────────────────

# Days of inactivity after which a dormant account is erased. 0 disables the
# sweep. Deleting user accounts automatically is destructive and irreversible,
# so this stays off until it is deliberately switched on — and the Privacy
# Policy must state the same number that is configured here.
INACTIVE_ACCOUNT_RETENTION_DAYS = int(os.getenv("INACTIVE_ACCOUNT_RETENTION_DAYS", "0"))


def run_retention_sweep(db: DBSession) -> Dict[str, int]:
    """Purge data that has outlived its purpose.

    Runs on a schedule from main.py. Currently:
      * expired email OTP codes — single-use secrets with no reason to persist
        past their expiry.
      * dormant accounts, only when INACTIVE_ACCOUNT_RETENTION_DAYS is set.
    """
    results: Dict[str, int] = {}
    now = datetime.utcnow()

    expired_otps = (
        db.query(User)
        .filter(User.email_otp_code.isnot(None), User.email_otp_expiry < now)
        .all()
    )
    for u in expired_otps:
        u.email_otp_code = None
        u.email_otp_expiry = None
    results["expired_otps_cleared"] = len(expired_otps)
    if expired_otps:
        db.commit()

    if INACTIVE_ACCOUNT_RETENTION_DAYS > 0:
        cutoff = now - timedelta(days=INACTIVE_ACCOUNT_RETENTION_DAYS)
        # "Active" means the account has a session touched since the cutoff.
        stale_users = []
        for u in db.query(User).filter(User.created_at < cutoff).all():
            latest = (
                db.query(Session.updated_at)
                .filter(Session.user_id == u.id)
                .order_by(Session.updated_at.desc())
                .first()
            )
            last_seen = latest[0] if latest and latest[0] else u.created_at
            if last_seen and last_seen < cutoff:
                stale_users.append(u)

        for u in stale_users:
            delete_user_data(db, u)
        results["inactive_accounts_deleted"] = len(stale_users)
    else:
        results["inactive_accounts_deleted"] = 0

    if any(results.values()):
        logger.info(f"[Retention] sweep complete: {results}")
    return results
