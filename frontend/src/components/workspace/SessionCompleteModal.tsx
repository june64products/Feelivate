import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Loader2, TrendingUp, Award, Zap, ArrowRight } from 'lucide-react';
import { completeSession, type SessionReport } from '../../api';

interface Props {
    sessionId: string;
    sessionFocus?: string;
    onClose: () => void;
    onConfirmed: () => void;
}

type Step = 'confirm' | 'loading' | 'report';

export default function SessionCompleteModal({ sessionId, sessionFocus, onClose, onConfirmed }: Props) {
    const [step, setStep] = useState<Step>('confirm');
    const [report, setReport] = useState<SessionReport | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleStop = async () => {
        setStep('loading');
        setError(null);
        try {
            const result = await completeSession(sessionId);
            setReport(result.report);
            setStep('report');
            onConfirmed();
        } catch (e) {
            setError('Could not generate report. Session has been marked complete.');
            setStep('report');
            onConfirmed();
        }
    };

    const overlay: React.CSSProperties = {
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
    };

    const card: React.CSSProperties = {
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '88vh',
        overflowY: 'auto',
        padding: '32px',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={overlay}
                onClick={(e) => { if (e.target === e.currentTarget && step !== 'loading') onClose(); }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    style={card}
                >
                    {/* Close */}
                    {step !== 'loading' && (
                        <button
                            onClick={onClose}
                            style={{
                                position: 'absolute', top: '20px', right: '20px',
                                width: '28px', height: '28px', borderRadius: '8px',
                                background: 'transparent', border: 'none',
                                color: '#555', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}

                    {/* Step 1: Confirm */}
                    {step === 'confirm' && (
                        <div>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '14px',
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: '20px',
                            }}>
                                <Zap size={22} color="#f87171" />
                            </div>

                            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                                Stop this plan?
                            </h2>
                            <p style={{ fontSize: '13.5px', color: '#71717a', lineHeight: 1.6, margin: '0 0 8px' }}>
                                {sessionFocus ? (
                                    <>You're about to complete your plan: <span style={{ color: '#a1a1aa' }}>"{sessionFocus}"</span></>
                                ) : 'You are about to complete this plan.'}
                            </p>
                            <p style={{ fontSize: '13px', color: '#52525b', lineHeight: 1.6, margin: '0 0 28px' }}>
                                A final summary report will be generated. The chat will still work for general questions, but no new weekly plans will be created.
                            </p>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        flex: 1, padding: '11px', borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        background: 'transparent', color: '#a1a1aa',
                                        fontSize: '13.5px', fontWeight: 500, cursor: 'pointer',
                                        transition: 'background 0.15s',
                                        fontFamily: "'Inter', sans-serif",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    Keep going
                                </button>
                                <button
                                    onClick={handleStop}
                                    style={{
                                        flex: 1, padding: '11px', borderRadius: '10px',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        background: 'rgba(239,68,68,0.08)',
                                        color: '#f87171', fontSize: '13.5px', fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                        fontFamily: "'Inter', sans-serif",
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                >
                                    Yes, stop plan
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Loading */}
                    {step === 'loading' && (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <Loader2
                                size={36}
                                color="#a1a1aa"
                                style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }}
                            />
                            <h3 style={{ fontSize: '17px', color: '#e4e4e7', fontWeight: 600, margin: '0 0 8px' }}>
                                Generating your report...
                            </h3>
                            <p style={{ fontSize: '13px', color: '#52525b' }}>
                                Analysing your journey across all weeks
                            </p>
                        </div>
                    )}

                    {/* Step 3: Report */}
                    {step === 'report' && (
                        <div>
                            {/* Header */}
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '14px',
                                    background: 'rgba(74,222,128,0.08)',
                                    border: '1px solid rgba(74,222,128,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginBottom: '16px',
                                }}>
                                    <Award size={22} color="#4ade80" />
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                                    Plan Complete
                                </h2>
                                {report?.headline && (
                                    <p style={{ fontSize: '14px', color: '#a1a1aa', margin: 0, lineHeight: 1.5 }}>
                                        {report.headline}
                                    </p>
                                )}
                            </div>

                            {error && (
                                <div style={{
                                    padding: '12px', borderRadius: '10px',
                                    background: 'rgba(239,68,68,0.08)',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                    color: '#fca5a5', fontSize: '12.5px', marginBottom: '20px',
                                }}>
                                    {error}
                                </div>
                            )}

                            {report && (
                                <>
                                    {/* Stats row */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: '10px', marginBottom: '24px',
                                    }}>
                                        {[
                                            { label: 'Weeks', value: report.stats?.total_weeks ?? '—' },
                                            { label: 'Days Done', value: report.stats?.days_done ?? '—' },
                                            { label: 'Total Days', value: report.stats?.days_total ?? '—' },
                                            { label: 'Avg Mood', value: report.stats?.avg_mood ? `${report.stats.avg_mood}/10` : '—' },
                                        ].map((s) => (
                                            <div key={s.label} style={{
                                                padding: '14px 10px', borderRadius: '12px',
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.07)',
                                                textAlign: 'center',
                                            }}>
                                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#e4e4e7', lineHeight: 1 }}>
                                                    {s.value}
                                                </div>
                                                <div style={{ fontSize: '10.5px', color: '#52525b', marginTop: '4px', fontWeight: 500 }}>
                                                    {s.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Biggest wins */}
                                    {report.biggest_wins?.length > 0 && (
                                        <Section title="Biggest Wins" icon={<Check size={14} color="#4ade80" />}>
                                            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {report.biggest_wins.map((w, i) => (
                                                    <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5 }}>
                                                        <span style={{ color: '#4ade80', flexShrink: 0, marginTop: '2px' }}>
                                                            <ArrowRight size={13} />
                                                        </span>
                                                        {w}
                                                    </li>
                                                ))}
                                            </ul>
                                        </Section>
                                    )}

                                    {/* Growth arc */}
                                    {report.growth_arc && (
                                        <Section title="Your Growth Arc" icon={<TrendingUp size={14} color="#60a5fa" />}>
                                            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: 1.65 }}>
                                                {report.growth_arc}
                                            </p>
                                        </Section>
                                    )}

                                    {/* Next chapter */}
                                    {report.advice_for_next_chapter && (
                                        <Section title="Next Chapter" icon={<Zap size={14} color="#fbbf24" />}>
                                            <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0, lineHeight: 1.65 }}>
                                                {report.advice_for_next_chapter}
                                            </p>
                                        </Section>
                                    )}
                                </>
                            )}

                            <button
                                onClick={onClose}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '10px',
                                    background: '#ffffff', border: 'none',
                                    color: '#000', fontSize: '13.5px', fontWeight: 600,
                                    cursor: 'pointer', marginTop: '24px',
                                    transition: 'opacity 0.15s',
                                    fontFamily: "'Inter', sans-serif",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                            >
                                Close
                            </button>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{
            padding: '14px 16px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            marginBottom: '12px',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.06em',
                textTransform: 'uppercase', color: '#52525b', marginBottom: '10px',
            }}>
                {icon}
                {title}
            </div>
            {children}
        </div>
    );
}
