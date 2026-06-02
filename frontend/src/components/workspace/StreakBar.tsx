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
            padding: '0',
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
                                <Check size={15} color="#4ade80" />
                            </motion.div>
                        ) : (
                            <Flame
                                size={15}
                                color={currentStreak > 0 ? '#d97757' : '#3f3f46'}
                                fill={currentStreak > 0 ? '#d9775755' : 'none'}
                            />
                        )}
                    </AnimatePresence>
                    <span style={{
                        fontSize: '13px', fontWeight: 600,
                        color: currentStreak > 0 ? '#e4e4e7' : '#71717a',
                        fontFamily: "'Inter', sans-serif",
                    }}>
                        {currentStreak} day streak
                    </span>
                </div>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '11px', color: '#52525b', fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
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
                        d.status === 'done'    ? '#4ade80' :
                        d.status === 'skipped' ? '#3f3f46' :
                        isToday                ? 'rgba(255,255,255,0.25)' :
                                                 'rgba(255,255,255,0.07)';
                    return (
                        <div
                            key={d.date}
                            title={`${d.date} — ${d.status}`}
                            style={{
                                flex: 1, height: '4px', borderRadius: '2px',
                                background: dotColor,
                                outline: isToday ? '1px solid rgba(255,255,255,0.35)' : 'none',
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
                            border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent', color: '#e4e4e7',
                            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                            fontFamily: "'Inter', sans-serif",
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        <Check size={13} />
                        Done
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('skipped')}
                        disabled={checkinLoading}
                        style={{
                            padding: '7px 12px', borderRadius: '8px',
                            border: '1px solid transparent', background: 'transparent',
                            color: '#52525b', fontSize: '12px', cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#a1a1aa'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#52525b'; }}
                    >
                        Skip
                    </motion.button>
                </div>
            ) : (
                <div style={{
                    padding: '7px 10px', borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    fontSize: '11.5px', color: '#52525b',
                    textAlign: 'center', fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                }}>
                    {todayStatus === 'done' ? (
                        <><Check size={12} color="#4ade80" /> Completed today</>
                    ) : (
                        <><Close size={12} /> Skipped today</>
                    )}
                </div>
            )}
        </div>
    );
}
