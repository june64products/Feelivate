"""
The product-feedback forms: the fuller form (side tab, leaving, logout, weekly
report), the one-tap "does this plan fit?" after locking, the three-tap
"how was today's task?" after a voice note, the "what's off?" after a second
tweak, and the 👍/👎 link in the morning email. Each answer records who, which
time (1st, 2nd …), which moment asked, where they were in the plan, and when.

Drives a throwaway SQLite database through the real app, like the privacy
suite does.
"""

import json
import os

import pytest


def full_consent(client):
    body = client.get("/legal/consents").json()
    return {item["key"]: True for item in body["catalogue"] if item["required"]}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-feedback-db")
    os.environ["APP_ENV"] = "development"
    os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-used-anywhere-real"
    os.environ["DATABASE_URL"] = ""
    os.environ.pop("QDRANT_URL", None)
    os.environ.pop("QDRANT_API_KEY", None)
    # The inbox passphrase; individual tests unset it to check the closed state.
    os.environ["FEEDBACK_ADMIN_TOKEN"] = "inbox-passphrase-for-tests"

    cwd = os.getcwd()
    os.chdir(workdir)
    try:
        from fastapi.testclient import TestClient

        from app.database import init_db
        from app.main import app
        from app.ratelimit import LIMITERS, SlidingWindowLimiter

        for bucket in ("signup", "login", "feedback", "account_delete", "account_export"):
            LIMITERS[bucket] = SlidingWindowLimiter(1000, 3600)

        init_db()
        yield TestClient(app)
    finally:
        os.chdir(cwd)


def register(client, email):
    resp = client.post(
        "/signup",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "name": email.split("@")[0],
            "consents": full_consent(client),
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user_id"]


ADMIN = {"X-Internal-Token": "inbox-passphrase-for-tests"}


def inbox_item(client, item_id):
    return next(i for i in client.get("/admin/feedback", headers=ADMIN).json()["items"] if i["id"] == item_id)


# ─── The fuller form ────────────────────────────────────────────────────────


def test_visitor_can_leave_feedback_without_an_account(client):
    resp = client.post(
        "/feedback",
        json={
            "kind": "full",
            "answers": {
                "upset": "a_bit",
                "upset_reason": "  I'd just use a notes app.  ",
                "liked_most": "design",
                "confusing": ["signup", "not-a-chip"],
                "confusing_notes": {"signup": "asked a lot", "not-a-chip": "dropped"},
            },
            "comment": "  Nice, but the sign-up asked a lot.  ",
            "email": "visitor@example.com",
            "trigger": "side_tab",
            "page": "/features",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok" and body["sequence_no"] is None

    item = inbox_item(client, body["id"])
    assert item["user_id"] is None and item["email"] == "visitor@example.com"
    assert item["kind"] == "full"
    assert item["answers"]["upset"] == "a_bit"
    assert item["answers"]["upset_reason"] == "I'd just use a notes app."
    assert item["answers"]["liked_most"] == "design"
    assert item["answers"]["confusing"] == ["signup"], "unknown chips are dropped, not stored"
    assert item["answers"]["confusing_notes"] == {"signup": "asked a lot"}
    assert item["comment"] == "Nice, but the sign-up asked a lot."
    assert item["trigger"] == "side_tab" and item["page"] == "/features"


def test_full_form_needs_the_upset_answer_and_a_reason_when_lukewarm(client):
    resp = client.post("/feedback", json={"kind": "full", "answers": {"liked_most": "plan"}, "trigger": "side_tab"})
    assert resp.status_code == 400 and "upset" in resp.json()["detail"]

    resp = client.post("/feedback", json={"kind": "full", "answers": {"upset": "not_really"}, "trigger": "side_tab"})
    assert resp.status_code == 400 and "reason" in resp.json()["detail"].lower()

    # "Very upset" needs no explanation.
    resp = client.post("/feedback", json={"kind": "full", "answers": {"upset": "very"}, "trigger": "side_tab"})
    assert resp.status_code == 200, resp.text

    # A made-up option is rejected, not silently kept.
    resp = client.post("/feedback", json={"kind": "full", "answers": {"upset": "meh"}, "trigger": "side_tab"})
    assert resp.status_code == 400


def test_each_submission_records_who_which_time_and_which_moment(client):
    headers, user_id = register(client, "seq@example.com")

    first = client.post("/feedback", json={"kind": "full", "answers": {"upset": "very"}, "trigger": "weekly_report"}, headers=headers).json()
    second = client.post("/feedback", json={"kind": "full", "answers": {"upset": "very"}, "trigger": "logout", "comment": "better now"}, headers=headers).json()
    assert (first["sequence_no"], second["sequence_no"]) == (1, 2)

    status = client.get("/feedback/me", headers=headers).json()
    assert status["count"] == 2 and status["last_at"]

    inbox = client.get("/admin/feedback", headers=ADMIN).json()
    mine = sorted((i for i in inbox["items"] if i["user_id"] == user_id), key=lambda i: i["sequence_no"])
    assert [i["trigger"] for i in mine] == ["weekly_report", "logout"]
    assert mine[0]["user_email"] == "seq@example.com"
    assert mine[0]["account_age_days"] == 0
    assert all(i["created_at"] for i in mine)
    # A signed-in user is reachable through the account: no separate address is kept.
    assert client.post(
        "/feedback", json={"kind": "full", "answers": {"upset": "very"}, "email": "ignored@example.com"}, headers=headers
    ).status_code == 200
    latest = max((i for i in client.get("/admin/feedback", headers=ADMIN).json()["items"] if i["user_id"] == user_id), key=lambda i: i["sequence_no"])
    assert latest["sequence_no"] == 3 and latest["email"] is None


def test_legacy_star_ratings_still_land(client):
    """Older clients (and the rows already in the database) send a 1–5 rating."""
    body = client.post("/feedback", json={"rating": 4, "liked": ["design", "not-a-chip"], "confusing": ["signup"], "trigger": "timer"}).json()
    item = inbox_item(client, body["id"])
    assert item["kind"] == "full" and item["rating"] == 4
    assert item["liked"] == ["design"] and item["confusing"] == ["signup"]
    assert item["answers"]["legacy_rating"] == 4

    for bad in (0, 6, "five"):
        assert client.post("/feedback", json={"rating": bad, "trigger": "timer"}).status_code in (400, 422)


def test_unknown_trigger_is_recorded_as_the_side_tab(client):
    body = client.post("/feedback", json={"kind": "full", "answers": {"upset": "very"}, "trigger": "made-up"}).json()
    assert inbox_item(client, body["id"])["trigger"] == "side_tab"


# ─── The small in-the-moment forms ──────────────────────────────────────────


def test_small_forms_need_an_account(client):
    for kind, answers in (("plan_fit", {"fit": "too_hard"}), ("task_day", {"quality": "great"}), ("tweaks", {"reason": "too_hard"})):
        resp = client.post("/feedback", json={"kind": kind, "answers": answers, "trigger": "first_plan"})
        assert resp.status_code == 401, (kind, resp.text)


def test_plan_fit_after_locking(client):
    headers, _ = register(client, "fit@example.com")
    resp = client.post("/feedback", json={"kind": "plan_fit", "answers": {"fit": "too_hard", "note": " Day 3 is a lot "}, "trigger": "first_plan"}, headers=headers)
    assert resp.status_code == 200, resp.text
    item = inbox_item(client, resp.json()["id"])
    assert item["kind"] == "plan_fit" and item["answers"] == {"fit": "too_hard", "note": "Day 3 is a lot"}

    missing = client.post("/feedback", json={"kind": "plan_fit", "answers": {"note": "no choice made"}, "trigger": "first_plan"}, headers=headers)
    assert missing.status_code == 400


def test_task_day_after_the_voice_note(client):
    headers, _ = register(client, "task@example.com")
    resp = client.post(
        "/feedback",
        json={"kind": "task_day", "answers": {"quality": "off", "clarity": "somewhat", "time": "longer", "note": "took an hour"}, "trigger": "after_journal"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    item = inbox_item(client, resp.json()["id"])
    assert item["answers"] == {"quality": "off", "clarity": "somewhat", "time": "longer", "note": "took an hour"}
    assert item["trigger"] == "after_journal"


def test_tweaks_after_the_second_change(client):
    headers, _ = register(client, "tweaks@example.com")
    resp = client.post(
        "/feedback",
        json={"kind": "tweaks", "answers": {"reason": "wrong_time", "tweak_count": 2, "note": "mornings don't work"}, "trigger": "second_tweak"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    item = inbox_item(client, resp.json()["id"])
    assert item["answers"]["reason"] == "wrong_time" and item["answers"]["tweak_count"] == 2

    # Text past the cap is trimmed, never rejected.
    long_note = "x" * 2000
    body = client.post("/feedback", json={"kind": "tweaks", "answers": {"reason": "other", "note": long_note}, "trigger": "second_tweak"}, headers=headers).json()
    assert len(inbox_item(client, body["id"])["answers"]["note"]) <= 400


def test_unknown_kind_is_rejected(client):
    headers, _ = register(client, "kind@example.com")
    assert client.post("/feedback", json={"kind": "made_up", "answers": {}}, headers=headers).status_code == 400
    # The email thumbs only come through the signed link, never the form.
    assert client.post("/feedback", json={"kind": "task_email", "answers": {"clear": "yes"}}, headers=headers).status_code == 400


# ─── 👍/👎 from the morning email ───────────────────────────────────────────


def test_email_thumbs_land_through_the_signed_link(client):
    from app.security import create_email_action_token

    headers, user_id = register(client, "thumbs@example.com")
    token = create_email_action_token(user_id, "task_rating", "2026-10-09")

    resp = client.get(f"/feedback/email?token={token}&clear=no")
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/html")

    inbox = client.get("/admin/feedback?kind=task_email", headers=ADMIN).json()
    mine = [i for i in inbox["items"] if i["user_id"] == user_id]
    assert len(mine) == 1
    assert mine[0]["answers"] == {"clear": "no", "date": "2026-10-09"} and mine[0]["trigger"] == "task_email"
    assert mine[0]["page"] == "email:2026-10-09"

    # Clicking the other thumb on the same day's email changes the answer instead of adding a row.
    assert client.get(f"/feedback/email?token={token}&clear=yes").status_code == 200
    mine = [i for i in client.get("/admin/feedback?kind=task_email", headers=ADMIN).json()["items"] if i["user_id"] == user_id]
    assert len(mine) == 1 and mine[0]["answers"]["clear"] == "yes"

    # A token minted for another action, or a tampered one, does nothing.
    other = create_email_action_token(user_id, "mark_done", "2026-10-09")
    assert client.get(f"/feedback/email?token={other}&clear=yes").status_code in (400, 403)
    assert client.get(f"/feedback/email?token={token}x&clear=yes").status_code in (400, 403)


# ─── Context, inbox, export ─────────────────────────────────────────────────


def test_where_they_were_is_captured_with_the_answer(client):
    from app.database import SessionLocal
    from app.models import Session as UserSession

    headers, user_id = register(client, "context@example.com")
    session_id = "fb-context-session"
    db = SessionLocal()
    db.add(UserSession(id=session_id, user_id=user_id, focus="Run 3x a week", history="", vision="", phase="planning", current_week=1))
    db.commit()
    db.close()

    body = client.post(
        "/feedback",
        json={"kind": "plan_fit", "answers": {"fit": "about_right"}, "trigger": "first_plan", "session_id": session_id},
        headers=headers,
    ).json()
    item = inbox_item(client, body["id"])
    assert item["session_id"] == session_id
    assert item["goal"] == "Run 3x a week"
    assert item["current_streak"] == 0 and item["days_active"] == 0
    assert item["week_number"] is None and item["plan_day"] is None, "no plan locked yet"


def test_inbox_totals_filters_metrics_and_csv(client):
    headers, _ = register(client, "stats@example.com")
    client.post("/feedback", json={"kind": "full", "answers": {"upset": "not_really", "upset_reason": "no habit yet", "confusing": ["tutorial"], "broke": "mic died"}, "trigger": "exit_intent"}, headers=headers)
    client.post("/feedback", json={"kind": "full", "answers": {"upset": "very", "liked_most": "plan", "quit_reason": "week 2 slump"}, "trigger": "exit_intent"})

    inbox = client.get("/admin/feedback", headers=ADMIN).json()
    stats = inbox["stats"]
    assert stats["total"] == inbox["total"] >= 2
    assert stats["upset"]["very"] >= 1 and stats["upset"]["not_really"] >= 1
    assert stats["triggers"]["exit_intent"] >= 2
    assert stats["confusing"]["tutorial"] >= 1 and stats["liked_most"]["plan"] >= 1
    assert stats["broke_reports"] >= 1 and stats["quit_notes"] >= 1
    assert stats["kinds"]["full"] >= 2 and stats["kinds"]["plan_fit"] >= 1
    assert stats["plan_fit"]["too_hard"] >= 1 and stats["task_quality"]["off"] >= 1
    assert stats["tweak_reasons"]["wrong_time"] >= 1 and stats["task_clear"]["yes"] >= 1
    assert stats["legacy_count"] >= 1 and 1 <= stats["legacy_average_rating"] <= 5
    assert stats["last_7_days"] >= 2

    metrics = inbox["metrics"]
    for key in ("signups", "built_plan", "locked_plan", "day3_pct", "week2_pct", "completion_pct"):
        assert key in metrics, key
    # Test accounts live on example.com and are left out of the product numbers.
    assert metrics["signups"] == 0

    only_exit = client.get("/admin/feedback?trigger=exit_intent", headers=ADMIN).json()
    assert only_exit["items"] and all(i["trigger"] == "exit_intent" for i in only_exit["items"])
    only_tweaks = client.get("/admin/feedback?kind=tweaks", headers=ADMIN).json()
    assert only_tweaks["items"] and all(i["kind"] == "tweaks" for i in only_tweaks["items"])

    csv_resp = client.get("/admin/feedback.csv", headers=ADMIN)
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in csv_resp.headers["content-disposition"]
    lines = csv_resp.text.strip().splitlines()
    assert lines[0].startswith("id,created_at,user_email")
    assert "kind" in lines[0] and "answers" in lines[0] and "goal" in lines[0]
    assert len(lines) - 1 == inbox["total"]


def test_inbox_needs_the_passphrase(client, monkeypatch):
    assert client.get("/admin/feedback").status_code == 403
    assert client.get("/admin/feedback", headers={"X-Internal-Token": "wrong"}).status_code == 403
    assert client.get("/admin/feedback.csv", headers={"X-Internal-Token": "wrong"}).status_code == 403

    monkeypatch.delenv("FEEDBACK_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("INTERNAL_ADMIN_TOKEN", raising=False)
    assert client.get("/admin/feedback", headers=ADMIN).status_code == 503


def test_feedback_is_exported_and_erased_with_the_account(client):
    headers, user_id = register(client, "gdpr-fb@example.com")
    client.post("/feedback", json={"kind": "full", "answers": {"upset": "very"}, "trigger": "timer", "comment": "keep it"}, headers=headers)

    export = client.get("/account/export", headers=headers).json()
    assert export["feedback_forms"][0]["comment"] == "keep it"
    assert export["feedback_forms"][0]["sequence_no"] == 1
    assert json.loads(export["feedback_forms"][0]["answers"])["upset"] == "very"

    resp = client.request(
        "DELETE", "/account",
        json={"confirmation": "DELETE", "password": "correct-horse-battery"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"]["user_feedback"] == 1
    assert not [i for i in client.get("/admin/feedback", headers=ADMIN).json()["items"] if i["user_id"] == user_id]
