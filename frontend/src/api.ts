const getApiUrl = () => {
    const override = typeof window !== 'undefined' ? localStorage.getItem('VITE_API_URL_OVERRIDE') : null;
    return override || import.meta.env.VITE_API_URL || 'http://localhost:8000';
};

export const API_BASE_URL = getApiUrl();

/** Returns the user's IANA timezone (e.g. "Asia/Kolkata") */
export const getClientTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
        return 'UTC';
    }
};

/** Returns the local date string in YYYY-MM-DD format, safely handling timezone offsets. */
export const getLocalISODate = (): string => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
};

const getToken = () => localStorage.getItem('access_token');

/** Clears auth state and redirects to login. */
const forceLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('user_name');
    localStorage.removeItem('active_session_id');
    if (typeof window !== 'undefined') {
        window.location.href = '/login';
    }
};

const secureFetch = async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
        'Authorization': token ? `Bearer ${token}` : '',
    };

    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (response.status === 401) {
        // Token is invalid/expired — force a clean logout.
        forceLogout();
        // Throw so callers know the request failed, not return a broken response.
        throw new Error('Session expired. Please log in again.');
    }

    if (response.status === 403) {
        // The backend refuses anything touching wellbeing content until the
        // user has accepted the current policy version. Broadcast it so the
        // consent gate can open from wherever the app happens to be, instead of
        // every caller needing to know about consent.
        const clone = response.clone();
        try {
            const body = await clone.json();
            const detail = body?.detail;
            if (detail?.error === 'consent_required') {
                window.dispatchEvent(new CustomEvent('feelivate:consent-required', { detail }));
                throw new Error('Please accept the updated terms to continue.');
            }
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('Please accept')) throw e;
            // Not a consent 403 — fall through and let the caller handle it.
        }
    }

    return response;
};

// ============================================================
// CORE CHAT API
// ============================================================

/** Crisis-support resources the backend attaches when a message indicates risk. */
export interface SafetyNotice {
    type: 'crisis_support';
    headline: string;
    body: string;
    resources: { region: string; name: string; contact: string; note: string }[];
}

/**
 * Attached when the request was refused before the mentor model ever ran.
 * `category` is for our own logging — the copy shown to the user is the same
 * whatever it says, so it never hints at where the boundary sits.
 */
export interface BlockedNotice {
    type: 'request_blocked';
    headline: string;
    body: string;
    category: string;
}

export interface ChatResponse {
    reply: string;
    plan: any | null;
    session_id: string;
    /** Present only when the message triggered the crisis screen. */
    safety?: SafetyNotice;
    /** Present only when the request was refused outright. */
    blocked?: BlockedNotice;
}

export const chatWithMentor = async (
    message: string,
    sessionId: string | null,
    userId: string
): Promise<ChatResponse> => {
    const response = await secureFetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        body: JSON.stringify({
            message,
            session_id: sessionId,
            user_id: userId,
            timezone: getClientTimezone(),
        }),
    });

    if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
    }

    return response.json();
};

export const approvePlan = async (sessionId: string): Promise<any> => {
    // Send the user's local date so the week starts exactly when they locked it
    const clientDate = getLocalISODate();
    const response = await secureFetch(`${API_BASE_URL}/chat/${sessionId}/approve_plan?client_date=${clientDate}`, {
        method: 'POST',
    });

    if (!response.ok) {
        throw new Error(`Plan approval failed: ${response.statusText}`);
    }

    return response.json();
};

// ============================================================
// AUTH
// ============================================================

export const login = async (data: { email: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Login failed');
    }
    const result = await response.json();
    if (result.access_token) {
        // Clear stale session data from previous user before setting new credentials
        localStorage.removeItem('active_session_id');
        localStorage.setItem('access_token', result.access_token);
    }
    return result;
};

export interface UserProfile {
    id: string;
    name: string | null;
    email: string;
    created_at: string;
    /** Non-empty when the consent gate must be shown before using the app. */
    consent_required?: string[];
}

/** Fetch the authenticated user's profile (name, email, join date). */
export const getMe = async (): Promise<UserProfile> => {
    const response = await secureFetch(`${API_BASE_URL}/me`, { method: 'GET' });
    if (!response.ok) {
        throw new Error(`Failed to load profile: ${response.statusText}`);
    }
    return response.json();
};

export const signup = async (data: {
    email: string;
    password: string;
    name?: string;
    /** Required. The account is not created unless every required consent is true. */
    consents: Record<string, boolean>;
}) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Consent failures come back as a structured detail object; showing
        // "[object Object]" to the user would be worse than useless.
        const detail = errorData.detail;
        if (detail && typeof detail === 'object') {
            throw new Error(detail.message || 'Signup failed');
        }
        throw new Error(detail || errorData.error || 'Signup failed');
    }
    const result = await response.json();
    if (result.access_token) {
        // Clear stale session data from previous user before setting new credentials
        localStorage.removeItem('active_session_id');
        localStorage.setItem('access_token', result.access_token);
    }
    return result;
};

// ─── GOOGLE LOGIN ("Continue with Google") ──────────────────
/** Ask the backend for the Google Sign-In consent URL. */
export const getGoogleLoginUrl = async (): Promise<{ auth_url: string }> => {
    const response = await fetch(`${API_BASE_URL}/auth/google/login`);
    if (!response.ok) throw new Error('Failed to start Google sign-in');
    return response.json();
};

/** Exchange the code Google returned for a Feelivate JWT (find-or-create user). */
export const googleLoginCallback = async (code: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/google/login/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Google sign-in failed');
    }
    const result = await response.json();
    if (result.access_token) {
        localStorage.removeItem('active_session_id');
        localStorage.setItem('access_token', result.access_token);
    }
    return result; // { access_token, user_id, name, is_new_user }
};

// ============================================================
// ACCOUNT & DATA RIGHTS  (GDPR Art 7, 15, 17, 20)
// ============================================================

export interface ConsentItem {
    key: string;
    label: string;
    required: boolean;
    /** True for the Art 9 consent — must be its own unticked checkbox. */
    explicit: boolean;
}

export interface ConsentState {
    policy_version: string;
    catalogue: ConsentItem[];
    state: Record<string, { granted: boolean; policy_version: string; recorded_at: string | null }>;
    missing: string[];
}

/**
 * Public consent catalogue — used by the signup form, which runs before an
 * account exists. Fetched rather than hardcoded so the wording and the keys can
 * never drift from what the backend actually requires.
 */
export const getConsentCatalogue = async (): Promise<{ policy_version: string; catalogue: ConsentItem[] }> => {
    const response = await fetch(`${API_BASE_URL}/legal/consents`);
    if (!response.ok) throw new Error('Could not load the consent terms.');
    return response.json();
};

/** Fetch the consent catalogue and the user's current decisions. */
export const getConsents = async (): Promise<ConsentState> => {
    const response = await secureFetch(`${API_BASE_URL}/account/consents`, { method: 'GET' });
    if (!response.ok) throw new Error('Could not load consent settings.');
    return response.json();
};

/** Record consent decisions. Every required item must be true or this rejects. */
export const submitConsents = async (consents: Record<string, boolean>) => {
    const response = await fetch(`${API_BASE_URL}/account/consents`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken() ?? ''}`,
        },
        body: JSON.stringify({ consents }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = err.detail;
        throw new Error(
            (detail && typeof detail === 'object' ? detail.message : detail) || 'Could not save your choices.'
        );
    }
    return response.json();
};

/** Withdraw a single consent (Art 7(3)). */
export const withdrawConsent = async (consentType: string) => {
    const response = await secureFetch(`${API_BASE_URL}/account/consents/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ consent_type: consentType }),
    });
    if (!response.ok) throw new Error('Could not withdraw consent.');
    return response.json();
};

/**
 * Download everything we hold about the user as a JSON file (Art 15 / Art 20).
 * Triggers a browser download rather than returning the data, since the point
 * is a file the user keeps or hands to another service.
 */
export const downloadMyData = async (): Promise<void> => {
    const response = await secureFetch(`${API_BASE_URL}/account/export`, { method: 'GET' });
    if (!response.ok) throw new Error('Could not prepare your data export. Please try again.');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `feelivate-export-${getLocalISODate()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Release the blob — without this the whole export stays in memory for the
    // life of the tab.
    URL.revokeObjectURL(url);
};

export interface DeleteAccountResult {
    status: string;
    message: string;
    deleted: Record<string, number>;
    /** Non-empty if an external store could not be cleared — surface it, don't hide it. */
    incomplete: string[];
}

/**
 * Permanently delete the account. Irreversible.
 *
 * `confirmation` is the word the user actually typed — passed through rather
 * than hardcoded, so the backend check confirms a real human intent instead of
 * a constant the client always sends.
 * `password` is required for password accounts and omitted for Google-only ones.
 */
export const deleteMyAccount = async (confirmation: string, password?: string): Promise<DeleteAccountResult> => {
    const response = await secureFetch(`${API_BASE_URL}/account`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation, password: password || null }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = err.detail;
        throw new Error(
            (detail && typeof detail === 'object' ? detail.message : detail) || 'Account deletion failed.'
        );
    }
    return response.json();
};

// ============================================================
// SESSIONS
// ============================================================

export interface SessionPreview {
    id: string;
    created_at: string;
    title?: string | null;
    focus_preview: string;
    current_week: number;
    phase: string;
}

export const getUserSessions = async (userId: string): Promise<SessionPreview[]> => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
};

export interface SessionDetail {
    id: string;
    created_at: string;
    focus: string;
    current_week: number;
    phase: string;
    plan: any | null;
    plan_history: any[];
    messages: { role: string; content: string; created_at: string }[];
}

export const getSessionDetail = async (sessionId: string): Promise<SessionDetail> => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/detail/${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch session details');
    return response.json();
};

export const getSessionHistory = async (sessionId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/history`);
    if (!response.ok) throw new Error('Failed to fetch session history');
    return response.json();
};

// ============================================================
// GOOGLE CALENDAR
// ============================================================

export const getGoogleAuthUrl = async () => {
    const response = await secureFetch(`${API_BASE_URL}/auth/google`);
    if (!response.ok) throw new Error('Failed to get auth URL');
    return response.json();
};

export const confirmGoogleAuth = async (code: string, userId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/auth/google/callback?code=${code}&user_id=${userId}`);
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to confirm Google Auth');
    }
    return response.json();
};

export const syncGoogleCalendar = async (sessionId: string, userId: string, preferredTime: string = "08:00") => {
    const response = await secureFetch(`${API_BASE_URL}/calendar/sync/${sessionId}?user_id=${userId}&preferred_time=${preferredTime}`, {
        method: 'POST',
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to sync calendar');
    }
    return response.json();
};

export const stopGoogleCalendarSync = async (userId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/calendar/stop?user_id=${userId}`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to stop calendar sync');
    return response.json();
};

// ============================================================
// EMAIL NOTIFICATIONS
// ============================================================

export const sendEmailOTP = async (userId: string, email: string) => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/email/send-otp`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, email }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to send OTP. Please try again.');
    }
    return response.json();
};

export const verifyEmailOTP = async (userId: string, email: string, code: string, sessionId?: string | null, preferredTime?: string, preferredTimezone?: string) => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/email/verify-otp`, {
        method: 'POST',
        body: JSON.stringify({
            user_id: userId,
            email,
            code,
            session_id: sessionId,
            preferred_time: preferredTime || '08:00',
            preferred_timezone: preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'OTP verification failed. Please try again.');
    }
    return response.json();
};

export const updateNotificationTime = async (userId: string, preferredTime: string, preferredTimezone?: string) => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/email/update-time`, {
        method: 'PUT',
        body: JSON.stringify({
            user_id: userId,
            preferred_time: preferredTime,
            preferred_timezone: preferredTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update notification time.');
    }
    return response.json();
};

export const stopEmailNotifications = async (userId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/email/stop`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to stop email notifications');
    return response.json();
};

export const getEmailNotificationStatus = async (userId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/notifications/email/status?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch notification status');
    return response.json() as Promise<{ enabled: boolean; notification_email: string | null; preferred_time?: string; preferred_timezone?: string }>;
};


// ============================================================
// VOICE TRANSCRIPTION
// ============================================================

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    // Use .webm extension — widely supported for audio capture
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `recording.${ext}`);

    const response = await secureFetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — let the browser set multipart/form-data boundary
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Transcription failed');
    }

    const data = await response.json();
    return data.text || '';
};

// ============================================================
// STREAK & DAILY CHECK-IN
// ============================================================

export interface StreakData {
    current_streak: number;
    longest_streak: number;
    total_done: number;
    last_checkin: string | null;
    days_this_week: { date: string; status: 'pending' | 'done' | 'skipped' }[];
}

export const getStreak = async (userId: string): Promise<StreakData> => {
    const clientDate = getLocalISODate();
    const response = await secureFetch(`${API_BASE_URL}/streak/${userId}?client_date=${clientDate}`);
    if (!response.ok) throw new Error('Failed to fetch streak');
    return response.json();
};

export const submitCheckin = async (
    status: 'done' | 'skipped',
    sessionId?: string,
    note?: string,
): Promise<{ date: string; status: string; current_streak: number; longest_streak: number; total_done: number }> => {
    const clientDate = getLocalISODate();
    const response = await secureFetch(`${API_BASE_URL}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ status, session_id: sessionId, note, client_date: clientDate }),
    });
    if (!response.ok) throw new Error('Check-in failed');
    return response.json();
};

// ============================================================
// WEEKLY REVIEW
// ============================================================

export const submitWeeklyReview = async (
    sessionId: string,
    weekNumber: number,
    feedback: string,
): Promise<{ status: string; week_number: number }> => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/weekly_review`, {
        method: 'POST',
        body: JSON.stringify({ week_number: weekNumber, feedback }),
    });
    if (!response.ok) throw new Error('Failed to submit weekly review');
    return response.json();
};

// ============================================================
// VOICE JOURNAL
// ============================================================

export interface JournalEntry {
    id: number;
    date: string;
    transcript: string;
    emotion_label: string;
    emotion_score: number;
    one_liner: string;
    created_at: string;
}

export const uploadVoiceJournal = async (audioBlob: Blob): Promise<JournalEntry> => {
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `journal.${ext}`);

    const response = await secureFetch(`${API_BASE_URL}/journal/voice`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Journal upload failed');
    }
    return response.json();
};

export const getJournals = async (userId: string, limit = 30): Promise<JournalEntry[]> => {
    const response = await secureFetch(`${API_BASE_URL}/journal/${userId}?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch journals');
    return response.json();
};

// ============================================================
// TODAY'S EMOTION (for the chat-side orb)
// ============================================================

export interface TodayEmotionResult {
    has_entry: boolean;
    entry: {
        id: number;
        date: string;
        emotion_label: string;
        emotion_score: number;
        one_liner: string;
    } | null;
}

export const getTodayEmotion = async (userId: string, sessionId?: string): Promise<TodayEmotionResult> => {
    const clientDate = getLocalISODate();
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    params.set('client_date', clientDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await secureFetch(`${API_BASE_URL}/journal/${userId}/today-emotion${qs}`);
    if (!response.ok) throw new Error('Failed to fetch today emotion');
    return response.json();
};


// ============================================================
// WEEKLY EMOTION REPORT
// ============================================================

export interface WeeklyReportDay {
    date: string;
    day_label: string;
    planned_task: string;
    emotion: string | null;
    score: number | null;
    one_liner: string | null;
    checkin: 'done' | 'skipped' | 'missed' | 'pending';
    has_journal: boolean;
    coaching_insight: string;
    coaching_micro_action?: string;
}

export interface WeekBadge {
    name: string;
    reason: string;
}

export interface WeekSummary {
    wins: string;
    dips: string;
    pattern: string;
}

export interface ActionableCoaching {
    observation: string;
    micro_action: string;
}

export interface TriggerPattern {
    pattern: string;
    frequency: string;
    weeks_detected: number[];
}

export interface WeeklyReport {
    status: 'generated' | 'cached' | 'no_data' | 'waiting_for_sunday_entry' | 'in_progress';
    week_start: string;
    week_end: string;
    message?: string;
    report?: {
        // Core metrics
        avg_score: number;
        consistency_score: number;
        days_done: number;
        days_missed: number;
        past_days_count: number;
        entry_count: number;
        week_number: number;
        week_theme: string;
        // V2 metrics
        momentum_score?: number;
        momentum_label?: string;
        peak_performance_days?: string[];
        prev_week_stats?: {
            consistency_score: number;
            avg_score: number;
            momentum_score: number;
            days_done: number;
        } | null;
        // AI analysis — V2 (new)
        dominant_emotion: string;
        week_summary?: WeekSummary;
        week_badge?: WeekBadge;
        best_quote?: string;
        actionable_coaching?: ActionableCoaching[];
        trigger_patterns?: TriggerPattern[];
        hidden_insight: string;
        next_week_focus: string;
        next_week_plan_context: string;
        // Legacy fields (backward compat with old cached reports)
        emotional_arc?: string;
        what_went_well?: string;
        where_you_slipped?: string;
        consistency_analysis?: string;
        daily_analysis?: string[];
        // Per-day data
        days: WeeklyReportDay[];
    };
}

export const getWeeklyReport = async (userId: string, sessionId?: string, weekNumber?: number): Promise<WeeklyReport> => {
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    if (weekNumber !== undefined) params.set('week_number', String(weekNumber));
    params.set('client_date', getLocalISODate());
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await secureFetch(`${API_BASE_URL}/journal/${userId}/weekly-report${qs}`);
    if (!response.ok) throw new Error('Failed to fetch weekly report');
    const data: WeeklyReport = await response.json();

    // V2 auto-upgrade: if cached report is old format (missing momentum_score), force regenerate
    if (data.status === 'cached' && data.report && !('momentum_score' in data.report)) {
        const forceParams = new URLSearchParams(params);
        forceParams.set('force_refresh', 'true');
        const forceQs = `?${forceParams.toString()}`;
        const forceResponse = await secureFetch(`${API_BASE_URL}/journal/${userId}/weekly-report${forceQs}`);
        if (forceResponse.ok) {
            return forceResponse.json();
        }
    }

    return data;
};

// ============================================================
// WEEK INFO — session-scoped week bounds
// ============================================================

export interface WeekInfo {
    has_plan: boolean;
    current_week: number;
    plan_start_date?: string;
    week_start?: string;
    week_end?: string;
    day_count?: number;
    is_week_complete?: boolean;
    is_completed?: boolean;
    has_report?: boolean;
    has_next_plan?: boolean;
}

export const getWeekInfo = async (sessionId: string): Promise<WeekInfo> => {
    // Pass client local date so backend uses IST (or user's TZ) instead of UTC server date.
    // This prevents Sunday-evening IST appearing as Monday UTC and breaking is_week_complete.
    const clientDate = getLocalISODate();
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/week-info?client_date=${clientDate}`);
    if (!response.ok) throw new Error('Failed to fetch week info');
    return response.json();
};

// ============================================================
// SESSION COMPLETION
// ============================================================

export interface SessionReport {
    headline: string;
    biggest_wins: string[];
    growth_arc: string;
    advice_for_next_chapter: string;
    stats: {
        total_weeks: number;
        days_done: number;
        days_total: number;
        avg_mood: number;
    };
}

export const completeSession = async (sessionId: string): Promise<{ status: string; report: SessionReport }> => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/complete`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to complete session');
    return response.json();
};

// ============================================================
// ARCHIVE — All session weekly reports
// ============================================================

export interface ArchivedWeekReport {
    week_number: number;
    week_start: string;
    week_end: string;
    report: WeeklyReport['report'];
}

export const getSessionReports = async (sessionId: string): Promise<ArchivedWeekReport[]> => {
    const clientDate = getLocalISODate();
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/reports?client_date=${clientDate}`);
    if (!response.ok) throw new Error('Failed to fetch session reports');
    return response.json();
};

// ============================================================
// VOICE JOURNAL (session-scoped)
// ============================================================

export const uploadVoiceJournalForSession = async (audioBlob: Blob, sessionId?: string): Promise<JournalEntry & { recorded_today?: boolean }> => {
    const formData = new FormData();
    const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `journal.${ext}`);

    // Pass local date to avoid UTC vs IST timezone mismatch
    const clientDate = getLocalISODate();
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    params.set('client_date', clientDate);
    const qs = `?${params.toString()}`;

    const response = await secureFetch(`${API_BASE_URL}/journal/voice${qs}`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Journal upload failed');
    }
    return response.json();
};

export const getJournalsForSession = async (userId: string, sessionId?: string, limit = 30): Promise<JournalEntry[]> => {
    const qs = sessionId ? `?session_id=${sessionId}&limit=${limit}` : `?limit=${limit}`;
    const response = await secureFetch(`${API_BASE_URL}/journal/${userId}${qs}`);
    if (!response.ok) throw new Error('Failed to fetch journals');
    return response.json();
};

/**
 * Backfill: syncs existing voice journals into DailyCheckin table
 * and recalculates streak. Idempotent — safe to call on every mount.
 */
export const backfillStreak = async (): Promise<{
    checkins_created: number;
    current_streak: number;
    longest_streak: number;
    total_done: number;
}> => {
    const clientDate = getLocalISODate();
    const response = await secureFetch(`${API_BASE_URL}/streak/backfill?client_date=${clientDate}`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Streak backfill failed');
    return response.json();
};
