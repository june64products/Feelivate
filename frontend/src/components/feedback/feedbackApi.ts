import { API_BASE_URL } from '../../api';

/** The moment that opened the form. Stored with every submission. */
export type FeedbackTrigger =
    | 'exit_intent'   // desktop: the pointer headed for the tab bar / close button
    | 'tab_return'    // mobile: came back after leaving the tab for a while
    | 'first_plan'    // right after the first weekly plan was approved
    | 'first_chats'   // after the first few exchanges with the mentor
    | 'timer'         // a few minutes into the first session
    | 'logout'        // the user pressed log out
    | 'side_tab';     // opened deliberately from the side tab

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

export interface FeedbackPayload {
    rating: number;
    liked: FeedbackChip[];
    confusing: FeedbackChip[];
    comment?: string;
    contact_ok?: boolean;
    email?: string;
    trigger: FeedbackTrigger;
    page?: string;
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
    rating: number;
    trigger: FeedbackTrigger;
    page: string | null;
    liked: string[];
    confusing: string[];
    comment: string | null;
    contact_ok: boolean;
    email: string | null;
    account_age_days: number | null;
    device: string | null;
}

export interface FeedbackAdminStats {
    total: number;
    average_rating: number | null;
    ratings: Record<string, number>;
    liked: Record<string, number>;
    confusing: Record<string, number>;
    triggers: Record<string, number>;
    last_7_days: number;
    unique_users: number;
    anonymous: number;
    want_contact: number;
}

export interface FeedbackAdminResponse {
    total: number;
    stats: FeedbackAdminStats;
    items: FeedbackAdminItem[];
}

const inboxError = (status: number): Error => {
    if (status === 403) return new Error('Wrong passphrase.');
    if (status === 503) return new Error('The inbox is not configured on the server yet (FEEDBACK_ADMIN_TOKEN).');
    return new Error(`Request failed (${status}).`);
};

export async function fetchFeedbackInbox(
    token: string,
    params: { trigger?: string; min_rating?: number; limit?: number; offset?: number } = {},
): Promise<FeedbackAdminResponse> {
    const qs = new URLSearchParams();
    if (params.trigger) qs.set('trigger', params.trigger);
    if (params.min_rating) qs.set('min_rating', String(params.min_rating));
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
