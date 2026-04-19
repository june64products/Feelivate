import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

const HeroSection = () => {
    const router = useRouter();

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
            overflow: 'hidden',
            backgroundColor: 'var(--bg-primary)'
        }}>
            {/* Temporal Flow Visual */}
            <div className="temporal-path">
                <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <motion.path
                        d="M-100 600C200 500 400 700 720 400C1040 100 1240 300 1540 200"
                        stroke="url(#gradient-path-main)"
                        strokeWidth="1.5"
                        style={{ opacity: 0.6 }}
                    />
                    <motion.path
                        d="M-100 600C200 500 400 700 720 400C1040 100 1240 300 1540 200"
                        stroke="var(--accent-primary)"
                        strokeWidth="2.5"
                        initial={{ strokeDasharray: "1, 2000", strokeDashoffset: 2000 }}
                        animate={{ strokeDashoffset: -2000 }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            repeatDelay: 5,
                            delay: 2,
                            ease: "easeInOut"
                        }}
                    />
                    <defs>
                        <linearGradient id="gradient-path-main" x1="-100" y1="600" x2="1540" y2="200" gradientUnits="userSpaceOnUse">
                            <stop stopColor="var(--accent-primary)" stopOpacity="0" />
                            <stop offset="0.5" stopColor="var(--accent-primary)" />
                            <stop offset="1" stopColor="var(--accent-secondary)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>

            {/* Ambient Glows */}
            <div className="nebula-glow" style={{
                top: '5%',
                right: '10%',
                width: '45vw',
                height: '45vw',
                background: 'var(--accent-glow)',
            }} />

            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    style={{
                        color: 'var(--accent-primary)',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        marginBottom: '24px',
                        fontSize: '0.8rem'
                    }}
                >
                    Guided AI Journey for Emotional Clarity
                </motion.p>

                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                    style={{
                        fontSize: 'clamp(3rem, 6vw, 5.5rem)',
                        fontWeight: 700,
                        maxWidth: '1000px',
                        marginBottom: '32px',
                        lineHeight: 1.1
                    }}
                    className="text-gradient"
                >
                    Untangle your past, <br /> present, and future
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    style={{
                        fontSize: '1.25rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '650px',
                        margin: '0 auto 48px',
                        lineHeight: 1.6
                    }}
                >
                    Emotion Time Travel uses specialized AI agents to analyze your distinct temporal perspectives—disentangling complex feelings to construct a clear, actionable path forward.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}
                >
                    <button
                        onClick={() => {
                            const userId = localStorage.getItem('user_id');
                            if (userId) router.push('/workspace');
                            else router.push('/login');
                        }}
                        style={{
                            background: 'var(--text-primary)',
                            color: 'var(--bg-primary)',
                            padding: '18px 40px',
                            borderRadius: '32px',
                            fontWeight: 600,
                            fontSize: '1rem',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(255, 255, 255, 0.15)'
                        }}
                    >
                        Start Your Journey
                    </button>
                    
                    <button
                        onClick={() => {
                            const section = document.getElementById('mechanism');
                            section?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        style={{
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            padding: '18px 40px',
                            borderRadius: '32px',
                            fontWeight: 600,
                            fontSize: '1rem',
                            border: '1px solid var(--border-subtle)',
                            cursor: 'pointer'
                        }}
                    >
                        Learn More
                    </button>
                </motion.div>

                {/* Footer Monospaced Labels */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="text-mono"
                    style={{ 
                        marginTop: '100px', 
                        fontSize: '0.7rem', 
                        color: 'var(--text-secondary)', 
                        letterSpacing: '0.4em',
                        textTransform: 'uppercase'
                    }}
                >
                    Results you'll feel in 1-2 months • Encrypted • Private
                </motion.div>
            </div>
        </section>
    );
};

export default HeroSection;
