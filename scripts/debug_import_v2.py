import sys
import os
from dotenv import load_dotenv

print("1. Loading .env")
load_dotenv()

print("2. Importing build_prompt from .prompts")
from app.prompts import build_prompt

print("3. Importing call_llm from .llm")
from app.llm import call_llm

print("4. Importing vector_store from .vector_store")
try:
    from app.vector_store import vector_store
    print("   - Vector store imported")
except Exception as e:
    print(f"   - Vector store failed: {e}")

print("5. Importing observability...")
try:
    from app.observability import AGENT_CALLS_TOTAL, AgentTimer, trace_request
    print("   - Observability imported")
except Exception as e:
    print(f"   - Observability failed: {e}")

print("6. Importing orchestrate from .orchestrator")
from app.orchestrator import orchestrate
print("7. Success!")
