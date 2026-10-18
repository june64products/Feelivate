import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Download, LogOut, RefreshCw, Star } from 'lucide-react';
import {
    downloadFeedbackCsv,
    fetchFeedbackInbox,
    FEEDBACK_CHIPS,
    type FeedbackAdminItem,
    type FeedbackAdminResponse,
    type ProductMetrics,
} from '../components/feedback/feedbackApi';

const TOKEN_KEY = 'feelivate-feedback-inbox';

const TRIGGER_LABELS: Record<string, string> = {
    exit_intent: 'Leaving (desktop)',
    tab_return: 'Came back (mobile)',
    first_plan: 'After plan built',
    first_chats: 'After first chats',
    timer: 'Pulse check',
    logout: 'At logout',
    side_tab: 'Side tab',
    after_journal: 'After voice note',
    second_tweak: 'Second tweak',
    weekly_report: 'Weekly report',
    task_email: 'Morning email',
    review_read: 'Under a week review',
};

const KIND_LABELS: Record<string, string> = {
    full: 'Full form',
    plan_fit: 'Plan fit',
    task_day: "Today's task",
    tweaks: 'Tweaks',
    task_email: 'Email 👍/👎',
    review: 'Week review',
};

const ANSWER_LABELS: Record<string, string> = {
    very: 'Very upset', a_bit: 'A bit', not_really: 'Not really',
    too_hard: 'Too hard', about_right: 'About right', too_easy: 'Too easy',
    great: 'Spot on', fine: 'Fine', off: 'A bit off', didnt_fit: "Didn't fit",
    clear: 'Clear', somewhat: 'Somewhat', unclear: 'Unclear',
    shorter: 'Took less', right: 'As planned', longer: 'Took longer',
    wrong_time: 'Wrong time', not_my_goal: 'Not my goal', misunderstood: 'Misunderstood', other: 'Other',
    yes: '👍 Yes', no: '👎 No', partly: 'Partly',
};

const CHIP_LABELS: Record<string, string> = Object.fromEntries(FEEDBACK_CHIPS.map((c) => [c.key, c.label]));
const lbl = (v: unknown) => (typeof v === 'string' ? ANSWER_LABELS[v] ?? CHIP_LABELS[v] ?? v : String(v ?? ''));

// <body> never scrolls on this site; each page scrolls inside its own
// full-height wrapper (see PageShell), so this one must too.
const page: CSSProperties = {
    height: '100vh', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch',
    background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', padding: '32px 20px 60px',
};
const card: CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' };
const button: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 14px', borderRadius: '10px',
    border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)',
    fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
const select: CSSProperties = {
    padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-medium)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)',
};
const pill = (tone: 'good' | 'bad' | 'neutral'): CSSProperties => ({
    display: 'inline-block', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 500, marginRight: '4px', marginBottom: '4px',
    border: '1px solid var(--border-subtle)',
    background: tone === 'good' ? 'var(--accent-glow)' : tone === 'bad' ? 'rgba(217, 119, 87, 0.12)' : 'var(--bg-secondary)',
    color: tone === 'bad' ? 'var(--accent-warm)' : 'var(--text-primary)',
});

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div style={card}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{label}</div>
            <div style={{ fontSize: '28px', fontWeight: 600, marginTop: '6px', fontFamily: 'var(--font-display)' }}>{value}</div>
            {hint && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
        </div>
    );
}

function CountList({ title, counts, labels, order, tone }: { title: string; counts: Record<string, number>; labels: Record<string, string>; order?: string[]; tone?: Record<string, string> }) {
    const entries = order ? order.map((k): [string, number] => [k, counts[k] ?? 0]) : Object.entries(counts);
    const max = Math.max(1, ...entries.map(([, n]) => n));
    return (
        <div style={card}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>{title}</div>
            {entries.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nothing yet</div>}
            {entries.map(([key, n]) => (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 32px', alignItems: 'center', gap: '10px', marginBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labels[key] ?? key}</span>
                    <span style={{ height: '8px', borderRadius: '999px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${(n / max) * 100}%`, background: tone?.[key] ?? 'var(--accent-primary)', borderRadius: '999px' }} />
                    </span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </div>
            ))}
        </div>
    );
}

const pct = (v?: number | null) => (v === null || v === undefined ? '—' : `${v}%`);

function Metrics({ m }: { m: ProductMetrics }) {
    if (m.error || !m.signups) {
        return <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 22px' }}>No sign-ups in the last {m.cohort_days ?? 30} days yet — the numbers appear with the first real users.</p>;
    }
    return (
        <section style={{ marginBottom: '22px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                What people actually did · accounts from the last {m.cohort_days} days ({m.signups} sign-ups)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <Stat label="Built a plan" value={pct(m.built_plan_pct)} hint={`${m.built_plan} of ${m.signups}`} />
                <Stat label="Locked a plan" value={pct(m.locked_plan_pct)} hint={`${m.locked_plan} of ${m.signups}`} />
                <Stat label="Back on day 3" value={pct(m.day3_pct)} hint={`${m.back_on_day3} of ${m.day3_eligible} old enough`} />
                <Stat label="Active in week 2" value={pct(m.week2_pct)} hint={`${m.active_week2} of ${m.week2_eligible} old enough`} />
                <Stat label="Tasks done" value={pct(m.completion_pct)} hint={`${m.days_done} of ${m.plan_days_elapsed} plan days so far`} />
            </div>
        </section>
    );
}

function Answers({ it }: { it: FeedbackAdminItem }) {
    const a = it.answers || {};
    const row = (k: string, v: unknown, tone: 'good' | 'bad' | 'neutral' = 'neutral') => (
        <div key={k} style={{ marginBottom: '3px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{k} </span>
            <span style={pill(tone)}>{lbl(v)}</span>
        </div>
    );
    const toneFor = (v: unknown) => (['very', 'about_right', 'great', 'clear', 'yes', 'right'].includes(String(v)) ? 'good' : ['not_really', 'too_hard', 'didnt_fit', 'unclear', 'no', 'misunderstood'].includes(String(v)) ? 'bad' : 'neutral');
    const out: React.ReactNode[] = [];
    if (it.kind === 'full') {
        if (a.upset) out.push(row('if gone', a.upset, toneFor(a.upset)));
        if (a.legacy_rating) out.push(<div key="legacy" style={{ marginBottom: '3px' }}><Stars n={Number(a.legacy_rating)} /></div>);
        if (a.liked_most) out.push(row('liked most', a.liked_most, 'good'));
        const conf = (a.confusing as string[]) || it.confusing || [];
        if (conf.length) out.push(<div key="conf" style={{ marginBottom: '3px' }}><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>confusing </span>{conf.map((c) => <span key={c} style={pill('bad')}>{lbl(c)}</span>)}</div>);
        if (it.liked?.length) out.push(<div key="liked" style={{ marginBottom: '3px' }}><span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>worked </span>{it.liked.map((c) => <span key={c} style={pill('good')}>{lbl(c)}</span>)}</div>);
    } else if (it.kind === 'plan_fit') {
        if (a.fit) out.push(row('plan', a.fit, toneFor(a.fit)));
    } else if (it.kind === 'task_day') {
        if (a.quality) out.push(row('task', a.quality, toneFor(a.quality)));
        if (a.clarity) out.push(row('clarity', a.clarity, toneFor(a.clarity)));
        if (a.time) out.push(row('time', a.time, toneFor(a.time)));
    } else if (it.kind === 'tweaks') {
        if (a.reason) out.push(row(`after ${a.tweak_count ?? 2} tweaks`, a.reason, toneFor(a.reason)));
    } else if (it.kind === 'task_email') {
        if (a.clear) out.push(row('task clear?', a.clear, toneFor(a.clear)));
    } else if (it.kind === 'review') {
        if (a.accurate) out.push(row(`week ${a.week_number ?? '?'} review true?`, a.accurate, toneFor(a.accurate)));
    }
    return <>{out.length ? out : <span style={{ color: 'var(--text-muted)' }}>—</span>}</>;
}

function Notes({ it }: { it: FeedbackAdminItem }) {
    const a = it.answers || {};
    const lines: { k: string; v: string; hot?: boolean }[] = [];
    if (typeof a.upset_reason === 'string') lines.push({ k: 'why', v: a.upset_reason, hot: true });
    if (typeof a.quit_reason === 'string') lines.push({ k: 'almost quit', v: a.quit_reason, hot: true });
    if (typeof a.broke === 'string') lines.push({ k: 'BROKE', v: a.broke, hot: true });
    if (a.confusing_notes && typeof a.confusing_notes === 'object') {
        for (const [chip, note] of Object.entries(a.confusing_notes as Record<string, string>)) lines.push({ k: `${lbl(chip)}:`, v: note });
    }
    if (typeof a.note === 'string') lines.push({ k: 'note', v: a.note });
    if (it.comment) lines.push({ k: 'comment', v: it.comment });
    if (!lines.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
        <div style={{ display: 'grid', gap: '4px' }}>
            {lines.map((l, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: l.hot ? 'var(--accent-warm)' : 'var(--text-muted)' }}>{l.k} </span>{l.v}
                </div>
            ))}
        </div>
    );
}

function Stars({ n }: { n: number }) {
    return (
        <span aria-label={`${n} of 5`} style={{ display: 'inline-flex', gap: '2px', color: 'var(--accent-warm)' }}>
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={12} fill={i <= n ? 'currentColor' : 'none'} strokeWidth={1.6} style={{ opacity: i <= n ? 1 : 0.35 }} />)}
        </span>
    );
}

const fmt = (iso: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

export default function FeedbackAdminPage() {
    const [token, setToken] = useState<string>(() => sessionStorage.getItem(TOKEN_KEY) ?? '');
    const [draft, setDraft] = useState('');
    const [data, setData] = useState<FeedbackAdminResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [trigger, setTrigger] = useState('');
    const [kind, setKind] = useState('');

    const load = useCallback(async (t: string) => {
        if (!t) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetchFeedbackInbox(t, { trigger: trigger || undefined, kind: kind || undefined, limit: 500 });
            setData(res);
            sessionStorage.setItem(TOKEN_KEY, t);
            setToken(t);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not load the inbox.');
            if (e instanceof Error && e.message === 'Wrong passphrase.') { sessionStorage.removeItem(TOKEN_KEY); setToken(''); setData(null); }
        } finally {
            setLoading(false);
        }
    }, [trigger, kind]);

    useEffect(() => {
        document.title = 'Feedback inbox';
        if (token) void load(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger, kind]);

    const unlock = (e: FormEvent) => { e.preventDefault(); void load(draft.trim()); };
    const signOut = () => { sessionStorage.removeItem(TOKEN_KEY); setToken(''); setData(null); setDraft(''); };

    if (!token || !data) {
        return (
            <div style={{ ...page, display: 'grid', placeItems: 'center' }}>
                <form onSubmit={unlock} style={{ ...card, width: '100%', maxWidth: '380px', padding: '28px' }}>
                    <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontFamily: 'var(--font-display)' }}>Feedback inbox</h1>
                    <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary)' }}>Enter the passphrase to open it.</p>
                    <input type="password" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Passphrase" style={{ ...select, width: '100%', boxSizing: 'border-box', marginBottom: '12px', fontSize: '14px' }} />
                    {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}
                    <button type="submit" disabled={loading || !draft.trim()} style={{ ...button, width: '100%', justifyContent: 'center', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', fontWeight: 600 }}>
                        {loading ? 'Opening…' : 'Open inbox'}
                    </button>
                </form>
            </div>
        );
    }

    const { stats, items, total, metrics } = data;
    const good = 'var(--color-success)', bad = 'var(--accent-warm)';

    return (
        <div style={page}>
            <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
                <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '22px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'var(--font-display)' }}>Feedback inbox</h1>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>{total} answer{total === 1 ? '' : 's'} · newest first</p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <select value={kind} onChange={(e) => setKind(e.target.value)} style={select} aria-label="Filter by form">
                            <option value="">All forms</option>
                            {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select value={trigger} onChange={(e) => setTrigger(e.target.value)} style={select} aria-label="Filter by moment">
                            <option value="">All moments</option>
                            {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <button type="button" style={button} onClick={() => void load(token)} disabled={loading}><RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}</button>
                        <button type="button" style={button} onClick={() => downloadFeedbackCsv(token).catch((e) => setError(e.message))}><Download size={14} /> CSV</button>
                        <button type="button" style={button} onClick={signOut} aria-label="Lock the inbox"><LogOut size={14} /></button>
                    </div>
                </header>

                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}

                <Metrics m={metrics} />

                <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>What people said</p>
                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <Stat label="Answers" value={stats.total} hint={`${stats.last_7_days} in the last 7 days`} />
                    <Stat label="People" value={stats.unique_users} hint={`${stats.anonymous} anonymous`} />
                    <Stat label="Almost quit" value={stats.quit_notes} hint="wrote a reason" />
                    <Stat label="Something broke" value={stats.broke_reports} hint="bug reports" />
                    <Stat label="Want a reply" value={stats.want_contact} hint="ticked the email box" />
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '22px' }}>
                    <CountList title="If Feelivate went away tomorrow" counts={stats.upset} order={['very', 'a_bit', 'not_really']} labels={ANSWER_LABELS} tone={{ very: good, not_really: bad }} />
                    <CountList title="Liked most" counts={stats.liked_most} labels={CHIP_LABELS} />
                    <CountList title="Confusing" counts={stats.confusing} labels={CHIP_LABELS} tone={Object.fromEntries(Object.keys(stats.confusing).map((k) => [k, bad]))} />
                    <CountList title="Plan fit (after building)" counts={stats.plan_fit} order={['too_hard', 'about_right', 'too_easy']} labels={ANSWER_LABELS} tone={{ about_right: good, too_hard: bad }} />
                    <CountList title="Today's task (after voice note)" counts={stats.task_quality} order={['great', 'fine', 'off', 'didnt_fit']} labels={ANSWER_LABELS} tone={{ great: good, didnt_fit: bad, off: bad }} />
                    <CountList title="Task clear? (email 👍/👎)" counts={stats.task_clear} order={['yes', 'no']} labels={ANSWER_LABELS} tone={{ yes: good, no: bad }} />
                    <CountList title="Why tweaks keep happening" counts={stats.tweak_reasons} labels={ANSWER_LABELS} />
                    <CountList title="Did the week review read true?" counts={stats.review_accuracy ?? {}} order={['yes', 'partly', 'no']} labels={ANSWER_LABELS} tone={{ yes: good, no: bad }} />
                    <CountList title="Which moment asked" counts={stats.triggers} labels={TRIGGER_LABELS} />
                </section>

                {stats.legacy_count > 0 && (
                    <p style={{ margin: '0 0 14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {stats.legacy_count} older star-rating answer{stats.legacy_count === 1 ? '' : 's'} (average {stats.legacy_average_rating}/5) from before the form changed.
                    </p>
                )}

                <section style={{ ...card, padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '1100px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                {['When', 'Who', 'Nth', 'Form · moment', 'Answers', 'In their words', 'Where they were', 'Reply?'].map((h) => (
                                    <th key={h} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr><td colSpan={8} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>No feedback matches these filters.</td></tr>
                            )}
                            {items.map((it) => (
                                <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmt(it.created_at)}</td>
                                    <td style={{ padding: '12px 14px' }}>
                                        {it.user_email ? (
                                            <>
                                                <div>{it.user_name || '—'}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{it.user_email}</div>
                                                {it.account_age_days !== null && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>account {it.account_age_days}d old</div>}
                                            </>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>Visitor{it.email ? ` · ${it.email}` : ''}</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums' }}>{it.sequence_no ?? '—'}</td>
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        <div style={{ fontWeight: 600 }}>{KIND_LABELS[it.kind] ?? it.kind}</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{TRIGGER_LABELS[it.trigger] ?? it.trigger}</div>
                                    </td>
                                    <td style={{ padding: '12px 14px', minWidth: '180px' }}><Answers it={it} /></td>
                                    <td style={{ padding: '12px 14px', maxWidth: '360px' }}><Notes it={it} /></td>
                                    <td style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--text-secondary)', minWidth: '170px' }}>
                                        {it.goal && <div style={{ color: 'var(--text-primary)', marginBottom: '2px' }}>{it.goal}</div>}
                                        <div>
                                            {it.week_number !== null && it.week_number !== undefined ? `Week ${it.week_number}` : ''}
                                            {it.plan_day ? ` · ${it.plan_day}` : ''}
                                        </div>
                                        <div>
                                            {it.current_streak !== null && it.current_streak !== undefined ? `streak ${it.current_streak}` : ''}
                                            {it.days_active !== null && it.days_active !== undefined ? ` · ${it.days_active} active day${it.days_active === 1 ? '' : 's'}` : ''}
                                        </div>
                                        <div style={{ color: 'var(--text-muted)' }}>{it.page ?? ''}{it.device && it.device !== 'email' ? ` · ${/Mobile|Android|iPhone/i.test(it.device) ? 'mobile' : 'desktop'}` : ''}</div>
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>{it.contact_ok ? <span style={pill('good')}>yes</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </div>
    );
}
