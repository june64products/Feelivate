import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';
import ChatWindow from '../chat/ChatWindow';
import RadiantPromptInput from '../chat/RadiantPromptInput';
import { clashDisplay, satoshi, easeSilk } from './missionTheme';

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
 * The mentor, demoted from "the whole room" to a summonable side drawer.
 * ChatWindow and RadiantPromptInput are mounted unchanged — every chat
 * behavior (plans, safety cards, blocked notices, markdown) rides along.
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
                        key="drawer-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{
                            position: 'fixed', inset: 0, zIndex: 240,
                            background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)',
                        }}
                    />
                    <motion.div
                        key="mentor-drawer"
                        data-tour="mentor-drawer"
                        initial={{ x: '105%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '105%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
                        style={{
                            position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 250,
                            width: 'min(560px, 100vw)',
                            display: 'flex', flexDirection: 'column',
                            background: 'var(--bg-primary)',
                            borderLeft: '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-lg)',
                        }}
                    >
                        {/* Drawer header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
                            flexShrink: 0,
                        }}>
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
                        </div>

                        {/* The chat itself — unchanged components */}
                        <ChatWindow
                            messages={messages}
                            isLoading={isLoading}
                            onApprovePlan={onApprovePlan}
                            onRequestPlanChange={onRequestPlanChange}
                            isPlanApproved={isPlanApproved}
                            isFirstPlan={isFirstPlan}
                            demoMode={demoMode}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15, duration: 0.35, ease: easeSilk as any }}
                            style={{
                                padding: '0 16px max(env(safe-area-inset-bottom, 14px), 14px)',
                                background: 'linear-gradient(180deg, transparent, var(--bg-primary) 20%)',
                                flexShrink: 0,
                            }}
                        >
                            <RadiantPromptInput
                                onSubmit={onSend}
                                disabled={inputDisabled}
                                placeholder="Talk to your mentor..."
                            />
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
