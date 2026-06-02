import { motion } from 'framer-motion';

/* ── Emotion color map (UNCHANGED) ─────────────────── */
const EMOTION_COLORS: Record<string, string> = {
    motivated:   '#f59e0b',
    stressed:    '#ef4444',
    focused:     '#6366f1',
    anxious:     '#f97316',
    confident:   '#10b981',
    drained:     '#8b5cf6',
    excited:     '#ec4899',
    neutral:     '#6b7280',
    frustrated:  '#dc2626',
    hopeful:     '#22c55e',
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

/* ── PRIMARY VISUAL ANCHOR ────────────────────────────
 * The Orb is the emotional heartbeat of Feelivate.
 * It is NEVER demoted. In chat view it appears as a
 * floating card on the right edge of the content area.
 * In Journey view it powers the large hero card.
 * ─────────────────────────────────────────────────── */
export default function EmotionOrb({ emotion, onClick }: EmotionOrbProps) {
    const color = getColor(emotion.emotion_label);
    const label = emotion.emotion_label;
    const score = emotion.emotion_score;
    const oneLiner = emotion.one_liner;

    return (
        <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.7 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.7 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onClick={onClick}
            className="emotion-orb-wrapper"
            title={`Today: ${label} (${score}/10) — ${oneLiner}`}
            style={{
                position: 'absolute',
                right: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                zIndex: 30,
                cursor: onClick ? 'pointer' : 'default',
                userSelect: 'none',
            }}
        >
            {/* ── Floating card ── */}
            <motion.div
                whileHover={{ scale: 1.03, y: -2 }}
                transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    background: 'var(--bg-surface)',
                    border: `1.5px solid ${color}40`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: '14px',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: `0 4px 20px ${color}20, 0 1px 4px rgba(0,0,0,0.06)`,
                    minWidth: 140,
                    maxWidth: 180,
                    backdropFilter: 'blur(8px)',
                }}
            >
                {/* Orb circle (64px) */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    {/* Outer ring 1 — pulsing slow */}
                    <motion.div
                        animate={{
                            scale: [1, 1.25, 1],
                            opacity: [0.15, 0.3, 0.15],
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            inset: -10,
                            borderRadius: '50%',
                            background: `radial-gradient(circle, ${color}44 0%, transparent 70%)`,
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Outer ring 2 — offset */}
                    <motion.div
                        animate={{
                            scale: [1, 1.18, 1],
                            opacity: [0.2, 0.35, 0.2],
                        }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                        style={{
                            position: 'absolute',
                            inset: -5,
                            borderRadius: '50%',
                            border: `1.5px solid ${color}55`,
                            pointerEvents: 'none',
                        }}
                    />

                    {/* Main orb body — 64px, breathes */}
                    <motion.div
                        animate={{ scale: [1, 1.06, 1] }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            background: `radial-gradient(circle at 34% 30%, ${color}ee, ${color}88)`,
                            border: `2px solid ${color}44`,
                            boxShadow: `0 0 20px ${color}50, inset 0 1px 0 ${color}bb`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                        }}
                    >
                        {/* Inner shine */}
                        <div style={{
                            position: 'absolute',
                            top: 8, left: 10,
                            width: 9, height: 9,
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.55)',
                            filter: 'blur(1px)',
                        }} />
                    </motion.div>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color,
                        textTransform: 'capitalize',
                        letterSpacing: '0.01em',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                    }}>
                        {label}
                    </div>
                    <div style={{
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: 3,
                        lineHeight: 1.2,
                    }}>
                        Score {score}/10
                    </div>
                    {oneLiner && (
                        <div style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: 3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.35,
                        } as React.CSSProperties}>
                            {oneLiner}
                        </div>
                    )}
                    {onClick && (
                        <div style={{
                            fontSize: '10px', marginTop: 5,
                            color: color, fontWeight: 600,
                            letterSpacing: '0.03em',
                        }}>
                            View Journey →
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
