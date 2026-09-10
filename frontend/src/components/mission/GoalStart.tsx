import { motion } from 'framer-motion';
import { Dumbbell, Leaf, Code, GraduationCap, MessageCircle, Lock, Flame, ArrowRight } from 'lucide-react';
import RadiantPromptInput from '../chat/RadiantPromptInput';
import { clashDisplay, satoshi, easeSilk } from './missionTheme';

interface GoalStartProps {
    onSubmit: (text: string) => void;
    disabled: boolean;
    demoMode?: boolean;
}

const SUGGESTIONS = [
    { icon: Dumbbell, label: 'I want to get fit', prompt: 'I want to get fit' },
    { icon: Leaf, label: 'Help me quit smoking', prompt: 'Help me quit smoking' },
    { icon: Code, label: 'Learn coding, for real', prompt: 'Learn coding, for real this time' },
    { icon: GraduationCap, label: 'Exam prep, no burnout', prompt: 'Exam prep without burning out' },
];

const HOW_IT_WORKS = [
    { icon: MessageCircle, label: 'Say your goal' },
    { icon: Lock, label: 'Commit to one week' },
    { icon: Flame, label: 'Show up daily' },
];

/**
 * The very first screen of a goal — a single question, not a chat thread.
 * Submitting starts the same handleSendMessage flow as always; the setup
 * questions popup takes it from there.
 */
export default function GoalStart({ onSubmit, disabled, demoMode = false }: GoalStartProps) {
    const firstName = (localStorage.getItem('user_name') || '').split(' ')[0];

    return (
        <motion.div
            key="goal-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, ease: easeSilk as any }}
            style={{
                minHeight: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '32px 20px 24px', position: 'relative', overflow: 'hidden',
            }}
        >
            {/* Ambient depth — theme-adaptive glow behind the hero, so the page
                reads as a lit stage instead of a flat void. */}
            <div style={{
                position: 'absolute', top: '4%', left: '50%', transform: 'translateX(-50%)',
                width: 'min(760px, 92vw)', height: '420px', pointerEvents: 'none',
                background: 'radial-gradient(closest-side, var(--glass-hover), transparent 72%)',
            }} />

            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.06, ease: easeSilk as any }}
                style={{ textAlign: 'center', marginBottom: '30px', position: 'relative' }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', marginBottom: '26px',
                }}>
                    <motion.div
                        initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                        style={{
                            width: '38px', height: '38px', background: 'var(--accent-primary)',
                            borderRadius: '10px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', overflow: 'hidden',
                        }}
                    >
                        <img
                            src="/logo_2_backup.png"
                            alt="Feelivate"
                            style={{ width: '26px', height: '26px', objectFit: 'contain', filter: 'var(--logo-filter)' }}
                        />
                    </motion.div>
                    <h1 style={{
                        fontSize: '25px', fontWeight: 700, letterSpacing: '0.09em',
                        color: 'var(--text-primary)', margin: 0, fontFamily: clashDisplay,
                        textTransform: 'uppercase',
                    }}>
                        Feelivate
                    </h1>
                </div>

                {firstName && (
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.25, duration: 0.5 }}
                        style={{
                            fontSize: '13px', fontWeight: 600, letterSpacing: '0.14em',
                            textTransform: 'uppercase', color: 'var(--text-muted)',
                            margin: '0 0 12px', fontFamily: satoshi,
                        }}
                    >
                        Hi {firstName}
                    </motion.p>
                )}

                {/* Word-staggered headline */}
                <h2 style={{
                    fontSize: 'clamp(30px, 4.5vw, 40px)', fontWeight: 600,
                    color: 'var(--text-primary)', letterSpacing: '-0.02em',
                    margin: '0 0 12px', lineHeight: 1.2, fontFamily: clashDisplay,
                }}>
                    {'What do you want to change?'.split(' ').map((word, i) => (
                        <motion.span
                            key={i}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18 + i * 0.06, duration: 0.5, ease: easeSilk as any }}
                            style={{ display: 'inline-block', marginRight: '0.24em' }}
                        >
                            {word}
                        </motion.span>
                    ))}
                </h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.55, duration: 0.5 }}
                    style={{
                        fontSize: '14.5px', color: 'var(--text-secondary)', margin: 0,
                        fontFamily: satoshi, lineHeight: 1.6,
                    }}
                >
                    Say it once. Your mentor turns it into a week you can actually keep.
                </motion.p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.65, delay: 0.3, ease: easeSilk as any }}
                style={{ width: '100%', maxWidth: '680px', marginBottom: '28px', position: 'relative' }}
            >
                <RadiantPromptInput
                    onSubmit={demoMode ? () => { } : onSubmit}
                    disabled={disabled}
                    placeholder="I keep starting and quitting… this time I want to…"
                />
            </motion.div>

            {/* Goal cards — icons give the choices weight; hover lifts */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center',
                maxWidth: '720px', position: 'relative', marginBottom: '44px',
            }}>
                {SUGGESTIONS.map((s, i) => (
                    <motion.button
                        key={s.label}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.45 + i * 0.07, duration: 0.5, ease: easeSilk as any }}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => !demoMode && !disabled && onSubmit(s.prompt)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '11px 18px 11px 12px', borderRadius: '100px',
                            border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
                            color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600,
                            fontFamily: satoshi, cursor: 'pointer', letterSpacing: '0.01em',
                            boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--accent-primary)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border-medium)';
                            e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <span style={{
                            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                            background: 'var(--glass-hover)', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <s.icon size={15} style={{ color: 'var(--accent-primary)' }} />
                        </span>
                        {s.label}
                    </motion.button>
                ))}
            </div>

            {/* How it works — quiet, fills the void with the product's promise */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85, duration: 0.6, ease: easeSilk as any }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
                    justifyContent: 'center', position: 'relative',
                }}
            >
                {HOW_IT_WORKS.map((st, i) => (
                    <div key={st.label} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)',
                            fontFamily: satoshi,
                        }}>
                            <st.icon size={14} style={{ color: 'var(--text-muted)' }} />
                            {st.label}
                        </span>
                        {i < HOW_IT_WORKS.length - 1 && (
                            <ArrowRight size={12} style={{ color: 'var(--border-medium)' }} />
                        )}
                    </div>
                ))}
            </motion.div>
        </motion.div>
    );
}
