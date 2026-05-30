import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Mic, MicOff, ArrowUp, Loader2, ChevronDown } from 'lucide-react';
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
    placeholder = "Message Feelivate...",
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

    // Auto-resize textarea properly
    const resizeTextarea = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        const newH = Math.min(ta.scrollHeight, 220);
        ta.style.height = `${newH}px`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isControlled) setInternalValue(e.target.value);
        propOnChange?.(e.target.value);
        resizeTextarea();
    };

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSubmit(value.trim());
            if (!isControlled) setInternalValue("");
            if (textareaRef.current) {
                textareaRef.current.style.height = '24px';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Mic recording
    const startRecording = useCallback(async () => {
        setMicError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
                stream.getTracks().forEach(t => t.stop());
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                if (audioBlob.size < 1000) { setMicError("Too short — hold and speak!"); return; }
                setIsTranscribing(true);
                try {
                    const text = await transcribeAudio(audioBlob);
                    if (text) {
                        const newVal = (value ? value + ' ' : '') + text;
                        if (!isControlled) setInternalValue(newVal);
                        propOnChange?.(newVal);
                        setTimeout(resizeTextarea, 50);
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
        if (micError) setMicError(null);
    };

    const canSend = value.trim() && !isRecording && !isTranscribing && !disabled;

    return (
        <div
            style={{
                maxWidth: '780px',
                margin: '0 auto',
                width: '100%',
                fontFamily: "'Inter', sans-serif",
            }}
            className={className}
        >
            {/* Main input box — fixed pill that grows cleanly */}
            <div
                style={{
                    background: '#181818',
                    border: isFocused
                        ? '1px solid rgba(255,255,255,0.22)'
                        : '1px solid rgba(255,255,255,0.09)',
                    borderRadius: '16px',
                    transition: 'border-color 0.18s ease',
                    overflow: 'hidden',
                }}
            >
                {/* Top row: Paperclip + Textarea */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '12px 12px 4px 14px',
                    gap: '8px',
                }}>
                    {/* Paperclip */}
                    <button
                        type="button"
                        disabled={disabled}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '7px',
                            background: 'transparent', border: 'none',
                            color: '#555', cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'color 0.15s', flexShrink: 0, marginTop: '2px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#888'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
                        aria-label="Add attachment"
                    >
                        <Paperclip size={17} />
                    </button>

                    {/* Textarea — grows properly */}
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
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: isRecording ? '#f87171' : '#e4e4e7',
                            fontSize: '14.5px',
                            fontWeight: 400,
                            lineHeight: '1.6',
                            resize: 'none',
                            minHeight: '24px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            padding: '4px 0 4px',
                            fontFamily: "'Inter', sans-serif",
                        }}
                    />
                </div>

                {/* Bottom row: Models + Mic + Send */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px 10px 12px',
                }}>
                    {/* Left: Models selector */}
                    <div
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 10px', borderRadius: '8px',
                            background: 'transparent', cursor: 'pointer',
                            color: '#555', fontSize: '12.5px', fontWeight: 500,
                            border: '1px solid transparent',
                            transition: 'all 0.15s', userSelect: 'none',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.color = '#aaa';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#555';
                            e.currentTarget.style.borderColor = 'transparent';
                        }}
                    >
                        Select Models
                        <ChevronDown size={12} strokeWidth={2} style={{ marginLeft: '2px' }} />
                    </div>

                    {/* Right: Mic error + Mic + Send */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {micError && (
                            <span style={{ fontSize: '11px', color: '#f87171', whiteSpace: 'nowrap' }}>
                                {micError}
                            </span>
                        )}

                        {/* Mic button */}
                        <button
                            type="button"
                            onClick={handleMicClick}
                            disabled={disabled || isTranscribing}
                            title={isRecording ? "Stop recording" : "Voice input"}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '50%',
                                border: 'none',
                                cursor: (disabled || isTranscribing) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.18s',
                                flexShrink: 0,
                                background: isRecording ? 'rgba(239,68,68,0.15)' : 'transparent',
                                color: isRecording ? '#f87171' : '#555',
                            }}
                            onMouseEnter={(e) => {
                                if (!isRecording && !isTranscribing && !disabled) {
                                    e.currentTarget.style.color = '#aaa';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isRecording && !isTranscribing) {
                                    e.currentTarget.style.color = '#555';
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {isTranscribing
                                ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                : isRecording
                                    ? <MicOff size={16} />
                                    : <Mic size={16} />
                            }
                        </button>

                        {/* Send button — white circle like Blackbox waveform */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSend}
                            title="Send"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: canSend ? '#ffffff' : 'rgba(255,255,255,0.07)',
                                color: canSend ? '#000000' : '#444',
                                border: 'none',
                                cursor: canSend ? 'pointer' : 'not-allowed',
                                transition: 'all 0.18s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                                if (canSend) e.currentTarget.style.transform = 'scale(1.06)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                            }}
                        >
                            {isRecording
                                ? (
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        {[0, 0.15, 0.3, 0.15, 0].map((d, i) => (
                                            <div key={i} className="wave-bar" style={{ animationDelay: `${d}s` }} />
                                        ))}
                                    </div>
                                )
                                : <ArrowUp size={16} strokeWidth={2.5} />
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Hint text */}
            <p style={{
                textAlign: 'center',
                fontSize: '11px',
                color: '#333',
                marginTop: '10px',
                fontFamily: "'Inter', sans-serif",
            }}>
                By using Feelivate you agree to our <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms</span> and <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
            </p>
        </div>
    );
}
