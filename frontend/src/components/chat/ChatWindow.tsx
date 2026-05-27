import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, User } from 'lucide-react';
import PlanCard from './PlanCard';

interface Message {
    role: string;
    content: string;
    plan?: any;
}

interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    activePlan: any | null;
    onApprovePlan: () => void;
    onRequestPlanChange: (feedback: string) => void;
    isPlanApproved: boolean;
}

export default function ChatWindow({
    messages,
    isLoading,
    activePlan,
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
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '40px 20px',
                    gap: '16px',
                }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                        width: '48px', height: '48px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 32px rgba(192, 132, 252, 0.2)',
                    }}
                >
                    <Sparkles size={24} style={{ color: 'white' }} />
                </motion.div>
                <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{
                        fontSize: '24px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                    }}
                >
                    What can I help you plan?
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    style={{
                        fontSize: '14px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        maxWidth: '420px',
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
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        justifyContent: 'center',
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
                            style={{
                                padding: '8px 16px',
                                borderRadius: '20px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--glass-surface)',
                                color: 'var(--text-secondary)',
                                fontSize: '13px',
                                cursor: 'default',
                                transition: 'all 0.2s',
                            }}
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
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 0',
            }}
        >
            {/* Approved plan pill at top */}
            {isPlanApproved && activePlan && (
                <div style={{ maxWidth: 'var(--chat-max-width)', margin: '0 auto', padding: '0 20px' }}>
                    <PlanCard
                        plan={activePlan}
                        onApprove={onApprovePlan}
                        onRequestChange={onRequestPlanChange}
                        isApproved={true}
                    />
                </div>
            )}

            {/* Messages */}
            <div style={{ maxWidth: 'var(--chat-max-width)', margin: '0 auto', padding: '0 20px' }}>
                {messages.map((msg, idx) => (
                    <div key={idx}>
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            style={{
                                display: 'flex',
                                gap: '12px',
                                padding: '16px 0',
                                alignItems: 'flex-start',
                            }}
                        >
                            {/* Avatar */}
                            <div
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: msg.role === 'user' ? '50%' : '10px',
                                    background: msg.role === 'user'
                                        ? 'var(--accent-warm)'
                                        : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: '2px',
                                }}
                            >
                                {msg.role === 'user' ? (
                                    <User size={14} style={{ color: 'white' }} />
                                ) : (
                                    <Sparkles size={14} style={{ color: 'white' }} />
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    marginBottom: '4px',
                                    textTransform: 'capitalize',
                                }}>
                                    {msg.role === 'user' ? 'You' : 'Feelivate'}
                                </div>
                                <div
                                    style={{
                                        fontSize: '14px',
                                        color: 'var(--text-primary)',
                                        lineHeight: '1.7',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                    }}
                                    dangerouslySetInnerHTML={{
                                        __html: formatMarkdown(msg.content)
                                    }}
                                />
                            </div>
                        </motion.div>

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
                        style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '16px 0',
                            alignItems: 'flex-start',
                        }}
                    >
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Sparkles size={14} style={{ color: 'white' }} />
                        </div>
                        <div style={{ paddingTop: '8px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
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
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Inline code
        .replace(/`(.*?)`/g, '<code style="background:var(--bg-surface);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>')
        // Line breaks
        .replace(/\n/g, '<br/>');
    return html;
}
