import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStreak, submitCheckin, backfillStreak, type StreakData } from '../../api';
import { Flame, Check, X as Close, TrendingUp } from 'lucide-react';

interface StreakBarProps {
    userId: string;
    isPlanActive: boolean;
}

export default function StreakBar({ userId, isPlanActive }: StreakBarProps) {
    const [streak, setStreak] = useState<StreakData | null>(null);
    const [loading, setLoading] = useState(false);
    const [checkinLoading, setCheckinLoading] = useState(false);
    const [todayStatus, setTodayStatus] = useState<'pending' | 'done' | 'skipped'>('pending');
    const [showCelebration, setShowCelebration] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!userId || !isPlanActive) return;
        // Always run backfill on mount — it is idempotent (no duplicate checkins created).
        // Backfill ensures voice journals recorded before auto-checkin existed are synced.
        // We pass client_date from the API so streak boundary uses IST, not server UTC.
        backfillStreak()
            .then((result) => {
                // Immediately apply streak numbers returned by backfill
                setStreak(prev => ({
                    current_streak: result.current_streak,
                    longest_streak: result.longest_streak,
                    total_done: result.total_done,
                    last_checkin: prev?.last_checkin ?? null,
                    days_this_week: prev?.days_this_week ?? [],
                }));
            })
            .catch(() => { /* non-fatal, loadStreak will still run */ })
            .finally(() => loadStreak()); // Full refresh for days_this_week
    }, [userId, isPlanActive]);

    const loadStreak = async () => {
        setLoading(true);
        try {
            const data = await getStreak(userId);
            setStreak(data);

            // Find today's status from the days_this_week array
            if (data?.days_this_week && Array.isArray(data.days_this_week)) {
                const todayEntry = data.days_this_week.find(d => d.date === today);
                if (todayEntry) {
                    setTodayStatus(todayEntry.status);
                } else {
                    setTodayStatus('pending');
                }
            }
        } catch (e) {
            console.error('Streak load failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckin = async (status: 'done' | 'skipped') => {
        setCheckinLoading(true);
        try {
            const result = await submitCheckin(status);
            // Immediately update UI with fresh data from server response
            setTodayStatus(status);
            setStreak(prev => {
                const updated = {
                    current_streak: result.current_streak,
                    longest_streak: result.longest_streak,
                    total_done: result.total_done,
                    last_checkin: result.date,
                    days_this_week: prev
                        ? prev.days_this_week.map(d => d.date === today ? { ...d, status } : d)
                        : [{ date: today, status }],
                };
                return updated;
            });
            if (status === 'done') {
                setShowCelebration(true);
                setTimeout(() => setShowCelebration(false), 2200);
            }
            // Also do a background refresh to make sure everything is in sync
            loadStreak();
        } catch (e) {
            console.error('Check-in failed:', e);
        } finally {
            setCheckinLoading(false);
        }
    };

    if (!isPlanActive || loading) return null;

    const currentStreak = streak?.current_streak ?? 0;
    const longestStreak = streak?.longest_streak ?? 0;
    // Build 7-day strip: Mon–Sun of current week
    const days = (() => {
        if (streak?.days_this_week && streak.days_this_week.length > 0) {
            return streak.days_this_week;
        }
        // Fallback: generate current week with all pending
        const d = new Date();
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(mon);
            day.setDate(mon.getDate() + i);
            return {
                date: day.toISOString().split('T')[0],
                status: 'pending' as const,
            };
        });
    })();

    return (
        <div style={{
            padding: '14px 14px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'transparent',
            flexShrink: 0,
        }}>
            {/* Row: Streak count + Best */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '10px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <AnimatePresence>
                        {showCelebration ? (
                            <motion.div
                                key="check"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                            >
                                <Check size={15} color="var(--accent-green)" />
                            </motion.div>
                        ) : (
                            <Flame
                                size={15}
                                color={currentStreak > 0 ? '#d97757' : 'var(--text-muted)'}
                                fill={currentStreak > 0 ? '#d9775755' : 'none'}
                            />
                        )}
                    </AnimatePresence>
                    <span style={{
                        fontSize: '13px', fontWeight: 600,
                        color: currentStreak > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontFamily: 'var(--font-sans)',
                    }}>
                        {currentStreak} day streak
                    </span>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                }}>
                    <TrendingUp size={11} />
                    Best: {longestStreak}
                </div>
            </div>

            {/* 7-day dots strip */}
            <div style={{ display: 'flex', gap: '3px', marginBottom: '10px' }}>
                {days.map((d) => {
                    const isToday = d.date === today;
                    const dotColor =
                        d.status === 'done' ? 'var(--accent-green)' :
                            d.status === 'skipped' ? 'var(--border-medium)' :
                                isToday ? 'var(--accent-faint-md)' :
                                    'var(--border-subtle)';
                    return (
                        <div
                            key={d.date}
                            title={`${d.date} — ${d.status}`}
                            style={{
                                flex: 1, height: '4px', borderRadius: '2px',
                                background: dotColor,
                                outline: isToday ? '1px solid var(--border-focus)' : 'none',
                                outlineOffset: '1px',
                                transition: 'background 0.25s',
                            }}
                        />
                    );
                })}
            </div>

            {/* Today's check-in */}
            {todayStatus === 'pending' ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('done')}
                        disabled={checkinLoading}
                        style={{
                            flex: 1, padding: '7px 0', borderRadius: '8px',
                            border: '1px solid var(--accent-green-faint)',
                            background: 'var(--accent-green-faint)',
                            color: 'var(--accent-green)',
                            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            fontFamily: 'var(--font-sans)',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.15)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-green-faint)'; }}
                    >
                        <Check size={13} />
                        Done today
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('skipped')}
                        disabled={checkinLoading}
                        style={{
                            padding: '7px 12px', borderRadius: '8px',
                            border: '1px solid transparent', background: 'transparent',
                            color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer',
                            fontFamily: 'var(--font-sans)',
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        Skip
                    </motion.button>
                </div>
            ) : (
                <div style={{
                    padding: '7px 10px', borderRadius: '8px',
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '11.5px', color: 'var(--text-muted)',
                    textAlign: 'center', fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}>
                    {todayStatus === 'done' ? (
                        <><Check size={12} color="var(--accent-green)" /> Completed today</>
                    ) : (
                        <><Close size={12} /> Skipped today</>
                    )}
                </div>
            )}
        </div>
    );
}
