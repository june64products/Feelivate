import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { googleLoginCallback } from '../api';
import { startOnboarding } from '../lib/onboarding';

// Handles the redirect back from Google Sign-In (the LOGIN flow).
// Google sends ?code=... here; we swap it for a Feelivate JWT and go to /app.
const GoogleCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'error'>('loading');
    const [message, setMessage] = useState('Signing you in with Google...');
    const ran = useRef(false);

    useEffect(() => {
        // The auth code is single-use — React StrictMode runs effects twice in
        // dev, so guard against a double exchange (the 2nd would fail).
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
        <div style={{ minHeight: '100vh', backgroundColor: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ maxWidth: '28rem', width: '100%', backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '1.5rem', textAlign: 'center' }}
            >
                {status === 'loading' && (
                    <div style={{ width: '3rem', height: '3rem', border: '4px solid rgba(204, 255, 0, 0.2)', borderTopColor: '#ccff00', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
                )}
                {status === 'error' && (
                    <div style={{ width: '4rem', height: '4rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <svg style={{ width: '2rem', height: '2rem', color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                )}

                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem', fontFamily: 'sans-serif' }}>{status === 'error' ? 'Oops!' : 'Signing you in'}</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif' }}>{message}</p>

                {status === 'error' && (
                    <button
                        onClick={() => navigate('/login', { replace: true })}
                        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', backgroundColor: 'white', color: 'black', fontWeight: 'bold', borderRadius: '9999px', cursor: 'pointer', border: 'none' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#ccff00')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
                    >
                        Back to Login
                    </button>
                )}
            </motion.div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default GoogleCallbackPage;
