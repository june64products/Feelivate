import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flag } from 'lucide-react';
import { completeSession } from '../../api';

interface Props {
    sessionId: string;
    sessionFocus?: string;
    onClose: () => void;
    onConfirmed: () => void;
}

/**
 * "Finish this goal?" — one question, one tap. Nothing is generated and
 * nothing is waited for: the goal is closed the moment they confirm.
 */
export default function SessionCompleteModal({ sessionId, sessionFocus, onClose, onConfirmed }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFinish = async () => {
        setBusy(true);
        setError(null);
        try {
            await completeSession(sessionId);
            onConfirmed();
        } catch {
            setBusy(false);
            setError("Couldn't reach the server. Check your connection and try once more.");
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
        maxWidth: '480px',
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
                onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    style={card}
                    role="dialog"
                    aria-labelledby="finish-goal-title"
                >
                    {!busy && (
                        <button
                            onClick={onClose}
                            aria-label="Close"
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

                    <div style={{
                        width: '48px', height: '48px', borderRadius: '14px',
                        background: 'rgba(217,119,87,0.12)',
                        border: '1px solid rgba(217,119,87,0.28)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: '20px',
                    }}>
                        <Flag size={22} color="#d97757" />
                    </div>

                    <h2 id="finish-goal-title" style={{ fontSize: '20px', fontWeight: 700, color: '#f0f0f0', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
                        Finish this goal?
                    </h2>
                    <p style={{ fontSize: '13.5px', color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 14px' }}>
                        {sessionFocus ? <>You're closing <span style={{ color: '#e4e4e7' }}>"{sessionFocus}"</span>.</> : 'You are closing this goal.'}
                    </p>
                    <ul style={{ margin: '0 0 24px', padding: '0 0 0 18px', fontSize: '13px', color: '#71717a', lineHeight: 1.7 }}>
                        <li>No more weekly plans, reviews or task emails for it.</li>
                        <li>Your mentor stays here to talk, any time.</li>
                        <li>Every week you recorded stays in the archive.</li>
                        <li>This can't be undone — a fresh start is a new goal.</li>
                    </ul>

                    {error && (
                        <div role="alert" style={{
                            padding: '12px', borderRadius: '10px',
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.15)',
                            color: '#fca5a5', fontSize: '12.5px', marginBottom: '16px',
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={onClose}
                            disabled={busy}
                            style={{
                                flex: 1, padding: '11px', borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: 'transparent', color: '#a1a1aa',
                                fontSize: '13.5px', fontWeight: 500, cursor: busy ? 'default' : 'pointer',
                                transition: 'background 0.15s',
                                fontFamily: "'Inter', sans-serif",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                            Keep going
                        </button>
                        <button
                            onClick={handleFinish}
                            disabled={busy}
                            style={{
                                flex: 1, padding: '11px', borderRadius: '10px',
                                border: '1px solid rgba(217,119,87,0.4)',
                                background: 'rgba(217,119,87,0.12)',
                                color: '#e8a07f', fontSize: '13.5px', fontWeight: 600,
                                cursor: busy ? 'default' : 'pointer', transition: 'all 0.15s',
                                fontFamily: "'Inter', sans-serif", opacity: busy ? 0.7 : 1,
                            }}
                            onMouseEnter={e => { if (!busy) e.currentTarget.style.background = 'rgba(217,119,87,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(217,119,87,0.12)'; }}
                        >
                            {busy ? 'Finishing…' : 'Yes, finish it'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
