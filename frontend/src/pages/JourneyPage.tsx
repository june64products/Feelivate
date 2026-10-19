import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, ArrowLeft, Lock, ChevronDown, FileText, BookOpen } from 'lucide-react';
import {
    getJournalsForSession,
    getWeeklyReport,
    getWeekInfo,
    getSessionReports,
    getSessionDetail,
    uploadVoiceJournalForSession,
    submitMoodCheckin,
    type MoodCheckinResult,
    type JournalEntry,
    type WeeklyReport,
    type WeeklyReportDay,
    type WeekInfo,
    type ArchivedWeekReport,
    getLocalISODate
} from '../api';
import WeekReviewStory from '../components/journey/WeekReviewStory';
import LockedWeeksPanel from '../components/workspace/LockedWeeksPanel';
import { DEMO_ARCHIVE } from '../components/demo/demoScript';

// ─── Fonts ────────────────────────────────────────────────────────────────────
const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// ─── Emotion color palette ────────────────────────────────────────────────────
const EMOTION_COLORS: Record<string, string> = {
    motivated: '#f59e0b',
    stressed: '#ef4444',
    focused: '#6366f1',
    anxious: '#f97316',
    confident: '#10b981',
    drained: '#8b5cf6',
    excited: '#ec4899',
    neutral: '#6b7280',
    frustrated: '#dc2626',
    hopeful: '#22c55e',
};
const emotionColor = (label?: string | null) =>
    EMOTION_COLORS[label ?? 'neutral'] ?? '#6b7280';

// ─── 7-day calendar strip ─────────────────────────────────────────────────────
function WeekCalendar({ days, today, planStartDate }: { days: WeeklyReportDay[]; today: string; planStartDate?: string }) {
    // Parse in local timezone to get correct weekday
    const parseLocalDate = (dateStr: string) => {
        const [y, mo, dd] = dateStr.split('-').map(Number);
        return new Date(y, mo - 1, dd);
    };

    // Filter out days before the plan started — don't show them at all
    const visibleDays = planStartDate
        ? days.filter(d => d.date >= planStartDate)
        : days;
    const colCount = visibleDays.length || 7;

    return (
            <div className="mobile-horizontal-scroll" style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${colCount}, 1fr)`,
                gap: '6px',
            }}>
            {visibleDays.map((d, i) => {
                const dayDate = parseLocalDate(d.date);
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                const isPast = d.date < today;
                const isToday = d.date === today;
                const hasDone = d.has_journal;
                const isMissed = isPast && !hasDone && !isToday;
                const color = hasDone ? emotionColor(d.emotion) : isMissed ? '#ef4444' : 'var(--text-muted)';

                return (
                    <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 600, fontFamily: satoshi }}>
                            {dayName}
                        </span>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            title={d.date}
                            style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: hasDone ? `${color}15` : 'transparent',
                                border: `2px solid ${color}`,
                                position: 'relative',
                            }}
                        >
                            {hasDone && (
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: color,
                                }} />
                            )}
                            {isMissed && (
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: 'rgba(239,68,68,0.3)',
                                }} />
                            )}
                            {isToday && !hasDone && (
                                <div style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    background: 'var(--text-muted)',
                                }} />
                            )}
                        </motion.div>
                        {hasDone && (
                            <span style={{ fontSize: '8px', color, fontWeight: 600, fontFamily: satoshi }}>
                                {d.score}/10
                            </span>
                        )}
                        {isMissed && (
                            <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: 500, opacity: 0.7, fontFamily: satoshi }}>
                                missed
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface JourneyPageProps {
    userId: string;
    sessionId?: string;
    onJournalSaved?: (entry: JournalEntry) => void;
    /** A completed week's report is on screen — the moment for the fuller feedback form. */
    onReportSeen?: (weekNumber: number) => void;
    onClose?: () => void;
    demoMode?: boolean;
    demoTab?: 'overview' | 'archive';
    /** Guided demo: render the between-weeks state (journal locked + mood mic). */
    demoBetweenWeeks?: boolean;
    /** Guided demo: the archive report that should be open (to point at its View button). */
    demoExpandedWeek?: number | null;
    initialTab?: 'overview' | 'archive';
}

export default function JourneyPage({ userId, sessionId, onJournalSaved, onReportSeen, onClose, demoMode = false, demoTab, demoBetweenWeeks = false, demoExpandedWeek = null, initialTab }: JourneyPageProps) {
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
    const [archivedReports, setArchivedReports] = useState<ArchivedWeekReport[]>([]);
    const [planHistory, setPlanHistory] = useState<any[]>([]);
    const [currentPlan, setCurrentPlan] = useState<any | null>(null);
    const [loadingReport, setLoadingReport] = useState(true);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'archive'>(initialTab ?? 'overview');
    const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

    // Mic-lock is tracked PER SESSION so a recording in one session doesn't lock
    // the mic in a different (fresh) session on the same day.
    const [micLocked, setMicLocked] = useState<boolean>(() => {
        const uid = localStorage.getItem('user_id');
        const key = `last_journal_date_${uid}_${sessionId ?? 'none'}`;
        const stored = localStorage.getItem(key);
        return stored === getLocalISODate();
    });
    const [showWeekEndCelebration, setShowWeekEndCelebration] = useState(false);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [justSaved, setJustSaved] = useState<JournalEntry | null>(null);
    // Mood-only mic (between weeks): records through the same recorder but
    // uploads to /mood/checkin — joins no journal, no streak, no report.
    const moodModeRef = useRef(false);
    const [moodResult, setMoodResult] = useState<MoodCheckinResult | null>(null);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const today = getLocalISODate();

    // No week is running right now: either no plan was ever locked, or the
    // last locked week's window has ended and the next one isn't committed.
    // The main journal locks in this gap; the mood mic takes over.
    // In the guided demo the scene decides (so the tour can show this state
    // without touching the backend); the real rule is unchanged otherwise.
    // A finished goal: reports stay readable, but nothing invites another week.
    const goalFinished = !demoMode && !!weekInfo?.is_completed;
    const noActiveWeek = demoMode
        ? demoBetweenWeeks
        : (
            !weekInfo?.has_plan ||
            (!!weekInfo?.week_end && today > weekInfo.week_end && !weekInfo?.has_next_plan)
        );

    // In the guided demo we never hit the backend — show the empty Journey UI plus
    // canned archive reports so the mic / Overview / Archive can be spotlighted.
    useEffect(() => {
        if (demoMode) {
            setLoadingReport(false);
            setLoadingArchive(false);
            setArchivedReports(DEMO_ARCHIVE as any);
            return;
        }
        loadAll();
    }, [userId, sessionId, demoMode]);

    // Guided demo: switch Overview/Archive tab as the demo asks.
    useEffect(() => {
        if (demoMode && demoTab) setActiveTab(demoTab);
    }, [demoMode, demoTab]);
    // The tour opens one archive report to point at its View button.
    useEffect(() => {
        if (demoMode) setExpandedWeek(demoExpandedWeek ?? null);
    }, [demoMode, demoExpandedWeek]);

    const loadAll = async () => {
        try {
            // 1. Always fetch weekInfo first — we need current_week for the report query
            let wi: WeekInfo | null = null;
            if (sessionId) {
                wi = await getWeekInfo(sessionId).catch(() => null);
                setWeekInfo(wi);
            }

            const weekNum = wi?.current_week;

            // 2. Fetch journals (ALL user journals, not session-filtered),
            //    weekly report (session-scoped), and archived reports in parallel
            const [j, r, ar] = await Promise.all([
                // Session-scoped: only THIS session's voice entries (fresh session = empty)
                getJournalsForSession(userId, sessionId),
                sessionId ? getWeeklyReport(userId, sessionId, weekNum).catch(() => null) : null,
                sessionId ? getSessionReports(sessionId).catch(() => []) : [],
            ]);
            setJournals(j);
            setReport(r);
            setArchivedReports(ar);

            // 4. Fetch session plan + plan history
            if (sessionId) {
                const detail = await getSessionDetail(sessionId).catch(() => null);
                if (detail) {
                    setPlanHistory(detail.plan_history || []);
                    setCurrentPlan(detail.plan || null);
                }
            }

            // 5. Lock the mic only if THIS session already has today's entry; otherwise
            //    keep it unlocked (a fresh session must be recordable even if another
            //    session was journaled today).
            const todayJ = j.find(jj => jj.date === getLocalISODate());
            const uid = localStorage.getItem('user_id');
            const key = `last_journal_date_${uid}_${sessionId ?? 'none'}`;
            if (todayJ) {
                setMicLocked(true);
                localStorage.setItem(key, getLocalISODate());
            } else {
                setMicLocked(false);
                localStorage.removeItem(key);
            }
        } finally {
            setLoadingReport(false);
        }
    };

    // ── Recording logic ───────────────────────────────────────────────────────
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            chunksRef.current = [];
            mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            mr.onstop = handleUpload;
            mr.start();
            mediaRef.current = mr;
            setIsRecording(true);
        } catch {
            alert('Microphone access denied. Please allow mic access.');
        }
    };

    const stopRecording = () => {
        mediaRef.current?.stop();
        mediaRef.current?.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
    };

    // Two entry points, one recorder. The ref decides where the audio goes.
    const beginJournal = () => { moodModeRef.current = false; startRecording(); };
    const beginMood = () => { moodModeRef.current = true; startRecording(); };

    const handleUpload = async () => {
        if (moodModeRef.current) {
            // Mood-only path: detect and show, touch nothing else.
            setIsUploading(true);
            try {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                const res = await submitMoodCheckin(blob);
                setMoodResult(res);
            } catch (e) {
                console.error('Mood check-in failed:', e);
            } finally {
                setIsUploading(false);
                moodModeRef.current = false;
            }
            return;
        }
        setIsUploading(true);
        try {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            const entry = await uploadVoiceJournalForSession(blob, sessionId);
            setJustSaved(entry);
            onJournalSaved?.(entry);
            setJournals(prev => {
                const filtered = prev.filter(j => j.date !== entry.date);
                return [entry, ...filtered];
            });
            const uid = localStorage.getItem('user_id');
            const key = `last_journal_date_${uid}_${sessionId ?? 'none'}`;
            localStorage.setItem(key, getLocalISODate());
            setMicLocked(true);

            // Refresh the weekly report
            setLoadingReport(true);
            const wk = weekInfo?.current_week;
            const r = await getWeeklyReport(userId, sessionId, wk).catch(() => null);
            if (r) {
                setReport(r);
                // Refresh weekInfo for last-day-of-week detection
                const wi = sessionId ? await getWeekInfo(sessionId).catch(() => null) : null;
                if (wi) setWeekInfo(wi);
                // Celebration fires ONLY on the very last day of the week (today === week_end)
                // and only once a real report exists (not for no_data / in_progress states).
                const isLastDay = wi?.week_end ? today === wi.week_end : false;
                if (isLastDay && !wi?.is_completed && r.report && r.status !== 'no_data' && r.status !== 'in_progress') {
                    setTimeout(() => setShowWeekEndCelebration(true), 800);
                }
            }
        } catch (e: any) {
            alert(e.message || 'Upload failed');
        } finally {
            setIsUploading(false);
            setLoadingReport(false);
        }
    };

    // Load archive when switching to archive tab
    const handleArchiveTab = async () => {
        setActiveTab('archive');
        if (sessionId && archivedReports.length === 0) {
            setLoadingArchive(true);
            try {
                const reports = await getSessionReports(sessionId);
                setArchivedReports(reports);
            } catch { /* ignore */ } finally {
                setLoadingArchive(false);
            }
        }
    };

    const reportData = report?.report;

    // A finished week's review is on screen: the one moment the fuller feedback
    // form is worth asking (the parent decides whether it has been asked before).
    const reportSeenRef = useRef<string | null>(null);
    useEffect(() => {
        if (demoMode || !reportData || !onReportSeen) return;
        if (report?.status === 'no_data' || report?.status === 'in_progress' || report?.status === 'waiting_for_sunday_entry') return;
        const complete = weekInfo?.week_end ? today >= weekInfo.week_end : (weekInfo?.is_week_complete ?? false);
        const wk = reportData.week_number ?? 0;
        if (!complete || wk < 1) return;
        const key = `${sessionId ?? ''}:${wk}`;
        if (reportSeenRef.current === key) return;
        reportSeenRef.current = key;
        const t = window.setTimeout(() => onReportSeen(wk), 4000);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reportData, report?.status, weekInfo?.week_end, weekInfo?.is_week_complete, demoMode, sessionId]);

    // Build weekDays — the calendar for the current week (respects plan start date)
    const weekDays: WeeklyReportDay[] = (() => {
        // Prefer server-generated per-day data from report (most accurate)
        if (reportData?.days && reportData.days.length > 0) return reportData.days;

        // Fallback: build from local journal data
        const jMap: Record<string, JournalEntry> = {};
        journals.forEach(j => { jMap[j.date] = j; });

        // Determine the start date for the calendar
        // Prefer the displayed week's bounds from the backend (week_start..week_end) —
        // these already start at the day the plan was locked, so a Wed-locked week shows
        // Wed→Sun (Mon/Tue excluded). Fall back to plan_start_date, then today's Monday.
        const todayLocal = new Date();
        let startDate: Date;
        let endDate: Date;

        if (weekInfo?.week_start && weekInfo?.week_end) {
            const [sy, sm, sd] = weekInfo.week_start.split('-').map(Number);
            startDate = new Date(sy, sm - 1, sd);
            const [ey, em, ed] = weekInfo.week_end.split('-').map(Number);
            endDate = new Date(ey, em - 1, ed);
        } else if (weekInfo?.plan_start_date) {
            // Use plan start date as anchor
            const [py, pm, pd] = weekInfo.plan_start_date.split('-').map(Number);
            startDate = new Date(py, pm - 1, pd);
            // End date = that Sunday
            const startDow = startDate.getDay() || 7; // 1=Mon..7=Sun
            const daysToSunday = 7 - startDow;
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + daysToSunday);
        } else {
            // Standard Monday anchor
            const dow = todayLocal.getDay() || 7;
            startDate = new Date(todayLocal);
            startDate.setDate(todayLocal.getDate() - dow + 1);
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
        }

        const dayCount = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        return Array.from({ length: dayCount }, (_, i) => {
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);
            const tzOffset = day.getTimezoneOffset() * 60000;
            const dateStr = new Date(day.getTime() - tzOffset).toISOString().split('T')[0];
            const j = jMap[dateStr];
            const isPast = dateStr < today;
            return {
                date: dateStr,
                emotion: j?.emotion_label ?? null,
                score: j?.emotion_score ?? null,
                one_liner: j?.one_liner ?? null,
                checkin: j ? 'done' : isPast ? 'missed' : 'pending',
                has_journal: !!j,
            } as WeeklyReportDay;
        });
    })();

    // Derive todayEntry from weekDays for consistent state
    const todayEntry = weekDays.find(d => d.date === today && d.has_journal) ? journals.find(j => j.date === today) : null;


    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            height: '100%', minHeight: 0,
            background: 'var(--bg-primary)', overflow: 'hidden',
            position: 'relative',
            fontFamily: satoshi,
        }}>
            {/* Floating locked weeks panel — right edge */}
            <LockedWeeksPanel
                sessionId={sessionId}
                currentWeek={weekInfo?.current_week ?? 1}
                micLocked={micLocked}
                activePlan={currentPlan}
                planHistory={planHistory}
            />

            {/* ── Sunday night: the week's review is in ── */}
            <AnimatePresence>
                {showWeekEndCelebration && reportData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'var(--modal-overlay, rgba(0,0,0,0.5))',
                            backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '16px',
                        }}
                        onClick={() => setShowWeekEndCelebration(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 24 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                            onClick={e => e.stopPropagation()}
                            role="dialog"
                            aria-label={`Week ${reportData.week_number} review`}
                            style={{
                                width: '100%', maxWidth: '560px', maxHeight: '94vh',
                                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                                borderRadius: '28px', boxShadow: 'var(--shadow-lg)',
                                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                            }}
                        >
                            <div style={{ padding: '18px 22px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-warm)', fontFamily: satoshi }}>
                                        Week {reportData.week_number}{reportData.week_theme ? ` · ${reportData.week_theme}` : ''}
                                    </p>
                                    <h2 style={{ margin: '6px 0 0', fontSize: 'clamp(22px, 5vw, 28px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--text-primary)', fontFamily: clashDisplay }}>
                                        Week {reportData.week_number}, complete.
                                    </h2>
                                </div>
                                <button onClick={() => setShowWeekEndCelebration(false)} aria-label="Close" style={{ border: 'none', background: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', fontFamily: satoshi, padding: '4px 0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Later
                                </button>
                            </div>
                            <div style={{ flex: 1, minHeight: 0, padding: '6px 14px 0' }}>
                                <WeekReviewStory
                                    report={reportData}
                                    days={weekDays}
                                    weekStart={report?.week_start}
                                    weekEnd={report?.week_end}
                                    height="min(58vh, 600px)"
                                    onPlanNext={(!weekInfo?.has_next_plan && !goalFinished) ? () => {
                                        setShowWeekEndCelebration(false);
                                        window.dispatchEvent(new CustomEvent('request-next-week-plan', { detail: { week: (reportData.week_number ?? 1) + 1 } }));
                                        setTimeout(() => window.dispatchEvent(new CustomEvent('close-journey')), 100);
                                    } : undefined}
                                />
                            </div>
                            <div style={{ padding: '14px 22px 18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                <button
                                    onClick={() => setShowWeekEndCelebration(false)}
                                    style={{
                                        flex: '1 1 160px', padding: '11px', borderRadius: '100px',
                                        border: '1px solid var(--border-medium)', background: 'transparent',
                                        color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: satoshi,
                                    }}
                                >
                                    View Full Report
                                </button>
                                {!weekInfo?.has_next_plan && !goalFinished && (
                                    <button
                                        onClick={() => {
                                            setShowWeekEndCelebration(false);
                                            window.dispatchEvent(new CustomEvent('request-next-week-plan', { detail: { week: (reportData.week_number ?? 1) + 1 } }));
                                            setTimeout(() => window.dispatchEvent(new CustomEvent('close-journey')), 100);
                                        }}
                                        style={{
                                            flex: '1 1 160px', padding: '11px', borderRadius: '100px', border: 'none',
                                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                            fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: satoshi,
                                        }}
                                    >
                                        Plan Week {(reportData.week_number ?? 1) + 1} →
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* ── Header — mission style ── */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '16px clamp(16px, 4vw, 28px)',
                    borderBottom: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                }}
            >
                {onClose && (
                    <motion.button
                        whileTap={{ scale: 0.94 }}
                        onClick={onClose}
                        aria-label="Back to today"
                        style={{
                            width: '36px', height: '36px', borderRadius: '12px',
                            border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'border-color 0.15s, color 0.15s', flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <ArrowLeft size={16} />
                    </motion.button>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: 'var(--accent-primary)',
                        margin: '0 0 2px', fontFamily: satoshi,
                    }}>
                        Your private space
                    </p>
                    <h1 style={{
                        fontSize: '19px', fontWeight: 700, color: 'var(--text-primary)',
                        letterSpacing: '-0.02em', margin: 0, fontFamily: clashDisplay,
                        display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap',
                    }}>
                        My Journey
                        {report?.week_start && (
                            <span style={{
                                fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)',
                                fontFamily: satoshi, letterSpacing: 0,
                            }}>
                                Week of {report.week_start}
                            </span>
                        )}
                    </h1>
                </div>

                {/* Tabs — pill segmented control */}
                <div style={{
                    display: 'flex', gap: '2px', background: 'var(--bg-surface)',
                    borderRadius: '100px', padding: '4px', border: '1px solid var(--border-subtle)',
                    flexShrink: 0,
                }}>
                    {(['overview', 'archive'] as const).map(tab => (
                        <button
                            key={tab}
                            data-tour={tab === 'archive' ? 'archive-tab' : undefined}
                            onClick={() => tab === 'archive' ? handleArchiveTab() : setActiveTab('overview')}
                            style={{
                                padding: '7px 16px', borderRadius: '100px', border: 'none',
                                background: activeTab === tab ? 'var(--btn-primary-bg)' : 'transparent',
                                color: activeTab === tab ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                transition: 'all 0.18s',
                                fontFamily: satoshi,
                                textTransform: 'capitalize',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </motion.div>

            {/* ── Body ── */}
            <div className="journey-body-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px clamp(16px, 4vw, 28px) 60px' }}>
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                display: 'flex', flexDirection: 'column', gap: '16px',
                                maxWidth: '820px', margin: '0 auto', width: '100%',
                            }}
                        >
                            {/* ── Voice recorder — the hero of this page ── */}
                            <div style={{
                                borderRadius: '24px', padding: '36px 28px 32px',
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-subtle)',
                                boxShadow: 'var(--shadow-sm)',
                                position: 'relative', overflow: 'hidden',
                            }}>
                                {/* Ambient glow behind the mic — same treatment as Goal Start */}
                                <div style={{
                                    position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
                                    width: '520px', height: '300px', pointerEvents: 'none',
                                    background: 'radial-gradient(closest-side, var(--glass-hover), transparent 72%)',
                                }} />
                                {todayEntry && (
                                    <div style={{
                                        position: 'absolute', top: '18px', right: '18px',
                                        width: '36px', height: '36px', borderRadius: '50%',
                                        background: `${emotionColor(todayEntry.emotion_label)}15`,
                                        border: `2px solid ${emotionColor(todayEntry.emotion_label)}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <div style={{
                                            width: '12px', height: '12px', borderRadius: '50%',
                                            background: emotionColor(todayEntry.emotion_label),
                                        }} />
                                    </div>
                                )}
                                <div style={{ textAlign: 'center', marginBottom: '22px', position: 'relative' }}>
                                    <p style={{
                                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em',
                                        textTransform: 'uppercase', color: 'var(--accent-primary)',
                                        margin: '0 0 8px', fontFamily: satoshi,
                                    }}>
                                        {noActiveWeek ? 'Between weeks' : todayEntry ? 'Today logged' : 'Tonight\'s ritual'}
                                    </p>
                                    <p style={{
                                        fontSize: '21px', fontWeight: 600, color: 'var(--text-primary)',
                                        margin: '0 0 6px', fontFamily: clashDisplay, letterSpacing: '-0.01em',
                                    }}>
                                        {noActiveWeek
                                            ? 'No active week right now'
                                            : todayEntry ? `Feeling ${todayEntry.emotion_label} — ${todayEntry.emotion_score}/10` : 'How did today actually go?'}
                                    </p>
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontFamily: satoshi, lineHeight: 1.6, maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
                                        {noActiveWeek
                                            ? 'Your journal is locked because no week is committed — it unlocks the moment your next week starts. Meanwhile the small mic below logs a quick mood: just for you, it joins no report.'
                                            : todayEntry
                                                ? 'Captured. Your mentor folds this into your week report.'
                                                : '60 honest seconds. Your mentor listens, reads the mood, and shapes next week around it.'}
                                    </p>
                                </div>

                                <div data-tour="journey-mic" style={{ display: 'flex', justifyContent: 'center', marginBottom: justSaved ? '16px' : '0' }}>
                                    <AnimatePresence mode="wait">
                                        {isUploading ? (
                                            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: satoshi }}>
                                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                                Analyzing your mood...
                                            </motion.div>
                                        ) : isRecording ? (
                                            <motion.button key="stop-live"
                                                initial={{ scale: 0.8 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }}
                                                onClick={stopRecording}
                                                style={{
                                                    width: '88px', height: '88px', borderRadius: '50%',
                                                    border: '2px solid rgba(239,68,68,0.4)',
                                                    background: 'rgba(239,68,68,0.12)',
                                                    color: '#f87171', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    animation: 'pulse-rec 1.4s ease-in-out infinite',
                                                }}>
                                                <Square size={28} fill="#f87171" />
                                            </motion.button>
                                        ) : noActiveWeek ? (
                                            // Between weeks: the journal is locked (and says why), and a
                                            // separate mood-only mic takes over — connected to nothing.
                                            <motion.div key="between-weeks"
                                                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                                                style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: '36px',
                                                    justifyContent: 'center', flexWrap: 'wrap',
                                                }}
                                            >
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '150px' }}>
                                                    <div style={{
                                                        width: '72px', height: '72px', borderRadius: '50%',
                                                        border: '2px solid var(--border-subtle)',
                                                        background: 'var(--bg-surface)',
                                                        color: 'var(--text-muted)', cursor: 'not-allowed',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Lock size={22} />
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: satoshi, textAlign: 'center', lineHeight: 1.5 }}>
                                                        Journal locked — unlocks with your next week
                                                    </span>
                                                </div>
                                                <div data-tour="mood-mic" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '150px' }}>
                                                    <motion.button
                                                        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                                                        onClick={beginMood}
                                                        aria-label="Record a mood check-in"
                                                        style={{
                                                            width: '72px', height: '72px', borderRadius: '50%',
                                                            border: '2px solid var(--accent-primary)',
                                                            background: 'var(--glass-hover)',
                                                            color: 'var(--accent-primary)', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                        <Mic size={26} />
                                                    </motion.button>
                                                    <span style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 700, fontFamily: satoshi, textAlign: 'center', lineHeight: 1.5 }}>
                                                        Mood check-in — unlocked
                                                    </span>
                                                </div>
                                            </motion.div>
                                        ) : (weekInfo?.week_start && today < weekInfo.week_start) ? (
                                            // Week hasn't started yet (e.g. next week locked on Sunday, starts Monday).
                                            // Lock the mic so no entry is logged before the week officially begins.
                                            <motion.div key="not-started"
                                                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}
                                            >
                                                <div style={{
                                                    width: '60px', height: '60px', borderRadius: '50%',
                                                    border: '2px solid rgba(30,30,30,0.08)',
                                                    background: 'var(--bg-surface)',
                                                    color: 'var(--text-muted)', cursor: 'not-allowed',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <Lock size={18} />
                                                </div>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: satoshi, textAlign: 'center' }}>
                                                    Starts {weekInfo.week_start}
                                                </span>
                                            </motion.div>
                                        ) : micLocked ? (
                                            <motion.div key="locked"
                                                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                                style={{
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', gap: '8px',
                                                }}
                                            >
                                                <div style={{
                                                    width: '60px', height: '60px', borderRadius: '50%',
                                                    border: '2px solid rgba(30,30,30,0.08)',
                                                    background: 'var(--bg-surface)',
                                                    color: 'var(--text-muted)', cursor: 'not-allowed',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <Lock size={18} />
                                                </div>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: satoshi }}>
                                                    Recorded today
                                                </span>
                                            </motion.div>
                                        ) : (
                                            <motion.div key="record" style={{ position: 'relative', display: 'flex' }}>
                                                {/* Breathing rings — pull the eye to the one action that matters */}
                                                <motion.span
                                                    animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
                                                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                                                    style={{
                                                        position: 'absolute', inset: 0, borderRadius: '50%',
                                                        border: '1.5px solid var(--accent-primary)', pointerEvents: 'none',
                                                    }}
                                                />
                                                <motion.span
                                                    animate={{ scale: [1, 1.45], opacity: [0.45, 0] }}
                                                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut', delay: 1.1 }}
                                                    style={{
                                                        position: 'absolute', inset: 0, borderRadius: '50%',
                                                        border: '1.5px solid var(--accent-primary)', pointerEvents: 'none',
                                                    }}
                                                />
                                                <motion.button
                                                    initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                                                    whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                                                    onClick={beginJournal}
                                                    style={{
                                                        width: '88px', height: '88px', borderRadius: '50%',
                                                        border: 'none',
                                                        background: 'var(--btn-primary-bg)',
                                                        color: 'var(--btn-primary-text)', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: 'var(--shadow-lg)',
                                                    }}>
                                                    <Mic size={32} />
                                                </motion.button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <AnimatePresence>
                                    {moodResult && (
                                        <motion.div
                                            key="mood-result"
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            style={{
                                                marginTop: '16px',
                                                padding: '12px 16px', borderRadius: '12px',
                                                background: 'var(--glass-hover)',
                                                border: '1px solid var(--border-subtle)',
                                                fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6,
                                                fontFamily: satoshi,
                                            }}>
                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                                Mood noted — {moodResult.emotion_label} ({moodResult.emotion_score}/10)
                                            </span>
                                            {' — '}{moodResult.one_liner}
                                            <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                                Just for you — this joins no report. Your journal unlocks when the next week is committed.
                                            </span>
                                        </motion.div>
                                    )}
                                    {justSaved && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            style={{
                                                marginTop: '12px',
                                                padding: '10px 14px', borderRadius: '10px',
                                                background: `${emotionColor(justSaved.emotion_label)}10`,
                                                border: `1px solid ${emotionColor(justSaved.emotion_label)}30`,
                                                fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5,
                                                fontFamily: satoshi,
                                            }}>
                                            <span style={{ fontWeight: 600, color: emotionColor(justSaved.emotion_label) }}>
                                                {justSaved.emotion_label} ({justSaved.emotion_score}/10)
                                            </span>
                                            {' — '}{justSaved.one_liner}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div style={{
                                borderRadius: '20px', padding: '20px 24px',
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-subtle)',
                                boxShadow: 'var(--shadow-sm)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <p style={{
                                        fontSize: '10px', fontWeight: 800, color: 'var(--accent-primary)',
                                        textTransform: 'uppercase', letterSpacing: '0.14em', margin: 0,
                                        fontFamily: satoshi,
                                    }}>
                                        {weekInfo?.has_plan ? `Your week · Week ${weekInfo.current_week}` : 'This week'}
                                    </p>
                                    {weekInfo?.has_plan && weekInfo.week_start && weekInfo.week_end && (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: satoshi }}>
                                            {weekInfo.week_start} – {weekInfo.week_end}
                                        </span>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <WeekCalendar days={weekDays} today={today} planStartDate={weekInfo?.week_start ?? weekInfo?.plan_start_date} />
                                </div>
                                {/* Legend row — separate from Plan button for clean layout */}
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: satoshi }}>Logged</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #ef4444' }} />
                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: satoshi }}>Missed</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #b6b5b5' }} />
                                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontFamily: satoshi }}>Upcoming</span>
                                    </div>
                                    {weekInfo?.has_plan && !weekInfo.is_week_complete && weekInfo.week_end && (
                                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: satoshi }}>
                                            Week ends {weekInfo.week_end}
                                        </span>
                                    )}
                                </div>
                                {/* Plan Week N+1 button — own row for breathing room */}
                                {weekInfo?.has_plan && weekInfo.is_week_complete && weekInfo.has_report && !weekInfo.has_next_plan && !goalFinished && (
                                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                                        <button
                                            onClick={() => {
                                                const nextWeek = (weekInfo.current_week ?? 1) + 1;
                                                window.dispatchEvent(new CustomEvent('request-next-week-plan', { detail: { week: nextWeek } }));
                                            }}
                                            style={{
                                                padding: '8px 20px',
                                                borderRadius: '100px',
                                                border: 'none',
                                                background: 'var(--text-primary)',
                                                color: 'var(--bg-primary)', fontSize: '12px', fontWeight: 700,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                fontFamily: satoshi,
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                                            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                        >
                                            Plan Week {(weekInfo.current_week ?? 1) + 1}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* ── Weekly Report — only shown when week is complete ── */}
                            {(() => {
                                const isWeekComplete = weekInfo?.week_end
                                    ? today >= weekInfo.week_end
                                    : (weekInfo?.is_week_complete ?? false);
                                return (
                                    <>
                                        {!isWeekComplete && !goalFinished && weekDays.some(d => d.has_journal) && (
                                            <div style={{
                                                borderRadius: '18px', padding: '18px 20px',
                                                background: 'var(--card-bg)',
                                                border: '1px solid var(--border-subtle)',
                                                textAlign: 'center', lineHeight: 1.6,
                                            }}>
                                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontFamily: satoshi }}>
                                                    Great start! Keep logging each day.
                                                </p>
                                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0', fontFamily: satoshi }}>
                                                    Your full AI week review will appear after {weekInfo?.week_end ?? 'the last day'}.
                                                </p>
                                            </div>
                                        )}
                                        {loadingReport ? (
                                            <div style={{
                                                borderRadius: '18px', padding: '32px', textAlign: 'center',
                                                background: 'var(--card-bg)',
                                                border: '1px solid var(--border-subtle)',
                                                color: 'var(--text-muted)', fontSize: '13px',
                                                fontFamily: satoshi,
                                            }}>
                                                Generating week report...
                                            </div>
                                        ) : !isWeekComplete ? null
                                            : report?.status === 'no_data' ? (
                                                <div style={{
                                                    borderRadius: '18px', padding: '28px', textAlign: 'center',
                                                    background: 'var(--card-bg)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6,
                                                    fontFamily: satoshi,
                                                }}>
                                                    {goalFinished ? (
                                                        <>This goal is finished — no new review is written for it.<br />Reviews from before you finished are in the archive below.</>
                                                    ) : (
                                                        <>Record voice journals across the week.<br />At the end of the week, your AI performance review will appear here.</>
                                                    )}
                                                </div>
                                            ) : (report?.status === 'in_progress' || report?.status === 'waiting_for_sunday_entry') ? (
                                                <div style={{
                                                    borderRadius: '18px', padding: '28px', textAlign: 'center',
                                                    background: 'var(--card-bg)',
                                                    border: '1px solid var(--border-subtle)',
                                                    lineHeight: 1.6,
                                                    fontFamily: satoshi,
                                                }}>
                                                    <p style={{ fontSize: '20px', margin: '0 0 8px' }}>🎯</p>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>
                                                        Week complete! One last step.
                                                    </p>
                                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                                        Record today's voice journal to unlock your weekly review.
                                                    </p>
                                                </div>
                                            ) : reportData ? (
                                                <WeekReviewStory
                                                    report={reportData}
                                                    days={weekDays}
                                                    weekStart={report?.week_start}
                                                    weekEnd={report?.week_end}
                                                    onPlanNext={(!weekInfo?.has_next_plan && !goalFinished) ? () => {
                                                        window.dispatchEvent(new CustomEvent('request-next-week-plan', { detail: { week: (reportData.week_number ?? 1) + 1 } }));
                                                        setTimeout(() => window.dispatchEvent(new CustomEvent('close-journey')), 100);
                                                    } : undefined}
                                                />
                                            ) : null}
                                    </>
                                );
                            })()}
                        </motion.div>
                    ) : (
                        /* ── Archive tab ── */
                        <motion.div
                            key="archive"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            style={{ maxWidth: '820px', margin: '0 auto', width: '100%' }}
                        >
                            <p style={{
                                fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px',
                                fontFamily: satoshi,
                            }}>
                                Session Weekly Reports
                            </p>

                            {loadingArchive ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: satoshi }}>
                                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                                    Loading archive...
                                </div>
                            ) : archivedReports.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '40px',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '12px', color: 'var(--text-secondary)', fontSize: '13px',
                                    background: 'var(--card-bg)', fontFamily: satoshi,
                                }}>
                                    No weekly reports found for this session yet.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {archivedReports.map((aw) => {
                                        const isExpanded = expandedWeek === aw.week_number;
                                        const arConsistency = aw.report?.consistency_score ?? 0;
                                        return (
                                            <div
                                                key={aw.week_number}
                                                style={{
                                                    borderRadius: '18px',
                                                    border: isExpanded ? '1px solid rgba(30,30,30,0.1)' : '1px solid rgba(30,30,30,0.06)',
                                                    background: 'var(--card-bg)',
                                                    overflow: 'hidden',
                                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                                    boxShadow: isExpanded ? '0 2px 12px rgba(30,30,30,0.06)' : 'none',
                                                }}
                                            >
                                                {/* Archive card header */}
                                                <button
                                                    onClick={() => setExpandedWeek(isExpanded ? null : aw.week_number)}
                                                    style={{
                                                        width: '100%', padding: '16px 18px', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'space-between',
                                                        background: 'transparent', border: 'none',
                                                    color: 'var(--text-primary)', cursor: 'pointer',
                                                        fontFamily: satoshi,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        <div style={{
                                                            width: '38px', height: '38px', borderRadius: '10px',
                                                            background: 'var(--bg-surface)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'background 0.2s',
                                                        }}>
                                                            {isExpanded
                                                                ? <BookOpen size={16} color="var(--text-primary)" />
                                                                : <FileText size={16} color="var(--text-secondary)" />
                                                            }
                                                        </div>
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.02em', fontFamily: clashDisplay, color: 'var(--text-primary)' }}>Week {aw.week_number} Report</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: satoshi }}>
                                                                {aw.week_start} – {aw.week_end}
                                                                {aw.report?.consistency_score !== undefined && (
                                                                    <span style={{ marginLeft: '10px', color: arConsistency >= 70 ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
                                                                        {arConsistency}% consistency
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                                        <ChevronDown size={16} color="var(--text-muted)" />
                                                    </motion.div>
                                                </button>

                                                {/* Expanded content */}
                                                <AnimatePresence>
                                                    {isExpanded && (
                                                        <motion.div
                                                            key={`expanded-${aw.week_number}`}
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                                                            style={{ overflow: 'hidden' }}
                                                        >
                                                            <div style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border-subtle)' }}>
                                                                {aw.report ? (
                                                                    <WeekReviewStory report={aw.report} days={aw.report.days ?? []} weekStart={aw.week_start} weekEnd={aw.week_end} compact />
                                                                ) : null}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                @keyframes pulse-rec {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3); }
                    50% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
