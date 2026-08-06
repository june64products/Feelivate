import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { deleteMyAccount } from '../../api';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";

const WHAT_GETS_DELETED = [
    'Your account, name and email',
    'Every chat, goal and weekly plan',
    'All voice journal entries and their transcripts',
    'Your emotion logs, check-ins, streaks and weekly reports',
    'Your long-term memory and any Google Calendar connection',
];

/**
 * Irreversible account deletion (GDPR Art 17).
 *
 * Two gates before it fires — the typed word and, for password accounts, the
 * password. Deletion is immediate and total: there is no soft-delete, because a
 * row flagged `deleted` is still personal data we would be holding.
 */
export default function DeleteAccountModal({
    onClose,
    onDeleted,
}: {
    onClose: () => void;
    onDeleted: () => void;
}) {
    const [confirmation, setConfirmation] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [warning, setWarning] = useState<string[] | null>(null);

    const canDelete = confirmation.trim().toUpperCase() === 'DELETE' && !busy;

    const handleDelete = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await deleteMyAccount(confirmation, password || undefined);
            if (result.incomplete?.length) {
                // Told plainly rather than glossed over — the user is entitled to
                // know that part of the erasure needs a manual follow-up.
                setWarning(result.incomplete);
                return;
            }
            onDeleted();
        } catch (e: any) {
            setError(e?.message || 'Could not delete your account. Please try again.');
        } finally {
            setBusy(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '4px',
        border: '1px solid var(--border-medium)',
        background: 'var(--input-bg)',
        color: 'var(--text-primary)',
        // 16px is a hard floor on iOS: anything smaller makes Safari zoom the
        // whole page in when the field is focused, and it never zooms back out.
        fontSize: '16px',
        fontFamily: satoshi,
        outline: 'none',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={busy ? undefined : onClose}
            style={{
                position: 'fixed',
                inset: 0,
                // dvh, not vh: on mobile Safari `vh` is the viewport with the
                // browser chrome hidden, so a vh-sized dialog runs under the
                // address bar and its bottom controls become unreachable.
                height: '100dvh',
                background: 'var(--modal-overlay, rgba(0,0,0,0.6))',
                backdropFilter: 'blur(6px)',
                zIndex: 800,
                display: 'flex',
                overflowY: 'auto',
                // Respect the notch and the home indicator rather than sitting under them.
                paddingTop: 'max(16px, env(safe-area-inset-top))',
                paddingRight: 'max(16px, env(safe-area-inset-right))',
                paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                paddingLeft: 'max(16px, env(safe-area-inset-left))',
            }}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-account-title"
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 6 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '460px',
                    // `margin: auto` rather than the parent's align-items: it
                    // centres when the card fits and lets it scroll from the top
                    // when it doesn't — align-items would clip the heading off
                    // the top of a card taller than the screen.
                    margin: 'auto',
                    background: 'var(--modal-bg, #fff)',
                    border: '1px solid var(--modal-border, rgba(0,0,0,0.1))',
                    borderRadius: '14px',
                    // Scales with the screen instead of eating half the width of
                    // a small phone.
                    padding: 'clamp(20px, 5.5vw, 30px)',
                    boxShadow: 'var(--shadow-xl)',
                    fontFamily: satoshi,
                }}
            >
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '16px',
                }}>
                    <div
                        style={{
                            width: '40px',
                            height: '40px',
                            flexShrink: 0,
                            borderRadius: '10px',
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.06)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                    </div>

                    {/* In the header row, not absolutely positioned — it used to
                        float over the corner and drift away from the content on
                        a narrow screen. 40px keeps it a comfortable tap target. */}
                    {!busy && (
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            style={{
                                width: '40px',
                                height: '40px',
                                flexShrink: 0,
                                background: 'var(--glass-hover)',
                                border: 'none',
                                borderRadius: '10px',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <h2
                    id="delete-account-title"
                    style={{
                        // Shrinks on a small phone instead of wrapping the title
                        // across three lines.
                        fontSize: 'clamp(19px, 5.2vw, 22px)',
                        fontWeight: 700,
                        letterSpacing: '-0.03em',
                        lineHeight: 1.15,
                        color: 'var(--text-primary)',
                        marginBottom: '10px',
                        fontFamily: clashDisplay,
                    }}
                >
                    Delete your account
                </h2>

                {warning ? (
                    <>
                        <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            Your account and database records have been deleted. One external store could not
                            be reached, so a small amount of data may still be held there:
                        </p>
                        <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '18px', marginBottom: '18px', lineHeight: 1.7 }}>
                            {warning.map((w) => (
                                <li key={w}>{w.replace(/_/g, ' ')}</li>
                            ))}
                        </ul>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.6 }}>
                            Please email <strong>info@june64.com</strong> and we will confirm its removal.
                        </p>
                        <button onClick={onDeleted} style={primaryButtonStyle}>
                            Done
                        </button>
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: '13.5px', lineHeight: 1.65, color: 'var(--text-secondary)', marginBottom: '14px' }}>
                            This is permanent and immediate. There is no undo and no recovery period.
                            Everything below is erased:
                        </p>
                        <ul
                            style={{
                                fontSize: '12.5px',
                                color: 'var(--text-secondary)',
                                paddingLeft: '18px',
                                marginBottom: '18px',
                                lineHeight: 1.75,
                            }}
                        >
                            {WHAT_GETS_DELETED.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                            Want a copy first? Close this and choose <strong>Download my data</strong>.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '18px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="delete-confirm" style={labelStyle}>
                                    Type DELETE to confirm
                                </label>
                                <input
                                    id="delete-confirm"
                                    type="text"
                                    value={confirmation}
                                    onChange={(e) => setConfirmation(e.target.value)}
                                    placeholder="DELETE"
                                    autoComplete="off"
                                    disabled={busy}
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label htmlFor="delete-password" style={labelStyle}>
                                    Password
                                </label>
                                <input
                                    id="delete-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Leave blank if you sign in with Google"
                                    autoComplete="current-password"
                                    disabled={busy}
                                    style={inputStyle}
                                />
                            </div>
                        </div>

                        {error && (
                            <p style={{ fontSize: '12.5px', color: '#dc2626', marginBottom: '14px', lineHeight: 1.5 }}>
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleDelete}
                            disabled={!canDelete}
                            style={{
                                ...primaryButtonStyle,
                                background: '#dc2626',
                                color: '#fff',
                                cursor: canDelete ? 'pointer' : 'not-allowed',
                                opacity: canDelete ? 1 : 0.45,
                            }}
                        >
                            {busy ? <Loader2 size={15} className="animate-spin" /> : 'Delete my account permanently'}
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    );
}

const labelStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-secondary)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: satoshi,
};

const primaryButtonStyle: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '14px',
    borderRadius: '4px',
    border: 'none',
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
    fontFamily: satoshi,
    cursor: 'pointer',
};
