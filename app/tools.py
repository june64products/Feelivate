"""
Small tool implementations.

Exposed tools:
 - sentiment_tool(text) -> {"emotion": str, "score": float}
 - tts_tool(text) -> str (URL or file path, placeholder)

sentiment_tool is LLM-based and expects OPENAI_API_KEY available.
"""

import json
import uuid
from typing import Any, Dict

from loguru import logger

from .llm import call_llm
from .observability import AGENT_CALLS_TOTAL, AgentTimer


def _parse_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = text[start : end + 1]
            return json.loads(candidate)
        raise RuntimeError("Failed to parse JSON from tool output")


def sentiment_tool(text: str) -> Dict[str, Any]:
    """
    Analyze sentiment/emotion via LLM and return a JSON dict:
    {"emotion": <string>, "score": <float 0.0-1.0>}.
    """
    prompt = (
        "You are a sentiment analysis tool. Given the user's text, return ONLY JSON with "
        "fields: {\"emotion\": string (primary emotion label), \"score\": number (0.0-1.0 confidence)}.\n"
        f"User Text: {text}\n"
    )
    logger.info("sentiment_tool_call", extra={"text_len": len(text)})
    AGENT_CALLS_TOTAL.labels(agent="sentiment_tool").inc()
    timer = AgentTimer("sentiment_tool")
    output = call_llm(prompt, temperature=0.0, max_tokens=200)
    timer.observe()
    data = _parse_json(output)
    if "emotion" not in data or "score" not in data:
        raise RuntimeError("sentiment_tool missing required fields")
    return {"emotion": str(data["emotion"]), "score": float(data["score"])}


def tts_tool(text: str) -> str:
    """
    Placeholder text-to-speech tool.
    Returns a dummy URL or file path for the synthesized audio.
    """
    audio_id = str(uuid.uuid4())
    url = f"https://example.local/tts/{audio_id}.mp3"
    logger.info("tts_tool_call", extra={"text_len": len(text), "url": url})
    AGENT_CALLS_TOTAL.labels(agent="tts_tool").inc()
    return url