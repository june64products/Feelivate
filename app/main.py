"""
FastAPI app v3.0 — Single Smart Chat Endpoint.
Clean ChatGPT-style architecture: one /chat endpoint that handles everything.
"""

import json
import os
import re
import uuid
import secrets
import asyncio
import io
from typing import Any, Dict, Optional, List, Union

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks, UploadFile, File, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from loguru import logger
from sqlalchemy.orm import Session as DBSession

from fastapi.security import OAuth2PasswordBearer
from .database import engine, SessionLocal, init_db, get_db
from .models import (
    User, Session, ChatMessage, RoadmapTask, EmotionalState,
    DailyCheckin, UserStreak, VoiceJournal, WeeklyReport, TaskHowTo,
)
from .calendar_service import calendar_service
from .google_login import google_login_service
from .email_service import (
    generate_otp, send_verification_email, send_daily_task_email,
    run_daily_email_scheduler, run_evening_reminders, run_week_review_emails,
)
from .security import (
    get_password_hash, verify_password, create_access_token, decode_access_token,
    verify_email_action_token,
)
from .observability import REQUESTS_TOTAL
from .ratelimit import LIMITERS as RATE_LIMITERS, prune_all as prune_rate_limiters
from .crypto import encrypt_secret, decrypt_secret
from .safety import CRISIS_SYSTEM_INSTRUCTION, crisis_payload, detect_crisis
from . import guardrail
from .privacy import (
    CONSENT_POLICY_VERSION,
    REQUIRED_CONSENTS,
    build_user_export,
    delete_user_data,
    missing_consents,
    record_consents,
    run_retention_sweep,
)

load_dotenv()

from contextlib import asynccontextmanager

# ── APScheduler (optional — server starts even if not installed) ─────────────
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _SCHEDULER_AVAILABLE = True
except ImportError:
    _scheduler = None
    _SCHEDULER_AVAILABLE = False
    logger.warning("[Scheduler] APScheduler not installed — daily emails disabled. Install it via: pip install APScheduler pytz")

@asynccontextmanager
async def lifespan(app):
    """Initialise the database, then start the scheduler; stop it on shutdown.

    Everything that must happen at boot belongs *here*. Starlette only runs the
    handlers registered via @app.on_event when it is using its own default
    lifespan — pass a custom one, as this app does, and those handlers are
    silently ignored. init_db() used to live in an on_event("startup") hook and
    therefore never ran: existing deployments only worked because their tables
    had been created before the lifespan was introduced, and the first genuinely
    new table (user_consents) failed to appear, turning every signup into a 500.
    """
    # Every slow step of a request (guardrail, embedding, memory search, the
    # model call itself) runs through asyncio.to_thread, which uses the loop's
    # default executor: min(32, cpu_count + 4) threads — 5–8 on the machines
    # this runs on. A model call holds its thread for 5–20 s, so that capped
    # the whole API at roughly six chats in flight; the rest queued, still
    # holding their pooled DB connection, until the pool timed out into 500s.
    # 32 threads sit idle almost entirely on network waits, so they are cheap.
    from concurrent.futures import ThreadPoolExecutor
    asyncio.get_running_loop().set_default_executor(
        ThreadPoolExecutor(
            max_workers=int(os.getenv("WORKER_THREADS", "32")),
            thread_name_prefix="feelivate-worker",
        )
    )

    try:
        init_db()
        logger.info("Application startup: DB initialization done.")
    except Exception as e:
        logger.error(f"CRITICAL: Database initialization failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())

    # Idempotent, and a no-op once clean: leaves no readable password in storage.
    try:
        from .database import migrate_plaintext_passwords
        migrate_plaintext_passwords()
    except Exception as e:
        logger.error(f"Password migration failed at startup: {e}")

    if _SCHEDULER_AVAILABLE and _scheduler:
        _scheduler.add_job(
            run_daily_email_scheduler,
            trigger="cron",
            minute="*",   # every minute — checks if any user's preferred time matches
            id="daily_email_scheduler",
            replace_existing=True,
        )
        # The evening note, same per-user-timezone check: 20:30 local if the
        # day's journal is missing (a streak that would end tonight is said
        # in the same note).
        _scheduler.add_job(
            run_evening_reminders,
            trigger="cron",
            minute="*",
            id="evening_reminders",
            replace_existing=True,
        )
        # "Your review is in" — 21:30 local once a locked week has ended and
        # its review can be read.
        _scheduler.add_job(
            run_week_review_emails,
            trigger="cron",
            minute="*",
            id="week_review_emails",
            replace_existing=True,
        )
        # Storage limitation (GDPR Art 5(1)(e)) is an obligation, not a chore —
        # it has to run on its own schedule rather than depend on someone
        # remembering to clean up.
        _scheduler.add_job(
            _retention_job,
            trigger="cron",
            hour="3",
            minute="17",   # off the hour so it doesn't pile onto other cron work
            id="retention_sweep",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("[Scheduler] APScheduler started — daily emails + evening reminders + nightly retention sweep")
    yield
    if _SCHEDULER_AVAILABLE and _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] APScheduler shut down")

app = FastAPI(title="Feelivate API", version="3.0.0", lifespan=lifespan)

# CORS
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "https://feelivate.com,https://www.feelivate.com,https://emotion-time-travel-brlz.vercel.app"
)
_allowed_origins = [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]

# Preview deployments live on unpredictable *.vercel.app subdomains, so during
# development it is convenient to allow the whole zone. In production that means
# *any* Vercel-hosted site — including someone else's — can make credentialed
# requests to this API, which removes a layer of defence in an XSS or leaked
# token scenario. So the wildcard is opt-in and off by default; production
# should list its real origins in ALLOWED_ORIGINS instead.
_allow_vercel_previews = os.environ.get("ALLOW_VERCEL_PREVIEW_ORIGINS", "").lower() in {"1", "true", "yes"}
_vercel_origin_regex = r"https://([a-zA-Z0-9-]+\.)*vercel\.app" if _allow_vercel_previews else None

if _allow_vercel_previews:
    logger.warning(
        "CORS: all *.vercel.app origins are allowed (ALLOW_VERCEL_PREVIEW_ORIGINS). "
        "Leave this unset in production."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_vercel_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: DBSession = Depends(get_db)):
    """Dependency to validate JWT and return the current user."""
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_consented_user(
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Like get_current_user, but also requires a current, valid consent.

    Applied to the endpoints that actually process wellbeing content. A client
    that skips the consent screen therefore cannot reach them — the gate does
    not depend on the frontend behaving.

    Defined here, next to get_current_user, because FastAPI evaluates Depends()
    defaults at import time: a dependency must exist before the first endpoint
    that references it.
    """
    outstanding = missing_consents(db, current_user.id)
    if outstanding:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "consent_required",
                "message": "Please review and accept the updated terms to continue.",
                "missing": outstanding,
                "policy_version": CONSENT_POLICY_VERSION,
            },
        )
    return current_user


# ── Client identification & rate limiting ───────────────────────────────────

def client_ip(request: Request) -> str:
    """Best-effort client IP.

    Northflank terminates TLS in front of the app, so request.client.host is the
    proxy. Trust the left-most X-Forwarded-For entry, which is the original
    client for a single trusted proxy hop.
    """
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip", "")
    if real_ip:
        return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(bucket: str, request: Request, identity: Optional[str] = None) -> None:
    """Raise 429 when the caller has exhausted the quota for `bucket`.

    `identity` (email or user id) is preferred over IP where available, so a
    shared NAT/office IP can't lock everyone out of their own account.
    """
    limiter = RATE_LIMITERS.get(bucket)
    if limiter is None:
        return
    key = f"{bucket}:{(identity or '').lower().strip() or client_ip(request)}"
    allowed, retry_after = limiter.check(key)
    if not allowed:
        logger.warning(f"[RateLimit] blocked bucket={bucket}")
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please wait a little while and try again.",
            headers={"Retry-After": str(retry_after)},
        )


def _clear_rate_limit(bucket: str, request: Request, identity: Optional[str] = None) -> None:
    """Reset a bucket after a legitimate success."""
    limiter = RATE_LIMITERS.get(bucket)
    if limiter is None:
        return
    limiter.reset(f"{bucket}:{(identity or '').lower().strip() or client_ip(request)}")


def _retention_job():
    """Scheduled housekeeping: storage limitation + limiter bookkeeping."""
    db = SessionLocal()
    try:
        run_retention_sweep(db)
    except Exception as e:
        logger.error(f"[Retention] sweep failed: {e}")
    finally:
        db.close()
    try:
        prune_rate_limiters()
    except Exception as e:
        logger.debug(f"[RateLimit] prune failed: {e}")


@app.post("/admin/migrate", tags=["admin"])
def run_migrations_endpoint(x_internal_token: Optional[str] = Header(None)):
    """
    Emergency endpoint: run DB migrations manually.
    Safe to call multiple times — all statements use IF NOT EXISTS.

    Requires INTERNAL_ADMIN_TOKEN. An unauthenticated endpoint that issues DDL
    is an availability risk on a database holding special-category data, so it
    refuses to run at all when no token is configured.
    """
    expected = os.environ.get("INTERNAL_ADMIN_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoint disabled: INTERNAL_ADMIN_TOKEN is not configured.",
        )
    if not x_internal_token or not secrets.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        from .database import init_db as _init_db
        _init_db()
        return {"status": "ok", "message": "Migrations complete."}
    except Exception:
        logger.exception("Migration failed")
        return {"status": "error", "message": "Migration failed. Check server logs."}


@app.post("/admin/repair-stranded-weeks", tags=["admin"])
def repair_stranded_weeks_endpoint(
    apply: bool = False,
    session_id: Optional[str] = None,
    today: Optional[str] = None,
    x_internal_token: Optional[str] = Header(None),
    db: DBSession = Depends(get_db),
):
    """Move weeks that were locked into an already-past window onto today.

    Same job as scripts/repair_stranded_weeks.py, over HTTP — a deployment
    without an interactive shell still needs a way to run it.

    Defaults to a dry run: it reports what it would change and writes nothing
    until `apply=true`. Weeks that have journals inside their window are never
    touched — that week ran normally and moving it would rewrite real history.

    Guarded by INTERNAL_ADMIN_TOKEN like /admin/migrate, and refuses outright
    when no token is configured: this endpoint rewrites user content.
    """
    expected = os.environ.get("INTERNAL_ADMIN_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoint disabled: INTERNAL_ADMIN_TOKEN is not configured.",
        )
    if not x_internal_token or not secrets.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")

    from datetime import date as _d
    from . import repair as _repair

    today_iso = today or _d.today().isoformat()
    try:
        _d.fromisoformat(today_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="`today` must be YYYY-MM-DD.")

    try:
        return _repair.run(db, today_iso, apply=apply, session_id=session_id)
    except Exception:
        logger.exception("Stranded-week repair failed")
        raise HTTPException(status_code=500, detail="Repair failed. Check server logs.")


@app.post("/admin/repair-short-weeks", tags=["admin"])
def repair_short_weeks_endpoint(
    apply: bool = False,
    session_id: Optional[str] = None,
    today: Optional[str] = None,
    x_internal_token: Optional[str] = Header(None),
    db: DBSession = Depends(get_db),
):
    """Pad locked weeks whose plan stops before its window's Sunday.

    Same job as scripts/repair_short_weeks.py, over HTTP — a deployment without
    an interactive shell still needs a way to run it.

    Defaults to a dry run: it reports what it would change and writes nothing
    until `apply=true`. Only weeks that are still running (or have not started)
    are touched, and padding only ever appends rest days to the tail — it never
    rewrites a day the user already lived.

    Guarded by INTERNAL_ADMIN_TOKEN like /admin/migrate, and refuses outright
    when no token is configured: this endpoint rewrites user content.
    """
    expected = os.environ.get("INTERNAL_ADMIN_TOKEN", "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoint disabled: INTERNAL_ADMIN_TOKEN is not configured.",
        )
    if not x_internal_token or not secrets.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")

    from datetime import date as _d
    from . import repair as _repair

    today_iso = today or _d.today().isoformat()
    try:
        _d.fromisoformat(today_iso)
    except ValueError:
        raise HTTPException(status_code=400, detail="`today` must be YYYY-MM-DD.")

    try:
        return _repair.run_short_weeks(db, today_iso, apply=apply, session_id=session_id)
    except Exception:
        logger.exception("Short-week repair failed")
        raise HTTPException(status_code=500, detail="Repair failed. Check server logs.")


def _cors_headers_for(request: Request) -> Dict[str, str]:
    """CORS headers to attach to responses that bypass CORSMiddleware.

    Starlette runs handlers registered for bare `Exception` inside
    ServerErrorMiddleware, which sits *outside* CORSMiddleware — so a 500 goes
    back with no CORS headers at all. The browser then reports it as an opaque
    "Failed to fetch" instead of a 500, which hides the actual failure from the
    frontend and from anyone debugging it.
    """
    origin = request.headers.get("origin")
    if not origin:
        return {}
    allowed = origin in _allowed_origins or (
        _vercel_origin_regex is not None and re.fullmatch(_vercel_origin_regex, origin) is not None
    )
    if not allowed:
        return {}
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Vary": "Origin",
    }


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    REQUESTS_TOTAL.labels(route=str(request.url.path), method=request.method, status="500").inc()
    logger.exception("unhandled_exception")
    # Never leak internal error text (may contain provider/model/infra details) to the client.
    return JSONResponse(
        status_code=500,
        content={"error": "Something went wrong. Please try again."},
        headers=_cors_headers_for(request),
    )


@app.get("/", tags=["health"])
def read_root():
    return {"status": "ok", "version": "v3.0-smart-mentor"}


# ============================================================
# INPUT MODELS
# ============================================================

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: str
    timezone: Optional[str] = "UTC"
    # YYYY-MM-DD: when the user wants their first week to begin. Sent with the
    # setup answers so the draft is built for the real window (start → Sunday)
    # instead of today's and then padded with rest days at lock time.
    start_date: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    # Consent decisions keyed by the entries in privacy.REQUIRED_CONSENTS /
    # OPTIONAL_CONSENTS, e.g. {"terms_privacy_age": true, "sensitive_data": true}.
    # Every required key must be true.
    consents: Optional[Dict[str, bool]] = None


class ConsentRequest(BaseModel):
    consents: Dict[str, bool]


class ConsentWithdrawRequest(BaseModel):
    consent_type: str


class AccountDeleteRequest(BaseModel):
    # Typing the exact word is the confirmation step — the action is
    # irreversible and must not be reachable by a single stray click.
    confirmation: str
    # Required for password accounts; Google-only accounts pass nothing.
    password: Optional[str] = None

class TaskUpdate(BaseModel):
    is_completed: bool

class MessageCreate(BaseModel):
    role: str
    content: str

class CheckinRequest(BaseModel):
    status: str                       # "done" | "skipped"
    note: Optional[str] = None
    session_id: Optional[str] = None
    client_date: Optional[str] = None  # ISO date from client local timezone e.g. "2026-05-31"

class WeeklyReviewRequest(BaseModel):
    week_number: int
    feedback: str         # free-text: "Week 1 was hard on days 3-4..."

# ── Smart memory helpers ─────────────────────────────────────────────────────
_PERSONAL_KEYWORDS = [
    "feel", "emotion", "week", "plan", "goal", "struggle", "stress",
    "anxious", "progress", "update", "journal", "mood", "how am i",
    "kaise", "stressed", "motivation", "tired", "excited", "confident",
]

def _is_personal_query(message: str) -> bool:
    """Return True only if message seems personally relevant (not generic knowledge)."""
    msg = message.lower()
    return any(kw in msg for kw in _PERSONAL_KEYWORDS)


# ============================================================
# CORE: THE ONE CHAT ENDPOINT
# ============================================================

def _extract_json_by_braces(text: str) -> Optional[str]:
    """Extract the outermost JSON object from text using balanced brace counting.
    Handles preamble text before JSON and nested braces inside plan actions.
    Returns the JSON substring or None if no valid object found.
    """
    start = None
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"' and not escape:
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                return text[start:i + 1]
    # If we found a start but JSON was truncated (depth > 0), try to close it
    if start is not None and depth > 0:
        closer = ']' * text[start:].count('[') + '}' * depth  # rough guess
        candidate = text[start:] + closer
        try:
            json.loads(candidate)
            return candidate
        except Exception:
            pass
    return None


def _parse_llm_response(raw_text: str) -> Dict[str, Any]:
    """Parse LLM response into {reply, plan} format.
    
    Uses a multi-strategy approach to handle common LLM output issues:
    1. Direct JSON parse (model output clean JSON)
    2. Strip markdown fences, then direct parse
    3. Balanced-brace extraction (handles preamble text before JSON)
    4. Regex extraction of "reply" field (last resort for broken JSON)
    """
    # Strip thinking blocks (some models wrap reasoning in <think> tags)
    raw_text = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL).strip()
    
    # Strip markdown code fences: ```json\n{...}\n```, ```\n{...}\n```
    fence_stripped = re.sub(r'```(?:json)?\s*', '', raw_text)
    fence_stripped = fence_stripped.replace('```', '').strip()
    
    # Strategy 1: Try direct json.loads on the full text (fastest path)
    for text_to_try in [fence_stripped, raw_text]:
        text_trimmed = text_to_try.strip()
        if text_trimmed.startswith('{'):
            try:
                data = json.loads(text_trimmed)
                if isinstance(data, dict) and "reply" in data:
                    return {
                        "reply": str(data.get("reply", "")),
                        "plan": data.get("plan", None),
                        # Optional fields: the one-time "why" (RULE 1c) and the
                        # setup-questions form for the popup (RULE 1).
                        "commitment_why": data.get("commitment_why"),
                        "questions": data.get("questions"),
                    }
            except json.JSONDecodeError:
                pass

    # Strategy 2: Balanced-brace extraction (handles preamble text like
    # "Done — here's your plan:\n\n{...}" or code snippets with nested braces)
    for text_to_try in [fence_stripped, raw_text]:
        json_str = _extract_json_by_braces(text_to_try)
        if json_str:
            try:
                data = json.loads(json_str)
                if isinstance(data, dict) and "reply" in data:
                    return {
                        "reply": str(data.get("reply", "")),
                        "plan": data.get("plan", None),
                        # Optional fields: the one-time "why" (RULE 1c) and the
                        # setup-questions form for the popup (RULE 1).
                        "commitment_why": data.get("commitment_why"),
                        "questions": data.get("questions"),
                    }
            except json.JSONDecodeError as e:
                logger.warning(f"Balanced-brace JSON parse failed: {e}")

    # Strategy 3: Try the old find/rfind approach as another fallback
    for text_to_try in [fence_stripped, raw_text]:
        try:
            start = text_to_try.find("{")
            end = text_to_try.rfind("}")
            if start != -1 and end != -1 and end > start:
                json_str = text_to_try[start:end + 1].strip()
                data = json.loads(json_str)
                if isinstance(data, dict) and "reply" in data:
                    return {
                        "reply": str(data.get("reply", "")),
                        "plan": data.get("plan", None),
                        # Optional fields: the one-time "why" (RULE 1c) and the
                        # setup-questions form for the popup (RULE 1).
                        "commitment_why": data.get("commitment_why"),
                        "questions": data.get("questions"),
                    }
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"find/rfind JSON parse attempt failed: {e}")
            continue

    # Strategy 4: Extract "reply" field via regex (handles partially broken JSON
    # where the plan section has issues but the reply is still extractable)
    reply_match = re.search(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"\s*[,}]', fence_stripped or raw_text)
    if reply_match:
        reply_text = reply_match.group(1)
        # Unescape basic JSON escapes
        reply_text = reply_text.replace('\\"', '"').replace('\\n', '\n').replace('\\\\', '\\')
        logger.warning("Used regex fallback to extract reply from broken JSON")
        return {"reply": reply_text, "plan": None}
    
    # Strategy 5 (final): Treat entire response as plain text reply
    clean_text = fence_stripped or raw_text.strip()
    # If it looks like it was supposed to be JSON, clean up structural chars
    if clean_text.startswith("{"):
        clean_text = re.sub(r'[{}\[\]]', '', clean_text)
        clean_text = re.sub(r'"reply"\s*:\s*"?', '', clean_text)
        clean_text = re.sub(r'",?\s*"plan"\s*:.*', '', clean_text, flags=re.DOTALL)
        clean_text = clean_text.strip().strip('"').strip()
    
    return {"reply": clean_text or "I'm here — what can I help you with?", "plan": None}


def _clean_reply_text(reply: str, has_plan: bool) -> str:
    """Strip a plan the model restated inside its own chat message.

    The plan is rendered as a card from the `plan` object, so anything the model
    also writes into `reply` is a duplicate — and when it pastes the raw JSON
    (which it does, because the current plan is injected into its context as
    JSON) the user sees `{"week_number": 0, "days": [...]}` in a chat bubble.

    Prompt rules alone don't hold here: the model is being shown JSON and asked
    not to echo it. So the reply is cleaned on the way out as well.
    """
    if not reply:
        return reply

    cleaned = reply

    # A JSON object carrying plan fields, wherever it appears in the message.
    cleaned = re.sub(
        r'\{[^{}]*"(?:week_number|days|win_condition|generated_date)"\s*:.*',
        '',
        cleaned,
        flags=re.DOTALL,
    )

    # Prose schedules are only stripped when a card is actually attached. With a
    # card, any day-by-day text in the message is by definition the same plan
    # written twice. Without one, the identical wording may be a legitimate
    # answer — "what time should I study?" deserves times in the reply — so it
    # is left alone rather than gutted.
    if has_plan:
        # Inline, mid-sentence: "...here's your plan: Day 1 (Saturday): Watch 30
        # minutes... Day 2 (Sunday): Review." Cut from the first day marker on.
        cleaned = re.sub(
            r'(?:Day\s*\d+|\b[A-Z][a-z]{2}\s+\d{1,2})\s*\([A-Za-z]{3,9}\)\s*[:,].*',
            '',
            cleaned,
            flags=re.DOTALL,
        )

        # A schedule dump: the first time block and everything after it.
        cleaned = re.sub(
            r'\b\d{1,2}:\d{2}\s*(?:[-–]\s*\d{1,2}:\d{2})?\s*(?:AM|PM|am|pm)?\s*:.*',
            '',
            cleaned,
            flags=re.DOTALL,
        )

        # A day list on its own lines: "- Aug 08 (Sat): ..." / "**Day 1**: ...".
        cleaned = re.sub(
            r'(?:^|\n)\s*(?:[-*•]\s*)?\*{0,2}(?:Day\s*\d+|\w{3}\s+\d{1,2})\b[^\n]{0,40}?\*{0,2}\s*[:\-–]\s*\n?(?:\s{2,}[^\n]*\n?)*',
            '\n',
            cleaned,
        )

    # Tidy the leftovers: dangling colons, repeated blank lines, stray quotes,
    # and the preposition left hanging where the cut landed ("...broken down For").
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    cleaned = cleaned.strip().strip('"').strip()
    cleaned = re.sub(r'[:\-–,]\s*$', '', cleaned).strip()
    cleaned = re.sub(
        r'[\s,]+(?:for|and|with|into|on|at|by|to|in|of|like)\s*$', '', cleaned, flags=re.I
    ).strip()
    cleaned = re.sub(r'[:\-–,]\s*$', '', cleaned).strip()

    if len(cleaned) < 15:
        # Everything of substance was a restated plan. With a card attached the
        # plan is still on screen; without one the model meant to send a plan and
        # didn't, so point the user at the one action that produces it.
        return (
            "Here's your plan — take a look and tell me if you want anything changed."
            if has_plan
            else "Got it. Say \"make a plan\" and I'll put that straight into your week."
        )
    return cleaned


def _fill_plan_gaps(plan: Optional[dict]) -> Optional[dict]:
    """Supply the header fields the card renders, when the model leaves them out.

    A plan with no `theme` renders as a card headed "WEEK 0" with an empty
    "Win:" line, which reads like the app broke.
    """
    if not isinstance(plan, dict):
        return plan
    days = plan.get("days") if isinstance(plan.get("days"), list) else []
    if not str(plan.get("theme") or "").strip():
        wk = plan.get("week_number")
        plan["theme"] = "Getting Started" if wk in (0, 1) else f"Week {wk}"
    if not str(plan.get("win_condition") or "").strip() and days:
        target = max(1, round(len(days) * 0.8))
        plan["win_condition"] = f"Complete {target} of {len(days)} days"
    else:
        # The model sometimes writes a win the plan can't hold — "3 of 4 runs"
        # over a week that schedules two runs. The days array is the ground
        # truth, so the win's arithmetic is checked against it and rewritten
        # when they disagree.
        win = str(plan.get("win_condition") or "")
        m = re.search(r"(\d+)\s+(?:out\s+of|of)\s+(\d+)\s*([A-Za-z]*)", win)
        if m and days:
            rest_re = re.compile(r"^\s*(?:optional\s+)?(?:rest|recovery)\b", re.I)
            action_count = sum(
                1 for d in days
                if isinstance(d, dict) and not rest_re.match(str(d.get("action") or ""))
            )
            x, y = int(m.group(1)), int(m.group(2))
            # "4 of 6 days" counting every day is as valid as "2 of 2 runs"
            # counting only the work — broken only when the denominator matches
            # neither, or the target exceeds it.
            if (y not in (action_count, len(days)) or x > y) and action_count:
                unit = m.group(3) or "days"
                target = max(1, round(action_count * 0.8))
                plan["win_condition"] = f"Complete {target} of {action_count} {unit}"
    if not str(plan.get("week_label") or "").strip() and days:
        first = str(days[0].get("day", "")) if isinstance(days[0], dict) else ""
        last = str(days[-1].get("day", "")) if isinstance(days[-1], dict) else ""
        if first and last:
            plan["week_label"] = first if first == last else f"{first} – {last}"
    return plan


def _generate_and_save_title(session_id: str, user_message: str, assistant_reply: str):
    """
    Background task: generate a short sidebar title for a session's first exchange
    via Groq's cheap model and persist it. Runs in its own DB session because the
    request's session is already closed by the time background tasks execute.
    """
    from .llm import generate_session_title
    db = SessionLocal()
    try:
        title = generate_session_title(user_message, assistant_reply)
        if not title:
            return
        sess = db.query(Session).filter(Session.id == session_id).first()
        if sess and not sess.title:
            sess.title = title
            db.commit()
            logger.info(f"[Title] session {session_id} → '{title}'")
    except Exception as e:
        logger.warning(f"[Title] save failed (non-fatal): {e}")
    finally:
        db.close()


async def _blocked_chat_response(db: DBSession, session_id: str, user_id: str,
                                 message: str, verdict) -> Dict[str, Any]:
    """Answer a blocked message without ever calling the mentor model.

    The exchange is still written to the thread so the conversation reads
    coherently when the user scrolls back — but it is deliberately kept out of
    the vector store, so a blocked request never becomes long-term context the
    mentor recalls later. No flag of any kind is stored against the user.
    """
    reply_text = guardrail.refusal_text()
    try:
        session_rec = db.query(Session).filter(Session.id == session_id).first()
        if not session_rec:
            session_rec = Session(id=session_id, user_id=user_id, focus="", history="", vision="")
            db.add(session_rec)
            db.commit()

        db.add(ChatMessage(session_id=session_id, role="user", content=message))
        db.add(ChatMessage(session_id=session_id, role="assistant", content=reply_text))
        db.commit()
    except Exception as e:
        # The refusal matters more than the transcript — still return it.
        logger.warning(f"Could not persist blocked exchange (non-fatal): {e}")

    return {
        "reply": reply_text,
        "plan": None,
        "session_id": session_id,
        "blocked": guardrail.blocked_payload(verdict),
    }


# ── Chat concurrency gate ────────────────────────────────────────────────────
# Backpressure for the one endpoint that does real work. Every chat holds a
# worker thread and, for part of its life, a pooled DB connection, for 5–20 s.
# Without a cap, a burst of 100 arrivals checks out every connection in the
# pool and the rest block on the pool *from the event loop* (the DB calls in
# this handler are synchronous), which freezes the whole API — health checks
# included. Requests beyond the cap wait here instead: in the async layer,
# holding nothing. Sized below the DB pool (10 + 20) so pool waits never
# happen. Load-tested: 100 simultaneous chats went from a total stall to all
# served, the last one ~45 s later.
_CHAT_GATE: Optional[asyncio.Semaphore] = None  # created on first use, on the running loop
_CHAT_GATE_WAIT_S = float(os.getenv("CHAT_QUEUE_TIMEOUT", "90"))


async def _chat_gate():
    global _CHAT_GATE
    if _CHAT_GATE is None:
        _CHAT_GATE = asyncio.Semaphore(int(os.getenv("CHAT_CONCURRENCY", "24")))
    try:
        await asyncio.wait_for(_CHAT_GATE.acquire(), timeout=_CHAT_GATE_WAIT_S)
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=503,
            detail="The mentor is busy right now — please try again in a moment.",
        )
    try:
        yield
    finally:
        _CHAT_GATE.release()


@app.post("/chat", tags=["chat"])
async def chat(
    *,
    # First on purpose: FastAPI resolves dependencies in signature order, and
    # the gate must be taken before get_db checks a connection out of the pool.
    _gate: None = Depends(_chat_gate),
    payload: ChatRequest,
    background_tasks: BackgroundTasks,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_consented_user)
):
    """
    The ONE chat endpoint. Handles everything:
    - Casual conversation
    - Lovable-style questions (one at a time)
    - Week plan generation
    - Plan revision
    - Free chat after plan
    """
    from .llm import call_with_fallback_chain, create_embedding
    from .prompts import build_chat_prompt
    from .vector_store import vector_store
    
    user_id = payload.user_id
    session_id = payload.session_id or str(uuid.uuid4())
    message = payload.message.strip()
    
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    # Session id only. The user id and the message body stay out of the log
    # stream — chat content here is wellbeing data (GDPR Art 9).
    logger.info(f"Chat request | session={session_id}")

    # Screened locally, before the message goes anywhere else.
    in_crisis = detect_crisis(message)

    # Security agent. Crisis wins: someone in distress gets the helpline card,
    # never a policy refusal. Everyone else is screened before the mentor model
    # is called at all — a blocked request never reaches it, so there is no
    # reply to leak and no plan object to slip out alongside one.
    if not in_crisis:
        verdict = await asyncio.to_thread(guardrail.screen, message)
        if not verdict.allowed:
            logger.info(f"Chat blocked | session={session_id} | stage={verdict.stage}")
            return await _blocked_chat_response(db, session_id, user_id, message, verdict)

    try:
        # 1. Get or create session
        session_rec = db.query(Session).filter(Session.id == session_id).first()
        if not session_rec:
            session_rec = Session(
                id=session_id,
                user_id=user_id,
                focus="",
                history="",
                vision=""
            )
            db.add(session_rec)
            db.commit()

        # 1b. "When do you start?" — answered right after the setup questions,
        # before the first draft exists. Remembered on the session so the draft
        # (and every tweak of it) is built for start → Sunday, and the lock
        # defaults to the same day. Only the first week is asked up front; a
        # later week keeps its lock-time choice.
        import datetime as _sd
        try:
            import zoneinfo as _sz
            _today_for_start = _sd.datetime.now(_sz.ZoneInfo(payload.timezone or "UTC")).date().isoformat()
        except Exception:
            _today_for_start = _sd.date.today().isoformat()
        _next_week_start = None   # a later week's chosen start, held until its draft is saved
        if payload.start_date and not session_rec.is_completed:
            if session_rec.phase != "active":
                session_rec.plan_starts_on = _resolve_start_date(session_rec, _today_for_start, payload.start_date)
                db.commit()
            else:
                # Week N+1: validated now, written to the session only once the
                # draft exists — an active week must never see a future start.
                _next_week_start = _resolve_next_week_start(session_rec, _today_for_start, payload.start_date)
        _chosen_start = (
            session_rec.plan_starts_on if (session_rec.phase != "active" and session_rec.plan_starts_on) else _next_week_start
        )

        # 2. Fetch conversation history from DB
        db_messages = db.query(ChatMessage).filter(
            ChatMessage.session_id == session_id
        ).order_by(ChatMessage.created_at.asc()).all()
        
        history = [{"role": m.role, "content": m.content} for m in db_messages]
        
        # Add current user message to history
        history.append({"role": "user", "content": message})
        
        # 3. Build system context (current pending/active plan info)
        system_context = None
        if session_rec.week_plan_json:
            phase_label = "LOCKED" if session_rec.phase == "active" else "PENDING APPROVAL"
            # Show the plan as a readable list, not as the stored JSON. Handing
            # the model JSON is what teaches it to paste JSON back into the chat
            # message — including bookkeeping fields like generated_date, which
            # the user then reads in a chat bubble.
            try:
                _cur = json.loads(session_rec.week_plan_json)
                _lines = [
                    f"- {d.get('day', '?')}: {d.get('action', '')}"
                    for d in (_cur.get("days") or []) if isinstance(d, dict)
                ]
                _readable = (
                    f"Theme: {_cur.get('theme', '—')}\n"
                    f"Win condition: {_cur.get('win_condition', '—')}\n"
                    + "\n".join(_lines)
                )
            except Exception:
                _readable = session_rec.week_plan_json
            system_context = (
                f"CURRENT WEEK {session_rec.current_week} PLAN ({phase_label}):\n{_readable}"
            )

        # Persist the user's core goal + measurable targets across EVERY week, so a long
        # conversation never drops what they first asked for (e.g. "protein 150g/day").
        if session_rec.focus:
            system_context = (system_context or "") + (
                f"\n\nUSER'S CORE GOAL (stated at the start — honour it in EVERY plan): \"{session_rec.focus}\""
                "\nPreserve every specific, measurable target they gave (daily protein grams, weight,"
                " hours, reps, pages) in every week's plan — never silently drop a stated requirement."
            )

        # A completed / stopped session is a plain conversation — planning is over.
        if session_rec.is_completed or session_rec.phase == "completed":
            system_context = (system_context or "") + (
                "\n\n⛔ THIS SESSION IS COMPLETED. The user finished and closed this journey."
                " Behave as a plain conversational assistant — answer, reflect, encourage. Do NOT"
                " build, offer, or output any plan; always keep \"plan\": null. If they want a new"
                " plan, tell them to start a new session."
            )

        # SETUP GATE: no plan may be built until the user has actually completed the setup
        # form ("Setup answers: ..."). This covers RE-TYPED goals, not just the first message —
        # otherwise the model one-shots a generic plan on the 2nd/3rd try and fabricates times.
        _is_setup_answers = message.strip().lower().startswith("setup answers")
        _prior_setup = any("setup answers" in (m.content or "").lower() for m in db_messages)
        _needs_setup = (not _is_setup_answers) and (not _prior_setup) and (not session_rec.week_plan_json)
        if _needs_setup:
            system_context = (system_context or "") + (
                "\n\n⚠️ SETUP REQUIRED. The user has NOT completed the setup form yet. Reply with ONLY"
                " the questions form: a short reply + a \"questions\" array (3-4 questions reworded for"
                " their goal, WHY last), and \"plan\": null. Do NOT output a plan this turn under any"
                " circumstance — you don't know their schedule or level, and inventing them (e.g. a"
                " 7:00 AM you were never told) is the exact failure being prevented."
            )

        # 4. Load plan history for multi-week context
        plan_history = []
        if session_rec.result_json:
            try:
                parsed_history = json.loads(session_rec.result_json)
                if isinstance(parsed_history, list):
                    plan_history = parsed_history
            except Exception:
                plan_history = []
        
        # 4b. Retrieve relevant memories — ONLY for personal queries, ONLY current session
        # Design rule: Plans cross sessions. Emotions do NOT.
        # Old session emotional data is never auto-injected (user views it in /journey).
        embedding = None
        try:
            embedding = await asyncio.to_thread(create_embedding, message)
            if embedding and _is_personal_query(message):
                # Scope to THIS session inside Qdrant (session_id is indexed), so
                # the five nearest hits are all usable instead of five global
                # hits that mostly belong to other sessions.
                hits = await asyncio.to_thread(
                    vector_store.search_memories, user_id, embedding, 5, {"session_id": session_id}
                )
                # Belt and braces: the store returns hits as {text, metadata,
                # score}. This used to read a "payload" key that never existed,
                # so every retrieved memory was discarded and the mentor never
                # saw one.
                session_memories = [
                    h["text"] for h in hits
                    if (h.get("metadata") or {}).get("session_id") == session_id
                ]
                if session_memories:
                    memory_text = "\n".join(session_memories)
                    ctx_line = f"\n\nCURRENT SESSION CONTEXT:\n{memory_text}"
                    system_context = (system_context or "") + ctx_line
        except Exception as e:
            logger.warning(f"Memory retrieval failed (non-fatal): {e}")
        
        # 4c. Load week reviews for multi-week calibration
        week_reviews = []
        if session_rec.week_review_json:
            try:
                week_reviews = json.loads(session_rec.week_review_json)
            except Exception:
                week_reviews = []

        # 4d. Auto-fetch the latest weekly report from DB (compressed performance context)
        # This saves tokens vs injecting raw transcripts — report is already AI-summarized.
        # Only inject when plan is active (relevant for building next week).
        #
        # IMPORTANT: use session-scoped _get_week_bounds() instead of standard Mon–Sun
        # calendar-week arithmetic. If the plan started on a non-Monday (e.g. Wednesday),
        # the report is stored under the session's week_start, not the calendar Mon.
        # Using calendar-week lookup causes week_report_data to always be None for these
        # sessions, which means the LLM has no performance context and either asks questions
        # or silently generates a week_number=1 plan that the lock guard discards.
        week_report_data = None
        if session_rec.phase == "active" and session_rec.plan_start_date:
            from datetime import date as _date_cls
            # NOTE: `or 1` would turn a valid Week 0 into Week 1 (0 is falsy), so the
            # report fetch must use an explicit None-check to keep Week 0 as 0.
            current_wk = session_rec.current_week if session_rec.current_week is not None else 1

            # Check current week first, then previous week (user may be asking for N+1
            # while still technically on the last day of week N, or report may be cached
            # from a completed prior week).
            for wk_to_check in [current_wk, max(1, current_wk - 1)]:
                try:
                    # Use lock-date-aware bounds so we find reports stored under the
                    # week's actual start (matches get_weekly_report's keying).
                    ws_check, _, _ = _week_bounds_for(session_rec, wk_to_check)
                except Exception:
                    continue
                latest_report = (
                    db.query(WeeklyReport)
                    .filter(
                        WeeklyReport.user_id == user_id,
                        WeeklyReport.session_id == session_id,
                        WeeklyReport.week_start == ws_check,
                    )
                    .first()
                )
                if not latest_report:
                    # Also try without session_id filter — older reports may not have it set
                    latest_report = (
                        db.query(WeeklyReport)
                        .filter(
                            WeeklyReport.user_id == user_id,
                            WeeklyReport.week_start == ws_check,
                        )
                        .first()
                    )
                if latest_report:
                    try:
                        week_report_data = json.loads(latest_report.report_json)
                    except Exception:
                        pass
                    if week_report_data:
                        break  # Use the most recent valid report found

        # 4e. Is the CURRENT (locked) week finished? Next-week plans are only allowed
        #     once the current week is complete — its end date has passed OR its weekly
        #     report exists — so the model can analyze that week before building the next.
        #     While the week is still ongoing, the model must NOT build the next week;
        #     it should help the user with their CURRENT plan instead. (Even once it is
        #     complete, the next week is built only when the user asks — see 6a-0.)
        current_week_complete = False
        if session_rec.phase == "active" and session_rec.plan_start_date:
            try:
                # `or 1` would treat a valid Week 0 as Week 1 (0 is falsy), making the
                # completeness check look at the WRONG week — so Week 0 never counts as
                # complete and the next week never builds. Use an explicit None-check.
                _cur_wk_for_bounds = session_rec.current_week if session_rec.current_week is not None else 1
                ws_cur, we_cur, _ = _week_bounds_for(session_rec, _cur_wk_for_bounds)
                import datetime as _dt
                try:
                    import zoneinfo
                    _tz = zoneinfo.ZoneInfo(payload.timezone or "UTC")
                    _today_cur = _dt.datetime.now(_tz).date().isoformat()
                except Exception:
                    _today_cur = _dt.date.today().isoformat()
                week_ended = _today_cur >= we_cur
                report_exists = db.query(WeeklyReport).filter(
                    WeeklyReport.user_id == user_id,
                    WeeklyReport.session_id == session_id,
                    WeeklyReport.week_start == ws_cur,
                ).first() is not None
                current_week_complete = week_ended or report_exists
            except Exception as e:
                logger.warning(f"current_week_complete calc failed: {e}")

        # 4f. Accountability context — the user's own "why", plus recovery mode
        # after a missed day. This is what makes the mentor act like a mentor:
        # it remembers the commitment, catches the slip, and fixes the plan.
        if session_rec.commitment_why:
            system_context = (system_context or "") + (
                f"\n\nUSER'S OWN WHY (their commitment, in their words): \"{session_rec.commitment_why}\""
                "\nUse it sparingly — at slips, doubts and weak moments, gently quote their own words back."
                " Never weaponise it, never repeat it every message."
            )
        if session_rec.phase == "active":
            try:
                import datetime as _rdt
                try:
                    import zoneinfo as _rzi
                    _rtoday_iso = _rdt.datetime.now(_rzi.ZoneInfo(payload.timezone or "UTC")).date().isoformat()
                except Exception:
                    _rtoday_iso = _rdt.date.today().isoformat()
                from .streaks import yesterday_missed as _yesterday_missed
                if _yesterday_missed(db, user_id, _rtoday_iso):
                    system_context = (system_context or "") + (
                        "\n\n🔄 RECOVERY MODE — the user MISSED yesterday's check-in."
                        "\nWhen the miss comes up (or they open with guilt), respond as a recovery coach:"
                        "\n1. Zero shame, and say the science plainly: missing ONE day does not break a habit"
                        " (Lally et al., 2010) — but missing twice starts a new one. Today is the only day that matters."
                        "\n2. Ask ONE question: \"What got in the way?\""
                        "\n3. Fix the PLAN, not the person: from their answer, suggest one concrete tweak for TODAY"
                        " within the locked week (a smaller version, a different time), and note the if-then change"
                        " for next week."
                        "\nOne warm, direct message — don't lecture, don't walk the three steps mechanically."
                    )
            except Exception as _rec_err:
                logger.warning(f"Recovery context calc failed (non-fatal): {_rec_err}")

        # 5. Build prompt messages
        prompt_messages = build_chat_prompt(
            messages=history,
            system_context=system_context,
            phase=session_rec.phase or "chat",
            plan_history=plan_history,
            current_week=session_rec.current_week or 0,
            week_reviews=week_reviews,
            week_report_data=week_report_data,
            client_timezone=payload.timezone,
            current_week_complete=current_week_complete,
            plan_start=_chosen_start,
        )

        # 4h. A locked week that hasn't started yet: the mentor must know, so
        # "what do I do tomorrow?" gets "nothing until Monday", not a task.
        if session_rec.phase == "active" and session_rec.plan_starts_on:
            try:
                import datetime as _sdt
                import zoneinfo as _pzi
                try:
                    _today_s = _sdt.datetime.now(_pzi.ZoneInfo(payload.timezone or "UTC")).date()
                except Exception:
                    _today_s = _sdt.date.today()
                _starts = _sdt.date.fromisoformat(session_rec.plan_starts_on)
                if _starts > _today_s:
                    _gap = (_starts - _today_s).days
                    prompt_messages.append({
                        "role": "system",
                        "content": (
                            f"PLAN TIMING: Week {session_rec.current_week} is locked but STARTS ON {_starts.strftime('%A %d %B')} "
                            f"({'tomorrow' if _gap == 1 else f'in {_gap} days'}). Nothing is due before then and no day is missed "
                            f"before then. If asked what to do today or tomorrow, say the week starts on that date and suggest "
                            f"light preparation only (gear, time slot, mindset). Do not build a new plan."
                        ),
                    })
            except Exception as _pt_err:
                logger.warning(f"Plan-timing context failed (non-fatal): {_pt_err}")

        # 5a. Crisis override. If the message indicates suicide or self-harm
        # risk, the mentor persona is suspended for this turn: no plan, no
        # streak pressure, just an honest handoff to real help.
        if in_crisis:
            prompt_messages.insert(0, {"role": "system", "content": CRISIS_SYSTEM_INSTRUCTION})

        # 5b. Anti-repetition guardrail — detect if last assistant messages are very similar
        # and inject a system hint to vary the response
        recent_assistant_msgs = [m["content"] for m in history if m["role"] == "assistant"][-3:]
        if len(recent_assistant_msgs) >= 2:
            def _word_overlap(a: str, b: str) -> float:
                wa = set(a.lower().split())
                wb = set(b.lower().split())
                if not wa or not wb:
                    return 0.0
                return len(wa & wb) / max(len(wa), len(wb))
            
            last_two_overlap = _word_overlap(recent_assistant_msgs[-1], recent_assistant_msgs[-2])
            if last_two_overlap > 0.6:
                prompt_messages.append({
                    "role": "system",
                    "content": (
                        "⚠️ ANTI-REPETITION WARNING: Your last 2 responses were very similar. "
                        "You MUST say something COMPLETELY DIFFERENT this time. "
                        "If the user sent a casual message like 'ok', just give a brief 1-sentence friendly reply. "
                        "Do NOT repeat any previous explanation about plans, locking, or disruptions."
                    )
                })
        
        # 5c. Adjust temperature for casual messages — higher = more variety
        chat_temperature = 0.7
        _casual_check = message.lower().strip().rstrip("!.?,")
        _casual_set = {"ok", "okay", "k", "sure", "yes", "no", "hmm", "haan", "nahi",
                        "theek hai", "acha", "accha", "nice", "cool", "great", "good",
                        "fine", "thanks", "ty", "thankyou", "thank you", "got it",
                        "alright", "right", "yep", "yup", "nope", "hm", "ohh", "oh",
                        "wow", "lol", "haha", "interesting", "understood"}
        _is_casual = _casual_check in _casual_set
        if _is_casual:
            chat_temperature = 0.9  # More creative for casual replies

        # Repetition penalties help small talk stay fresh, but they actively
        # fight a plan: every day is supposed to share a shape ("…~40 min. Done
        # when…"), and penalising repeated tokens pushes the model off that
        # structure and toward vaguer, more varied wording. Keep them for
        # chit-chat, drop them everywhere else.
        _presence = 0.4 if _is_casual else 0.1
        _frequency = 0.35 if _is_casual else 0.05

        # Hand the DB connection back before the model call. The session
        # autobegan a transaction on its first SELECT and would otherwise keep
        # its pooled connection checked out for the 5–20 s the model takes;
        # twenty concurrent chats were enough to drain the pool and turn the
        # rest into 500s. Everything needed below is already loaded, and the
        # session reacquires a connection on its next query.
        db.commit()

        # 5d. Week N+1 is asked for, but not when it should begin. The client
        # asks that first (same picker as the first week) and sends the message
        # again with start_date — so the draft is built for the real window
        # instead of today's and re-stamped at lock time. Nothing is saved here.
        if (
            session_rec.phase == "active"
            and current_week_complete
            and not session_rec.is_completed
            and _chosen_start is None
            and _asks_for_next_week(message, _last_assistant_text(history[:-1]))
        ):
            _cur_wk_ask = session_rec.current_week if session_rec.current_week is not None else 1
            _earliest = max(_next_week_floor(session_rec) or _today_for_start, _today_for_start)
            logger.info(f"[NextWeek] start date needed before building Week {_cur_wk_ask + 1} (earliest {_earliest})")
            return {
                "reply": "",
                "plan": None,
                "questions": None,
                "session_id": session_id,
                "needs_start_date": {"week": _cur_wk_ask + 1, "earliest": _effective_lock_start(_earliest)},
            }

        raw_response = await asyncio.to_thread(
            call_with_fallback_chain,
            prompt_messages,
            temperature=chat_temperature,
            max_tokens=4000,
            presence_penalty=_presence,
            frequency_penalty=_frequency
        )
        
        logger.debug(f"Raw LLM response: {raw_response[:200]}...")
        
        # 6. Parse response
        parsed = _parse_llm_response(raw_response)
        reply_text = parsed["reply"]
        plan_data = _fill_plan_gaps(parsed["plan"])

        # 6a-0. A next week nobody asked for. Once a week is closed the prompt
        # allows building the next one, and the model has taken "I don't get
        # this exercise" as its cue to do so. If the message doesn't ask for a
        # new week, ask the model once more for a plain answer and keep no plan.
        if (
            plan_data
            and session_rec.phase == "active"
            and current_week_complete
            and int(plan_data.get("week_number") or 0) > int(session_rec.current_week or 0)
            and not _asks_for_next_week(message, _last_assistant_text(history))
        ):
            logger.info("Model built the next week unasked — asking again for a plain answer")
            retry_messages = prompt_messages + [{"role": "system", "content": UNASKED_PLAN_CORRECTION}]
            raw_response = await asyncio.to_thread(
                call_with_fallback_chain,
                retry_messages,
                temperature=chat_temperature,
                max_tokens=1200,
                presence_penalty=_presence,
                frequency_penalty=_frequency,
            )
            parsed = _parse_llm_response(raw_response)
            reply_text = parsed["reply"]
            plan_data = None

        # 6a-pre. Capture the user's "why" the first time they voice it. Stored
        # once, never overwritten — this is the quote the recovery flow brings
        # back at weak moments.
        _cw = parsed.get("commitment_why")
        if isinstance(_cw, str) and _cw.strip() and not session_rec.commitment_why:
            session_rec.commitment_why = _cw.strip()[:2000]
            db.commit()
            logger.info(f"[Commitment] why saved for session {session_id}")
        # The card is the plan. Anything the model also wrote into the chat
        # message is a duplicate at best and raw JSON at worst — and it does
        # this with `plan` set to null too, which is how a bare JSON blob ends
        # up in a chat bubble with no card under it.
        reply_text = _clean_reply_text(reply_text, has_plan=bool(plan_data))
        
        # 6a. Casual message guardrail — if user sent a short acknowledgment,
        # discard any plan the model may have hallucinated.
        _CASUAL_WORDS = {
            "ok", "okay", "k", "sure", "yes", "no", "hmm", "haan", "nahi",
            "theek hai", "acha", "accha", "nice", "cool", "great", "good",
            "fine", "thanks", "ty", "thankyou", "thank you", "got it",
            "alright", "right", "yep", "yup", "nope", "hm", "ohh", "oh",
            "wow", "lol", "haha", "interesting", "understood",
        }
        msg_normalized = message.lower().strip().rstrip("!.?,")
        if plan_data and msg_normalized in _CASUAL_WORDS:
            logger.info("Casual acknowledgement triggered a plan — suppressing plan_data")
            plan_data = None
        
        # 6b. Validate plan structure — plan must have 'days' array with items
        if plan_data and isinstance(plan_data, dict):
            plan_days = plan_data.get("days")
            if not isinstance(plan_days, list) or len(plan_days) == 0:
                logger.warning(f"Plan missing valid 'days' array — discarding: {plan_data.keys()}")
                plan_data = None

        # 6c. A week's plan MUST span its whole window (today → Sunday), and its day
        #     labels MUST match the real calendar. The model is unreliable at weekday
        #     math — it will label a Wednesday start as "(MON)", run past Sunday, or
        #     stop days early. So we figure out this plan's true start date and hand it
        #     to _fit_plan_to_window, which trims, pads and re-labels.
        if plan_data and isinstance(plan_data, dict) and isinstance(plan_data.get("days"), list):
            try:
                import datetime as _dt2
                try:
                    import zoneinfo as _zi2
                    _gen_today = _dt2.datetime.now(_zi2.ZoneInfo(payload.timezone or "UTC")).date()
                except Exception:
                    _gen_today = _dt2.date.today()

                # Determine the plan's true start date, assuming the user locks it
                # now. This is only a projection — the week's real start is stamped
                # on approve, because an unlocked plan may sit for weeks. If it
                # does, approve re-fits against the actual lock day.
                _plan_week = plan_data.get("week_number", 0)
                # The user's chosen first-week start wins over the projection.
                _proj_start = _chosen_start or _projected_week_start(session_rec, _plan_week, _gen_today.isoformat())

                # Record when this plan was built so the client can warn before a
                # long-stale plan gets locked into a brand new week. Only the build
                # date is stamped — the projected window is recomputed client-side at
                # lock time, since a plan can sit unlocked for weeks and any window
                # stored here would be stale by then.
                plan_data["generated_date"] = _gen_today.isoformat()
                if _chosen_start:
                    # The draft carries the chosen start so the lock card can preselect it.
                    plan_data["start_date"] = _chosen_start

                _fit_plan_to_window(plan_data, _proj_start)
            except Exception as e:
                logger.warning(f"Plan day normalization failed (non-fatal): {e}")

        # 7. Save messages to DB
        user_msg = ChatMessage(session_id=session_id, role="user", content=message)
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=reply_text)
        db.add(user_msg)
        db.add(assistant_msg)
        
        # 8. If plan was generated, update session — with lock guards
        # A completed / stopped session must never accept or revive a plan — it is chat-only now.
        if plan_data and (session_rec.is_completed or session_rec.phase == "completed"):
            logger.info("Completed session — discarding generated plan (chat-only mode).")
            plan_data = None
        if plan_data and isinstance(plan_data, dict):
            new_week_num = plan_data.get("week_number", 1)
            cur_wk = session_rec.current_week or 0

            # GUARD 1 — modifying a locked week: only accept plans for a NEWER week.
            if session_rec.phase == "active" and new_week_num <= cur_wk:
                logger.warning(
                    f"Model attempted to modify locked Week {cur_wk} — discarding plan."
                )
                plan_data = None  # Discard — never let the model silently overwrite a locked week

            # GUARD 2 — building the NEXT week before the current week is finished.
            # The next week can only be built once the current week is complete (its end
            # date passed / its report exists), so it can be based on that week's report.
            elif session_rec.phase == "active" and new_week_num > cur_wk and not current_week_complete:
                logger.warning(
                    f"Model attempted to build Week {new_week_num} before Week {cur_wk} finished "
                    f"(current_week_complete=False) — discarding plan."
                )
                plan_data = None
                reply_text = (
                    f"Week {cur_wk} is still in progress 💪 — let's finish this one first. "
                    f"I'll build the next week only once this week wraps up and its report is ready, "
                    f"so I can study your full week and make the next plan actually fit you. "
                    f"In the meantime, tell me exactly where you're getting stuck and I'll give you "
                    f"specific fixes and tips within this week's plan (without changing the locked plan)."
                )
                assistant_msg.content = reply_text  # keep the saved message consistent

            else:
                session_rec.week_plan_json = json.dumps(plan_data)
                session_rec.current_week = new_week_num
                session_rec.phase = "planning"  # Back to pending approval for new week
                if _next_week_start:
                    session_rec.plan_starts_on = _next_week_start

            # Store the focus from the first message if not set
            if not session_rec.focus and len(db_messages) == 0:
                session_rec.focus = message[:200]
        
        # Update focus for new sessions
        if not session_rec.focus:
            session_rec.focus = message[:200]
        
        db.commit()

        # 8b. First exchange → generate a short sidebar title in the background (Groq, cheap).
        # db_messages was fetched before this message, so len == 0 means this is message #1.
        if len(db_messages) == 0 and not session_rec.title:
            background_tasks.add_task(
                _generate_and_save_title, session_id, message, reply_text
            )

        # 9. Save to Qdrant (non-blocking)
        try:
            if embedding:
                memory_text = f"User: '{message}'. Mentor: '{reply_text[:500]}'"
                await asyncio.to_thread(
                    vector_store.add_memory,
                    user_id,
                    memory_text,
                    embedding,
                    {"source": "chat", "session_id": session_id}
                )
        except Exception as e:
            logger.warning(f"Failed to save chat memory (non-fatal): {e}")
        
        # DETERMINISTIC FIRST-TURN GATE — the model is not allowed to build a plan on the
        # very first message. If it ignored the instruction and one-shot a plan (fabricating
        # times/level), discard it, undo any session mutation, and force the setup form.
        if _needs_setup and plan_data:
            logger.info("Plan blocked before setup completed — forcing setup questions.")
            plan_data = None
            session_rec.week_plan_json = None
            session_rec.phase = "chat"
            session_rec.current_week = 0
            reply_text = "Love it — 30 seconds of setup and I'll build a plan that actually fits YOU (not a generic one)."
            assistant_msg.content = reply_text
            if not isinstance(parsed.get("questions"), list) or not parsed.get("questions"):
                parsed["questions"] = [
                    {"id": "goal", "label": "What exactly do you want to achieve?", "placeholder": "be as specific as you can"},
                    {"id": "time", "label": "How much time can you give, and when?", "placeholder": "e.g. 30 min, weekday mornings"},
                    {"id": "level", "label": "Where are you now, and what usually gets in the way?", "placeholder": "e.g. total beginner — I lose steam by Wednesday"},
                    {"id": "why", "label": "Why does this actually matter to you? The real reason.", "placeholder": "your own words — this stays between us"},
                ]

        # Setup-questions form (rendered by the client as a popup). Only a
        # NEW-goal discovery turn may carry one, never alongside a plan, and a
        # malformed structure is dropped rather than trusted.
        questions_data = parsed.get("questions")
        _session_finished = bool(session_rec.is_completed or session_rec.phase == "completed")
        if plan_data or _session_finished or not isinstance(questions_data, list):
            questions_data = None
        else:
            questions_data = [
                {
                    "id": str(q.get("id") or f"q{i}"),
                    "label": str(q.get("label"))[:200],
                    "placeholder": str(q.get("placeholder") or "")[:200],
                }
                for i, q in enumerate(questions_data)
                if isinstance(q, dict) and q.get("label")
            ][:4] or None

        response: Dict[str, Any] = {
            "reply": reply_text,
            "plan": plan_data,
            "questions": questions_data,
            "session_id": session_id
        }
        if in_crisis:
            # Suppress any plan the model produced anyway, and hand the client a
            # structured block to render as a resource card rather than leaving
            # help buried in a paragraph.
            response["plan"] = None
            response["questions"] = None
            response["safety"] = crisis_payload()
        return response

    except HTTPException:
        # A deliberate refusal (e.g. a start date too far ahead) must reach the
        # client as the 4xx it is, not as the generic "hit a snag" reply.
        raise
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Chat failed: {str(e)}")
        logger.error(tb)
        fallback = {
            "reply": "Sorry, I hit a snag on my end. Please try again in a moment.",
            "plan": None,
            "session_id": session_id
        }
        # A backend failure must not swallow a crisis signal.
        if in_crisis:
            fallback["reply"] = crisis_payload()["body"]
            fallback["safety"] = crisis_payload()
        return fallback


# How far ahead a week may be scheduled to start. Long enough to say "from
# next Monday" on any weekday with a buffer; short enough that the plan is
# still about the person who approved it.
MAX_START_LEAD_DAYS = 14


def _next_week_floor(session_rec) -> Optional[str]:
    """The first day the week after the current locked one may begin: the day
    after that week's Sunday. None when there is no locked week."""
    from datetime import date as _d, timedelta as _td

    if not session_rec.plan_start_date:
        return None
    try:
        cur = session_rec.current_week if session_rec.current_week is not None else 1
        _, we, _ = _week_bounds_for(session_rec, cur)
        return (_d.fromisoformat(we) + _td(days=1)).isoformat()
    except Exception as e:
        logger.warning(f"Next-week floor lookup failed: {e}")
        return None


def _resolve_next_week_start(session_rec, today_iso: str, requested: Optional[str]) -> str:
    """Where Week N+1 begins, asked BEFORE its draft is built (an active
    session): the user's day, never before the current week ends, never in the
    past, at most MAX_START_LEAD_DAYS ahead, weekends rolled to Monday."""
    from datetime import date as _d

    floor = _next_week_floor(session_rec) or today_iso
    earliest = max(floor, today_iso)
    if not requested:
        return _effective_lock_start(earliest)
    try:
        chosen = _d.fromisoformat(requested)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date must be a date like 2026-10-06.")
    today = _d.fromisoformat(today_iso)
    if chosen < today:
        raise HTTPException(status_code=400, detail="The start date can't be in the past.")
    if chosen.isoformat() < floor:
        cur = session_rec.current_week if session_rec.current_week is not None else 1
        raise HTTPException(status_code=400, detail=f"Week {cur} runs until {(_d.fromisoformat(floor) - _td_one()).isoformat()}; start on or after {floor}.")
    if (chosen - today).days > MAX_START_LEAD_DAYS:
        raise HTTPException(status_code=400, detail=f"Pick a start within the next {MAX_START_LEAD_DAYS} days.")
    return _effective_lock_start(chosen.isoformat())


def _td_one():
    from datetime import timedelta as _td
    return _td(days=1)


def _resolve_start_date(session_rec, today_iso: str, requested: Optional[str]) -> str:
    """The date the week being approved will begin.

    Without a request the week starts the day it is locked (the behaviour the
    product always had, including the Sat/Sun roll-forward). With one, the
    user has said when they are ready — tomorrow, next Monday, a chosen date —
    and that wins, within limits: not in the past, not more than
    MAX_START_LEAD_DAYS ahead, and never inside a week that is still running.
    """
    from datetime import date as _d, timedelta as _td

    _cur_wk = session_rec.current_week if session_rec.current_week is not None else 1
    default_start = _projected_week_start(session_rec, _cur_wk, today_iso)
    if not requested:
        return default_start
    try:
        chosen = _d.fromisoformat(requested)
    except ValueError:
        raise HTTPException(status_code=400, detail="start_date must be a date like 2026-10-06.")
    today = _d.fromisoformat(today_iso)
    if chosen < today:
        raise HTTPException(status_code=400, detail="The start date can't be in the past.")
    if (chosen - today).days > MAX_START_LEAD_DAYS:
        raise HTTPException(status_code=400, detail=f"Pick a start within the next {MAX_START_LEAD_DAYS} days.")
    # A week runs to its Sunday, so a Saturday or Sunday start would be a 1–2
    # day stub. The same rule that rolls a weekend LOCK to Monday applies to a
    # chosen weekend start (the client shows the roll before they commit).
    chosen = _d.fromisoformat(_effective_lock_start(chosen.isoformat()))
    # A later week can never begin before the running one has ended.
    if session_rec.plan_start_date and _cur_wk and _cur_wk > 1:
        try:
            _, prev_end, _ = _week_bounds_for(session_rec, _cur_wk - 1)
            floor = _d.fromisoformat(prev_end) + _td(days=1)
            if chosen < floor:
                raise HTTPException(status_code=400, detail=f"Week {_cur_wk - 1} runs until {prev_end}; start on or after {floor.isoformat()}.")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Previous-week floor lookup failed: {e}")
    return chosen.isoformat()


@app.post("/chat/{session_id}/approve_plan", tags=["chat"])
async def approve_plan(
    session_id: str,
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    start_date: Optional[str] = None,   # YYYY-MM-DD: when the user wants the week to begin
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve the current week plan — marks it active and enables calendar sync.

    The week starts on `start_date` when given (tomorrow, next Monday, a date
    the user picked — see _resolve_start_date), else the day it is locked. The
    plan's days are re-fitted to that window, and until the start arrives the
    daily emails become a short countdown instead of tasks."""
    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")

    if session_rec.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    if not session_rec.week_plan_json:
        raise HTTPException(status_code=400, detail="No plan to approve")
    
    # Save current plan to history BEFORE approving
    plan_history: list = []
    if session_rec.result_json:
        try:
            existing = json.loads(session_rec.result_json)
            if isinstance(existing, list):
                plan_history = existing
        except Exception:
            plan_history = []
    
    from datetime import date as _date, timedelta as _timedelta
    # Lock date in the user's local timezone (falls back to server date)
    if client_date:
        try:
            today_iso = _date.fromisoformat(client_date).isoformat()
        except ValueError:
            today_iso = _date.today().isoformat()
    else:
        today_iso = _date.today().isoformat()

    # By default a week starts the day it is locked — not the day after the
    # previous week ended. A plan generated weeks ago and locked today must run
    # from today, otherwise its whole window sits in the past and every day is
    # marked missed the moment it is locked. The user may instead name the day
    # they will actually be ready (people routinely want a couple of days to get
    # set, or a clean Monday); that date wins within _resolve_start_date's limits.
    # A first week whose start was chosen with the setup answers keeps that day
    # unless the lock names another.
    if not start_date and session_rec.phase != "active" and session_rec.plan_starts_on and session_rec.plan_starts_on >= today_iso:
        start_date = session_rec.plan_starts_on
    start_iso = _resolve_start_date(session_rec, today_iso, start_date)
    starts_later = start_iso > today_iso

    try:
        approved_plan = json.loads(session_rec.week_plan_json)
        # Stamp the computed start so the locked week spans the right calendar dates
        approved_plan["start_date"] = start_iso

        # Authoritative re-fit: the lock date is the definitive start, so the plan
        # is trimmed/padded to the real window and every day re-stamped with the
        # correct consecutive calendar date (a plan locked on Wednesday must read
        # Wed→Sun, not the model's mislabeled Mon→Fri; a short plan locked on
        # Monday must still cover through Sunday). This guarantees the locked week
        # is complete and correctly dated even if it was generated on another day.
        try:
            _fit_plan_to_window(approved_plan, start_iso)
        except Exception as _re:
            logger.warning(f"Plan day re-fit on approve failed (non-fatal): {_re}")
        # Save to history (replace if this week already exists, else append)
        existing_idx = next(
            (i for i, p in enumerate(plan_history)
             if isinstance(p, dict) and p.get("week_number") == approved_plan.get("week_number")),
            None,
        )
        if existing_idx is not None:
            plan_history[existing_idx] = approved_plan
        else:
            plan_history.append(approved_plan)
        session_rec.result_json = json.dumps(plan_history)
        # Persist the stamped start_date onto the active plan too
        session_rec.week_plan_json = json.dumps(approved_plan)
    except Exception as e:
        logger.warning(f"Could not save plan to history: {e}")

    session_rec.phase = "active"
    # Store where the FIRST week actually starts (don't overwrite for later weeks —
    # each week's own start now lives in the plan's stamped start_date). This is
    # start_iso, not the lock date: a plan locked on Saturday starts the following
    # Monday, and the legacy fallback must agree with the stamp.
    if not session_rec.plan_start_date:
        session_rec.plan_start_date = start_iso
    # The day this locked week begins. Read by the daily email job (countdown
    # until then, tasks from then on) and by the workspace ("starts in N days").
    session_rec.plan_starts_on = start_iso
    db.commit()

    # The build-up emails are written once, now, so each countdown day costs no
    # model call later and the three notes read as one arc.
    if starts_later:
        try:
            from .email_service import build_countdown_notes
            notes = await asyncio.to_thread(build_countdown_notes, approved_plan, session_rec.focus or "", start_iso, today_iso)
            session_rec.countdown_json = json.dumps(notes)
            db.commit()
        except Exception as e:
            logger.warning(f"Countdown notes not generated (non-fatal): {e}")

    # Add a system message to the chat. First-ever approval gets the endowed-
    # progress framing: the user has already banked something (setup + a real
    # plan + a commitment), so they never start from zero.
    _is_first_approval = len(plan_history) <= 1
    from datetime import date as _sd
    _start_label = _sd.fromisoformat(start_iso).strftime("%A %-d %B")
    if starts_later:
        _days_away = (_sd.fromisoformat(start_iso) - _sd.fromisoformat(today_iso)).days
        _approve_msg = (
            f"Week {session_rec.current_week} is set and starts {_start_label} — "
            f"{'tomorrow' if _days_away == 1 else f'{_days_away} days from now'}. "
            f"Good call giving yourself a runway. Until then nothing is due: I'll send a short note each day "
            f"to get you ready, and on {_start_label} your first task lands. I'm here in chat whenever you need me."
        )
    elif _is_first_approval:
        _approve_msg = (
            f"Week {session_rec.current_week} is set — and here's the thing: you're not starting from zero. "
            f"Goal defined ✓, plan built ✓, commitment made ✓ — that's the setup week done, and it's already banked. "
            f"From here it's one day at a time: do today's task, log it on the Journey page, and I'm here whenever you need me."
        )
    else:
        _approve_msg = (
            f"Week {session_rec.current_week} is set — commitment made, and that's the hard part done. "
            f"From here it's one day at a time: do today's task, log it on the Journey page, and I'm here in chat whenever you need me."
        )
    system_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=_approve_msg
    )
    db.add(system_msg)
    db.commit()
    
    return {
        "status": "approved",
        "week": session_rec.current_week,
        "plan_start_date": session_rec.plan_start_date,
        "starts_on": start_iso,
        "starts_later": starts_later,
        "message": f"Week {session_rec.current_week} plan is now active!"
    }


# ============================================================
# PERSISTENCE ENDPOINTS
# ============================================================

def _assert_session_owner(db: DBSession, session_id: str, current_user: User) -> Session:
    """Load a session and confirm it belongs to the caller.

    Authentication alone is not authorization: without this check any logged-in
    user could read or mutate another user's chat history, plans and tasks —
    which here includes emotional/wellbeing content (GDPR Art 32 confidentiality).
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    return session


@app.get("/sessions/{session_id}/history", tags=["persistence"])
def get_session_history(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all chat messages for a specific session."""
    _assert_session_owner(db, session_id, current_user)
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]


@app.get("/sessions/{session_id}/tasks", tags=["persistence"])
def get_session_tasks(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all roadmap tasks for a specific session."""
    _assert_session_owner(db, session_id, current_user)
    tasks = db.query(RoadmapTask).filter(
        RoadmapTask.session_id == session_id
    ).order_by(RoadmapTask.month.asc(), RoadmapTask.week.asc()).all()
    return tasks


@app.patch("/tasks/{task_id}", tags=["persistence"])
def update_task_status(task_id: int, payload: TaskUpdate, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update the completion status of a roadmap task."""
    task = db.query(RoadmapTask).filter(RoadmapTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    # task_id is a sequential integer, so without this check the endpoint is
    # trivially enumerable across every user's tasks.
    _assert_session_owner(db, task.session_id, current_user)
    task.is_completed = 1 if payload.is_completed else 0
    db.commit()
    return task


# ============================================================
# SESSIONS
# ============================================================

@app.get("/sessions/{user_id}", tags=["sessions"])
async def list_sessions(user_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You can only access your own sessions")
    sessions = db.query(
        Session.id,
        Session.created_at,
        Session.title,
        Session.focus,
        Session.current_week,
        Session.phase,
    ).filter(Session.user_id == user_id).order_by(Session.created_at.desc()).all()

    return [
        {
            "id": s.id,
            "created_at": s.created_at,
            "title": s.title,
            "focus_preview": s.focus[:60] + "..." if s.focus and len(s.focus) > 60 else (s.focus or "New Chat"),
            "current_week": s.current_week,
            "phase": s.phase,
        }
        for s in sessions
    ]


@app.get("/sessions/detail/{session_id}", tags=["sessions"])
async def get_session_detail(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    # Get messages
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    
    # Parse plan if exists
    plan = None
    if session.week_plan_json:
        try:
            plan = json.loads(session.week_plan_json)
        except:
            pass

    # Parse plan history (all approved weeks)
    plan_history = []
    if session.result_json:
        try:
            parsed = json.loads(session.result_json)
            if isinstance(parsed, list):
                plan_history = parsed
        except:
            pass
    
    return {
        "id": session.id,
        "created_at": session.created_at,
        "focus": session.focus,
        "current_week": session.current_week,
        "phase": session.phase,
        "plan": plan,
        "plan_history": plan_history,
        # The day the locked week begins; in the future when the user chose a
        # later start. The workspace shows a countdown until then.
        "plan_starts_on": getattr(session, "plan_starts_on", None),
        # The user's own "why" — the recovery screen quotes it back to them,
        # exactly as the recovery email already does.
        "commitment_why": getattr(session, "commitment_why", None),
        "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]
    }


# ============================================================
# VOICE TRANSCRIPTION (Whisper)
# ============================================================

@app.post("/transcribe", tags=["chat"])
async def transcribe_audio(
    audio: UploadFile = File(...),
    current_user: User = Depends(get_consented_user)
):
    """Transcribe voice input via Groq Whisper Large v3 Turbo (fast, <1s)."""
    from .llm import call_groq_transcribe

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    filename = audio.filename or "recording.webm"

    try:
        text = await asyncio.to_thread(call_groq_transcribe, audio_bytes, filename)
        logger.info(f"[Transcribe] {len(audio_bytes)} bytes → {len(text)} chars")
        return {"text": text}
    except Exception as e:
        logger.error(f"[Transcribe] failed: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed. Please try again.")



@app.post("/signup", tags=["auth"])
async def signup(req: SignupRequest, request: Request, db: DBSession = Depends(get_db)):
    """Create an account, recording the consents that make processing lawful."""
    _enforce_rate_limit("signup", request)

    decisions = req.consents or {}

    # No account is created without a lawful basis for the data it will hold.
    # Checking before the INSERT means a refused consent leaves nothing behind.
    not_granted = [key for key in REQUIRED_CONSENTS if not decisions.get(key)]
    if not_granted:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "consent_required",
                "message": "Please accept the required items to create your account.",
                "missing": not_granted,
            },
        )

    # A one-character password was accepted until now. Argon2 protects the
    # stored hash, not a guessable secret; eight characters is the floor both
    # NIST and the ICO cite.
    if len(req.password or "") < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    user = db.query(User).filter(User.email == req.email).first()
    if user:
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = User(
        id=str(uuid.uuid4()),
        email=req.email,
        password=get_password_hash(req.password),
        name=req.name
    )
    db.add(new_user)
    db.flush()  # assign the row before the consent rows reference it

    record_consents(
        db,
        new_user.id,
        decisions,
        ip_address=client_ip(request),
        user_agent=request.headers.get("user-agent"),
        commit=False,
    )
    db.commit()

    access_token = create_access_token(data={"sub": new_user.id})
    return {
        "message": "User created",
        "user_id": new_user.id,
        "name": new_user.name,
        "access_token": access_token,
        "token_type": "bearer",
        "consent_required": [],
    }

@app.post("/login", tags=["auth"])
async def login(req: LoginRequest, request: Request, db: DBSession = Depends(get_db)):
    """Secure login with JWT generation."""
    _enforce_rate_limit("login", request, req.email)

    user = db.query(User).filter(User.email == req.email).first()

    # Same status and message for "no such account" and "wrong password".
    # Distinguishing them would let anyone test whether a given email address
    # has a Feelivate account — on a wellbeing product that is itself a
    # disclosure of personal data.
    if not user or not verify_password(req.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    _clear_rate_limit("login", request, req.email)
    access_token = create_access_token(data={"sub": user.id})
    return {
        "message": "Login successful",
        "user_id": user.id,
        "name": user.name,
        "access_token": access_token,
        "token_type": "bearer",
        # Accounts created before consent was collected, or under an older
        # policy version, land here with a non-empty list. The client shows the
        # consent screen; the backend independently refuses the sensitive
        # endpoints until it is cleared.
        "consent_required": missing_consents(db, user.id),
    }


@app.get("/me", tags=["auth"])
async def get_me(db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile — name, email, and join date."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "consent_required": missing_consents(db, current_user.id),
    }


# ============================================================
# ACCOUNT & DATA RIGHTS  (GDPR Art 7, 15, 17, 20)
# ============================================================

@app.get("/legal/consents", tags=["account"])
async def get_consent_catalogue():
    """Public: the consent items and current policy version.

    Unauthenticated because the signup form needs it before an account exists.
    Serving it from here rather than hardcoding the list in the frontend means
    adding or rewording a consent can never leave the two out of step.
    """
    from .privacy import consent_catalogue

    return {"policy_version": CONSENT_POLICY_VERSION, "catalogue": consent_catalogue()}


@app.get("/account/consents", tags=["account"])
async def get_consents(db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Current consent state plus the catalogue the consent screen renders."""
    from .privacy import consent_catalogue, current_consents

    return {
        "policy_version": CONSENT_POLICY_VERSION,
        "catalogue": consent_catalogue(),
        "state": current_consents(db, current_user.id),
        "missing": missing_consents(db, current_user.id),
    }


@app.post("/account/consents", tags=["account"])
async def submit_consents(
    req: ConsentRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record consent decisions — used by signup and the post-login screen."""
    not_granted = [key for key in REQUIRED_CONSENTS if not req.consents.get(key)]
    if not_granted:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "consent_required",
                "message": "All required items must be accepted to continue using Feelivate.",
                "missing": not_granted,
            },
        )

    record_consents(
        db,
        current_user.id,
        req.consents,
        ip_address=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    return {"status": "ok", "policy_version": CONSENT_POLICY_VERSION, "missing": []}


@app.post("/account/consents/withdraw", tags=["account"])
async def withdraw_consent_endpoint(
    req: ConsentWithdrawRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Withdraw a consent (Art 7(3) — must be as easy as giving it).

    Withdrawing a *required* consent does not delete anything by itself; it
    stops further processing. The response says plainly what that means so the
    user can choose deletion if that is what they actually want.
    """
    from .privacy import withdraw_consent

    if not withdraw_consent(
        db,
        current_user.id,
        req.consent_type,
        ip_address=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ):
        raise HTTPException(status_code=400, detail="Unknown consent type")

    outstanding = missing_consents(db, current_user.id)
    return {
        "status": "withdrawn",
        "consent_type": req.consent_type,
        "missing": outstanding,
        "blocks_service": bool(outstanding),
        "message": (
            "Consent withdrawn. Feelivate can no longer process your wellbeing content, so "
            "those features are paused until you accept again. Your existing data is still "
            "stored — use Delete account if you want it erased."
            if outstanding
            else "Consent withdrawn."
        ),
    }


@app.get("/account/export", tags=["account"])
async def export_account(
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download everything we hold about you, as JSON (Art 15 and Art 20).

    Served as an attachment so the browser saves a file the user can keep or
    hand to another service, which is the point of portability.
    """
    _enforce_rate_limit("account_export", request, current_user.id)

    payload = build_user_export(db, current_user)
    filename = f"feelivate-export-{current_user.id[:8]}.json"
    logger.info("[Export] account export generated")
    return Response(
        content=json.dumps(payload, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            # Never let a proxy or the browser keep a copy of this file.
            "Cache-Control": "no-store",
        },
    )


@app.delete("/account", tags=["account"])
async def delete_account(
    req: AccountDeleteRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Permanently erase the account and all associated data (Art 17).

    Irreversible and immediate — there is no soft-delete and no grace period.
    Two safeguards guard the action: the literal confirmation word, and the
    account password where the account has one (so a stolen session token on
    its own cannot destroy someone's history).
    """
    _enforce_rate_limit("account_delete", request, current_user.id)

    if (req.confirmation or "").strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail='Type DELETE to confirm account deletion.')

    # Google-only accounts hold an unguessable random password they never set,
    # so a password prompt would be impossible to satisfy. Those accounts rely
    # on the confirmation word plus a valid session.
    if req.password:
        if not verify_password(req.password, current_user.password):
            raise HTTPException(status_code=401, detail="Incorrect password.")

    # Best-effort: hand the Google refresh token back before the row is gone,
    # otherwise it stays live at Google with nothing left here to revoke it.
    if current_user.google_refresh_token:
        try:
            calendar_service.revoke_token(decrypt_secret(current_user.google_refresh_token))
        except Exception as e:
            logger.warning(f"[Erasure] Google token revocation failed (non-fatal): {type(e).__name__}")

    result = delete_user_data(db, current_user)

    return {
        "status": "deleted",
        "message": "Your account and all associated data have been permanently deleted.",
        "deleted": result["deleted"],
        # Named honestly rather than swallowed: if an external store could not
        # be reached, the user is told so they can hold us to finishing it.
        "incomplete": result["warnings"],
    }


# ============================================================
# GOOGLE LOGIN ("Continue with Google")
# ============================================================

@app.get("/auth/google/login", tags=["auth"])
async def google_login_init():
    """Return the Google Sign-In URL (openid/email/profile scopes)."""
    try:
        return {"auth_url": google_login_service.get_login_url()}
    except Exception as e:
        logger.error(f"Google login init failed: {e}")
        raise HTTPException(status_code=500, detail="Could not start Google sign-in.")


class GoogleLoginCallbackRequest(BaseModel):
    code: str


@app.post("/auth/google/login/callback", tags=["auth"])
async def google_login_callback(req: GoogleLoginCallbackRequest, db: DBSession = Depends(get_db)):
    """Exchange the Google code, find-or-create the user, and return a JWT."""
    try:
        info = google_login_service.exchange_code_for_userinfo(req.code)
    except Exception as e:
        # Full diagnostics go to the SERVER logs only (Northflank runtime logs) —
        # the user just sees a clean message, never the debug internals.
        desc = getattr(e, "description", "") or ""
        err_code = getattr(e, "error", "") or ""
        logger.exception(
            "Google login callback failed | redirect_uri=%s | client_id_set=%s | client_secret_set=%s | %s: %s | error=%s desc=%s",
            google_login_service.redirect_uri,
            bool(google_login_service.client_id),
            bool(google_login_service.client_secret),
            type(e).__name__, e, err_code, desc,
        )
        raise HTTPException(status_code=400, detail="Google sign-in failed. Please try again.")

    email = (info.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email address.")

    user = db.query(User).filter(User.email == email).first()
    is_new = False
    if not user:
        # New Google user — create with an unusable random password. They sign
        # in via Google; the password field just satisfies the NOT NULL column.
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password=get_password_hash(secrets.token_urlsafe(32)),
            name=info.get("name") or email.split("@")[0],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new = True
    elif not user.name and info.get("name"):
        # Existing account (e.g. signed up by email) that had no name — backfill it.
        user.name = info.get("name")
        db.commit()

    access_token = create_access_token(data={"sub": user.id})
    return {
        "message": "Login successful",
        "user_id": user.id,
        "name": user.name,
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new,
        # Google sign-in cannot carry consent, so both new and returning Google
        # users clear it on the consent screen straight after landing.
        "consent_required": missing_consents(db, user.id),
    }


class GoogleMobileRequest(BaseModel):
    id_token: str


@app.post("/auth/google/mobile", tags=["auth"])
async def google_login_mobile(req: GoogleMobileRequest, db: DBSession = Depends(get_db)):
    """
    "Continue with Google" from the Android app.

    Credential Manager hands the app an ID token rather than an OAuth code, so
    there is nothing to exchange — the token is verified against Google's keys
    here and then takes exactly the same find-or-create path as the web
    callback above.
    """
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    if not client_id:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured.")

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        info = google_id_token.verify_oauth2_token(
            req.id_token, google_requests.Request(), client_id
        )
    except Exception as e:
        logger.warning(f"Google mobile sign-in rejected a token: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")

    if info.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")
    # An unverified address could belong to someone else entirely.
    if info.get("email_verified") is False:
        raise HTTPException(status_code=401, detail="That Google address isn't verified yet.")

    email = (info.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email address.")

    user = db.query(User).filter(User.email == email).first()
    is_new = False
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            password=get_password_hash(secrets.token_urlsafe(32)),
            name=info.get("name") or email.split("@")[0],
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        is_new = True
    elif not user.name and info.get("name"):
        user.name = info.get("name")
        db.commit()

    access_token = create_access_token(data={"sub": user.id})
    return {
        "message": "Login successful",
        "user_id": user.id,
        "name": user.name,
        "access_token": access_token,
        "token_type": "bearer",
        "is_new_user": is_new,
        "consent_required": missing_consents(db, user.id),
    }


# ============================================================
# GOOGLE CALENDAR
# ============================================================

@app.get("/auth/google", tags=["calendar"])
async def google_auth_init():
    """Initializes Google OAuth flow and returns the auth URL."""
    auth_url = calendar_service.get_auth_url()
    return {"auth_url": auth_url}

@app.get("/auth/google/callback", tags=["calendar"])
async def google_auth_callback(code: str, user_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Handles the callback from Google, exchanges code for refresh token."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        tokens = calendar_service.exchange_code(code)
        refresh_token = tokens.get("refresh_token")
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
            
        if refresh_token:
            # Encrypted at rest: a database dump must not yield live calendar access.
            user.google_refresh_token = encrypt_secret(refresh_token)
        
        user.calendar_sync_enabled = 1
        db.commit()
        
        return {"status": "success", "message": "Google Calendar connected!"}
    except Exception as e:
        logger.error(f"OAuth Callback failed: {e}")
        raise HTTPException(status_code=500, detail="Google Calendar connection failed. Please try again.")

@app.post("/calendar/sync/{session_id}", tags=["calendar"])
async def sync_calendar(session_id: str, user_id: str, background_tasks: BackgroundTasks, preferred_time: str = "08:00", db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Triggers a background task to sync the week plan to Google Calendar."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    session = db.query(Session).filter(Session.id == session_id).first()
    
    if not user or not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Google Calendar not connected.")
        
    if not session or not session.week_plan_json:
        raise HTTPException(status_code=404, detail="No active plan to sync.")

    try:
        plan_data = json.loads(session.week_plan_json)
        # Wrap in the format calendar_service expects
        roadmap_data = {
            "integration": {
                "roadmap": [{
                    "phase": f"Week {session.current_week}",
                    "weeks": [{
                        "week": plan_data.get("week_label", "This week"),
                        "days": plan_data.get("days", [])
                    }]
                }]
            }
        }
        user_context = {"focus": session.focus or ""}
        
        background_tasks.add_task(
            calendar_service.sync_roadmap_to_calendar,
            decrypt_secret(user.google_refresh_token),
            roadmap_data,
            user_context,
            preferred_time
        )
        
        return {"message": f"Calendar sync started for Week {session.current_week}."}
    except Exception as e:
        logger.error(f"Sync trigger failed: {e}")
        raise HTTPException(status_code=500, detail="Calendar sync failed. Please try again.")

@app.post("/calendar/stop", tags=["calendar"])
async def stop_calendar_sync(user_id: str, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Disables calendar sync and removes future events."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Google Calendar not connected.")

    user.calendar_sync_enabled = 0
    db.commit()

    background_tasks.add_task(calendar_service.clear_roadmap_events, decrypt_secret(user.google_refresh_token))
    
    return {"message": "Notifications disabled and future events being removed."}


# ============================================================
# EMAIL NOTIFICATIONS
# ============================================================

class SendEmailOTPRequest(BaseModel):
    user_id: str
    email: str

class VerifyEmailOTPRequest(BaseModel):
    user_id: str
    email: str
    code: str
    session_id: Optional[str] = None
    preferred_time: str = "08:00"          # HH:MM in user's local timezone
    preferred_timezone: str = "UTC"  # IANA timezone string (overridden by the browser's tz)

class StopEmailNotificationRequest(BaseModel):
    user_id: str

class UpdateNotificationTimeRequest(BaseModel):
    user_id: str
    preferred_time: str                       # HH:MM in user's local timezone
    preferred_timezone: str = "UTC"  # IANA timezone string (overridden by the browser's tz)


@app.post("/notifications/email/send-otp", tags=["notifications"])
async def send_email_otp(
    payload: SendEmailOTPRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a 6-digit OTP to the user's email and store it in the DB."""
    from datetime import datetime, timedelta

    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Each call sends a real email to an address the caller supplies — without a
    # cap this is a mail-bombing primitive pointed at third parties.
    _enforce_rate_limit("otp_send", request, current_user.id)

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    otp = generate_otp()
    expiry = datetime.utcnow() + timedelta(minutes=10)

    user.email_otp_code = otp
    user.email_otp_expiry = expiry
    db.commit()

    success = send_verification_email(
        to_email=payload.email,
        otp=otp,
        user_name=user.name or "there",
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send email. Please try again.")

    return {"message": "Verification code sent! Please check your inbox.", "expires_in": 600}


@app.post("/notifications/email/verify-otp", tags=["notifications"])
async def verify_email_otp(
    payload: VerifyEmailOTPRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify the OTP; on success, enable email notifications."""
    from datetime import datetime

    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # A 6-digit code is only 10^6 wide; unlimited guesses defeat the point of
    # verifying the address at all.
    _enforce_rate_limit("otp_verify", request, current_user.id)

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.email_otp_code or not user.email_otp_expiry:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new code.")

    # Check expiry
    if datetime.utcnow() > user.email_otp_expiry:
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")

    # Check code
    if user.email_otp_code.strip() != payload.code.strip():
        raise HTTPException(status_code=400, detail="Incorrect OTP. Please check your email and try again.")

    # Enable notifications with preferred time + timezone
    user.notification_email = payload.email
    user.email_notifications_enabled = 1
    user.email_otp_code = None
    user.email_otp_expiry = None
    import re as _re
    pt = payload.preferred_time.strip()
    user.preferred_notification_time = pt if _re.match(r'^([01]\d|2[0-3]):[0-5]\d$', pt) else "08:00"
    # Validate IANA timezone string
    import pytz as _pytz
    tz = payload.preferred_timezone.strip()
    try:
        _pytz.timezone(tz)
        user.preferred_notification_timezone = tz
    except Exception:
        user.preferred_notification_timezone = "UTC"
    db.commit()

    return {
        "message": "Email verified! Daily notifications are now active.",
        "notification_email": payload.email,
        "preferred_time": user.preferred_notification_time,
        "preferred_timezone": user.preferred_notification_timezone,
    }


@app.post("/notifications/email/stop", tags=["notifications"])
async def stop_email_notifications(
    payload: StopEmailNotificationRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Disable the user's email notifications."""
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.email_notifications_enabled = 0
    user.notification_email = None
    db.commit()

    return {"message": "Email notifications have been stopped."}


@app.get("/notifications/email/status", tags=["notifications"])
async def get_email_notification_status(
    user_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns current email notification subscription status for the user."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "enabled": bool(user.email_notifications_enabled),
        "notification_email": user.notification_email,
        "preferred_time": user.preferred_notification_time or "08:00",
        "preferred_timezone": user.preferred_notification_timezone or "UTC",
    }


@app.put("/notifications/email/update-time", tags=["notifications"])
async def update_notification_time(
    payload: UpdateNotificationTimeRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the user's preferred daily notification time and timezone."""
    import re as _re
    import pytz as _pytz
    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    pt = payload.preferred_time.strip()
    if not _re.match(r'^([01]\d|2[0-3]):[0-5]\d$', pt):
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM (e.g. 08:00)")
    user.preferred_notification_time = pt
    tz = payload.preferred_timezone.strip()
    try:
        _pytz.timezone(tz)
        user.preferred_notification_timezone = tz
    except Exception:
        user.preferred_notification_timezone = "UTC"
    db.commit()
    return {
        "message": f"Notification time updated to {pt} ({user.preferred_notification_timezone}).",
        "preferred_time": pt,
        "preferred_timezone": user.preferred_notification_timezone,
    }


# ============================================================
# STREAK & DAILY CHECK-IN
# ============================================================

# Streak math + automatic streak insurance live in streaks.py (shared with the
# email scheduler). The old in-file implementation moved there and gained
# shield-awareness: a "shielded" day keeps the chain unbroken without counting.
from .streaks import (
    recalculate_streak as _recalculate_streak,
    apply_streak_shield as _apply_streak_shield,
    shields_left as _shields_left,
)


# ── "How do I do this?" ───────────────────────────────────────────────────────

HOWTO_SYSTEM = (
    "You are a patient coach explaining ONE day's task from a weekly plan to a complete beginner. "
    "Return ONLY JSON, no prose, no markdown fences:\n"
    '{"summary": "one sentence on what this day is for", '
    '"items": [{"name": "the exercise/step as written", "steps": ["3-6 short numbered-style steps, each one action"], '
    '"mistakes": ["1-3 common mistakes"], "easier": "an easier version if it is too hard"}], '
    '"bare_minimum": "the smallest version of the day that still counts", '
    '"time_minutes": 30}\n'
    "Rules: break the task into its real items (each exercise, each sub-task). Use plain words, no jargon; "
    "if a term is unavoidable, explain it in the step. Numbers (reps, sets, minutes) from the task stay exactly as written. "
    "Never invent equipment the task does not mention. Keep every string under 160 characters. "
    "Reply in the language of the task text."
)


class HowToRequest(BaseModel):
    action: str
    day_label: Optional[str] = None


def _extract_json_object(raw: str) -> Optional[Dict[str, Any]]:
    """The first {...} object in a model reply, fences and chatter tolerated."""
    text = (raw or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.I)
    start = text.find("{")
    if start == -1:
        return None
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    value = json.loads(text[start:i + 1])
                except ValueError:
                    return None
                return value if isinstance(value, dict) else None
    return None


def _normalise_howto(data: Dict[str, Any], action: str) -> Dict[str, Any]:
    items = []
    for it in (data.get("items") or [])[:12]:
        if not isinstance(it, dict):
            continue
        # The page numbers the list itself; a "1." the model wrote would double up.
        steps = [re.sub(r"^\s*(?:step\s*)?\d+\s*[.):-]\s*", "", str(s), flags=re.I).strip() for s in (it.get("steps") or [])]
        steps = [s for s in steps if s][:8]
        if not steps:
            continue
        items.append({
            "name": str(it.get("name") or "").strip()[:160] or "Step",
            "steps": steps,
            "mistakes": [str(m).strip() for m in (it.get("mistakes") or []) if str(m).strip()][:3],
            "easier": (str(it.get("easier") or "").strip()[:200] or None),
        })
    if not items:
        raise ValueError("no usable items")
    minutes = data.get("time_minutes")
    try:
        minutes = int(minutes) if minutes is not None else None
    except (TypeError, ValueError):
        minutes = None
    return {
        "summary": str(data.get("summary") or "").strip()[:240],
        "items": items,
        "bare_minimum": str(data.get("bare_minimum") or "").strip()[:240] or None,
        "time_minutes": minutes,
        "action": action,
    }


@app.post("/sessions/{session_id}/howto", tags=["sessions"])
async def task_howto(
    session_id: str,
    req: HowToRequest,
    request: Request,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_consented_user),
):
    """A step-by-step guide for one plan day. Generated once per distinct task
    text and kept, so reopening it is instant and free."""
    from .llm import call_with_fallback_chain

    session_rec = db.query(Session).filter(Session.id == session_id, Session.user_id == current_user.id).first()
    if not session_rec:
        raise HTTPException(status_code=404, detail="Session not found")
    action = (req.action or "").strip()
    if len(action) < 8:
        raise HTTPException(status_code=400, detail="Nothing to explain for this day.")
    action = action[:2000]
    day_label = (req.day_label or "").strip()[:40] or None

    import hashlib
    action_hash = hashlib.sha1(action.encode("utf-8")).hexdigest()
    cached = db.query(TaskHowTo).filter(TaskHowTo.session_id == session_id, TaskHowTo.action_hash == action_hash).first()
    if cached:
        try:
            return {**json.loads(cached.content_json), "cached": True, "day_label": cached.day_label or day_label}
        except ValueError:
            db.delete(cached)
            db.commit()

    _enforce_rate_limit("howto", request, identity=current_user.id)

    goal = (session_rec.focus or "").strip()[:300]
    user_prompt = (
        (f"The user's goal: {goal}\n" if goal else "")
        + (f"Day: {day_label}\n" if day_label else "")
        + f"Task as written in the plan:\n{action}"
    )
    messages = [{"role": "system", "content": HOWTO_SYSTEM}, {"role": "user", "content": user_prompt}]
    try:
        raw = await asyncio.to_thread(call_with_fallback_chain, messages, temperature=0.3, max_tokens=1400)
        data = _extract_json_object(raw)
        if not data:
            raise ValueError("model reply was not JSON")
        content = _normalise_howto(data, action)
    except Exception as e:
        logger.warning(f"[HowTo] generation failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=503, detail="Couldn't build the guide right now. Ask your mentor instead — it's one tap.")

    db.add(TaskHowTo(session_id=session_id, action_hash=action_hash, day_label=day_label, content_json=json.dumps(content)))
    db.commit()
    return {**content, "cached": False, "day_label": day_label}


# ── Asking for the next week ──────────────────────────────────────────────────
# Once a week is complete the model may build the next one, but only when the
# user actually asks. A confused "I don't know how to do this" is not a request.

# What counts as asking for the next week. Deliberately needs a plan/week noun
# next to an intent word, so "I don't understand this plan" or "how do I build
# muscle" don't read as a request to build anything.
_NEXT_WEEK_ASK = re.compile(
    r"(next\s*week|week\s*\d+|new\s+plan|next\s+plan|"
    r"(build|make|create|generate|prepare|plan|design)\s+(me\s+|us\s+)?(a\s+|the\s+|my\s+|another\s+|next\s+|new\s+)*(week|plan)|"
    r"\bbanao\b|\bbana\s*do\b|\bbnao\b|"
    r"(agla|agle|next)\s+(hafta|hafte|week|plan))",
    re.I,
)
_AFFIRMATION = re.compile(
    r"^\W*(yes|yeah|yep|yup|ya|haan|han|ha|ok|okay|sure|go|go ahead|do it|please|kar do|karo|"
    r"lets go|let's go|start|build it|make it|chalo)\b",
    re.I,
)


def _asks_for_next_week(message: str, last_assistant: str = "") -> bool:
    """True when the user asked for the next week's plan, in their own words or
    by agreeing to the mentor's offer of it."""
    text = message or ""
    if _NEXT_WEEK_ASK.search(text):
        return True
    if _AFFIRMATION.match(text) and re.search(r"(next\s*week|week\s*\d+)", last_assistant or "", re.I):
        return True
    return False


def _last_assistant_text(history: List[Dict[str, str]]) -> str:
    for m in reversed(history or []):
        if m.get("role") == "assistant":
            return m.get("content") or ""
    return ""


UNASKED_PLAN_CORRECTION = (
    "CORRECTION: The user did NOT ask for a new week or a new plan. Do not build, propose or "
    "mention a new plan. Answer their actual message directly and specifically — explain, teach, "
    "reassure, or ask one clarifying question. \"plan\" MUST be null."
)


@app.post("/checkin", tags=["streak"])
async def daily_checkin(
    payload: CheckinRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_consented_user),
):
    """
    Mark today as done or skipped. Idempotent — calling twice updates the status.
    Accepts optional client_date (ISO string) to handle timezone differences.
    Returns updated streak.
    """
    from datetime import date
    # Use client's local date if provided (avoids UTC vs IST timezone mismatch)
    today = payload.client_date if payload.client_date else date.today().isoformat()
    user_id = current_user.id

    if payload.status not in ("done", "skipped"):
        raise HTTPException(status_code=400, detail="status must be 'done' or 'skipped'")

    # Upsert checkin for today
    existing = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == today)
        .first()
    )
    if existing:
        existing.status = payload.status
        if payload.note:
            existing.note = payload.note
        if payload.session_id:
            existing.session_id = payload.session_id
    else:
        checkin = DailyCheckin(
            user_id=user_id,
            session_id=payload.session_id,
            date=today,
            status=payload.status,
            note=payload.note,
        )
        db.add(checkin)
    db.commit()

    # A returning user's first action of the day: if yesterday would have broken
    # the chain, spend a shield on it silently before the streak is recalculated.
    shield_info = _apply_streak_shield(db, current_user, today)

    # Pass client_date so streak boundary uses user's local timezone
    streak = _recalculate_streak(db, user_id, client_date=today)
    return {
        "date": today,
        "status": payload.status,
        "shield_applied": bool(shield_info),
        "shields_left": _shields_left(current_user),
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_done": streak.total_done,
    }


class SlipReasonRequest(BaseModel):
    date: str                    # ISO date of the missed day (usually yesterday)
    reason: str                  # one of SLIP_REASONS
    session_id: Optional[str] = None


SLIP_REASONS = {"no time", "low energy", "forgot", "life happened"}


@app.post("/checkin/slip_reason", tags=["streak"])
async def save_slip_reason(
    payload: SlipReasonRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_consented_user),
):
    """Record WHY a day slipped, from the recovery card's one-tap chips.

    Deliberately NOT routed through the mentor chat: a slip reason is context
    for the weekly report (which reads it from the check-in note), not a
    conversation opener — sending it to the model mid-week caused it to start
    renegotiating the locked plan.
    """
    from datetime import date as _slip_date
    reason = payload.reason.strip().lower()
    if reason not in SLIP_REASONS:
        raise HTTPException(status_code=400, detail="Unknown reason")
    try:
        _slip_date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date")

    row = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == current_user.id, DailyCheckin.date == payload.date)
        .first()
    )
    if row:
        base = (row.note or "").split("| slip_reason:", 1)[0].strip()
        row.note = f"{base} | slip_reason: {reason}".strip(" |") if base else f"slip_reason: {reason}"
        if payload.session_id and not row.session_id:
            row.session_id = payload.session_id
    else:
        db.add(DailyCheckin(
            user_id=current_user.id,
            session_id=payload.session_id,
            date=payload.date,
            status="skipped",
            note=f"slip_reason: {reason}",
        ))
    db.commit()
    return {"saved": True, "date": payload.date, "reason": reason}


class RecoveryMotivationRequest(BaseModel):
    miss_count: int = 1
    focus: Optional[str] = None  # the goal, for a line that lands personally


@app.post("/recovery/motivation", tags=["streak"])
async def recovery_motivation(
    payload: RecoveryMotivationRequest,
    current_user: User = Depends(get_consented_user),
):
    """One fresh, short motivational line for the recovery card.

    Generated per request (the client caches it per local day) so the card
    never repeats itself. Falls back to a solid static line if the LLM is
    unavailable — the recovery moment must never show an error.
    """
    miss_count = max(1, min(int(payload.miss_count or 1), 14))
    fallbacks = [
        "One missed day never broke a habit. Walking away did.",
        "The chain isn't broken — it's waiting. One rep today re-links it.",
        "Research says a single miss changes nothing. Two in a row writes a new habit. Choose today.",
    ]
    try:
        from .llm import call_llm
        goal_bit = f' Their goal: "{payload.focus.strip()[:120]}".' if payload.focus and payload.focus.strip() else ""
        prompt = (
            "Write ONE short motivational line (max 130 characters) for someone who just "
            f"missed {miss_count} day{'s' if miss_count != 1 else ''} of their habit and opened the app today.{goal_bit} "
            "Tone: warm, direct coach — zero shame, zero clichés, no exclamation spam, no emoji, no quotes around it. "
            "Ground it in the truth that one lapse doesn't break a habit but today's action decides the trend. "
            "Reply with the line only — no preamble, no quotation marks."
        )
        line = (call_llm(prompt, temperature=0.9, max_tokens=60) or "").strip().strip('"').strip()
        if not line or len(line) > 200:
            raise ValueError("bad line")
        return {"line": line, "source": "llm"}
    except Exception as e:
        logger.warning(f"[Recovery] motivation line fallback: {e}")
        return {"line": fallbacks[miss_count % len(fallbacks)], "source": "fallback"}


@app.get("/streak/{user_id}", tags=["streak"])
async def get_streak(
    user_id: str,
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return streak stats + last 7 days checkin statuses for the UI calendar strip.
    Pass client_date query param so streak boundary and week strip use user's local date.
    """
    from datetime import date, timedelta

    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Opening the app IS the moment protection matters: shield yesterday's miss
    # (if a shield is available) before the streak is recalculated, so the user
    # sees a preserved streak instead of a broken one.
    _today_iso = client_date or date.today().isoformat()
    shield_info = _apply_streak_shield(db, current_user, _today_iso)

    # Re-calculate streak using client's local date so UTC vs IST doesn't break it
    streak_rec = _recalculate_streak(db, user_id, client_date=client_date)

    # Build Mon–Sun of the CURRENT calendar week using client's local date
    if client_date:
        try:
            today_d = date.fromisoformat(client_date)
        except ValueError:
            today_d = date.today()
    else:
        today_d = date.today()

    # weekday(): Monday=0, Sunday=6
    week_monday = today_d - timedelta(days=today_d.weekday())
    days = []
    for i in range(7):  # Mon(0) → Sun(6)
        d = (week_monday + timedelta(days=i)).isoformat()
        checkin = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == d)
            .first()
        )
        days.append({"date": d, "status": checkin.status if checkin else "pending"})

    return {
        "current_streak": streak_rec.current_streak if streak_rec else 0,
        "longest_streak": streak_rec.longest_streak if streak_rec else 0,
        "total_done": streak_rec.total_done if streak_rec else 0,
        "last_checkin": streak_rec.last_checkin if streak_rec else None,
        "days_this_week": days,
        "shield_applied": bool(shield_info),
        "shields_left": _shields_left(current_user),
    }


# Where "Open Feelivate" buttons on server-rendered pages point (the frontend).
FRONTEND_APP_URL = os.getenv("APP_URL", "https://emotion-time-travel-brlz.vercel.app")


def _email_checkin_page(title: str, body: str, accent: str = "#a855f7") -> str:
    """Tiny standalone confirmation page for one-tap email actions."""
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — Feelivate</title></head>
<body style="margin:0;background:#0a0a0f;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
             display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
  <div style="max-width:420px;text-align:center;background:#13131a;border:1px solid rgba(168,85,247,0.2);
              border-radius:20px;padding:44px 34px;">
    <div style="font-size:44px;margin-bottom:14px;">{'&#10003;' if accent != '#f87171' else '&#9888;'}</div>
    <h1 style="color:#f4f4f5;font-size:22px;margin:0 0 10px;">{title}</h1>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 26px;">{body}</p>
    <a href="{FRONTEND_APP_URL}/app" style="display:inline-block;background:{accent};color:#0a0a0f;
       text-decoration:none;font-size:13px;font-weight:700;padding:12px 28px;border-radius:100px;
       letter-spacing:0.05em;text-transform:uppercase;">Open Feelivate</a>
  </div>
</body></html>"""


@app.get("/checkin/email", response_class=HTMLResponse, tags=["streak"])
async def checkin_from_email(token: str, db: DBSession = Depends(get_db)):
    """One-tap "Done" from the daily email — no login.

    The signed token (user + date + action, 48h) IS the authorisation. This
    exists because the daily loop must be completable from the inbox: forcing a
    login round-trip on the one action we most need people to take is exactly
    where the loop breaks.
    """
    data = verify_email_action_token(token, "checkin")
    if not data:
        return HTMLResponse(
            _email_checkin_page(
                "This link has expired",
                "One-tap links live for 48 hours. Open the app to log today instead — it takes two taps.",
                accent="#f87171",
            ),
            status_code=400,
        )

    user_id, date_iso = data["sub"], data["d"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return HTMLResponse(
            _email_checkin_page("Account not found", "This link doesn't match an active account.", accent="#f87171"),
            status_code=404,
        )

    existing = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == date_iso)
        .first()
    )
    if existing:
        existing.status = "done"
    else:
        db.add(DailyCheckin(user_id=user_id, date=date_iso, status="done", note="one-tap from email"))
    db.commit()

    _apply_streak_shield(db, user, date_iso)
    streak = _recalculate_streak(db, user_id, client_date=date_iso)
    day_word = "day" if streak.current_streak == 1 else "days"
    return HTMLResponse(
        _email_checkin_page(
            "Done. That's what counts.",
            f"Today is logged — your streak is at <strong style='color:#f4f4f5;'>{streak.current_streak} {day_word}</strong>. See you tomorrow.",
        )
    )


# ============================================================
# WEEKLY REVIEW
# ============================================================

@app.post("/sessions/{session_id}/weekly_review", tags=["sessions"])
async def submit_weekly_review(
    session_id: str,
    payload: WeeklyReviewRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Save user's end-of-week review feedback.
    This is injected into the prompt when building next week's plan.
    """
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Store reviews as a list keyed by week_number
    reviews: list = []
    if session.week_review_json:
        try:
            reviews = json.loads(session.week_review_json)
        except Exception:
            reviews = []

    # Upsert review for this week
    reviews = [r for r in reviews if r.get("week_number") != payload.week_number]
    reviews.append({"week_number": payload.week_number, "feedback": payload.feedback})
    session.week_review_json = json.dumps(reviews)
    db.commit()

    return {"status": "saved", "week_number": payload.week_number}


# ============================================================
# WEEK INFO — session-scoped week bounds
# ============================================================

# Week bounds now live in app/weeks.py so maintenance scripts can import them
# without loading the whole app. Re-exported here — everything below still
# calls them by their original names.
from .weeks import (  # noqa: E402
    _bounds_from_start,
    _effective_lock_start,
    _fit_plan_to_window,
    _projected_week_start,
    _week_bounds_for,
    build_quiet_week_report,
)


def _latest_approved_week(session_rec) -> int:
    """The highest week number among APPROVED plans — the week the Journey page should
    display. While a next-week plan is generated but not yet locked (phase 'planning'),
    this stays on the previous approved week, so the Journey keeps showing the old week
    until the user locks the new one."""
    weeks = []
    if session_rec.result_json:
        try:
            hist = json.loads(session_rec.result_json)
            if isinstance(hist, list):
                for p in hist:
                    if isinstance(p, dict) and isinstance(p.get("week_number"), int):
                        weeks.append(p["week_number"])
        except Exception:
            pass
    if weeks:
        return max(weeks)
    # No approved history — only treat the session's current_week as displayed if it's
    # already active (legacy sessions); otherwise nothing is approved yet.
    if session_rec.phase == "active" and session_rec.current_week is not None:
        return session_rec.current_week
    return 0


@app.get("/sessions/{session_id}/week-info", tags=["sessions"])
async def get_week_info(
    session_id: str,
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current week's date bounds and completion status for the session.
    Pass client_date (YYYY-MM-DD) from user's local timezone to avoid UTC vs IST mismatch.
    is_week_complete is True on the LAST day itself (>=) so the report and Plan Week N+1
    button both appear on Sunday rather than the day after.
    """
    from datetime import date
    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec or session_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session_rec.plan_start_date:
        return {"has_plan": False, "current_week": 0}

    # Display the latest APPROVED week. During 'planning' (next week generated but not
    # yet locked) this stays on the previous approved week, so the Journey keeps showing
    # the old week until the user locks the new one — then it switches immediately.
    current_week = _latest_approved_week(session_rec)
    ws, we, day_count = _week_bounds_for(session_rec, current_week)

    # Use client's local date if provided — avoids UTC vs IST midnight-shift bugs
    if client_date:
        try:
            today = date.fromisoformat(client_date).isoformat()
        except ValueError:
            today = date.today().isoformat()
    else:
        today = date.today().isoformat()

    # >= so the last day of the week (Sunday/plan-end day) itself counts as "complete".
    # This allows the weekly report and "Plan Week N+1" button to appear on the final day
    # after the user records their voice journal, rather than requiring them to wait until
    # the following day.
    is_week_complete = today >= we

    # Check if a weekly report exists for this week
    has_report = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == current_user.id,
        WeeklyReport.session_id == session_id,
        WeeklyReport.week_start == ws,
    ).first() is not None

    # Check if next week's plan already exists
    # When user generates "Plan Week N+1", session.current_week increments to N+1
    # So if there's a week_start AFTER this week, next plan exists
    from datetime import timedelta as _td2
    next_ws = (date.fromisoformat(we) + _td2(days=1)).isoformat()
    has_next_plan = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == current_user.id,
        WeeklyReport.session_id == session_id,
        WeeklyReport.week_start >= next_ws,
    ).first() is not None

    return {
        "has_plan": True,
        "current_week": current_week,
        "plan_start_date": session_rec.plan_start_date,
        "week_start": ws,
        "week_end": we,
        "day_count": day_count,
        "is_week_complete": is_week_complete,
        "is_completed": bool(session_rec.is_completed),
        "has_report": has_report,
        "has_next_plan": has_next_plan,
    }


# ============================================================
# SESSION COMPLETION
# ============================================================

@app.post("/sessions/{session_id}/complete", tags=["sessions"])
async def complete_session(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Finish a goal. End means end.

    The session is marked completed immediately — no model call, nothing to
    wait for, nothing that can fail halfway and leave the goal half-open. From
    here the mentor is a plain conversation: no new weekly plans, no new
    reviews, no task emails. Every week already recorded stays in the archive.
    """
    from datetime import datetime as _dt

    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec or session_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    checkins = db.query(DailyCheckin).filter(DailyCheckin.session_id == session_id).all()
    done_count = sum(1 for c in checkins if c.status == "done")
    weeks_recorded = db.query(WeeklyReport).filter(WeeklyReport.session_id == session_id).count()
    weeks_locked = 0
    try:
        weeks_locked = len(json.loads(session_rec.result_json or "[]"))
    except (TypeError, ValueError):
        pass

    stats = {
        "total_weeks": max(weeks_locked, weeks_recorded, int(session_rec.current_week or 0)),
        "days_done": done_count,
        "days_total": len(checkins),
    }
    already = bool(session_rec.is_completed or session_rec.phase == "completed")
    session_rec.is_completed = 1
    session_rec.phase = "completed"
    if not already:
        session_rec.session_report_json = json.dumps({"finished_at": _dt.utcnow().isoformat(timespec="seconds"), "stats": stats})
    db.commit()
    logger.info(f"[Finish] session={session_id} user={current_user.id} weeks={stats['total_weeks']} done={done_count}/{len(checkins)}")
    return {"status": "completed", "stats": stats}


# ============================================================
# ARCHIVE — All weekly reports for a session
# ============================================================

@app.get("/sessions/{session_id}/reports", tags=["sessions"])
async def get_session_reports(
    session_id: str,
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return weekly reports for a session — only for weeks that have actually FINISHED.
    The current/ongoing week is never shown in the Archive (its report belongs to the
    live Overview until the week ends)."""
    from datetime import date as _date_cls
    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec or session_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    if client_date:
        try:
            today_str = _date_cls.fromisoformat(client_date).isoformat()
        except ValueError:
            today_str = _date_cls.today().isoformat()
    else:
        today_str = _date_cls.today().isoformat()

    reports = (
        db.query(WeeklyReport)
        .filter(WeeklyReport.session_id == session_id)
        .order_by(WeeklyReport.week_number.asc())
        .all()
    )

    result = []
    for r in reports:
        # Skip ONLY the current ONGOING week (it lives in the live Overview tab). Every
        # other week belongs in the Archive — including a week that ended TODAY. A
        # stopped/completed session has no ongoing week, so all its reports show.
        if session_rec.phase == "active" and r.week_number == session_rec.current_week:
            continue
        try:
            report_data = json.loads(r.report_json)
        except Exception:
            report_data = {}
        result.append({
            "week_number": r.week_number,
            "week_start": r.week_start,
            "week_end": r.week_end,
            "report": report_data,
        })
    return result


# ============================================================
# VOICE JOURNAL & WEEKLY EMOTION REPORT
# ============================================================

_EMOTION_LABELS = [
    "motivated", "stressed", "focused", "anxious", "confident",
    "drained", "excited", "neutral", "frustrated", "hopeful",
]

def _loads_model_json(raw: str) -> Optional[dict]:
    """A JSON object out of a model reply — fences, think-blocks and chatter stripped."""
    raw = re.sub(r'<think>.*?</think>', '', raw or '', flags=re.DOTALL)
    raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
    json_str = _extract_json_by_braces(raw)
    if not json_str:
        start, end = raw.find("{"), raw.rfind("}")
        json_str = raw[start:end + 1] if start != -1 and end > start else ""
    if not json_str:
        return None
    try:
        data = json.loads(json_str)
    except (TypeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


# "In your words" guards — shared with the daily email (see journal_text.py).
from .journal_text import loose as _loose, said_verbatim as _said_verbatim, strongest_sentence as _strongest_sentence  # noqa: E402


def _dominant_emotion(journals: list) -> Optional[str]:
    """
    The week's most common journal emotion — the label that appears on the
    most days, ties broken by the higher total score. Deterministic, and
    always one of the labels the app knows how to colour; the model's own
    word for it ("sadness", "mixed") is not.
    """
    tally: dict = {}
    for j in journals:
        label = (getattr(j, "emotion_label", None) or "").strip().lower()
        if not label:
            continue
        n, total = tally.get(label, (0, 0))
        tally[label] = (n + 1, total + (getattr(j, "emotion_score", None) or 0))
    if not tally:
        return None
    return max(tally.items(), key=lambda kv: (kv[1][0], kv[1][1]))[0]


async def _analyze_emotion(transcript: str) -> dict:
    """
    Use LLM to detect emotion from transcript.
    Returns {label, score, one_liner}.
    """
    from .llm import call_llm, call_with_fallback_chain

    text = (transcript or "").strip()
    if not text:
        logger.warning("[Emotion] Empty transcript — returning neutral/5")
        return {"label": "neutral", "score": 5, "one_liner": ""}
    # The WHOLE entry goes to the model. It used to see the first 800
    # characters — about a minute of speech — so a note that opened one way
    # and ended another was labelled by its opening. 20k characters is a
    # guard against runaway input (~25 minutes of talking), not a working cap.
    if len(text) > 20000:
        text = text[:20000]

    prompt = (
        "You are an expert emotion analyst. Read the journal entry below — it may be in "
        "English, Hindi, or Hinglish — and detect how the writer actually feels.\n\n"
        f"Entry (complete — read all of it):\n\"{text}\"\n\n"
        "Rules:\n"
        "- Read the ENTIRE entry before deciding. People often open one way and land "
        "somewhere else; the feeling they end on, weighed with everything before it, is "
        "the day's emotion — never just the opening lines.\n"
        f"- Pick the single best label from: {', '.join(_EMOTION_LABELS)}\n"
        "- Give an honest score from 1 to 10 using the FULL range:\n"
        "    1-3  = clearly negative (drained, anxious, frustrated, stressed)\n"
        "    4-6  = mixed, mild, or genuinely neutral\n"
        "    7-10 = clearly positive (motivated, excited, confident, hopeful)\n"
        "- Use 'neutral' with score 5 ONLY when the entry has NO emotional signal at all. "
        "If there is ANY emotional cue, choose the matching label with an honest score — "
        "do NOT default to neutral/5.\n"
        "- Judge how the writer feels, not the topic they talk about.\n"
        "- one_liner: ONE short sentence that sums up the WHOLE entry — what they did and "
        "how it left them — keeping their own specifics.\n\n"
        "Respond with ONLY valid JSON, nothing else:\n"
        "{\"label\": \"<label>\", \"score\": <integer 1-10>, \"one_liner\": \"<1 short sentence>\"}"
    )
    system = "You are an expert emotion analyst. Output raw JSON only — no markdown, no preamble."

    # Groq's qwen reads the entry first — it does this job well and costs no
    # OpenRouter tokens; the gpt-oss chain (OpenRouter, then OpenAI) is the
    # safety net so a Groq outage never collapses a day to neutral/5.
    attempts = [
        ("qwen/qwen3.8-27b", lambda: call_llm(prompt, temperature=0.2, max_tokens=240, model_override="qwen/qwen3.8-27b")),
        ("gpt-oss chain", lambda: call_with_fallback_chain(
            [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
            temperature=0.2, max_tokens=240,
        )),
    ]
    last_err = None
    for model, fn in attempts:
        try:
            raw = await asyncio.to_thread(fn)
            logger.info(f"[Emotion] ({model}) raw response: {repr(raw[:300])}")
            raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
            json_str = _extract_json_by_braces(raw)
            if not json_str:
                start = raw.find("{")
                end = raw.rfind("}")
                json_str = raw[start:end + 1] if start != -1 and end != -1 else None
            if not json_str:
                logger.warning(f"[Emotion] No JSON from {model}: {repr(raw[:200])}")
                continue

            data = json.loads(json_str)
            # Normalize label
            label = str(data.get("label", "neutral")).lower().strip()
            if label not in _EMOTION_LABELS:
                logger.warning(f"[Emotion] Unexpected label '{label}', keeping as-is")
            # Score can come back as string or float — round, don't truncate (7.6 → 8)
            raw_score = data.get("score", 5)
            try:
                score = max(1, min(10, int(round(float(str(raw_score))))))
            except (ValueError, TypeError):
                score = 5
                logger.warning(f"[Emotion] Could not parse score '{raw_score}', defaulting to 5")
            one_liner = str(data.get("one_liner", "")).strip()
            logger.info(f"[Emotion] ✅ ({model}) label={label}, score={score}, one_liner={one_liner[:60]}")
            return {"label": label, "score": score, "one_liner": one_liner}
        except Exception as e:
            last_err = e
            logger.warning(f"[Emotion] {model} failed: {type(e).__name__}: {e}")
            continue

    logger.error(f"[Emotion] All models failed — defaulting to neutral/5. Last error: {last_err}")
    return {"label": "neutral", "score": 5, "one_liner": ""}


@app.post("/mood/checkin", tags=["journal"])
async def create_mood_checkin(
    audio: UploadFile = File(...),
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_consented_user),
):
    """Mood-only voice check-in, for the gap BETWEEN weeks.

    Deliberately connected to nothing: no VoiceJournal row, no daily check-in,
    no streak recalc, no week report. Transcribe → read the mood → store a bare
    EmotionalState point so the trend isn't lost — that's all. The main journal
    mic stays locked while no week is active; this is the little mic beside it.
    """
    from .llm import call_groq_transcribe

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    try:
        transcript = await asyncio.to_thread(
            call_groq_transcribe, audio_bytes, audio.filename or "recording.webm"
        )
    except Exception as e:
        logger.error(f"Mood transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed. Please try again.")
    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Could not transcribe audio — too short or silent.")

    emotion = await _analyze_emotion(transcript)

    try:
        db.add(EmotionalState(
            user_id=current_user.id,
            session_id=None,  # unattached on purpose — this joins no journey
            sentiment_score=int(emotion.get("score") or 0),
            dominant_emotion=emotion.get("label"),
        ))
        db.commit()
    except Exception as e:
        logger.warning(f"Mood point persist failed (non-fatal): {e}")

    return {
        "emotion_label": emotion["label"],
        "emotion_score": emotion["score"],
        "one_liner": emotion["one_liner"],
        "mood_only": True,
    }


@app.post("/journal/voice", tags=["journal"])
async def create_voice_journal(
    audio: UploadFile = File(...),
    session_id: Optional[str] = None,
    client_date: Optional[str] = None,  # ISO date from client local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_consented_user),
):
    """
    Upload a voice note → transcribe (Groq Whisper) → analyze emotion (LLM) → save.
    Session-scoped: pass session_id query param to tag entry to a session.
    One entry per user per day; calling again updates the existing entry.
    Pass client_date (ISO string) to use local timezone instead of UTC.
    """
    from .llm import call_groq_transcribe
    from datetime import date

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    filename = audio.filename or "recording.webm"
    # Use client's local date if provided to avoid UTC vs IST timezone mismatch
    today = client_date if client_date else date.today().isoformat()
    user_id = current_user.id

    # 1. Transcribe
    try:
        transcript = await asyncio.to_thread(call_groq_transcribe, audio_bytes, filename)
    except Exception as e:
        logger.error(f"Transcription failed: {e}")
        raise HTTPException(status_code=500, detail="Transcription failed. Please try again.")

    if not transcript.strip():
        raise HTTPException(status_code=422, detail="Could not transcribe audio — too short or silent.")

    # 2. Analyze emotion
    emotion = await _analyze_emotion(transcript)

    # 3. Upsert journal entry for today (one per user per day PER SESSION).
    #    Scoping by session keeps each journey independent — recording in a new
    #    session creates its own entry instead of overwriting another session's.
    upsert_q = db.query(VoiceJournal).filter(
        VoiceJournal.user_id == user_id, VoiceJournal.date == today
    )
    if session_id:
        upsert_q = upsert_q.filter(VoiceJournal.session_id == session_id)
    existing = upsert_q.first()
    if existing:
        existing.transcript = transcript
        existing.emotion_label = emotion["label"]
        existing.emotion_score = emotion["score"]
        existing.one_liner = emotion["one_liner"]
        # Always update session_id to the latest active session
        if session_id:
            existing.session_id = session_id
    else:
        entry = VoiceJournal(
            user_id=user_id,
            session_id=session_id,
            date=today,
            transcript=transcript,
            emotion_label=emotion["label"],
            emotion_score=emotion["score"],
            one_liner=emotion["one_liner"],
        )
        db.add(entry)
    db.commit()

    # 4. Auto-mark today's daily checkin as "done" so the streak updates automatically
    #    when a voice journal is recorded (user doesn't need to press Done separately).
    existing_checkin = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == today)
        .first()
    )
    if existing_checkin:
        # Only upgrade to 'done' — never downgrade a done checkin
        if existing_checkin.status != "done":
            existing_checkin.status = "done"
        # Always update session_id to the latest active session
        if session_id:
            existing_checkin.session_id = session_id
    else:
        db.add(DailyCheckin(
            user_id=user_id,
            session_id=session_id,
            date=today,
            status="done",
        ))
    db.commit()
    # Pass today (client date) so streak boundary uses user's local timezone
    _recalculate_streak(db, user_id, client_date=today)

    response: Dict[str, Any] = {
        "date": today,
        "transcript": transcript,
        "emotion_label": emotion["label"],
        "emotion_score": emotion["score"],
        "one_liner": emotion["one_liner"],
        "recorded_today": True,
    }
    # A voice note is often where someone says the thing they wouldn't type.
    # Same screen as the chat endpoint, applied to the transcript.
    if detect_crisis(transcript):
        response["safety"] = crisis_payload()
    return response


@app.post("/streak/backfill", tags=["streak"])
async def backfill_streak_from_journals(
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Backfill: create DailyCheckin 'done' entries for every existing VoiceJournal
    that doesn't already have a checkin. Recalculates streak.
    Idempotent — safe to call on every app load.
    Pass client_date so streak boundary uses user's local timezone.
    """
    user_id = current_user.id
    journals = (
        db.query(VoiceJournal)
        .filter(VoiceJournal.user_id == user_id)
        .all()
    )
    created = 0
    for j in journals:
        existing = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == j.date)
            .first()
        )
        if not existing:
            db.add(DailyCheckin(
                user_id=user_id,
                session_id=j.session_id,
                date=j.date,
                status="done",
            ))
            created += 1
        elif existing.status != "done":
            existing.status = "done"
    db.commit()
    streak = _recalculate_streak(db, user_id, client_date=client_date)
    return {
        "checkins_created": created,
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_done": streak.total_done,
    }


@app.get("/journal/{user_id}", tags=["journal"])
async def get_journals(
    user_id: str,
    session_id: Optional[str] = None,
    limit: int = 30,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch voice journal entries. If session_id provided, filter to that session."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    q = db.query(VoiceJournal).filter(VoiceJournal.user_id == user_id)
    if session_id:
        q = q.filter(VoiceJournal.session_id == session_id)
    entries = q.order_by(VoiceJournal.date.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "date": e.date,
            "transcript": e.transcript,
            "emotion_label": e.emotion_label,
            "emotion_score": e.emotion_score,
            "one_liner": e.one_liner,
            "created_at": e.created_at,
        }
        for e in entries
    ]


@app.get("/journal/{user_id}/today-emotion", tags=["journal"])
async def get_today_emotion(
    user_id: str,
    session_id: Optional[str] = None,
    client_date: Optional[str] = None,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return today's voice journal entry if it exists. Used by the chat-side emotion orb.
    Pass client_date (YYYY-MM-DD) from user's local timezone to avoid UTC mismatch.
    Returns null if no entry recorded today.
    """
    from datetime import date
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Use client's local date if provided to avoid UTC vs IST timezone mismatch
    if client_date:
        try:
            today = date.fromisoformat(client_date).isoformat()
        except ValueError:
            today = date.today().isoformat()
    else:
        today = date.today().isoformat()

    # Today's entry for THIS session (each journey is independent — a fresh session
    # must not show an entry recorded under a different session on the same day).
    entry_q = db.query(VoiceJournal).filter(
        VoiceJournal.user_id == user_id, VoiceJournal.date == today
    )
    if session_id:
        entry_q = entry_q.filter(VoiceJournal.session_id == session_id)
    entry = entry_q.order_by(VoiceJournal.created_at.desc()).first()
    if not entry:
        return {"has_entry": False, "entry": None}
    return {
        "has_entry": True,
        "entry": {
            "id": entry.id,
            "date": entry.date,
            "emotion_label": entry.emotion_label,
            "emotion_score": entry.emotion_score,
            "one_liner": entry.one_liner,
        },
    }


@app.get("/journal/{user_id}/weekly-report", tags=["journal"])
async def get_weekly_report(
    user_id: str,
    session_id: Optional[str] = None,
    week_number: Optional[int] = None,
    force_refresh: bool = False,
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return (or generate) the weekly emotion report.
    Session-scoped: uses plan_start_date to compute correct week bounds.
    week_number defaults to the session's current_week.
    A report is only generated/persisted once the week is COMPLETE (Sunday entry
    recorded OR Sunday passed) — never mid-week, so it never appears early in Archive.
    """
    from .llm import call_llm, call_with_fallback_chain
    from datetime import date, timedelta

    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Use the user's local date (avoids UTC vs IST Sunday-boundary bugs)
    if client_date:
        try:
            today = date.fromisoformat(client_date)
        except ValueError:
            today = date.today()
    else:
        today = date.today()

    # Determine week bounds
    session_rec = None
    if session_id:
        session_rec = db.query(Session).filter(Session.id == session_id).first()

    if session_rec and session_rec.plan_start_date:
        # Use session-scoped week bounds (anchored to each week's lock date)
        wk_num = week_number if week_number is not None else _latest_approved_week(session_rec)
        ws, we, _ = _week_bounds_for(session_rec, wk_num)
    else:
        # Fallback: standard Mon–Sun of current calendar week
        wk_num = week_number if week_number is not None else 1
        week_start_d = today - timedelta(days=today.weekday())
        ws = week_start_d.isoformat()
        we = (week_start_d + timedelta(days=6)).isoformat()

    # ── 0. Finished goal: the archive is read-only ──────────────────────────────
    # "End means end": once a goal is finished no new review is written for it,
    # whatever the calendar says. Reviews that already exist stay readable.
    if session_rec is not None and (session_rec.is_completed or session_rec.phase == "completed"):
        done_q = db.query(WeeklyReport).filter(WeeklyReport.user_id == user_id, WeeklyReport.week_start == ws, WeeklyReport.session_id == session_id)
        done_wr = done_q.first()
        if done_wr:
            try:
                return {"status": "cached", "week_start": ws, "week_end": we, "week_number": wk_num, "report": json.loads(done_wr.report_json)}
            except (TypeError, ValueError):
                pass
        return {
            "status": "no_data",
            "message": "This goal is finished — no new reviews are written for it.",
            "week_start": ws, "week_end": we, "week_number": wk_num, "finished": True,
        }

    # ── 1. Fetch this week's voice journals (SESSION-SCOPED) ────────────────────
    # Each journey/session is independent: a new session starts fresh and must NOT
    # inherit voice entries recorded under a different session (even on the same day).
    journals_q = db.query(VoiceJournal).filter(
        VoiceJournal.user_id == user_id,
        VoiceJournal.date >= ws,
        VoiceJournal.date <= we,
    )
    if session_id:
        journals_q = journals_q.filter(VoiceJournal.session_id == session_id)
    journals = journals_q.order_by(VoiceJournal.date.asc()).all()

    if not journals:
        today_str_early = today.isoformat()
        if today_str_early <= we:
            # Week still running — nothing to report yet.
            return {"status": "no_data", "message": "No journal entries this week yet.", "week_start": ws, "week_end": we, "week_number": wk_num}

        # ── Quiet week: the week ENDED with zero journals. Previously this
        # returned no_data forever — no report in the Archive, no has_report,
        # and the next-week flow had nothing to read. Instead, persist an
        # honest deterministic report (no LLM needed for silence): plain about
        # the zero input, warm about the restart. quiet_week=True also tells
        # the mentor prompt to restart at the same level instead of advancing.
        done_days = (
            db.query(DailyCheckin)
            .filter(
                DailyCheckin.user_id == user_id,
                DailyCheckin.date >= ws,
                DailyCheckin.date <= we,
                DailyCheckin.status == "done",
            )
            .count()
        )
        quiet_report = build_quiet_week_report(wk_num, ws, we, done_days)
        try:
            existing_wr = cache_q_early = db.query(WeeklyReport).filter(
                WeeklyReport.user_id == user_id, WeeklyReport.week_start == ws,
            )
            if session_id:
                cache_q_early = cache_q_early.filter(WeeklyReport.session_id == session_id)
            existing_wr = cache_q_early.first()
            if existing_wr:
                existing_wr.report_json = json.dumps(quiet_report)
            else:
                db.add(WeeklyReport(
                    user_id=user_id, session_id=session_id, week_number=wk_num,
                    week_start=ws, week_end=we, report_json=json.dumps(quiet_report),
                ))
            db.commit()
        except Exception as _qe:
            logger.warning(f"Quiet-week report persist failed (non-fatal): {_qe}")
        return {"status": "generated", "week_start": ws, "week_end": we, "week_number": wk_num, "report": quiet_report}

    # ── 1b. Completion gate ─────────────────────────────────────────────────────
    # A weekly report is generated (and persisted) ONLY once the week is COMPLETE:
    #   • Sunday's voice entry has been recorded, OR
    #   • Sunday has already passed (today is after week_end).
    # While the week is still in progress we never generate or cache a report, so it
    # never shows up in the Archive before the week is actually over.
    today_str = today.isoformat()
    sunday_entry_exists = any(j.date == we for j in journals)
    week_complete = (today_str > we) or sunday_entry_exists
    if not week_complete:
        return {
            "status": "in_progress",
            "message": "Your weekly review unlocks when this week wraps up — record Sunday's entry, or once Sunday passes.",
            "week_start": ws, "week_end": we, "week_number": wk_num,
        }

    # ── 2. Check cache (session + week keyed) ──────────────────────────────────
    cache_q = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == user_id,
        WeeklyReport.week_start == ws,
    )
    if session_id:
        cache_q = cache_q.filter(WeeklyReport.session_id == session_id)
    cached = cache_q.first()
    if cached and not force_refresh:
        try:
            cached_data = json.loads(cached.report_json)
            # Validate cache: entry_count must match AND days_done must match actual
            # journal count for this week (not DailyCheckin count which can be inflated).
            # We determine "actual" days_done from journal_by_date below, but for a quick
            # check we count journals that fall within the week bounds.
            journals_in_week = sum(1 for j in journals if ws <= j.date <= we)
            cached_days_done = cached_data.get("days_done", -1)
            cached_entry_count = cached_data.get("entry_count", -1)
            cache_valid = (
                cached_entry_count == len(journals)
                and cached_days_done == journals_in_week  # voice journal = source of truth
                and "momentum_score" in cached_data        # V2 schema check — force regen if old format
            )
            if cache_valid:
                return {"status": "cached", "week_start": ws, "week_end": we, "week_number": wk_num, "report": cached_data}
        except Exception:
            pass

    # ── 3. Fetch daily checkins for this week ────────────────────────────────
    from datetime import date as _date_cls, timedelta as _td
    ws_date = _date_cls.fromisoformat(ws)
    we_date = _date_cls.fromisoformat(we)
    day_count_total = (we_date - ws_date).days + 1
    all_week_days = [(ws_date + _td(days=i)).isoformat() for i in range(day_count_total)]
    checkin_map: dict = {}
    slip_reason_map: dict = {}
    for d in all_week_days:
        row = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == d)
            .first()
        )
        checkin_map[d] = row.status if row else ("pending" if d > today.isoformat() else "missed")
        # The recovery card stores WHY a day slipped ("slip_reason: no time")
        # on that day's check-in — surfaced to the report model so the review
        # can name the real obstacle instead of guessing.
        if row and row.note and "slip_reason:" in row.note:
            slip_reason_map[d] = row.note.split("slip_reason:", 1)[1].strip()

    # ── 4. Fetch the approved week plan ─────────────────────────────────────
    week_plan_days: list = []
    week_plan_theme = ""
    if session_rec and session_rec.week_plan_json:
        try:
            plan = json.loads(session_rec.week_plan_json)
            week_plan_days = plan.get("days", [])
            week_plan_theme = plan.get("theme", "")
        except Exception:
            pass

    # Align plan days to calendar days by anchoring to the SHARED Sunday endpoint
    # (both the plan and the displayed week end on Sunday). This way, if the user
    # locks late — e.g. plan built Wed→Sun but locked Friday so the week is Fri→Sun —
    # Friday correctly shows Friday's task, not Wednesday's. The leading plan days
    # (Wed/Thu) are simply dropped along with those calendar days.
    _plan_offset = len(week_plan_days) - len(all_week_days)

    def _plan_day_for(i: int) -> dict:
        idx = i + _plan_offset
        if 0 <= idx < len(week_plan_days) and isinstance(week_plan_days[idx], dict):
            return week_plan_days[idx]
        return {}

    # ── 5. Build the per-day data merge ────────────────────────────────────
    journal_by_date = {j.date: j for j in journals}
    avg_score = round(sum(j.emotion_score or 5 for j in journals) / len(journals), 1)

    # Use voice journal count for days_done — NOT DailyCheckin.
    # Reason: backfill marks journal days as "done" in DailyCheckin, but DailyCheckin
    # can also be inflated by manual checkins or stale backfill data, causing
    # "2/2 done" to show even when the user recorded only 1 voice entry.
    # Voice journals are the source of truth for this report.
    past_days = [d for d in all_week_days if d <= today.isoformat()]
    past_days_count = len(past_days)
    days_done = sum(1 for d in past_days if d in journal_by_date)
    days_missed = past_days_count - days_done
    consistency_score = round((days_done / max(past_days_count, 1)) * 100) if past_days_count > 0 else 0

    # ── 5b. Fetch previous week reports for cross-week patterns ─────────
    prev_week_reports: list = []
    prev_week_stats = None
    if session_id and wk_num > 1:
        prev_reports_q = (
            db.query(WeeklyReport)
            .filter(
                WeeklyReport.session_id == session_id,
                WeeklyReport.week_number < wk_num,
            )
            .order_by(WeeklyReport.week_number.desc())
            .limit(4)
            .all()
        )
        for pr in prev_reports_q:
            try:
                pr_data = json.loads(pr.report_json)
                prev_week_reports.append(pr_data)
                # Capture immediate previous week stats for delta comparison
                if pr.week_number == wk_num - 1:
                    prev_week_stats = {
                        "consistency_score": pr_data.get("consistency_score", 0),
                        "avg_score": pr_data.get("avg_score", 0),
                        "momentum_score": pr_data.get("momentum_score", 0),
                        "days_done": pr_data.get("days_done", 0),
                    }
            except Exception:
                pass

    # ── 5c. Compute momentum score server-side (deterministic) ────────
    # Formula: (consistency * 0.4) + (mood_normalized * 0.3) + (task_quality * 0.3)
    mood_normalized = min(100, max(0, round((avg_score / 10) * 100)))
    # Task quality: ratio of days with journals that indicate positive execution
    task_quality = round((days_done / max(past_days_count, 1)) * 100)
    momentum_score = round(
        (consistency_score * 0.4) + (mood_normalized * 0.3) + (task_quality * 0.3)
    )
    momentum_label = (
        "Peak" if momentum_score >= 85 else
        "Strong Week" if momentum_score >= 70 else
        "Building" if momentum_score >= 50 else
        "Struggling" if momentum_score >= 30 else
        "Reset Needed"
    )

    # ── 5d. Extract best quote from transcripts ──────────────────────
    best_quote = ""
    best_j_transcript = ""
    if journals:
        # The highest-scored entry: its one-liner as a last resort, its
        # transcript as the source of a real sentence when the model paraphrases.
        best_j = max(journals, key=lambda j: (j.emotion_score or 0))
        best_quote = best_j.one_liner or ""
        best_j_transcript = best_j.transcript or ""

    # ── 5e. Detect peak performance time from journal timestamps ─────
    peak_performance_days: list = []
    if journals:
        from collections import Counter
        day_scores: dict = {}
        for j in journals:
            if j.emotion_score and j.emotion_score >= 7:
                # Parse local date to get day name
                try:
                    jd = _date_cls.fromisoformat(j.date)
                    day_name = jd.strftime("%a")
                    day_scores[day_name] = day_scores.get(day_name, 0) + j.emotion_score
                except Exception:
                    pass
        if day_scores:
            sorted_days = sorted(day_scores.items(), key=lambda x: x[1], reverse=True)
            peak_performance_days = [d[0] for d in sorted_days[:3]]

    # ── 5f. The weeks before (from Week 2) ───────────────────────────────
    # The week just before is read in full — every field, every day — and the
    # weeks before that as a line of numbers each, so patterns across weeks
    # are seen rather than guessed.
    from .prompts import render_week_report
    cross_week_context = ""
    if prev_week_reports and wk_num >= 2:
        prev_full = next((pw for pw in prev_week_reports if pw.get("week_number") == wk_num - 1), None)
        older = [pw for pw in prev_week_reports if pw is not prev_full]
        blocks = []
        if prev_full:
            blocks.append(f"LAST WEEK'S REVIEW IN FULL (Week {wk_num - 1}):\n{render_week_report(prev_full)}")
        if older:
            pattern_lines = []
            for pw in older:
                pw_days = [d for d in pw.get("days", []) if isinstance(d, dict)]
                low_days = [d.get("date", "") for d in pw_days if d.get("score") and d.get("score") <= 4]
                missed_days = [d.get("date", "") for d in pw_days if not d.get("has_journal")]
                pattern_lines.append(
                    f"  Week {pw.get('week_number', '?')}: consistency={pw.get('consistency_score', 0)}%, "
                    f"avg_mood={pw.get('avg_score', 0)}/10, dominant={pw.get('dominant_emotion', '')}, "
                    f"low_score_dates={low_days}, missed_dates={missed_days}"
                )
            blocks.append("EARLIER WEEKS (numbers only):\n" + "\n".join(pattern_lines))
        cross_week_context = "\n\n" + "\n\n".join(blocks)

    # ── 6. Build the analysis prompts ────────────────────────────────────
    # Every journal entry goes in COMPLETE. The review used to see the first
    # 600 characters of each — about forty seconds of speech — so an entry
    # that opened one way and ended another was reviewed by its opening.
    day_name_of = {d: _date_cls.fromisoformat(d).strftime("%A") for d in all_week_days}
    planned_of = {d: (_plan_day_for(i).get("action", "") or "") for i, d in enumerate(all_week_days)}

    def _entry_block(j) -> str:
        head = f"[{j.date} · {day_name_of.get(j.date, '')}] Felt that evening: {j.emotion_label} ({j.emotion_score}/10) · one-line: {j.one_liner or '—'}"
        if planned_of.get(j.date):
            head += f"\nPlanned that day: {planned_of[j.date]}"
        return head + f"\nFull entry (verbatim, complete):\n{(j.transcript or '').strip()}"

    transcripts_block = "\n\n".join(_entry_block(j) for j in journals)
    all_transcripts = [(j.transcript or "") for j in journals]

    missing_lines = []
    for d in all_week_days:
        if d in journal_by_date or d > today.isoformat():
            continue
        line = f"  {d} · {day_name_of[d]}: no journal · check-in {checkin_map.get(d, 'missed')}"
        if planned_of.get(d):
            line += f" · planned: {planned_of[d]}"
        if d in slip_reason_map:
            line += f" · their stated reason: {slip_reason_map[d]}"
        missing_lines.append(line)
    missing_block = "\n".join(missing_lines) if missing_lines else "  none — every day has a journal"

    goal_lines = []
    if session_rec:
        for label, val in (
            ("Goal", session_rec.focus), ("Their why, in their words", session_rec.commitment_why),
            ("Where they want to be", session_rec.vision), ("Background they gave", session_rec.history),
        ):
            if val and str(val).strip():
                goal_lines.append(f"{label}: {str(val).strip()[:1200]}")
    goal_block = "\n".join(goal_lines) if goal_lines else "Goal: (not recorded)"

    # Plan vs actual comparison block (iterate calendar days, end-anchored tasks)
    plan_vs_actual = ""
    if week_plan_days:
        lines = []
        for i, d in enumerate(all_week_days):
            pd = _plan_day_for(i)
            day_label = pd.get("day", "")
            task = pd.get("action", "")
            s = checkin_map.get(d, "pending")
            j_info = ""
            if d in journal_by_date:
                j_info = f" | Voice Journal: {journal_by_date[d].emotion_label} ({journal_by_date[d].emotion_score}/10) - '{journal_by_date[d].one_liner}'"
            reason_info = f" | User's stated reason for the miss: {slip_reason_map[d]}" if d in slip_reason_map else ""
            lines.append(f"  Day {i+1} ({day_label or d}): Planned: '{task}' | Checkin: {s}{j_info}{reason_info}")
        plan_vs_actual = "\nWEEK PLAN vs ACTUAL CHECK-INS & JOURNALS:\n" + "\n".join(lines)

    # ── 6a. Pass one: the evidence sheet ─────────────────────────────────
    # Before anything is judged, the model retells what each entry actually
    # said — in order, in the person's own specifics — and what runs across
    # the days. The review is then written from that sheet and the complete
    # transcripts, so every line of it traces back to something they said.
    evidence_prompt = f"""You are a careful behavioural analyst. Build an EVIDENCE SHEET for this person's week before any review is written. Read every journal entry in full, start to finish, and record only what is actually there — no advice, no invention.

{goal_block}
Week {wk_num}: {ws} to {we} · theme: {week_plan_theme or '—'}

JOURNAL ENTRIES (complete transcripts — the user's own words, possibly in English, Hindi or Hinglish):
{transcripts_block}

DAYS WITHOUT A JOURNAL:
{missing_block}
{cross_week_context}

Respond with ONLY valid JSON (no markdown, no code fences):
{{
  "days": [
    {{
      "date": "YYYY-MM-DD",
      "said_in_short": "3-5 sentences that faithfully retell the WHOLE entry in order — what they did, what happened, how it went. Keep their specifics (names, numbers, places, times).",
      "did": "What they actually did versus what was planned that day, in one or two sentences.",
      "felt": "How they felt, including any shift within the entry (e.g. 'started frustrated, ended relieved'). Use their own emotional words.",
      "why": "The causes they themselves named for how it went. 'not stated' if they gave none.",
      "key_line": "ONE sentence copied EXACTLY, character for character, from this entry — the line that carries the most weight.",
      "friction": ["things that got in the way, in their words"],
      "win": "a concrete win from this entry, or null"
    }}
  ],
  "week_arc": "The emotional and practical arc across the journaled days, in order, 2-3 sentences.",
  "threads": ["themes that appear in more than one entry — name the days"],
  "contradictions": ["where what they said and what they did differ — name the days"],
  "what_they_need": "What this person needs next week, judged from the whole of what they recorded — one or two sentences."
}}

Rules:
- One object per journaled day, in date order; nothing for days without a journal.
- Every claim must be traceable to an entry. If only one or two days have journals, analyse those fully — do not pad, do not generalise beyond them.
- Quote in the user's own language; do not translate key_line."""

    evidence: Optional[dict] = None
    try:
        raw_ev = await asyncio.to_thread(
            call_with_fallback_chain,
            [
                {"role": "system", "content": "You are a careful behavioural analyst. Output raw JSON only — no markdown, no code fences, no preamble."},
                {"role": "user", "content": evidence_prompt},
            ],
            temperature=0.2, max_tokens=4000,
        )
        parsed = _loads_model_json(raw_ev)
        if parsed and isinstance(parsed.get("days"), list):
            evidence = parsed
        else:
            logger.warning("Weekly report evidence pass returned no usable JSON; writing the review from the transcripts alone")
    except Exception as _ev_err:
        logger.warning(f"Weekly report evidence pass failed (non-fatal): {_ev_err}")

    # Only lines the person actually said survive as their words.
    if evidence:
        for ev_day in evidence.get("days", []):
            if not isinstance(ev_day, dict):
                continue
            jd = journal_by_date.get(ev_day.get("date"))
            if not jd or not _said_verbatim(str(ev_day.get("key_line") or ""), [jd.transcript or ""]):
                ev_day["key_line"] = ""

    evidence_block = (
        "\nEVIDENCE SHEET (built from the complete transcripts above — what each entry actually said):\n"
        + json.dumps(evidence, ensure_ascii=False, indent=1)
    ) if evidence else ""

    # ── 6b. Pass two: the review ─────────────────────────────────────────
    prompt = f"""You are a world-class performance coach and behavioral analyst. Your job is to write a deep, honest, insightful WEEK REVIEW for this user.

You have access to:
- Every one of their voice journal entries this week, COMPLETE and verbatim (what they actually felt and said)
- An evidence sheet that retells each entry and what runs across the days
- Their daily checkin status (did they complete their plan each day)
- Their week's planned tasks (what they were supposed to do)
- Their goal in their own words, and last week's full review when there is one

Read everything before writing. Every sentence of the review must be grounded in what they recorded — cite the day. Analyse the days that exist collectively and deeply: if three days have journals, the review is about those three days in depth, not about the four that are missing. Never invent what a missing day felt like.

Be direct, specific, and honest. This is NOT a therapy session — it's a performance review. Call out exactly where consistency broke, what patterns emerged, and what needs to change next week.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{goal_block}
WEEK DATA: {ws} to {we} (Week {wk_num})
Theme: {week_plan_theme or 'Personal growth'}
Days with checkin done: {days_done}/{past_days_count}
Days missed: {days_missed}
Avg emotional score: {avg_score}/10
Momentum score: {momentum_score}/100 ({momentum_label})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VOICE JOURNAL ENTRIES (complete transcripts — the user's own words):
{transcripts_block}

DAYS WITHOUT A JOURNAL:
{missing_block}
{plan_vs_actual}
{evidence_block}
{cross_week_context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond with ONLY valid JSON (no markdown, no code fences) in this EXACT schema:
{{
  "dominant_emotion": "the single most common emotional state this week, judged from the whole of each entry",
  "week_summary": {{
    "wins": "2-3 specific wins — cite actual days and what they said or did. 2 sentences max.",
    "dips": "2-3 specific dips or consistency breaks — be direct, cite the day and the evidence. 2 sentences max.",
    "pattern": "One key behavioral pattern you noticed across the journaled days. 1-2 sentences."
  }},
  "hidden_insight": "One non-obvious insight about their emotional patterns that they probably haven't noticed themselves — drawn from how the entries read in full, not from any one line.",
  "next_week_focus": "The single most important thing they must do differently next week. Very specific and actionable.",
  "next_week_plan_context": "2-3 bullet points of what the next week plan should account for. Format: bullet per line with \\n separator.",
  "week_badge": {{
    "name": "A short badge name for this week based on their pattern. Examples: 'Iron Week' (100% consistency), 'Comeback King' (started low finished high), 'Steady Climber' (mood improved each day), 'Grit Mode' (pushed through despite low mood), 'Fresh Start' (first week). Pick the most fitting one.",
    "reason": "One sentence explaining why they earned this badge."
  }},
  "best_quote": "The single most emotionally resonant or powerful sentence from the user's voice journal transcripts this week. Copy it EXACTLY, character for character, in their own language — it is displayed as a pull-quote.",
  "actionable_coaching": [
    {{
      "observation": "Day 1: One-line observation about what happened that day, from the entry — e.g. 'Strong start, executed setup task with high energy'",
      "micro_action": "One specific micro-action for improvement — e.g. 'Keep this momentum by setting a 9am start ritual'"
    }}
  ],
  "trigger_patterns": [
    {{
      "pattern": "A recurring friction or trigger detected across weeks — e.g. 'Friday mood dip', 'Cravings correlate with low scores'",
      "frequency": "How often it occurred — e.g. 'Every Friday', '3 out of 4 weeks'",
      "weeks_detected": [1, 2, 3]
    }}
  ],
  "recurring_friction": ["list", "of", "recurring", "friction", "points", "in their words"],
  "best_days": ["Tue", "Sun"],
  "worst_days": ["Thu", "Fri"],
  "mood_trend": "Description of overall mood trajectory — e.g. 'high-start, mid-dip, strong-finish'"
}}

IMPORTANT NOTES:
- "actionable_coaching": exactly one object per calendar day listed under WEEK PLAN vs ACTUAL, in that order ({len(all_week_days)} objects). Each MUST have both "observation" AND "micro_action". For a day with a journal, the observation comes from that entry. For a day WITHOUT a journal, the observation names the miss and what was planned, and the micro_action says how to make that day easier next time. Make micro_actions specific — e.g. "Try 5-min breathing before coding" not "take a break".
- "best_quote": the MOST powerful line from the user's actual transcripts, copied exactly. NOT your own words, NOT a paraphrase, NOT translated.
- "trigger_patterns": only patterns seen in MORE THAN ONE week (use the earlier weeks above). In Week 1, or when nothing recurs, return [].
- "week_badge": always generate one — even for Week 1.
- Write the review in English; quote the user in whatever language they spoke.
- Keep "week_summary" concise — 3 short bullets, not paragraphs."""

    try:
        messages = [
            {"role": "system", "content": "You are a world-class performance coach and behavioral analyst. You must output raw JSON only matching the schema exactly. No markdown, no code fences."},
            {"role": "user", "content": prompt}
        ]
        raw = await asyncio.to_thread(call_with_fallback_chain, messages, temperature=0.4, max_tokens=5000)
        # Strip thinking blocks if generated
        raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        # Use robust balanced-brace extraction, fall back to find/rfind
        json_str = _extract_json_by_braces(raw)
        if not json_str:
            start_idx = raw.find("{")
            end_idx = raw.rfind("}")
            json_str = raw[start_idx:end_idx + 1] if start_idx != -1 else "{}"
        ai_data = json.loads(json_str)

        # Normalize actionable_coaching
        coaching_list = ai_data.get("actionable_coaching", [])
        if not isinstance(coaching_list, list):
            coaching_list = []
        while len(coaching_list) < 7:
            coaching_list.append({"observation": "", "micro_action": ""})
        # Ensure each item has both fields
        for item in coaching_list:
            if not isinstance(item, dict):
                item = {"observation": "", "micro_action": ""}
            item.setdefault("observation", "")
            item.setdefault("micro_action", "")
        ai_data["actionable_coaching"] = coaching_list

        # Normalize week_summary
        ws_data = ai_data.get("week_summary", {})
        if not isinstance(ws_data, dict):
            ws_data = {}
        ws_data.setdefault("wins", "")
        ws_data.setdefault("dips", "")
        ws_data.setdefault("pattern", "")
        ai_data["week_summary"] = ws_data

        # Normalize week_badge
        badge = ai_data.get("week_badge", {})
        if not isinstance(badge, dict):
            badge = {"name": "Week Warrior", "reason": "Completed this week's journey."}
        badge.setdefault("name", "Week Warrior")
        badge.setdefault("reason", "Completed this week's journey.")
        ai_data["week_badge"] = badge

        # Normalize trigger_patterns
        triggers = ai_data.get("trigger_patterns", [])
        if not isinstance(triggers, list):
            triggers = []
        ai_data["trigger_patterns"] = triggers

        # The pull-quote must be something they actually said. A paraphrase,
        # a translation, or nothing at all → one of their own sentences instead.
        if not _said_verbatim(str(ai_data.get("best_quote") or ""), all_transcripts):
            ai_data["best_quote"] = _strongest_sentence(best_j_transcript) if best_j_transcript else best_quote

        # The week's emotion is the one that appears on the most days, from the
        # labels each entry was given — not the model's own word for it.
        ai_data["dominant_emotion"] = _dominant_emotion(journals) or ai_data.get("dominant_emotion") or "neutral"

    except Exception as e:
        logger.error(f"Weekly report AI generation failed: {e}")
        ai_data = {
            "dominant_emotion": journals[0].emotion_label if journals else "neutral",
            "week_summary": {
                "wins": "You showed up and recorded your journey.",
                "dips": "Analysis unavailable.",
                "pattern": f"You completed {days_done} out of {past_days_count} days.",
            },
            "hidden_insight": "",
            "next_week_focus": "Keep showing up every day.",
            "next_week_plan_context": "",
            "week_badge": {"name": "Week Warrior", "reason": "Completed this week's journey."},
            "best_quote": _strongest_sentence(best_j_transcript) if best_j_transcript else best_quote,
            "actionable_coaching": [{"observation": "", "micro_action": ""} for _ in range(7)],
            "trigger_patterns": [],
            "recurring_friction": [],
            "best_days": [],
            "worst_days": [],
            "mood_trend": "",
        }
        coaching_list = ai_data["actionable_coaching"]

    # ── 7. Build the final report dict ──────────────────────────────────────
    ev_by_date: dict = {}
    if evidence:
        for ev_day in evidence.get("days", []):
            if isinstance(ev_day, dict) and ev_day.get("date"):
                ev_by_date[ev_day["date"]] = ev_day
    report_data = {
        **ai_data,
        # The evidence sheet the review was written from, kept with it so the
        # next week's plan and the next review can read what each entry said.
        "analysis": evidence,
        "analysis_version": 2,
        # Core metrics
        "avg_score": avg_score,
        "consistency_score": consistency_score,
        "days_done": days_done,
        "days_missed": days_missed,
        "past_days_count": past_days_count,
        "entry_count": len(journals),
        "week_start": ws,
        "week_end": we,
        "week_number": wk_num,
        "week_theme": week_plan_theme,
        # V2 metrics
        "momentum_score": momentum_score,
        "momentum_label": momentum_label,
        "peak_performance_days": peak_performance_days,
        # Previous week stats for delta comparison
        "prev_week_stats": prev_week_stats,
        # Per-day data for charts and detailed breakdown
        "days": [
            {
                "date": d,
                "day_label": _plan_day_for(i).get("day") or f"Day {i+1}",
                "planned_task": _plan_day_for(i).get("action", ""),
                "emotion": journal_by_date[d].emotion_label if d in journal_by_date else None,
                "score": journal_by_date[d].emotion_score if d in journal_by_date else None,
                "one_liner": journal_by_date[d].one_liner if d in journal_by_date else None,
                # A sentence they actually said that day (verified against the transcript).
                "key_line": (ev_by_date.get(d) or {}).get("key_line") or None,
                # Use journal presence as source of truth for checkin status
                # (DailyCheckin can be inflated by backfill; journal IS the record)
                "checkin": "done" if d in journal_by_date else ("missed" if d <= today.isoformat() else "pending"),
                "has_journal": d in journal_by_date,
                "coaching_insight": coaching_list[i].get("observation", "") if i < len(coaching_list) else "",
                "coaching_micro_action": coaching_list[i].get("micro_action", "") if i < len(coaching_list) else "",
            }
            for i, d in enumerate(all_week_days)
        ],
    }

    # ── 7b. Build model_context (Layer 2 — structured JSON for AI consumption) ──
    report_data["model_context"] = {
        "week_number": wk_num,
        "date_range": f"{ws} to {we}",
        "goal": session_rec.focus if session_rec else "",
        "stats": {
            "consistency_pct": consistency_score,
            "days_done": days_done,
            "days_missed": days_missed,
            "avg_mood_score": avg_score,
            "dominant_emotion": ai_data.get("dominant_emotion", "neutral"),
            "momentum_score": momentum_score,
        },
        "daily_log": [
            {
                "day": _plan_day_for(i).get("day") or f"Day {i+1}",
                "task_planned": _plan_day_for(i).get("action", ""),
                "task_done": d in journal_by_date,
                "mood_score": journal_by_date[d].emotion_score if d in journal_by_date else None,
                "emotion": journal_by_date[d].emotion_label if d in journal_by_date else None,
                "journal_summary": journal_by_date[d].one_liner if d in journal_by_date else None,
                "friction_noted": ", ".join(str(f) for f in ((ev_by_date.get(d) or {}).get("friction") or []) if f) or None,
            }
            for i, d in enumerate(all_week_days)
        ],
        "patterns": {
            "recurring_friction": ai_data.get("recurring_friction", []),
            "best_days": ai_data.get("best_days", peak_performance_days),
            "worst_days": ai_data.get("worst_days", []),
            "mood_trend": ai_data.get("mood_trend", ""),
        },
        "ai_insight": ai_data.get("hidden_insight", ""),
        "next_week_carry_forward": ai_data.get("next_week_focus", ""),
    }

    # ── 8. Cache the report ───────────────────────────────────────────────────
    if cached:
        cached.report_json = json.dumps(report_data)
        cached.week_number = wk_num
        if session_id and not cached.session_id:
            cached.session_id = session_id
    else:
        db.add(WeeklyReport(
            user_id=user_id,
            session_id=session_id,
            week_number=wk_num,
            week_start=ws,
            week_end=we,
            report_json=json.dumps(report_data),
        ))
    db.commit()

    return {"status": "generated", "week_start": ws, "week_end": we, "week_number": wk_num, "report": report_data}


# ============================================================
# METRICS & AUDIO
# ============================================================

class ContactRequest(BaseModel):
    name: str
    email: str
    message: str


@app.post("/contact", tags=["contact"])
async def contact_form(req: ContactRequest, request: Request):
    """Receive a website contact-form submission and email it to the team."""
    import html as _html
    import resend

    # Unauthenticated and it sends mail — cap it per IP.
    _enforce_rate_limit("contact", request)
    resend.api_key = os.getenv("RESEND_API_KEY", "")
    if not resend.api_key:
        raise HTTPException(status_code=503, detail="Contact form is temporarily unavailable. Please email info@june64.com directly.")
    name = _html.escape((req.name or "").strip())[:120]
    email = _html.escape((req.email or "").strip())[:160]
    message = _html.escape((req.message or "").strip())[:5000].replace("\n", "<br>")
    if not email or not message:
        raise HTTPException(status_code=400, detail="Email and message are required.")
    try:
        resend.Emails.send({
            "from": f"Feelivate Contact <{os.getenv('FROM_EMAIL', 'onboarding@resend.dev')}>",
            "to": ["info@june64.com"],
            "subject": f"Website contact — {name or 'New message'}",
            "html": f"<p><b>Name:</b> {name}</p><p><b>Email:</b> {email}</p><hr><p>{message}</p>",
        })
        return {"status": "sent"}
    except Exception as e:
        logger.error(f"Contact form failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Could not send your message right now. Please email info@june64.com directly.")


# ============================================================
# PRODUCT FEEDBACK
# ============================================================

from .models import UserFeedback

# The moments that can open a form. Anything else is recorded as the side tab.
FEEDBACK_TRIGGERS = {
    "exit_intent", "first_plan", "first_chats", "timer", "logout", "side_tab", "tab_return",
    "after_journal", "second_tweak", "weekly_report", "task_email",
}
# The chips the form offers; unknown values are dropped rather than stored.
FEEDBACK_CHIPS = {"signup", "tutorial", "plan", "mentor_chat", "alerts", "design", "speed", "other"}

# Each form's questions and the answers it accepts. A submission is only
# stored with answers from this table, so the inbox can count on the values.
FEEDBACK_FORMS: Dict[str, Dict[str, Any]] = {
    # The side tab / weekly form. "upset" is the one required question: it
    # predicts whether they come back better than any star rating.
    "full": {
        "required": ["upset"],
        "choices": {
            "upset": {"very", "a_bit", "not_really"},
            "liked_most": FEEDBACK_CHIPS,
            "confusing": FEEDBACK_CHIPS,            # multi
        },
        "text": {"upset_reason": 400, "quit_reason": 600, "broke": 600},
        "text_map": {"confusing_notes": 300},     # {chip: note}
    },
    # Right after a plan is built, before locking it.
    "plan_fit": {
        "required": ["fit"],
        "choices": {"fit": {"too_hard", "about_right", "too_easy"}},
        "text": {"note": 400},
    },
    # After the evening voice note: how today's task actually was.
    "task_day": {
        "required": ["quality"],
        "choices": {
            "quality": {"great", "fine", "off", "didnt_fit"},
            "clarity": {"clear", "somewhat", "unclear"},
            "time": {"shorter", "right", "longer"},
        },
        "text": {"note": 400},
    },
    # After the second tweak of a draft: why isn't it landing.
    "tweaks": {
        "required": ["reason"],
        "choices": {"reason": {"too_hard", "too_easy", "wrong_time", "not_my_goal", "misunderstood", "other"}},
        "text": {"note": 400},
        "ints": {"tweak_count"},
    },
    # 👍/👎 from the morning email (one tap, no login).
    "task_email": {
        "required": ["clear"],
        "choices": {"clear": {"yes", "no"}},
        "text": {},
    },
}


# ╔══════════════════════════════════════════════════════════════╗
# ║  Push notifications — the phone's copy of the daily alerts    ║
# ╚══════════════════════════════════════════════════════════════╝

class DeviceTokenRequest(BaseModel):
    token: str
    platform: str = "android"


@app.post("/notifications/device", tags=["notifications"])
async def register_device(
    req: DeviceTokenRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    The app calls this after Android hands it an FCM token — on first launch,
    on every sign-in, and whenever Google rotates the token.
    """
    from .push_service import register_token
    token = (req.token or "").strip()
    if len(token) < 20 or len(token) > 4096:
        raise HTTPException(status_code=400, detail="Not a device token.")
    platform = req.platform if req.platform in ("android", "ios") else "android"
    register_token(db, current_user.id, token, platform)
    return {"ok": True}


@app.delete("/notifications/device", tags=["notifications"])
async def forget_device(
    req: DeviceTokenRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Logout: this phone should stop hearing from the account that left it."""
    from .push_service import unregister_token
    unregister_token(db, (req.token or "").strip())
    return {"ok": True}


class FeedbackRequest(BaseModel):
    kind: str = "full"
    answers: Dict[str, Any] = {}
    # Legacy fields, still accepted from older clients.
    rating: Optional[int] = None
    liked: List[str] = []
    confusing: List[str] = []
    comment: Optional[str] = None
    contact_ok: bool = False
    email: Optional[str] = None
    trigger: str = "side_tab"
    page: Optional[str] = None
    session_id: Optional[str] = None


def _clean_answers(kind: str, raw: Dict[str, Any]) -> Dict[str, Any]:
    """Keep only the answers the form defines, in the shapes it defines."""
    spec = FEEDBACK_FORMS[kind]
    out: Dict[str, Any] = {}
    for key, allowed in spec["choices"].items():
        value = raw.get(key)
        if key == "confusing":
            picks = value if isinstance(value, list) else []
            out[key] = [str(p) for p in dict.fromkeys(picks) if str(p) in allowed]
        elif value is not None and str(value) in allowed:
            out[key] = str(value)
    for key, limit in spec.get("text", {}).items():
        value = (str(raw.get(key) or "")).strip()[:limit]
        if value:
            out[key] = value
    for key, limit in spec.get("text_map", {}).items():
        value = raw.get(key)
        if isinstance(value, dict):
            notes = {str(k): str(v).strip()[:limit] for k, v in value.items() if str(k) in FEEDBACK_CHIPS and str(v).strip()}
            if notes:
                out[key] = notes
    for key in spec.get("ints", set()):
        try:
            out[key] = int(raw.get(key))
        except (TypeError, ValueError):
            pass
    missing = [k for k in spec["required"] if k not in out]
    if missing:
        raise HTTPException(status_code=400, detail=f"Please answer: {', '.join(missing)}.")
    # The one follow-up that must not be skipped: someone who wouldn't miss us
    # is asked why, and that answer is the whole point.
    if kind == "full" and out.get("upset") in ("a_bit", "not_really") and not out.get("upset_reason"):
        raise HTTPException(status_code=400, detail="Please tell us the main reason.")
    return out


def _feedback_context(db: DBSession, user: Optional[User], session_id: Optional[str]) -> Dict[str, Any]:
    """What the person was doing when they answered: goal, week, today's
    plan day, streak, days active. Without it a note like "the plan felt
    off" cannot be placed; with it, it came from day 2 of a fitness goal."""
    from datetime import datetime as _dt

    ctx: Dict[str, Any] = {"session_id": None, "goal": None, "week_number": None, "plan_day": None, "current_streak": None, "days_active": None}
    if not user:
        return ctx
    try:
        q = db.query(Session).filter(Session.user_id == user.id)
        session_rec = q.filter(Session.id == session_id).first() if session_id else None
        if session_rec is None:
            session_rec = q.filter(Session.phase.in_(["active", "planning"])).order_by(Session.updated_at.desc()).first()
        if session_rec is not None:
            ctx["session_id"] = session_rec.id
            ctx["goal"] = (session_rec.focus or "").strip()[:160] or None
            try:
                plan = json.loads(session_rec.week_plan_json or "{}")
            except ValueError:
                plan = {}
            days = plan.get("days", []) if isinstance(plan, dict) else []
            if days:
                # Only a session with a plan is "in" a week.
                ctx["week_number"] = plan.get("week_number", session_rec.current_week)
                now = _dt.utcnow()
                today_label = now.strftime("%b %d").lower()   # plan days are stamped "Oct 10 (Sat)"
                today_name = now.strftime("%a").lower()
                match = next((d for d in days if today_label in str(d.get("day", "")).lower()), None)
                if match is None:
                    match = next((d for d in days if today_name in str(d.get("day", "")).lower()), None)
                if match is not None:
                    ctx["plan_day"] = str(match.get("day"))[:40]
        streak = db.query(UserStreak).filter(UserStreak.user_id == user.id).first()
        ctx["current_streak"] = int(streak.current_streak or 0) if streak is not None else 0
        checkin_days = {r[0] for r in db.query(DailyCheckin.date).filter(DailyCheckin.user_id == user.id).all()}
        journal_days = {r[0] for r in db.query(VoiceJournal.date).filter(VoiceJournal.user_id == user.id).all()}
        ctx["days_active"] = len(checkin_days | journal_days)
    except Exception as e:
        logger.warning(f"[Feedback] context capture failed (non-fatal): {e}")
    return ctx


def _optional_user(request: Request, db: DBSession) -> Optional[User]:
    """The signed-in user when a valid bearer token is present, else None.

    Feedback is open to visitors who never signed up, so a missing or stale
    token is not an error here — it only makes the submission anonymous.
    """
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    payload = decode_access_token(auth[7:].strip())
    user_id = (payload or {}).get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id).first()


def _require_feedback_admin(token: Optional[str]) -> None:
    """The inbox is read through a passphrase, never a user account."""
    expected = (os.environ.get("FEEDBACK_ADMIN_TOKEN") or os.environ.get("INTERNAL_ADMIN_TOKEN") or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Feedback inbox disabled: FEEDBACK_ADMIN_TOKEN is not configured.",
        )
    if not token or not secrets.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


@app.post("/feedback", tags=["feedback"])
async def submit_feedback(req: FeedbackRequest, request: Request, db: DBSession = Depends(get_db)):
    """Store one feedback-form submission, signed in or anonymous."""
    from datetime import datetime as _dt

    user = _optional_user(request, db)
    _enforce_rate_limit("feedback", request, identity=user.id if user else None)

    kind = req.kind if req.kind in FEEDBACK_FORMS else "full"
    if kind == "task_email":
        raise HTTPException(status_code=400, detail="Task ratings come from the email link.")
    # The moment-specific forms only make sense for someone using the app.
    if kind != "full" and not user:
        raise HTTPException(status_code=401, detail="Sign in to answer this one.")

    answers: Dict[str, Any] = {}
    rating: Optional[int] = None
    if kind == "full" and not req.answers and req.rating is not None:
        # An older client: stars + chips. Kept so nothing it sends is lost.
        try:
            rating = int(req.rating)
        except (TypeError, ValueError):
            rating = 0
        if not 1 <= rating <= 5:
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")
    else:
        answers = _clean_answers(kind, req.answers or {})

    trigger = req.trigger if req.trigger in FEEDBACK_TRIGGERS else "side_tab"
    liked = [c for c in dict.fromkeys(req.liked or []) if c in FEEDBACK_CHIPS]
    confusing = [c for c in dict.fromkeys(req.confusing or []) if c in FEEDBACK_CHIPS]
    comment = (req.comment or "").strip()[:1000] or None
    # A signed-in user is reachable through the account; only visitors need to leave an address.
    email = None if user else ((req.email or "").strip()[:160] or None)
    page = (req.page or "").strip()[:200] or None
    device = (request.headers.get("user-agent") or "").strip()[:200] or None

    sequence_no = None
    account_age_days = None
    if user:
        sequence_no = db.query(UserFeedback).filter(UserFeedback.user_id == user.id).count() + 1
        if user.created_at:
            account_age_days = max(0, (_dt.utcnow() - user.created_at).days)
    ctx = _feedback_context(db, user, req.session_id)

    row = UserFeedback(
        user_id=user.id if user else None,
        sequence_no=sequence_no,
        kind=kind,
        rating=rating,
        answers=json.dumps(answers) if answers else None,
        liked=json.dumps(liked),
        confusing=json.dumps(confusing),
        comment=comment,
        contact_ok=bool(req.contact_ok),
        email=email,
        trigger=trigger,
        page=page,
        device=device,
        account_age_days=account_age_days,
        **ctx,
    )
    db.add(row)
    db.commit()
    logger.info(
        f"[Feedback] kind={kind} trigger={trigger} seq={sequence_no} "
        f"{'user' if user else 'anonymous'} page={page} week={ctx.get('week_number')}"
    )
    return {"status": "ok", "id": row.id, "sequence_no": sequence_no}


@app.get("/feedback/email", response_class=HTMLResponse, tags=["feedback"])
async def feedback_from_email(token: str, clear: str, db: DBSession = Depends(get_db)):
    """👍/👎 on today's task straight from the morning email — no login.

    The signed token (user + date + action 'task_rating', 48h) is the
    authorisation, exactly like the one-tap Done link. One answer per day:
    tapping again just updates it."""
    from datetime import datetime as _dt

    data = verify_email_action_token(token, "task_rating")
    if not data:
        return HTMLResponse(
            _email_checkin_page("This link has expired", "Rating links live for 48 hours. Thanks for trying — tomorrow's email will have a fresh one.", accent="#f87171"),
            status_code=400,
        )
    if clear not in ("yes", "no"):
        return HTMLResponse(_email_checkin_page("Hmm", "That link is incomplete.", accent="#f87171"), status_code=400)
    user_id, date_iso = data["sub"], data["d"]
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return HTMLResponse(_email_checkin_page("Account not found", "This link doesn't match an active account.", accent="#f87171"), status_code=404)

    existing = (
        db.query(UserFeedback)
        .filter(UserFeedback.user_id == user_id, UserFeedback.kind == "task_email", UserFeedback.page == f"email:{date_iso}")
        .first()
    )
    answers = {"clear": clear, "date": date_iso}
    if existing:
        existing.answers = json.dumps(answers)
    else:
        ctx = _feedback_context(db, user, None)
        db.add(UserFeedback(
            user_id=user_id,
            sequence_no=db.query(UserFeedback).filter(UserFeedback.user_id == user_id).count() + 1,
            kind="task_email",
            answers=json.dumps(answers),
            liked="[]", confusing="[]",
            trigger="task_email",
            page=f"email:{date_iso}",
            device="email",
            account_age_days=max(0, (_dt.utcnow() - user.created_at).days) if user.created_at else None,
            **ctx,
        ))
    db.commit()
    if clear == "yes":
        return HTMLResponse(_email_checkin_page("Thanks — noted 👍", "Good to know today's task read clearly. Go do it.", accent="#22c55e"))
    return HTMLResponse(_email_checkin_page(
        "Thanks — noted 👎",
        f"Sorry today's task wasn't clear. Open the app and tap <strong>How do I do this?</strong> for a step-by-step guide, or ask your mentor. "
        f"<a href='{os.getenv('APP_URL', 'https://feelivate.com')}/app' style='color:#111'>Open Feelivate →</a>",
        accent="#f59e0b",
    ))


@app.get("/feedback/me", tags=["feedback"])
def my_feedback_status(current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """How often this account has already given feedback.

    The client uses it to decide whether the one-time prompt is still due, so
    the decision survives a new browser or a cleared cache.
    """
    rows = (
        db.query(UserFeedback)
        .filter(UserFeedback.user_id == current_user.id)
        .order_by(UserFeedback.created_at.desc())
        .all()
    )
    return {"count": len(rows), "last_at": rows[0].created_at.isoformat() if rows else None}


def _feedback_items(db: DBSession, rows: List[UserFeedback]) -> List[Dict[str, Any]]:
    user_ids = {r.user_id for r in rows if r.user_id}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    def _chips(raw: Optional[str]) -> List[str]:
        try:
            value = json.loads(raw or "[]")
        except (TypeError, ValueError):
            return []
        return [str(v) for v in value] if isinstance(value, list) else []

    def _answers(raw: Optional[str]) -> Dict[str, Any]:
        try:
            value = json.loads(raw or "{}")
        except (TypeError, ValueError):
            return {}
        return value if isinstance(value, dict) else {}

    items = []
    for r in rows:
        u = users.get(r.user_id)
        answers = _answers(r.answers)
        # Legacy stars+chips rows read like a "full" form so the inbox is one list.
        if not answers and r.rating:
            answers = {"legacy_rating": r.rating, "liked_most": None}
        items.append({
            "id": r.id,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "user_id": r.user_id,
            "user_email": u.email if u else None,
            "user_name": u.name if u else None,
            "sequence_no": r.sequence_no,
            "kind": r.kind or "full",
            "answers": answers,
            "rating": r.rating,
            "trigger": r.trigger,
            "page": r.page,
            "liked": _chips(r.liked),
            "confusing": _chips(r.confusing) or (answers.get("confusing") if isinstance(answers.get("confusing"), list) else []),
            "comment": r.comment,
            "contact_ok": bool(r.contact_ok),
            "email": r.email,
            "account_age_days": r.account_age_days,
            "device": r.device,
            "session_id": r.session_id,
            "goal": r.goal,
            "week_number": r.week_number,
            "plan_day": r.plan_day,
            "current_streak": r.current_streak,
            "days_active": r.days_active,
        })
    return items


def _feedback_stats(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    from collections import Counter
    from datetime import datetime as _dt, timedelta as _td

    week_ago = (_dt.utcnow() - _td(days=7)).isoformat()
    full = [i for i in items if i["kind"] == "full"]
    upset = Counter(i["answers"].get("upset") for i in full if i["answers"].get("upset"))
    liked_most = Counter(i["answers"].get("liked_most") for i in full if i["answers"].get("liked_most"))
    confusing = Counter(c for i in full for c in (i["answers"].get("confusing") or i["confusing"] or []))
    plan_fit = Counter(i["answers"].get("fit") for i in items if i["kind"] == "plan_fit" and i["answers"].get("fit"))
    task_quality = Counter(i["answers"].get("quality") for i in items if i["kind"] == "task_day" and i["answers"].get("quality"))
    task_clear = Counter(i["answers"].get("clear") for i in items if i["kind"] == "task_email" and i["answers"].get("clear"))
    tweak_reasons = Counter(i["answers"].get("reason") for i in items if i["kind"] == "tweaks" and i["answers"].get("reason"))
    kinds = Counter(i["kind"] for i in items)
    triggers = Counter(i["trigger"] for i in items)
    legacy = [int(i["rating"]) for i in items if i.get("rating")]
    total = len(items)
    return {
        "total": total,
        "kinds": dict(kinds.most_common()),
        "upset": {k: upset.get(k, 0) for k in ("very", "a_bit", "not_really")},
        "liked_most": dict(liked_most.most_common()),
        "confusing": dict(confusing.most_common()),
        "plan_fit": {k: plan_fit.get(k, 0) for k in ("too_hard", "about_right", "too_easy")},
        "task_quality": {k: task_quality.get(k, 0) for k in ("great", "fine", "off", "didnt_fit")},
        "task_clear": {k: task_clear.get(k, 0) for k in ("yes", "no")},
        "tweak_reasons": dict(tweak_reasons.most_common()),
        "broke_reports": sum(1 for i in full if i["answers"].get("broke")),
        "quit_notes": sum(1 for i in full if i["answers"].get("quit_reason")),
        "triggers": dict(triggers.most_common()),
        "last_7_days": sum(1 for i in items if (i["created_at"] or "") >= week_ago),
        "unique_users": len({i["user_id"] for i in items if i["user_id"]}),
        "anonymous": sum(1 for i in items if not i["user_id"]),
        "want_contact": sum(1 for i in items if i["contact_ok"]),
        # Older stars-and-chips rows, kept visible until they age out.
        "legacy_average_rating": round(sum(legacy) / len(legacy), 2) if legacy else None,
        "legacy_count": len(legacy),
    }


def _product_metrics(db: DBSession) -> Dict[str, Any]:
    """What people actually did — the numbers to trust before any form.

    Over accounts created in the last 30 days: did they build a plan (day-1
    activation), lock one, come back on day 3, still show up in week 2; and
    across all locked weeks, how many plan days were marked done."""
    from datetime import datetime as _dt, timedelta as _td

    since = _dt.utcnow() - _td(days=30)
    users = db.query(User).filter(User.created_at >= since).all()
    cohort = [u for u in users if not (u.email or "").endswith("@example.com")]
    ids = [u.id for u in cohort]
    if not ids:
        # Same shape as a populated answer, so the inbox never has to special-case it.
        return {
            "cohort_days": 30, "signups": 0,
            "built_plan": 0, "built_plan_pct": None, "locked_plan": 0, "locked_plan_pct": None,
            "day3_eligible": 0, "back_on_day3": 0, "day3_pct": None,
            "week2_eligible": 0, "active_week2": 0, "week2_pct": None,
            "plan_days_elapsed": 0, "days_done": 0, "completion_pct": None,
        }

    sessions = db.query(Session).filter(Session.user_id.in_(ids)).all()
    by_user: Dict[str, List[Session]] = {}
    for s in sessions:
        by_user.setdefault(s.user_id, []).append(s)
    checkins = db.query(DailyCheckin).filter(DailyCheckin.user_id.in_(ids)).all()
    journals = db.query(VoiceJournal).filter(VoiceJournal.user_id.in_(ids)).all()
    active_days: Dict[str, set] = {}
    for c in checkins:
        active_days.setdefault(c.user_id, set()).add(c.date)
    for j in journals:
        active_days.setdefault(j.user_id, set()).add(j.date)

    def _day_offset(u: User, iso: str) -> int:
        try:
            return (date.fromisoformat(iso) - u.created_at.date()).days
        except Exception:
            return -1

    built = sum(1 for u in cohort if any(s.week_plan_json for s in by_user.get(u.id, [])))
    locked = sum(1 for u in cohort if any(s.plan_start_date for s in by_user.get(u.id, [])))
    old_enough_3 = [u for u in cohort if (_dt.utcnow() - u.created_at).days >= 3]
    back_day3 = sum(1 for u in old_enough_3 if any(_day_offset(u, d) >= 2 for d in active_days.get(u.id, set())))
    old_enough_8 = [u for u in cohort if (_dt.utcnow() - u.created_at).days >= 8]
    week2 = sum(1 for u in old_enough_8 if any(_day_offset(u, d) >= 7 for d in active_days.get(u.id, set())))

    done = sum(1 for c in checkins if c.status == "done")
    plan_days = 0
    today_iso = _dt.utcnow().date().isoformat()
    for s in sessions:
        if not s.plan_start_date:
            continue
        try:
            for p in json.loads(s.result_json or "[]"):
                start = p.get("start_date")
                if not start:
                    continue
                for i, _d in enumerate(p.get("days", [])):
                    day_iso = (date.fromisoformat(start) + _td(days=i)).isoformat()
                    if day_iso <= today_iso:
                        plan_days += 1
        except Exception:
            continue

    pct = lambda n, d: round(100 * n / d) if d else None  # noqa: E731
    return {
        "cohort_days": 30,
        "signups": len(cohort),
        "built_plan": built, "built_plan_pct": pct(built, len(cohort)),
        "locked_plan": locked, "locked_plan_pct": pct(locked, len(cohort)),
        "day3_eligible": len(old_enough_3), "back_on_day3": back_day3, "day3_pct": pct(back_day3, len(old_enough_3)),
        "week2_eligible": len(old_enough_8), "active_week2": week2, "week2_pct": pct(week2, len(old_enough_8)),
        "plan_days_elapsed": plan_days, "days_done": done, "completion_pct": pct(done, plan_days),
    }


@app.get("/admin/feedback", tags=["admin"])
def list_feedback(
    trigger: Optional[str] = None,
    kind: Optional[str] = None,
    min_rating: Optional[int] = None,
    limit: int = 200,
    offset: int = 0,
    x_internal_token: Optional[str] = Header(None),
    db: DBSession = Depends(get_db),
):
    """The feedback inbox: newest first, with totals over everything received."""
    _require_feedback_admin(x_internal_token)
    limit = max(1, min(int(limit), 1000))
    offset = max(0, int(offset))

    q = db.query(UserFeedback)
    if trigger:
        q = q.filter(UserFeedback.trigger == trigger)
    if kind:
        q = q.filter(UserFeedback.kind == kind)
    if min_rating:
        q = q.filter(UserFeedback.rating >= int(min_rating))
    total = q.count()
    rows = q.order_by(UserFeedback.created_at.desc(), UserFeedback.id.desc()).offset(offset).limit(limit).all()

    everything = db.query(UserFeedback).order_by(UserFeedback.created_at.desc()).limit(5000).all()
    try:
        metrics = _product_metrics(db)
    except Exception as e:
        logger.warning(f"[Feedback] metrics failed (non-fatal): {e}")
        metrics = {"error": "unavailable"}
    return {
        "total": total,
        "stats": _feedback_stats(_feedback_items(db, everything)),
        "metrics": metrics,
        "items": _feedback_items(db, rows),
    }


@app.get("/admin/feedback.csv", tags=["admin"])
def feedback_csv(x_internal_token: Optional[str] = Header(None), db: DBSession = Depends(get_db)):
    """Every submission as a spreadsheet, oldest first."""
    _require_feedback_admin(x_internal_token)
    import csv
    import io

    rows = db.query(UserFeedback).order_by(UserFeedback.created_at.asc(), UserFeedback.id.asc()).all()
    items = _feedback_items(db, rows)
    fields = [
        "id", "created_at", "user_email", "user_name", "user_id", "sequence_no", "kind", "trigger", "answers",
        "rating", "page", "liked", "confusing", "comment", "contact_ok", "email", "account_age_days", "device",
        "goal", "week_number", "plan_day", "current_streak", "days_active",
    ]
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    for item in items:
        writer.writerow({
            k: (", ".join(v) if isinstance(v, list) else json.dumps(v, ensure_ascii=False) if isinstance(v, dict) else v)
            for k, v in item.items()
        })
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=feelivate-feedback.csv",
            "Cache-Control": "no-store",
        },
    )


# ============================================================
# BLOG (see app/blog.py)
# ============================================================

from .blog import router as _blog_router

app.include_router(_blog_router)


@app.get("/health", tags=["observability"])
def health(db: DBSession = Depends(get_db)):
    """Liveness for the platform's health check: the process is up AND the
    database answers. A bare port check keeps routing traffic to an API whose
    DB is unreachable or whose pool is exhausted; this returns 503 instead so
    the platform can restart or stop routing to it.
    """
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ok"}


@app.get("/metrics", tags=["observability"])
def metrics(x_internal_token: Optional[str] = Header(None)):
    expected_token = os.environ.get("INTERNAL_METRICS_TOKEN")
    if expected_token and x_internal_token != expected_token:
        raise HTTPException(status_code=403, detail="Forbidden")
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# NOTE: Removed a duplicate, unauthenticated POST /transcribe route here.
# It was shadowed by the authenticated /transcribe defined earlier and it
# leaked raw error text (provider/model details) to the client.
