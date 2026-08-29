import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, Check, Flame, Lock, Mail, Mic, TrendingUp } from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

const GOAL = 'I want to start running again';

/**
 * Ten seconds of Feelivate, played in Feelivate's own components.
 *
 * Goal typed → week built → week locked → the task arrives → the day is logged
 * → the week is scored. A pointer does the clicking, so it reads as somebody
 * using the product rather than a slideshow of features.
 *
 * Built from the app's markup rather than recorded: sharp at any density,
 * follows the visitor's theme, weighs nothing to download, and cannot drift
 * into advertising an interface that no longer exists.
 */

type SceneId = 'type' | 'plan' | 'lock' | 'email' | 'journal' | 'report';

interface Scene {
    id: SceneId;
    hold: number;              // ms on screen
    label: string;             // caption under the frame
    cursor: { x: number; y: number } | null;  // % of frame; null hides it
    click?: boolean;
}

// Ten seconds, split so the two moments that carry the product — the lock and
// the report — get the longest dwell.
const SCENES: Scene[] = [
    { id: 'type', hold: 2000, label: 'Tell it the goal', cursor: { x: 88, y: 89 }, click: true },
    { id: 'plan', hold: 1700, label: 'It builds the week — and says why', cursor: { x: 66, y: 55 } },
    { id: 'lock', hold: 1700, label: "Lock it in. It can't be softened later", cursor: { x: 50, y: 78 }, click: true },
    { id: 'email', hold: 1500, label: "Each morning, today's exact task", cursor: null },
    { id: 'journal', hold: 1400, label: 'Log the day by voice. Keep the streak', cursor: { x: 50, y: 62 }, click: true },
    { id: 'report', hold: 1700, label: 'Week end: done versus promised', cursor: null },
];

const TOTAL = SCENES.reduce((n, s) => n + s.hold, 0); // 10,000ms

const kicker: React.CSSProperties = {
    fontSize: '8.5px', fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
};

export default function ProductDemo({
    fill = false,
    compact = false,
}: {
    /** Stretch to the parent instead of holding a 16:9 box. */
    fill?: boolean;
    compact?: boolean;
}) {
    const [i, setI] = useState(0);
    const reduced = useRef(
        typeof window !== 'undefined'
        && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ).current;

    useEffect(() => {
        // Reduced motion holds on the report — the outcome is the part worth seeing.
        if (reduced) { setI(SCENES.length - 1); return; }
        const t = setTimeout(() => setI(n => (n + 1) % SCENES.length), SCENES[i].hold);
        return () => clearTimeout(t);
    }, [i, reduced]);

    const scene = SCENES[i];
    const pad = compact ? '14px' : '18px 22px';

    const shell: React.CSSProperties = fill
        ? { position: 'absolute', inset: 0, borderRadius: 0, border: 'none', boxShadow: 'none' }
        : {
            position: 'relative',
            aspectRatio: compact ? '3 / 4' : '16 / 9',
            border: '1px solid var(--border-medium)',
            borderRadius: '10px',
            boxShadow: 'var(--shadow-xl)',
        };

    return (
        <div style={{
            width: '100%',
            background: 'var(--card-bg)',
            overflow: 'hidden',
            fontFamily: satoshi,
            display: 'flex',
            flexDirection: 'column',
            ...shell,
        }}>
            {/* Window chrome */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                flexShrink: 0,
            }}>
                {['#ef4444', '#eab308', '#22c55e'].map(c => (
                    <span key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.55 }} />
                ))}
                <span style={{ ...kicker, marginLeft: 'auto' }}>feelivate.com/app</span>
            </div>

            {/* Stage */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
                <div style={{ position: 'absolute', inset: 0, padding: pad, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={scene.id}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9px' }}
                        >
                            {scene.id === 'type' && <TypeScene />}
                            {scene.id === 'plan' && <PlanScene />}
                            {scene.id === 'lock' && <LockScene />}
                            {scene.id === 'email' && <EmailScene />}
                            {scene.id === 'journal' && <JournalScene />}
                            {scene.id === 'report' && <ReportScene />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Pointer */}
                {!reduced && scene.cursor && (
                    <motion.div
                        aria-hidden="true"
                        animate={{ left: `${scene.cursor.x}%`, top: `${scene.cursor.y}%` }}
                        transition={{ type: 'spring', stiffness: 95, damping: 18, mass: 0.9 }}
                        style={{ position: 'absolute', zIndex: 5, pointerEvents: 'none' }}
                    >
                        <AnimatePresence>
                            {scene.click && (
                                <motion.span
                                    key={scene.id}
                                    initial={{ scale: 0, opacity: 0.5 }}
                                    animate={{ scale: 2.6, opacity: 0 }}
                                    transition={{ duration: 0.7, delay: 0.5 }}
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

            {/* Caption + progress — tells the viewer what they just watched. */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', gap: '3px', padding: '0 14px', marginTop: '-1px' }}>
                    {SCENES.map((s, n) => (
                        <div key={s.id} style={{ flex: s.hold, height: '2px', background: 'var(--border-medium)', overflow: 'hidden' }}>
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ scaleX: n < i ? 1 : n === i ? 1 : 0 }}
                                transition={{ duration: n === i ? s.hold / 1000 : 0, ease: 'linear' }}
                                style={{ height: '100%', background: 'var(--accent-warm)', transformOrigin: 'left' }}
                            />
                        </div>
                    ))}
                </div>
                <div style={{ padding: '9px 14px 10px' }}>
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={scene.id}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{
                                margin: 0, fontSize: '11.5px', fontWeight: 600,
                                color: 'var(--text-secondary)', fontFamily: satoshi,
                            }}
                        >
                            {scene.label}
                        </motion.p>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

/* ── Scenes ──────────────────────────────────────────────────────────────── */

function Bubble({ children, mine = false }: { children: React.ReactNode; mine?: boolean }) {
    return (
        <div style={{
            alignSelf: mine ? 'flex-end' : 'flex-start',
            maxWidth: '86%',
            background: mine ? 'var(--btn-primary-bg)' : 'var(--bg-surface)',
            color: mine ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
            border: mine ? 'none' : '1px solid var(--border-subtle)',
            borderRadius: '13px', padding: '9px 13px',
            fontSize: '11.5px', lineHeight: 1.5, fontWeight: 500,
        }}>
            {children}
        </div>
    );
}

function Card({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            border: '1px solid var(--border-medium)', borderRadius: '9px',
            overflow: 'hidden', background: 'var(--bg-primary)',
        }}>
            {children}
        </div>
    );
}

function TypeScene() {
    const [n, setN] = useState(0);
    useEffect(() => {
        const iv = setInterval(() => setN(v => (v >= GOAL.length ? v : v + 1)), 48);
        return () => clearInterval(iv);
    }, []);
    return (
        <>
            <div style={{ flex: 1 }} />
            <Bubble>What do you want to change? Tell me in your own words.</Bubble>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <div style={{
                    flex: 1, minWidth: 0, border: '1px solid var(--input-border)',
                    borderRadius: '100px', padding: '9px 15px', background: 'var(--bg-primary)',
                    fontSize: '11.5px', color: 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden',
                }}>
                    {GOAL.slice(0, n)}
                    <motion.span
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        style={{ display: 'inline-block', width: '1.5px', height: '11px', background: 'var(--accent-warm)', marginLeft: '2px', verticalAlign: 'middle' }}
                    />
                </div>
                <div style={{
                    width: '29px', height: '29px', borderRadius: '50%', flexShrink: 0,
                    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <ArrowUp size={13} strokeWidth={2.5} />
                </div>
            </div>
        </>
    );
}

function PlanScene() {
    return (
        <>
            <Bubble mine>{GOAL}</Bubble>
            <Bubble>Two runs this week, not four — you said you burn out. Habit first.</Bubble>
            <Card>
                <div style={{ padding: '10px 13px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ ...kicker, marginBottom: '3px' }}>Week 1</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                        Build the running habit
                    </div>
                </div>
                {[
                    ['Mon', 'Easy 20-minute walk + 5 min jog'],
                    ['Tue', 'Rest or gentle stretching'],
                    ['Wed', 'Intervals: 1 min jog, 2 min walk × 6'],
                ].map(([d, a], n) => (
                    <div key={d} style={{
                        display: 'flex', gap: '9px', padding: '6px 13px',
                        borderTop: n === 0 ? 'none' : '1px solid var(--border-subtle)',
                    }}>
                        <span style={{ ...kicker, color: 'var(--text-primary)', width: '26px', flexShrink: 0, paddingTop: '2px' }}>{d}</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{a}</span>
                    </div>
                ))}
            </Card>
        </>
    );
}

function LockScene() {
    return (
        <>
            <Bubble>Ready when you are. Once it's locked, it stays as agreed.</Bubble>
            <Card>
                <div style={{ padding: '10px 13px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ ...kicker, marginBottom: '3px' }}>Week 1</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                        Build the running habit
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '7px', padding: '10px 13px' }}>
                    <motion.span
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 0.7, repeat: Infinity }}
                        style={{
                            flex: 1, textAlign: 'center', padding: '8px', borderRadius: '100px',
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                        }}
                    >
                        Let's go
                    </motion.span>
                    <span style={{
                        padding: '8px 15px', borderRadius: '100px',
                        border: '1px solid var(--accent-primary)', color: 'var(--text-primary)',
                        fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}>Tweak</span>
                </div>
            </Card>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, type: 'spring', stiffness: 300, damping: 24 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '9px', alignSelf: 'flex-start',
                    padding: '8px 14px', borderRadius: '100px',
                    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                }}
            >
                <Lock size={11} />
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Week 1 locked
                </span>
            </motion.div>
        </>
    );
}

function EmailScene() {
    return (
        <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '11px 13px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{
                    width: '24px', height: '24px', borderRadius: '7px', flexShrink: 0,
                    background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Mail size={12} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: clash, letterSpacing: '-0.01em' }}>
                        Wednesday · your task
                    </div>
                    <div style={{ ...kicker, marginTop: '2px' }}>7:00 AM · your timezone</div>
                </div>
            </div>
            <div style={{ padding: '12px 13px' }}>
                <div style={{ ...kicker, color: 'var(--accent-warm)', marginBottom: '5px' }}>Today</div>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '5px' }}>
                    Intervals: 1 min jog, 2 min walk × 6
                </div>
                <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                    Easy pace — the goal is to show up, not to race. Lay your shoes out tonight.
                </p>
            </div>
        </Card>
    );
}

function JournalScene() {
    return (
        <>
            <div style={{ ...kicker, marginBottom: '2px' }}>Today's voice log</div>
            <Card>
                <div style={{ padding: '18px 13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <motion.div
                        animate={{ boxShadow: ['0 0 0 0px rgba(217,119,87,0.35)', '0 0 0 14px rgba(217,119,87,0)'] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        style={{
                            width: '42px', height: '42px', borderRadius: '50%',
                            background: 'var(--accent-warm)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Mic size={17} />
                    </motion.div>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '18px' }}>
                        {[0.3, 0.7, 1, 0.5, 0.85, 0.4, 0.65].map((h, n) => (
                            <motion.span
                                key={n}
                                animate={{ scaleY: [h * 0.4, h, h * 0.4] }}
                                transition={{ duration: 0.7, repeat: Infinity, delay: n * 0.08 }}
                                style={{ width: '3px', height: '18px', borderRadius: '2px', background: 'var(--accent-warm)', opacity: 0.75 }}
                            />
                        ))}
                    </div>
                </div>
            </Card>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start',
                padding: '7px 13px', borderRadius: '100px',
                border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
            }}>
                <Flame size={12} style={{ color: 'var(--accent-warm)' }} />
                <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>5-day streak</span>
                <Check size={12} style={{ color: '#10b981' }} />
            </div>
        </>
    );
}

function ReportScene() {
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={kicker}>Week 1 · Report</div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'var(--accent-warm)' }}>
                    <Flame size={11} /> 5-day streak
                </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px' }}>
                {[['86%', 'Consistency', 'var(--text-primary)'], ['6', 'Done', '#10b981'], ['1', 'Missed', '#ef4444']].map(([v, l, c]) => (
                    <div key={l} style={{ padding: '9px 10px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div style={{ fontSize: '17px', fontWeight: 700, color: c, fontFamily: clash, letterSpacing: '-0.03em', lineHeight: 1 }}>{v}</div>
                        <div style={{ ...kicker, marginTop: '3px', fontSize: '8px' }}>{l}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
                {[true, true, true, false, true, true, true].map((done, n) => (
                    <div key={n} style={{
                        flex: 1, height: '22px', borderRadius: '5px',
                        background: done ? 'var(--accent-warm)' : 'var(--border-medium)',
                        opacity: done ? 0.9 : 0.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {done && <Check size={10} style={{ color: '#fff' }} />}
                    </div>
                ))}
            </div>
            <div style={{
                padding: '10px 11px', borderRadius: '8px', display: 'flex', gap: '8px',
                background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)',
            }}>
                <TrendingUp size={13} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                    You skipped Thursday — same as last week. Both evenings you had plans.
                    Week 2 moves that run to the morning.
                </p>
            </div>
        </>
    );
}

export { TOTAL as DEMO_DURATION_MS };
