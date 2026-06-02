import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Calendar, ChevronDown, ChevronUp, Sparkles, Trophy, Edit3 } from 'lucide-react';

/* ── Types ─────────────────────────────────── */
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

/* ── Day label abbreviations ───────────────── */
const DAY_ABBR: Record<string, string> = {
    'monday': 'Mon', 'tuesday': 'Tue', 'wednesday': 'Wed',
    'thursday': 'Thu', 'friday': 'Fri', 'saturday': 'Sat', 'sunday': 'Sun',
    'day 1': 'D1', 'day 2': 'D2', 'day 3': 'D3', 'day 4': 'D4',
    'day 5': 'D5', 'day 6': 'D6', 'day 7': 'D7',
};
const abbr = (day: string) => DAY_ABBR[day.toLowerCase()] ?? day.substring(0, 3);

/* ── Today detection ───────────────────────── */
const TODAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const todayName = TODAY_NAMES[new Date().getDay()];

const isToday = (day: string) =>
    day.toLowerCase() === todayName || day.toLowerCase() === `day ${new Date().getDay() + 1}`;

/* ── Collapsed pill (when approved / collapsed) ─ */
function CollapsedPill({
    plan,
    isCollapsed,
    onToggle,
}: {
    plan: PlanData;
    isCollapsed: boolean;
    onToggle: () => void;
}) {
    const [hovered, setHovered] = useState(false);
    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={onToggle}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                background: hovered
                    ? 'rgba(34,197,94,0.13)'
                    : 'var(--accent-green-faint)',
                border: '1px solid rgba(34,197,94,0.22)',
                borderRadius: '14px',
                cursor: 'pointer',
                margin: '8px 0',
                transition: 'all 0.18s',
            }}
        >
            <div style={{
                width: 28, height: 28, borderRadius: '8px',
                background: 'rgba(34,197,94,0.14)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Calendar size={14} style={{ color: 'var(--accent-green)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '13px', fontWeight: 600, color: 'var(--accent-green)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                    Week {plan.week_number} Active · {plan.theme}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(34,197,94,0.65)', marginTop: 2 }}>
                    {plan.week_label} — tap to {isCollapsed ? 'expand' : 'collapse'}
                </div>
            </div>
            {isCollapsed
                ? <ChevronDown size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
                : <ChevronUp size={14} style={{ color: 'var(--accent-green)', flexShrink: 0 }} />
            }
        </motion.div>
    );
}

/* ── Progress bar ──────────────────────────── */
function WeekProgress({ days }: { days: PlanDay[] }) {
    const total = days.length;
    const dayIndex = new Date().getDay(); // 0=Sun
    // Rough: estimate progress by days of week elapsed
    const elapsed = Math.max(0, Math.min(total, dayIndex));
    const pct = total > 0 ? (elapsed / total) * 100 : 0;
    return (
        <div style={{ padding: '10px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Week Progress
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                    {elapsed}/{total} days
                </span>
            </div>
            <div style={{
                height: 4, borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                overflow: 'hidden',
            }}>
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                    style={{ height: '100%', background: 'rgba(255,255,255,0.85)', borderRadius: 999 }}
                />
            </div>
        </div>
    );
}

/* ── Full Plan Card ─────────────────────────── */
export default function PlanCard({ plan, onApprove, onRequestChange, isApproved }: PlanCardProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [approveAnimation, setApproveAnimation] = useState(false);
    const [approveBtnHovered, setApproveBtnHovered] = useState(false);
    const [tweakHovered, setTweakHovered] = useState(false);

    const handleApprove = () => {
        setApproveAnimation(true);
        setTimeout(() => {
            setIsCollapsed(true);
            onApprove();
        }, 600);
    };

    /* ── Collapsed / Approved pill ── */
    if (isApproved && isCollapsed) {
        return (
            <CollapsedPill
                plan={plan}
                isCollapsed={true}
                onToggle={() => setIsCollapsed(false)}
            />
        );
    }

    return (
        <motion.div
            layout
            className={approveAnimation ? 'plan-float-up' : 'plan-slide-in'}
            style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: '18px',
                overflow: 'hidden',
                margin: '12px 0',
                position: 'relative',
                boxShadow: 'var(--shadow-card)',
            }}
        >
            {/* ── Gradient header ── */}
            <div style={{
                background: 'var(--bg-feature)',
                padding: '18px 20px 14px',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Subtle decorative pattern */}
                <div style={{
                    position: 'absolute', top: -40, right: -40,
                    width: 160, height: 160,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', bottom: -20, left: -20,
                    width: 100, height: 100,
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                }} />

                {/* Content */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
                    <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            width: 36, height: 36, borderRadius: '10px',
                            background: 'rgba(255,255,255,0.18)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <Sparkles size={18} style={{ color: 'white' }} />
                    </motion.div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                        }}>
                            <span style={{
                                fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em',
                                textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
                            }}>
                                Week {plan.week_number}
                            </span>
                            <div style={{
                                height: 12, width: 1,
                                background: 'rgba(255,255,255,0.25)',
                            }} />
                            <span style={{
                                fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                            }}>
                                {plan.week_label}
                            </span>
                        </div>
                        <h3 style={{
                            margin: 0, fontSize: '17px', fontWeight: 700, color: 'white',
                            letterSpacing: '-0.02em', lineHeight: 1.25,
                        }}>
                            {plan.theme}
                        </h3>
                        {plan.win_condition && (
                            <p style={{
                                margin: '6px 0 0', fontSize: '12px',
                                color: 'rgba(255,255,255,0.65)',
                                fontStyle: 'italic', lineHeight: 1.4,
                            }}>
                                🎯 {plan.win_condition}
                            </p>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                <WeekProgress days={plan.days} />
                <div style={{ height: 14 }} />
            </div>

            {/* ── Day rows ── */}
            <div>
                {plan.days.map((day, idx) => {
                    const today = isToday(day.day);
                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.08 + idx * 0.05, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                display: 'flex',
                                gap: 14,
                                padding: '12px 20px',
                                borderBottom: idx < plan.days.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                background: today ? 'var(--accent-faint)' : 'transparent',
                                borderLeft: today ? `3px solid var(--accent)` : '3px solid transparent',
                                paddingLeft: today ? 17 : 20,
                                transition: 'background 0.15s',
                            }}
                        >
                            {/* Day label */}
                            <div style={{
                                fontSize: '11px', fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: today ? 'var(--accent)' : 'var(--text-muted)',
                                minWidth: 36,
                                paddingTop: 2,
                                flexShrink: 0,
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                                {abbr(day.day)}
                                {today && (
                                    <div style={{
                                        width: 4, height: 4, borderRadius: '50%',
                                        background: 'var(--accent)',
                                    }} />
                                )}
                            </div>

                            {/* Action text */}
                            <div style={{
                                fontSize: '13.5px',
                                color: today ? 'var(--text-primary)' : 'var(--text-secondary)',
                                lineHeight: 1.5,
                                fontWeight: today ? 500 : 400,
                            }}>
                                {day.action}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* ── Actions ── */}
            <div style={{
                padding: '14px 20px 18px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: 10,
            }}>
                {/* Approve CTA */}
                <motion.button
                    onClick={handleApprove}
                    onMouseEnter={() => setApproveBtnHovered(true)}
                    onMouseLeave={() => setApproveBtnHovered(false)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '11px 16px',
                        borderRadius: '12px',
                        border: 'none',
                        background: approveBtnHovered
                            ? 'var(--accent)'
                            : 'var(--bg-feature)',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.18s',
                        fontFamily: 'var(--font-sans)',
                        boxShadow: approveBtnHovered
                            ? '0 4px 16px rgba(124,110,248,0.35)'
                            : '0 2px 8px rgba(124,110,248,0.2)',
                    }}
                >
                    <Check size={15} strokeWidth={2.5} />
                    Looks good, let's go!
                </motion.button>

                {/* Tweak */}
                <motion.button
                    onClick={() => onRequestChange("I want to change something in this plan")}
                    onMouseEnter={() => setTweakHovered(true)}
                    onMouseLeave={() => setTweakHovered(false)}
                    whileTap={{ scale: 0.97 }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '11px 16px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-medium)',
                        background: tweakHovered ? 'var(--bg-hover)' : 'transparent',
                        color: tweakHovered ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: '13px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        fontFamily: 'var(--font-sans)',
                        flexShrink: 0,
                    }}
                >
                    <Edit3 size={13} />
                    Tweak
                </motion.button>
            </div>

            {/* ── Approve overlay ── */}
            <AnimatePresence>
                {approveAnimation && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexDirection: 'column', gap: 12,
                            background: 'rgba(34,197,94,0.08)',
                            backdropFilter: 'blur(6px)',
                            borderRadius: '18px',
                        }}
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -20 }}
                            animate={{ scale: [0, 1.25, 1], rotate: 0 }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <Trophy size={52} style={{ color: 'var(--accent-green)' }} />
                        </motion.div>
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            style={{
                                fontSize: '15px', fontWeight: 700, color: 'var(--accent-green)',
                                letterSpacing: '-0.01em',
                            }}
                        >
                            Week {plan.week_number} Activated!
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
