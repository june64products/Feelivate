import sys
import os
import json
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Session, User, RoadmapTask

load_dotenv()

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def verify():
    db = SessionLocal()
    try:
        # Get last 5 sessions
        sessions = db.query(Session).order_by(Session.created_at.desc()).limit(5).all()
        print(f"Found {len(sessions)} sessions:")
        for s in sessions:
            focus_val = s.focus if s.focus else "NULL"
            has_result = "YES" if s.result_json else "NO"
            result_len = len(s.result_json) if s.result_json else 0
            print(f"ID: {s.id} | Focus: {focus_val[:30]}... | Has Result: {has_result} ({result_len} chars)")
            if s.result_json:
                try:
                    res = json.loads(s.result_json)
                    keys = res.keys() if isinstance(res, dict) else "LIST"
                    print(f"  - Result Structure: {keys}")
                except:
                    print("  - Result is not valid JSON")
    finally:
        db.close()

if __name__ == "__main__":
    verify()
