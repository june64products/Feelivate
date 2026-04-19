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
    
    # Strip any sslmode query params as they can interfere with some drivers
    if "?" in DATABASE_URL:
        base_url = DATABASE_URL.split("?")[0]
        # Keep query params for sync engine if needed, but asyncpg needs them in connect_args
    else:
        base_url = DATABASE_URL

    # Create Async URL
    ASYNC_DATABASE_URL = base_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Common connection arguments
connect_args = {}
if "postgresql" in DATABASE_URL:
    # Northflank/Render databases often require SSL
    connect_args["ssl"] = "require"
elif "sqlite" in DATABASE_URL:
    connect_args["check_same_thread"] = False

# Sync Engine
engine = create_engine(
    DATABASE_URL, 
    pool_pre_ping=True, 
    echo=False,
    connect_args=connect_args if "sqlite" in DATABASE_URL else {} # psycogp2 handles ssl via URL usually
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async Engine
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    future=True,
    connect_args=connect_args
)
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
        # from .models import User, Session  <-- Will implement next
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
