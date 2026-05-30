import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, X, Lock, Sparkles, FileText } from 'lucide-react';
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

// ─── Week drawer (slides in from right) ──────────────────────────────────────
function WeekDrawer({
    weekNumber,
    report,
    isOngoing,
    onClose,
}: {
    weekNumber: number;
    report: ArchivedWeekReport | null;
    isOngoing: boolean;
    onClose: () => void;
}) {
    const accentColor = isOngoing ? '#818cf8' : '#6b7280';
    const accentBg = isOngoing ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.04)';
    const accentBorder = isOngoing ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.1)';

    const r = report?.report;

    return (
        <motion.div
            key={`drawer-${weekNumber}`}
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
                position: 'fixed',
                right: 60, // offset from the pill panel
                top: '50%',
                transform: 'translateY(-50%)',
                width: '300px',
                maxHeight: '80vh',
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
                        background: isOngoing ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {isOngoing
                            ? <Sparkles size={13} color={accentColor} />
                            : <FileText size={13} color={accentColor} />
                        }
                    </div>
                    <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>
                            Week {weekNumber}
                        </p>
                        <p style={{ fontSize: '10px', color: isOngoing ? '#818cf8' : 'rgba(255,255,255,0.35)', margin: 0, marginTop: '1px' }}>
                            {isOngoing ? 'Ongoing ✦' : (report ? `${report.week_start} – ${report.week_end}` : 'Locked')}
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
                {isOngoing && !r && (
                    <div style={{
                        padding: '20px', borderRadius: '12px',
                        background: 'rgba(99,102,241,0.06)',
                        border: '1px dashed rgba(99,102,241,0.2)',
                        textAlign: 'center',
                    }}>
                        <Sparkles size={20} color="#818cf8" style={{ margin: '0 auto 10px' }} />
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.5 }}>
                            This is your current active week.<br />
                            Keep journaling — your report appears at week end.
                        </p>
                    </div>
                )}

                {!isOngoing && !r && (
                    <div style={{
                        padding: '20px', borderRadius: '12px',
                        border: '1px dashed rgba(255,255,255,0.1)',
                        textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '12px', lineHeight: 1.6,
                    }}>
                        <Lock size={18} style={{ margin: '0 auto 10px', display: 'block' }} />
                        No report available for this week yet.
                    </div>
                )}

                {r && (
                    <>
                        {/* Stats */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <MiniStatCard label="Consistency" value={`${r.consistency_score ?? 0}%`} color="#10b981" />
                            <MiniStatCard label="Avg Mood" value={`${r.avg_score ?? 0}/10`} color="#60a5fa" />
                        </div>

                        {/* Theme badge */}
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

                        {/* Analysis blocks */}
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

export default function LockedWeeksPanel({ sessionId, currentWeek, micLocked }: LockedWeeksPanelProps) {
    const [reports, setReports] = useState<ArchivedWeekReport[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [loadedReports, setLoadedReports] = useState(false);

    // Load archived reports once
    useEffect(() => {
        if (!sessionId || loadedReports) return;
        getSessionReports(sessionId)
            .then(r => { setReports(r); setLoadedReports(true); })
            .catch(() => { setLoadedReports(true); });
    }, [sessionId]);

    // Build list of week items — locked past weeks + current ongoing week
    const weekItems: WeekButtonItem[] = [];
    // Past locked weeks (from archived reports)
    const lockedWeekNums = reports.map(r => r.week_number).sort((a, b) => a - b);
    lockedWeekNums.forEach(wn => {
        if (wn !== currentWeek) {
            weekItems.push({ weekNumber: wn, isOngoing: false, isLocked: true });
        }
    });
    // Add current week as ongoing
    if (micLocked) {
        weekItems.push({ weekNumber: currentWeek, isOngoing: true, isLocked: false });
    }
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
            isCollapsed: chunk.length >= 5, // auto-collapse full groups
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

    const handleWeekClick = (weekNumber: number) => {
        setSelectedWeek(prev => prev === weekNumber ? null : weekNumber);
    };

    const getReportForWeek = (wn: number): ArchivedWeekReport | null =>
        reports.find(r => r.week_number === wn) ?? null;

    const selectedReport = selectedWeek !== null ? getReportForWeek(selectedWeek) : null;
    const isSelectedOngoing = selectedWeek === currentWeek;

    if (weekItems.length === 0) return null;

    return (
        <>
            {/* ── Floating pill panel on right edge ── */}
            <motion.div
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: 'spring', damping: 22, stiffness: 250, delay: 0.1 }}
                style={{
                    position: 'fixed',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
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
                            <div key={groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', width: '100%' }}>
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
                                                    onClick={() => handleWeekClick(w.weekNumber)}
                                                />
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Divider between groups */}
                                {gi < groups.length - 1 && (
                                    <div style={{ width: '28px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
                                )}
                            </div>
                        );
                    }

                    // Less than 5 in group → show individually
                    return (
                        <div key={groupKey} style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center', width: '100%' }}>
                            {group.weeks.map(w => (
                                <WeekPill
                                    key={w.weekNumber}
                                    item={w}
                                    isSelected={selectedWeek === w.weekNumber}
                                    onClick={() => handleWeekClick(w.weekNumber)}
                                />
                            ))}
                            {gi < groups.length - 1 && (
                                <div style={{ width: '28px', height: '1px', background: 'rgba(255,255,255,0.07)', margin: '2px 0' }} />
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
                        isOngoing={isSelectedOngoing}
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
    onClick: () => void;
}) {
    const { weekNumber, isOngoing } = item;

    // Color scheme
    const bgColor = isSelected
        ? isOngoing ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.12)'
        : isOngoing ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)';

    const borderColor = isSelected
        ? isOngoing ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.25)'
        : isOngoing ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)';

    const textColor = isSelected
        ? isOngoing ? '#a5b4fc' : 'white'
        : isOngoing ? '#818cf8' : 'rgba(255,255,255,0.4)';

    return (
        <motion.button
            layout
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={onClick}
            title={isOngoing ? `Week ${weekNumber} (ongoing)` : `Week ${weekNumber} (locked)`}
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
                e.currentTarget.style.background = isOngoing ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.09)';
                e.currentTarget.style.color = isOngoing ? '#a5b4fc' : 'rgba(255,255,255,0.8)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = bgColor;
                e.currentTarget.style.color = textColor;
            }}
        >
            {/* Lock / sparkle icon */}
            {isOngoing
                ? <Sparkles size={10} />
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
                        background: isOngoing ? '#818cf8' : '#e4e4e7',
                    }}
                />
            )}
        </motion.button>
    );
}
