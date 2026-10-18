"""
The week review — a letter, not a report card.

The model is asked for a headline, what it saw, one thing worth noticing,
and one change for next week; the server cleans what comes back, keeps
the older field names alive for the planner and the archive, marks thin
weeks, rewrites old-format reviews once, and never calls the model for a
week that ended in silence.
"""

import json
import os
from datetime import date, timedelta

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-review-db")
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


def last_week():
    """Monday..Sunday of the week that ended last Sunday."""
    today = date.today()
    monday = today - timedelta(days=today.weekday() + 7)
    return monday, monday + timedelta(days=6)


def seed_week(user_id, sid, start: date, notes: dict, focus="learn piano"):
    """A locked week from `start` with evening notes on the given day offsets ({offset: (label, score, one_liner)})."""
    from app.database import SessionLocal
    from app.models import DailyCheckin, Session as UserSession, VoiceJournal

    end = start + timedelta(days=6 - start.weekday())
    days = [{"day": (start + timedelta(days=i)).strftime("%b %d (%a)"), "action": f"Ten minutes at the keys ({i + 1})"} for i in range((end - start).days + 1)]
    plan = {"week_number": 1, "theme": "First Keys", "start_date": start.isoformat(), "days": days}
    db = SessionLocal()
    db.add(UserSession(id=sid, user_id=user_id, focus=focus, history="", vision="", phase="active", current_week=1,
                       plan_start_date=start.isoformat(), week_plan_json=json.dumps(plan), result_json=json.dumps([plan])))
    for off, (label, score, line) in notes.items():
        d = (start + timedelta(days=off)).isoformat()
        db.add(VoiceJournal(user_id=user_id, session_id=sid, date=d, transcript=f"um so today {line} yeah", emotion_label=label, emotion_score=score, one_liner=line))
        db.add(DailyCheckin(user_id=user_id, session_id=sid, date=d, status="done"))
    db.commit()
    db.close()
    return start.isoformat(), end.isoformat()


def review(client, headers, uid, sid, **params):
    qs = "&".join(f"{k}={v}" for k, v in {"session_id": sid, "week_number": 1, **params}.items())
    resp = client.get(f"/journal/{uid}/weekly-report?{qs}", headers=headers)
    assert resp.status_code == 200, resp.text
    return resp.json()


MODEL_REVIEW = {
    "headline": "Three evenings at the keys, then a quiet weekend.",
    "saw": ["Day 1: Monday you sat down and found middle C, and said it felt easy.",
            "- Wednesday was the good one: the five-finger run came together.",
            "Thursday through Sunday passed without a note."],
    "one_thing": "Both notes you left were on days you played right after dinner.",
    "next_week_focus": "Keep the after-dinner slot and add one more evening.",
    "next_week_plan_context": "- keep sessions to ten minutes\n- after dinner works\n- no new pieces yet",
    "quote": "it actually sounded like music for a second",
    "vs_last_week": "null",
    "dominant_emotion": "calm",
    "mood_trend": "easy start, steady",
    "badge": {"name": "Steady Start", "reason": "Two real sessions in the first week."},
}


def test_review_is_cleaned_and_keeps_the_old_names_alive(client, monkeypatch):
    import app.llm as llm

    asked = {}

    def mentor(messages, **_k):
        asked["prompt"] = "\n".join(m["content"] for m in messages)
        return json.dumps(MODEL_REVIEW)

    monkeypatch.setattr(llm, "call_with_fallback_chain", mentor)

    headers, uid = register(client, "review-1@example.com")
    start, _ = last_week()
    seed_week(uid, "s-review-1", start, {0: ("calm", 7, "found middle C"), 2: ("calm", 8, "the five-finger run came together")})

    out = review(client, headers, uid, "s-review-1")
    assert out["status"] == "generated", out
    r = out["report"]

    # The model was told exactly which days it may speak about.
    assert "Voice notes exist for these days only" in asked["prompt"]
    assert start.strftime("%a %d %b") in asked["prompt"]
    assert "performance review" not in asked["prompt"].lower()

    assert r["schema_version"] == 3
    assert r["headline"] == MODEL_REVIEW["headline"]
    assert r["saw"][0].startswith("Monday you sat down"), "Day N: prefixes are stripped"
    assert r["saw"][1].startswith("Wednesday was"), "leading bullets are stripped"
    assert r["one_thing"] == MODEL_REVIEW["one_thing"]
    assert r["quote"] == "it actually sounded like music for a second"
    assert r["vs_last_week"] is None, "no previous week, so no comparison line"
    assert r["badge"]["name"] == "Steady Start"
    assert r["sparse"] is True, "two notes is a thin week"
    assert r["entry_count"] == 2 and r["days_done"] == 2

    # The planner and the archive still find what they used to read.
    assert r["hidden_insight"] == r["one_thing"]
    assert r["week_summary"]["wins"].startswith("Monday you sat down")
    assert r["what_went_well"] == r["week_summary"]["wins"]
    assert r["best_quote"] == r["quote"] and r["week_badge"] == r["badge"]
    assert r["next_week_focus"] == MODEL_REVIEW["next_week_focus"]
    assert r["model_context"]["mentor_review"]["headline"] == r["headline"]
    assert all(d["coaching_insight"] == "" for d in r["days"]), "no model-written per-day coaching any more"
    assert sum(1 for d in r["days"] if d["has_journal"]) == 2

    # Served from cache the second time, unchanged.
    again = review(client, headers, uid, "s-review-1")
    assert again["status"] == "cached" and again["report"]["headline"] == r["headline"]


def test_an_old_format_review_is_rewritten_once(client, monkeypatch):
    import app.llm as llm
    from app.database import SessionLocal
    from app.models import WeeklyReport

    monkeypatch.setattr(llm, "call_with_fallback_chain", lambda messages, **_k: json.dumps(MODEL_REVIEW))

    headers, uid = register(client, "review-old@example.com")
    start, end = last_week()
    seed_week(uid, "s-review-old", start, {1: ("focused", 6, "slow but fine"), 3: ("tired", 4, "pushed through"), 5: ("calm", 7, "good session")})

    old = {"momentum_score": 40, "entry_count": 3, "days_done": 3, "week_summary": {"wins": "old", "dips": "old", "pattern": "old"},
           "hidden_insight": "old insight", "consistency_score": 43, "avg_score": 5.7}
    db = SessionLocal()
    db.add(WeeklyReport(user_id=uid, session_id="s-review-old", week_number=1, week_start=start.isoformat(), week_end=end.isoformat(), report_json=json.dumps(old)))
    db.commit()
    db.close()

    out = review(client, headers, uid, "s-review-old")
    assert out["status"] == "generated"
    assert out["report"]["schema_version"] == 3 and out["report"]["headline"] == MODEL_REVIEW["headline"]
    assert out["report"]["sparse"] is False, "three notes is enough to read"
    assert review(client, headers, uid, "s-review-old")["status"] == "cached"


def test_when_the_model_fails_the_review_is_built_from_the_notes(client, monkeypatch):
    import app.llm as llm

    def explode(*_a, **_k):
        raise RuntimeError("offline")

    monkeypatch.setattr(llm, "call_with_fallback_chain", explode)

    headers, uid = register(client, "review-fb@example.com")
    start, _ = last_week()
    seed_week(uid, "s-review-fb", start, {0: ("calm", 7, "found middle C")})

    r = review(client, headers, uid, "s-review-fb")["report"]
    assert r["review_fallback"] is True
    assert r["headline"] == "1 of 7 days with a note."
    assert r["saw"][0].startswith("Monday: found middle C")
    assert "6 days passed without a note." in r["saw"]
    assert r["badge"]["name"] == "Quiet Week" and r["sparse"] is True
    assert r["hidden_insight"] == "" and r["next_week_focus"]


def test_a_silent_week_never_calls_the_model(client, monkeypatch):
    import app.llm as llm

    def explode(*_a, **_k):
        raise AssertionError("a silent week must not reach the model")

    monkeypatch.setattr(llm, "call_with_fallback_chain", explode)
    monkeypatch.setattr(llm, "call_llm", explode)

    headers, uid = register(client, "review-quiet@example.com")
    start, _ = last_week()
    seed_week(uid, "s-review-quiet", start, {})

    out = review(client, headers, uid, "s-review-quiet")
    assert out["status"] == "generated"
    r = out["report"]
    assert r["quiet_week"] is True and r["schema_version"] == 3 and r["sparse"] is True
    assert r["headline"] == "This week went quiet."
    assert len(r["saw"]) == 2 and r["one_thing"] and r["badge"]["name"] == "Quiet Week"
    assert r["quote"] is None


def test_did_this_read_true_lands_in_the_inbox(client, monkeypatch):
    os.environ["FEEDBACK_ADMIN_TOKEN"] = "inbox-passphrase-for-tests"
    headers, uid = register(client, "review-fb-inbox@example.com")
    resp = client.post(
        "/feedback",
        json={"kind": "review", "answers": {"accurate": "partly", "week_number": 2, "note": "It said Tuesday felt heavy. I never recorded Tuesday."}, "trigger": "review_read", "page": "/journey"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    inbox = client.get("/admin/feedback?kind=review", headers={"X-Internal-Token": "inbox-passphrase-for-tests"}).json()
    mine = [i for i in inbox["items"] if i["user_id"] == uid]
    assert mine and mine[0]["answers"]["accurate"] == "partly" and mine[0]["answers"]["week_number"] == 2
    assert mine[0]["trigger"] == "review_read"
    assert inbox["stats"]["review_accuracy"]["partly"] >= 1

    bad = client.post("/feedback", json={"kind": "review", "answers": {"accurate": "sort of"}, "trigger": "review_read"}, headers=headers)
    assert bad.status_code == 400
