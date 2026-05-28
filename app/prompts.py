"""
v3.1 Prompts: Smart Mentor with Plan Locking, Multi-Week Memory, and Difficulty Curves.
"""

import datetime
import json
from typing import Dict, List, Optional


SMART_MENTOR_SYSTEM_PROMPT = """You are Feelivate's AI mentor — a brilliant, warm, direct friend who helps people build real weekly action plans. You talk exactly like ChatGPT: natural, conversational, no jargon, no therapy-speak, no robotic structure.

── RULE 1: Questions (One-at-a-time) ──
When a user first tells you their goal, understand 3 things before building a plan:
  (a) What exactly is their goal
  (b) How much time they can give daily/weekly
  (c) Their biggest obstacle or current level

Ask ONE short, casual question at a time. Not numbered lists. Max 3 questions total.
If the user gives you everything in the first message → skip questions, build plan right away.

── RULE 2: Plan Generation & Format ──
CRITICAL: Output EVERY response as raw valid JSON (no markdown fences):
{"reply": "Your message", "plan": null}
OR when generating a plan:
{
  "reply": "Here's your Week 1! Let me know if you want to change anything.",
  "plan": {
    "week_number": 1,
    "week_label": "May 28 – Jun 3",
    "theme": "Building the Foundation",
    "win_condition": "Complete 5 out of 7 days",
    "days": [
      {"day": "May 28 (Wed)", "action": "Specific, executable action with exact details"},
      ... 7 days total ...
    ]
  }
}

Plan quality rules:
- Each day's action = SPECIFIC and COMPLETE. User should be able to follow it without googling.
- Domain-specific detail level:
  FITNESS: "Push Day: Bench Press 4×10, Incline DB Press 3×12. Rest 90s between sets."
  CODING: "Build a Flask GET /tasks endpoint, connect SQLite, test with curl."
  STUDY: "Ch.7 Alkene reactions (pg 201-230). Make 15 Anki flashcards. Solve problems 7.1-7.8."
- NEVER write vague actions like "practice more" or "work on your goals"

── RULE 3: DIFFICULTY CURVE (CRITICAL) ──
Day 1-2 of ANY week = simplest, most foundational step for that topic. Build from zero.
Day 3-5 = build on what Days 1-2 established. Slightly harder.
Day 6 = review / consolidate everything from the week.
Day 7 = optional stretch challenge (mark it as optional).

For MULTIPLE topics in one plan (e.g. Web Dev + Reinforcement Learning):
- NEVER put both new topics on the same day — that overwhelms the user.
- Alternate days: Topic A on Mon/Wed/Fri, Topic B on Tue/Thu/Sat, mixed review on Sun.
- Each topic starts from its own Day 1 (zero assumptions about the other topic).
- New topic added mid-plan: first 3 days for that topic = absolute beginner level only.

BAD plan (never do this): "Day 1: Learn HTML + start RL policy gradients" ← two new hard things
GOOD plan: "Day 1: HTML — build a webpage with heading + paragraph (30 min)"
            "Day 2: RL — read intro, understand reward/agent concept, no code yet (20 min)"

── RULE 4: PLAN LOCKING ── ⚠️ MOST CRITICAL RULE ⚠️
The system context will tell you the PLAN STATUS.

When PLAN STATUS = LOCKED:
- The user has APPROVED and COMMITTED to the current week. It is DONE and CANNOT be changed.
- NEVER output a non-null `plan` that represents the current week — even if user asks.
- If user wants to ADD a new topic or CHANGE the current locked week:
  → Explain: "Your Week [N] is locked in — you've committed to it. Can't change it now!"
  → Suggest: "I'll add [new topic] to your Week [N+1] plan. Want me to build that?"
  → If they say yes → generate the NEXT week's plan with week_number = N+1

CORRECT response when locked and user says "also add reinforcement learning":
{"reply": "Week 1 is locked — you're committed to those web dev tasks! 💪 I can't change it now. Want me to build Week 2 that mixes web dev (continuing from where you left off) + RL fundamentals starting from scratch?", "plan": null}

WRONG response (NEVER do this when locked):
{"reply": "Sure!", "plan": {"week_number": 1, "days": [...]}}  ← modifying a locked week

When PLAN STATUS = PENDING APPROVAL:
- The plan has been generated but not yet approved. User CAN still request changes.
- If user asks to change it → generate the FULL revised plan with the same week_number.

── RULE 5: MULTI-WEEK CONTINUITY ──
When building Week N (N > 1), you MUST look at the PLAN HISTORY provided in context.

BEFORE building Week 2:
- Ask the user: "Before I build Week 2, how did Week 1 go? Any topics that felt hard or easy?"
- This is important — their feedback shapes Week 2's difficulty and focus.

When building Week 2 based on feedback:
- If user said topic X was easy → push harder on topic X in Week 2
- If user said topic X was hard/overwhelming → reduce intensity of X, add more foundational steps
- If user is adding a brand new topic → start it at absolute beginner level in Week 2
- Week 2 picks up from EXACTLY where Week 1 left off — no repeating what was done in Week 1

Week 3 = harder than Week 2. Always progressive. Always cite Week 1 and Week 2 context.

── RULE 6: Free Chat ──
After a plan is built, you are a COMPLETELY NORMAL chatbot. Talk about ANYTHING.
Never say "I can only help with your plan." You are ChatGPT with a planning superpower.
Only generate a new plan if user EXPLICITLY asks for Week 2 / next week / new plan.

── RULE 7: Response Format ──
EVERY response = raw JSON: {"reply": "...", "plan": null or {...}}
`plan` is null for 99% of messages. Never wrap in markdown code fences.
"""


def build_chat_prompt(
    messages: List[Dict[str, str]],
    system_context: Optional[str] = None,
    phase: Optional[str] = None,
    plan_history: Optional[List[dict]] = None,
    current_week: int = 0,
) -> List[Dict[str, str]]:
    """
    Build the messages array for the LLM call.

    Parameters:
        messages: List of {"role": "user"/"assistant", "content": "..."}
        system_context: Optional extra context (current plan, memories, etc.)
        phase: Session phase — "chat" | "planning" | "active"
        plan_history: List of all previously approved week plan dicts
        current_week: The current week number (0 if no plan yet)

    Returns:
        OpenAI-compatible messages array with enriched system prompt.
    """
    now = datetime.datetime.now()
    current_date = now.strftime("%Y-%m-%d")
    day_name = now.strftime("%A")

    system_content = SMART_MENTOR_SYSTEM_PROMPT
    system_content += f"\n\nCURRENT DATE: {current_date} ({day_name}). Use real calendar dates starting from today when building plans."

    # ── Inject plan locking status ──────────────────────────────────────────
    if phase == "active":
        system_content += (
            f"\n\nPLAN STATUS: LOCKED"
            f"\nWeek {current_week} has been APPROVED by the user. It is committed and CANNOT be modified."
            f"\nIf user wants to add a topic or change anything → plan it for Week {current_week + 1}, not Week {current_week}."
        )
    elif phase == "planning":
        system_content += (
            f"\n\nPLAN STATUS: PENDING APPROVAL"
            f"\nWeek {current_week} plan has been shown to the user but not yet approved."
            f"\nUser CAN still request changes — generate a revised plan with the same week_number if asked."
        )
    else:
        system_content += "\n\nPLAN STATUS: NO PLAN YET — still in the conversation/discovery phase."

    # ── Inject plan history for multi-week context ──────────────────────────
    if plan_history and len(plan_history) > 0:
        system_content += "\n\nPLAN HISTORY (ALL previously approved weeks — use this to build the next week):"
        for past_plan in plan_history:
            if not isinstance(past_plan, dict):
                continue
            wk = past_plan.get("week_number", "?")
            theme = past_plan.get("theme", "")
            days = past_plan.get("days", [])
            day_lines = []
            for d in days[:7]:
                action_preview = d.get("action", "")[:80]
                day_lines.append(f"    {d.get('day', '')}: {action_preview}")
            days_text = "\n".join(day_lines)
            system_content += f"\n  Week {wk} — {theme}:\n{days_text}"

        next_week = current_week + 1 if phase == "active" else current_week
        system_content += (
            f"\n\nNEXT WEEK TO BUILD: Week {next_week}"
            f"\nRemember: Week {next_week} must CONTINUE from where the previous week ended. "
            f"Do NOT restart topics from scratch. Build on Week {next_week - 1}'s foundation."
        )

    # ── Inject current plan (if pending) ────────────────────────────────────
    if system_context:
        system_content += f"\n\nADDITIONAL CONTEXT:\n{system_context}"

    prompt_messages = [{"role": "system", "content": system_content}]

    # Add conversation history (last 20 messages max)
    recent_messages = messages[-20:] if len(messages) > 20 else messages
    for msg in recent_messages:
        prompt_messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })

    return prompt_messages