import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, BookOpen, TrendingUp } from 'lucide-react';
import {
    uploadVoiceJournal,
    getJournals,
    getWeeklyReport,
    type JournalEntry,
    type WeeklyReport,
} from '../api';

// ─── Emotion styling ─────────────────────────────────────────────────────────
const EMOTION_META: Record<string, { emoji: string; color: string }> = {
    motivated:   { emoji: '🔥', color: '#f59e0b' },
    stressed:    { emoji: '😤', color: '#ef4444' },
    focused:     { emoji: '🎯', color: '#6366f1' },
    anxious:     { emoji: '😰', color: '#f97316' },
    confident:   { emoji: '💪', color: '#10b981' },
    drained:     { emoji: '😴', color: '#8b5cf6' },
    excited:     { emoji: '✨', color: '#ec4899' },
    neutral:     { emoji: '😐', color: '#6b7280' },
    frustrated:  { emoji: '😠', color: '#dc2626' },
    hopeful:     { emoji: '🌱', color: '#22c55e' },
};

const getEmoMeta = (label?: string) =>
    EMOTION_META[label ?? 'neutral'] ?? { emoji: '😐', color: '#6b7280' };

// ─── Score bar ───────────────────────────────────────────────────────────────
function ScoreBar({ score, color }: { score: number; color: string }) {
    return (
        <div style={{
            width: '100%', height: '4px', borderRadius: '2px',
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(score / 10) * 100}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: '100%', borderRadius: '2px', background: color }}
            />
        </div>
    );
}

// ─── Weekly mood mini-chart ──────────────────────────────────────────────────
function MiniChart({ days }: { days: { date: string; emotion: string; score: number }[] }) {
    const max = 10;
    const h = 48;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: `${h}px` }}>
            {days.map((d, i) => {
                const meta = getEmoMeta(d.emotion);
                const barH = Math.max(6, Math.round((d.score / max) * h));
                return (
                    <motion.div
                        key={d.date}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: barH, opacity: 1 }}
                        transition={{ delay: i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        title={`${d.date}: ${d.emotion} (${d.score}/10)`}
                        style={{
                            flex: 1, borderRadius: '3px 3px 0 0',
                            background: meta.color,
                            opacity: 0.8,
                            cursor: 'default',
                        }}
                    />
                );
            })}
        </div>
    );
}

interface JourneyPageProps {
    userId: string;
}

export default function JourneyPage({ userId }: JourneyPageProps) {
    const [journals, setJournals] = useState<JournalEntry[]>([]);
    const [report, setReport] = useState<WeeklyReport | null>(null);
    const [loadingJournals, setLoadingJournals] = useState(true);
    const [loadingReport, setLoadingReport] = useState(true);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [justSaved, setJustSaved] = useState<JournalEntry | null>(null);
    const mediaRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        loadAll();
    }, [userId]);

    const loadAll = async () => {
        try {
            const [j, r] = await Promise.all([
                getJournals(userId),
                getWeeklyReport(userId).catch(() => null),
            ]);
            setJournals(j);
            setReport(r);
        } finally {
            setLoadingJournals(false);
            setLoadingReport(false);
        }
    };

    // ── Voice recording logic ─────────────────────────────────────────────
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
            setJournals(prev => {
                const filtered = prev.filter(j => j.date !== entry.date);
                return [entry, ...filtered];
            });
            // Refresh report
            const r = await getWeeklyReport(userId).catch(() => null);
            if (r) setReport(r);
        } catch (e: any) {
            alert(e.message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    // ── Today's entry ─────────────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = journals.find(j => j.date === today);

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflowY: 'auto',
            padding: '24px 28px',
            gap: '24px',
            background: 'var(--bg-primary)',
        }}>
            {/* Header */}
            <div>
                <h1 style={{
                    fontSize: '22px', fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    marginBottom: '4px',
                }}>
                    My Journey 📔
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Your emotional archive. Speak daily — AI listens & tracks your growth.
                </p>
            </div>

            {/* ── Voice recorder card ── */}
            <div style={{
                borderRadius: '16px',
                border: '1px solid var(--border-medium)',
                background: 'var(--bg-surface)',
                padding: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Today's Voice Journal
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {todayEntry ? `Recorded today — ${todayEntry.emotion_label} (${todayEntry.emotion_score}/10)` : 'Tap to record a 60-second note about your day'}
                        </p>
                    </div>
                    {todayEntry && (
                        <span style={{ fontSize: '28px' }}>
                            {getEmoMeta(todayEntry.emotion_label).emoji}
                        </span>
                    )}
                </div>

                {/* Record button */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <AnimatePresence mode="wait">
                        {isUploading ? (
                            <motion.div
                                key="uploading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}
                            >
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                Analyzing your mood...
                            </motion.div>
                        ) : isRecording ? (
                            <motion.button
                                key="stop"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={stopRecording}
                                className="mic-recording"
                                style={{
                                    width: '64px', height: '64px', borderRadius: '50%',
                                    border: 'none',
                                    background: 'rgba(239,68,68,0.15)',
                                    color: '#f87171',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <Square size={22} fill="#f87171" />
                            </motion.button>
                        ) : (
                            <motion.button
                                key="record"
                                initial={{ scale: 0.8 }}
                                animate={{ scale: 1 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={startRecording}
                                style={{
                                    width: '64px', height: '64px', borderRadius: '50%',
                                    border: '2px solid rgba(192,132,252,0.4)',
                                    background: 'rgba(192,132,252,0.1)',
                                    color: 'var(--accent-primary)',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }}
                            >
                                <Mic size={24} />
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Just saved result */}
                <AnimatePresence>
                    {justSaved && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            style={{
                                padding: '12px 14px', borderRadius: '10px',
                                background: `${getEmoMeta(justSaved.emotion_label).color}18`,
                                border: `1px solid ${getEmoMeta(justSaved.emotion_label).color}40`,
                                fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5,
                            }}
                        >
                            <span style={{ fontWeight: 600, color: getEmoMeta(justSaved.emotion_label).color }}>
                                {getEmoMeta(justSaved.emotion_label).emoji} {justSaved.emotion_label} ({justSaved.emotion_score}/10)
                            </span>
                            {' — '}
                            {justSaved.one_liner}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Weekly Emotion Report ── */}
            {!loadingReport && report && report.status !== 'no_data' && report.report && (
                <div style={{
                    borderRadius: '16px',
                    border: '1px solid var(--border-medium)',
                    background: 'var(--bg-surface)',
                    padding: '20px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <TrendingUp size={16} color="var(--accent-primary)" />
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Weekly Soul Report
                        </span>
                        <span style={{
                            marginLeft: 'auto', fontSize: '10px', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '10px',
                            background: 'rgba(192,132,252,0.12)',
                            color: 'var(--accent-primary)',
                        }}>
                            {report.week_start} → {report.week_end}
                        </span>
                    </div>

                    {/* Avg score */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                            {report.report.avg_score}
                        </span>
                        <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/10</span>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '4px' }}>
                            avg mood — {report.report.dominant_emotion}
                        </span>
                    </div>

                    {/* Mini chart */}
                    {report.report.days?.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <MiniChart days={report.report.days} />
                        </div>
                    )}

                    {/* Insight pills */}
                    {[
                        { label: '✨ Highlight', text: report.report.highlight },
                        { label: '🔍 Pattern', text: report.report.pattern },
                        { label: '💡 Next week tip', text: report.report.next_week_tip },
                    ].map(({ label, text }) => text && (
                        <div key={label} style={{
                            padding: '10px 12px', borderRadius: '10px',
                            background: 'var(--glass-surface)',
                            border: '1px solid var(--border-subtle)',
                            marginBottom: '8px',
                        }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {label}
                            </p>
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {text}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Past journal entries ── */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <BookOpen size={15} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Journal Archive
                    </span>
                </div>

                {loadingJournals ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        Loading...
                    </div>
                ) : journals.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: '12px', color: 'var(--text-muted)', fontSize: '13px',
                    }}>
                        Record your first voice journal above 👆
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {journals.map((entry, i) => {
                            const meta = getEmoMeta(entry.emotion_label);
                            return (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                    style={{
                                        padding: '14px 16px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-subtle)',
                                        background: 'var(--glass-surface)',
                                        display: 'flex', alignItems: 'center', gap: '14px',
                                    }}
                                >
                                    <span style={{ fontSize: '24px', flexShrink: 0 }}>{meta.emoji}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, color: meta.color }}>
                                                {entry.emotion_label} · {entry.emotion_score}/10
                                            </span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {entry.date}
                                            </span>
                                        </div>
                                        <p style={{
                                            fontSize: '12px', color: 'var(--text-secondary)',
                                            lineHeight: 1.4, margin: 0,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {entry.one_liner || entry.transcript}
                                        </p>
                                        <div style={{ marginTop: '6px' }}>
                                            <ScoreBar score={entry.emotion_score} color={meta.color} />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
