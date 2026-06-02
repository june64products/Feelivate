import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, LogOut, Sparkles, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ── Helper ─────────────────────────────────────── */
const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/* ── Theme Toggle ───────────────────────────────── */
function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return <div style={{ width: 32, height: 32 }} />;

    const isDark = resolvedTheme === 'dark';
    return (
        <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
                width: 32, height: 32, borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                flexShrink: 0,
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
            }}
        >
            <AnimatePresence mode="wait">
                {isDark ? (
                    <motion.span key="sun" initial={{ rotate: -45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 45, opacity: 0 }} transition={{ duration: 0.18 }}>
                        <Sun size={15} />
                    </motion.span>
                ) : (
                    <motion.span key="moon" initial={{ rotate: 45, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -45, opacity: 0 }} transition={{ duration: 0.18 }}>
                        <Moon size={15} />
                    </motion.span>
                )}
            </AnimatePresence>
        </motion.button>
    );
}

/* ── Profile Dropdown ───────────────────────────── */
function ProfileDropdown({ onLogout }: { onLogout: () => void }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const name = localStorage.getItem('user_name') || 'User';
    const initials = getInitials(name);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-profile-dropdown]')) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div data-profile-dropdown="true" style={{ position: 'relative' }}>
            <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setOpen(v => !v)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '5px 10px 5px 5px',
                    background: open ? 'var(--bg-hover)' : 'transparent',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
            >
                {/* Avatar */}
                <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: 'white',
                    flexShrink: 0,
                }}>
                    {initials}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                </span>
                <ChevronDown size={12} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                            minWidth: 200,
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '14px',
                            boxShadow: 'var(--shadow-modal)',
                            overflow: 'hidden',
                            zIndex: 200,
                        }}
                    >
                        {/* User info header */}
                        <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: '10px',
                                    background: 'var(--accent)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '13px', fontWeight: 700, color: 'white',
                                }}>
                                    {initials}
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>{name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 2 }}>Active Session</div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '6px' }}>
                            {[
                                { icon: <Sparkles size={13} />, label: 'Go to Core', action: () => { setOpen(false); navigate('/app'); }, color: 'var(--text-secondary)' },
                                { icon: <LogOut size={13} />, label: 'Log out', action: () => { setOpen(false); onLogout(); }, color: 'var(--accent-red)' },
                            ].map(item => (
                                <button
                                    key={item.label}
                                    onClick={item.action}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '9px 10px', borderRadius: '9px', border: 'none',
                                        background: 'transparent', color: item.color,
                                        cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                                        fontFamily: 'var(--font-sans)', textAlign: 'left',
                                        transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Topbar ─────────────────────────────────────── */
interface TopbarProps {
    onLogout: () => void;
    activePlan?: { week_number?: number; theme?: string } | null;
    userId: string | null;
}

export default function Topbar({ onLogout, activePlan, userId }: TopbarProps) {
    if (!userId) return null;

    return (
        <motion.div
            className="topbar"
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
            {/* Left: Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 8 }}>
                <img
                    src="/logo_2_backup.png"
                    alt="Feelivate"
                    style={{ width: 26, height: 26, objectFit: 'contain', borderRadius: '7px' }}
                />
                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'none' }}
                    className="hide-on-mobile">
                    Feelivate
                </span>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Active plan indicator — real data, not decorative */}
            {activePlan && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px',
                        background: 'var(--accent-faint)',
                        border: '1px solid var(--accent-faint-md)',
                        borderRadius: '999px',
                        marginRight: 8,
                    }}
                    className="hide-on-mobile"
                >
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--accent)',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                        Week {activePlan.week_number ?? '—'}
                        {activePlan.theme ? ` · ${activePlan.theme}` : ''}
                    </span>
                </motion.div>
            )}

            {/* Right controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ThemeToggle />
                <ProfileDropdown onLogout={onLogout} />
            </div>
        </motion.div>
    );
}
