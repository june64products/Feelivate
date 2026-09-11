import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion, AnimatePresence } from 'framer-motion';
import { Check, Flame } from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/**
 * Motion for the home hero.
 *
 * Rules that keep it safe on a first product:
 *   • Only transform and opacity animate. Nothing here changes layout, so text
 *     never jumps, images never reflow and Lighthouse's CLS stays at zero.
 *   • Everything runs once on load or once on scroll-in. Nothing loops forever
 *     except the ambient glow, which is a single slow transform on one layer.
 *   • prefers-reduced-motion turns every entrance into a plain fade and stops
 *     the glow and the tilt. The page is identical at rest either way.
 *   • The tilt only listens to a real pointer (mouse or pen). Touch never tilts.
 */

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* When the preview card starts landing (seconds from mount). The text column's
   timings live in HomePage next to the markup they sequence. */
const CARD_DELAY = 0.35;

/* ── Headline: words rise out of a clipped line, one after another ─────────── */

interface WordsProps {
    text: string;
    /** A word rendered in the italic serif, e.g. "actually". Matched exactly. */
    accent?: string;
    delay?: number;
    style?: CSSProperties;
    as?: 'h1' | 'h2' | 'p';
}

export function Words({ text, accent, delay = 0, style, as = 'h1' }: WordsProps) {
    const reduced = useReducedMotion();
    const Tag = motion[as];
    const words = text.split(' ');
    return (
        <Tag
            style={style}
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: reduced ? 0 : 0.055, delayChildren: delay } } }}
            aria-label={text}
        >
            {words.map((w, n) => {
                const isAccent = accent != null && w.replace(/[.,!?]/g, '') === accent;
                return (
                    <span
                        key={n}
                        aria-hidden="true"
                        style={{
                            display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom',
                            // Room for descenders: a clipped "y" or "g" looks like a bug.
                            paddingBottom: '0.12em', marginBottom: '-0.12em',
                            paddingRight: n < words.length - 1 ? '0.22em' : 0,
                        }}
                    >
                        <motion.span
                            variants={{
                                hidden: reduced ? { opacity: 0 } : { y: '108%', opacity: 0 },
                                show: { y: 0, opacity: 1, transition: { duration: reduced ? 0.4 : 0.85, ease: EASE_OUT } },
                            }}
                            style={{
                                display: 'inline-block',
                                ...(isAccent ? { fontStyle: 'italic', fontFamily: "'Georgia', serif", fontWeight: 400, color: 'var(--text-secondary)' } : null),
                            }}
                        >
                            {w}
                        </motion.span>
                    </span>
                );
            })}
        </Tag>
    );
}

/* ── Rise: the standard fade-up for everything that is not the headline ────── */

export function Rise({ children, delay = 0, y = 18, style, once = true, inView = false, amount = 0.3 }: {
    children: ReactNode; delay?: number; y?: number; style?: CSSProperties;
    /** Animate when scrolled into view instead of on mount. */
    inView?: boolean; once?: boolean; amount?: number;
}) {
    const reduced = useReducedMotion();
    const hidden = reduced ? { opacity: 0 } : { opacity: 0, y };
    const shown = { opacity: 1, y: 0 };
    const transition = { duration: reduced ? 0.4 : 0.8, delay, ease: EASE_OUT };
    return inView ? (
        <motion.div initial={hidden} whileInView={shown} viewport={{ once, amount }} transition={transition} style={style}>
            {children}
        </motion.div>
    ) : (
        <motion.div initial={hidden} animate={shown} transition={transition} style={style}>
            {children}
        </motion.div>
    );
}

/* ── Scale-in for a large media block (the walkthrough) ────────────────────── */

export function MediaReveal({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: CSSProperties }) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 32, scale: 0.965 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reduced ? 0.4 : 0.95, delay, ease: EASE_OUT }}
            style={style}
        >
            {children}
        </motion.div>
    );
}

/* ── Tilt: the card follows a mouse by a few degrees, with a spring ────────── */

export function TiltCard({ children, max = 5, style }: { children: ReactNode; max?: number; style?: CSSProperties }) {
    const reduced = useReducedMotion();
    const px = useMotionValue(0);   // -0.5 .. 0.5 across the card
    const py = useMotionValue(0);
    const spring = { stiffness: 140, damping: 18, mass: 0.6 };
    const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [max, -max]), spring);
    const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-max, max]), spring);
    // A highlight that slides opposite to the tilt, so the card reads as lit.
    const glareX = useTransform(px, [-0.5, 0.5], ['20%', '80%']);
    const glareY = useTransform(py, [-0.5, 0.5], ['20%', '80%']);
    const glare = useTransform([glareX, glareY], ([x, y]) =>
        `radial-gradient(420px circle at ${x} ${y}, color-mix(in srgb, var(--text-primary) 5%, transparent), transparent 60%)`);

    const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (reduced || e.pointerType === 'touch') return;
        const r = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width - 0.5);
        py.set((e.clientY - r.top) / r.height - 0.5);
    };
    const onLeave = () => { px.set(0); py.set(0); };

    return (
        <div style={{ perspective: '1100px', ...style }}>
            <motion.div
                onPointerMove={onMove}
                onPointerLeave={onLeave}
                style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY, transformStyle: 'preserve-3d', position: 'relative' }}
            >
                {children}
                {!reduced && (
                    <motion.div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: glare, pointerEvents: 'none' }} />
                )}
            </motion.div>
        </div>
    );
}

/* ── Ambient glow behind the hero ──────────────────────────────────────────── */

export function AmbientGlow() {
    const reduced = useReducedMotion();
    const blob = (color: string, size: number, extra: CSSProperties): CSSProperties => ({
        position: 'absolute', width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}, transparent 65%)`,
        filter: 'blur(18px)', ...extra,
    });
    const warm = 'color-mix(in srgb, var(--accent-warm) 22%, transparent)';
    const ink = 'color-mix(in srgb, var(--text-primary) 6%, transparent)';
    return (
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
            <motion.div
                animate={reduced ? undefined : { x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
                style={blob(warm, 640, { top: '-18%', right: '-8%' })}
            />
            <motion.div
                animate={reduced ? undefined : { x: [0, -30, 25, 0], y: [0, 25, -15, 0] }}
                transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
                style={blob(ink, 520, { bottom: '10%', left: '-10%' })}
            />
            {/* Fine dot grid, fading out toward the bottom so the media sits on plain ground. */}
            <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: 'radial-gradient(color-mix(in srgb, var(--text-primary) 9%, transparent) 1px, transparent 1px)',
                backgroundSize: '26px 26px',
                maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)',
                WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.9), rgba(0,0,0,0) 70%)',
            }} />
        </div>
    );
}

/* ── Kicker with a live dot ────────────────────────────────────────────────── */

export function LiveKicker({ children }: { children: ReactNode }) {
    const reduced = useReducedMotion();
    return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>
            <span style={{ position: 'relative', width: '7px', height: '7px', flexShrink: 0 }}>
                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-warm)' }} />
                {!reduced && (
                    <motion.span
                        animate={{ scale: [1, 2.6], opacity: [0.55, 0] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-warm)' }}
                    />
                )}
            </span>
            {children}
        </span>
    );
}

/* ── The hero preview card, alive: rows land, then today's task gets done ──── */

const ROWS = [
    { d: 'Mon', t: 'Meal prep + grocery run' },
    { d: 'Tue', t: '20-minute walk' },
    { d: 'Wed', t: '30-minute morning run' },
];

export function HeroPreviewCard({ isMobile }: { isMobile: boolean }) {
    const reduced = useReducedMotion();
    // Wednesday flips to done a beat after the card settles. One time, not a loop:
    // a card that keeps checking itself off looks like a screensaver.
    const [wedDone, setWedDone] = useState(!!reduced);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (reduced) return;
        timer.current = window.setTimeout(() => setWedDone(true), 2300);
        return () => window.clearTimeout(timer.current);
    }, [reduced]);

    const streak = wedDone ? 4 : 3;

    return (
        <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 28, rotateX: 8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: reduced ? 0.4 : 1, delay: CARD_DELAY, ease: EASE_OUT }}
            style={{
                border: '1px solid var(--border-medium)', borderRadius: '10px',
                background: 'var(--card-bg)', padding: isMobile ? '18px' : '22px',
                boxShadow: 'var(--shadow-xl)', transformStyle: 'preserve-3d',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>Week 1 · Wednesday</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--accent-warm)', fontFamily: satoshi }}>
                    <motion.span
                        key={streak}
                        initial={reduced ? false : { scale: 1 }}
                        animate={wedDone && !reduced ? { scale: [1, 1.45, 1], rotate: [0, -12, 0] } : undefined}
                        transition={{ duration: 0.6, ease: EASE_OUT }}
                        style={{ display: 'inline-flex' }}
                    >
                        <Flame size={13} />
                    </motion.span>
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        <span style={{ display: 'inline-block', overflow: 'hidden', height: '14px', lineHeight: '14px', verticalAlign: 'bottom' }}>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span
                                    key={streak}
                                    initial={reduced ? { opacity: 0 } : { y: 14, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={reduced ? { opacity: 0 } : { y: -14, opacity: 0 }}
                                    transition={{ duration: 0.4, ease: EASE_OUT }}
                                    style={{ display: 'inline-block' }}
                                >
                                    {streak}
                                </motion.span>
                            </AnimatePresence>
                        </span>
                        <span>-day streak</span>
                    </span>
                </span>
            </div>

            <motion.div
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: CARD_DELAY + 0.35, ease: EASE_OUT }}
                style={{ border: '1px solid var(--border-subtle)', borderRadius: '7px', padding: '16px', marginBottom: '14px', background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden' }}
            >
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-warm)', fontFamily: satoshi }}>Today's task</span>
                <h3 style={{ fontSize: '17px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', margin: '8px 0 6px', color: 'var(--text-primary)' }}>30-minute morning run</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, fontFamily: satoshi, fontWeight: 500, margin: 0 }}>Easy pace — the goal is to show up, not to race. Lay your shoes out tonight.</p>
                <AnimatePresence>
                    {wedDone && (
                        <motion.span
                            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, x: 8 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                            style={{
                                position: 'absolute', top: '14px', right: '14px',
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: '4px 9px', borderRadius: '100px',
                                background: 'var(--accent-warm)', color: '#fff',
                                fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: satoshi,
                            }}
                        >
                            <Check size={10} strokeWidth={3} /> Done
                        </motion.span>
                    )}
                </AnimatePresence>
            </motion.div>

            {ROWS.map((row, n) => {
                const done = n < 2 || wedDone;
                return (
                    <motion.div
                        key={row.d}
                        initial={reduced ? { opacity: 0 } : { opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.55, delay: CARD_DELAY + 0.5 + n * 0.1, ease: EASE_OUT }}
                        style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 0', borderTop: '1px solid var(--border-subtle)' }}
                    >
                        <motion.span
                            animate={{
                                background: done ? 'var(--accent-warm)' : 'rgba(0,0,0,0)',
                                borderColor: done ? 'var(--accent-warm)' : 'var(--border-focus)',
                                scale: n === 2 && wedDone && !reduced ? [1, 1.3, 1] : 1,
                            }}
                            transition={{ duration: 0.45, ease: EASE_OUT }}
                            style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                            <AnimatePresence>
                                {done && (
                                    <motion.span
                                        initial={n === 2 && !reduced ? { scale: 0, opacity: 0 } : false}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 24, delay: 0.1 }}
                                        style={{ display: 'inline-flex' }}
                                    >
                                        <Check size={11} style={{ color: '#fff' }} />
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </motion.span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: satoshi, width: '30px' }}>{row.d}</span>
                        <span style={{ position: 'relative', fontSize: '13px', color: done ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: satoshi, fontWeight: 500, transition: 'color 0.4s' }}>
                            {row.t}
                            {/* Strike-through drawn left to right instead of appearing at once. */}
                            <motion.span
                                aria-hidden="true"
                                initial={false}
                                animate={{ scaleX: done ? 1 : 0 }}
                                transition={{ duration: n === 2 ? 0.45 : 0, ease: EASE_OUT, delay: n === 2 ? 0.15 : 0 }}
                                style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: '1px', background: 'var(--text-muted)', transformOrigin: 'left' }}
                            />
                        </span>
                    </motion.div>
                );
            })}
        </motion.div>
    );
}

/* ── Buttons that respond ──────────────────────────────────────────────────── */

export function Pressable({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    const reduced = useReducedMotion();
    return (
        <motion.div
            whileHover={reduced ? undefined : { y: -2 }}
            whileTap={reduced ? undefined : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            style={{ display: 'inline-flex', ...style }}
        >
            {children}
        </motion.div>
    );
}
