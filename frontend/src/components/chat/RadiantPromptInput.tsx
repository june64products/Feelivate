import React, { useState, useRef } from 'react';
import { Send, Mic } from 'lucide-react';

interface RadiantPromptInputProps {
    onSubmit: (text: string) => void;
    disabled?: boolean;
}

export default function RadiantPromptInput({ onSubmit, disabled }: RadiantPromptInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputValue(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSubmit = () => {
        if (inputValue.trim() && !disabled) {
            onSubmit(inputValue.trim());
            setInputValue('');
            if (textareaRef.current) {
                textareaRef.current.style.height = '24px';
            }
        }
    };

    const toggleRecording = () => {
        setIsRecording(!isRecording);
        // actual recording logic would go here
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
            <div 
                className={`radiant-wrapper ${isFocused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}
                style={{
                    position: 'relative',
                    padding: '2px',
                    borderRadius: '24px',
                    background: isFocused 
                        ? 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)' 
                        : 'var(--border-medium)',
                    backgroundSize: '200% 100%',
                    animation: isFocused ? 'gradient-rotate 3s linear infinite' : 'none',
                    transition: 'all 0.3s ease',
                    boxShadow: isFocused ? '0 8px 32px rgba(139, 92, 246, 0.25)' : '0 4px 12px rgba(0,0,0,0.05)',
                }}
            >
                <div style={{
                    background: 'var(--bg-surface)',
                    borderRadius: '22px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: '12px',
                    backdropFilter: 'blur(10px)',
                }}>
                    <button
                        onClick={toggleRecording}
                        disabled={disabled}
                        title="Use Microphone"
                        style={{
                            background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                            border: 'none',
                            color: isRecording ? '#ef4444' : 'var(--text-muted)',
                            padding: '8px',
                            borderRadius: '50%',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            marginBottom: '4px'
                        }}
                    >
                        <Mic size={20} className={isRecording ? 'pulse-animation' : ''} />
                    </button>
                    
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={handleInput}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Message Feelivate..."
                        disabled={disabled}
                        rows={1}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '15px',
                            lineHeight: '1.5',
                            resize: 'none',
                            minHeight: '24px',
                            maxHeight: '150px',
                            padding: '6px 0',
                            fontFamily: 'inherit',
                            overflowY: 'auto'
                        }}
                    />

                    <button
                        onClick={handleSubmit}
                        disabled={!inputValue.trim() || disabled}
                        style={{
                            background: inputValue.trim() ? 'var(--brand-primary)' : 'var(--border-medium)',
                            color: inputValue.trim() ? '#fff' : 'var(--text-muted)',
                            border: 'none',
                            padding: '8px',
                            borderRadius: '50%',
                            cursor: inputValue.trim() && !disabled ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            marginBottom: '4px',
                            boxShadow: inputValue.trim() ? '0 2px 10px rgba(16, 185, 129, 0.3)' : 'none'
                        }}
                    >
                        <Send size={18} style={{ transform: 'translateX(-1px) translateY(1px)' }} />
                    </button>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes gradient-rotate {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 200% 50%; }
                }
                @keyframes pulse-animation {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .pulse-animation {
                    animation: pulse-animation 1.5s infinite ease-in-out;
                }
            `}} />
        </div>
    );
}
