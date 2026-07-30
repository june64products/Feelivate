"""
Regression cover for the guarantees we make to users and to regulators.

These are not ordinary feature tests. Each one pins a behaviour that, if it
silently broke, would be a compliance failure rather than a bug report:

  * no account is created without a lawful basis (Art 6 / Art 9)
  * consent is recorded in a way that can be produced as evidence (Art 7(1))
  * withdrawing consent actually stops the processing (Art 7(3))
  * access and portability work (Art 15 / Art 20)
  * erasure is complete and immediate (Art 17)
  * one user can never reach another's wellbeing content (Art 32)

Each test drives a throwaway SQLite database through the real app.
"""

import json
import os
import tempfile

import pytest


def full_consent(client):
    """Every required consent, granted.

    Read from the running app rather than hardcoded, so renaming or adding a
    required consent can't leave the suite signing up with an incomplete set
    and still passing. Fetched through the client instead of imported from
    app.privacy because importing the app package at module scope would bind
    the database engine before the fixture has pointed it at a temp file.
    """
    body = client.get("/legal/consents").json()
    return {item["key"]: True for item in body["catalogue"] if item["required"]}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    """A TestClient backed by a disposable SQLite file."""
    workdir = tmp_path_factory.mktemp("feelivate-db")
    os.environ["APP_ENV"] = "development"
    os.environ["JWT_SECRET_KEY"] = "test-only-secret-not-used-anywhere-real"
    os.environ["DATABASE_URL"] = ""
    # The vector store is optional infrastructure; keep the tests off it.
    os.environ.pop("QDRANT_URL", None)
    os.environ.pop("QDRANT_API_KEY", None)

    cwd = os.getcwd()
    os.chdir(workdir)
    try:
        from fastapi.testclient import TestClient

        from app.database import init_db
        from app.main import app
        from app.ratelimit import LIMITERS, SlidingWindowLimiter

        # Every request here comes from the same client address, so the
        # production sign-up quota (5/hour/IP) would throttle the suite itself.
        # Widen the windows rather than disabling them, so a limiter that broke
        # outright would still show up.
        for bucket in ("signup", "login", "account_delete", "account_export"):
            LIMITERS[bucket] = SlidingWindowLimiter(1000, 3600)

        init_db()
        yield TestClient(app)
    finally:
        os.chdir(cwd)


def register(client, email, consents=None):
    """Create an account and return (auth headers, user id, response)."""
    resp = client.post(
        "/signup",
        json={
            "email": email,
            "password": "correct-horse-battery",
            "name": email.split("@")[0],
            "consents": full_consent(client) if consents is None else consents,
        },
    )
    if resp.status_code != 200:
        return None, None, resp
    body = resp.json()
    return {"Authorization": f"Bearer {body['access_token']}"}, body["user_id"], resp


# ── Consent as a precondition ───────────────────────────────────────────────

def test_consent_catalogue_is_public(client):
    """The sign-up form needs it before an account exists."""
    resp = client.get("/legal/consents")
    assert resp.status_code == 200

    body = resp.json()
    required = {item["key"] for item in body["catalogue"] if item["required"]}
    assert required, "there must be at least one required consent"

    # The Art 9 consent must be its own item, flagged explicit, so the UI can
    # render it separately. Art 7(2) requires it to be clearly distinguishable
    # from the terms, and Art 9(2)(a) requires it to be explicit — merging it
    # into the terms tick to shorten the form would invalidate it.
    explicit = [i for i in body["catalogue"] if i["explicit"]]
    assert len(explicit) == 1
    assert explicit[0]["key"] == "sensitive_data"
    assert explicit[0]["required"] is True

    # Specific enough to be informed consent: it has to say what is processed
    # and what for, not just "your data".
    label = explicit[0]["label"].lower()
    assert "explicitly consent" in label
    assert "journals" in label and "voice notes" in label and "emotion logs" in label


def test_signup_without_consent_creates_nothing(client):
    resp = client.post(
        "/signup",
        json={"email": "nobasis@example.com", "password": "correct-horse-battery"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["error"] == "consent_required"

    # Crucially, the refusal must happen before the INSERT — otherwise we would
    # be holding an account we had no basis to create.
    login = client.post(
        "/login",
        json={"email": "nobasis@example.com", "password": "correct-horse-battery"},
    )
    assert login.status_code == 401


def test_signup_refused_when_only_the_art9_consent_is_withheld(client):
    partial = {**full_consent(client), "sensitive_data": False}
    _, _, resp = register(client, "partial@example.com", consents=partial)
    assert resp.status_code == 400
    assert "sensitive_data" in resp.json()["detail"]["missing"]


def test_consent_is_recorded_as_evidence(client):
    """Art 7(1) — we must be able to show what was agreed, and under which version."""
    headers, _, resp = register(client, "ledger@example.com")
    assert resp.json()["consent_required"] == []

    state = client.get("/account/consents", headers=headers).json()
    # Every required consent is on the ledger, stamped with the policy version
    # that was actually shown — consent to an older wording is not consent to
    # the current one.
    for key in full_consent(client):
        assert state["state"][key]["granted"] is True
        assert state["state"][key]["policy_version"] == state["policy_version"]
        assert state["state"][key]["recorded_at"]


def test_withdrawing_consent_stops_the_processing(client):
    """Art 7(3) — withdrawal has to actually do something."""
    headers, user_id, _ = register(client, "withdraw@example.com")

    resp = client.post(
        "/account/consents/withdraw",
        json={"consent_type": "sensitive_data"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["blocks_service"] is True

    blocked = client.post(
        "/chat",
        json={"message": "hello", "user_id": user_id},
        headers=headers,
    )
    assert blocked.status_code == 403
    assert blocked.json()["detail"]["error"] == "consent_required"

    # Withdrawal must never cost the user access to their own data.
    assert client.get("/account/export", headers=headers).status_code == 200

    regrant = client.post("/account/consents", json={"consents": full_consent(client)}, headers=headers)
    assert regrant.status_code == 200
    assert regrant.json()["missing"] == []


# ── Access, portability, erasure ────────────────────────────────────────────

def test_export_is_complete_and_excludes_credentials(client):
    """Art 15 and Art 20."""
    headers, user_id, _ = register(client, "export@example.com")

    from app.database import SessionLocal
    from app.models import ChatMessage, Session as UserSession

    db = SessionLocal()
    db.add(UserSession(id="export-sess", user_id=user_id, focus="get fit"))
    db.flush()
    db.add(ChatMessage(session_id="export-sess", role="user", content="a private entry"))
    db.commit()
    db.close()

    resp = client.get("/account/export", headers=headers)
    assert resp.status_code == 200
    assert "attachment" in resp.headers["content-disposition"]
    # The file must not linger in a proxy or browser cache.
    assert resp.headers["cache-control"] == "no-store"

    export = json.loads(resp.content)
    assert export["account"]["email"] == "export@example.com"
    assert export["sessions"][0]["messages"][0]["content"] == "a private entry"
    # One ledger row per required consent — the evidence Art 7(1) demands has
    # to survive into the export the user can actually read.
    assert len(export["consents"]) == len(full_consent(client))

    # Credentials are not information about the person, and exporting them only
    # creates another place for them to leak.
    serialised = json.dumps(export)
    assert "correct-horse-battery" not in serialised
    assert "$argon2" not in serialised


def test_deletion_is_immediate_and_cascades(client):
    """Art 17 — no soft delete, nothing orphaned, no working session left behind."""
    headers, user_id, _ = register(client, "erase@example.com")

    from app.database import SessionLocal
    from app.models import ChatMessage, RoadmapTask, Session as UserSession

    db = SessionLocal()
    db.add(UserSession(id="erase-sess", user_id=user_id, focus="run"))
    db.flush()
    db.add(ChatMessage(session_id="erase-sess", role="user", content="entry"))
    db.add(RoadmapTask(session_id="erase-sess", month=1, week=1, title="run 5k"))
    db.commit()
    db.close()

    resp = client.request(
        "DELETE",
        "/account",
        json={"confirmation": "DELETE", "password": "correct-horse-battery"},
        headers=headers,
    )
    assert resp.status_code == 200

    deleted = resp.json()["deleted"]
    assert deleted["users"] == 1
    assert deleted["sessions"] == 1
    assert deleted["chat_messages"] == 1
    assert deleted["roadmap_tasks"] == 1
    assert deleted["user_consents"] == len(full_consent(client))

    assert client.get("/me", headers=headers).status_code == 401
    assert client.post(
        "/login", json={"email": "erase@example.com", "password": "correct-horse-battery"}
    ).status_code == 401


@pytest.mark.parametrize(
    "payload,expected",
    [
        ({"confirmation": "yes", "password": "correct-horse-battery"}, 400),
        ({"confirmation": "DELETE", "password": "wrong-password"}, 401),
    ],
)
def test_deletion_needs_both_confirmations(client, payload, expected):
    """A stolen session token alone must not be able to destroy someone's history."""
    headers, _, _ = register(client, f"guard{expected}@example.com")
    assert client.request("DELETE", "/account", json=payload, headers=headers).status_code == expected
    # Still very much alive.
    assert client.get("/me", headers=headers).status_code == 200


# ── Access control between accounts ─────────────────────────────────────────

def test_one_user_cannot_reach_anothers_content(client):
    """Authentication is not authorisation. These endpoints once checked only the former."""
    owner_headers, owner_id, _ = register(client, "owner@example.com")
    other_headers, _, _ = register(client, "other@example.com")

    from app.database import SessionLocal
    from app.models import ChatMessage, RoadmapTask, Session as UserSession

    db = SessionLocal()
    db.add(UserSession(id="owned-sess", user_id=owner_id, focus="private goal"))
    db.flush()
    db.add(ChatMessage(session_id="owned-sess", role="user", content="private journal"))
    task = RoadmapTask(session_id="owned-sess", month=1, week=1, title="task")
    db.add(task)
    db.commit()
    task_id = task.id
    db.close()

    assert client.get("/sessions/owned-sess/history", headers=owner_headers).status_code == 200
    assert client.get("/sessions/owned-sess/history", headers=other_headers).status_code == 403
    assert client.get("/sessions/owned-sess/tasks", headers=other_headers).status_code == 403

    # task_id is a sequential integer, so this endpoint is trivially enumerable
    # without an ownership check.
    assert client.patch(
        f"/tasks/{task_id}", json={"is_completed": True}, headers=other_headers
    ).status_code == 403
    assert client.patch(
        f"/tasks/{task_id}", json={"is_completed": True}, headers=owner_headers
    ).status_code == 200


def test_login_does_not_reveal_whether_an_account_exists(client):
    """On a wellbeing product, "this address has an account" is itself a disclosure."""
    register(client, "known@example.com")

    unknown = client.post("/login", json={"email": "nobody@example.com", "password": "x"})
    wrong_password = client.post("/login", json={"email": "known@example.com", "password": "x"})

    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json() == wrong_password.json()


def test_admin_migrate_is_closed_by_default(client):
    """DDL behind an unauthenticated endpoint, on a database of special category data."""
    assert client.post("/admin/migrate").status_code in (403, 503)
