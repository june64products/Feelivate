import React, { useState, useRef, useCallback } from 'react';
import { Plus, Mic, MicOff, ArrowUp, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../../api';

export interface RadiantPromptInputProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSubmit: (value: string) => void;
    className?: string;
    disabled?: boolean;
}

export default function RadiantPromptInput({
    placeholder = "Ask anything...",
    value: propValue,
    onChange: propOnChange,
    onSubmit,
    className,
    disabled
}: RadiantPromptInputProps) {
    const [internalValue, setInternalValue] = useState("");
    const isControlled = propValue !== undefined;
    const value = isControlled ? propValue : internalValue;

    const [isFocused, setIsFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isControlled) setInternalValue(e.target.value);
        propOnChange?.(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    };

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSubmit(value.trim());
            if (!isControlled) setInternalValue("");
            if (textareaRef.current) textareaRef.current.style.height = '24px';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // ── Mic: start / stop recording ─────────────────────────────────────────
    const startRecording = useCallback(async () => {
        setMicError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Pick best supported MIME type
            const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : MediaRecorder.isTypeSupported('audio/webm')
                    ? 'audio/webm'
                    : 'audio/mp4';

            const recorder = new MediaRecorder(stream, { mimeType });
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onstop = async () => {
                // Stop all tracks to release mic
                stream.getTracks().forEach(t => t.stop());

                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (audioBlob.size < 1000) {
                    setMicError("Too short — hold and speak!");
                    return;
                }

                setIsTranscribing(true);
                try {
                    const text = await transcribeAudio(audioBlob);
                    if (text) {
                        const newVal = (value ? value + ' ' : '') + text;
                        if (!isControlled) setInternalValue(newVal);
                        propOnChange?.(newVal);
                        // Resize textarea
                        setTimeout(() => {
                            if (textareaRef.current) {
                                textareaRef.current.style.height = 'auto';
                                textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
                            }
                        }, 50);
                    } else {
                        setMicError("Couldn't hear anything. Try again.");
                    }
                } catch {
                    setMicError("Transcription failed. Please try again.");
                } finally {
                    setIsTranscribing(false);
                }
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
        } catch {
            setMicError("Microphone access denied.");
        }
    }, [value, isControlled, propOnChange]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    }, []);

    const handleMicClick = () => {
        if (disabled) return;
        if (isRecording) stopRecording();
        else startRecording();
        // Clear error on next click
        if (micError) setMicError(null);
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative', width: '100%' }} className={className}>
            <div
                className="radiant-input-wrapper"
                style={{
                    position: 'relative',
                    borderRadius: '9999px',
                    background: 'var(--bg-surface)',
                    transition: 'all 0.3s ease',
                    boxShadow: isFocused ? '0 8px 32px rgba(192, 132, 252, 0.15)' : '0 4px 12px rgba(0,0,0,0.05)',
                }}
            >
                {/* Animated Gradient Border */}
                <div className="radiant-input-border" style={{ borderRadius: '9999px' }} />

                {/* Inner Content */}
                <div style={{
                    position: 'relative',
                    zIndex: 10,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    padding: '8px 8px 8px 16px',
                    minHeight: '56px',
                    background: 'var(--bg-surface)',
                    borderRadius: '9999px',
                }}>

                    {/* Add Button */}
                    <button
                        type="button"
                        disabled={disabled}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        aria-label="Add attachment"
                    >
                        <Plus size={20} strokeWidth={2} />
                    </button>

                    {/* Text Input */}
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder={
                            isRecording ? "Listening..." :
                            isTranscribing ? "Transcribing..." :
                            placeholder
                        }
                        disabled={disabled || isTranscribing}
                        rows={1}
                        style={{
                            flex: 1,
                            background: 'transparent', border: 'none', outline: 'none',
                            color: isRecording ? '#f87171' : 'var(--text-primary)',
                            fontSize: '16px', fontWeight: 300, letterSpacing: '0.01em',
                            lineHeight: '1.5', resize: 'none',
                            minHeight: '24px', maxHeight: '150px',
                            padding: '8px 0',
                            fontFamily: 'var(--font-sans)', overflowY: 'auto',
                            transition: 'color 0.2s',
                        }}
                    />

                    {/* Right Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

                        {/* Mic Error Tooltip */}
                        {micError && (
                            <span style={{
                                fontSize: '11px', color: '#f87171',
                                whiteSpace: 'nowrap', marginRight: '4px',
                                animation: 'fadeInUp 0.3s ease',
                            }}>
                                {micError}
                            </span>
                        )}

                        {/* Mic Button */}
                        <button
                            type="button"
                            onClick={handleMicClick}
                            disabled={disabled || isTranscribing}
                            className={isRecording ? 'mic-recording' : ''}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '40px', height: '40px', borderRadius: '50%',
                                border: 'none', cursor: (disabled || isTranscribing) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                flexShrink: 0,
                                background: isRecording
                                    ? 'rgba(239, 68, 68, 0.15)'
                                    : isTranscribing
                                        ? 'rgba(192, 132, 252, 0.12)'
                                        : 'transparent',
                                color: isRecording
                                    ? '#f87171'
                                    : isTranscribing
                                        ? 'var(--accent-primary)'
                                        : 'var(--text-muted)',
                            }}
                            onMouseEnter={(e) => {
                                if (!isRecording && !isTranscribing && !disabled) {
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                    e.currentTarget.style.background = 'var(--glass-hover)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isRecording && !isTranscribing) {
                                    e.currentTarget.style.color = 'var(--text-muted)';
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                            aria-label={isRecording ? "Stop recording" : "Use microphone"}
                        >
                            {isTranscribing
                                ? <Loader2 size={20} strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }} />
                                : isRecording
                                    ? <MicOff size={20} strokeWidth={2} />
                                    : <Mic size={20} strokeWidth={2} />
                            }
                        </button>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!value.trim() || disabled || isRecording || isTranscribing}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '40px', height: '40px', borderRadius: '50%',
                                background: value.trim() && !isRecording ? 'var(--text-primary)' : 'var(--bg-input)',
                                color: value.trim() && !isRecording ? 'var(--bg-primary)' : 'var(--text-muted)',
                                border: 'none',
                                cursor: (value.trim() && !disabled && !isRecording && !isTranscribing) ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                flexShrink: 0,
                                transform: (value.trim() && !isRecording) ? 'scale(1)' : 'scale(0.95)',
                                opacity: (value.trim() && !isRecording) ? 1 : 0.6,
                                boxShadow: (value.trim() && !isRecording) ? '0 4px 12px rgba(255,255,255,0.1)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                                if (value.trim() && !disabled && !isRecording) e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                                if (value.trim() && !isRecording) e.currentTarget.style.transform = 'scale(1)';
                            }}
                            aria-label="Send message"
                        >
                            <ArrowUp size={22} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Recording status bar */}
            {isRecording && (
                <div style={{
                    marginTop: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    animation: 'fadeInUp 0.3s ease',
                }}>
                    {/* Live waveform dots */}
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {[0, 1, 2, 3, 4].map(i => (
                            <div
                                key={i}
                                className="mic-wave-bar"
                                style={{ animationDelay: `${i * 0.12}s` }}
                            />
                        ))}
                    </div>
                    <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 500 }}>
                        Recording... click mic to stop
                    </span>
                </div>
            )}
        </div>
    );
}
