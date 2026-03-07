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
