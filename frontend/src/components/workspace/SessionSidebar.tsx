import { useState, useEffect } from 'react';
import { Plus, MessageSquare, BookOpen, Clock, PanelLeft } from 'lucide-react';
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
        if (!userId) return;
        setLoading(true);
        getUserSessions(userId)
            .then(data => setSessions(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [userId, refreshKey]);

    const Logo = () => (
        <div style={{
            width: '38px', height: '38px',
            background: 'linear-gradient(135deg, #8b5cf6, #8455ef)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 4px 12px rgba(139,92,246,0.35)',
        }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(10)' }} />
        </div>
    );

    const iconBtnBase: React.CSSProperties = {
        width: '40px', height: '40px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '12px', border: 'none',
        background: 'transparent', color: 'var(--text-secondary)',
        cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
    };

    // Collapsed sidebar
    if (isCollapsed) {
        return (
            <div style={{
                width: '72px',
                height: '100vh',
                background: 'rgba(255,255,255,0.4)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                borderRight: '1px solid rgba(203,195,215,0.35)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '20px 0',
                gap: '6px',
                flexShrink: 0,
                boxShadow: '4px 0 24px rgba(139,92,246,0.05)',
            }}>
                {/* Logo — click to expand */}
                <button
                    onClick={onToggleCollapse}
                    title="Expand sidebar"
                    style={{ ...iconBtnBase, marginBottom: '12px', width: '44px', height: '44px' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <Logo />
                </button>

                {/* New Chat */}
                <button
                    onClick={onNewChat}
                    title="New Chat"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.color = '#8b5cf6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <Plus size={18} />
                </button>

                {/* History */}
                <button
                    title="History"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.color = '#8b5cf6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <Clock size={18} />
                </button>

                {/* My Journey — only when plan is active */}
                {isPlanActive && (
                    <button
                        onClick={onJourney}
                        title="My Journey"
                        style={iconBtnBase}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.color = '#8b5cf6'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <BookOpen size={18} />
                    </button>
                )}
            </div>
        );
    }

    // Expanded sidebar
    return (
        <div style={{
            width: '260px',
            height: '100vh',
            background: 'rgba(255,255,255,0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(203,195,215,0.35)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
            fontFamily: "var(--font-sans)",
            transition: 'width 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '4px 0 24px rgba(139,92,246,0.06)',
        }}>
            {/* Header: Logo + FEELIVATE + Collapse */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 16px 14px',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Logo />
                    <div>
                        <span style={{
                            fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)',
                            letterSpacing: '-0.025em', fontFamily: "var(--font-sans)",
                            lineHeight: 1,
                        }}>
                            Feelivate
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-label)', marginTop: '2px' }}>
                            Your AI Mentor
                        </div>
                    </div>
                </div>
                <button
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.07)'; e.currentTarget.style.color = '#8b5cf6'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                >
                    <PanelLeft size={16} />
                </button>
            </div>

            {/* Nav items */}
            <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                <NavItem icon={<Plus size={16} />} label="New Chat" onClick={onNewChat} />
                <NavItem icon={<Clock size={16} />} label="History" />
                {isPlanActive && (
                    <NavItem icon={<BookOpen size={16} />} label="My Journey" onClick={onJourney} accent />
                )}
            </div>

            {/* Session list */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: '12px 10px 8px',
                marginTop: '8px',
                borderTop: '1px solid rgba(203,195,215,0.3)',
            }}>
                {sessions.length > 0 && (
                    <div style={{
                        fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)',
                        padding: '0 10px 8px',
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        fontFamily: 'var(--font-label)',
                    }}>
                        Recent
                    </div>
                )}
                {loading ? (
                    <div style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-label)' }}>
                        Loading...
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '10px 10px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-label)' }}>
                        No conversations yet
                    </div>
                ) : (
                    sessions.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 10px', borderRadius: '10px', border: 'none',
                                background: session.id === activeSessionId
                                    ? 'rgba(255,255,255,0.85)'
                                    : 'transparent',
                                color: session.id === activeSessionId ? '#8b5cf6' : 'var(--text-secondary)',
                                fontWeight: session.id === activeSessionId ? 600 : 400,
                                cursor: 'pointer', fontSize: '13.5px', textAlign: 'left',
                                transition: 'all 0.15s', marginBottom: '2px',
                                fontFamily: "var(--font-sans)",
                                boxShadow: session.id === activeSessionId ? '0 2px 8px rgba(139,92,246,0.1)' : 'none',
                            }}
                            onMouseEnter={e => {
                                if (session.id !== activeSessionId) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.6)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (session.id !== activeSessionId) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-secondary)';
                                }
                            }}
                        >
                            <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.6 }} />
                            <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                flex: 1, fontSize: '13px',
                            }}>
                                {session.focus_preview}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* Streak section at bottom */}
            <StreakBar userId={userId} isPlanActive={isPlanActive} />
        </div>
    );
}

/* Reusable nav item */
function NavItem({
    icon, label, onClick, accent,
}: { icon: React.ReactNode; label: string; onClick?: () => void; accent?: boolean }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 12px', borderRadius: '12px', border: 'none',
                background: hovered
                    ? accent ? 'rgba(139,92,246,0.08)' : 'rgba(255,255,255,0.7)'
                    : 'transparent',
                color: accent
                    ? hovered ? '#8b5cf6' : 'var(--color-primary)'
                    : hovered ? 'var(--color-primary)' : 'var(--text-secondary)',
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '14px', fontWeight: 500,
                transition: 'all 0.15s', textAlign: 'left',
                fontFamily: "var(--font-sans)",
            }}
        >
            <span style={{
                color: accent
                    ? '#8b5cf6'
                    : hovered ? 'var(--color-primary)' : 'var(--text-muted)',
                transition: 'color 0.15s', flexShrink: 0,
            }}>
                {icon}
            </span>
            {label}
        </button>
    );
}
