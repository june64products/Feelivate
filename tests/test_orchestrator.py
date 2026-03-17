import asyncio
import json
import unittest


def _stub_call_llm(prompt: str, **kwargs) -> str:
    if "PastPatternAgent" in prompt:
        return json.dumps({
            "agent": "PastPatternAgent",
            "focus_period": "past",
            "pattern_detected": "pattern",
            "predicted_context": "predicted",
            "contradiction": "none",
            "key_failure_point": "none",
            "origin_story": "origin",
            "confidence": 0.9,
        })
    if "PresentConstraintAgent" in prompt:
        return json.dumps({
            "agent": "PresentConstraintAgent",
            "focus_period": "present",
            "primary_blocker": "blocker",
            "primary_constraint": "constraint",
            "energy_level": "High",
            "emotional_blocker": "none",
            "weekly_cost_estimate": "0 hours",
            "physical_reframe": "reframe",
            "needs_micro_task": False,
            "confidence": 0.8,
        })
    if "FutureSimulatorAgent" in prompt:
        return json.dumps({
            "agent": "FutureSimulatorAgent",
            "focus_period": "future",
            "failure_simulation": "failure",
            "success_simulation": "success",
            "impact_on_life": "impact",
            "confidence": 0.7,
        })
    if "IntegrationActionAgent" in prompt:
        return json.dumps({
            "agent": "IntegrationActionAgent",
            "impact_statement": "statement",
            "mentor_persona": "persona",
            "message_from_mentor": "msg",
            "micro_task": {"title": "t", "description": "d", "reward": "r"},
            "roadmap": [
                {
                    "phase": "Month 1",
                    "theme": "theme",
                    "expected_result": "result",
                    "weeks": [{"week": "Week 1", "focus": "f", "outcome": "o", "win_condition": "w", "days": []}]
                }
            ]
        })
    if "IntegrationMonthAgent" in prompt:
        return json.dumps({
            "month_plan": {
                "phase": "Month X",
                "theme": "theme",
                "expected_result": "result",
                "weeks": []
            }
        })
    return "{}"


class TestOrchestrator(unittest.TestCase):
    def test_orchestrate_with_stub(self):
        import app.orchestrator as orch

        orig = orch.call_llm
        try:
            orch.call_llm = _stub_call_llm
            chunks = []
            
            async def run_test():
                async for chunk in orch.orchestrate("user123", "focus", "history", "vision"):
                    chunks.append(chunk)

            asyncio.run(run_test())
            
            self.assertGreater(len(chunks), 0)
            self.assertEqual(chunks[0]["type"], "initial")
            self.assertIn("past", chunks[0])
            self.assertIn("present", chunks[0])
            self.assertIn("future", chunks[0])
            self.assertIn("first_month", chunks[0])
            
            # Check for subsequent months
            month_chunks = [c for c in chunks if c["type"] == "month"]
            self.assertEqual(len(month_chunks), 5) # Months 2-6
            
        finally:
            orch.call_llm = orig


if __name__ == "__main__":
    unittest.main()