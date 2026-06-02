import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageSquare, BookOpen, Clock, X } from 'lucide-react';
import { getUserSessions } from '../../api';
import type { SessionPreview } from '../../api';
import StreakBar from './StreakBar';

interface FloatingDockProps {
    userId: string;
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    onJourney: () => void;
    refreshKey: number;
    isPlanActive: boolean;
}

export default function FloatingDock({
    userId,
    activeSessionId,
    onSelectSession,
    onNewChat,
    onJourney,
    refreshKey,
    isPlanActive,
}: FloatingDockProps) {
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        getUserSessions(userId)
            .then(data => setSessions(data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [userId, refreshKey]);

    const handleSelectSession = (sessionId: string) => {
        onSelectSession(sessionId);
        setShowHistory(false);
    };

    return (
        <>
            {/* Backdrop when history is open */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={() => setShowHistory(false)}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'rgba(0,0,0,0.3)',
                            zIndex: 99,
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Session History Popover */}
            <AnimatePresence>
                {showHistory && (
                    <motion.div
                        className="session-popover"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="session-popover-header">
                            <span style={{
                                fontSize: '11px', fontWeight: 700, color: '#55556a',
                                letterSpacing: '0.06em', textTransform: 'uppercase',
                            }}>
                                Recent Sessions
                            </span>
                            <button
                                onClick={() => setShowHistory(false)}
                                style={{
                                    width: '24px', height: '24px', borderRadius: '6px',
                                    border: 'none', background: 'rgba(255,255,255,0.05)',
                                    color: '#55556a', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#9d9daa'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#55556a'; }}
                            >
                                <X size={12} />
                            </button>
                        </div>

                        <div className="session-popover-list">
                            {loading ? (
                                <div style={{ padding: '16px', color: '#55556a', fontSize: '12px', textAlign: 'center' }}>
                                    Loading...
                                </div>
                            ) : sessions.length === 0 ? (
                                <div style={{ padding: '16px', color: '#55556a', fontSize: '12px', textAlign: 'center' }}>
                                    No conversations yet
                                </div>
                            ) : (
                                sessions.map((session) => (
                                    <button
                                        key={session.id}
                                        onClick={() => handleSelectSession(session.id)}
                                        className={`session-item ${session.id === activeSessionId ? 'active' : ''}`}
                                    >
                                        <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.4 }} />
                                        <span style={{
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            flex: 1,
                                        }}>
                                            {session.focus_preview}
                                        </span>
                                        {session.phase === 'active' && (
                                            <div style={{
                                                width: '5px', height: '5px', borderRadius: '50%',
                                                background: '#4ade80', flexShrink: 0,
                                            }} />
                                        )}
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Streak section inside popover */}
                        {isPlanActive && (
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <StreakBar userId={userId} isPlanActive={isPlanActive} />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Floating Dock ─────────────────────────────────────────── */}
            <motion.div
                className="floating-dock"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
                {/* New Chat */}
                <button
                    className="dock-btn"
                    onClick={onNewChat}
                    title="New Chat"
                >
                    <Plus size={16} />
                    <span className="hide-on-mobile">New</span>
                </button>

                {/* History */}
                <button
                    className={`dock-btn ${showHistory ? 'active' : ''}`}
                    onClick={() => setShowHistory(!showHistory)}
                    title="Chat History"
                >
                    <Clock size={16} />
                    <span className="hide-on-mobile">History</span>
                    {sessions.length > 0 && (
                        <span style={{
                            fontSize: '10px', fontWeight: 700,
                            background: 'rgba(167,139,250,0.15)',
                            color: '#a78bfa',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            lineHeight: 1.4,
                        }}>
                            {sessions.length}
                        </span>
                    )}
                </button>

                {/* Journey — only when plan is active */}
                {isPlanActive && (
                    <>
                        <div className="dock-divider" />
                        <button
                            className="dock-btn"
                            onClick={onJourney}
                            title="My Journey"
                        >
                            <BookOpen size={16} />
                            <span className="hide-on-mobile">Journey</span>
                        </button>
                    </>
                )}
            </motion.div>
        </>
    );
}
