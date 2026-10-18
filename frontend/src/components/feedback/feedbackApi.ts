import { API_BASE_URL } from '../../api';

/** The moment that opened the form. Stored with every submission. */
export type FeedbackTrigger =
    | 'exit_intent'    // desktop: the pointer headed for the tab bar / close button
    | 'tab_return'     // mobile: came back after leaving the tab for a while
    | 'first_plan'     // right after the first weekly plan was built (plan_fit)
    | 'first_chats'    // after the first few exchanges with the mentor
    | 'timer'          // a few minutes into the first session
    | 'logout'         // the user pressed log out
    | 'side_tab'       // opened deliberately from the side tab
    | 'after_journal'  // right after the evening voice note was saved (task_day)
    | 'second_tweak'   // the draft was tweaked a second time (tweaks)
    | 'weekly_report'  // the first weekly report was opened (full form)
    | 'task_email'     // 👍/👎 from the morning email
    | 'review_read';   // "did this read true?" under a week review

/**
 * Which questions a form asks. Each moment gets its own few questions
 * instead of one long form for everything.
 */
export type FeedbackKind = 'full' | 'plan_fit' | 'task_day' | 'tweaks' | 'task_email' | 'review';

export const FEEDBACK_CHIPS = [
    { key: 'signup', label: 'Sign-up' },
    { key: 'tutorial', label: 'Tutorial' },
    { key: 'plan', label: 'Weekly plan' },
    { key: 'mentor_chat', label: 'Mentor chat' },
    { key: 'alerts', label: 'Alerts & emails' },
    { key: 'design', label: 'Look & feel' },
    { key: 'speed', label: 'Speed' },
    { key: 'other', label: 'Something else' },
] as const;

export type FeedbackChip = (typeof FEEDBACK_CHIPS)[number]['key'];

/** Answer values per form, as the server stores them. */
export const UPSET_OPTIONS = [
    { key: 'very', label: 'Very upset', hint: "I'd miss it" },
    { key: 'a_bit', label: 'A bit', hint: 'nice to have' },
    { key: 'not_really', label: 'Not really', hint: "wouldn't notice" },
] as const;

export const PLAN_FIT_OPTIONS = [
    { key: 'too_hard', label: 'Too hard' },
    { key: 'about_right', label: 'About right' },
    { key: 'too_easy', label: 'Too easy' },
] as const;

export const TASK_QUALITY_OPTIONS = [
    { key: 'great', label: 'Spot on', hint: 'exactly what I needed' },
    { key: 'fine', label: 'Fine', hint: 'did it, nothing special' },
    { key: 'off', label: 'A bit off', hint: 'not quite right for me' },
    { key: 'didnt_fit', label: "Didn't fit my day", hint: 'wrong time or place' },
] as const;

export const TASK_CLARITY_OPTIONS = [
    { key: 'clear', label: 'Clear' },
    { key: 'somewhat', label: 'Somewhat' },
    { key: 'unclear', label: 'Unclear' },
] as const;

export const TASK_TIME_OPTIONS = [
    { key: 'shorter', label: 'Took less' },
    { key: 'right', label: 'As planned' },
    { key: 'longer', label: 'Took longer' },
] as const;

export const TWEAK_REASON_OPTIONS = [
    { key: 'too_hard', label: 'Too hard for where I am' },
    { key: 'too_easy', label: 'Too easy, not worth it' },
    { key: 'wrong_time', label: 'Wrong time of day / week' },
    { key: 'not_my_goal', label: "Doesn't match my goal" },
    { key: 'misunderstood', label: 'The mentor misunderstood me' },
    { key: 'other', label: 'Something else' },
] as const;

export interface FeedbackPayload {
    kind: FeedbackKind;
    answers: Record<string, unknown>;
    comment?: string;
    contact_ok?: boolean;
    email?: string;
    trigger: FeedbackTrigger;
    page?: string;
    session_id?: string | null;
}

const authHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function submitFeedback(
    payload: FeedbackPayload,
): Promise<{ status: string; id: number; sequence_no: number | null }> {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        let detail = 'Could not send your feedback right now.';
        try {
            const body = await response.json();
            if (typeof body?.detail === 'string') detail = body.detail;
        } catch {
            /* non-JSON error body */
        }
        throw new Error(detail);
    }
    return response.json();
}

/** How many times this account has already given feedback; null when signed out or unreachable. */
export async function getMyFeedbackStatus(): Promise<{ count: number; last_at: string | null } | null> {
    if (!localStorage.getItem('access_token')) return null;
    try {
        const response = await fetch(`${API_BASE_URL}/feedback/me`, { headers: authHeaders() });
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

// ── Inbox (secret admin page) ────────────────────────────────────────────

export interface FeedbackAdminItem {
    id: number;
    created_at: string | null;
    user_id: string | null;
    user_email: string | null;
    user_name: string | null;
    sequence_no: number | null;
    kind: FeedbackKind;
    answers: Record<string, unknown>;
    rating: number | null;
    trigger: FeedbackTrigger;
    page: string | null;
    liked: string[];
    confusing: string[];
    comment: string | null;
    contact_ok: boolean;
    email: string | null;
    account_age_days: number | null;
    device: string | null;
    session_id: string | null;
    goal: string | null;
    week_number: number | null;
    plan_day: string | null;
    current_streak: number | null;
    days_active: number | null;
}

export interface FeedbackAdminStats {
    total: number;
    kinds: Record<string, number>;
    upset: Record<string, number>;
    liked_most: Record<string, number>;
    confusing: Record<string, number>;
    plan_fit: Record<string, number>;
    task_quality: Record<string, number>;
    task_clear: Record<string, number>;
    tweak_reasons: Record<string, number>;
    review_accuracy: Record<string, number>;
    broke_reports: number;
    quit_notes: number;
    triggers: Record<string, number>;
    last_7_days: number;
    unique_users: number;
    anonymous: number;
    want_contact: number;
    legacy_average_rating: number | null;
    legacy_count: number;
}

export interface ProductMetrics {
    cohort_days: number;
    signups: number;
    built_plan?: number; built_plan_pct?: number | null;
    locked_plan?: number; locked_plan_pct?: number | null;
    day3_eligible?: number; back_on_day3?: number; day3_pct?: number | null;
    week2_eligible?: number; active_week2?: number; week2_pct?: number | null;
    plan_days_elapsed?: number; days_done?: number; completion_pct?: number | null;
    error?: string;
}

export interface FeedbackAdminResponse {
    total: number;
    stats: FeedbackAdminStats;
    metrics: ProductMetrics;
    items: FeedbackAdminItem[];
}

const inboxError = (status: number): Error => {
    if (status === 403) return new Error('Wrong passphrase.');
    if (status === 503) return new Error('The inbox is not configured on the server yet (FEEDBACK_ADMIN_TOKEN).');
    return new Error(`Request failed (${status}).`);
};

export async function fetchFeedbackInbox(
    token: string,
    params: { trigger?: string; kind?: string; limit?: number; offset?: number } = {},
): Promise<FeedbackAdminResponse> {
    const qs = new URLSearchParams();
    if (params.trigger) qs.set('trigger', params.trigger);
    if (params.kind) qs.set('kind', params.kind);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const response = await fetch(`${API_BASE_URL}/admin/feedback?${qs.toString()}`, {
        headers: { 'X-Internal-Token': token },
    });
    if (!response.ok) throw inboxError(response.status);
    return response.json();
}

export async function downloadFeedbackCsv(token: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/admin/feedback.csv`, {
        headers: { 'X-Internal-Token': token },
    });
    if (!response.ok) throw inboxError(response.status);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'feelivate-feedback.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}
