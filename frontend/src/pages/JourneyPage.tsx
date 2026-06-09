import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, ArrowLeft, Lock, ChevronDown, FileText, Sparkles, Trophy } from 'lucide-react';
import {
    getJournalsForSession,
    getWeeklyReport,
    getWeekInfo,
    getSessionReports,
    getSessionDetail,
    uploadVoiceJournalForSession,
    type JournalEntry,
    type WeeklyReport,
    type WeeklyReportDay,
    type WeekInfo,
    type ArchivedWeekReport,
    getLocalISODate
} from '../api';
import LockedWeeksPanel from '../components/workspace/LockedWeeksPanel';

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
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
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
                <circle cx={cx} cy={cy} r={30} fill="var(--card-bg)" />
                <text x={cx} y={cy - 4} textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700" fontFamily={clashDisplay}>
                    {total}
                </text>
                <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily={satoshi}>
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
                        }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'capitalize', fontFamily: satoshi }}>
                            {s.label}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', paddingLeft: '8px', fontFamily: satoshi }}>
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
    const scoreVal = isNaN(score) ? 0 : score;
    const filled = circ * (Math.min(100, Math.max(0, scoreVal)) / 100);
    const ringColor = scoreVal >= 80 ? '#10b981' : scoreVal >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <svg width="120" height="120" viewBox="0 0 120 120">
                {/* Background ring */}
                <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
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
                <text x="60" y="56" textAnchor="middle" fill="var(--text-primary)" fontSize="22" fontWeight="700" fontFamily={clashDisplay}>
                    {scoreVal}%
                </text>
                <text x="60" y="73" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily={satoshi}>
                    consistency
                </text>
            </svg>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, fontFamily: satoshi }}>
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

    // Helper: parse date string in LOCAL timezone (avoids UTC-midnight shift)
    const parseLocalDate = (dateStr: string) => {
        const [y, mo, dd] = dateStr.split('-').map(Number);
        return new Date(y, mo - 1, dd);
    };

    return (
        <svg width="100%" viewBox={`0 0 ${totalW + 4} ${chartH + 32}`} style={{ overflow: 'visible' }}>
            {days.map((d, i) => {
                const score = d.score ?? 0;
                const hasJournal = d.has_journal;
                const barH = hasJournal ? Math.max(6, Math.round((score / 10) * chartH)) : 0;
                const x = i * (barW + gap);
                const y = chartH - barH;
                const color = hasJournal ? emotionColor(d.emotion) : 'var(--border-medium)';
                const dayDate = parseLocalDate(d.date);
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });

                return (
                    <g key={d.date}>
                        {/* Background slot */}
                        <rect x={x} y={0} width={barW} height={chartH} rx={4} fill="var(--glass-surface)" />
                        {/* Score bar */}
                        <motion.rect
                            x={x} y={chartH} width={barW} height={0} rx={4} fill={color}
                            initial={{ y: chartH, height: 0 }}
                            animate={{ y, height: barH }}
                            transition={{ duration: 0.7, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                        />
                        {/* Day label — aligned to column centre */}
                        <text x={x + barW / 2} y={chartH + 16} textAnchor="middle"
                            fill="var(--text-secondary)" fontSize="9" fontFamily={satoshi}>
                            {dayName}
                        </text>
                        {/* Score label on top of bar */}
                        {hasJournal && score > 0 && (
                            <motion.text
                                x={x + barW / 2} y={y - 4} textAnchor="middle"
                                fill={color} fontSize="9" fontWeight="700" fontFamily={satoshi}
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

// ─── Day-by-Day Rich Plan vs Actual execution breakdown ────────────────────────
function DailyBreakdown({ days }: { days: WeeklyReportDay[] }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            <p style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px',
                fontFamily: satoshi,
            }}>
                Daily Execution Breakdown
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {days.map((d, i) => {
                    const hasDone = d.checkin === 'done' || d.has_journal;
                    const isMissed = d.checkin === 'missed';
                    const statusColor = hasDone ? '#10b981' : isMissed ? '#ef4444' : 'var(--text-muted)';
                    const statusBg = hasDone ? 'rgba(16,185,129,0.08)' : isMissed ? 'rgba(239,68,68,0.08)' : 'var(--glass-surface)';
                    const statusLabel = hasDone ? 'Done' : isMissed ? 'Missed' : 'Upcoming';

                    return (
                        <div key={d.date} style={{
                            padding: '14px 16px',
                            borderRadius: '12px',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        }}>
                            {/* Day Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clashDisplay }}>
                                        {d.day_label || `Day ${i + 1}`}
                                    </span>
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: satoshi }}>
                                        {d.date}
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px',
                                    background: statusBg, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.04em',
                                    fontFamily: satoshi,
                                }}>
                                    {statusLabel}
                                </span>
                            </div>

                            {/* Grid: Plan vs Actual */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="grid-col-1-mobile">
                                {/* Planned Task Column */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: satoshi }}>
                                        Planned Task
                                    </span>
                                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5, fontFamily: satoshi }}>
                                        {d.planned_task || 'No task planned for this day.'}
                                    </p>
                                </div>

                                {/* Actual Outcome Column */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: satoshi }}>
                                        Actual Journal
                                    </span>
                                    {d.has_journal ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{
                                                    width: '6px', height: '6px', borderRadius: '50%',
                                                    background: emotionColor(d.emotion),
                                                }} />
                                                <span style={{ fontSize: '12px', fontWeight: 600, color: emotionColor(d.emotion), textTransform: 'capitalize', fontFamily: satoshi }}>
                                                    {d.emotion} ({d.score}/10)
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic', lineHeight: 1.4, fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                                "{d.one_liner}"
                                            </p>
                                        </div>
                                    ) : (
                                        <p style={{ fontSize: '11.5px', color: isMissed ? '#ef4444' : 'var(--text-muted)', margin: 0, opacity: isMissed ? 0.8 : 0.6, fontFamily: satoshi }}>
                                            {isMissed ? '✕ Missed check-in & voice entry' : '— Pending voice entry'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Coaching Insight if available */}
                            {d.coaching_insight && (
                                <div style={{
                                    marginTop: '4px',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-surface)',
                                    borderLeft: '2px solid #111111',
                                }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '2px', fontFamily: satoshi }}>
                                        AI coaching insight
                                    </span>
                                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45, fontFamily: satoshi }}>
                                        {d.coaching_insight}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── 7-day calendar strip ─────────────────────────────────────────────────────
function WeekCalendar({ days, today, planStartDate }: { days: WeeklyReportDay[]; today: string; planStartDate?: string }) {
    // Parse in local timezone to get correct weekday
    const parseLocalDate = (dateStr: string) => {
        const [y, mo, dd] = dateStr.split('-').map(Number);
        return new Date(y, mo - 1, dd);
    };
    return (
            <div className="mobile-horizontal-scroll" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px',
            }}>
            {days.map((d, i) => {
                const dayDate = parseLocalDate(d.date);
                const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
                const isBeforePlan = planStartDate ? d.date < planStartDate : false;
                const isPast = d.date < today;
                const isToday = d.date === today;
                const hasDone = d.has_journal;
                const isMissed = !isBeforePlan && isPast && !hasDone && !isToday;
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
                            {isBeforePlan && !hasDone && (
                                <div style={{
                                    width: '12px', height: '2px', borderRadius: '2px',
                                    background: 'rgba(30,30,30,0.1)',
                                }} />
                            )}
                            {isToday && !hasDone && !isBeforePlan && (
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

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
    return (
        <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi }}>{label}</span>
            <span style={{ fontSize: '24px', fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: clashDisplay }}>{value}</span>
            {sub && <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: satoshi }}>{sub}</span>}
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
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
        }}>
            <p style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
                fontFamily: satoshi,
            }}>{label}</p>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{content}</p>
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
    const [planHistory, setPlanHistory] = useState<any[]>([]);
    const [currentPlan, setCurrentPlan] = useState<any | null>(null);
    const [loadingReport, setLoadingReport] = useState(true);
    const [loadingArchive, setLoadingArchive] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'archive'>('overview');
    const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

    const [micLocked, setMicLocked] = useState<boolean>(() => {
        const uid = localStorage.getItem('user_id');
        const key = `last_journal_date_${uid}`;
        const stored = localStorage.getItem(key);
        return stored === getLocalISODate();
    });
    const [showWeekEndCelebration, setShowWeekEndCelebration] = useState(false);

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [justSaved, setJustSaved] = useState<JournalEntry | null>(null);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const today = getLocalISODate();

    useEffect(() => { loadAll(); }, [userId, sessionId]);

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
                getJournalsForSession(userId, undefined),
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

            // 5. If we have a journal for today, also set micLocked
            const todayJ = j.find(jj => jj.date === getLocalISODate());
            if (todayJ) {
                setMicLocked(true);
                const uid = localStorage.getItem('user_id');
                const key = `last_journal_date_${uid}`;
                localStorage.setItem(key, getLocalISODate());
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
            const uid = localStorage.getItem('user_id');
            const key = `last_journal_date_${uid}`;
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
                const isLastDay = wi?.week_end ? today === wi.week_end : false;
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

    const reportData = report?.report;

    // Build weekDays — the 7-day calendar for the current week
    const weekDays: WeeklyReportDay[] = (() => {
        // Prefer server-generated per-day data from report (most accurate)
        if (reportData?.days && reportData.days.length > 0) return reportData.days;

        // Fallback: build from local journal data
        const jMap: Record<string, JournalEntry> = {};
        journals.forEach(j => { jMap[j.date] = j; });

        // Anchor to the Monday of today's physical week
        const todayLocal = new Date();
        const dow = todayLocal.getDay() || 7;
        const startDate = new Date(todayLocal);
        startDate.setDate(todayLocal.getDate() - dow + 1);

        return Array.from({ length: 7 }, (_, i) => {
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

    const consistencyScore = reportData?.consistency_score ?? 0;
    const avgScore = reportData?.avg_score ?? 0;
    const daysDone = reportData?.days_done ?? weekDays.filter(d => d.has_journal).length;
    const daysMissed = reportData?.days_missed ?? weekDays.filter(d => !d.has_journal && d.date < today).length;

    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', height: '100%',
            background: 'var(--bg-primary)', overflow: 'hidden',
            position: 'relative',
            overflowY: 'auto',
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

            {/* ── Week-End Celebration Modal ── */}
            <AnimatePresence>
                {showWeekEndCelebration && reportData && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 1000,
                            background: 'rgba(0,0,0,0.5)',
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
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '24px',
                                boxShadow: '0 40px 80px rgba(0,0,0,0.15), 0 0 0 1px rgba(30,30,30,0.04)',
                                overflow: 'hidden',
                                display: 'flex', flexDirection: 'column',
                            }}
                        >
                            {/* Glow header */}
                            <div style={{
                                padding: '28px 28px 20px',
                                background: 'var(--bg-surface)',
                                borderBottom: '1px solid var(--border-subtle)',
                                textAlign: 'center',
                                position: 'relative',
                            }}>
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }}
                                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                                    style={{ display: 'inline-block', marginBottom: '12px' }}
                                >
                                    <Trophy size={40} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 12px #f59e0b55)' }} />
                                </motion.div>
                                <h2 style={{
                                    fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)',
                                    letterSpacing: '-0.04em', margin: '0 0 6px',
                                    fontFamily: clashDisplay,
                                }}>
                                    Week {reportData.week_number} Complete!
                                </h2>
                                {reportData.week_theme && (
                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, fontFamily: satoshi }}>
                                        {reportData.week_theme}
                                    </p>
                                )}
                            </div>

                            {/* Body — scrollable */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
                                {/* Stats row */}
                                <div className="grid-col-1-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{
                                        padding: '14px', borderRadius: '14px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#10b981', letterSpacing: '-0.03em', fontFamily: clashDisplay }}>
                                            {reportData.consistency_score}%
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px', fontFamily: satoshi }}>Consistency</div>
                                    </div>
                                    <div style={{
                                        padding: '14px', borderRadius: '14px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#6366f1', letterSpacing: '-0.03em', fontFamily: clashDisplay }}>
                                            {reportData.avg_score}/10
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px', fontFamily: satoshi }}>Avg Mood</div>
                                    </div>
                                    <div style={{
                                        padding: '14px', borderRadius: '14px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#f59e0b', letterSpacing: '-0.03em', fontFamily: clashDisplay }}>
                                            {reportData.days_done}/{reportData.past_days_count ?? 7}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '3px', fontFamily: satoshi }}>Days Done</div>
                                    </div>
                                </div>

                                {/* Emotion Pie Chart */}
                                <div style={{
                                    padding: '16px', borderRadius: '14px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    marginBottom: '14px',
                                }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px', fontFamily: satoshi }}>Emotion Distribution</p>
                                    <EmotionPieChart days={weekDays} />
                                </div>

                                {/* Key insight */}
                                {reportData.hidden_insight && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: '12px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)',
                                        marginBottom: '14px',
                                    }}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px', fontFamily: satoshi }}>Hidden Insight</p>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{reportData.hidden_insight}</p>
                                    </div>
                                )}

                                {/* Next week focus */}
                                {reportData.next_week_focus && (
                                    <div style={{
                                        padding: '14px 16px', borderRadius: '12px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)',
                                        marginBottom: '14px',
                                    }}>
                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px', fontFamily: satoshi }}>Key Focus for Next Week</p>
                                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{reportData.next_week_focus}</p>
                                    </div>
                                )}
                            </div>

                            {/* Footer CTA */}
                            <div style={{
                                padding: '16px 24px',
                                borderTop: '1px solid var(--border-subtle)',
                                display: 'flex', gap: '10px',
                            }}>
                                <button
                                    onClick={() => setShowWeekEndCelebration(false)}
                                    style={{
                                        flex: 1, padding: '11px', borderRadius: '100px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'transparent', color: 'var(--text-secondary)',
                                        fontSize: '13px', cursor: 'pointer', fontFamily: satoshi,
                                    }}
                                >
                                    View Full Report
                                </button>
                                <button
                                    onClick={() => {
                                        setShowWeekEndCelebration(false);
                                        const event = new CustomEvent('request-next-week-plan', {
                                            detail: { week: (reportData.week_number ?? 1) + 1 }
                                        });
                                        window.dispatchEvent(event);
                                        setTimeout(() => window.dispatchEvent(new CustomEvent('close-journey')), 100);
                                    }}
                                    style={{
                                        flex: 1, padding: '11px', borderRadius: '100px',
                                        border: 'none',
                                        background: 'var(--text-primary)',
                                        color: 'var(--btn-primary-bg)', fontSize: '13px', fontWeight: 700,
                                        cursor: 'pointer', fontFamily: satoshi,
                                    }}
                                >
                                    Plan Week {(reportData.week_number ?? 1) + 1} →
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
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0,
                background: 'var(--card-bg)',
            }}>
                {onClose && (
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--text-primary)'; e.currentTarget.style.color = 'var(--btn-primary-bg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--btn-primary-bg)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                        <ArrowLeft size={16} />
                    </button>
                )}
                <div style={{ flex: 1 }}>
                    <h1 style={{
                        fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
                        letterSpacing: '-0.03em', margin: 0,
                        fontFamily: clashDisplay,
                    }}>
                        My Journey
                    </h1>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: '2px', fontFamily: satoshi }}>
                        {report?.week_start && `Week of ${report.week_start}`}
                    </p>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0', background: 'var(--bg-surface)', borderRadius: '10px', padding: '3px', border: '1px solid var(--border-subtle)' }}>
                    {(['overview', 'archive'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => tab === 'archive' ? handleArchiveTab() : setActiveTab('overview')}
                            style={{
                                padding: '5px 14px', borderRadius: '7px', border: 'none',
                                background: activeTab === tab ? 'var(--card-bg)' : 'transparent',
                                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: satoshi,
                                textTransform: 'capitalize',
                                boxShadow: activeTab === tab ? '0 1px 3px rgba(30,30,30,0.06)' : 'none',
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
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                    <div>
                                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: clashDisplay }}>
                                            {todayEntry ? 'Today logged' : "Today's voice log"}
                                        </p>
                                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '3px 0 0', fontFamily: satoshi }}>
                                            {todayEntry
                                                ? `${todayEntry.emotion_label} — ${todayEntry.emotion_score}/10`
                                                : 'Speak about your day. AI detects your emotion.'}
                                        </p>
                                    </div>
                                    {todayEntry && (
                                        <div style={{
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
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: justSaved ? '16px' : '0' }}>
                                    <AnimatePresence mode="wait">
                                        {isUploading ? (
                                            <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: satoshi }}>
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
                                                    border: `2px solid ${todayEntry ? 'rgba(30,30,30,0.15)' : 'rgba(30,30,30,0.2)'}`,
                                                    background: `${todayEntry ? 'var(--btn-primary-bg)' : 'var(--card-bg)'}`,
                                                    color: 'var(--text-primary)', cursor: 'pointer',
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
                                borderRadius: '16px', padding: '18px 20px',
                                background: 'var(--card-bg)',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                                    <p style={{
                                        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                                        fontFamily: satoshi,
                                    }}>
                                        {weekInfo?.has_plan ? `Week ${weekInfo.current_week}` : 'This Week'}
                                    </p>
                                    {weekInfo?.has_plan && weekInfo.week_start && weekInfo.week_end && (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: satoshi }}>
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
                                    {/* Plan Week N+1 gating */}
                                    {weekInfo?.has_plan && weekInfo.is_week_complete && (
                                        <button
                                            onClick={() => {
                                                const nextWeek = (weekInfo.current_week ?? 1) + 1;
                                                window.dispatchEvent(new CustomEvent('request-next-week-plan', { detail: { week: nextWeek } }));
                                            }}
                                            style={{
                                                marginLeft: 'auto', padding: '4px 10px',
                                                borderRadius: '100px',
                                                border: 'none',
                                                background: 'var(--text-primary)',
                                                color: 'var(--btn-primary-bg)', fontSize: '11px', fontWeight: 600,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                fontFamily: satoshi,
                                            }}
                                        >
                                            Plan Week {(weekInfo.current_week ?? 1) + 1}
                                        </button>
                                    )}
                                    {weekInfo?.has_plan && !weekInfo.is_week_complete && weekInfo.week_end && (
                                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, fontFamily: satoshi }}>
                                            Week ends {weekInfo.week_end}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* ── Weekly Report — only shown when week is complete ── */}
                            {(() => {
                                const isWeekComplete = weekInfo?.week_end
                                    ? today >= weekInfo.week_end
                                    : (weekInfo?.is_week_complete ?? false);
                                return (
                                    <>
                                        {!isWeekComplete && weekDays.some(d => d.has_journal) && (
                                            <div style={{
                                                borderRadius: '16px', padding: '18px 20px',
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
                                                borderRadius: '16px', padding: '32px', textAlign: 'center',
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
                                                    borderRadius: '16px', padding: '28px', textAlign: 'center',
                                                    background: 'var(--card-bg)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6,
                                                    fontFamily: satoshi,
                                                }}>
                                                    Record voice journals across the week.<br />
                                                    At the end of the week, your AI performance review will appear here.
                                                </div>
                                            ) : reportData ? (
                                                <div style={{
                                                    borderRadius: '16px',
                                                    border: '1px solid var(--border-subtle)',
                                                    background: 'var(--card-bg)',
                                                    overflow: 'hidden',
                                                }}>
                                                    {/* Report header */}
                                                    <div style={{
                                                        padding: '16px 20px',
                                                        borderBottom: '1px solid var(--border-subtle)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    }}>
                                                        <div>
                                                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: clashDisplay }}>
                                                                Week {reportData.week_number !== undefined ? reportData.week_number : 'N'} Review
                                                            </p>
                                                            {reportData.week_theme && (
                                                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0', fontFamily: satoshi }}>
                                                                    {reportData.week_theme}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <span style={{
                                                            fontSize: '10px', fontWeight: 700, padding: '3px 10px',
                                                            borderRadius: '100px',
                                                            background: 'var(--bg-surface)',
                                                            color: 'var(--text-secondary)',
                                                            fontFamily: satoshi,
                                                        }}>
                                                            {report?.week_start} — {report?.week_end}
                                                        </span>
                                                    </div>

                                                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                                        {/* ── Performance stats row ── */}
                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                            <ConsistencyRing score={consistencyScore} doneCount={daysDone} totalCount={reportData.past_days_count ?? 7} />
                                                            <div className="grid-col-1-mobile" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                                                                    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
                                                                    fontFamily: satoshi,
                                                                }}>Emotion Distribution</p>
                                                                <EmotionPieChart days={weekDays} />
                                                            </div>
                                                        )}

                                                        {/* ── Emotional arc chart ── */}
                                                        <div>
                                                            <p style={{
                                                                fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                                                                fontFamily: satoshi,
                                                            }}>Daily Emotional Arc</p>
                                                            <EmotionChart days={weekDays} />
                                                            {reportData.emotional_arc && (
                                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '10px', fontFamily: satoshi }}>
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
                                                                background: 'var(--bg-surface)',
                                                                border: '1px solid var(--border-subtle)',
                                                            }}>
                                                                <p style={{
                                                                    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
                                                                    fontFamily: satoshi,
                                                                }}>Hidden Insight</p>
                                                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>
                                                                    {reportData.hidden_insight}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* ── Daily Breakdown ── */}
                                                        <DailyBreakdown days={weekDays} />

                                                        {/* ── Next week focus ── */}
                                                        {reportData.next_week_focus && (
                                                            <div style={{
                                                                padding: '16px', borderRadius: '12px',
                                                                background: 'var(--bg-surface)',
                                                                border: '1px solid var(--border-subtle)',
                                                            }}>
                                                                <p style={{
                                                                    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
                                                                    fontFamily: satoshi,
                                                                }}>Next Week: Key Focus</p>
                                                                <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>
                                                                    {reportData.next_week_focus}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Plan Week N+1 prompt */}
                                                        <div style={{
                                                            padding: '14px 16px', borderRadius: '12px',
                                                            background: 'var(--bg-surface)',
                                                            border: '1px solid var(--border-subtle)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        }}>
                                                            <div>
                                                                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: clashDisplay }}>
                                                                    Ready for Week {(reportData.week_number ?? 1) + 1}?
                                                                </p>
                                                                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0', fontFamily: satoshi }}>
                                                                    AI will build it using this week's performance data.
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    // Communicate back to WorkspacePage to open chat and send a specific prompt
                                                                    const event = new CustomEvent('request-next-week-plan', {
                                                                        detail: { week: (reportData.week_number ?? 1) + 1 }
                                                                    });
                                                                    window.dispatchEvent(event);
                                                                    // Close journey
                                                                    setTimeout(() => {
                                                                        const closeEvent = new CustomEvent('close-journey');
                                                                        window.dispatchEvent(closeEvent);
                                                                    }, 100);
                                                                }}
                                                                style={{
                                                                    padding: '8px 16px', borderRadius: '100px',
                                                                    border: 'none',
                                                                    background: 'var(--text-primary)',
                                                                    color: 'var(--btn-primary-bg)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                                                                    flexShrink: 0, fontFamily: satoshi,
                                                                    transition: 'opacity 0.2s',
                                                                }}
                                                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                                                            >
                                                                Plan Week {(reportData.week_number ?? 1) + 1}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
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
                                        const arDaysDone = aw.report?.days_done ?? 0;
                                        const arPastDays = aw.report?.past_days_count ?? 7;
                                        const arDays: WeeklyReportDay[] = aw.report?.days ?? [];
                                        return (
                                            <div
                                                key={aw.week_number}
                                                style={{
                                                    borderRadius: '16px',
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
                                                                ? <Sparkles size={16} color="var(--text-primary)" />
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
                                                            <div style={{
                                                                padding: '4px 18px 20px',
                                                                borderTop: '1px solid var(--border-subtle)',
                                                            }}>
                                                                {/* Stats + ring row */}
                                                                <div style={{ display: 'flex', gap: '12px', marginTop: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                                                    <ConsistencyRing
                                                                        score={arConsistency}
                                                                        doneCount={arDaysDone}
                                                                        totalCount={arPastDays}
                                                                    />
                                                                    <div className="grid-col-1-mobile" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                                                                        marginTop: '14px', padding: '10px 14px', borderRadius: '10px',
                                                                        background: 'var(--bg-surface)',
                                                                        border: '1px solid var(--border-subtle)',
                                                                        fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600,
                                                                        fontFamily: clashDisplay,
                                                                    }}>
                                                                        {aw.report.week_theme}
                                                                    </div>
                                                                )}

                                                                {/* Emotion distribution pie */}
                                                                {arDays.length > 0 && arDays.some(d => d.has_journal) && (
                                                                    <div style={{ marginTop: '16px' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: satoshi }}>Emotion Distribution</p>
                                                                        <EmotionPieChart days={arDays} />
                                                                    </div>
                                                                )}

                                                                {/* Emotional arc bar chart */}
                                                                {arDays.length > 0 && (
                                                                    <div style={{ marginTop: '16px' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px', fontFamily: satoshi }}>Daily Arc</p>
                                                                        <EmotionChart days={arDays} />
                                                                    </div>
                                                                )}

                                                                {/* Daily Breakdown */}
                                                                {arDays.length > 0 && (
                                                                    <DailyBreakdown days={arDays} />
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
                                                                            background: 'var(--bg-surface)',
                                                                            border: '1px solid var(--border-subtle)',
                                                                        }}>
                                                                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px', fontFamily: satoshi }}>Hidden Insight</p>
                                                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{aw.report.hidden_insight}</p>
                                                                        </div>
                                                                    )}
                                                                    {aw.report?.next_week_focus && (
                                                                        <div style={{
                                                                            padding: '14px 16px', borderRadius: '12px',
                                                                            background: 'var(--bg-surface)',
                                                                            border: '1px solid var(--border-subtle)',
                                                                        }}>
                                                                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px', fontFamily: satoshi }}>Next Week Focus</p>
                                                                            <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{aw.report.next_week_focus}</p>
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
