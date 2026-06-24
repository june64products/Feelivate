"""
FastAPI app v3.0 — Single Smart Chat Endpoint.
Clean ChatGPT-style architecture: one /chat endpoint that handles everything.
"""

import json
import os
import re
import uuid
import asyncio
import io
from typing import Any, Dict, Optional, List, Union

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks, UploadFile, File
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
from .email_service import generate_otp, send_verification_email, send_daily_task_email, run_daily_email_scheduler
from .security import get_password_hash, verify_password, create_access_token, decode_access_token
from .observability import REQUESTS_TOTAL

load_dotenv()

from contextlib import asynccontextmanager

# ── APScheduler (optional — server starts even if not installed) ─────────────
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    _scheduler = BackgroundScheduler(timezone="Asia/Kolkata")
    _SCHEDULER_AVAILABLE = True
except ImportError:
    _scheduler = None
    _SCHEDULER_AVAILABLE = False
    logger.warning("[Scheduler] APScheduler not installed — daily emails disabled. Install it via: pip install APScheduler pytz")

@asynccontextmanager
async def lifespan(app):
    """Start scheduler on startup, stop on shutdown."""
    if _SCHEDULER_AVAILABLE and _scheduler:
        _scheduler.add_job(
            run_daily_email_scheduler,
            trigger="cron",
            minute="*",   # every minute — checks if any user's preferred time matches
            id="daily_email_scheduler",
            replace_existing=True,
        )
        _scheduler.start()
        logger.info("[Scheduler] APScheduler started — checking every minute for daily emails")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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


@app.on_event("startup")
def on_startup():
    try:
        init_db()
        logger.info("Application startup: DB initialization done.")
    except Exception as e:
        logger.error(f"CRITICAL: Database initialization failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())


@app.post("/admin/migrate", tags=["admin"])
def run_migrations_endpoint():
    """
    Emergency endpoint: run DB migrations manually.
    Safe to call multiple times — all statements use IF NOT EXISTS.
    """
    try:
        from .database import init_db as _init_db
        _init_db()
        return {"status": "ok", "message": "Migrations complete."}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "trace": traceback.format_exc()}


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    REQUESTS_TOTAL.labels(route=str(request.url.path), method=request.method, status="500").inc()
    logger.exception("unhandled_exception")
    return JSONResponse(status_code=500, content={"error": str(exc)})


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


@app.post("/chat", tags=["chat"])
async def chat(
    payload: ChatRequest, 
    db: DBSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
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
    
    logger.info(f"Chat request from user {user_id}, session {session_id}")
    
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
            current_wk = session_rec.current_week or 1

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
                ws_cur, we_cur, _ = _week_bounds_for(session_rec, session_rec.current_week or 1)
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
            logger.info(f"Casual message '{message}' triggered plan — suppressing plan_data")
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

                # Determine the plan's true start date + day-count.
                #   • First plan (no stamped start yet) → starts TODAY (the lock day),
                #     running today → this Sunday.
                #   • Later weeks → start on their computed Monday block (week 2+) or
                #     stamped start, via the session's week-bounds helper.
                _plan_week = plan_data.get("week_number", 0)
                _start_date = _gen_today
                _max_days = 7 - _gen_today.weekday()  # today → upcoming Sunday (inclusive)
                if session_rec.plan_start_date:
                    try:
                        _ws, _we, _dc = _week_bounds_for(session_rec, _plan_week)
                        _start_date = _dt2.date.fromisoformat(_ws)
                        _max_days = _dc
                    except Exception as _be:
                        logger.warning(f"week-bounds lookup failed, using today: {_be}")

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
        
        return {
            "reply": reply_text,
            "plan": plan_data,
            "session_id": session_id
        }
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Chat failed: {str(e)}")
        logger.error(tb)
        # Return the real error in development so it's debuggable;
        # in prod the generic message is fine but we expose the type.
        error_hint = type(e).__name__
        return {
            "reply": f"Sorry, I hit an error ({error_hint}). Try again in a moment.",
            "plan": None,
            "session_id": session_id
        }


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

    try:
        approved_plan = json.loads(session_rec.week_plan_json)
        # Stamp the lock date so this week starts exactly when the user locked it
        approved_plan["start_date"] = today_iso

        # Authoritative day-label fix: the lock date is the definitive start, so
        # re-stamp every day with the correct consecutive calendar date (a plan
        # locked on Wednesday must read Wed→Sun, not the model's mislabeled
        # Mon→Fri). This guarantees the locked plan's weekdays are always correct,
        # even if it was generated on a different day than it was locked.
        try:
            _ws, _we, _dc = _bounds_from_start(today_iso)
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
    # Store when the FIRST plan was approved (don't overwrite for later weeks — each
    # week's own start now lives in the plan's stamped start_date)
    if not session_rec.plan_start_date:
        session_rec.plan_start_date = today_iso
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

@app.get("/sessions/{session_id}/history", tags=["persistence"])
def get_session_history(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all chat messages for a specific session."""
    messages = db.query(ChatMessage).filter(
        ChatMessage.session_id == session_id
    ).order_by(ChatMessage.created_at.asc()).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]


@app.get("/sessions/{session_id}/tasks", tags=["persistence"])
def get_session_tasks(session_id: str, db: DBSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch all roadmap tasks for a specific session."""
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
        Session.focus,
        Session.current_week,
        Session.phase,
    ).filter(Session.user_id == user_id).order_by(Session.created_at.desc()).all()
    
    return [
        {
            "id": s.id,
            "created_at": s.created_at,
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
    current_user: User = Depends(get_current_user)
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
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")



@app.post("/signup", tags=["auth"])
async def signup(req: SignupRequest, db: DBSession = Depends(get_db)):
    """Secure signup with password hashing."""
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
    db.commit()
    
    access_token = create_access_token(data={"sub": new_user.id})
    return {
        "message": "User created", 
        "user_id": new_user.id, 
        "name": new_user.name,
        "access_token": access_token,
        "token_type": "bearer"
    }

@app.post("/login", tags=["auth"])
async def login(req: LoginRequest, db: DBSession = Depends(get_db)):
    """Secure login with JWT generation and lazy password hashing."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Lazy Migration Logic: If it doesn't look like an Argon2 hash, assume plain text
    if not user.password.startswith("$argon2"):
        if user.password == req.password:
            user.password = get_password_hash(req.password)
            db.commit()
            logger.info(f"Upgraded password for user {user.email} to hash.")
        else:
            raise HTTPException(status_code=401, detail="Invalid password")
    else:
        if not verify_password(req.password, user.password):
            raise HTTPException(status_code=401, detail="Invalid password")
        
    access_token = create_access_token(data={"sub": user.id})
    return {
        "message": "Login successful",
        "user_id": user.id,
        "name": user.name,
        "access_token": access_token,
        "token_type": "bearer"
    }


@app.get("/me", tags=["auth"])
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the authenticated user's profile — name, email, and join date."""
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
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
            user.google_refresh_token = refresh_token
        
        user.calendar_sync_enabled = 1
        db.commit()
        
        return {"status": "success", "message": "Google Calendar connected!"}
    except Exception as e:
        logger.error(f"OAuth Callback failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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
            user.google_refresh_token,
            roadmap_data,
            user_context,
            preferred_time
        )
        
        return {"message": f"Calendar sync started for Week {session.current_week}."}
    except Exception as e:
        logger.error(f"Sync trigger failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

    background_tasks.add_task(calendar_service.clear_roadmap_events, user.google_refresh_token)
    
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
    preferred_timezone: str = "Asia/Kolkata"  # IANA timezone string

class StopEmailNotificationRequest(BaseModel):
    user_id: str

class UpdateNotificationTimeRequest(BaseModel):
    user_id: str
    preferred_time: str                       # HH:MM in user's local timezone
    preferred_timezone: str = "Asia/Kolkata"  # IANA timezone string


@app.post("/notifications/email/send-otp", tags=["notifications"])
async def send_email_otp(
    payload: SendEmailOTPRequest,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User ke email par 6-digit OTP bhejta hai, DB me store karta hai."""
    from datetime import datetime, timedelta

    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """OTP verify karta hai, success par email notifications enable karta hai."""
    from datetime import datetime

    if payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

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
        user.preferred_notification_timezone = "Asia/Kolkata"
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
        "preferred_timezone": user.preferred_notification_timezone or "Asia/Kolkata",
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
        user.preferred_notification_timezone = "Asia/Kolkata"
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
    current_user: User = Depends(get_current_user),
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

def _get_week_bounds(plan_start_date_str: str, week_number: int):
    """
    Given the plan_start_date (ISO string) and a week_number (0, 1, 2, ...),
    return (week_start: str, week_end: str, day_count: int).

    Rules:
      - Day of week: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
      - If plan started Mon/Tue/Wed (weekday <= 2):
          Week 1 = plan_start_date → that Sunday
          Week 2+ = standard Mon–Sun
      - If plan started Thu/Fri/Sat/Sun (weekday >= 3):
          Week 0 = plan_start_date → that Sunday (partial)
          Week 1 = next Monday → next Sunday (full)
          Week 2+ = standard Mon–Sun after that
    """
    from datetime import date, timedelta
    plan_start = date.fromisoformat(plan_start_date_str)
    dow = plan_start.weekday()  # 0=Mon, 6=Sun

    if dow <= 2:  # Mon/Tue/Wed — direct Week 1 start
        has_week0 = False
        w1_start = plan_start
        # End of week 1 = that Sunday
        days_to_sunday = 6 - dow
        w1_end = plan_start + timedelta(days=days_to_sunday)
    else:  # Thu/Fri/Sat/Sun — Week 0 exists
        has_week0 = True
        w0_start = plan_start
        days_to_sunday = 6 - dow
        w0_end = plan_start + timedelta(days=days_to_sunday)
        # Week 1 starts next Monday
        w1_start = w0_end + timedelta(days=1)
        w1_end = w1_start + timedelta(days=6)

    if week_number == 0:
        if not has_week0:
            # No week 0 exists for Mon/Tue/Wed starters; return week 1 instead
            ws, we = w1_start, w1_end
        else:
            ws, we = w0_start, w0_end
    elif week_number == 1:
        ws, we = w1_start, w1_end
    else:
        # Week 2, 3, ... = Mon–Sun blocks starting from w1_end + 1
        offset_weeks = week_number - 1  # weeks after week 1
        next_monday = w1_end + timedelta(days=1)
        ws = next_monday + timedelta(weeks=offset_weeks - 1)
        we = ws + timedelta(days=6)

    day_count = (we - ws).days + 1
    return ws.isoformat(), we.isoformat(), day_count


def _bounds_from_start(start_date_str: str):
    """Week bounds anchored to an explicit lock date (the day the plan was approved).
    The week runs from that day through the SAME calendar week's Sunday — so a plan
    locked on Wednesday yields Wed→Sun and Mon/Tue are excluded entirely."""
    from datetime import date, timedelta
    start = date.fromisoformat(start_date_str)
    dow = start.weekday()  # 0=Mon .. 6=Sun
    end = start + timedelta(days=(6 - dow))
    return start.isoformat(), end.isoformat(), (end - start).days + 1


def _stamped_week_start(session_rec, week_number: int):
    """Return the lock date stamped into the approved plan for this week, if present."""
    # Active plan (current week_plan_json)
    if session_rec.week_plan_json:
        try:
            plan = json.loads(session_rec.week_plan_json)
            if plan.get("week_number") == week_number and plan.get("start_date"):
                return plan["start_date"]
        except Exception:
            pass
    # Approved-plan history (result_json holds a list of approved plan dicts)
    if session_rec.result_json:
        try:
            hist = json.loads(session_rec.result_json)
            if isinstance(hist, list):
                for p in hist:
                    if isinstance(p, dict) and p.get("week_number") == week_number and p.get("start_date"):
                        return p["start_date"]
        except Exception:
            pass
    return None


def _week_bounds_for(session_rec, week_number: int):
    """Week bounds for a session+week, preferring the stamped lock date so each week
    starts exactly when its plan was locked (not a forced Mon–Sun block). Falls back to
    the legacy plan_start_date computation for weeks locked before this was introduced."""
    sd = _stamped_week_start(session_rec, week_number)
    if sd:
        return _bounds_from_start(sd)
    return _get_week_bounds(session_rec.plan_start_date, week_number)


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
        # Only include weeks that have already ended — never the ongoing/current week.
        if r.week_end and r.week_end >= today_str:
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
    current_user: User = Depends(get_current_user),
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
        raise HTTPException(status_code=500, detail=f"Transcription error: {str(e)}")

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

    return {
        "date": today,
        "transcript": transcript,
        "emotion_label": emotion["label"],
        "emotion_score": emotion["score"],
        "one_liner": emotion["one_liner"],
        "recorded_today": True,
    }


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

@app.get("/metrics", tags=["observability"])
def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

@app.post("/transcribe", tags=["audio"])
async def transcribe_audio(file: UploadFile = File(...)):
    """Accepts audio file and returns transcribed text."""
    try:
        from .audio import transcriber
        content = await file.read()
        file_obj = io.BytesIO(content)
        raw_text = transcriber.transcribe(file_obj, filename=file.filename or "audio.webm")
        
        if "[Error" in raw_text:
            return JSONResponse(status_code=500, content={"error": raw_text})

        return {
            "raw_text": raw_text,
            "text": raw_text,
        }
    except Exception as e:
        logger.error(f"Audio processing failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
