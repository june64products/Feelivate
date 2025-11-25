"""
FastAPI app with ingest/session/task/metrics endpoints.
"""

import json
import os
import time
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from loguru import logger

from .observability import REQUESTS_TOTAL
from .orchestrator import orchestrate
from .session_service import InMemorySessionService
from .tasks import enqueue_long_healing_journey, _session_service
from .eval import init_eval_db, submit_evaluation, daily_summary, set_consent
from .memory import delete_user_data


load_dotenv()

app = FastAPI(title="Emotion Time Travel API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


result_store: Dict[str, Dict[str, Any]] = {}
session_service = _session_service  # reuse the one in tasks
init_eval_db()
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    REQUESTS_TOTAL.labels(route=str(request.url.path), method=request.method, status="500").inc()
    logger.exception("unhandled_exception")
    return JSONResponse(status_code=500, content={"error": str(exc)})


@app.get("/", tags=["health"])
def read_root():
    return {"status": "ok"}


@app.post("/ingest", tags=["ingest"])
async def ingest(payload: Dict[str, Any], background_tasks: BackgroundTasks):
    text = payload.get("text")
    user_id = payload.get("user_id")
    session_id = payload.get("session_id")
    if not text or not user_id:
        REQUESTS_TOTAL.labels(route="/ingest", method="POST", status="400").inc()
        raise HTTPException(status_code=400, detail="text and user_id are required")

    trace_id = str(os.urandom(8).hex())
    
    # Initialize result_store with processing status
    result_store[trace_id] = {"status": "processing", "trace_id": trace_id, "error": "Processing your request..."}
    logger.info(f"Starting orchestration for trace_id: {trace_id}")

    def run_orchestrate_sync(t: str, sid: Optional[str], tid: str):
        try:
            logger.info(f"Background thread started for trace_id: {tid}")
            import asyncio
            # Create new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                logger.info(f"Starting orchestration for trace_id: {tid}")
                res = loop.run_until_complete(orchestrate(t, session_id=sid))
                result_store[tid] = res
                logger.info(f"Orchestration completed successfully for trace_id: {tid}, keys: {res.keys()}")
            finally:
                loop.close()
        except Exception as e:
            error_msg = str(e)
            logger.exception(f"Error in orchestration for trace_id: {tid}, error: {error_msg}")
            result_store[tid] = {
                "error": error_msg, 
                "trace_id": tid,
                "status": "error",
                "details": f"Processing failed: {error_msg}"
            }

    import threading
    thread = threading.Thread(target=run_orchestrate_sync, args=(text, session_id, trace_id), daemon=True)
    thread.start()
    logger.info(f"Background thread started for trace_id: {trace_id}, thread_id: {thread.ident}")
    REQUESTS_TOTAL.labels(route="/ingest", method="POST", status="202").inc()
    return {"trace_id": trace_id, "status": "accepted"}


@app.get("/result/{trace_id}", tags=["ingest"])
def get_result(trace_id: str):
    res = result_store.get(trace_id)
    if not res:
        logger.warning(f"Result not found for trace_id: {trace_id}")
        REQUESTS_TOTAL.labels(route="/result", method="GET", status="200").inc()
        return {
            "error": "Result not ready yet. Still processing...", 
            "status": "processing", 
            "trace_id": trace_id
        }
    
    # Log the status for debugging
    status = res.get("status", "completed" if "error" not in res else "error")
    logger.info(f"Returning result for trace_id: {trace_id}, status: {status}, keys: {list(res.keys())}")
    
    # If there's an error in the result, log it
    if "error" in res and res.get("status") == "error":
        logger.error(f"Error in result for trace_id: {trace_id}: {res.get('error')}")
    
    REQUESTS_TOTAL.labels(route="/result", method="GET", status="200").inc()
    return res


@app.post("/eval", tags=["eval"])
def submit_eval(payload: Dict[str, Any]):
    tid = payload.get("trace_id")
    uid = payload.get("user_id")
    rating = payload.get("rating")
    comments = payload.get("comments")
    if not tid or not uid or rating is None:
        raise HTTPException(status_code=400, detail="trace_id, user_id, rating required")
    rid = submit_evaluation(str(tid), str(uid), int(rating), str(comments) if comments is not None else None)
    return {"id": rid}


@app.get("/eval/summary/{user_id}", tags=["eval"])
def eval_summary(user_id: str):
    return daily_summary(user_id)


@app.post("/session", tags=["session"])
def create_session(payload: Dict[str, Any]):
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")
    sid = session_service.create_session(user_id)
    return {"session_id": sid}


@app.post("/session/{session_id}/pause", tags=["session"])
def pause_session(session_id: str):
    session_service.pause_session(session_id)
    return {"session_id": session_id, "paused": True}


@app.post("/session/{session_id}/resume", tags=["session"])
def resume_session(session_id: str):
    session_service.resume_session(session_id)
    return {"session_id": session_id, "paused": False}


@app.post("/user/{user_id}/consent", tags=["user"])
def user_consent(user_id: str, payload: Dict[str, Any]):
    consent = bool(payload.get("consent", True))
    set_consent(user_id, consent)
    return {"user_id": user_id, "consent": consent}


@app.delete("/user/{user_id}/data", tags=["user"])
def user_delete(user_id: str):
    m = delete_user_data(user_id)
    s = session_service.delete_user(user_id)
    return {"user_id": user_id, "memories_deleted": m, "sessions_deleted": s}


@app.post("/tasks/journey/{session_id}", tags=["tasks"])
def start_journey(session_id: str):
    job = enqueue_long_healing_journey(session_id)
    return {"job_id": job.id}


@app.get("/metrics", tags=["observability"])
def metrics():
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


@app.get("/debug/result-store", tags=["debug"])
def debug_result_store():
    """Debug endpoint to check result_store status"""
    return {
        "total_results": len(result_store),
        "trace_ids": list(result_store.keys()),
        "results": {tid: {
            "status": res.get("status", "unknown"),
            "has_error": "error" in res,
            "has_past": "past" in res,
            "has_present": "present" in res,
            "has_future": "future" in res,
            "error_msg": res.get("error", "")[:100] if "error" in res else None
        } for tid, res in result_store.items()}
    }
