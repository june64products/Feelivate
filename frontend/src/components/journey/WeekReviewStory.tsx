import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import WeekReviewDashboard, { ViewButton } from './WeekReviewDashboard';
import type { WeeklyReport, WeeklyReportDay } from '../../api';
import { clashDisplay, satoshi } from '../mission/missionTheme';

/**
 * The weekly report as a magazine: nine swipeable pages in a phone-sized
 * frame — the week drawn first, then momentum, the best line, wins / dips /
 * pattern, the hidden insight, the days, mood & patterns, week over week,
 * and next week. Same data, same rules as before (patterns from Week 3,
 * comparison from Week 2, the plan action only when the next week isn't
 * built yet); only the look changed.
 */

export type ReportData = NonNullable<WeeklyReport['report']>;

const EMOTION_COLORS: Record<string, string> = {
    motivated: '#f59e0b', stressed: '#ef4444', focused: '#6366f1', anxious: '#f97316', confident: '#10b981',
    drained: '#8b5cf6', excited: '#ec4899', neutral: '#6b7280', frustrated: '#dc2626', hopeful: '#22c55e', calm: '#6b7280',
};
const emotionColor = (label?: string | null) => EMOTION_COLORS[(label ?? 'neutral').toLowerCase()] ?? '#6b7280';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const parseISO = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const weekday = (iso: string, long = false) => parseISO(iso).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short' });
const dayNum = (iso: string) => parseISO(iso).getDate();
const fmtRange = (a?: string, b?: string) => {
    if (!a || !b) return '';
    const f = (iso: string) => parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${f(a)} – ${f(b)}`;
};

// ─── type bits ────────────────────────────────────────────────────────────────
const kicker: CSSProperties = { fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: satoshi, margin: 0 };
const cap: CSSProperties = { fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: satoshi, margin: 0 };
const display = (size: string, lh = 1.02): CSSProperties => ({ fontFamily: clashDisplay, fontWeight: 600, letterSpacing: '-0.03em', fontSize: size, lineHeight: lh, color: 'var(--text-primary)', margin: 0 });
const num = (size: string): CSSProperties => ({ fontFamily: clashDisplay, fontWeight: 600, letterSpacing: '-0.04em', fontSize: size, lineHeight: 1, color: 'var(--text-primary)' });
const body = (size = '15px'): CSSProperties => ({ fontSize: size, lineHeight: 1.6, color: 'var(--text-primary)', fontFamily: satoshi, margin: 0 });
const Rule = ({ strong = false, w }: { strong?: boolean; w?: string }) => (
    <div style={{ height: '1px', width: w ?? '100%', background: strong ? 'var(--text-primary)' : 'var(--border-medium)', opacity: strong ? 0.9 : 1, margin: '14px 0' }} />
);
const Kicker = ({ n, children }: { n: number; children: ReactNode }) => <p style={kicker}>{ROMAN[n - 1]} · {children}</p>;

function Stamp({ name }: { name: string }) {
    return (
        <span style={{
            display: 'inline-block', transform: 'rotate(-5deg)', padding: '6px 11px', borderRadius: '6px',
            border: '1.5px solid var(--accent-warm)', color: 'var(--accent-warm)',
            fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi, whiteSpace: 'nowrap',
        }}>★ {name}</span>
    );
}

// ─── the week, drawn ──────────────────────────────────────────────────────────
function InkChart({ days }: { days: WeeklyReportDay[] }) {
    const n = Math.max(days.length, 1);
    const W = 420, top = 40, base = 160;
    const x = (i: number) => (n === 1 ? W / 2 : 50 + (i * 348) / (n - 1));
    const y = (score: number) => base - (Math.max(0, Math.min(10, score)) / 10) * (base - top);
    const pts = days.map((d, i) => ({ d, i, has: d.has_journal && typeof d.score === 'number' }));
    const noted = pts.filter(p => p.has);
    const gid = useMemo(() => `ink-${Math.random().toString(36).slice(2, 8)}`, []);
    const segs: { a: typeof noted[number]; b: typeof noted[number]; gap: boolean }[] = [];
    for (let k = 1; k < noted.length; k++) segs.push({ a: noted[k - 1], b: noted[k], gap: noted[k].i - noted[k - 1].i > 1 });
    const area = noted.length >= 2
        ? `M${x(noted[0].i)},${y(noted[0].d.score!)} ` + noted.slice(1).map(p => `L${x(p.i)},${y(p.d.score!)}`).join(' ') + ` L${x(noted[noted.length - 1].i)},${base} L${x(noted[0].i)},${base} Z`
        : '';
    return (
        <svg viewBox={`0 0 ${W} 222`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-hidden="true">
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#ffb24d" stopOpacity="0.55" /><stop offset="1" stopColor="#ff5a36" stopOpacity="0" />
                </linearGradient>
            </defs>
            <g stroke="var(--border-medium)" strokeWidth="1">
                <line x1="20" y1={top} x2="400" y2={top} /><line x1="20" y1={(top + base) / 2} x2="400" y2={(top + base) / 2} /><line x1="20" y1={base} x2="400" y2={base} />
            </g>
            <g fontSize="9" fill="var(--text-muted)" fontFamily={satoshi}>
                <text x="6" y={top + 4}>10</text><text x="10" y={(top + base) / 2 + 4}>5</text><text x="10" y={base + 4}>0</text>
            </g>
            {area && <path d={area} fill={`url(#${gid})`} />}
            {segs.map((s, k) => (
                <line key={k} x1={x(s.a.i)} y1={y(s.a.d.score!)} x2={x(s.b.i)} y2={y(s.b.d.score!)} stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray={s.gap ? '4 5' : undefined} />
            ))}
            {pts.map(p => p.has
                ? <circle key={p.d.date} cx={x(p.i)} cy={y(p.d.score!)} r="6" fill="var(--accent-warm)" />
                : <circle key={p.d.date} cx={x(p.i)} cy={base} r="5" fill="none" stroke="var(--text-muted)" strokeDasharray="3 3" />)}
            {pts.map(p => p.has && (
                <text key={`s-${p.d.date}`} x={x(p.i)} y={y(p.d.score!) - 12} textAnchor="middle" fontSize="11" fontFamily={clashDisplay} fontWeight="600" fill="var(--text-primary)">{p.d.score}</text>
            ))}
            {pts.map(p => (
                <text key={`w-${p.d.date}`} x={x(p.i)} y="190" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily={satoshi} fill="var(--text-secondary)">{weekday(p.d.date).toUpperCase()}</text>
            ))}
            {pts.map(p => (
                <text key={`c-${p.d.date}`} x={x(p.i)} y="210" textAnchor="middle" fontSize={p.has || p.d.checkin === 'done' ? 12 : 10} fontFamily={satoshi}
                    fill={p.has || p.d.checkin === 'done' ? 'var(--color-success)' : 'var(--text-muted)'}>
                    {p.has || p.d.checkin === 'done' ? '✓' : p.d.checkin === 'pending' ? '·' : '—'}
                </text>
            ))}
        </svg>
    );
}

function EmotionRing({ days }: { days: WeeklyReportDay[] }) {
    const counts: Record<string, number> = {};
    days.forEach(d => { if (d.has_journal && d.emotion) counts[d.emotion] = (counts[d.emotion] ?? 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!total) return null;
    const C = 2 * Math.PI * 44;
    let offset = 0;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '16px', alignItems: 'center' }}>
            <svg viewBox="0 0 120 120" style={{ width: '112px', height: '112px' }} aria-hidden="true">
                <circle cx="60" cy="60" r="44" fill="none" stroke="var(--border-subtle)" strokeWidth="18" />
                {entries.map(([label, n]) => {
                    const len = (n / total) * C;
                    const el = <circle key={label} cx="60" cy="60" r="44" fill="none" stroke={emotionColor(label)} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />;
                    offset += len;
                    return el;
                })}
            </svg>
            <div style={{ fontSize: '12.5px', lineHeight: 2, fontFamily: satoshi, color: 'var(--text-primary)' }}>
                {entries.map(([label, n]) => (
                    <div key={label}><span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: emotionColor(label), marginRight: '7px', verticalAlign: 'middle' }} />{label} {Math.round((n / total) * 100)}%</div>
                ))}
            </div>
        </div>
    );
}

function Delta({ now, prev, invert = false, suffix = '' }: { now: number; prev: number; invert?: boolean; suffix?: string }) {
    const d = Math.round((now - prev) * 10) / 10;
    if (!d) return <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>· same</span>;
    const good = invert ? d < 0 : d > 0;
    return <span style={{ fontSize: '13px', fontFamily: satoshi, color: good ? 'var(--color-success)' : 'var(--accent-warm)' }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{suffix}</span>;
}

// ─── the story ────────────────────────────────────────────────────────────────
interface WeekReviewStoryProps {
    report: ReportData;
    /** The week's calendar (from the report, or rebuilt locally when the report has none). */
    days: WeeklyReportDay[];
    weekStart?: string;
    weekEnd?: string;
    /** The "Plan Week N+1" action, only when the next week isn't built yet. */
    onPlanNext?: () => void;
    /** Archive rows: a shorter frame. */
    compact?: boolean;
    /** Frame height; defaults suit the Journey page and the Sunday card. */
    height?: string;
}

export default function WeekReviewStory({ report, days, weekStart, weekEnd, onPlanNext, compact = false, height }: WeekReviewStoryProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(0);
    // The View button: the dashboard (everything on one screen) by default, or the swipeable pages.
    const [mode, setMode] = useState<'dashboard' | 'swipe'>('dashboard');

    const wk = report.week_number ?? 1;
    const pastDays = report.past_days_count ?? days.length;
    const noted = days.filter(d => d.has_journal);
    const quoteDay = useMemo(() => {
        const q = (report.best_quote ?? '').trim().toLowerCase();
        return noted.find(d => d.one_liner && q && (q.includes(d.one_liner.toLowerCase().slice(0, 30)) || d.one_liner.toLowerCase().includes(q.slice(0, 30))))
            ?? [...noted].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    }, [report.best_quote, noted]);

    const summary = report.week_summary;
    const legacy = !summary;
    const r = report as ReportData & { best_days?: string[]; worst_days?: string[]; mood_trend?: string; recurring_friction?: string[]; patterns?: { best_days?: string[]; worst_days?: string[]; mood_trend?: string; recurring_friction?: string[] } };
    const bestDays = r.best_days ?? r.patterns?.best_days ?? report.peak_performance_days ?? [];
    const worstDays = r.worst_days ?? r.patterns?.worst_days ?? [];
    const moodTrend = r.mood_trend ?? r.patterns?.mood_trend ?? '';
    const friction = r.recurring_friction ?? r.patterns?.recurring_friction ?? [];
    const showTriggers = !!report.trigger_patterns && report.trigger_patterns.length > 0 && wk >= 3;
    const showCompare = !!report.prev_week_stats && wk >= 2;
    const planNotes = String(report.next_week_plan_context ?? '').split(/\n+/).map(t => t.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean);

    // ── pages (each a full card) ──
    const pages: ReactNode[] = [];

    pages.push(
        <>
            <p style={kicker}>Week {wk}{weekStart && weekEnd ? ` · ${fmtRange(weekStart, weekEnd)}` : ''}{report.week_theme ? ` · ${report.week_theme}` : ''}</p>
            <h2 style={{ ...display(compact ? 'clamp(28px,7vw,36px)' : 'clamp(32px,8vw,44px)', 0.98), margin: '10px 0 6px' }}>The week, drawn.</h2>
            <p style={cap}>How each evening felt · dot = voice note · dashed = no note</p>
            <div style={{ margin: '12px 0 4px' }}><InkChart days={days} /></div>
            <Rule strong />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div><div style={num('40px')}>{report.days_done ?? noted.length}<span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>/{pastDays}</span></div><p style={{ ...cap, marginTop: '6px' }}>days done</p></div>
                <div><div style={num('40px')}>{report.avg_score ?? 0}</div><p style={{ ...cap, marginTop: '6px' }}>avg mood{report.dominant_emotion ? ` · mostly ${report.dominant_emotion}` : ''}</p></div>
            </div>
        </>,
    );

    const momentum = report.momentum_score ?? Math.round(((report.consistency_score ?? 0) * 0.4) + (((report.avg_score ?? 0) / 10) * 100 * 0.3) + ((report.consistency_score ?? 0) * 0.3));
    const momentumLabel = report.momentum_label ?? ((report.consistency_score ?? 0) >= 85 ? 'Peak' : (report.consistency_score ?? 0) >= 70 ? 'Strong Week' : 'Building');
    pages.push(
        <>
            <Kicker n={2}>Momentum</Kicker>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', marginTop: '18px', flexWrap: 'wrap' }}>
                <div style={num('clamp(84px, 24vw, 112px)')}>{momentum}</div>
                <div style={{ paddingBottom: '12px' }}><div style={display('22px')}>{momentumLabel}</div><p style={cap}>out of 100</p></div>
            </div>
            <Rule strong />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                <div><div style={num('30px')}>{report.consistency_score ?? 0}%</div><p style={{ ...cap, marginTop: '6px' }}>consistency</p></div>
                <div><div style={num('30px')}>{report.days_missed ?? 0}</div><p style={{ ...cap, marginTop: '6px' }}>days missed</p></div>
            </div>
            {report.week_badge?.name && (
                <>
                    <Rule />
                    <div style={{ marginTop: '6px' }}><Stamp name={report.week_badge.name} /></div>
                    {report.week_badge.reason && <p style={{ ...body('14.5px'), marginTop: '14px' }}>{report.week_badge.reason}</p>}
                </>
            )}
            <p style={{ ...cap, marginTop: 'auto', paddingTop: '18px' }}>momentum = 40% consistency · 30% mood · 30% execution</p>
        </>,
    );

    if (report.best_quote) {
        pages.push(
            <div style={{ margin: 'auto 0' }}>
                <Kicker n={3}>In your words</Kicker>
                <div style={{ fontFamily: clashDisplay, fontSize: '120px', lineHeight: 0.6, color: 'var(--accent-warm)', margin: '28px 0 0' }}>“</div>
                <h2 style={{ ...display(compact ? 'clamp(24px,6.5vw,30px)' : 'clamp(28px,7.5vw,38px)', 1.08), marginTop: '8px' }}>{report.best_quote}</h2>
                <Rule strong w="48px" />
                {quoteDay && <p style={cap}>{weekday(quoteDay.date, true)}{quoteDay.emotion ? ` · ${quoteDay.emotion}` : ''}{quoteDay.score ? ` · ${quoteDay.score}/10` : ''}</p>}
            </div>,
        );
    }

    pages.push(
        <>
            <Kicker n={4}>The week in three parts</Kicker>
            <h2 style={{ ...display(compact ? '24px' : 'clamp(26px,7vw,32px)', 1.05), margin: '8px 0 4px' }}>What went well, where it slipped, what repeats.</h2>
            <Rule />
            {legacy ? (
                <>
                    {report.emotional_arc && <Block label="Emotional arc" text={report.emotional_arc} />}
                    {report.what_went_well && <Block label="What went well" text={report.what_went_well} color="var(--color-success)" lede />}
                    {report.where_you_slipped && <Block label="Where you slipped" text={report.where_you_slipped} color="var(--accent-warm)" />}
                    {report.consistency_analysis && <Block label="Consistency" text={report.consistency_analysis} />}
                </>
            ) : (
                <>
                    {summary.wins && <Block label="Wins" text={summary.wins} color="var(--color-success)" lede />}
                    {summary.dips && <Block label="Dips" text={summary.dips} color="var(--accent-warm)" />}
                    {summary.pattern && <Block label="Pattern" text={summary.pattern} />}
                </>
            )}
        </>,
    );

    if (report.hidden_insight) {
        pages.push(
            <div style={{ margin: 'auto 0' }}>
                <Kicker n={5}>Hidden insight</Kicker>
                <h2 style={{ ...display(compact ? 'clamp(24px,6.5vw,30px)' : 'clamp(26px,7.5vw,36px)', 1.08), marginTop: '22px' }}>{report.hidden_insight}</h2>
                <Rule strong w="48px" />
                <p style={cap}>Something you probably hadn't noticed</p>
            </div>,
        );
    }

    if (days.length) {
        pages.push(
            <>
                <Kicker n={6}>Day by day</Kicker>
                <h2 style={{ ...display('26px', 1.05), margin: '8px 0 4px' }}>{days.length} days, one line each.</h2>
                <div style={{ marginTop: '6px' }}>
                    {days.map(d => {
                        const done = d.has_journal || d.checkin === 'done';
                        const muted = !done;
                        return (
                            <div key={d.date} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: '12px', padding: '11px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div>
                                    <div style={{ fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 800 }}>{weekday(d.date)}</div>
                                    <div style={{ ...num('18px'), color: muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{dayNum(d.date)}</div>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    {d.planned_task && <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45, fontFamily: satoshi }}>{d.planned_task}</div>}
                                    {d.has_journal && d.one_liner && (
                                        <div style={{ fontSize: '12.5px', marginTop: '3px', color: 'var(--text-primary)', fontFamily: satoshi, lineHeight: 1.45 }}>
                                            “{d.one_liner}” {d.emotion && <span style={{ ...cap, color: 'var(--accent-warm)' }}>{d.emotion} {d.score}</span>}
                                        </div>
                                    )}
                                    {!d.has_journal && (
                                        <div style={{ ...cap, marginTop: '3px' }}>{d.checkin === 'pending' ? 'ahead' : d.checkin === 'done' ? 'done · no note' : 'no note'}</div>
                                    )}
                                    {(d.coaching_insight || d.coaching_micro_action) && (
                                        <div style={{ fontSize: '12px', color: 'var(--accent-warm)', marginTop: '4px', fontFamily: satoshi, lineHeight: 1.45 }}>
                                            {d.coaching_insight}{d.coaching_insight && d.coaching_micro_action ? ' → ' : ''}{d.coaching_micro_action}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>,
        );
    }

    if (noted.length || friction.length || bestDays.length || moodTrend || showTriggers) {
        pages.push(
            <>
                <Kicker n={7}>Mood &amp; patterns</Kicker>
                {moodTrend && <h2 style={{ ...display('26px', 1.05), margin: '8px 0 4px' }}>{moodTrend}</h2>}
                {noted.length > 0 && <><p style={{ ...cap, marginTop: '12px', marginBottom: '8px' }}>Emotion mix</p><EmotionRing days={days} /></>}
                {(bestDays.length > 0 || worstDays.length > 0) && (
                    <>
                        <Rule />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                            <div><p style={{ ...cap, color: 'var(--color-success)' }}>Best days</p><div style={display('22px')}>{bestDays.join(' · ') || '—'}</div></div>
                            <div><p style={{ ...cap, color: 'var(--accent-warm)' }}>Hardest days</p><div style={display('22px')}>{worstDays.join(' · ') || '—'}</div></div>
                        </div>
                    </>
                )}
                {friction.length > 0 && <><Rule /><p style={cap}>Recurring friction</p><p style={{ ...body('14px'), marginTop: '6px' }}>{friction.join(' · ')}</p></>}
                {showTriggers ? (
                    <>
                        <Rule />
                        <p style={cap}>Trigger patterns</p>
                        <div style={{ marginTop: '6px' }}>
                            {report.trigger_patterns!.map((t, i) => (
                                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: '13px', fontFamily: satoshi }}>
                                    <span style={{ color: 'var(--text-primary)' }}>{t.pattern}</span>
                                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.frequency}{t.weeks_detected?.length ? ` · wk ${t.weeks_detected.join(', ')}` : ''}</span>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <p style={{ ...cap, marginTop: 'auto', paddingTop: '18px' }}>Cross-week trigger patterns appear from Week 3</p>
                )}
            </>,
        );
    }

    if (showCompare) {
        const p = report.prev_week_stats!;
        pages.push(
            <>
                <Kicker n={8}>Week over week</Kicker>
                <h2 style={{ ...display('26px', 1.05), margin: '8px 0 4px' }}>Against Week {wk - 1}.</h2>
                <Rule />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    <div><p style={cap}>Consistency</p><div style={num('34px')}>{report.consistency_score}% <Delta now={report.consistency_score} prev={p.consistency_score} /></div></div>
                    <div><p style={cap}>Momentum</p><div style={num('34px')}>{momentum} <Delta now={momentum} prev={p.momentum_score} /></div></div>
                </div>
                <Rule />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
                    <div><p style={cap}>Avg mood</p><div style={num('34px')}>{report.avg_score} <Delta now={report.avg_score} prev={p.avg_score} /></div></div>
                    <div><p style={cap}>Days done</p><div style={num('34px')}>{report.days_done} <Delta now={report.days_done} prev={p.days_done} /></div></div>
                </div>
            </>,
        );
    }

    if (report.next_week_focus || planNotes.length || onPlanNext) {
        pages.push(
            <>
                <Kicker n={9}>Next week</Kicker>
                {report.next_week_focus && <h2 style={{ ...display(compact ? 'clamp(24px,6.5vw,30px)' : 'clamp(26px,7.5vw,34px)', 1.08), marginTop: '8px' }}>{report.next_week_focus}</h2>}
                <Rule strong />
                {planNotes.length > 0 && (
                    <>
                        <p style={cap}>The plan will account for</p>
                        <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '14.5px', lineHeight: 1.7, fontFamily: satoshi, color: 'var(--text-primary)' }}>
                            {planNotes.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                    </>
                )}
                {onPlanNext && (
                    <div style={{ marginTop: 'auto', paddingTop: '18px' }}>
                        <p style={{ ...body('12.5px'), color: 'var(--text-secondary)', marginBottom: '10px' }}>AI will build it using this week's performance data.</p>
                        <button onClick={onPlanNext} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 20px', borderRadius: '100px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontWeight: 700, fontSize: '13px', border: 0, cursor: 'pointer', fontFamily: satoshi }}>
                            Plan Week {wk + 1} →
                        </button>
                    </div>
                )}
            </>,
        );
    }

    // ── paging ──
    const count = pages.length;
    const go = (n: number) => {
        const el = trackRef.current; if (!el) return;
        const i = Math.max(0, Math.min(count - 1, n));
        el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    };
    useEffect(() => {
        const el = trackRef.current; if (!el) return;
        const onScroll = () => setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, []);
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(page + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(page - 1); }
    };

    const frameH = height ?? (compact ? 'min(64vh, 560px)' : 'min(78vh, 760px)');
    const swipe = mode === 'swipe';

    // The View button always names the OTHER way of reading.
    const viewToggle = swipe
        ? <ViewButton label="Dashboard" icon={<LayoutGrid size={12} />} onClick={() => setMode('dashboard')} />
        : <ViewButton label="Swipe" onClick={() => setMode('swipe')} />;

    if (!swipe) {
        return (
            <div aria-label={`Week ${wk} review`} style={{ width: '100%', fontFamily: satoshi }}>
                <WeekReviewDashboard report={report} days={days} weekStart={weekStart} weekEnd={weekEnd} onPlanNext={onPlanNext} viewButton={viewToggle} />
            </div>
        );
    }

    return (
        <div
            tabIndex={0}
            onKeyDown={onKey}
            aria-roledescription="carousel"
            aria-label={`Week ${wk} review`}
            style={{
                position: 'relative', width: '100%', maxWidth: '520px', margin: '0 auto', height: frameH,
                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '24px',
                boxShadow: compact ? 'none' : 'var(--shadow-lg)', overflow: 'hidden', outline: 'none', fontFamily: satoshi,
            }}
        >
            <div style={{ position: 'absolute', top: '12px', left: '16px', right: '16px', display: 'flex', gap: '4px', zIndex: 3 }}>
                {pages.map((_, i) => (
                    <button key={i} onClick={() => go(i)} aria-label={`Page ${i + 1}`} style={{ flex: 1, height: '10px', padding: 0, background: 'none', border: 0, cursor: 'pointer' }}>
                        <span style={{ display: 'block', height: '2px', borderRadius: '2px', background: i <= page ? 'var(--text-primary)' : 'var(--border-medium)', transition: 'background 0.25s' }} />
                    </button>
                ))}
            </div>
            <div ref={trackRef} style={{ height: '100%', display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }} className="hide-scrollbar">
                {pages.map((content, i) => (
                    <section key={i} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', height: '100%', padding: compact ? '40px 20px 72px' : '44px 26px 76px', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxSizing: 'border-box' }}>
                        {content}
                    </section>
                ))}
            </div>
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '10px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                background: 'linear-gradient(to top, var(--card-bg) 55%, transparent)', zIndex: 3,
            }}>
                {viewToggle}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous page" style={navBtn(page === 0)}><ChevronLeft size={15} /></button>
                    <span style={{ ...cap, color: 'var(--text-muted)', minWidth: '42px', textAlign: 'center' }}>{page + 1} / {count}</span>
                    <button onClick={() => go(page + 1)} disabled={page === count - 1} aria-label="Next page" style={navBtn(page === count - 1)}><ChevronRight size={15} /></button>
                </div>
            </div>
            <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
        </div>
    );
}

const navBtn = (disabled: boolean): CSSProperties => ({
    width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
});

function Block({ label, text, color, lede = false }: { label: string; text: string; color?: string; lede?: boolean }) {
    return (
        <div style={{ marginBottom: '16px' }}>
            <p style={{ ...cap, color: color ?? 'var(--text-muted)' }}>{label}</p>
            <p style={{ ...body(lede ? '15.5px' : '15px'), marginTop: '6px' }} className={lede ? 'review-lede' : undefined}>{text}</p>
            {lede && <style>{`.review-lede::first-letter{font-family:${clashDisplay};font-size:46px;float:left;line-height:.8;padding:6px 8px 0 0;font-weight:600}`}</style>}
        </div>
    );
}
