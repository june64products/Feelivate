import { useCallback, useEffect, useState } from 'react';
import { getStreak, submitCheckin, backfillStreak, getLocalISODate, type StreakData } from '../api';
import { DEMO_STREAK } from '../components/demo/demoScript';

export type TodayStatus = 'pending' | 'done' | 'skipped';

/**
 * The streak logic that used to live inside StreakBar, unhooked from any one
 * widget so the new layout can read it in several places at once (top-bar
 * flame, path row, Today card). Same endpoints, same backfill, same
 * client-date semantics — only the rendering moved.
 */
export function useStreak(userId: string | null, isPlanActive: boolean, demoMode = false) {
    const [streak, setStreak] = useState<StreakData | null>(demoMode ? (DEMO_STREAK as StreakData) : null);
    const [checkinLoading, setCheckinLoading] = useState(false);
    const [todayStatus, setTodayStatus] = useState<TodayStatus>('pending');
    const [justCelebrated, setJustCelebrated] = useState(false);

    const today = getLocalISODate();

    const loadStreak = useCallback(async () => {
        if (demoMode || !userId) return;
        try {
            const data = await getStreak(userId);
            setStreak(data);
            if (data?.days_this_week && Array.isArray(data.days_this_week)) {
                const todayEntry = data.days_this_week.find(d => d.date === today);
                setTodayStatus(todayEntry && todayEntry.status !== 'shielded' ? todayEntry.status : 'pending');
            }
        } catch (e) {
            console.error('Streak load failed:', e);
        }
    }, [userId, demoMode, today]);

    useEffect(() => {
        if (demoMode || !userId || !isPlanActive) return;
        // Idempotent backfill so voice journals recorded before auto-checkin sync in.
        backfillStreak()
            .then((result) => {
                setStreak(prev => ({
                    current_streak: result.current_streak,
                    longest_streak: result.longest_streak,
                    total_done: result.total_done,
                    last_checkin: prev?.last_checkin ?? null,
                    days_this_week: prev?.days_this_week ?? [],
                    shields_left: prev?.shields_left,
                }));
            })
            .catch(() => { /* non-fatal */ })
            .finally(() => loadStreak());
    }, [userId, isPlanActive, demoMode, loadStreak]);

    const checkin = useCallback(async (status: 'done' | 'skipped') => {
        if (demoMode) return;
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
                shields_left: (result as any).shields_left ?? prev?.shields_left,
            }));
            if (status === 'done') {
                setJustCelebrated(true);
                setTimeout(() => setJustCelebrated(false), 2400);
            }
            loadStreak();
        } catch (e) {
            console.error('Check-in failed:', e);
        } finally {
            setCheckinLoading(false);
        }
    }, [demoMode, today, loadStreak]);

    return { streak, todayStatus, checkinLoading, justCelebrated, checkin, reload: loadStreak, today };
}
