"""
Seed a demo account with a full 10-week journey, so the app can be viewed the
way a long-running user sees it: a deep archive, a real streak, and a week
currently in flight.

The data is a plausible beginner-guitar arc rather than filler — an eager start,
a hard wall at barre chords in week 5 (two entries all week, the lowest mood of
the run), a deliberate lighter week to recover, then a climb to actually playing
a song. Reports, journals, check-ins and the streak are all derived from the
same day-by-day source below, so every screen agrees with every other.

Weeks 1-10 are finished and archived; week 11 is the live week, part-done, so
the Today card and path row have something to show.

IDEMPOTENT: re-running wipes this account's rows and rebuilds them.

DRY RUN BY DEFAULT. Review the summary, then re-run with --apply.

    python -m scripts.seed_demo_account                 # show what it would write
    python -m scripts.seed_demo_account --apply         # write it

Writes to whatever DATABASE_URL points at — the local sqlite file unless that is
set. Check which database you are pointed at before using --apply.
"""

import argparse
import json
import sys
import uuid
from datetime import date, datetime, timedelta

sys.path.insert(0, ".")

from app.database import SessionLocal, engine  # noqa: E402
from app.models import (  # noqa: E402
    Base, ChatMessage, DailyCheckin, Session, User, UserConsent,
    UserStreak, VoiceJournal, WeeklyReport,
)
from app.privacy import CONSENT_POLICY_VERSION, REQUIRED_CONSENTS  # noqa: E402
from app.security import get_password_hash  # noqa: E402

EMAIL = "ro@example.com"
PASSWORD = "ro1234"
NAME = "Rohan"
GOAL = "Learn guitar and actually play a full song start to finish"

# ── The journey ──────────────────────────────────────────────────────────────
# One entry per week: the plan the mentor built, and what actually happened.
#
# `days`    — the 7 planned tasks (Mon→Sun), the plan card's content.
# `journals`— {weekday_index: (emotion, score, one_liner, transcript)}. A weekday
#             with no entry is a day the user did not log: that is what makes the
#             consistency numbers and the streak breaks real.
WEEKS = [
    {
        "theme": "Make friends with the instrument",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — tune the guitar with an app, then just hold it for 10 min. Get used to the weight.\nBare minimum: tune it and put it back.",
            "Evening — 10 min finger stretches on the fretboard, no chords yet. Build the callus habit.\nBare minimum: 3 min of stretches.",
            "Evening — learn Em. One finger shape, 15 min. Press until it rings clean.\nBare minimum: find Em once.",
            "Evening — Em again, 15 min. Strum it slowly, listen for buzzing strings.\nBare minimum: 5 clean Em strums.",
            "Evening — learn Am. 15 min. Compare the shape to Em — they are neighbours.\nBare minimum: find Am once.",
            "Rest day — let the fingertips recover. Soreness now is normal.\nBare minimum: rest is the task today.",
            "Evening — 15 min: alternate Em and Am slowly. No rhythm yet, just the shapes.\nBare minimum: 5 changes each way.",
        ],
        "journals": {
            0: ("motivated", 8, "Finally took it off the wall after two years.", "Okay so I actually did it, I took the guitar down and tuned it. It's been sitting there for two years. Felt kind of silly just holding it but also kind of good."),
            1: ("motivated", 7, "Fingers hurt but in a good way.", "Did the finger stretches. My fingertips are already sore which apparently is normal. Ten minutes went fast."),
            2: ("focused", 7, "Em is buzzing but it's a chord.", "Learned E minor today. It buzzes a lot, the strings aren't ringing clean, but it's recognisably a chord. Small win."),
            4: ("proud", 8, "Two chords in and it still feels possible.", "Got A minor. It's close to Em so the switch isn't as scary as I thought. Feeling like this might actually stick this time."),
            6: ("focused", 7, "Slow changes, but changes.", "Practiced going between Em and Am. Slow, clumsy, but it's happening. Week one done and I didn't quit."),
        },
    },
    {
        "theme": "Two more shapes, and the first changes",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — learn G. 20 min. It is a stretch, go slow.\nBare minimum: find G once.",
            "Evening — G again + Em. 20 min of switching between the two.\nBare minimum: 10 switches.",
            "Evening — learn D. 20 min. The triangle shape.\nBare minimum: find D once.",
            "Evening — G to D, 20 min. These two live together in a thousand songs.\nBare minimum: 10 switches.",
            "Evening — all four: Em, Am, G, D. 20 min round robin.\nBare minimum: touch each shape once.",
            "Rest day — fingertips need it.\nBare minimum: rest is the task today.",
            "Evening — 20 min: slow chord changes with a count of four between each.\nBare minimum: 5 min of changes.",
        ],
        "journals": {
            0: ("frustrated", 5, "G chord is a hand contortion.", "G is hard. My fingers do not want to spread that way. Twenty minutes and it still sounds like a dropped box of cutlery."),
            1: ("focused", 6, "G is getting less awful.", "Went back at G. Slightly better. The low string finally rang clean a few times."),
            2: ("motivated", 7, "D clicked fast.", "D was way easier than G. Got it in about ten minutes. Nice to have an easy one after yesterday."),
            3: ("proud", 8, "G to D is starting to sound like music.", "Switching G to D and back. It's slow but when I get it clean it actually sounds like the start of a song. That was a good feeling."),
            4: ("focused", 7, "Four chords now.", "All four shapes in one session. Em and Am are automatic now, G still needs a think."),
            6: ("content", 7, "Second week done.", "Steady session. Not exciting but I showed up. Two weeks in a row now which is longer than last time I tried this."),
        },
    },
    {
        "theme": "Put a rhythm under it",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — learn the down-down-up strum. 20 min on one chord only.\nBare minimum: 20 strums of the pattern.",
            "Evening — same pattern, switch between Em and Am on the beat.\nBare minimum: 5 min.",
            "Evening — 20 min with a metronome at 60bpm. Slow is the point.\nBare minimum: 5 min with the click.",
            "Evening — down-down-up-up-down-up. The big one. 20 min.\nBare minimum: learn the pattern on one chord.",
            "Evening — 20 min: the new pattern over G and D.\nBare minimum: 5 min.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: pick any two chords, play in time for a full minute without stopping.\nBare minimum: 30 seconds unbroken.",
        ],
        "journals": {
            0: ("motivated", 8, "Rhythm makes it sound like a real instrument.", "The strumming pattern changed everything. Even one chord with a rhythm sounds like music instead of noise."),
            2: ("frustrated", 5, "The metronome is brutally honest.", "Tried playing to a metronome. Turns out I have been speeding up and slowing down constantly. The click does not let you lie to yourself."),
            3: ("focused", 6, "The long pattern is a lot.", "Down down up up down up. My hand does not want to do it yet. Lots of stopping and restarting."),
            4: ("content", 7, "Slowly locking in.", "Better tonight. The pattern is starting to feel automatic on G at least."),
            6: ("proud", 8, "A full minute without stopping.", "Played Em to Am in time for a whole minute without falling apart. Three weeks and I'm still here."),
        },
    },
    {
        "theme": "Your first actual song",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — pick a two-chord song you genuinely like. 20 min learning its shape.\nBare minimum: choose the song.",
            "Evening — 25 min on the verse only. Slow, with the metronome.\nBare minimum: 10 min on the verse.",
            "Evening — 25 min: verse at half speed, then nudge the tempo up.\nBare minimum: 10 min.",
            "Evening — learn the chorus. 25 min.\nBare minimum: get the chorus chord order down.",
            "Evening — 25 min: join verse to chorus. The join is the hard part.\nBare minimum: play the transition 5 times.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: play the whole thing through, mistakes and all. Do not stop to fix.\nBare minimum: one full pass.",
        ],
        "journals": {
            0: ("excited", 9, "Picked a song I've loved for years.", "Chose my song. Seeing the chords written out and realising I already know three of the four was a genuinely great moment."),
            1: ("focused", 7, "The verse is coming.", "Worked the verse. Slow but it's recognisable. My partner walked past and identified the song which felt amazing."),
            2: ("proud", 8, "Got it up to speed.", "Pushed the tempo up bit by bit. Nearly at the real speed of the song now."),
            4: ("frustrated", 6, "The join between parts keeps breaking.", "Verse is fine, chorus is fine, but going from one to the other I fall apart every time. Annoying."),
            6: ("proud", 9, "Played a whole song. Badly, but whole.", "Played the entire song start to finish. Loads of mistakes, did not stop, and it was unmistakably the song. Best moment of this whole thing so far."),
        },
    },
    {
        "theme": "The barre chord wall",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — introduce F. The barre. 20 min. Expect it to sound dead.\nBare minimum: attempt the shape 10 times.",
            "Evening — F again, 20 min. Focus on thumb position behind the neck.\nBare minimum: 10 attempts.",
            "Evening — 20 min: barre on higher frets where it is easier, then walk it down.\nBare minimum: 5 min.",
            "Evening — F to C, 20 min. Slowly.\nBare minimum: 5 changes.",
            "Evening — 20 min on F. Just F.\nBare minimum: 10 attempts.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 20 min: put F into the song you learned. It belongs there.\nBare minimum: one pass with F in it.",
        ],
        "journals": {
            1: ("frustrated", 3, "F chord is a brick wall.", "Two days on F and I cannot get a single clean note out of it. Every string is muted or buzzing. I genuinely do not understand how anyone does this."),
            4: ("defeated", 2, "Thinking about stopping.", "Skipped a couple of days. Picked it up tonight, still nothing on F. It's the first time in five weeks I've thought maybe I'm just not built for this. Put it down after ten minutes."),
        },
    },
    {
        "theme": "Back to solid ground",
        "win": "Complete 3 of 5 practice days",
        "days": [
            "Evening — no F today. 15 min playing the song you already know, for fun.\nBare minimum: one pass.",
            "Evening — 15 min of the chords that already feel good. Rebuild the enjoyment.\nBare minimum: 5 min.",
            "Evening — 15 min: F for five minutes only, then back to what you enjoy.\nBare minimum: 5 min of anything.",
            "Rest day — genuinely rest.\nBare minimum: rest is the task today.",
            "Evening — 15 min: try Fmaj7, the easier cousin of F. It is a legitimate substitute.\nBare minimum: find the shape.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 20 min: play the song using Fmaj7 where F goes.\nBare minimum: one pass.",
        ],
        "journals": {
            0: ("relieved", 6, "Just played something I can play.", "The plan said no F this week and honestly that was a relief. Played my song a few times and remembered why I wanted to do this."),
            2: ("content", 6, "Five minutes of F is survivable.", "Five minutes on F then back to the fun stuff. Much better approach than grinding at it for twenty."),
            4: ("hopeful", 8, "Fmaj7 actually rings out.", "Tried Fmaj7. It rings clean! It's not the full barre but it sounds right in the song. Feels like a door opened after last week."),
            6: ("proud", 8, "Song is whole again.", "Played the song with Fmaj7 in place of F and it sounds correct. Last week I nearly quit, this week it works."),
        },
    },
    {
        "theme": "Clean changes at real tempo",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — 20 min, metronome at 70bpm, four chords in rotation.\nBare minimum: 5 min with the click.",
            "Evening — 20 min at 80bpm. If it falls apart, drop back to 70.\nBare minimum: 5 min.",
            "Evening — 20 min: one-minute changes. Count how many clean G to D you get in 60 seconds.\nBare minimum: one 60-second round.",
            "Evening — 20 min at 90bpm.\nBare minimum: 5 min.",
            "Evening — 20 min: revisit F for 5 min, then tempo work.\nBare minimum: 5 min.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: play the song at full tempo, twice through.\nBare minimum: one pass.",
        ],
        "journals": {
            0: ("focused", 7, "70bpm is comfortable now.", "What felt impossible in week three is comfortable now. Nice to notice that."),
            1: ("motivated", 8, "80bpm clean.", "Got to 80bpm with clean changes. Progress is obvious when you measure it."),
            2: ("proud", 8, "38 changes in a minute.", "Counted 38 clean G to D changes in sixty seconds. Going to beat that next week."),
            3: ("focused", 7, "90 is the edge.", "90bpm is where it gets messy. That's the growth edge I suppose."),
            5: ("content", 7, "Quiet Saturday session.", "Was meant to rest but picked it up anyway for fifteen minutes. That's a first."),
            6: ("proud", 9, "Full tempo, twice, clean.", "Played it twice at full speed and both passes held together. Seven weeks ago I couldn't hold a chord."),
        },
    },
    {
        "theme": "Song number two",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — choose a second song, ideally with one chord you do not know yet.\nBare minimum: choose it.",
            "Evening — 25 min learning the new chord in it.\nBare minimum: find the shape.",
            "Evening — 25 min on the verse.\nBare minimum: 10 min.",
            "Evening — 25 min on the chorus.\nBare minimum: 10 min.",
            "Evening — 25 min: whole song, slow.\nBare minimum: one pass.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: both songs back to back.\nBare minimum: one pass of each.",
        ],
        "journals": {
            0: ("excited", 8, "Second song picked, harder one.", "Picked something with a chord I don't know. Deliberately harder. Week five me would not have done that."),
            2: ("focused", 7, "Verse down in one session.", "Learning songs is much faster now. The verse took one sitting instead of three."),
            3: ("content", 7, "Chorus is fiddly but fine.", "Chorus has a quick change that keeps tripping me. Slowed it down and it came good."),
            4: ("proud", 8, "Whole second song, slowly.", "Played the new one all the way through at half speed. Two songs now."),
            6: ("proud", 9, "Two songs back to back.", "Played both songs one after the other. It's starting to feel like a tiny set list rather than exercises."),
        },
    },
    {
        "theme": "Play and sing at the same time",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — 20 min: play song one while humming the melody. Not singing yet.\nBare minimum: one pass humming.",
            "Evening — 20 min: sing only the first line while playing.\nBare minimum: the first line, 5 times.",
            "Evening — 20 min: sing the whole verse while playing. It will fall apart. That is expected.\nBare minimum: 5 min of trying.",
            "Evening — 20 min: simplify the strum to one strum per bar and sing over it.\nBare minimum: one pass.",
            "Evening — 20 min: verse sung, full strum.\nBare minimum: one pass.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: whole song, played and sung.\nBare minimum: one pass, however rough.",
        ],
        "journals": {
            0: ("focused", 7, "Humming and playing is harder than it sounds.", "Even humming while playing makes my hands forget what they're doing. Brains are strange."),
            1: ("frustrated", 5, "One line and I lose the strum.", "Sing one line, hands stop. Every time. Very humbling after last week's confidence."),
            3: ("hopeful", 7, "Simplifying the strum unlocked it.", "Dropped to one strum per bar and suddenly I could sing over it. Going to build back up from there."),
            4: ("motivated", 8, "Verse sung with the real strum.", "Got the verse sung with the full strumming pattern. That felt like a genuine breakthrough."),
            6: ("proud", 9, "Sang and played a whole song.", "Did the whole song, singing and playing. Nobody heard it and it does not matter. Nine weeks ago this was a guitar on a wall."),
        },
    },
    {
        "theme": "Record it and hear yourself honestly",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — 20 min: record one pass on your phone. Do not listen yet.\nBare minimum: record something.",
            "Evening — listen back, write down the two roughest spots. 20 min practising only those.\nBare minimum: listen and note one spot.",
            "Evening — 25 min on rough spot one.\nBare minimum: 10 min.",
            "Evening — 25 min on rough spot two.\nBare minimum: 10 min.",
            "Evening — 25 min: record again, compare to Monday.\nBare minimum: record one pass.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: clean take of your best song. Keep the recording.\nBare minimum: one recorded pass.",
        ],
        "journals": {
            0: ("nervous", 6, "Recording myself is oddly scary.", "Recorded a take. Weirdly nerve-wracking even though nobody will hear it. Did not listen back yet."),
            1: ("surprised", 7, "Better than it felt, worse than I hoped.", "Listened back. Two obvious rough patches but overall far better than I expected. The timing is decent now."),
            2: ("focused", 8, "Fixed the first rough patch.", "Drilled the chorus transition. Twenty five minutes on one change and it's clean now."),
            4: ("proud", 9, "The difference is audible.", "Recorded again and compared to Monday. The difference across one week is genuinely audible. That's motivating in a way nothing else is."),
            5: ("content", 7, "Bonus Saturday session.", "Rest day but I wanted to play. That's the whole thing isn't it."),
            6: ("proud", 10, "Got a take I'd let someone hear.", "Recorded a clean take of my best song. Ten weeks. I'd actually let someone listen to this one."),
        },
    },
    # ── Week 11: the live week. Only the days up to today are logged. ──
    {
        "theme": "Play it for one real person",
        "win": "Complete 4 of 6 practice days",
        "days": [
            "Evening — 20 min: full run of both songs, warm up the set.\nBare minimum: one pass each.",
            "Evening — 20 min: play standing up. It is a different instrument standing.\nBare minimum: 10 min standing.",
            "Evening — 20 min: play through mistakes without stopping. Performance is recovery, not perfection.\nBare minimum: one unbroken pass.",
            "Evening — 20 min: run the set twice, no restarts.\nBare minimum: one pass.",
            "Evening — play one song for one person. Actually do it.\nBare minimum: play it for someone on a video call.",
            "Rest day.\nBare minimum: rest is the task today.",
            "Evening — 25 min: play for yourself, for fun. No goals.\nBare minimum: pick it up.",
        ],
        "journals": {
            0: ("motivated", 8, "Set feels solid.", "Ran both songs. They hold up. Feeling good going into this week."),
            1: ("surprised", 7, "Standing up is a different instrument.", "Played standing and everything moved. The angle is completely different. Good thing the plan caught that."),
            2: ("focused", 8, "Played through the mistakes.", "Made three mistakes and kept going instead of restarting. That's new for me and it's the actual skill."),
        },
    },
]

CHAT = [
    ("user", "I've had a guitar on my wall for two years and never learned it. I keep starting and quitting after a week."),
    ("assistant", "Two years of walking past it is its own kind of information — the guitar was never the problem, the first week was. So week one asks for almost nothing: tune it, hold it, two chord shapes. Here's Week 1, built to be too small to quit."),
    ("user", "F chord is destroying me. I can't get a single clean note and I'm thinking of packing it in."),
    ("assistant", "Barre chords take most people weeks, not days — you're not behind, you're exactly where the wall is. So Week 6 takes F off the menu almost entirely: you rebuild the enjoyment first, and meet Fmaj7, which sounds right in your song and rings clean. We come back to the full barre when your hands aren't associating the guitar with failure."),
]


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def build(today: date):
    """Assemble every row from WEEKS. Returns a dict of lists, nothing persisted."""
    live_monday = monday_of(today)               # week 11 starts this Monday
    first_monday = live_monday - timedelta(weeks=len(WEEKS) - 1)

    user_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())

    plans, journals, checkins, reports = [], [], [], []
    done_dates = set()
    prev_stats = None

    for idx, wk in enumerate(WEEKS):
        week_no = idx + 1
        ws = first_monday + timedelta(weeks=idx)
        we = ws + timedelta(days=6)
        is_live = week_no == len(WEEKS)

        plan = {
            "week_number": week_no,
            "start_date": ws.isoformat(),
            "week_label": f"{ws.strftime('%b %d (%a)')} – {we.strftime('%b %d (%a)')}",
            "theme": wk["theme"],
            "win_condition": wk["win"],
            "generated_date": (ws - timedelta(days=1)).isoformat(),
            "days": [
                {"day": (ws + timedelta(days=i)).strftime("%b %d (%a)"), "action": action}
                for i, action in enumerate(wk["days"])
            ],
        }
        plans.append(plan)

        # Per-day rows
        day_rows, scores, emotions = [], [], []
        for i in range(7):
            d = ws + timedelta(days=i)
            entry = wk["journals"].get(i)
            in_past = d <= today
            if entry and in_past:
                emotion, score, one_liner, transcript = entry
                journals.append({
                    "date": d.isoformat(), "transcript": transcript,
                    "emotion_label": emotion, "emotion_score": score, "one_liner": one_liner,
                })
                checkins.append({"date": d.isoformat(), "status": "done"})
                done_dates.add(d)
                scores.append(score)
                emotions.append(emotion)
                checkin = "done"
            elif in_past:
                is_rest = wk["days"][i].lower().startswith("rest day")
                checkin = "skipped" if is_rest else "missed"
                if not is_rest:
                    checkins.append({"date": d.isoformat(), "status": "skipped"})
            else:
                checkin = "pending"

            day_rows.append({
                "date": d.isoformat(),
                "day_label": d.strftime("%a"),
                "planned_task": wk["days"][i].split("\n")[0],
                "emotion": entry[0] if (entry and in_past) else None,
                "score": entry[1] if (entry and in_past) else None,
                "one_liner": entry[2] if (entry and in_past) else None,
                "checkin": checkin,
                "has_journal": bool(entry and in_past),
                "coaching_insight": "",
            })

        if is_live:
            continue  # the live week has no archived report yet

        past = [d for d in day_rows if d["date"] <= today.isoformat()]
        days_done = sum(1 for d in past if d["has_journal"])
        past_count = len(past)
        days_missed = past_count - days_done
        avg = round(sum(scores) / len(scores), 1) if scores else 0
        consistency = round(days_done / max(past_count, 1) * 100)
        mood_norm = min(100, max(0, round(avg / 10 * 100)))
        momentum = round(consistency * 0.4 + mood_norm * 0.3 + consistency * 0.3)
        label = ("Peak" if momentum >= 85 else "Strong Week" if momentum >= 70
                 else "Building" if momentum >= 50 else "Struggling" if momentum >= 30
                 else "Reset Needed")
        dominant = max(set(emotions), key=emotions.count) if emotions else ""
        best = max(
            (d for d in day_rows if d["has_journal"]),
            key=lambda d: d["score"] or 0, default=None,
        )

        report = {
            "avg_score": avg,
            "consistency_score": consistency,
            "days_done": days_done,
            "days_missed": days_missed,
            "past_days_count": past_count,
            "entry_count": days_done,
            "week_number": week_no,
            "week_theme": wk["theme"],
            "momentum_score": momentum,
            "momentum_label": label,
            "peak_performance_days": sorted(
                {d["day_label"] for d in day_rows if (d["score"] or 0) >= 8}
            ),
            "prev_week_stats": prev_stats,
            "dominant_emotion": dominant,
            "week_summary": wk.get("summary") or {
                "wins": f"{days_done} of {past_count} days logged, averaging {avg}/10 on mood.",
                "dips": (f"{days_missed} day(s) went unlogged."
                         if days_missed else "Nothing slipped this week."),
                "pattern": f"Mood tracked with the difficulty of the week's focus — {wk['theme'].lower()}.",
            },
            "week_badge": wk.get("badge") or {
                "name": label,
                "reason": f"{consistency}% consistency at a {avg}/10 average mood.",
            },
            "best_quote": best["one_liner"] if best else "",
            "actionable_coaching": wk.get("coaching") or [],
            "hidden_insight": wk.get("insight", ""),
            "next_week_focus": wk.get("focus", ""),
            "next_week_plan_context": "",
            "days": day_rows,
        }
        reports.append({
            "week_number": week_no, "week_start": ws.isoformat(),
            "week_end": we.isoformat(), "report_json": json.dumps(report),
        })
        prev_stats = {
            "consistency_score": consistency, "avg_score": avg,
            "momentum_score": momentum, "days_done": days_done,
        }

    # Streak: walk back from the most recent logged day.
    current = 0
    cursor = max(done_dates)
    if (today - cursor).days <= 1:
        while cursor in done_dates:
            current += 1
            cursor -= timedelta(days=1)
    longest = 0
    run = 0
    for d in sorted(done_dates):
        run = run + 1 if (d - timedelta(days=1)) in done_dates else 1
        longest = max(longest, run)

    return {
        "user_id": user_id,
        "session_id": session_id,
        "plans": plans,
        "journals": journals,
        "checkins": checkins,
        "reports": reports,
        "first_monday": first_monday,
        "live_monday": live_monday,
        "streak": {
            "current": current, "longest": longest,
            "total": len(done_dates), "last": max(done_dates).isoformat(),
        },
    }


def wipe(db, user: User):
    """Remove every row belonging to this account, so seeding is repeatable."""
    sess_ids = [s.id for s in db.query(Session).filter(Session.user_id == user.id).all()]
    for model in (WeeklyReport, VoiceJournal, DailyCheckin, UserConsent):
        db.query(model).filter(model.user_id == user.id).delete(synchronize_session=False)
    db.query(UserStreak).filter(UserStreak.user_id == user.id).delete(synchronize_session=False)
    if sess_ids:
        db.query(ChatMessage).filter(
            ChatMessage.session_id.in_(sess_ids)
        ).delete(synchronize_session=False)
    db.query(Session).filter(Session.user_id == user.id).delete(synchronize_session=False)
    db.delete(user)
    db.flush()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write the account (default: dry run)")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for testing")
    args = ap.parse_args()

    today = date.fromisoformat(args.today) if args.today else date.today()
    data = build(today)
    live = data["plans"][-1]

    print(f"Demo account: {EMAIL}  (password: {PASSWORD})")
    print(f"Goal        : {GOAL}")
    print(f"Journey     : weeks 1–{len(WEEKS) - 1} complete + week {len(WEEKS)} live")
    print(f"Dates       : {data['first_monday']} → {data['live_monday'] + timedelta(days=6)}")
    print(f"Rows        : {len(data['reports'])} reports, {len(data['journals'])} journals, "
          f"{len(data['checkins'])} check-ins, {len(data['plans'])} plans")
    print(f"Streak      : {data['streak']['current']} current, "
          f"{data['streak']['longest']} longest, {data['streak']['total']} total days")
    print(f"Live week   : {live['theme']}")
    if not args.apply:
        print("\nDry run — nothing written. Re-run with --apply.")
        return

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == EMAIL).first()
        if existing:
            print(f"\nExisting {EMAIL} found — wiping it first.")
            wipe(db, existing)

        now = datetime.utcnow()
        db.add(User(
            id=data["user_id"], email=EMAIL, password=get_password_hash(PASSWORD),
            name=NAME, created_at=now - timedelta(weeks=len(WEEKS)),
            shield_stock=2, shield_run_milestone=data["streak"]["current"] // 7,
        ))
        for key in REQUIRED_CONSENTS:
            db.add(UserConsent(
                user_id=data["user_id"], consent_type=key, granted=1,
                policy_version=CONSENT_POLICY_VERSION,
                created_at=now - timedelta(weeks=len(WEEKS)),
            ))
        # Journals, check-ins and reports carry a raw session_id FK but no ORM
        # relationship to Session, so SQLAlchemy cannot infer that sessions must
        # be inserted first. Postgres enforces the constraint even though SQLite
        # does not, so the parents are flushed explicitly before their children.
        db.flush()

        db.add(Session(
            id=data["session_id"], user_id=data["user_id"],
            title="Learn guitar", focus=GOAL,
            phase="active", current_week=len(WEEKS),
            plan_start_date=data["first_monday"].isoformat(),
            week_plan_json=json.dumps(data["plans"][-1]),
            result_json=json.dumps(data["plans"]),
            created_at=now - timedelta(weeks=len(WEEKS)),
        ))
        db.flush()

        for role, content in CHAT:
            db.add(ChatMessage(session_id=data["session_id"], role=role, content=content))
        for j in data["journals"]:
            db.add(VoiceJournal(user_id=data["user_id"], session_id=data["session_id"], **j))
        for c in data["checkins"]:
            db.add(DailyCheckin(
                user_id=data["user_id"], session_id=data["session_id"],
                date=c["date"], status=c["status"],
            ))
        for r in data["reports"]:
            db.add(WeeklyReport(
                user_id=data["user_id"], session_id=data["session_id"], **r
            ))
        db.add(UserStreak(
            user_id=data["user_id"],
            current_streak=data["streak"]["current"],
            longest_streak=data["streak"]["longest"],
            total_done=data["streak"]["total"],
            last_checkin=data["streak"]["last"],
        ))
        db.commit()
        print(f"\nSeeded. Log in as {EMAIL} / {PASSWORD}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
