import { motion } from 'framer-motion';
import { Check, Shield, Gift, Lock, Minus } from 'lucide-react';
import { satoshi, ACCENT_AMBER, SHIELD_BLUE, dayLetter, easeSilk } from './missionTheme';
import type { StreakData } from '../../api';

interface PathRowProps {
    streak: StreakData | null;
    todayIso: string;
    currentWeek: number;
    winCondition?: string;
    /** Opens the Journey (week detail / report) — same view the old panel opened. */
    onOpenJourney: () => void;
}

type NodeKind = 'done' | 'shielded' | 'skipped' | 'today' | 'upcoming';

/**
 * The week as a path. Data comes straight from /streak's days_this_week — the
 * same array the old StreakBar ring rendered, drawn as a journey instead.
 * The gift node at the end is the week report gate (opens Journey).
 */
export default function PathRow({ streak, todayIso, currentWeek, winCondition, onOpenJourney }: PathRowProps) {
    const days = (() => {
        if (streak?.days_this_week && streak.days_this_week.length > 0) return streak.days_this_week;
        const d = new Date(`${todayIso}T12:00:00`);
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(mon);
            day.setDate(mon.getDate() + i);
            const y = day.getFullYear(), m = String(day.getMonth() + 1).padStart(2, '0'), dd = String(day.getDate()).padStart(2, '0');
            return { date: `${y}-${m}-${dd}`, status: 'pending' as const };
        });
    })();

    const kindOf = (d: { date: string; status: string }): NodeKind => {
        if (d.date === todayIso && d.status !== 'done' && d.status !== 'skipped') return 'today';
        if (d.status === 'done') return 'done';
        if (d.status === 'shielded') return 'shielded';
        if (d.status === 'skipped' || (d.date < todayIso && d.status === 'pending')) return 'skipped';
        return 'upcoming';
    };

    const nodeStyle = (kind: NodeKind): React.CSSProperties => {
        const base: React.CSSProperties = {
            width: '38px', height: '38px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        };
        switch (kind) {
            case 'done': return { ...base, background: `${ACCENT_AMBER}26`, border: `1.5px solid ${ACCENT_AMBER}`, color: ACCENT_AMBER };
            case 'shielded': return { ...base, background: `${SHIELD_BLUE}1f`, border: `1.5px solid ${SHIELD_BLUE}`, color: SHIELD_BLUE };
            case 'skipped': return { ...base, background: 'transparent', border: '1.5px dashed var(--border-medium)', color: 'var(--text-muted)' };
            case 'today': return {
                ...base, width: '46px', height: '46px',
                background: 'var(--btn-primary-bg)', border: 'none', color: 'var(--btn-primary-text)',
                boxShadow: '0 0 0 5px var(--glass-hover)',
            };
            default: return { ...base, background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' };
        }
    };

    const icon = (kind: NodeKind, d: { date: string }) => {
        switch (kind) {
            case 'done': return <Check size={17} strokeWidth={3} />;
            case 'shielded': return <Shield size={15} />;
            case 'skipped': return <Minus size={14} />;
            case 'today': return <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: satoshi }}>{dayLetter(d.date)}</span>;
            default: return <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: satoshi }}>{dayLetter(d.date)}</span>;
        }
    };

    return (
        <motion.div
            data-tour="week-panel"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: easeSilk as any }}
            style={{
                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                borderRadius: '18px', padding: '16px 20px',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{
                    fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
                }}>
                    Your path · Week {currentWeek}
                </span>
                <span style={{ flex: 1 }} />
                {winCondition && (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: satoshi }}>
                        Win: {winCondition}
                    </span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: '4px' }}>
                {days.map((d, i) => {
                    const kind = kindOf(d);
                    return (
                        <div key={d.date} style={{ display: 'flex', alignItems: 'center' }}>
                            {i > 0 && (
                                <div style={{
                                    width: '22px', height: '2px', flexShrink: 0,
                                    background: kind === 'upcoming' ? 'var(--border-subtle)' : 'var(--border-medium)',
                                }} />
                            )}
                            <motion.div
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.15 + i * 0.05, type: 'spring', stiffness: 300, damping: 22 }}
                                title={`${d.date} · ${d.status}`}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                            >
                                <motion.div
                                    animate={kind === 'today' ? { scale: [1, 1.06, 1] } : {}}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    style={nodeStyle(kind)}
                                >
                                    {icon(kind, d)}
                                </motion.div>
                            </motion.div>
                        </div>
                    );
                })}

                {/* Week gate → report / journey */}
                <div style={{ width: '22px', height: '2px', flexShrink: 0, background: 'var(--border-subtle)' }} />
                <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onOpenJourney}
                    title="Week report & journey"
                    style={{
                        width: '42px', height: '42px', borderRadius: '13px',
                        border: '1px solid var(--border-medium)', background: 'var(--bg-surface)',
                        color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                    }}
                >
                    <Gift size={17} />
                </motion.button>
                <div style={{ width: '22px', height: '2px', flexShrink: 0, background: 'var(--border-subtle)' }} />
                <div
                    title={`Week ${currentWeek + 1} — unlocks after this week's report`}
                    style={{
                        width: '38px', height: '38px', borderRadius: '50%',
                        border: '1.5px dashed var(--border-subtle)', color: 'var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}
                >
                    <Lock size={13} />
                </div>
            </div>
        </motion.div>
    );
}
