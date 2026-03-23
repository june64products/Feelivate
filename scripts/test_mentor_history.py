import requests
import json

payload = {
    "user_id": "test_user_history",
    "session_id": "3c126a22-53f0-4404-b3c5-c6f1e5966d05",
    "message": "why is it so difficult today?",
    "chat_history": [
        {"role": "user", "content": "what is actually day 1 of week 1"},
        {"role": "assistant", "content": "It's about exposing your relief trigger."},
        {"role": "user", "content": "explain day 1 in simple words"},
        {"role": "assistant", "content": "Sure, start by figuring out what is holding you back."}
    ],
    "full_roadmap": [{"month": 1, "weeks": [{"week": 1, "days": [{"day_name": "Day 1", "action": "test"}]}] }]
}

try:
    print("Testing Common Mentor History...")
    response = requests.post("http://localhost:8000/chat_global", json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Failed to connect: {e}")
