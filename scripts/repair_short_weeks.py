"""
Pad locked weeks whose plan stops before its window's Sunday.

Plans are fitted to their window on generate and on approve, but weeks locked
before that fix kept whatever day count the model produced — a 4-day plan locked
on a Monday runs Mon–Thu while its window runs Mon–Sun, leaving Fri/Sat/Sun with
no task at all. This appends explicit rest days to fill the window.

Only weeks that are still running (or have not started) are touched; finished
weeks are history and their reports already count days from the window.

Thin CLI over app/repair.py — the same code backs POST /admin/repair-short-weeks,
so a deployment without shell access can run it over HTTP instead.

DRY RUN BY DEFAULT. Review the printed list, then re-run with --apply.

    python -m scripts.repair_short_weeks                    # list candidates
    python -m scripts.repair_short_weeks --apply            # pad all
    python -m scripts.repair_short_weeks --session-id <id> --apply
"""

import argparse
import sys
from datetime import date

sys.path.insert(0, ".")

from app.database import SessionLocal  # noqa: E402
from app import repair                 # noqa: E402


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--session-id", help="repair only this session")
    ap.add_argument("--today", help="override today's date (YYYY-MM-DD), for testing")
    args = ap.parse_args()

    today_iso = args.today or date.today().isoformat()
    db = SessionLocal()
    try:
        result = repair.run_short_weeks(
            db, today_iso, apply=args.apply, session_id=args.session_id
        )
        if not result["count"]:
            print("No short weeks found.")
            return

        print(f"{result['count']} short week(s) as of {today_iso}"
              f"{'' if args.apply else '  (dry run — nothing written)'}:\n")
        for r in result["sessions"]:
            w = r["window"]
            print(f"  {r['session_id']}  week {r['week']}: "
                  f"{w['start']}→{w['end']} ({w['days']}d window) "
                  f"has {r['plan_days']} plan day(s)"
                  f"  ⇒  +{r['rest_days_added']} rest day(s)")

        print(f"\nPadded {result['count']} week(s)." if args.apply
              else "\nRe-run with --apply to write these changes.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
