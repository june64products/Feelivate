import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Target, ChevronDown, Plus, Flame, Shield, Bell, Calendar,
    Archive, Check, StopCircle,
} from 'lucide-react';
import { getUserSessions, type SessionPreview, type StreakData } from '../../api';
import ProfileMenu from '../workspace/ProfileMenu';
import { clashDisplay, satoshi, FLAME_FROM, FLAME_TO, easeSilk } from './missionTheme';

interface MissionTopBarProps {
    userId: string | null;
    activeSessionId: string | null;
    sessionFocus: string;
    currentWeek: number;
    streak: StreakData | null;
    isPlanActive: boolean;
    demoMode: boolean;
    /** Bumps when the session list should re-fetch (same key the sidebar used). */
    refreshKey: number;
    onSelectSession: (id: string) => void;
    onNewGoal: () => void;
    onOpenArchive: () => void;
    onOpenAlerts: () => void;
    onOpenCalendar: () => void;
    onOpenPlanInfo: () => void;
    onStopSession: () => void;
    onLogout: () => void;
}

/**
 * The workspace header. Replaces the old left sidebar entirely: the goal pill
 * carries session switching / new goal / stop goal, and the streak cluster
 * keeps the flame + shield bank visible on every screen.
 */
export default function MissionTopBar({
    userId, activeSessionId, sessionFocus, currentWeek, streak, isPlanActive,
    demoMode, refreshKey, onSelectSession, onNewGoal, onOpenArchive,
    onOpenAlerts, onOpenCalendar, onOpenPlanInfo, onStopSession, onLogout,
}: MissionTopBarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!userId || demoMode) return;
        getUserSessions(userId).then(setSessions).catch(() => { });
    }, [userId, refreshKey, demoMode, activeSessionId]);

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const goalLabel = (() => {
        const active = sessions.find(s => s.id === activeSessionId);
        const raw = active?.title || sessionFocus || active?.focus_preview || 'New goal';
        return raw.length > 26 ? `${raw.slice(0, 26)}…` : raw;
    })();

    const currentStreak = streak?.current_streak ?? 0;
    const shields = streak?.shields_left;
    const flameActive = currentStreak > 0;

    const iconBtn: React.CSSProperties = {
        width: '34px', height: '34px', borderRadius: '10px',
        border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
    };

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 16px', flexShrink: 0, position: 'relative', zIndex: 60,
        }}>
            {/* ── Goal pill + dropdown (the sidebar's replacement) ── */}
            <div ref={menuRef} style={{ position: 'relative' }}>
                <motion.button
                    data-tour="goal-pill"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMenuOpen(o => !o)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '8px 14px', borderRadius: '100px',
                        border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
                        color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: satoshi, maxWidth: '260px',
                    }}
                >
                    <Target size={15} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {goalLabel}{isPlanActive && currentWeek > 0 ? ` · Week ${currentWeek}` : ''}
                    </span>
                    <ChevronDown size={14} style={{
                        color: 'var(--text-muted)', flexShrink: 0,
                        transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                    }} />
                </motion.button>

                <AnimatePresence>
                    {menuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                            transition={{ duration: 0.18, ease: easeSilk as any }}
                            style={{
                                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                                width: '300px', maxHeight: '380px', overflowY: 'auto',
                                background: 'var(--bg-surface)', border: '1px solid var(--modal-border)',
                                borderRadius: '16px', boxShadow: 'var(--shadow-lg)',
                                padding: '8px', zIndex: 100,
                            }}
                        >
                            <button
                                onClick={() => { setMenuOpen(false); onNewGoal(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                    padding: '10px 12px', borderRadius: '10px', border: 'none',
                                    background: 'transparent', color: 'var(--text-primary)',
                                    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                                    fontFamily: satoshi, textAlign: 'left',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <Plus size={15} style={{ color: 'var(--accent-primary)' }} />
                                Start a new goal
                            </button>

                            {sessions.length > 0 && (
                                <div style={{
                                    padding: '8px 12px 4px', fontSize: '10.5px', fontWeight: 700,
                                    letterSpacing: '0.1em', textTransform: 'uppercase',
                                    color: 'var(--text-muted)', fontFamily: satoshi,
                                }}>
                                    Your goals
                                </div>
                            )}
                            {sessions.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => { setMenuOpen(false); onSelectSession(s.id); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                        padding: '9px 12px', borderRadius: '10px', border: 'none',
                                        background: s.id === activeSessionId ? 'var(--glass-hover)' : 'transparent',
                                        color: 'var(--text-primary)', fontSize: '13px', cursor: 'pointer',
                                        fontFamily: satoshi, textAlign: 'left',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = s.id === activeSessionId ? 'var(--glass-hover)' : 'transparent'; }}
                                >
                                    {s.id === activeSessionId
                                        ? <Check size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                        : <span style={{ width: '14px', flexShrink: 0 }} />}
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.title || s.focus_preview || 'Untitled goal'}
                                    </span>
                                    {s.phase === 'active' && (
                                        <span style={{
                                            fontSize: '10px', fontWeight: 700, color: 'var(--accent-primary)',
                                            flexShrink: 0,
                                        }}>W{s.current_week}</span>
                                    )}
                                </button>
                            ))}

                            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 4px' }} />
                            <button
                                onClick={() => { setMenuOpen(false); onOpenArchive(); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                    padding: '9px 12px', borderRadius: '10px', border: 'none',
                                    background: 'transparent', color: 'var(--text-secondary)',
                                    fontSize: '13px', cursor: 'pointer', fontFamily: satoshi, textAlign: 'left',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <Archive size={14} />
                                Report archive
                            </button>
                            {activeSessionId && isPlanActive && (
                                <button
                                    onClick={() => { setMenuOpen(false); onStopSession(); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                                        padding: '9px 12px', borderRadius: '10px', border: 'none',
                                        background: 'transparent', color: 'var(--accent-warm, #d97757)',
                                        fontSize: '13px', cursor: 'pointer', fontFamily: satoshi, textAlign: 'left',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <StopCircle size={14} />
                                    Finish this goal
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div style={{ flex: 1 }} />

            {/* ── Streak cluster — always visible, on every screen ── */}
            {isPlanActive && (
                <motion.div
                    data-tour="streak"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 12px', borderRadius: '100px',
                        border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                    }}
                    title={`${currentStreak}-day streak · best ${streak?.longest_streak ?? 0}`}
                >
                    <motion.span
                        animate={flameActive ? { scale: [1, 1.15, 1] } : {}}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ display: 'flex' }}
                    >
                        <Flame size={15} style={{ color: flameActive ? FLAME_TO : 'var(--text-muted)' }}
                            fill={flameActive ? FLAME_FROM : 'none'} />
                    </motion.span>
                    <span style={{
                        fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)',
                        fontFamily: clashDisplay,
                    }}>{currentStreak}</span>
                    {typeof shields === 'number' && (
                        <>
                            <span style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />
                            <span
                                title="Streak shields — every 7-day run earns one (max 2)"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                                <Shield size={13} style={{ color: 'var(--accent-primary)' }} />
                                <span style={{
                                    fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)',
                                    fontFamily: satoshi,
                                }}>{shields}</span>
                            </span>
                        </>
                    )}
                </motion.div>
            )}

            {/* ── Utilities ── */}
            <button data-tour="alerts-button" title="Daily email alerts" onClick={onOpenAlerts} style={iconBtn}>
                <Bell size={15} />
            </button>
            <button title="Google Calendar sync" onClick={onOpenCalendar} style={iconBtn}>
                <Calendar size={15} />
            </button>
            <button
                onClick={onOpenPlanInfo}
                style={{
                    padding: '8px 14px', borderRadius: '100px', border: 'none',
                    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                    fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                    fontFamily: satoshi, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
                className="hide-on-mobile"
            >
                Upgrade
            </button>
            <ProfileMenu onLogout={onLogout} />
        </div>
    );
}
