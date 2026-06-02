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
            flex: 1, padding: '10px 12px', borderRadius: '10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: color ?? 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</span>
        </div>
    );
}

// ─── Analysis mini block ──────────────────────────────────────────────────────
function MiniAnalysis({ label, content }: { label: string; content: string }) {
    if (!content) return null;
    return (
        <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.55, margin: 0 }}>{content}</p>
        </div>
    );
}

// ─── Week Plan day list ───────────────────────────────────────────────────────
function WeekPlanDays({ plan, accentColor }: { plan: any; accentColor: string }) {
    if (!plan?.days?.length) return null;
    return (
        <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', paddingLeft: '2px' }}>
                Week {plan.week_number} · {plan.theme}
            </div>
            <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                {plan.days.map((day: any, idx: number) => (
                    <div key={idx} style={{
                        display: 'flex', gap: '10px', padding: '10px 14px',
                        borderBottom: idx < plan.days.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                    }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: accentColor, minWidth: '70px', marginTop: '2px', flexShrink: 0 }}>
                            {day.day}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.5 }}>
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
                right: 60, // offset from the pill panel
                top: drawerTop !== undefined ? Math.min(drawerTop, typeof window !== 'undefined' ? window.innerHeight - 350 : 500) : 80,
                transform: 'none',
                width: '310px',
                maxHeight: '82vh',
                background: '#111112',
                border: `1px solid ${accentBorder}`,
                borderRadius: '16px',
                boxShadow: `0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px ${accentBorder}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 500,
                fontFamily: "'Inter', sans-serif",
            }}
        >
            {/* Header */}
            <div style={{
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
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
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>
                            Week {weekNumber} {isLockedPast ? '— Plan' : ''}
                        </p>
                        <p style={{ fontSize: '10px', color: isOngoing ? '#818cf8' : isActiveCurrent ? '#34d399' : 'rgba(255,255,255,0.35)', margin: 0, marginTop: '1px' }}>
                            {isOngoing ? 'Recorded Today ✦' : isActiveCurrent ? 'Active Now' : (report ? `${report.week_start} – ${report.week_end}` : 'Completed')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        width: '26px', height: '26px', borderRadius: '7px',
                        border: 'none', background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
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
                            padding: '16px', borderRadius: '12px',
                            border: '1px dashed rgba(255,255,255,0.1)',
                            textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.6,
                        }}>
                            <FileText size={18} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4 }} />
                            Plan data not available for this week.
                        </div>
                    )
                )}

                {/* ── Last voice entry for LOCKED past weeks ── */}
                {isLockedPast && lastJournalDay && (
                    <div style={{
                        padding: '10px 12px', borderRadius: '10px',
                        background: 'rgba(167,139,250,0.06)',
                        border: '1px solid rgba(167,139,250,0.15)',
                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                    }}>
                        <Mic size={13} color="#a78bfa" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                                Last Voice Entry
                            </p>
                            <p style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.45, fontStyle: 'italic' }}>
                                "{lastJournalDay.one_liner}"
                            </p>
                            {lastJournalDay.emotion && (
                                <p style={{ fontSize: '10px', color: 'rgba(167,139,250,0.6)', margin: '3px 0 0', fontWeight: 600 }}>
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
                            <MiniStatCard label="Avg Mood" value={`${r.avg_score ?? 0}/10`} color="#60a5fa" />
                        </div>
                        <MiniAnalysis label="Emotional Arc" content={r.emotional_arc ?? ''} />
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
                    top: '80px', // Below the profile icon
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '8px 0',
                    background: 'rgba(10,10,10,0.92)',
                    borderLeft: '1px solid rgba(255,255,255,0.08)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '14px 0 0 14px',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 400,
                    minWidth: '52px',
                    alignItems: 'center',
                    fontFamily: "'Inter', sans-serif",
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
                                        borderRadius: '9px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: isGroupExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                        color: 'rgba(255,255,255,0.55)',
                                        cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                                        transition: 'all 0.15s',
                                        fontFamily: "'Inter', sans-serif",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = isGroupExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
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
                                    <div className="week-divider" style={{ width: '28px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
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
                                <div className="week-divider" style={{ width: '28px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
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

// ─── Individual week pill button ──────────────────────────────────────────────

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
    // isOngoing = true → recorded today (indigo/sparkle)
    // isLocked = true → completed past week (purple/lock)
    // neither → active current week, not recorded yet (emerald/play)
    const isActiveCurrent = !isOngoing && !isLocked;

    const bgColor = isSelected
        ? isOngoing ? 'rgba(99,102,241,0.3)' : isActiveCurrent ? 'rgba(16,185,129,0.25)' : 'rgba(139,92,246,0.25)'
        : isOngoing ? 'rgba(99,102,241,0.12)' : isActiveCurrent ? 'rgba(16,185,129,0.1)' : 'rgba(139,92,246,0.08)';

    const borderColor = isSelected
        ? isOngoing ? 'rgba(99,102,241,0.6)' : isActiveCurrent ? 'rgba(16,185,129,0.5)' : 'rgba(139,92,246,0.55)'
        : isOngoing ? 'rgba(99,102,241,0.25)' : isActiveCurrent ? 'rgba(16,185,129,0.3)' : 'rgba(139,92,246,0.22)';

    const textColor = isSelected
        ? isOngoing ? '#a5b4fc' : isActiveCurrent ? '#34d399' : '#c4b5fd'
        : isOngoing ? '#818cf8' : isActiveCurrent ? '#10b981' : '#a78bfa';

    const hoverBg = isOngoing ? 'rgba(99,102,241,0.2)' : isActiveCurrent ? 'rgba(16,185,129,0.18)' : 'rgba(139,92,246,0.16)';
    const hoverColor = isOngoing ? '#a5b4fc' : isActiveCurrent ? '#34d399' : '#c4b5fd';

    const titleText = isOngoing
        ? `Week ${weekNumber} — recorded today ✦`
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
                borderRadius: '9px',
                border: `1px solid ${borderColor}`,
                background: bgColor,
                color: textColor,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                transition: 'all 0.15s',
                fontFamily: "'Inter', sans-serif",
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
                        background: isOngoing ? '#818cf8' : isLocked ? '#a78bfa' : '#34d399',
                    }}
                />
            )}
        </motion.button>
    );
}
