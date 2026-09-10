import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';
import ChatWindow from '../chat/ChatWindow';
import RadiantPromptInput from '../chat/RadiantPromptInput';
import { clashDisplay, satoshi, easeSilk } from './missionTheme';

/** Shared layoutId — the "Ask your mentor" tile morphs into this surface. */
export const MENTOR_MORPH_ID = 'mentor-morph';

interface MentorDrawerProps {
    open: boolean;
    onClose: () => void;
    /* Everything below is the exact prop set the old full-page chat used. */
    messages: any[];
    isLoading: boolean;
    onSend: (text: string) => void;
    onApprovePlan: () => void;
    onRequestPlanChange: (feedback: string) => void;
    isPlanApproved: boolean;
    isFirstPlan: boolean;
    demoMode?: boolean;
    inputDisabled?: boolean;
}

/**
 * The mentor surface. Not a slide-in drawer anymore: the "Ask your mentor"
 * tile EXPANDS into this centered panel (framer-motion shared layoutId) while
 * the workspace blurs behind it. Opened from a spot without the tile mounted,
 * it scales in gracefully instead. ChatWindow and RadiantPromptInput are
 * mounted unchanged — every chat behavior rides along.
 */
export default function MentorDrawer({
    open, onClose, messages, isLoading, onSend, onApprovePlan,
    onRequestPlanChange, isPlanApproved, isFirstPlan, demoMode = false,
    inputDisabled = false,
}: MentorDrawerProps) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="mentor-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 240,
                            background: 'var(--modal-overlay)',
                            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                        }}
                    />
                    <div
                        key="mentor-center"
                        style={{
                            position: 'fixed', inset: 0, zIndex: 250,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: 'max(env(safe-area-inset-top, 0px), 14px) 14px max(env(safe-area-inset-bottom, 0px), 14px)',
                            pointerEvents: 'none',
                        }}
                    >
                        <motion.div
                            layoutId={MENTOR_MORPH_ID}
                            data-tour="mentor-drawer"
                            initial={{ opacity: 0, scale: 0.92, y: 24 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 18 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            style={{
                                width: 'min(720px, 100%)', height: 'min(84vh, 100%)',
                                display: 'flex', flexDirection: 'column',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: '24px', overflow: 'hidden',
                                boxShadow: 'var(--shadow-lg)',
                                pointerEvents: 'auto',
                            }}
                        >
                            {/* Header */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.12, duration: 0.3 }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
                                    flexShrink: 0,
                                }}
                            >
                                <div style={{
                                    width: '30px', height: '30px', borderRadius: '9px',
                                    background: 'var(--btn-primary-bg)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <MessageCircle size={15} style={{ color: 'var(--btn-primary-text)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{
                                        fontSize: '14px', fontWeight: 700, margin: 0,
                                        color: 'var(--text-primary)', fontFamily: clashDisplay,
                                    }}>
                                        Your mentor
                                    </p>
                                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: satoshi }}>
                                        Plans, slips, questions — anything
                                    </p>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.92 }}
                                    onClick={onClose}
                                    aria-label="Close mentor"
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '10px',
                                        border: '1px solid var(--border-subtle)', background: 'transparent',
                                        color: 'var(--text-secondary)', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                    }}
                                >
                                    <X size={15} />
                                </motion.button>
                            </motion.div>

                            {/* The chat itself — unchanged components */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.16, duration: 0.35, ease: easeSilk as any }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                            >
                                <ChatWindow
                                    messages={messages}
                                    isLoading={isLoading}
                                    onApprovePlan={onApprovePlan}
                                    onRequestPlanChange={onRequestPlanChange}
                                    isPlanApproved={isPlanApproved}
                                    isFirstPlan={isFirstPlan}
                                    demoMode={demoMode}
                                />
                                <div style={{
                                    padding: '0 16px max(env(safe-area-inset-bottom, 14px), 14px)',
                                    background: 'linear-gradient(180deg, transparent, var(--bg-primary) 20%)',
                                    flexShrink: 0,
                                }}>
                                    <RadiantPromptInput
                                        onSubmit={onSend}
                                        disabled={inputDisabled}
                                        placeholder="Talk to your mentor..."
                                    />
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
