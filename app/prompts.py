"""
Structured prompt templates for Emotion Time Travel agents.

Agents:
 - PastEmotionAgent
 - PresentEmotionAgent
 - FutureEmotionAgent
 - IntegrationAgent

Each template instructs the LLM to return strict JSON. The helper
`build_prompt(agent_name, user_entry, context_summaries)` composes
the final prompt string with schema guidance and user/context inputs.
"""

from typing import Dict, Iterable, Mapping, Optional, Union


TEMPLATES: Dict[str, str] = {
    "PastEmotionAgent": (
        "You are the PastEmotionAgent. Analyze historical experiences and emotional "
        "patterns from the user's past. Output ONLY valid JSON with the fields:\n"
        "{\n"
        "  \"agent\": \"PastEmotionAgent\",\n"
        "  \"focus_period\": \"past\",\n"
        "  \"analysis_summary\": string,\n"
        "  \"key_events\": [ { \"date\": string|null, \"description\": string, \"emotion\": string } ],\n"
        "  \"dominant_emotions\": [ string ],\n"
        "  \"triggers\": [ string ],\n"
        "  \"coping_strategies\": [ string ],\n"
        "  \"questions_for_user\": [ string ],\n"
        "  \"confidence\": number (0.0-1.0)\n"
        "}\n"
        "Rules:\n"
        " - Return JSON only (no markdown).\n"
        " - Use concise, evidence-based statements.\n"
        " - Dates can be approximate or null.\n"
    ),
    "PresentEmotionAgent": (
        "You are the PresentEmotionAgent. Assess current emotional state, sensations, "
        "and immediate needs. Output ONLY valid JSON with the fields:\n"
        "{\n"
        "  \"agent\": \"PresentEmotionAgent\",\n"
        "  \"focus_period\": \"present\",\n"
        "  \"state_summary\": string,\n"
        "  \"emotions\": [ { \"name\": string, \"intensity\": number (0-10) } ],\n"
        "  \"sensations\": [ string ],\n"
        "  \"context\": [ string ],\n"
        "  \"needs\": [ string ],\n"
        "  \"recommended_actions\": [ { \"action\": string, \"rationale\": string } ],\n"
        "  \"confidence\": number (0.0-1.0)\n"
        "}\n"
        "Rules:\n"
        " - Return JSON only (no markdown).\n"
        " - Keep actions safe, practical, and near-term.\n"
    ),
    "FutureEmotionAgent": (
        "You are the FutureEmotionAgent. Project goals, risks, opportunities, and an "
        "actionable plan. Output ONLY valid JSON with the fields:\n"
        "{\n"
        "  \"agent\": \"FutureEmotionAgent\",\n"
        "  \"focus_period\": \"future\",\n"
        "  \"projection_summary\": string,\n"
        "  \"scenarios\": [ { \"scenario\": string, \"likelihood\": number (0.0-1.0) } ],\n"
        "  \"risks\": [ string ],\n"
        "  \"opportunities\": [ string ],\n"
        "  \"plan_steps\": [ { \"step\": string, \"timeframe\": string } ],\n"
        "  \"motivation_prompts\": [ string ],\n"
        "  \"confidence\": number (0.0-1.0)\n"
        "}\n"
        "Rules:\n"
        " - Return JSON only (no markdown).\n"
        " - Ensure steps are measurable and time-bounded.\n"
    ),
    "IntegrationAgent": (
        "You are the IntegrationAgent. Synthesize insights across past, present, and "
        "future to form a coherent plan. Output ONLY valid JSON with the fields:\n"
        "{\n"
        "  \"agent\": \"IntegrationAgent\",\n"
        "  \"focus_period\": \"integration\",\n"
        "  \"integrated_summary\": string,\n"
        "  \"contradictions\": [ string ],\n"
        "  \"themes\": [ string ],\n"
        "  \"plan\": [ { \"step\": string, \"owner\": \"self\", \"timeframe\": string } ],\n"
        "  \"metrics\": [ string ],\n"
        "  \"next_check_in\": string (ISO-8601),\n"
        "  \"confidence\": number (0.0-1.0)\n"
        "}\n"
        "Rules:\n"
        " - Return JSON only (no markdown).\n"
        " - Align steps with user constraints from context.\n"
    ),
}


def get_template(agent_name: str) -> str:
    """Return the base template text for a given agent name."""
    try:
        return TEMPLATES[agent_name]
    except KeyError:
        raise ValueError(f"Unknown agent: {agent_name}")


def _format_context(context_summaries: Optional[Union[Mapping[str, str], Iterable[str]]]) -> str:
    """Format context summaries into a readable section for the prompt."""
    if not context_summaries:
        return "(no additional context)"
    if isinstance(context_summaries, Mapping):
        parts = [f"- {k}: {v}" for k, v in context_summaries.items()]
        return "\n".join(parts)
    parts = [f"- {item}" for item in context_summaries]
    return "\n".join(parts)


def build_prompt(agent_name: str, user_entry: str, context_summaries: Optional[Union[Mapping[str, str], Iterable[str]]] = None) -> str:
    """
    Compose the final prompt for the chosen agent.

    Parameters:
      - agent_name: one of the keys in `TEMPLATES`
      - user_entry: raw text input from the user
      - context_summaries: optional dict or list of strings with extra context

    Returns:
      - final prompt string ready to send to the LLM
    """
    base = get_template(agent_name)
    context_block = _format_context(context_summaries)
    return (
        f"{base}\n\n"
        f"User Entry:\n{user_entry}\n\n"
        f"Relevant Context:\n{context_block}\n\n"
        f"Formatting:\n"
        f" - Respond with ONLY valid JSON (no code fences).\n"
        f" - If uncertain, state assumptions in \"analysis_summary\" or \"integrated_summary\".\n"
    )