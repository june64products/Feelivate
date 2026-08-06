"""
Crisis detection and signposting.

Feelivate is not a mental-health service and must not behave like one. But it
invites people to write down how their week actually went, which means some of
them will write something serious. The product's obligation is narrow and
non-negotiable: recognise it, stop coaching, and put real help in front of the
person.

This is deliberately a keyword screen and not a classifier:

  * it runs locally, so a message in this category is not shipped to a third
    country just to decide whether it is a crisis;
  * it is inspectable and adjustable — a reviewer can read exactly what triggers
    it, which an embedding model does not offer;
  * it fails toward showing help. A false positive costs one resource card. A
    false negative costs something we are not willing to gamble on.

It is a signpost, not a diagnosis, and nothing here is stored as a risk flag
against the user. Inferring a mental-health status and recording it would create
new Art 9 data about a person who never asked us to assess them.
"""

import re
from typing import Dict, List, Optional

# Phrases that indicate risk of suicide or self-harm. English plus the Hinglish
# and romanised Hindi that Feelivate's users actually write in — an
# English-only screen would silently miss a large share of the user base.
_CRISIS_PATTERNS: List[str] = [
    # explicit suicidal statements
    r"\bkill (?:myself|my self)\b",
    r"\b(?:want|wanna|going) to die\b",
    r"\bi (?:want|wish) (?:to |i )?(?:was |were )?dead\b",
    # "ending my life" / "ending it all" are as common as the bare verb. The
    # object has to be named — a bare "end my ..." also matches "end my
    # procrastination", which is the most ordinary sentence in this app.
    r"\bend(?:ing|s)? (?:it all|my (?:life|existence|suffering))\b",
    r"\btake my (?:own )?life\b",
    r"\bsuicid(?:e|al)\b",
    r"\bkms\b",
    r"\bbetter off without me\b",
    r"\bno (?:reason|point) (?:to|in) liv(?:e|ing)\b",
    r"\bdon'?t want to (?:be here|live|exist)\b",
    # self-harm
    r"\b(?:cut|cutting|hurt|harm)(?:ing)? myself\b",
    r"\bself[- ]harm\b",
    r"\boverdos(?:e|ing)\b",
    # Hinglish / romanised Hindi
    r"\bmar\s?jau[nm]?ga?\b",
    r"\bmarna chahta\b",
    r"\bkhud ?kushi\b",
    r"\batmahatya\b",
    r"\bjeena nahi chahta\b",
    r"\bjeene ka mann nahi\b",
    r"\bzindagi khatam\b",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in _CRISIS_PATTERNS]

# Phrases that read as crisis in a wellbeing app but as ordinary frustration in
# an accountability one — "I can't do this anymore" is something a user says
# about week three of a training plan far more often than about their life. They
# only count when the message also refers to living or existing, which keeps the
# signal without flooding every discouraged user with a helpline card.
_AMBIGUOUS_PATTERNS: List[str] = [
    r"\bcan'?t (?:go on|do this any ?more|take (?:it|this) any ?more|keep going)\b",
    r"\bgive up on everything\b",
    r"\bwhat'?s the point\b",
    r"\bhopeless\b",
    r"\bnahi ho payega mujhse\b",
]

_LIFE_CONTEXT = re.compile(
    r"\b(?:life|living|alive|exist(?:ing|ence)?|die|dying|dead|death|world|"
    r"zindagi|jeena|jeene|jindagi|marna)\b",
    re.IGNORECASE,
)

_COMPILED_AMBIGUOUS = [re.compile(p, re.IGNORECASE) for p in _AMBIGUOUS_PATTERNS]


# Resources shown alongside the response. Deliberately region-agnostic at the
# top (emergency services work everywhere) then narrowing, because we do not
# geolocate users and should not pretend to know where they are.
CRISIS_RESOURCES: List[Dict[str, str]] = [
    {
        "region": "Anywhere",
        "name": "Local emergency services",
        "contact": "112 (EU and India) · 911 (US) · or your country's emergency number",
        "note": "If you are in immediate danger, call now.",
    },
    {
        "region": "Europe",
        "name": "Emotional support helpline",
        "contact": "116 123",
        "note": "Free helpline number available in many European countries.",
    },
    {
        "region": "India",
        "name": "Tele-MANAS",
        "contact": "14416 or 1-800-891-4416",
        "note": "Government of India mental health helpline, 24/7, multilingual.",
    },
    {
        "region": "Worldwide",
        "name": "Find a helpline",
        "contact": "https://findahelpline.com",
        "note": "Verified helplines for almost every country.",
    },
]


def detect_crisis(text: Optional[str]) -> bool:
    """True when the text contains language indicating suicide or self-harm risk."""
    if not text:
        return False
    if any(pattern.search(text) for pattern in _COMPILED):
        return True
    if any(pattern.search(text) for pattern in _COMPILED_AMBIGUOUS):
        return bool(_LIFE_CONTEXT.search(text))
    return False


def crisis_payload() -> Dict[str, object]:
    """The structured block the API attaches to a response.

    The frontend renders this as a resource card. Kept separate from the reply
    text so the UI can present it prominently instead of burying it in a
    paragraph the user is unlikely to be in a state to read carefully.
    """
    return {
        "type": "crisis_support",
        "headline": "Please talk to someone who can help right now",
        "body": (
            "It sounds like you are going through something really heavy, and I want to be "
            "straight with you: I'm an AI accountability tool, not a counsellor, and this is "
            "bigger than what I can help with. Please reach out to a real person who is "
            "trained for this — right now, if you can."
        ),
        "resources": CRISIS_RESOURCES,
    }


# Appended to the system prompt for a message that triggered detection. The
# model still writes the reply, but on these terms: no plan, no streak, no
# accountability pressure.
CRISIS_SYSTEM_INSTRUCTION = """
── OVERRIDE: THE USER MAY BE IN CRISIS ──
This message contains language suggesting the user may be considering suicide or self-harm.
For this response, every other rule is suspended.

DO:
- Respond with warmth and without alarm. Short. Human. No coaching voice.
- Say plainly that you are an AI and that this is beyond what you can help with.
- Encourage them to contact emergency services or a helpline, or a person they trust.
- Take what they said seriously. Let them know it matters that they said it.

DO NOT:
- Build, mention, or adapt a plan. Do not mention streaks, tasks, weeks, or accountability.
- Give advice, techniques, coping strategies, or anything that sounds like therapy.
- Ask probing questions about methods, timing, or intent.
- Minimise it, be cheerful about it, or say anything like "you've got this".
- Return a plan object. Return only a reply.
"""
