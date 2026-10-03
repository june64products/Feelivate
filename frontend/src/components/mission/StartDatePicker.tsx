import { useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { satoshi } from './missionTheme';
import { addDays, daysBetween, formatDay, localISODate, nextMonday, projectedWeekWindow, windowFrom } from '../../lib/weekWindow';

/** Mirrors MAX_START_LEAD_DAYS on the server. */
export const MAX_START_LEAD_DAYS = 14;

export type StartChoice = 'today' | 'tomorrow' | 'monday' | 'custom';

interface StartDatePickerProps {
    /** The session's very first plan may begin today however short the week is. */
    isFirstPlan: boolean;
    value: string;                 // ISO date the week will begin
    onChange: (iso: string) => void;
}

/**
 * When should the week begin? Locking a plan used to mean "from today", and
 * people who needed a day or two to get set simply never locked it. The
 * choice lives beside the commit button: today, tomorrow, next Monday, or a
 * date within the next two weeks — with the resulting window spelled out.
 */
export default function StartDatePicker({ isFirstPlan, value, onChange }: StartDatePickerProps) {
    const today = localISODate();
    const defaultWindow = useMemo(() => projectedWeekWindow(today, isFirstPlan), [today, isFirstPlan]);
    const tomorrow = addDays(today, 1);
    const monday = nextMonday(today);
    const maxDate = addDays(today, MAX_START_LEAD_DAYS);

    const [customOpen, setCustomOpen] = useState(false);

    const choice: StartChoice =
        value === defaultWindow.start ? 'today'
        : value === tomorrow ? 'tomorrow'
        : value === monday ? 'monday'
        : 'custom';

    const window_ = windowFrom(value);
    const lead = daysBetween(today, value);

    const options: { key: StartChoice; label: string; sub: string; iso: string }[] = [
        {
            key: 'today',
            label: defaultWindow.startsLater ? `Next ${formatDay(defaultWindow.start).split(',')[0]}` : 'Today',
            sub: defaultWindow.startsLater ? 'the default' : 'start right now',
            iso: defaultWindow.start,
        },
        { key: 'tomorrow', label: 'Tomorrow', sub: formatDay(tomorrow), iso: tomorrow },
        { key: 'monday', label: 'Next Monday', sub: formatDay(monday), iso: monday },
    ];
    // Collapse duplicates (e.g. the default already is tomorrow or next Monday).
    const seen = new Set<string>();
    const distinct = options.filter((o) => (seen.has(o.iso) ? false : (seen.add(o.iso), true)));

    const pill = (active: boolean): React.CSSProperties => ({
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px',
        padding: '9px 13px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
        border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
        background: active ? 'var(--accent-primary)' : 'transparent',
        color: active ? 'var(--btn-primary-text)' : 'var(--text-primary)',
        fontFamily: satoshi, minWidth: '0', flex: '1 1 120px',
        transition: 'background 140ms ease, color 140ms ease, border-color 140ms ease',
    });

    return (
        <div data-tour="start-date" style={{ padding: '14px 24px 4px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <CalendarDays size={13} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: satoshi }}>
                    When do you want to start?
                </span>
            </div>

            <div role="radiogroup" aria-label="Start date" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {distinct.map((o) => {
                    const active = choice === o.key || (choice === 'custom' && false);
                    return (
                        <button
                            key={o.key}
                            type="button"
                            role="radio"
                            aria-checked={active && !customOpen}
                            onClick={() => { setCustomOpen(false); onChange(o.iso); }}
                            style={pill(active && !customOpen)}
                        >
                            <span style={{ fontSize: '13px', fontWeight: 700 }}>{o.label}</span>
                            <span style={{ fontSize: '11px', opacity: 0.75 }}>{o.sub}</span>
                        </button>
                    );
                })}
                <button
                    type="button"
                    role="radio"
                    aria-checked={choice === 'custom' || customOpen}
                    onClick={() => setCustomOpen(true)}
                    style={pill(choice === 'custom' || customOpen)}
                >
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>Pick a date</span>
                    <span style={{ fontSize: '11px', opacity: 0.75 }}>{choice === 'custom' ? formatDay(value) : `within ${MAX_START_LEAD_DAYS} days`}</span>
                </button>
            </div>

            {customOpen && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <input
                        type="date"
                        value={value}
                        min={today}
                        max={maxDate}
                        onChange={(e) => {
                            const v = e.target.value;
                            if (v && v >= today && v <= maxDate) onChange(v);
                        }}
                        aria-label="Start date"
                        style={{
                            padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-medium)',
                            background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: satoshi,
                        }}
                    />
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: satoshi }}>
                        Up to {formatDay(maxDate)}.
                    </span>
                </div>
            )}

            <p style={{ margin: '12px 0 8px', fontSize: '12.5px', lineHeight: 1.55, color: 'var(--text-secondary)', fontFamily: satoshi }}>
                {lead > 0 ? (
                    <>
                        <strong style={{ color: 'var(--text-primary)' }}>Week starts {formatDay(window_.start)}</strong>
                        {' '}({lead === 1 ? 'tomorrow' : `in ${lead} days`}) and runs to {formatDay(window_.end)} — {window_.dayCount} day{window_.dayCount === 1 ? '' : 's'}.
                        {' '}Nothing is due before then; you'll get a short note each of the last {Math.min(lead, 3)} day{Math.min(lead, 3) === 1 ? '' : 's'} to get ready.
                    </>
                ) : (
                    <>
                        <strong style={{ color: 'var(--text-primary)' }}>Starts today</strong> and runs to {formatDay(window_.end)} — {window_.dayCount} day{window_.dayCount === 1 ? '' : 's'}. Your first task is today's.
                    </>
                )}
            </p>
        </div>
    );
}
