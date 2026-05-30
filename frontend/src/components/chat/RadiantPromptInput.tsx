import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Mic, MicOff, ArrowUp, Loader2, Settings2 } from 'lucide-react';
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
        if (micError) setMicError(null);
    };

    return (
        <div style={{ maxWidth: '820px', margin: '0 auto', position: 'relative', width: '100%', fontFamily: "'Inter', sans-serif" }} className={className}>
            <div
                style={{
                    position: 'relative',
                    borderRadius: '16px',
                    background: '#161616', // Dark sleek background like Blackbox
                    border: isFocused ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.08)',
                    transition: 'border-color 0.2s ease',
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '8px',
                    padding: '10px 12px 10px 16px',
                    minHeight: '56px',
                }}>

                    {/* Paperclip Button */}
                    <button
                        type="button"
                        disabled={disabled}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: 'transparent', border: 'none',
                            color: '#a1a1aa', cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', flexShrink: 0,
                            marginBottom: '2px'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
                        aria-label="Add attachment"
                    >
                        <Paperclip size={18} />
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
                            color: isRecording ? '#f87171' : '#fff',
                            fontSize: '14.5px', fontWeight: 400,
                            lineHeight: '1.5', resize: 'none',
                            minHeight: '24px', maxHeight: '200px',
                            padding: '6px 0',
                            fontFamily: "'Inter', sans-serif", overflowY: 'auto',
                            transition: 'color 0.2s',
                        }}
                    />

                    {/* Right Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        
                        {/* Fake Model Selector for aesthetics */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', borderRadius: '6px',
                            background: 'transparent', cursor: 'pointer',
                            color: '#a1a1aa', fontSize: '12px', fontWeight: 500,
                            border: '1px solid transparent',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a1a1aa'; }}
                        >
                            <Settings2 size={14} /> Models
                        </div>

                        {micError && (
                            <span style={{ fontSize: '11px', color: '#f87171', whiteSpace: 'nowrap' }}>
                                {micError}
                            </span>
                        )}

                        {/* Mic Button - White pill style when recording, otherwise sleek icon */}
                        <button
                            type="button"
                            onClick={handleMicClick}
                            disabled={disabled || isTranscribing}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '50%',
                                border: 'none', cursor: (disabled || isTranscribing) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', flexShrink: 0,
                                background: isRecording ? '#fff' : 'transparent',
                                color: isRecording ? '#000' : isTranscribing ? '#fff' : '#a1a1aa',
                            }}
                            onMouseEnter={(e) => {
                                if (!isRecording && !isTranscribing && !disabled) {
                                    e.currentTarget.style.color = '#fff';
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isRecording && !isTranscribing) {
                                    e.currentTarget.style.color = '#a1a1aa';
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

                        {/* Submit Button - White pill like the waveform button in blackbox */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!value.trim() || disabled || isRecording || isTranscribing}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: value.trim() && !isRecording ? '#fff' : 'rgba(255,255,255,0.05)',
                                color: value.trim() && !isRecording ? '#000' : '#a1a1aa',
                                border: 'none',
                                cursor: (value.trim() && !disabled && !isRecording && !isTranscribing) ? 'pointer' : 'not-allowed',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => {
                                if (value.trim() && !disabled && !isRecording) {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (value.trim() && !isRecording) {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }
                            }}
                        >
                            <ArrowUp size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Recording status bar */}
            {isRecording && (
                <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                }}>
                    <span style={{ fontSize: '12px', color: '#f87171', fontWeight: 500 }}>
                        Recording... click mic to stop
                    </span>
                </div>
            )}
        </div>
    );
}
