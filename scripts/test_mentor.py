import requests
import json

def test_chat_global():
    url = "http://localhost:8000/chat_global"
    payload = {
        "user_id": "test_user_recall",
        "session_id": "3c126a22-53f0-4404-b3c5-c6f1e5966d05",
        "message": "What am I supposed to do on Day 1 of Week 1? Also, what is your opinion on Python vs JavaScript?",
        "chat_history": [],
        "full_roadmap": [
            {"month": 1, "task": "Test Task"}
        ]
    }
    
    print(f"Testing Common Mentor at {url}...")
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            print("Response:", json.dumps(response.json(), indent=2))
        else:
            print("Error:", response.text)
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    test_chat_global()
