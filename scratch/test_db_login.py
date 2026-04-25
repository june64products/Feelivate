import os
import sys
import asyncio
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, async_engine, SessionLocal, AsyncSessionLocal, init_db
from app.models import User
from sqlalchemy import text

load_dotenv()

def test_sync_db():
    print("Testing sync engine...")
    try:
        init_db()
        with SessionLocal() as db:
            result = db.execute(text("SELECT 1")).scalar()
            print("Sync connection OK, SELECT 1 returned:", result)
            
            # test user query
            user = db.query(User).first()
            print("Sync User query OK. Found user:", user.email if user else "None")
    except Exception as e:
        print("Sync DB error:", type(e).__name__, str(e))
        import traceback
        traceback.print_exc()

async def test_async_db():
    print("Testing async engine...")
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(text("SELECT 1"))
            print("Async connection OK, SELECT 1 returned:", result.scalar())
    except Exception as e:
        print("Async DB error:", type(e).__name__, str(e))
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_sync_db()
    asyncio.run(test_async_db())
