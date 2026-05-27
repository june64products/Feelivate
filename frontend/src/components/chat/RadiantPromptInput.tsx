import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, Mic } from 'lucide-react';

interface RadiantPromptInputProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
    disabled?: boolean;
}

export default function RadiantPromptInput({
    placeholder = "Message Feelivate...",
    value: propValue,
    onChange: propOnChange,
    onSubmit,
    disabled = false,
}: RadiantPromptInputProps) {
    const [internalValue, setInternalValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const isControlled = propValue !== undefined;
    const value = isControlled ? propValue : internalValue;

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isControlled) {
            setInternalValue(e.target.value);
        }
        propOnChange?.(e.target.value);
    };

    const handleSubmit = () => {
        if (value.trim() && !disabled) {
            onSubmit?.(value.trim());
            if (!isControlled) setInternalValue("");
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: 'var(--input-max-width)', margin: '0 auto' }}>
            <div
                className="radiant-input-wrapper"
                style={{
                    position: 'relative',
                    borderRadius: '26px',
                    background: 'var(--bg-input)',
                    transition: 'all 0.3s ease',
                }}
            >
                {/* Animated Gradient Border */}
                <div className="radiant-input-border" style={{ borderRadius: '26px' }} />

                {/* Inner Content */}
                <div
                    style={{
                        position: 'relative',
                        zIndex: 10,
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '8px',
                        padding: '10px 12px 10px 16px',
                        minHeight: '52px',
                    }}
                >
                    {/* Attach button */}
                    <button
                        type="button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: '1px solid var(--border-subtle)',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            marginBottom: '2px',
                        }}
                        aria-label="Add attachment"
                    >
                        <Paperclip size={16} strokeWidth={2} />
                    </button>

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={handleChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '15px',
                            fontFamily: 'var(--font-sans)',
                            lineHeight: '1.5',
                            resize: 'none',
                            minHeight: '24px',
                            maxHeight: '200px',
                            padding: '4px 0',
                        }}
                    />

                    {/* Right actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginBottom: '2px' }}>
                        {/* Mic button */}
                        <button
                            type="button"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            aria-label="Use microphone"
                        >
                            <Mic size={16} strokeWidth={2} />
                        </button>

                        {/* Submit button */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!value.trim() || disabled}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                border: 'none',
                                background: value.trim() ? 'var(--text-primary)' : 'var(--bg-surface)',
                                color: value.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                                cursor: value.trim() ? 'pointer' : 'not-allowed',
                                opacity: value.trim() ? 1 : 0.5,
                                transition: 'all 0.2s',
                                transform: value.trim() ? 'scale(1)' : 'scale(0.95)',
                            }}
                            aria-label="Send message"
                        >
                            <ArrowUp size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Disclaimer */}
            <p
                style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginTop: '10px',
                    fontFamily: 'var(--font-sans)',
                }}
            >
                Feelivate can make mistakes. Not a substitute for professional advice.
            </p>
        </div>
    );
}
