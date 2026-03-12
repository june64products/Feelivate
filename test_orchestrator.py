import asyncio
from app.orchestrator import orchestrate

async def main():
    try:
        res = await orchestrate(
            user_id="test_user",
            focus="I want to improve my focus.",
            history="I always get distracted by my phone.",
            vision="I want to work for 4 hours straight."
        )
        import json
        with open("test_output.json", "w") as f:
            json.dump(res, f, indent=2)
        print("Success, see test_output.json")
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
