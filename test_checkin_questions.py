import asyncio
from app.llm import call_llm
from app.prompts import build_prompt
from app.orchestrator import _parse_json
import json

def test_questions():
    print("Testing /generate_questions logic...")
    prompt = build_prompt("QuestionGeneratorAgent", {"focus": "I want to start a youtube channel about tech but I am afraid to put myself out there"}, None)
    json_str = call_llm(prompt)
    print("Response:")
    print(json_str)

def test_checkin():
    print("\nTesting /checkin logic...")
    context = {
        "status": "Struggled",
        "current_plan": json.dumps({"micro_task": {"title": "Post my first video", "description": "Upload a 10 min 4k video", "reward": "Feeling accomplished"}})
    }
    prompt = build_prompt("RecalibrationAgent", {"focus": "User status: Struggled\nCurrent plan: ..."}, context)
    json_str = call_llm(prompt)
    print("Response:")
    print(json_str)

if __name__ == "__main__":
    test_questions()
    test_checkin()
