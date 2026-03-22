import time
import sys

print("1. Importing os, json, uuid...")
import os, json, uuid
print("2. Importing threading, asyncio...")
import threading, asyncio
print("3. Importing dotenv...")
from dotenv import load_dotenv
print("4. Loading .env...")
load_dotenv()
print("5. Importing FastAPI...")
from fastapi import FastAPI
print("6. Importing database components...")
try:
    from app.database import engine, SessionLocal, init_db, get_db
    print("   - Database imported")
except Exception as e:
    print(f"   - Database import failed: {e}")

print("7. Importing models...")
try:
    from app.models import User, Session, ChatMessage, RoadmapTask, EmotionalState
    print("   - Models imported")
except Exception as e:
    print(f"   - Models import failed: {e}")

print("8. Importing orchestrator...")
try:
    from app.orchestrator import orchestrate
    print("   - Orchestrator imported")
except Exception as e:
    print(f"   - Orchestrator import failed: {e}")

print("9. All imports done!")
