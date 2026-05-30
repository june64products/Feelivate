import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, LogOut, PanelLeftClose, PanelLeft, BookOpen } from 'lucide-react';
import { getUserSessions } from '../../api';
import type { SessionPreview } from '../../api';
import StreakBar from './StreakBar';


interface SessionSidebarProps {
    userId: string;
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    onLogout: () => void;
    onJourney: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    refreshKey: number;
    isPlanActive: boolean;
}

export default function SessionSidebar({
    userId,
    activeSessionId,
    onSelectSession,
    onNewChat,
    onLogout,
    onJourney,
    isCollapsed,
    onToggleCollapse,
    refreshKey,
    isPlanActive,
}: SessionSidebarProps) {
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const [loading, setLoading] = useState(true);
    const userName = localStorage.getItem('user_name') || 'User';

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                setLoading(true);
                const data = await getUserSessions(userId);
                setSessions(data);
            } catch (err) {
                console.error('Failed to load sessions:', err);
            } finally {
                setLoading(false);
            }
        };
        if (userId) fetchSessions();
    }, [userId, refreshKey]);

    if (isCollapsed) {
        return (
            <div style={{
                width: '50px',
                height: '100vh',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '12px',
                gap: '8px',
                flexShrink: 0,
            }}>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        border: 'none', background: 'transparent',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                >
                    <PanelLeft size={18} />
                </button>
                <button
                    onClick={onNewChat}
                    style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        background: 'transparent',
                        color: 'var(--text-secondary)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                >
                    <Plus size={16} />
                </button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
                width: 'var(--sidebar-width)',
                height: '100vh',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        border: 'none', background: 'transparent',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                >
                    <PanelLeftClose size={18} />
                </button>
                <button
                    onClick={onNewChat}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-medium)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-sans)',
                    }}
                >
                    <Plus size={16} />
                    New chat
                </button>
            </div>

            {/* Session list */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '4px 8px',
            }}>
                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        Loading...
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                        No conversations yet
                    </div>
                ) : (
                    sessions.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 12px',
                                borderRadius: '10px',
                                border: 'none',
                                background: session.id === activeSessionId
                                    ? 'var(--glass-hover)'
                                    : 'transparent',
                                color: session.id === activeSessionId
                                    ? 'var(--text-primary)'
                                    : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontFamily: 'var(--font-sans)',
                                textAlign: 'left',
                                transition: 'all 0.15s',
                                marginBottom: '2px',
                            }}
                        >
                            <MessageSquare size={14} style={{ flexShrink: 0, opacity: 0.5 }} />
                            <span style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {session.focus_preview}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* Streak bar — shows only when plan is active */}
            <StreakBar
                userId={userId}
                sessionId={activeSessionId}
                isPlanActive={isPlanActive}
            />

            {/* Journey link — only visible when session has an active plan */}
            {isPlanActive && (
                <div style={{ padding: '8px 8px 0' }}>
                    <button
                        onClick={onJourney}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 12px',
                            borderRadius: '10px',
                            border: '1px solid rgba(99,102,241,0.25)',
                            background: 'rgba(99,102,241,0.06)',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            textAlign: 'left',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(99,102,241,0.14)';
                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(99,102,241,0.06)';
                            e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                        }}
                    >
                        <BookOpen size={13} style={{ flexShrink: 0 }} />
                        My Journey
                    </button>
                </div>
            )}


            {/* User section at bottom */}
            <div style={{
                padding: '12px',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, color: 'white',
                        flexShrink: 0,
                    }}>
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <span style={{
                        flex: 1, fontSize: '13px', color: 'var(--text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {userName}
                    </span>
                    <button
                        onClick={onLogout}
                        style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            border: 'none', background: 'transparent',
                            color: 'var(--text-muted)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                    >
                        <LogOut size={14} />
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
