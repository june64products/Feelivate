import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { getMe, type UserProfile } from '../../api';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";

const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'U';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Top-right profile menu for the workspace. Clicking the avatar opens a dropdown
 * showing the user's name + join date and a red Log out button — it does NOT log
 * the user out on click (the previous avatar did, which forced repeated re-logins).
 */
export default function ProfileMenu({ onLogout }: { onLogout: () => void }) {
    const [open, setOpen] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const name = profile?.name || localStorage.getItem('user_name') || 'User';
    const initials = getInitials(name);
    const joined = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : null;

    // Load profile (name + join date) once
    useEffect(() => {
        let active = true;
        getMe().then(p => { if (active) setProfile(p); }).catch(() => { });
        return () => { active = false; };
    }, []);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            {/* Trigger — avatar with initials */}
            <div
                className="user-avatar"
                onClick={() => setOpen(v => !v)}
                title="Profile"
            >
                {initials}
            </div>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 10px)',
                            right: 0,
                            minWidth: '220px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-medium)',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 300,
                            fontFamily: satoshi,
                        }}
                    >
                        {/* User info */}
                        <div style={{
                            padding: '16px 16px 14px',
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', gap: '12px',
                        }}>
                            <div className="user-avatar" style={{ cursor: 'default' }}>{initials}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{
                                    color: 'var(--text-primary)', fontSize: '13px', fontWeight: 700,
                                    lineHeight: 1.2, fontFamily: clashDisplay,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                    {name}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '3px' }}>
                                    {joined ? `Joined ${joined}` : 'Member'}
                                </div>
                            </div>
                        </div>

                        {/* Logout */}
                        <div style={{ padding: '8px' }}>
                            <button
                                onClick={() => { setOpen(false); onLogout(); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '10px',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    background: 'transparent', color: '#ef4444',
                                    cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                                    fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                            >
                                <LogOut size={14} />
                                Log out
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
