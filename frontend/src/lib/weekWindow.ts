/**
 * Where a week lands if it is locked today.
 *
 * Mirrors `_effective_lock_start` + `_bounds_from_start` in app/main.py — keep
 * the two in step. A week begins the day the user locks it and runs through
 * that same calendar week's Sunday, so locking on Thursday gives Thu–Sun and
 * Mon–Wed never appear in the journal. Locking on Saturday or Sunday would
 * leave a 1–2 day stub, so those roll forward to the next Monday and run a
 * full Mon–Sun instead.
 */

const MIN_WEEK_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date as YYYY-MM-DD (never UTC — the user's day is what counts). */
export function localISODate(d: Date = new Date()): string {
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function parseISO(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/** Mon=0 … Sun=6, matching Python's date.weekday(). */
function weekdayMon0(d: Date): number {
    return (d.getDay() + 6) % 7;
}

export interface WeekWindow {
    start: string;
    end: string;
    dayCount: number;
    /** True when the lock rolled forward — the week has not begun yet. */
    startsLater: boolean;
}

/**
 * @param isFirstPlan The session's very first plan starts today however short —
 *   a Thu–Sun start is the deliberate partial "Week 0", and rolling it to next
 *   Monday would leave a brand new user with nothing to do for days.
 */
export function projectedWeekWindow(lockDateISO: string = localISODate(), isFirstPlan = false): WeekWindow {
    const lock = parseISO(lockDateISO);
    const daysLeft = 7 - weekdayMon0(lock); // Mon → 7 … Sun → 1, inclusive of the lock day

    const start = (!isFirstPlan && daysLeft < MIN_WEEK_DAYS)
        ? new Date(lock.getTime() + daysLeft * DAY_MS) // next Monday
        : lock;

    const end = new Date(start.getTime() + (6 - weekdayMon0(start)) * DAY_MS);
    const dayCount = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;

    return {
        start: localISODate(start),
        end: localISODate(end),
        dayCount,
        startsLater: !isFirstPlan && daysLeft < MIN_WEEK_DAYS,
    };
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(aISO: string, bISO: string): number {
    return Math.round((parseISO(bISO).getTime() - parseISO(aISO).getTime()) / DAY_MS);
}

/** "Thu, 6 Aug" — short, unambiguous, no locale surprises about month/day order. */
export function formatDay(iso: string): string {
    return parseISO(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
