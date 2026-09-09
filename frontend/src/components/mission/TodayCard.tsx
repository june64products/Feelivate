import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, MessageCircle } from 'lucide-react';
import { clashDisplay, satoshi, FLAME_FROM, ACCENT_AMBER, easeSilk, todaysPlanEntry } from './missionTheme';
import type { TodayStatus } from '../../hooks/useStreak';

interface TodayCardProps {
    activePlan: any;
    todayIso: string;
    todayStatus: TodayStatus;
    checkinLoading: boolean;
    justCelebrated: boolean;
    onCheckin: (status: 'done' | 'skipped') => void;
    onAskMentor: () => void;
    demoMode?: boolean;
}

/**
 * The hero of the new workspace: one day, one task, one tap. Check-in logic is
 * the exact same /checkin call the old StreakBar made — only the stage changed.
 */
export default function TodayCard({
    activePlan, todayIso, todayStatus, checkinLoading, justCelebrated,
    onCheckin, onAskMentor, demoMode = false,
}: TodayCardProps) {
    const entry = todaysPlanEntry(activePlan, todayIso);
    const weekNum = activePlan?.week_number ?? 1;
    const dateLabel = new Date(`${todayIso}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric',
    });
    const isDone = todayStatus === 'done';
    const isSkipped = todayStatus === 'skipped';

    return (
        <motion.div
            data-tour="today-card"
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: easeSilk as any }}
            style={{
                position: 'relative', overflow: 'hidden',
                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: '22px', padding: '26px 28px',
                boxShadow: 'var(--shadow-sm)',
            }}
        >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--accent-primary)', fontFamily: satoshi,
                }}>
                    Today · Week {weekNum}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '12px', color: 'var(--text-muted)', fontFamily: satoshi,
                }}>
                    <Clock size={13} />
                    {dateLabel}
                </span>
            </div>

            {entry ? (
                <>
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12, duration: 0.5, ease: easeSilk as any }}
                        style={{
                            fontSize: '21px', fontWeight: 600, color: 'var(--text-primary)',
                            lineHeight: 1.5, margin: '0 0 20px', fontFamily: clashDisplay,
                            letterSpacing: '-0.01em', whiteSpace: 'pre-wrap',
                        }}
                    >
                        {entry.action}
                    </motion.p>

                    {/* Action row */}
                    {todayStatus === 'pending' ? (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <motion.button
                                data-tour="done-button"
                                whileTap={{ scale: 0.96 }}
                                whileHover={{ scale: 1.02 }}
                                onClick={() => !demoMode && onCheckin('done')}
                                disabled={checkinLoading}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '13px 28px', borderRadius: '100px', border: 'none',
                                    background: `linear-gradient(135deg, ${FLAME_FROM}, ${'#ff5a36'})`,
                                    color: '#fff', fontSize: '13px', fontWeight: 800,
                                    cursor: 'pointer', fontFamily: satoshi,
                                    letterSpacing: '0.05em', textTransform: 'uppercase',
                                    boxShadow: '0 6px 18px rgba(255,90,54,0.35)',
                                }}
                            >
                                <Check size={15} />
                                Done for today
                            </motion.button>
                            <button
                                onClick={() => !demoMode && onCheckin('skipped')}
                                disabled={checkinLoading}
                                style={{
                                    padding: '12px 18px', borderRadius: '100px',
                                    border: '1px solid var(--border-medium)', background: 'transparent',
                                    color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                                    fontFamily: satoshi,
                                }}
                            >
                                Skip today
                            </button>
                            <span style={{ flex: 1 }} />
                            <button
                                onClick={onAskMentor}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '11px 16px', borderRadius: '100px',
                                    border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
                                    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                                    cursor: 'pointer', fontFamily: satoshi,
                                }}
                            >
                                <MessageCircle size={13} />
                                How do I do this?
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 18px', borderRadius: '14px',
                            background: isDone ? `${ACCENT_AMBER}1a` : 'var(--bg-surface)',
                            border: `1px solid ${isDone ? `${ACCENT_AMBER}40` : 'var(--border-subtle)'}`,
                            color: isDone ? ACCENT_AMBER : 'var(--text-muted)',
                            fontSize: '13px', fontWeight: 700, fontFamily: satoshi,
                        }}>
                            <Check size={15} />
                            {isDone ? 'Completed — the chain grows.' : isSkipped ? 'Logged as skipped. Tomorrow is the day that matters.' : 'Logged.'}
                        </div>
                    )}
                </>
            ) : (
                <p style={{
                    fontSize: '15px', color: 'var(--text-secondary)', margin: 0,
                    fontFamily: satoshi, lineHeight: 1.7,
                }}>
                    Nothing scheduled for today in this week's plan. Rest is part of the work.
                </p>
            )}

            {/* Celebration burst on done */}
            <AnimatePresence>
                {justCelebrated && (
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                        {Array.from({ length: 14 }).map((_, i) => {
                            const ang = (i * (360 / 14)) * (Math.PI / 180);
                            return (
                                <motion.div
                                    key={i}
                                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                    animate={{
                                        x: Math.cos(ang) * (90 + (i % 3) * 30),
                                        y: Math.sin(ang) * (70 + (i % 4) * 24),
                                        opacity: 0, scale: 0.2,
                                    }}
                                    transition={{ duration: 1.1, ease: 'easeOut' }}
                                    style={{
                                        position: 'absolute', left: '50%', top: '55%',
                                        width: '8px', height: '8px', borderRadius: '50%',
                                        background: i % 2 ? ACCENT_AMBER : FLAME_FROM,
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
