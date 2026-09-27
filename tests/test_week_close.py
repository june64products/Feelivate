"""
A week closes only with its Sunday voice note, and the mentor builds the
next week only when asked.

The production incident these pin: a Week 0 approved on a Sunday counted as
"complete" the moment it was locked (today >= end), so "I don't know how to
do any of these exercises" was answered with a brand-new Week 1.

The mentor model is replaced by a scripted fake; everything else — the
session, the plan window, the guards, the journal — runs for real on a
throwaway SQLite database.
"""

import io
import json
import os
from datetime import date, timedelta

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-weekclose-db")
    os.environ["APP_ENV"] = "development"
    os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-used-anywhere-real"
    os.environ["DATABASE_URL"] = ""
    os.environ.pop("QDRANT_URL", None)
    os.environ.pop("QDRANT_API_KEY", None)

    cwd = os.getcwd()
    os.chdir(workdir)
    try:
        from fastapi.testclient import TestClient

        from app.database import init_db
        from app.main import app
        from app.ratelimit import LIMITERS, SlidingWindowLimiter

        for bucket in ("signup", "login", "howto"):
            LIMITERS[bucket] = SlidingWindowLimiter(1000, 3600)
        init_db()
        yield TestClient(app)
    finally:
        os.chdir(cwd)


@pytest.fixture(autouse=True)
def quiet_side_channels(client, monkeypatch):
    """No embeddings, no title generation, no guardrail classifier network call.

    Depends on `client` so the app is imported only after the fixture has
    moved into the throwaway directory — importing it first would bind the
    engine to whatever SQLite file sits in the project root.
    """
    import app.llm as llm
    import app.main as main
    from app import guardrail

    monkeypatch.setattr(llm, "create_embedding", lambda *_a, **_k: None)
    monkeypatch.setattr(main, "_generate_and_save_title", lambda *_a, **_k: None)
    monkeypatch.setattr(guardrail, "screen", lambda *_a, **_k: guardrail.ALLOWED)


class FakeMentor:
    """Answers the chat model's calls from a script and records what it was asked."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def __call__(self, messages, **kwargs):
        self.calls.append(messages)
        return self.replies.pop(0) if len(self.replies) > 1 else self.replies[0]


def plan_json(week_number, start_iso, days):
    return json.dumps({
        "week_number": week_number,
        "theme": f"Week {week_number}",
        "start_date": start_iso,
        "days": [{"day": d, "action": f"Push-ups 3x12 and a 20 minute walk ({d})"} for d in days],
    })


def next_week_reply():
    return json.dumps({
        "reply": "Here's your Week 1 — a step up from last Sunday.",
        "plan": {"week_number": 1, "theme": "Step up", "days": [
            {"day": "Mon", "action": "Push-ups 3x15 and squats 3x15"},
            {"day": "Tue", "action": "Rest day — walk 20 minutes"},
        ]},
    })


PLAIN_ANSWER = "A push-up: hands under shoulders, body straight, lower until the chest nearly touches, press up."


def register(client, email):
    body = client.get("/legal/consents").json()
    consents = {i["key"]: True for i in body["catalogue"] if i["required"]}
    resp = client.post("/signup", json={"email": email, "password": "correct-horse-battery", "name": "t", "consents": consents})
    assert resp.status_code == 200, resp.text
    b = resp.json()
    return {"Authorization": f"Bearer {b['access_token']}"}, b["user_id"]


def last_sunday(before_or_on: date) -> date:
    return before_or_on - timedelta(days=(before_or_on.weekday() + 1) % 7)


def make_locked_week(user_id, sid, start: date, week_number=0):
    """A session whose Week `week_number` is locked with a plan that starts on `start`."""
    from app.database import SessionLocal
    from app.models import Session as UserSession

    end = start + timedelta(days=6 - start.weekday())
    days = [(start + timedelta(days=i)).strftime("%b %d (%a)") for i in range((end - start).days + 1)]
    db = SessionLocal()
    db.add(UserSession(
        id=sid, user_id=user_id, focus="get fit at home", history="", vision="",
        phase="active", current_week=week_number, plan_start_date=start.isoformat(),
        week_plan_json=plan_json(week_number, start.isoformat(), days),
        result_json=json.dumps([json.loads(plan_json(week_number, start.isoformat(), days))]),
    ))
    db.commit()
    db.close()
    return start.isoformat(), end.isoformat()


def add_closing_note(user_id, sid, day_iso):
    from app.database import SessionLocal
    from app.models import VoiceJournal

    db = SessionLocal()
    db.add(VoiceJournal(user_id=user_id, session_id=sid, date=day_iso, transcript="the week went fine", emotion_label="calm", emotion_score=6))
    db.commit()
    db.close()


def chat(client, headers, user_id, sid, text):
    resp = client.post("/chat", json={"message": text, "session_id": sid, "user_id": user_id, "timezone": "UTC"}, headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


def session_state(sid):
    from app.database import SessionLocal
    from app.models import Session as UserSession

    db = SessionLocal()
    s = db.query(UserSession).filter(UserSession.id == sid).first()
    out = (s.phase, s.current_week)
    db.close()
    return out


# ── Asking for the next week ────────────────────────────────────────────────

@pytest.mark.parametrize("text,asked", [
    ("build week 2", True),
    ("plan next week", True),
    ("next week ka plan banao", True),
    ("agle hafte ka plan", True),
    ("I've reviewed my week report. Please build me Week 2 plan based on my performance data", True),
    ("make me a new plan", True),
    ("I dont know how to do any of these exercises", False),
    ("still i dont get what you said", False),
    ("done", False),
    ("how do I build muscle at home", False),
    ("I don't understand this plan", False),
])
def test_what_counts_as_asking_for_the_next_week(text, asked):
    from app.main import _asks_for_next_week

    assert _asks_for_next_week(text) is asked


def test_agreeing_to_the_mentors_offer_counts():
    from app.main import _asks_for_next_week

    assert _asks_for_next_week("yes please", "Want me to build Week 2 now?") is True
    assert _asks_for_next_week("yes please", "Great push-up form matters more than reps.") is False


# ── The incident ────────────────────────────────────────────────────────────

def test_closed_week_plain_question_is_answered_not_replanned(client, monkeypatch):
    """Week 0 is closed (its Sunday note is in). A confused question must get an
    answer, not Week 1 — even when the model's first instinct is a plan."""
    import app.llm as llm

    headers, uid = register(client, "closed@example.com")
    sid = "closed-week"
    start_iso, end_iso = make_locked_week(uid, sid, last_sunday(date.today()))
    add_closing_note(uid, sid, end_iso)

    mentor = FakeMentor(next_week_reply(), json.dumps({"reply": PLAIN_ANSWER, "plan": None}))
    monkeypatch.setattr(llm, "call_with_fallback_chain", mentor)

    out = chat(client, headers, uid, sid, "I dont know how to do any of these exercises")
    assert out.get("plan") is None
    assert out["reply"] == PLAIN_ANSWER
    assert len(mentor.calls) == 2, "the model is asked once more, with the correction"
    assert "did NOT ask for a new week" in mentor.calls[1][-1]["content"]
    assert session_state(sid) == ("active", 0), "nothing about the locked week changed"


def test_closed_week_explicit_ask_builds_the_next_week(client, monkeypatch):
    import app.llm as llm

    headers, uid = register(client, "asked@example.com")
    sid = "closed-week-asked"
    _, end_iso = make_locked_week(uid, sid, last_sunday(date.today()))
    add_closing_note(uid, sid, end_iso)

    mentor = FakeMentor(next_week_reply())
    monkeypatch.setattr(llm, "call_with_fallback_chain", mentor)

    out = chat(client, headers, uid, sid, "build week 1")
    assert out.get("plan") and out["plan"]["week_number"] == 1
    assert len(mentor.calls) == 1
    assert session_state(sid) == ("planning", 1)


def test_days_over_but_no_closing_note_asks_for_the_voice_note(client, monkeypatch):
    """The calendar moved on but the Sunday note was never recorded: the week is
    not closed, so even an explicit ask gets the voice-note nudge, not a plan."""
    import app.llm as llm

    headers, uid = register(client, "open@example.com")
    sid = "open-week"
    make_locked_week(uid, sid, last_sunday(date.today()) - timedelta(days=14))

    mentor = FakeMentor(next_week_reply())
    monkeypatch.setattr(llm, "call_with_fallback_chain", mentor)

    out = chat(client, headers, uid, sid, "build week 1")
    assert out.get("plan") is None
    assert "voice note" in out["reply"].lower()
    assert session_state(sid) == ("active", 0)

    # The prompt told the model the same thing.
    system_text = "\n".join(m["content"] for m in mentor.calls[0] if m["role"] == "system")
    assert "NOT CLOSED" in system_text and "voice note" in system_text

    info = client.get(f"/sessions/{sid}/week-info?client_date={date.today().isoformat()}", headers=headers).json()
    assert info["week_over"] is True
    assert info["closing_journal_recorded"] is False
    assert info["is_week_complete"] is False


def test_week_info_closes_with_the_sunday_note_and_report_waits_for_it(client):
    headers, uid = register(client, "info@example.com")
    sid = "info-week"
    _, end_iso = make_locked_week(uid, sid, last_sunday(date.today()) - timedelta(days=7))
    today = date.today().isoformat()

    report = client.get(f"/journal/{uid}/weekly-report?session_id={sid}&client_date={today}", headers=headers).json()
    assert report["status"] == "in_progress" and report.get("needs_closing_note") is True

    add_closing_note(uid, sid, end_iso)
    info = client.get(f"/sessions/{sid}/week-info?client_date={today}", headers=headers).json()
    assert info["closing_journal_recorded"] is True and info["is_week_complete"] is True


def test_late_closing_note_is_filed_on_the_weeks_last_day(client, monkeypatch):
    import app.llm as llm
    import app.main as main

    headers, uid = register(client, "late@example.com")
    sid = "late-week"
    _, end_iso = make_locked_week(uid, sid, last_sunday(date.today()) - timedelta(days=7))

    monkeypatch.setattr(llm, "call_groq_transcribe", lambda *_a, **_k: "Honestly the week was uneven but I showed up.")

    async def fake_emotion(_t):
        return {"label": "reflective", "score": 6, "one_liner": "uneven but present"}

    monkeypatch.setattr(main, "_analyze_emotion", fake_emotion)

    today = date.today().isoformat()
    resp = client.post(
        f"/journal/voice?session_id={sid}&client_date={today}&journal_date={end_iso}",
        files={"audio": ("journal.webm", io.BytesIO(b"fake-audio-bytes"), "audio/webm")},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["date"] == end_iso and body["closing_note"] is True and body["recorded_today"] is False

    from app.database import SessionLocal
    from app.models import DailyCheckin, VoiceJournal

    db = SessionLocal()
    assert db.query(VoiceJournal).filter(VoiceJournal.session_id == sid, VoiceJournal.date == end_iso).count() == 1
    assert db.query(DailyCheckin).filter(DailyCheckin.user_id == uid, DailyCheckin.date == end_iso).count() == 0, \
        "a late note reflects on the week; it does not mark that day's task done"
    db.close()

    info = client.get(f"/sessions/{sid}/week-info?client_date={today}", headers=headers).json()
    assert info["is_week_complete"] is True

    # journal_date is only honoured for the week's last day; anything else files under today.
    resp = client.post(
        f"/journal/voice?session_id={sid}&client_date={today}&journal_date=2020-01-01",
        files={"audio": ("journal.webm", io.BytesIO(b"fake-audio-bytes"), "audio/webm")},
        headers=headers,
    )
    assert resp.json()["date"] == today


# ── How do I do this? ───────────────────────────────────────────────────────

GUIDE = json.dumps({
    "summary": "A short strength day.",
    "items": [
        {"name": "Push-ups 3x12", "steps": ["1. Hands under shoulders", "2) Body in one line", "Step 3: Lower, then press up"], "mistakes": ["Hips sagging"], "easier": "Knees on the floor"},
        {"name": "20 minute walk", "steps": ["Shoes on", "Walk at a pace where talking is slightly hard"], "mistakes": [], "easier": None},
    ],
    "bare_minimum": "One set of push-ups and a 10 minute walk.",
    "time_minutes": 30,
})


def test_howto_is_generated_once_then_served_from_the_store(client, monkeypatch):
    import app.llm as llm

    headers, uid = register(client, "howto@example.com")
    sid = "howto-week"
    make_locked_week(uid, sid, last_sunday(date.today()))

    mentor = FakeMentor(GUIDE)
    monkeypatch.setattr(llm, "call_with_fallback_chain", mentor)

    body = {"action": "Push-ups 3x12 and a 20 minute walk", "day_label": "Sep 28 (Mon)"}
    first = client.post(f"/sessions/{sid}/howto", json=body, headers=headers)
    assert first.status_code == 200, first.text
    guide = first.json()
    assert guide["cached"] is False
    assert [i["name"] for i in guide["items"]] == ["Push-ups 3x12", "20 minute walk"]
    assert guide["items"][0]["steps"] == ["Hands under shoulders", "Body in one line", "Lower, then press up"], "model numbering is stripped"
    assert guide["items"][0]["easier"] == "Knees on the floor"
    assert guide["bare_minimum"].startswith("One set")

    second = client.post(f"/sessions/{sid}/howto", json=body, headers=headers).json()
    assert second["cached"] is True and second["items"] == guide["items"]
    assert len(mentor.calls) == 1, "the second open costs nothing"

    # A different day's text is a different guide.
    third = client.post(f"/sessions/{sid}/howto", json={"action": "Squats 3x15 and plank 3x30s"}, headers=headers).json()
    assert third["cached"] is False and len(mentor.calls) == 2


def test_howto_refuses_empty_tasks_and_other_peoples_sessions(client, monkeypatch):
    import app.llm as llm

    headers, uid = register(client, "howto2@example.com")
    sid = "howto2-week"
    make_locked_week(uid, sid, last_sunday(date.today()))
    monkeypatch.setattr(llm, "call_with_fallback_chain", FakeMentor(GUIDE))

    assert client.post(f"/sessions/{sid}/howto", json={"action": "Rest"}, headers=headers).status_code == 400

    other_headers, _ = register(client, "howto3@example.com")
    assert client.post(f"/sessions/{sid}/howto", json={"action": "Push-ups 3x12 and a walk"}, headers=other_headers).status_code == 404


def test_howto_reports_a_model_failure_honestly(client, monkeypatch):
    import app.llm as llm

    headers, uid = register(client, "howto4@example.com")
    sid = "howto4-week"
    make_locked_week(uid, sid, last_sunday(date.today()))
    monkeypatch.setattr(llm, "call_with_fallback_chain", FakeMentor("Sure! Here is how you do it: ..."))

    resp = client.post(f"/sessions/{sid}/howto", json={"action": "Push-ups 3x12 and a walk"}, headers=headers)
    assert resp.status_code == 503
