"""
Week-window maths for a session's plan.

A locked week runs from the day the user locked it through that same calendar
week's Sunday. Kept in its own module so maintenance scripts can import it
without pulling in the whole FastAPI app, and so the rules live in exactly one
place — `frontend/src/lib/weekWindow.ts` mirrors them for the client.
"""

import json

from loguru import logger


def _get_week_bounds(plan_start_date_str: str, week_number: int):
    """
    Given the plan_start_date (ISO string) and a week_number (0, 1, 2, ...),
    return (week_start: str, week_end: str, day_count: int).

    Rules:
      - Day of week: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
      - If plan started Mon/Tue/Wed (weekday <= 2):
          Week 1 = plan_start_date → that Sunday
          Week 2+ = standard Mon–Sun
      - If plan started Thu/Fri/Sat/Sun (weekday >= 3):
          Week 0 = plan_start_date → that Sunday (partial)
          Week 1 = next Monday → next Sunday (full)
          Week 2+ = standard Mon–Sun after that
    """
    from datetime import date, timedelta
    plan_start = date.fromisoformat(plan_start_date_str)
    dow = plan_start.weekday()  # 0=Mon, 6=Sun

    if dow <= 2:  # Mon/Tue/Wed — direct Week 1 start
        has_week0 = False
        w1_start = plan_start
        # End of week 1 = that Sunday
        days_to_sunday = 6 - dow
        w1_end = plan_start + timedelta(days=days_to_sunday)
    else:  # Thu/Fri/Sat/Sun — Week 0 exists
        has_week0 = True
        w0_start = plan_start
        days_to_sunday = 6 - dow
        w0_end = plan_start + timedelta(days=days_to_sunday)
        # Week 1 starts next Monday
        w1_start = w0_end + timedelta(days=1)
        w1_end = w1_start + timedelta(days=6)

    if week_number == 0:
        if not has_week0:
            # No week 0 exists for Mon/Tue/Wed starters; return week 1 instead
            ws, we = w1_start, w1_end
        else:
            ws, we = w0_start, w0_end
    elif week_number == 1:
        ws, we = w1_start, w1_end
    else:
        # Week 2, 3, ... = Mon–Sun blocks starting from w1_end + 1
        offset_weeks = week_number - 1  # weeks after week 1
        next_monday = w1_end + timedelta(days=1)
        ws = next_monday + timedelta(weeks=offset_weeks - 1)
        we = ws + timedelta(days=6)

    day_count = (we - ws).days + 1
    return ws.isoformat(), we.isoformat(), day_count


def _bounds_from_start(start_date_str: str):
    """Week bounds anchored to an explicit lock date (the day the plan was approved).
    The week runs from that day through the SAME calendar week's Sunday — so a plan
    locked on Wednesday yields Wed→Sun and Mon/Tue are excluded entirely."""
    from datetime import date, timedelta
    start = date.fromisoformat(start_date_str)
    dow = start.weekday()  # 0=Mon .. 6=Sun
    end = start + timedelta(days=(6 - dow))
    return start.isoformat(), end.isoformat(), (end - start).days + 1


def _effective_lock_start(lock_date_str: str) -> str:
    """The date a week actually begins when it is locked on `lock_date_str`.

    A week runs from its start through that same calendar week's Sunday, so
    locking late in the week would leave a stub: lock on Saturday and the week
    is 2 days, lock on Sunday and it is 1. Anything shorter than
    MIN_WEEK_DAYS rolls forward to the next Monday instead and runs a full
    Mon–Sun — the Journey page already handles a week that starts in the
    future ("Starts <date>", mic locked until then).
    """
    from datetime import date, timedelta
    MIN_WEEK_DAYS = 3
    lock = date.fromisoformat(lock_date_str)
    days_left = 7 - lock.weekday()  # Mon → 7 … Sun → 1 (inclusive of the lock day)
    if days_left < MIN_WEEK_DAYS:
        return (lock + timedelta(days=days_left)).isoformat()  # next Monday
    return lock.isoformat()


def _projected_week_start(session_rec, week_number: int, today_iso: str) -> str:
    """Where a week would start if it were locked (or generated) on `today_iso`.

    The week begins the day the user commits to it — NOT the day after the
    previous week ended. Users routinely leave a generated plan unlocked for
    days or weeks; anchoring to the previous week's end would silently place
    the new week entirely in the past, marking every day missed before the
    user had any chance to log it.

    The previous week's end is still a floor, so a week locked early can never
    overlap the one still running.

    The very first plan of a session is exempt from the roll-forward: a session
    started on Thu–Sun deliberately gets a short partial "Week 0" (see the Week 0
    instruction in prompts.py), and pushing it to next Monday would leave a new
    user with nothing to do for days.
    """
    from datetime import date, timedelta
    is_first_plan = not session_rec.plan_start_date
    start = today_iso if is_first_plan else _effective_lock_start(today_iso)
    if not is_first_plan and week_number and week_number > 1:
        try:
            _, prev_end, _ = _week_bounds_for(session_rec, week_number - 1)
            floor = (date.fromisoformat(prev_end) + timedelta(days=1)).isoformat()
            if floor > start:
                start = floor
        except Exception as e:
            logger.warning(f"Previous-week floor lookup failed for week {week_number}: {e}")
    return start


def _stamped_week_start(session_rec, week_number: int):
    """Return the lock date stamped into the approved plan for this week, if present."""
    # Active plan (current week_plan_json)
    if session_rec.week_plan_json:
        try:
            plan = json.loads(session_rec.week_plan_json)
            if plan.get("week_number") == week_number and plan.get("start_date"):
                return plan["start_date"]
        except Exception:
            pass
    # Approved-plan history (result_json holds a list of approved plan dicts)
    if session_rec.result_json:
        try:
            hist = json.loads(session_rec.result_json)
            if isinstance(hist, list):
                for p in hist:
                    if isinstance(p, dict) and p.get("week_number") == week_number and p.get("start_date"):
                        return p["start_date"]
        except Exception:
            pass
    return None


def _week_bounds_for(session_rec, week_number: int):
    """Week bounds for a session+week, preferring the stamped lock date so each week
    starts exactly when its plan was locked (not a forced Mon–Sun block). Falls back to
    the legacy plan_start_date computation for weeks locked before this was introduced."""
    sd = _stamped_week_start(session_rec, week_number)
    if sd:
        return _bounds_from_start(sd)
    return _get_week_bounds(session_rec.plan_start_date, week_number)


REST_DAY_ACTION = (
    "Rest day — recover and reset, nothing scheduled.\n"
    "Bare minimum: rest is the task today."
)


def _fit_plan_to_window(plan, start_iso: str):
    """Make a plan's `days` cover its week window exactly: start_iso → that Sunday.

    A week always ends on Sunday, so once the start date is known the window's
    length is fixed. The model is unreliable in BOTH directions, but only one
    direction used to be handled: running past Sunday was trimmed, stopping
    early was left alone. That gap shows up hardest on a quiet-week restart,
    where the model is told to rebuild the same week and so reuses the previous
    week's day count — a 4-day week (Thu–Sun) restarted on a Monday came back as
    Mon–Thu, leaving Fri/Sat/Sun with no task at all while the Journey calendar,
    built from the window, still showed all seven days.

    Missing days become explicit rest days — the same convention the prompt uses
    for a day the user doesn't train — and every label is re-stamped with its
    real consecutive calendar date.

    Lives here so the chat/approve paths and the backfill (app/repair.py) all
    fit plans the same way.
    """
    if not isinstance(plan, dict) or not isinstance(plan.get("days"), list):
        return plan
    from datetime import date as _d, timedelta as _td

    ws, _we, day_count = _bounds_from_start(start_iso)
    start = _d.fromisoformat(ws)
    days = list(plan["days"])
    original = len(days)
    if original == 0:
        # A plan with no days at all is broken upstream, not short — padding it
        # would fabricate a week of pure rest. The caller discards these.
        return plan

    if original > day_count:
        logger.info(
            f"Trimming plan from {original} to {day_count} days "
            f"(week {ws} must end on Sunday)"
        )
        days = days[:day_count]
    elif original < day_count:
        logger.info(
            f"Padding plan from {original} to {day_count} days with rest days "
            f"(short week for {ws})"
        )
        days += [{"action": REST_DAY_ACTION} for _ in range(day_count - original)]

    bad_labels = []
    for i, day in enumerate(days):
        if not isinstance(day, dict):
            continue
        correct = (start + _td(days=i)).strftime("%b %d (%a)")
        current = str(day.get("day", "")).strip()
        if current and current.lower() != correct.lower():
            bad_labels.append(f"{current!r}→{correct!r}")
        day["day"] = correct
    if bad_labels:
        logger.info(
            f"Corrected {len(bad_labels)} mislabeled plan day(s) "
            f"(start = {start.strftime('%a')}): {', '.join(bad_labels)}"
        )

    plan["days"] = days
    # A label derived from the old span would now contradict the plan itself.
    if original != day_count and days:
        first = str(days[0].get("day", "")) if isinstance(days[0], dict) else ""
        last = str(days[-1].get("day", "")) if isinstance(days[-1], dict) else ""
        if first and last:
            plan["week_label"] = first if first == last else f"{first} – {last}"
    return plan


def build_quiet_week_report(week_number: int, ws: str, we: str, done_days: int) -> dict:
    """The deterministic report for a week that ENDED with zero voice journals.

    Silence needs no LLM — it needs honesty and a warm restart. Shared by the
    weekly-report endpoint and the backfill script so both write the identical
    shape. `quiet_week` / zero counts also flip the mentor prompt from
    "advance, never repeat" to "restart at the same level".
    """
    from datetime import date as _d
    total_days = (_d.fromisoformat(we) - _d.fromisoformat(ws)).days + 1
    return {
        "quiet_week": done_days == 0,
        "momentum_score": 0,
        "avg_score": 0,
        "consistency_score": round(done_days * 100 / total_days) if total_days else 0,
        "days_done": 0,  # journal-count keyed (cache validation compares to journals)
        "days_missed": total_days - done_days,
        "past_days_count": total_days,
        "entry_count": 0,
        "week_number": week_number,
        "week_theme": "",
        "dominant_emotion": "",
        "headline": "This week went quiet." if done_days == 0 else "A quiet week — a few check-ins, no journals.",
        "what_went_well": (
            f"{done_days} day(s) still got checked off — that counted." if done_days else ""
        ),
        "where_you_slipped": (
            "No check-ins and no journals landed this week — zero input, the whole week."
            if done_days == 0 else
            "No voice journals landed this week, so there's no read on how the days actually felt."
        ),
        "hidden_insight": (
            "A silent week is data, not a verdict. The plan didn't fail — it just never got a first rep. "
            "The next move is small: restart the same week and show up once."
        ),
        "next_week_focus": "Restart at the same level — do not advance difficulty. Win the first day back.",
        "next_week_plan_context": (
            "The previous week had ZERO user input (no journals"
            + ("" if done_days else ", no completed check-ins")
            + "). Rebuild the SAME week at the SAME level — do not advance or repeat-penalise. "
            "Acknowledge the quiet week in one warm line and ask one short question about what got in the way."
        ),
        "days": [],
    }
