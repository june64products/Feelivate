import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, ArrowLeft, Lock, ChevronDown, FileText, Sparkles, Trophy } from 'lucide-react';
import {
    getJournalsForSession,
    getWeeklyReport,
    getWeekInfo,
    getSessionReports,
    uploadVoiceJournalForSession,
    type JournalEntry,
    type WeeklyReport,
    type WeeklyReportDay,
    type WeekInfo,
    type ArchivedWeekReport,
} from '../api';
import LockedWeeksPanel from '../components/workspace/LockedWeeksPanel';

// ─── Emotion color palette ────────────────────────────────────────────────────
const EMOTION_COLORS: Record<string, string> = {
    motivated:   '#f59e0b',
    stressed:    '#ef4444',
    focused:     '#6366f1',
    anxious:     '#f97316',
    confident:   '#10b981',
    drained:     '#8b5cf6',
    excited:     '#ec4899',
    neutral:     '#6b7280',
    frustrated:  '#dc2626',
    hopeful:     '#22c55e',
};
const emotionColor = (label?: string | null) =>
    EMOTION_COLORS[label ?? 'neutral'] ?? '#6b7280';

// ─── Emotion Pie Chart (SVG, no library) ─────────────────────────────────────
function EmotionPieChart({ days }: { days: WeeklyReportDay[] }) {
    const recorded = days.filter(d => d.has_journal && d.emotion);
    if (recorded.length === 0) return null;

    // Count each emotion
    const counts: Record<string, { count: number; color: string }> = {};
    recorded.forEach(d => {
        const label = d.emotion ?? 'neutral';
        if (!counts[label]) counts[label] = { count: 0, color: emotionColor(label) };
        counts[label].count++;
    });
    const total = recorded.length;
    const entries = Object.entries(counts);

    // Build SVG pie slices
    const cx = 70; const cy = 70; const r = 54;
    let startAngle = -Math.PI / 2;
    const slices: { path: string; color: string; label: string; pct: number }[] = [];
    entries.forEach(([label, { count, color }]) => {
        const angle = (count / total) * 2 * Math.PI;
        const endAngle = startAngle + angle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = angle > Math.PI ? 1 : 0;
        slices.push({
            path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`,
            color,
            label,
            pct: Math.round((count / total) * 100),
        });
        startAngle = endAngle;
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
                {slices.map((s, i) => (
                    <motion.path
                        key={s.label}
                        d={s.path}
                        fill={s.color}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                        style={{ transformOrigin: '70px 70px', filter: `drop-shadow(0 0 6px ${s.color}55)` }}
                    />
                ))}
                {/* Center donut hole */}
                <circle cx={cx} cy={cy} r={30} fill="#0a0a0b" />
                <text x={cx} y={cy - 4} textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Inter, sans-serif">
                    {total}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="Inter, sans-serif">
                    days
                </text>
            </svg>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {slices.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: s.color, flexShrink: 0,
                            boxShadow: `0 0 6px ${s.color}`,
                        }} />
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.75)', fontWeight: 500, textTransform: 'capitalize' }}>
                            {s.label}
                        </span>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginLeft: 'auto', paddingLeft: '8px' }}>
                            {s.pct}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Consistency ring (SVG, no library) ──────────────────────────────────────
function ConsistencyRing({ score, doneCount, totalCount }: { score: number; doneCount: number; totalCount: number }) {
    const r = 46;
    const circ = 2 * Math.PI * r;
    const filled = circ * (score / 100);
    const ringColor = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                {/* Background ring */}
                <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                {/* Progress ring */}
                <motion.circle
                    cx="60" cy="60" r={r}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - filled }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: '60px 60px', transform: 'rotate(-90deg)' }}
                />
                {/* Score text */}
                <text x="60" y="56" textAnchor="middle" fill="white" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">
                    {score}%
                </text>
                <text x="60" y="73" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="10" fontFamily="Inter, sans-serif">
                    consistency
                </text>
            </svg>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                    {doneCount} of {totalCount} days completed
                </p>
            </div>
        </div>
    );
}

// ─── Emotional arc bar chart (SVG, no library) ────────────────────────────────
function EmotionChart({ days }: { days: WeeklyReportDay[] }) {
    const chartH = 80;
    const barW = 28;
    const gap = 8;
    const totalW = days.length * (barW + gap) - gap;

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <svg width="100%" viewBox={`0 0 ${totalW + 4} ${chartH + 32}`} style={{ overflow: 'visible' }}>
            {days.map((d, i) => {
                const score = d.score ?? 0;
                const hasJournal = d.has_journal;
                const barH = hasJournal ? Math.max(6, Math.round((score / 10) * chartH)) : 0;
                const x = i * (barW + gap);
                const y = chartH - barH;
                const color = hasJournal ? emotionColor(d.emotion) : 'rgba(255,255,255,0.08)';
                const dayName = dayNames[i] ?? `D${i + 1}`;

                return (
                    <g key={d.date}>
                        {/* Background slot */}
                        <rect x={x} y={0} width={barW} height={chartH} rx={4} fill="rgba(255,255,255,0.04)" />
                        {/* Score bar */}
                        <motion.rect
                            x={x} y={chartH} width={barW} height={0} rx={4} fill={color}
                            initial={{ y: chartH, height: 0 }}
                            animate={{ y, height: barH }}
                            transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        />
                        {/* Day label */}
                        <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                            fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="Inter, sans-serif">
                            {dayName}
                        </text>
                        {/* Score label on top of bar */}
                        {hasJournal && score > 0 && (
                            <motion.text
                                x={x + barW / 2} y={y - 4} textAnchor="middle"
                                fill={color} fontSize="9" fontWeight="700" fontFamily="Inter, sans-serif"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.06 + 0.5 }}
                            >
                                {score}
                            </motion.text>
                        )}
                    </g>
                );
            })}
        </svg>
    );
}

// ─── 7-day calendar strip ─────────────────────────────────────────────────────
function WeekCalendar({ days, today, planStartDate }: { days: WeeklyReportDay[]; today: string; planStartDate?: string }) {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
        }}>
            {days.map((d, i) => {
                const isBeforePlan = planStartDate ? d.date < planStartDate : false;
                const isPast = d.date < today;
                const isToday = d.date === today;
                const hasDone = d.has_journal;
                const isMissed = !isBeforePlan && isPast && !hasDone && !isToday;
                const color = hasDone ? emotionColor(d.emotion) : isMissed ? '#ef4444' : 'rgba(255,255,255,0.15)';

                return (
                    <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                            {dayNames[i]}
                        </span>
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            title={d.date}
                            style={{
                                width: '28px', height: '28px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: hasDone ? `${color}22` : 'transparent',
                                border: `2px solid ${color}`,
                                boxShadow: hasDone ? `0 0 8px ${color}40` : 'none',
                                position: 'relative',
                            }}
                        >
                            {hasDone && (
                                <div style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: color,
                                    boxShadow: `0 0 6px ${color}`,
                                }} />
                            )}
                            {isMissed && (
                                <div style={{
                                    width: '8px', height: '8px', borderRadius: '50%',
                                    background: 'rgba(239,68,68,0.3)',
                                }} />
                            )}
                            {isBeforePlan && !hasDone && (
                                <div style={{
                                    width: '12px', height: '2px', borderRadius: '2px',
                                    background: 'rgba(255,255,255,0.15)',
                                }} />
                            )}
                            {isToday && !hasDone && !isBeforePlan && (
                                <div style={{
                                    width: '5px', height: '5px', borderRadius: '50%',
                                    background: 'rgba(255,255,255,0.4)',
                                }} />
                            )}
                        </motion.div>
                        {hasDone && (
                            <span style={{ fontSize: '8px', color, fontWeight: 600 }}>
                                {d.score}/10
                            </span>
                        )}
                        {isMissed && (
                            <span style={{ fontSize: '8px', color: '#ef4444', fontWeight: 500, opacity: 0.7 }}>
                                missed
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontSize: '24px', fontWeight: 700, color: color ?? 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
            {sub && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{sub}</span>}
        </div>
    );
}

// ─── Analysis block ───────────────────────────────────────────────────────────
function AnalysisBlock({ label, content }: { label: string; content: string }) {
    if (!content) return null;
    return (
        <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
        }}>
            <p style={{
                fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
            }}>{label}</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>{content}</p>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface JourneyPageProps {
    userId: string;
    sessionId?: string;
    onJournalSaved?: (entry: JournalEntry) => void;
    onClose?: () => void;
}

export default function JourneyPage({ userId, sessionId, onJournalSaved, onClose }: JourneyPageProps) {
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
    const [archivedReports, setArchivedReports] = useState<ArchivedWeekReport[]>([]);
    const [loadingReport, setLoadingReport] = useState(true);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'archive'>('overview');
    const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

    // Mic lock — one recording per day per session
    // Use en-CA locale date (YYYY-MM-DD in local TZ) to match client_date sent to backend
    const micLockKey = `last_journal_date_${sessionId || userId}`;
    const [micLocked, setMicLocked] = useState<boolean>(() => {
        const stored = localStorage.getItem(micLockKey);
        return stored === new Date().toLocaleDateString('en-CA');
    });
    const [showWeekEndCelebration, setShowWeekEndCelebration] = useState(false);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [justSaved, setJustSaved] = useState<JournalEntry | null>(null);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Use local timezone date to avoid UTC vs IST mismatch
    const today = new Date().toLocaleDateString('en-CA');

    useEffect(() => { loadAll(); }, [userId, sessionId]);

    const loadAll = async () => {
        try {
            const [j, r, wi] = await Promise.all([
                // Fetch journals scoped to this session so the orb/journey
                // only shows the current active plan's data.
                getJournalsForSession(userId, sessionId),
                getWeeklyReport(userId, sessionId).catch(() => null),
                sessionId ? getWeekInfo(sessionId).catch(() => null) : Promise.resolve(null),
            ]);
            setJournals(j);
            setReport(r);
            setWeekInfo(wi);
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

    const handleUpload = async () => {
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
            // Lock mic for the rest of today (use local TZ date to match backend)
            localStorage.setItem(micLockKey, today);
            setMicLocked(true);
            // Refresh report after new journal
            setLoadingReport(true);
            const r = await getWeeklyReport(userId, sessionId).catch(() => null);
            if (r) {
                setReport(r);
                // Refresh weekInfo to check if this was the last day of the week
                const wi = sessionId ? await getWeekInfo(sessionId).catch(() => null) : null;
                if (wi) setWeekInfo(wi);
                // If today is the last day of the plan week, celebrate!
                const isLastDay = wi?.week_end ? today >= wi.week_end : false;
                if (isLastDay && r.status !== 'no_data') {
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

    const todayEntry = journals.find(j => j.date === today);
    const reportData = report?.report;

    // Build day structure — ALWAYS anchor to the Monday of today's physical week
    // so that today's voice journal always appears on the correct day in the calendar.
    // planStartDate is used only to visually cross out pre-plan days.
    const weekDays: WeeklyReportDay[] = (() => {
        if (reportData?.days && reportData.days.length > 0) return reportData.days;
        const jMap: Record<string, JournalEntry> = {};
        journals.forEach(j => { jMap[j.date] = j; });

        // Always use the Monday of the current physical week (local date)
        const todayLocal = new Date();
        const startDate = new Date(todayLocal);
        const dow = startDate.getDay() || 7; // Mon=1..Sun=7
        startDate.setDate(startDate.getDate() - dow + 1);

        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);
            const dateStr = day.toISOString().split('T')[0];
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

    const consistencyScore = reportData?.consistency_score ?? 0;
    const avgScore = reportData?.avg_score ?? 0;
    const daysDone = reportData?.days_done ?? weekDays.filter(d => d.has_journal).length;
    const daysMissed = reportData?.days_missed ?? weekDays.filter(d => !d.has_journal && d.date < today).length;

    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', height: '100%',
            background: 'var(--bg-primary)', overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Floating locked weeks panel — right edge */}
            <LockedWeeksPanel
                sessionId={sessionId}
                currentWeek={weekInfo?.current_week ?? 1}
                micLocked={micLocked}
            />

            {/* ── Week-End Celebration Modal ── */}
            <AnimatePresence>
                {showWeekEndCelebration && reportData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(0,0,0,0.85)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '20px',
                        }}
                        onClick={() => setShowWeekEndCelebration(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.85, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 22, stiffness: 250, delay: 0.05 }}
                            onClick={e => e.stopPropagation()}
                            style={{
                                width: '100%', maxWidth: '500px',
                                maxHeight: '90vh',
                                background: 'linear-gradient(145deg, #0d0d10 0%, #13131a 100%)',
                                border: '1px solid rgba(99,102,241,0.3)',
                                borderRadius: '24px',
                                boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(99,102,241,0.12)',
                                overflow: 'hidden',
                                display: 'flex', flexDirection: 'column',
                            }}
                        >
                            {/* Glow header */}
                            <div style={{
                                padding: '28px 28px 20px',
                                background: 'linear-gradient(180deg, rgba(99,102,241,0.15) 0%, transparent 100%)',
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                textAlign: 'center',
                                position: 'relative',
                            }}>
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                    style={{ display: 'inline-block', marginBottom: '12px' }}
                                >
                                    <Trophy size={40} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 16px #f59e0b88)' }} />
                                </motion.div>
                                <h2 style={{
                                    fontSize: '22px', fontWeight: 800, color: 'white',
                                    letterSpacing: '-0.03em', margin: '0 0 6px',
                                    fontFamily: "'Inter', sans-serif",
                                }}>
                                    Week {reportData.week_number} Complete! 🎉
                                </h2>
                                {reportData.week_theme && (
                                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                                        {reportData.week_theme}
                                    </p>
                                )}
                            </div>

                            {/* Body — scrollable */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                                {/* Stats row */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{
                                        padding: '14px', borderRadius: '14px',
                                        background: 'rgba(16,185,129,0.08)',
                                        border: '1px solid rgba(16,185,129,0.18)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981', letterSpacing: '-0.03em' }}>
                                            {reportData.consistency_score}%
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>Consistency</div>
                                    </div>
                                    <div style={{
                                        padding: '14px', borderRadius: '14px',
                                        background: 'rgba(99,102,241,0.08)',
                                        border: '1px solid rgba(99,102,241,0.18)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#818cf8', letterSpacing: '-0.03em' }}>
                                            {reportData.avg_score}/10
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>Avg Mood</div>
                                    </div>
                                    <div style={{
                                        padding: '14px', borderRadius: '14px',
                                        background: 'rgba(245,158,11,0.08)',
                                        border: '1px solid rgba(245,158,11,0.18)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b', letterSpacing: '-0.03em' }}>
                                            {reportData.days_done}/{reportData.past_days_count ?? 7}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '3px' }}>Days Done</div>
                                    </div>
                                </div>

                                {/* Emotion Pie Chart */}
                                <div style={{
                                    padding: '16px', borderRadius: '14px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.07)',
                                    marginBottom: '14px',
                                }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px' }}>Emotion Distribution</p>
                                    <EmotionPieChart days={weekDays} />
                                </div>

                                {/* Key insight */}
                                {reportData.hidden_insight && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: '12px',
                                        background: 'rgba(99,102,241,0.08)',
                                        border: '1px solid rgba(99,102,241,0.2)',
                                        marginBottom: '14px',
                                    }}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(99,102,241,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Hidden Insight</p>
                                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, margin: 0 }}>{reportData.hidden_insight}</p>
                                    </div>
                                )}

                                {/* Next week focus */}
                                {reportData.next_week_focus && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: '12px',
                                        background: 'rgba(16,185,129,0.07)',
                                        border: '1px solid rgba(16,185,129,0.2)',
                                        marginBottom: '14px',
                                    }}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(16,185,129,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Key Focus for Next Week</p>
                                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.6, margin: 0 }}>{reportData.next_week_focus}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer CTA */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                display: 'flex', gap: '10px',
                            }}>
                                <button
                                    onClick={() => setShowWeekEndCelebration(false)}
                                    style={{
                                        flex: 1, padding: '11px', borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'transparent', color: 'rgba(255,255,255,0.5)',
                                        fontSize: '13px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                    }}
                                >
                                    View Full Report
                                </button>
                                <button
                                    onClick={() => {
                                        setShowWeekEndCelebration(false);
                                        const event = new CustomEvent('request-next-week-plan', {
                                            detail: { week: (reportData.week_number || 1) + 1 }
                                        });
                                        window.dispatchEvent(event);
                                        setTimeout(() => window.dispatchEvent(new CustomEvent('close-journey')), 100);
                                    }}
                                    style={{
                                        flex: 1, padding: '11px', borderRadius: '12px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        color: 'white', fontSize: '13px', fontWeight: 700,
                                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                        boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                                    }}
                                >
                                    Plan Week {(reportData.week_number || 1) + 1} →
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* ── Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                flexShrink: 0,
            }}>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: 'none', background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
                <div style={{ flex: 1 }}>
                    <h1 style={{
                        fontSize: '16px', fontWeight: 700, color: 'white',
                        letterSpacing: '-0.02em', margin: 0,
                    }}>
                        My Journey
                    </h1>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: 0, marginTop: '2px' }}>
                        {report?.week_start && `Week of ${report.week_start}`}
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', padding: '3px' }}>
                    {(['overview', 'archive'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => tab === 'archive' ? handleArchiveTab() : setActiveTab('overview')}
                            style={{
                                padding: '5px 14px', borderRadius: '7px', border: 'none',
                                background: activeTab === tab ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.4)',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: 'var(--font-sans)',
                                textTransform: 'capitalize',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <AnimatePresence mode="wait">
                    {activeTab === 'overview' ? (
                        <motion.div
                            key="overview"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                        >
                            {/* ── Voice recorder card ── */}
                            <div style={{
                                borderRadius: '16px', padding: '20px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 600, color: 'white', margin: 0 }}>
                                            {todayEntry ? 'Today logged' : "Today's voice log"}
                                        </p>
                                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '3px 0 0' }}>
                                            {todayEntry
                                                ? `${todayEntry.emotion_label} — ${todayEntry.emotion_score}/10`
                                                : 'Speak about your day. AI detects your emotion.'}
                                        </p>
                                    </div>
                                    {todayEntry && (
                                        <div style={{
                                            width: '36px', height: '36px', borderRadius: '50%',
                                            background: `${emotionColor(todayEntry.emotion_label)}22`,
                                            border: `2px solid ${emotionColor(todayEntry.emotion_label)}55`,
                                            boxShadow: `0 0 12px ${emotionColor(todayEntry.emotion_label)}40`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <div style={{
                                                width: '12px', height: '12px', borderRadius: '50%',
                                                background: emotionColor(todayEntry.emotion_label),
                                            }} />
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: justSaved ? '16px' : '0' }}>
                                    <AnimatePresence mode="wait">
                                        {isUploading ? (
                                            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                                Analyzing your mood...
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
                                                    border: '2px solid rgba(255,255,255,0.1)',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    color: '#3f3f46', cursor: 'not-allowed',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <Lock size={18} />
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#3f3f46', fontWeight: 500 }}>
                                                    Recorded today
                                                </span>
                                            </motion.div>
                                        ) : isRecording ? (
                                            <motion.button key="stop"
                                                initial={{ scale: 0.8 }} animate={{ scale: 1 }} whileTap={{ scale: 0.95 }}
                                                onClick={stopRecording}
                                                style={{
                                                    width: '60px', height: '60px', borderRadius: '50%',
                                                    border: '2px solid rgba(239,68,68,0.4)',
                                                    background: 'rgba(239,68,68,0.12)',
                                                    color: '#f87171', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    animation: 'pulse-rec 1.4s ease-in-out infinite',
                                                }}>
                                                <Square size={20} fill="#f87171" />
                                            </motion.button>
                                        ) : (
                                            <motion.button key="record"
                                                initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                                                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                                onClick={startRecording}
                                                style={{
                                                    width: '60px', height: '60px', borderRadius: '50%',
                                                    border: `2px solid ${todayEntry ? 'rgba(99,102,241,0.3)' : 'rgba(192,132,252,0.4)'}`,
                                                    background: `${todayEntry ? 'rgba(99,102,241,0.1)' : 'rgba(192,132,252,0.1)'}`,
                                                    color: 'var(--accent-primary)', cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.2s',
                                                }}>
                                                <Mic size={22} />
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <AnimatePresence>
                                    {justSaved && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                            style={{
                                                marginTop: '12px',
                                                padding: '10px 14px', borderRadius: '10px',
                                                background: `${emotionColor(justSaved.emotion_label)}14`,
                                                border: `1px solid ${emotionColor(justSaved.emotion_label)}30`,
                                                fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5,
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
                                borderRadius: '16px', padding: '18px 20px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <p style={{
                                        fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                        textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
                                    }}>
                                        {weekInfo?.has_plan ? `Week ${weekInfo.current_week}` : 'This Week'}
                                    </p>
                                    {weekInfo?.has_plan && weekInfo.week_start && weekInfo.week_end && (
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
                                            {weekInfo.week_start} – {weekInfo.week_end}
                                        </span>
                                    )}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <WeekCalendar days={weekDays} today={today} planStartDate={weekInfo?.plan_start_date} />
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Logged</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid #ef4444' }} />
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Missed</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)' }} />
                                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>Upcoming</span>
                                    </div>
                                    {/* Plan Week N+1 gating */}
                                    {weekInfo?.has_plan && weekInfo.is_week_complete && (
                                        <button
                                            onClick={() => {
                                                const nextWeek = (weekInfo.current_week ?? 1) + 1;
                                                window.dispatchEvent(new CustomEvent('request-next-week-plan', { detail: { week: nextWeek } }));
                                            }}
                                            style={{
                                                marginLeft: 'auto', padding: '4px 10px',
                                                borderRadius: '8px',
                                                border: '1px solid rgba(99,102,241,0.3)',
                                                background: 'rgba(99,102,241,0.08)',
                                                color: '#818cf8', fontSize: '11px', fontWeight: 600,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                fontFamily: "'Inter', sans-serif",
                                            }}
                                        >
                                            Plan Week {(weekInfo.current_week ?? 1) + 1}
                                        </button>
                                    )}
                                    {weekInfo?.has_plan && !weekInfo.is_week_complete && weekInfo.week_end && (
                                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
                                            Week ends {weekInfo.week_end}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ── Weekly Report ── */}
                            {loadingReport ? (
                                <div style={{
                                    borderRadius: '16px', padding: '32px', textAlign: 'center',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    color: 'rgba(255,255,255,0.3)', fontSize: '13px',
                                }}>
                                    Generating week report...
                                </div>
                            ) : report?.status === 'no_data' ? (
                                <div style={{
                                    borderRadius: '16px', padding: '28px', textAlign: 'center',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    color: 'rgba(255,255,255,0.3)', fontSize: '13px', lineHeight: 1.6,
                                }}>
                                    Record voice journals across the week.<br />
                                    At the end of the week, your AI performance review will appear here.
                                </div>
                            ) : reportData ? (
                                <div style={{
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.02)',
                                    overflow: 'hidden',
                                }}>
                                    {/* Report header */}
                                    <div style={{
                                        padding: '16px 20px',
                                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    }}>
                                        <div>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>
                                                Week {reportData.week_number || 'N'} Review
                                            </p>
                                            {reportData.week_theme && (
                                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                                                    {reportData.week_theme}
                                                </p>
                                            )}
                                        </div>
                                        <span style={{
                                            fontSize: '10px', fontWeight: 700, padding: '3px 10px',
                                            borderRadius: '20px',
                                            background: consistencyScore >= 80 ? 'rgba(16,185,129,0.12)' : consistencyScore >= 50 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)',
                                            color: consistencyScore >= 80 ? '#10b981' : consistencyScore >= 50 ? '#f59e0b' : '#ef4444',
                                        }}>
                                            {report?.week_start} — {report?.week_end}
                                        </span>
                                    </div>

                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                        {/* ── Performance stats row ── */}
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                            <ConsistencyRing score={consistencyScore} doneCount={daysDone} totalCount={reportData.past_days_count ?? 7} />
                                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                <StatCard
                                                    label="Avg Mood"
                                                    value={`${avgScore}/10`}
                                                    sub={reportData.dominant_emotion}
                                                    color={emotionColor(reportData.dominant_emotion)}
                                                />
                                                <StatCard
                                                    label="Days Done"
                                                    value={daysDone}
                                                    sub={`${daysMissed} missed`}
                                                    color={daysDone > daysMissed ? '#10b981' : '#ef4444'}
                                                />
                                            </div>
                                        </div>

                                        {/* ── Emotion Distribution Pie Chart ── */}
                                        {weekDays.some(d => d.has_journal) && (
                                            <div>
                                                <p style={{
                                                    fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px',
                                                }}>Emotion Distribution</p>
                                                <EmotionPieChart days={weekDays} />
                                            </div>
                                        )}

                                        {/* ── Emotional arc chart ── */}
                                        <div>
                                            <p style={{
                                                fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px',
                                            }}>Daily Emotional Arc</p>
                                            <EmotionChart days={weekDays} />
                                            {reportData.emotional_arc && (
                                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginTop: '10px' }}>
                                                    {reportData.emotional_arc}
                                                </p>
                                            )}
                                        </div>

                                        {/* ── AI analysis blocks ── */}
                                        <AnalysisBlock label="What Went Well" content={reportData.what_went_well} />
                                        <AnalysisBlock label="Where You Slipped" content={reportData.where_you_slipped} />
                                        <AnalysisBlock label="Consistency Analysis" content={reportData.consistency_analysis} />
                                        {reportData.hidden_insight && (
                                            <div style={{
                                                padding: '14px 16px', borderRadius: '12px',
                                                background: 'rgba(99,102,241,0.08)',
                                                border: '1px solid rgba(99,102,241,0.2)',
                                            }}>
                                                <p style={{
                                                    fontSize: '10px', fontWeight: 700, color: 'rgba(99,102,241,0.7)',
                                                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
                                                }}>Hidden Insight</p>
                                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>
                                                    {reportData.hidden_insight}
                                                </p>
                                            </div>
                                        )}

                                        {/* ── Next week focus ── */}
                                        {reportData.next_week_focus && (
                                            <div style={{
                                                padding: '16px', borderRadius: '12px',
                                                background: 'rgba(16,185,129,0.07)',
                                                border: '1px solid rgba(16,185,129,0.2)',
                                            }}>
                                                <p style={{
                                                    fontSize: '10px', fontWeight: 700, color: 'rgba(16,185,129,0.7)',
                                                    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px',
                                                }}>Next Week: Key Focus</p>
                                                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0 }}>
                                                    {reportData.next_week_focus}
                                                </p>
                                            </div>
                                        )}

                                        {/* Plan Week N+1 prompt */}
                                        <div style={{
                                            padding: '14px 16px', borderRadius: '12px',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        }}>
                                            <div>
                                                <p style={{ fontSize: '12px', fontWeight: 600, color: 'white', margin: 0 }}>
                                                    Ready for Week {(reportData.week_number || 1) + 1}?
                                                </p>
                                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
                                                    AI will build it using this week's performance data.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    // Communicate back to WorkspacePage to open chat and send a specific prompt
                                                    const event = new CustomEvent('request-next-week-plan', {
                                                        detail: { week: (reportData.week_number || 1) + 1 }
                                                    });
                                                    window.dispatchEvent(event);
                                                    // Close journey
                                                    setTimeout(() => {
                                                        const closeEvent = new CustomEvent('close-journey');
                                                        window.dispatchEvent(closeEvent);
                                                    }, 100);
                                                }}
                                                style={{
                                                    padding: '8px 16px', borderRadius: '10px',
                                                    border: 'none',
                                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                                    flexShrink: 0, fontFamily: 'var(--font-sans)',
                                                    transition: 'opacity 0.2s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                            >
                                                Plan Week {(reportData.week_number || 1) + 1}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </motion.div>
                    ) : (
                        /* ── Archive tab ── */
                        <motion.div
                            key="archive"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            <p style={{
                                fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px',
                            }}>
                                Session Weekly Reports
                            </p>

                            {loadingArchive ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
                                    Loading archive...
                                </div>
                            ) : archivedReports.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '40px',
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    borderRadius: '12px', color: 'rgba(255,255,255,0.3)', fontSize: '13px',
                                }}>
                                    No weekly reports found for this session yet.
                                </div>
                                ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {archivedReports.map((aw) => {
                                        const isExpanded = expandedWeek === aw.week_number;
                                        const arConsistency = aw.report?.consistency_score ?? 0;
                                        const arDaysDone = aw.report?.days_done ?? 0;
                                        const arPastDays = aw.report?.past_days_count ?? 7;
                                        const arDays: WeeklyReportDay[] = aw.report?.days ?? [];
                                        return (
                                            <div
                                                key={aw.week_number}
                                                style={{
                                                    borderRadius: '16px',
                                                    border: isExpanded ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.07)',
                                                    background: isExpanded ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)',
                                                    overflow: 'hidden',
                                                    transition: 'border-color 0.2s, background 0.2s',
                                                }}
                                            >
                                                {/* Archive card header */}
                                                <button
                                                    onClick={() => setExpandedWeek(isExpanded ? null : aw.week_number)}
                                                    style={{
                                                        width: '100%', padding: '16px 18px', display: 'flex',
                                                        alignItems: 'center', justifyContent: 'space-between',
                                                        background: 'transparent', border: 'none',
                                                        color: 'white', cursor: 'pointer',
                                                        fontFamily: "'Inter', sans-serif",
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        <div style={{
                                                            width: '38px', height: '38px', borderRadius: '10px',
                                                            background: isExpanded ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.08)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            transition: 'background 0.2s',
                                                        }}>
                                                            {isExpanded
                                                                ? <Sparkles size={16} color="#818cf8" />
                                                                : <FileText size={16} color="#818cf8" />
                                                            }
                                                        </div>
                                                        <div style={{ textAlign: 'left' }}>
                                                            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '-0.01em' }}>Week {aw.week_number} Report</div>
                                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
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
                                                        <ChevronDown size={16} color="#71717a" />
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
                                                            <div style={{
                                                                padding: '4px 18px 20px',
                                                                borderTop: '1px solid rgba(255,255,255,0.06)',
                                                            }}>
                                                                {/* Stats + ring row */}
                                                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                                    <ConsistencyRing
                                                                        score={arConsistency}
                                                                        doneCount={arDaysDone}
                                                                        totalCount={arPastDays}
                                                                    />
                                                                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                                        <StatCard
                                                                            label="Avg Mood"
                                                                            value={`${aw.report?.avg_score ?? 0}/10`}
                                                                            sub={aw.report?.dominant_emotion}
                                                                            color={emotionColor(aw.report?.dominant_emotion)}
                                                                        />
                                                                        <StatCard
                                                                            label="Days Done"
                                                                            value={`${arDaysDone}/${arPastDays}`}
                                                                            sub={`${aw.report?.days_missed ?? 0} missed`}
                                                                            color={arDaysDone > (aw.report?.days_missed ?? 0) ? '#10b981' : '#ef4444'}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Week theme */}
                                                                {aw.report?.week_theme && (
                                                                    <div style={{
                                                                        marginTop: '14px', padding: '8px 12px', borderRadius: '10px',
                                                                        background: 'rgba(99,102,241,0.07)',
                                                                        border: '1px solid rgba(99,102,241,0.15)',
                                                                        fontSize: '12px', color: '#818cf8', fontWeight: 500,
                                                                    }}>
                                                                        ✦ {aw.report.week_theme}
                                                                    </div>
                                                                )}

                                                                {/* Emotion distribution pie */}
                                                                {arDays.length > 0 && arDays.some(d => d.has_journal) && (
                                                                    <div style={{ marginTop: '16px' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Emotion Distribution</p>
                                                                        <EmotionPieChart days={arDays} />
                                                                    </div>
                                                                )}

                                                                {/* Emotional arc bar chart */}
                                                                {arDays.length > 0 && (
                                                                    <div style={{ marginTop: '16px' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Daily Arc</p>
                                                                        <EmotionChart days={arDays} />
                                                                    </div>
                                                                )}

                                                                {/* AI narrative blocks */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                                                                    {aw.report?.emotional_arc && <AnalysisBlock label="Emotional Arc" content={aw.report.emotional_arc} />}
                                                                    {aw.report?.what_went_well && <AnalysisBlock label="What Went Well" content={aw.report.what_went_well} />}
                                                                    {aw.report?.where_you_slipped && <AnalysisBlock label="Where You Slipped" content={aw.report.where_you_slipped} />}
                                                                    {aw.report?.consistency_analysis && <AnalysisBlock label="Consistency Analysis" content={aw.report.consistency_analysis} />}
                                                                    {aw.report?.hidden_insight && (
                                                                        <div style={{
                                                                            padding: '14px 16px', borderRadius: '12px',
                                                                            background: 'rgba(99,102,241,0.08)',
                                                                            border: '1px solid rgba(99,102,241,0.2)',
                                                                        }}>
                                                                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(99,102,241,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Hidden Insight</p>
                                                                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, margin: 0 }}>{aw.report.hidden_insight}</p>
                                                                        </div>
                                                                    )}
                                                                    {aw.report?.next_week_focus && (
                                                                        <div style={{
                                                                            padding: '14px 16px', borderRadius: '12px',
                                                                            background: 'rgba(16,185,129,0.07)',
                                                                            border: '1px solid rgba(16,185,129,0.2)',
                                                                        }}>
                                                                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(16,185,129,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Next Week Focus</p>
                                                                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0 }}>{aw.report.next_week_focus}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
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
