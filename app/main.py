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
    status: str           # "done" | "skipped"
    note: Optional[str] = None
    session_id: Optional[str] = None

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

        # 5. Build prompt with full context and call LLM
        prompt_messages = build_chat_prompt(
            history,
            system_context,
            phase=session_rec.phase or "chat",
            plan_history=plan_history,
            current_week=session_rec.current_week or 0,
            week_reviews=week_reviews,
            week_report_data=week_report_data,
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
    db.commit()
    
    # Add a system message to the chat
    system_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=f"✅ Week {session_rec.current_week} plan approved and locked! Let's do this. How are you feeling about Day 1?"
    )
    db.add(system_msg)
    db.commit()
    
    return {
        "status": "approved",
        "week": session_rec.current_week,
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
    
    return {
        "id": session.id,
        "created_at": session.created_at,
        "focus": session.focus,
        "current_week": session.current_week,
        "phase": session.phase,
        "plan": plan,
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
# STREAK & DAILY CHECK-IN
# ============================================================

def _recalculate_streak(db: DBSession, user_id: str) -> UserStreak:
    """
    Recalculate current and longest streak from daily_checkins.
    Called after every checkin mutation. O(n) but checkins are small.
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

    today = date.today().isoformat()
    yesterday = (date.today() - timedelta(days=1)).isoformat()

    # Current streak: consecutive days ending today or yesterday
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

    # Longest streak: scan all done dates
    longest = 0
    run = 0
    prev_date = None
    for d in sorted(done_dates):
        if prev_date is None:
            run = 1
        else:
            delta = (date.fromisoformat(d) - date.fromisoformat(prev_date)).days
            run = run + 1 if delta == 1 else 1
        longest = max(longest, run)
        prev_date = d

    # Upsert UserStreak
    streak_rec = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if not streak_rec:
        streak_rec = UserStreak(user_id=user_id)
        db.add(streak_rec)
    streak_rec.current_streak = current
    streak_rec.longest_streak = max(longest, streak_rec.longest_streak)
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
    Returns updated streak.
    """
    from datetime import date
    today = date.today().isoformat()
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

    streak = _recalculate_streak(db, user_id)
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return streak stats + last 7 days checkin statuses for the UI calendar strip."""
    from datetime import date, timedelta

    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    streak_rec = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()

    # Build last 7 days checkin map
    days = []
    for i in range(6, -1, -1):  # 6 days ago → today
        d = (date.today() - timedelta(days=i)).isoformat()
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a voice note → transcribe (Groq Whisper) → analyze emotion (LLM) → save.
    One entry per day; calling again on same day updates the existing entry.
    """
    from .llm import call_groq_transcribe
    from datetime import date

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    filename = audio.filename or "recording.webm"
    today = date.today().isoformat()
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

    # 3. Upsert journal entry for today
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
    else:
        entry = VoiceJournal(
            user_id=user_id,
            date=today,
            transcript=transcript,
            emotion_label=emotion["label"],
            emotion_score=emotion["score"],
            one_liner=emotion["one_liner"],
        )
        db.add(entry)
    db.commit()

    return {
        "date": today,
        "transcript": transcript,
        "emotion_label": emotion["label"],
        "emotion_score": emotion["score"],
        "one_liner": emotion["one_liner"],
    }


@app.get("/journal/{user_id}", tags=["journal"])
async def get_journals(
    user_id: str,
    limit: int = 30,
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch all voice journal entries for the user (newest first). Max 30 by default."""
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    entries = (
        db.query(VoiceJournal)
        .filter(VoiceJournal.user_id == user_id)
        .order_by(VoiceJournal.date.desc())
        .limit(limit)
        .all()
    )
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return today's voice journal entry if it exists. Used by the chat-side emotion orb.
    Returns null if no entry recorded today.
    """
    from datetime import date
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    today = date.today().isoformat()
    entry = (
        db.query(VoiceJournal)
        .filter(VoiceJournal.user_id == user_id, VoiceJournal.date == today)
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
    db: DBSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return (or generate) the weekly emotion report for the current week.
    If session_id provided, report also analyses the week plan vs actual performance.
    Acts as a deep week reviewer — reads all transcripts + plan + checkins.
    Report is cached per week and regenerated only when new journals arrive.
    """
    from .llm import call_llm
    from datetime import date, timedelta

    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Forbidden")

    today = date.today()
    week_start = today - timedelta(days=today.weekday())  # Monday
    week_end   = week_start + timedelta(days=6)            # Sunday
    ws = week_start.isoformat()
    we = week_end.isoformat()

    # ── 1. Fetch this week's voice journals ──────────────────────────────────
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
        return {"status": "no_data", "message": "No journal entries this week yet.", "week_start": ws, "week_end": we}

    # ── 2. Check cache (invalidate if new journals exist since last gen) ─────
    cached = (
        db.query(WeeklyReport)
        .filter(WeeklyReport.user_id == user_id, WeeklyReport.week_start == ws)
        .first()
    )
    if cached:
        try:
            cached_data = json.loads(cached.report_json)
            if cached_data.get("entry_count") == len(journals):
                return {"status": "cached", "week_start": ws, "week_end": we, "report": cached_data}
        except Exception:
            pass

    # ── 3. Fetch daily checkins for this week ────────────────────────────────
    all_week_days = [(week_start + timedelta(days=i)).isoformat() for i in range(7)]
    checkin_map: dict = {}
    for d in all_week_days:
        row = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user_id, DailyCheckin.date == d)
            .first()
        )
        checkin_map[d] = row.status if row else ("pending" if d > today.isoformat() else "missed")

    # ── 4. Optionally fetch the approved week plan ───────────────────────────
    week_plan_days: list = []
    week_plan_theme = ""
    week_number = 0
    if session_id:
        session_rec = db.query(Session).filter(Session.id == session_id).first()
        if session_rec and session_rec.week_plan_json:
            try:
                plan = json.loads(session_rec.week_plan_json)
                week_plan_days = plan.get("days", [])
                week_plan_theme = plan.get("theme", "")
                week_number = plan.get("week_number", 0)
            except Exception:
                pass

    # ── 5. Build the per-day data merge ─────────────────────────────────────
    journal_by_date = {j.date: j for j in journals}
    avg_score = round(sum(j.emotion_score or 5 for j in journals) / len(journals), 1)
    days_done = sum(1 for s in checkin_map.values() if s == "done")
    days_missed = sum(1 for d, s in checkin_map.items() if s == "missed" and d <= today.isoformat())
    past_days_count = sum(1 for d in all_week_days if d <= today.isoformat())
    consistency_score = round((days_done / max(past_days_count, 1)) * 100) if past_days_count > 0 else 0

    # ── 6. Build rich AI prompt ───────────────────────────────────────────────
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
        for pd in week_plan_days[:7]:
            day_label = pd.get("day", "")
            task = pd.get("action", "")
            # Try to find the date for this plan day
            day_status = "unknown"
            for d, s in checkin_map.items():
                lines.append(f"  Planned: '{task[:100]}' | Checkin: {s}")
                break
            else:
                lines.append(f"  Planned: '{task[:100]}' | Checkin: {day_status}")
        plan_vs_actual = "\nWEEK PLAN vs ACTUAL:\n" + "\n".join(lines)

    prompt = f"""You are a world-class performance coach and behavioral analyst. Your job is to write a deep, honest, insightful WEEK REVIEW for this user.

You have access to:
- All their daily voice journal entries this week (what they actually felt and said)
- Their daily checkin status (did they complete their plan each day)
- Their week's planned tasks (what they were supposed to do)

Be direct, specific, and honest. This is NOT a therapy session — it's a performance review. Call out exactly where consistency broke, what patterns emerged, and what needs to change next week.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEK DATA: {ws} to {we} (Week {week_number or 'N'})
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
  "next_week_plan_context": "2-3 bullet points of what the next week plan should account for, based on this week's performance. Format: bullet per line with \\n separator."
}}"""

    try:
        raw = await asyncio.to_thread(call_llm, prompt, temperature=0.4, max_tokens=900)
        raw = re.sub(r'```(?:json)?\s*', '', raw).replace('```', '').strip()
        start_idx = raw.find("{")
        end_idx = raw.rfind("}")
        ai_data = json.loads(raw[start_idx:end_idx + 1]) if start_idx != -1 else {}
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
        "week_number": week_number,
        "week_theme": week_plan_theme,
        # Per-day data for charts
        "days": [
            {
                "date": d,
                "emotion": journal_by_date[d].emotion_label if d in journal_by_date else None,
                "score": journal_by_date[d].emotion_score if d in journal_by_date else None,
                "one_liner": journal_by_date[d].one_liner if d in journal_by_date else None,
                "checkin": checkin_map.get(d, "pending"),
                "has_journal": d in journal_by_date,
            }
            for d in all_week_days
        ],
    }

    # ── 8. Cache the report ───────────────────────────────────────────────────
    if cached:
        cached.report_json = json.dumps(report_data)
    else:
        db.add(WeeklyReport(
            user_id=user_id,
            week_start=ws,
            week_end=we,
            report_json=json.dumps(report_data),
        ))
    db.commit()

    return {"status": "generated", "week_start": ws, "week_end": we, "report": report_data}


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
