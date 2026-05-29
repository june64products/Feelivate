import os
import sys
import asyncio
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv('.env')

client = OpenAI(api_key=os.getenv('GROQ_API_KEY'), base_url="https://api.groq.com/openai/v1")

try:
    resp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=10
    )
    print("Success:", resp.choices[0].message.content)
except Exception as e:
    print("Error:", str(e))
