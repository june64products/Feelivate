import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { Download, LogOut, RefreshCw, Star } from 'lucide-react';
import {
    downloadFeedbackCsv,
    fetchFeedbackInbox,
    FEEDBACK_CHIPS,
    type FeedbackAdminItem,
    type FeedbackAdminResponse,
} from '../components/feedback/feedbackApi';

const TOKEN_KEY = 'feelivate-feedback-inbox';

const TRIGGER_LABELS: Record<string, string> = {
    exit_intent: 'Leaving (desktop)',
    tab_return: 'Came back (mobile)',
    first_plan: 'After first plan',
    first_chats: 'After first chats',
    timer: 'Pulse check',
    logout: 'At logout',
    side_tab: 'Side tab',
};

const CHIP_LABELS: Record<string, string> = Object.fromEntries(FEEDBACK_CHIPS.map((c) => [c.key, c.label]));

// <body> never scrolls on this site; each page scrolls inside its own
// full-height wrapper (see PageShell), so this one must too.
const page: CSSProperties = {
    height: '100vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    WebkitOverflowScrolling: 'touch',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    padding: '32px 20px 60px',
};

const card: CSSProperties = {
    background: 'var(--card-bg)',
    border: '1px solid var(--card-border)',
    borderRadius: '16px',
    padding: '18px 20px',
    boxShadow: 'var(--shadow-sm)',
};

const button: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '9px 14px',
    borderRadius: '10px',
    border: '1px solid var(--btn-secondary-border)',
    background: 'var(--btn-secondary-bg)',
    color: 'var(--btn-secondary-text)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
};

const select: CSSProperties = {
    padding: '9px 12px',
    borderRadius: '10px',
    border: '1px solid var(--border-medium)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontFamily: 'var(--font-sans)',
};

const pill = (tone: 'good' | 'bad' | 'neutral'): CSSProperties => ({
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    marginRight: '4px',
    marginBottom: '4px',
    border: '1px solid var(--border-subtle)',
    background: tone === 'good' ? 'var(--accent-glow)' : tone === 'bad' ? 'rgba(217, 119, 87, 0.12)' : 'var(--bg-secondary)',
    color: tone === 'bad' ? 'var(--accent-warm)' : 'var(--text-primary)',
});

function Stars({ n }: { n: number }) {
    return (
        <span aria-label={`${n} of 5`} style={{ display: 'inline-flex', gap: '2px', color: 'var(--accent-warm)' }}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={13} fill={i <= n ? 'currentColor' : 'none'} strokeWidth={1.6} style={{ opacity: i <= n ? 1 : 0.35 }} />
            ))}
        </span>
    );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
    return (
        <div style={card}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                {label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 600, marginTop: '6px', fontFamily: 'var(--font-display)' }}>{value}</div>
            {hint && <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>}
        </div>
    );
}

function CountList({
    title,
    counts,
    labels,
    order,
}: {
    title: string;
    counts: Record<string, number>;
    labels: Record<string, string>;
    /** Explicit key order; objects re-sort integer-like keys, so "5 first" needs saying. */
    order?: string[];
}) {
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
                        <span style={{ display: 'block', height: '100%', width: `${(n / max) * 100}%`, background: 'var(--accent-primary)', borderRadius: '999px' }} />
                    </span>
                    <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                </div>
            ))}
        </div>
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
    const [minRating, setMinRating] = useState(0);

    const load = useCallback(
        async (t: string) => {
            if (!t) return;
            setLoading(true);
            setError(null);
            try {
                const res = await fetchFeedbackInbox(t, { trigger: trigger || undefined, min_rating: minRating || undefined, limit: 500 });
                setData(res);
                sessionStorage.setItem(TOKEN_KEY, t);
                setToken(t);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not load the inbox.');
                if (e instanceof Error && e.message === 'Wrong passphrase.') {
                    sessionStorage.removeItem(TOKEN_KEY);
                    setToken('');
                    setData(null);
                }
            } finally {
                setLoading(false);
            }
        },
        [trigger, minRating],
    );

    useEffect(() => {
        document.title = 'Feedback inbox';
        if (token) void load(token);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trigger, minRating]);

    const unlock = (e: FormEvent) => {
        e.preventDefault();
        void load(draft.trim());
    };

    const signOut = () => {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
        setData(null);
        setDraft('');
    };

    if (!token || !data) {
        return (
            <div style={{ ...page, display: 'grid', placeItems: 'center' }}>
                <form onSubmit={unlock} style={{ ...card, width: '100%', maxWidth: '380px', padding: '28px' }}>
                    <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontFamily: 'var(--font-display)' }}>Feedback inbox</h1>
                    <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary)' }}>Enter the passphrase to open it.</p>
                    <input
                        type="password"
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Passphrase"
                        style={{ ...select, width: '100%', boxSizing: 'border-box', marginBottom: '12px', fontSize: '14px' }}
                    />
                    {error && <p role="alert" style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}
                    <button
                        type="submit"
                        disabled={loading || !draft.trim()}
                        style={{ ...button, width: '100%', justifyContent: 'center', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', fontWeight: 600 }}
                    >
                        {loading ? 'Opening…' : 'Open inbox'}
                    </button>
                </form>
            </div>
        );
    }

    const { stats, items, total } = data;

    return (
        <div style={page}>
            <div style={{ maxWidth: '1180px', margin: '0 auto' }}>
                <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '22px' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '24px', fontFamily: 'var(--font-display)' }}>Feedback inbox</h1>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {total} submission{total === 1 ? '' : 's'} · newest first
                        </p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <select value={trigger} onChange={(e) => setTrigger(e.target.value)} style={select} aria-label="Filter by moment">
                            <option value="">All moments</option>
                            {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>
                        <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} style={select} aria-label="Minimum rating">
                            <option value={0}>Any rating</option>
                            {[5, 4, 3, 2].map((n) => (
                                <option key={n} value={n}>{n}★ and up</option>
                            ))}
                        </select>
                        <button type="button" style={button} onClick={() => void load(token)} disabled={loading}>
                            <RefreshCw size={14} /> {loading ? 'Loading…' : 'Refresh'}
                        </button>
                        <button type="button" style={button} onClick={() => downloadFeedbackCsv(token).catch((e) => setError(e.message))}>
                            <Download size={14} /> CSV
                        </button>
                        <button type="button" style={button} onClick={signOut} aria-label="Lock the inbox">
                            <LogOut size={14} />
                        </button>
                    </div>
                </header>

                {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}

                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                    <Stat label="Total" value={stats.total} hint={`${stats.last_7_days} in the last 7 days`} />
                    <Stat label="Average" value={stats.average_rating ?? '—'} hint="out of 5" />
                    <Stat label="People" value={stats.unique_users} hint={`${stats.anonymous} anonymous`} />
                    <Stat label="Want a reply" value={stats.want_contact} hint="ticked the email box" />
                </section>

                <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '22px' }}>
                    <CountList title="Ratings" counts={stats.ratings} order={['5', '4', '3', '2', '1']} labels={{ 5: '5 ★', 4: '4 ★', 3: '3 ★', 2: '2 ★', 1: '1 ★' }} />
                    <CountList title="What worked" counts={stats.liked} labels={CHIP_LABELS} />
                    <CountList title="What was confusing" counts={stats.confusing} labels={CHIP_LABELS} />
                    <CountList title="Which moment asked" counts={stats.triggers} labels={TRIGGER_LABELS} />
                </section>

                <section style={{ ...card, padding: 0, overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '960px' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                {['When', 'Who', 'Nth', 'Rating', 'Moment', 'Page', 'Worked / confusing', 'Comment', 'Reply?'].map((h) => (
                                    <th key={h} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={9} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted)' }}>No feedback matches these filters.</td>
                                </tr>
                            )}
                            {items.map((it: FeedbackAdminItem) => (
                                <tr key={it.id} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{fmt(it.created_at)}</td>
                                    <td style={{ padding: '12px 14px' }}>
                                        {it.user_email ? (
                                            <>
                                                <div>{it.user_name || '—'}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{it.user_email}</div>
                                                {it.account_age_days !== null && (
                                                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>account {it.account_age_days}d old</div>
                                                )}
                                            </>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>Visitor{it.email ? ` · ${it.email}` : ''}</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums' }}>{it.sequence_no ?? '—'}</td>
                                    <td style={{ padding: '12px 14px' }}><Stars n={it.rating} /></td>
                                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>{TRIGGER_LABELS[it.trigger] ?? it.trigger}</td>
                                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{it.page ?? '—'}</td>
                                    <td style={{ padding: '12px 14px', maxWidth: '220px' }}>
                                        {it.liked.map((c) => <span key={`l-${c}`} style={pill('good')}>+ {CHIP_LABELS[c] ?? c}</span>)}
                                        {it.confusing.map((c) => <span key={`c-${c}`} style={pill('bad')}>− {CHIP_LABELS[c] ?? c}</span>)}
                                        {it.liked.length + it.confusing.length === 0 && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ padding: '12px 14px', maxWidth: '340px', whiteSpace: 'pre-wrap' }}>{it.comment ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
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
