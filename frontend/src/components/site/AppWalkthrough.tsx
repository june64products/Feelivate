import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUp, BookOpen, Calendar, Check, Bell, Flame, Lock, Mail, MessageSquare, Mic, Plus, TrendingUp,
} from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

const GOAL = 'I want to start running again';

/**
 * Fourteen seconds of somebody using Feelivate.
 *
 * Unlike a slideshow of scenes, this is ONE app screen — sidebar, chat, composer —
 * that stays put while a pointer types the goal, sends it, gets the week, locks it,
 * receives the morning email and reads the weekly report. The pointer is aimed at
 * the real elements (measured from the DOM), so every click lands on the thing it
 * changes. Same order as the first-run tutorial, cut down to the five beats that
 * carry the product.
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
    { id: 'greet', hold: 1300, step: 'Step 1', label: 'Tell it the goal, in your own words', target: 'input' },
    { id: 'type', hold: 1900, step: 'Step 1', label: 'Tell it the goal, in your own words', target: 'input' },
    { id: 'send', hold: 1100, step: 'Step 1', label: 'Tell it the goal, in your own words', target: 'send', clickAt: 350 },
    { id: 'plan', hold: 2500, step: 'Step 2', label: 'It builds your week, and says why', target: 'plan' },
    { id: 'lock', hold: 2300, step: 'Step 3', label: "Lock it in. It can't be softened later", target: 'letsgo', clickAt: 650 },
    { id: 'email', hold: 2400, step: 'Step 4', label: "Each morning: today's exact task, in your inbox", target: null },
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

    // Derived scene state. Everything that has "already happened" stays on screen,
    // so the frame reads as a conversation rather than a series of slides.
    const sent = idx >= at('send') && clicked || idx > at('send');
    const hasPlan = idx >= at('plan');
    const locked = (phase === 'lock' && clicked) || idx > at('lock');
    const hasEmail = idx >= at('email');
    const hasReport = idx >= at('report');
    const resetting = phase === 'reset';

    // Advance the timeline. The click flag and the typed text are reset in the
    // same tick the beat changes, so no frame shows a stale state.
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

    // Typewriter, only during the typing beat.
    useEffect(() => {
        if (reduced || phase !== 'type') return;
        const iv = setInterval(() => setTyped(v => (v >= GOAL.length ? v : v + 1)), 52);
        return () => clearInterval(iv);
    }, [phase, reduced]);

    // Aim the pointer at the real element. Measured a few times after the beat
    // starts so elements that slide in are caught at their resting position.
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
            // Plan hover sits over the card's first row instead of dead centre.
            const y = key === 'plan' ? r.top + Math.min(r.height * 0.45, 70) : r.top + r.height / 2;
            setCursor({ x: r.left + r.width / 2 - s.left, y: y - s.top });
        };
        const raf = requestAnimationFrame(measure);
        const t1 = setTimeout(measure, 220);
        const t2 = setTimeout(measure, 560);
        return () => { cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); };
    }, [i, beat, reduced, compact]);

    // Layout responds to the frame's own width, not the viewport.
    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 520));
        ro.observe(stage);
        return () => ro.disconnect();
    }, []);

    const reg = (key: Exclude<Target, null>) => (el: HTMLElement | null) => { targets.current[key] = el; };

    return (
        <div style={{
            width: '100%',
            position: 'relative',
            // Square on a phone: the plan card needs the height to be read whole.
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

            {/* Stage — the app */}
            <div ref={stageRef} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex' }}>
                <motion.div
                    animate={{ opacity: resetting ? 0 : 1 }}
                    transition={{ duration: 0.35 }}
                    style={{ position: 'absolute', inset: 0, display: 'flex' }}
                >
                    <Sidebar compact={compact} locked={locked} />

                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
                        <TopBar locked={locked} compact={compact} />

                        {/* Messages — newest at the bottom, older ones scroll off the top. */}
                        <div style={{
                            flex: 1, minHeight: 0, overflow: 'hidden',
                            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                            gap: '8px', padding: compact ? '10px 12px' : '12px 18px',
                        }}>
                            <Bubble>What do you want to change? Tell me in your own words.</Bubble>

                            <AnimatePresence>
                                {sent && (
                                    <Enter key="user"><Bubble mine>{GOAL}</Bubble></Enter>
                                )}
                                {sent && !hasPlan && (
                                    <Enter key="dots"><Thinking /></Enter>
                                )}
                                {hasPlan && (
                                    <Enter key="why">
                                        <Bubble>Two runs this week, not four. You said you burn out. Habit first.</Bubble>
                                    </Enter>
                                )}
                                {hasPlan && !locked && (
                                    <Enter key="plan" y={18}>
                                        <div ref={reg('plan')}>
                                            <PlanCard letsGoRef={reg('letsgo')} pressing={phase === 'lock' && clicked} />
                                        </div>
                                    </Enter>
                                )}
                                {locked && (
                                    <Enter key="pill">
                                        <ActivePill compact={compact} />
                                    </Enter>
                                )}
                                {hasEmail && (
                                    <Enter key="email" y={18}><EmailCard compact={compact} /></Enter>
                                )}
                                {hasReport && (
                                    <Enter key="report" y={18}><ReportCard compact={compact} /></Enter>
                                )}
                            </AnimatePresence>
                        </div>

                        <Composer
                            inputRef={reg('input')}
                            sendRef={reg('send')}
                            text={sent ? '' : GOAL.slice(0, typed)}
                            focused={phase === 'greet' || phase === 'type' || phase === 'send'}
                            compact={compact}
                        />
                    </div>

                    {/* Lock toast */}
                    <AnimatePresence>
                        {locked && phase === 'lock' && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, x: '-50%', scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, x: '-50%', scale: 1 }}
                                exit={{ opacity: 0, x: '-50%' }}
                                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                                style={{
                                    // Drops in under the top bar, clear of the pill it just replaced.
                                    position: 'absolute', top: compact ? '40px' : '44px',
                                    left: compact ? 'calc(50% + 20px)' : 'calc(50% + 64px)',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 14px', borderRadius: '100px',
                                    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                    boxShadow: 'var(--shadow-lg)', zIndex: 4, whiteSpace: 'nowrap',
                                }}
                            >
                                <Lock size={11} />
                                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    Week 1 locked
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <Pointer pos={cursor} click={clicked && beat.clickAt != null} clickKey={phase} />
            </div>

            {/* Caption + progress */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', gap: '3px', padding: '0 14px', marginTop: '-1px' }}>
                    {BEATS.filter(b => b.id !== 'reset').map((b, n) => {
                        const done = n < Math.min(i, BEATS.length - 2) || resetting;
                        const active = !resetting && n === i;
                        return (
                            <div key={b.id} style={{ flex: b.hold, height: '2px', background: 'var(--border-medium)', overflow: 'hidden' }}>
                                <motion.div
                                    initial={false}
                                    animate={{ scaleX: done || active ? 1 : 0 }}
                                    transition={{ duration: active ? b.hold / 1000 : 0, ease: 'linear' }}
                                    style={{ height: '100%', background: 'var(--accent-warm)', transformOrigin: 'left' }}
                                />
                            </div>
                        );
                    })}
                </div>
                <div style={{ padding: '8px 14px 9px', display: 'flex', alignItems: 'baseline', gap: '10px', minHeight: '32px' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={beat.label || 'reset'}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.22 }}
                            style={{ display: 'flex', alignItems: 'baseline', gap: '10px', minWidth: 0 }}
                        >
                            {beat.step && <span style={{ ...kicker, color: 'var(--accent-warm)', flexShrink: 0 }}>{beat.step}</span>}
                            <span style={{
                                fontSize: compact ? '11px' : '11.5px', fontWeight: 600,
                                color: 'var(--text-secondary)', fontFamily: satoshi,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {beat.label}
                            </span>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

/* ── Pointer ─────────────────────────────────────────────────────────────── */

function Pointer({ pos, click, clickKey }: { pos: { x: number; y: number } | null; click: boolean; clickKey: string }) {
    return (
        <AnimatePresence>
            {pos && (
                <motion.div
                    aria-hidden="true"
                    initial={{ opacity: 0, left: pos.x, top: pos.y }}
                    animate={{ opacity: 1, left: pos.x, top: pos.y, scale: click ? 0.88 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        left: { type: 'spring', stiffness: 110, damping: 20, mass: 0.8 },
                        top: { type: 'spring', stiffness: 110, damping: 20, mass: 0.8 },
                        scale: { duration: 0.12 },
                        opacity: { duration: 0.25 },
                    }}
                    style={{ position: 'absolute', zIndex: 8, pointerEvents: 'none', marginLeft: '-2px', marginTop: '-2px' }}
                >
                    <AnimatePresence>
                        {click && (
                            <motion.span
                                key={clickKey}
                                initial={{ scale: 0.2, opacity: 0.55 }}
                                animate={{ scale: 2.8, opacity: 0 }}
                                transition={{ duration: 0.65, ease: 'easeOut' }}
                                style={{
                                    position: 'absolute', left: '-10px', top: '-10px',
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: 'var(--accent-warm)',
                                }}
                            />
                        )}
                    </AnimatePresence>
                    <svg width="18" height="21" viewBox="0 0 17 20" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }}>
                        <path d="M1 1L1 15.5L4.8 12.2L7.4 18L10.2 16.8L7.6 11.2L12.5 11L1 1Z"
                            fill="#fff" stroke="#111" strokeWidth="1.1" strokeLinejoin="round" />
                    </svg>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

/* ── App shell pieces ────────────────────────────────────────────────────── */

function Sidebar({ compact, locked }: { compact: boolean; locked: boolean }) {
    const w = compact ? 40 : 128;
    const item = (Icon: typeof Plus, label: string, active = false) => (
        <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: compact ? '7px 0' : '6px 8px', justifyContent: compact ? 'center' : 'flex-start',
            borderRadius: '7px', background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        }}>
            <Icon size={12} />
            {!compact && <span style={{ fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>}
        </div>
    );
    return (
        <aside style={{
            width: `${w}px`, flexShrink: 0, background: '#111111',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexDirection: 'column', gap: '4px',
            padding: compact ? '10px 6px' : '12px 10px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: compact ? 'center' : 'flex-start', marginBottom: '8px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#f2f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <img src="/logo_2_backup.png" alt="" style={{ width: '14px', height: '14px', objectFit: 'contain' }} />
                </div>
                {!compact && <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', fontFamily: clash, letterSpacing: '-0.01em' }}>Feelivate</span>}
            </div>
            {item(Plus, 'New chat')}
            {item(MessageSquare, 'Running again', true)}
            {item(BookOpen, 'My Journey')}
            <div style={{ flex: 1 }} />
            <AnimatePresence>
                {locked && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px', justifyContent: compact ? 'center' : 'flex-start',
                            padding: compact ? '6px 0' : '7px 8px', borderRadius: '7px',
                            background: 'rgba(255,255,255,0.06)', color: 'var(--accent-warm)',
                        }}
                    >
                        <Flame size={12} />
                        {!compact && <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>Day 1 streak</span>}
                    </motion.div>
                )}
            </AnimatePresence>
        </aside>
    );
}

function TopBar({ locked, compact }: { locked: boolean; compact: boolean }) {
    const chip: CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '4px 9px', borderRadius: '100px', fontSize: '9px', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: satoshi,
        border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', background: 'var(--bg-surface)',
    };
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: compact ? '7px 12px' : '8px 18px',
            borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, minHeight: '32px',
        }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash, letterSpacing: '-0.01em' }}>Mentor</span>
            <div style={{ flex: 1 }} />
            <AnimatePresence>
                {locked && (
                    <motion.span
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        style={{ ...chip, borderColor: 'var(--accent-warm)', color: 'var(--accent-warm)' }}
                    >
                        <Calendar size={9} /> Week 1
                    </motion.span>
                )}
            </AnimatePresence>
            <span style={chip}><Bell size={9} />{!compact && 'Alerts'}</span>
        </div>
    );
}

function Composer({ inputRef, sendRef, text, focused, compact }: {
    inputRef: (el: HTMLElement | null) => void;
    sendRef: (el: HTMLElement | null) => void;
    text: string; focused: boolean; compact: boolean;
}) {
    return (
        <div style={{ padding: compact ? '8px 12px 10px' : '8px 18px 12px', flexShrink: 0 }}>
            <div
                ref={inputRef}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    border: `1px solid ${focused ? 'var(--input-border-focus)' : 'var(--input-border)'}`,
                    boxShadow: focused ? 'var(--input-shadow-focus)' : 'none',
                    borderRadius: '100px', padding: '5px 5px 5px 14px', background: 'var(--bg-surface)',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
            >
                <div style={{ flex: 1, minWidth: 0, fontSize: '11px', color: text ? 'var(--text-primary)' : 'var(--text-placeholder)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {text || 'Message Feelivate...'}
                    {focused && (
                        <motion.span
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ duration: 0.8, repeat: Infinity }}
                            style={{ display: 'inline-block', width: '1.5px', height: '11px', background: 'var(--accent-warm)', marginLeft: '2px', verticalAlign: 'middle' }}
                        />
                    )}
                </div>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
                    <Mic size={12} />
                </span>
                <span
                    ref={sendRef}
                    style={{
                        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                        background: text ? 'var(--btn-primary-bg)' : 'var(--btn-disabled-bg)',
                        color: 'var(--btn-primary-text)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s',
                    }}
                >
                    <ArrowUp size={12} strokeWidth={2.5} />
                </span>
            </div>
        </div>
    );
}

/* ── Message pieces ──────────────────────────────────────────────────────── */

function Enter({ children, y = 10 }: { children: ReactNode; y?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.18 } }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}
        >
            {children}
        </motion.div>
    );
}

function Bubble({ children, mine = false }: { children: ReactNode; mine?: boolean }) {
    return (
        <div style={{
            alignSelf: mine ? 'flex-end' : 'flex-start',
            maxWidth: '84%',
            background: mine ? 'var(--btn-primary-bg)' : 'var(--bg-surface)',
            color: mine ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
            border: mine ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: '12px', padding: '7px 11px',
            fontSize: '10.5px', lineHeight: 1.5, fontWeight: 500, flexShrink: 0,
        }}>
            {children}
        </div>
    );
}

function Thinking() {
    return (
        <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '9px 12px', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            {[0, 1, 2].map(n => (
                <motion.span
                    key={n}
                    animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: n * 0.15 }}
                    style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--text-muted)', display: 'block' }}
                />
            ))}
        </div>
    );
}

function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    return (
        <div style={{
            border: '1px solid var(--border-medium)', borderRadius: '10px',
            overflow: 'hidden', background: 'var(--card-bg)', boxShadow: 'var(--shadow-md)',
            alignSelf: 'stretch', maxWidth: '420px', ...style,
        }}>
            {children}
        </div>
    );
}

function PlanCard({ letsGoRef, pressing }: { letsGoRef: (el: HTMLElement | null) => void; pressing: boolean }) {
    return (
        <Card>
            <div style={{ padding: '9px 12px 7px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ ...kicker, marginBottom: '2px' }}>Week 1</div>
                <div style={{ fontSize: '12.5px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                    Build the running habit
                </div>
            </div>
            {[
                ['Mon', 'Easy 20-minute walk + 5 min jog'],
                ['Tue', 'Rest or gentle stretching'],
                ['Wed', 'Intervals: 1 min jog, 2 min walk × 6'],
            ].map(([d, a], n) => (
                <div key={d} style={{
                    display: 'flex', gap: '9px', padding: '5px 12px',
                    borderTop: n === 0 ? 'none' : '1px solid var(--border-subtle)',
                    background: n % 2 === 1 ? 'var(--glass-surface)' : 'transparent',
                }}>
                    <span style={{ ...kicker, color: 'var(--text-primary)', width: '26px', flexShrink: 0, paddingTop: '2px' }}>{d}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{a}</span>
                </div>
            ))}
            <div style={{ display: 'flex', gap: '6px', padding: '8px 12px', borderTop: '1px solid var(--border-subtle)' }}>
                <motion.span
                    ref={letsGoRef}
                    animate={{ scale: pressing ? 0.95 : 1 }}
                    transition={{ duration: 0.12 }}
                    style={{
                        flex: 1, textAlign: 'center', padding: '7px', borderRadius: '100px',
                        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                        fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                        display: 'block',
                    }}
                >
                    Let's go
                </motion.span>
                <span style={{
                    padding: '7px 13px', borderRadius: '100px',
                    border: '1px solid var(--accent-primary)', color: 'var(--text-primary)',
                    fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>Tweak</span>
            </div>
        </Card>
    );
}

function ActivePill({ compact }: { compact: boolean }) {
    return (
        <div style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 13px', borderRadius: '100px', background: 'var(--btn-primary-bg)',
        }}>
            <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={9} style={{ color: 'var(--btn-primary-text)' }} />
            </span>
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--btn-primary-text)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {compact ? 'Week 1 Active' : 'Week 1 Active · Running'}
            </span>
            <Lock size={9} style={{ color: 'var(--btn-primary-text)', opacity: 0.7 }} />
        </div>
    );
}

function EmailCard({ compact }: { compact: boolean }) {
    return (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Mail size={11} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash, letterSpacing: '-0.01em' }}>
                        Wednesday · your task
                    </div>
                    <div style={{ ...kicker, marginTop: '1px' }}>7:00 AM · your timezone</div>
                </div>
                <span style={{ ...kicker, marginLeft: 'auto', color: 'var(--accent-warm)' }}>Inbox</span>
            </div>
            <div style={{ padding: compact ? '9px 12px' : '10px 12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '3px' }}>
                    Intervals: 1 min jog, 2 min walk × 6
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Easy pace. The goal is to show up, not to race. Lay your shoes out tonight.
                </p>
            </div>
        </Card>
    );
}

function ReportCard({ compact }: { compact: boolean }) {
    return (
        <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div style={kicker}>Week 1 · Report</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700, color: 'var(--accent-warm)' }}>
                    <Flame size={10} /> 5-day streak
                </span>
            </div>
            <div style={{ padding: '9px 12px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {[['86%', 'Consistency', 'var(--text-primary)'], ['6', 'Done', '#10b981'], ['1', 'Missed', '#ef4444']].map(([v, l, c]) => (
                        <div key={l} style={{ padding: '7px 8px', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '15px', fontWeight: 700, color: c, fontFamily: clash, letterSpacing: '-0.03em', lineHeight: 1 }}>{v}</div>
                            <div style={{ ...kicker, marginTop: '2px', fontSize: '7.5px' }}>{l}</div>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '3px' }}>
                    {[true, true, true, false, true, true, true].map((done, n) => (
                        <motion.div
                            key={n}
                            initial={{ opacity: 0, scaleY: 0.4 }} animate={{ opacity: 1, scaleY: 1 }}
                            transition={{ delay: 0.25 + n * 0.06 }}
                            style={{
                                flex: 1, height: '16px', borderRadius: '4px',
                                background: done ? 'var(--accent-warm)' : 'var(--border-medium)',
                                opacity: done ? 0.9 : 0.5,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            {done && <Check size={9} style={{ color: '#fff' }} />}
                        </motion.div>
                    ))}
                </div>
                {!compact && (
                    <div style={{ padding: '7px 9px', borderRadius: '7px', display: 'flex', gap: '7px', background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)' }}>
                        <TrendingUp size={12} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '1px' }} />
                        <p style={{ fontSize: '9.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                            You skipped Thursday, same as last week. Week 2 moves that run to the morning.
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
