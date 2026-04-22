import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

def test_openai_oss():
    # Using standard OpenAI endpoint
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    model = "openai/gpt-oss-120b"
    
    print(f"Testing model: {model} on OFFICIAL OPENAI API...")
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello"}],
            max_tokens=10
        )
        print("\n--- RESPONSE ---")
        print(resp.choices[0].message.content)
        print("Success! Model exists on OpenAI.")
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        if "rate_limit" in str(e).lower():
            print("Rate limit reached on OpenAI.")
        elif "model_not_found" in str(e).lower() or "404" in str(e):
            print("This model does NOT exist on official OpenAI API.")

if __name__ == "__main__":
    test_openai_oss()
