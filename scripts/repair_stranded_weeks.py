"""
Repair weeks that were locked into a window that had already passed.

Until the lock-date fix, approving Week N+1 anchored it to the day after Week N
ended rather than the day the user actually locked it. A user who built Week 2
and locked it a month later got a week whose entire window sat in the past:
every day rendered "missed" the moment it was locked, and voice journals
recorded today fell outside the window so they never showed up.

This finds those sessions and re-stamps the affected week onto today, matching
what approve_plan now does — the plan's start_date, and every day label.

DRY RUN BY DEFAULT. Review the printed list, then re-run with --apply.

    python -m scripts.repair_stranded_weeks                    # list candidates
    python -m scripts.repair_stranded_weeks --apply            # repair all
    python -m scripts.repair_stranded_weeks --session-id <id> --apply
"""

import argparse
import json
import sys
from datetime import date, timedelta

sys.path.insert(0, ".")

from app.database import SessionLocal          # noqa: E402
from app.models import Session, VoiceJournal   # noqa: E402
from app.weeks import (                        # noqa: E402
    _effective_lock_start,
    _bounds_from_start,
    _week_bounds_for,
)


def _plan_for_week(session_rec, week_number):
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


def find_candidates(db, today_iso, session_id=None):
    """Sessions whose locked current week ended before today with nothing logged in it.

    Both conditions matter. A week that ended in the past is only *stranded* if
    the user never got to use it — if there are journals inside the window the
    week ran normally and must not be touched, or we would rewrite real history.
    """
    q = db.query(Session).filter(Session.phase == "active")
    if session_id:
        q = q.filter(Session.id == session_id)

    out = []
    for s in q.all():
        week = s.current_week or 0
        if week < 1:
            continue
        try:
            ws, we, dc = _week_bounds_for(s, week)
        except Exception as e:
            print(f"  ! {s.id}: could not resolve week bounds ({e}) — skipping")
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

        out.append({"session": s, "week": week, "old_start": ws, "old_end": we,
                    "old_days": dc, "plan": plan})
    return out


def repair(db, cand, today_iso, apply):
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

    print(f"  {s.id}  week {week}: {cand['old_start']}→{cand['old_end']} "
          f"({cand['old_days']}d)  ⇒  {ws}→{we} ({dc}d)"
          + (f"  [{trimmed} plan day(s) trimmed]" if trimmed else ""))

    if not apply:
        return

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


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--session-id", help="repair only this session")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for testing")
    args = ap.parse_args()

    today_iso = args.today or date.today().isoformat()
    db = SessionLocal()
    try:
        cands = find_candidates(db, today_iso, args.session_id)
        if not cands:
            print("No stranded weeks found.")
            return

        print(f"{len(cands)} stranded week(s) as of {today_iso}"
              f"{'' if args.apply else '  (dry run — nothing written)'}:\n")
        for c in cands:
            repair(db, c, today_iso, args.apply)

        if args.apply:
            db.commit()
            print(f"\nRepaired {len(cands)} session(s).")
        else:
            print("\nRe-run with --apply to write these changes.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
