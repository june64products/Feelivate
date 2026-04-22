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

async def test_auth_logic():
    print("Testing Auth Logic...")
    from app.main import signup, login
    from app.database import SessionLocal, init_db
    from app.models import User

    # Initialize DB (creates tables)
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

        # 2. Test Duplicate Signup (should fail)
        print("Attempting duplicate signup...")
        try:
            await signup(signup_payload, db)
            print("FAILED: Duplicate signup should have raised 400")
        except HTTPException as e:
            print(f"SUCCESS: Duplicate signup caught as expected: {e.detail}")

        # 3. Test Login
        print("Attempting login...")
        login_payload = LoginRequest(email=test_email, password=test_password)
        login_res = await login(login_payload, db)
        print(f"Login Result: {login_res}")

        # 4. Test Wrong Password
        print("Attempting login with wrong password...")
        try:
            wrong_payload = LoginRequest(email=test_email, password="wrongpassword")
            await login(wrong_payload, db)
            print("FAILED: Wrong password should have raised 401")
        except HTTPException as e:
            print(f"SUCCESS: Invalid password caught: {e.detail}")

        # Cleanup
        user = db.query(User).filter(User.email == test_email).first()
        if user:
            db.delete(user)
            db.commit()
            print("Test user cleaned up.")

    except Exception as e:
        print(f"TEST FAILED with unexpected error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    load_dotenv()
    asyncio.run(test_auth_logic())
