import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const HeroSection = () => {
    const navigate = useNavigate();
    return (
        <section className="hero-section" style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: 'var(--nav-height) 24px 0',
            position: 'relative',
        }}>
            <div className="background-glow" style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60vw',
                height: '60vw',
                background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 60%)',
                zIndex: -1,
                pointerEvents: 'none',
            }} />

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                style={{
                    color: 'var(--text-accent)',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    marginBottom: '24px'
                }}
            >
                Guided AI Journey for Emotional Clarity
            </motion.p>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                style={{
                    fontSize: 'clamp(3rem, 6vw, 5rem)',
                    fontWeight: 700,
                    maxWidth: '1000px',
                    marginBottom: '32px'
                }}
                className="text-gradient"
            >
                Untangle your past, present, and future
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{
                    fontSize: '1.25rem',
                    color: 'var(--text-secondary)',
                    maxWidth: '600px',
                    marginBottom: '48px',
                    lineHeight: 1.6
                }}
            >
                Emotion Time Travel uses specialized AI agents to analyze your distinct temporal perspectives—disentangling complex feelings to construct a clear, actionable path forward.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                style={{ display: 'flex', gap: '24px' }}
            >
                <button
                    onClick={() => navigate('/app')}
                    style={{
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        padding: '16px 32px',
                        borderRadius: '32px',
                        fontWeight: 600,
                        fontSize: '1rem',
                        boxShadow: '0 4px 14px rgba(255, 255, 255, 0.25)'
                    }}>
                    Start Journey
                </button>
            </motion.div>
        </section>
    );
};

export default HeroSection;
