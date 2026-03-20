import os
from app.database import engine, Base
from loguru import logger

# Import models to ensure they are registered with Base
from app.models import User, Session, ChatMessage, RoadmapTask, EmotionalState, Feedback

def init_supabase():
    """Initialize database tables in Supabase."""
    logger.info("Initializing Supabase database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Database tables initialized successfully in Supabase.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        logger.warning("Make sure your DATABASE_URL in .env is correct and contains the right password.")

if __name__ == "__main__":
    init_supabase()
