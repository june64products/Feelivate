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
    """Initialize database tables."""
    try:
        # Import models here to ensure they are registered with Base
        from .models import User, Session, ChatMessage, RoadmapTask, EmotionalState, Feedback
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
