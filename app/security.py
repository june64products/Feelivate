import os
from datetime import datetime, timedelta
from typing import Optional, Union

from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "feelivate-default-secret-key-please-set-jwt-secret-in-env")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days — prevents logout on reload

if SECRET_KEY == "feelivate-default-secret-key-please-set-jwt-secret-in-env":
    logger.warning("⚠️  JWT_SECRET_KEY is not set in environment variables! Using default. Set JWT_SECRET_KEY in production.")

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)

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
