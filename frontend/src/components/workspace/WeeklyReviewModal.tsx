import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { submitWeeklyReview } from '../../api';

interface WeeklyReviewModalProps {
    sessionId: string;
    weekNumber: number;
    onClose: () => void;
    onComplete: () => void;
}

export default function WeeklyReviewModal({
    sessionId,
    weekNumber,
    onClose,
    onComplete,
}: WeeklyReviewModalProps) {
    const [feedback, setFeedback] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async () => {
        if (!feedback.trim()) return;
        setLoading(true);
        try {
            await submitWeeklyReview(sessionId, weekNumber, feedback.trim());
            setSubmitted(true);
            setTimeout(() => {
                onComplete();
            }, 1200);
        } catch (e) {
            console.error('Review submit failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const prompts = [
        'Completed most days 💪',
        'Struggled mid-week 😓',
        'It was too easy',
        'It was too hard',
        'Want to add a new topic',
    ];

    return (
        <AnimatePresence>
            <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(6px)',
                zIndex: 300,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
            }}>
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    style={{
                        width: '100%', maxWidth: '480px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: '20px',
                        padding: '28px',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                    }}
                >
                    {submitted ? (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={{ textAlign: 'center', padding: '20px 0' }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
                            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Got it! Building Week {weekNumber + 1}...
                            </p>
                        </motion.div>
                    ) : (
                        <>
                            {/* Header */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                                    padding: '4px 10px', borderRadius: '20px',
                                    background: 'rgba(192,132,252,0.1)',
                                    border: '1px solid rgba(192,132,252,0.2)',
                                    fontSize: '11px', fontWeight: 600,
                                    color: 'var(--accent-primary)',
                                    marginBottom: '12px',
                                }}>
                                    Week {weekNumber} Complete 🎉
                                </div>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    How did Week {weekNumber} go?
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    Your answer directly shapes Week {weekNumber + 1}'s difficulty and focus.
                                </p>
                            </div>

                            {/* Quick-pick chips */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                                {prompts.map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setFeedback(prev => prev ? `${prev}, ${p}` : p)}
                                        style={{
                                            padding: '5px 10px',
                                            borderRadius: '20px',
                                            border: '1px solid var(--border-medium)',
                                            background: feedback.includes(p) ? 'rgba(192,132,252,0.12)' : 'var(--glass-surface)',
                                            color: feedback.includes(p) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>

                            {/* Free text */}
                            <textarea
                                value={feedback}
                                onChange={e => setFeedback(e.target.value)}
                                placeholder="Add more detail... (optional)"
                                rows={3}
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-medium)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    resize: 'vertical',
                                    outline: 'none',
                                    fontFamily: 'var(--font-sans)',
                                    lineHeight: 1.5,
                                    marginBottom: '20px',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={e => { e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
                            />

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '9px 18px', borderRadius: '10px',
                                        border: '1px solid var(--border-medium)',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        fontSize: '13px', cursor: 'pointer',
                                    }}
                                >
                                    Later
                                </button>
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleSubmit}
                                    disabled={loading || !feedback.trim()}
                                    style={{
                                        padding: '9px 20px', borderRadius: '10px',
                                        border: 'none',
                                        background: feedback.trim()
                                            ? 'linear-gradient(135deg, #c084fc, #818cf8)'
                                            : 'var(--bg-tertiary)',
                                        color: 'white',
                                        fontSize: '13px', fontWeight: 600,
                                        cursor: feedback.trim() ? 'pointer' : 'not-allowed',
                                        opacity: loading ? 0.7 : 1,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {loading ? 'Saving...' : `Build Week ${weekNumber + 1} →`}
                                </motion.button>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
