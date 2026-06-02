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

/* ── Avatar ──────────────────────────────────── */
function Avatar({ role }: { role: string }) {
    const isUser = role === 'user';
    const name = isUser
        ? (localStorage.getItem('user_name') || 'U')
        : 'F';
    const initials = isUser
        ? (() => {
              const parts = name.trim().split(/\s+/);
              return (parts[0]?.[0] ?? 'U').toUpperCase();
          })()
        : null;

    return (
        <div style={{
            width: 28,
            height: 28,
            borderRadius: isUser ? '50%' : '9px',
            background: isUser
                ? 'var(--accent)'
                : 'var(--bg-feature)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
            boxShadow: isUser ? 'none' : '0 2px 8px rgba(124,110,248,0.25)',
        }}>
            {isUser ? (
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>
                    {initials}
                </span>
            ) : (
                <img
                    src="/logo_2_backup.png"
                    alt="Feelivate"
                    style={{ width: 17, height: 17, objectFit: 'contain', borderRadius: 4 }}
                />
            )}
        </div>
    );
}

/* ── Message bubble ──────────────────────────── */
function MessageBubble({ msg }: { msg: Message }) {
    const isUser = msg.role === 'user';

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                gap: 10,
                padding: '6px 0',
                alignItems: 'flex-start',
            }}
        >
            {/* Avatar */}
            <Avatar role={msg.role} />

            {/* Bubble + label */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                maxWidth: '78%',
                alignItems: isUser ? 'flex-end' : 'flex-start',
            }}>
                {/* Sender label */}
                <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: 'var(--text-muted)',
                    letterSpacing: '0.01em',
                    paddingLeft: isUser ? 0 : 4,
                    paddingRight: isUser ? 4 : 0,
                }}>
                    {isUser ? 'You' : 'Feelivate'}
                </span>

                {/* The bubble */}
                <div
                    className={isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}
                    style={{
                        // Override border-radius for context:
                        borderRadius: isUser
                            ? '18px 18px 4px 18px'
                            : '4px 18px 18px 18px',
                    }}
                    dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                />
            </div>
        </motion.div>
    );
}

/* ── Loading indicator ───────────────────────── */
function LoadingBubble() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start' }}
        >
            <Avatar role="assistant" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', paddingLeft: 4 }}>
                    Feelivate
                </span>
                <div className="chat-bubble-ai" style={{ borderRadius: '4px 18px 18px 18px', padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                        <div className="loading-dot" />
                        <div className="loading-dot" />
                        <div className="loading-dot" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/* ── Suggestion chips ────────────────────────── */
const SUGGESTIONS = [
    "🏋️ I want to get fit",
    "💻 Help me learn coding",
    "📚 Exam prep plan",
    "🎸 Learn guitar",
];

/* ── Main component ──────────────────────────── */
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

    /* ── Empty state ── */
    if (messages.length === 0 && !isLoading) {
        return (
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                gap: '16px',
            }}>
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        width: 58, height: 58,
                        background: 'var(--bg-surface)',
                        borderRadius: '16px',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 4px 24px rgba(124,110,248,0.15)',
                    }}
                >
                    <img
                        src="/logo_2_backup.png"
                        alt="Feelivate"
                        style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }}
                    />
                </motion.div>

                {/* Heading */}
                <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        fontSize: '22px', fontWeight: 700,
                        color: 'var(--text-primary)',
                        textAlign: 'center',
                        letterSpacing: '-0.02em', margin: 0,
                    }}
                >
                    What can I help you plan?
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.18, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        fontSize: '14px', color: 'var(--text-muted)',
                        textAlign: 'center', maxWidth: '380px', lineHeight: 1.55, margin: 0,
                    }}
                >
                    Tell me your goal — fitness, coding, studying, music, anything.
                    I'll build you a personalized week plan.
                </motion.p>

                {/* Chips */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.26, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        display: 'flex', flexWrap: 'wrap', gap: 8,
                        justifyContent: 'center', marginTop: 8,
                    }}
                >
                    {SUGGESTIONS.map((suggestion, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 + idx * 0.06 }}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '999px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-secondary)',
                                fontSize: '13px',
                                cursor: 'default',
                                boxShadow: 'var(--shadow-card)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {suggestion}
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        );
    }

    /* ── Messages list ── */
    return (
        <div
            ref={containerRef}
            style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 0 8px',
            }}
        >
            <div style={{
                maxWidth: 'var(--chat-max-width)',
                margin: '0 auto',
                padding: '0 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
            }}>
                {messages.map((msg, idx) => (
                    <div key={idx}>
                        <MessageBubble msg={msg} />

                        {/* Plan card after AI message with plan */}
                        {msg.plan && !isPlanApproved && (
                            <div style={{ paddingLeft: 38, paddingTop: 4 }}>
                                <PlanCard
                                    plan={msg.plan}
                                    onApprove={onApprovePlan}
                                    onRequestChange={onRequestPlanChange}
                                    isApproved={false}
                                />
                            </div>
                        )}

                        {/* Approved plan pill (most recent plan) */}
                        {msg.plan && isPlanApproved && idx === messages.length - 1 && (
                            <div style={{ paddingLeft: 38, paddingTop: 4 }}>
                                <PlanCard
                                    plan={msg.plan}
                                    onApprove={onApprovePlan}
                                    onRequestChange={onRequestPlanChange}
                                    isApproved={true}
                                />
                            </div>
                        )}
                    </div>
                ))}

                {/* Loading bubble */}
                {isLoading && <LoadingBubble />}

                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}

/* ── Simple markdown formatter (preserved exactly) ── */
function formatMarkdown(text: string): string {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code style="background:var(--bg-raised);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;">$1</code>')
        .replace(/\n/g, '<br/>');
}
