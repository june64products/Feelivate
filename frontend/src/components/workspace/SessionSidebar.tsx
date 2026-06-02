import { useState, useEffect } from 'react';
import { Plus, MessageSquare, BookOpen, Clock, PanelLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

/* ── Reusable nav item ────────────────────────────── */
function NavItem({
    icon, label, onClick, isActive = false, isCollapsed = false, badge,
}: {
    icon: React.ReactNode;
    label: string;
    onClick?: () => void;
    isActive?: boolean;
    isCollapsed?: boolean;
    badge?: string;
}) {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            title={isCollapsed ? label : undefined}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: isCollapsed ? '9px 0' : '9px 12px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                borderRadius: '9px',
                border: 'none',
                background: isActive
                    ? 'var(--accent-faint)'
                    : hovered ? 'var(--bg-hover)' : 'transparent',
                color: isActive ? 'var(--accent)' : hovered ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '13.5px',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.15s',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                position: 'relative',
            }}
        >
            {/* Active bullet */}
            {isActive && !isCollapsed && (
                <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 16,
                    background: 'var(--accent)',
                    borderRadius: '0 3px 3px 0',
                }} />
            )}

            <span style={{ color: isActive ? 'var(--accent)' : hovered ? 'var(--text-secondary)' : 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
                {icon}
            </span>

            {!isCollapsed && (
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                </span>
            )}

            {!isCollapsed && badge && (
                <span style={{
                    fontSize: '10px', fontWeight: 700,
                    background: 'var(--accent-faint-md)',
                    color: 'var(--accent)',
                    padding: '1px 7px',
                    borderRadius: '999px',
                }}>
                    {badge}
                </span>
            )}
        </button>
    );
}

/* ── Logo mark ────────────────────────────────────── */
function Logo() {
    return (
        <div style={{
            width: 26, height: 26,
            background: 'var(--bg-page)',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            border: '1px solid var(--border-subtle)',
        }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: 17, height: 17, objectFit: 'contain' }} />
        </div>
    );
}

/* ── Main Component ────────────────────────────────── */
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
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [userId, refreshKey]);

    /* ── Collapsed rail ── */
    if (isCollapsed) {
        return (
            <motion.div
                initial={{ width: 240 }}
                animate={{ width: 52 }}
                transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    width: 52,
                    height: '100vh',
                    background: 'var(--bg-sidebar)',
                    borderRight: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: 72, // below topbar
                    paddingBottom: 16,
                    gap: 4,
                    flexShrink: 0,
                    overflowX: 'hidden',
                }}
            >
                {/* Expand button */}
                <button
                    onClick={onToggleCollapse}
                    title="Expand sidebar"
                    style={{
                        width: 36, height: 36,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '9px', border: 'none',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', marginBottom: 8, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <Logo />
                </button>

                {[
                    { icon: <Plus size={17} />, label: 'New Chat', action: onNewChat },
                    { icon: <Clock size={17} />, label: 'History', action: undefined },
                    ...(isPlanActive ? [{ icon: <BookOpen size={17} />, label: 'My Journey', action: onJourney }] : []),
                ].map(item => (
                    <button
                        key={item.label}
                        onClick={item.action}
                        title={item.label}
                        style={{
                            width: 36, height: 36,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: '9px', border: 'none',
                            background: 'transparent', color: 'var(--text-muted)',
                            cursor: item.action ? 'pointer' : 'default',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        {item.icon}
                    </button>
                ))}
            </motion.div>
        );
    }

    /* ── Expanded sidebar ── */
    return (
        <motion.div
            initial={{ width: 52 }}
            animate={{ width: 240 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            style={{
                width: 240,
                height: '100vh',
                background: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden',
                fontFamily: 'var(--font-sans)',
            }}
        >
            {/* Header: Logo + brand + collapse */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 14px 10px',
                flexShrink: 0,
                paddingTop: 68, // below topbar
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Logo />
                    <motion.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.06, duration: 0.2 }}
                        style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
                    >
                        Feelivate
                    </motion.span>
                </div>
                <button
                    onClick={onToggleCollapse}
                    title="Collapse sidebar"
                    style={{
                        width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '7px', border: 'none',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <PanelLeft size={15} />
                </button>
            </div>

            {/* Nav items */}
            <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                {[
                    { icon: <Plus size={16} />, label: 'New Chat', action: onNewChat },
                    { icon: <Clock size={16} />, label: 'History', action: undefined },
                    ...(isPlanActive ? [{ icon: <BookOpen size={16} />, label: 'My Journey', action: onJourney }] : []),
                ].map((item, i) => (
                    <motion.div
                        key={item.label}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 + i * 0.04, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <NavItem
                            icon={item.icon}
                            label={item.label}
                            onClick={item.action}
                        />
                    </motion.div>
                ))}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '10px 14px' }} />

            {/* Session list */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: '0 8px 8px',
            }}>
                {sessions.length > 0 && (
                    <div style={{
                        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                        padding: '0 10px 8px',
                        letterSpacing: '0.07em', textTransform: 'uppercase',
                    }}>
                        Recent
                    </div>
                )}

                {loading ? (
                    <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading...</div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>No conversations yet</div>
                ) : (
                    <AnimatePresence>
                        {sessions.map((session, i) => {
                            const isActive = session.id === activeSessionId;
                            return (
                                <motion.button
                                    key={session.id}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03, duration: 0.2 }}
                                    onClick={() => onSelectSession(session.id)}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 10px', borderRadius: '9px', border: 'none',
                                        background: isActive ? 'var(--accent-faint)' : 'transparent',
                                        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                        cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                                        fontFamily: 'var(--font-sans)',
                                        transition: 'all 0.12s', marginBottom: 1,
                                        fontWeight: isActive ? 500 : 400,
                                    }}
                                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                                >
                                    <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.5 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '13px' }}>
                                        {session.focus_preview}
                                    </span>
                                    {isActive && (
                                        <ChevronRight size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
                                    )}
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* Streak section */}
            <StreakBar userId={userId} isPlanActive={isPlanActive} />
        </motion.div>
    );
}
