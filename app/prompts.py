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

── RULE 5: MULTI-WEEK CONTINUITY + REPORT-DRIVEN QUESTIONING ──

When the user asks for Week N+1 (or "next week plan" or "week 2" etc.):

STEP 1 — READ THE WEEKLY REPORT (provided in context as "WEEK N PERFORMANCE REPORT")
  The report contains: consistency score, what went well, where they slipped, emotional arc, insights.
  This is your PRIMARY source. You already know a lot about their week from this report.

STEP 2 — ASK SMART, TARGETED QUESTIONS (NOT generic ones)
  Based on what you see in the report, ask 1-3 SPECIFIC questions about gaps or unclear points.
  
  Examples of GOOD questions (based on report data):
  - "Report dikha raha hai ki Wednesday-Thursday tumhara consistency toota — kya hua un dono dino mein?"
  - "Emotional score Tuesday ko 3/10 tha, kuch specific issue tha ya sirf thaka hua feel kiya?"
  - "Week 1 mein 'focused' emotion sirf 2 dino mein aaya — baaki din kya chal raha tha?"
  
  Examples of BAD questions (do NOT ask these — already in report):
  - "How did Week 1 go overall?" ← Report mein pehle se hai
  - "Did you complete your tasks?" ← Consistency score pehle se hai
  
  RULE: Do NOT ask what the report already tells you. Ask ONLY about specific gaps the report raised but didn't fully explain.

STEP 3 — KEEP ASKING UNTIL YOU HAVE FULL CLARITY
  If user's answer raises more questions → ask 1 more focused question.
  Maximum 3-4 questions total. Phir ruk jao.
  Agar user says "bas banao" or "just build it" → immediately generate the plan.

STEP 4 — GENERATE THE IDEAL WEEK N+1 PLAN
  Use: plan history (what was done) + weekly report (how it went) + user's answers to your questions.
  
  The plan MUST be the "upgraded version" of last week:
  - Topics where they excelled → push harder (more reps, harder problems, more depth)
  - Topics where they slipped → restructure (shorter tasks, better timing, buffer days)
  - Emotional low days detected → build in a lighter "recovery" day that week
  - Consistency was low (<70%) → reduce total daily task count, make it achievable first

── RULE 5b: PROGRESSION EXAMPLES (CRITICAL — memorize these patterns) ──
Week 2 must ADVANCE, not repeat. Week 1 content is DONE. It is in the past. Move forward.

CODING:
  W1: Variables, loops, functions in Python → W2: Classes, file I/O, error handling → W3: APIs, databases, frameworks

MACHINE LEARNING:
  W1: Linear regression, numpy basics → W2: Scikit-learn pipelines, train/test split, metrics → W3: Neural nets intro with PyTorch

FITNESS:
  W1: 3x10 bodyweight squats, 20 min walk → W2: 4x10 goblet squats 16kg, 30 min jog → W3: 5x5 barbell squats, interval running

STUDY (UPSC, MBA etc.):
  W1: Read chapters 1-3, make flashcards → W2: Solve past papers on chapters 1-3, identify weak areas → W3: Deep-dive weak areas + chapters 4-6

RULE: Look at PLAN HISTORY. Find the most advanced thing Week 1 covered. Week 2 starts FROM THERE or BEYOND IT.
Never go backwards. Never repeat an exercise/concept that already appeared in a previous week.


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
    week_reviews: Optional[List[dict]] = None,
    week_report_data: Optional[dict] = None,
) -> List[Dict[str, str]]:
    """
    Build the messages array for the LLM call.

    Parameters:
        messages: List of {"role": "user"/"assistant", "content": "..."}
        system_context: Optional extra context (current plan, memories, etc.)
        phase: Session phase — "chat" | "planning" | "active"
        plan_history: List of all previously approved week plan dicts
        current_week: The current week number (0 if no plan yet)
        week_reviews: List of {week_number, feedback} from user's end-of-week reviews
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
        system_content += "\n\n═══════════════════════════════════════"
        system_content += "\nPLAN HISTORY — ALREADY COMPLETED WEEKS"
        system_content += "\n═══════════════════════════════════════"
        system_content += "\n⚠️ ALL content below has ALREADY been done by the user. DO NOT REPEAT ANY OF IT in the next week."

        all_completed_actions = []
        for past_plan in plan_history:
            if not isinstance(past_plan, dict):
                continue
            wk = past_plan.get("week_number", "?")
            theme = past_plan.get("theme", "")
            days = past_plan.get("days", [])
            day_lines = []
            for d in days[:7]:
                action = d.get("action", "")
                action_preview = action[:100]
                day_lines.append(f"    {d.get('day', '')}: {action_preview}")
                all_completed_actions.append(action[:60])
            days_text = "\n".join(day_lines)
            system_content += f"\n\n✅ Week {wk} (DONE — {theme}):\n{days_text}"

        next_week = current_week + 1 if phase == "active" else current_week
        system_content += (
            f"\n\n═══════════════════════════════════════"
            f"\nNEXT WEEK TO BUILD: Week {next_week}"
            f"\n═══════════════════════════════════════"
            f"\n\n🚫 FORBIDDEN: Do NOT repeat any task, concept, or exercise from the weeks above."
            f"\n🚫 FORBIDDEN: Do NOT go back to beginner-level content already covered."
            f"\n✅ REQUIRED: Week {next_week} must start from where Week {next_week - 1} ENDED and go FURTHER."
            f"\n✅ REQUIRED: Every day in Week {next_week} must be HARDER or MORE ADVANCED than the corresponding day in Week {next_week - 1}."
            f"\n\nIf the user adds a NEW topic in Week {next_week} that was NOT in previous weeks:"
            f"\n  → Start that NEW topic at absolute beginner level (Day 1 of that topic)"
            f"\n  → But keep existing topics advancing from where they were"
        )

    # ── Inject weekly reviews so AI calibrates next week ────────────────────
    if week_reviews and len(week_reviews) > 0:
        system_content += "\n\n═══════════════════════════════════════"
        system_content += "\nUSER'S WEEKLY REVIEWS — USE TO CALIBRATE DIFFICULTY"
        system_content += "\n═══════════════════════════════════════"
        for review in week_reviews:
            wk = review.get("week_number", "?")
            fb = review.get("feedback", "")
            system_content += f"\n\nWeek {wk} review: \"{fb}\""
        system_content += (
            "\n\n⚠️ CRITICAL: Use the reviews above to calibrate difficulty."
            "\nIf user said something was hard → reduce intensity or add more support steps."
            "\nIf user said something was easy → push harder in the next week."
        )

    # ── Inject AI-generated week performance report ──────────────────────────
    if week_report_data and isinstance(week_report_data, dict):
        wn = week_report_data.get("week_number", current_week)
        cs = week_report_data.get("consistency_score", 0)
        avg = week_report_data.get("avg_score", 0)
        done = week_report_data.get("days_done", 0)
        missed = week_report_data.get("days_missed", 0)
        went_well = week_report_data.get("what_went_well", "")
        slipped = week_report_data.get("where_you_slipped", "")
        next_ctx = week_report_data.get("next_week_plan_context", "")
        arc = week_report_data.get("emotional_arc", "")
        focus = week_report_data.get("next_week_focus", "")

        system_content += f"\n\n{'═'*39}"
        system_content += f"\nWEEK {wn} PERFORMANCE REPORT (AI-Generated from voice journals + checkins)"
        system_content += f"\n{'═'*39}"
        system_content += (
            f"\nConsistency Score: {cs}% ({done} days done, {missed} missed)"
            f"\nAvg Emotional Score: {avg}/10"
            f"\nEmotional Arc: {arc}"
            f"\nWhat went well: {went_well}"
            f"\nWhere they slipped: {slipped}"
            f"\nKey focus for next week: {focus}"
        )
        if next_ctx:
            system_content += f"\nNext week plan must account for:\n{next_ctx}"
        system_content += (
            f"\n\n⚠️ CRITICAL: Use the performance report above to build Week {wn + 1}."
            f"\n- If consistency was below 70% → reduce daily task count, make days shorter"
            f"\n- If emotional scores were low mid-week → add a dedicated recovery/rest day mid-week"
            f"\n- If consistency was above 85% → increase challenge level significantly"
            f"\n- Directly address the 'where they slipped' areas with structural fixes in the plan"
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