"""
The product-feedback form: the popup new users see and the side tab everyone
sees. Each submission records who, which time (1st, 2nd …), which moment
asked (logout, leaving the tab, the side tab …) and when.

Drives a throwaway SQLite database through the real app, like the privacy
suite does.
"""

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


def test_visitor_can_leave_feedback_without_an_account(client):
    resp = client.post(
        "/feedback",
        json={
            "rating": 4,
            "liked": ["design", "not-a-chip"],
            "confusing": ["signup"],
            "comment": "  Nice, but the sign-up asked a lot.  ",
            "email": "visitor@example.com",
            "trigger": "side_tab",
            "page": "/features",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "ok" and body["sequence_no"] is None

    inbox = client.get("/admin/feedback", headers=ADMIN).json()
    item = next(i for i in inbox["items"] if i["id"] == body["id"])
    assert item["user_id"] is None and item["email"] == "visitor@example.com"
    assert item["liked"] == ["design"], "unknown chips are dropped, not stored"
    assert item["confusing"] == ["signup"]
    assert item["comment"] == "Nice, but the sign-up asked a lot."
    assert item["trigger"] == "side_tab" and item["page"] == "/features"


def test_each_submission_records_who_which_time_and_which_moment(client):
    headers, user_id = register(client, "seq@example.com")

    first = client.post("/feedback", json={"rating": 3, "trigger": "first_plan"}, headers=headers).json()
    second = client.post("/feedback", json={"rating": 5, "trigger": "logout", "comment": "better now"}, headers=headers).json()
    assert (first["sequence_no"], second["sequence_no"]) == (1, 2)

    status = client.get("/feedback/me", headers=headers).json()
    assert status["count"] == 2 and status["last_at"]

    inbox = client.get("/admin/feedback", headers=ADMIN).json()
    mine = sorted((i for i in inbox["items"] if i["user_id"] == user_id), key=lambda i: i["sequence_no"])
    assert [i["trigger"] for i in mine] == ["first_plan", "logout"]
    assert mine[0]["user_email"] == "seq@example.com"
    assert mine[0]["account_age_days"] == 0
    assert all(i["created_at"] for i in mine)
    # A signed-in user is reachable through the account: no separate address is kept.
    assert client.post(
        "/feedback", json={"rating": 4, "email": "ignored@example.com"}, headers=headers
    ).status_code == 200
    latest = max((i for i in client.get("/admin/feedback", headers=ADMIN).json()["items"] if i["user_id"] == user_id), key=lambda i: i["sequence_no"])
    assert latest["sequence_no"] == 3 and latest["email"] is None


@pytest.mark.parametrize("rating", [0, 6, "five"])
def test_rating_must_be_one_to_five(client, rating):
    resp = client.post("/feedback", json={"rating": rating, "trigger": "timer"})
    assert resp.status_code in (400, 422)


def test_unknown_trigger_is_recorded_as_the_side_tab(client):
    body = client.post("/feedback", json={"rating": 2, "trigger": "made-up"}).json()
    item = next(i for i in client.get("/admin/feedback", headers=ADMIN).json()["items"] if i["id"] == body["id"])
    assert item["trigger"] == "side_tab"


def test_inbox_needs_the_passphrase(client, monkeypatch):
    assert client.get("/admin/feedback").status_code == 403
    assert client.get("/admin/feedback", headers={"X-Internal-Token": "wrong"}).status_code == 403
    assert client.get("/admin/feedback.csv", headers={"X-Internal-Token": "wrong"}).status_code == 403

    monkeypatch.delenv("FEEDBACK_ADMIN_TOKEN", raising=False)
    monkeypatch.delenv("INTERNAL_ADMIN_TOKEN", raising=False)
    assert client.get("/admin/feedback", headers=ADMIN).status_code == 503


def test_inbox_totals_filters_and_csv(client):
    headers, _ = register(client, "stats@example.com")
    client.post("/feedback", json={"rating": 1, "trigger": "exit_intent", "confusing": ["tutorial"]}, headers=headers)
    client.post("/feedback", json={"rating": 5, "trigger": "exit_intent", "liked": ["plan"]})

    inbox = client.get("/admin/feedback", headers=ADMIN).json()
    stats = inbox["stats"]
    assert stats["total"] == inbox["total"] >= 2
    assert 1 <= stats["average_rating"] <= 5
    assert stats["triggers"]["exit_intent"] >= 2
    assert stats["confusing"]["tutorial"] >= 1 and stats["liked"]["plan"] >= 1
    assert stats["last_7_days"] >= 2

    only_exit = client.get("/admin/feedback?trigger=exit_intent&min_rating=5", headers=ADMIN).json()
    assert only_exit["items"] and all(i["trigger"] == "exit_intent" and i["rating"] >= 5 for i in only_exit["items"])

    csv_resp = client.get("/admin/feedback.csv", headers=ADMIN)
    assert csv_resp.status_code == 200
    assert csv_resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in csv_resp.headers["content-disposition"]
    lines = csv_resp.text.strip().splitlines()
    assert lines[0].startswith("id,created_at,user_email")
    assert len(lines) - 1 == inbox["total"]


def test_feedback_is_exported_and_erased_with_the_account(client):
    headers, user_id = register(client, "gdpr-fb@example.com")
    client.post("/feedback", json={"rating": 4, "trigger": "timer", "comment": "keep it"}, headers=headers)

    export = client.get("/account/export", headers=headers).json()
    assert export["feedback_forms"][0]["comment"] == "keep it"
    assert export["feedback_forms"][0]["sequence_no"] == 1

    resp = client.request(
        "DELETE", "/account",
        json={"confirmation": "DELETE", "password": "correct-horse-battery"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["deleted"]["user_feedback"] == 1
    assert not [i for i in client.get("/admin/feedback", headers=ADMIN).json()["items"] if i["user_id"] == user_id]
