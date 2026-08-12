"""
Streak calculation + automatic streak insurance ("streak shield").

Lives in its own module because both the API endpoints (main.py) and the email
scheduler (email_service.py) need it, and neither may import the other.

Shield semantics (Duolingo-style, applied SILENTLY — EARNED model):
- Every user STARTS with 1 shield banked (endowed progress: they own something
  from day one). Each 7-day run of the current streak earns another, capped at
  SHIELD_STOCK_CAP in the bank. This keeps the safety net from deflating the
  streak's tension: shields are scarce, owned, and themselves a reward loop.
- A shield is applied automatically when yesterday broke an otherwise-alive
  chain — the user does NOT have to open the app or press anything. The person
  about to lose their streak is, by definition, the person who didn't show up
  yesterday; any protection that needs a tap fails exactly when it's needed.
- A shielded day keeps the chain UNBROKEN but does not count as a done day:
  the streak number doesn't grow, it just survives.
"""

from datetime import date, timedelta
from typing import Optional

from loguru import logger

from .models import DailyCheckin, UserStreak, User

SHIELD_STOCK_CAP = 2
STREAK_DAYS_PER_SHIELD = 7

# Statuses that keep a chain alive. "done" also feeds the streak count;
# "shielded" only preserves the link.
CHAIN_STATUSES = ("done", "shielded")


def _resolve_today(client_date: Optional[str]) -> date:
    if client_date:
        try:
            return date.fromisoformat(client_date)
        except ValueError:
            pass
    return date.today()


def recalculate_streak(db, user_id: str, client_date: Optional[str] = None) -> UserStreak:
    """
    Recalculate current and longest streak from daily_checkins.
    Called after every checkin mutation. O(n) but checkins are small.
    Pass client_date (YYYY-MM-DD) from the user's local timezone to avoid
    UTC vs IST mismatch when checking today/yesterday boundaries.

    Shielded days are links, not wins: they hold consecutive done-days
    together across a miss, but only done days are counted.
    """
    rows = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.status.in_(CHAIN_STATUSES))
        .all()
    )
    done_dates = sorted({r.date for r in rows if r.status == "done"}, reverse=True)
    chain_dates = sorted({r.date for r in rows}, reverse=True)

    today_d = _resolve_today(client_date)
    today = today_d.isoformat()
    yesterday = (today_d - timedelta(days=1)).isoformat()

    # Current streak: walk the chain back from its most recent link, which must
    # be today or yesterday for the streak to still be alive. Count done days.
    current = 0
    if chain_dates and chain_dates[0] in (today, yesterday):
        done_set = set(done_dates)
        expected = chain_dates[0]
        for d in chain_dates:
            if d == expected:
                if d in done_set:
                    current += 1
                expected = (date.fromisoformat(expected) - timedelta(days=1)).isoformat()
            else:
                break

    # Longest streak: split the chain into consecutive runs, count the done
    # days inside each run, keep the best.
    longest = 0
    run_done = 0
    prev_date_str = None
    done_set_all = set(done_dates)
    for d in sorted(chain_dates):
        if prev_date_str is not None:
            delta = (date.fromisoformat(d) - date.fromisoformat(prev_date_str)).days
            if delta != 1:
                run_done = 0
        if d in done_set_all:
            run_done += 1
        longest = max(longest, run_done)
        prev_date_str = d

    streak_rec = db.query(UserStreak).filter(UserStreak.user_id == user_id).first()
    if not streak_rec:
        streak_rec = UserStreak(user_id=user_id)
        db.add(streak_rec)
    streak_rec.current_streak = current
    # longest_streak should always be the historical maximum — never decrease
    streak_rec.longest_streak = max(longest, streak_rec.longest_streak or 0)
    streak_rec.total_done = len(done_dates)
    streak_rec.last_checkin = done_dates[0] if done_dates else None

    # ── Earn shields: +1 at each 7-day milestone of the CURRENT run ─────────
    # Idempotent: the milestone last rewarded is tracked per run, so recalcs
    # never double-award. A broken streak resets the marker, so rebuilding to
    # 7 days earns again — the shield is itself something to run for.
    user = db.query(User).filter(User.id == user_id).first()
    if user is not None:
        milestone = current // STREAK_DAYS_PER_SHIELD
        prev_ms = user.shield_run_milestone or 0
        if milestone > prev_ms:
            stock = user.shield_stock or 0
            if stock < SHIELD_STOCK_CAP:
                user.shield_stock = min(SHIELD_STOCK_CAP, stock + (milestone - prev_ms))
                logger.info(
                    f"[Shield] user {user_id} earned a shield at streak {current} "
                    f"(bank: {user.shield_stock}/{SHIELD_STOCK_CAP})"
                )
            user.shield_run_milestone = milestone
        elif milestone < prev_ms:
            user.shield_run_milestone = milestone  # run broke/shrank — new climb

    db.commit()
    db.refresh(streak_rec)
    return streak_rec


def shields_left(user: User) -> int:
    """Protected days currently banked (earned model — no monthly reset)."""
    return max(0, user.shield_stock if user.shield_stock is not None else 1)


def apply_streak_shield(db, user: User, today_iso: str) -> Optional[dict]:
    """
    If yesterday broke an otherwise-alive chain and the user has shields left,
    mark yesterday "shielded" — automatically, no user action.

    Returns {"date": ..., "streak": ..., "shields_left": ...} when a shield was
    applied this call, else None. Never raises: streak protection must not be
    able to take the caller (an email tick or a checkin request) down with it.
    """
    try:
        today_d = _resolve_today(today_iso)
        yesterday = (today_d - timedelta(days=1)).isoformat()
        day_before = (today_d - timedelta(days=2)).isoformat()

        y_row = (
            db.query(DailyCheckin)
            .filter(DailyCheckin.user_id == user.id, DailyCheckin.date == yesterday)
            .first()
        )
        if y_row and y_row.status in CHAIN_STATUSES:
            return None  # yesterday is fine — nothing to protect

        # A chain existed up to the day before yesterday?
        anchor = (
            db.query(DailyCheckin)
            .filter(
                DailyCheckin.user_id == user.id,
                DailyCheckin.date == day_before,
                DailyCheckin.status.in_(CHAIN_STATUSES),
            )
            .first()
        )
        if not anchor:
            return None  # no live streak to save (new user, or already broken)

        # NULL means the migration default hasn't been materialised for this row
        # yet — treat as the endowed starting shield, not as zero.
        stock = user.shield_stock if user.shield_stock is not None else 1
        if stock < 1:
            return None  # bank empty — the miss stands (recovery flow takes over)

        if y_row:
            y_row.status = "shielded"
        else:
            db.add(
                DailyCheckin(
                    user_id=user.id,
                    date=yesterday,
                    status="shielded",
                    note="auto streak shield",
                )
            )
        user.shield_stock = stock - 1
        db.commit()

        streak_rec = recalculate_streak(db, user.id, client_date=today_iso)
        left = shields_left(user)
        logger.info(
            f"[Shield] auto-applied for user {user.id} on {yesterday} "
            f"(streak preserved at {streak_rec.current_streak}, {left} left this month)"
        )
        return {
            "date": yesterday,
            "streak": streak_rec.current_streak,
            "shields_left": left,
        }
    except Exception as e:
        logger.error(f"[Shield] apply failed for user {user.id}: {e}")
        try:
            db.rollback()
        except Exception:
            pass
        return None


def yesterday_missed(db, user_id: str, today_iso: str) -> bool:
    """
    True when yesterday has no chain-keeping checkin but the user HAS shown up
    before — i.e. a real miss by a real participant, not a brand-new account.
    Call AFTER apply_streak_shield: a shielded yesterday is not a miss.
    """
    today_d = _resolve_today(today_iso)
    yesterday = (today_d - timedelta(days=1)).isoformat()

    y_ok = (
        db.query(DailyCheckin)
        .filter(
            DailyCheckin.user_id == user_id,
            DailyCheckin.date == yesterday,
            DailyCheckin.status.in_(CHAIN_STATUSES),
        )
        .first()
    )
    if y_ok:
        return False

    ever_done = (
        db.query(DailyCheckin)
        .filter(DailyCheckin.user_id == user_id, DailyCheckin.status == "done")
        .first()
    )
    return ever_done is not None
