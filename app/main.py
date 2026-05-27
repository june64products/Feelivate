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
from .models import User, Session, ChatMessage, RoadmapTask, EmotionalState
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


# ============================================================
# CORE: THE ONE CHAT ENDPOINT
# ============================================================

def _parse_llm_response(raw_text: str) -> Dict[str, Any]:
    """Parse LLM response into {reply, plan} format."""
    # Strip thinking blocks
    raw_text = re.sub(r'<think>.*?</think>', '', raw_text, flags=re.DOTALL)
    
    # Try to parse as JSON first
    try:
        # Find JSON object
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            json_str = raw_text[start:end + 1]
            # Strip markdown fences
            json_str = re.sub(r'```(?:json)?\s*', '', json_str)
            json_str = json_str.replace('```', '').strip()
            data = json.loads(json_str)
            
            if "reply" in data:
                return {
                    "reply": data.get("reply", ""),
                    "plan": data.get("plan", None)
                }
    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"JSON parse failed, treating as plain text: {e}")
    
    # Fallback: treat entire response as plain text reply
    # Strip any JSON artifacts
    clean_text = raw_text.strip()
    if clean_text.startswith("{"):
        # Tried and failed to parse — extract just readable text
        clean_text = re.sub(r'[{}"\[\]]', '', clean_text)
    
    return {"reply": clean_text, "plan": None}


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
    from .llm import call_llm_chat, create_embedding
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
        
        # 3. Build system context (active plan info if any)
        system_context = None
        if session_rec.week_plan_json:
            system_context = f"ACTIVE PLAN (Week {session_rec.current_week}):\n{session_rec.week_plan_json}"
        
        # 4. Retrieve relevant memories from Qdrant
        retrieved_memories = []
        embedding = None
        try:
            embedding = await asyncio.to_thread(create_embedding, message)
            if embedding:
                hits = await asyncio.to_thread(
                    vector_store.search_memories, user_id, embedding, 3
                )
                retrieved_memories = [h["text"] for h in hits]
        except Exception as e:
            logger.warning(f"Memory retrieval failed (non-fatal): {e}")
        
        if retrieved_memories:
            memory_text = "\n".join(retrieved_memories)
            if system_context:
                system_context += f"\n\nRELEVANT PAST CONTEXT:\n{memory_text}"
            else:
                system_context = f"RELEVANT PAST CONTEXT:\n{memory_text}"
        
        # 5. Build prompt and call LLM
        prompt_messages = build_chat_prompt(history, system_context)
        
        raw_response = await asyncio.to_thread(
            call_llm_chat,
            prompt_messages,
            temperature=0.85,
            max_tokens=4000,
            model_override="gpt-oss-120b",
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
        
        # 8. If plan was generated, update session
        if plan_data:
            session_rec.week_plan_json = json.dumps(plan_data)
            session_rec.current_week = plan_data.get("week_number", 1)
            session_rec.phase = "planning"
            
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
        logger.error(f"Chat failed: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "reply": "Sorry, I hit an error. Try again in a moment.",
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
# AUTH
# ============================================================

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
