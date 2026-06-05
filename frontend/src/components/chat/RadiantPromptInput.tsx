import React, { useState, useRef, useCallback } from 'react';
import { Paperclip, Mic, MicOff, ArrowUp, Loader2, SlidersHorizontal, X } from 'lucide-react';
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
    const [showModels, setShowModels] = useState(false);
    const [selectedModel, setSelectedModel] = useState('Groq Llama 3.3');

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
                maxWidth: '720px',
                margin: '0 auto',
                width: '100%',
                fontFamily: "var(--font-sans)",
            }}
            className={className}
        >
            {/* Main input box — Stitch glass pill */}
            <div
                style={{
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: isFocused
                        ? '1px solid rgba(139,92,246,0.35)'
                        : '1px solid rgba(255,255,255,0.95)',
                    borderRadius: '9999px',
                    transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
                    overflow: 'hidden',
                    boxShadow: isFocused
                        ? '0 20px 50px rgba(0,0,0,0.08), 0 0 0 3px rgba(139,92,246,0.1)'
                        : '0 20px 50px rgba(0,0,0,0.07)',
                }}
            >
                {/* Top row: Paperclip + Textarea */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '12px 16px 4px 16px',
                    gap: '10px',
                }}>
                    {/* Paperclip */}
                    <button
                        type="button"
                        disabled={disabled}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: 'transparent', border: 'none',
                            color: 'var(--text-muted)', cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'color 0.15s', flexShrink: 0, marginTop: '2px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
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
                            color: isRecording ? '#ef4444' : 'var(--text-primary)',
                            fontSize: '15px',
                            fontWeight: 400,
                            lineHeight: '1.6',
                            resize: 'none',
                            minHeight: '24px',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            padding: '4px 0 4px',
                            fontFamily: "var(--font-sans)",
                        }}
                    />
                </div>

                {/* Bottom row: Settings + Mic + Send */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 10px 10px 14px',
                    position: 'relative',
                }}>
                    {/* Left: Model settings popup trigger */}
                    <div style={{ position: 'relative' }}>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => setShowModels(prev => !prev)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', borderRadius: '9999px',
                                background: showModels ? 'rgba(139,92,246,0.08)' : 'transparent',
                                border: '1px solid transparent',
                                color: showModels ? 'var(--color-primary)' : 'var(--text-muted)',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                fontSize: '12.5px', fontWeight: 500,
                                transition: 'all 0.15s', userSelect: 'none',
                                fontFamily: "var(--font-label)",
                            }}
                            onMouseEnter={(e) => {
                                if (!showModels) e.currentTarget.style.background = 'rgba(139,92,246,0.06)';
                                e.currentTarget.style.color = 'var(--color-primary)';
                            }}
                            onMouseLeave={(e) => {
                                if (!showModels) e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = showModels ? 'var(--color-primary)' : 'var(--text-muted)';
                            }}
                            aria-label="Select model"
                        >
                            <SlidersHorizontal size={14} />
                            <span style={{ color: '#666', fontSize: '12px' }}>{selectedModel}</span>
                        </button>

                        {/* Model popup */}
                        {showModels && (
                            <div style={{
                                position: 'absolute', bottom: 'calc(100% + 10px)', left: 0,
                                background: 'rgba(255,255,255,0.95)',
                                backdropFilter: 'blur(20px)',
                                WebkitBackdropFilter: 'blur(20px)',
                                border: '1px solid rgba(203,195,215,0.6)',
                                borderRadius: '16px', padding: '8px',
                                width: '220px', boxShadow: '0 16px 40px rgba(139,92,246,0.12)',
                                zIndex: 100,
                            }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 8px 10px', borderBottom: '1px solid rgba(203,195,215,0.4)',
                                    marginBottom: '4px',
                                }}>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'var(--font-label)' }}>
                                        Model
                                    </span>
                                    <button
                                        onClick={() => setShowModels(false)}
                                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', display: 'flex' }}
                                    >
                                        <X size={13} />
                                    </button>
                                </div>
                                {[
                                    { name: 'Groq Llama 3.3', tag: 'Fast', color: '#60a5fa' },
                                    { name: 'GPT-4o Mini', tag: 'Balanced', color: '#a78bfa' },
                                    { name: 'OSS 120B', tag: 'Deep', color: '#fbbf24' },
                                ].map((m) => (
                                    <button
                                        key={m.name}
                                        onClick={() => { setSelectedModel(m.name); setShowModels(false); }}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center',
                                            justifyContent: 'space-between', padding: '9px 10px',
                                            borderRadius: '10px', border: 'none',
                                            background: selectedModel === m.name ? 'rgba(139,92,246,0.08)' : 'transparent',
                                            color: selectedModel === m.name ? 'var(--color-primary)' : 'var(--text-secondary)',
                                            cursor: 'pointer', fontSize: '13px', fontWeight: selectedModel === m.name ? 600 : 400,
                                            fontFamily: "var(--font-sans)",
                                            transition: 'all 0.12s',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; }}
                                        onMouseLeave={e => { if (selectedModel !== m.name) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {m.name}
                                        <span style={{
                                            fontSize: '10px', fontWeight: 600, color: m.color,
                                            background: `${m.color}18`, padding: '2px 7px',
                                            borderRadius: '6px',
                                        }}>
                                            {m.tag}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
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
                                width: '34px', height: '34px', borderRadius: '50%',
                                border: 'none',
                                cursor: (disabled || isTranscribing) ? 'not-allowed' : 'pointer',
                                transition: 'all 0.18s',
                                flexShrink: 0,
                                background: isRecording ? 'rgba(239,68,68,0.1)' : 'transparent',
                                color: isRecording ? '#ef4444' : 'var(--text-muted)',
                            }}
                            onMouseEnter={(e) => {
                                if (!isRecording && !isTranscribing && !disabled) {
                                    e.currentTarget.style.color = 'var(--color-primary)';
                                    e.currentTarget.style.background = 'rgba(139,92,246,0.07)';
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

                        {/* Send button — violet pill (Stitch style) */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSend}
                            title="Send"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '6px',
                                height: '38px', padding: '0 18px',
                                borderRadius: '9999px',
                                background: canSend ? 'var(--color-primary)' : 'rgba(139,92,246,0.15)',
                                color: canSend ? '#ffffff' : 'rgba(139,92,246,0.4)',
                                border: 'none',
                                cursor: canSend ? 'pointer' : 'not-allowed',
                                transition: 'all 0.18s',
                                flexShrink: 0,
                                fontFamily: 'var(--font-sans)',
                                fontSize: '14px',
                                fontWeight: 700,
                                boxShadow: canSend ? '0 4px 12px rgba(139,92,246,0.3)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                                if (canSend) { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,92,246,0.4)'; }
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                                e.currentTarget.style.boxShadow = canSend ? '0 4px 12px rgba(139,92,246,0.3)' : 'none';
                            }}
                        >
                            {isRecording
                                ? (
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        {[0, 0.15, 0.3, 0.15, 0].map((d, i) => (
                                            <div key={i} className="wave-bar" style={{ animationDelay: `${d}s`, background: '#fff' }} />
                                        ))}
                                    </div>
                                )
                                : <><ArrowUp size={15} strokeWidth={2.5} /><span>Send</span></>
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Hint text */}
            <p style={{
                textAlign: 'center',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                marginTop: '12px',
                fontFamily: "var(--font-label)",
                opacity: 0.7,
            }}>
                By using Feelivate you agree to our <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Terms</span> and <span style={{ textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
            </p>
        </div>
    );
}
