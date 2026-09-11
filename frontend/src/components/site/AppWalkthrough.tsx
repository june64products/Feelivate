import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUp, Bell, Check, Calendar, Flame, Gift, Lock, Mail, Mic, Shield, Target, TrendingUp,
} from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

const GOAL = 'I want to start running again';

/**
 * Fourteen seconds of somebody using Feelivate — the MISSION layout.
 *
 * One app frame that stays put: the goal-start screen takes the typed goal,
 * the mentor panel builds the week, committing seals it into the Today
 * mission surface (task card, path row, streak + shield), then the morning
 * email and the weekly report land on top. The pointer is aimed at real
 * elements (measured from the DOM), so every click lands on the thing it
 * changes. Same order as the first-run tutorial, cut to five beats.
 *
 * Built from markup rather than recorded: sharp at any density, follows the
 * visitor's theme, weighs nothing, and can't drift out of date.
 */

type Phase = 'greet' | 'type' | 'send' | 'plan' | 'lock' | 'email' | 'report' | 'reset';
type Target = 'input' | 'send' | 'letsgo' | 'plan' | null;

interface Beat {
    id: Phase;
    hold: number;
    label: string;
    step: string;       // shown in the caption kicker
    target: Target;
    clickAt?: number;   // ms into the beat when the pointer clicks
}

const BEATS: Beat[] = [
    { id: 'greet', hold: 1300, step: 'Step 1', label: 'Say the goal, in your own words', target: 'input' },
    { id: 'type', hold: 1900, step: 'Step 1', label: 'Say the goal, in your own words', target: 'input' },
    { id: 'send', hold: 1100, step: 'Step 1', label: 'Say the goal, in your own words', target: 'send', clickAt: 350 },
    { id: 'plan', hold: 2500, step: 'Step 2', label: 'Your mentor builds the week — and says why', target: 'plan' },
    { id: 'lock', hold: 2600, step: 'Step 3', label: 'Commit. Today takes the stage', target: 'letsgo', clickAt: 650 },
    { id: 'email', hold: 2400, step: 'Step 4', label: "Each morning: today's task, one-tap done", target: null },
    { id: 'report', hold: 2800, step: 'Step 5', label: 'Week end: what you did versus what you promised', target: null },
    { id: 'reset', hold: 450, step: '', label: '', target: null },
];

const ORDER: Phase[] = BEATS.map(b => b.id);
const at = (p: Phase) => ORDER.indexOf(p);

const kicker: CSSProperties = {
    fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
};

export default function AppWalkthrough() {
    const [reduced] = useState(() =>
        typeof window !== 'undefined'
        && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );

    // Reduced motion holds on the report: the outcome is the part worth seeing.
    const [i, setI] = useState(() => (reduced ? at('report') : 0));
    const [clicked, setClicked] = useState(false);
    const [typed, setTyped] = useState(() => (reduced ? GOAL.length : 0));
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
    const [compact, setCompact] = useState(false);

    const stageRef = useRef<HTMLDivElement>(null);
    const targets = useRef<Record<Exclude<Target, null>, HTMLElement | null>>({
        input: null, send: null, letsgo: null, plan: null,
    });

    const beat = BEATS[i];
    const phase = beat.id;
    const idx = at(phase);

    const hasPlan = idx >= at('plan');
    const locked = (phase === 'lock' && clicked) || idx > at('lock');
    const hasEmail = idx >= at('email');
    const hasReport = idx >= at('report');
    const resetting = phase === 'reset';

    useEffect(() => {
        if (reduced) return;
        const next = (i + 1) % BEATS.length;
        const t = setTimeout(() => {
            setClicked(false);
            if (next === 0) setTyped(0);
            setI(next);
        }, beat.hold);
        const c = beat.clickAt != null ? setTimeout(() => setClicked(true), beat.clickAt) : undefined;
        return () => { clearTimeout(t); if (c) clearTimeout(c); };
    }, [i, beat, reduced]);

    useEffect(() => {
        if (reduced || phase !== 'type') return;
        const iv = setInterval(() => setTyped(v => (v >= GOAL.length ? v : v + 1)), 52);
        return () => clearInterval(iv);
    }, [phase, reduced]);

    useLayoutEffect(() => {
        if (reduced) return;
        const key = beat.target;
        const measure = () => {
            if (!key) { setCursor(null); return; }
            const stage = stageRef.current;
            const el = targets.current[key];
            if (!stage || !el) return;
            const s = stage.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            const y = key === 'plan' ? r.top + Math.min(r.height * 0.45, 70) : r.top + r.height / 2;
            setCursor({ x: r.left + r.width / 2 - s.left, y: y - s.top });
        };
        const raf = requestAnimationFrame(measure);
        const t1 = setTimeout(measure, 220);
        const t2 = setTimeout(measure, 560);
        return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
    }, [i, beat, reduced, compact]);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 520));
        ro.observe(stage);
        return () => ro.disconnect();
    }, []);

    const reg = (key: Exclude<Target, null>) => (el: HTMLElement | null) => { targets.current[key] = el; };

    const showGoalScreen = !hasPlan;
    const showMentorPanel = hasPlan && !locked;

    return (
        <div style={{
            width: '100%',
            position: 'relative',
            aspectRatio: compact ? '1 / 1' : '16 / 9',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-medium)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-xl)',
            overflow: 'hidden',
            fontFamily: satoshi,
            display: 'flex',
            flexDirection: 'column',
        }}>
            {/* Window chrome */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '9px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                flexShrink: 0,
            }}>
                {['#ef4444', '#eab308', '#22c55e'].map(c => (
                    <span key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.55 }} />
                ))}
                <span style={{ ...kicker, marginLeft: 'auto' }}>feelivate.com/app</span>
            </div>

            {/* Stage — the mission workspace */}
            <div ref={stageRef} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
                <motion.div
                    animate={{ opacity: resetting ? 0 : 1 }}
                    transition={{ duration: 0.35 }}
                    style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}
                >
                    <MissionBar locked={locked} compact={compact} />

                    {/* ── Goal start (steps 1) ── */}
                    {showGoalScreen && (
                        <div style={{
                            flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center',
                            padding: compact ? '10px 14px' : '12px 24px', gap: compact ? '10px' : '14px',
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{
                                    fontSize: compact ? '15px' : '20px', fontWeight: 600, color: 'var(--text-primary)',
                                    fontFamily: clash, letterSpacing: '-0.02em',
                                }}>
                                    What do you want to change?
                                </div>
                                <div style={{ fontSize: compact ? '9px' : '10.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                    Say it once. Your mentor turns it into a week you can keep.
                                </div>
                            </div>
                            <div ref={reg('input')} style={{
                                width: 'min(420px, 92%)', display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'var(--card-bg)', border: '1px solid var(--border-medium)',
                                borderRadius: '100px', padding: compact ? '8px 8px 8px 14px' : '10px 10px 10px 16px',
                                boxShadow: 'var(--shadow-sm)',
                            }}>
                                <span style={{
                                    flex: 1, fontSize: compact ? '10px' : '11.5px', whiteSpace: 'nowrap', overflow: 'hidden',
                                    color: typed > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                                }}>
                                    {typed > 0 ? GOAL.slice(0, typed) : 'I keep starting and quitting…'}
                                    {phase === 'type' && <span style={{ opacity: 0.7 }}>▍</span>}
                                </span>
                                <Mic size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span ref={reg('send')} style={{
                                    width: compact ? '22px' : '26px', height: compact ? '22px' : '26px', borderRadius: '50%',
                                    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    transform: phase === 'send' && clicked ? 'scale(0.9)' : 'none',
                                    transition: 'transform 0.15s',
                                }}>
                                    <ArrowUp size={13} />
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {['Get fit', 'Quit smoking', 'Learn coding'].map(s => (
                                    <span key={s} style={{
                                        fontSize: '8.5px', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
                                        borderRadius: '100px', padding: '4px 10px', background: 'var(--card-bg)',
                                    }}>{s}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Mentor panel with the plan (step 2-3) ── */}
                    {showMentorPanel && (
                        <div style={{
                            flex: 1, minHeight: 0, display: 'flex', alignItems: 'center',
                            justifyContent: 'center', padding: compact ? '8px 12px' : '10px 24px',
                        }}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                                ref={reg('plan')}
                                style={{
                                    width: 'min(430px, 96%)', background: 'var(--card-bg)',
                                    border: '1px solid var(--border-medium)', borderRadius: '14px',
                                    boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                                }}
                            >
                                <div style={{ padding: compact ? '10px 14px 8px' : '12px 18px 10px' }}>
                                    <div style={{ ...kicker, color: 'var(--accent-primary)' }}>Week 1 · ready to commit</div>
                                    <div style={{
                                        fontSize: compact ? '12.5px' : '14px', fontWeight: 700, color: 'var(--text-primary)',
                                        fontFamily: clash, marginTop: '3px',
                                    }}>
                                        Running restart — built for you
                                    </div>
                                    <div style={{ fontSize: compact ? '8.5px' : '9.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.5 }}>
                                        Two runs this week, not four — you said you burn out. Habit first, volume later.
                                    </div>
                                </div>
                                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: compact ? '8px 14px' : '10px 18px' }}>
                                    {[
                                        ['Tue', 'If 7 am — shoes on, out the door. Run 1 / walk 3 × 6'],
                                        ['Thu', 'If 7 am — run 90s / walk 3 × 5'],
                                        ['Sat', 'Longest effort yet — 20 min, any pace'],
                                    ].map(([d, a]) => (
                                        <div key={d} style={{ display: 'flex', gap: '10px', padding: '3.5px 0', alignItems: 'baseline' }}>
                                            <span style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-muted)', width: '22px', flexShrink: 0 }}>{d}</span>
                                            <span style={{ fontSize: compact ? '8.5px' : '9.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a}</span>
                                        </div>
                                    ))}
                                    <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', marginTop: '4px' }}>Win = 2 of 3 runs · Sun rest</div>
                                </div>
                                <div style={{ padding: compact ? '8px 14px 12px' : '10px 18px 14px', display: 'flex', gap: '8px' }}>
                                    <span ref={reg('letsgo')} style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                        borderRadius: '100px', padding: compact ? '7px 0' : '8px 0',
                                        fontSize: compact ? '9px' : '10px', fontWeight: 800, letterSpacing: '0.05em',
                                        textTransform: 'uppercase',
                                        transform: phase === 'lock' && clicked ? 'scale(0.96)' : 'none',
                                        transition: 'transform 0.15s',
                                    }}>
                                        <Lock size={10} />
                                        I'm committing to this
                                    </span>
                                    <span style={{
                                        padding: compact ? '7px 12px' : '8px 14px', borderRadius: '100px',
                                        border: '1px solid var(--border-medium)', color: 'var(--text-secondary)',
                                        fontSize: compact ? '9px' : '10px', fontWeight: 700,
                                    }}>Tweak</span>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* ── Today mission surface (after commit) ── */}
                    {locked && (
                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
                                gap: compact ? '8px' : '10px', padding: compact ? '10px 14px' : '12px 26px',
                                maxWidth: '560px', width: '100%', margin: '0 auto',
                            }}
                        >
                            <div style={{
                                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                                borderRadius: '14px', padding: compact ? '10px 14px' : '12px 18px',
                                boxShadow: 'var(--shadow-sm)',
                            }}>
                                <div style={{ ...kicker, color: 'var(--accent-primary)' }}>Today · Week 1</div>
                                <div style={{
                                    fontSize: compact ? '11px' : '13px', fontWeight: 600, color: 'var(--text-primary)',
                                    fontFamily: clash, margin: '4px 0 8px', lineHeight: 1.45,
                                }}>
                                    If it's 7:00 am — shoes on, out the door
                                </div>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    background: 'linear-gradient(135deg, #ffb24d, #ff5a36)', color: '#fff',
                                    borderRadius: '100px', padding: compact ? '5px 12px' : '6px 14px',
                                    fontSize: compact ? '8.5px' : '9.5px', fontWeight: 800,
                                    letterSpacing: '0.05em', textTransform: 'uppercase',
                                }}>
                                    <Check size={10} strokeWidth={3} />
                                    Done for today
                                </span>
                            </div>
                            <div style={{
                                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                                borderRadius: '14px', padding: compact ? '9px 14px' : '10px 18px',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={kicker}>Your path · Week 1</span>
                                    <span style={{ fontSize: '8.5px', color: 'var(--text-secondary)' }}>Win: 2 of 3 runs</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    {(['done', 'today', 'up', 'up', 'gift'] as const).map((k, n) => (
                                        <div key={n} style={{ display: 'flex', alignItems: 'center' }}>
                                            {n > 0 && <span style={{ width: compact ? '12px' : '18px', height: '2px', background: 'var(--border-subtle)' }} />}
                                            <span style={{
                                                width: k === 'today' ? (compact ? '24px' : '28px') : (compact ? '20px' : '24px'),
                                                height: k === 'today' ? (compact ? '24px' : '28px') : (compact ? '20px' : '24px'),
                                                borderRadius: k === 'gift' ? '8px' : '50%',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: k === 'done' ? 'rgba(245,158,11,0.16)' : k === 'today' ? 'var(--btn-primary-bg)' : 'var(--bg-surface)',
                                                border: k === 'done' ? '1.5px solid #f59e0b' : k === 'today' ? 'none' : '1px solid var(--border-subtle)',
                                                color: k === 'done' ? '#f59e0b' : k === 'today' ? 'var(--btn-primary-text)' : 'var(--text-muted)',
                                                fontSize: '8px', fontWeight: 800,
                                            }}>
                                                {k === 'done' ? <Check size={10} strokeWidth={3} /> : k === 'today' ? 'T' : k === 'gift' ? <Gift size={10} /> : '·'}
                                            </span>
                                        </div>
                                    ))}
                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Flame size={11} style={{ color: '#ff5a36' }} fill="#ffb24d" />
                                        <span style={{ fontSize: '9.5px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: clash }}>1</span>
                                        <Shield size={10} style={{ color: 'var(--accent-primary)', marginLeft: '4px' }} />
                                        <span style={{ fontSize: '8.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>1</span>
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </motion.div>

                {/* ── Email overlay (step 4) ── */}
                <AnimatePresence>
                    {hasEmail && !hasReport && (
                        <Overlay key="email">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{
                                    width: '24px', height: '24px', borderRadius: '8px', background: 'var(--btn-primary-bg)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Mail size={12} style={{ color: 'var(--btn-primary-text)' }} />
                                </span>
                                <div>
                                    <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Feelivate · 7:00 am</div>
                                    <div style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>Week 1 · Thursday — your plan, your words</div>
                                </div>
                            </div>
                            <div style={{ fontSize: compact ? '10px' : '11px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: clash, lineHeight: 1.5 }}>
                                Shoes on? If it's 7 am — run 90s, walk 3 × 5.
                            </div>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '8px',
                                background: '#059669', color: '#fff', borderRadius: '8px',
                                padding: '5px 12px', fontSize: '8.5px', fontWeight: 800,
                            }}>
                                <Check size={9} strokeWidth={3} /> Mark today done — one tap, no login
                            </span>
                        </Overlay>
                    )}
                    {hasReport && (
                        <Overlay key="report">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <span style={{
                                    width: '24px', height: '24px', borderRadius: '8px', background: 'var(--btn-primary-bg)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <TrendingUp size={12} style={{ color: 'var(--btn-primary-text)' }} />
                                </span>
                                <div style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Week 1 report</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                {[['3/3', 'runs done'], ['86%', 'consistency'], ['+1', 'shield earned']].map(([v, l]) => (
                                    <div key={l} style={{
                                        flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                        borderRadius: '10px', padding: '7px 6px', textAlign: 'center',
                                    }}>
                                        <div style={{ fontSize: compact ? '11px' : '13px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: clash }}>{v}</div>
                                        <div style={{ fontSize: '7.5px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ fontSize: compact ? '8.5px' : '9.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                                You never missed a morning. Next week's evening run moves to 7 am — your window.
                            </div>
                        </Overlay>
                    )}
                </AnimatePresence>

                {/* Pointer */}
                {cursor && !reduced && (
                    <motion.div
                        animate={{ left: cursor.x, top: cursor.y, scale: clicked ? 0.82 : 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                        style={{
                            position: 'absolute', width: '18px', height: '18px', zIndex: 40,
                            marginLeft: '-9px', marginTop: '-9px', pointerEvents: 'none',
                            borderRadius: '50%', border: '2px solid var(--text-primary)',
                            background: 'color-mix(in srgb, var(--text-primary) 14%, transparent)',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
                        }}
                    />
                )}
            </div>

            {/* Caption */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: compact ? '8px 14px' : '9px 16px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)', flexShrink: 0, minHeight: '34px',
            }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={beat.step + beat.label}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.22 }}
                        style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}
                    >
                        {beat.step && <span style={{ ...kicker, color: 'var(--accent-primary)', flexShrink: 0 }}>{beat.step}</span>}
                        <span style={{
                            fontSize: compact ? '10px' : '11.5px', fontWeight: 600, color: 'var(--text-primary)',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{beat.label}</span>
                    </motion.div>
                </AnimatePresence>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                        <span key={n} style={{
                            width: '5px', height: '5px', borderRadius: '50%',
                            background: beat.step === `Step ${n}` ? 'var(--accent-primary)' : 'var(--border-medium)',
                            transition: 'background 0.3s',
                        }} />
                    ))}
                </span>
            </div>
        </div>
    );
}

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function MissionBar({ locked, compact }: { locked: boolean; compact: boolean }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: compact ? '7px 10px' : '8px 14px', flexShrink: 0,
        }}>
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: 'var(--card-bg)', border: '1px solid var(--border-medium)',
                borderRadius: '100px', padding: compact ? '4px 9px' : '5px 11px',
                fontSize: compact ? '8px' : '9px', fontWeight: 700, color: 'var(--text-primary)',
            }}>
                <Target size={9} style={{ color: 'var(--accent-primary)' }} />
                {locked ? 'Running again · Week 1' : 'New goal'}
            </span>
            <span style={{ flex: 1 }} />
            {locked && (
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                    borderRadius: '100px', padding: compact ? '4px 8px' : '4px 10px',
                }}>
                    <Flame size={10} style={{ color: '#ff5a36' }} fill="#ffb24d" />
                    <span style={{ fontSize: '9px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: clash }}>1</span>
                </span>
            )}
            {[Bell, Calendar].map((I, n) => (
                <span key={n} style={{
                    width: compact ? '18px' : '20px', height: compact ? '18px' : '20px', borderRadius: '7px',
                    border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
                }}>
                    <I size={9} />
                </span>
            ))}
            <span style={{
                width: compact ? '18px' : '20px', height: compact ? '18px' : '20px', borderRadius: '50%',
                background: 'var(--accent-warm, #d97757)', color: '#fff', fontSize: '7.5px', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>A</span>
        </div>
    );
}

function Overlay({ children }: { children: ReactNode }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            style={{
                position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                width: 'min(400px, 88%)', zIndex: 30,
                background: 'var(--card-bg)', border: '1px solid var(--border-medium)',
                borderRadius: '14px', padding: '14px 16px', boxShadow: 'var(--shadow-xl)',
                fontFamily: satoshi,
            }}
        >
            {children}
        </motion.div>
    );
}
