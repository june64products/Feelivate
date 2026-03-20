import os
import json
import uuid
from app.database import SessionLocal, Base, engine
from app.models import User, Session, ChatMessage, RoadmapTask

# We will use the actual DB defined in .env (Supabase)
TestSession = SessionLocal

def test_persistence():
    db = TestSession()
    
    # 1. Create User
    user_id = "test_persist_user"
    user = User(id=user_id)
    db.add(user)
    db.commit()
    print("✓ User created")

    # 2. Create Session
    session_id = str(uuid.uuid4())
    session = Session(id=session_id, user_id=user_id, focus="Test focus")
    db.add(session)
    db.commit()
    print(f"✓ Session created: {session_id}")

    # 3. Add Chat Messages
    msg1 = ChatMessage(session_id=session_id, role="user", content="Hello Mentor")
    msg2 = ChatMessage(session_id=session_id, role="assistant", content="Hello User, how can I help?")
    db.add_all([msg1, msg2])
    db.commit()
    print("✓ Chat messages saved")

    # 4. Add Roadmap Tasks
    task1 = RoadmapTask(session_id=session_id, month=1, week=1, title="Wake up early", description="7 AM")
    task2 = RoadmapTask(session_id=session_id, month=1, week=2, title="Drink water", description="2 Liters")
    db.add_all([task1, task2])
    db.commit()
    print("✓ Roadmap tasks saved")

    # 5. Verify Retrieval
    saved_msgs = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).all()
    assert len(saved_msgs) == 2
    assert saved_msgs[0].content == "Hello Mentor"
    print("✓ Verified message retrieval")

    saved_tasks = db.query(RoadmapTask).filter(RoadmapTask.session_id == session_id).all()
    assert len(saved_tasks) == 2
    assert saved_tasks[1].title == "Drink water"
    print("✓ Verified task retrieval")

    db.close()
    print("\nALL PERSISTENCE TESTS PASSED!")

if __name__ == "__main__":
    test_persistence()
