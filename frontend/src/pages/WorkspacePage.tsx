import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import InputForm from '../components/workspace/InputForm';
import ResultsDashboard from '../components/workspace/ResultsDashboard';
import SessionSidebar from '../components/workspace/SessionSidebar';
import { submitIngestStream, getSessionDetail } from '../api';

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
                
                <button
                    onClick={() => {
                        localStorage.removeItem('user_id');
                        navigate('/');
                    }}
                    style={{
                        background: 'transparent',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-secondary)',
                        padding: isMobile ? '6px 12px' : '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    Log Out
                </button>
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
