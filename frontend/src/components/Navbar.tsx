import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Sparkles, ChevronDown } from 'lucide-react';

/* ── Helper: get initials from name ── */
const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/* ── Profile Avatar Dropdown ── */
const ProfileAvatar = ({ onLogout }: { onLogout: () => void }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const name = localStorage.getItem('user_name') || 'User';
    const initials = getInitials(name);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 12px)',
                            right: 0,
                            minWidth: '200px',
                            background: 'rgba(10, 8, 20, 0.97)',
                            backdropFilter: 'blur(40px)',
                            WebkitBackdropFilter: 'blur(40px)',
                            border: '1px solid rgba(216,180,254,0.12)',
                            borderRadius: '20px',
                            overflow: 'hidden',
                            boxShadow: '0 16px 60px rgba(0,0,0,0.7), 0 0 40px rgba(167,139,250,0.06)',
                            zIndex: 200,
                        }}
                    >
                        {/* User info */}
                        <div style={{
                            padding: '18px 18px 14px',
                            borderBottom: '1px solid rgba(216,180,254,0.08)',
                        }}>
                            {/* Mini avatar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                                    boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.8rem', fontWeight: 700, color: 'white',
                                    fontFamily: 'var(--font-mono)',
                                }}>
                                    {initials}
                                </div>
                                <div>
                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>
                                        {name}
                                    </div>
                                    <div style={{ color: 'rgba(216,180,254,0.4)', fontSize: '0.65rem', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>
                                        Active Session
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '8px' }}>
                            <button
                                onClick={() => { setOpen(false); navigate('/app'); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '12px', border: 'none',
                                    background: 'transparent', color: 'rgba(216,180,254,0.7)',
                                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
                                    letterSpacing: '0.08em', textAlign: 'left',
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(216,180,254,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(216,180,254,0.7)'; }}
                            >
                                <Sparkles size={14} />
                                Go to Core
                            </button>
                            <button
                                onClick={() => { setOpen(false); onLogout(); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '12px', border: 'none',
                                    background: 'transparent', color: 'rgba(248,113,113,0.6)',
                                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'var(--font-mono)',
                                    letterSpacing: '0.08em', textAlign: 'left',
                                    transition: 'background 0.15s, color 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.6)'; }}
                            >
                                <LogOut size={14} />
                                End Session
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Avatar button */}
            <motion.button
                onClick={() => setOpen(v => !v)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '6px 12px 6px 6px',
                    background: open ? 'rgba(216,180,254,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${open ? 'rgba(216,180,254,0.2)' : 'rgba(216,180,254,0.1)'}`,
                    borderRadius: '999px', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
            >
                {/* Initials circle */}
                <div style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                    boxShadow: '0 2px 10px rgba(99,102,241,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.7rem', fontWeight: 700, color: 'white',
                    fontFamily: 'var(--font-mono)', flexShrink: 0,
                }}>
                    {initials}
                </div>
                {/* Name */}
                <span style={{
                    color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem',
                    fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                    maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                    {name}
                </span>
                <ChevronDown
                    size={12}
                    style={{
                        color: 'rgba(216,180,254,0.5)',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0,
                    }}
                />
            </motion.button>
        </div>
    );
};



const Navbar = () => {
    const navigate = useNavigate();
    const [userId, setUserId] = useState<string | null>(localStorage.getItem('user_id'));
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        setUserId(localStorage.getItem('user_id'));
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_name');
        setUserId(null);
        navigate('/');
        setIsMobileMenuOpen(false);
    };

    const navLinks = ['The Journey', 'Mechanism', 'Clarity'];

    return (
        <>
        <motion.nav
            className="navbar"
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: 'var(--nav-height)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 60px',
                zIndex: 100,
                background: scrolled
                    ? 'rgba(3, 3, 3, 0.85)'
                    : 'rgba(3, 3, 3, 0.3)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                borderBottom: scrolled
                    ? '1px solid rgba(216, 180, 254, 0.12)'
                    : '1px solid rgba(255,255,255,0.04)',
                boxShadow: scrolled
                    ? '0 0 40px rgba(216, 180, 254, 0.05)'
                    : 'none',
                transition: 'background 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease',
            }}
        >
            {/* ── LOGO ── */}
            <div
                className="logo"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    cursor: 'pointer',
                    zIndex: 101,
                }}
                onClick={() => navigate('/')}
            >
                <motion.img
                    src="/logo_2_backup.png"
                    alt="Feelivate Logo"
                    className="nav-logo-img"
                    whileHover={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    style={{
                        height: '34px',
                        width: 'auto',
                        objectFit: 'contain',
                        filter: 'brightness(1.1)',
                        opacity: 0.95,
                        borderRadius: '6px',
                    }}
                />

                {/* Brand Name */}
                <motion.div
                    whileHover={{ scale: 1.03 }}
                    transition={{ type: 'spring', stiffness: 400 }}
                    style={{ lineHeight: 1 }}
                >
                    <div
                        className="nav-logo-text"
                        style={{
                            fontFamily: 'var(--font-serif)',
                            fontSize: '1.65rem',
                            fontStyle: 'italic',
                            letterSpacing: '-0.02em',
                            background: 'linear-gradient(120deg, #ffffff 0%, #e9d5ff 45%, #a78bfa 80%, #818cf8 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            lineHeight: 1,
                            filter: 'drop-shadow(0 0 18px rgba(167,139,250,0.35))',
                        }}
                    >
                        Feelivate
                    </div>
                    {/* Subtle tagline under the name */}
                    <div style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.42rem',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: 'rgba(216, 180, 254, 0.5)',
                        marginTop: '3px',
                        paddingLeft: '2px',
                    }}>
                        Emotional Intelligence
                    </div>
                </motion.div>
            </div>

            {/* ── NAV LINKS ── */}
            <div
                className="nav-links hide-on-mobile"
                style={{
                    display: 'flex',
                    gap: '44px',
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                }}
            >
                {navLinks.map((item) => (
                    <motion.a
                        key={item}
                        href={`#${item.toLowerCase().replace(' ', '-')}`}
                        className="text-mono"
                        whileHover={{ color: '#ffffff', opacity: 1 }}
                        style={{
                            color: 'rgba(255,255,255,0.5)',
                            cursor: 'pointer',
                            textDecoration: 'none',
                            position: 'relative',
                            transition: 'color 0.3s ease',
                            paddingBottom: '4px',
                        }}
                    >
                        {item}
                        {/* hover underline via CSS class */}
                        <span style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            width: 0,
                            height: '1px',
                            background: 'linear-gradient(90deg, #d8b4fe, #818cf8)',
                            transition: 'width 0.35s cubic-bezier(0.19,1,0.22,1)',
                        }} className="link-underline" />
                    </motion.a>
                ))}
            </div>

            {/* ── ACTIONS ── */}
            <div
                className="nav-actions hide-on-mobile"
                style={{ display: 'flex', gap: '20px', alignItems: 'center' }}
            >
                {userId ? (
                    <ProfileAvatar onLogout={handleLogout} />
                ) : (
                    <motion.button
                        whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(167,139,250,0.3)' }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => navigate('/login')}
                        style={{
                            padding: '11px 28px',
                            fontSize: '0.7rem',
                            fontFamily: 'var(--font-mono)',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            background: 'linear-gradient(135deg, rgba(216,180,254,0.15), rgba(129,140,248,0.15))',
                            border: '1px solid rgba(216,180,254,0.3)',
                            borderRadius: '999px',
                            color: '#e9d5ff',
                            cursor: 'pointer',
                            transition: 'border-color 0.3s ease',
                        }}
                    >
                        Login
                    </motion.button>
                )}
            </div>

            {/* ── MOBILE HAMBURGER ── */}
            <div
                className="mobile-menu-toggle show-on-mobile"
                style={{ zIndex: 101, cursor: 'pointer', padding: '10px' }}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
                {[0, 1, 2].map((i) => (
                    <div key={i} style={{
                        width: '22px',
                        height: '1.5px',
                        background: i === 1 && isMobileMenuOpen
                            ? 'transparent'
                            : 'rgba(255,255,255,0.8)',
                        marginBottom: i < 2 ? '6px' : 0,
                        transition: 'all 0.3s ease',
                        transform: isMobileMenuOpen
                            ? i === 0 ? 'rotate(45deg) translate(5px, 5px)'
                            : i === 2 ? 'rotate(-45deg) translate(5px, -5px)'
                            : 'none'
                            : 'none',
                    }} />
                ))}
            </div>
        </motion.nav>

        {/* ── MOBILE MENU OVERLAY ── */}
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
                        background: 'rgba(3,3,3,0.97)',
                        backdropFilter: 'blur(40px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '36px',
                        zIndex: 99,
                        padding: '24px',
                    }}
                >
                    {/* Mobile brand */}
                    <div style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '2.2rem',
                        fontStyle: 'italic',
                        background: 'linear-gradient(120deg, #ffffff, #d8b4fe, #818cf8)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        marginBottom: '8px',
                    }}>
                        Feelivate
                    </div>

                    {navLinks.map((item) => (
                        <a
                            key={item}
                            href={`#${item.toLowerCase().replace(' ', '-')}`}
                            className="text-mono"
                            style={{
                                color: 'rgba(255,255,255,0.7)',
                                fontSize: '0.75rem',
                                letterSpacing: '0.25em',
                                textDecoration: 'none',
                            }}
                            onClick={() => setIsMobileMenuOpen(false)}
                        >
                            {item}
                        </a>
                    ))}

                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '220px' }}>
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
                                    style={{ color: 'var(--text-muted)', border: 'none', background: 'none', padding: '12px', cursor: 'pointer' }}
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
