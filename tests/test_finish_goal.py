"""
"Finish this goal" — end means end.

Finishing is instant and needs no model: the session is closed the moment
the person confirms. From then on the mentor is a plain conversation (no
plan, no setup questions), no new weekly review is written, the task-email
scheduler leaves the session alone, and everything already recorded stays
readable in the archive.
"""

import json
import os
from datetime import date, timedelta

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-finish-db")
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


def locked_week(user_id, sid, start: date, week_number=1):
    """A session mid-week with Week `week_number` locked from `start`."""
    from app.database import SessionLocal
    from app.models import Session as UserSession

    end = start + timedelta(days=6 - start.weekday())
    days = [(start + timedelta(days=i)).strftime("%b %d (%a)") for i in range((end - start).days + 1)]
    plan = {"week_number": week_number, "theme": "Home Strength", "start_date": start.isoformat(),
            "days": [{"day": d, "action": f"Push-ups 3x12 ({d})"} for d in days]}
    db = SessionLocal()
    db.add(UserSession(
        id=sid, user_id=user_id, focus="get fit at home", history="", vision="",
        phase="active", current_week=week_number, plan_start_date=start.isoformat(),
        week_plan_json=json.dumps(plan), result_json=json.dumps([plan]),
    ))
    db.commit()
    db.close()
    return start.isoformat(), end.isoformat()


def session_row(sid):
    from app.database import SessionLocal
    from app.models import Session as UserSession

    db = SessionLocal()
    s = db.query(UserSession).filter(UserSession.id == sid).first()
    out = {"phase": s.phase, "is_completed": s.is_completed, "current_week": s.current_week, "week_plan_json": s.week_plan_json, "session_report_json": s.session_report_json}
    db.close()
    return out


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def test_finishing_is_instant_and_needs_no_model(client, monkeypatch):
    import app.llm as llm

    def explode(*_a, **_k):
        raise AssertionError("finishing a goal must not call the model")

    monkeypatch.setattr(llm, "call_llm", explode)
    monkeypatch.setattr(llm, "call_with_fallback_chain", explode)

    headers, uid = register(client, "finish-1@example.com")
    locked_week(uid, "s-finish-1", monday_of(date.today()))
    client.post("/checkin", json={"session_id": "s-finish-1", "status": "done", "client_date": date.today().isoformat()}, headers=headers)

    resp = client.post("/sessions/s-finish-1/complete", headers=headers)
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "completed"
    assert body["stats"]["total_weeks"] == 1 and body["stats"]["days_total"] >= 0

    row = session_row("s-finish-1")
    assert row["phase"] == "completed" and row["is_completed"] == 1
    assert row["week_plan_json"], "the last plan stays on record for the archive"
    assert json.loads(row["session_report_json"])["finished_at"]

    # Finishing twice is harmless and keeps the original finish time.
    first = json.loads(row["session_report_json"])["finished_at"]
    assert client.post("/sessions/s-finish-1/complete", headers=headers).status_code == 200
    assert json.loads(session_row("s-finish-1")["session_report_json"])["finished_at"] == first


def test_only_the_owner_can_finish(client):
    headers, uid = register(client, "finish-owner@example.com")
    other, _ = register(client, "finish-other@example.com")
    locked_week(uid, "s-finish-owner", monday_of(date.today()))
    assert client.post("/sessions/s-finish-owner/complete", headers=other).status_code == 404
    assert session_row("s-finish-owner")["phase"] == "active"


def test_mentor_is_chat_only_after_finishing(client, monkeypatch):
    """The model may still answer, but any plan or setup form it emits is dropped."""
    import app.llm as llm

    asked = []

    def mentor(messages, **_k):
        asked.append(messages)
        return json.dumps({
            "reply": "Here is a fresh Week 2 for you!",
            "plan": {"week_number": 2, "theme": "Again", "days": [{"day": "Mon", "action": "Push-ups 3x15"}]},
            "questions": [{"id": "q1", "label": "What is your goal?"}],
        })

    monkeypatch.setattr(llm, "call_with_fallback_chain", mentor)

    headers, uid = register(client, "finish-chat@example.com")
    locked_week(uid, "s-finish-chat", monday_of(date.today()) - timedelta(days=7))
    assert client.post("/sessions/s-finish-chat/complete", headers=headers).status_code == 200

    resp = client.post("/chat", json={"message": "plan my next week please", "session_id": "s-finish-chat", "user_id": uid, "timezone": "UTC"}, headers=headers)
    assert resp.status_code == 200, resp.text
    out = resp.json()
    assert out["plan"] is None and out["questions"] is None
    assert out["reply"], "the mentor still talks"

    system_text = " ".join(m.get("content", "") for m in asked[-1] if m.get("role") == "system")
    assert "COMPLETED" in system_text

    row = session_row("s-finish-chat")
    assert row["phase"] == "completed" and row["current_week"] == 1, "no week was added"


def test_week_info_says_finished_and_no_new_review_is_written(client, monkeypatch):
    import app.llm as llm

    def explode(*_a, **_k):
        raise AssertionError("no review may be generated for a finished goal")

    monkeypatch.setattr(llm, "call_llm", explode)
    monkeypatch.setattr(llm, "call_with_fallback_chain", explode)

    headers, uid = register(client, "finish-review@example.com")
    # A week that ended last Sunday, with a journal in it, and no review written yet.
    start = monday_of(date.today()) - timedelta(days=7)
    ws, we = locked_week(uid, "s-finish-review", start)
    from app.database import SessionLocal
    from app.models import VoiceJournal

    db = SessionLocal()
    db.add(VoiceJournal(user_id=uid, session_id="s-finish-review", date=ws, transcript="day one", emotion_label="calm", emotion_score=7.0))
    db.commit()
    db.close()

    assert client.post("/sessions/s-finish-review/complete", headers=headers).status_code == 200

    info = client.get("/sessions/s-finish-review/week-info", headers=headers).json()
    assert info["is_completed"] is True

    report = client.get(f"/journal/{uid}/weekly-report?session_id=s-finish-review&week_number=1", headers=headers).json()
    assert report["status"] == "no_data" and report.get("finished") is True

    from app.models import WeeklyReport

    db = SessionLocal()
    assert db.query(WeeklyReport).filter(WeeklyReport.session_id == "s-finish-review").count() == 0
    db.close()


def test_reviews_written_before_finishing_stay_readable(client):
    headers, uid = register(client, "finish-archive@example.com")
    start = monday_of(date.today()) - timedelta(days=14)
    ws, we = locked_week(uid, "s-finish-archive", start)
    from app.database import SessionLocal
    from app.models import WeeklyReport

    kept = {"consistency_score": 71, "days_done": 5, "entry_count": 5, "what_went_well": "showed up"}
    db = SessionLocal()
    db.add(WeeklyReport(user_id=uid, session_id="s-finish-archive", week_number=1, week_start=ws, week_end=we, report_json=json.dumps(kept)))
    db.commit()
    db.close()

    assert client.post("/sessions/s-finish-archive/complete", headers=headers).status_code == 200

    report = client.get(f"/journal/{uid}/weekly-report?session_id=s-finish-archive&week_number=1", headers=headers).json()
    assert report["status"] == "cached" and report["report"]["what_went_well"] == "showed up"

    archive = client.get("/sessions/s-finish-archive/reports", headers=headers)
    assert archive.status_code == 200
    assert [r["week_number"] for r in archive.json()] == [1]


def test_task_email_scheduler_skips_a_finished_goal(client):
    from app.database import SessionLocal
    from app.email_service import _has_active_plan

    headers, uid = register(client, "finish-email@example.com")
    locked_week(uid, "s-finish-email", monday_of(date.today()))
    db = SessionLocal()
    try:
        assert _has_active_plan(db, uid) is True
    finally:
        db.close()

    assert client.post("/sessions/s-finish-email/complete", headers=headers).status_code == 200
    db = SessionLocal()
    try:
        assert _has_active_plan(db, uid) is False
    finally:
        db.close()
