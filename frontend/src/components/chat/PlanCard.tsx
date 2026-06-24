import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Calendar, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { useWindowSize } from '../../hooks/useWindowSize';
import ConfirmDialog from '../workspace/ConfirmDialog';

const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

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
}

interface PlanCardProps {
    plan: PlanData;
    onApprove: () => void;
    onRequestChange: (feedback: string) => void;
    isApproved: boolean;
}

export default function PlanCard({ plan, onApprove, onRequestChange, isApproved }: PlanCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [approveAnimation, setApproveAnimation] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const { isMobile } = useWindowSize();

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
                <div style={{
                    fontSize: '13px', color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    lineHeight: 1.4,
                }}>
                    Win: {plan.win_condition}
                </div>
            </div>

            {/* Days — Tabular layout */}
            <div style={{ padding: '4px 0' }}>
                {plan.days.map((day, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: isMobile ? '6px' : '0',
                            padding: isMobile ? '16px 20px' : '14px 24px',
                            borderBottom: idx < plan.days.length - 1
                                ? '1px solid var(--border-subtle)'
                                : 'none',
                            background: idx % 2 === 1
                                ? 'var(--glass-surface)'
                                : 'transparent',
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = idx % 2 === 1 ? 'var(--glass-surface)' : 'transparent'; }}
                    >
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            fontFamily: clashDisplay,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            minWidth: '110px',
                            flexShrink: 0,
                            paddingTop: '2px',
                        }}>
                            {day.day}
                        </div>
                        <div style={{
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.6',
                            fontFamily: satoshi,
                            fontWeight: 400,
                        }}>
                            {day.action}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions — Swiss pill buttons */}
            <div style={{
                padding: '16px 24px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: '10px',
            }}>
                <button
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

        {showConfirm && (
            <ConfirmDialog
                title="Lock this week's plan?"
                message="Once you lock it, this week's plan can't be changed until the week ends. Ready to commit?"
                confirmLabel="Yes, lock it"
                cancelLabel="Not yet"
                onConfirm={() => { setShowConfirm(false); handleApprove(); }}
                onCancel={() => setShowConfirm(false)}
            />
        )}
        </>
    );
}
