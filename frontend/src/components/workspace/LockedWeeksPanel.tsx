import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, X, Lock, Sparkles, FileText, ChevronUp, Mic, Menu } from 'lucide-react';
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

// ─── Fonts ────────────────────────────────────────────────────────────────────
const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// ─── Small helper: stat card — Swiss light ────────────────────────────────────
function MiniStatCard({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{
            flex: 1, padding: '12px 14px', borderRadius: '10px',
            background: '#ffffff',
            border: '1px solid rgba(30,30,30,0.06)',
            display: 'flex', flexDirection: 'column', gap: '3px',
        }}>
            <span style={{ fontSize: '9px', fontWeight: 700, color: '#b6b5b5', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: satoshi }}>{label}</span>
            <span style={{ fontSize: '18px', fontWeight: 700, color: color ?? '#111111', letterSpacing: '-0.02em', lineHeight: 1, fontFamily: clashDisplay }}>{value}</span>
        </div>
    );
}

// ─── Analysis mini block — Swiss light ────────────────────────────────────────
function MiniAnalysis({ label, content }: { label: string; content: string }) {
    if (!content) return null;
    return (
        <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#ffffff', border: '1px solid rgba(30,30,30,0.06)' }}>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#b6b5b5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px', fontFamily: satoshi }}>{label}</p>
            <p style={{ fontSize: '12px', color: '#838282', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{content}</p>
        </div>
    );
}

// ─── Week Plan day list — Swiss tabular matching PlanCard ─────────────────────
function WeekPlanDays({ plan }: { plan: any }) {
    if (!plan?.days?.length) return null;
    return (
        <div style={{ marginTop: '4px' }}>
            {/* Header with theme */}
            <div style={{
                padding: '14px 16px 10px',
                borderBottom: '1px solid rgba(30,30,30,0.06)',
            }}>
                <div style={{
                    fontSize: '10px', fontWeight: 700, color: '#b6b5b5',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    fontFamily: satoshi, marginBottom: '5px',
                }}>
                    Week {plan.week_number}
                </div>
                <div style={{
                    fontSize: '16px', fontWeight: 700, color: '#111111',
                    fontFamily: clashDisplay, letterSpacing: '-0.03em',
                    lineHeight: 1.2, marginBottom: '6px',
                }}>
                    {plan.theme}
                </div>
                {plan.win_condition && (
                    <div style={{
                        fontSize: '12px', color: '#838282',
                        fontStyle: 'italic',
                        fontFamily: "'Georgia', 'Times New Roman', serif",
                        lineHeight: 1.4,
                    }}>
                        Win: {plan.win_condition}
                    </div>
                )}
            </div>

            {/* Days — tabular rows with alternating tint */}
            <div style={{ background: '#ffffff', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                {plan.days.map((day: any, idx: number) => (
                    <div key={idx} style={{
                        display: 'flex', gap: '0',
                        padding: '11px 16px',
                        borderBottom: idx < plan.days.length - 1 ? '1px solid rgba(30,30,30,0.04)' : 'none',
                        background: idx % 2 === 1 ? 'rgba(30,30,30,0.015)' : 'transparent',
                    }}>
                        <div style={{
                            fontSize: '11px', fontWeight: 700, color: '#111111',
                            fontFamily: clashDisplay, letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            minWidth: '70px', flexShrink: 0, paddingTop: '1px',
                        }}>
                            {day.day}
                        </div>
                        <div style={{
                            fontSize: '12px', color: '#838282',
                            lineHeight: '1.55', fontFamily: satoshi, fontWeight: 400,
                        }}>
                            {day.action}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Week drawer (slides in from right) — Swiss light theme ─────────────────
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
    weekPlan?: any;
    drawerTop?: number;
    onClose: () => void;
}) {
    const isCurrentWeek = isOngoing || isActiveCurrent;
    const isLockedPast = !isCurrentWeek;

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
                background: '#ffffff',
                border: '1px solid rgba(30,30,30,0.08)',
                borderRadius: '16px',
                boxShadow: '0 24px 60px rgba(30,30,30,0.12), 0 2px 8px rgba(30,30,30,0.06)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 500,
                fontFamily: satoshi,
            }}
        >
            {/* Header — Swiss minimal */}
            <div style={{
                padding: '16px 18px',
                borderBottom: '1px solid rgba(30,30,30,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#b6b5b5', margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: satoshi }}>
                        Week {weekNumber} {isLockedPast ? '— Plan' : ''}
                    </p>
                    <p style={{ fontSize: '11px', color: '#838282', margin: '2px 0 0 0', fontFamily: satoshi }}>
                        {isOngoing ? 'Recorded today' : isActiveCurrent ? 'Active now' : (report ? `${report.week_start} – ${report.week_end}` : 'Completed')}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        border: '1px solid rgba(30,30,30,0.08)', background: '#f2f2f2',
                        color: '#838282', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#111111'; e.currentTarget.style.color = '#f2f2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f2f2f2'; e.currentTarget.style.color = '#838282'; }}
                >
                    <X size={13} />
                </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#fafafa' }}>

                {/* ── CURRENT WEEK: show active state ── */}
                {isCurrentWeek && !r && (
                    <div style={{
                        padding: '16px', borderRadius: '12px',
                        background: '#ffffff',
                        border: '1px solid rgba(30,30,30,0.06)',
                        textAlign: 'center',
                    }}>
                        <p style={{ fontSize: '12px', color: '#838282', margin: 0, lineHeight: 1.5, fontWeight: 500, fontFamily: satoshi }}>
                            {isOngoing ? 'Voice logged today — great work.' : 'This is your current active week.'}
                        </p>
                        <p style={{ fontSize: '11px', color: '#b6b5b5', margin: '4px 0 0 0', fontFamily: satoshi }}>
                            {isOngoing ? 'Keep up the momentum.' : 'Keep journaling — report at week end.'}
                        </p>
                    </div>
                )}

                {/* ── Week plan (current or past) — Swiss tabular ── */}
                {planToShow && planToShow.days ? (
                    <WeekPlanDays plan={planToShow} />
                ) : (
                    !isCurrentWeek && (
                        <div style={{
                            padding: '16px', borderRadius: '12px',
                            border: '1px solid rgba(30,30,30,0.06)',
                            textAlign: 'center', color: '#b6b5b5', fontSize: '12px', lineHeight: 1.6,
                            background: '#ffffff', fontFamily: satoshi,
                        }}>
                            <FileText size={18} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.4, color: '#b6b5b5' }} />
                            Plan data not available for this week.
                        </div>
                    )
                )}

                {/* ── Last voice entry for past weeks ── */}
                {isLockedPast && lastJournalDay && (
                    <div style={{
                        padding: '12px 14px', borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid rgba(30,30,30,0.06)',
                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                    }}>
                        <Mic size={13} color="#838282" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                            <p style={{ fontSize: '9px', fontWeight: 700, color: '#b6b5b5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px', fontFamily: satoshi }}>
                                Last Voice Entry
                            </p>
                            <p style={{ fontSize: '12px', color: '#838282', margin: 0, lineHeight: 1.45, fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                                "{lastJournalDay.one_liner}"
                            </p>
                            {lastJournalDay.emotion && (
                                <p style={{ fontSize: '10px', color: '#b6b5b5', margin: '3px 0 0', fontWeight: 600, fontFamily: satoshi }}>
                                    {lastJournalDay.emotion} · {lastJournalDay.score}/10
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Collapsible Report Summary ── */}
                {isLockedPast && r && (
                    <div style={{ borderRadius: '10px', border: '1px solid rgba(30,30,30,0.06)', overflow: 'hidden', background: '#ffffff' }}>
                        <button
                            onClick={() => setShowReport(p => !p)}
                            style={{
                                width: '100%', padding: '11px 14px',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                background: 'transparent', border: 'none',
                                color: '#838282', cursor: 'pointer',
                                fontFamily: satoshi, fontSize: '10px', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                            }}
                        >
                            <span>Week Performance</span>
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
                                    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(30,30,30,0.06)' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <MiniStatCard label="Consistency" value={`${r.consistency_score ?? 0}%`} color="#10b981" />
                                            <MiniStatCard label="Avg Mood" value={`${r.avg_score ?? 0}/10`} color="#111111" />
                                        </div>
                                        {r.week_theme && (
                                            <div style={{
                                                padding: '10px 14px', borderRadius: '10px',
                                                background: '#f2f2f2',
                                                border: '1px solid rgba(30,30,30,0.04)',
                                                fontSize: '12px', color: '#111111', fontWeight: 600,
                                                fontFamily: clashDisplay,
                                            }}>
                                                {r.week_theme}
                                            </div>
                                        )}
                                        <MiniAnalysis label="What Went Well" content={r.what_went_well ?? ''} />
                                        <MiniAnalysis label="Where You Slipped" content={r.where_you_slipped ?? ''} />
                                        {r.hidden_insight && (
                                            <div style={{
                                                padding: '12px 14px', borderRadius: '10px',
                                                background: '#f2f2f2', border: '1px solid rgba(30,30,30,0.04)',
                                            }}>
                                                <p style={{ fontSize: '9px', fontWeight: 700, color: '#b6b5b5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: satoshi }}>Hidden Insight</p>
                                                <p style={{ fontSize: '12px', color: '#838282', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{r.hidden_insight}</p>
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
                            <MiniStatCard label="Avg Mood" value={`${r.avg_score ?? 0}/10`} color="#111111" />
                        </div>
                        <MiniAnalysis label="Emotional Arc" content={r.emotional_arc ?? ''} />
                        <MiniAnalysis label="What Went Well" content={r.what_went_well ?? ''} />
                        <MiniAnalysis label="Where You Slipped" content={r.where_you_slipped ?? ''} />
                        {r.hidden_insight && (
                            <div style={{
                                padding: '12px 14px', borderRadius: '10px',
                                background: '#f2f2f2', border: '1px solid rgba(30,30,30,0.04)',
                            }}>
                                <p style={{ fontSize: '9px', fontWeight: 700, color: '#b6b5b5', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', fontFamily: satoshi }}>Hidden Insight</p>
                                <p style={{ fontSize: '12px', color: '#838282', lineHeight: 1.6, margin: 0, fontFamily: satoshi }}>{r.hidden_insight}</p>
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768;
            setIsMobile(mobile);
            if (!mobile) setIsMobileMenuOpen(true); // always open on desktop
        };
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
                    right: isMobile ? 'auto' : 0,
                    left: isMobile ? 0 : 'auto',
                    top: isMobile ? 'auto' : '80px',
                    bottom: isMobile ? 0 : 'auto',
                    display: 'flex',
                    flexDirection: isMobile ? (isMobileMenuOpen ? 'column' : 'row') : 'column',
                    gap: '4px',
                    padding: isMobile ? '8px 16px' : '8px 0',
                    background: 'rgba(10,10,10,0.92)',
                    borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    borderRadius: isMobile ? '20px 20px 0 0' : '14px 0 0 14px',
                    boxShadow: isMobile ? '0 -10px 40px rgba(0,0,0,0.4)' : '-4px 0 24px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(12px)',
                    zIndex: 400,
                    minWidth: '52px',
                    width: isMobile ? '100%' : 'auto',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    fontFamily: "'Inter', sans-serif",
                }}
            >
                {/* Hamburger toggle on mobile */}
                {isMobile && (
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'transparent', border: 'none',
                            color: '#f2f2f2', cursor: 'pointer',
                            padding: '8px 4px', width: '100%',
                            justifyContent: 'center',
                        }}
                    >
                        <Menu size={20} />
                        {!isMobileMenuOpen && <span style={{ fontSize: '12px', fontWeight: 600 }}>WEEKS</span>}
                        {isMobileMenuOpen && <span style={{ fontSize: '12px', fontWeight: 600 }}>CLOSE</span>}
                    </button>
                )}

                <AnimatePresence>
                    {(!isMobile || isMobileMenuOpen) && (
                        <motion.div
                            initial={isMobile ? { height: 0, opacity: 0 } : undefined}
                            animate={isMobile ? { height: 'auto', opacity: 1 } : undefined}
                            exit={isMobile ? { height: 0, opacity: 0 } : undefined}
                            style={{ 
                                display: 'flex', 
                                flexDirection: isMobile ? 'row' : 'column',
                                flexWrap: isMobile ? 'wrap' : 'nowrap',
                                gap: '8px',
                                width: '100%',
                                justifyContent: isMobile ? 'center' : 'center',
                                padding: isMobile ? '10px 0' : '0'
                            }}
                        >
                            {groups.map((group, gi) => {
                                const groupKey = `${group.startWeek}-${group.endWeek}`;
                                const isGroupExpanded = expandedGroups.has(groupKey);
                                const showGrouped = group.weeks.length >= 5;

                                if (showGrouped) {
                                    return (
                                        <div key={groupKey} className="week-group-col" style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '3px', alignItems: 'center', width: isMobile ? 'auto' : '100%' }}>
                                            <button
                                                onClick={() => toggleGroup(groupKey)}
                                                title={`${group.label} — click to ${isGroupExpanded ? 'collapse' : 'expand'}`}
                                                style={{
                                                    width: isMobile ? 'auto' : '44px',
                                                    padding: '7px 8px',
                                                    borderRadius: '9px',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    background: isGroupExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                                                    color: 'rgba(255,255,255,0.55)',
                                                    cursor: 'pointer',
                                                    display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: 'center', gap: '4px',
                                                    transition: 'all 0.15s',
                                                    fontFamily: "'Inter', sans-serif",
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = isGroupExpanded ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
                                            >
                                                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.1, textAlign: 'center' }}>
                                                    {group.startWeek}–{group.endWeek}
                                                </span>
                                                {isGroupExpanded ? (isMobile ? <ChevronRight size={10} /> : <ChevronDown size={9} />) : (isMobile ? <ChevronDown size={10} /> : <ChevronRight size={9} />)}
                                            </button>

                                            <AnimatePresence>
                                                {isGroupExpanded && (
                                                    <motion.div
                                                        className="week-group-col"
                                                        initial={{ opacity: 0, width: isMobile ? 0 : 'auto', height: isMobile ? 'auto' : 0 }}
                                                        animate={{ opacity: 1, width: 'auto', height: 'auto' }}
                                                        exit={{ opacity: 0, width: isMobile ? 0 : 'auto', height: isMobile ? 'auto' : 0 }}
                                                        style={{ overflow: 'hidden', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '3px', alignItems: 'center', width: isMobile ? 'auto' : '100%' }}
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

                                            {gi < groups.length - 1 && !isMobile && (
                                                <div className="week-divider" style={{ width: '28px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <div key={groupKey} className="week-group-col" style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '3px', alignItems: 'center', width: isMobile ? 'auto' : '100%', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                                        {group.weeks.map(w => (
                                            <WeekPill
                                                key={w.weekNumber}
                                                item={w}
                                                isSelected={selectedWeek === w.weekNumber}
                                                onClick={(e) => handleWeekClick(w.weekNumber, e)}
                                            />
                                        ))}
                                        {gi < groups.length - 1 && !isMobile && (
                                            <div className="week-divider" style={{ width: '28px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
                                        )}
                                    </div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
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
