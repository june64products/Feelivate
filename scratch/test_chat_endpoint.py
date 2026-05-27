import asyncio
import os
import sys
from loguru import logger

# Add root directory to python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, init_db
from app.models import User, Session, ChatMessage
from app.main import chat, ChatRequest

async def test_chat():
    logger.info("Initializing DB...")
    init_db()
    db = SessionLocal()
    
    try:
        # Get or create test user
        email = "test@example.com"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            import uuid
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                password="testpassword",
                name="Test User"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        logger.info(f"Using user: {user.email} with ID {user.id}")
        
        # Test Chat Request
        request_payload = ChatRequest(
            message="I want to learn guitar. I have 30 minutes a day.",
            session_id=None,
            user_id=user.id
        )
        
        logger.info("Invoking /chat endpoint...")
        result = await chat(payload=request_payload, db=db, current_user=user)
        logger.info(f"RESULT: {result}")
        
    except Exception as e:
        logger.exception("Chat execution failed:")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_chat())
