import { } from 'react';
import { motion } from 'framer-motion';

// ── Emotion color map ─────────────────────────────────────────────────────────
const EMOTION_COLORS: Record<string, string> = {
    motivated: '#f59e0b',
    stressed: '#ef4444',
    focused: '#6366f1',
    anxious: '#f97316',
    confident: '#10b981',
    drained: '#8b5cf6',
    excited: '#ec4899',
    neutral: '#6b7280',
    frustrated: '#dc2626',
    hopeful: '#22c55e',
};

const getColor = (label?: string) => EMOTION_COLORS[label ?? 'neutral'] ?? '#6b7280';

interface EmotionOrbProps {
    emotion: {
        emotion_label: string;
        emotion_score: number;
        one_liner: string;
    };
    onClick?: () => void;
}

export default function EmotionOrb({ emotion, onClick }: EmotionOrbProps) {
    const color = getColor(emotion.emotion_label);
    const label = emotion.emotion_label;
    const score = emotion.emotion_score;

    return (
        <motion.div
            initial={{ opacity: 0, x: 30, scale: 0.6 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            title={`Today: ${label} (${score}/10) — ${emotion.one_liner}`}
            onClick={onClick}
            className="emotion-orb-wrapper"
            style={{
                position: 'absolute',
                right: '18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                zIndex: 30,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
            }}
        >
            {/* Outer glow ring */}
            <motion.div
                animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0.45, 0.25] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute',
                    width: '62px',
                    height: '62px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`,
                    filter: 'blur(6px)',
                }}
            />

            {/* Orb itself */}
            <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${color}ee, ${color}88)`,
                    border: `2px solid ${color}55`,
                    boxShadow: `0 0 16px ${color}60, inset 0 1px 0 ${color}aa`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                {/* Inner shine dot */}
                <div style={{
                    position: 'absolute',
                    top: '9px',
                    left: '11px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.55)',
                    filter: 'blur(1px)',
                }} />
            </motion.div>

            {/* Label below orb */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1px',
            }}>
                <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color,
                    textTransform: 'capitalize',
                    letterSpacing: '0.03em',
                    lineHeight: 1,
                }}>
                    {label}
                </span>
                <span style={{
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.35)',
                    lineHeight: 1,
                }}>
                    {score}/10
                </span>
            </div>
        </motion.div>
    );
}
