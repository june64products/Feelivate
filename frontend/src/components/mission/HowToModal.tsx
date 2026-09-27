import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, Clock, Loader2, MessageCircle, X } from 'lucide-react';
import { getTaskHowTo, type TaskHowTo } from '../../api';
import { clashDisplay, satoshi } from './missionTheme';
import { useWindowSize } from '../../hooks/useWindowSize';

export interface HowToTarget {
    day: string;
    action: string;
}

interface HowToModalProps {
    target: HowToTarget | null;
    sessionId: string | null;
    onClose: () => void;
    /** "Still confused": open the mentor with the question already sent. */
    onAskMentor: (target: HowToTarget) => void;
}

/**
 * The step-by-step guide for one plan day. Opens from "How do I do this?" on
 * the Today card and on every day of a plan card. Built once by the model,
 * then served from the store, so reopening it is instant.
 */
export default function HowToModal({ target, sessionId, onClose, onAskMentor }: HowToModalProps) {
    const { isMobile } = useWindowSize();
    const reduceMotion = useReducedMotion();
    const [guide, setGuide] = useState<TaskHowTo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const open = !!target;

    useEffect(() => {
        if (!target) return;
        setGuide(null);
        setError(null);
        if (!sessionId) {
            setError('Open a session to get a guide for this task.');
            return;
        }
        let active = true;
        setLoading(true);
        getTaskHowTo(sessionId, target.action, target.day)
            .then((g) => { if (active) setGuide(g); })
            .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Could not build the guide right now.'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [target, sessionId]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [open, onClose]);

    const label = {
        fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' as const,
        color: 'var(--text-secondary)', fontFamily: satoshi,
    };

    return (
        <AnimatePresence>
            {target && (
                <motion.div
                    key="howto-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.2 }}
                    onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 1100,
                        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
                        padding: isMobile ? 0 : '20px',
                    }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="howto-title"
                        initial={reduceMotion ? { opacity: 1 } : isMobile ? { y: 40, opacity: 0 } : { scale: 0.94, opacity: 0, y: 16 }}
                        animate={isMobile ? { y: 0, opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : isMobile ? { y: 40, opacity: 0 } : { scale: 0.94, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        style={{
                            width: '100%', maxWidth: isMobile ? '100%' : '560px',
                            maxHeight: isMobile ? '92vh' : '88vh', overflowY: 'auto',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-medium)',
                            borderRadius: isMobile ? '22px 22px 0 0' : '22px',
                            padding: isMobile ? '20px 18px calc(20px + env(safe-area-inset-bottom))' : '26px 28px',
                            boxShadow: 'var(--shadow-xl)', color: 'var(--text-primary)', fontFamily: satoshi,
                            position: 'relative',
                        }}
                    >
                        <button
                            type="button"
                            aria-label="Close"
                            onClick={onClose}
                            style={{
                                position: 'absolute', top: '14px', right: '14px', width: '34px', height: '34px',
                                borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', cursor: 'pointer',
                            }}
                        >
                            <X size={16} />
                        </button>

                        <p style={{ ...label, color: 'var(--accent-warm)', margin: '0 0 6px' }}>How do I do this?</p>
                        <h2 id="howto-title" style={{
                            margin: '0 0 4px', fontSize: isMobile ? '19px' : '22px', lineHeight: 1.2, fontWeight: 600,
                            fontFamily: clashDisplay, letterSpacing: '-0.01em', paddingRight: '36px',
                        }}>
                            {target.day}
                        </h2>
                        <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                            {target.action}
                        </p>

                        {loading && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '22px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                Breaking it into steps…
                            </div>
                        )}

                        {error && !loading && (
                            <div role="alert" style={{
                                display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '14px 16px', borderRadius: '14px',
                                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', fontSize: '13px', lineHeight: 1.5,
                                marginBottom: '18px',
                            }}>
                                <AlertTriangle size={16} style={{ flexShrink: 0, color: 'var(--accent-warm)', marginTop: '1px' }} />
                                <span>{error}</span>
                            </div>
                        )}

                        {guide && !loading && (
                            <>
                                {(guide.summary || guide.time_minutes) && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                                        {guide.summary && (
                                            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, flex: '1 1 240px' }}>{guide.summary}</p>
                                        )}
                                        {guide.time_minutes ? (
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600,
                                                padding: '5px 10px', borderRadius: '999px', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)',
                                            }}>
                                                <Clock size={12} /> ~{guide.time_minutes} min
                                            </span>
                                        ) : null}
                                    </div>
                                )}

                                <div style={{ display: 'grid', gap: '14px' }}>
                                    {guide.items.map((item, i) => (
                                        <section key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: '16px', padding: '14px 16px', background: 'var(--card-bg)' }}>
                                            <h3 style={{ margin: '0 0 10px', fontSize: '15px', fontWeight: 700, fontFamily: clashDisplay, letterSpacing: '-0.01em' }}>
                                                {item.name}
                                            </h3>
                                            <ol style={{ margin: 0, paddingLeft: '20px', display: 'grid', gap: '6px', fontSize: '13.5px', lineHeight: 1.55 }}>
                                                {item.steps.map((s, j) => <li key={j}>{s}</li>)}
                                            </ol>
                                            {item.mistakes.length > 0 && (
                                                <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--accent-warm)' }}>Watch out: </span>
                                                    {item.mistakes.join(' · ')}
                                                </p>
                                            )}
                                            {item.easier && (
                                                <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                    <span style={{ fontWeight: 700 }}>Too hard? </span>{item.easier}
                                                </p>
                                            )}
                                        </section>
                                    ))}
                                </div>

                                {guide.bare_minimum && (
                                    <p style={{
                                        margin: '16px 0 0', padding: '12px 14px', borderRadius: '14px', fontSize: '13px', lineHeight: 1.5,
                                        background: 'var(--accent-glow)', border: '1px solid var(--border-subtle)',
                                    }}>
                                        <span style={{ fontWeight: 700 }}>Bare minimum that still counts: </span>{guide.bare_minimum}
                                    </p>
                                )}
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '22px' }}>
                            <button
                                type="button"
                                onClick={() => onAskMentor(target)}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '11px 16px', borderRadius: '100px',
                                    border: '1px solid var(--btn-secondary-border)', background: 'var(--btn-secondary-bg)', color: 'var(--btn-secondary-text)',
                                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: satoshi,
                                }}
                            >
                                <MessageCircle size={14} />
                                Still confused → Ask mentor
                            </button>
                            <motion.button
                                type="button"
                                whileTap={reduceMotion ? undefined : { scale: 0.97 }}
                                onClick={onClose}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '11px 18px', borderRadius: '100px',
                                    border: 'none', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: satoshi,
                                }}
                            >
                                <Check size={14} />
                                Got it
                            </motion.button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/** Open the guide for a plan day from anywhere (the plan card dispatches this). */
export const OPEN_HOWTO_EVENT = 'open-howto';

export function requestHowTo(target: HowToTarget) {
    window.dispatchEvent(new CustomEvent<HowToTarget>(OPEN_HOWTO_EVENT, { detail: target }));
}
