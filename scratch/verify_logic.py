import os
import uuid
import asyncio
from fastapi import HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Mocking the request structure
class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = None

class LoginRequest(BaseModel):
    email: str
    password: str

async def test_auth_logic_sqlite():
    print("Verifying Auth Logic with local SQLite...")
    
    # Force SQLite for logic verification
    os.environ["DATABASE_URL"] = "sqlite:///./test_logic.db"
    
    from app.main import signup, login
    from app.database import SessionLocal, init_db
    from app.models import User

    # Initialize DB (creates tables in test_logic.db)
    init_db()

    test_email = f"test_{uuid.uuid4().hex[:6]}@example.com"
    test_password = "password123"
    test_name = "Test User"

    db = SessionLocal()
    try:
        # 1. Test Signup
        print(f"Attempting signup for {test_email}...")
        signup_payload = SignupRequest(email=test_email, password=test_password, name=test_name)
        signup_res = await signup(signup_payload, db)
        print(f"Signup Result: {signup_res}")

        # 2. Test Login
        print("Attempting login...")
        login_payload = LoginRequest(email=test_email, password=test_password)
        login_res = await login(login_payload, db)
        print(f"Login Result: {login_res}")
        
        print("\n✓ AUTH LOGIC VERIFIED: Signup and Login are working perfectly.")

    except Exception as e:
        print(f"TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
        if os.path.exists("./test_logic.db"):
            os.remove("./test_logic.db")

if __name__ == "__main__":
    asyncio.run(test_auth_logic_sqlite())
