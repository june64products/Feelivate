const getApiUrl = () => {
    const override = typeof window !== 'undefined' ? localStorage.getItem('VITE_API_URL_OVERRIDE') : null;
    return override || import.meta.env.VITE_API_URL || 'http://localhost:8000';
};

export const API_BASE_URL = getApiUrl();

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

    return response;
};

// ============================================================
// CORE CHAT API
// ============================================================

export interface ChatResponse {
    reply: string;
    plan: any | null;
    session_id: string;
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
        }),
    });

    if (!response.ok) {
        throw new Error(`Chat failed: ${response.statusText}`);
    }

    return response.json();
};

export const approvePlan = async (sessionId: string): Promise<any> => {
    const response = await secureFetch(`${API_BASE_URL}/chat/${sessionId}/approve_plan`, {
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
        localStorage.setItem('access_token', result.access_token);
    }
    return result;
};

export const signup = async (data: { email: string; password: string; name?: string }) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || errorData.error || 'Signup failed');
    }
    const result = await response.json();
    if (result.access_token) {
        localStorage.setItem('access_token', result.access_token);
    }
    return result;
};

// ============================================================
// SESSIONS
// ============================================================

export interface SessionPreview {
    id: string;
    created_at: string;
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
    if (!response.ok) throw new Error('Failed to confirm Google Auth');
    return response.json();
};

export const syncGoogleCalendar = async (sessionId: string, userId: string, preferredTime: string = "08:00") => {
    const response = await secureFetch(`${API_BASE_URL}/calendar/sync/${sessionId}?user_id=${userId}&preferred_time=${preferredTime}`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to sync calendar');
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
// VOICE TRANSCRIPTION
// ============================================================

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    // Use .webm extension — supported by Whisper
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
    const response = await secureFetch(`${API_BASE_URL}/streak/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch streak');
    return response.json();
};

export const submitCheckin = async (
    status: 'done' | 'skipped',
    sessionId?: string,
    note?: string,
): Promise<{ date: string; status: string; current_streak: number; longest_streak: number; total_done: number }> => {
    const response = await secureFetch(`${API_BASE_URL}/checkin`, {
        method: 'POST',
        body: JSON.stringify({ status, session_id: sessionId, note }),
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

export const getTodayEmotion = async (userId: string): Promise<TodayEmotionResult> => {
    const response = await secureFetch(`${API_BASE_URL}/journal/${userId}/today-emotion`);
    if (!response.ok) throw new Error('Failed to fetch today emotion');
    return response.json();
};


// ============================================================
// WEEKLY EMOTION REPORT
// ============================================================

export interface WeeklyReportDay {
    date: string;
    emotion: string | null;
    score: number | null;
    one_liner: string | null;
    checkin: 'done' | 'skipped' | 'missed' | 'pending';
    has_journal: boolean;
}

export interface WeeklyReport {
    status: 'generated' | 'cached' | 'no_data';
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
        // AI analysis
        dominant_emotion: string;
        emotional_arc: string;
        what_went_well: string;
        where_you_slipped: string;
        consistency_analysis: string;
        hidden_insight: string;
        next_week_focus: string;
        next_week_plan_context: string;
        // Per-day data
        days: WeeklyReportDay[];
    };
}

export const getWeeklyReport = async (userId: string, sessionId?: string, weekNumber?: number): Promise<WeeklyReport> => {
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    if (weekNumber !== undefined) params.set('week_number', String(weekNumber));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await secureFetch(`${API_BASE_URL}/journal/${userId}/weekly-report${qs}`);
    if (!response.ok) throw new Error('Failed to fetch weekly report');
    return response.json();
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
}

export const getWeekInfo = async (sessionId: string): Promise<WeekInfo> => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/week-info`);
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
    const response = await secureFetch(`${API_BASE_URL}/sessions/${sessionId}/reports`);
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

    const qs = sessionId ? `?session_id=${sessionId}` : '';
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
