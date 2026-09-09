import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sunrise, Check } from 'lucide-react';
import { getRecoveryMotivation, submitSlipReason, getLocalISODate } from '../../api';
import { clashDisplay, satoshi, easeSilk } from './missionTheme';

interface RecoveryCardProps {
    /** Consecutive scheduled days missed, walking back from yesterday. */
    missCount: number;
    /** ISO date of the most recent missed day (yesterday). */
    missedDateIso: string;
    /** The user's stored "why" (from session detail) — quoted back, their words. */
    commitmentWhy?: string | null;
    /** Yesterday was covered by a shield (streak survived). */
    wasShielded: boolean;
    /** The goal — makes the generated line land personally. */
    focus?: string;
    sessionId?: string | null;
}

const CHIPS = ['No time', 'Low energy', 'Forgot', 'Life happened'];

const COUNT_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

function headingFor(missCount: number): string {
    if (missCount <= 1) return 'One missed day changes nothing.';
    if (missCount === 2) return 'Two quiet days — today is the comeback.';
    const w = COUNT_WORDS[missCount] || String(missCount);
    return `${w} days quiet — the door is still open.`;
}

/**
 * Shown above the Today card the morning after a real scheduled-day miss.
 * The motivational line is generated fresh (cached per local day), and the
 * "what got in the way" chips store the reason for the WEEKLY REPORT — they
 * never message the mentor, which used to send it off renegotiating the plan.
 */
export default function RecoveryCard({
    missCount, missedDateIso, commitmentWhy, wasShielded, focus, sessionId,
}: RecoveryCardProps) {
    const [line, setLine] = useState<string>('');
    const [savedReason, setSavedReason] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // One generated line per local day per miss-count — fresh every alert,
    // never a repeat mid-day, never a second API call on re-render.
    useEffect(() => {
        const key = `recovery_line_${getLocalISODate()}_${missCount}`;
        const cached = localStorage.getItem(key);
        if (cached) { setLine(cached); return; }
        let alive = true;
        getRecoveryMotivation(missCount, focus)
            .then(res => {
                if (!alive || !res.line) return;
                localStorage.setItem(key, res.line);
                setLine(res.line);
            })
            .catch(() => {
                if (alive) setLine('One lapse never broke a habit. Walking away did — and you just walked back in.');
            });
        return () => { alive = false; };
    }, [missCount, focus]);

    // A reason already chosen today survives reloads.
    useEffect(() => {
        const saved = localStorage.getItem(`slip_reason_${missedDateIso}`);
        if (saved) setSavedReason(saved);
    }, [missedDateIso]);

    const pickReason = async (chip: string) => {
        if (saving || savedReason) return;
        setSaving(true);
        try {
            await submitSlipReason(missedDateIso, chip.toLowerCase(), sessionId);
            localStorage.setItem(`slip_reason_${missedDateIso}`, chip);
            setSavedReason(chip);
        } catch (e) {
            console.error('Slip reason save failed:', e);
        } finally {
            setSaving(false);
        }
    };

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
                    {missCount <= 1
                        ? (wasShielded ? 'Yesterday slipped · streak shielded' : 'Yesterday slipped')
                        : `${missCount} days missed`}
                </span>
            </div>

            <p style={{
                fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)',
                margin: '0 0 6px', fontFamily: clashDisplay, letterSpacing: '-0.01em',
            }}>
                {headingFor(missCount)}
            </p>

            <AnimatePresence mode="wait">
                {line && (
                    <motion.p
                        key={line}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: easeSilk as any }}
                        style={{
                            fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 0 14px',
                            lineHeight: 1.65, fontFamily: satoshi,
                        }}
                    >
                        {line}
                    </motion.p>
                )}
            </AnimatePresence>

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

            <AnimatePresence mode="wait">
                {savedReason ? (
                    <motion.div
                        key="noted"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '9px 16px', borderRadius: '100px',
                            background: 'var(--glass-hover)', border: '1px solid var(--border-subtle)',
                            fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)',
                            fontFamily: satoshi,
                        }}
                    >
                        <Check size={14} style={{ color: 'var(--accent-primary)' }} />
                        Noted — “{savedReason}”. It'll shape your week report.
                    </motion.div>
                ) : (
                    <motion.div key="chips" exit={{ opacity: 0, y: -6 }}>
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
                                    disabled={saving}
                                    onClick={() => pickReason(chip)}
                                    style={{
                                        padding: '8px 14px', borderRadius: '100px',
                                        border: '1px solid var(--border-medium)', background: 'transparent',
                                        color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                                        cursor: saving ? 'wait' : 'pointer', fontFamily: satoshi,
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    {chip}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
