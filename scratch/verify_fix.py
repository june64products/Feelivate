import asyncio
from app.prompts import build_prompt
from app.llm import call_llm
from app.orchestrator import _parse_json

async def verify_structure_agent():
    print("\n==================================================")
    print("TESTING STRUCTURE AGENT CONSTRAINT EXTRACTION...")
    print("==================================================")
    
    # Raw input with multiple constraints: vegetarian diet and a knee injury
    raw_text = (
        "I want to start going to the gym in the morning and evening for 1 hour each, "
        "and I want to get a solid plan. But please remember, I am a vegetarian so my diet "
        "should not contain any meat, and also I have a knee injury so I cannot do high-impact squats."
    )
    
    prompt = build_prompt("StructureAgent", {"focus": raw_text}, None)
    print("Sending request to StructureAgent...")
    response_str = call_llm(prompt, max_tokens=2000)
    print(f"Raw Response:\n{response_str}\n")
    
    try:
        data = _parse_json(response_str)
        print("Parsed JSON:")
        print(f"Focus: {data.get('focus')}")
        print(f"History: {data.get('history')}")
        print(f"Vision: {data.get('vision')}")
        
        # Check if constraints are in the focus field
        focus_text = data.get('focus', '')
        if "Vegetarian" in focus_text or "vegetarian" in focus_text or "knee" in focus_text:
            print("\n✅ SUCCESS: Constraints successfully extracted and embedded in Focus field!")
        else:
            print("\n❌ FAILURE: Constraints were lost in Focus field!")
    except Exception as e:
        print(f"Parsing failed: {e}")

async def verify_global_mentor_agent():
    print("\n==================================================")
    print("TESTING GLOBAL MENTOR AGENT CHATGPT-STYLE RESPONSE...")
    print("==================================================")
    
    mentor_persona = "A highly supportive, practical fitness and mindset coach."
    impact_statement = "Help the user build consistency through progressive, tailored physical exercises."
    
    # Pre-existing roadmap containing the plan (representing RAG context)
    roadmap = (
        "Morning Gym Routine:\n"
        "- Warm-up (10 min)\n"
        "- Push-ups, bodyweight squats, plank (40 min)\n"
        "- Cool-down (10 min)\n"
        "\n"
        "Diet Plan:\n"
        "- Breakfast: Plant-based protein smoothie\n"
        "- Lunch: Quinoa salad with chickpeas\n"
        "- Dinner: Stir-fried tofu with brown rice"
    )
    
    # Conversation history showing the previous turn where the plan was given
    chat_history = [
        {"role": "user", "content": "ok so what to do in morning gym and what diet should I take"},
        {"role": "assistant", "content": f"Alright, let's get down to business. Here's a structured plan for your mornings at the gym: {roadmap}"}
    ]
    
    history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in chat_history])
    
    context = {
        "mentor_persona": mentor_persona,
        "impact_statement": impact_statement,
        "Relevant Roadmap Sections (RAG)": roadmap,
        "Conversation History": history_str,
        "Long-term Context": "User has a knee injury and is vegetarian."
    }
    
    # User's new follow-up question
    inputs = {"focus": "so what about weight training"}
    
    prompt = build_prompt("GlobalMentorAgent", inputs, context)
    print("Sending request to GlobalMentorAgent...")
    response_str = call_llm(prompt, max_tokens=1000, model_override="gpt-4o-mini")
    print(f"Raw Response:\n{response_str}\n")
    
    try:
        data = _parse_json(response_str)
        response_msg = data.get("response_message", "")
        print("Parsed response_message:")
        print(response_msg)
        
        # Check if the model repeated the whole diet plan / warmups, or if it answered concisely
        if "Alright, let's get down to business" in response_msg or "Breakfast: Plant-based protein smoothie" in response_msg:
            print("\n❌ FAILURE: Chatbot repeated the previous response verbatim or in full!")
        else:
            print("\n✅ SUCCESS: Chatbot responded dynamically and concisely to the follow-up, just like ChatGPT!")
    except Exception as e:
        print(f"Parsing failed: {e}")

async def main():
    await verify_structure_agent()
    await verify_global_mentor_agent()

if __name__ == "__main__":
    asyncio.run(main())
