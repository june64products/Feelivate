import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { googleLoginCallback } from '../api';
import { startOnboarding } from '../lib/onboarding';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// Handles the redirect back from Google Sign-In (the LOGIN flow).
// Google sends ?code=... here; we swap it for a Feelivate JWT and go to /app.
const GoogleCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'error'>('loading');
    const [message, setMessage] = useState('Signing you in with Google…');
    const ran = useRef(false);

    useEffect(() => {
        // The auth code is single-use — guard against a double exchange.
        if (ran.current) return;
        ran.current = true;

        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error || !code) {
            setStatus('error');
            setMessage('Google sign-in was cancelled or failed.');
            return;
        }

        googleLoginCallback(code)
            .then((res) => {
                localStorage.setItem('user_id', res.user_id);
                localStorage.setItem('user_name', res.name || 'there');
                if (res.is_new_user) startOnboarding(res.user_id);
                navigate('/app', { replace: true });
            })
            .catch((err) => {
                console.error(err);
                setStatus('error');
                setMessage(err.message || 'Google sign-in failed. Please try again.');
            });
    }, [searchParams, navigate]);

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{ maxWidth: '400px', width: '100%', background: 'var(--card-bg)', border: '1px solid var(--border-medium)', padding: '40px 32px', borderRadius: '4px', textAlign: 'center', boxShadow: 'var(--shadow-xl)' }}
            >
                {status === 'loading' ? (
                    <div style={{ width: '52px', height: '52px', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                        <Loader2 size={22} style={{ color: 'var(--accent-warm)', animation: 'fv-spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <div style={{ width: '52px', height: '52px', borderRadius: '4px', border: '1px solid var(--border-medium)', background: 'rgba(217,119,87,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>
                        <X size={22} style={{ color: 'var(--accent-warm)' }} />
                    </div>
                )}

                <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '10px', fontFamily: clash }}>
                    {status === 'error' ? 'Sign-in failed' : 'Signing you in'}
                </h2>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>
                    {message}
                </p>

                {status === 'error' && (
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        style={{ marginTop: '26px', width: '100%', padding: '14px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', fontWeight: 700, borderRadius: '4px', cursor: 'pointer', border: 'none', fontSize: '14px', fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', transition: 'opacity 180ms ease' }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        Back to Login
                    </button>
                )}
            </motion.div>
            <style>{`@keyframes fv-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default GoogleCallbackPage;
