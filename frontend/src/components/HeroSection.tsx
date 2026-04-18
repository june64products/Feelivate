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
            overflow: 'hidden',
            backgroundColor: 'var(--bg-primary)'
        }}>
            {/* Temporal Flow Visual */}
            <div className="temporal-path">
                <svg width="100%" height="100%" viewBox="0 0 1440 800" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Background Static Path */}
                    <motion.path
                        d="M-100 600C200 500 400 700 720 400C1040 100 1240 300 1540 200"
                        stroke="url(#gradient-path-main)"
                        strokeWidth="1.5"
                        className="animate-draw"
                        style={{ opacity: 0.6 }}
                    />
                    
                    {/* Recurring Light Pulse Path */}
                    <motion.path
                        d="M-100 600C200 500 400 700 720 400C1040 100 1240 300 1540 200"
                        stroke="var(--accent-primary)"
                        strokeWidth="2.5"
                        className="glow-line"
                        initial={{ strokeDasharray: "1, 2000", strokeDashoffset: 2000 }}
                        animate={{ strokeDashoffset: -2000 }}
                        transition={{ 
                            duration: 4, 
                            repeat: Infinity, 
                            repeatDelay: 5,
                            delay: 6, // Start after main draw
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
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.5 }}
                    style={{ marginBottom: '48px' }}
                >
                    <span className="text-mono" style={{ 
                        padding: '8px 20px', 
                        border: '1px solid var(--border-subtle)', 
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'rgba(255,255,255,0.6)'
                    }}>
                        Active Emotional Intelligence
                    </span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.5, ease: [0.19, 1, 0.22, 1] }}
                    style={{
                        fontSize: 'clamp(4rem, 11vw, 8.5rem)',
                        maxWidth: '1200px',
                        marginBottom: '40px',
                        color: 'var(--text-primary)',
                        display: 'inline-block'
                    }}
                >
                    Travel through <span style={{ fontStyle: 'italic', fontWeight: 300, color: 'var(--accent-primary)' }}>chaos</span>. <br />
                    Arrive at clarity.
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.5, delay: 0.3 }}
                    className="text-jost"
                    style={{
                        fontSize: '1.35rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '750px',
                        margin: '0 auto 64px',
                        lineHeight: 1.6,
                        fontWeight: 300,
                        opacity: 0.9
                    }}
                >
                    Your thoughts aren't looped—they're just waiting to be disentangled. 
                    Emotion Time Travel maps your internal world with surgical precision. 
                </motion.p>

                {/* Benefits Core - Interactive Cards */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1.2, delay: 0.6 }}
                    style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '40px',
                        width: '100%',
                        maxWidth: '900px',
                        margin: '0 auto 80px',
                    }}
                >
                    {[
                        { label: 'Past', desc: 'Audit emotional debts', detail: 'Resolve what lingers' },
                        { label: 'Present', desc: 'Disentangle current chaos', detail: 'Find your center now' },
                        { label: 'Future', desc: 'Actionable 30-day roadmap', detail: 'Construct the plan' }
                    ].map((item, i) => (
                        <motion.div 
                            key={i} 
                            whileHover={{ 
                                scale: 1.02, 
                                backgroundColor: "rgba(255,255,255,0.05)",
                                borderColor: "rgba(255,255,255,0.1)"
                            }}
                            style={{ 
                                textAlign: 'center', 
                                padding: '32px', 
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '24px',
                                cursor: 'default',
                                transition: 'background-color 0.3s ease, border-color 0.3s ease'
                            }}
                        >
                            <div className="text-mono" style={{ color: 'var(--accent-primary)', marginBottom: '12px', fontSize: '0.7rem' }}>{item.label}</div>
                            <div style={{ fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 400 }}>{item.desc}</div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 300 }}>{item.detail}</div>
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.8 }}
                >
                    <button
                        onClick={() => {
                            const userId = localStorage.getItem('user_id');
                            if (userId) navigate('/app');
                            else navigate('/login');
                        }}
                        className="action-pill primary"
                        style={{ padding: '20px 56px', fontSize: '1rem' }}
                    >
                        Access The Core
                    </button>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: 2.5, duration: 1 }}
                    className="text-mono"
                    style={{ marginTop: '100px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3em' }}
                >
                    ENCRYPTED. ON-DEVICE. PRIVATE.
                </motion.div>
            </div>
        </section>
    );
};

export default HeroSection;



