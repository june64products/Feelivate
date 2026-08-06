"""
Repair weeks that were locked into a window that had already passed.

Until the lock-date fix, approving Week N+1 anchored it to the day after Week N
ended rather than the day the user actually locked it. A user who built Week 2
and locked it a month later got a week whose entire window sat in the past:
every day rendered "missed" the moment it was locked, and voice journals
recorded that day fell outside the window, so they never showed up.

The logic lives here rather than in the script so the same code backs both the
CLI (scripts/repair_stranded_weeks.py) and the admin endpoint — a deployment
without shell access still needs a way to run it.

Nothing here writes unless `apply=True`. Callers are expected to look first.
"""

import json
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from loguru import logger

from .models import Session, VoiceJournal
from .weeks import _bounds_from_start, _effective_lock_start, _week_bounds_for


def _plan_for_week(session_rec, week_number: int) -> Optional[dict]:
    """The stored plan dict for a week — the active plan, else its history entry."""
    if session_rec.week_plan_json:
        try:
            plan = json.loads(session_rec.week_plan_json)
            if plan.get("week_number") == week_number:
                return plan
        except Exception:
            pass
    if session_rec.result_json:
        try:
            hist = json.loads(session_rec.result_json)
            if isinstance(hist, list):
                for p in hist:
                    if isinstance(p, dict) and p.get("week_number") == week_number:
                        return p
        except Exception:
            pass
    return None


def find_stranded(db, today_iso: str, session_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Sessions whose locked current week ended before today with nothing logged in it.

    Both conditions matter. A week that ended in the past is only *stranded* if
    the user never got to use it — if there are journals inside the window the
    week ran normally and must not be touched, or we would rewrite real history.
    """
    q = db.query(Session).filter(Session.phase == "active")
    if session_id:
        q = q.filter(Session.id == session_id)

    out: List[Dict[str, Any]] = []
    for s in q.all():
        week = s.current_week or 0
        if week < 1:
            continue
        try:
            ws, we, dc = _week_bounds_for(s, week)
        except Exception as e:
            logger.warning(f"[Repair] {s.id}: could not resolve week bounds ({e}) — skipping")
            continue

        if we >= today_iso:
            continue  # week is current or still ahead — nothing to fix

        logged = (
            db.query(VoiceJournal)
            .filter(
                VoiceJournal.session_id == s.id,
                VoiceJournal.date >= ws,
                VoiceJournal.date <= we,
            )
            .count()
        )
        if logged:
            continue  # the user actually used this week — leave it alone

        plan = _plan_for_week(s, week)
        if not plan or not isinstance(plan.get("days"), list):
            continue

        out.append({
            "session": s,
            "session_id": s.id,
            "week": week,
            "old_start": ws,
            "old_end": we,
            "old_days": dc,
            "plan": plan,
        })
    return out


def repair_week(db, cand: Dict[str, Any], today_iso: str, apply: bool) -> Dict[str, Any]:
    """Move one stranded week onto today. Returns what changed (or would change)."""
    s, week, plan = cand["session"], cand["week"], cand["plan"]

    new_start = _effective_lock_start(today_iso)
    ws, we, dc = _bounds_from_start(new_start)

    days = plan.get("days") or []
    trimmed = len(days) - dc if len(days) > dc else 0
    new_days = days[:dc] if trimmed > 0 else days

    start_d = date.fromisoformat(ws)
    for i, d in enumerate(new_days):
        if isinstance(d, dict):
            d["day"] = (start_d + timedelta(days=i)).strftime("%b %d (%a)")

    summary = {
        "session_id": s.id,
        "week": week,
        "from": {"start": cand["old_start"], "end": cand["old_end"], "days": cand["old_days"]},
        "to": {"start": ws, "end": we, "days": dc},
        "plan_days_trimmed": trimmed,
        "applied": apply,
    }

    if not apply:
        return summary

    plan["start_date"] = ws
    plan["days"] = new_days

    # Write back to whichever slots hold this week.
    if s.week_plan_json:
        try:
            active = json.loads(s.week_plan_json)
            if active.get("week_number") == week:
                s.week_plan_json = json.dumps(plan)
        except Exception:
            pass
    if s.result_json:
        try:
            hist = json.loads(s.result_json)
            if isinstance(hist, list):
                for i, p in enumerate(hist):
                    if isinstance(p, dict) and p.get("week_number") == week:
                        hist[i] = plan
                s.result_json = json.dumps(hist)
        except Exception:
            pass

    # Week 1 also feeds the legacy plan_start_date fallback.
    if week == 1:
        s.plan_start_date = ws

    return summary


def run(db, today_iso: str, apply: bool = False, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Find and (optionally) repair. Commits only when `apply` is true."""
    cands = find_stranded(db, today_iso, session_id)
    results = [repair_week(db, c, today_iso, apply) for c in cands]
    if apply and results:
        db.commit()
        logger.info(f"[Repair] repaired {len(results)} stranded week(s)")
    return {
        "today": today_iso,
        "applied": apply,
        "count": len(results),
        "sessions": results,
    }
