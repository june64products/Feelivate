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

        # 3. Integration (The Architect) - Iterative Generation
        # ---------------------------------------------------
        integration_context = {
            "past_pattern": past.get("pattern_detected", "None"),
            "present_constraint": present.get("primary_constraint", "None"),
            "future_risk": future.get("failure_simulation", "None"),
            "energy_level": present.get("energy_level", "Unknown")
        }
        
        # Step 3a: Generate Month 1 (and overall strategy)
        log.info("Generating Month 1 Strategy...")
        # Deep reasoning models need large output buffers
        integration = await _call_agent("IntegrationActionAgent", inputs, integration_context)
        
        # Step 3b: Iterative Generation for Months 2-6
        if "roadmap" not in integration:
            integration["roadmap"] = []
            
        # We expect IntegrationActionAgent to return Month 1 inside the roadmap array.
        # Ensure we have at least one month, or create a placeholder if it failed.
        if len(integration["roadmap"]) == 0:
             integration["roadmap"].append({
                 "phase": "Month 1",
                 "theme": "Initiation",
                 "expected_result": "Started",
                 "weeks": []
             })
             
        for month_num in range(2, 7):
            success = False
            for attempt in range(2): # Simple retry
                log.info(f"Iteratively generating Month {month_num} (Attempt {attempt + 1})...")
                month_context = integration_context.copy()
                # Only pass the last generated month to keep context small and avoid JSON parsing failures
                last_month = integration["roadmap"][-1] if integration["roadmap"] else {}
                month_context["current_roadmap_progress"] = json.dumps([last_month])
                month_context["target_month"] = f"Month {month_num}"
                
                # Calculate correct week numbering
                start_week = (month_num - 1) * 4 + 1
                end_week = month_num * 4
                
                month_inputs = {
                    "focus": f"Generate exactly Month {month_num}. You MUST label the weeks sequentially as Week {start_week}, Week {start_week+1}, Week {start_week+2}, and Week {end_week}. Follow the 4-week, 7-day breakdown format."
                }
                month_data = await _call_agent("IntegrationMonthAgent", month_inputs, month_context)
                
                new_month = None
                if "month_plan" in month_data and isinstance(month_data["month_plan"], dict):
                    new_month = month_data["month_plan"]
                elif "roadmap" in month_data and isinstance(month_data["roadmap"], list) and len(month_data["roadmap"]) > 0:
                     new_month = month_data["roadmap"][0]
                
                if new_month and "phase" in new_month:
                    integration["roadmap"].append(new_month)
                    success = True
                    break
                else:
                    log.warning(f"Attempt {attempt + 1} failed for Month {month_num}")
            
            if not success:
                log.error(f"Failed to generate valid JSON for Month {month_num} after retries. Adding placeholder.")
                integration["roadmap"].append({
                    "phase": f"Month {month_num}",
                    "theme": "Growth and Consolidation",
                    "expected_result": "Continued progress on focus area",
                    "weeks": []
                })

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