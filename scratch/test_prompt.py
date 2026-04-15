import sys
import os

# Add the project directory to sys.path
sys.path.append('/Users/shubhammishra/Desktop/projects/ai agents project emotional time travel/ai agent project/emotion-time-travel')

from app.prompts import build_prompt

def test_prompt_interpolation():
    inputs = {"focus": "I want to be a better coder"}
    context = {
        "mentor_persona": "A ruthless drill sergeant who loves Python.",
        "impact_statement": "Force the user to write 100 lines of code daily.",
        "Relevant Roadmap Sections (RAG)": "N/A",
        "Conversation History": "User: Hi",
        "Long-term Context": "N/A"
    }
    
    prompt = build_prompt("GlobalMentorAgent", inputs, context)
    
    print("--- GENERATED PROMPT PREVIEW ---")
    print(prompt[:1000])
    
    if "A ruthless drill sergeant who loves Python." in prompt:
        print("\n✅ SUCCESS: Persona interpolated correctly!")
    else:
        print("\n❌ FAILURE: Persona missing from prompt!")

    if "Force the user to write 100 lines of code daily." in prompt:
        print("✅ SUCCESS: Impact statement interpolated correctly!")
    else:
        print("❌ FAILURE: Impact statement missing!")

if __name__ == "__main__":
    test_prompt_interpolation()
