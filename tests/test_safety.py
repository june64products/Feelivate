"""Crisis detection: it must fire on real risk without firing on ordinary
accountability frustration, which in this product is the far more common
phrasing."""

import pytest

from app.safety import CRISIS_RESOURCES, crisis_payload, detect_crisis


MUST_DETECT = [
    "I want to kill myself",
    "I don't want to live anymore",
    "thinking about suicide",
    "kms honestly",
    "I've been cutting myself again",
    "there's no point in living",
    "I can't do this anymore, I don't want to be alive",
    # Hinglish / romanised Hindi — an English-only screen would miss these
    "mai mar jaunga",
    "jeene ka mann nahi hai",
    "khudkushi kar lunga",
]

MUST_NOT_DETECT = [
    "I can't do this anymore, this plan is too hard",
    "I want to kill this bad habit",
    "this workout is killing me",
    "what's the point of week 3",
    "feeling hopeless about my deadline",
    "Today was great, finished my task",
    "I'm dead tired after that run",
    "",
    None,
]


@pytest.mark.parametrize("text", MUST_DETECT)
def test_detects_crisis_language(text):
    assert detect_crisis(text) is True


@pytest.mark.parametrize("text", MUST_NOT_DETECT)
def test_ignores_ordinary_frustration(text):
    assert detect_crisis(text) is False


def test_ambiguous_phrase_needs_life_context():
    """The same clause flips on whether the message is about life or a plan."""
    assert detect_crisis("I can't go on, life isn't worth it") is True
    assert detect_crisis("I can't go on with this week's schedule") is False


def test_payload_carries_actionable_resources():
    payload = crisis_payload()
    assert payload["type"] == "crisis_support"
    assert payload["resources"] == CRISIS_RESOURCES
    assert payload["resources"], "crisis card must never render empty"
    for resource in payload["resources"]:
        assert resource["name"] and resource["contact"]
