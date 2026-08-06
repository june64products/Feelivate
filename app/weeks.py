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
