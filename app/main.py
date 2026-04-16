"""
FastAPI app with v2.0 Production Endpoints.
"""

import json
import os
import uuid
import threading
import asyncio
import io
from typing import Any, Dict, Optional, List

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from loguru import logger
from sqlalchemy.orm import Session as DBSession

from .database import engine, SessionLocal, init_db, get_db
from .models import User, Session, ChatMessage, RoadmapTask, EmotionalState
# from .orchestrator import orchestrate (Moved inside functions to prevent startup hang)
from .observability import REQUESTS_TOTAL
from .eval import init_eval_db  # Keeping legacy eval for now, but will migrate to Postgres

load_dotenv()

app = FastAPI(title="Emotion Time Travel API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# In-memory result store for async polling (Production: use Redis)
result_store: Dict[str, Dict[str, Any]] = {}


@app.on_event("startup")
def on_startup():
    init_db()  # Re-enabled to allow SQLite table creation on Render
    logger.info("Application startup: DB initialization done.")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    REQUESTS_TOTAL.labels(route=str(request.url.path), method=request.method, status="500").inc()
    logger.exception("unhandled_exception")
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/", tags=["health"])
def read_root():
    return {"status": "ok", "version": "v2.0-production-persistence"}

# --- Input Models ---

class IngestRequest(BaseModel):
    user_id: str
    text: str
    session_id: Optional[str] = None

class QuestionRequest(BaseModel):
    text: str
    history: Optional[str] = None

class ContradictionRequest(BaseModel):
    focus: str
    history: str

class CheckinRequest(BaseModel):
    user_id: str
    session_id: str
    status: str
    current_plan: Dict[str, Any]

class WeeklyFocusRequest(BaseModel):
    user_id: str
    session_id: str
    current_phase: str
    current_week: str

class WeekChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    week_context: Dict[str, Any]
    chat_history: List[Dict[str, str]]

class GlobalChatRequest(BaseModel):
    user_id: str
    session_id: str
    message: str
    full_roadmap: Optional[Any] = None
    chat_history: List[Dict[str, str]]

class TaskUpdate(BaseModel):
    is_completed: bool

class MessageCreate(BaseModel):
    role: str
    content: str

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

# --- Persistence Endpoints ---

@app.get("/sessions/{session_id}/history", tags=["persistence"])
def get_session_history(session_id: str, db: DBSession = Depends(get_db)):
    """Fetch all chat messages for a specific session."""
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    return [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in messages]

@app.get("/sessions/{session_id}/tasks", tags=["persistence"])
def get_session_tasks(session_id: str, db: DBSession = Depends(get_db)):
    """Fetch all roadmap tasks for a specific session."""
    tasks = db.query(RoadmapTask).filter(RoadmapTask.session_id == session_id).order_by(RoadmapTask.month.asc(), RoadmapTask.week.asc()).all()
    return tasks

@app.patch("/tasks/{task_id}", tags=["persistence"])
def update_task_status(task_id: int, payload: TaskUpdate, db: DBSession = Depends(get_db)):
    """Update the completion status of a roadmap task."""
    task = db.query(RoadmapTask).filter(RoadmapTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_completed = 1 if payload.is_completed else 0
    db.commit()
    return task

@app.post("/sessions/{session_id}/messages", tags=["persistence"])
def add_session_message(session_id: str, payload: MessageCreate, db: DBSession = Depends(get_db)):
    """Manually add a message to a session history."""
    msg = ChatMessage(session_id=session_id, role=payload.role, content=payload.content)
    db.add(msg)
    db.commit()
    return msg



# --- Endpoints ---

@app.post("/generate_questions", tags=["ingest"])
async def generate_questions(payload: QuestionRequest):
    """
    Generates 1 specific adaptive follow-up question based on the initial input and history.
    """
    from .llm import call_llm
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    
    try:
        inputs = {"focus": payload.text}
        if payload.history:
            inputs["history"] = payload.history
            
        prompt_text = build_prompt("QuestionGeneratorAgent", inputs, None)
        json_str = await asyncio.to_thread(call_llm, prompt_text, max_tokens=1000, model_override="llama-3.3-70b-versatile")
        data = _parse_json(json_str)
        
        # Fallback to empty string if LLM fails
        question = data.get("question", "")
        if not question and "questions" in data and isinstance(data["questions"], list) and len(data["questions"]) > 0:
            question = data["questions"][0] # Just in case it hallucinated the old format
            
        return {"question": question}
    except Exception as e:
        logger.exception("Failed to generate question")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/detect_contradiction", tags=["ingest"])
async def detect_contradiction(payload: ContradictionRequest):
    """
    Analyzes the user's answers for psychological contradictions before generating the blueprint.
    """
    from .llm import call_llm
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    
    try:
        inputs = {
            "focus": payload.focus,
            "history": payload.history
        }
        prompt_text = build_prompt("ContradictionDetectorAgent", inputs, None)
        json_str = await asyncio.to_thread(call_llm, prompt_text, max_tokens=1000, model_override="llama-3.3-70b-versatile")
        data = _parse_json(json_str)
        
        return {
            "has_contradiction": data.get("has_contradiction", False),
            "tension_question": data.get("tension_question", "")
        }
    except Exception as e:
        logger.exception("Failed to detect contradiction")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/checkin", tags=["ingest"])
async def submit_checkin(payload: CheckinRequest, db: DBSession = Depends(get_db)):
    """
    Dynamically recalibrates the plan based on checkin status.
    """
    from .llm import call_llm
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    
    try:
        context = {
            "status": payload.status,
            "current_plan": json.dumps(payload.current_plan)
        }
        prompt_text = build_prompt("RecalibrationAgent", {"focus": f"User status: {payload.status}\nCurrent plan: {json.dumps(payload.current_plan)}"}, context)
        json_str = await asyncio.to_thread(call_llm, prompt_text)
        recalibrated_data = _parse_json(json_str)
        
        return recalibrated_data
    except Exception as e:
        logger.exception("Failed to recalibrate plan")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/weekly_focus", tags=["planner"])
async def get_weekly_focus(payload: WeeklyFocusRequest):
    """
    Generates 3 behavioral focus areas for the current week in the 6-month plan.
    """
    from .llm import call_llm
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    
    try:
        inputs = {
            "focus": f"Phase: {payload.current_phase}, Week: {payload.current_week}"
        }
        prompt_text = build_prompt("WeeklyFocusAgent", inputs, None)
        json_str = await asyncio.to_thread(call_llm, prompt_text)
        data = _parse_json(json_str)
        return data
    except Exception as e:
        logger.exception("Failed to generate weekly focus")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat_week", tags=["planner"])
async def generate_week_chat(req: WeekChatRequest):
    """Handle chat interaction for a specific week."""
    from .llm import call_llm, create_embedding
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    from .vector_store import vector_store
    
    logger.info(f"Generating week chat for user {req.user_id}")
    try:
        # 1. Semantic Retrieval
        retrieved_memories = []
        try:
            embedding = await asyncio.to_thread(create_embedding, req.message)
            if embedding:
                hits = await asyncio.to_thread(vector_store.search_memories, req.user_id, embedding, 2)
                retrieved_memories = [h["text"] for h in hits]
        except Exception as re:
            logger.warning(f"Memory retrieval failed: {re}")

        context = {
            "Week Context": json.dumps(req.week_context),
            "Conversation History": "\n".join([f"{msg['role']}: {msg['content']}" for msg in req.chat_history[-5:]]),
            "Relevant Past Memories": "\n".join(retrieved_memories) if retrieved_memories else "None found."
        }
        inputs = {"focus": req.message}
        prompt_text = build_prompt("WeekChatAgent", inputs, context)
        
        json_str = await asyncio.to_thread(call_llm, prompt_text)
        parsed_response = _parse_json(json_str)
        
        # 2. Add message saving logic to SQL
        with SessionLocal() as db:
            # Save user message
            user_msg = ChatMessage(session_id=req.session_id, role="user", content=req.message)
            db.add(user_msg)
            # Save assistant response
            assistant_msg = ChatMessage(
                session_id=req.session_id, 
                role="assistant", 
                content=parsed_response.get("response_message", "")
            )
            db.add(assistant_msg)
            db.commit()

        # 3. Save interaction to vector store (Semantic Memory)
        try:
            memory_text = f"User asked Week Mentor: '{req.message}'. Mentor replied: '{parsed_response.get('response_message', '')}'"
            if embedding:
                await asyncio.to_thread(
                    vector_store.add_memory, 
                    req.user_id, 
                    memory_text, 
                    embedding, 
                    {"source": "chat_week", "week": req.week_context.get("week_number")}
                )
        except Exception as ve:
             logger.warning(f"Could not save chat memory to Qdrant: {ve}")
             
        return parsed_response
    except Exception as e:
        logger.exception("Week chat generation failed")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat_global", tags=["planner"])
async def generate_global_chat(req: GlobalChatRequest):
    """Handle chat interaction with the Common Mentor (Global)."""
    from .llm import call_llm, create_embedding
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    from .vector_store import vector_store
    
    logger.info(f"Generating global chat for user {req.user_id}")
    try:
        # 1. Intent Classification (Fast Routing)
        intent_prompt = build_prompt("IntentClassifierAgent", {"focus": req.message})
        intent_json = await asyncio.to_thread(call_llm, intent_prompt, model_override="gpt-4o-mini")
        intent_data = _parse_json(intent_json)
        needs_context = intent_data.get("needs_context", True) # Default to true for safety
        logger.info(f"Intent classified: needs_context={needs_context}")

        # 2. Semantic Retrieval
        retrieved_memories = []
        retrieved_roadmap = []
        embedding = None
        
        if needs_context:
            try:
                embedding = await asyncio.to_thread(create_embedding, req.message)
                if embedding:
                    # Fetch explicit roadmap chunks
                    roadmap_hits = await asyncio.to_thread(vector_store.search_memories, req.user_id, embedding, 2, {"source": "roadmap_chunk"})
                    retrieved_roadmap = [h["text"] for h in roadmap_hits]
                    
                    # Fetch past general memories
                    hits = await asyncio.to_thread(vector_store.search_memories, req.user_id, embedding, 3)
                    retrieved_memories = [h["text"] for h in hits if h.get("metadata", {}).get("source") != "roadmap_chunk"]
            except Exception as re:
                logger.warning(f"Global memory retrieval failed: {re}")

        # 3. Ensure session exists and fetch roadmap if needed
        roadmap_from_db = None
        with SessionLocal() as db_query:
            s = db_query.query(Session).filter(Session.id == req.session_id).first()
            if s:
                roadmap_from_db = s.result_json
            else:
                s = Session(id=req.session_id, user_id=req.user_id)
                db_query.add(s)
                db_query.commit()

        # 4. Construct context for the AI
        # Prefer provided roadmap, fallback to database
        effective_roadmap = req.full_roadmap if req.full_roadmap else roadmap_from_db
        
        context = {
            "Relevant Roadmap Sections (RAG)": "\n".join(retrieved_roadmap) if (needs_context and retrieved_roadmap) else json.dumps(effective_roadmap),
            "Conversation History": "\n".join([f"{msg['role']}: {msg['content']}" for msg in req.chat_history[-8:]]),
            "Long-term Context": "\n".join(retrieved_memories) if (needs_context and retrieved_memories) else "No specific past context found."
        }
        inputs = {"focus": req.message}
        prompt_text = build_prompt("GlobalMentorAgent", inputs, context)
        logger.info(f"Prompts: {prompt_text[:200]}...")
        json_str = await asyncio.to_thread(call_llm, prompt_text, model_override="gpt-4o-mini")
        logger.info(f"Raw LLM response: {json_str}")
        parsed_response = _parse_json(json_str)
        logger.info(f"Parsed response: {parsed_response}")
        
        # 2. Save messages to SQL
        with SessionLocal() as db:
            user_msg = ChatMessage(session_id=req.session_id, role="user", content=req.message)
            db.add(user_msg)
            assistant_msg = ChatMessage(
                session_id=req.session_id, 
                role="assistant", 
                content=parsed_response.get("response_message", "")
            )
            db.add(assistant_msg)
            db.commit()

        # 3. Save to Semantic Memory
        try:
            if embedding:
                memory_text = f"User asked Common Mentor: '{req.message}'. Mentor replied: '{parsed_response.get('response_message', '')}'"
                await asyncio.to_thread(
                    vector_store.add_memory, 
                    req.user_id, 
                    memory_text, 
                    embedding, 
                    {"source": "chat_global"}
                )
        except Exception as ve:
            logger.warning(f"Failed to save global chat memory: {ve}")
            
        return parsed_response
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Failed to generate global chat:\n{error_details}")
        print(f"ERROR IN CHAT_GLOBAL:\n{error_details}")
        raise HTTPException(status_code=500, detail=str(error_details))

@app.get("/sessions/{user_id}", tags=["sessions"])
async def list_sessions(user_id: str, db: DBSession = Depends(get_db)):
    # Optimized query: avoids fetching the giant result_json blob for all sessions
    sessions = db.query(
        Session.id,
        Session.created_at,
        Session.focus,
        Session.result_json.isnot(None).label('has_result')
    ).filter(Session.user_id == user_id).order_by(Session.created_at.desc()).all()
    
    return [
        {
            "id": s.id,
            "created_at": s.created_at,
            "focus_preview": s.focus[:50] + "..." if s.focus and len(s.focus) > 50 else (s.focus or "New Journey"),
            "has_result": s.has_result
        }
        for s in sessions
    ]

@app.get("/sessions/detail/{session_id}", tags=["sessions"])
async def get_session_detail(session_id: str, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Return matches the format expected by ResultsDashboard
    import json
    result = None
    if session.result_json:
        try:
            result = json.loads(session.result_json)
        except:
            pass
            
    return {
        "id": session.id,
        "created_at": session.created_at,
        "focus": session.focus,
        "history": session.history,
        "vision": session.vision,
        "result": result
    }

@app.post("/signup", tags=["auth"])
async def signup(req: SignupRequest, db: DBSession = Depends(get_db)):
    """Simple signup (Production: use Supabase Auth)."""
    user = db.query(User).filter(User.email == req.email).first()
    if user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    new_user = User(
        id=str(uuid.uuid4()),
        email=req.email,
        password=req.password,
        name=req.name
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created", "user_id": new_user.id, "name": new_user.name}

@app.post("/login", tags=["auth"])
async def login(req: LoginRequest, db: DBSession = Depends(get_db)):
    """Simple login (Production: use Supabase Auth)."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.password != req.password:
        raise HTTPException(status_code=401, detail="Invalid password")
        
    return {"message": "Login successful", "user_id": user.id, "name": user.name}

@app.post("/ingest", tags=["ingest"])
async def ingest(payload: IngestRequest, background_tasks: BackgroundTasks, db: DBSession = Depends(get_db)):
    """
    Main entry point for v2.0.
    Starts the orchestration in background.
    """
    user_id = payload.user_id
    
    # Create/Get User
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        user = User(id=user_id)
        db.add(user)
        db.commit()

    # Create Session Record
    session_id = payload.session_id or str(uuid.uuid4())
    session_rec = db.query(Session).filter(Session.id == session_id).first()
    if not session_rec:
        session_rec = Session(
            id=session_id,
            user_id=user_id,
            focus=payload.text, # Since focus is required on the model, we store the full text there initially
            history="",
            vision=""
        )
        db.add(session_rec)
        db.commit()

    trace_id = str(uuid.uuid4())
    result_store[trace_id] = {"status": "processing"}

    # Run orchestration in background thread (since it calls blocking sync LLM code wrapped in async)
    def run_orchestrate(tid: str, uid: str, raw_text: str, sid: str):
        from .orchestrator import orchestrate
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                # 1. First, parse the raw unstructured text into Focus, History, Vision using StructureAgent
                from .llm import call_llm
                from .prompts import build_prompt
                from .orchestrator import _parse_json
                
                logger.info("Structuring raw input with Groq StructureAgent...")
                prompt_text = build_prompt("StructureAgent", {"focus": raw_text}, None)
                
                structured_json_str = call_llm(prompt_text, max_tokens=2000)
                structured_data = _parse_json(structured_json_str)
                
                focus = structured_data.get("focus", raw_text)
                history = structured_data.get("history", "")
                vision = structured_data.get("vision", "")

                # Update the session with the structured data
                with SessionLocal() as db_inner:
                    s = db_inner.query(Session).filter(Session.id == sid).first()
                    if s:
                        s.focus = focus
                        s.history = history
                        s.vision = vision
                        db_inner.commit()

                # 2. Call the orchestrator with the newly structured inputs
                res = loop.run_until_complete(orchestrate(uid, focus, history, vision, sid))
                
                # Update DB with result (sync)
                with SessionLocal() as db_inner:
                    s = db_inner.query(Session).filter(Session.id == sid).first()
                    if s:
                        s.result_json = json.dumps(res)
                        db_inner.commit()
                
                result_store[tid] = res
            finally:
                loop.close()
        except Exception as e:
            logger.exception(f"Orchestration failed for {tid}")
            result_store[tid] = {"status": "error", "error": str(e)}

    threading.Thread(
        target=run_orchestrate, 
        args=(trace_id, user_id, payload.text, session_id),
        daemon=True
    ).start()

@app.post("/ingest_stream", tags=["ingest"])
async def ingest_stream(payload: IngestRequest, db: DBSession = Depends(get_db)):
    """
    Streaming entry point for v2.0.
    """
    user_id = payload.user_id
    session_id = payload.session_id or str(uuid.uuid4())

    # Ensure User and Session exist in DB before proceeding
    with SessionLocal() as db_init:
        user = db_init.query(User).filter(User.id == user_id).first()
        if not user:
            user = User(id=user_id, email=f"{user_id}@example.com") # Placeholder email
            db_init.add(user)
        
        session = db_init.query(Session).filter(Session.id == session_id).first()
        if not session:
            session = Session(id=session_id, user_id=user_id)
            db_init.add(session)
        
        db_init.commit()

    async def event_generator():
        try:
            # 1. First, parse the raw unstructured text into Focus, History, Vision using StructureAgent
            from .llm import call_llm
            from .prompts import build_prompt
            from .orchestrator import _parse_json
            
            logger.info("Structuring raw input for stream...")
            prompt_text = build_prompt("StructureAgent", {"focus": payload.text}, None)
            
            structured_json_str = await asyncio.to_thread(call_llm, prompt_text, max_tokens=2000)
            structured_data = _parse_json(structured_json_str)
            
            # Update the session with the structured data
            # Use a separate block to ensure it's saved even if orchestration fails
            history = structured_data.get("history", "")
            vision = structured_data.get("vision", "")
            focus = structured_data.get("focus", payload.text[:100])

            session.focus = focus
            session.history = history
            session.vision = vision
            db.add(session)
            db.commit()
            
            # Initial yield of structured focus
            yield f"data: {json.dumps({'type': 'structured', 'focus': focus})}\n\n"

            # 1.5 Generate a catchy session title using NamingAgent (Llama 3.3)
            smart_title = focus
            try:
                import re
                from .llm import call_llm
                from .prompts import build_prompt
                naming_prompt = build_prompt("NamingAgent", {"focus": focus})
                naming_res_raw = await asyncio.to_thread(call_llm, naming_prompt, model_override="llama-3.3-70b-versatile")
                naming_json = json.loads(re.search(r"\{.*\}", naming_res_raw, re.DOTALL).group())
                smart_title = naming_json.get("title", focus)
                
                # Update session with the better title
                session.focus = smart_title
                db.add(session)
                db.commit()
                logger.info(f"Smart title generated: {smart_title}")
            except Exception as e:
                logger.error(f"Failed to generate smart title: {e}")
            
            # Yield full structured data including the potentially smarter title
            yield f"data: {json.dumps({'type': 'structured', 'focus': smart_title, 'history': history, 'vision': vision})}\n\n"

            # 2. Call the streaming orchestrator
            # We'll collect everything into session_result for persistence
            session_result = {
                "past": {"origin_story": "No historical pattern detected.", "predicted_context": ""},
                "present": {"primary_blocker": "No immediate constraints identified.", "weekly_cost_estimate": "", "physical_reframe": ""},
                "future": {"failure_simulation": "Trajectory simulation pending.", "success_simulation": ""},
                "integration": {
                    "roadmap": []
                }
            }
            
            from .orchestrator import orchestrate
            async for chunk in orchestrate(user_id, focus, history, vision, session_id):
                if chunk["type"] == "initial":
                    session_result["past"] = chunk.get("past", "")
                    session_result["present"] = chunk.get("present", "")
                    session_result["future"] = chunk.get("future", "")
                    session_result["integration"] = {
                        **(chunk.get("integration_meta", {})),
                        "roadmap": [chunk.get("first_month")]
                    }
                elif chunk["type"] == "month":
                    month_plan = chunk["month"]
                    session_result["integration"]["roadmap"].append(month_plan)
                    
                    # Store roadmap chunk in Qdrant for RAG
                    try:
                        month_text = json.dumps(month_plan)
                        from .llm import create_embedding
                        month_embedding = await asyncio.to_thread(create_embedding, month_text)
                        if month_embedding:
                            from .vector_store import vector_store
                            await asyncio.to_thread(
                                vector_store.add_memory,
                                user_id,
                                month_text,
                                month_embedding,
                                {"source": "roadmap_chunk", "session_id": session_id, "phase": month_plan.get("phase", "Unknown")}
                            )
                    except Exception as ve:
                        logger.error(f"Failed to store roadmap chunk in RAG: {ve}")

                    # Save month tasks to DB
                    try:
                        with SessionLocal() as db_inner:
                            # Extract month number from "Month X"
                            month_idx = int(month_plan.get("phase", "Month 0").split()[-1])
                            for week in month_plan.get("weeks", []):
                                week_num = week.get("week", 0)
                                task = RoadmapTask(
                                    session_id=session_id,
                                    month=month_idx,
                                    week=week_num,
                                    title=week.get("title", "Task"),
                                    description=week.get("description", ""),
                                    is_completed=0
                                )
                                db_inner.add(task)
                            db_inner.commit()
                    except Exception as db_e:
                        logger.error(f"Failed to save tasks for month: {db_e}")

                yield f"data: {json.dumps(chunk)}\n\n"
            
            # Save final comprehensive session_result to Session
            with SessionLocal() as db_final:
                s = db_final.query(Session).filter(Session.id == session_id).first()
                if s:
                    s.result_json = json.dumps(session_result)
                    db_final.commit()
        
        except Exception as e:
            logger.exception("Streaming orchestration failed")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/result/{trace_id}", tags=["ingest"])
def get_result(trace_id: str):
    res = result_store.get(trace_id)
    if not res:
        return {"status": "processing", "message": "Result not found or not ready."}
    return res


@app.get("/metrics", tags=["observability"])
def metrics():
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# --- Audio Endpoint ---

from fastapi import UploadFile, File
from .audio import transcriber

@app.post("/transcribe", tags=["audio"])
async def transcribe_audio(file: UploadFile = File(...), skip_structure: bool = True):
    """
    Accepts an audio file and returns text.
    1. Transcribe with Whisper on Groq (Ultra-fast).
    2. Optionally structure with LLM (Slower).
    """
    try:
        # 1. Read & Transcribe
        content = await file.read()
        file_obj = io.BytesIO(content)
        raw_text = transcriber.transcribe(file_obj)
        
        if "[Error" in raw_text:
            logger.error(f"Transcription error: {raw_text}")
            return JSONResponse(status_code=500, content={"error": raw_text})

        # 2. Early Return for Speed
        if skip_structure:
            logger.info("Skipping LLM structuring for low-latency return.")
            return {
                "raw_text": raw_text,
                "focus": raw_text, # Frontend uses this as the user's primary answer
                "history": "",
                "vision": ""
            }

        # 3. Optional Slow Structure with LLM
        from .llm import call_llm
        from .prompts import build_prompt
        from .orchestrator import _parse_json
        
        prompt_text = build_prompt("StructureAgent", {"focus": raw_text}, None)
        logger.info("Structuring transcript with Groq...")
        structured_json_str = call_llm(prompt_text, max_tokens=2000)
        structured_data = _parse_json(structured_json_str)

        return {
            "raw_text": raw_text,
            "focus": structured_data.get("focus", raw_text),
            "history": structured_data.get("history", ""),
            "vision": structured_data.get("vision", "")
        }

    except Exception as e:
        logger.error(f"Audio processing failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
