const Footer = () => {
    return (
        <footer style={{
            borderTop: '1px solid var(--border-color)',
            padding: '80px 24px 40px',
            marginTop: '80px',
        }}>
            <div className="container" style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center'
            }}>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '24px' }}>
                    Untangle your past, present, and future
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', maxWidth: '500px' }}>
                    AI agents that guide your emotional journey into actionable reality.
                </p>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '80px' }}>
                    <button style={{
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        padding: '16px 32px',
                        borderRadius: '32px',
                        fontWeight: 600,
                        fontSize: '1rem'
                    }}>
                        Book Demo
                    </button>
                    <button className="glass-panel" style={{
                        color: 'var(--text-primary)',
                        padding: '16px 32px',
                        borderRadius: '32px',
                        fontWeight: 600,
                        fontSize: '1rem',
                        background: 'transparent'
                    }}>
                        Contact
                    </button>
                </div>

                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '40px',
                    borderTop: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem'
                }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.25rem' }}>Emotion Time Travel</div>
                    <div>© 2026 Emotion Time Travel. All rights reserved.</div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
