import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStreak, submitCheckin, backfillStreak, getLocalISODate, type StreakData } from '../../api';
import { Flame, Check, TrendingUp } from 'lucide-react';

interface StreakBarProps {
    userId: string;
    isPlanActive: boolean;
    /** Compact, always-animated indicator for the 52px collapsed rail. */
    collapsed?: boolean;
}

/* ── Warm flame palette — reads well on the dark sidebar in any app theme ── */
const FLAME_FROM = '#ffb24d';
const FLAME_TO = '#ff5a36';
const ACCENT = '#f59e0b';        // amber — done days / progress arc
const TXT = '#ededf0';
const TXT_MUTED = '#8a8a93';
const TXT_DIM = '#5b5b63';

/* ── Count-up hook (animates 0 → target whenever target changes) ── */
function useCountUp(target: number, duration = 750) {
    const [n, setN] = useState(0);
    useEffect(() => {
        let raf = 0;
        let startTs = 0;
        const step = (ts: number) => {
            if (!startTs) startTs = ts;
            const p = Math.min(1, (ts - startTs) / duration);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            setN(Math.round(target * eased));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return n;
}

export default function StreakBar({ userId, isPlanActive, collapsed = false }: StreakBarProps) {
    const [streak, setStreak] = useState<StreakData | null>(null);
    const [checkinLoading, setCheckinLoading] = useState(false);
    const [todayStatus, setTodayStatus] = useState<'pending' | 'done' | 'skipped'>('pending');
    const [showCelebration, setShowCelebration] = useState(false);

    // Local date (matches the client_date the backend uses for streak boundaries) —
    // not toISOString() which is UTC and can be a day off near midnight.
    const today = getLocalISODate();

    useEffect(() => {
        if (!userId || !isPlanActive) return;
        // Idempotent backfill so voice journals recorded before auto-checkin sync in.
        backfillStreak()
            .then((result) => {
                setStreak(prev => ({
                    current_streak: result.current_streak,
                    longest_streak: result.longest_streak,
                    total_done: result.total_done,
                    last_checkin: prev?.last_checkin ?? null,
                    days_this_week: prev?.days_this_week ?? [],
                }));
            })
            .catch(() => { /* non-fatal */ })
            .finally(() => loadStreak());
    }, [userId, isPlanActive]);

    const loadStreak = async () => {
        try {
            const data = await getStreak(userId);
            setStreak(data);
            if (data?.days_this_week && Array.isArray(data.days_this_week)) {
                const todayEntry = data.days_this_week.find(d => d.date === today);
                setTodayStatus(todayEntry ? todayEntry.status : 'pending');
            }
        } catch (e) {
            console.error('Streak load failed:', e);
        }
    };

    const handleCheckin = async (status: 'done' | 'skipped') => {
        setCheckinLoading(true);
        try {
            const result = await submitCheckin(status);
            setTodayStatus(status);
            setStreak(prev => ({
                current_streak: result.current_streak,
                longest_streak: result.longest_streak,
                total_done: result.total_done,
                last_checkin: result.date,
                days_this_week: prev
                    ? prev.days_this_week.map(d => d.date === today ? { ...d, status } : d)
                    : [{ date: today, status }],
            }));
            if (status === 'done') {
                setShowCelebration(true);
                setTimeout(() => setShowCelebration(false), 2200);
            }
            loadStreak();
        } catch (e) {
            console.error('Check-in failed:', e);
        } finally {
            setCheckinLoading(false);
        }
    };

    // Hooks must run unconditionally — keep useCountUp above the early returns.
    const currentStreak = streak?.current_streak ?? 0;
    const animatedStreak = useCountUp(currentStreak);

    if (!isPlanActive) return null;

    const longestStreak = streak?.longest_streak ?? 0;
    const active = currentStreak > 0;
    const isDoneToday = todayStatus === 'done';

    // 7-day week (Mon–Sun)
    const days = (() => {
        if (streak?.days_this_week && streak.days_this_week.length > 0) return streak.days_this_week;
        const d = new Date();
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(mon);
            day.setDate(mon.getDate() + i);
            return { date: day.toISOString().split('T')[0], status: 'pending' as const };
        });
    })();
    const doneThisWeek = days.filter(d => d.status === 'done').length;

    /* ─────────────────────────── COLLAPSED MINI ─────────────────────────── */
    if (collapsed) {
        return (
            <div
                title={`${currentStreak}-day streak · ${isDoneToday ? 'Done for today' : 'Goal pending today'}`}
                style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                    padding: '10px 0 4px',
                }}
            >
                <div style={{ position: 'relative', width: '34px', height: '34px' }}>
                    {/* Today-status ring */}
                    <svg width="34" height="34" viewBox="0 0 34 34" style={{ position: 'absolute', inset: 0 }}>
                        <circle cx="17" cy="17" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2" />
                        <circle
                            cx="17" cy="17" r="15" fill="none"
                            stroke={isDoneToday ? ACCENT : 'rgba(255,255,255,0.18)'}
                            strokeWidth="2" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 15}
                            strokeDashoffset={2 * Math.PI * 15 * (isDoneToday ? 0 : 0.72)}
                            transform="rotate(-90 17 17)"
                        />
                    </svg>
                    {/* Flickering flame */}
                    <motion.div
                        animate={active
                            ? { scale: [1, 1.12, 0.98, 1.08, 1], opacity: [0.92, 1, 0.95, 1, 0.92] }
                            : { scale: 1, opacity: 0.6 }}
                        transition={active ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : {}}
                        style={{
                            position: 'absolute', inset: '6px', borderRadius: '50%',
                            background: active ? `radial-gradient(circle at 50% 35%, ${FLAME_FROM}, ${FLAME_TO})` : 'rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: active ? `0 0 10px ${FLAME_TO}66` : 'none',
                        }}
                    >
                        <Flame size={13} color={active ? '#fff' : TXT_DIM} fill={active ? 'rgba(255,255,255,0.35)' : 'none'} />
                    </motion.div>
                </div>
                <span style={{
                    fontSize: '11px', fontWeight: 800, lineHeight: 1,
                    color: active ? TXT : TXT_DIM, fontFamily: "'Clash Display', 'Inter', sans-serif",
                }}>
                    {currentStreak}
                </span>
            </div>
        );
    }

    /* ─────────────────────────── EXPANDED ORBITAL ─────────────────────────── */
    const R = 38;
    const C = 2 * Math.PI * R;
    const weekFrac = doneThisWeek / 7;

    return (
        <div style={{
            padding: '14px 14px 16px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
        }}>
            {/* Orbital ring + flame */}
            <div style={{ position: 'relative', width: '116px', height: '116px', margin: '0 auto 10px' }}>
                <svg width="116" height="116" viewBox="0 0 100 100">
                    <defs>
                        <linearGradient id="streak-arc" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={FLAME_FROM} />
                            <stop offset="100%" stopColor={FLAME_TO} />
                        </linearGradient>
                    </defs>
                    {/* Track */}
                    <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                    {/* Animated progress arc (this week's completed days) */}
                    <motion.circle
                        cx="50" cy="50" r={R} fill="none"
                        stroke="url(#streak-arc)" strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={C}
                        initial={{ strokeDashoffset: C }}
                        animate={{ strokeDashoffset: C * (1 - weekFrac) }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        transform="rotate(-90 50 50)"
                    />
                    {/* 7 day-nodes around the ring */}
                    {days.map((d, i) => {
                        const ang = (-90 + i * (360 / 7)) * (Math.PI / 180);
                        const x = 50 + R * Math.cos(ang);
                        const y = 50 + R * Math.sin(ang);
                        const isToday = d.date === today;
                        const fill =
                            d.status === 'done' ? ACCENT :
                                isToday ? '#ffffff' :
                                    'rgba(255,255,255,0.18)';
                        return (
                            <g key={d.date}>
                                {isToday && d.status !== 'done' && (
                                    <motion.circle
                                        cx={x} cy={y} r={4} fill="none" stroke="#ffffff" strokeWidth="1"
                                        animate={{ r: [3, 6, 3], opacity: [0.6, 0, 0.6] }}
                                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                                    />
                                )}
                                <circle cx={x} cy={y} r={d.status === 'done' || isToday ? 3 : 2.2} fill={fill} />
                            </g>
                        );
                    })}
                </svg>

                {/* Center flame disc — pulsing glow */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <motion.div
                        animate={active
                            ? { scale: [1, 1.06, 0.99, 1.04, 1], boxShadow: [`0 0 14px ${FLAME_TO}55`, `0 0 26px ${FLAME_TO}88`, `0 0 14px ${FLAME_TO}55`] }
                            : { scale: 1 }}
                        transition={active ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } : {}}
                        style={{
                            width: '46px', height: '46px', borderRadius: '50%',
                            background: active ? `radial-gradient(circle at 50% 32%, ${FLAME_FROM}, ${FLAME_TO})` : 'rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Flame size={22} color={active ? '#fff' : TXT_DIM} fill={active ? 'rgba(255,255,255,0.4)' : 'none'} />
                    </motion.div>
                </div>

                {/* Celebration burst */}
                <AnimatePresence>
                    {showCelebration && (
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                            {Array.from({ length: 8 }).map((_, i) => {
                                const ang = i * (360 / 8) * (Math.PI / 180);
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                        animate={{ x: Math.cos(ang) * 46, y: Math.sin(ang) * 46, opacity: 0, scale: 0.3 }}
                                        transition={{ duration: 0.9, ease: 'easeOut' }}
                                        style={{
                                            position: 'absolute', left: '50%', top: '50%',
                                            width: '6px', height: '6px', borderRadius: '50%',
                                            background: i % 2 ? ACCENT : FLAME_FROM,
                                            marginLeft: '-3px', marginTop: '-3px',
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Streak count (count-up) */}
            <div style={{ textAlign: 'center', marginBottom: '2px' }}>
                <span style={{
                    fontSize: '26px', fontWeight: 800, lineHeight: 1,
                    color: active ? TXT : TXT_DIM,
                    fontFamily: "'Clash Display', 'Inter', sans-serif", letterSpacing: '-0.02em',
                }}>
                    {animatedStreak}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: active ? TXT : TXT_DIM, marginLeft: '6px', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
                    Day Streak
                </span>
            </div>

            {/* Status line */}
            <div style={{
                textAlign: 'center', fontSize: '10px', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: isDoneToday ? ACCENT : TXT_MUTED, marginBottom: '12px',
                fontFamily: "'Satoshi', 'Inter', sans-serif",
            }}>
                {isDoneToday ? 'Daily goal complete' : todayStatus === 'skipped' ? 'Skipped today' : 'Keep your streak alive'}
            </div>

            {/* Action / status */}
            {todayStatus === 'pending' ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('done')}
                        disabled={checkinLoading}
                        style={{
                            flex: 1, padding: '9px 0', borderRadius: '100px',
                            border: 'none',
                            background: `linear-gradient(135deg, ${FLAME_FROM}, ${FLAME_TO})`,
                            color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                            fontFamily: "'Satoshi', 'Inter', sans-serif",
                            letterSpacing: '0.04em', textTransform: 'uppercase',
                            boxShadow: `0 4px 14px ${FLAME_TO}44`,
                        }}
                    >
                        <Check size={13} />
                        Done for Today
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('skipped')}
                        disabled={checkinLoading}
                        style={{
                            padding: '9px 12px', borderRadius: '100px',
                            border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                            color: TXT_DIM, fontSize: '12px', cursor: 'pointer',
                            fontFamily: "'Satoshi', 'Inter', sans-serif",
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = TXT_MUTED; }}
                        onMouseLeave={e => { e.currentTarget.style.color = TXT_DIM; }}
                    >
                        Skip
                    </motion.button>
                </div>
            ) : (
                <div style={{
                    padding: '9px 10px', borderRadius: '100px',
                    background: isDoneToday ? `${ACCENT}1a` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isDoneToday ? `${ACCENT}40` : 'rgba(255,255,255,0.06)'}`,
                    fontSize: '11.5px', fontWeight: 700, color: isDoneToday ? ACCENT : TXT_MUTED,
                    textAlign: 'center', fontFamily: "'Satoshi', 'Inter', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                    <Check size={13} />
                    {isDoneToday ? 'Completed today' : 'Logged today'}
                </div>
            )}

            {/* Best streak footnote */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                marginTop: '10px', fontSize: '10.5px', color: TXT_DIM, fontWeight: 600,
                fontFamily: "'Satoshi', 'Inter', sans-serif",
            }}>
                <TrendingUp size={11} />
                Best: {longestStreak} days
            </div>
        </div>
    );
}
