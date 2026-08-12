import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Calendar, ChevronDown, ChevronUp, ArrowRight, AlertTriangle } from 'lucide-react';
import { useWindowSize } from '../../hooks/useWindowSize';
import ConfirmDialog from '../workspace/ConfirmDialog';
import { projectedWeekWindow, daysBetween, formatDay, localISODate } from '../../lib/weekWindow';
import { useExpandableDay, CLAMP_CHARS } from '../../lib/useExpandableDay';

const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/** A plan left unlocked longer than this is worth a second look before it starts. */
const STALE_AFTER_DAYS = 7;

interface PlanDay {
    day: string;
    action: string;
}

interface PlanData {
    week_number: number;
    week_label: string;
    theme: string;
    win_condition: string;
    days: PlanDay[];
    /** Stamped by the backend when the plan was built. Absent on older plans. */
    generated_date?: string;
}

interface PlanCardProps {
    plan: PlanData;
    onApprove: () => void;
    onRequestChange: (feedback: string) => void;
    isApproved: boolean;
    /** First plan of the session — it may start short on purpose (see Week 0). */
    isFirstPlan?: boolean;
}

export default function PlanCard({ plan, onApprove, onRequestChange, isApproved, isFirstPlan = false }: PlanCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [approveAnimation, setApproveAnimation] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const { isMobile } = useWindowSize();
    const { openDay, setOpenDay, openRef } = useExpandableDay();

    // Where this week lands if locked right now, and how long the plan has been
    // sitting unlocked. The week starts on the lock day, so a plan built weeks
    // ago is about to be stretched over a completely different set of dates.
    const today = localISODate();
    const window_ = projectedWeekWindow(today, isFirstPlan);
    const planAge = plan.generated_date ? daysBetween(plan.generated_date, today) : 0;
    const isStale = planAge >= STALE_AFTER_DAYS;

    const windowLine = window_.startsLater
        ? `This week starts ${formatDay(window_.start)} and runs to ${formatDay(window_.end)} — ${window_.dayCount} days. Locking today reserves it; the journal opens on ${formatDay(window_.start)}.`
        : `This week runs ${formatDay(window_.start)} → ${formatDay(window_.end)} — ${window_.dayCount} days. Days before today won't appear in your journal.`;

    const handleRebuild = () => {
        setShowConfirm(false);
        onRequestChange(
            `it was built ${planAge} days ago and is out of date — please rebuild Week ${plan.week_number} from scratch for ${window_.dayCount} days starting ${window_.start}, based on where I am now.`
        );
    };

    const handleApprove = () => {
        setApproveAnimation(true);
        setTimeout(() => {
            setIsCollapsed(true);
            onApprove();
        }, 600);
    };

    // Collapsed pill at top — click to expand
    if (isCollapsed || isApproved) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 18px',
                    background: 'var(--btn-primary-bg)',
                    border: 'none',
                    borderRadius: '100px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    margin: '12px 0',
                }}
            >
                <div style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Calendar size={11} style={{ color: 'var(--btn-primary-text)' }} />
                </div>
                <span style={{
                    flex: 1, fontSize: '12px', fontWeight: 700,
                    color: 'var(--btn-primary-text)',
                    fontFamily: satoshi,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                }}>
                    Week {plan.week_number} Active — {plan.week_label}
                </span>
                {isApproved && !isCollapsed ? (
                    <ChevronUp size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                ) : (
                    <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.5)' }} />
                )}
            </motion.div>
        );
    }

    // Full plan card — Swiss Tabular Layout
    return (
        <>
        <motion.div
            className={approveAnimation ? 'plan-float-up' : 'plan-slide-in'}
            style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--modal-border)',
                borderRadius: '16px',
                overflow: 'hidden',
                margin: '16px 0',
                boxShadow: 'var(--shadow-md)',
                position: 'relative',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                <div style={{
                    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    fontFamily: satoshi, marginBottom: '6px',
                }}>
                    Week {plan.week_number}
                </div>
                <div style={{
                    fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)',
                    fontFamily: clashDisplay, letterSpacing: '-0.03em',
                    lineHeight: 1.1, marginBottom: '8px',
                }}>
                    {plan.theme}
                </div>
                {/* Older plans were stored without these, and a bare "Win:" with
                    nothing after it reads as a broken card. */}
                {plan.win_condition?.trim() && (
                    <div style={{
                        fontSize: '13px', color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                        fontFamily: "'Georgia', 'Times New Roman', serif",
                        lineHeight: 1.4,
                    }}>
                        Win: {plan.win_condition}
                    </div>
                )}
            </div>

            {/* Days — tabular, and any long day opens out in place. Same
                behaviour as the week drawer, so a day reads the same whether
                you meet it in chat or reopen it from an old session. */}
            <div style={{ padding: '4px 0' }}>
                {plan.days.map((day, idx) => {
                    const action = String(day.action ?? '');
                    const isLong = action.length > CLAMP_CHARS;
                    const isOpen = openDay === idx;

                    return (
                        <motion.div
                            key={idx}
                            ref={isOpen ? openRef : undefined}
                            layout
                            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.7 }}
                            onClick={() => { if (isLong) setOpenDay(isOpen ? null : idx); }}
                            style={{
                                display: 'flex',
                                flexDirection: (isMobile || isOpen) ? 'column' : 'row',
                                gap: (isMobile || isOpen) ? '8px' : '0',
                                padding: isOpen ? '18px 22px' : isMobile ? '16px 20px' : '14px 24px',
                                borderBottom: idx < plan.days.length - 1
                                    ? '1px solid var(--border-subtle)'
                                    : 'none',
                                cursor: isLong ? 'pointer' : 'default',
                                position: 'relative',
                                zIndex: isOpen ? 2 : 1,
                                background: isOpen
                                    ? 'var(--bg-surface)'
                                    : idx % 2 === 1 ? 'var(--glass-surface)' : 'transparent',
                                boxShadow: isOpen ? 'var(--shadow-lg)' : 'none',
                                borderRadius: isOpen ? '12px' : 0,
                                margin: isOpen ? '6px' : 0,
                            }}
                        >
                            <motion.div layout="position" style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: isOpen ? 'var(--accent-warm)' : 'var(--text-primary)',
                                fontFamily: clashDisplay,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                minWidth: (isMobile || isOpen) ? undefined : '110px',
                                flexShrink: 0,
                                paddingTop: '2px',
                            }}>
                                {day.day}
                            </motion.div>

                            <motion.div layout="position" style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: isOpen ? '14px' : '13px',
                                color: isOpen ? 'var(--text-primary)' : 'var(--text-secondary)',
                                lineHeight: isOpen ? 1.75 : 1.6,
                                fontFamily: satoshi,
                                fontWeight: 400,
                                wordBreak: 'break-word',
                                ...(isOpen || !isLong ? {} : {
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical' as const,
                                    overflow: 'hidden',
                                }),
                            }}>
                                {action}
                            </motion.div>

                            {isLong && (
                                <motion.div layout="position" style={{
                                    fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
                                    textTransform: 'uppercase', fontFamily: satoshi,
                                    color: 'var(--accent-warm)', flexShrink: 0,
                                    alignSelf: 'flex-start', whiteSpace: 'nowrap',
                                }}>
                                    {isOpen ? 'Show less' : 'See more'}
                                </motion.div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Actions — Swiss pill buttons */}
            <div data-tour="plan-actions" style={{
                padding: '16px 24px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '10px',
            }}>
                <button
                    data-tour="lets-go"
                    onClick={() => setShowConfirm(true)}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 20px',
                        borderRadius: '100px',
                        border: 'none',
                        background: 'var(--btn-primary-bg)',
                        color: 'var(--btn-primary-text)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'opacity 0.15s',
                        fontFamily: satoshi,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                    <ArrowRight size={14} />
                    Let's go
                </button>
                <button
                    data-tour="tweak"
                    onClick={() => onRequestChange("I want to change something in this plan")}
                    style={{
                        padding: '12px 20px',
                        borderRadius: '100px',
                        border: '1px solid var(--accent-primary)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: satoshi,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--btn-primary-bg)'; e.currentTarget.style.color = 'var(--btn-primary-text)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                    Tweak
                </button>
            </div>

            {/* Approve animation overlay */}
            <AnimatePresence>
                {approveAnimation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'var(--glass-hover)',
                            borderRadius: '16px',
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            <Check size={48} style={{ color: 'var(--text-primary)' }} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>

        {showConfirm && !isStale && (
            <ConfirmDialog
                title="Commit to this week?"
                message={`Once you commit, this week's plan is set until the week wraps — no mid-week renegotiation, that's what makes it work. Next week always adapts to how this one goes. ${windowLine}`}
                confirmLabel="I'm committing to this"
                cancelLabel="Not yet"
                onConfirm={() => { setShowConfirm(false); handleApprove(); }}
                onCancel={() => setShowConfirm(false)}
            />
        )}

        {/* A plan that sat unlocked for a while is about to be locked onto a
            completely different set of dates than it was written for — say so,
            and offer to rebuild it instead of silently starting it. */}
        {showConfirm && isStale && (
            <div
                onClick={() => setShowConfirm(false)}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px',
                }}
            >
                <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.92, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    style={{
                        width: '100%', maxWidth: '430px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--modal-border)',
                        borderRadius: '20px', padding: '26px',
                        boxShadow: 'var(--shadow-lg)', fontFamily: satoshi,
                    }}
                >
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '11px',
                        background: 'rgba(217,119,87,0.10)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
                    }}>
                        <AlertTriangle size={17} style={{ color: 'var(--accent-warm)' }} />
                    </div>

                    <h3 style={{
                        fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)',
                        margin: '0 0 8px', fontFamily: clashDisplay, letterSpacing: '-0.01em',
                    }}>
                        This plan is {planAge} days old
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 10px' }}>
                        You built Week {plan.week_number} on {formatDay(plan.generated_date!)} and haven't locked it yet.
                        A week starts the day you lock it, so this one would begin now, not back then.
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 22px' }}>
                        {windowLine}
                    </p>

                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={() => setShowConfirm(false)}
                            style={{
                                padding: '9px 18px', borderRadius: '100px',
                                border: '1px solid var(--border-medium)', background: 'transparent',
                                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
                                cursor: 'pointer', fontFamily: satoshi,
                                letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                        >
                            Not yet
                        </button>
                        <button
                            onClick={handleRebuild}
                            style={{
                                padding: '9px 18px', borderRadius: '100px',
                                border: '1px solid var(--accent-primary)', background: 'transparent',
                                color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700,
                                cursor: 'pointer', fontFamily: satoshi,
                                letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                        >
                            Build a fresh plan
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => { setShowConfirm(false); handleApprove(); }}
                            style={{
                                padding: '9px 18px', borderRadius: '100px', border: 'none',
                                background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                        >
                            Start it today
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        )}
        </>
    );
}
