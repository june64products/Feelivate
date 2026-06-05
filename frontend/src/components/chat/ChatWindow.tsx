import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import PlanCard from './PlanCard';

interface Message {
    role: string;
    content: string;
    plan?: any;
}

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    onApprovePlan: () => void;
    onRequestPlanChange: (feedback: string) => void;
    isPlanApproved: boolean;
}

export default function ChatWindow({
    messages,
    isLoading,
    onApprovePlan,
    onRequestPlanChange,
    isPlanApproved,
}: ChatWindowProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length, isLoading]);

    // Empty state
    if (messages.length === 0 && !isLoading) {
        return (
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '40px 20px', gap: '20px',
            }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                >
                    <div style={{
                        width: '64px', height: '64px',
                        background: 'rgba(139,92,246,0.1)',
                        borderRadius: '20px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(139,92,246,0.15)',
                    }}>
                        <img
                            src="/logo_2_backup.png"
                            alt="Feelivate"
                            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                        />
                    </div>
                </motion.div>
                <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{
                        fontSize: '24px', fontWeight: 700,
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        fontFamily: 'var(--font-sans)',
                        letterSpacing: '-0.02em',
                    }}
                >
                    What can I help you plan?
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    style={{
                        fontSize: '15px', color: 'var(--text-secondary)',
                        textAlign: 'center', maxWidth: '420px',
                        fontFamily: 'var(--font-sans)', lineHeight: 1.6,
                    }}
                >
                    Tell me your goal — fitness, coding, studying, music, anything. I'll build you a personalized week plan.
                </motion.p>

                {/* Suggestion chips */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.4 }}
                    style={{
                        display: 'flex', flexWrap: 'wrap',
                        gap: '10px', justifyContent: 'center',
                        marginTop: '8px',
                    }}
                >
                    {[
                        "🏋️ I want to get fit",
                        "💻 Help me learn coding",
                        "📚 Exam prep plan",
                        "🎸 Learn guitar",
                    ].map((suggestion, idx) => (
                        <div
                            key={idx}
                            className="suggestion-chip"
                        >
                            {suggestion}
                        </div>
                    ))}
                </motion.div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}
        >
            {/* Messages */}
            <div style={{ maxWidth: 'var(--chat-max-width)', margin: '0 auto', padding: '0 24px' }}>
                {messages.map((msg, idx) => (
                    <div key={idx}>
                        {msg.role === 'assistant' ? (
                            /* AI MESSAGE */
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0' }}
                            >
                                {/* AI avatar row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <div style={{
                                        width: '30px', height: '30px', borderRadius: '10px',
                                        background: 'rgba(139,92,246,0.1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                        border: '1px solid rgba(139,92,246,0.15)',
                                    }}>
                                        <img
                                            src="/logo_2_backup.png"
                                            alt="Feelivate"
                                            style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                                        />
                                    </div>
                                    <span style={{
                                        fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)',
                                        fontFamily: 'var(--font-sans)',
                                    }}>
                                        Feelivate
                                    </span>
                                </div>
                                {/* AI bubble */}
                                <div className="msg-bubble-ai" style={{ padding: '20px 24px', maxWidth: '88%' }}>
                                    <div
                                        style={{
                                            fontSize: '15px', color: 'var(--text-primary)',
                                            lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                                    />
                                </div>
                            </motion.div>
                        ) : (
                            /* USER MESSAGE */
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', padding: '16px 0' }}
                            >
                                <div className="msg-bubble-user" style={{ padding: '18px 22px', maxWidth: '88%' }}>
                                    <div
                                        style={{
                                            fontSize: '15px', color: 'var(--color-primary)',
                                            fontWeight: 500, lineHeight: '1.7',
                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                            fontStyle: 'italic',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {/* If this message has an associated plan, show PlanCard */}
                        {msg.plan && !isPlanApproved && (
                            <PlanCard
                                plan={msg.plan}
                                onApprove={onApprovePlan}
                                onRequestChange={onRequestPlanChange}
                                isApproved={false}
                            />
                        )}
                    </div>
                ))}

                {/* Loading indicator */}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                            <div style={{
                                width: '30px', height: '30px', borderRadius: '10px',
                                background: 'rgba(139,92,246,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '1px solid rgba(139,92,246,0.15)',
                            }}>
                                <img src="/logo_2_backup.png" alt="Feelivate"
                                    style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-primary)', fontFamily: 'var(--font-sans)' }}>
                                Feelivate
                            </span>
                        </div>
                        <div className="msg-bubble-ai" style={{ padding: '18px 24px', display: 'inline-flex' }}>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <div className="loading-dot" />
                                <div className="loading-dot" />
                                <div className="loading-dot" />
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}

// Simple markdown formatter
function formatMarkdown(text: string): string {
    if (!text) return '';
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:rgba(139,92,246,0.08);padding:2px 7px;border-radius:6px;font-family:var(--font-mono);font-size:12.5px;color:var(--color-primary);">$1</code>')
        .replace(/\n/g, '<br/>');
    return html;
}
