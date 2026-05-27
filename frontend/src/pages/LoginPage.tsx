import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mail, Lock, User as UserIcon, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { login, signup } from '../api';

export default function LoginPage() {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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
                const displayName = res.name || res.full_name || formData.email.split('@')[0];
                localStorage.setItem('user_name', displayName);
                navigate('/app');
            } else {
                const res = await signup({
                    email: formData.email,
                    password: formData.password,
                    name: formData.name
                });
                localStorage.setItem('user_id', res.user_id);
                localStorage.setItem('user_name', formData.name || res.name || formData.email.split('@')[0]);
                navigate('/app');
            }
        } catch (err: any) {
            console.error("Authentication error details:", err);
            setError(err.message || 'Authentication failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            background: 'var(--bg-primary)',
            fontFamily: 'var(--font-sans)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
        }}>
            {/* Left Side: Brand Panel (Desktop only) */}
            <div style={{
                flex: 1.2,
                background: 'linear-gradient(135deg, #171717, #0d0d0d)',
                borderRight: '1px solid var(--border-subtle)',
                display: 'none',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '48px',
                position: 'relative',
                '@media (min-width: 1024px)': {
                    display: 'flex',
                }
            } as any} className="desktop-brand-panel">
                {/* Glow Orb in panel */}
                <div style={{
                    position: 'absolute',
                    top: '25%',
                    left: '20%',
                    width: '300px',
                    height: '300px',
                    background: 'radial-gradient(circle, rgba(192, 132, 252, 0.05) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                    pointerEvents: 'none',
                }} />

                <button 
                    onClick={() => navigate('/')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                        zIndex: 2,
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    <ArrowLeft size={16} />
                    Back to home
                </button>

                <div style={{ zIndex: 2, maxWidth: '440px', marginTop: '60px' }}>
                    <div className="animate-float" style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '16px',
                        background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '24px',
                        boxShadow: '0 8px 24px rgba(192, 132, 252, 0.2)',
                    }}>
                        <Sparkles size={24} style={{ color: 'white' }} />
                    </div>
                    <h2 style={{
                        fontSize: '32px',
                        fontWeight: 700,
                        lineHeight: 1.2,
                        letterSpacing: '-0.02em',
                        color: '#f5f0e8',
                        marginBottom: '16px',
                    }}>
                        Organize your time. Master your craft.
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6 }}>
                        Feelivate adapts to you, helps build a bulletproof week-by-week action schedule, and chats with you just like a knowledgeable companion.
                    </p>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', zIndex: 2 }}>
                    &copy; {new Date().getFullYear()} Feelivate Inc. All rights reserved.
                </div>
            </div>

            {/* Right Side: Auth Form (Claude.ai style cream card on right) */}
            <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                position: 'relative',
                background: 'var(--bg-primary)'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '400px',
                    background: '#f5f0e8', // Elegant Claude.ai cream off-white background
                    borderRadius: '24px',
                    padding: '36px 32px',
                    boxShadow: '0 20px 80px rgba(0,0,0,0.3)',
                    color: '#1a1a1a', // Dark text on cream background
                    position: 'relative',
                }}>
                    {/* Header with mini logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
                        <div style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Sparkles size={12} style={{ color: 'white' }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em', color: '#1a1a1a' }}>Feelivate</span>
                    </div>

                    <h1 style={{
                        fontSize: '24px',
                        fontWeight: 700,
                        letterSpacing: '-0.02em',
                        color: '#1a1a1a',
                        marginBottom: '8px',
                    }}>
                        {isLogin ? 'Welcome back' : 'Create an account'}
                    </h1>
                    <p style={{ fontSize: '13px', color: '#6b6b6b', marginBottom: '24px' }}>
                        {isLogin ? "Enter your details to sign in to your AI workspace" : "Get started with Feelivate to configure your custom Weekly plans"}
                    </p>

                    {/* Error message */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                style={{
                                    padding: '12px 16px',
                                    borderRadius: '12px',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#b91c1c',
                                    fontSize: '13px',
                                    marginBottom: '20px',
                                }}
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Auth Form */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Name Field (Signup only) */}
                        {!isLogin && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#4a4a4a' }}>Full Name</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8c8c8c', display: 'flex' }}>
                                        <UserIcon size={16} />
                                    </span>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        placeholder="John Doe"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 38px',
                                            borderRadius: '12px',
                                            border: '1px solid #dcd7cf',
                                            background: '#faf6f0',
                                            color: '#1a1a1a',
                                            fontSize: '14px',
                                            outline: 'none',
                                            transition: 'border 0.2s',
                                        }}
                                        onFocus={(e) => e.currentTarget.style.borderColor = '#c084fc'}
                                        onBlur={(e) => e.currentTarget.style.borderColor = '#dcd7cf'}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#4a4a4a' }}>Email Address</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8c8c8c', display: 'flex' }}>
                                    <Mail size={16} />
                                </span>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    placeholder="you@example.com"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 38px',
                                        borderRadius: '12px',
                                        border: '1px solid #dcd7cf',
                                        background: '#faf6f0',
                                        color: '#1a1a1a',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border 0.2s',
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#c084fc'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = '#dcd7cf'}
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#4a4a4a' }}>Password</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8c8c8c', display: 'flex' }}>
                                    <Lock size={16} />
                                </span>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 38px',
                                        borderRadius: '12px',
                                        border: '1px solid #dcd7cf',
                                        background: '#faf6f0',
                                        color: '#1a1a1a',
                                        fontSize: '14px',
                                        outline: 'none',
                                        transition: 'border 0.2s',
                                    }}
                                    onFocus={(e) => e.currentTarget.style.borderColor = '#c084fc'}
                                    onBlur={(e) => e.currentTarget.style.borderColor = '#dcd7cf'}
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                background: '#1a1a1a',
                                color: '#f5f0e8',
                                border: 'none',
                                padding: '14px',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'opacity 0.2s, transform 0.1s',
                                marginTop: '8px',
                            }}
                            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
                            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.opacity = '1'; }}
                        >
                            {loading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <>
                                    {isLogin ? 'Sign In' : 'Sign Up'}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Toggle Login/Signup */}
                    <div style={{
                        marginTop: '24px',
                        textAlign: 'center',
                        fontSize: '13px',
                        color: '#6b6b6b',
                    }}>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setError('');
                            }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#c96442', // Terracotta accent color
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '13px',
                            }}
                        >
                            {isLogin ? 'Sign up free' : 'Log in here'}
                        </button>
                    </div>

                    {/* Back to home for mobile */}
                    <button 
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'transparent',
                            border: 'none',
                            color: '#8c8c8c',
                            fontSize: '12px',
                            cursor: 'pointer',
                            marginTop: '24px',
                            width: '100%',
                            justifyContent: 'center',
                            '@media (min-width: 1024px)': {
                                display: 'none',
                            }
                        } as any}
                        className="mobile-back-home"
                    >
                        <ArrowLeft size={12} />
                        Back to home
                    </button>
                </div>
            </div>
            
            {/* Simple CSS injection for responsive display grid */}
            <style>{`
                @media (max-width: 1024px) {
                    .desktop-brand-panel {
                        display: none !important;
                    }
                }
                @media (min-width: 1025px) {
                    .desktop-brand-panel {
                        display: flex !important;
                    }
                    .mobile-back-home {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
