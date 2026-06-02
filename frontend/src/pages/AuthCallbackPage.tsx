import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmGoogleAuth } from '../api';
import { motion } from 'framer-motion';

const AuthCallbackPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('Connecting to Google Calendar...');

    useEffect(() => {
        const code = searchParams.get('code');
        const userId = localStorage.getItem('user_id');

        if (code && userId) {
            confirmGoogleAuth(code, userId)
                .then(() => {
                    setStatus('success');
                    setMessage('Calendar connected successfully! Redirecting...');
                    setTimeout(() => {
                        navigate('/app');
                    }, 2000);
                })
                .catch((err) => {
                    console.error(err);
                    setStatus('error');
                    setMessage('Failed to connect calendar. Please try again.');
                });
        } else {
            setStatus('error');
            setMessage('Invalid authentication code or session.');
        }
    }, [searchParams, navigate]);

    return (
        <div style={{
            minHeight: '100vh', backgroundColor: '#060608',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            fontFamily: "'Inter', system-ui, sans-serif",
        }}>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                    maxWidth: '400px', width: '100%',
                    backgroundColor: '#111116',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '36px', borderRadius: '24px', textAlign: 'center',
                    boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
                }}
            >
                {status === 'loading' && (
                    <div style={{
                        width: '48px', height: '48px',
                        border: '3px solid rgba(167,139,250,0.15)',
                        borderTopColor: '#a78bfa',
                        borderRadius: '50%', margin: '0 auto 24px',
                        animation: 'spin 0.9s linear infinite',
                    }} />
                )}
                {status === 'success' && (
                    <div style={{
                        width: '52px', height: '52px',
                        backgroundColor: 'rgba(74,222,128,0.1)',
                        border: '1px solid rgba(74,222,128,0.2)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                    }}>
                        <svg style={{ width: '24px', height: '24px', color: '#4ade80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
                {status === 'error' && (
                    <div style={{
                        width: '52px', height: '52px',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 24px',
                    }}>
                        <svg style={{ width: '24px', height: '24px', color: '#f87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                )}
                
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e8e8ed', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                    {status === 'error' ? 'Oops!' : 'Authentication'}
                </h2>
                <p style={{ color: '#6a6a7a', fontSize: '14px', lineHeight: 1.6 }}>{message}</p>
                
                {status === 'error' && (
                    <button 
                        onClick={() => navigate('/app')}
                        style={{
                            marginTop: '24px', padding: '12px 24px',
                            backgroundColor: '#ffffff', color: '#060608',
                            fontWeight: 700, borderRadius: '12px', cursor: 'pointer',
                            transition: 'opacity 0.2s', border: 'none',
                            fontSize: '14px', letterSpacing: '-0.02em',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.88'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                    >
                        Back to Workspace
                    </button>
                )}
            </motion.div>
        </div>
    );
};

export default AuthCallbackPage;
