import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Shield, TrendingUp } from 'lucide-react';
import type { StreakData } from '../../api';
import { clashDisplay, satoshi, FLAME_FROM, FLAME_TO, ACCENT_AMBER, SHIELD_BLUE, dayLetter, easeSilk } from './missionTheme';

/* ── Count-up (same easing the old StreakBar used) ── */
function useCountUp(target: number, duration = 800) {
    const [n, setN] = useState(0);
    useEffect(() => {
        let raf = 0, startTs = 0;
        const step = (ts: number) => {
            if (!startTs) startTs = ts;
            const p = Math.min(1, (ts - startTs) / duration);
            setN(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration]);
    return n;
}

/** The big animated flame — layered glow, flicker, alive. */
function FlameHero({ active, size = 84 }: { active: boolean; size?: number }) {
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            {active && (
                <motion.div
                    animate={{ scale: [1, 1.25, 1.05, 1.2, 1], opacity: [0.35, 0.6, 0.4, 0.55, 0.35] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute', inset: '-18%', borderRadius: '50%',
                        background: `radial-gradient(circle, ${FLAME_TO}55, transparent 65%)`,
                    }}
                />
            )}
            <motion.div
                animate={active
                    ? { scale: [1, 1.07, 0.98, 1.05, 1], rotate: [0, -1.5, 1, -1, 0] }
                    : { scale: 1 }}
                transition={active ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: active
                        ? `radial-gradient(circle at 50% 30%, ${FLAME_FROM}, ${FLAME_TO})`
                        : 'var(--glass-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: active ? `0 8px 32px ${FLAME_TO}66` : 'none',
                }}
            >
                <Flame
                    size={size * 0.46}
                    color={active ? '#fff' : 'var(--text-muted)'}
                    fill={active ? 'rgba(255,255,255,0.4)' : 'none'}
                />
            </motion.div>
        </div>
    );
}

/** Progress toward the next earned shield (7-day run, bank cap 2). */
function ShieldProgress({ streak }: { streak: StreakData }) {
    const banked = streak.shields_left ?? 0;
    const intoRun = (streak.current_streak || 0) % 7;
    const bankFull = banked >= 2;
    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
                <Shield size={13} style={{ color: SHIELD_BLUE }} />
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: satoshi }}>
                    {banked} shield{banked !== 1 ? 's' : ''} banked
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: satoshi }}>
                    {bankFull ? 'bank full (max 2)' : `${intoRun}/7 to the next`}
                </span>
            </div>
            <div style={{
                height: '6px', borderRadius: '100px', background: 'var(--glass-hover)',
                overflow: 'hidden',
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: bankFull ? '100%' : `${Math.max(4, (intoRun / 7) * 100)}%` }}
                    transition={{ duration: 0.9, ease: easeSilk as any }}
                    style={{
                        height: '100%', borderRadius: '100px',
                        background: bankFull
                            ? `linear-gradient(90deg, ${SHIELD_BLUE}, ${SHIELD_BLUE})`
                            : `linear-gradient(90deg, ${SHIELD_BLUE}88, ${SHIELD_BLUE})`,
                    }}
                />
            </div>
        </div>
    );
}

interface StreakPanelProps {
    open: boolean;
    onClose: () => void;
    streak: StreakData | null;
    todayIso: string;
    todayDone: boolean;
}

/**
 * The showcase: click the top-bar streak pill and the flame takes the stage —
 * count-up number, best run, shield bank with earn-progress, and the week.
 */
export function StreakPanel({ open, onClose, streak, todayIso, todayDone }: StreakPanelProps) {
    const current = streak?.current_streak ?? 0;
    const animated = useCountUp(open ? current : 0);
    const active = current > 0;

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{ position: 'fixed', inset: 0, zIndex: 90 }}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
                        style={{
                            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                            width: '312px', zIndex: 100,
                            background: 'var(--bg-surface)', border: '1px solid var(--modal-border)',
                            borderRadius: '20px', boxShadow: 'var(--shadow-lg)',
                            padding: '24px 22px', textAlign: 'center',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
                            <FlameHero active={active} />
                        </div>
                        <div style={{ marginBottom: '2px' }}>
                            <span style={{
                                fontSize: '40px', fontWeight: 800, lineHeight: 1,
                                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontFamily: clashDisplay, letterSpacing: '-0.03em',
                            }}>{animated}</span>
                            <span style={{
                                fontSize: '15px', fontWeight: 700, marginLeft: '8px',
                                color: active ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: clashDisplay,
                            }}>day streak</span>
                        </div>
                        <p style={{
                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em',
                            textTransform: 'uppercase', margin: '0 0 16px', fontFamily: satoshi,
                            color: todayDone ? ACCENT_AMBER : 'var(--text-muted)',
                        }}>
                            {todayDone ? "Today's in the bank" : active ? "Today keeps it alive" : 'Day 1 begins today'}
                        </p>

                        {/* Week dots */}
                        {streak?.days_this_week && streak.days_this_week.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '9px', marginBottom: '18px' }}>
                                {streak.days_this_week.map(d => {
                                    const isToday = d.date === todayIso;
                                    const bg =
                                        d.status === 'done' ? ACCENT_AMBER :
                                            d.status === 'shielded' ? SHIELD_BLUE :
                                                'var(--glass-hover)';
                                    return (
                                        <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <motion.div
                                                initial={{ scale: 0.5, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                transition={{ delay: 0.12, type: 'spring', stiffness: 300, damping: 20 }}
                                                style={{
                                                    width: '12px', height: '12px', borderRadius: '50%',
                                                    background: bg,
                                                    border: isToday ? `2px solid var(--accent-primary)` : 'none',
                                                    boxSizing: 'border-box',
                                                }}
                                            />
                                            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 700 }}>
                                                {dayLetter(d.date)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {streak && <ShieldProgress streak={streak} />}

                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)',
                            fontWeight: 600, fontFamily: satoshi,
                        }}>
                            <TrendingUp size={12} />
                            Best run: {streak?.longest_streak ?? 0} days
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

interface StreakStripProps {
    streak: StreakData | null;
    todayDone: boolean;
}

/** Slim always-visible flame strip for the Today stage — the daily reminder
 *  that something real is on the line. */
export function StreakStrip({ streak, todayDone }: StreakStripProps) {
    const current = streak?.current_streak ?? 0;
    const active = current > 0;
    const intoRun = current % 7;
    const banked = streak?.shields_left ?? 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05, ease: easeSilk as any }}
            style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 18px', borderRadius: '16px',
                border: '1px solid var(--border-subtle)',
                background: active
                    ? `linear-gradient(90deg, ${FLAME_TO}14, transparent 55%), var(--card-bg)`
                    : 'var(--card-bg)',
            }}
        >
            <FlameHero active={active} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                    <span style={{
                        fontSize: '19px', fontWeight: 800, color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontFamily: clashDisplay, letterSpacing: '-0.02em', lineHeight: 1,
                    }}>{current}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: satoshi }}>
                        day streak
                    </span>
                    {banked > 0 && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '11px', fontWeight: 700, color: SHIELD_BLUE, fontFamily: satoshi,
                        }}>
                            <Shield size={11} /> ×{banked}
                        </span>
                    )}
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0', fontFamily: satoshi }}>
                    {todayDone
                        ? 'Today counted. See you tomorrow.'
                        : active
                            ? `${current} day${current !== 1 ? 's' : ''} on the line — today decides.`
                            : 'Day 1 begins today. Light it up.'}
                </p>
            </div>
            {/* Mini shield-earn dots: 7 steps of the current run */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} title={`${intoRun}/7 days to your next shield`}>
                {Array.from({ length: 7 }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 + i * 0.045 }}
                        style={{
                            width: '7px', height: i < intoRun ? '18px' : '10px',
                            borderRadius: '100px', alignSelf: 'flex-end',
                            background: i < intoRun
                                ? `linear-gradient(180deg, ${FLAME_FROM}, ${FLAME_TO})`
                                : 'var(--glass-hover)',
                        }}
                    />
                ))}
            </div>
        </motion.div>
    );
}
