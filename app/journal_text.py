"""
Small helpers for quoting a person's own words back to them.

Shared by the weekly review (pull-quote, per-day key lines) and the daily
email (last night's line). Anything shown as "in your words" must pass
`said_verbatim`; when a model paraphrases, `strongest_sentence` picks a real
sentence instead.
"""
import re


def loose(text: str) -> str:
    """Text reduced to lowercase words, for 'did they really say this' checks."""
    return " ".join(re.sub(r"[^\w]+", " ", (text or "").lower()).split())


def said_verbatim(quote: str, transcripts: list) -> bool:
    """True when `quote` appears, word for word, in one of the transcripts."""
    q = loose(quote)
    return len(q) >= 12 and any(q in loose(t) for t in transcripts)


def sentences(transcript: str) -> list:
    """The transcript split into sentences (English and Devanagari stops)."""
    return [p.strip() for p in re.split(r"(?<=[.!?।])\s+|\n+", transcript or "") if p.strip()]


def strongest_sentence(transcript: str) -> str:
    """
    A sentence the person actually said, for when the model paraphrases:
    the longest sentence of a readable length, else the opening of the entry.
    """
    parts = sentences(transcript)
    fit = [p for p in parts if 30 <= len(p) <= 220]
    if fit:
        return max(fit, key=len)
    return (parts[0] if parts else (transcript or "").strip())[:200]


def snippet(text: str, limit: int = 48) -> str:
    """The opening of a line, cut at a word boundary, for a subject line."""
    t = " ".join((text or "").split()).strip().strip('"“”')
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0].rstrip(",;:—-")
    return (cut or t[:limit]) + "…"
