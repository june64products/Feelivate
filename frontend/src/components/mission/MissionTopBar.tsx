import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown, Plus, Flame, Shield, Bell, Calendar,
    Archive, Check, StopCircle, Layers,
} from 'lucide-react';
import { getUserSessions, type SessionPreview, type StreakData } from '../../api';
import ProfileMenu from '../workspace/ProfileMenu';
import { StreakPanel } from './StreakShowcase';
import { useWindowSize } from '../../hooks/useWindowSize';
import { clashDisplay, satoshi, FLAME_FROM, FLAME_TO, easeSilk } from './missionTheme';

interface MissionTopBarProps {
    userId: string | null;
    activeSessionId: string | null;
    sessionFocus: string;
    currentWeek: number;
    streak: StreakData | null;
    isPlanActive: boolean;
    /** Today already checked in — the panel celebrates instead of nudging. */
    todayDone: boolean;
    /** Local ISO date, for the panel's week dots. */
    todayIso: string;
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
    todayDone, todayIso, demoMode, refreshKey, onSelectSession, onNewGoal, onOpenArchive,
    onOpenAlerts, onOpenCalendar, onOpenPlanInfo, onStopSession, onLogout,
}: MissionTopBarProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [streakOpen, setStreakOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const menuRef = useRef<HTMLDivElement>(null);
    const { isMobile } = useWindowSize();

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
        const cap = isMobile ? 16 : 26;
        return raw.length > cap ? `${raw.slice(0, cap)}…` : raw;
    })();

    const currentStreak = streak?.current_streak ?? 0;
    const shields = streak?.shields_left;
    const flameActive = currentStreak > 0;

    // Labeled utility tile for the mobile second row (icon over a small label).
    const LabeledTile = ({ icon, label, onClick, tour }: { icon: React.ReactNode; label: string; onClick: () => void; tour?: string }) => (
        <button
            data-tour={tour}
            onClick={onClick}
            aria-label={label}
            style={{
                flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: '4px', padding: '9px 6px', borderRadius: '14px',
                border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: satoshi,
            }}
        >
            {icon}
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{label}</span>
        </button>
    );

    // Compact icon-over-label tile for the desktop utility cluster, so each
    // action carries a readable name instead of a bare icon.
    const DeskTile = ({ icon, label, onClick, tour }: { icon: React.ReactNode; label: string; onClick: () => void; tour?: string }) => (
        <button
            data-tour={tour}
            onClick={onClick}
            title={label}
            aria-label={label}
            style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                padding: '6px 13px', borderRadius: '12px', flexShrink: 0,
                border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: satoshi,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; }}
        >
            {icon}
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.03em' }}>{label}</span>
        </button>
    );

    return (
        <div style={{
            display: 'flex', flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '10px' : '8px',
            padding: isMobile ? '10px 12px' : '12px 16px', flexShrink: 0,
            position: 'relative', zIndex: 60,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', width: '100%' }}>
            {/* ── Goal pill + dropdown (the sidebar's replacement) ── */}
            <div ref={menuRef} style={{ position: 'relative' }}>
                <motion.button
                    data-tour="goal-pill"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMenuOpen(o => !o)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px',
                        padding: isMobile ? '7px 11px' : '8px 14px', borderRadius: '100px',
                        border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
                        color: 'var(--text-primary)', fontSize: isMobile ? '12px' : '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: satoshi, maxWidth: isMobile ? '160px' : '260px',
                        minWidth: 0,
                    }}
                >
                    <span style={{
                        width: '22px', height: '22px', borderRadius: '7px', flexShrink: 0,
                        background: 'var(--accent-primary)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                    }}>
                        <img
                            src="/logo_2_backup.png"
                            alt=""
                            style={{ width: '15px', height: '15px', objectFit: 'contain', filter: 'var(--logo-filter)' }}
                        />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {goalLabel}{!isMobile && isPlanActive && currentWeek > 0 ? ` · Week ${currentWeek}` : ''}
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

            {/* ── Streak cluster — tap it and the flame takes the stage ── */}
            {isPlanActive && (
                <div style={{ position: 'relative' }}>
                    <motion.button
                        data-tour="streak"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setStreakOpen(o => !o)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '7px 13px', borderRadius: '100px',
                            border: `1px solid ${flameActive ? `${FLAME_TO}55` : 'var(--border-subtle)'}`,
                            background: flameActive
                                ? `linear-gradient(90deg, ${FLAME_TO}18, transparent), var(--card-bg)`
                                : 'var(--card-bg)',
                            cursor: 'pointer',
                        }}
                        title="Your streak — tap for details"
                    >
                        <motion.span
                            animate={flameActive ? { scale: [1, 1.18, 1], rotate: [0, -3, 3, 0] } : {}}
                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ display: 'flex', filter: flameActive ? `drop-shadow(0 0 5px ${FLAME_TO}88)` : 'none' }}
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
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Shield size={13} style={{ color: 'var(--accent-primary)' }} />
                                    <span style={{
                                        fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)',
                                        fontFamily: satoshi,
                                    }}>{shields}</span>
                                </span>
                            </>
                        )}
                    </motion.button>
                    <StreakPanel
                        open={streakOpen}
                        onClose={() => setStreakOpen(false)}
                        streak={streak}
                        todayIso={todayIso}
                        todayDone={todayDone}
                    />
                </div>
            )}

            {/* ── Utilities (desktop: inline icons; mobile: labeled second row) ── */}
            {!isMobile && (
                <>
                    <DeskTile icon={<Archive size={16} />} label="Reports" onClick={onOpenArchive} />
                    <DeskTile tour="alerts-button" icon={<Bell size={16} />} label="Alerts" onClick={onOpenAlerts} />
                    <DeskTile icon={<Calendar size={16} />} label="Calendar" onClick={onOpenCalendar} />
                    <button
                        onClick={onOpenPlanInfo}
                        style={{
                            padding: '8px 14px', borderRadius: '100px', border: 'none',
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            fontSize: '11px', fontWeight: 800, cursor: 'pointer',
                            fontFamily: satoshi, letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}
                    >
                        Upgrade
                    </button>
                </>
            )}
            <ProfileMenu onLogout={onLogout} />
        </div>

        {/* Mobile second row — labeled utility tiles, evenly aligned */}
        {isMobile && (
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                {isPlanActive && (
                    <LabeledTile
                        tour="week-pill"
                        icon={<Layers size={16} />}
                        label="Weeks"
                        onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-weeks'))}
                    />
                )}
                <LabeledTile icon={<Archive size={16} />} label="Reports" onClick={onOpenArchive} />
                <LabeledTile tour="alerts-button" icon={<Bell size={16} />} label="Alerts" onClick={onOpenAlerts} />
                <LabeledTile icon={<Calendar size={16} />} label="Calendar" onClick={onOpenCalendar} />
            </div>
        )}
        </div>
    );
}
