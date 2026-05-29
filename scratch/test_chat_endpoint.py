import os
import asyncio
from fastapi.testclient import TestClient
from app.main import app, get_current_user
from app.models import User
from app.database import init_db, get_db

# Override dependency
def override_get_current_user():
    return User(id="test_user", email="test@test.com", name="Test")

app.dependency_overrides[get_current_user] = override_get_current_user

init_db()

# Create a test user in DB if it doesn't exist
db_gen = get_db()
db = next(db_gen)
user = db.query(User).filter(User.id == "test_user").first()
if not user:
    user = User(id="test_user", email="test@test.com", password="pwd", name="Test")
    db.add(user)
    db.commit()

client = TestClient(app)

response = client.post(
    "/chat",
    json={"message": "hello", "user_id": "test_user", "session_id": "test_session"}
)
print("Response status:", response.status_code)
print("Response JSON:", response.json())
