import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model = "gemini-2.5-flash-lite-preview-09-2025"
url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

headers = {"Content-Type": "application/json"}
data = {
    "contents": [{
        "parts": [{"text": "Hello, are you working?"}]
    }]
}

try:
    print(f"Sending request to {url}...")
    response = requests.post(url, headers=headers, json=data, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
