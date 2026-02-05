import os
import requests
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
url = "https://api.groq.com/openai/v1/models"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}

try:
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        print("Available Models:")
        models = response.json().get("data", [])
        for m in models:
            print(f"- {m['id']}")
    else:
        print(f"Error fetching models: {response.status_code} - {response.text}")
except Exception as e:
    print(f"Error: {e}")
