import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Check } from 'lucide-react';
import PlanCard from '../chat/PlanCard';
import { clashDisplay, satoshi, FLAME_FROM, FLAME_TO, easeSilk } from './missionTheme';

interface CommitStageProps {
    plan: any;
    isFirstPlan: boolean;
    onApprove: () => void;
    onRequestChange: (feedback: string) => void;
    /** Opens the mentor drawer so the tweak conversation happens there. */
    onOpenMentor: () => void;
}

/**
 * The plan, center stage — not buried in a chat bubble. PlanCard is mounted
 * unchanged, so approve/tweak/stale-plan dialogs all behave exactly as before.
 */
export function CommitStage({ plan, isFirstPlan, onApprove, onRequestChange, onOpenMentor }: CommitStageProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeSilk as any }}
            style={{ maxWidth: '760px', margin: '0 auto', width: '100%' }}
        >
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    style={{
                        fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em',
                        textTransform: 'uppercase', color: 'var(--accent-primary)',
                        margin: '0 0 8px', fontFamily: satoshi,
                    }}
                >
                    Week {plan?.week_number ?? 1} · ready to commit
                </motion.p>
                <motion.h2
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: easeSilk as any }}
                    style={{
                        fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)',
                        margin: 0, fontFamily: clashDisplay, letterSpacing: '-0.02em',
                    }}
                >
                    Your week, built for you
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    style={{
                        fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0',
                        fontFamily: satoshi,
                    }}
                >
                    Read it. Tweak it. Then commit — no renegotiation mid-week.{' '}
                    <button
                        onClick={onOpenMentor}
                        style={{
                            border: 'none', background: 'none', color: 'var(--accent-primary)',
                            fontSize: '13px', cursor: 'pointer', padding: 0, fontFamily: satoshi,
                            textDecoration: 'underline',
                        }}
                    >
                        Ask about it
                    </button>
                </motion.p>
            </div>

            <PlanCard
                plan={plan}
                onApprove={onApprove}
                onRequestChange={onRequestChange}
                isApproved={false}
                isFirstPlan={isFirstPlan}
            />
        </motion.div>
    );
}

/**
 * The 2.2-second full-screen seal after approval — the moment of commitment
 * gets a ceremony instead of a toast.
 */
export function CeremonyOverlay({ show, weekNumber }: { show: boolean; weekNumber: number }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 400,
                        background: 'var(--modal-overlay)', backdropFilter: 'blur(14px)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: '18px', pointerEvents: 'none',
                    }}
                >
                    <motion.div
                        initial={{ scale: 0, rotate: -20 }}
                        animate={{ scale: [0, 1.25, 1], rotate: 0 }}
                        transition={{ duration: 0.7, ease: easeSilk as any }}
                        style={{
                            width: '88px', height: '88px', borderRadius: '50%',
                            background: `linear-gradient(135deg, ${FLAME_FROM}, ${FLAME_TO})`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 0 60px ${FLAME_TO}66`,
                        }}
                    >
                        <Check size={44} color="#fff" strokeWidth={3} />
                    </motion.div>
                    <motion.p
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35, duration: 0.5, ease: easeSilk as any }}
                        style={{
                            fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)',
                            margin: 0, fontFamily: clashDisplay, letterSpacing: '-0.02em',
                            textAlign: 'center',
                        }}
                    >
                        Week {weekNumber} is set.
                    </motion.p>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.55 }}
                        style={{
                            fontSize: '14px', color: 'var(--text-secondary)', margin: 0,
                            fontFamily: satoshi, display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                    >
                        <Flame size={14} style={{ color: FLAME_TO }} />
                        Commitment made — that's the hard part done.
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
