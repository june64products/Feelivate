/**
 * First-time onboarding walkthrough — persistence helpers.
 *
 * The whole walkthrough is tracked in localStorage, keyed per user, so it runs
 * exactly once (right after a user creates their account) and never again. We
 * store the current step too, so the tour can resume across reloads — and even
 * across days for the final "emotion orb" step, which only appears after the
 * user's first daily entry.
 *
 * No backend involved: a brand-new user gets `startOnboarding()` called at
 * signup; existing users have no saved state, so they never see the tour.
 */

export type OnboardingStatus = 'active' | 'done';

export interface OnboardingState {
    status: OnboardingStatus;
    step: number;
}

const key = (userId: string) => `feelivate_onboarding_${userId}`;

/** Read the saved onboarding state, or null if this user has none. */
export function getOnboardingState(userId: string | null | undefined): OnboardingState | null {
    if (!userId) return null;
    try {
        const raw = localStorage.getItem(key(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.status === 'active' || parsed.status === 'done') && typeof parsed.step === 'number') {
            return parsed as OnboardingState;
        }
        return null;
    } catch {
        return null;
    }
}

function write(userId: string, state: OnboardingState) {
    try {
        localStorage.setItem(key(userId), JSON.stringify(state));
    } catch {
        /* storage full / unavailable — non-fatal, tour just won't persist */
    }
}

/** Begin (or restart, for "Replay tutorial") the walkthrough from step 0. */
export function startOnboarding(userId: string | null | undefined) {
    if (!userId) return;
    write(userId, { status: 'active', step: 0 });
}

/** Persist the current step so the tour resumes here on the next visit. */
export function setOnboardingStep(userId: string | null | undefined, step: number) {
    if (!userId) return;
    write(userId, { status: 'active', step });
}

/** Mark the walkthrough finished (or skipped) — it will never show again. */
export function completeOnboarding(userId: string | null | undefined) {
    if (!userId) return;
    write(userId, { status: 'done', step: -1 });
}

/** True when this user should currently be shown the walkthrough. */
export function isOnboardingActive(userId: string | null | undefined): boolean {
    return getOnboardingState(userId)?.status === 'active';
}
