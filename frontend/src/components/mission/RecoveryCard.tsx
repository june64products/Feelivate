import { motion } from 'framer-motion';
import { Sunrise } from 'lucide-react';
import { clashDisplay, satoshi, easeSilk } from './missionTheme';

interface RecoveryCardProps {
    /** The user's stored "why" (from session detail) — quoted back, their words. */
    commitmentWhy?: string | null;
    /** Yesterday was covered by a shield (streak survived). */
    wasShielded: boolean;
    /** Sends the chip answer to the mentor and opens the drawer. */
    onAnswer: (message: string) => void;
}

const CHIPS = ['No time', 'Low energy', 'Forgot', 'Life happened'];

/**
 * Shown above the Today card the morning after a miss — the product's
 * "don't miss twice" moment, mirroring the recovery email's exact framing.
 */
export default function RecoveryCard({ commitmentWhy, wasShielded, onAnswer }: RecoveryCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: easeSilk as any }}
            style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--accent-warm, #d97757)',
                borderRadius: '20px', padding: '22px 26px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Sunrise size={15} style={{ color: 'var(--accent-warm, #d97757)' }} />
                <span style={{
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.12em',
                    textTransform: 'uppercase', color: 'var(--accent-warm, #d97757)', fontFamily: satoshi,
                }}>
                    {wasShielded ? 'Yesterday slipped · streak shielded' : 'Yesterday slipped'}
                </span>
            </div>

            <p style={{
                fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)',
                margin: '0 0 6px', fontFamily: clashDisplay, letterSpacing: '-0.01em',
            }}>
                One missed day changes nothing.
            </p>
            <p style={{
                fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 14px',
                lineHeight: 1.65, fontFamily: satoshi,
            }}>
                The research is clear — missing twice is what starts a new habit. Today is the only day that matters.
            </p>

            {commitmentWhy && commitmentWhy.trim() && (
                <div style={{
                    borderLeft: '2px solid var(--border-medium)', padding: '4px 0 4px 14px',
                    margin: '0 0 16px',
                }}>
                    <p style={{
                        fontSize: '14px', fontStyle: 'italic', color: 'var(--text-primary)',
                        margin: '0 0 4px', lineHeight: 1.6, fontFamily: satoshi,
                    }}>
                        “{commitmentWhy.trim()}”
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: satoshi }}>
                        — you, when you started
                    </p>
                </div>
            )}

            <p style={{
                fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
                margin: '0 0 8px', fontFamily: satoshi,
            }}>
                What got in the way?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {CHIPS.map(chip => (
                    <motion.button
                        key={chip}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onAnswer(
                            `Yesterday I missed my task — the reason: ${chip.toLowerCase()}. ` +
                            `Help me make sure I don't miss twice. If the plan's timing is the problem, suggest how to adjust my if-then for the rest of this week (without changing the locked plan).`
                        )}
                        style={{
                            padding: '8px 14px', borderRadius: '100px',
                            border: '1px solid var(--border-medium)', background: 'transparent',
                            color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: satoshi,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                        {chip}
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );
}
