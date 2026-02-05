import requests
import sys

BASE = "http://127.0.0.1:8000"

try:
    print(f"Testing connection to {BASE}/ ...")
    r = requests.get(f"{BASE}/", timeout=5)
    print(f"Root Status: {r.status_code}")
except Exception as e:
    print(f"Error connecting to root: {e}")
    sys.exit(1)

try:
    print(f"\nTesting POST {BASE}/session ...")
    payload = {"user_id": "test_user"}
    r = requests.post(f"{BASE}/session", json=payload, timeout=5)
    print(f"Session Status: {r.status_code}")
    print(f"Session Response: {r.text}")
except Exception as e:
    print(f"Error creating session: {e}")
