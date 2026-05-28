import React, { useState, useRef } from 'react';
import { Plus, Mic, ArrowUp } from 'lucide-react';

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
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!isControlled) {
            setInternalValue(e.target.value);
        }
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
                {/* Animated Gradient Border from index.css */}
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
                        className="prompt-action-btn"
                        disabled={disabled}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            flexShrink: 0,
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
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            fontWeight: 300,
                            letterSpacing: '0.01em',
                            lineHeight: '1.5',
                            resize: 'none',
                            minHeight: '24px',
                            maxHeight: '150px',
                            padding: '8px 0',
                            fontFamily: 'var(--font-sans)',
                            overflowY: 'auto'
                        }}
                    />

                    {/* Right Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        
                        {/* Mic Button */}
                        <button 
                            type="button"
                            disabled={disabled}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: disabled ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--glass-hover)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                            aria-label="Use microphone"
                        >
                            <Mic size={20} strokeWidth={2} />
                        </button>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!value.trim() || disabled}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: value.trim() ? 'var(--text-primary)' : 'var(--bg-input)',
                                color: value.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
                                border: 'none',
                                cursor: value.trim() && !disabled ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                flexShrink: 0,
                                transform: value.trim() && !disabled ? 'scale(1)' : 'scale(0.95)',
                                opacity: value.trim() ? 1 : 0.6,
                                boxShadow: value.trim() ? '0 4px 12px rgba(255,255,255,0.1)' : 'none'
                            }}
                            onMouseEnter={(e) => {
                                if (value.trim() && !disabled) {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (value.trim() && !disabled) {
                                    e.currentTarget.style.transform = 'scale(1)';
                                }
                            }}
                            aria-label="Send message"
                        >
                            <ArrowUp size={22} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
