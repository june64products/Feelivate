const getApiUrl = () => {
    // Priority: 1. Manual override, 2. Env variable, 3. Default
    const override = typeof window !== 'undefined' ? localStorage.getItem('VITE_API_URL_OVERRIDE') : null;
    return override || import.meta.env.VITE_API_URL || 'http://localhost:8000';
};

export const API_BASE_URL = getApiUrl();

// Helper to get token from storage
const getToken = () => localStorage.getItem('access_token');

// Secure fetch wrapper that adds Authorization header
const secureFetch = async (url: string, options: RequestInit = {}) => {
    const token = getToken();
    const headers = {
        ...options.headers,
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': options.body instanceof FormData ? undefined : 'application/json',
    };

    // Remove Content-Type if body is FormData (browser will set it with boundary)
    if (options.body instanceof FormData) {
        delete (headers as any)['Content-Type'];
    }

    const response = await fetch(url, {
        ...options,
        headers: headers as any,
    });

    if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('access_token');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }

    return response;
};

export interface IngestRequest {
    user_id: string;
    text: string;
}

export interface IngestResponse {
    trace_id: string;
    session_id: string;
    status: string;
}

export const submitIngest = async (payload: IngestRequest): Promise<IngestResponse> => {
    const response = await secureFetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Integration failed: ${response.statusText}`);
    }

    return response.json();
};

export const submitIngestStream = async (payload: IngestRequest, onUpdate: (data: any) => void) => {
    const response = await secureFetch(`${API_BASE_URL}/ingest_stream`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    onUpdate(data);
                } catch (e) {
                    console.error("Error parsing stream event:", e);
                }
            }
        }
    }
};

export const fetchResult = async (traceId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/result/${traceId}`);

    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.statusText}`);
    }

    return response.json();
};

export interface TranscribeResponse {
    raw_text: string;
    text: string;
    focus: string;
    history: string;
    vision: string;
}

export const transcribeAudio = async (audioBlob: Blob): Promise<TranscribeResponse> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    const response = await secureFetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
    }

    return response.json();
};

export interface QuestionResponse {
    question: string;
}

export const generateQuestion = async (history: Array<{q: string, a: string}>): Promise<QuestionResponse> => {
    const response = await secureFetch(`${API_BASE_URL}/generate_questions`, {
        method: 'POST',
        body: JSON.stringify({ history }),
    });

    if (!response.ok) {
        throw new Error(`Failed to generate question: ${response.statusText}`);
    }

    return response.json();
};

export interface ContradictionResponse {
    has_contradiction: boolean;
    tension_question?: string;
    question?: string;
}

export const detectContradiction = async (history: Array<{q: string, a: string}>): Promise<ContradictionResponse> => {
    const response = await secureFetch(`${API_BASE_URL}/detect_contradiction`, {
        method: 'POST',
        body: JSON.stringify({ history }),
    });

    if (!response.ok) {
        throw new Error(`Contradiction detection failed: ${response.statusText}`);
    }

    return response.json();
};

export const submitCheckIn = async (payload: { user_id: string, session_id: string, status: string, current_plan: any }) => {
    const response = await secureFetch(`${API_BASE_URL}/checkin`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Check-in failed: ${response.statusText}`);
    }

    return response.json();
};

export interface WeeklyFocusRequest {
    user_id: string;
    session_id: string;
    current_phase: string;
    current_week: string;
}

export const generateWeeklyFocus = async (payload: WeeklyFocusRequest) => {
    const response = await secureFetch(`${API_BASE_URL}/weekly_focus`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Weekly focus failed: ${response.statusText}`);
    }

    return response.json();
};

export interface WeekChatRequest {
    user_id: string;
    session_id: string;
    message: string;
    week_context: any;
    chat_history: { role: string; content: string }[];
}

export interface GlobalChatRequest {
    user_id: string;
    session_id: string;
    message: string;
    full_roadmap?: any;
    chat_history: { role: string; content: string }[];
}

export const chatWeek = async (data: WeekChatRequest) => {
    const response = await secureFetch(`${API_BASE_URL}/chat_week`, {
        method: 'POST',
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Failed to chat with week agent');
    }

    return response.json();
};

export const chatGlobal = async (data: GlobalChatRequest) => {
    const response = await secureFetch(`${API_BASE_URL}/chat_global`, {
        method: 'POST',
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Failed to chat with global agent');
    }

    return response.json();
};

export const login = async (data: any) => {
    // Login doesn't use secureFetch because it doesn't have a token yet
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
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

export const signup = async (data: any) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
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

export const getUserSessions = async (userId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
};

export const getSessionDetail = async (sessionId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/sessions/detail/${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch session details');
    return response.json();
};

export const getSessionHistory = async (sessionId: string) => {
    const data = await getSessionDetail(sessionId);
    return data.chat_history || [];
};

// Google Calendar
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
        method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to sync calendar');
    return response.json();
};

export const stopGoogleCalendarSync = async (userId: string) => {
    const response = await secureFetch(`${API_BASE_URL}/calendar/stop?user_id=${userId}`, {
        method: 'POST'
    });
    if (!response.ok) throw new Error('Failed to stop calendar sync');
    return response.json();
};
