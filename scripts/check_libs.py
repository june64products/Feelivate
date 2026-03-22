import time
print("1. Importing google.generativeai")
try:
    import google.generativeai as genai
    print("   - Success")
except Exception as e:
    print(f"   - Error: {e}")

print("2. Importing qdrant_client")
try:
    from qdrant_client import QdrantClient
    print("   - Success")
except Exception as e:
    print(f"   - Error: {e}")

print("3. Importing openai")
try:
    from openai import OpenAI
    print("   - Success")
except Exception as e:
    print(f"   - Error: {e}")
