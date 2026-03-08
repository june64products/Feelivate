import { useNavigate } from 'react-router-dom';

const Navbar = () => {
    const navigate = useNavigate();
    return (
        <nav className="navbar" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 'var(--nav-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            zIndex: 100,
            background: 'rgba(10, 10, 10, 0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--border-color)',
        }}>
            <div className="logo" style={{
                fontWeight: 700,
                fontSize: '1.5rem',
                letterSpacing: '-0.05em'
            }}>
                Emotion Time Travel
            </div>
            <div className="nav-links hide-on-mobile" style={{ display: 'flex', gap: '32px' }}>
                <a href="#architecture" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Architecture</a>
                <a href="#demo" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Demo</a>
                <a href="#tech" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tech Stack</a>
            </div>
            <div className="nav-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <a href="#login" style={{ fontSize: '0.9rem' }}>Log in</a>
                <button
                    onClick={() => navigate('/app')}
                    style={{
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        padding: '10px 20px',
                        borderRadius: '24px',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                    }}>
                    Start Journey
                </button>
            </div>
        </nav>
    );
};

export default Navbar;
