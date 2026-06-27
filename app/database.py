import os
from contextlib import contextmanager, asynccontextmanager
from typing import Generator, AsyncGenerator

from dotenv import load_dotenv
from loguru import logger
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

load_dotenv()

# Use internal URL for production (Render/Northflank) or external for local dev
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Fallback to sqlite for local dev if no PG url provided
    logger.warning("DATABASE_URL not set. Using local sqlite memory.db")
    DATABASE_URL = "sqlite:///./memory.db"
    ASYNC_DATABASE_URL = "sqlite+aiosqlite:///./memory.db"
else:
    # Clean up DATABASE_URL (Northflank/Heroku style fixes)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    
    # Handle Multi-host URLs (commonly provided by Northflank for Primary/Read replicas)
    # Format: postgresql://user:pass@host1:5432,host2:5432/dbname
    if "@" in DATABASE_URL and "/" in DATABASE_URL.split("@")[-1]:
        prefix, remainder = DATABASE_URL.split("@", 1)
        address_part, path_part = remainder.split("/", 1)
        
        if "," in address_part:
            # Pick only the first host:port pair
            primary_address = address_part.split(",")[0]
            DATABASE_URL = f"{prefix}@{primary_address}/{path_part}"
            logger.info(f"Targeting primary database host: {primary_address.split(':')[0]}")

    # Strip any sslmode query params for asyncpg (handled in connect_args)
    if "postgresql" in DATABASE_URL:
        if "?" in DATABASE_URL:
            base_url = DATABASE_URL.split("?")[0]
            # For sync engine, ensure sslmode=require is in the URL if needed
            if "sslmode=" not in DATABASE_URL:
                DATABASE_URL += "&sslmode=require" if "?" in DATABASE_URL else "?sslmode=require"
        else:
            base_url = DATABASE_URL
            DATABASE_URL += "?sslmode=require"
        
        # Create Async URL
        ASYNC_DATABASE_URL = base_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        ASYNC_DATABASE_URL = DATABASE_URL.replace("sqlite://", "sqlite+aiosqlite://", 1)

# Common connection arguments
connect_args = {}
if "postgresql" in DATABASE_URL:
    # Northflank/Render databases often require SSL
    connect_args["ssl"] = "require"
elif "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False

# Sync Engine
# Redact sensitive info for logging
log_url = DATABASE_URL
if "@" in log_url:
    prefix, remainder = log_url.split("://", 1)
    creds, rest = remainder.split("@", 1)
    log_url = f"{prefix}://****:****@{rest}"

logger.info(f"Creating sync engine for: {log_url}")

sync_engine_args = {
    "pool_pre_ping": True, 
    "echo": False,
}

if "sqlite" in DATABASE_URL:
    sync_engine_args["connect_args"] = connect_args
else:
    sync_engine_args.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_timeout": 30
    })

engine = create_engine(DATABASE_URL, **sync_engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async Engine
logger.info(f"Creating async engine")

async_engine_args = {
    "echo": False,
    "future": True,
    "connect_args": connect_args
}

if "sqlite" not in ASYNC_DATABASE_URL:
    async_engine_args.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_timeout": 30
    })

async_engine = create_async_engine(ASYNC_DATABASE_URL, **async_engine_args)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

def get_db() -> Generator[Session, None, None]:
    """Dependency for synchronous database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for asynchronous database session."""
    async with AsyncSessionLocal() as session:
        yield session

def init_db():
    """Initialize database tables and apply incremental column migrations."""
    try:
        # Import ALL models so SQLAlchemy registers them with Base before create_all
        from .models import (
            User, Session, ChatMessage, RoadmapTask, EmotionalState, Feedback,
            DailyCheckin, UserStreak, VoiceJournal, WeeklyReport,
        )
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified (including new USP tables)")

        # ── Incremental column migrations ──────────────────────────────────────
        # PostgreSQL: IF NOT EXISTS supported (PG 9.6+).
        # SQLite: wrap each statement; OperationalError = column exists → skip.
        is_postgres = "postgresql" in DATABASE_URL or "postgres" in DATABASE_URL

        if is_postgres:
            migrations = [
                # ── users ──
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token VARCHAR;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_sync_enabled INTEGER DEFAULT 0;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_email VARCHAR;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled INTEGER DEFAULT 0;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_code VARCHAR;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_expiry TIMESTAMP;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_notification_time VARCHAR DEFAULT '08:00';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_notification_timezone VARCHAR DEFAULT 'UTC';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_email_date VARCHAR;",
                # ── sessions ──
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS title VARCHAR;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS history TEXT;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS vision TEXT;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS result_json TEXT;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS current_week INTEGER DEFAULT 0;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS phase VARCHAR DEFAULT 'chat';",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS week_plan_json TEXT;",
                # ── NEW: week review ──
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS week_review_json TEXT;",
                # ── NEW: plan lifecycle ──
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS plan_start_date VARCHAR;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_completed INTEGER DEFAULT 0;",
                "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_report_json TEXT;",
                # ── NEW: session-scoped journals & reports ──
                "ALTER TABLE voice_journals ADD COLUMN IF NOT EXISTS session_id VARCHAR REFERENCES sessions(id);",
                "ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS session_id VARCHAR REFERENCES sessions(id);",
                "ALTER TABLE weekly_reports ADD COLUMN IF NOT EXISTS week_number INTEGER DEFAULT 1;",
                # ── daily_checkins unique constraint ──
                """
                CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_checkins_user_date
                ON daily_checkins (user_id, date);
                """,
            ]
        else:
            migrations = [
                "ALTER TABLE users ADD COLUMN google_refresh_token VARCHAR;",
                "ALTER TABLE users ADD COLUMN calendar_sync_enabled INTEGER DEFAULT 0;",
                "ALTER TABLE users ADD COLUMN notification_email VARCHAR;",
                "ALTER TABLE users ADD COLUMN email_notifications_enabled INTEGER DEFAULT 0;",
                "ALTER TABLE users ADD COLUMN email_otp_code VARCHAR;",
                "ALTER TABLE users ADD COLUMN email_otp_expiry TIMESTAMP;",
                "ALTER TABLE users ADD COLUMN preferred_notification_time VARCHAR DEFAULT '08:00';",
                "ALTER TABLE users ADD COLUMN preferred_notification_timezone VARCHAR DEFAULT 'UTC';",
                "ALTER TABLE users ADD COLUMN last_daily_email_date VARCHAR;",
                "ALTER TABLE sessions ADD COLUMN title VARCHAR;",
                "ALTER TABLE sessions ADD COLUMN updated_at TIMESTAMP;",
                "ALTER TABLE sessions ADD COLUMN history TEXT;",
                "ALTER TABLE sessions ADD COLUMN vision TEXT;",
                "ALTER TABLE sessions ADD COLUMN result_json TEXT;",
                "ALTER TABLE sessions ADD COLUMN current_week INTEGER DEFAULT 0;",
                "ALTER TABLE sessions ADD COLUMN phase VARCHAR DEFAULT 'chat';",
                "ALTER TABLE sessions ADD COLUMN week_plan_json TEXT;",
                "ALTER TABLE sessions ADD COLUMN week_review_json TEXT;",
                # NEW: plan lifecycle
                "ALTER TABLE sessions ADD COLUMN plan_start_date VARCHAR;",
                "ALTER TABLE sessions ADD COLUMN is_completed INTEGER DEFAULT 0;",
                "ALTER TABLE sessions ADD COLUMN session_report_json TEXT;",
                # NEW: session-scoped journals & reports
                "ALTER TABLE voice_journals ADD COLUMN session_id VARCHAR REFERENCES sessions(id);",
                "ALTER TABLE weekly_reports ADD COLUMN session_id VARCHAR REFERENCES sessions(id);",
                "ALTER TABLE weekly_reports ADD COLUMN week_number INTEGER DEFAULT 1;",
                # SQLite unique index (no IF NOT EXISTS, so we catch the error)
                "CREATE UNIQUE INDEX uq_daily_checkins_user_date ON daily_checkins (user_id, date);",
            ]

        with engine.begin() as conn:
            from sqlalchemy import text
            applied = 0
            for sql in migrations:
                try:
                    conn.execute(text(sql))
                    applied += 1
                except Exception as col_err:
                    logger.debug(
                        f"Migration skipped (already applied or harmless): "
                        f"{sql.strip()[:80]} — {col_err}"
                    )

            logger.info(f"DB migrations done: {applied}/{len(migrations)} applied.")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        import traceback
        logger.error(traceback.format_exc())


