"""
The emails that leave the product.

The morning note replies to last night's voice journal in the person's own
words, then gives today's task — no stock tips, no stock encouragement.
One evening note (20:30) when the day's journal is missing, carrying the
streak warning when there is one. And "your review is in" the evening a
week's review becomes readable, announced once per week.
"""

import json
import os
from datetime import date, datetime, timedelta

import pytest
import pytz


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    workdir = tmp_path_factory.mktemp("feelivate-emails-db")
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
    resp = client.post("/signup", json={"email": email, "password": "correct-horse-battery", "name": "Priya Dev", "consents": consents})
    assert resp.status_code == 200, resp.text
    b = resp.json()
    return {"Authorization": f"Bearer {b['access_token']}"}, b["user_id"]


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


TRANSCRIPT = ("Okay so the five-finger exercise was clumsy, my ring finger kept collapsing, "
              "but I did the full ten minutes and by the end it was smoother. "
              "Tomorrow I want to try it with the metronome at sixty.")


# ─── the morning note ────────────────────────────────────────────────────────

def test_morning_note_quotes_their_words_and_drops_the_filler():
    from app.email_service import build_daily_email

    yesterday = {"date": "2026-10-20", "weekday_label": "Tuesday", "transcript": TRANSCRIPT,
                 "emotion_label": "focused", "emotion_score": 6, "one_liner": "Clumsy but complete.", "checkin": "done"}
    mentor = {"their_line": "Tomorrow I want to try it with the metronome at sixty.",
              "read": "Your ring finger collapsing is a hand-position thing, not a talent thing: keep the wrist level and it stops. Sixty on the metronome is the right call. Today's four bars are the same exercise with a tune on top.",
              "hook": "About your ring finger, Priya"}
    subject, preheader, rows = build_daily_email(
        user_name="Priya Dev", day_label="Wednesday", task_title="Learn the first four bars of Twinkle, right hand only.",
        task_description="Slow is fine.", week_number=1, today_str="Wednesday, 21 October", week_theme="First Keys",
        day_index=3, day_count=7, week_dots=[("M", "done"), ("T", "done"), ("W", "today"), ("T", "upcoming"), ("F", "upcoming"), ("S", "upcoming"), ("S", "upcoming")],
        streak=2, yesterday=yesterday, mentor=mentor, checkin_url="https://api.example/checkin?token=x",
        rating_urls=("https://api.example/up", "https://api.example/down"), reply_to="info@example.com",
    )
    # The notification line is the mentor's hook from their note; the preview
    # under it is the mentor's first sentence — both about them, neither a calendar line.
    assert subject == "About your ring finger, Priya"
    assert not subject.startswith("Week 1")
    assert preheader == "Your ring finger collapsing is a hand-position thing, not a talent thing: keep the wrist level and it stops."

    # Without a hook, the subject is their own sentence (cut at a word for phone inboxes).
    subject2, pre2, _ = build_daily_email(
        user_name="Priya Dev", day_label="Wednesday", task_title="Learn the first four bars of Twinkle, right hand only.",
        task_description="", week_number=1, day_index=3, day_count=7, streak=2, yesterday=yesterday,
        mentor={"their_line": mentor["their_line"], "read": mentor["read"], "hook": None},
    )
    assert subject2 == "“Tomorrow I want to try it with the metronome at…” — day 3 is up"
    # In their words, with the stored read of the night.
    assert "Last night, in your words" in rows
    assert "Tomorrow I want to try it with the metronome at sixty." in rows
    assert "Tuesday &middot; focused &middot; 6/10" in rows
    assert "What your mentor read" in rows and "keep the wrist level" in rows
    # Today's task, the week strip, and the door into the app.
    assert "Learn the first four bars of Twinkle" in rows
    assert "Day 3 of 7" in rows and "Your week so far" in rows
    assert "Open today" in rows and "/app" in rows
    assert "Mark today done" in rows and "token=x" in rows
    assert "2 in a row, Priya." in rows
    # The stock blocks are gone.
    for gone in ("How to do it well", "Avoid today", "For you,", "Good morning", "Daily brief"):
        assert gone not in rows, gone
    # Still one tap to say whether the task was clear, and a person to reply to.
    assert "Was today" in rows and "reply to this email" in rows


def test_first_day_of_a_week_has_no_last_night_and_a_plain_subject():
    from app.email_service import build_daily_email

    subject, _pre, rows = build_daily_email(
        user_name="Priya", day_label="Monday", task_title="Sit at the piano, play middle C.", task_description="",
        week_number=1, day_index=1, day_count=7, streak=0, yesterday=None, mentor=None,
    )
    assert subject == "Day 1 of 7, Priya — today's one thing"
    assert "Last night" not in rows and "What your mentor read" not in rows
    assert "Day 1 of 7, Priya." in rows


def test_a_ticked_day_without_a_note_is_named_not_invented():
    from app.email_service import build_daily_email

    yesterday = {"date": "2026-10-20", "weekday_label": "Tuesday", "transcript": "", "emotion_label": None,
                 "emotion_score": None, "one_liner": None, "checkin": "done"}
    subject, _pre, rows = build_daily_email(
        user_name="Priya", day_label="Wednesday", task_title="Four bars.", task_description="",
        week_number=1, day_index=3, day_count=7, streak=1, yesterday=yesterday, mentor=None,
    )
    assert "No note last night" in rows and "Tuesday got ticked" in rows
    assert "What your mentor read" not in rows
    assert subject == "Day 3 of 7, Priya — today's one thing"


def test_mentor_read_sends_the_whole_note_and_keeps_only_verbatim_lines(monkeypatch):
    import app.llm as llm
    from app.email_service import _mentor_read

    seen = {}

    def fake_llm(prompt, **kw):
        seen["prompt"] = prompt
        return json.dumps({"their_line": "my ring finger kept giving way",  # a paraphrase — not what they said
                           "read": "Your ring finger collapsing is a wrist-height problem; keep the wrist level today. Sixty on the metronome is the right call. Today's four bars are the same motion with a tune.",
                           "hook": "The metronome idea — yes, today"})

    monkeypatch.setattr(llm, "call_llm", fake_llm)
    journal = {"transcript": TRANSCRIPT, "emotion_label": "focused", "emotion_score": 6, "one_liner": "Clumsy but complete."}
    out = _mentor_read("Priya Dev", "learn the piano", journal, "Four bars of Twinkle", "right hand only", "Wednesday")
    assert "metronome at sixty" in seen["prompt"], "the complete transcript went to the model"
    assert out["read"].startswith("Your ring finger collapsing")
    assert out["their_line"] in TRANSCRIPT, "a paraphrase is replaced by a sentence they actually said"
    assert out["hook"] == "The metronome idea — yes, today", "a hook that names something from the note is kept"


def test_a_subject_hook_that_could_be_sent_to_anyone_is_dropped(monkeypatch):
    import app.llm as llm
    from app.email_service import _hook_ok, _mentor_read

    journal = {"transcript": TRANSCRIPT, "emotion_label": "focused", "emotion_score": 6, "one_liner": "Clumsy but complete."}
    for generic in ("Let's go, Priya!", "Your morning note is here", "Good morning Priya", "A new day, a new task"):
        monkeypatch.setattr(llm, "call_llm", lambda *a, **k: json.dumps({
            "their_line": "I did the full ten minutes and by the end it was smoother.",
            "read": "Your ring finger collapsing is a wrist-height problem; keep the wrist level today. Sixty on the metronome is the right call. Today's four bars are the same motion with a tune.",
            "hook": generic}))
        out = _mentor_read("Priya", "learn the piano", journal, "Four bars", "", "Wednesday")
        assert out["hook"] is None, generic
    assert _hook_ok("About your ring finger, Priya", TRANSCRIPT, "Priya")
    assert _hook_ok("Sixty on the metronome. Today.", TRANSCRIPT, "Priya")
    assert not _hook_ok("About your ring finger and the metronome and everything else you said", TRANSCRIPT, "Priya"), "too long for a notification"


def test_mentor_read_filler_is_thrown_away(monkeypatch):
    import app.llm as llm
    from app.email_service import _mentor_read

    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: json.dumps({
        "their_line": "I did the full ten minutes and by the end it was smoother.",
        "read": "You've got this, Priya! Every small step counts. Keep going and crush today's task!"}))
    journal = {"transcript": TRANSCRIPT, "emotion_label": "focused", "emotion_score": 6, "one_liner": "Clumsy but complete."}
    out = _mentor_read("Priya", "learn the piano", journal, "Four bars", "", "Wednesday")
    assert "got this" not in out["read"] and "crush" not in out["read"]
    assert out["read"].startswith("Last night read focused at 6/10.")
    assert out["their_line"] == "I did the full ten minutes and by the end it was smoother."


def test_mentor_read_when_the_model_is_down(monkeypatch):
    import app.llm as llm
    from app.email_service import _mentor_read

    monkeypatch.setattr(llm, "call_llm", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("offline")))
    journal = {"transcript": TRANSCRIPT, "emotion_label": "focused", "emotion_score": 6, "one_liner": "Clumsy but complete."}
    out = _mentor_read("Priya", "learn the piano", journal, "Four bars", "", "Wednesday")
    assert out["read"] == "Last night read focused at 6/10. Clumsy but complete. Today picks up from there: Four bars."
    assert out["their_line"] in TRANSCRIPT


# ─── the evening note ────────────────────────────────────────────────────────

def test_evening_note_is_one_email_with_the_streak_inside_it():
    from app.email_service import build_evening_email

    e = build_evening_email("Priya Dev", "Four bars of Twinkle", streak=4, streak_at_risk=True)
    assert e["subject"] == "4 days in a row — one minute keeps it"
    assert e["heading"] == "Priya, how did today actually go?"
    assert any("Four bars of Twinkle" in line for line in e["body_lines"])
    assert any("4 days in a row" in line for line in e["body_lines"])
    assert "nothing is lost" in e["footer_note"]

    quiet = build_evening_email("Priya", "Four bars", streak=0, streak_at_risk=False)
    assert quiet["subject"] == "How did today go, Priya?"
    assert not any("in a row" in line for line in quiet["body_lines"]) and quiet["footer_note"] == ""
    for gone in ("empty", "hasn't been logged", "ends at midnight"):
        assert gone not in " ".join(quiet["body_lines"]) + quiet["subject"], gone


def test_evening_note_goes_once_at_2030_only_when_the_journal_is_missing(client, monkeypatch):
    import app.email_service as es
    from app.database import SessionLocal
    from app.models import DailyCheckin, Session as UserSession, User, UserStreak, VoiceJournal

    headers, uid = register(client, "evening@example.com")
    start = monday_of(date.today())
    end = start + timedelta(days=6)
    days = [(start + timedelta(days=i)).strftime("%b %d (%a)") for i in range(7)]
    plan = {"week_number": 1, "theme": "First Keys", "start_date": start.isoformat(), "days": [{"day": d, "action": f"Piano ({d})"} for d in days]}
    db = SessionLocal()
    u = db.query(User).filter(User.id == uid).first()
    u.email_notifications_enabled = 1
    u.preferred_notification_timezone = "UTC"
    db.add(UserSession(id="s-evening", user_id=uid, focus="learn the piano", phase="active", current_week=1,
                       plan_start_date=start.isoformat(), week_plan_json=json.dumps(plan), result_json=json.dumps([plan])))
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    db.add(DailyCheckin(user_id=uid, session_id="s-evening", date=yesterday, status="done"))
    db.add(UserStreak(user_id=uid, current_streak=3, longest_streak=3, last_checkin=yesterday, total_done=3))
    db.commit()
    db.close()

    sent = []
    monkeypatch.setattr(es, "send_evening_email", lambda to, name, task, streak=0, streak_at_risk=False: sent.append((to, task, streak, streak_at_risk)) or True)

    at_2031 = datetime.combine(date.today(), datetime.min.time(), tzinfo=pytz.utc).replace(hour=20, minute=31)
    es.run_evening_reminders(now_utc=at_2031.replace(hour=19))   # too early
    assert sent == []
    es.run_evening_reminders(now_utc=at_2031)
    assert len(sent) == 1
    to, task, streak, at_risk = sent[0]
    assert to == "evening@example.com" and task.startswith("Piano") and streak == 3 and at_risk is True
    es.run_evening_reminders(now_utc=at_2031.replace(minute=35))  # same evening: once only
    assert len(sent) == 1

    # Tomorrow, with the journal already in: nothing to say.
    db = SessionLocal()
    db.add(VoiceJournal(user_id=uid, session_id="s-evening", date=(date.today() + timedelta(days=1)).isoformat(), transcript="done", emotion_label="calm", emotion_score=7))
    db.commit()
    db.close()
    es.run_evening_reminders(now_utc=at_2031 + timedelta(days=1))
    assert len(sent) == 1


# ─── your review is in ───────────────────────────────────────────────────────

REPORT = {
    "week_number": 1, "consistency_score": 57, "days_done": 4, "days_missed": 3, "past_days_count": 7,
    "entry_count": 4, "avg_score": 6.2, "momentum_score": 58, "momentum_label": "Building",
    "week_badge": {"name": "Sunday Sprint", "reason": "cleared the missed line"},
    "best_quote": "It actually sounded like music for a second.",
    "hidden_insight": "Your motivation jumps the moment the notes turn into a tune.",
    "days": [
        {"date": "2026-10-12", "has_journal": True, "score": 7}, {"date": "2026-10-13", "has_journal": True, "score": 6},
        {"date": "2026-10-15", "has_journal": True, "score": 8}, {"date": "2026-10-18", "has_journal": True, "score": 4},
    ],
}


def test_review_note_is_a_teaser_with_the_door_to_the_archive():
    from app.email_service import build_review_email

    subject, preheader, rows = build_review_email("Priya Dev", REPORT, 1, "2026-10-12", "2026-10-18", has_next_plan=False)
    assert subject == "Priya, your week had a pattern · Sunday Sprint"
    assert preheader == "4 of 7 days. Thursday was the high point."
    # No insight → the badge carries the subject; neither → plain.
    no_insight = dict(REPORT, hidden_insight="")
    assert build_review_email("Priya", no_insight, 1, "2026-10-12", "2026-10-18")[0] == "Week 1: Sunday Sprint. Here's why."
    bare = dict(REPORT, hidden_insight="", week_badge={})
    assert build_review_email("Priya", bare, 1, "2026-10-12", "2026-10-18")[0] == "Your Week 1 review is in"
    assert "4 of 7 days. Thursday was the high point." in rows
    assert "Sunday Sprint" in rows
    assert "57%" in rows and "4/7" in rows and "6.2/10" in rows
    assert "It actually sounded like music for a second." in rows and "You, this week" in rows
    assert "one pattern you probably haven" in rows
    assert "/app?open=archive" in rows and "Read your Week 1 review" in rows
    assert "Week 2 gets built from this review" in rows
    # The review itself stays in the app.
    assert "Your motivation jumps" not in rows

    quiet = dict(REPORT, quiet_week=True, days_done=0, entry_count=0, best_quote="", hidden_insight="")
    subject, _p, rows = build_review_email("Priya", quiet, 2, "2026-10-19", "2026-10-25", has_next_plan=True)
    assert subject == "Week 2 went quiet — your review is in"
    assert "This week went quiet." in rows and "not a verdict" in rows
    assert "gets built from this review" not in rows


def test_review_note_goes_once_the_week_is_over_and_only_once(client, monkeypatch):
    import app.email_service as es
    from app.database import SessionLocal
    from app.models import Session as UserSession, User, VoiceJournal, WeeklyReport

    headers, uid = register(client, "review@example.com")
    start = monday_of(date.today()) - timedelta(days=7)      # last week, ended Sunday
    end = start + timedelta(days=6)
    days = [(start + timedelta(days=i)).strftime("%b %d (%a)") for i in range(7)]
    plan = {"week_number": 1, "theme": "First Keys", "start_date": start.isoformat(), "days": [{"day": d, "action": f"Piano ({d})"} for d in days]}
    db = SessionLocal()
    u = db.query(User).filter(User.id == uid).first()
    u.email_notifications_enabled = 1
    u.preferred_notification_timezone = "UTC"
    db.add(UserSession(id="s-review", user_id=uid, focus="learn the piano", phase="active", current_week=1,
                       plan_start_date=start.isoformat(), week_plan_json=json.dumps(plan), result_json=json.dumps([plan])))
    db.add(VoiceJournal(user_id=uid, session_id="s-review", date=end.isoformat(), transcript="Did the whole line. Tired.", emotion_label="drained", emotion_score=4))
    # The review already exists and is valid for one journal — no model call needed.
    cached = dict(REPORT, week_number=1, days_done=1, entry_count=1, past_days_count=7, week_start=start.isoformat(), week_end=end.isoformat())
    db.add(WeeklyReport(user_id=uid, session_id="s-review", week_number=1, week_start=start.isoformat(), week_end=end.isoformat(), report_json=json.dumps(cached)))
    db.commit()
    db.close()

    sent = []
    monkeypatch.setattr(es, "send_week_review_email", lambda to, name, report, wk, ws, we, has_next_plan=False: sent.append((to, wk, ws, has_next_plan)) or True)
    # "Last Sunday" is up to six days ago depending on the weekday this runs on.
    monkeypatch.setattr(es, "REVIEW_EMAIL_MAX_AGE_DAYS", 7)

    at_2131 = datetime.combine(date.today(), datetime.min.time(), tzinfo=pytz.utc).replace(hour=21, minute=31)
    es.run_week_review_emails(now_utc=at_2131.replace(hour=20))   # not the hour
    assert sent == []
    es.run_week_review_emails(now_utc=at_2131)
    assert sent == [("review@example.com", 1, start.isoformat(), False)]
    es.run_week_review_emails(now_utc=at_2131.replace(minute=36))  # once per week, not per tick
    assert len(sent) == 1

    db = SessionLocal()
    u = db.query(User).filter(User.id == uid).first()
    assert u.last_review_email_key == f"s-review:{start.isoformat()}"
    db.close()


def test_review_note_waits_for_a_week_that_is_still_running(client, monkeypatch):
    import app.email_service as es
    from app.database import SessionLocal
    from app.models import Session as UserSession, User

    headers, uid = register(client, "review-running@example.com")
    start = monday_of(date.today())                             # this week, still on
    days = [(start + timedelta(days=i)).strftime("%b %d (%a)") for i in range(7)]
    plan = {"week_number": 1, "theme": "First Keys", "start_date": start.isoformat(), "days": [{"day": d, "action": f"Piano ({d})"} for d in days]}
    db = SessionLocal()
    u = db.query(User).filter(User.id == uid).first()
    u.email_notifications_enabled = 1
    u.preferred_notification_timezone = "UTC"
    db.add(UserSession(id="s-review-running", user_id=uid, focus="learn the piano", phase="active", current_week=1,
                       plan_start_date=start.isoformat(), week_plan_json=json.dumps(plan), result_json=json.dumps([plan])))
    db.commit()
    db.close()

    monkeypatch.setattr(es, "send_week_review_email", lambda *a, **k: (_ for _ in ()).throw(AssertionError("nothing to announce yet")))
    at_2131 = datetime.combine(date.today(), datetime.min.time(), tzinfo=pytz.utc).replace(hour=21, minute=31)
    if date.today().weekday() == 6:
        pytest.skip("on a Sunday this week's end is today; the running-week case needs another day")
    es.run_week_review_emails(now_utc=at_2131)


# ─── the next-week prompt still reads the whole review (unchanged contract) ─

def test_deep_link_param_is_documented_in_the_frontend():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = open(os.path.join(root, "frontend", "src", "pages", "WorkspacePage.tsx"), encoding="utf-8").read()
    assert "open === 'archive'" in src, "the review email's /app?open=archive link must land on the archive"
