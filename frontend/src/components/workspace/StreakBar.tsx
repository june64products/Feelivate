import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStreak, submitCheckin, type StreakData } from '../../api';

interface StreakBarProps {
    userId: string;
    sessionId?: string | null;
    isPlanActive: boolean;
}

export default function StreakBar({ userId, sessionId, isPlanActive }: StreakBarProps) {
    const [streak, setStreak] = useState<StreakData | null>(null);
    const [loading, setLoading] = useState(false);
    const [checkinLoading, setCheckinLoading] = useState(false);
    const [todayStatus, setTodayStatus] = useState<'pending' | 'done' | 'skipped'>('pending');
    const [showCelebration, setShowCelebration] = useState(false);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => {
        if (!userId) return;
        loadStreak();
    }, [userId]);

    const loadStreak = async () => {
        setLoading(true);
        try {
            const data = await getStreak(userId);
            setStreak(data);
            const todayEntry = data.days_this_week.find(d => d.date === today);
            setTodayStatus(todayEntry?.status || 'pending');
        } catch (e) {
            // non-fatal
        } finally {
            setLoading(false);
        }
    };

    const handleCheckin = async (status: 'done' | 'skipped') => {
        setCheckinLoading(true);
        try {
            const result = await submitCheckin(status, sessionId || undefined);
            setTodayStatus(status);
            setStreak(prev => prev ? {
                ...prev,
                current_streak: result.current_streak,
                longest_streak: result.longest_streak,
                total_done: result.total_done,
                days_this_week: prev.days_this_week.map(d =>
                    d.date === today ? { ...d, status } : d
                ),
            } : prev);
            if (status === 'done') {
                setShowCelebration(true);
                setTimeout(() => setShowCelebration(false), 2000);
            }
        } catch (e) {
            console.error('Check-in failed:', e);
        } finally {
            setCheckinLoading(false);
        }
    };

    if (!isPlanActive || loading) return null;

    const currentStreak = streak?.current_streak ?? 0;
    const days = streak?.days_this_week ?? [];

    return (
        <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
        }}>
            {/* Streak header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AnimatePresence>
                        {showCelebration && (
                            <motion.span
                                initial={{ scale: 0, rotate: -20 }}
                                animate={{ scale: 1.4, rotate: 0 }}
                                exit={{ scale: 0 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                                style={{ fontSize: '18px' }}
                            >
                                🎉
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <span style={{ fontSize: '16px' }}>🔥</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {currentStreak} day{currentStreak !== 1 ? 's' : ''}
                    </span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    Best: {streak?.longest_streak ?? 0}
                </span>
            </div>

            {/* 7-day strip */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                {days.map((d) => {
                    const isToday = d.date === today;
                    const statusColor =
                        d.status === 'done' ? 'rgba(16,185,129,0.8)' :
                        d.status === 'skipped' ? 'rgba(245,158,11,0.6)' :
                        isToday ? 'rgba(192,132,252,0.3)' : 'rgba(255,255,255,0.06)';
                    return (
                        <motion.div
                            key={d.date}
                            whileHover={{ scale: 1.15 }}
                            title={`${d.date} — ${d.status}`}
                            style={{
                                flex: 1,
                                height: '6px',
                                borderRadius: '3px',
                                background: statusColor,
                                border: isToday ? '1px solid rgba(192,132,252,0.5)' : 'none',
                                transition: 'background 0.3s',
                            }}
                        />
                    );
                })}
            </div>

            {/* Today's check-in buttons */}
            {todayStatus === 'pending' ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('done')}
                        disabled={checkinLoading}
                        style={{
                            flex: 1,
                            padding: '7px 0',
                            borderRadius: '8px',
                            border: '1px solid rgba(16,185,129,0.3)',
                            background: 'rgba(16,185,129,0.08)',
                            color: 'var(--accent-green)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                        }}
                    >
                        ✅ Done today
                    </motion.button>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => handleCheckin('skipped')}
                        disabled={checkinLoading}
                        style={{
                            padding: '7px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-subtle)',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            fontSize: '11px',
                            cursor: 'pointer',
                        }}
                    >
                        Skip
                    </motion.button>
                </div>
            ) : (
                <div style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    background: todayStatus === 'done' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${todayStatus === 'done' ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    fontSize: '11px',
                    color: todayStatus === 'done' ? 'var(--accent-green)' : 'rgb(245,158,11)',
                    textAlign: 'center',
                    fontWeight: 500,
                }}>
                    {todayStatus === 'done' ? '✅ Today marked done!' : '⏭️ Skipped today'}
                </div>
            )}
        </div>
    );
}
