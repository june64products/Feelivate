import asyncio
import os
import json
from dotenv import load_dotenv

import sys
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(project_root)

from app.orchestrator import _call_agent

async def test_o3_mini():
    print("--- Testing CoreAnalysisAgent with o3-mini ---")
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
        print("\nCalling OpenAI with o3-mini...")
        result = await _call_agent("CoreAnalysisAgent", inputs, memory_context, model_override="o3-mini")
        
        print("\n[RESULT]")
        print(json.dumps(result, indent=2))
        
        if "error" in result:
            print(f"\nFAILURE: {result['error']}")
        else:
            print("\nSUCCESS: Orchestrator is communicating correctly with o3-mini.")
            
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_o3_mini())
