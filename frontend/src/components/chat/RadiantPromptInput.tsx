import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, ArrowUp, Loader2 } from 'lucide-react';
import { transcribeAudio } from '../../api';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/** One line of text at the styles below — keeps the collapsed box button-height. */
const LINE_HEIGHT = 1.6;
const FONT_SIZE = 14.5;
const ONE_LINE = Math.round(FONT_SIZE * LINE_HEIGHT); // 23px
/** Ceiling before the textarea scrolls instead of pushing the page around. */
const MAX_INPUT_HEIGHT = 180;

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

    // Grow only as far as the text actually needs. The box sits at one line by
    // default and gains a line at a time, which matters most on a phone where a
    // permanently tall composer eats the conversation above it.
    const resizeTextarea = () => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        const newH = Math.min(ta.scrollHeight, MAX_INPUT_HEIGHT);
        ta.style.height = `${newH}px`;
    };

    // The value can change without a keystroke — voice transcription fills it in
    // — so the height has to follow the value, not just the typing.
    useEffect(resizeTextarea, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isControlled) setInternalValue(e.target.value);
        propOnChange?.(e.target.value);
        resizeTextarea();
    };

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSubmit(value.trim());
            if (!isControlled) setInternalValue("");
            // 'auto' rather than a fixed px: the value is about to clear, and
            // auto collapses back to exactly one line on the next paint.
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
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
            data-tour="chat-input"
            style={{
                maxWidth: '780px',
                margin: '0 auto',
                width: '100%',
                fontFamily: satoshi,
            }}
            className={className}
        >
            {/* Main input box — Swiss pill */}
            <div
                style={{
                    background: 'var(--bg-surface)',
                    border: isFocused
                        ? '1px solid var(--input-border-focus)'
                        : '1px solid var(--input-border)',
                    borderRadius: '16px',
                    transition: 'border-color 0.18s ease',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-md)',
                }}
            >
                {/* Single row: textarea + mic + send. They used to be stacked,
                    which cost ~40px of permanent height for a box that is empty
                    most of the time. Bottom-aligned so the buttons stay put as
                    the text grows upward. */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: '6px 8px 6px 16px',
                    gap: '6px',
                }}>
                    {/* Textarea — Swiss style */}
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
                            color: isRecording ? '#ef4444' : 'var(--text-primary)',
                            fontSize: `${FONT_SIZE}px`,
                            fontWeight: 400,
                            lineHeight: LINE_HEIGHT,
                            resize: 'none',
                            // Padding + one line = 32px, exactly the button height,
                            // so an empty box is a single clean row.
                            minHeight: `${ONE_LINE + 9}px`,
                            maxHeight: `${MAX_INPUT_HEIGHT}px`,
                            overflowY: 'auto',
                            padding: '4px 0 5px',
                            fontFamily: satoshi,
                        }}
                    />

                    {/* Mic button */}
                        <button
                            type="button"
                            data-tour="mic-button"
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
                                background: isRecording ? 'rgba(239,68,68,0.1)' : 'transparent',
                                color: isRecording ? '#ef4444' : 'var(--text-muted)',
                            }}
                            onMouseEnter={(e) => {
                                if (!isRecording && !isTranscribing && !disabled) {
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                    e.currentTarget.style.background = 'var(--btn-hover-bg)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isRecording && !isTranscribing) {
                                    e.currentTarget.style.color = 'var(--text-muted)';
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

                        {/* Send button — Swiss circle */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSend}
                            title="Send"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: canSend ? 'var(--btn-primary-bg)' : 'var(--btn-disabled-bg)',
                                color: canSend ? 'var(--btn-primary-text)' : 'var(--text-muted)',
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

            {/* Mic errors sit under the box, not inside the row — in one row they
                would squeeze the textarea the moment they appeared. */}
            {micError && (
                <p style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#ef4444',
                    marginTop: '8px',
                    fontFamily: satoshi,
                }}>
                    {micError}
                </p>
            )}

            {/* Hint text */}
            <p style={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '10px',
                fontFamily: satoshi,
            }}>
                By using Feelivate you agree to our <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms</span> and <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
            </p>

            {/* AI disclosure, sat directly under the terms line. Required by the
                EU AI Act Art 50(1): a person has to be told they are talking to
                a machine, at the point they start talking to it — not only in
                the Terms page they may never open. */}
            <p style={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--text-muted)',
                marginTop: '4px',
                fontFamily: satoshi,
            }}>
                You are interacting with an AI, not a human.
            </p>
        </div>
    );
}
