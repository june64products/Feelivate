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
from .email_service import generate_otp, send_verification_email, send_daily_task_email
from .security import get_password_hash, verify_password, create_access_token, decode_access_token
from .observability import REQUESTS_TOTAL

load_dotenv()

app = FastAPI(title="Feelivate API", version="3.0.0")

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

def _parse_llm_response(raw_text: str) -> Dict[str, Any]:
    """Parse LLM response into {reply, plan} format."""
    # Strip thinking blocks
    raw_text = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
    
    # Strip markdown code fences FIRST before any JSON extraction
    # Handles: ```json\n{...}\n```, ```\n{...}\n```, etc.
    fence_stripped = re.sub(r'```(?:json)?\s*', '', raw_text)
    fence_stripped = fence_stripped.replace('```', '').strip()
    
    # Try to parse as JSON first
    for text_to_try in [fence_stripped, raw_text]:
        try:
            # Find outermost JSON object
            start = text_to_try.find("{")
            end = text_to_try.rfind("}")
            if start != -1 and end != -1 and end > start:
                json_str = text_to_try[start:end + 1].strip()
                data = json.loads(json_str)
                
                if "reply" in data:
                    return {
                        "reply": str(data.get("reply", "")),
                        "plan": data.get("plan", None)
                    }
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"JSON parse attempt failed: {e}")
            continue
    
    # Fallback: treat entire response as plain text reply
    clean_text = fence_stripped or raw_text.strip()
    # Remove leftover JSON structural characters if it looks like broken JSON
    if clean_text.startswith("{"):
        clean_text = re.sub(r'[{}"\[\]]', '', clean_text).strip()
    
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
        week_report_data = None
        if session_rec.phase == "active":
            from datetime import date, timedelta
            today_d = date.today()
            # Check current week AND previous week (report may be from last week)
            for offset in [0, -7]:
                ref = today_d + timedelta(days=offset)
                week_start = (ref - timedelta(days=ref.weekday())).isoformat()
                latest_report = (
                    db.query(WeeklyReport)
                    .filter(
                        WeeklyReport.user_id == user_id,
                        WeeklyReport.week_start == week_start,
                    )
                    .first()
                )
                if latest_report:
                    try:
                        week_report_data = json.loads(latest_report.report_json)
                    except Exception:
                        pass
                    break  # Use the most recent one found

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
        )

        
        raw_response = await asyncio.to_thread(
            call_with_fallback_chain,
            prompt_messages,
            temperature=0.85,
            max_tokens=4000,
            presence_penalty=0.4,
            frequency_penalty=0.35
        )
        
        logger.debug(f"Raw LLM response: {raw_response[:200]}...")
        
        # 6. Parse response
        parsed = _parse_llm_response(raw_response)
        reply_text = parsed["reply"]
        plan_data = parsed["plan"]
        
        # 7. Save messages to DB
        user_msg = ChatMessage(session_id=session_id, role="user", content=message)
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=reply_text)
        db.add(user_msg)
        db.add(assistant_msg)
        
        # 8. If plan was generated, update session — with lock guard
        if plan_data and isinstance(plan_data, dict):
            new_week_num = plan_data.get("week_number", 1)
            
            # LOCK GUARD: if current week is locked, only accept plans for a NEWER week
            if session_rec.phase == "active" and new_week_num <= (session_rec.current_week or 0):
                logger.warning(
                    f"Model attempted to modify locked Week {session_rec.current_week} — discarding plan."
                )
                plan_data = None  # Discard — never let the model silently overwrite a locked week
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approve the current week plan — marks it active and enables calendar sync."""
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
    
    try:
        approved_plan = json.loads(session_rec.week_plan_json)
        # Avoid duplicating the same week in history
        existing_weeks = {p.get("week_number") for p in plan_history if isinstance(p, dict)}
        if approved_plan.get("week_number") not in existing_weeks:
            plan_history.append(approved_plan)
        session_rec.result_json = json.dumps(plan_history)
    except Exception as e:
        logger.warning(f"Could not save plan to history: {e}")
    
    session_rec.phase = "active"
    # Store when plan was first approved (only for week 1 — don't overwrite for subsequent weeks)
    from datetime import date as _date
    if not session_rec.plan_start_date:
        session_rec.plan_start_date = _date.today().isoformat()
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

class StopEmailNotificationRequest(BaseModel):
    user_id: str


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
        raise HTTPException(status_code=500, detail="Email bhejne me error aaya. Please try again.")

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
        raise HTTPException(status_code=400, detail="Pehle OTP send karein.")

    # Check expiry
    if datetime.utcnow() > user.email_otp_expiry:
        raise HTTPException(status_code=400, detail="OTP expire ho gaya hai. Please dobara bhejein.")

    # Check code
    if user.email_otp_code.strip() != payload.code.strip():
        raise HTTPException(status_code=400, detail="Galat OTP code. Please check karein.")

    # Enable notifications
    user.notification_email = payload.email
    user.email_notifications_enabled = 1
    user.email_otp_code = None
    user.email_otp_expiry = None
    db.commit()

    return {
        "message": "Email verified! Daily notifications enable ho gayi hain.",
        "notification_email": payload.email,
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

    return {"message": "Email notifications band kar di gayi hain."}


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


@app.get("/sessions/{session_id}/week-info", tags=["sessions"])
async def get_week_info(
    session_id: str,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current week's date bounds and completion status for the session."""
    from datetime import date
    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec or session_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session_rec.plan_start_date:
        return {"has_plan": False, "current_week": 0}

    current_week = session_rec.current_week if session_rec.current_week is not None else 1
    ws, we, day_count = _get_week_bounds(session_rec.plan_start_date, current_week)
    # Use client's local date if provided via query param, otherwise fallback to server date
    today = date.today().isoformat()
    is_week_complete = today > we

    return {
        "has_plan": True,
        "current_week": current_week,
        "plan_start_date": session_rec.plan_start_date,
        "week_start": ws,
        "week_end": we,
        "day_count": day_count,
        "is_week_complete": is_week_complete,
        "is_completed": bool(session_rec.is_completed),
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
        start = raw.find("{")
        end = raw.rfind("}")
        report_data = json.loads(raw[start:end + 1]) if start != -1 else {}
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all weekly reports for a session, ordered by week number."""
    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec or session_rec.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    reports = (
        db.query(WeeklyReport)
        .filter(WeeklyReport.session_id == session_id)
        .order_by(WeeklyReport.week_number.asc())
        .all()
    )

    result = []
    for r in reports:
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
    prompt = (
        f"Analyze the emotional tone of this journal entry and respond with ONLY valid JSON.\n"
        f"Entry: \"{transcript[:800]}\"\n\n"
        f"Respond exactly: {{\"label\": \"one of: {', '.join(_EMOTION_LABELS)}\", "
        f"\"score\": <integer 1-10 where 10=very positive>, "
        f"\"one_liner\": \"1 sentence capturing the essence\"}}"
    )
    try:
        raw = await asyncio.to_thread(call_llm, prompt, temperature=0.2, max_tokens=120)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1:
            data = json.loads(raw[start:end + 1])
            return {
                "label": data.get("label", "neutral"),
                "score": max(1, min(10, int(data.get("score", 5)))),
                "one_liner": data.get("one_liner", ""),
            }
    except Exception as e:
        logger.warning(f"Emotion analysis failed (non-fatal): {e}")
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

    # 3. Upsert journal entry for today (one per user per day)
    existing = (
        db.query(VoiceJournal)
        .filter(VoiceJournal.user_id == user_id, VoiceJournal.date == today)
        .first()
    )
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

    # Look for any journal entry from this user for today, regardless of session
    entry = (
        db.query(VoiceJournal)
        .filter(VoiceJournal.user_id == user_id, VoiceJournal.date == today)
        .order_by(VoiceJournal.created_at.desc())
        .first()
    )
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return (or generate) the weekly emotion report.
    Session-scoped: uses plan_start_date to compute correct week bounds.
    week_number defaults to the session's current_week.
    """
    from .llm import call_llm, call_with_fallback_chain
    from datetime import date, timedelta

    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    today = date.today()

    # Determine week bounds
    session_rec = None
    if session_id:
        session_rec = db.query(Session).filter(Session.id == session_id).first()

    if session_rec and session_rec.plan_start_date:
        # Use session-scoped week bounds
        wk_num = week_number if week_number is not None else (session_rec.current_week if session_rec.current_week is not None else 1)
        ws, we, _ = _get_week_bounds(session_rec.plan_start_date, wk_num)
    else:
        # Fallback: standard Mon–Sun of current calendar week
        wk_num = week_number if week_number is not None else 1
        week_start_d = today - timedelta(days=today.weekday())
        ws = week_start_d.isoformat()
        we = (week_start_d + timedelta(days=6)).isoformat()

    # ── 1. Fetch this week's voice journals (ALL user journals in date range) ────
    # Journals are one-per-user-per-day, not session-scoped. A journal recorded
    # under any session should count for the weekly report of any session.
    journals = (
        db.query(VoiceJournal)
        .filter(
            VoiceJournal.user_id == user_id,
            VoiceJournal.date >= ws,
            VoiceJournal.date <= we,
        )
        .order_by(VoiceJournal.date.asc())
        .all()
    )

    if not journals:
        return {"status": "no_data", "message": "No journal entries this week yet.", "week_start": ws, "week_end": we, "week_number": wk_num}

    # ── 2. Check cache (session + week keyed) ──────────────────────────────────
    cache_q = db.query(WeeklyReport).filter(
        WeeklyReport.user_id == user_id,
        WeeklyReport.week_start == ws,
    )
    if session_id:
        cache_q = cache_q.filter(WeeklyReport.session_id == session_id)
    cached = cache_q.first()
    if cached:
        try:
            cached_data = json.loads(cached.report_json)
            if cached_data.get("entry_count") == len(journals):
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

    # ── 5. Build the per-day data merge ────────────────────────────────────
    journal_by_date = {j.date: j for j in journals}
    avg_score = round(sum(j.emotion_score or 5 for j in journals) / len(journals), 1)
    days_done = sum(1 for s in checkin_map.values() if s == "done")
    days_missed = sum(1 for d, s in checkin_map.items() if s == "missed" and d <= today.isoformat())
    past_days_count = sum(1 for d in all_week_days if d <= today.isoformat())
    consistency_score = round((days_done / max(past_days_count, 1)) * 100) if past_days_count > 0 else 0

    # ── 6. Build rich AI prompt ─────────────────────────────────────────
    # Full transcripts block
    transcripts_block = "\n\n".join(
        f"[{j.date}] Emotion: {j.emotion_label} ({j.emotion_score}/10)\n"
        f"Summary: {j.one_liner}\n"
        f"Full entry: {j.transcript[:600]}"
        for j in journals
    )

    # Plan vs actual comparison block
    plan_vs_actual = ""
    if week_plan_days:
        lines = []
        for idx, pd in enumerate(week_plan_days[:7]):
            day_label = pd.get("day", "")
            task = pd.get("action", "")
            if idx < len(all_week_days):
                d = all_week_days[idx]
                s = checkin_map.get(d, "pending")
                j_info = ""
                if d in journal_by_date:
                    j_info = f" | Voice Journal: {journal_by_date[d].emotion_label} ({journal_by_date[d].emotion_score}/10) - '{journal_by_date[d].one_liner}'"
                lines.append(f"  Day {idx+1} ({day_label}): Planned: '{task}' | Checkin: {s}{j_info}")
            else:
                lines.append(f"  Day {idx+1} ({day_label}): Planned: '{task}' | Checkin: pending")
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
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VOICE JOURNAL ENTRIES (what the user actually recorded):
{transcripts_block}
{plan_vs_actual}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Respond with ONLY valid JSON (no markdown, no code fences) in this EXACT schema:
{{
  "dominant_emotion": "the single most common emotional state this week",
  "emotional_arc": "2 sentences describing how their emotional state evolved across the week",
  "what_went_well": "2-3 specific things they did right — cite actual days or actions from their journals",
  "where_you_slipped": "2-3 specific breakdowns in consistency or mindset — be direct, not harsh. Cite evidence from journals.",
  "consistency_analysis": "Detailed 3-4 sentence analysis of their consistency pattern. When did they slip? Why? Was it emotional or external?",
  "hidden_insight": "One non-obvious insight you noticed about their emotional patterns that they probably haven't noticed themselves.",
  "next_week_focus": "The single most important thing they must do differently next week based on this data. Make it very specific and actionable.",
  "next_week_plan_context": "2-3 bullet points of what the next week plan should account for, based on this week's performance. Format: bullet per line with \\n separator.",
  "daily_analysis": [
    "coaching_insight for Day 1: 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 1 based on their plan vs actual log.",
    "coaching_insight for Day 2: 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 2 based on their plan vs actual log.",
    "coaching_insight for Day 3: 1-2 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 3 based on their plan vs actual log.",
    "coaching_insight for Day 4: 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 4 based on their plan vs actual log.",
    "coaching_insight for Day 5: 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 5 based on their plan vs actual log.",
    "coaching_insight for Day 6: 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 6 based on their plan vs actual log.",
    "coaching_insight for Day 7: 1-2 sentence supportive yet direct coaching insight specifically about their execution, mood, or behavior on Day 7 based on their plan vs actual log."
  ]
}}"""

    try:
        messages = [
            {"role": "system", "content": "You are a world-class performance coach and behavioral analyst. You must output raw JSON only matching the schema exactly."},
            {"role": "user", "content": prompt}
        ]
        raw = await asyncio.to_thread(call_with_fallback_chain, messages, temperature=0.4, max_tokens=2500)
        # Strip thinking blocks if generated
        raw = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        start_idx = raw.find("{")
        end_idx = raw.rfind("}")
        ai_data = json.loads(raw[start_idx:end_idx + 1]) if start_idx != -1 else {}
        
        daily_list = ai_data.get("daily_analysis", [])
        if not isinstance(daily_list, list):
            daily_list = []
        while len(daily_list) < 7:
            daily_list.append("")
    except Exception as e:
        logger.error(f"Weekly report AI generation failed: {e}")
        ai_data = {
            "dominant_emotion": journals[0].emotion_label if journals else "neutral",
            "emotional_arc": "Could not generate analysis.",
            "what_went_well": "You showed up and recorded your journey.",
            "where_you_slipped": "Analysis unavailable.",
            "consistency_analysis": f"You completed {days_done} out of {past_days_count} days.",
            "hidden_insight": "",
            "next_week_focus": "Keep showing up every day.",
            "next_week_plan_context": "",
        }
        daily_list = ["", "", "", "", "", "", ""]

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
        # Per-day data for charts and detailed breakdown
        "days": [
            {
                "date": d,
                "day_label": week_plan_days[i].get("day", f"Day {i+1}") if i < len(week_plan_days) else f"Day {i+1}",
                "planned_task": week_plan_days[i].get("action", "") if i < len(week_plan_days) else "",
                "emotion": journal_by_date[d].emotion_label if d in journal_by_date else None,
                "score": journal_by_date[d].emotion_score if d in journal_by_date else None,
                "one_liner": journal_by_date[d].one_liner if d in journal_by_date else None,
                "checkin": checkin_map.get(d, "pending"),
                "has_journal": d in journal_by_date,
                "coaching_insight": daily_list[i] if i < len(daily_list) else "",
            }
            for i, d in enumerate(all_week_days)
        ],
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
