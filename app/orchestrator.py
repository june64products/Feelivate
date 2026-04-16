import asyncio
import json
import uuid
import time
from typing import Any, Dict, Optional, List

from loguru import logger

from .prompts import build_prompt
from .llm import call_llm, create_embedding
from .vector_store import vector_store
from .observability import AGENT_CALLS_TOTAL, AgentTimer, trace_request


import re

def _parse_json(text: str) -> Dict[str, Any]:
    # Strip <think>...</think> blocks from reasoning models like DeepSeek-R1
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Fallback: try to find start/end brackets
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
        # Final fallback: return raw text wrapped in dict
        return {"raw_text": text, "error": "failed_to_parse_json"}


async def _call_agent(agent_name: str, inputs: Dict[str, str], context: Optional[Dict[str, Any]], model_override: Optional[str] = None) -> Dict[str, Any]:
    try:
        # Build prompt with specific inputs and retrieved context
        prompt_text = build_prompt(agent_name, inputs, context)
        
        timer = AgentTimer(agent_name)
        AGENT_CALLS_TOTAL.labels(agent=agent_name).inc()
        
        logger.info(f"Calling agent: {agent_name}")
        # Call LLM (IO bound, run in thread). Use 8000 tokens to ensure the 6-month plan fits.
        text = await asyncio.to_thread(call_llm, prompt_text, max_tokens=8000, model_override=model_override)
        
        timer.observe()
        data = _parse_json(text)
        return data
    except Exception as e:
        logger.exception(f"Error in _call_agent for {agent_name}")
        return {"agent": agent_name, "error": str(e)}


async def orchestrate(
    user_id: str,
    focus: str,
    history: str,
    vision: str,
    session_id: Optional[str] = None
):
    """
    Main v2.0 Pipeline (Streaming Generator):
    1. Embed 'Focus' + 'History'.
    2. Retrieve Context.
    3. Run Agents in Parallel (Past, Present, Future).
    4. Yield Initial Analysis.
    5. Yield Months 1-6 as they are generated.
    """
    trace_id = str(uuid.uuid4())
    log = logger.bind(trace_id=trace_id, user_id=user_id)
    
    combined_input = f"{focus} {history} {vision}"
    log.info("orchestrate_start (streaming)")
    
    try:
        # 1. Retrieval
        retrieved_memories = []
        embedding = []
        try:
            embedding = await asyncio.to_thread(create_embedding, combined_input)
            if embedding:
                hits = await asyncio.to_thread(vector_store.search_memories, user_id, embedding, 3)
                retrieved_memories = [h["text"] for h in hits]
        except Exception as e:
            log.warning(f"Memory retrieval failed: {e}")

        inputs = {"focus": focus, "history": history, "vision": vision}
        memory_context = {"past_patterns": retrieved_memories if retrieved_memories else ["No past data available yet."]}

        # 2. Sequential Core Agents (using gpt-oss-120b for deep reasoning)
        # Bypassing the concurrency/rate limit issue by sending one combined request
        core_analysis = await _call_agent("CoreAnalysisAgent", inputs, memory_context, model_override="openai/gpt-oss-120b")
        
        past = core_analysis.get("past", {"error": "Failed to parse past"})
        present = core_analysis.get("present", {"error": "Failed to parse present"})
        future = core_analysis.get("future", {"error": "Failed to parse future"})

        # 3. Integration Step 1: Strategy & Month 1
        integration_context = {
            "past_pattern": past.get("pattern_detected", "None"),
            "present_constraint": present.get("primary_constraint", present.get("primary_blocker", "None")),
            "future_risk": future.get("failure_simulation", "None"),
            "energy_level": present.get("energy_level", "Unknown")
        }
        
        log.info("Generating Month 1 Strategy...")
        integration = await _call_agent("IntegrationActionAgent", inputs, integration_context, model_override="openai/gpt-oss-120b")
        
        if "roadmap" not in integration or not integration["roadmap"]:
            integration["roadmap"] = [{
                "phase": "Month 1",
                "theme": "Initiation",
                "expected_result": "Started",
                "weeks": []
            }]

        # Yield Initial Results immediately
        yield {
            "type": "initial",
            "session_id": session_id,
            "past": past,
            "present": present,
            "future": future,
            "integration_meta": {
                "impact_statement": integration.get("impact_statement", ""),
                "mentor_persona": integration.get("mentor_persona", ""),
                "message_from_mentor": integration.get("message_from_mentor", ""),
                "micro_task": integration.get("micro_task", {})
            },
            "first_month": integration["roadmap"][0]
        }

        # 4. Sequential Month Generation (2-6)
        full_roadmap = [integration["roadmap"][0]]
        
        for month_num in range(2, 7):
            success = False
            for attempt in range(2):
                log.info(f"Streaming Month {month_num}...")
                month_context = integration_context.copy()
                last_month = full_roadmap[-1]
                month_context["current_roadmap_progress"] = json.dumps([last_month])
                
                start_week = (month_num - 1) * 4 + 1
                end_week = month_num * 4
                month_inputs = {
                    "focus": f"Generate exactly Month {month_num}. Weeks {start_week}-{end_week}."
                }
                
                month_data = await _call_agent("IntegrationMonthAgent", month_inputs, month_context, model_override="openai/gpt-oss-120b")
                new_month = month_data.get("month_plan") or (month_data.get("roadmap") and month_data["roadmap"][0])
                
                if new_month and "phase" in new_month:
                    full_roadmap.append(new_month)
                    yield {"type": "month", "month": new_month}
                    success = True
                    break
            
            if not success:
                placeholder = {
                    "phase": f"Month {month_num}",
                    "theme": "Continued Momentum",
                    "expected_result": "Scaling habits",
                    "weeks": []
                }
                full_roadmap.append(placeholder)
                yield {"type": "month", "month": placeholder}

        # Final Save to DB/Memory logic would happen in the stream handler in main.py
        if embedding:
            memory_text = f"Focus: {focus}. Plan: {integration.get('impact_statement', '')}"
            asyncio.create_task(asyncio.to_thread(
                vector_store.add_memory, user_id, memory_text, embedding, {"session_id": session_id}
            ))

        log.info("orchestrate_success (streaming complete)")

    except Exception as e:
        log.exception("orchestrate_error")
        raise RuntimeError(f"Orchestrate failed: {e}")