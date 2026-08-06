"""
Security agent — the pre-flight screen on every chat message.

Internal name only. Nothing in the UI ever calls this "the security agent"; the
user just sees that the request can't be planned.

It runs BEFORE the mentor model is called. If it blocks, the model is never
invoked at all — no reply is generated, no plan is built, nothing is written to
long-term memory. That is the point: a refusal written by the model is still a
model response about the topic, and a plan object can slip out alongside it.
Refusing without ever asking the model removes that whole class of failure.

Two stages, cheapest first:

  1. A local pattern screen. Unambiguous requests (build a weapon, synthesise a
     drug, write malware) are blocked here with no network call at all.
  2. A small LLM classifier, but only for messages that tripped a weaker signal.
     Regexes cannot read intent, and this app's users write things like "I want
     to quit heroin this month" or "my goal is to learn ethical hacking" —
     legitimate goals that share vocabulary with the things we block. Stage 2
     exists to tell those apart rather than punish the wording.

Set GUARDRAIL_ALWAYS_CLASSIFY=true to run stage 2 on every message instead of
only on suspicious ones — more coverage, at the cost of an extra model call per
message.

NOT handled here: suicide and self-harm. Those go through safety.detect_crisis
and get the helpline card. Someone saying they want to die needs help and a
human, not a policy refusal — routing them here would be the single worst thing
this file could do. main.py checks crisis first for exactly that reason.

Nothing is stored against the user. The category is logged, the text is not:
recording "this user asked about X" would build a behavioural profile nobody
consented to.
"""

import json
import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from loguru import logger

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — local patterns
# ─────────────────────────────────────────────────────────────────────────────

# Unambiguous. No plausible accountability goal is phrased this way, so these
# block outright without a second opinion.
_HARD_PATTERNS: Dict[str, List[str]] = {
    "weapons": [
        r"\b(?:how (?:to|do i)|steps? to|guide to|teach me to|help me)\s+(?:\w+\s+){0,3}(?:make|build|construct|assemble|manufacture)\s+(?:a |an |my own )?(?:bomb|explosive|ied|pipe bomb|grenade|landmine|silencer|suppressor|ghost gun|untraceable (?:gun|firearm))\b",
        r"\b(?:napalm|thermite|pipe bomb|pressure cooker bomb|nerve agent|sarin|ricin|anthrax)\b.{0,40}\b(?:make|build|recipe|synthes\w+|instructions?)\b",
        r"\b(?:make|build|recipe|synthes\w+|instructions?)\b.{0,40}\b(?:napalm|thermite|pipe bomb|nerve agent|sarin|ricin|anthrax)\b",
        r"\bconvert\b.{0,30}\b(?:to (?:full )?auto|automatic weapon)\b",
    ],
    "drugs": [
        r"\b(?:how (?:to|do i)|steps? to|guide to|teach me to)\s+(?:\w+\s+){0,3}(?:make|cook|synthes\w+|manufacture|produce)\s+(?:meth|methamphetamine|crystal meth|fentanyl|heroin|cocaine|crack|lsd|mdma|ecstasy)\b",
        r"\b(?:meth|fentanyl|heroin|cocaine|mdma)\b.{0,30}\b(?:synthesis|recipe|lab setup|precursors?)\b",
        r"\b(?:sell|deal|distribut\w+|traffic\w*)\b.{0,25}\b(?:meth|fentanyl|heroin|cocaine|drugs)\b.{0,25}\b(?:without getting caught|undetected|avoid police)\b",
    ],
    "cyber": [
        r"\b(?:write|build|create|code|make)\b.{0,30}\b(?:ransomware|keylogger|spyware|trojan|rootkit|botnet|worm|virus payload|credential stealer)\b",
        r"\b(?:hack|break ?into|get ?into|access)\b.{0,40}\b(?:someone(?:'s)?|my (?:ex|wife|husband|girlfriend|boyfriend|friend)'?s?|his|her|their)\b.{0,25}\b(?:account|phone|instagram|whatsapp|facebook|snapchat|gmail|email|icloud|messages?)\b",
        r"\b(?:ddos|dos attack)\b.{0,30}\b(?:website|server|site|company)\b",
        r"\bsql ?inject\w*\b.{0,30}\b(?:their|his|her|someone|company|bank)\b",
    ],
    "fraud": [
        r"\b(?:how (?:to|do i)|help me|teach me to)\b.{0,30}\b(?:launder(?:ing)? money|money launder\w*|counterfeit (?:money|notes|currency|passport|id)|forge (?:a )?(?:passport|id|signature|cheque|check))\b",
        r"\b(?:steal|clone|skim)\b.{0,25}\b(?:credit card|debit card|card (?:details|numbers?)|identity)\b",
        r"\b(?:phishing|scam)\b.{0,30}\b(?:page|site|email|template|campaign)\b.{0,30}\b(?:make|build|write|create)\b",
        r"\b(?:make|build|write|create|set ?up)\b.{0,30}\b(?:phishing|scam)\b.{0,25}\b(?:page|site|email|template|campaign)\b",
    ],
    "violence": [
        r"\b(?:how (?:to|do i)|help me|plan(?:ning)? to|want to)\b.{0,30}\b(?:kill|murder|poison|stab|shoot|assault|kidnap)\b.{0,25}\b(?:him|her|them|someone|my (?:ex|boss|wife|husband|neighbou?r|teacher|father|mother|brother|sister))\b",
        r"\b(?:untraceable|undetectable)\b.{0,25}\b(?:poison|murder|kill)\b",
        r"\b(?:get ?away with|not get caught)\b.{0,25}\b(?:murder|killing)\b",
    ],
    "csae": [
        r"\bchild\b.{0,25}\b(?:porn|sexual|nude|explicit)\b",
        r"\b(?:sexual\w*|nude|explicit)\b.{0,25}\b(?:child|children|minor|underage|kid|preteen|teen(?:ager)?s?)\b",
        r"\b(?:groom(?:ing)?|lure|seduce)\b.{0,25}\b(?:a )?(?:child|minor|underage|kid)\b",
    ],
    "targeting": [
        r"\b(?:stalk|track|follow|spy on|monitor)\b.{0,35}\b(?:without (?:them|her|him|his|their) knowing|secretly|covertly)\b",
        r"\b(?:dox|doxx)(?:ing|x)?\b",
        r"\b(?:find|get)\b.{0,25}\b(?:home )?address\b.{0,35}\b(?:so i can|to confront|to get back at|revenge)\b",
        # Blackmail and extortion aimed at a person. "revenge body" and "revenge
        # bedtime procrastination" are real goals users write, so revenge only
        # counts with "on <someone>" after it.
        r"\b(?:blackmail|extort)(?:ing|s)?\b\s+(?:him|her|them|someone|my|his|her|their)\b",
        r"\bget (?:back at|revenge on)\b\s+(?:him|her|them|someone|my|his|her|their)\b",
        r"\b(?:ruin|destroy|wreck|sabotage)\b.{0,30}\b(?:his|her|their|someone'?s|my (?:ex|boss|coworker|colleague|neighbou?r|manager))\b.{0,30}\b(?:life|reputation|career|marriage|business|job)\b",
    ],
}

# Weaker signals. These words appear constantly in legitimate goals — "I want to
# quit heroin", "learn penetration testing", "shooting practice at the range" —
# so they never block on their own. They only wake stage 2.
_SUSPECT_PATTERNS: List[str] = [
    r"\b(?:bomb|explosive|grenade|firearm|ammunition|silencer|ghost gun)\b",
    r"\b(?:meth|methamphetamine|fentanyl|heroin|cocaine|lsd|mdma|ketamine)\b",
    r"\b(?:hack|hacking|exploit|malware|ransomware|keylogger|botnet|phish\w*)\b",
    r"\b(?:launder\w*|counterfeit|forge\w*|embezzl\w*|insider trading)\b",
    r"\b(?:kill|murder|stab|shoot|poison|assault|kidnap|revenge)\b",
    r"\b(?:stalk\w*|spy on|surveil\w*|blackmail|extort\w*)\b",
    r"\b(?:smuggl\w*|traffick\w*|bribe|bribery)\b",
    r"\b(?:underage|minor|jailbait)\b",
]

_HARD_COMPILED = {
    cat: [re.compile(p, re.IGNORECASE) for p in pats]
    for cat, pats in _HARD_PATTERNS.items()
}
_SUSPECT_COMPILED = [re.compile(p, re.IGNORECASE) for p in _SUSPECT_PATTERNS]


# ─────────────────────────────────────────────────────────────────────────────
# Verdict
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Verdict:
    allowed: bool
    category: Optional[str] = None
    """Which stage decided: "patterns", "classifier", or "" when allowed."""
    stage: str = ""
    meta: Dict[str, str] = field(default_factory=dict)


ALLOWED = Verdict(allowed=True)


# What the user is told. Deliberately short, non-preachy and non-specific: it
# names no technique, does not lecture, and does not imply anything about the
# person. It also does not vary by category — telling someone precisely which
# rule they hit is a free hint for anyone probing the boundary.
_REFUSAL_TEXT = (
    "I can't help with that one. Feelivate builds accountability plans for "
    "personal goals, and this falls outside what I can plan for. If I've "
    "misread you, rephrase it as the goal you're actually working towards and "
    "we'll pick it up from there."
)


def blocked_payload(verdict: Verdict) -> Dict[str, object]:
    """The structured block the API attaches so the client can raise a dialog.

    `category` ships to the client for its own logging only — the UI copy is
    identical whatever the category is.
    """
    return {
        "type": "request_blocked",
        "headline": "This can't be planned",
        "body": _REFUSAL_TEXT,
        "category": verdict.category or "unspecified",
    }


def refusal_text() -> str:
    """The message written into the chat thread in place of a model reply."""
    return _REFUSAL_TEXT


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — classifier
# ─────────────────────────────────────────────────────────────────────────────

_CLASSIFIER_SYSTEM = """You are the safety screen for Feelivate, an app that turns a user's personal goals into weekly action plans.

Decide whether the app should refuse to respond to the user's message.

BLOCK only if the user is asking for help to DO one of these:
- build or acquire weapons, explosives, or dangerous devices
- synthesise, produce, buy, source, or traffic illegal drugs
- create malware, or break into systems/accounts that are not their own
- commit fraud, money laundering, forgery, or theft
- harm, kill, poison, kidnap, stalk, blackmail, or dox another person
- harass, defame, threaten, or run a campaign to damage a specific real person
- anything sexual involving a minor

ALLOW everything else, including things that merely SOUND alarming. These are normal goals for this app and must be allowed:
- recovering from addiction — STOPPING or reducing use ("quit heroin", "stop drinking", "get off painkillers"). Asking where to BUY or how to GET the drug is not recovery; block that.
- studying security professionally ("learn ethical hacking", "get my OSCP", "practise CTFs")
- lawful, licensed activities ("shooting range practice", "hunting season", "boxing", "MMA")
- competitive or figurative language ("kill this presentation", "destroy my PB", "attack my inbox", "outsell a rival company")
- ordinary conflict handled properly ("prepare for a difficult conversation with my manager", "file a complaint about a colleague")
- medical, legal, academic, journalistic or fictional interest in a difficult topic
- venting, anger, dark humour, or frustration with a person, with no plan to act
- being a victim seeking help ("someone is stalking me", "I was scammed")

If the user is expressing distress, hopelessness or thoughts of self-harm, ALLOW — that is handled elsewhere and must never be refused.

When genuinely uncertain, ALLOW. A wrongly blocked user loses trust in the product; the categories above are narrow on purpose.

Reply with ONLY this JSON, nothing else:
{"block": true|false, "category": "weapons|drugs|cyber|fraud|violence|csae|targeting|none"}"""


# Deliberately NOT the cheapest model — the 8B one waves through things like
# sourcing drugs when they are phrased calmly. This only runs on messages that
# already tripped a signal, so the extra cost is rare.
#
# Must be a NON-reasoning model. The gpt-oss family spends its budget on hidden
# reasoning tokens and returns an empty completion, which fails JSON validation
# and makes the screen fail open — silently, which is the worst outcome here.
GUARDRAIL_MODEL = os.getenv("GUARDRAIL_MODEL", "llama-3.3-70b-versatile")


def _classify(message: str) -> Optional[Verdict]:
    """Ask the classifier model. Returns None if it could not be reached."""
    from .llm import _get_groq_client

    try:
        client = _get_groq_client()
        resp = client.chat.completions.create(
            model=GUARDRAIL_MODEL,
            messages=[
                {"role": "system", "content": _CLASSIFIER_SYSTEM},
                {"role": "user", "content": message[:2000]},
            ],
            max_tokens=64,
            temperature=0,
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "").strip()
        data = json.loads(raw)
    except Exception as e:
        # Fail open. The hard patterns already ran; letting a classifier outage
        # take down the chat for everyone is the worse failure.
        logger.warning(f"[Security] classifier unavailable, allowing (non-fatal): {e}")
        return None

    if not isinstance(data, dict) or not data.get("block"):
        return ALLOWED

    category = data.get("category") or "unspecified"
    if category == "none":
        category = "unspecified"
    return Verdict(allowed=False, category=str(category)[:40], stage="classifier")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def _always_classify() -> bool:
    return os.getenv("GUARDRAIL_ALWAYS_CLASSIFY", "").strip().lower() in ("1", "true", "yes")


def screen(message: Optional[str]) -> Verdict:
    """Screen one user message. Never raises — a broken screen must not break chat."""
    if not message or not message.strip():
        return ALLOWED

    try:
        for category, patterns in _HARD_COMPILED.items():
            if any(p.search(message) for p in patterns):
                logger.warning(f"[Security] blocked by patterns | category={category}")
                return Verdict(allowed=False, category=category, stage="patterns")

        suspicious = any(p.search(message) for p in _SUSPECT_COMPILED)
        if suspicious or _always_classify():
            verdict = _classify(message)
            if verdict and not verdict.allowed:
                logger.warning(f"[Security] blocked by classifier | category={verdict.category}")
                return verdict
    except Exception as e:
        logger.error(f"[Security] screen failed, allowing (non-fatal): {e}")

    return ALLOWED
