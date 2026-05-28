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
