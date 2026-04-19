import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';

const Navbar = () => {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        setUserId(localStorage.getItem('user_id'));
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user_id');
        setUserId(null);
        router.push('/');
    };

    const navigateToHome = () => {
        router.push('/');
    };

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
            padding: '0 60px',
            zIndex: 100,
            background: 'rgba(3, 3, 3, 0.6)',
            backdropFilter: 'blur(30px)',
            borderBottom: '1px solid var(--border-subtle)',
        }}>
            <div className="logo" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
            }} onClick={navigateToHome}>
                <img 
                    src="/LOGO.png" 
                    alt="Logo" 
                    style={{ 
                        height: '32px', 
                        width: 'auto',
                        filter: 'invert(1) brightness(2)', /* Makes black logo white/visible */
                        opacity: 0.9
                    }} 
                />
                <div style={{
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
                {['The Journey', 'Mechanism', 'Clarity'].map((item) => (
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
                    >
                        {item}
                    </a>
                ))}
            </div>

            <div className="nav-actions" style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
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
                            onClick={() => router.push('/workspace')}
                            className="action-pill primary"
                            style={{ fontSize: '0.75rem', padding: '12px 28px' }}
                        >
                            Open Engine
                        </button>
                    </>
                ) : (
                    <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                        <Link href="/login" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', textDecoration: 'none' }} className="text-mono">
                            Login
                        </Link>
                        <button
                            onClick={() => router.push('/login')}
                            className="action-pill primary"
                            style={{ padding: '10px 24px', fontSize: '0.75rem' }}
                        >
                            Start Journey
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
};
    );
};

export default Navbar;



