import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, X, Lock, Sparkles, FileText, ChevronUp, Mic } from 'lucide-react';
import { getSessionReports, type ArchivedWeekReport } from '../../api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekButtonItem {
    weekNumber: number;
    isOngoing: boolean;  // current active week
    isLocked: boolean;   // completed/past week
}

interface WeekGroup {
    label: string;       // e.g. "Week 0-4" or "Week 0"
    weeks: WeekButtonItem[];
    isCollapsed: boolean; // group level collapse (for 5+ weeks)
    startWeek: number;
    endWeek: number;
}

interface LockedWeeksPanelProps {
    sessionId: string | undefined;
    currentWeek: number;           // the ongoing week number (0-indexed)
    micLocked: boolean;            // if today is locked
    activePlan?: any;              // current plan data
    planHistory?: any[];           // all past approved week plans
    onClose?: () => void;
}

// ─── Small helper: stat card ──────────────────────────────────────────────────
function MiniStatCard({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{
            flex: 1, padding: '10px 12px', borderRadius: '12px',
            background: 'rgba(139,92,246,0.04)',
            border: '1px solid rgba(203,195,215,0.5)',
            display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: color ?? 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        </div>
    );
}

// ─── Analysis mini block ──────────────────────────────────────────────────────
function MiniAnalysis({ label, content }: { label: string; content: string }) {
    if (!content) return null;
    return (
        <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(139,92,246,0.03)', border: '1px solid rgba(203,195,215,0.4)' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{content}</p>
        </div>
    );
}

// ─── Week Plan day list ───────────────────────────────────────────────────────
function WeekPlanDays({ plan, accentColor }: { plan: any; accentColor: string }) {
    if (!plan?.days?.length) return null;
    return (
        <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingLeft: '2px' }}>
                Week {plan.week_number} · {plan.theme}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '14px', border: '1px solid rgba(230,238,255,0.9)', overflow: 'hidden' }}>
                {plan.days.map((day: any, idx: number) => (
                    <div key={idx} style={{
                        display: 'flex', gap: '10px', padding: '10px 14px',
                        borderBottom: idx < plan.days.length - 1 ? '1px solid rgba(203,195,215,0.3)' : 'none'
                    }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-label)', color: accentColor, minWidth: '70px', marginTop: '2px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                            {day.day}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            {day.action}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Week drawer (slides in from right) ──────────────────────────────────────
function WeekDrawer({
    weekNumber,
    report,
    isOngoing,
    isActiveCurrent,
    activePlan,
    weekPlan,
    drawerTop,
    onClose,
}: {
    weekNumber: number;
    report: ArchivedWeekReport | null;
    isOngoing: boolean;
    isActiveCurrent: boolean;
    activePlan?: any;
    weekPlan?: any;         // plan for this specific week from planHistory
    drawerTop?: number;
    onClose: () => void;
}) {
    const isCurrentWeek = isOngoing || isActiveCurrent;
    const isLockedPast = !isCurrentWeek;
    const accentColor = isOngoing ? '#818cf8' : isActiveCurrent ? '#34d399' : '#a78bfa';
    const accentBg = isOngoing ? 'rgba(99,102,241,0.08)' : isActiveCurrent ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.07)';
    const accentBorder = isOngoing ? 'rgba(99,102,241,0.2)' : isActiveCurrent ? 'rgba(16,185,129,0.2)' : 'rgba(139,92,246,0.18)';

    const r = report?.report;
    const planToShow = isCurrentWeek ? activePlan : weekPlan;

    const [showReport, setShowReport] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth <= 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // Last voice entry (from report days if available)
    const lastJournalDay = r?.days?.slice().reverse().find((d: any) => d.has_journal);

    return (
        <motion.div
            key={`drawer-${weekNumber}`}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className={isMobile ? 'week-drawer-mobile' : ''}
            style={{
                position: 'fixed',
                right: 60,
                top: drawerTop !== undefined ? Math.min(drawerTop, typeof window !== 'undefined' ? window.innerHeight - 350 : 500) : 80,
                transform: 'none',
                width: '320px',
                maxHeight: '82vh',
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: `1px solid ${accentBorder}`,
                borderRadius: '20px',
                boxShadow: `0 20px 60px rgba(139,92,246,0.12), 0 0 0 1px ${accentBorder}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 500,
                fontFamily: "var(--font-sans)",
            }}
        >
            {/* Header */}
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(203,195,215,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
                background: accentBg,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: isOngoing ? 'rgba(99,102,241,0.15)' : isActiveCurrent ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {isOngoing
                            ? <Sparkles size={13} color={accentColor} />
                            : isActiveCurrent
                                ? <span style={{ fontSize: '12px', color: accentColor }}>▶</span>
                                : <Lock size={13} color={accentColor} />
                        }
                    </div>
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            Week {weekNumber} {isLockedPast ? '— Plan' : ''}
                        </p>
                        <p style={{ fontSize: '10px', color: isOngoing ? '#6366f1' : isActiveCurrent ? '#10b981' : 'var(--text-muted)', margin: 0, marginTop: '1px' }}>
                            {isOngoing ? 'Recorded Today ✦' : isActiveCurrent ? 'Active Now' : (report ? `${report.week_start} – ${report.week_end}` : 'Completed')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        width: '26px', height: '26px', borderRadius: '8px',
                        border: 'none', background: 'rgba(139,92,246,0.08)',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    <X size={13} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* ── CURRENT WEEK: show active state + plan ── */}
                {isCurrentWeek && !r && (
                    <div style={{
                        padding: '16px', borderRadius: '12px',
                        background: isOngoing ? 'rgba(99,102,241,0.06)' : 'rgba(16,185,129,0.06)',
                        border: `1px dashed ${isOngoing ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        textAlign: 'center',
                    }}>
                        {isOngoing
                            ? <Sparkles size={20} color="#818cf8" style={{ margin: '0 auto 10px' }} />
                            : <div style={{ fontSize: '20px', color: '#34d399', margin: '0 auto 10px', lineHeight: 1 }}>▶</div>
                        }
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>
                            {isOngoing ? 'Voice logged today ✦' : 'This is your current active week.'}
                        </p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0' }}>
                            {isOngoing ? 'Great work keeping up the momentum.' : 'Keep journaling — report appears at week end.'}
                        </p>
                    </div>
                )}

                {/* ── Show the week's plan (current or past) ── */}
                {planToShow && planToShow.days ? (
                    <WeekPlanDays plan={planToShow} accentColor={accentColor} />
                ) : (
                    !isCurrentWeek && (
                        <div style={{
                            padding: '16px', borderRadius: '14px',
                            border: '1px dashed rgba(203,195,215,0.4)',
                            textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.6,
                        }}>
                            <FileText size={18} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                            Plan data not available for this week.
                        </div>
                    )
                )}

                {/* ── Last voice entry for LOCKED past weeks ── */}
                {isLockedPast && lastJournalDay && (
                    <div style={{
                        padding: '10px 12px', borderRadius: '12px',
                        background: 'rgba(139,92,246,0.05)',
                        border: '1px solid rgba(139,92,246,0.15)',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}>
                        <Mic size={13} color="#8b5cf6" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                                Last Voice Entry
                            </p>
                            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.45, fontStyle: 'italic' }}>
                                "{lastJournalDay.one_liner}"
                            </p>
                            {lastJournalDay.emotion && (
                                <p style={{ fontSize: '10px', color: 'var(--color-primary)', margin: '3px 0 0', fontWeight: 600 }}>
                                    {lastJournalDay.emotion} · {lastJournalDay.score}/10
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Collapsible Report Summary for LOCKED past weeks ── */}
                {isLockedPast && r && (
                    <div style={{ borderRadius: '10px', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                        <button
                            onClick={() => setShowReport(p => !p)}
                            style={{
                                width: '100%', padding: '10px 12px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'rgba(255,255,255,0.03)', border: 'none',
                                color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                                fontFamily: "'Inter', sans-serif", fontSize: '10px', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.06em',
                            }}
                        >
                            <span>📊 Week Performance</span>
                            {showReport ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                        <AnimatePresence>
                            {showReport && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <MiniStatCard label="Consistency" value={`${r.consistency_score ?? 0}%`} color="#10b981" />
                                            <MiniStatCard label="Avg Mood" value={`${r.avg_score ?? 0}/10`} color="#60a5fa" />
                                        </div>
                                        {r.week_theme && (
                                            <div style={{
                                                padding: '8px 12px', borderRadius: '10px',
                                                background: 'rgba(99,102,241,0.07)',
                                                border: '1px solid rgba(99,102,241,0.15)',
                                                fontSize: '11px', color: '#818cf8', fontWeight: 500,
                                            }}>
                                                ✦ {r.week_theme}
                                            </div>
                                        )}
                                        <MiniAnalysis label="What Went Well" content={r.what_went_well ?? ''} />
                                        <MiniAnalysis label="Where You Slipped" content={r.where_you_slipped ?? ''} />
                                        {r.hidden_insight && (
                                            <div style={{
                                                padding: '10px 12px', borderRadius: '10px',
                                                background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                                            }}>
                                                <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(99,102,241,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Hidden Insight</p>
                                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, margin: 0 }}>{r.hidden_insight}</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* ── Current week report if available ── */}
                {isCurrentWeek && r && (
                    <>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <MiniStatCard label="Consistency" value={`${r.consistency_score ?? 0}%`} color="#10b981" />
                            <MiniStatCard label="Avg Mood" value={`${r.avg_score ?? 0}/10`} color="#6366f1" />
                        </div>
                        <MiniAnalysis label="Emotional Arc" content={r.emotional_arc ?? ''} />
                        <MiniAnalysis label="What Went Well" content={r.what_went_well ?? ''} />
                        <MiniAnalysis label="Where You Slipped" content={r.where_you_slipped ?? ''} />
                        {r.hidden_insight && (
                            <div style={{
                                padding: '10px 12px', borderRadius: '12px',
                                background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.12)',
                            }}>
                                <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>Hidden Insight</p>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{r.hidden_insight}</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LockedWeeksPanel({ sessionId, currentWeek, micLocked, activePlan, planHistory = [] }: LockedWeeksPanelProps) {
    const [reports, setReports] = useState<ArchivedWeekReport[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [loadedReports, setLoadedReports] = useState(false);
    const [drawerTop, setDrawerTop] = useState<number>(80);

    // Load archived reports once
    useEffect(() => {
        if (!sessionId || loadedReports) return;
        getSessionReports(sessionId)
            .then(r => { setReports(r); setLoadedReports(true); })
            .catch(() => { setLoadedReports(true); });
    }, [sessionId]);

    // Build list of week items — locked past weeks + current active week
    const weekItems: WeekButtonItem[] = [];
    // Past locked weeks (from archived reports)
    const lockedWeekNums = reports.map(r => r.week_number).sort((a, b) => a - b);
    lockedWeekNums.forEach(wn => {
        if (wn !== currentWeek) {
            weekItems.push({ weekNumber: wn, isOngoing: false, isLocked: true });
        }
    });
    // Always add current week — isOngoing=true means mic was locked today (recorded)
    weekItems.push({ weekNumber: currentWeek, isOngoing: micLocked, isLocked: false });

    // Sort all
    weekItems.sort((a, b) => a.weekNumber - b.weekNumber);

    // Build groups: group every 5 weeks into a collapsible group
    const groups: WeekGroup[] = [];
    for (let i = 0; i < weekItems.length; i += 5) {
        const chunk = weekItems.slice(i, i + 5);
        const startW = chunk[0].weekNumber;
        const endW = chunk[chunk.length - 1].weekNumber;
        const label = chunk.length >= 5 ? `W ${startW}–${endW}` : chunk.length === 1 ? `Week ${startW}` : `W ${startW}–${endW}`;
        groups.push({
            label,
            weeks: chunk,
            isCollapsed: chunk.length >= 5,
            startWeek: startW,
            endWeek: endW,
        });
    }

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    const handleWeekClick = (weekNumber: number, e: React.MouseEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDrawerTop(rect.top);
        setSelectedWeek(prev => prev === weekNumber ? null : weekNumber);
    };

    const getReportForWeek = (wn: number): ArchivedWeekReport | null =>
        reports.find(r => r.week_number === wn) ?? null;

    // Get the plan for a specific week number from planHistory
    const getPlanForWeek = (wn: number): any | null =>
        planHistory.find((p: any) => p.week_number === wn) ?? null;

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const selectedReport = selectedWeek !== null ? getReportForWeek(selectedWeek) : null;
    const selectedWeekPlan = selectedWeek !== null && selectedWeek !== currentWeek ? getPlanForWeek(selectedWeek) : null;
    const isSelectedOngoing = selectedWeek === currentWeek;

    return (
        <>
            {/* ── Floating pill panel on right edge ── */}
            <motion.div
                className="locked-weeks-panel"
                initial={isMobile ? { y: 60, opacity: 0 } : { x: 60, opacity: 0 }}
                animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 22, stiffness: 250, delay: 0.1 }}
                style={{
                    position: 'fixed',
                    right: 0,
                    top: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 0',
                    background: 'rgba(255,255,255,0.65)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    borderLeft: '1px solid rgba(203,195,215,0.4)',
                    borderTop: '1px solid rgba(230,238,255,0.7)',
                    borderBottom: '1px solid rgba(230,238,255,0.7)',
                    borderRadius: '14px 0 0 14px',
                    boxShadow: '-4px 0 24px rgba(139,92,246,0.08)',
                    zIndex: 400,
                    minWidth: '52px',
                    alignItems: 'center',
                    fontFamily: "var(--font-label)",
                }}
            >
                {groups.map((group, gi) => {
                    const groupKey = `${group.startWeek}-${group.endWeek}`;
                    const isGroupExpanded = expandedGroups.has(groupKey);
                    // If group has 5+ weeks → show as collapsible pill, else show individual buttons
                    const showGrouped = group.weeks.length >= 5;

                    if (showGrouped) {
                        return (
                            <div key={groupKey} className="week-group-col" style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', width: '100%' }}>
                                {/* Group toggle button */}
                                <button
                                    onClick={() => toggleGroup(groupKey)}
                                    title={`${group.label} — click to ${isGroupExpanded ? 'collapse' : 'expand'}`}
                                    style={{
                                        width: '44px',
                                        padding: '7px 4px',
                                        borderRadius: '10px',
                                        border: '1px solid rgba(203,195,215,0.4)',
                                        background: isGroupExpanded ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.5)',
                                        color: isGroupExpanded ? 'var(--color-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                                        transition: 'all 0.15s',
                                        fontFamily: "var(--font-label)",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.1)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = isGroupExpanded ? 'rgba(139,92,246,0.1)' : 'rgba(255,255,255,0.5)'; e.currentTarget.style.color = isGroupExpanded ? 'var(--color-primary)' : 'var(--text-secondary)'; }}
                                >
                                    <span style={{ fontSize: '8px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1, textAlign: 'center' }}>
                                        {group.startWeek}–{group.endWeek}
                                    </span>
                                    {isGroupExpanded ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                                </button>

                                {/* Expanded individual week buttons */}
                                <AnimatePresence>
                                    {isGroupExpanded && (
                                        <motion.div
                                            className="week-group-col"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                                            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', width: '100%' }}
                                        >
                                            {group.weeks.map(w => (
                                                <WeekPill
                                                    key={w.weekNumber}
                                                    item={w}
                                                    isSelected={selectedWeek === w.weekNumber}
                                                    onClick={(e) => handleWeekClick(w.weekNumber, e)}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Divider between groups */}
                                {gi < groups.length - 1 && (
                                    <div className="week-divider" style={{ width: '28px', height: '1px', background: 'rgba(203,195,215,0.4)', margin: '2px 0' }} />
                                )}
                            </div>
                        );
                    }

                    // Less than 5 in group → show individually
                    return (
                        <div key={groupKey} className="week-group-col" style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', width: '100%' }}>
                            {group.weeks.map(w => (
                                <WeekPill
                                    key={w.weekNumber}
                                    item={w}
                                    isSelected={selectedWeek === w.weekNumber}
                                    onClick={(e) => handleWeekClick(w.weekNumber, e)}
                                />
                            ))}
                            {gi < groups.length - 1 && (
                                <div className="week-divider" style={{ width: '28px', height: '1px', background: 'rgba(203,195,215,0.4)', margin: '2px 0' }} />
                            )}
                        </div>
                    );
                })}
            </motion.div>

            {/* ── Slide-out week drawer ── */}
            <AnimatePresence>
                {selectedWeek !== null && (
                    <WeekDrawer
                        weekNumber={selectedWeek}
                        report={selectedReport}
                        isOngoing={isSelectedOngoing && micLocked}
                        isActiveCurrent={selectedWeek === currentWeek && !micLocked}
                        activePlan={activePlan}
                        weekPlan={selectedWeekPlan}
                        drawerTop={drawerTop}
                        onClose={() => setSelectedWeek(null)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// ─── Individual week pill button ──────────────────────────────────────────────────────

function WeekPill({
    item,
    isSelected,
    onClick,
}: {
    item: WeekButtonItem;
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
}) {
    const { weekNumber, isOngoing, isLocked } = item;
    const isActiveCurrent = !isOngoing && !isLocked;

    const bgColor = isSelected
        ? isOngoing ? 'rgba(99,102,241,0.2)' : isActiveCurrent ? 'rgba(16,185,129,0.18)' : 'rgba(139,92,246,0.18)'
        : isOngoing ? 'rgba(99,102,241,0.08)' : isActiveCurrent ? 'rgba(16,185,129,0.07)' : 'rgba(139,92,246,0.06)';

    const borderColor = isSelected
        ? isOngoing ? 'rgba(99,102,241,0.5)' : isActiveCurrent ? 'rgba(16,185,129,0.5)' : 'rgba(139,92,246,0.5)'
        : isOngoing ? 'rgba(99,102,241,0.2)' : isActiveCurrent ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.2)';

    const textColor = isSelected
        ? isOngoing ? '#6366f1' : isActiveCurrent ? '#10b981' : 'var(--color-primary)'
        : isOngoing ? '#818cf8' : isActiveCurrent ? '#10b981' : '#8b5cf6';

    const hoverBg = isOngoing ? 'rgba(99,102,241,0.15)' : isActiveCurrent ? 'rgba(16,185,129,0.12)' : 'rgba(139,92,246,0.12)';
    const hoverColor = isOngoing ? '#6366f1' : isActiveCurrent ? '#10b981' : 'var(--color-primary)';

    const titleText = isOngoing
        ? `Week ${weekNumber} — recorded today ✶`
        : isActiveCurrent
            ? `Week ${weekNumber} — active (click to view plan)`
            : `Week ${weekNumber} — tap to view plan`;

    return (
        <motion.button
            layout
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={onClick}
            title={titleText}
            style={{
                width: '44px',
                padding: '7px 4px',
                borderRadius: '10px',
                border: `1px solid ${borderColor}`,
                background: bgColor,
                color: textColor,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                transition: 'all 0.15s',
                fontFamily: "var(--font-label)",
                position: 'relative',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = hoverBg;
                e.currentTarget.style.color = hoverColor;
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = bgColor;
                e.currentTarget.style.color = textColor;
            }}
        >
            {/* Icon */}
            {isOngoing
                ? <Sparkles size={10} />
                : isActiveCurrent
                    ? <span style={{ fontSize: '9px', lineHeight: 1 }}>▶</span>
                    : <Lock size={10} />
            }
            <span style={{ fontSize: '8.5px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1 }}>
                W{weekNumber}
            </span>

            {/* Selected indicator dot */}
            {isSelected && (
                <motion.div
                    layoutId="selected-dot"
                    style={{
                        position: 'absolute',
                        left: '-4px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '4px', height: '14px',
                        borderRadius: '0 3px 3px 0',
                        background: isOngoing ? '#6366f1' : isLocked ? 'var(--color-primary)' : '#10b981',
                    }}
                />
            )}
        </motion.button>
    );
}
