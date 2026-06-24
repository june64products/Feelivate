import { useState, useEffect, useRef } from 'react';
import { Plus, MessageSquare, BookOpen, Clock, PanelLeft } from 'lucide-react';
import { gsap } from 'gsap';
import { getUserSessions } from '../../api';
import type { SessionPreview } from '../../api';
import StreakBar from './StreakBar';

interface SessionSidebarProps {
    userId: string;
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewChat: () => void;
    onJourney: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    refreshKey: number;
    isPlanActive: boolean;
}

/* ── Fonts ───────────────────────────────────────────────────────────────── */
const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

export default function SessionSidebar({
    userId,
    activeSessionId,
    onSelectSession,
    onNewChat,
    onJourney,
    isCollapsed,
    onToggleCollapse,
    refreshKey,
    isPlanActive,
}: SessionSidebarProps) {
    const [sessions, setSessions] = useState<SessionPreview[]>([]);
    const [loading, setLoading] = useState(true);
    // Hovering anywhere over the sidebar morphs the Feelivate logo into the
    // collapse/expand toggle (the only toggle — no separate button).
    const [hovered, setHovered] = useState(false);
    const navItemsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!userId) return;
        setLoading(true);
        getUserSessions(userId)
            .then(data => setSessions(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [userId, refreshKey]);

    // GSAP entrance animation for nav items
    useEffect(() => {
        if (!isCollapsed && navItemsRef.current) {
            const items = navItemsRef.current.querySelectorAll('.sb-nav-item');
            gsap.fromTo(items,
                { opacity: 0, x: -12 },
                { opacity: 1, x: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out', delay: 0.1 }
            );
        }
    }, [isCollapsed]);

    const Logo = () => (
        <div style={{
            width: '28px', height: '28px',
            background: '#f2f2f2',
            borderRadius: '7px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
        }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '18px', height: '18px', objectFit: 'contain', filter: 'invert(0)' }} />
        </div>
    );

    const iconBtnBase: React.CSSProperties = {
        width: '36px', height: '36px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '9px', border: 'none',
        background: 'transparent', color: 'rgba(255,255,255,0.4)',
        cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
        flexShrink: 0,
    };

    // Feelivate logo that dynamically morphs into the sidebar toggle button when
    // the cursor is over the sidebar; reverts to the logo when the cursor leaves.
    // Clicking it opens/closes the sidebar. This is the ONLY collapse control.
    const LogoToggle = () => (
        <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
            aria-label={isCollapsed ? 'Open sidebar' : 'Close sidebar'}
            style={{
                position: 'relative',
                width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '9px', border: 'none', background: 'transparent',
                cursor: 'pointer', flexShrink: 0, padding: 0,
            }}
        >
            {/* Logo — visible by default, fades out on sidebar hover */}
            <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                opacity: hovered ? 0 : 1,
                transform: hovered ? 'scale(0.8)' : 'scale(1)',
                transition: 'opacity 0.18s ease, transform 0.18s ease',
                pointerEvents: 'none',
            }}>
                <Logo />
            </span>
            {/* Toggle icon — fades in on sidebar hover */}
            <span style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.7)',
                opacity: hovered ? 1 : 0,
                transform: hovered ? 'scale(1)' : 'scale(0.8)',
                transition: 'opacity 0.18s ease, transform 0.18s ease',
                pointerEvents: 'none',
            }}>
                <PanelLeft size={18} />
            </span>
        </button>
    );

    // Collapsed sidebar
    if (isCollapsed) {
        return (
            <div
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    width: '52px',
                    height: '100dvh',
                    background: '#111111',
                    borderRight: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '14px 0',
                    gap: '4px',
                    flexShrink: 0,
                    overflow: 'hidden',
                }}>
                {/* Logo — morphs into the toggle on hover, click to expand */}
                <div style={{ marginBottom: '10px' }}>
                    <LogoToggle />
                </div>

                {/* New Chat */}
                <button
                    onClick={onNewChat}
                    title="New Chat"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f2f2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                >
                    <Plus size={18} />
                </button>

                {/* History */}
                <button
                    title="History"
                    style={iconBtnBase}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f2f2f2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                >
                    <Clock size={18} />
                </button>

                {/* My Journey — only when plan is active */}
                {isPlanActive && (
                    <button
                        onClick={onJourney}
                        title="My Journey"
                        style={iconBtnBase}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f2f2f2'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
                    >
                        <BookOpen size={18} />
                    </button>
                )}
            </div>
        );
    }

    // Expanded sidebar
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '260px',
                height: '100dvh',
                maxHeight: '100dvh',
                background: '#111111',
                borderRight: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden',
                fontFamily: satoshi,
                transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                minHeight: 0,
            }}>
            {/* Header: Logo (morphs into toggle on hover) + FEELIVATE */}
            <div className="sidebar-header" style={{
                display: 'flex', alignItems: 'center',
                gap: '8px',
                padding: '16px 14px 12px',
                flexShrink: 0,
            }}>
                <LogoToggle />
                <span style={{
                    fontWeight: 700, fontSize: '14px', color: '#f2f2f2',
                    letterSpacing: '0.08em', fontFamily: clashDisplay,
                    textTransform: 'uppercase',
                }}>
                    Feelivate
                </span>
            </div>

            {/* New Chat pill button */}
            <div style={{ padding: '0 10px 8px' }}>
                <button
                    onClick={onNewChat}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '10px 14px', borderRadius: '100px', border: 'none',
                        background: '#f2f2f2', color: '#111111',
                        fontSize: '12px', fontWeight: 700, fontFamily: satoshi,
                        cursor: 'pointer', transition: 'opacity 0.15s',
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                    <Plus size={14} />
                    New Chat
                </button>
            </div>

            {/* Nav items with GSAP hover */}
            <div ref={navItemsRef} style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                <SidebarNavItem icon={<Clock size={15} />} label="History" isCollapsed={isCollapsed} />
                {isPlanActive && (
                    <SidebarNavItem icon={<BookOpen size={15} />} label="My Journey" onClick={onJourney} isCollapsed={isCollapsed} />
                )}
            </div>

            {/* Session list — flex:1 scrolls, StreakBar stays pinned at bottom */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                minHeight: 0,
                padding: '12px 10px 8px',
                marginTop: '8px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
                {sessions.length > 0 && (
                    <div style={{
                        fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)',
                        padding: '0 8px 8px',
                        letterSpacing: '0.12em', textTransform: 'uppercase',
                        fontFamily: clashDisplay,
                    }}>
                        Recent
                    </div>
                )}
                {loading ? (
                    <div style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
                        Loading...
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
                        No conversations yet
                    </div>
                ) : (
                    sessions.map((session) => (
                        <button
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '9px 10px', borderRadius: '8px', border: 'none',
                                background: session.id === activeSessionId
                                    ? 'rgba(255,255,255,0.08)'
                                    : 'transparent',
                                color: session.id === activeSessionId ? '#f2f2f2' : 'rgba(255,255,255,0.45)',
                                cursor: 'pointer', fontSize: '13px', textAlign: 'left',
                                transition: 'all 0.15s', marginBottom: '1px',
                                fontFamily: satoshi,
                            }}
                            onMouseEnter={e => {
                                if (session.id !== activeSessionId)
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                            }}
                            onMouseLeave={e => {
                                if (session.id !== activeSessionId)
                                    e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = session.id === activeSessionId ? '#f2f2f2' : 'rgba(255,255,255,0.45)';
                            }}
                        >
                            <MessageSquare size={13} style={{ flexShrink: 0, opacity: 0.4 }} />
                            <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                flex: 1, fontSize: '13px',
                            }}>
                                {session.focus_preview}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* Streak section at bottom */}
            <StreakBar userId={userId} isPlanActive={isPlanActive} />
        </div>
    );
}

/* ── Sidebar Nav Item with GSAP vertical rising-circle animation ──────── */
function SidebarNavItem({
    icon, label, onClick, isCollapsed,
}: { icon: React.ReactNode; label: string; onClick?: () => void; isCollapsed?: boolean }) {
    const itemRef = useRef<HTMLButtonElement>(null);
    const circleRef = useRef<HTMLSpanElement>(null);
    const labelRef = useRef<HTMLSpanElement>(null);
    const hoverLabelRef = useRef<HTMLSpanElement>(null);
    const tlRef = useRef<gsap.core.Timeline | null>(null);
    const tweenRef = useRef<gsap.core.Tween | null>(null);
    const isHoveredRef = useRef(false);
    const lastWidthRef = useRef(0);

    useEffect(() => {
        const pill = itemRef.current;
        const circle = circleRef.current;
        const lbl = labelRef.current;
        const hover = hoverLabelRef.current;
        if (!pill || !circle || !lbl || !hover) return;

        // When collapsed, kill all animations and reset state
        if (isCollapsed) {
            tweenRef.current?.kill();
            tlRef.current?.kill();
            tlRef.current = null;
            isHoveredRef.current = false;
            lastWidthRef.current = 0;
            gsap.set(circle, { scale: 0 });
            gsap.set(lbl, { x: 0 });
            gsap.set(hover, { x: 0, opacity: 0 });
            return;
        }

        const setup = () => {
            const { width: w, height: h } = pill.getBoundingClientRect();
            if (w === 0 || h === 0) return;
            // Skip rebuilds that don't change the width (avoids hover flicker)
            if (Math.abs(w - lastWidthRef.current) < 0.5 && tlRef.current) return;
            lastWidthRef.current = w;

            // Compute circle radius large enough to cover the whole pill
            const R = ((h * h) / 4 + w * w) / (2 * w);
            const D = Math.ceil(2 * R) + 2;
            const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (h * h) / 4))) + 1;

            circle.style.width = `${D}px`;
            circle.style.height = `${D}px`;
            circle.style.bottom = `${-D / 2 + h / 2}px`;
            circle.style.left = `${-delta}px`;

            const originX = D - delta;

            gsap.set(circle, {
                yPercent: 0,
                scale: 0,
                transformOrigin: `${originX}px 50%`,
            });

            gsap.set(lbl, { x: 0 });
            gsap.set(hover, { x: -(w + 20), opacity: 0 });

            tweenRef.current?.kill();
            tlRef.current?.kill();
            const tl = gsap.timeline({ paused: true });
            tl.to(circle, { scale: 1.2, duration: 0.7, ease: 'power3.out', overwrite: 'auto' }, 0);
            tl.to(lbl, { x: w + 20, duration: 0.5, ease: 'power3.out', overwrite: 'auto' }, 0);
            tl.to(hover, { x: 0, opacity: 1, duration: 0.5, ease: 'power3.out', overwrite: 'auto' }, 0);
            tlRef.current = tl;

            // If the pointer is already over the item while we re-measure
            // (e.g. mid expand), snap to the hovered end-state so the freshly
            // built timeline matches reality instead of resetting to rest.
            if (isHoveredRef.current) tl.progress(1);
        };

        // ResizeObserver re-measures as the sidebar's width transition plays
        // AND once it settles at full width — so the slide distance is always
        // correct, even after a collapse → re-expand.
        const ro = new ResizeObserver(() => setup());
        ro.observe(pill);
        setup();
        document.fonts?.ready.then(setup).catch(() => {});
        return () => {
            ro.disconnect();
        };
    }, [isCollapsed]);

    const handleEnter = () => {
        isHoveredRef.current = true;
        const tl = tlRef.current;
        if (!tl) return;
        tweenRef.current?.kill();
        tweenRef.current = tl.tweenTo(tl.duration(), { duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
    };

    const handleLeave = () => {
        isHoveredRef.current = false;
        const tl = tlRef.current;
        if (!tl) return;
        tweenRef.current?.kill();
        tweenRef.current = tl.tweenTo(0, { duration: 0.25, ease: 'power3.out', overwrite: 'auto' });
    };

    return (
        <button
            ref={itemRef}
            className="sb-nav-item"
            onClick={onClick}
            onMouseEnter={handleEnter}
            onMouseLeave={handleLeave}
            style={{
                position: 'relative',
                width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                padding: '9px 10px', borderRadius: '8px', border: 'none',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.6)',
                cursor: onClick ? 'pointer' : 'default',
                fontSize: '13px', fontWeight: 600,
                textAlign: 'left',
                fontFamily: satoshi,
                overflow: 'hidden',
                zIndex: 0,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
            }}
        >
            {/* Rising circle from left */}
            <span
                ref={circleRef}
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    borderRadius: '50%',
                    background: '#f2f2f2',
                    zIndex: 1,
                    pointerEvents: 'none',
                    willChange: 'transform',
                    display: 'block',
                }}
            />

            {/* Icon — always visible */}
            <span style={{ flexShrink: 0, display: 'flex', position: 'relative', zIndex: 3 }}>
                {icon}
            </span>

            {/* Label wrapper with slide animation */}
            <span style={{
                position: 'relative',
                display: 'inline-block',
                lineHeight: 1,
                zIndex: 2,
                overflow: 'hidden',
                flex: 1,
            }}>
                {/* Original label — slides out right */}
                <span
                    ref={labelRef}
                    style={{ display: 'inline-block', willChange: 'transform' }}
                >
                    {label}
                </span>
                {/* Hover label — slides in from left, dark color */}
                <span
                    ref={hoverLabelRef}
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        left: 0, top: 0,
                        width: '100%',
                        display: 'inline-block',
                        color: '#111111',
                        willChange: 'transform, opacity',
                        pointerEvents: 'none',
                        opacity: 0,
                    }}
                >
                    {label}
                </span>
            </span>
        </button>
    );
}
