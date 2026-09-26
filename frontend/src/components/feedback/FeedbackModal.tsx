import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { Check, Star, X } from 'lucide-react';
import { useFeedback } from './FeedbackContext';
import { FEEDBACK_CHIPS, submitFeedback, type FeedbackChip, type FeedbackTrigger } from './feedbackApi';

const COPY: Record<FeedbackTrigger, { title: string; sub: string }> = {
    logout: { title: 'Before you go — 30 seconds?', sub: 'One honest rating helps more than you would think.' },
    exit_intent: { title: 'Leaving already?', sub: 'Tell us one thing before you go, good or bad.' },
    tab_return: { title: 'Welcome back', sub: 'While it is fresh: how has Feelivate been so far?' },
    first_plan: { title: 'Your first plan is set', sub: 'How did building it feel?' },
    first_chats: { title: 'How is the mentor so far?', sub: 'You have had a few exchanges. First impressions?' },
    timer: { title: 'Quick pulse check', sub: 'You have been here a few minutes. How is it going?' },
    side_tab: { title: 'Tell us what you think', sub: 'Every note goes straight to the people building Feelivate.' },
};

const STAR_LABELS = ['', 'Rough', 'Meh', 'Okay', 'Good', 'Loved it'];

const useIsNarrow = () => {
    const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
    useEffect(() => {
        const onResize = () => setNarrow(window.innerWidth < 640);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return narrow;
};

const chipStyle = (selected: boolean): CSSProperties => ({
    padding: '7px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1.2,
    cursor: 'pointer',
    border: `1px solid ${selected ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
    background: selected ? 'var(--accent-primary)' : 'transparent',
    color: selected ? 'var(--btn-primary-text)' : 'var(--text-primary)',
    transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease, transform 160ms var(--ease-spring)',
    fontFamily: 'var(--font-sans)',
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

function ChipGroup({
    label,
    selected,
    onToggle,
}: {
    label: string;
    selected: FeedbackChip[];
    onToggle: (chip: FeedbackChip) => void;
}) {
    return (
        <div>
            <span style={labelStyle}>{label}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }} role="group" aria-label={label}>
                {FEEDBACK_CHIPS.map((chip) => {
                    const on = selected.includes(chip.key);
                    return (
                        <button
                            key={chip.key}
                            type="button"
                            aria-pressed={on}
                            onClick={() => onToggle(chip.key)}
                            style={chipStyle(on)}
                        >
                            {chip.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function FeedbackModal() {
    const { isOpen, trigger, close, isLoggedIn } = useFeedback();
    const { pathname } = useLocation();
    const narrow = useIsNarrow();
    const reduceMotion = useReducedMotion();

    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [liked, setLiked] = useState<FeedbackChip[]>([]);
    const [confusing, setConfusing] = useState<FeedbackChip[]>([]);
    const [comment, setComment] = useState('');
    const [contactOk, setContactOk] = useState(false);
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    // Fresh form every time it opens.
    useEffect(() => {
        if (!isOpen) return;
        setRating(0);
        setHover(0);
        setLiked([]);
        setConfusing([]);
        setComment('');
        setContactOk(false);
        setEmail('');
        setSending(false);
        setError(null);
        setDone(false);
    }, [isOpen]);

    // Escape closes as "not now"; the page behind must not scroll.
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !sending) close(false);
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [isOpen, sending, close]);

    const copy = COPY[trigger];
    const isLogout = trigger === 'logout';
    const shown = hover || rating;

    const toggle = (list: FeedbackChip[], set: (v: FeedbackChip[]) => void) => (chip: FeedbackChip) =>
        set(list.includes(chip) ? list.filter((c) => c !== chip) : [...list, chip]);

    const handleSubmit = async () => {
        if (!rating || sending) return;
        setSending(true);
        setError(null);
        try {
            await submitFeedback({
                rating,
                liked,
                confusing,
                comment: comment.trim() || undefined,
                contact_ok: isLoggedIn ? contactOk : Boolean(email.trim()),
                email: !isLoggedIn && email.trim() ? email.trim() : undefined,
                trigger,
                page: pathname,
            });
            setDone(true);
            window.setTimeout(() => close(true), 1400);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not send your feedback right now.');
            setSending(false);
        }
    };

    const sheet = useMemo<CSSProperties>(
        () => ({
            width: '100%',
            maxWidth: narrow ? '100%' : '520px',
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
        [narrow],
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="feedback-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !sending) close(false);
                    }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 1200,
                        background: 'rgba(0,0,0,0.55)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        display: 'flex',
                        alignItems: narrow ? 'flex-end' : 'center',
                        justifyContent: 'center',
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
                                position: 'absolute',
                                top: '14px',
                                right: '14px',
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                            }}
                        >
                            <X size={16} />
                        </button>

                        {done ? (
                            <motion.div
                                initial={reduceMotion ? {} : { scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                style={{ textAlign: 'center', padding: '28px 0 12px' }}
                            >
                                <div
                                    style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '50%',
                                        margin: '0 auto 14px',
                                        display: 'grid',
                                        placeItems: 'center',
                                        background: 'var(--accent-primary)',
                                        color: 'var(--btn-primary-text)',
                                    }}
                                >
                                    <Check size={26} />
                                </div>
                                <p style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px', fontFamily: 'var(--font-display)' }}>
                                    Thank you
                                </p>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                                    This shapes what we build next.
                                </p>
                            </motion.div>
                        ) : (
                            <>
                                <p
                                    style={{
                                        margin: '0 0 6px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        letterSpacing: '0.12em',
                                        textTransform: 'uppercase',
                                        color: 'var(--accent-warm)',
                                    }}
                                >
                                    Feedback
                                </p>
                                <h2
                                    id="feedback-title"
                                    style={{
                                        margin: '0 0 4px',
                                        fontSize: narrow ? '20px' : '22px',
                                        lineHeight: 1.2,
                                        fontWeight: 600,
                                        fontFamily: 'var(--font-display)',
                                        paddingRight: '36px',
                                    }}
                                >
                                    {copy.title}
                                </h2>
                                <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'var(--text-secondary)' }}>{copy.sub}</p>

                                {/* Rating */}
                                <div style={{ marginBottom: '20px' }}>
                                    <span style={labelStyle}>How is Feelivate for you?</span>
                                    <div
                                        role="radiogroup"
                                        aria-label="Rating"
                                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        onMouseLeave={() => setHover(0)}
                                    >
                                        {[1, 2, 3, 4, 5].map((n) => {
                                            const filled = n <= shown;
                                            return (
                                                <motion.button
                                                    key={n}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={rating === n}
                                                    aria-label={`${n} of 5: ${STAR_LABELS[n]}`}
                                                    onMouseEnter={() => setHover(n)}
                                                    onFocus={() => setHover(n)}
                                                    onBlur={() => setHover(0)}
                                                    onClick={() => setRating(n)}
                                                    whileTap={reduceMotion ? undefined : { scale: 0.85 }}
                                                    style={{
                                                        width: '42px',
                                                        height: '42px',
                                                        borderRadius: '12px',
                                                        border: '1px solid var(--border-subtle)',
                                                        background: filled ? 'var(--accent-glow)' : 'transparent',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        cursor: 'pointer',
                                                        color: filled ? 'var(--accent-warm)' : 'var(--text-muted)',
                                                        transition: 'color 120ms ease, background 120ms ease',
                                                    }}
                                                >
                                                    <Star size={22} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.8} />
                                                </motion.button>
                                            );
                                        })}
                                        <span
                                            aria-live="polite"
                                            style={{ marginLeft: '8px', fontSize: '13px', color: 'var(--text-secondary)', minWidth: '64px' }}
                                        >
                                            {shown ? STAR_LABELS[shown] : ''}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gap: '18px', marginBottom: '18px' }}>
                                    <ChipGroup label="What worked?" selected={liked} onToggle={toggle(liked, setLiked)} />
                                    <ChipGroup label="What was confusing?" selected={confusing} onToggle={toggle(confusing, setConfusing)} />
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <label htmlFor="feedback-comment" style={labelStyle}>
                                        Anything else? <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional)</span>
                                    </label>
                                    <textarea
                                        id="feedback-comment"
                                        value={comment}
                                        maxLength={1000}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="What would make this worth coming back to?"
                                        rows={3}
                                        style={{
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            resize: 'vertical',
                                            minHeight: '84px',
                                            padding: '12px 14px',
                                            borderRadius: '14px',
                                            border: '1px solid var(--border-medium)',
                                            background: 'var(--bg-input)',
                                            color: 'var(--text-primary)',
                                            fontSize: '14px',
                                            lineHeight: 1.5,
                                            fontFamily: 'var(--font-sans)',
                                            outline: 'none',
                                        }}
                                    />
                                    <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        {comment.length}/1000
                                    </div>
                                </div>

                                {isLoggedIn ? (
                                    <label
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            fontSize: '13px',
                                            color: 'var(--text-secondary)',
                                            marginBottom: '22px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={contactOk}
                                            onChange={(e) => setContactOk(e.target.checked)}
                                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-warm)' }}
                                        />
                                        You can email me about this
                                    </label>
                                ) : (
                                    <div style={{ marginBottom: '22px' }}>
                                        <label htmlFor="feedback-email" style={labelStyle}>
                                            Email <span style={{ textTransform: 'none', fontWeight: 400 }}>(optional, only if you want a reply)</span>
                                        </label>
                                        <input
                                            id="feedback-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '11px 14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-medium)',
                                                background: 'var(--bg-input)',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px',
                                                fontFamily: 'var(--font-sans)',
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                )}

                                {error && (
                                    <p role="alert" style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--color-error)' }}>
                                        {error}
                                    </p>
                                )}

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={() => !sending && close(false)}
                                        style={{
                                            padding: '11px 16px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--btn-secondary-border)',
                                            background: 'var(--btn-secondary-bg)',
                                            color: 'var(--btn-secondary-text)',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                    >
                                        {isLogout ? 'Skip & log out' : 'Not now'}
                                    </button>
                                    <motion.button
                                        type="button"
                                        disabled={!rating || sending}
                                        onClick={handleSubmit}
                                        whileTap={reduceMotion || !rating ? undefined : { scale: 0.97 }}
                                        style={{
                                            padding: '11px 18px',
                                            borderRadius: '12px',
                                            border: 'none',
                                            background: rating ? 'var(--btn-primary-bg)' : 'var(--btn-disabled-bg)',
                                            color: rating ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: rating && !sending ? 'pointer' : 'not-allowed',
                                            fontFamily: 'var(--font-sans)',
                                            transition: 'background 160ms ease, color 160ms ease',
                                        }}
                                    >
                                        {sending ? 'Sending…' : isLogout ? 'Send & log out' : 'Send feedback'}
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
