import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
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

    // Empty state — cinematic hero
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
                    position: 'relative',
                }}
            >
                {/* Ambient glow behind logo */}
                <div style={{
                    position: 'absolute', top: '28%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '320px', height: '320px',
                    background: 'radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 65%)',
                    filter: 'blur(60px)', pointerEvents: 'none',
                }} />

                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div style={{
                        width: '64px', height: '64px',
                        background: '#fff', borderRadius: '18px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 40px rgba(167,139,250,0.2)',
                    }}>
                        <img
                            src="/logo_2_backup.png" alt="Feelivate"
                            style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                        />
                    </div>
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        fontSize: '26px', fontWeight: 700,
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        letterSpacing: '-0.03em',
                    }}
                >
                    What can I help you plan?
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        fontSize: '14px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        maxWidth: '440px', lineHeight: 1.7,
                    }}
                >
                    Tell me your goal — fitness, coding, studying, music, anything. I'll build you a personalized week plan.
                </motion.p>

                {/* Suggestion chips */}
                <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        display: 'flex', flexWrap: 'wrap', gap: '8px',
                        justifyContent: 'center', marginTop: '8px',
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
                                padding: '8px 16px', borderRadius: '20px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--glass-surface)',
                                color: 'var(--text-secondary)',
                                fontSize: '13px', cursor: 'default',
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
                flex: 1, overflowY: 'auto',
                padding: '20px 0 100px',
            }}
        >
            <div style={{ maxWidth: 'var(--chat-max-width)', margin: '0 auto', padding: '0 20px' }}>
                {messages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                        <div key={idx}>
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    padding: '12px 0',
                                    alignItems: 'flex-start',
                                }}
                            >
                                {/* Avatar */}
                                <div
                                    style={{
                                        width: '30px', height: '30px',
                                        borderRadius: isUser ? '50%' : '10px',
                                        background: isUser
                                            ? 'linear-gradient(135deg, #d97757, #c06040)'
                                            : 'linear-gradient(135deg, #a78bfa, #6366f1)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, marginTop: '2px',
                                    }}
                                >
                                    {isUser ? (
                                        <User size={14} style={{ color: 'white' }} />
                                    ) : (
                                        <img
                                            src="/logo_2_backup.png" alt="Feelivate"
                                            style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '4px' }}
                                        />
                                    )}
                                </div>

                                {/* Content bubble */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: '11.5px', fontWeight: 600,
                                        color: 'var(--text-muted)',
                                        marginBottom: '5px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                    }}>
                                        {isUser ? 'You' : 'Feelivate'}
                                    </div>
                                    <div
                                        className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}
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
                    );
                })}

                {/* Loading indicator */}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: 'flex', gap: '12px',
                            padding: '12px 0', alignItems: 'flex-start',
                        }}
                    >
                        <div style={{
                            width: '30px', height: '30px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #a78bfa22, #6366f122)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <img
                                src="/logo_2_backup.png" alt="Feelivate"
                                style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ paddingTop: '10px' }}>
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
        .replace(/`(.*?)`/g, '<code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>')
        // Line breaks
        .replace(/\n/g, '<br/>');
    return html;
}
