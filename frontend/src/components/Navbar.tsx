import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
    const navigate = useNavigate();
    const [userId, setUserId] = useState<string | null>(localStorage.getItem('user_id'));
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        setUserId(localStorage.getItem('user_id'));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user_id');
        setUserId(null);
        navigate('/');
        setIsMobileMenuOpen(false);
    };

    const navLinks = ['The Journey', 'Mechanism', 'Clarity'];

    return (
        <>
        <nav className="navbar" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: 'var(--nav-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 60px', /* Desktop padding, overridden by index.css on mobile */
            zIndex: 100,
            background: 'rgba(3, 3, 3, 0.6)',
            backdropFilter: 'blur(30px)',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            <div className="logo" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                zIndex: 101
            }} onClick={() => navigate('/')}>
                <img 
                    src="/LOGO.png" 
                    alt="Logo" 
                    className="nav-logo-img"
                    style={{ 
                        height: '32px', 
                        width: 'auto',
                        filter: 'invert(1) brightness(2)',
                        opacity: 0.9
                    }} 
                />
                <div className="nav-logo-text" style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.2rem',
                    color: 'var(--text-primary)',
                    marginTop: '2px'
                }}>
                    Emotion <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Time Travel</span>
                </div>
            </div>

            <div className="nav-links hide-on-mobile" style={{ 
                display: 'flex', 
                gap: '40px', 
                position: 'absolute',
                left: '50%',
                transform: 'translateX(-50%)'
            }}>
                {navLinks.map((item) => (
                    <a 
                        key={item} 
                        href={`#${item.toLowerCase().replace(' ', '-')}`} 
                        className="text-mono nav-link-hover"
                        style={{ 
                            color: 'var(--text-secondary)', 
                            transition: 'color 0.4s cubic-bezier(0.19, 1, 0.22, 1)',
                            cursor: 'pointer',
                            opacity: 0.8
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--text-primary)';
                            e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-secondary)';
                            e.currentTarget.style.opacity = '0.8';
                        }}
                    >
                        {item}
                    </a>
                ))}
            </div>

            <div className="nav-actions hide-on-mobile" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                {userId ? (
                    <>
                        <button
                            onClick={handleLogout}
                            className="text-mono"
                            style={{ 
                                color: 'var(--text-muted)', 
                                border: 'none',
                                background: 'none'
                            }}
                        >
                            End Session
                        </button>
                        <button
                            onClick={() => navigate('/app')}
                            className="action-pill primary"
                            style={{ fontSize: '0.75rem', padding: '12px 28px' }}
                        >
                            Go to Core
                        </button>
                    </>
                ) : (
                    <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/login')}
                        className="action-pill primary"
                        style={{ padding: '10px 24px', fontSize: '0.75rem' }}
                    >
                        Login
                    </motion.button>
                )}
            </div>

            {/* Mobile Hamburger Icon */}
            <div 
                className="mobile-menu-toggle show-on-mobile" 
                style={{ zIndex: 101, cursor: 'pointer', padding: '10px' }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                <div style={{
                    width: '24px',
                    height: '2px',
                    background: 'var(--text-primary)',
                    marginBottom: '6px',
                    transition: 'transform 0.3s',
                    transform: isMobileMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none'
                }}></div>
                <div style={{
                    width: '24px',
                    height: '2px',
                    background: 'var(--text-primary)',
                    marginBottom: '6px',
                    opacity: isMobileMenuOpen ? 0 : 1,
                    transition: 'opacity 0.3s'
                }}></div>
                <div style={{
                    width: '24px',
                    height: '2px',
                    background: 'var(--text-primary)',
                    transition: 'transform 0.3s',
                    transform: isMobileMenuOpen ? 'rotate(-45deg) translate(6px, -6px)' : 'none'
                }}></div>
            </div>

            {/* Mobile Menu Overlay */}
        </nav>
        
        <AnimatePresence>
            {isMobileMenuOpen && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'var(--bg-primary)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '32px',
                        zIndex: 99,
                        padding: '24px'
                    }}
                >
                    {navLinks.map((item) => (
                        <a 
                            key={item} 
                            href={`#${item.toLowerCase().replace(' ', '-')}`} 
                            className="text-mono"
                            style={{ 
                                color: 'var(--text-primary)', 
                                fontSize: '1.2rem',
                                textDecoration: 'none',
                                letterSpacing: '0.2em'
                            }}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {item}
                        </a>
                    ))}
                    
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '200px' }}>
                        {userId ? (
                            <>
                                <button
                                    onClick={() => { setIsMobileMenuOpen(false); navigate('/app'); }}
                                    className="action-pill primary"
                                    style={{ width: '100%', justifyContent: 'center' }}
                                >
                                    Go to Core
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="text-mono"
                                    style={{ 
                                        color: 'var(--text-muted)', 
                                        border: 'none',
                                        background: 'none',
                                        padding: '12px'
                                    }}
                                >
                                    End Session
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }}
                                className="action-pill primary"
                                style={{ width: '100%', justifyContent: 'center' }}
                            >
                                Login
                            </button>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
};

export default Navbar;



