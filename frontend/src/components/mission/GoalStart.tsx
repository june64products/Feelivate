import { motion } from 'framer-motion';
import RadiantPromptInput from '../chat/RadiantPromptInput';
import { clashDisplay, satoshi, easeSilk } from './missionTheme';

interface GoalStartProps {
    onSubmit: (text: string) => void;
    disabled: boolean;
    demoMode?: boolean;
}

const SUGGESTIONS = [
    'I want to get fit',
    'Help me quit smoking',
    'Learn coding, for real this time',
    'Exam prep without burning out',
];

/**
 * The very first screen of a goal — a single question, not a chat thread.
 * Submitting starts the same handleSendMessage flow as always; the setup
 * questions popup takes it from there.
 */
export default function GoalStart({ onSubmit, disabled, demoMode = false }: GoalStartProps) {
    return (
        <motion.div
            key="goal-start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -18 }}
            transition={{ duration: 0.5, ease: easeSilk as any }}
            style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '24px 20px', gap: '0',
            }}
        >
            <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.08, ease: easeSilk as any }}
                style={{ textAlign: 'center', marginBottom: '34px' }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', marginBottom: '20px',
                }}>
                    <div style={{
                        width: '38px', height: '38px', background: 'var(--accent-primary)',
                        borderRadius: '10px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', overflow: 'hidden',
                    }}>
                        <img
                            src="/logo_2_backup.png"
                            alt="Feelivate"
                            style={{ width: '26px', height: '26px', objectFit: 'contain', filter: 'var(--logo-filter)' }}
                        />
                    </div>
                    <h1 style={{
                        fontSize: '26px', fontWeight: 700, letterSpacing: '0.08em',
                        color: 'var(--text-primary)', margin: 0, fontFamily: clashDisplay,
                        textTransform: 'uppercase',
                    }}>
                        Feelivate
                    </h1>
                </div>
                <h2 style={{
                    fontSize: '30px', fontWeight: 600, color: 'var(--text-primary)',
                    letterSpacing: '-0.02em', margin: '0 0 10px', lineHeight: 1.25,
                    fontFamily: clashDisplay,
                }}>
                    What do you want to change?
                </h2>
                <p style={{
                    fontSize: '14px', color: 'var(--text-secondary)', margin: 0,
                    fontFamily: satoshi, lineHeight: 1.6,
                }}>
                    Say it once. Your mentor turns it into a week you can actually keep.
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.2, ease: easeSilk as any }}
                style={{ width: '100%', maxWidth: '680px', marginBottom: '26px' }}
            >
                <RadiantPromptInput
                    onSubmit={demoMode ? () => { } : onSubmit}
                    disabled={disabled}
                    placeholder="I keep starting and quitting… this time I want to…"
                />
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease: easeSilk as any }}
                style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}
            >
                {SUGGESTIONS.map(s => (
                    <button
                        key={s}
                        onClick={() => !demoMode && !disabled && onSubmit(s)}
                        style={{
                            padding: '9px 16px', borderRadius: '100px',
                            border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
                            color: 'var(--text-secondary)', fontSize: '12.5px', fontWeight: 500,
                            fontFamily: satoshi, cursor: 'pointer', letterSpacing: '0.02em',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; }}
                    >
                        {s}
                    </button>
                ))}
            </motion.div>
        </motion.div>
    );
}
