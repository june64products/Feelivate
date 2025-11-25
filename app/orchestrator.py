import asyncio
import json
import uuid
import time
from typing import Any, Dict, Optional

from loguru import logger

from .prompts import build_prompt
from .llm import call_llm
from .observability import AGENT_CALLS_TOTAL, AgentTimer, trace_request


def _parse_json(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning(f"Initial JSON parse failed, trying to extract JSON from text. Error: {e}")
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = text[start : end + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError as e2:
                logger.error(f"Failed to parse extracted JSON. Error: {e2}, Text snippet: {text[:200]}")
                raise RuntimeError(f"Failed to parse JSON from LLM output: {e2}")
        logger.error(f"No JSON found in text. Text snippet: {text[:200]}")
        raise RuntimeError(f"Failed to parse JSON from LLM output. No JSON structure found.")


async def _call_agent(agent_name: str, entry_text: str, context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        prompt = build_prompt(agent_name, entry_text, context)
        timer = AgentTimer(agent_name)
        AGENT_CALLS_TOTAL.labels(agent=agent_name).inc()
        logger.info(f"Calling agent: {agent_name}")
        text = await asyncio.to_thread(call_llm, prompt)
        timer.observe()
        logger.info(f"Agent {agent_name} returned response, length: {len(text)}")
        data = _parse_json(text)
        logger.info(f"Agent {agent_name} JSON parsed successfully")
        return data
    except Exception as e:
        logger.exception(f"Error in _call_agent for {agent_name}")
        raise RuntimeError(f"Agent {agent_name} failed: {e}")


async def orchestrate(entry_text: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    trace_id = str(uuid.uuid4())
    log = logger.bind(trace_id=trace_id)
    context = {"session_id": session_id} if session_id else None
    log.info("orchestrate_start", extra={"entry_len": len(entry_text)})
    trace_request(trace_id, "orchestrate_start", {"session_id": session_id})

    try:
        past_task = _call_agent("PastEmotionAgent", entry_text, context)
        present_task = _call_agent("PresentEmotionAgent", entry_text, context)
        future_task = _call_agent("FutureEmotionAgent", entry_text, context)

        past, present, future = await asyncio.gather(past_task, present_task, future_task)

        integration_context = {
            "session_id": session_id,
            "past_summary": past.get("analysis_summary"),
            "present_summary": present.get("state_summary"),
            "future_summary": future.get("projection_summary"),
        }
        integration = await _call_agent("IntegrationAgent", entry_text, integration_context)

        result = {
            "past": past,
            "present": present,
            "future": future,
            "integration": integration,
            "trace_id": trace_id,
        }
        trace_request(trace_id, "orchestrate_success", {"sizes": {"past": len(json.dumps(past)), "present": len(json.dumps(present)), "future": len(json.dumps(future))}})
        log.info("orchestrate_success")
        return result
    except Exception as e:
        trace_request(trace_id, "orchestrate_error", {"error": str(e)})
        log.exception("orchestrate_error")
        raise RuntimeError(f"Orchestrate failed: {e}")