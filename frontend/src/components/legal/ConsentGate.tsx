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
export default function ConsentGate() {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [catalogue, setCatalogue] = useState<ConsentItem[]>([]);
    const [decisions, setDecisions] = useState<Record<string, boolean>>({});

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
            setOpen(data.missing.length > 0);
        } catch {
            setError('Could not load the consent terms. Please refresh and try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    // On mount: only ask the backend if the user is actually signed in.
    useEffect(() => {
        if (!localStorage.getItem('access_token')) return;
        void load();
    }, [load]);

    // A blocked request anywhere in the app opens the gate.
    useEffect(() => {
        const handler = () => {
            setOpen(true);
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
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'var(--modal-overlay, rgba(0,0,0,0.6))',
                            backdropFilter: 'blur(6px)',
                            zIndex: 900,
                        }}
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="consent-gate-title"
                        initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-46%' }}
                        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                        exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-48%' }}
                        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            width: 'calc(100% - 32px)',
                            maxWidth: '520px',
                            maxHeight: '86vh',
                            overflowY: 'auto',
                            background: 'var(--modal-bg, #fff)',
                            border: '1px solid var(--modal-border, rgba(0,0,0,0.1))',
                            borderRadius: '8px',
                            padding: '32px 28px 26px',
                            zIndex: 901,
                            boxShadow: 'var(--shadow-xl)',
                            fontFamily: satoshi,
                        }}
                    >
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
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
                                fontSize: '24px',
                                fontWeight: 700,
                                letterSpacing: '-0.03em',
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
                </>
            )}
        </AnimatePresence>
    );
}
