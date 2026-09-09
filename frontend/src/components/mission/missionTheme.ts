/**
 * Shared bits for the mission workspace. Colors all come from the app's CSS
 * variables so light/dark adapt exactly like the rest of the product.
 */
export const clashDisplay = "'Clash Display', 'Inter', sans-serif";
export const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/* Flame ramp — matches StreakBar's palette so the streak keeps its identity */
export const FLAME_FROM = '#ffb24d';
export const FLAME_TO = '#ff5a36';
export const ACCENT_AMBER = '#f59e0b';
export const SHIELD_BLUE = '#60a5fa';

/** Spring used across the mission surface for a consistent, premium feel. */
export const springSnappy = { type: 'spring' as const, stiffness: 320, damping: 28 };
export const easeSilk = [0.16, 1, 0.3, 1] as const;

/** Weekday letter for a YYYY-MM-DD date, in the user's local sense. */
export function dayLetter(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()];
}

export function shortDay(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

/**
 * Find a given date's entry in the active plan, matching the same way the
 * daily-email engine does: the plan's `day` label contains the weekday name.
 */
export function planEntryFor(activePlan: any, iso: string): { day: string; action: string } | null {
    const days = activePlan?.days;
    if (!Array.isArray(days) || days.length === 0) return null;
    const d = new Date(`${iso}T12:00:00`);
    const longName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const shortName = d.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
    for (const entry of days) {
        const label = String(entry?.day || '').toLowerCase();
        if (label.includes(longName) || label.includes(shortName)) {
            return { day: String(entry.day), action: String(entry.action || '') };
        }
    }
    return null;
}

export function todaysPlanEntry(activePlan: any, todayIso: string): { day: string; action: string } | null {
    return planEntryFor(activePlan, todayIso);
}

/** Rest days never count as misses — same pattern the backend uses. */
export function isRestAction(action: string): boolean {
    return /^\s*(?:optional\s+)?(?:rest|recovery)\b/i.test(action || '');
}

export function isoDaysAgo(fromIso: string, days: number): string {
    const d = new Date(`${fromIso}T12:00:00`);
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True when every date in the plan's window is behind today (week wrapped). */
export function planWeekOver(activePlan: any, todayIso: string): boolean {
    const days = activePlan?.days;
    if (!Array.isArray(days) || days.length === 0) return false;
    return todaysPlanEntry(activePlan, todayIso) === null && !!activePlan?.start_date &&
        todayIso > String(activePlan.start_date);
}
