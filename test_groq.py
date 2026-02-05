from app.llm import call_llm
import os
from dotenv import load_dotenv

load_dotenv()

print(f"Testing Groq Integration...")
print(f"API Key present: {bool(os.getenv('GROQ_API_KEY'))}")
print(f"Model: {os.getenv('GROQ_MODEL')}")

try:
    response = call_llm("Hello, can you hear me? Answer in one sentence.")
    print("\nResponse from LLM:")
    print(response)
except Exception as e:
    print(f"\nError calling LLM: {e}")
