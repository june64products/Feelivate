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
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from loguru import logger
from sqlalchemy.orm import Session as DBSession

from fastapi.security import OAuth2PasswordBearer
from .database import engine, SessionLocal, init_db, get_db
from .models import (
    User, Session, ChatMessage, RoadmapTask, EmotionalState,
    DailyCheckin, UserStreak, VoiceJournal, WeeklyReport,
)
from .calendar_service import calendar_service
from .google_login import google_login_service
from .email_service import generate_otp, send_verification_email, send_daily_task_email, run_daily_email_scheduler
from .security import get_password_hash, verify_password, create_access_token, decode_access_token
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
        logger.info("[Scheduler] APScheduler started — daily emails + nightly retention sweep")
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
                        "plan": data.get("plan", None)
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
                        "plan": data.get("plan", None)
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
                        "plan": data.get("plan", None)
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


@app.post("/chat", tags=["chat"])
async def chat(
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
            system_context = f"CURRENT WEEK {session_rec.current_week} PLAN ({phase_label}):\n{session_rec.week_plan_json}"
        
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
                hits = await asyncio.to_thread(
                    vector_store.search_memories, user_id, embedding, 5
                )
                # Filter: only include memories from THIS session
                session_memories = [
                    h["text"] for h in hits
                    if h.get("payload", {}).get("session_id") == session_id
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
        #     it should help the user with their CURRENT plan instead.
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
        )

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
        if _casual_check in _casual_set:
            chat_temperature = 0.9  # More creative for casual replies
        
        raw_response = await asyncio.to_thread(
            call_with_fallback_chain,
            prompt_messages,
            temperature=chat_temperature,
            max_tokens=4000,
            presence_penalty=0.4,
            frequency_penalty=0.35
        )
        
        logger.debug(f"Raw LLM response: {raw_response[:200]}...")
        
        # 6. Parse response
        parsed = _parse_llm_response(raw_response)
        reply_text = parsed["reply"]
        plan_data = parsed["plan"]
        
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

        # 6c. A week's plan MUST end on Sunday, and its day labels MUST match the
        #     real calendar. The model is unreliable at weekday math — it will label a
        #     Wednesday start as "(MON)" and build a Mon–Fri plan. So we (1) figure out
        #     this plan's true start date + length, (2) trim anything past the end, and
        #     (3) overwrite every `day` string with the correct consecutive date.
        if plan_data and isinstance(plan_data, dict) and isinstance(plan_data.get("days"), list):
            try:
                import datetime as _dt2
                try:
                    import zoneinfo as _zi2
                    _gen_today = _dt2.datetime.now(_zi2.ZoneInfo(payload.timezone or "UTC")).date()
                except Exception:
                    _gen_today = _dt2.date.today()

                # Determine the plan's true start date + day-count, assuming the user
                # locks it now. This is only a projection — the week's real start is
                # stamped on approve, because an unlocked plan may sit for weeks. If
                # it does, approve re-trims and re-labels against the actual lock day.
                _plan_week = plan_data.get("week_number", 0)
                _proj_start = _projected_week_start(session_rec, _plan_week, _gen_today.isoformat())
                _ws, _we, _dc = _bounds_from_start(_proj_start)
                _start_date = _dt2.date.fromisoformat(_ws)
                _max_days = _dc

                # Record when this plan was built so the client can warn before a
                # long-stale plan gets locked into a brand new week. Only the build
                # date is stamped — the projected window is recomputed client-side at
                # lock time, since a plan can sit unlocked for weeks and any window
                # stored here would be stale by then.
                plan_data["generated_date"] = _gen_today.isoformat()

                _days = plan_data["days"]
                if len(_days) > _max_days:
                    logger.info(
                        f"Trimming plan from {len(_days)} to {_max_days} days "
                        f"(start {_start_date.strftime('%a %b %d')}, must end Sunday)"
                    )
                    _days = _days[:_max_days]
                    plan_data["days"] = _days

                # Re-stamp each day's label with the correct CONSECUTIVE calendar date.
                _bad_labels = []
                for _i, _day in enumerate(_days):
                    if isinstance(_day, dict):
                        _correct = (_start_date + _dt2.timedelta(days=_i)).strftime("%b %d (%a)")
                        _model_label = str(_day.get("day", "")).strip()
                        if _model_label and _model_label.lower() != _correct.lower():
                            _bad_labels.append(f"{_model_label!r}→{_correct!r}")
                        _day["day"] = _correct
                if _bad_labels:
                    logger.info(
                        f"Corrected {len(_bad_labels)} mislabeled plan day(s) "
                        f"(start = {_start_date.strftime('%a')}): {', '.join(_bad_labels)}"
                    )
            except Exception as e:
                logger.warning(f"Plan day-label normalization failed (non-fatal): {e}")

        # 7. Save messages to DB
        user_msg = ChatMessage(session_id=session_id, role="user", content=message)
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=reply_text)
        db.add(user_msg)
        db.add(assistant_msg)
        
        # 8. If plan was generated, update session — with lock guards
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
        
        response: Dict[str, Any] = {
            "reply": reply_text,
            "plan": plan_data,
            "session_id": session_id
        }
        if in_crisis:
            # Suppress any plan the model produced anyway, and hand the client a
            # structured block to render as a resource card rather than leaving
            # help buried in a paragraph.
            response["plan"] = None
            response["safety"] = crisis_payload()
        return response

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


@app.post("/chat/{session_id}/approve_plan", tags=["chat"])
async def approve_plan(
    session_id: str,
    client_date: Optional[str] = None,  # YYYY-MM-DD from user's local timezone
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve the current week plan — marks it active and enables calendar sync.
    Stamps the lock date onto the plan so this week starts exactly when the user
    locked it (a plan locked on Wednesday shows Wed→Sun, not Mon→Sun)."""
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

    # EVERY week starts the day it is locked — not the day after the previous week
    # ended. A plan generated weeks ago and locked today must run from today,
    # otherwise its whole window sits in the past and every day is marked missed
    # the moment it is locked. _projected_week_start keeps the previous week's end
    # as a floor so an early lock can't overlap it, and rolls a Sat/Sun lock
    # forward to Monday so the week is never a 1–2 day stub.
    _cur_wk = session_rec.current_week if session_rec.current_week is not None else 1
    start_iso = _projected_week_start(session_rec, _cur_wk, today_iso)

    try:
        approved_plan = json.loads(session_rec.week_plan_json)
        # Stamp the computed start so the locked week spans the right calendar dates
        approved_plan["start_date"] = start_iso

        # Authoritative day-label fix: the lock date is the definitive start, so
        # re-stamp every day with the correct consecutive calendar date (a plan
        # locked on Wednesday must read Wed→Sun, not the model's mislabeled
        # Mon→Fri). This guarantees the locked plan's weekdays are always correct,
        # even if it was generated on a different day than it was locked.
        try:
            _ws, _we, _dc = _bounds_from_start(start_iso)
            _lock_start = _date.fromisoformat(_ws)
            _ap_days = approved_plan.get("days")
            if isinstance(_ap_days, list):
                if len(_ap_days) > _dc:
                    _ap_days = _ap_days[:_dc]
                    approved_plan["days"] = _ap_days
                for _i, _d in enumerate(_ap_days):
                    if isinstance(_d, dict):
                        _d["day"] = (_lock_start + _timedelta(days=_i)).strftime("%b %d (%a)")
        except Exception as _re:
            logger.warning(f"Plan day-label re-stamp on approve failed (non-fatal): {_re}")
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
    db.commit()
    
    # Add a system message to the chat
    system_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=f"Week {session_rec.current_week} plan approved and locked! Let's go — your plan is set. You can chat with me anytime, or head to the Journey page to log your daily voice entry."
    )
    db.add(system_msg)
    db.commit()
    
    return {
        "status": "approved",
        "week": session_rec.current_week,
        "plan_start_date": session_rec.plan_start_date,
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
    """User ke email par 6-digit OTP bhejta hai, DB me store karta hai."""
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
    """OTP verify karta hai, success par email notifications enable karta hai."""
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
    """User ke email notifications disable karta hai."""
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

def _recalculate_streak(db: DBSession, user_id: str, client_date: Optional[str] = None) -> UserStreak:
    """
    Recalculate current and longest streak from daily_checkins.
    Called after every checkin mutation. O(n) but checkins are small.
    Pass client_date (YYYY-MM-DD) from the user's local timezone to avoid
    UTC vs IST mismatch when checking today/yesterday boundaries.
    """
    from datetime import date, timedelta

    # Get all 'done' checkins ordered newest first
    done_rows = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.status == "done")
        .order_by(DailyCheckin.date.desc())
        .all()
    )
    done_dates = sorted({r.date for r in done_rows}, reverse=True)

    # Use client local date if provided (avoids UTC vs IST mismatch)
    if client_date:
        try:
            today_d = date.fromisoformat(client_date)
        except ValueError:
            today_d = date.today()
    else:
        today_d = date.today()

    today = today_d.isoformat()
    yesterday = (today_d - timedelta(days=1)).isoformat()

    # Current streak: count consecutive done days ending at or before today.
    # Streak is still alive if the most recent done day is today OR yesterday
    # (user hasn't done today yet but hasn't broken the chain).
    current = 0
    if done_dates and done_dates[0] in (today, yesterday):
        expected = done_dates[0]
        for d in done_dates:
            if d == expected:
                current += 1
                prev = date.fromisoformat(expected) - timedelta(days=1)
                expected = prev.isoformat()
            else:
                break

    # Longest streak: scan all done dates ascending
    longest = 0
    run = 0
    prev_date_str = None
    for d in sorted(done_dates):
        if prev_date_str is None:
            run = 1
        else:
            delta = (date.fromisoformat(d) - date.fromisoformat(prev_date_str)).days
            run = run + 1 if delta == 1 else 1
        longest = max(longest, run)
        prev_date_str = d

    # Upsert UserStreak
    streak_rec = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if not streak_rec:
        streak_rec = UserStreak(user_id=user_id)
        db.add(streak_rec)
    streak_rec.current_streak = current
    # longest_streak should always be the historical maximum — never decrease
    streak_rec.longest_streak = max(longest, streak_rec.longest_streak or 0)
    streak_rec.total_done = len(done_dates)
    streak_rec.last_checkin = done_dates[0] if done_dates else None
    db.commit()
    db.refresh(streak_rec)
    return streak_rec


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

    # Pass client_date so streak boundary uses user's local timezone
    streak = _recalculate_streak(db, user_id, client_date=today)
    return {
        "date": today,
        "status": payload.status,
        "current_streak": streak.current_streak,
        "longest_streak": streak.longest_streak,
        "total_done": streak.total_done,
    }


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
    }


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
    _projected_week_start,
    _week_bounds_for,
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
    """
    Mark a session as complete. Generate a final aggregated report covering
    all weeks, total checkins, emotional arc, and highlights.
    """
    from datetime import date
    from .llm import call_llm

    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec or session_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    # Gather all weekly reports for this session
    weekly_reports = (
        db.query(WeeklyReport)
        .filter(WeeklyReport.session_id == session_id)
        .order_by(WeeklyReport.week_number.asc())
        .all()
    )

    # Count checkins
    checkins = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.session_id == session_id)
        .all()
    )
    done_count = sum(1 for c in checkins if c.status == "done")
    total_count = len(checkins)

    # Journals for this session
    journals = (
        db.query(VoiceJournal)
        .filter(VoiceJournal.session_id == session_id)
        .order_by(VoiceJournal.date.asc())
        .all()
    )

    # Build summary context for the AI
    weeks_summary = []
    for wr in weekly_reports:
        try:
            rd = json.loads(wr.report_json)
            weeks_summary.append({
                "week": wr.week_number,
                "start": wr.week_start,
                "end": wr.week_end,
                "consistency": rd.get("consistency_score", 0),
                "avg_score": rd.get("avg_score", 0),
                "dominant_emotion": rd.get("dominant_emotion", "neutral"),
                "what_went_well": rd.get("what_went_well", ""),
                "where_you_slipped": rd.get("where_you_slipped", ""),
            })
        except Exception:
            pass

    emotion_labels = [j.emotion_label for j in journals if j.emotion_label]
    avg_emotion_score = round(sum(j.emotion_score or 0 for j in journals) / max(len(journals), 1), 1)

    # Ask LLM to generate final session summary
    context = json.dumps({
        "total_weeks": session_rec.current_week,
        "days_done": done_count,
        "days_total": total_count,
        "avg_emotion_score": avg_emotion_score,
        "emotion_labels": emotion_labels,
        "weeks": weeks_summary,
        "focus": session_rec.focus or "",
    })

    prompt = (
        f"You are a mentor writing a final summary report for a user who has completed their transformation plan.\n"
        f"Context: {context}\n\n"
        f"Write a warm, insightful final report in JSON format:\n"
        f"{{\"headline\": \"1-line summary of their journey\","
        f" \"biggest_wins\": [\"list of 3 biggest achievements\"],"
        f" \"growth_arc\": \"2-3 sentences describing their emotional and performance arc\","
        f" \"advice_for_next_chapter\": \"1-2 sentences of forward-looking advice\","
        f" \"stats\": {{\"total_weeks\": N, \"days_done\": N, \"days_total\": N, \"avg_mood\": N}}}}"
    )

    try:
        raw = await asyncio.to_thread(call_llm, prompt, temperature=0.7, max_tokens=600)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        json_str = _extract_json_by_braces(raw)
        if not json_str:
            start = raw.find("{")
            end = raw.rfind("}")
            json_str = raw[start:end + 1] if start != -1 else "{}"
        report_data = json.loads(json_str)
    except Exception as e:
        logger.warning(f"Final report generation failed: {e}")
        report_data = {
            "headline": f"Completed {session_rec.current_week} week plan",
            "biggest_wins": ["Showed up consistently", "Built self-awareness", "Stayed committed"],
            "growth_arc": "You committed to the process and saw it through.",
            "advice_for_next_chapter": "Keep the habits you built. Start fresh with new goals.",
            "stats": {
                "total_weeks": session_rec.current_week,
                "days_done": done_count,
                "days_total": total_count,
                "avg_mood": avg_emotion_score,
            },
        }

    # Save to session
    session_rec.is_completed = 1
    session_rec.phase = "completed"
    session_rec.session_report_json = json.dumps(report_data)
    db.commit()

    return {"status": "completed", "report": report_data}


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

async def _analyze_emotion(transcript: str) -> dict:
    """
    Use LLM to detect emotion from transcript.
    Returns {label, score, one_liner}.
    """
    from .llm import call_llm

    text = (transcript or "").strip()
    if not text:
        logger.warning("[Emotion] Empty transcript — returning neutral/5")
        return {"label": "neutral", "score": 5, "one_liner": ""}

    prompt = (
        "You are an expert emotion analyst. Read the journal entry below — it may be in "
        "English, Hindi, or Hinglish — and detect how the writer actually feels.\n\n"
        f"Entry: \"{text[:800]}\"\n\n"
        "Rules:\n"
        f"- Pick the single best label from: {', '.join(_EMOTION_LABELS)}\n"
        "- Give an honest score from 1 to 10 using the FULL range:\n"
        "    1-3  = clearly negative (drained, anxious, frustrated, stressed)\n"
        "    4-6  = mixed, mild, or genuinely neutral\n"
        "    7-10 = clearly positive (motivated, excited, confident, hopeful)\n"
        "- Use 'neutral' with score 5 ONLY when the entry has NO emotional signal at all. "
        "If there is ANY emotional cue, choose the matching label with an honest score — "
        "do NOT default to neutral/5.\n"
        "- Judge how the writer feels, not the topic they talk about.\n\n"
        "Respond with ONLY valid JSON, nothing else:\n"
        "{\"label\": \"<label>\", \"score\": <integer 1-10>, \"one_liner\": \"<1 short sentence>\"}"
    )

    # Try several models in order. Using a single model_override bypasses the
    # fallback chain, so any hiccup with that one model (rate-limit, outage,
    # decommission) would silently collapse every entry to neutral/5. Trying
    # multiple models means we only fall back to neutral if ALL of them fail.
    models_to_try = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "gpt-4o-mini"]
    last_err = None
    for model in models_to_try:
        try:
            raw = await asyncio.to_thread(
                call_llm, prompt,
                temperature=0.2,
                max_tokens=150,
                model_override=model,
            )
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
        return {"status": "no_data", "message": "No journal entries this week yet.", "week_start": ws, "week_end": we, "week_number": wk_num}

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
    for d in all_week_days:
        row = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == d)
            .first()
        )
        checkin_map[d] = row.status if row else ("pending" if d > today.isoformat() else "missed")

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
    if journals:
        # Pick the one-liner from the highest-scored journal entry
        best_j = max(journals, key=lambda j: (j.emotion_score or 0))
        best_quote = best_j.one_liner or ""

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

    # ── 5f. Build cross-week pattern context for AI ──────────────────
    cross_week_context = ""
    if prev_week_reports and wk_num >= 3:
        pattern_lines = []
        for pw in prev_week_reports:
            pw_num = pw.get("week_number", "?")
            pw_dom = pw.get("dominant_emotion", "")
            pw_cs = pw.get("consistency_score", 0)
            pw_avg = pw.get("avg_score", 0)
            pw_days = pw.get("days", [])
            # Extract days with low scores
            low_days = [d.get("date", "") for d in pw_days if d.get("score") and d.get("score") <= 4]
            missed_days = [d.get("date", "") for d in pw_days if not d.get("has_journal")]
            pattern_lines.append(
                f"  Week {pw_num}: consistency={pw_cs}%, avg_mood={pw_avg}/10, "
                f"dominant={pw_dom}, low_score_dates={low_days}, missed_dates={missed_days}"
            )
        cross_week_context = "\n\nCROSS-WEEK HISTORY (for pattern detection):\n" + "\n".join(pattern_lines)

    # ── 6. Build rich AI prompt ─────────────────────────────────────────
    # Full transcripts block
    transcripts_block = "\n\n".join(
        f"[{j.date}] Emotion: {j.emotion_label} ({j.emotion_score}/10)\n"
        f"Summary: {j.one_liner}\n"
        f"Full entry: {j.transcript[:600]}"
        for j in journals
    )

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
            lines.append(f"  Day {i+1} ({day_label or d}): Planned: '{task}' | Checkin: {s}{j_info}")
        plan_vs_actual = "\nWEEK PLAN vs ACTUAL CHECK-INS & JOURNALS:\n" + "\n".join(lines)

    prompt = f"""You are a world-class performance coach and behavioral analyst. Your job is to write a deep, honest, insightful WEEK REVIEW for this user.

You have access to:
- All their daily voice journal entries this week (what they actually felt and said)
- Their daily checkin status (did they complete their plan each day)
- Their week's planned tasks (what they were supposed to do)

Be direct, specific, and honest. This is NOT a therapy session — it's a performance review. Call out exactly where consistency broke, what patterns emerged, and what needs to change next week.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEK DATA: {ws} to {we} (Week {wk_num})
Theme: {week_plan_theme or 'Personal growth'}
Days with checkin done: {days_done}/{past_days_count}
Days missed: {days_missed}
Avg emotional score: {avg_score}/10
Momentum score: {momentum_score}/100 ({momentum_label})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VOICE JOURNAL ENTRIES (what the user actually recorded):
{transcripts_block}
{plan_vs_actual}
{cross_week_context}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond with ONLY valid JSON (no markdown, no code fences) in this EXACT schema:
{{
  "dominant_emotion": "the single most common emotional state this week",
  "week_summary": {{
    "wins": "2-3 specific wins — cite actual days or actions. Keep to 2 sentences max.",
    "dips": "2-3 specific dips or consistency breaks. Be direct, cite evidence. 2 sentences max.",
    "pattern": "One key behavioral pattern you noticed this week. 1-2 sentences."
  }},
  "hidden_insight": "One non-obvious insight about their emotional patterns that they probably haven't noticed themselves.",
  "next_week_focus": "The single most important thing they must do differently next week. Very specific and actionable.",
  "next_week_plan_context": "2-3 bullet points of what the next week plan should account for. Format: bullet per line with \\n separator.",
  "week_badge": {{
    "name": "A short badge name for this week based on their pattern. Examples: 'Iron Week' (100% consistency), 'Comeback King' (started low finished high), 'Steady Climber' (mood improved each day), 'Grit Mode' (pushed through despite low mood), 'Fresh Start' (first week). Pick the most fitting one.",
    "reason": "One sentence explaining why they earned this badge."
  }},
  "best_quote": "The single most emotionally resonant or powerful sentence from the user's voice journal transcripts this week. Copy it exactly as they said it — this gets displayed as a pull-quote.",
  "actionable_coaching": [
    {{
      "observation": "Day 1: One-line observation about what happened — e.g. 'Strong start, executed setup task with high energy'",
      "micro_action": "One specific micro-action for improvement — e.g. 'Keep this momentum by setting a 9am start ritual'"
    }},
    {{
      "observation": "Day 2: One-line observation",
      "micro_action": "One specific micro-action"
    }},
    {{
      "observation": "Day 3: One-line observation",
      "micro_action": "One specific micro-action"
    }},
    {{
      "observation": "Day 4: One-line observation",
      "micro_action": "One specific micro-action"
    }},
    {{
      "observation": "Day 5: One-line observation",
      "micro_action": "One specific micro-action"
    }},
    {{
      "observation": "Day 6: One-line observation",
      "micro_action": "One specific micro-action"
    }},
    {{
      "observation": "Day 7: One-line observation",
      "micro_action": "One specific micro-action"
    }}
  ],
  "trigger_patterns": [
    {{
      "pattern": "A recurring friction or trigger detected — e.g. 'Friday mood dip', 'Cravings correlate with low scores'",
      "frequency": "How often it occurred — e.g. 'Every Friday', '3 out of 4 weeks'",
      "weeks_detected": [1, 2, 3]
    }}
  ],
  "recurring_friction": ["list", "of", "recurring", "friction", "points"],
  "best_days": ["Tue", "Sun"],
  "worst_days": ["Thu", "Fri"],
  "mood_trend": "Description of overall mood trajectory — e.g. 'high-start, mid-dip, strong-finish'"
}}

IMPORTANT NOTES:
- For "best_quote": Pick the MOST powerful, emotionally resonant line from the user's actual voice transcripts. NOT your own words.
- For "actionable_coaching": Each day MUST have both "observation" AND "micro_action". Make micro_actions specific — e.g. "Try 5-min breathing before coding" not "take a break".
- For "trigger_patterns": Only include if you detect recurring patterns. If this is Week 1 or patterns are unclear, return an empty array [].
- For "week_badge": Always generate one — even for Week 1.
- Keep "week_summary" concise — 3 short bullets, not paragraphs."""

    try:
        messages = [
            {"role": "system", "content": "You are a world-class performance coach and behavioral analyst. You must output raw JSON only matching the schema exactly. No markdown, no code fences."},
            {"role": "user", "content": prompt}
        ]
        raw = await asyncio.to_thread(call_with_fallback_chain, messages, temperature=0.4, max_tokens=4000)
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

        # Use AI best_quote if provided, otherwise fall back to server-side extraction
        if not ai_data.get("best_quote"):
            ai_data["best_quote"] = best_quote

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
            "best_quote": best_quote,
            "actionable_coaching": [{"observation": "", "micro_action": ""} for _ in range(7)],
            "trigger_patterns": [],
            "recurring_friction": [],
            "best_days": [],
            "worst_days": [],
            "mood_trend": "",
        }
        coaching_list = ai_data["actionable_coaching"]

    # ── 7. Build the final report dict ──────────────────────────────────────
    report_data = {
        **ai_data,
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
                "friction_noted": None,
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
