import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Sparkles, ChevronDown } from 'lucide-react';
import InputForm from '../components/workspace/InputForm';
import ResultsDashboard from '../components/workspace/ResultsDashboard';
import SessionSidebar from '../components/workspace/SessionSidebar';
import { submitIngestStream, getSessionDetail } from '../api';

/* ── Inline Profile Avatar (same design as Navbar) ── */
const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const WorkspaceProfileAvatar = ({ onLogout, isMobile }: { onLogout: () => void; isMobile: boolean }) => {
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
                            zIndex: 300,
                        }}
                    >
                        {/* User info */}
                        <div style={{ padding: '18px 18px 14px', borderBottom: '1px solid rgba(216,180,254,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                                    boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.8rem', fontWeight: 700, color: 'white',
                                    fontFamily: 'monospace',
                                }}>
                                    {initials}
                                </div>
                                <div>
                                    <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.85rem', fontWeight: 600, lineHeight: 1.2 }}>
                                        {name}
                                    </div>
                                    <div style={{ color: 'rgba(216,180,254,0.4)', fontSize: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>
                                        Active Session
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* Actions */}
                        <div style={{ padding: '8px' }}>
                            <button
                                onClick={() => { setOpen(false); navigate('/'); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '12px', border: 'none',
                                    background: 'transparent', color: 'rgba(216,180,254,0.7)',
                                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'monospace',
                                    letterSpacing: '0.08em', textAlign: 'left', transition: 'background 0.15s, color 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(216,180,254,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.9)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(216,180,254,0.7)'; }}
                            >
                                <Sparkles size={14} /> Leave Workspace
                            </button>
                            <button
                                onClick={() => { setOpen(false); onLogout(); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', borderRadius: '12px', border: 'none',
                                    background: 'transparent', color: 'rgba(248,113,113,0.6)',
                                    cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'monospace',
                                    letterSpacing: '0.08em', textAlign: 'left', transition: 'background 0.15s, color 0.15s',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.07)'; (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,1)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(248,113,113,0.6)'; }}
                            >
                                <LogOut size={14} /> End Session
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Avatar pill button */}
            <motion.button
                onClick={() => setOpen(v => !v)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                style={{
                    display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px',
                    padding: isMobile ? '5px 8px 5px 5px' : '6px 12px 6px 6px',
                    background: open ? 'rgba(216,180,254,0.08)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${open ? 'rgba(216,180,254,0.2)' : 'rgba(216,180,254,0.1)'}`,
                    borderRadius: '999px', cursor: 'pointer', transition: 'all 0.2s ease',
                }}
            >
                <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
                    boxShadow: '0 2px 10px rgba(99,102,241,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 700, color: 'white',
                    fontFamily: 'monospace', flexShrink: 0,
                }}>
                    {initials}
                </div>
                {!isMobile && (
                    <span style={{
                        color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem',
                        fontFamily: 'monospace', letterSpacing: '0.05em',
                        maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                        {name}
                    </span>
                )}
                <ChevronDown
                    size={12}
                    style={{
                        color: 'rgba(216,180,254,0.5)',
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease', flexShrink: 0,
                    }}
                />
            </motion.button>
        </div>
    );
};


const WorkspacePage = () => {
    const navigate = useNavigate();
    const [userId] = useState<string | null>(localStorage.getItem('user_id'));
    const [processing, setProcessing] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sidebarKey, setSidebarKey] = useState(0); // Used to force refetch
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    useEffect(() => {
        if (!userId) {
            navigate('/login');
        }
    }, [userId, navigate]);

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [result, setResult] = useState<any>(null);
    const [pollStatus, setPollStatus] = useState('');

    const [sessionLoadError, setSessionLoadError] = useState('');

    const handleSelectSession = async (sessionId: string) => {
        try {
            setProcessing(true);
            setActiveSessionId(sessionId);
            setIsMobileSidebarOpen(false);
            setSessionLoadError('');
            const data = await getSessionDetail(sessionId);
            
            if (data.result) {
                const roadmapLength = data.result?.integration?.roadmap?.length || 0;
                setResult({
                    user_id: userId,
                    session_id: data.id,
                    ...data.result,
                    _isPartial: roadmapLength < 6 // Flag for partial roadmaps
                });
            } else {
                setResult(null);
                setSessionLoadError("This journey's analysis hasn't completed yet. Please start a new journey or try again later.");
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            setResult(null);
            setSessionLoadError("Could not load the selected journey. Please check your connection.");
        } finally {
            setProcessing(false);
        }
    };

    const handleNewJourney = () => {
        setActiveSessionId(null);
        setResult(null);
        setProcessing(false);
        setIsMobileSidebarOpen(false);
        setSessionLoadError('');
    };

    const handleIngest = async (text: string) => {
        try {
            setProcessing(true);
            setResult(null);
            setPollStatus("🔍 Initializing AI Agents...");

            await submitIngestStream({
                user_id: userId || 'anonymous',
                text
            }, (chunk) => {
                if (chunk.type === 'structured') {
                    setPollStatus(`🧠 Pattern detected: ${chunk.focus.substring(0, 30)}...`);
                } else if (chunk.type === 'initial') {
                    setResult({
                        user_id: userId,
                        session_id: chunk.session_id,
                        past: chunk.past,
                        present: chunk.present,
                        future: chunk.future,
                        integration: {
                            ...chunk.integration_meta,
                            roadmap: [chunk.first_month]
                        }
                    });
                    setProcessing(false); 
                    setActiveSessionId(chunk.session_id);
                    setSidebarKey(prev => prev + 1); // Refresh sidebar list
                } else if (chunk.type === 'month') {
                    setResult((prev: any) => {
                        if (!prev) return prev;
                        const roadmap = prev.integration.roadmap || [];
                        // Prevent duplicates if stream reconnects
                        if (roadmap.some((m: any) => m.phase === chunk.month.phase)) return prev;
                        
                        return {
                            ...prev,
                            integration: {
                                ...prev.integration,
                                roadmap: [...roadmap, chunk.month]
                            }
                        };
                    });
                } else if (chunk.type === 'error') {
                    alert("Analysis error: " + chunk.message);
                    setProcessing(false);
                }
            });

        } catch (error) {
            console.error("Failed to start analysis:", error);
            setProcessing(false);
            alert("Failed to connect to the backend engine.");
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Ambient Background Glow */}
            <div style={{
                position: 'fixed',
                top: '-10%',
                right: '-10%',
                width: '50vw',
                height: '50vw',
                background: 'radial-gradient(circle, rgba(130, 202, 255, 0.05) 0%, transparent 70%)',
                zIndex: 0,
                pointerEvents: 'none'
            }} />

            {/* Workspace Navbar */}
            <nav style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                height: 'var(--nav-height)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? '0 16px' : '0 40px',
                background: 'rgba(10, 10, 10, 0.7)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                zIndex: 100
            }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                    {/* Mobile hamburger */}
                    {isMobile && userId && (
                        <button
                            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
                            style={{
                                background: 'transparent',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-primary)',
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '1.2rem'
                            }}
                        >
                            {isMobileSidebarOpen ? '✕' : '☰'}
                        </button>
                    )}
                    <div
                        onClick={() => navigate('/')}
                        style={{
                            fontWeight: 600,
                            fontSize: isMobile ? '0.85rem' : '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: isMobile ? '8px' : '12px',
                            padding: isMobile ? '6px 12px' : '8px 16px',
                            borderRadius: '20px',
                            background: 'rgba(255,255,255,0.05)',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        <span style={{ color: 'var(--text-secondary)' }}>←</span> {isMobile ? 'Back' : 'Leave Workspace'}
                    </div>
                </div>

                {/* ── Profile Avatar replaces plain Log Out button ── */}
                <WorkspaceProfileAvatar
                    isMobile={isMobile}
                    onLogout={() => {
                        localStorage.removeItem('user_id');
                        localStorage.removeItem('user_name');
                        navigate('/');
                    }}
                />
            </nav>

            <div style={{ display: 'flex', flex: 1, marginTop: 'var(--nav-height)', position: 'relative', overflow: 'hidden' }}>
                {/* Sidebar - Desktop: always visible (can be collapsed), Mobile: overlay */}
                {userId && !isMobile && (
                    <div style={{
                        width: '280px',
                        minWidth: '280px',
                        transform: isSidebarCollapsed ? 'translateX(-100%)' : 'translateX(0)',
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'fixed',
                        left: 0,
                        top: 'var(--nav-height)',
                        bottom: 0,
                        zIndex: 100,
                        background: 'var(--bg-primary)',
                        borderRight: '1px solid rgba(255,255,255,0.05)',
                        overflowY: 'auto'
                    }}>
                        <SessionSidebar 
                            key={sidebarKey}
                            userId={userId} 
                            activeSessionId={activeSessionId}
                            onSelectSession={handleSelectSession}
                            onNewJourney={handleNewJourney}
                        />
                        {/* Collapse Toggle Arrow */}
                        <button
                            onClick={() => setIsSidebarCollapsed(true)}
                            style={{
                                position: 'absolute',
                                top: '20px',
                                right: '10px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'white',
                                width: '28px',
                                height: '28px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 110,
                                opacity: 1,
                                transition: 'opacity 0.2s'
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>←</span>
                        </button>
                    </div>
                )}

                {/* Expand Button (visible when collapsed) */}
                {userId && !isMobile && isSidebarCollapsed && (
                    <button
                        onClick={() => setIsSidebarCollapsed(false)}
                        style={{
                            position: 'fixed',
                            left: '20px',
                            top: `calc(var(--nav-height) + 20px)`,
                            background: 'rgba(130, 202, 255, 0.1)',
                            border: '1px solid rgba(130, 202, 255, 0.3)',
                            color: '#82caff',
                            padding: '8px 16px',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            zIndex: 110,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: 600,
                            boxShadow: '0 4px 20px rgba(130, 202, 255, 0.15)',
                            animation: 'fadeIn 0.3s'
                        }}
                    >
                        <span>→</span> Show Journeys
                    </button>
                )}

                {/* Mobile Sidebar Overlay */}
                {userId && isMobile && isMobileSidebarOpen && (
                    <div style={{
                        position: 'fixed',
                        top: 'var(--nav-height)',
                        left: 0,
                        width: '100vw',
                        height: `calc(100vh - var(--nav-height))`,
                        background: 'var(--bg-primary)',
                        zIndex: 150,
                        overflowY: 'auto'
                    }}>
                        <SessionSidebar 
                            key={sidebarKey}
                            userId={userId} 
                            activeSessionId={activeSessionId}
                            onSelectSession={handleSelectSession}
                            onNewJourney={handleNewJourney}
                        />
                    </div>
                )}

                {/* Main Content Area */}
                <main style={{ 
                    flex: 1, 
                    marginLeft: (userId && !isMobile) ? (isSidebarCollapsed ? '0' : '280px') : 0, 
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    zIndex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: isSidebarCollapsed ? (isMobile ? '16px' : '40px 60px') : (isMobile ? '16px' : '40px'),
                    overflowX: 'hidden'
                }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '1400px', margin: isSidebarCollapsed ? '0 auto' : '0', width: '100%', transition: 'all 0.4s' }}>
                        {!processing && !result && (
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.5s ease' }}>
                                {sessionLoadError && (
                                    <div style={{
                                        background: 'rgba(255, 77, 77, 0.08)',
                                        border: '1px solid rgba(255, 77, 77, 0.2)',
                                        borderRadius: '16px',
                                        padding: '20px 24px',
                                        marginBottom: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        animation: 'fadeIn 0.3s ease'
                                    }}>
                                        <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                                        <span style={{ color: '#ff9999', fontSize: '0.95rem' }}>{sessionLoadError}</span>
                                    </div>
                                )}
                                <InputForm onSubmit={handleIngest} isLoading={processing} />
                            </div>
                        )}

                        {processing && !result && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: isMobile ? '60px 16px' : '100px auto',
                                maxWidth: '600px',
                                background: 'rgba(0,0,0,0.3)',
                                padding: isMobile ? '40px 24px' : '60px 40px',
                                borderRadius: '24px',
                                border: '1px solid var(--border-color)',
                                boxShadow: '0 0 40px rgba(130, 202, 255, 0.05)'
                            }}>
                                <div className="spinner" style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    border: '3px solid rgba(130, 202, 255, 0.1)',
                                    borderTopColor: 'var(--accent-glow)',
                                    marginBottom: '32px'
                                }} />
                                <h3 style={{ fontSize: isMobile ? '1.2rem' : '1.5rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center' }}>
                                    The Agents are orchestrating...
                                </h3>
                                <p style={{
                                    color: 'var(--text-accent)',
                                    fontSize: isMobile ? '0.95rem' : '1.1rem',
                                    height: '24px',
                                    transition: 'opacity 0.3s',
                                    textAlign: 'center'
                                }}>
                                    {pollStatus || "Initializing agents..."}
                                </p>
                            </div>
                        )}

                        {result && (
                            <div style={{ animation: 'fadeIn 0.5s ease', padding: isMobile ? '16px' : '0' }}>
                                <ResultsDashboard
                                    data={result}
                                    userId={result.user_id}
                                    sessionId={result.session_id}
                                    resetIntegration={handleNewJourney}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .spinner {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}
            </style>
        </div>
    );
};

export default WorkspacePage;
