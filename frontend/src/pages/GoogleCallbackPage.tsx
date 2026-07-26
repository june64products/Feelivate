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
        <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', backdropFilter: 'blur(6px)' }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                style={{
                    width: '100%', maxWidth: '420px',
                    background: '#161616',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '20px',
                    padding: '38px 30px',
                    textAlign: 'center',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}
            >
                <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px',
                }}>
                    {status === 'loading'
                        ? <Loader2 size={24} style={{ color: '#d97757', animation: 'fv-spin 1s linear infinite' }} />
                        : <X size={24} style={{ color: '#d97757' }} />}
                </div>

                <h2 style={{ fontSize: '23px', fontWeight: 700, letterSpacing: '-0.03em', color: '#f5f5f5', marginBottom: '10px', fontFamily: clash }}>
                    {status === 'error' ? 'Sign-in failed' : 'Signing you in'}
                </h2>
                <p style={{ fontSize: '13.5px', color: 'rgba(245,245,245,0.6)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500, wordBreak: 'break-word' }}>
                    {message}
                </p>

                {status === 'error' && (
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        style={{
                            marginTop: '26px', width: '100%', padding: '13px',
                            background: '#f2f2f2', color: '#111', fontWeight: 700,
                            borderRadius: '12px', cursor: 'pointer', border: 'none',
                            fontSize: '14px', fontFamily: satoshi, letterSpacing: '0.01em',
                            transition: 'opacity 180ms ease',
                        }}
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
