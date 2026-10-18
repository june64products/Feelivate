import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays } from 'lucide-react';
import StartDatePicker from './StartDatePicker';
import { clashDisplay, satoshi } from './missionTheme';
import { localISODate, rollWeekendStart } from '../../lib/weekWindow';
import { useWindowSize } from '../../hooks/useWindowSize';

interface NextWeekStartModalProps {
    week: number;
    /** The first day this week may begin (the day after the current week's Sunday). */
    earliest: string;
    onConfirm: (startDate: string) => void;
    onClose: () => void;
}

/**
 * "Week N — when do you start?" Asked BEFORE the mentor drafts the week, the
 * same way the first week is asked with the setup answers, so the plan is
 * written for the days it will actually run and not re-stamped at lock time.
 */
export default function NextWeekStartModal({ week, earliest, onConfirm, onClose }: NextWeekStartModalProps) {
    const today = localISODate();
    const [startDate, setStartDate] = useState<string>(() => rollWeekendStart(earliest > today ? earliest : today));
    const { isMobile } = useWindowSize();

    return (
        <div
            role="dialog"
            aria-labelledby="next-week-start-title"
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0,
                background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
            }}
        >
            <motion.div
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.94, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                style={{
                    width: '100%', maxWidth: '480px', maxHeight: '84vh', overflowY: 'auto',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--modal-border)',
                    borderRadius: '20px', padding: isMobile ? '22px 20px' : '28px 26px',
                    boxShadow: 'var(--shadow-lg)', fontFamily: satoshi,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: 'var(--btn-primary-bg)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <CalendarDays size={16} style={{ color: 'var(--btn-primary-text)' }} />
                    </div>
                    <h3 id="next-week-start-title" style={{
                        fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
                        margin: 0, fontFamily: clashDisplay, letterSpacing: '-0.01em',
                    }}>
                        Week {week}: when do you start?
                    </h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px' }}>
                    Your mentor builds Week {week} for exactly these days, from the day you pick to its Sunday, with a task on each. Pick the day you'll actually be ready.
                </p>

                <div style={{ margin: isMobile ? '0 -20px' : '0 -26px' }}>
                    <StartDatePicker isFirstPlan={false} earliest={earliest} value={startDate} onChange={setStartDate} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onConfirm(startDate)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '13px 24px', borderRadius: '100px', border: 'none',
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
                            width: '100%', justifyContent: 'center',
                        }}
                    >
                        Build Week {week}
                        <ArrowRight size={14} />
                    </motion.button>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '10px', borderRadius: '100px', border: 'none', background: 'none',
                            color: 'var(--text-secondary)', fontSize: '12.5px', cursor: 'pointer', fontFamily: satoshi,
                        }}
                    >
                        Not now
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
