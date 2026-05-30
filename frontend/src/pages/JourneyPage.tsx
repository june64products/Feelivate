import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, ArrowLeft } from 'lucide-react';
import {
    uploadVoiceJournal,
    getJournals,
    getWeeklyReport,
    type JournalEntry,
    type WeeklyReport,
    type WeeklyReportDay,
} from '../api';

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
function WeekCalendar({ days, today }: { days: WeeklyReportDay[]; today: string }) {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '6px',
        }}>
            {days.map((d, i) => {
                const isPast = d.date <= today;
                const isToday = d.date === today;
                const hasDone = d.has_journal;
                const isMissed = isPast && !hasDone && !isToday;
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
                            {isToday && !hasDone && (
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
    const [loadingJournals, setLoadingJournals] = useState(true);
    const [loadingReport, setLoadingReport] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'archive'>('overview');

    // Voice recording
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [justSaved, setJustSaved] = useState<JournalEntry | null>(null);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const today = new Date().toISOString().split('T')[0];

    useEffect(() => { loadAll(); }, [userId]);

    const loadAll = async () => {
        try {
            const [j, r] = await Promise.all([
                getJournals(userId),
                getWeeklyReport(userId, sessionId).catch(() => null),
            ]);
            setJournals(j);
            setReport(r);
        } finally {
            setLoadingJournals(false);
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
            const entry = await uploadVoiceJournal(blob);
            setJustSaved(entry);
            onJournalSaved?.(entry);
            setJournals(prev => {
                const filtered = prev.filter(j => j.date !== entry.date);
                return [entry, ...filtered];
            });
            // Refresh report after new journal
            setLoadingReport(true);
            const r = await getWeeklyReport(userId, sessionId).catch(() => null);
            if (r) setReport(r);
        } catch (e: any) {
            alert(e.message || 'Upload failed');
        } finally {
            setIsUploading(false);
            setLoadingReport(false);
        }
    };

    const todayEntry = journals.find(j => j.date === today);
    const reportData = report?.report;

    // Build full 7-day structure if report has days (or synthesize from journals)
    const weekDays: WeeklyReportDay[] = (() => {
        if (reportData?.days && reportData.days.length === 7) return reportData.days;
        // Synthesize if no report
        const d = new Date();
        const monday = new Date(d);
        monday.setDate(d.getDate() - d.getDay() + 1);
        const jMap: Record<string, JournalEntry> = {};
        journals.forEach(j => { jMap[j.date] = j; });
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
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
        }}>
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
                            onClick={() => setActiveTab(tab)}
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

                            {/* ── 7-day calendar strip ── */}
                            <div style={{
                                borderRadius: '16px', padding: '18px 20px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                            }}>
                                <p style={{
                                    fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '14px',
                                }}>
                                    This Week
                                </p>
                                <WeekCalendar days={weekDays} today={today} />
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

                                        {/* ── Emotional arc chart ── */}
                                        <div>
                                            <p style={{
                                                fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)',
                                                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px',
                                            }}>Emotional Arc</p>
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
                                Journal Archive — {journals.length} entries
                            </p>

                            {loadingJournals ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                                    Loading...
                                </div>
                            ) : journals.length === 0 ? (
                                <div style={{
                                    textAlign: 'center', padding: '40px',
                                    border: '1px dashed rgba(255,255,255,0.1)',
                                    borderRadius: '12px', color: 'rgba(255,255,255,0.3)', fontSize: '13px',
                                }}>
                                    No journal entries yet. Record your first voice note above.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {journals.map((entry, i) => {
                                        const color = emotionColor(entry.emotion_label);
                                        const barFill = (entry.emotion_score / 10) * 100;
                                        return (
                                            <motion.div
                                                key={entry.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                                style={{
                                                    padding: '14px 16px', borderRadius: '12px',
                                                    border: '1px solid rgba(255,255,255,0.07)',
                                                    background: 'rgba(255,255,255,0.02)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{
                                                            width: '8px', height: '8px', borderRadius: '50%',
                                                            background: color, boxShadow: `0 0 6px ${color}`,
                                                        }} />
                                                        <span style={{ fontSize: '12px', fontWeight: 600, color, textTransform: 'capitalize' }}>
                                                            {entry.emotion_label}
                                                        </span>
                                                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                                                            {entry.emotion_score}/10
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                                                        {entry.date}
                                                    </span>
                                                </div>
                                                <p style={{
                                                    fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4,
                                                    margin: '0 0 8px', overflow: 'hidden',
                                                    display: '-webkit-box', WebkitLineClamp: 2 as any,
                                                    WebkitBoxOrient: 'vertical' as any,
                                                }}>
                                                    {entry.one_liner || entry.transcript}
                                                </p>
                                                <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${barFill}%` }}
                                                        transition={{ delay: i * 0.03 + 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                                        style={{ height: '100%', borderRadius: '2px', background: color }}
                                                    />
                                                </div>
                                            </motion.div>
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
            `}</style>
        </div>
    );
}
