import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useFeedback } from './FeedbackContext';
import {
    FEEDBACK_CHIPS,
    PLAN_FIT_OPTIONS,
    TASK_CLARITY_OPTIONS,
    TASK_QUALITY_OPTIONS,
    TASK_TIME_OPTIONS,
    TWEAK_REASON_OPTIONS,
    UPSET_OPTIONS,
    submitFeedback,
    type FeedbackChip,
    type FeedbackKind,
    type FeedbackTrigger,
} from './feedbackApi';

/*
 * One component, five forms. Which one shows depends on the moment that
 * opened it:
 *   first_plan     → plan_fit   (one question: does this plan feel right?)
 *   after_journal  → task_day   (how was today's task, three taps)
 *   second_tweak   → tweaks     (why isn't the draft landing?)
 *   weekly_report, side tab, exit, logout, … → full
 *
 * The full form no longer asks for stars. Its one required question is
 * whether they'd be upset if Feelivate went away — the answer that predicts
 * coming back — and a "not really" must say why. Everything else is one
 * tap or one line.
 */

const KIND_FOR: Record<FeedbackTrigger, FeedbackKind> = {
    first_plan: 'plan_fit',
    after_journal: 'task_day',
    second_tweak: 'tweaks',
    weekly_report: 'full',
    side_tab: 'full',
    exit_intent: 'full',
    tab_return: 'full',
    first_chats: 'full',
    timer: 'full',
    logout: 'full',
    task_email: 'full',
    review_read: 'full',   // the review's own thumbs post directly; never opens this modal
};

const COPY: Record<FeedbackTrigger, { title: string; sub: string }> = {
    logout: { title: 'Before you go — 20 seconds?', sub: 'One honest answer helps more than you would think.' },
    exit_intent: { title: 'Leaving already?', sub: 'Tell us one thing before you go, good or bad.' },
    tab_return: { title: 'Welcome back', sub: 'While it is fresh: how has Feelivate been so far?' },
    first_plan: { title: 'Does this plan feel right?', sub: 'Before you lock it — one tap.' },
    first_chats: { title: 'How is the mentor so far?', sub: 'You have had a few exchanges. First impressions?' },
    timer: { title: 'Quick pulse check', sub: 'You have been here a few minutes. How is it going?' },
    side_tab: { title: 'Tell us what you think', sub: 'Every note goes straight to the people building Feelivate.' },
    after_journal: { title: "How was today's task?", sub: 'Voice note saved. Three taps and you are done.' },
    second_tweak: { title: 'Two tweaks in — what is off?', sub: 'Help the mentor get it right next time.' },
    weekly_report: { title: 'One week in. Be honest.', sub: 'You have seen a full week now — this is the feedback that matters most.' },
    task_email: { title: 'Tell us what you think', sub: '' },
    review_read: { title: 'Tell us what you think', sub: '' },
};

const useIsNarrow = () => {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return narrow;
};

const chipStyle = (selected: boolean, block = false): CSSProperties => ({
    padding: block ? '11px 14px' : '7px 12px',
    borderRadius: block ? '12px' : '999px',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.25,
    cursor: 'pointer',
    textAlign: 'left',
    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
    background: selected ? 'var(--accent-primary)' : 'transparent',
    color: selected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
    fontFamily: 'var(--font-sans)',
    display: block ? 'flex' : 'inline-flex',
    flexDirection: block ? 'column' : 'row',
    gap: block ? '2px' : 0,
    flex: block ? '1 1 140px' : undefined,
});

const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
};

const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border-medium)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    lineHeight: 1.5,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
};

function Choice<T extends string>({
    label,
    options,
    value,
    onChange,
    block = false,
}: {
    label: ReactNode;
    options: readonly { key: T; label: string; hint?: string }[];
    value: T | null;
    onChange: (v: T) => void;
    block?: boolean;
}) {
    return (
        <div style={{ marginBottom: '16px' }}>
            <span style={labelStyle}>{label}</span>
            <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {options.map((o) => {
                    const on = value === o.key;
                    return (
                        <button key={o.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.key)} style={chipStyle(on, block)}>
                            <span style={{ fontWeight: 600 }}>{o.label}</span>
                            {o.hint && <span style={{ fontSize: '11.5px', opacity: 0.75 }}>{o.hint}</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function TextBox({
    label,
    value,
    onChange,
    placeholder,
    rows = 2,
    max = 400,
    required = false,
}: {
    label: ReactNode;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    rows?: number;
    max?: number;
    required?: boolean;
}) {
    return (
        <div style={{ marginBottom: '16px' }}>
            <span style={labelStyle}>
                {label} {!required && <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>}
            </span>
            <textarea value={value} maxLength={max} rows={rows} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
    );
}

export default function FeedbackModal() {
    const { isOpen, trigger, details, close, isLoggedIn } = useFeedback();
    const { pathname } = useLocation();
    const narrow = useIsNarrow();
    const reduceMotion = useReducedMotion();
    const kind = KIND_FOR[trigger];

    // full
    const [upset, setUpset] = useState<string | null>(null);
    const [upsetReason, setUpsetReason] = useState('');
    const [likedMost, setLikedMost] = useState<FeedbackChip | null>(null);
    const [confusing, setConfusing] = useState<FeedbackChip[]>([]);
    const [confusingNotes, setConfusingNotes] = useState<Record<string, string>>({});
    const [quitReason, setQuitReason] = useState('');
    const [brokeOpen, setBrokeOpen] = useState(false);
    const [broke, setBroke] = useState('');
    // plan_fit
    const [fit, setFit] = useState<string | null>(null);
    // task_day
    const [quality, setQuality] = useState<string | null>(null);
    const [clarity, setClarity] = useState<string | null>(null);
    const [time, setTime] = useState<string | null>(null);
    // tweaks
    const [reason, setReason] = useState<string | null>(null);
    // shared
    const [note, setNote] = useState('');
    const [contactOk, setContactOk] = useState(false);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setUpset(null); setUpsetReason(''); setLikedMost(null); setConfusing([]); setConfusingNotes({});
        setQuitReason(''); setBrokeOpen(false); setBroke('');
        setFit(null); setQuality(null); setClarity(null); setTime(null); setReason(null);
        setNote(''); setContactOk(false); setEmail(''); setSending(false); setError(null); setDone(false);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) close(false); };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
    }, [isOpen, sending, close]);

    const copy = COPY[trigger];
    const isLogout = trigger === 'logout';
    const needsReason = upset === 'a_bit' || upset === 'not_really';

    const canSend = (() => {
        if (kind === 'full') return !!upset && (!needsReason || upsetReason.trim().length > 0);
        if (kind === 'plan_fit') return !!fit;
        if (kind === 'task_day') return !!quality;
        if (kind === 'tweaks') return !!reason;
        return false;
    })();

    const toggleConfusing = (chip: FeedbackChip) =>
        setConfusing((list) => (list.includes(chip) ? list.filter((c) => c !== chip) : [...list, chip]));

    const handleSubmit = async () => {
        if (!canSend || sending) return;
        setSending(true);
        setError(null);
        let answers: Record<string, unknown> = {};
        if (kind === 'full') {
            answers = {
                upset,
                upset_reason: upsetReason.trim() || undefined,
                liked_most: likedMost ?? undefined,
                confusing,
                confusing_notes: Object.fromEntries(Object.entries(confusingNotes).filter(([k, v]) => confusing.includes(k as FeedbackChip) && v.trim())),
                quit_reason: quitReason.trim() || undefined,
                broke: brokeOpen && broke.trim() ? broke.trim() : undefined,
            };
        } else if (kind === 'plan_fit') {
            answers = { fit, note: note.trim() || undefined };
        } else if (kind === 'task_day') {
            answers = { quality, clarity: clarity ?? undefined, time: time ?? undefined, note: note.trim() || undefined };
        } else if (kind === 'tweaks') {
            answers = { reason, note: note.trim() || undefined, tweak_count: details.tweakCount ?? 2 };
        }
        try {
            await submitFeedback({
                kind,
                answers,
                contact_ok: isLoggedIn ? contactOk : Boolean(email.trim()),
                email: !isLoggedIn && email.trim() ? email.trim() : undefined,
                trigger,
                page: pathname,
                session_id: details.sessionId ?? localStorage.getItem('active_session_id'),
            });
            setDone(true);
            window.setTimeout(() => close(true), 1200);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not send your feedback right now.');
            setSending(false);
        }
    };

    const sheet = useMemo<CSSProperties>(
        () => ({
            width: '100%',
            maxWidth: narrow ? '100%' : kind === 'full' ? '540px' : '460px',
            maxHeight: narrow ? '92vh' : '90vh',
            overflowY: 'auto',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: narrow ? '22px 22px 0 0' : '22px',
            padding: narrow ? '22px 20px calc(22px + env(safe-area-inset-bottom))' : '28px',
            boxShadow: 'var(--shadow-xl)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            position: 'relative',
        }),
        [narrow, kind],
    );

    const sendLabel = sending ? 'Sending…' : isLogout ? 'Send & log out' : kind === 'full' ? 'Send feedback' : 'Done';
    const skipLabel = isLogout ? 'Skip & log out' : kind === 'full' ? 'Not now' : 'Skip';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="feedback-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) close(false); }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1200,
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: narrow ? 'flex-end' : 'center', justifyContent: 'center',
                        padding: narrow ? 0 : '20px',
                    }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="feedback-title"
                        initial={reduceMotion ? { opacity: 1 } : narrow ? { y: 40, opacity: 0 } : { scale: 0.94, opacity: 0, y: 16 }}
                        animate={narrow ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : narrow ? { y: 40, opacity: 0 } : { scale: 0.94, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        style={sheet}
                    >
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={() => !sending && close(false)}
                            style={{
                                position: 'absolute', top: '14px', right: '14px', width: '34px', height: '34px', borderRadius: '50%',
                                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                                display: 'grid', placeItems: 'center', cursor: 'pointer',
                            }}
                        >
                            <X size={16} />
                        </button>

                        {done ? (
                            <motion.div initial={reduceMotion ? {} : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ textAlign: 'center', padding: '28px 0 12px' }}>
                                <div style={{ width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 14px', display: 'grid', placeItems: 'center', background: 'var(--accent-primary)', color: 'var(--btn-primary-text)' }}>
                                    <Check size={26} />
                                </div>
                                <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>Thank you</p>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>This shapes what we build next.</p>
                            </motion.div>
                        ) : (
                            <>
                                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-warm)' }}>
                                    Feedback
                                </p>
                                <h2 id="feedback-title" style={{ margin: '0 0 4px', fontSize: narrow ? '20px' : '22px', lineHeight: 1.2, fontWeight: 600, fontFamily: 'var(--font-display)', paddingRight: '36px' }}>
                                    {copy.title}
                                </h2>
                                <p style={{ margin: '0 0 18px', fontSize: '14px', color: 'var(--text-secondary)' }}>{copy.sub}</p>

                                {/* ── plan_fit ── */}
                                {kind === 'plan_fit' && (
                                    <>
                                        <Choice label={`Week ${details.weekNumber ?? 1}'s plan is…`} options={PLAN_FIT_OPTIONS} value={fit} onChange={setFit} block />
                                        {fit && fit !== 'about_right' && (
                                            <TextBox label="What would make it fit?" value={note} onChange={setNote} placeholder={fit === 'too_hard' ? 'e.g. 3×12 push-ups is a lot for day one' : 'e.g. I already run 5k, this is a warm-up'} />
                                        )}
                                    </>
                                )}

                                {/* ── task_day ── */}
                                {kind === 'task_day' && (
                                    <>
                                        {details.taskLabel && (
                                            <p style={{ margin: '0 0 14px', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                {details.taskLabel}
                                            </p>
                                        )}
                                        <Choice label="Today's task was…" options={TASK_QUALITY_OPTIONS} value={quality} onChange={setQuality} block />
                                        <Choice label="Was it clear what to do?" options={TASK_CLARITY_OPTIONS} value={clarity} onChange={setClarity} />
                                        <Choice label="Time it took vs the plan" options={TASK_TIME_OPTIONS} value={time} onChange={setTime} />
                                        {(quality === 'off' || quality === 'didnt_fit') && (
                                            <TextBox label="What would have fit better?" value={note} onChange={setNote} placeholder="One line is plenty." />
                                        )}
                                    </>
                                )}

                                {/* ── tweaks ── */}
                                {kind === 'tweaks' && (
                                    <>
                                        <Choice label="The main reason the draft isn't landing" options={TWEAK_REASON_OPTIONS} value={reason} onChange={setReason} block />
                                        <TextBox label="Anything the mentor keeps getting wrong?" value={note} onChange={setNote} placeholder="e.g. I said mornings only, it keeps planning evenings" />
                                    </>
                                )}

                                {/* ── full ── */}
                                {kind === 'full' && (
                                    <>
                                        <Choice label="If Feelivate went away tomorrow, you'd be…" options={UPSET_OPTIONS} value={upset} onChange={setUpset} block />
                                        {needsReason && (
                                            <TextBox label="What's the main reason?" value={upsetReason} onChange={setUpsetReason} placeholder="Honest is better than polite." required />
                                        )}

                                        <div style={{ marginBottom: '16px' }}>
                                            <span style={labelStyle}>The one thing you liked most</span>
                                            <div role="radiogroup" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {FEEDBACK_CHIPS.map((chip) => (
                                                    <button key={chip.key} type="button" role="radio" aria-checked={likedMost === chip.key} onClick={() => setLikedMost(likedMost === chip.key ? null : chip.key)} style={chipStyle(likedMost === chip.key)}>
                                                        {chip.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div style={{ marginBottom: '16px' }}>
                                            <span style={labelStyle}>What was confusing? <span style={{ textTransform: 'none', fontWeight: 400 }}>(pick any)</span></span>
                                            <div role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {FEEDBACK_CHIPS.map((chip) => {
                                                    const on = confusing.includes(chip.key);
                                                    return (
                                                        <button key={chip.key} type="button" aria-pressed={on} onClick={() => toggleConfusing(chip.key)} style={chipStyle(on)}>
                                                            {chip.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {confusing.map((chip) => {
                                                const label = FEEDBACK_CHIPS.find((c) => c.key === chip)?.label ?? chip;
                                                return (
                                                    <input
                                                        key={chip}
                                                        value={confusingNotes[chip] ?? ''}
                                                        maxLength={300}
                                                        onChange={(e) => setConfusingNotes((m) => ({ ...m, [chip]: e.target.value }))}
                                                        placeholder={`What was confusing about ${label.toLowerCase()}?`}
                                                        style={{ ...inputStyle, marginTop: '8px', fontSize: '13px', padding: '9px 12px' }}
                                                    />
                                                );
                                            })}
                                        </div>

                                        <TextBox label="What almost made you quit?" value={quitReason} onChange={setQuitReason} placeholder="Or: what did you expect to happen that didn't?" max={600} />

                                        {!brokeOpen ? (
                                            <button type="button" onClick={() => setBrokeOpen(true)} style={{ ...chipStyle(false), marginBottom: '16px' }}>
                                                Something broke?
                                            </button>
                                        ) : (
                                            <TextBox label="What broke, and where?" value={broke} onChange={setBroke} placeholder="What you did, what you expected, what happened instead." max={600} rows={3} />
                                        )}
                                    </>
                                )}

                                {isLoggedIn ? (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-warm)' }} />
                                        You can email me about this
                                    </label>
                                ) : (
                                    <div style={{ marginBottom: '20px' }}>
                                        <span style={labelStyle}>Email <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional, only if you want a reply)</span></span>
                                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inputStyle} />
                                    </div>
                                )}

                                {error && <p role="alert" style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--color-error)' }}>{error}</p>}

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => !sending && close(false)}
                                        style={{ padding: '11px 16px', borderRadius: '12px', border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                                    >
                                        {skipLabel}
                                    </button>
                                    <motion.button
                                        type="button"
                                        disabled={!canSend || sending}
                                        onClick={handleSubmit}
                                        whileTap={reduceMotion || !canSend ? undefined : { scale: 0.97 }}
                                        style={{
                                            padding: '11px 18px', borderRadius: '12px', border: 'none',
                                            background: canSend ? 'var(--btn-primary-bg)' : 'var(--btn-disabled-bg)',
                                            color: canSend ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                                            fontSize: '14px', fontWeight: 600, cursor: canSend && !sending ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)',
                                            transition: 'background 160ms ease, color 160ms ease',
                                        }}
                                    >
                                        {sendLabel}
                                    </motion.button>
                                </div>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
