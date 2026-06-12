import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue } from 'framer-motion';

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

const STORAGE_KEY = 'emotion_orb_position';

/** Load saved position from localStorage, or use default (bottom-right). */
function loadPosition(): { x: number; y: number } | null {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                // Validate it's still within the viewport
                const maxX = window.innerWidth - 60;
                const maxY = window.innerHeight - 80;
                return {
                    x: Math.min(Math.max(0, parsed.x), maxX),
                    y: Math.min(Math.max(0, parsed.y), maxY),
                };
            }
        }
    } catch { /* ignore */ }
    return null;
}

function savePosition(x: number, y: number) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch { /* ignore */ }
}

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

    // Track if user dragged (to distinguish from click)
    const isDragging = useRef(false);
    const dragStartPos = useRef({ x: 0, y: 0 });

    // Default position: bottom-right corner above the input area
    const saved = loadPosition();
    const [defaultPos] = useState(() => {
        if (saved) return saved;
        // Default: right side, above the input bar
        return {
            x: (typeof window !== 'undefined' ? window.innerWidth - 75 : 300),
            y: (typeof window !== 'undefined' ? window.innerHeight - 200 : 400),
        };
    });

    const motionX = useMotionValue(defaultPos.x);
    const motionY = useMotionValue(defaultPos.y);

    // Constrain ref for the entire viewport
    const constraintsRef = useRef<HTMLDivElement>(null);

    // Update constraints on resize
    useEffect(() => {
        const handleResize = () => {
            const currentX = motionX.get();
            const currentY = motionY.get();
            const maxX = window.innerWidth - 60;
            const maxY = window.innerHeight - 80;
            if (currentX > maxX) motionX.set(maxX);
            if (currentY > maxY) motionY.set(maxY);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [motionX, motionY]);

    const handleDragStart = () => {
        isDragging.current = false;
        dragStartPos.current = { x: motionX.get(), y: motionY.get() };
    };

    const handleDrag = () => {
        const dx = Math.abs(motionX.get() - dragStartPos.current.x);
        const dy = Math.abs(motionY.get() - dragStartPos.current.y);
        if (dx > 5 || dy > 5) {
            isDragging.current = true;
        }
    };

    const handleDragEnd = () => {
        // Save position
        savePosition(motionX.get(), motionY.get());
    };

    const handleClick = () => {
        // Only fire onClick if user didn't drag
        if (!isDragging.current && onClick) {
            onClick();
        }
    };

    return (
        <>
            {/* Invisible full-screen drag constraints boundary */}
            <div
                ref={constraintsRef}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: 29,
                }}
            />

            <motion.div
                drag
                dragMomentum={false}
                dragElastic={0.1}
                dragConstraints={constraintsRef}
                onDragStart={handleDragStart}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onClick={handleClick}
                style={{
                    position: 'fixed',
                    x: motionX,
                    y: motionY,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 30,
                    cursor: 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                }}
                whileDrag={{ scale: 1.15, cursor: 'grabbing' }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                title={`Today: ${label} (${score}/10) — ${emotion.one_liner}\n\nDrag me anywhere!`}
                className="emotion-orb-wrapper"
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
        </>
    );
}
