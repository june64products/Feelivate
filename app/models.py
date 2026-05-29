from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, BigInteger
from sqlalchemy.orm import relationship
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True) # UUID
    email = Column(String, unique=True, index=True)
    password = Column(String) # Storing Argon2 hash here now
    name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sessions = relationship("Session", back_populates="user")
    feedbacks = relationship("Feedback", back_populates="user")
    emotional_states = relationship("EmotionalState", back_populates="user")
    
    # Google Calendar integration
    google_refresh_token = Column(String, nullable=True)
    calendar_sync_enabled = Column(Integer, default=0) # 0: disabled, 1: enabled

class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True) # UUID
    user_id = Column(String, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Store the core inputs for this session
    focus = Column(Text, nullable=True)
    history = Column(Text, nullable=True)
    vision = Column(Text, nullable=True)
    
    # Store the AI result as JSON string (roadmap content)
    result_json = Column(Text, nullable=True) 
    
    # Weekly adaptive flow
    current_week = Column(Integer, default=0)          # 0 = no plan yet, 1+ = active week number
    phase = Column(String, default="chat")             # chat | planning | active | review
    week_plan_json = Column(Text, nullable=True)       # current approved week plan
    week_review_json = Column(Text, nullable=True)     # user's end-of-week feedback per week
    
    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")
    tasks = relationship("RoadmapTask", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    role = Column(String)  # 'user' or 'assistant'
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="messages")

class RoadmapTask(Base):
    __tablename__ = "roadmap_tasks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    month = Column(Integer)
    week = Column(Integer)
    title = Column(String)
    description = Column(Text, nullable=True)
    is_completed = Column(Integer, default=0) # 0: pending, 1: done
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="tasks")

class EmotionalState(Base):
    __tablename__ = "emotional_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    session_id = Column(String, ForeignKey("sessions.id"), nullable=True)
    sentiment_score = Column(Integer)  # Scale 1-100 or -1 to 1
    dominant_emotion = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="emotional_states")

class Feedback(Base):
    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.id"))
    session_id = Column(String, ForeignKey("sessions.id"), nullable=True)
    rating = Column(Integer)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="feedbacks")


# ============================================================
# NEW TABLES — USP Features
# ============================================================

class DailyCheckin(Base):
    """
    One row per user per day. Tracks whether they completed their plan task today.
    Unique constraint on (user_id, date) prevents double-logging.
    """
    __tablename__ = "daily_checkins"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=True)
    date       = Column(String, nullable=False)   # ISO date string: "2026-05-29"
    status     = Column(String, default="pending") # pending | done | skipped
    note       = Column(Text, nullable=True)       # optional user note on checkin
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class UserStreak(Base):
    """
    One row per user. Denormalized for fast reads. Updated on every checkin.
    """
    __tablename__ = "user_streaks"

    user_id        = Column(String, ForeignKey("users.id"), primary_key=True)
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_checkin   = Column(String, nullable=True)  # ISO date of last 'done' checkin
    total_done     = Column(Integer, default=0)      # lifetime done count
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class VoiceJournal(Base):
    """
    One row per voice journal entry. Stores transcript + AI-detected emotion.
    Old data is NEVER auto-injected into new sessions (user views via /journey).
    """
    __tablename__ = "voice_journals"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    date          = Column(String, nullable=False)    # ISO date: "2026-05-29"
    transcript    = Column(Text, nullable=False)       # Groq Whisper output
    emotion_label = Column(String, nullable=True)      # e.g. "motivated", "stressed"
    emotion_score = Column(Integer, nullable=True)     # 1–10
    one_liner     = Column(Text, nullable=True)        # AI 1-sentence summary
    created_at    = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


class WeeklyReport(Base):
    """
    One generated report per user per week. Created on-demand (user visits /journey).
    Contains mood trend JSON + AI insight text.
    """
    __tablename__ = "weekly_reports"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    week_start  = Column(String, nullable=False)  # Monday ISO date: "2026-05-26"
    week_end    = Column(String, nullable=False)  # Sunday ISO date: "2026-06-01"
    report_json = Column(Text, nullable=False)    # Full report as JSON string
    created_at  = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")
