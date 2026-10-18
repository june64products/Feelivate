import { useMemo, useState, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Lightbulb, Target, TrendingUp } from 'lucide-react';
import type { WeeklyReport, WeeklyReportDay } from '../../api';
import { clashDisplay, satoshi, FLAME_FROM, FLAME_TO } from '../mission/missionTheme';
import { submitFeedback } from '../feedback/feedbackApi';

/**
 * The week review, written like a letter from someone who watched the week —
 * not a dashboard. One screen: a headline, the week as a ribbon of days, what
 * the mentor saw (in prose), one thing worth noticing, next week's single
 * change, then the numbers in a quiet strip, then the days themselves.
 *
 * Reads both the current review shape (headline / saw / one_thing) and the
 * older one (week_summary / hidden_insight), so the archive never breaks.
 */

export type ReportData = NonNullable<WeeklyReport['report']>;

export interface Review {
    headline: string;
    saw: string[];
    oneThing: string;
    nextFocus: string;
    planNotes: string[];
    quote: string | null;
    vsLastWeek: string | null;
    badge: { name: string; reason: string } | null;
    sparse: boolean;
    quiet: boolean;
    weekNumber: number;
    theme: string;
    daysDone: number;
    pastDays: number;
    entries: number;
    avgScore: number;
    dominant: string;
    moodTrend: string;
    momentum: number | null;
    momentumLabel: string;
    days: WeeklyReportDay[];
}

const firstSentence = (t: string) => {
    const m = t.match(/^(.{20,140}?[.!?])(\s|$)/);
    return (m ? m[1] : t).trim();
};

const tidyLine = (t: string) => t.replace(/^\s*(day\s*\d+\s*[:\-–—]\s*|[-•·]\s*)/i, '').trim();

export function normalizeReview(r: ReportData): Review {
    const entries = r.entry_count ?? (r.days ?? []).filter(d => d.has_journal).length;
    const daysDone = r.days_done ?? 0;
    const pastDays = r.past_days_count ?? (r.days ?? []).length ?? 7;
    const quiet = !!r.quiet_week || (entries === 0 && daysDone === 0);
    const v3 = typeof r.headline === 'string' && Array.isArray(r.saw);

    const wins = r.week_summary?.wins?.trim() ?? '';
    const dips = r.week_summary?.dips?.trim() ?? '';
    const pattern = r.week_summary?.pattern?.trim() ?? '';
    const legacySaw = v3 ? [] : [wins, dips, r.what_went_well, r.where_you_slipped, r.emotional_arc]
        .map(t => (t ?? '').trim()).filter((t, i, arr) => t && arr.indexOf(t) === i);

    const headline = (r.headline ?? '').trim()
        || (wins ? firstSentence(wins) : quiet ? 'This week went quiet.' : `${entries} of ${pastDays} days with a note.`);
    const saw = (v3 ? (r.saw ?? []) : legacySaw).map(tidyLine).filter(Boolean).slice(0, 6);
    const oneThing = (r.one_thing ?? r.hidden_insight ?? pattern ?? '').trim();
    const nextFocus = (r.next_week_focus ?? '').trim();
    const planNotes = String(r.next_week_plan_context ?? '')
        .split(/\n+/).map(tidyLine).filter(Boolean).slice(0, 4);

    let quote: string | null = null;
    if (typeof r.quote === 'string' && r.quote.trim()) quote = r.quote.trim();
    else if (!v3 && r.best_quote && r.best_quote.trim().length >= 12 && r.best_quote.trim().length <= 140) quote = r.best_quote.trim();

    const badgeSrc = r.badge ?? r.week_badge ?? null;
    const badge = badgeSrc && badgeSrc.name ? { name: badgeSrc.name, reason: badgeSrc.reason ?? '' } : null;

    return {
        headline, saw, oneThing, nextFocus, planNotes, quote,
        vsLastWeek: typeof r.vs_last_week === 'string' && r.vs_last_week.trim() ? r.vs_last_week.trim() : null,
        badge,
        sparse: r.sparse ?? entries <= 2,
        quiet,
        weekNumber: r.week_number ?? 1,
        theme: r.week_theme ?? '',
        daysDone, pastDays, entries,
        avgScore: r.avg_score ?? 0,
        dominant: r.dominant_emotion ?? '',
        moodTrend: (r.mood_trend ?? '').trim(),
        momentum: typeof r.momentum_score === 'number' ? r.momentum_score : null,
        momentumLabel: r.momentum_label ?? '',
        days: r.days ?? [],
    };
}

// ─── Small shared bits ───────────────────────────────────────────────────────

const weekdayOf = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short' });
};
const dayNum = (iso: string) => Number(iso.split('-')[2]);
const fmtRange = (a?: string, b?: string) => {
    if (!a || !b) return '';
    const f = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };
    return `${f(a)} – ${f(b)}`;
};

const eyebrow: CSSProperties = {
    fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--text-secondary)', fontFamily: satoshi, margin: 0,
};

function Eyebrow({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
    return (
        <p style={{ ...eyebrow, display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
            {icon}{children}
        </p>
    );
}

/** The week as a ribbon: one column per day, bar height = how the evening felt. */
export function WeekRibbon({ days, compact = false }: { days: WeeklyReportDay[]; compact?: boolean }) {
    const n = Math.max(days.length, 1);
    const W = n * 60, H = 100, base = 92, top = 12;
    const h = (score: number | null) => (score ? Math.max(10, ((Math.min(10, Math.max(1, score)) / 10) * (base - top))) : 0);
    const pts = days
        .map((d, i) => ({ d, i }))
        .filter(({ d }) => d.has_journal && d.score)
        .map(({ d, i }) => `${i * 60 + 30},${base - h(d.score)}`);
    const gid = useMemo(() => `flame-${Math.random().toString(36).slice(2, 8)}`, []);
    const barH = compact ? 64 : 84;

    return (
        <div style={{ width: '100%' }}>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: `${barH}px`, display: 'block' }} aria-hidden="true">
                <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={FLAME_FROM} />
                        <stop offset="100%" stopColor={FLAME_TO} />
                    </linearGradient>
                </defs>
                {/* baseline */}
                <line x1="0" y1={base + 0.5} x2={W} y2={base + 0.5} stroke="var(--border-medium)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                {days.map((d, i) => {
                    const x = i * 60 + 18, w = 24;
                    if (d.has_journal && d.score) {
                        const hh = h(d.score);
                        return <rect key={d.date} x={x} y={base - hh} width={w} height={hh} rx="4" fill={`url(#${gid})`} />;
                    }
                    if (d.checkin === 'pending') {
                        return <rect key={d.date} x={x} y={base - 5} width={w} height={5} rx="2" fill="var(--border-subtle)" />;
                    }
                    // a past day without a note: an outline, so the gap is visible but not loud
                    return <rect key={d.date} x={x + 0.5} y={base - 22} width={w - 1} height={22} rx="4" fill="none" stroke="var(--border-medium)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />;
                })}
                {pts.length >= 2 && (
                    <polyline points={pts.join(' ')} fill="none" stroke="var(--accent-warm)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.9" />
                )}
            </svg>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, marginTop: '6px' }}>
                {days.map(d => {
                    const done = d.checkin === 'done' || d.has_journal;
                    return (
                        <div key={d.date} title={d.one_liner ?? (d.planned_task || undefined)} style={{ textAlign: 'center', minWidth: 0 }}>
                            <div style={{ fontSize: compact ? '10px' : '11px', fontWeight: 700, color: done ? 'var(--text-primary)' : 'var(--text-muted)', fontFamily: satoshi, letterSpacing: '0.02em' }}>
                                {weekdayOf(d.date).slice(0, compact ? 1 : 3)}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: satoshi, lineHeight: 1.2 }}>
                                {d.has_journal && d.score ? <span style={{ color: 'var(--accent-warm)', fontWeight: 700 }}>{d.score}</span>
                                    : done ? <Check size={10} style={{ color: 'var(--color-success)' }} />
                                    : d.checkin === 'pending' ? '·' : '—'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function Stamp({ name }: { name: string }) {
    return (
        <span style={{
            display: 'inline-block', transform: 'rotate(-4deg)', padding: '5px 10px', borderRadius: '8px',
            border: '1.5px dashed var(--accent-warm)', color: 'var(--accent-warm)',
            fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase',
            fontFamily: satoshi, whiteSpace: 'nowrap', opacity: 0.95,
        }}>
            {name}
        </span>
    );
}

function Numbers({ r }: { r: Review }) {
    const tiles: { k: string; v: string; sub?: string }[] = [
        { k: 'Evenings with a note', v: `${r.entries}`, sub: `of ${r.pastDays} days` },
        { k: 'Days checked off', v: `${r.daysDone}`, sub: `of ${r.pastDays}` },
    ];
    if (r.entries >= 1) tiles.push({ k: 'How it felt', v: `${r.avgScore}`, sub: r.dominant ? `mostly ${r.dominant}` : 'out of 10' });
    if (r.entries >= 3 && r.momentum !== null) tiles.push({ k: 'Momentum', v: `${r.momentum}`, sub: r.momentumLabel || 'out of 100' });
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '8px' }}>
            {tiles.map(t => (
                <div key={t.k} style={{ padding: '10px 12px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.03em', color: 'var(--text-primary)', fontFamily: clashDisplay, lineHeight: 1 }}>{t.v}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontFamily: satoshi, marginTop: '5px', fontWeight: 600 }}>{t.k}</div>
                    {t.sub && <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: satoshi }}>{t.sub}</div>}
                </div>
            ))}
        </div>
    );
}

function DayLedger({ days, defaultOpen }: { days: WeeklyReportDay[]; defaultOpen: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    const [expanded, setExpanded] = useState<string | null>(null);
    if (!days.length) return null;
    return (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-primary)' }}>
                <span style={{ ...eyebrow, color: 'var(--text-secondary)' }}>The days, one by one</span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} style={{ display: 'inline-flex' }}><ChevronDown size={15} color="var(--text-muted)" /></motion.span>
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
                            {days.map(d => {
                                const done = d.checkin === 'done' || d.has_journal;
                                const isOpen = expanded === d.date;
                                return (
                                    <button key={d.date} onClick={() => setExpanded(isOpen ? null : d.date)} style={{
                                        display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: '10px', alignItems: 'start', textAlign: 'left',
                                        padding: '10px 12px', borderRadius: '12px', border: '1px solid var(--border-subtle)',
                                        background: d.has_journal ? 'var(--bg-surface)' : 'transparent', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: satoshi,
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{weekdayOf(d.date)}</div>
                                            <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: clashDisplay, lineHeight: 1.1, color: done ? 'var(--text-primary)' : 'var(--text-muted)' }}>{dayNum(d.date)}</div>
                                        </div>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45, ...(isOpen ? {} : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }) }}>
                                                {d.planned_task || 'No task planned.'}
                                            </div>
                                            {d.has_journal && d.one_liner && (
                                                <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', marginTop: '5px', lineHeight: 1.5, ...(isOpen ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
                                                    “{d.one_liner}”
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {d.has_journal && d.score ? (
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-warm)' }}>{d.emotion ?? ''} {d.score}/10</span>
                                            ) : done ? (
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Check size={11} /> done</span>
                                            ) : d.checkin === 'pending' ? (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ahead</span>
                                            ) : (
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>no note</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function ReadTrue({ sessionId, weekNumber, demoMode }: { sessionId?: string; weekNumber: number; demoMode: boolean }) {
    const key = `review-fb:${sessionId ?? 'none'}:${weekNumber}`;
    const [answer, setAnswer] = useState<string | null>(() => { try { return localStorage.getItem(key); } catch { return null; } });
    const [note, setNote] = useState('');
    const [noteSent, setNoteSent] = useState(false);
    const [busy, setBusy] = useState(false);
    if (demoMode) return null;

    const send = async (accurate: 'yes' | 'partly' | 'no', text?: string) => {
        if (busy) return;
        setBusy(true);
        try {
            await submitFeedback({ kind: 'review', answers: { accurate, week_number: weekNumber, ...(text ? { note: text } : {}) }, trigger: 'review_read', page: '/journey', session_id: sessionId ?? null });
            try { localStorage.setItem(key, accurate); } catch { /* private mode */ }
            setAnswer(accurate);
            if (text) setNoteSent(true);
        } catch { /* a thumbs that fails to send is not worth an error */ }
        finally { setBusy(false); }
    };

    const pill = (active: boolean): CSSProperties => ({
        padding: '7px 13px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: satoshi,
        border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
        background: active ? 'var(--accent-primary)' : 'transparent', color: active ? 'var(--btn-primary-text)' : 'var(--text-primary)',
    });

    return (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontFamily: satoshi, marginRight: '4px' }}>Did this read true?</span>
                {(['yes', 'partly', 'no'] as const).map(v => (
                    <button key={v} type="button" onClick={() => send(v)} disabled={busy} style={pill(answer === v)}>
                        {v === 'yes' ? 'Yes' : v === 'partly' ? 'Partly' : 'No'}
                    </button>
                ))}
                {answer === 'yes' && <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: satoshi }}>Thanks — noted.</span>}
            </div>
            {(answer === 'partly' || answer === 'no') && !noteSent && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <input value={note} onChange={e => setNote(e.target.value)} placeholder="What did it get wrong?" maxLength={300}
                        style={{ flex: '1 1 220px', padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-medium)', background: 'var(--bg-input, var(--bg-surface))', color: 'var(--text-primary)', fontSize: '13px', fontFamily: satoshi }} />
                    <button type="button" onClick={() => note.trim() && send(answer as 'partly' | 'no', note.trim())} disabled={busy || !note.trim()} style={{ ...pill(true), opacity: note.trim() ? 1 : 0.5 }}>Send</button>
                </div>
            )}
            {noteSent && <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--text-muted)', fontFamily: satoshi }}>Thanks — a person reads these.</p>}
        </div>
    );
}

// ─── The review ──────────────────────────────────────────────────────────────

interface WeekReviewProps {
    report: ReportData;
    weekStart?: string;
    weekEnd?: string;
    sessionId?: string;
    /** Archive rows: tighter type, days collapsed. */
    compact?: boolean;
    /** When given, a "Plan Week N+1" action closes the review. */
    onPlanNext?: () => void;
    demoMode?: boolean;
}

export default function WeekReview({ report, weekStart, weekEnd, sessionId, compact = false, onPlanNext, demoMode = false }: WeekReviewProps) {
    const r = useMemo(() => normalizeReview(report), [report]);
    const range = fmtRange(weekStart, weekEnd);

    return (
        <article style={{
            borderRadius: '22px', border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
            boxShadow: compact ? 'none' : 'var(--shadow-sm)', padding: compact ? '18px 18px 16px' : 'clamp(18px, 3.5vw, 28px)',
            display: 'flex', flexDirection: 'column', gap: compact ? '16px' : '20px', fontFamily: satoshi,
        }}>
            {/* dateline */}
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ minWidth: 0 }}>
                    <p style={eyebrow}>Week {r.weekNumber}{range ? ` · ${range}` : ''}{r.theme ? ` · ${r.theme}` : ''}</p>
                    <h2 style={{
                        margin: '8px 0 0', fontFamily: clashDisplay, fontWeight: 700, letterSpacing: '-0.03em',
                        fontSize: compact ? 'clamp(19px, 2.6vw, 23px)' : 'clamp(22px, 3.6vw, 30px)', lineHeight: 1.12, color: 'var(--text-primary)',
                    }}>
                        {r.headline}
                    </h2>
                </div>
                {r.badge && <Stamp name={r.badge.name} />}
            </header>

            <WeekRibbon days={r.days} compact={compact} />

            {r.sparse && !r.quiet && (
                <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Only {r.entries} evening note{r.entries === 1 ? '' : 's'} this week, so this one is short — it can only speak to the days it heard from.
                </p>
            )}

            {r.saw.length > 0 && (
                <section>
                    <Eyebrow>What I saw</Eyebrow>
                    <div style={{ display: 'grid', gap: '9px' }}>
                        {r.saw.map((line, i) => (
                            <div key={i} style={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: '10px', alignItems: 'start' }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', marginTop: '8px', background: i === r.saw.length - 1 && r.saw.length > 1 ? 'var(--text-muted)' : 'var(--accent-warm)' }} />
                                <p style={{ margin: 0, fontSize: compact ? '13.5px' : '14.5px', lineHeight: 1.6, color: 'var(--text-primary)' }}>{line}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {r.quote && (
                <blockquote style={{ margin: 0, padding: '2px 0 2px 16px', borderLeft: '3px solid var(--accent-warm)' }}>
                    <p style={{ margin: 0, fontFamily: clashDisplay, fontSize: compact ? '16px' : '18px', lineHeight: 1.35, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>“{r.quote}”</p>
                    <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>in your words</p>
                </blockquote>
            )}

            {r.oneThing && (
                <section style={{ padding: '14px 16px', borderRadius: '16px', background: 'var(--accent-glow)', border: '1px solid var(--border-subtle)' }}>
                    <Eyebrow icon={<Lightbulb size={13} style={{ color: 'var(--accent-warm)' }} />}>The one thing</Eyebrow>
                    <p style={{ margin: 0, fontSize: compact ? '14px' : '15px', lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 500 }}>{r.oneThing}</p>
                </section>
            )}

            {r.vsLastWeek && (
                <p style={{ margin: 0, display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                    <TrendingUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />{r.vsLastWeek}
                </p>
            )}

            {(r.nextFocus || r.planNotes.length > 0 || onPlanNext) && (
                <section style={{ padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--border-medium)' }}>
                    <Eyebrow icon={<Target size={13} style={{ color: 'var(--text-primary)' }} />}>Next week, one change</Eyebrow>
                    {r.nextFocus && <p style={{ margin: 0, fontSize: compact ? '14px' : '15px', fontWeight: 700, lineHeight: 1.5, color: 'var(--text-primary)' }}>{r.nextFocus}</p>}
                    {r.planNotes.length > 0 && (
                        <ul style={{ margin: '8px 0 0', padding: '0 0 0 16px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                            {r.planNotes.map((n, i) => <li key={i}>{n}</li>)}
                        </ul>
                    )}
                    {onPlanNext && (
                        <button onClick={onPlanNext} style={{
                            marginTop: '12px', padding: '11px 18px', borderRadius: '100px', border: 'none', cursor: 'pointer',
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '12.5px', fontWeight: 700, fontFamily: satoshi,
                        }}>
                            Plan Week {r.weekNumber + 1} from this →
                        </button>
                    )}
                </section>
            )}

            <Numbers r={r} />

            <DayLedger days={r.days} defaultOpen={false} />

            <ReadTrue sessionId={sessionId} weekNumber={r.weekNumber} demoMode={demoMode} />
        </article>
    );
}

/** The Sunday-night card: headline, the ribbon, the one thing. Enough to want the rest. */
export function WeekReviewTeaser({ report }: { report: ReportData }) {
    const r = useMemo(() => normalizeReview(report), [report]);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontFamily: satoshi }}>
            <h2 style={{ margin: 0, fontFamily: clashDisplay, fontWeight: 700, letterSpacing: '-0.03em', fontSize: 'clamp(21px, 5vw, 26px)', lineHeight: 1.15, color: 'var(--text-primary)' }}>
                {r.headline}
            </h2>
            <WeekRibbon days={r.days} compact />
            {r.oneThing && (
                <div style={{ padding: '12px 14px', borderRadius: '14px', background: 'var(--accent-glow)', border: '1px solid var(--border-subtle)' }}>
                    <Eyebrow icon={<Lightbulb size={12} style={{ color: 'var(--accent-warm)' }} />}>The one thing</Eyebrow>
                    <p style={{ margin: 0, fontSize: '13.5px', lineHeight: 1.55, color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.oneThing}</p>
                </div>
            )}
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
                {r.entries} evening note{r.entries === 1 ? '' : 's'} · {r.daysDone} of {r.pastDays} days checked off{r.badge ? ` · ${r.badge.name}` : ''}
            </p>
        </div>
    );
}
