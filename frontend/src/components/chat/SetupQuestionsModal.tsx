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
}

/**
 * The mentor's discovery questions, asked as ONE form instead of a
 * one-at-a-time chat interrogation. Answers go back as a single message and
 * the plan builds immediately — no dead-end turns, no twenty-questions.
 */
export default function SetupQuestionsModal({ questions, onSubmit }: SetupQuestionsModalProps) {
    const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ''));
    const { isMobile } = useWindowSize();

    // The first (up to) 3 questions are the essentials (goal / time / level) the plan
    // needs; the WHY (last) is optional. No skip — a real plan needs real answers.
    const essentialCount = Math.min(3, questions.length);
    const canSubmit = answers.slice(0, essentialCount).every(a => a.trim());

    const handleSubmit = () => {
        if (!canSubmit) return;
        const lines = questions
            .map((q, i) => ({ q, a: answers[i].trim() }))
            .filter(({ a }) => a)
            .map(({ q, a }) => `${q.label}\n→ ${a}`);
        onSubmit(`Setup answers:\n\n${lines.join('\n\n')}\n\nThat's everything — build my plan.`);
    };

    return (
        <div
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '22px' }}>
                    <motion.button
                        whileTap={{ scale: canSubmit ? 0.97 : 1 }}
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '13px 24px', borderRadius: '100px', border: 'none',
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            fontSize: '13px', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
                            opacity: canSubmit ? 1 : 0.5,
                            fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
                            width: '100%', justifyContent: 'center',
                        }}
                    >
                        Build my plan
                        <ArrowRight size={14} />
                    </motion.button>
                    {!canSubmit && (
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', margin: 0, fontFamily: satoshi }}>
                            Answer the first few so your plan actually fits you — no guessing.
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
