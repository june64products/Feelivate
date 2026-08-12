import os
import secrets
from datetime import datetime, timedelta
from typing import Optional, Union

from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

# Configuration
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days — prevents logout on reload

# A hardcoded fallback secret is a token-forgery hole: anyone who can read the
# repo can mint a valid JWT for any user. Refuse to boot without a real secret
# outside local development (GDPR Art 32 — appropriate security of processing).
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
APP_ENV = os.getenv("APP_ENV", "production").strip().lower()

if not SECRET_KEY:
    if APP_ENV in {"dev", "development", "local", "test"}:
        # Ephemeral per-process secret: tokens die on restart, which is fine
        # locally and impossible to leak through source control.
        SECRET_KEY = secrets.token_urlsafe(64)
        logger.warning(
            "JWT_SECRET_KEY not set — generated an ephemeral development secret. "
            "Tokens will be invalidated on every restart."
        )
    else:
        raise RuntimeError(
            "JWT_SECRET_KEY is not set. Refusing to start: without it every access "
            "token would be forgeable. Set JWT_SECRET_KEY in the environment "
            "(or set APP_ENV=development for local work)."
        )

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash.

    Returns False (never raises) for malformed or legacy non-Argon2 values, so a
    stray row can't turn into a 500 that leaks storage details to the client.
    """
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception:
        logger.warning("Password verification failed: stored value is not a valid Argon2 hash.")
        return False

def get_password_hash(password: str) -> str:
    """Generate an Argon2 hash from a plain password."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def create_email_action_token(user_id: str, action: str, date_iso: str, expires_hours: int = 48) -> str:
    """Short-lived signed token for one-tap actions from email (no login).

    Scoped three ways: to one user, one action kind, and one calendar date —
    so a leaked "mark Aug 12 done" link can never mark any other day, do any
    other thing, or outlive its 48 hours. Deliberately NOT an access token:
    it carries no session and works nowhere else in the API.
    """
    payload = {
        "sub": user_id,
        "act": action,
        "d": date_iso,
        "exp": datetime.utcnow() + timedelta(hours=expires_hours),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_email_action_token(token: str, action: str) -> Optional[dict]:
    """Validate a one-tap email token; returns its payload or None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("act") != action or not payload.get("sub") or not payload.get("d"):
            return None
        return payload
    except JWTError:
        return None
