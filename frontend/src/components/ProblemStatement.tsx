import { motion } from 'framer-motion';

const ProblemStatement = () => {
    return (
        <section className="problem-section" style={{
            padding: '120px 24px',
            position: 'relative',
        }}>
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-100px' }}
                    transition={{ duration: 0.8 }}
                    style={{ textAlign: 'center', marginBottom: '80px' }}
                >
                    <h2 style={{
                        fontSize: 'clamp(2rem, 4vw, 3rem)',
                        fontWeight: 700,
                        maxWidth: '800px',
                        margin: '0 auto',
                        color: 'var(--text-primary)'
                    }}>
                        Thoughts and emotions can be overwhelming, making it hard to find a structured path forward
                    </h2>
                </motion.div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '24px',
                }}>
                    {/* Stat Box 1 */}
                    <motion.div
                        className="glass-panel"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        style={{
                            padding: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center'
                        }}
                    >
                        <h3 style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '16px' }}>3</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Specialized AI Agents</p>
                    </motion.div>

                    {/* Stat Box 2 */}
                    <motion.div
                        className="glass-panel"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        style={{
                            padding: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center'
                        }}
                    >
                        <h3 style={{ fontSize: '4rem', fontWeight: 700, color: 'var(--text-accent)', marginBottom: '16px' }}>1</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Unified Action Plan</p>
                    </motion.div>

                    {/* Stat Box 3 */}
                    <motion.div
                        className="glass-panel"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        style={{
                            padding: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center'
                        }}
                    >
                        <h3 style={{ fontSize: '4rem', fontWeight: 700, color: '#ef4444', marginBottom: '16px' }}>∞</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Clarity Gained</p>
                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    style={{ textAlign: 'center', marginTop: '120px' }}
                >
                    <h2 style={{
                        fontSize: 'clamp(1.5rem, 3vw, 2.5rem)',
                        fontWeight: 600,
                        maxWidth: '800px',
                        margin: '0 auto',
                        color: 'var(--text-secondary)'
                    }}>
                        A single AI often produces generic results, but a team of <span style={{ color: 'var(--text-primary)' }}>specialized agents</span> provides deep, actionable insights.
                    </h2>
                </motion.div>
            </div>
        </section>
    );
};

export default ProblemStatement;
