import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquare, PanelLeft, BookOpen, Clock } from 'lucide-react';
import { getUserSessions } from '../../api';
import type { SessionPreview } from '../../api';
import StreakBar from './StreakBar';

interface SessionSidebarProps {
    userId: string;
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
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
    onJourney,
    isCollapsed,
    onToggleCollapse,
    refreshKey,
    isPlanActive,
}: SessionSidebarProps) {
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const [loading, setLoading] = useState(true);

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

    const SidebarLogo = () => (
        <div style={{
            width: '24px', height: '24px',
            background: '#ffffff',
            borderRadius: '6px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
        }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
        </div>
    );

    // Collapsed Mode
    if (isCollapsed) {
        return (
            <div style={{
                width: '60px',
                height: '100vh',
                background: '#09090b', // True black/dark grey
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: '16px',
                paddingBottom: '16px',
                gap: '16px',
                flexShrink: 0,
            }}>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                    title="Expand Sidebar"
                >
                    <SidebarLogo />
                </button>
                
                <div style={{ width: '24px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0' }} />

                <button
                    onClick={onNewChat}
                    style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: 'transparent', border: 'none',
                        color: '#a1a1aa', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
                    title="New Chat"
                >
                    <Plus size={18} />
                </button>

                <button
                    style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: 'transparent', border: 'none',
                        color: '#a1a1aa', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
                    title="History"
                >
                    <Clock size={18} />
                </button>

                {isPlanActive && (
                    <button
                        onClick={onJourney}
                        style={{
                            width: '36px', height: '36px', borderRadius: '8px',
                            background: 'transparent', border: 'none',
                            color: '#a1a1aa', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
                        title="My Journey"
                    >
                        <BookOpen size={18} />
                    </button>
                )}
            </div>
        );
    }

    // Expanded Mode
    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.2 }}
            style={{
                width: '260px',
                height: '100vh',
                background: '#09090b',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden',
                fontFamily: "'Inter', sans-serif"
            }}
        >
            {/* Header: Logo and App Name */}
            <div style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <SidebarLogo />
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff', letterSpacing: '-0.02em' }}>
                        FEELIVATE
                    </span>
                </div>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        border: 'none', background: 'transparent',
                        color: '#a1a1aa', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <PanelLeft size={16} />
                </button>
            </div>

            {/* Main Navigation Actions */}
            <div style={{ padding: '0 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button
                    onClick={onNewChat}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 12px', borderRadius: '8px',
                        background: 'transparent', border: 'none',
                        color: '#e4e4e7', cursor: 'pointer',
                        fontSize: '13.5px', fontWeight: 500,
                        transition: 'all 0.2s', textAlign: 'left',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <Plus size={16} color="#a1a1aa" />
                    New
                </button>

                <div style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none',
                    color: '#e4e4e7', cursor: 'default',
                    fontSize: '13.5px', fontWeight: 500,
                    textAlign: 'left',
                }}>
                    <Clock size={16} color="#a1a1aa" />
                    History
                </div>

                {isPlanActive && (
                    <button
                        onClick={onJourney}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 12px', borderRadius: '8px',
                            background: 'transparent', border: 'none',
                            color: '#e4e4e7', cursor: 'pointer',
                            fontSize: '13.5px', fontWeight: 500,
                            transition: 'all 0.2s', textAlign: 'left',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        <BookOpen size={16} color="#a1a1aa" />
                        My Journey
                    </button>
                )}
            </div>

            {/* Session list (History items) */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 12px',
                marginTop: '12px',
                borderTop: '1px solid rgba(255,255,255,0.06)'
            }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#71717a', padding: '0 12px 8px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Recent Sessions
                </div>
                {loading ? (
                    <div style={{ padding: '12px', color: '#71717a', fontSize: '12px' }}>Loading...</div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '12px', color: '#71717a', fontSize: '12px' }}>No conversations yet</div>
                ) : (
                    sessions.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                background: session.id === activeSessionId ? 'rgba(255,255,255,0.08)' : 'transparent',
                                color: session.id === activeSessionId ? '#fff' : '#a1a1aa',
                                cursor: 'pointer',
                                fontSize: '13px',
                                textAlign: 'left',
                                transition: 'all 0.15s',
                                marginBottom: '2px',
                            }}
                            onMouseEnter={e => { if (session.id !== activeSessionId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { if (session.id !== activeSessionId) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <MessageSquare size={14} style={{ flexShrink: 0, opacity: session.id === activeSessionId ? 0.8 : 0.5 }} />
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

        </motion.div>
    );
}
