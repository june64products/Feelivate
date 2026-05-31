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
                        navigate('/app'); // Go back to workspace
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
        <div style={{ minHeight: '100vh', backgroundColor: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ maxWidth: '28rem', width: '100%', backgroundColor: '#111', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '1.5rem', textAlign: 'center' }}
            >
                {status === 'loading' && (
                    <div style={{ width: '3rem', height: '3rem', border: '4px solid rgba(204, 255, 0, 0.2)', borderTopColor: '#ccff00', borderRadius: '50%', margin: '0 auto 1.5rem', animation: 'spin 1s linear infinite' }} />
                )}
                {status === 'success' && (
                    <div style={{ width: '4rem', height: '4rem', backgroundColor: 'rgba(204, 255, 0, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <svg style={{ width: '2rem', height: '2rem', color: '#ccff00' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
                {status === 'error' && (
                    <div style={{ width: '4rem', height: '4rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <svg style={{ width: '2rem', height: '2rem', color: '#ef4444' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                )}
                
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'white', marginBottom: '0.5rem', fontFamily: 'sans-serif' }}>{status === 'error' ? 'Oops!' : 'Authentication'}</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'sans-serif' }}>{message}</p>
                
                {status === 'error' && (
                    <button 
                        onClick={() => navigate('/app')}
                        style={{ marginTop: '2rem', padding: '0.75rem 1.5rem', backgroundColor: 'white', color: 'black', fontWeight: 'bold', borderRadius: '9999px', cursor: 'pointer', transition: 'background-color 0.2s', border: 'none' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ccff00'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                        Back to Workspace
                    </button>
                )}
            </motion.div>
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default AuthCallbackPage;
