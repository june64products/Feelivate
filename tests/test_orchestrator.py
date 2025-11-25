import asyncio
import json
import unittest


def _stub_call_llm(prompt: str, system=None, temperature=0.7, max_tokens=500) -> str:
    if "\"agent\": \"PastEmotionAgent\"" in prompt:
        return json.dumps({
            "agent": "PastEmotionAgent",
            "focus_period": "past",
            "analysis_summary": "past summary",
            "key_events": [],
            "dominant_emotions": [],
            "triggers": [],
            "coping_strategies": [],
            "questions_for_user": [],
            "confidence": 0.9,
        })
    if "\"agent\": \"PresentEmotionAgent\"" in prompt:
        return json.dumps({
            "agent": "PresentEmotionAgent",
            "focus_period": "present",
            "state_summary": "present",
            "emotions": [],
            "sensations": [],
            "context": [],
            "needs": [],
            "recommended_actions": [],
            "confidence": 0.8,
        })
    if "\"agent\": \"FutureEmotionAgent\"" in prompt:
        return json.dumps({
            "agent": "FutureEmotionAgent",
            "focus_period": "future",
            "projection_summary": "future",
            "scenarios": [],
            "risks": [],
            "opportunities": [],
            "plan_steps": [],
            "motivation_prompts": [],
            "confidence": 0.7,
        })
    if "\"agent\": \"IntegrationAgent\"" in prompt:
        return json.dumps({
            "agent": "IntegrationAgent",
            "focus_period": "integration",
            "integrated_summary": "ok",
            "contradictions": [],
            "themes": [],
            "plan": [],
            "metrics": [],
            "next_check_in": "2025-01-01T00:00:00Z",
            "confidence": 0.6,
        })
    return "{}"


class TestOrchestrator(unittest.TestCase):
    def test_orchestrate_with_stub(self):
        import app.orchestrator as orch

        orig = orch.call_llm
        try:
            orch.call_llm = _stub_call_llm
            result = asyncio.run(orch.orchestrate("entry"))
            self.assertIn("past", result)
            self.assertIn("present", result)
            self.assertIn("future", result)
            self.assertIn("integration", result)
            self.assertIn("trace_id", result)
        finally:
            orch.call_llm = orig


if __name__ == "__main__":
    unittest.main()