import os
import asyncio
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv('.env')
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

try:
    resp = client.embeddings.create(model="text-embedding-3-small", input="hello")
    print("Success: Embedding created")
except Exception as e:
    print("Error:", str(e))
