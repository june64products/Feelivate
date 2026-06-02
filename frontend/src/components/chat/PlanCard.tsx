import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Calendar, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

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
                    padding: '10px 16px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    margin: '8px 0',
                }}
            >
                <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Calendar size={12} style={{ color: 'var(--accent-green)' }} />
                </div>
                <span style={{
                    flex: 1, fontSize: '13px', fontWeight: 500,
                    color: 'var(--accent-green)',
                }}>
                    📅 Week {plan.week_number} Active — {plan.week_label}
                </span>
                {isApproved && !isCollapsed ? (
                    <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} />
                ) : (
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                )}
            </motion.div>
        );
    }

    // Full plan card
    return (
        <motion.div
            className={approveAnimation ? 'plan-float-up' : 'plan-slide-in'}
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '16px',
                overflow: 'hidden',
                margin: '12px 0',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
            }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Sparkles size={16} style={{ color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Week {plan.week_number}: {plan.theme}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {plan.week_label} • Win: {plan.win_condition}
                    </div>
                </div>
            </div>

            {/* Days */}
            <div style={{ padding: '12px 20px' }}>
                {plan.days.map((day, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            gap: '12px',
                            padding: '10px 0',
                            borderBottom: idx < plan.days.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        }}
                    >
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--accent-primary)',
                            fontFamily: 'var(--font-mono)',
                            minWidth: '100px',
                            flexShrink: 0,
                            paddingTop: '2px',
                        }}>
                            {day.day}
                        </div>
                        <div style={{
                            fontSize: '13px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.5',
                        }}>
                            {day.action}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div style={{
                padding: '12px 20px 16px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '10px',
            }}>
                <button
                    onClick={handleApprove}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: 'var(--accent-green)',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <Check size={16} />
                    Looks good, let's go!
                </button>
                <button
                    onClick={() => onRequestChange("I want to change something in this plan")}
                    style={{
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-medium)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    Tweak this
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
                            background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '16px',
                            backdropFilter: 'blur(4px)',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            <Check size={48} style={{ color: 'var(--accent-green)' }} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
