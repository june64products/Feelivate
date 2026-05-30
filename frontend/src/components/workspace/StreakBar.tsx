import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getStreak, submitCheckin, type StreakData } from '../../api';
import { Flame, Check, X as Close, TrendingUp } from 'lucide-react';

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
            padding: '16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'transparent',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
        }}>
            {/* Streak header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AnimatePresence>
                        {showCelebration && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                                style={{ color: '#fff' }}
                            >
                                <Check size={16} color="#4ade80" />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {!showCelebration && <Flame size={16} color={currentStreak > 0 ? '#d97757' : '#555'} />}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: "'Inter', sans-serif" }}>
                        {currentStreak} Day Streak
                    </span>
                </div>
                <span style={{ fontSize: '11px', color: '#9c9a92', fontWeight: 500, fontFamily: "'Inter', sans-serif", display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <TrendingUp size={12} /> Best: {streak?.longest_streak ?? 0}
                </span>
            </div>

            {/* 7-day strip */}
            <div style={{ display: 'flex', gap: '4px' }}>
                {days.map((d) => {
                    const isToday = d.date === today;
                    const statusColor =
                        d.status === 'done' ? '#ffffff' :
                        d.status === 'skipped' ? 'rgba(255,255,255,0.2)' :
                        isToday ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.08)';
                    return (
                        <motion.div
                            key={d.date}
                            whileHover={{ scale: 1.1 }}
                            title={`${d.date} — ${d.status}`}
                            style={{
                                flex: 1,
                                height: '4px',
                                borderRadius: '2px',
                                background: statusColor,
                                border: isToday ? '1px solid rgba(255,255,255,0.6)' : 'none',
                                transition: 'background 0.3s',
                            }}
                        />
                    );
                })}
            </div>

            {/* Today's check-in buttons */}
            {todayStatus === 'pending' ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <motion.button
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCheckin('done')}
                        disabled={checkinLoading}
                        style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'transparent',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontFamily: "'Inter', sans-serif"
                        }}
                    >
                        <Check size={14} /> Done
                    </motion.button>
                    <motion.button
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCheckin('skipped')}
                        disabled={checkinLoading}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: '#9c9a92',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif"
                        }}
                    >
                        Skip
                    </motion.button>
                </div>
            ) : (
                <div style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    fontSize: '11px',
                    color: '#9c9a92',
                    textAlign: 'center',
                    fontWeight: 500,
                    fontFamily: "'Inter', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                }}>
                    {todayStatus === 'done' ? (
                        <><Check size={12} color="#fff" /> Completed today</>
                    ) : (
                        <><Close size={12} /> Skipped today</>
                    )}
                </div>
            )}
        </div>
    );
}

