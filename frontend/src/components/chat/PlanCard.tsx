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
                    padding: '12px 18px',
                    background: 'rgba(139,92,246,0.06)',
                    border: '1px solid rgba(139,92,246,0.18)',
                    borderRadius: '9999px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    margin: '8px 0',
                }}
            >
                <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: 'rgba(139,92,246,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Calendar size={12} style={{ color: 'var(--color-primary)' }} />
                </div>
                <span style={{
                    flex: 1, fontSize: '14px', fontWeight: 600,
                    color: 'var(--color-primary)',
                    fontFamily: 'var(--font-sans)',
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
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(230,238,255,0.9)',
                borderRadius: '24px',
                overflow: 'hidden',
                margin: '12px 0',
                boxShadow: '0 4px 24px rgba(139,92,246,0.07)',
                fontFamily: 'var(--font-sans)',
            }}
        >
            {/* Header */}
            <div style={{
                padding: '18px 22px',
                borderBottom: '1px solid rgba(230,238,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                background: 'linear-gradient(135deg, rgba(139,92,246,0.05), rgba(132,85,239,0.03))',
            }}>
                <div style={{
                    width: '36px', height: '36px', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #8b5cf6, #8455ef)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                }}>
                    <Sparkles size={16} style={{ color: 'white' }} />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', letterSpacing: '-0.01em' }}>
                        Week {plan.week_number}: {plan.theme}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--font-label)' }}>
                        {plan.week_label} • 🎯 {plan.win_condition}
                    </div>
                </div>
            </div>

            {/* Days */}
            <div style={{ padding: '12px 20px 4px' }}>
                {plan.days.map((day: any, idx: number) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            gap: '14px',
                            padding: '12px 16px',
                            borderRadius: '16px',
                            background: 'rgba(255,255,255,0.6)',
                            border: '1px solid rgba(230,238,255,0.8)',
                            marginBottom: '8px',
                            transition: 'border-color 0.2s',
                        }}
                    >
                        <div style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: 'var(--color-primary)',
                            fontFamily: 'var(--font-label)',
                            minWidth: '90px',
                            flexShrink: 0,
                            paddingTop: '1px',
                            letterSpacing: '0.03em',
                            textTransform: 'uppercase',
                        }}>
                            {day.day}
                        </div>
                        <div style={{
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.55',
                            fontFamily: 'var(--font-sans)',
                        }}>
                            {day.action}
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div style={{
                padding: '14px 20px 20px',
                borderTop: '1px solid rgba(230,238,255,0.7)',
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
                        padding: '12px 20px',
                        borderRadius: '9999px',
                        border: 'none',
                        background: 'var(--color-primary)',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-sans)',
                        boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,92,246,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.3)'; }}
                >
                    <Check size={16} />
                    Looks good, let's go!
                </button>
                <button
                    onClick={() => onRequestChange("I want to change something in this plan")}
                    style={{
                        padding: '12px 20px',
                        borderRadius: '9999px',
                        border: '1px solid rgba(139,92,246,0.25)',
                        background: 'transparent',
                        color: 'var(--color-primary)',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontFamily: 'var(--font-sans)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
