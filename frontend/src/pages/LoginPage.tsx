import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, ChevronLeft } from 'lucide-react';
import { login, signup } from '../api';

const LoginPage = () => {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            if (isLogin) {
                const res = await login({
                    email: formData.email,
                    password: formData.password
                });
                localStorage.setItem('user_id', res.user_id);
                navigate('/app');
            } else {
                const res = await signup({
                    email: formData.email,
                    password: formData.password,
                    name: formData.name
                });
                localStorage.setItem('user_id', res.user_id);
                navigate('/app');
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Branding Path Background */}
            <div className="temporal-path" style={{ opacity: 0.15 }}>
                <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                        d="M-100 600C200 500 400 700 720 400C1040 100 1240 300 1540 200"
                        stroke="var(--accent-primary)"
                        strokeWidth="2"
                    />
                </svg>
            </div>

            {/* Back to Home */}
            <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{ position: 'absolute', top: '40px', left: '40px', zIndex: 100 }}
            >
                <button 
                    onClick={() => navigate('/')}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    <ChevronLeft size={16} />
                    Back to Home
                </button>
            </motion.div>
            
            <motion.div 
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.19, 1, 0.22, 1] }}
                style={{
                    width: '100%',
                    maxWidth: '480px',
                    position: 'relative',
                    zIndex: 1,
                    padding: '20px'
                }}
            >
                {/* Logo Section */}
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <div style={{ marginBottom: '24px', opacity: 0.8 }}>
                        <img 
                            src="/LOGO.png" 
                            alt="Logo" 
                            style={{ 
                                height: '48px', 
                                width: 'auto',
                                filter: 'invert(1) brightness(2)'
                            }} 
                        />
                    </div>
                    <h1 style={{ 
                        fontFamily: 'var(--font-serif)', 
                        fontSize: '3rem', 
                        fontWeight: 300, 
                        marginBottom: '12px',
                        letterSpacing: '-0.02em'
                    }}>
                        {isLogin ? 'Welcome back' : 'Join the journey'}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', opacity: 0.6, fontSize: '1.1rem', fontWeight: 300 }}>
                        {isLogin ? 'Enter your credentials to continue.' : 'Create your secure profile to begin.'}
                    </p>
                </div>

                <div style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(40px)',
                    -webkit-backdropFilter: 'blur(40px)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '32px',
                    padding: '48px',
                    boxShadow: '0 40px 100px rgba(0,0,0,0.4)'
                }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    key="name-field"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                >
                                    <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Full Name</label>
                                    <div style={{ position: 'relative' }}>
                                        <UserIcon size={16} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                                        <input
                                            type="text"
                                            required={!isLogin}
                                            placeholder="Your name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                            style={{
                                                width: '100%',
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border-subtle)',
                                                borderRadius: '0',
                                                padding: '16px 16px 16px 32px',
                                                color: 'white',
                                                outline: 'none',
                                                transition: 'border-color 0.3s',
                                                fontSize: '1rem'
                                            }}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={16} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                                <input
                                    type="email"
                                    required
                                    placeholder="your@email.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        borderRadius: '0',
                                        padding: '16px 16px 16px 32px',
                                        color: 'white',
                                        outline: 'none',
                                        transition: 'border-color 0.3s',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', color: 'rgba(255,255,255,0.4)', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.2)' }} />
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    style={{
                                        width: '100%',
                                        background: 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        borderRadius: '0',
                                        padding: '16px 16px 16px 32px',
                                        color: 'white',
                                        outline: 'none',
                                        transition: 'border-color 0.3s',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                style={{ color: '#ff4d4d', fontSize: '0.85rem', textAlign: 'center' }}
                            >
                                {error}
                            </motion.div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="action-pill primary"
                            style={{
                                width: '100%',
                                padding: '20px',
                                fontWeight: 600,
                                fontSize: '1rem',
                                marginTop: '20px',
                                gap: '12px'
                            }}
                        >
                            {loading ? <Loader2 className="spinner" size={20} /> : (
                                <>
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.9rem' }}>
                        {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'var(--accent-primary)', 
                                padding: 0, 
                                fontWeight: 500, 
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textUnderlineOffset: '4px'
                            }}
                        >
                            {isLogin ? 'Register' : 'Login'}
                        </button>
                    </div>
                </div>
            </motion.div>
            
            <style>{`
                .spinner { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                input:focus { border-color: var(--accent-primary) !important; }
                input::placeholder { color: rgba(255,255,255,0.1) !important; }
            `}</style>
        </div>
    );
};

export default LoginPage;
