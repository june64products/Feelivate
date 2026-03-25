import os
import json
import asyncio
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from loguru import logger

# Add parent dir to path to import app modules
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models import Session
from app.llm import create_embedding
from app.vector_store import vector_store

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

async def index_all_plans():
    if not DATABASE_URL:
        logger.error("DATABASE_URL not set")
        return

    engine = create_engine(DATABASE_URL)
    SessionFactory = sessionmaker(bind=engine)
    db = SessionFactory()

    try:
        # Fetch all sessions with result_json
        sessions = db.query(Session).filter(Session.result_json.isnot(None)).all()
        logger.info(f"Found {len(sessions)} sessions with results to index.")

        for session_rec in sessions:
            try:
                result_data = json.loads(session_rec.result_json)
                
                # The structure in orchestrator.py:
                # session_result = { "integration": { "roadmap": [...] } }
                # OR some older ones might just have a list.
                
                roadmap = []
                if isinstance(result_data, dict):
                    if "integration" in result_data and "roadmap" in result_data["integration"]:
                        roadmap = result_data["integration"]["roadmap"]
                    elif "roadmap" in result_data:
                        roadmap = result_data["roadmap"]
                
                if not roadmap:
                    logger.warning(f"No roadmap found in session {session_rec.id}")
                    continue

                logger.info(f"Indexing roadmap for session {session_rec.id} (User: {session_rec.user_id})")
                
                for month_plan in roadmap:
                    phase = month_plan.get("phase", "Unknown Phase")
                    month_text = json.dumps(month_plan)
                    
                    # 1. Create embedding
                    embedding = await asyncio.to_thread(create_embedding, month_text)
                    if not embedding:
                        logger.error(f"Failed to create embedding for month {phase}")
                        continue
                        
                    # 2. Add to Qdrant
                    success = await asyncio.to_thread(
                        vector_store.add_memory,
                        session_rec.user_id,
                        month_text,
                        embedding,
                        {
                            "source": "roadmap_chunk", 
                            "session_id": session_rec.id, 
                            "phase": phase,
                            "migration": "true"
                        }
                    )
                    
                    if success:
                        logger.info(f"Successfully indexed {phase} for session {session_rec.id}")
                    else:
                        logger.error(f"Failed to index {phase} for session {session_rec.id}")

            except Exception as e:
                logger.error(f"Error processing session {session_rec.id}: {e}")

    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(index_all_plans())
