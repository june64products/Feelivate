export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Integration failed: ${response.statusText}`);
    }

    return response.json();
};

export const submitIngestStream = async (payload: IngestRequest, onUpdate: (data: any) => void) => {
    const response = await fetch(`${API_BASE_URL}/ingest_stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
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
    const response = await fetch(`${API_BASE_URL}/result/${traceId}`);

    if (!response.ok) {
        throw new Error(`Fetch failed: ${response.statusText}`);
    }

    return response.json();
};

export interface TranscribeResponse {
    raw_text: string;
    focus: string;
    history: string;
    vision: string;
}

export const transcribeAudio = async (audioBlob: Blob): Promise<TranscribeResponse> => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm'); // using webm for browser media recorder

    const response = await fetch(`${API_BASE_URL}/transcribe`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
    }

    return response.json();
};

export const generateQuestion = async (text: string, history?: string): Promise<string> => {
    const response = await fetch(`${API_BASE_URL}/generate_questions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, history }),
    });

    if (!response.ok) {
        throw new Error(`Failed to generate question: ${response.statusText}`);
    }

    const data = await response.json();
    return data.question;
};

export interface ContradictionResponse {
    has_contradiction: boolean;
    tension_question: string;
}

export const detectContradiction = async (focus: string, history: string): Promise<ContradictionResponse> => {
    const response = await fetch(`${API_BASE_URL}/detect_contradiction`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ focus, history }),
    });

    if (!response.ok) {
        throw new Error(`Contradiction detection failed: ${response.statusText}`);
    }

    return response.json();
};

export const submitCheckIn = async (payload: { user_id: string, session_id: string, status: string, current_plan: any }) => {
    const response = await fetch(`${API_BASE_URL}/checkin`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
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
    const response = await fetch(`${API_BASE_URL}/weekly_focus`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
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
    full_roadmap: any;
    chat_history: { role: string; content: string }[];
}

export const chatWeek = async (data: WeekChatRequest) => {
    const response = await fetch(`${API_BASE_URL}/chat_week`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Failed to chat with week agent');
    }

    return response.json();
};

export const chatGlobal = async (data: GlobalChatRequest) => {
    const response = await fetch(`${API_BASE_URL}/chat_global`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        throw new Error('Failed to chat with global agent');
    }

    return response.json();
};

export const login = async (data: any) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
};

export const signup = async (data: any) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Signup failed');
    return response.json();
};

export const getUserSessions = async (userId: string) => {
    const response = await fetch(`${API_BASE_URL}/sessions/${userId}`);
    if (!response.ok) throw new Error('Failed to fetch sessions');
    return response.json();
};

export const getSessionDetail = async (sessionId: string) => {
    const response = await fetch(`${API_BASE_URL}/sessions/detail/${sessionId}`);
    if (!response.ok) throw new Error('Failed to fetch session details');
    return response.json();
};
