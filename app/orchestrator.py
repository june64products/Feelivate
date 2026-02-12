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


def _parse_json(text: str) -> Dict[str, Any]:
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


async def _call_agent(agent_name: str, inputs: Dict[str, str], context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    try:
        # Build prompt with specific inputs and retrieved context
        prompt_text = build_prompt(agent_name, inputs, context)
        
        timer = AgentTimer(agent_name)
        AGENT_CALLS_TOTAL.labels(agent=agent_name).inc()
        
        logger.info(f"Calling agent: {agent_name}")
        # Call LLM (IO bound, run in thread)
        text = await asyncio.to_thread(call_llm, prompt_text)
        
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
) -> Dict[str, Any]:
    """
    Main v2.0 Pipeline:
    1. Embed 'Focus' + 'History'.
    2. Retrieve Context (Strictly filtered by user_id).
    3. Run Agents in Parallel (Past, Present, Future).
    4. Run Integration Agent (with Constraint Logic).
    5. Save new memory.
    """
    trace_id = str(uuid.uuid4())
    log = logger.bind(trace_id=trace_id, user_id=user_id)
    
    # Combined text for embedding (Capture the "Vibe")
    combined_input = f"{focus} {history} {vision}"
    
    log.info("orchestrate_start")
    
    try:
        # 1. Memory Retrieval (Pattern Hunting)
        # -------------------------------------
        # We embed the current focus/history to find similar past issues.
        # CRITICAL: specific user_id is passed to search_memories to prevent data leak.
        retrieved_memories = []
        embedding = []
        try:
            embedding = await asyncio.to_thread(create_embedding, combined_input)
            if embedding:
                # Retrieve top 3 past memories
                hits = await asyncio.to_thread(vector_store.search_memories, user_id, embedding, 3)
                retrieved_memories = [h["text"] for h in hits]
                log.info(f"Retrieved {len(hits)} past memories")
        except Exception as e:
            log.warning(f"Memory retrieval failed: {e}")

        # Prepare context for agents
        inputs = {
            "focus": focus,
            "history": history,
            "vision": vision
        }
        
        memory_context = {
            "past_patterns": retrieved_memories if retrieved_memories else ["No past data available yet."]
        }

        # 2. Parallel Agent Execution
        # ---------------------------
        # Past -> Pattern Hunter
        # Present -> Constraint Analyst
        # Future -> Scenario Simulator
        past_task = _call_agent("PastPatternAgent", inputs, memory_context)
        present_task = _call_agent("PresentConstraintAgent", inputs, memory_context)
        future_task = _call_agent("FutureSimulatorAgent", inputs, memory_context)

        past, present, future = await asyncio.gather(past_task, present_task, future_task)

        # 3. Integration (The Architect)
        # ------------------------------
        integration_context = {
            "past_pattern": past.get("pattern_detected", "None"),
            "present_constraint": present.get("primary_constraint", "None"),
            "future_risk": future.get("failure_simulation", "None"),
            "energy_level": present.get("energy_level", "Unknown")
        }
        
        integration = await _call_agent("IntegrationActionAgent", inputs, integration_context)

        result = {
            "past": past,
            "present": present,
            "future": future,
            "integration": integration,
            "trace_id": trace_id,
        }

        # 4. Save to Memory (Async background)
        # ------------------------------------
        if embedding:
            # We save the *Action Plan* and the *Focus* as the memory for next time
            memory_text = f"Focus: {focus}. Plan: {integration.get('impact_statement', '')}"
            asyncio.create_task(asyncio.to_thread(
                vector_store.add_memory, 
                user_id, 
                memory_text, 
                embedding, 
                {"session_id": session_id}
            ))

        log.info("orchestrate_success")
        return result

    except Exception as e:
        log.exception("orchestrate_error")
        raise RuntimeError(f"Orchestrate failed: {e}")