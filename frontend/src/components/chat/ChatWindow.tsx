import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import PlanCard from './PlanCard';

const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

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
                >
                    <img
                        src="/logo_2_backup.png"
                        alt="Feelivate"
                        style={{
                            width: '56px',
                            height: '56px',
                            objectFit: 'contain',
                            borderRadius: '16px',
                        }}
                    />
                </motion.div>
                <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.4 }}
                    style={{
                        fontSize: '28px',
                        fontWeight: 700,
                        color: '#111111',
                        textAlign: 'center',
                        fontFamily: clashDisplay,
                        letterSpacing: '-0.03em',
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
                        color: '#838282',
                        textAlign: 'center',
                        maxWidth: '420px',
                        fontFamily: satoshi,
                        lineHeight: 1.6,
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
                        "I want to get fit",
                        "Help me learn coding",
                        "Exam prep plan",
                        "Learn guitar",
                    ].map((suggestion, idx) => (
                        <div
                            key={idx}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '100px',
                                border: '1px solid rgba(30,30,30,0.1)',
                                background: '#ffffff',
                                color: '#838282',
                                fontSize: '12px',
                                fontWeight: 500,
                                fontFamily: satoshi,
                                cursor: 'default',
                                transition: 'all 0.2s',
                                letterSpacing: '0.02em',
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
                                gap: '14px',
                                padding: '18px 0',
                                alignItems: 'flex-start',
                                borderBottom: idx < messages.length - 1
                                    ? '1px solid rgba(30,30,30,0.04)'
                                    : 'none',
                            }}
                        >
                            {/* Avatar */}
                            <div
                                style={{
                                    width: '30px',
                                    height: '30px',
                                    borderRadius: msg.role === 'user' ? '50%' : '8px',
                                    background: msg.role === 'user'
                                        ? '#d97757'
                                        : '#111111',
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
                                    <img
                                        src="/logo_2_backup.png"
                                        alt="Feelivate"
                                        style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '4px', filter: 'invert(1)' }}
                                    />
                                )}
                            </div>

                            {/* Content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: '#b6b5b5',
                                    marginBottom: '6px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    fontFamily: clashDisplay,
                                }}>
                                    {msg.role === 'user' ? 'You' : 'Feelivate'}
                                </div>
                                <div
                                    style={{
                                        fontSize: '14px',
                                        color: '#111111',
                                        lineHeight: '1.7',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontFamily: satoshi,
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
                            gap: '14px',
                            padding: '18px 0',
                            alignItems: 'flex-start',
                        }}
                    >
                        <div style={{
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: '#111111',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <img
                                src="/logo_2_backup.png"
                                alt="Feelivate"
                                style={{ width: '18px', height: '18px', objectFit: 'contain', borderRadius: '4px', filter: 'invert(1)' }}
                            />
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
        .replace(/`(.*?)`/g, '<code style="background:rgba(30,30,30,0.04);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:12px;color:#111111;">$1</code>')
        // Line breaks
        .replace(/\n/g, '<br/>');
    return html;
}
