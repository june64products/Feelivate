from app.llm import call_llm
import sys

try:
    print("Calling LLM...")
    response = call_llm("Hello, are you working?")
    print(f"Response: {response}")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
