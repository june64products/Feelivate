import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getConsents, submitConsents, type ConsentItem } from '../../api';
import { ConsentCheckbox } from './ConsentControls';
import { allRequiredGranted } from '../../lib/consent';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";

/**
 * Blocking consent screen for signed-in users.
 *
 * Two things bring it up:
 *   1. Mount — accounts created before consent was collected, and accounts whose
 *      recorded consent is from an older policy version.
 *   2. The `feelivate:consent-required` event, dispatched by api.ts when the
 *      backend refuses a request for the same reason.
 *
 * It cannot be dismissed. That is the point: without a lawful basis we are not
 * allowed to process this content, so "remind me later" is not an option we can
 * offer. The user can always log out, and once inside they can delete the
 * account outright from the profile menu.
 */
/**
 * 'checking' — we don't yet know whether consent is outstanding. Anything that
 * wants to wait its turn (the walkthrough) must treat this as "not clear yet",
 * or it opens on top of the gate the moment the page mounts.
 */
export type ConsentStatus = 'checking' | 'blocking' | 'clear';

export default function ConsentGate({
    onStatusChange,
}: {
    onStatusChange?: (status: ConsentStatus) => void;
} = {}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [catalogue, setCatalogue] = useState<ConsentItem[]>([]);
    const [decisions, setDecisions] = useState<Record<string, boolean>>({});
    const [status, setStatus] = useState<ConsentStatus>('checking');

    // Report upward whenever it changes, so callers don't have to poll.
    useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await getConsents();
            setCatalogue(data.catalogue);
            // Optional consents keep whatever the user already chose; required
            // ones always start unticked so the act of agreeing is deliberate.
            const next: Record<string, boolean> = {};
            for (const item of data.catalogue) {
                next[item.key] = item.required ? false : data.state[item.key]?.granted === true;
            }
            setDecisions(next);
            const missing = data.missing.length > 0;
            setOpen(missing);
            setStatus(missing ? 'blocking' : 'clear');
        } catch {
            setError('Could not load the consent terms. Please refresh and try again.');
            // The gate stays shut on a load failure, so don't leave callers
            // stuck on 'checking' forever. If consent really is missing, the
            // backend refuses the next request and re-opens the gate anyway.
            setStatus('clear');
        } finally {
            setLoading(false);
        }
    }, []);

    // On mount: only ask the backend if the user is actually signed in.
    useEffect(() => {
        if (!localStorage.getItem('access_token')) {
            setStatus('clear');
            return;
        }
        void load();
    }, [load]);

    // A blocked request anywhere in the app opens the gate.
    useEffect(() => {
        const handler = () => {
            setOpen(true);
            setStatus('blocking');
            void load();
        };
        window.addEventListener('feelivate:consent-required', handler);
        return () => window.removeEventListener('feelivate:consent-required', handler);
    }, [load]);

    const handleSubmit = async () => {
        setSaving(true);
        setError('');
        try {
            await submitConsents(decisions);
            setOpen(false);
            setStatus('clear');
        } catch (e: any) {
            setError(e?.message || 'Could not save your choices.');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        localStorage.removeItem('active_session_id');
        window.location.href = '/login';
    };

    const canContinue = allRequiredGranted(catalogue, decisions) && !saving;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        // dvh, not vh — on mobile Safari `vh` measures the
                        // viewport with the browser chrome hidden, so the
                        // bottom of the dialog ends up under the address bar.
                        height: '100dvh',
                        background: 'var(--modal-overlay, rgba(0,0,0,0.6))',
                        backdropFilter: 'blur(6px)',
                        zIndex: 900,
                        display: 'flex',
                        overflowY: 'auto',
                        paddingTop: 'max(16px, env(safe-area-inset-top))',
                        paddingRight: 'max(16px, env(safe-area-inset-right))',
                        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
                        paddingLeft: 'max(16px, env(safe-area-inset-left))',
                    }}
                >
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="consent-gate-title"
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 6 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '520px',
                            // `margin: auto` centres the card when it fits and
                            // lets it scroll from the top when it doesn't —
                            // align-items would clip the heading off-screen on a
                            // short phone, and this dialog cannot be dismissed.
                            margin: 'auto',
                            background: 'var(--modal-bg, #fff)',
                            border: '1px solid var(--modal-border, rgba(0,0,0,0.1))',
                            borderRadius: '14px',
                            padding: 'clamp(20px, 5.5vw, 32px)',
                            zIndex: 901,
                            boxShadow: 'var(--shadow-xl)',
                            fontFamily: satoshi,
                        }}
                    >
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                flexShrink: 0,
                                borderRadius: '10px',
                                border: '1px solid var(--border-medium)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '18px',
                            }}
                        >
                            <ShieldCheck size={18} style={{ color: 'var(--text-primary)' }} />
                        </div>

                        <h2
                            id="consent-gate-title"
                            style={{
                                // Scales down on a narrow phone rather than
                                // wrapping the heading across three lines.
                                fontSize: 'clamp(20px, 5.6vw, 24px)',
                                fontWeight: 700,
                                letterSpacing: '-0.03em',
                                lineHeight: 1.15,
                                color: 'var(--text-primary)',
                                marginBottom: '10px',
                                fontFamily: clashDisplay,
                            }}
                        >
                            Before you continue
                        </h2>
                        <p
                            style={{
                                fontSize: '13.5px',
                                lineHeight: 1.65,
                                color: 'var(--text-secondary)',
                                marginBottom: '22px',
                            }}
                        >
                            We've updated how we explain the way Feelivate handles your data. Because your
                            journals, voice notes and emotion logs say something about your wellbeing, we need
                            your clear permission before we process them. Please review and confirm.
                        </p>

                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '22px' }}>
                                {catalogue.map((item) => (
                                    <ConsentCheckbox
                                        key={item.key}
                                        item={item}
                                        checked={decisions[item.key] === true}
                                        disabled={saving}
                                        onChange={(next) => setDecisions((d) => ({ ...d, [item.key]: next }))}
                                    />
                                ))}
                            </div>
                        )}

                        {error && (
                            <p
                                style={{
                                    fontSize: '12.5px',
                                    color: '#dc2626',
                                    marginBottom: '14px',
                                    lineHeight: 1.5,
                                }}
                            >
                                {error}
                            </p>
                        )}

                        <button
                            onClick={handleSubmit}
                            disabled={!canContinue}
                            style={{
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
                                fontSize: '13.5px',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                textTransform: 'uppercase',
                                fontFamily: satoshi,
                                cursor: canContinue ? 'pointer' : 'not-allowed',
                                opacity: canContinue ? 1 : 0.45,
                                transition: 'opacity 180ms ease',
                            }}
                        >
                            {saving ? <Loader2 size={15} className="animate-spin" /> : 'Agree and continue'}
                        </button>

                        <p
                            style={{
                                marginTop: '16px',
                                fontSize: '12px',
                                color: 'var(--text-muted)',
                                textAlign: 'center',
                                lineHeight: 1.6,
                            }}
                        >
                            Don't want to agree?{' '}
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--text-primary)',
                                    fontWeight: 700,
                                    fontSize: '12px',
                                    fontFamily: satoshi,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '2px',
                                }}
                            >
                                Log out
                            </button>
                            . Your data stays untouched, and you can delete your account any time from your
                            profile menu.
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
