import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Square, Loader2, ArrowLeft, Lock, ChevronDown, FileText, Sparkles, Trophy, Award, TrendingUp, Quote, Target, Zap, BarChart3, AlertTriangle } from 'lucide-react';
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
    type WeekBadge,
    type WeekSummary,
    type TriggerPattern,
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

                            {/* V2 Coaching: observation + micro_action, or legacy insight */}
                            {(d.coaching_insight || d.coaching_micro_action) && (
                                <div style={{
                                    marginTop: '4px',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    background: 'var(--bg-surface)',
                                    borderLeft: '2px solid #6366f1',
                                }}>
                                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '4px', fontFamily: satoshi }}>
                                        AI Coaching
                                    </span>
                                    {d.coaching_insight && (
                                        <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45, fontFamily: satoshi, fontWeight: 600 }}>
                                            {d.coaching_insight}
                                        </p>
                                    )}
                                    {d.coaching_micro_action && (
                                        <p style={{ fontSize: '11px', color: '#6366f1', margin: '4px 0 0', lineHeight: 1.4, fontFamily: satoshi }}>
                                            → {d.coaching_micro_action}
                                        </p>
                                    )}
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

// ─── V2: Momentum Score Card ──────────────────────────────────────────────────
function MomentumScoreCard({ score, label }: { score: number; label: string }) {
    const r = 52;
    const circ = 2 * Math.PI * r;
    const scoreVal = isNaN(score) ? 0 : Math.min(100, Math.max(0, score));
    const filled = circ * (scoreVal / 100);
    const ringColor = scoreVal >= 85 ? '#10b981' : scoreVal >= 70 ? '#6366f1' : scoreVal >= 50 ? '#f59e0b' : '#ef4444';
    const labelColor = scoreVal >= 70 ? '#10b981' : scoreVal >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{
                padding: '20px',
                borderRadius: '16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
            }}
        >
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi }}>
                Momentum
            </span>
            <svg width="130" height="130" viewBox="0 0 130 130">
                <circle cx="65" cy="65" r={r} fill="none" stroke="var(--border-subtle)" strokeWidth="10" />
                <motion.circle
                    cx="65" cy="65" r={r}
                    fill="none"
                    stroke={ringColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    initial={{ strokeDashoffset: circ }}
                    animate={{ strokeDashoffset: circ - filled }}
                    transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: '65px 65px', transform: 'rotate(-90deg)', filter: `drop-shadow(0 0 8px ${ringColor}40)` }}
                />
                <text x="65" y="60" textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="700" fontFamily={clashDisplay}>
                    {scoreVal}
                </text>
                <text x="65" y="78" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontFamily={satoshi}>
                    / 100
                </text>
            </svg>
            <span style={{
                fontSize: '12px', fontWeight: 700, color: labelColor,
                padding: '3px 12px', borderRadius: '100px',
                background: `${labelColor}12`,
                fontFamily: satoshi, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
                {label}
            </span>
        </motion.div>
    );
}

// ─── V2: Week Badge Card ──────────────────────────────────────────────────────
function WeekBadgeCard({ badge }: { badge: WeekBadge }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            style={{
                padding: '18px 20px',
                borderRadius: '16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: '14px',
            }}
        >
            <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                style={{
                    width: '48px', height: '48px', borderRadius: '14px',
                    background: 'linear-gradient(135deg, #f59e0b22, #f59e0b08)',
                    border: '1px solid #f59e0b30',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                <Award size={22} color="#f59e0b" style={{ filter: 'drop-shadow(0 0 6px #f59e0b55)' }} />
            </motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: clashDisplay }}>
                    {badge.name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '3px 0 0', fontFamily: satoshi, lineHeight: 1.4 }}>
                    {badge.reason}
                </p>
            </div>
        </motion.div>
    );
}

// ─── V2: Best Quote Card ──────────────────────────────────────────────────────
function BestQuoteCard({ quote }: { quote: string }) {
    if (!quote) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
                padding: '20px 22px',
                borderRadius: '16px',
                background: 'var(--card-bg)',
                border: '1px solid var(--border-subtle)',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            <Quote size={40} color="var(--border-medium)" style={{ position: 'absolute', top: '10px', left: '14px', opacity: 0.3 }} />
            <div style={{ position: 'relative', paddingLeft: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi, display: 'block', marginBottom: '10px' }}>
                    Your words this week
                </span>
                <p style={{
                    fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)',
                    lineHeight: 1.6, margin: 0,
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontStyle: 'italic',
                }}>
                    "{quote}"
                </p>
            </div>
        </motion.div>
    );
}

// ─── V2: Emotion Timeline Line Chart (replaces bar chart) ─────────────────────
function EmotionTimelineChart({ days, avgScore }: { days: WeeklyReportDay[]; avgScore: number }) {
    const chartW = 280;
    const chartH = 100;
    const padX = 28;
    const padY = 14;
    const plotW = chartW - padX * 2;
    const plotH = chartH - padY * 2;

    const parseLocalDate = (dateStr: string) => {
        const [y, mo, dd] = dateStr.split('-').map(Number);
        return new Date(y, mo - 1, dd);
    };

    // Build points
    const points: { x: number; y: number; score: number; color: string; dayName: string; hasJournal: boolean }[] = [];
    days.forEach((d, i) => {
        const x = padX + (i / Math.max(days.length - 1, 1)) * plotW;
        const score = d.score ?? 0;
        const y = d.has_journal ? padY + plotH - ((score - 1) / 9) * plotH : padY + plotH;
        const dayDate = parseLocalDate(d.date);
        const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'short' });
        points.push({
            x, y, score,
            color: d.has_journal ? emotionColor(d.emotion) : 'var(--border-medium)',
            dayName,
            hasJournal: d.has_journal,
        });
    });

    // Build smooth path using cubic bezier curves
    let pathD = '';
    const journalPoints = points.filter(p => p.hasJournal);
    if (journalPoints.length >= 2) {
        pathD = `M ${journalPoints[0].x} ${journalPoints[0].y}`;
        for (let i = 1; i < journalPoints.length; i++) {
            const prev = journalPoints[i - 1];
            const curr = journalPoints[i];
            const cpx = (prev.x + curr.x) / 2;
            pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
        }
    }

    // Avg mood line y position
    const avgY = padY + plotH - ((avgScore - 1) / 9) * plotH;

    return (
        <div>
            <p style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
                fontFamily: satoshi,
            }}>Emotion Timeline</p>
            <svg width="100%" viewBox={`0 0 ${chartW} ${chartH + 20}`} style={{ overflow: 'visible' }}>
                {/* Grid lines */}
                {[1, 4, 7, 10].map(v => {
                    const gy = padY + plotH - ((v - 1) / 9) * plotH;
                    return (
                        <g key={v}>
                            <line x1={padX} y1={gy} x2={chartW - padX} y2={gy} stroke="var(--border-subtle)" strokeWidth="0.5" />
                            <text x={padX - 6} y={gy + 3} textAnchor="end" fill="var(--text-muted)" fontSize="7" fontFamily={satoshi}>{v}</text>
                        </g>
                    );
                })}

                {/* Avg mood dashed line */}
                <line x1={padX} y1={avgY} x2={chartW - padX} y2={avgY}
                    stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
                <text x={chartW - padX + 4} y={avgY + 3} fill="var(--text-muted)" fontSize="7" fontFamily={satoshi}>avg</text>

                {/* Connection line */}
                {pathD && (
                    <motion.path
                        d={pathD}
                        fill="none"
                        stroke="var(--text-secondary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                    />
                )}

                {/* Dots + labels */}
                {points.map((p, i) => (
                    <g key={i}>
                        {/* Day label */}
                        <text x={p.x} y={chartH + 12} textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontFamily={satoshi}>
                            {p.dayName}
                        </text>

                        {/* Dot */}
                        <motion.circle
                            cx={p.x} cy={p.y}
                            r={p.hasJournal ? 5 : 3}
                            fill={p.hasJournal ? p.color : 'transparent'}
                            stroke={p.color}
                            strokeWidth={p.hasJournal ? 0 : 1.5}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.06 + 0.4, duration: 0.3 }}
                            style={{ transformOrigin: `${p.x}px ${p.y}px`, filter: p.hasJournal ? `drop-shadow(0 0 4px ${p.color}55)` : 'none' }}
                        />

                        {/* Score label */}
                        {p.hasJournal && p.score > 0 && (
                            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 + 0.7 }}>
                                <text x={p.x} y={p.y - 10} textAnchor="middle" fill={p.color} fontSize="8" fontWeight="700" fontFamily={satoshi}>
                                    {p.score}
                                </text>
                            </motion.g>
                        )}
                    </g>
                ))}
            </svg>
        </div>
    );
}

// ─── V2: Task Completion Bar (replaces ConsistencyRing) ───────────────────────
function TaskCompletionBar({ daysDone, daysTotal, days, prevWeekStats }: {
    daysDone: number; daysTotal: number; days: WeeklyReportDay[];
    prevWeekStats?: { consistency_score: number; avg_score: number; momentum_score: number; days_done: number } | null;
}) {
    const pct = Math.round((daysDone / Math.max(daysTotal, 1)) * 100);
    const prevPct = prevWeekStats ? Math.round((prevWeekStats.days_done / Math.max(daysTotal, 1)) * 100) : null;
    const delta = prevPct !== null ? pct - prevPct : null;
    const barColor = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';

    const parseLocalDate = (dateStr: string) => {
        const [y, mo, dd] = dateStr.split('-').map(Number);
        return new Date(y, mo - 1, dd);
    };

    return (
        <div style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi }}>
                    Task Completion
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: barColor, fontFamily: clashDisplay }}>
                        {daysDone} of {daysTotal} done
                    </span>
                    {delta !== null && delta !== 0 && (
                        <span style={{
                            fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '100px',
                            background: delta > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                            color: delta > 0 ? '#10b981' : '#ef4444',
                            fontFamily: satoshi,
                        }}>
                            {delta > 0 ? '+' : ''}{delta}% vs last week
                        </span>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div style={{
                height: '8px', borderRadius: '4px',
                background: 'var(--glass-surface)',
                marginBottom: '12px', overflow: 'hidden',
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    style={{ height: '100%', borderRadius: '4px', background: barColor }}
                />
            </div>

            {/* Day dots */}
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between' }}>
                {days.map((d, i) => {
                    const dayDate = parseLocalDate(d.date);
                    const dayName = dayDate.toLocaleDateString('en-US', { weekday: 'narrow' });
                    const done = d.has_journal;
                    const missed = d.checkin === 'missed';
                    const dotColor = done ? emotionColor(d.emotion) : missed ? '#ef4444' : 'var(--border-medium)';
                    return (
                        <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                                style={{
                                    width: '14px', height: '14px', borderRadius: '50%',
                                    background: done ? dotColor : 'transparent',
                                    border: `2px solid ${dotColor}`,
                                }}
                            />
                            <span style={{ fontSize: '7px', color: 'var(--text-muted)', fontFamily: satoshi }}>{dayName}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── V2: Week Summary Card (replaces 3 analysis blocks) ──────────────────────
function WeekSummaryCard({ summary }: { summary: WeekSummary }) {
    const items = [
        { icon: <Zap size={14} color="#10b981" />, label: 'Wins', text: summary.wins, color: '#10b981' },
        { icon: <AlertTriangle size={14} color="#f59e0b" />, label: 'Dips', text: summary.dips, color: '#f59e0b' },
        { icon: <Target size={14} color="#6366f1" />, label: 'Pattern', text: summary.pattern, color: '#6366f1' },
    ];

    return (
        <div style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
        }}>
            <p style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px',
                fontFamily: satoshi,
            }}>Week Summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {items.map(item => (
                    item.text ? (
                        <div key={item.label} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                            <div style={{
                                width: '26px', height: '26px', borderRadius: '8px',
                                background: `${item.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, marginTop: '1px',
                            }}>
                                {item.icon}
                            </div>
                            <div>
                                <span style={{ fontSize: '9px', fontWeight: 700, color: item.color, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: satoshi }}>
                                    {item.label}
                                </span>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5, fontFamily: satoshi }}>
                                    {item.text}
                                </p>
                            </div>
                        </div>
                    ) : null
                ))}
            </div>
        </div>
    );
}

// ─── V2: Trigger Pattern Table (Week 3+) ──────────────────────────────────────
function TriggerPatternTable({ patterns }: { patterns: TriggerPattern[] }) {
    if (!patterns || patterns.length === 0) return null;
    return (
        <div style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <BarChart3 size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi }}>
                    Detected Patterns
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {patterns.map((p, i) => (
                    <div key={i} style={{
                        padding: '10px 12px', borderRadius: '10px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, fontFamily: satoshi }}>
                            {p.pattern}
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: satoshi }}>
                                {p.frequency}
                            </span>
                            {p.weeks_detected && p.weeks_detected.length > 0 && (
                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: satoshi }}>
                                    Weeks: {p.weeks_detected.join(', ')}
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── V2: Week-over-Week Comparison Strip (Week 2+) ───────────────────────────
function WeekComparisonStrip({ currentWeek, currentStats, prevStats }: {
    currentWeek: number;
    currentStats: { consistency: number; avgMood: number; momentum: number };
    prevStats: { consistency_score: number; avg_score: number; momentum_score: number };
}) {
    const metrics = [
        { label: 'Consistency', prev: `${prevStats.consistency_score}%`, curr: `${currentStats.consistency}%`, delta: currentStats.consistency - prevStats.consistency_score },
        { label: 'Avg Mood', prev: `${prevStats.avg_score}`, curr: `${currentStats.avgMood}`, delta: currentStats.avgMood - prevStats.avg_score },
        { label: 'Momentum', prev: `${prevStats.momentum_score}`, curr: `${currentStats.momentum}`, delta: currentStats.momentum - prevStats.momentum_score },
    ];

    return (
        <div style={{
            padding: '16px 18px',
            borderRadius: '14px',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <TrendingUp size={14} color="var(--text-muted)" />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi }}>
                    Week {currentWeek - 1} → Week {currentWeek}
                </span>
            </div>
            <div className="grid-col-1-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {metrics.map(m => (
                    <div key={m.label} style={{
                        padding: '10px', borderRadius: '10px',
                        background: 'var(--bg-surface)',
                        textAlign: 'center',
                    }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: satoshi, display: 'block', marginBottom: '4px' }}>
                            {m.label}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: satoshi, textDecoration: 'line-through' }}>
                                {m.prev}
                            </span>
                            <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clashDisplay }}>
                                {m.curr}
                            </span>
                        </div>
                        {m.delta !== 0 && (
                            <span style={{
                                fontSize: '9px', fontWeight: 700,
                                color: m.delta > 0 ? '#10b981' : '#ef4444',
                                fontFamily: satoshi,
                            }}>
                                {m.delta > 0 ? '↑' : '↓'} {Math.abs(Math.round(m.delta * 10) / 10)}
                            </span>
                        )}
                    </div>
                ))}
            </div>
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
                                {!weekInfo?.has_next_plan && (
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
                                )}
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
            <div className="journey-body-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
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
                                    {/* Plan Week N+1 gating — only show when report exists AND next plan doesn't */}
                                    {weekInfo?.has_plan && weekInfo.is_week_complete && weekInfo.has_report && !weekInfo.has_next_plan && (
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
                                            ) : report?.status === 'waiting_for_sunday_entry' ? (
                                                <div style={{
                                                    borderRadius: '16px', padding: '28px', textAlign: 'center',
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

                                                        {/* ── V2: Momentum Score + Week Badge row ── */}
                                                        <div className="grid-col-1-mobile" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'stretch' }}>
                                                            <MomentumScoreCard
                                                                score={reportData.momentum_score ?? Math.round((consistencyScore * 0.4) + ((avgScore / 10) * 100 * 0.3) + (consistencyScore * 0.3))}
                                                                label={reportData.momentum_label ?? (consistencyScore >= 85 ? 'Peak' : consistencyScore >= 70 ? 'Strong Week' : 'Building')}
                                                            />
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                {reportData.week_badge && (
                                                                    <WeekBadgeCard badge={reportData.week_badge} />
                                                                )}
                                                                <div className="grid-col-1-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1 }}>
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
                                                        </div>

                                                        {/* ── V2: Best Quote ── */}
                                                        {reportData.best_quote && (
                                                            <BestQuoteCard quote={reportData.best_quote} />
                                                        )}

                                                        {/* ── V2: Emotion Timeline (line chart) ── */}
                                                        <div style={{
                                                            padding: '16px 18px', borderRadius: '14px',
                                                            background: 'var(--card-bg)',
                                                            border: '1px solid var(--border-subtle)',
                                                        }}>
                                                            <EmotionTimelineChart days={weekDays} avgScore={avgScore} />
                                                        </div>

                                                        {/* ── V2: Task Completion Bar ── */}
                                                        <TaskCompletionBar
                                                            daysDone={daysDone}
                                                            daysTotal={reportData.past_days_count ?? 7}
                                                            days={weekDays}
                                                            prevWeekStats={reportData.prev_week_stats}
                                                        />

                                                        {/* ── Emotion Distribution Pie Chart (KEPT) ── */}
                                                        {weekDays.some(d => d.has_journal) && (
                                                            <div style={{
                                                                padding: '16px 18px', borderRadius: '14px',
                                                                background: 'var(--card-bg)',
                                                                border: '1px solid var(--border-subtle)',
                                                            }}>
                                                                <p style={{
                                                                    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
                                                                    fontFamily: satoshi,
                                                                }}>Emotion Distribution</p>
                                                                <EmotionPieChart days={weekDays} />
                                                            </div>
                                                        )}

                                                        {/* ── V2: Week Summary (replaces 3 old analysis blocks) ── */}
                                                        {reportData.week_summary ? (
                                                            <WeekSummaryCard summary={reportData.week_summary} />
                                                        ) : (
                                                            /* Backward compat: show old analysis blocks if week_summary missing */
                                                            <>
                                                                <AnalysisBlock label="What Went Well" content={reportData.what_went_well || ''} />
                                                                <AnalysisBlock label="Where You Slipped" content={reportData.where_you_slipped || ''} />
                                                                <AnalysisBlock label="Consistency Analysis" content={reportData.consistency_analysis || ''} />
                                                            </>
                                                        )}

                                                        {/* ── Hidden Insight (KEPT) ── */}
                                                        {reportData.hidden_insight && (
                                                            <div style={{
                                                                padding: '14px 16px', borderRadius: '12px',
                                                                background: 'var(--bg-surface)',
                                                                border: '1px solid var(--border-subtle)',
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                    <Sparkles size={14} color="#a78bfa" />
                                                                    <p style={{
                                                                        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                                                                        fontFamily: satoshi,
                                                                    }}>Hidden Insight</p>
                                                                </div>
                                                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>
                                                                    {reportData.hidden_insight}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* ── Daily Breakdown (KEPT, with upgraded coaching) ── */}
                                                        <DailyBreakdown days={weekDays} />

                                                        {/* ── V2: Trigger Pattern Table (Week 3+) ── */}
                                                        {reportData.trigger_patterns && reportData.trigger_patterns.length > 0 && (reportData.week_number ?? 1) >= 3 && (
                                                            <TriggerPatternTable patterns={reportData.trigger_patterns} />
                                                        )}

                                                        {/* ── Next week focus (KEPT) ── */}
                                                        {reportData.next_week_focus && (
                                                            <div style={{
                                                                padding: '16px', borderRadius: '12px',
                                                                background: 'var(--bg-surface)',
                                                                border: '1px solid var(--border-subtle)',
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                                    <Target size={14} color="#10b981" />
                                                                    <p style={{
                                                                        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                                                                        textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0,
                                                                        fontFamily: satoshi,
                                                                    }}>Next Week: Key Focus</p>
                                                                </div>
                                                                <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>
                                                                    {reportData.next_week_focus}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* ── V2: Week-over-Week Comparison (Week 2+) ── */}
                                                        {reportData.prev_week_stats && (reportData.week_number ?? 1) >= 2 && (
                                                            <WeekComparisonStrip
                                                                currentWeek={reportData.week_number ?? 1}
                                                                currentStats={{
                                                                    consistency: consistencyScore,
                                                                    avgMood: avgScore,
                                                                    momentum: reportData.momentum_score ?? 0,
                                                                }}
                                                                prevStats={reportData.prev_week_stats}
                                                            />
                                                        )}

                                                        {/* Plan Week N+1 prompt — only when next plan doesn't exist */}
                                                        {!weekInfo?.has_next_plan && (
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
                                                                        const event = new CustomEvent('request-next-week-plan', {
                                                                            detail: { week: (reportData.week_number ?? 1) + 1 }
                                                                        });
                                                                        window.dispatchEvent(event);
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
                                                        )}
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
                                                                {/* V2 Hero: Momentum + Badge + Stats row */}
                                                                <div className="grid-col-1-mobile" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '12px', alignItems: 'stretch', marginTop: '16px' }}>
                                                                    <MomentumScoreCard
                                                                        score={aw.report?.momentum_score ?? Math.round((arConsistency * 0.4) + (((aw.report?.avg_score ?? 0) / 10) * 100 * 0.3) + (arConsistency * 0.3))}
                                                                        label={aw.report?.momentum_label ?? (arConsistency >= 85 ? 'Peak' : arConsistency >= 70 ? 'Strong Week' : 'Building')}
                                                                    />
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                                        {aw.report?.week_badge && (
                                                                            <WeekBadgeCard badge={aw.report.week_badge} />
                                                                        )}
                                                                        <div className="grid-col-1-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', flex: 1 }}>
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

                                                                {/* Best Quote */}
                                                                {aw.report?.best_quote && (
                                                                    <div style={{ marginTop: '14px' }}>
                                                                        <BestQuoteCard quote={aw.report.best_quote} />
                                                                    </div>
                                                                )}

                                                                {/* Emotion Timeline line chart */}
                                                                {arDays.length > 0 && arDays.some(d => d.has_journal) && (
                                                                    <div style={{
                                                                        marginTop: '16px', padding: '16px 18px', borderRadius: '14px',
                                                                        background: 'var(--card-bg)',
                                                                        border: '1px solid var(--border-subtle)',
                                                                    }}>
                                                                        <EmotionTimelineChart days={arDays} avgScore={aw.report?.avg_score ?? 0} />
                                                                    </div>
                                                                )}

                                                                {/* Task Completion Bar */}
                                                                <div style={{ marginTop: '14px' }}>
                                                                    <TaskCompletionBar
                                                                        daysDone={arDaysDone}
                                                                        daysTotal={arPastDays}
                                                                        days={arDays}
                                                                        prevWeekStats={aw.report?.prev_week_stats}
                                                                    />
                                                                </div>

                                                                {/* Emotion distribution pie */}
                                                                {arDays.length > 0 && arDays.some(d => d.has_journal) && (
                                                                    <div style={{
                                                                        marginTop: '16px', padding: '16px 18px', borderRadius: '14px',
                                                                        background: 'var(--card-bg)',
                                                                        border: '1px solid var(--border-subtle)',
                                                                    }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px', fontFamily: satoshi }}>Emotion Distribution</p>
                                                                        <EmotionPieChart days={arDays} />
                                                                    </div>
                                                                )}

                                                                {/* Week Summary (V2) or old analysis blocks (legacy) */}
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                                                                    {aw.report?.week_summary ? (
                                                                        <WeekSummaryCard summary={aw.report.week_summary} />
                                                                    ) : (
                                                                        <>
                                                                            {aw.report?.emotional_arc && <AnalysisBlock label="Emotional Arc" content={aw.report.emotional_arc} />}
                                                                            {aw.report?.what_went_well && <AnalysisBlock label="What Went Well" content={aw.report.what_went_well} />}
                                                                            {aw.report?.where_you_slipped && <AnalysisBlock label="Where You Slipped" content={aw.report.where_you_slipped} />}
                                                                            {aw.report?.consistency_analysis && <AnalysisBlock label="Consistency Analysis" content={aw.report.consistency_analysis} />}
                                                                        </>
                                                                    )}
                                                                    {aw.report?.hidden_insight && (
                                                                        <div style={{
                                                                            padding: '14px 16px', borderRadius: '12px',
                                                                            background: 'var(--bg-surface)',
                                                                            border: '1px solid var(--border-subtle)',
                                                                        }}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                                                                                <Sparkles size={14} color="#a78bfa" />
                                                                                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontFamily: satoshi }}>Hidden Insight</p>
                                                                            </div>
                                                                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{aw.report.hidden_insight}</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Daily Breakdown */}
                                                                {arDays.length > 0 && (
                                                                    <DailyBreakdown days={arDays} />
                                                                )}

                                                                {/* Trigger Patterns (Week 3+) */}
                                                                {aw.report?.trigger_patterns && aw.report.trigger_patterns.length > 0 && (aw.week_number ?? 1) >= 3 && (
                                                                    <div style={{ marginTop: '14px' }}>
                                                                        <TriggerPatternTable patterns={aw.report.trigger_patterns} />
                                                                    </div>
                                                                )}

                                                                {/* Next Week Focus */}
                                                                {aw.report?.next_week_focus && (
                                                                    <div style={{
                                                                        padding: '14px 16px', borderRadius: '12px',
                                                                        background: 'var(--bg-surface)',
                                                                        border: '1px solid var(--border-subtle)',
                                                                        marginTop: '10px',
                                                                    }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px' }}>
                                                                            <Target size={14} color="#10b981" />
                                                                            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontFamily: satoshi }}>Next Week Focus</p>
                                                                        </div>
                                                                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{aw.report.next_week_focus}</p>
                                                                    </div>
                                                                )}
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
