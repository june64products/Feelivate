import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Calendar, Check, Flame, Lock, Mail, Mic, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/**
 * What you get, one benefit at a time.
 *
 * The sign-up page's counterpart to the home-page walkthrough. Where that one
 * shows the product being used, this one shows what the product hands you: a
 * pointer walks down a list of six benefits, clicks each, and the panel beside
 * it opens the matching piece of the app with a one-line "you get" callout.
 * Same DNA as the three frames under the hero, but in motion.
 *
 * Built from the app's own tokens, so it follows the theme and never goes stale.
 */

interface Benefit {
    id: string;
    icon: LucideIcon;
    title: string;
    you: string;        // the "you get" line
    hold: number;
}

const BENEFITS: Benefit[] = [
    { id: 'plan', icon: Lock, title: 'A locked 7-day plan', you: 'Exact daily actions, built around your reasons. Once you say "Let\'s go", the week can\'t be quietly softened.', hold: 2600 },
    { id: 'email', icon: Mail, title: 'Today\'s task, every morning', you: 'One email at your hour, in your timezone. You never open the app wondering what to do.', hold: 2400 },
    { id: 'streak', icon: Flame, title: 'A streak worth protecting', you: 'Show up daily and it grows. Your best streak stays on record so you have something to beat.', hold: 2300 },
    { id: 'report', icon: TrendingUp, title: 'An honest weekly report', you: 'Done versus promised, no flattery. It spots the pattern and next week adapts to it.', hold: 2600 },
    { id: 'voice', icon: Mic, title: 'A voice journal that listens', you: 'Talk about the day. It reads how you felt and factors that into the plan, not just the checkboxes.', hold: 2400 },
    { id: 'calendar', icon: Calendar, title: 'Your calendar, filled in', you: 'Each task lands in Google Calendar with a reminder. Scheduled, not left to willpower.', hold: 2300 },
];

const CLICK_AT = 420;   // pointer arrives, then presses
const SWAP_AT = 520;    // preview changes just after the press

const kicker: CSSProperties = {
    fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
};

export default function BenefitsReel() {
    const [i, setI] = useState(0);
    const [shown, setShown] = useState(0);      // which preview is open (lags the pointer)
    const [clicked, setClicked] = useState(false);
    const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
    const [compact, setCompact] = useState(false);

    const stageRef = useRef<HTMLDivElement>(null);
    const rows = useRef<(HTMLElement | null)[]>([]);

    const [reduced] = useState(() =>
        typeof window !== 'undefined'
        && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );

    useEffect(() => {
        if (reduced) return;
        const next = (i + 1) % BENEFITS.length;
        const c = setTimeout(() => setClicked(true), CLICK_AT);
        const s = setTimeout(() => setShown(i), SWAP_AT);
        const t = setTimeout(() => { setClicked(false); setI(next); }, BENEFITS[i].hold);
        return () => { clearTimeout(c); clearTimeout(s); clearTimeout(t); };
    }, [i, reduced]);

    useLayoutEffect(() => {
        if (reduced) return;
        const measure = () => {
            const stage = stageRef.current;
            const el = rows.current[i];
            if (!stage || !el) return;
            const s = stage.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            setCursor({ x: r.left + Math.min(r.width * 0.55, 150) - s.left, y: r.top + r.height / 2 - s.top });
        };
        const raf = requestAnimationFrame(measure);
        const t = setTimeout(measure, 200);
        return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    }, [i, reduced, compact]);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(([e]) => setCompact(e.contentRect.width < 460));
        ro.observe(stage);
        return () => ro.disconnect();
    }, []);

    const active = BENEFITS[shown];

    return (
        <div style={{
            width: '100%',
            position: 'relative',
            aspectRatio: compact ? '4 / 5' : '4 / 3',
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
                <span style={{ ...kicker, marginLeft: 'auto' }}>What you get with Feelivate</span>
            </div>

            {/* Stage */}
            <div
                ref={stageRef}
                style={{
                    position: 'relative', flex: 1, minHeight: 0,
                    display: 'grid',
                    gridTemplateColumns: compact ? '1fr' : 'minmax(0, 0.9fr) minmax(0, 1.1fr)',
                    gridTemplateRows: compact ? 'auto minmax(0, 1fr)' : '1fr',
                }}
            >
                {/* Benefit list */}
                <div style={{
                    display: 'flex', flexDirection: compact ? 'row' : 'column',
                    gap: compact ? '4px' : '3px',
                    padding: compact ? '8px 10px' : '12px 10px',
                    borderRight: compact ? 'none' : '1px solid var(--border-subtle)',
                    borderBottom: compact ? '1px solid var(--border-subtle)' : 'none',
                    background: 'var(--bg-surface)',
                    overflow: 'hidden', justifyContent: compact ? 'space-between' : 'center',
                }}>
                    {BENEFITS.map((b, n) => {
                        const on = n === shown;
                        const Icon = b.icon;
                        return (
                            <div
                                key={b.id}
                                ref={el => { rows.current[n] = el; }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '9px',
                                    padding: compact ? '6px' : '8px 10px', borderRadius: '8px',
                                    background: on ? 'var(--card-bg)' : 'transparent',
                                    border: `1px solid ${on ? 'var(--border-medium)' : 'transparent'}`,
                                    boxShadow: on ? 'var(--shadow-sm)' : 'none',
                                    transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
                                    flex: compact ? 1 : undefined, justifyContent: compact ? 'center' : 'flex-start',
                                }}
                            >
                                <span style={{
                                    width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: on ? 'var(--accent-warm)' : 'var(--glass-surface)',
                                    color: on ? '#fff' : 'var(--text-muted)',
                                    border: on ? 'none' : '1px solid var(--border-subtle)',
                                    transition: 'background 0.25s, color 0.25s',
                                }}>
                                    <Icon size={11} />
                                </span>
                                {!compact && (
                                    <span style={{
                                        fontSize: '10.5px', fontWeight: on ? 700 : 600,
                                        color: on ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                        transition: 'color 0.25s',
                                    }}>
                                        {b.title}
                                    </span>
                                )}
                                {!compact && on && (
                                    <motion.span layoutId="dot" style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-warm)', flexShrink: 0 }} />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Preview + callout */}
                <div style={{ position: 'relative', minHeight: 0, padding: compact ? '10px 12px 12px' : '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)' }}>
                    <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                        {/* Previews are stacked absolutely, so the outgoing one can
                            crossfade under the incoming one with no blank frame. */}
                        <AnimatePresence initial={false}>
                            <motion.div
                                key={active.id}
                                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.985, transition: { duration: 0.22 } }}
                                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                                style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
                            >
                                <Preview id={active.id} compact={compact} />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={active.id + '-you'}
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
                            transition={{ duration: 0.28, delay: 0.05 }}
                            style={{ flexShrink: 0 }}
                        >
                            <div style={{ ...kicker, color: 'var(--accent-warm)', marginBottom: '3px' }}>You get</div>
                            <div style={{ fontSize: compact ? '12.5px' : '13.5px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1.15, marginBottom: '3px' }}>
                                {active.title}
                            </div>
                            <p style={{ fontSize: compact ? '10px' : '10.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                                {active.you}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Pointer */}
                {!reduced && cursor && (
                    <motion.div
                        aria-hidden="true"
                        initial={{ left: cursor.x, top: cursor.y }}
                        animate={{ left: cursor.x, top: cursor.y, scale: clicked ? 0.88 : 1 }}
                        transition={{
                            left: { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 },
                            top: { type: 'spring', stiffness: 120, damping: 20, mass: 0.8 },
                            scale: { duration: 0.12 },
                        }}
                        style={{ position: 'absolute', zIndex: 8, pointerEvents: 'none' }}
                    >
                        <AnimatePresence>
                            {clicked && (
                                <motion.span
                                    key={i}
                                    initial={{ scale: 0.2, opacity: 0.55 }}
                                    animate={{ scale: 2.8, opacity: 0 }}
                                    transition={{ duration: 0.65, ease: 'easeOut' }}
                                    style={{ position: 'absolute', left: '-10px', top: '-10px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-warm)' }}
                                />
                            )}
                        </AnimatePresence>
                        <svg width="18" height="21" viewBox="0 0 17 20" fill="none" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))' }}>
                            <path d="M1 1L1 15.5L4.8 12.2L7.4 18L10.2 16.8L7.6 11.2L12.5 11L1 1Z" fill="#fff" stroke="#111" strokeWidth="1.1" strokeLinejoin="round" />
                        </svg>
                    </motion.div>
                )}
            </div>

            {/* Progress */}
            <div style={{ flexShrink: 0, display: 'flex', gap: '3px', padding: '0 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', height: '9px', alignItems: 'flex-start' }}>
                {BENEFITS.map((b, n) => (
                    <div key={b.id} style={{ flex: b.hold, height: '2px', marginTop: '-1px', background: 'var(--border-medium)', overflow: 'hidden' }}>
                        <motion.div
                            initial={false}
                            animate={{ scaleX: n < i || n === i ? 1 : 0 }}
                            transition={{ duration: n === i ? b.hold / 1000 : 0, ease: 'linear' }}
                            style={{ height: '100%', background: 'var(--accent-warm)', transformOrigin: 'left' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Previews ────────────────────────────────────────────────────────────── */

function Frame({ children, head }: { children: ReactNode; head?: ReactNode }) {
    return (
        <div style={{ border: '1px solid var(--border-medium)', borderRadius: '10px', overflow: 'hidden', background: 'var(--card-bg)', boxShadow: 'var(--shadow-md)' }}>
            {head && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {head}
                </div>
            )}
            <div style={{ padding: '10px 12px' }}>{children}</div>
        </div>
    );
}

function Preview({ id, compact }: { id: string; compact: boolean }) {
    switch (id) {
        case 'plan': return <PlanPreview compact={compact} />;
        case 'email': return <EmailPreview />;
        case 'streak': return <StreakPreview />;
        case 'report': return <ReportPreview compact={compact} />;
        case 'voice': return <VoicePreview />;
        case 'calendar': return <CalendarPreview />;
        default: return null;
    }
}

function PlanPreview({ compact }: { compact: boolean }) {
    const days = [['Mon', 'Easy 20-min walk + 5 min jog'], ['Tue', 'Rest or gentle stretching'], ['Wed', 'Intervals: 1 min jog, 2 min walk × 6'], ['Thu', 'Mobility, 15 minutes']];
    return (
        <Frame head={<>
            <div><div style={kicker}>Week 1</div><div style={{ fontSize: '12px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Build the running habit</div></div>
            <motion.span
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 20 }}
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '100px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
                <Lock size={9} /> Locked
            </motion.span>
        </>}>
            {days.slice(0, compact ? 3 : 4).map(([d, a], n) => (
                <motion.div
                    key={d}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + n * 0.08 }}
                    style={{ display: 'flex', gap: '9px', padding: '5px 0', borderTop: n === 0 ? 'none' : '1px solid var(--border-subtle)' }}
                >
                    <span style={{ ...kicker, color: 'var(--text-primary)', width: '26px', flexShrink: 0, paddingTop: '2px' }}>{d}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{a}</span>
                </motion.div>
            ))}
        </Frame>
    );
}

function EmailPreview() {
    return (
        <Frame head={<>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Mail size={11} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div><div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash }}>Wednesday · your task</div><div style={kicker}>7:00 AM · your timezone</div></div>
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ ...kicker, marginLeft: 'auto', color: 'var(--accent-warm)' }}>Just now</motion.span>
        </>}>
            <div style={{ ...kicker, color: 'var(--accent-warm)', marginBottom: '4px' }}>Today</div>
            <div style={{ fontSize: '12px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '4px' }}>Intervals: 1 min jog, 2 min walk × 6</div>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 8px' }}>Easy pace. The goal is to show up, not to race. Lay your shoes out tonight.</p>
            <div style={{ display: 'flex', gap: '6px' }}>
                {['Start slower than feels right', 'Stop with something left'].map(t => (
                    <span key={t} style={{ fontSize: '9px', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '100px', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t}</span>
                ))}
            </div>
        </Frame>
    );
}

function StreakPreview() {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const done = [true, true, true, true, true, false, false];
    return (
        <Frame head={<>
            <Flame size={13} style={{ color: 'var(--accent-warm)' }} />
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash }}>Streak</div>
            <span style={{ ...kicker, marginLeft: 'auto' }}>Best 12</span>
        </>}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '10px' }}>
                <motion.span
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    style={{ fontSize: '30px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1 }}
                >5</motion.span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>days in a row</span>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
                {days.map((d, n) => (
                    <motion.div
                        key={n}
                        initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25 + n * 0.07, type: 'spring', stiffness: 300, damping: 18 }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                    >
                        <div style={{
                            width: '100%', aspectRatio: '1', maxHeight: '28px', borderRadius: '7px',
                            background: done[n] ? 'var(--accent-warm)' : 'var(--bg-surface)',
                            border: done[n] ? 'none' : '1px dashed var(--border-medium)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {done[n] && <Check size={11} style={{ color: '#fff' }} />}
                        </div>
                        <span style={{ ...kicker, fontSize: '8px' }}>{d}</span>
                    </motion.div>
                ))}
            </div>
        </Frame>
    );
}

function ReportPreview({ compact }: { compact: boolean }) {
    return (
        <Frame head={<>
            <div style={kicker}>Week 1 · Report</div>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '9.5px', fontWeight: 700, color: 'var(--accent-warm)' }}><Flame size={10} /> 5-day streak</span>
        </>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '8px' }}>
                {[['86%', 'Consistency', 'var(--text-primary)'], ['6', 'Done', '#10b981'], ['1', 'Missed', '#ef4444']].map(([v, l, c], n) => (
                    <motion.div
                        key={l}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + n * 0.08 }}
                        style={{ padding: '7px 8px', borderRadius: '7px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                    >
                        <div style={{ fontSize: '15px', fontWeight: 700, color: c, fontFamily: clash, letterSpacing: '-0.03em', lineHeight: 1 }}>{v}</div>
                        <div style={{ ...kicker, marginTop: '2px', fontSize: '7.5px' }}>{l}</div>
                    </motion.div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '3px', marginBottom: compact ? 0 : '8px' }}>
                {[true, true, true, false, true, true, true].map((d, n) => (
                    <div key={n} style={{ flex: 1, height: '16px', borderRadius: '4px', background: d ? 'var(--accent-warm)' : 'var(--border-medium)', opacity: d ? 0.9 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {d && <Check size={9} style={{ color: '#fff' }} />}
                    </div>
                ))}
            </div>
            {!compact && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ padding: '7px 9px', borderRadius: '7px', display: 'flex', gap: '7px', background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)' }}>
                    <TrendingUp size={12} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '1px' }} />
                    <p style={{ fontSize: '9.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>You skipped Thursday, same as last week. Week 2 moves that run to the morning.</p>
                </motion.div>
            )}
        </Frame>
    );
}

function VoicePreview() {
    return (
        <Frame head={<>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash }}>My Journey</div>
            <span style={{ ...kicker, marginLeft: 'auto' }}>Wednesday</span>
        </>}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <motion.div
                    animate={{ boxShadow: ['0 0 0 0px rgba(217,119,87,0.35)', '0 0 0 12px rgba(217,119,87,0)'] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: 'var(--accent-warm)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Mic size={15} />
                </motion.div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '20px', marginBottom: '6px' }}>
                        {[0.3, 0.7, 1, 0.5, 0.85, 0.4, 0.65, 0.9, 0.35, 0.6, 0.8, 0.45].map((h, n) => (
                            <motion.span
                                key={n}
                                animate={{ scaleY: [h * 0.4, h, h * 0.4] }}
                                transition={{ duration: 0.7, repeat: Infinity, delay: n * 0.07 }}
                                style={{ width: '3px', height: '20px', borderRadius: '2px', background: 'var(--accent-warm)', opacity: 0.75, display: 'block' }}
                            />
                        ))}
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontStyle: 'italic', fontFamily: "'Georgia', serif" }}>
                        "Did the intervals. Legs were heavy but I showed up…"
                    </p>
                </div>
            </div>
            <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)' }}
            >
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fbbf24, #d97757 70%)', boxShadow: '0 0 10px rgba(217,119,87,0.6)', flexShrink: 0 }} />
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600 }}>Today felt: <span style={{ color: 'var(--text-primary)' }}>tired, but proud</span></span>
            </motion.div>
        </Frame>
    );
}

function CalendarPreview() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const events: Record<string, string> = { Mon: 'Walk + jog', Wed: 'Intervals', Fri: 'Easy run' };
    return (
        <Frame head={<>
            <Calendar size={12} style={{ color: 'var(--text-secondary)' }} />
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash }}>Google Calendar</div>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '4px', ...kicker, color: '#10b981' }}><Check size={9} /> Synced</span>
        </>}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '5px' }}>
                {days.map((d, n) => (
                    <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <span style={{ ...kicker, fontSize: '8px', textAlign: 'center' }}>{d}</span>
                        <div style={{ height: '58px', borderRadius: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '4px', position: 'relative' }}>
                            {events[d] && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + n * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
                                    style={{ position: 'absolute', left: '4px', right: '4px', top: '14px', padding: '4px 5px', borderRadius: '4px', background: 'var(--accent-warm)', color: '#fff', fontSize: '8px', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden' }}
                                >
                                    <div style={{ opacity: 0.8, fontWeight: 600 }}>7:00</div>
                                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{events[d]}</div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bell size={10} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 600 }}>Reminder 15 minutes before each task</span>
            </motion.div>
        </Frame>
    );
}
