"""
Repair weeks that were locked into a window that had already passed.

Thin CLI over app/repair.py — the same code backs POST /admin/repair-stranded-weeks,
so a deployment without shell access can run it over HTTP instead.

DRY RUN BY DEFAULT. Review the printed list, then re-run with --apply.

    python -m scripts.repair_stranded_weeks                    # list candidates
    python -m scripts.repair_stranded_weeks --apply            # repair all
    python -m scripts.repair_stranded_weeks --session-id <id> --apply
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
        result = repair.run(db, today_iso, apply=args.apply, session_id=args.session_id)
        if not result["count"]:
            print("No stranded weeks found.")
            return

        print(f"{result['count']} stranded week(s) as of {today_iso}"
              f"{'' if args.apply else '  (dry run — nothing written)'}:\n")
        for r in result["sessions"]:
            trimmed = r["plan_days_trimmed"]
            print(f"  {r['session_id']}  week {r['week']}: "
                  f"{r['from']['start']}→{r['from']['end']} ({r['from']['days']}d)"
                  f"  ⇒  {r['to']['start']}→{r['to']['end']} ({r['to']['days']}d)"
                  + (f"  [{trimmed} plan day(s) trimmed]" if trimmed else ""))

        print(f"\nRepaired {result['count']} session(s)." if args.apply
              else "\nRe-run with --apply to write these changes.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
