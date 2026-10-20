import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { MoveHorizontal } from 'lucide-react';
import type { WeeklyReport, WeeklyReportDay } from '../../api';
import { clashDisplay, satoshi } from '../mission/missionTheme';

/**
 * The weekly report as a dashboard: everything on one screen, in five
 * labelled sections — 01 At a glance, then 02 How it felt · 03 What your
 * mentor saw · 04 Next week side by side, then 05 Day by day. Same data and
 * the same rules as the swipe cards (comparison from Week 2, trigger
 * patterns from Week 3, the plan action only while the next week isn't
 * built); only the look.
 *
 * Layout tiers come from the container's own width (not the viewport), so
 * the same component reads right on the Journey page, inside the Sunday
 * card, and in an archive row.
 */

export type ReportData = NonNullable<WeeklyReport['report']>;

const EMOTION_COLORS: Record<string, string> = {
    motivated: '#f59e0b', stressed: '#ef4444', focused: '#6366f1', anxious: '#f97316', confident: '#10b981',
    drained: '#8b5cf6', excited: '#ec4899', neutral: '#6b7280', frustrated: '#dc2626', hopeful: '#22c55e', calm: '#0ea5e9',
};
const emotionColor = (label?: string | null) => EMOTION_COLORS[(label ?? 'neutral').toLowerCase()] ?? '#6b7280';

const parseISO = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const weekday = (iso: string, long = false) => parseISO(iso).toLocaleDateString('en-GB', { weekday: long ? 'long' : 'short' });
const dayNum = (iso: string) => parseISO(iso).getDate();
const fmtRange = (a?: string, b?: string) => {
    if (!a || !b) return '';
    const f = (iso: string) => parseISO(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${f(a)} – ${f(b)}`;
};

export type Tier = 'wide' | 'mid' | 'narrow';

// ─── type bits ────────────────────────────────────────────────────────────────
const lab: CSSProperties = { fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.2, fontFamily: satoshi };
const cap: CSSProperties = { fontSize: '10.5px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, lineHeight: 1.3, fontFamily: satoshi };
const body: CSSProperties = { fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text-primary)', margin: 0, fontFamily: satoshi };
const num = (size: string): CSSProperties => ({ fontFamily: clashDisplay, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, fontSize: size, color: 'var(--text-primary)' });
const disp = (size: string, lh = 1.1): CSSProperties => ({ fontFamily: clashDisplay, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: lh, fontSize: size, color: 'var(--text-primary)', margin: 0 });
// Small tiles (01 and the day cards) and the large reading tiles of the middle row.
const tile: CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: '14px', padding: '12px 14px', boxShadow: 'var(--shadow-sm)', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' };
const tileL: CSSProperties = { ...tile, borderRadius: '16px', padding: '14px 16px', gap: '8px', flex: 1 };
const chip = (color?: string): CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 7px', borderRadius: '100px', fontSize: '9.5px', fontWeight: 700,
    letterSpacing: '0.04em', border: '1px solid var(--border-medium)', background: 'var(--bg-surface)', whiteSpace: 'nowrap', lineHeight: 1.2,
    color: color ?? 'var(--text-primary)', fontFamily: satoshi,
});
const Dot = ({ color }: { color: string }) => <i style={{ width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block', background: color, flexShrink: 0 }} />;

export function SectionHead({ n, title, meta, right }: { n: string; title: string; meta?: string; right?: ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span style={{ fontFamily: clashDisplay, fontWeight: 600, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{n}</span>
            <span style={{ ...lab, letterSpacing: '0.16em', whiteSpace: 'nowrap' }}>{title}</span>
            <span style={{ flex: 1, height: '1px', background: 'var(--border-medium)' }} />
            {meta && <span style={{ ...cap, fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '55%' }}>{meta}</span>}
            {right}
        </div>
    );
}

function Stamp({ name, reason }: { name: string; reason?: string }) {
    return (
        <span title={reason || undefined} style={{
            display: 'inline-block', transform: 'rotate(-4deg)', padding: '4px 9px', borderRadius: '6px',
            border: '1.5px solid var(--accent-warm)', color: 'var(--accent-warm)', background: 'var(--card-bg)',
            fontSize: '10px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi, whiteSpace: 'nowrap', cursor: reason ? 'help' : 'default',
        }}>★ {name}</span>
    );
}

function Delta({ now, prev, suffix = '' }: { now: number; prev: number; suffix?: string }) {
    const d = Math.round((now - prev) * 10) / 10;
    if (!d) return <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: satoshi }}>· same as last week</span>;
    return <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: satoshi, color: d > 0 ? 'var(--color-success)' : 'var(--accent-warm)' }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}{suffix} vs last week</span>;
}

// ─── charts ───────────────────────────────────────────────────────────────────
/**
 * The evening-mood line, kept compact: a fixed 300×118 drawing that never
 * stretches wider than 380px, so seven points sit close together instead
 * of being pulled across the whole tile.
 */
function MoodChart({ days }: { days: WeeklyReportDay[] }) {
    const n = Math.max(days.length, 1);
    const W = 300, H = 118, top = 18, base = 94, left = 30, right = 270;
    const x = (i: number) => (n === 1 ? W / 2 : left + (i * (right - left)) / (n - 1));
    const y = (score: number) => base - (Math.max(0, Math.min(10, score)) / 10) * (base - top);
    const pts = days.map((d, i) => ({ d, i, has: d.has_journal && typeof d.score === 'number' }));
    const noted = pts.filter(p => p.has);
    const gid = useMemo(() => `mood-${Math.random().toString(36).slice(2, 8)}`, []);
    const segs: { a: typeof noted[number]; b: typeof noted[number]; gap: boolean }[] = [];
    for (let k = 1; k < noted.length; k++) segs.push({ a: noted[k - 1], b: noted[k], gap: noted[k].i - noted[k - 1].i > 1 });
    const area = noted.length >= 2
        ? `M${x(noted[0].i)},${y(noted[0].d.score!)} ` + noted.slice(1).map(p => `L${x(p.i)},${y(p.d.score!)}`).join(' ') + ` L${x(noted[noted.length - 1].i)},${base} L${x(noted[0].i)},${base} Z`
        : '';
    const dom = noted.length ? emotionColor(noted.map(p => p.d.emotion).sort((a, b) => noted.filter(q => q.d.emotion === b).length - noted.filter(q => q.d.emotion === a).length)[0]) : 'var(--accent-warm)';
    return (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', maxWidth: '380px', height: `${H}px`, display: 'block' }} aria-hidden="true">
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={dom} stopOpacity="0.32" /><stop offset="1" stopColor={dom} stopOpacity="0" />
                </linearGradient>
            </defs>
            <g stroke="var(--border-subtle)" strokeWidth="1">
                <line x1="12" y1={top} x2={W - 12} y2={top} /><line x1="12" y1={(top + base) / 2} x2={W - 12} y2={(top + base) / 2} /><line x1="12" y1={base} x2={W - 12} y2={base} />
            </g>
            {area && <path d={area} fill={`url(#${gid})`} />}
            {segs.map((s, k) => (
                <line key={k} x1={x(s.a.i)} y1={y(s.a.d.score!)} x2={x(s.b.i)} y2={y(s.b.d.score!)} stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeDasharray={s.gap ? '4 5' : undefined} />
            ))}
            {pts.map(p => p.has
                ? <circle key={p.d.date} cx={x(p.i)} cy={y(p.d.score!)} r="6" fill={emotionColor(p.d.emotion)} />
                : <circle key={p.d.date} cx={x(p.i)} cy={base} r="5" fill="none" stroke="var(--text-muted)" strokeDasharray="3 3" />)}
            {pts.map(p => p.has && (
                <text key={`s-${p.d.date}`} x={x(p.i)} y={y(p.d.score!) - 12} textAnchor="middle" fontSize="11" fontFamily={clashDisplay} fontWeight="600" fill="var(--text-primary)">{p.d.score}</text>
            ))}
            {pts.map(p => {
                const done = p.has || p.d.checkin === 'done';
                return (
                    <text key={`w-${p.d.date}`} x={x(p.i)} y={H - 6} textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily={satoshi} fill="var(--text-secondary)">
                        {weekday(p.d.date).toUpperCase()} {done ? '✓' : p.d.checkin === 'pending' ? '·' : '—'}
                    </text>
                );
            })}
        </svg>
    );
}

/** The week's emotions as one thin stacked bar with a legend under it. */
function EmotionMix({ days }: { days: WeeklyReportDay[] }) {
    const counts: Record<string, number> = {};
    days.forEach(d => { if (d.has_journal && d.emotion) counts[d.emotion] = (counts[d.emotion] ?? 0) + 1; });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return (
        <div>
            <p style={{ ...lab, marginBottom: '5px' }}>Emotion mix</p>
            {!total ? <p style={cap}>No evening notes this week</p> : (
                <>
                    <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
                        {entries.map(([label, n]) => <i key={label} style={{ display: 'block', height: '100%', width: `${(n / total) * 100}%`, background: emotionColor(label) }} />)}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', fontFamily: satoshi }}>
                        {entries.map(([label, n]) => <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Dot color={emotionColor(label)} />{label} {Math.round((n / total) * 100)}%</span>)}
                    </div>
                </>
            )}
        </div>
    );
}

// ─── the five sections ────────────────────────────────────────────────────────
export interface ReviewSection {
    id: string;
    n: string;
    title: string;
    meta?: string;
    body: ReactNode;
    /** Sections sharing a row key sit side by side on the dashboard (the swipe view ignores it). */
    row?: string;
}

interface ReviewArgs {
    report: ReportData;
    days: WeeklyReportDay[];
    weekStart?: string;
    weekEnd?: string;
    onPlanNext?: () => void;
    tier: Tier;
}

/**
 * The report's sections, built once from the data. The dashboard lays them
 * out in rows; the swipe view shows one per card. Same tiles, same rules
 * either way.
 */
export function useReviewSections({ report, days, weekStart, weekEnd, onPlanNext, tier }: ReviewArgs): ReviewSection[] {
    const wk = report.week_number ?? 1;
    const pastDays = report.past_days_count ?? days.length;
    const noted = days.filter(d => d.has_journal);
    const daysDone = report.days_done ?? noted.length;
    const r = report as ReportData & { best_days?: string[]; worst_days?: string[]; mood_trend?: string; recurring_friction?: string[]; patterns?: { best_days?: string[]; worst_days?: string[]; mood_trend?: string; recurring_friction?: string[] } };
    const bestDays = r.best_days ?? r.patterns?.best_days ?? report.peak_performance_days ?? [];
    const worstDays = r.worst_days ?? r.patterns?.worst_days ?? [];
    const moodTrend = (r.mood_trend ?? r.patterns?.mood_trend ?? '').trim();
    const friction = r.recurring_friction ?? r.patterns?.recurring_friction ?? [];
    const showTriggers = !!report.trigger_patterns && report.trigger_patterns.length > 0 && wk >= 3;
    const prev = wk >= 2 ? report.prev_week_stats ?? null : null;
    const momentum = report.momentum_score ?? Math.round(((report.consistency_score ?? 0) * 0.4) + (((report.avg_score ?? 0) / 10) * 100 * 0.3) + ((report.consistency_score ?? 0) * 0.3));
    const momentumLabel = report.momentum_label ?? ((report.consistency_score ?? 0) >= 85 ? 'Peak' : (report.consistency_score ?? 0) >= 70 ? 'Strong Week' : 'Building');
    const planNotes = String(report.next_week_plan_context ?? '').split(/\n+/).map(t => t.replace(/^\s*[-•·]\s*/, '').trim()).filter(Boolean);

    // The headline: what happened, in one line, from the data.
    const bestNoted = [...noted].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const bestDayName = bestNoted ? weekday(bestNoted.date, true) : null;
    const headline = report.quiet_week
        ? 'This week went quiet.'
        : `${daysDone} of ${pastDays} days.${bestDayName ? ` ${bestDayName} was the high point.` : ''}`;
    const quoteDay = useMemo(() => {
        const q = (report.best_quote ?? '').trim().toLowerCase();
        return noted.find(d => d.one_liner && q && (q.includes(d.one_liner.toLowerCase().slice(0, 30)) || d.one_liner.toLowerCase().includes(q.slice(0, 30)))) ?? bestNoted;
    }, [report.best_quote, noted, bestNoted]);

    const summary = report.week_summary;
    const mentorRows: { label: string; color: string; text: string }[] = (summary
        ? [
            { label: 'Wins', color: 'var(--color-success)', text: summary.wins },
            { label: 'Dips', color: 'var(--accent-warm)', text: summary.dips },
            { label: 'Pattern', color: '#6366f1', text: summary.pattern },
        ]
        : [
            { label: 'What went well', color: 'var(--color-success)', text: report.what_went_well ?? '' },
            { label: 'Where you slipped', color: 'var(--accent-warm)', text: report.where_you_slipped ?? '' },
            { label: 'Consistency', color: '#6366f1', text: report.consistency_analysis ?? report.emotional_arc ?? '' },
        ]).filter(c => c.text && c.text.trim());

    const wide = tier === 'wide', narrow = tier === 'narrow';
    const cols = (w: string, m: string, n: string) => ({ display: 'grid', gap: '8px', gridTemplateColumns: wide ? w : tier === 'mid' ? m : n } as CSSProperties);
    const sideCap = (color: string): CSSProperties => ({ ...cap, color, textTransform: 'none', letterSpacing: '0.04em', fontWeight: 700, whiteSpace: 'nowrap' });

    const sections: Omit<ReviewSection, 'n'>[] = [];

    sections.push({
        id: 'glance', title: 'At a glance',
        meta: [`Week ${wk}`, fmtRange(weekStart, weekEnd), report.week_theme].filter(Boolean).join(' · '),
        body: (
            <div style={cols('5fr 2.4fr 4.6fr', '1fr 1fr', '1fr')}>
                <div style={{ ...tile, gridColumn: wide ? 'auto' : narrow ? 'auto' : '1 / -1' }}>
                    <h2 style={disp('clamp(19px, 1.9vw, 25px)', 1.08)}>{headline}</h2>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                        {report.week_badge?.name && <Stamp name={report.week_badge.name} reason={report.week_badge.reason} />}
                        {report.dominant_emotion && <span style={chip()}><Dot color={emotionColor(report.dominant_emotion)} />mostly {report.dominant_emotion}</span>}
                        {bestNoted && <span style={chip()}><Dot color={emotionColor(bestNoted.emotion)} />best day {weekday(bestNoted.date)}</span>}
                    </div>
                    {report.week_badge?.reason && <p style={{ ...body, fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Badge: {report.week_badge.reason}</p>}
                </div>
                <div style={{ ...tile, flexDirection: 'row', alignItems: 'center', gap: '14px' }}>
                    <svg viewBox="0 0 120 120" style={{ width: '84px', height: '84px', flexShrink: 0 }} aria-hidden="true">
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border-subtle)" strokeWidth="9" />
                        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--accent-warm)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(Math.max(0, Math.min(100, momentum)) / 100) * 314} 314`} transform="rotate(-90 60 60)" />
                        <text x="60" y="66" textAnchor="middle" fontFamily={clashDisplay} fontWeight="600" fontSize="32" fill="var(--text-primary)">{momentum}</text>
                    </svg>
                    <div style={{ minWidth: 0 }}>
                        <p style={lab}>Momentum</p>
                        <div style={{ ...disp('20px'), marginTop: '2px' }}>{momentumLabel}</div>
                        <p style={cap}>out of 100</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.35, margin: '4px 0 0', fontFamily: satoshi }}>40% consistency · 30% mood · 30% execution</p>
                    </div>
                </div>
                <div style={{ ...tile, padding: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '8px', flex: 1 }}>
                        {[
                            { k: 'Consistency', v: `${report.consistency_score ?? 0}`, u: '%', sub: prev ? <Delta now={report.consistency_score ?? 0} prev={prev.consistency_score} suffix="%" /> : `${daysDone} of ${pastDays} days` },
                            { k: 'Days done', v: `${daysDone}`, u: `/${pastDays}`, sub: prev ? <Delta now={daysDone} prev={prev.days_done} /> : `${report.days_missed ?? 0} missed` },
                            { k: 'Avg mood', v: `${report.avg_score ?? 0}`, u: '/10', sub: prev ? <Delta now={report.avg_score ?? 0} prev={prev.avg_score} /> : `${noted.length} evening note${noted.length === 1 ? '' : 's'}` },
                            prev
                                ? { k: 'Momentum', v: `${momentum}`, u: '', sub: <Delta now={momentum} prev={prev.momentum_score} /> }
                                : { k: 'vs last week', v: '—', u: '', sub: 'from Week 2' },
                        ].map(s => (
                            <div key={s.k} style={{ border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '9px 11px', display: 'flex', flexDirection: 'column', gap: '3px', justifyContent: 'center', background: 'var(--bg-surface)', minWidth: 0 }}>
                                <p style={lab}>{s.k}</p>
                                <div style={num(s.v === '—' ? '16px' : '24px')}>{s.v}<span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.u}</span></div>
                                <p style={cap}>{s.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        ),
    });

    // 02 · How it felt — one tile: the compact line, the emotion mix, the patterns.
    sections.push({
        id: 'felt', title: 'How it felt', meta: 'dot = note · dashed = no note', row: 'middle',
        body: (
            <div style={tileL}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <p style={lab}>Each evening, 1–10</p>
                    {bestDays.length > 0 && <span style={{ ...sideCap('var(--color-success)'), marginLeft: 'auto' }}>best {bestDays.join(' · ')}</span>}
                    {worstDays.length > 0 && <span style={sideCap('var(--accent-warm)')}>hardest {worstDays.join(' · ')}</span>}
                </div>
                <MoodChart days={days} />
                <EmotionMix days={days} />
                {(moodTrend || friction.length > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: narrow || !friction.length || !moodTrend ? '1fr' : '1fr 1fr', gap: '16px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)', alignItems: 'start' }}>
                        {moodTrend && <div><p style={cap}>Mood trend</p><p style={{ ...body, marginTop: '2px' }}>{moodTrend}</p></div>}
                        {friction.length > 0 && <div><p style={cap}>Recurring friction</p><div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '4px' }}>{friction.map((f, i) => <span key={i} style={chip()}>{f}</span>)}</div></div>}
                    </div>
                )}
                {showTriggers && (
                    <div><p style={cap}>Trigger patterns</p>
                        {report.trigger_patterns!.map((t, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11.5px', fontFamily: satoshi, padding: '3px 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none' }}>
                                <span style={{ color: 'var(--text-primary)' }}>{t.pattern}</span><span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{t.frequency}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ),
    });

    // 03 · What your mentor saw — one reading card: your words, then wins /
    // dips / pattern, then the hidden insight.
    if (mentorRows.length > 0 || report.best_quote || report.hidden_insight) {
        sections.push({
            id: 'mentor', title: 'What your mentor saw', row: 'middle',
            body: (
                <div style={{ ...tileL, gap: '10px' }}>
                    {report.best_quote && (
                        <div style={{ paddingLeft: '12px', borderLeft: '3px solid var(--text-primary)' }}>
                            <p style={disp('15px', 1.3)}>“{report.best_quote}”</p>
                            <p style={{ ...cap, marginTop: '4px' }}>In your words{quoteDay ? ` · ${weekday(quoteDay.date, true)}${quoteDay.emotion ? ` · ${quoteDay.emotion}` : ''}${quoteDay.score ? ` ${quoteDay.score}/10` : ''}` : ''}</p>
                        </div>
                    )}
                    {mentorRows.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'auto 1fr', gap: narrow ? '2px 0' : '9px 12px', alignItems: 'start' }}>
                            {mentorRows.map(c => (
                                <div key={c.label} style={{ display: 'contents' }}>
                                    <p style={{ ...lab, color: c.color, paddingTop: narrow ? '6px' : '3px' }}>{c.label}</p>
                                    <p style={body}>{c.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {report.hidden_insight && (
                        <div style={{ marginTop: 'auto', borderRadius: '12px', padding: '10px 12px', background: 'linear-gradient(180deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', border: '1px solid rgba(245,158,11,0.35)' }}>
                            <p style={{ ...lab, color: '#f59e0b' }}>💡 Hidden insight</p>
                            <p style={{ ...body, fontWeight: 600, marginTop: '3px' }}>{report.hidden_insight}</p>
                        </div>
                    )}
                </div>
            ),
        });
    }

    // 04 · Next week — the one change, what the plan will carry, the action.
    if (report.next_week_focus || planNotes.length > 0 || onPlanNext) {
        sections.push({
            id: 'next', title: 'Next week', row: 'middle',
            body: (
                <div style={{ ...tileL, border: '1px solid var(--accent-warm)' }}>
                    <p style={{ ...lab, color: 'var(--accent-warm)' }}>One change</p>
                    <p style={disp('18px', 1.2)}>{report.next_week_focus || 'Keep showing up every day.'}</p>
                    {planNotes.length > 0 && (
                        <>
                            <p style={{ ...lab, marginTop: '6px' }}>The plan will account for</p>
                            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: '12px', lineHeight: 1.5, color: 'var(--text-secondary)', fontFamily: satoshi }}>
                                {planNotes.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                        </>
                    )}
                    {wk < 3 && <p style={{ ...cap, marginTop: 'auto' }}>Week-over-week from Week 2 · Trigger patterns from Week 3</p>}
                    {onPlanNext && (
                        <button onClick={onPlanNext} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '100px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontWeight: 700, fontSize: '11.5px', border: 0, cursor: 'pointer', fontFamily: satoshi, whiteSpace: 'nowrap', alignSelf: 'flex-start', marginTop: wk < 3 ? '2px' : 'auto' }}>
                            Plan Week {wk + 1} →
                        </button>
                    )}
                </div>
            ),
        });
    }

    // 05 · Day by day — seven cards.
    if (days.length > 0) {
        sections.push({
            id: 'days', title: 'Day by day', meta: 'task · your words · coaching',
            body: (
                <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: wide ? `repeat(${days.length}, minmax(0, 1fr))` : tier === 'mid' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))' }}>
                    {days.map(d => {
                        const done = d.has_journal || d.checkin === 'done';
                        const col = emotionColor(d.emotion);
                        const muted = !done;
                        return (
                            <div key={d.date} style={{ ...tile, padding: '10px 12px', gap: '6px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '20px' }}>
                                    <small style={{ fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: 800 }}>{weekday(d.date)}</small>
                                    <b style={{ fontFamily: clashDisplay, fontSize: '15px', letterSpacing: '-0.02em', lineHeight: 1, color: muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{dayNum(d.date)}</b>
                                    <span style={{ ...chip(d.has_journal ? undefined : 'var(--text-muted)'), marginLeft: 'auto' }}>
                                        {d.has_journal ? <><Dot color={col} />{d.emotion ?? 'noted'}{d.score ? ` ${d.score}` : ''}</> : d.checkin === 'done' ? 'done' : d.checkin === 'pending' ? 'ahead' : d.checkin === 'skipped' ? 'skipped' : 'missed'}
                                    </span>
                                </div>
                                <div style={{ height: '5px', borderRadius: '3px', background: 'var(--border-subtle)', flexShrink: 0 }}>
                                    {d.has_journal && d.score ? <i style={{ display: 'block', height: '100%', borderRadius: '3px', width: `${(d.score / 10) * 100}%`, background: col }} /> : null}
                                </div>
                                {d.planned_task && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0, fontFamily: satoshi }}>{d.planned_task}</p>}
                                {d.has_journal && d.one_liner && <p style={{ fontSize: '11.5px', color: 'var(--text-primary)', lineHeight: 1.45, margin: 0, fontFamily: satoshi }}>“{d.one_liner}”</p>}
                                {(d.coaching_insight || d.coaching_micro_action) && (
                                    <p style={{ fontSize: '11px', lineHeight: 1.45, margin: 0, marginTop: 'auto', fontFamily: satoshi, color: d.has_journal ? col : 'var(--text-secondary)' }}>
                                        → {d.coaching_insight}{d.coaching_insight && d.coaching_micro_action ? ' — ' : ''}{d.coaching_micro_action}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            ),
        });
    }

    // Numbered in reading order, whatever is present.
    return sections.map((s, i) => ({ ...s, n: String(i + 1).padStart(2, '0') }));
}

// ─── the dashboard ────────────────────────────────────────────────────────────
interface WeekReviewDashboardProps {
    report: ReportData;
    days: WeeklyReportDay[];
    weekStart?: string;
    weekEnd?: string;
    onPlanNext?: () => void;
    /** Rendered in the 01 header: the View button that swaps to the swipe cards. */
    viewButton?: ReactNode;
}

/** Column widths for a full row of the middle sections; fewer sections share the row evenly. */
const ROW_COLS: Record<string, string[]> = { middle: ['1.25fr', '1.2fr', '0.9fr'] };

export default function WeekReviewDashboard({ report, days, weekStart, weekEnd, onPlanNext, viewButton }: WeekReviewDashboardProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [tier, setTier] = useState<Tier>('wide');
    useEffect(() => {
        const el = ref.current; if (!el) return;
        const apply = (w: number) => setTier(w >= 1000 ? 'wide' : w >= 620 ? 'mid' : 'narrow');
        apply(el.getBoundingClientRect().width);
        const ro = new ResizeObserver(entries => { for (const e of entries) apply(e.contentRect.width); });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const sections = useReviewSections({ report, days, weekStart, weekEnd, onPlanNext, tier });

    // Consecutive sections that share a row key sit side by side.
    const groups: ReviewSection[][] = [];
    for (const s of sections) {
        const last = groups[groups.length - 1];
        if (s.row && last && last[0].row === s.row) last.push(s); else groups.push([s]);
    }

    const Sec = ({ s, first, style }: { s: ReviewSection; first: boolean; style?: CSSProperties }) => (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0, ...style }}>
            <SectionHead n={s.n} title={s.title} meta={s.meta} right={first ? viewButton : undefined} />
            {s.body}
        </section>
    );

    return (
        <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: satoshi, width: '100%' }}>
            {groups.map((g, gi) => {
                if (g.length === 1) return <Sec key={g[0].id} s={g[0]} first={gi === 0} />;
                const widths = ROW_COLS[g[0].row!];
                const template = tier === 'wide'
                    ? (widths && widths.length === g.length ? widths.join(' ') : `repeat(${g.length}, minmax(0, 1fr))`)
                    : tier === 'mid' ? '1fr 1fr' : '1fr';
                return (
                    <div key={g[0].row} style={{ display: 'grid', gridTemplateColumns: template, gap: tier === 'wide' ? '14px' : '10px', alignItems: 'stretch' }}>
                        {g.map((s, j) => (
                            <Sec key={s.id} s={s} first={false} style={tier === 'mid' && g.length % 2 === 1 && j === g.length - 1 ? { gridColumn: '1 / -1' } : undefined} />
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

/** The View button, shared with the swipe story so both read the same. */
export function ViewButton({ label, onClick, icon }: { label: string; onClick: () => void; icon?: ReactNode }) {
    return (
        <button
            data-tour="review-view"
            onClick={onClick}
            aria-label={`View: switch to ${label.toLowerCase()}`}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '100px',
                border: '1px solid var(--border-medium)', background: 'var(--card-bg)', color: 'var(--text-primary)',
                fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: satoshi, whiteSpace: 'nowrap',
            }}
        >
            {icon ?? <MoveHorizontal size={12} />}
            View · {label}
        </button>
    );
}
