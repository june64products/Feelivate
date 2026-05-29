import asyncio
from app.database import init_db
from app.llm import call_llm_chat
from app.prompts import build_chat_prompt

init_db()

messages = [{"role": "user", "content": "hi"}]
prompt_messages = build_chat_prompt(messages, None)

try:
    resp = call_llm_chat(
        prompt_messages,
        temperature=0.85,
        max_tokens=4000,
        model_override="gpt-oss-120b",
        presence_penalty=0.4,
        frequency_penalty=0.35
    )
    print("Success!")
    print(resp)
except Exception as e:
    import traceback
    print("Error:", str(e))
    traceback.print_exc()
