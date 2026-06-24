import { motion, AnimatePresence } from 'framer-motion';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";

interface ConfirmDialogProps {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    tone?: 'primary' | 'danger';
}

/** Reusable themed confirmation dialog (matches the app's modal styling). */
export default function ConfirmDialog({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    tone = 'primary',
}: ConfirmDialogProps) {
    return (
        <AnimatePresence>
            <div
                onClick={onCancel}
                style={{
                    position: 'fixed', inset: 0,
                    background: 'var(--modal-overlay)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '20px',
                }}
            >
                <motion.div
                    onClick={e => e.stopPropagation()}
                    initial={{ scale: 0.92, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    style={{
                        width: '100%', maxWidth: '400px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--modal-border)',
                        borderRadius: '20px',
                        padding: '26px',
                        boxShadow: 'var(--shadow-lg)',
                        fontFamily: satoshi,
                    }}
                >
                    <h3 style={{
                        fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)',
                        margin: '0 0 8px', fontFamily: clashDisplay, letterSpacing: '-0.01em',
                    }}>
                        {title}
                    </h3>
                    <p style={{
                        fontSize: '13px', color: 'var(--text-secondary)',
                        lineHeight: 1.55, margin: '0 0 22px',
                    }}>
                        {message}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                            onClick={onCancel}
                            style={{
                                padding: '9px 18px', borderRadius: '100px',
                                border: '1px solid var(--border-medium)', background: 'transparent',
                                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
                                cursor: 'pointer', fontFamily: satoshi,
                                letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                        >
                            {cancelLabel}
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={onConfirm}
                            style={{
                                padding: '9px 18px', borderRadius: '100px', border: 'none',
                                background: tone === 'danger' ? '#ef4444' : 'var(--btn-primary-bg)',
                                color: tone === 'danger' ? '#fff' : 'var(--btn-primary-text)',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
                            }}
                        >
                            {confirmLabel}
                        </motion.button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
