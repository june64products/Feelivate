import json


def test_llm_mock(monkeypatch):
    from app import llm

    def fake_call(prompt, **kwargs):
        return json.dumps({"agent": "PresentEmotionAgent", "focus_period": "present", "state_summary": "ok"})

    monkeypatch.setattr(llm, "call_llm", fake_call)
    out = llm.call_llm("test")
    assert "state_summary" in out