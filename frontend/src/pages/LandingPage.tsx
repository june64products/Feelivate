import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Shield, Zap, Calendar } from 'lucide-react';

export default function LandingPage() {
    const navigate = useNavigate();

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { 
            opacity: 1, 
            y: 0,
            transition: { type: "spring" as const, stiffness: 100 }
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
            padding: '24px',
        }}>
            {/* Ambient Background Glows */}
            <div 
                className="orb-glow"
                style={{
                    position: 'absolute',
                    top: '20%',
                    left: '15%',
                    width: '35vw',
                    height: '35vw',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(192, 132, 252, 0.08) 0%, transparent 70%)',
                    filter: 'blur(60px)',
                    pointerEvents: 'none',
                    zIndex: 1,
                }}
            />
            <div 
                className="orb-glow"
                style={{
                    position: 'absolute',
                    bottom: '15%',
                    right: '10%',
                    width: '40vw',
                    height: '40vw',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(201, 100, 66, 0.06) 0%, transparent 70%)',
                    filter: 'blur(80px)',
                    pointerEvents: 'none',
                    zIndex: 1,
                    animationDelay: '2s'
                }}
            />

            {/* Top Navigation Row */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                padding: '24px 40px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                        src="/logo_2_backup.png"
                        alt="Feelivate Logo"
                        style={{ width: '28px', height: '28px', objectFit: 'contain', borderRadius: '6px' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.02em' }}>Feelivate</span>
                </div>

                <button 
                    onClick={() => navigate('/login')}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    Sign In
                </button>
            </div>

            {/* Main Content Area */}
            <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                style={{
                    maxWidth: '640px',
                    textAlign: 'center',
                    zIndex: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '32px',
                    marginTop: '40px',
                }}
            >
                {/* Logo & Sub-tag */}
                <motion.div
                    variants={itemVariants}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}
                >
                    <div className="animate-float">
                        <img
                            src="/logo_2_backup.png"
                            alt="Feelivate Logo"
                            style={{
                                width: '88px',
                                height: '88px',
                                objectFit: 'contain',
                                borderRadius: '24px',
                                filter: 'drop-shadow(0 12px 40px rgba(192, 132, 252, 0.3))',
                            }}
                        />
                    </div>
                </motion.div>

                {/* Tagline */}
                <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h1 style={{
                        fontSize: 'clamp(36px, 6vw, 54px)',
                        fontWeight: 700,
                        lineHeight: 1.15,
                        letterSpacing: '-0.03em',
                        color: '#f5f0e8', // Elegant off-white cream color
                    }}>
                        Your AI mentor.<br />
                        <span style={{
                            background: 'linear-gradient(135deg, var(--accent-primary) 30%, var(--accent-warm) 90%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}>Smarter every week.</span>
                    </h1>
                    <p style={{
                        fontSize: '16px',
                        color: 'var(--text-secondary)',
                        lineHeight: 1.6,
                        maxWidth: '480px',
                        margin: '0 auto',
                    }}>
                        Feelivate aligns with your goals, designs high-fidelity weekly actionable roadmaps, and keeps you accountable with direct, lovable ChatGPT-style interactions.
                    </p>
                </motion.div>

                {/* CTAs */}
                <motion.div 
                    variants={itemVariants}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        width: '100%',
                        maxWidth: '360px',
                        justifyContent: 'center',
                    }}
                >
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            background: '#f5f0e8',
                            color: 'var(--bg-primary)',
                            border: 'none',
                            padding: '14px 28px',
                            borderRadius: '16px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 24px rgba(245, 240, 232, 0.15)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 6px 30px rgba(245, 240, 232, 0.25)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 24px rgba(245, 240, 232, 0.15)';
                        }}
                    >
                        Start for free
                        <ArrowRight size={16} />
                    </button>
                </motion.div>

                {/* Feature Pills */}
                <motion.div 
                    variants={itemVariants}
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        gap: '12px',
                        marginTop: '16px',
                    }}
                >
                    {[
                        { icon: <Calendar size={13} />, text: "Week-by-week plans" },
                        { icon: <Zap size={13} />, text: "Adapts dynamically to you" },
                        { icon: <Shield size={13} />, text: "Lovable ChatGPT conversation" }
                    ].map((pill, idx) => (
                        <div 
                            key={idx}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                borderRadius: '24px',
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--glass-surface)',
                                color: 'var(--text-secondary)',
                                fontSize: '13px',
                                transition: 'all 0.3s ease',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.border = '1px solid var(--border-medium)';
                                e.currentTarget.style.background = 'var(--glass-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.border = '1px solid var(--border-subtle)';
                                e.currentTarget.style.background = 'var(--glass-surface)';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                        >
                            <span style={{ display: 'flex', color: 'var(--accent-primary)' }}>{pill.icon}</span>
                            <span>{pill.text}</span>
                        </div>
                    ))}
                </motion.div>
            </motion.div>
        </div>
    );
}
