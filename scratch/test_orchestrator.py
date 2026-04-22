import asyncio
import os
import json
from dotenv import load_dotenv

# Set working directory to project root
import sys
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from app.orchestrator import _call_agent
from app.prompts import build_prompt

async def test_core_analysis():
    print("--- Testing CoreAnalysisAgent with openai/gpt-oss-120b ---")
    load_dotenv()
    
    inputs = {
        "focus": "I want to start a fitness business but I'm afraid of being judged.",
        "history": [
            {"q": "What stopped you before?", "a": "I was worried people would think I'm not qualified."},
            {"q": "How does that feel?", "a": "Like a heavy weight in my chest."}
        ],
        "vision": "A thriving online coaching platform with 100 happy clients."
    }
    
    memory_context = {"past_patterns": ["User has a history of starting and stopping due to external validation needs."]}
    
    try:
        # 1. Test Prompt Building (especially the new history list handling)
        prompt = build_prompt("CoreAnalysisAgent", inputs, memory_context)
        print("\n[PROMPT SAMPLE]\n", prompt[:300], "...")
        
        # 2. Test LLM Call
        print("\nCalling Groq with openai/gpt-oss-120b...")
        result = await _call_agent("CoreAnalysisAgent", inputs, memory_context, model_override="openai/gpt-oss-120b")
        
        print("\n[RESULT]")
        print(json.dumps(result, indent=2))
        
        if "error" in result:
            print(f"\nFAILURE: {result['error']}")
        else:
            print("\nSUCCESS: Orchestrator is communicating correctly with Groq OSS model.")
            
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_core_analysis())
