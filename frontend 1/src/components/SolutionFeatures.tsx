import { motion } from 'framer-motion';

const FeatureCard = ({ title, description, delay }: { title: string, description: string, delay: number }) => (
    <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.6, delay }}
        className="glass-panel"
        style={{
            padding: '40px',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
        }}
    >
        <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: '2px',
            background: 'linear-gradient(90deg, transparent, var(--accent-primary), transparent)',
            opacity: 0.5
        }} />
        <h3 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>{title}</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.6 }}>{description}</p>
    </motion.div>
);

const SolutionFeatures = () => {
    return (
        <section className="features-section" style={{
            padding: '120px 24px',
            background: 'var(--bg-secondary)',
        }}>
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8 }}
                    style={{ textAlign: 'center', marginBottom: '80px' }}
                >
                    <h2 style={{
                        fontSize: 'clamp(2rem, 5vw, 4rem)',
                        fontWeight: 700,
                        maxWidth: '1000px',
                        margin: '0 auto',
                    }} className="text-gradient">
                        Micro-Agent Orchestration Architecture
                    </h2>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
                    gap: '32px',
                }}>
                    <FeatureCard
                        title="Analyze The Past"
                        description="Identifies historical patterns and root causes of your hesitations, surfacing contextual memories that shape your current behavior."
                        delay={0.1}
                    />
                    <FeatureCard
                        title="Understand The Present"
                        description="Detects current emotional states, needs, and anxieties, allowing the orchestrator to ground the analysis in your immediate reality."
                        delay={0.2}
                    />
                    <FeatureCard
                        title="Synthesize The Future"
                        description="Maps out potential scenarios, evaluates risks, and builds a unified, actionable plan forward to break free from emotional paralysis."
                        delay={0.3}
                    />
                </div>
            </div>
        </section>
    );
};

export default SolutionFeatures;
