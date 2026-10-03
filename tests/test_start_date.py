"""
A locked week can start later than it was locked.

People routinely want a day or two to get set, or a clean Monday, and the
only way to get that used to be not locking the plan at all. The approve
call now takes a start date; until it arrives nothing is due, the daily
email becomes a short countdown, and the mentor knows.
"""

import json
import os
from datetime import date, timedelta
from typing import Optional

import pytest


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-startdate-db")
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

        for bucket in ("signup", "login"):
            LIMITERS[bucket] = SlidingWindowLimiter(1000, 3600)
        init_db()
        yield TestClient(app)
    finally:
        os.chdir(cwd)


@pytest.fixture(autouse=True)
def no_model_calls(client, monkeypatch):
    """The countdown notes are written by the model at approval; keep that offline."""
    import app.email_service as es

    monkeypatch.setattr(es, "call_llm", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline")), raising=False)
    import app.llm as llm

    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline")))


def register(client, email):
    body = client.get("/legal/consents").json()
    consents = {i["key"]: True for i in body["catalogue"] if i["required"]}
    resp = client.post("/signup", json={"email": email, "password": "correct-horse-battery", "name": "t", "consents": consents})
    assert resp.status_code == 200, resp.text
    b = resp.json()
    return {"Authorization": f"Bearer {b['access_token']}"}, b["user_id"]


def drafted_session(user_id, sid, today: date):
    """A session with a Week 1 draft awaiting approval, written 'today'."""
    from app.database import SessionLocal
    from app.models import Session as UserSession

    days = [{"day": (today + timedelta(days=i)).strftime("%b %d (%a)"), "action": f"Push-ups 3x12 and a 20 minute walk (day {i + 1})"} for i in range(7)]
    plan = {"week_number": 1, "theme": "Home Strength", "win_condition": "5 of 5", "days": days, "generated_date": today.isoformat()}
    db = SessionLocal()
    db.add(UserSession(id=sid, user_id=user_id, focus="get fit at home", history="", vision="", phase="planning", current_week=1, week_plan_json=json.dumps(plan)))
    db.commit()
    db.close()


def load_session(sid):
    from app.database import SessionLocal
    from app.models import Session as UserSession

    db = SessionLocal()
    s = db.query(UserSession).filter(UserSession.id == sid).first()
    out = {
        "phase": s.phase, "plan_start_date": s.plan_start_date, "plan_starts_on": s.plan_starts_on,
        "plan": json.loads(s.week_plan_json), "countdown": json.loads(s.countdown_json or "[]"),
    }
    db.close()
    return out


def approve(client, headers, sid, today: date, start: Optional[date]):
    qs = f"client_date={today.isoformat()}" + (f"&start_date={start.isoformat()}" if start else "")
    return client.post(f"/chat/{sid}/approve_plan?{qs}", headers=headers)


def test_default_is_unchanged_the_week_starts_today(client):
    headers, uid = register(client, "today@example.com")
    today = date(2026, 10, 6)  # a Monday
    drafted_session(uid, "s-today", today)

    out = approve(client, headers, "s-today", today, None).json()
    assert out["status"] == "approved" and out["starts_later"] is False and out["starts_on"] == "2026-10-06"
    s = load_session("s-today")
    assert s["plan_starts_on"] == "2026-10-06" and s["countdown"] == []
    assert s["plan"]["start_date"] == "2026-10-06"


def test_a_later_start_refits_the_week_and_writes_the_countdown(client):
    headers, uid = register(client, "monday@example.com")
    today = date(2026, 10, 1)  # a Thursday
    monday = date(2026, 10, 5)
    drafted_session(uid, "s-monday", today)

    out = approve(client, headers, "s-monday", today, monday).json()
    assert out["starts_later"] is True and out["starts_on"] == "2026-10-05"

    s = load_session("s-monday")
    assert s["phase"] == "active"
    assert s["plan_starts_on"] == "2026-10-05" and s["plan_start_date"] == "2026-10-05"
    # Re-fitted to Mon→Sun of the chosen week: seven days, labelled with real dates.
    labels = [d["day"] for d in s["plan"]["days"]]
    assert labels[0].startswith("Oct 05") and labels[-1].startswith("Oct 11") and len(labels) == 7
    # Notes for the last three days before the start (the model is offline → fallback text).
    assert [n["days_before"] for n in s["countdown"]] == [3, 2, 1]
    assert "Tomorrow" in s["countdown"][-1]["subject"]

    # The chat message says so, and the session detail exposes the start.
    detail = client.get("/sessions/detail/s-monday", headers=headers).json()
    assert detail["plan_starts_on"] == "2026-10-05"
    assert "starts Monday 5 October" in detail["messages"][-1]["content"]


def test_a_short_runway_only_keeps_the_notes_that_fit(client):
    headers, uid = register(client, "tomorrow@example.com")
    today = date(2026, 10, 6)
    drafted_session(uid, "s-tomorrow", today)
    approve(client, headers, "s-tomorrow", today, today + timedelta(days=1))
    assert [n["days_before"] for n in load_session("s-tomorrow")["countdown"]] == [1]


@pytest.mark.parametrize("picked,expected", [
    (date(2026, 10, 10), "2026-10-12"),   # Saturday → the Monday after
    (date(2026, 10, 11), "2026-10-12"),   # Sunday → the Monday after
    (date(2026, 10, 9), "2026-10-09"),    # Friday stays (3-day week is allowed)
])
def test_a_weekend_start_rolls_to_monday(client, picked, expected):
    """A week runs to its Sunday; a weekend start would be a 1–2 day stub."""
    headers, uid = register(client, f"weekend{picked.day}@example.com")
    today = date(2026, 10, 5)  # a Monday
    sid = f"s-weekend{picked.day}"
    drafted_session(uid, sid, today)
    out = approve(client, headers, sid, today, picked).json()
    assert out["starts_on"] == expected
    assert load_session(sid)["plan"]["days"][0]["day"].startswith(date.fromisoformat(expected).strftime("%b %d"))


@pytest.mark.parametrize("offset,detail", [
    (-1, "past"),
    (15, "within the next 14 days"),
])
def test_start_date_limits(client, offset, detail):
    headers, uid = register(client, f"limits{offset}@example.com")
    today = date(2026, 10, 6)
    drafted_session(uid, f"s-limits{offset}", today)
    resp = approve(client, headers, f"s-limits{offset}", today, today + timedelta(days=offset))
    assert resp.status_code == 400 and detail in resp.json()["detail"]
    assert load_session(f"s-limits{offset}")["phase"] == "planning", "nothing locked on a refused date"


def test_countdown_email_is_due_only_in_the_last_three_days(client):
    from app.database import SessionLocal
    from app.email_service import get_countdown_for_user
    from app.models import User

    headers, uid = register(client, "countdown@example.com")
    today = date(2026, 10, 1)
    drafted_session(uid, "s-cd", today)
    approve(client, headers, "s-cd", today, date(2026, 10, 12))  # 11 days out

    db = SessionLocal()
    user = db.query(User).filter(User.id == uid).first()
    try:
        assert get_countdown_for_user(user, db, "2026-10-01") is None, "too far out: quiet"
        due, _ = get_countdown_for_user(user, db, "2026-10-09")
        assert due["days_before"] == 3
        due, _ = get_countdown_for_user(user, db, "2026-10-11")
        assert due["days_before"] == 1
        assert get_countdown_for_user(user, db, "2026-10-12") is None, "start day: the task email takes over"
    finally:
        db.close()


def test_no_task_email_before_the_start(client, monkeypatch):
    from app.database import SessionLocal
    from app import email_service as es
    from app.models import User

    headers, uid = register(client, "notask@example.com")
    today = date(2026, 10, 1)
    drafted_session(uid, "s-notask", today)
    approve(client, headers, "s-notask", today, date(2026, 10, 5))

    class _FrozenNow:
        """email_service builds 'now' from datetime.now(tz); pin it before the start."""
        @staticmethod
        def now(tz=None):
            from datetime import datetime as _dt
            return _dt(2026, 10, 3, 8, 0, tzinfo=tz)

    monkeypatch.setattr(es, "datetime", _FrozenNow)
    db = SessionLocal()
    user = db.query(User).filter(User.id == uid).first()
    try:
        assert es.get_today_task_for_user(user, db) is None
    finally:
        db.close()


def test_the_mentor_is_told_the_week_has_not_started(client, monkeypatch):
    import app.llm as llm
    import app.main as main
    from app import guardrail

    headers, uid = register(client, "mentor@example.com")
    today = date.today()
    drafted_session(uid, "s-mentor", today)
    approve(client, headers, "s-mentor", today, today + timedelta(days=3))

    seen = {}

    def fake_chain(messages, **kw):
        seen["system"] = "\n".join(m["content"] for m in messages if m["role"] == "system")
        return json.dumps({"reply": "Nothing until then — rest up.", "plan": None})

    monkeypatch.setattr(llm, "call_with_fallback_chain", fake_chain)
    monkeypatch.setattr(llm, "create_embedding", lambda *a, **k: None)
    monkeypatch.setattr(main, "_generate_and_save_title", lambda *a, **k: None)
    monkeypatch.setattr(guardrail, "screen", lambda *a, **k: guardrail.ALLOWED)

    out = client.post("/chat", json={"message": "what do I do tomorrow?", "session_id": "s-mentor", "user_id": uid, "timezone": "UTC"}, headers=headers).json()
    assert out.get("plan") is None
    assert "STARTS ON" in seen["system"] and "in 3 days" in seen["system"]
