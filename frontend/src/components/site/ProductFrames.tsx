import { Check, Flame, Mail, TrendingUp } from 'lucide-react';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/**
 * The product, drawn in the product's own components.
 *
 * These are real DOM built from the same tokens the app uses, not screenshots
 * and not generated pictures of an interface. That matters three ways: they are
 * sharp at any density, they follow the visitor's light/dark theme, and they
 * cannot drift into showing a version of Feelivate that no longer exists — a
 * risk both a stale PNG and an invented mockup carry.
 */

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
    return (
        <div
            role="img"
            aria-label={label}
            style={{
                border: '1px solid var(--border-medium)',
                borderRadius: '10px',
                background: 'var(--card-bg)',
                boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Window chrome — reads as "a screen" without faking a browser. */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '10px 12px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
                flexShrink: 0,
            }}>
                {['#ef4444', '#eab308', '#22c55e'].map(c => (
                    <span key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, opacity: 0.55 }} />
                ))}
            </div>
            <div style={{ padding: '16px', flex: 1, minHeight: 0 }}>{children}</div>
        </div>
    );
}

const kicker: React.CSSProperties = {
    fontSize: '9px', fontWeight: 700, letterSpacing: '0.14em',
    textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
};

/** Chat → the mentor answers and hands over a week. */
export function ChatFrame() {
    return (
        <Frame label="The Feelivate mentor replying in chat with a locked week plan">
            <div style={{
                alignSelf: 'flex-start', maxWidth: '92%',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: '12px', padding: '10px 12px', marginBottom: '10px',
                fontSize: '11.5px', lineHeight: 1.55, color: 'var(--text-secondary)',
                fontFamily: satoshi, fontWeight: 500,
            }}>
                Two runs this week, not four — you told me you burn out. Habit first.
            </div>

            <div style={{ border: '1px solid var(--border-medium)', borderRadius: '9px', overflow: 'hidden' }}>
                <div style={{ padding: '11px 13px 9px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ ...kicker, marginBottom: '4px' }}>Week 1</div>
                    <div style={{
                        fontSize: '14px', fontWeight: 700, fontFamily: clash,
                        letterSpacing: '-0.02em', color: 'var(--text-primary)',
                    }}>
                        Build the running habit
                    </div>
                </div>
                {[
                    ['Mon', 'Easy 20-minute walk + 5 min light jog'],
                    ['Tue', 'Rest or gentle stretching'],
                    ['Wed', 'Intervals: 1 min jog, 2 min walk × 6'],
                ].map(([d, a], i) => (
                    <div key={d} style={{
                        display: 'flex', gap: '10px', padding: '8px 13px',
                        borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                        background: i % 2 === 1 ? 'var(--glass-surface)' : 'transparent',
                    }}>
                        <span style={{
                            ...kicker, color: 'var(--text-primary)', width: '30px',
                            flexShrink: 0, paddingTop: '2px',
                        }}>{d}</span>
                        <span style={{
                            fontSize: '11px', color: 'var(--text-secondary)',
                            lineHeight: 1.5, fontFamily: satoshi,
                        }}>{a}</span>
                    </div>
                ))}
                <div style={{ display: 'flex', gap: '7px', padding: '10px 13px', borderTop: '1px solid var(--border-subtle)' }}>
                    <span style={{
                        flex: 1, textAlign: 'center', padding: '7px', borderRadius: '100px',
                        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                        fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase', fontFamily: satoshi,
                    }}>Let's go</span>
                    <span style={{
                        padding: '7px 14px', borderRadius: '100px',
                        border: '1px solid var(--accent-primary)', color: 'var(--text-primary)',
                        fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em',
                        textTransform: 'uppercase', fontFamily: satoshi,
                    }}>Tweak</span>
                </div>
            </div>
        </Frame>
    );
}

/** Daily email → the task arrives before you've decided anything. */
export function EmailFrame() {
    return (
        <Frame label="The daily Feelivate task email">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{
                    width: '24px', height: '24px', borderRadius: '7px',
                    background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Mail size={12} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <div style={{
                        fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                        fontFamily: clash, letterSpacing: '-0.01em',
                    }}>
                        Wednesday · your task
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontFamily: satoshi, marginTop: '1px' }}>
                        7:00 AM · your time
                    </div>
                </div>
            </div>

            <div style={{
                border: '1px solid var(--border-subtle)', borderRadius: '8px',
                padding: '12px', background: 'var(--bg-primary)', marginBottom: '10px',
            }}>
                <div style={{ ...kicker, color: 'var(--accent-warm)', marginBottom: '5px' }}>Today</div>
                <div style={{
                    fontSize: '13.5px', fontWeight: 700, fontFamily: clash,
                    letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: '5px',
                }}>
                    Intervals: 1 min jog, 2 min walk × 6
                </div>
                <p style={{
                    fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.55,
                    fontFamily: satoshi, fontWeight: 500, margin: 0,
                }}>
                    Easy pace — the goal is to show up, not to race. Lay your shoes out tonight.
                </p>
            </div>

            <div style={{ ...kicker, marginBottom: '6px' }}>How to do it well</div>
            {['Start slower than feels right', "Stop while you still have something left"].map(t => (
                <div key={t} style={{ display: 'flex', gap: '7px', marginBottom: '5px' }}>
                    <span style={{ color: 'var(--accent-warm)', fontSize: '11px', lineHeight: 1.5 }}>•</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: satoshi }}>{t}</span>
                </div>
            ))}
        </Frame>
    );
}

/** Weekly report → done versus promised, without the flattery. */
export function ReportFrame() {
    return (
        <Frame label="An end-of-week Feelivate report showing days done versus missed">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={kicker}>Week 1 · Report</div>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    fontSize: '10px', fontWeight: 700, color: 'var(--accent-warm)', fontFamily: satoshi,
                }}>
                    <Flame size={11} /> 5-day streak
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginBottom: '12px' }}>
                {[
                    ['86%', 'Consistency', 'var(--text-primary)'],
                    ['6', 'Done', '#10b981'],
                    ['1', 'Missed', '#ef4444'],
                ].map(([v, l, c]) => (
                    <div key={l} style={{
                        padding: '9px 10px', borderRadius: '8px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                    }}>
                        <div style={{
                            fontSize: '17px', fontWeight: 700, color: c,
                            fontFamily: clash, letterSpacing: '-0.03em', lineHeight: 1,
                        }}>{v}</div>
                        <div style={{ ...kicker, marginTop: '3px', fontSize: '8px' }}>{l}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                {[true, true, true, false, true, true, true].map((done, i) => (
                    <div key={i} style={{
                        flex: 1, height: '24px', borderRadius: '5px',
                        background: done ? 'var(--accent-warm)' : 'var(--border-medium)',
                        opacity: done ? 0.9 : 0.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        {done && <Check size={10} style={{ color: '#fff' }} />}
                    </div>
                ))}
            </div>

            <div style={{
                padding: '10px 11px', borderRadius: '8px',
                background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)',
                display: 'flex', gap: '8px',
            }}>
                <TrendingUp size={13} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '1px' }} />
                <p style={{
                    fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.55,
                    fontFamily: satoshi, fontWeight: 500, margin: 0,
                }}>
                    You skipped Thursday — same as last week. Both were days you had
                    an evening plan. Week 2 moves that run to the morning.
                </p>
            </div>
        </Frame>
    );
}
