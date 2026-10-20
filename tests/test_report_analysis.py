"""
The weekly review reads everything the person recorded.

Every voice journal goes to the model complete — not its first 600 characters
— through two passes: an evidence sheet that retells each entry, then the
review written from that sheet and the transcripts. The pull-quote and each
day's key line must be sentences the person actually said. A day's emotion is
judged from the whole entry. And the mentor, building the next week, is
handed the whole review, not a digest of it.
"""

import asyncio
import json
import os
from datetime import date, timedelta

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-report-db")
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

        for bucket in ("signup", "login", "chat"):
            LIMITERS[bucket] = SlidingWindowLimiter(1000, 3600)

        init_db()
        yield TestClient(app)
    finally:
        os.chdir(cwd)


@pytest.fixture(autouse=True)
def quiet_side_channels(client, monkeypatch):
    import app.llm as llm
    import app.main as main
    from app import guardrail

    monkeypatch.setattr(llm, "create_embedding", lambda *_a, **_k: None)
    monkeypatch.setattr(main, "_generate_and_save_title", lambda *_a, **_k: None)
    monkeypatch.setattr(guardrail, "screen", lambda *_a, **_k: guardrail.ALLOWED)


def register(client, email):
    body = client.get("/legal/consents").json()
    consents = {i["key"]: True for i in body["catalogue"] if i["required"]}
    resp = client.post("/signup", json={"email": email, "password": "correct-horse-battery", "name": "t", "consents": consents})
    assert resp.status_code == 200, resp.text
    b = resp.json()
    return {"Authorization": f"Bearer {b['access_token']}"}, b["user_id"]


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def locked_week(user_id, sid, start: date, week_number=1):
    """A session with Week `week_number` locked from `start` (a Monday)."""
    from app.database import SessionLocal
    from app.models import Session as UserSession

    end = start + timedelta(days=6 - start.weekday())
    days = [(start + timedelta(days=i)).strftime("%b %d (%a)") for i in range((end - start).days + 1)]
    plan = {"week_number": week_number, "theme": "First Keys", "start_date": start.isoformat(),
            "days": [{"day": d, "action": f"Ten minutes at the piano ({d})"} for d in days]}
    db = SessionLocal()
    db.add(UserSession(
        id=sid, user_id=user_id, focus="learn the piano", history="", vision="play one song for my mother",
        phase="active", current_week=week_number, plan_start_date=start.isoformat(),
        week_plan_json=json.dumps(plan), result_json=json.dumps([plan]), commitment_why="I promised her years ago.",
    ))
    db.commit()
    db.close()
    return start.isoformat(), end.isoformat()


# A long entry whose most important sentence is near the END — past the 600
# characters the review used to read, and past the 800 the emotion label used.
OPENING = ("Okay so today was the first proper day at the piano and honestly it started badly. "
           "I sat down after breakfast, the stool was too low, I kept hitting the wrong keys, "
           "and I nearly gave up twice before ten minutes were over. ") * 5
TAIL = "By the end of the ten minutes I found middle C and sat properly, and I was grinning like an idiot."
MONDAY_ENTRY = OPENING + TAIL
assert len(OPENING) > 900, "the tail must sit well past both old cut-offs"

WEDNESDAY_ENTRY = "Short one tonight. Five-finger exercise was clumsy but I did the full ten minutes. Clumsy means fast, I think."
SUNDAY_ENTRY = "Did the whole first line after skipping three days. Tired, but it is actually a tune now."


def add_journal(uid, sid, day, transcript, label, score, one_liner):
    from app.database import SessionLocal
    from app.models import VoiceJournal

    db = SessionLocal()
    db.add(VoiceJournal(user_id=uid, session_id=sid, date=day, transcript=transcript, emotion_label=label, emotion_score=score, one_liner=one_liner))
    db.commit()
    db.close()


def seed_last_week(client, email, sid):
    headers, uid = register(client, email)
    start = monday_of(date.today()) - timedelta(days=7)
    ws, we = locked_week(uid, sid, start)
    mid = (start + timedelta(days=2)).isoformat()
    add_journal(uid, sid, ws, MONDAY_ENTRY, "frustrated", 4, "Rough start at the piano.")
    add_journal(uid, sid, mid, WEDNESDAY_ENTRY, "focused", 6, "Clumsy but complete.")
    add_journal(uid, sid, we, SUNDAY_ENTRY, "drained", 4, "Played the first line, tired.")
    return headers, uid, ws, mid, we


def evidence_json(ws, mid, we, key_line=TAIL):
    return json.dumps({
        "days": [
            {"date": ws, "said_in_short": "Started badly, stool too low, nearly quit twice, then found middle C and sat properly.", "did": "Did the ten minutes.", "felt": "started frustrated, ended grinning", "why": "the stool and the wrong keys", "key_line": key_line, "friction": ["stool too low"], "win": "found middle C"},
            {"date": mid, "said_in_short": "Five-finger exercise, clumsy, full ten minutes.", "did": "Did the exercise.", "felt": "focused", "why": "not stated", "key_line": "Clumsy means fast, I think.", "friction": [], "win": "full ten minutes"},
            {"date": we, "said_in_short": "Played the first line after three skipped days.", "did": "Caught up in one go.", "felt": "tired but pleased", "why": "skipped three days", "key_line": "it is actually a tune now", "friction": ["three skipped days"], "win": "a tune"},
        ],
        "week_arc": "Frustration to a grin on Monday, a quiet Wednesday, a tired catch-up on Sunday.",
        "threads": ["sitting properly comes up on Monday and Sunday"],
        "contradictions": ["Sunday says tired yet calls it a tune"],
        "what_they_need": "A fixed evening slot so the three-day gap does not repeat.",
    })


def review_json(best_quote=TAIL):
    return json.dumps({
        "dominant_emotion": "focused",
        "week_summary": {"wins": "Monday ended in a grin; Sunday became a tune.", "dips": "Three skipped days mid-week.", "pattern": "You come back the day after something sounds like music."},
        "hidden_insight": "Your mood turns the moment the notes turn into a tune.",
        "next_week_focus": "Keep the after-breakfast slot every day.",
        "next_week_plan_context": "- ten-minute sessions\n- no new pieces yet",
        "week_badge": {"name": "Sunday Sprint", "reason": "You cleared the missed line on Sunday."},
        "best_quote": best_quote,
        "actionable_coaching": [{"observation": f"Day {i + 1}", "micro_action": "Sit properly first."} for i in range(7)],
        "trigger_patterns": [],
        "recurring_friction": ["stool too low", "three skipped days"],
        "best_days": ["Mon", "Sun"],
        "worst_days": ["Thu", "Fri"],
        "mood_trend": "rough start, quiet middle, tired finish",
    })


def two_pass_model(ws, mid, we, review=None, evidence=None, evidence_raises=False):
    """A fake model that answers the evidence pass and the review pass, recording both prompts."""
    seen = {"evidence": [], "review": []}

    def fake(messages, **_k):
        user_text = " ".join(m.get("content", "") for m in messages if m.get("role") == "user")
        if "EVIDENCE SHEET" in user_text and "WEEK REVIEW" not in user_text:
            seen["evidence"].append(user_text)
            if evidence_raises:
                raise RuntimeError("evidence model offline")
            return evidence or evidence_json(ws, mid, we)
        seen["review"].append(user_text)
        return review or review_json()

    return fake, seen


def test_review_reads_every_journal_in_full_and_keeps_their_words(client, monkeypatch):
    import app.llm as llm

    headers, uid, ws, mid, we = seed_last_week(client, "report-full@example.com", "s-report-full")
    fake, seen = two_pass_model(ws, mid, we)
    monkeypatch.setattr(llm, "call_with_fallback_chain", fake)

    resp = client.get(f"/journal/{uid}/weekly-report?session_id=s-report-full&week_number=1", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "generated"

    # Both passes saw the tail of Monday's entry — the part the old 600-character cut dropped.
    assert len(seen["evidence"]) == 1 and len(seen["review"]) == 1
    assert TAIL in seen["evidence"][0]
    assert TAIL in seen["review"][0]
    assert "learn the piano" in seen["review"][0], "the goal is part of the review's context"
    assert "I promised her years ago." in seen["review"][0], "so is their own why"
    # The review pass also received the evidence sheet.
    assert "EVIDENCE SHEET" in seen["review"][0] and "stool too low" in seen["review"][0]

    report = body["report"]
    assert report["analysis_version"] == 2
    assert report["analysis"]["week_arc"].startswith("Frustration")
    assert report["best_quote"] == TAIL
    by_date = {d["date"]: d for d in report["days"]}
    assert by_date[ws]["key_line"] == TAIL
    assert by_date[mid]["key_line"] == "Clumsy means fast, I think."
    assert by_date[ws]["coaching_micro_action"] == "Sit properly first."
    assert report["model_context"]["daily_log"][0]["friction_noted"] == "stool too low"


def test_a_paraphrased_quote_or_key_line_is_replaced_by_their_own_sentence(client, monkeypatch):
    import app.llm as llm

    headers, uid, ws, mid, we = seed_last_week(client, "report-quote@example.com", "s-report-quote")
    fake, _ = two_pass_model(
        ws, mid, we,
        review=review_json(best_quote="I realised the stool was the whole problem"),
        evidence=evidence_json(ws, mid, we, key_line="The stool was the real issue all along"),
    )
    monkeypatch.setattr(llm, "call_with_fallback_chain", fake)

    report = client.get(f"/journal/{uid}/weekly-report?session_id=s-report-quote&week_number=1", headers=headers).json()["report"]
    from app.main import _loose

    transcripts = [MONDAY_ENTRY, WEDNESDAY_ENTRY, SUNDAY_ENTRY]
    assert report["best_quote"], "there is always a pull-quote"
    assert any(_loose(report["best_quote"]) in _loose(t) for t in transcripts), "the quote is something they said"
    by_date = {d["date"]: d for d in report["days"]}
    assert by_date[ws]["key_line"] is None, "an invented key line is dropped, not shown"


def test_review_still_writes_when_the_evidence_pass_fails(client, monkeypatch):
    import app.llm as llm

    headers, uid, ws, mid, we = seed_last_week(client, "report-noev@example.com", "s-report-noev")
    fake, seen = two_pass_model(ws, mid, we, evidence_raises=True)
    monkeypatch.setattr(llm, "call_with_fallback_chain", fake)

    body = client.get(f"/journal/{uid}/weekly-report?session_id=s-report-noev&week_number=1", headers=headers).json()
    assert body["status"] == "generated"
    assert body["report"]["analysis"] is None
    assert body["report"]["week_summary"]["wins"].startswith("Monday")
    assert TAIL in seen["review"][0], "the review pass still gets the complete transcripts"


def test_a_days_emotion_is_judged_from_the_whole_entry(monkeypatch):
    import app.llm as llm
    from app.main import _analyze_emotion

    seen = []

    def fake(messages, **_k):
        seen.append(" ".join(m.get("content", "") for m in messages))
        return '{"label": "hopeful", "score": 8, "one_liner": "A bad start that ended in a grin."}'

    monkeypatch.setattr(llm, "call_with_fallback_chain", fake)
    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: (_ for _ in ()).throw(AssertionError("the chain answered; no fallback needed")))

    out = asyncio.run(_analyze_emotion(MONDAY_ENTRY))
    assert out == {"label": "hopeful", "score": 8, "one_liner": "A bad start that ended in a grin."}
    assert len(seen) == 1 and TAIL in seen[0], "the model saw the end of the entry, not just its first 800 characters"


def test_the_mentor_is_handed_the_whole_review_when_building_next_week():
    from app.prompts import build_chat_prompt

    report = json.loads(review_json())
    report.update({
        "week_number": 1, "week_start": "2026-10-05", "week_end": "2026-10-11", "week_theme": "First Keys",
        "consistency_score": 43, "days_done": 3, "days_missed": 4, "past_days_count": 7, "avg_score": 4.7,
        "momentum_score": 48, "momentum_label": "Building", "entry_count": 3,
        "days": [
            {"date": "2026-10-05", "day_label": "Mon", "planned_task": "Ten minutes at the piano", "has_journal": True, "emotion": "frustrated", "score": 4, "one_liner": "Rough start.", "key_line": TAIL, "coaching_insight": "Day 1 strong finish", "coaching_micro_action": "Sit properly first."},
            {"date": "2026-10-06", "day_label": "Tue", "planned_task": "Five-finger exercise", "has_journal": False, "checkin": "missed", "coaching_insight": "Missed — planned five-finger exercise", "coaching_micro_action": "Pair it with coffee."},
        ],
        "analysis": json.loads(evidence_json("2026-10-05", "2026-10-07", "2026-10-11")),
        "model_context": {"stats": {"consistency_pct": 43}},
    })
    msgs = build_chat_prompt(
        [{"role": "user", "content": "plan my week 2"}], phase="active", current_week=1,
        week_report_data=report, current_week_complete=True,
    )
    system_text = " ".join(m["content"] for m in msgs if m["role"] == "system")
    for needle in (
        "Monday ended in a grin", "Three skipped days mid-week",                # wins / dips
        "Your mood turns the moment the notes turn into a tune",                # hidden insight
        "Sit properly first.", "Pair it with coffee.",                          # every day's micro-action
        "Missed — planned five-finger exercise",                                # the missed day too
        TAIL,                                                                   # their own words
        "A fixed evening slot so the three-day gap does not repeat.",           # the evidence sheet
        "ten-minute sessions", "Read EVERY line of the report",                 # plan context + the directive
    ):
        assert needle in system_text, needle
    assert '"consistency_pct": 43' not in system_text, "the review is rendered as text, not dumped as a JSON digest"
