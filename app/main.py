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
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from loguru import logger
from sqlalchemy.orm import Session as DBSession

from .database import engine, SessionLocal, init_db, get_db
from .models import User, Session
from .orchestrator import orchestrate
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
    init_db()  # Create tables in Postgres if they don't exist
    logger.info("Application startup: DB initialized.")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    REQUESTS_TOTAL.labels(route=str(request.url.path), method=request.method, status="500").inc()
    logger.exception("unhandled_exception")
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/", tags=["health"])
def read_root():
    return {"status": "ok", "version": "v2.0-production"}


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
    from .llm import call_llm
    from .prompts import build_prompt
    from .orchestrator import _parse_json
    
    logger.info(f"Generating week chat for user {req.user_id}")
    try:
        context = {
            "Week Context": json.dumps(req.week_context),
            "Conversation History": "\n".join([f"{msg['role']}: {msg['content']}" for msg in req.chat_history[-5:]])
        }
        inputs = {"focus": req.message}
        prompt_text = build_prompt("WeekChatAgent", inputs, context)
        
        json_str = await asyncio.to_thread(call_llm, prompt_text)
        parsed_response = _parse_json(json_str)
        
        # Save interaction to vector store (Disabled temporarily due to missing dependency)
        try:
            memory_text = f"User asked Week Mentor: '{req.message}'. Mentor replied: '{parsed_response.get('response_message', '')}'"
            logger.info(f"Chat Memory Logged: {memory_text}")
        except Exception as ve:
             logger.warning(f"Could not save chat memory: {ve}")
             
        return parsed_response
    except Exception as e:
        logger.exception("Week chat generation failed")
        raise HTTPException(status_code=500, detail=str(e))

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
                
                structured_json_str = call_llm(prompt_text, max_tokens=2000, model_override="llama-3.3-70b-versatile")
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

    return {"trace_id": trace_id, "session_id": session_id, "status": "accepted"}


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
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Accepts an audio file and returns structured text (Focus, History, Vision).
    1. Transcribe with Whisper.
    2. Structure with Llama 3 (via Groq).
    """
    try:
        # 1. Read & Transcribe
        content = await file.read()
        file_obj = io.BytesIO(content)
        raw_text = transcriber.transcribe(file_obj)
        
        if "[Error" in raw_text:
            return JSONResponse(status_code=500, content={"error": raw_text})

        # 2. Structure with LLM
        # We reuse the orchestrator's helper or call_llm directly
        from .llm import call_llm
        from .prompts import build_prompt
        from .orchestrator import _parse_json
        
        # Build prompt for StructureAgent
        # We pass raw_text as 'focus' inputs just to fit the signature, or handle it custom
        prompt_text = build_prompt("StructureAgent", {"focus": raw_text}, None)
        
        logger.info("Structuring transcript with Groq...")
        structured_json_str = call_llm(prompt_text, max_tokens=2000, model_override="llama-3.3-70b-versatile")
        structured_data = _parse_json(structured_json_str)
        
        # If LLM failed to structure, fallback to raw text in 'focus'
        if "error" in structured_data or not structured_data.get("focus"):
            logger.warning("Structuring failed, returning raw text.")
            return {
                "raw_text": raw_text,
                "focus": raw_text,
                "history": "",
                "vision": ""
            }

        return {
            "raw_text": raw_text,
            "focus": structured_data.get("focus", ""),
            "history": structured_data.get("history", ""),
            "vision": structured_data.get("vision", "")
        }

    except Exception as e:
        logger.error(f"Audio processing failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})
