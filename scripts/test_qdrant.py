import os
from qdrant_client import QdrantClient
from dotenv import load_dotenv

load_dotenv()
url = os.getenv("QDRANT_URL")
api_key = os.getenv("QDRANT_API_KEY")

print(f"Testing Qdrant connection to: {url}")
try:
    client = QdrantClient(url=url, api_key=api_key, timeout=5)
    print("Attempting to get collections...")
    collections = client.get_collections()
    print(f"SUCCESS: Found {len(collections.collections)} collections")
except Exception as e:
    print(f"FAILURE: {e}")
