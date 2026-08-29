import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Check, Flame, Lock } from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

const GOAL = 'I want to start running again';

/**
 * A week being built, played out in the real interface.
 *
 * A pointer types the goal, sends it, the plan arrives, and the week gets
 * locked. Drawn in the app's own components rather than recorded, so it stays
 * true to the product, follows the visitor's theme, and costs no download.
 *
 * Steps are timed rather than scroll- or hover-driven so it plays the same on a
 * phone, and it holds on the finished state under prefers-reduced-motion — the
 * outcome is the part worth seeing.
 */

// ms each step holds before advancing.
const STEPS = [
    { id: 'idle', hold: 900 },
    { id: 'typing', hold: 2100 },
    { id: 'send', hold: 700 },
    { id: 'thinking', hold: 1100 },
    { id: 'plan', hold: 2400 },
    { id: 'reach-lock', hold: 900 },
    { id: 'locked', hold: 2800 },
] as const;

type StepId = typeof STEPS[number]['id'];

/** Where the pointer sits at each step, in % of the frame. */
const CURSOR: Record<StepId, { x: number; y: number }> = {
    idle: { x: 78, y: 88 },
    typing: { x: 22, y: 84 },
    send: { x: 89, y: 84 },
    thinking: { x: 89, y: 84 },
    plan: { x: 70, y: 60 },
    'reach-lock': { x: 33, y: 74 },
    locked: { x: 33, y: 74 },
};

export default function ProductDemo({ compact = false }: { compact?: boolean }) {
    const [step, setStep] = useState(0);
    const reduced = useRef(
        typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ).current;

    useEffect(() => {
        if (reduced) { setStep(STEPS.length - 1); return; }
        const t = setTimeout(() => setStep(s => (s + 1) % STEPS.length), STEPS[step].hold);
        return () => clearTimeout(t);
    }, [step, reduced]);

    const id = STEPS[step].id;
    const at = (...ids: StepId[]) => ids.includes(id);

    const typedChars = id === 'idle' ? 0
        : id === 'typing' ? undefined          // animated below
            : GOAL.length;

    const showPlan = at('plan', 'reach-lock', 'locked');
    const isLocked = id === 'locked';
    const clicking = at('send', 'locked');

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: compact ? '3 / 4' : '16 / 9',
            border: '1px solid var(--border-medium)',
            borderRadius: '10px',
            background: 'var(--card-bg)',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            fontFamily: satoshi,
        }}>
            {/* Window chrome */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
            }}>
                {['#ef4444', '#eab308', '#22c55e'].map(c => (
                    <span key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.55 }} />
                ))}
                <span style={{
                    marginLeft: 'auto', fontSize: '9px', fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)',
                }}>
                    feelivate.com/app
                </span>
            </div>

            {/* Conversation */}
            <div style={{
                position: 'absolute', inset: '38px 0 62px',
                padding: compact ? '14px' : '16px 20px',
                display: 'flex', flexDirection: 'column', gap: '8px',
                overflow: 'hidden',
            }}>
                <AnimatePresence>
                    {!at('idle', 'typing') && (
                        <motion.div
                            key="user"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            style={{
                                alignSelf: 'flex-end', maxWidth: '80%',
                                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                borderRadius: '14px', padding: '8px 13px',
                                fontSize: '11.5px', fontWeight: 500,
                            }}
                        >
                            {GOAL}
                        </motion.div>
                    )}

                    {id === 'thinking' && (
                        <motion.div
                            key="dots"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '10px 4px' }}
                        >
                            {[0, 0.15, 0.3].map(d => (
                                <motion.span
                                    key={d}
                                    animate={{ opacity: [0.25, 1, 0.25] }}
                                    transition={{ duration: 0.9, repeat: Infinity, delay: d }}
                                    style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted)' }}
                                />
                            ))}
                        </motion.div>
                    )}

                    {showPlan && !isLocked && (
                        <motion.div
                            key="plan"
                            initial={{ opacity: 0, y: 18, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                            style={{
                                border: '1px solid var(--border-medium)',
                                borderRadius: '9px', overflow: 'hidden', background: 'var(--bg-primary)',
                            }}
                        >
                            <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                                <div style={{
                                    fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.14em',
                                    textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '3px',
                                }}>Week 1</div>
                                <div style={{
                                    fontSize: '13px', fontWeight: 700, fontFamily: clash,
                                    letterSpacing: '-0.02em', color: 'var(--text-primary)',
                                }}>Build the running habit</div>
                            </div>
                            {[
                                ['Mon', 'Easy 20-minute walk + 5 min jog'],
                                ['Tue', 'Rest or gentle stretching'],
                                ['Wed', 'Intervals: 1 min jog, 2 min walk × 6'],
                            ].map(([d, a], i) => (
                                <div key={d} style={{
                                    display: 'flex', gap: '9px', padding: '6px 12px',
                                    borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                                }}>
                                    <span style={{
                                        fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.1em',
                                        textTransform: 'uppercase', color: 'var(--text-primary)',
                                        width: '26px', flexShrink: 0, paddingTop: '2px',
                                    }}>{d}</span>
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{a}</span>
                                </div>
                            ))}
                            <div style={{ padding: '9px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                                <motion.div
                                    animate={id === 'reach-lock' ? { scale: [1, 1.04, 1] } : {}}
                                    transition={{ duration: 0.6, repeat: Infinity }}
                                    style={{
                                        textAlign: 'center', padding: '7px', borderRadius: '100px',
                                        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                        fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Let's go
                                </motion.div>
                            </div>
                        </motion.div>
                    )}

                    {isLocked && (
                        <motion.div
                            key="locked"
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                            style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
                        >
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '9px',
                                padding: '9px 14px', borderRadius: '100px',
                                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            }}>
                                <Lock size={11} />
                                <span style={{
                                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
                                    textTransform: 'uppercase',
                                }}>Week 1 locked — Foundation</span>
                            </div>
                            <div style={{
                                alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '7px',
                                padding: '7px 12px', borderRadius: '100px',
                                border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                            }}>
                                <Flame size={11} style={{ color: 'var(--accent-warm)' }} />
                                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                    Day 1 · task emailed at 7:00 AM
                                </span>
                                <Check size={11} style={{ color: '#10b981' }} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Composer */}
            <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                padding: compact ? '12px 14px' : '14px 20px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                display: 'flex', alignItems: 'center', gap: '8px',
            }}>
                <div style={{
                    flex: 1, minWidth: 0,
                    border: '1px solid var(--input-border)', borderRadius: '100px',
                    padding: '8px 14px', background: 'var(--bg-primary)',
                    fontSize: '11.5px', color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                    {typedChars === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>Message Feelivate…</span>
                    ) : id === 'typing' ? (
                        <TypedGoal />
                    ) : at('send') ? (
                        GOAL
                    ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Continue the conversation…</span>
                    )}
                </div>
                <motion.div
                    animate={id === 'send' ? { scale: [1, 0.88, 1] } : {}}
                    transition={{ duration: 0.35 }}
                    style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <ArrowUp size={13} strokeWidth={2.5} />
                </motion.div>
            </div>

            {/* Pointer */}
            {!reduced && (
                <motion.div
                    aria-hidden="true"
                    animate={{ left: `${CURSOR[id].x}%`, top: `${CURSOR[id].y}%` }}
                    transition={{ type: 'spring', stiffness: 90, damping: 18, mass: 0.9 }}
                    style={{ position: 'absolute', zIndex: 5, pointerEvents: 'none' }}
                >
                    {/* Click ripple */}
                    <AnimatePresence>
                        {clicking && (
                            <motion.span
                                key={id}
                                initial={{ scale: 0, opacity: 0.5 }}
                                animate={{ scale: 2.6, opacity: 0 }}
                                transition={{ duration: 0.55 }}
                                style={{
                                    position: 'absolute', left: '-9px', top: '-9px',
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: 'var(--accent-warm)',
                                }}
                            />
                        )}
                    </AnimatePresence>
                    <svg width="17" height="20" viewBox="0 0 17 20" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }}>
                        <path d="M1 1L1 15.5L4.8 12.2L7.4 18L10.2 16.8L7.6 11.2L12.5 11L1 1Z"
                            fill="#fff" stroke="#111" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                </motion.div>
            )}
        </div>
    );
}

/** The goal typing itself in, one character at a time. */
function TypedGoal() {
    const [n, setN] = useState(0);
    useEffect(() => {
        setN(0);
        const iv = setInterval(() => setN(v => (v >= GOAL.length ? v : v + 1)), 55);
        return () => clearInterval(iv);
    }, []);
    return (
        <>
            {GOAL.slice(0, n)}
            <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ display: 'inline-block', width: '1.5px', height: '11px', background: 'var(--accent-warm)', marginLeft: '1.5px', verticalAlign: 'middle' }}
            />
        </>
    );
}
