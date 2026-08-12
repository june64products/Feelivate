import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { SetupQuestion } from '../../api';
import { useWindowSize } from '../../hooks/useWindowSize';

const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

interface SetupQuestionsModalProps {
    questions: SetupQuestion[];
    /** All answers collected → sent back to the mentor as one message. */
    onSubmit: (message: string) => void;
    /** User chose "skip" — mentor makes smart assumptions and drafts anyway. */
    onSkip: () => void;
    /** Closed without answering (overlay/Esc) — nothing is sent. */
    onDismiss: () => void;
}

/**
 * The mentor's discovery questions, asked as ONE form instead of a
 * one-at-a-time chat interrogation. Answers go back as a single message and
 * the plan builds immediately — no dead-end turns, no twenty-questions.
 */
export default function SetupQuestionsModal({ questions, onSubmit, onSkip, onDismiss }: SetupQuestionsModalProps) {
    const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
    const { isMobile } = useWindowSize();

    const answeredCount = answers.filter(a => a.trim()).length;

    const handleSubmit = () => {
        if (answeredCount === 0) {
            onSkip();
            return;
        }
        const lines = questions
            .map((q, i) => ({ q, a: answers[i].trim() }))
            .filter(({ a }) => a)
            .map(({ q, a }) => `${q.label}\n→ ${a}`);
        onSubmit(`Setup answers:\n\n${lines.join('\n\n')}\n\nThat's everything — build my plan.`);
    };

    return (
        <div
            onClick={onDismiss}
            style={{
                position: 'fixed', inset: 0,
                background: 'var(--modal-overlay)', backdropFilter: 'blur(8px)',
                zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '20px',
            }}
        >
            <motion.div
                onClick={e => e.stopPropagation()}
                initial={{ scale: 0.94, opacity: 0, y: 18 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                style={{
                    width: '100%', maxWidth: '480px', maxHeight: '84vh', overflowY: 'auto',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--modal-border)',
                    borderRadius: '20px', padding: isMobile ? '22px 20px' : '28px 26px',
                    boxShadow: 'var(--shadow-lg)', fontFamily: satoshi,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <div style={{
                        width: '34px', height: '34px', borderRadius: '10px',
                        background: 'var(--btn-primary-bg)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Sparkles size={16} style={{ color: 'var(--btn-primary-text)' }} />
                    </div>
                    <h3 style={{
                        fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)',
                        margin: 0, fontFamily: clashDisplay, letterSpacing: '-0.01em',
                    }}>
                        30 seconds of setup
                    </h3>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                    Answer what you can — short and honest beats long and polished. Your plan builds the moment you hit the button.
                </p>

                {questions.map((q, i) => (
                    <div key={q.id ?? i} style={{ marginBottom: '16px' }}>
                        <label style={{
                            display: 'block', fontSize: '13px', fontWeight: 700,
                            color: 'var(--text-primary)', marginBottom: '7px', lineHeight: 1.45,
                        }}>
                            {q.label}
                        </label>
                        <textarea
                            value={answers[i]}
                            onChange={e => {
                                const next = [...answers];
                                next[i] = e.target.value;
                                setAnswers(next);
                            }}
                            placeholder={q.placeholder || ''}
                            rows={2}
                            style={{
                                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                                padding: '10px 12px', borderRadius: '12px',
                                border: '1px solid var(--border-medium)',
                                background: 'var(--card-bg)', color: 'var(--text-primary)',
                                fontSize: '13.5px', lineHeight: 1.55, fontFamily: satoshi,
                                outline: 'none',
                            }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
                        />
                    </div>
                ))}

                <div style={{
                    display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                    gap: '10px', alignItems: 'center', justifyContent: 'space-between', marginTop: '22px',
                }}>
                    <button
                        onClick={onSkip}
                        style={{
                            padding: '10px 16px', borderRadius: '100px',
                            border: 'none', background: 'transparent',
                            color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600,
                            cursor: 'pointer', fontFamily: satoshi,
                        }}
                    >
                        Skip — let my mentor guess
                    </button>
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSubmit}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 24px', borderRadius: '100px', border: 'none',
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                            fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
                            width: isMobile ? '100%' : 'auto', justifyContent: 'center',
                        }}
                    >
                        Build my plan
                        <ArrowRight size={14} />
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
}
