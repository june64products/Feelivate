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
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-[#111] border border-white/10 p-8 rounded-3xl text-center"
            >
                {status === 'loading' && (
                    <div className="w-12 h-12 border-4 border-[#ccff00] border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                )}
                {status === 'success' && (
                    <div className="w-16 h-16 bg-[#ccff00]/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-[#ccff00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                )}
                {status === 'error' && (
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                )}
                
                <h2 className="text-xl font-bold text-white mb-2">{status === 'error' ? 'Oops!' : 'Authentication'}</h2>
                <p className="text-white/60">{message}</p>
                
                {status === 'error' && (
                    <button 
                        onClick={() => navigate('/app')}
                        className="mt-8 px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-[#ccff00] transition-colors"
                    >
                        Back to Workspace
                    </button>
                )}
            </motion.div>
        </div>
    );
};

export default AuthCallbackPage;
