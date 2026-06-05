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
            width: '26px', height: '26px',
            background: '#fff',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
        }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '17px', height: '17px', objectFit: 'contain' }} />
        </div>
    );

    const iconBtnBase: React.CSSProperties = {
        width: '36px', height: '36px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '9px', border: 'none',
        background: 'transparent', color: '#71717a',
        cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
    };

    // Collapsed sidebar
    if (isCollapsed) {
        return (
            <div style={{
                width: '52px',
                height: '100vh',
                background: '#0a0a0a',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '14px 0',
                gap: '4px',
                flexShrink: 0,
            }}>
                {/* Logo — click to expand */}
                <button
                    onClick={onToggleCollapse}
                    title="Expand sidebar"
                    style={{ ...iconBtnBase, marginBottom: '10px' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <Logo />
                </button>

                {/* New Chat */}
                <button
                    onClick={onNewChat}
                    title="New Chat"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}
                >
                    <Plus size={18} />
                </button>

                {/* History */}
                <button
                    title="History"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}
                >
                    <Clock size={18} />
                </button>

                {/* My Journey — only when plan is active */}
                {isPlanActive && (
                    <button
                        onClick={onJourney}
                        title="My Journey"
                        style={iconBtnBase}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}
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
            background: '#0a0a0a',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
            transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
            {/* Header: Logo + FEELIVATE + Collapse */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 14px 10px',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Logo />
                    <span style={{
                        fontWeight: 700, fontSize: '15px', color: '#f0f0f0',
                        letterSpacing: '-0.02em', fontFamily: "'Inter', sans-serif",
                    }}>
                        FEELIVATE
                    </span>
                </div>
                <button
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}
                >
                    <PanelLeft size={16} />
                </button>
            </div>

            {/* Nav items */}
            <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                <NavItem icon={<Plus size={16} />} label="New" onClick={onNewChat} />
                <NavItem icon={<Clock size={16} />} label="History" />
                {isPlanActive && (
                    <NavItem icon={<BookOpen size={16} />} label="My Journey" onClick={onJourney} />
                )}
            </div>

            {/* Session list */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: '12px 10px 8px',
                marginTop: '8px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
                {sessions.length > 0 && (
                    <div style={{
                        fontSize: '10.5px', fontWeight: 600, color: '#3f3f46',
                        padding: '0 8px 8px',
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>
                        Recent
                    </div>
                )}
                {loading ? (
                    <div style={{ padding: '10px 8px', color: '#3f3f46', fontSize: '12px' }}>
                        Loading...
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '10px 8px', color: '#3f3f46', fontSize: '12px' }}>
                        No conversations yet
                    </div>
                ) : (
                    sessions.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 10px', borderRadius: '8px', border: 'none',
                                background: session.id === activeSessionId
                                    ? 'rgba(255,255,255,0.07)'
                                    : 'transparent',
                                color: session.id === activeSessionId ? '#e4e4e7' : '#71717a',
                                cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                                transition: 'all 0.12s', marginBottom: '1px',
                                fontFamily: "'Inter', sans-serif",
                            }}
                            onMouseEnter={e => {
                                if (session.id !== activeSessionId)
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                e.currentTarget.style.color = '#a1a1aa';
                            }}
                            onMouseLeave={e => {
                                if (session.id !== activeSessionId)
                                    e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#71717a';
                            }}
                        >
                            <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
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
    icon, label, onClick,
}: { icon: React.ReactNode; label: string; onClick?: () => void }) {
    const [hovered, setHovered] = useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '9px 10px', borderRadius: '8px', border: 'none',
                background: hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: hovered ? '#e4e4e7' : '#a1a1aa',
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '13.5px', fontWeight: 500,
                transition: 'all 0.12s', textAlign: 'left',
                fontFamily: "'Inter', sans-serif",
            }}
        >
            <span style={{ color: hovered ? '#a1a1aa' : '#52525b', transition: 'color 0.12s', flexShrink: 0 }}>
                {icon}
            </span>
            {label}
        </button>
    );
}
