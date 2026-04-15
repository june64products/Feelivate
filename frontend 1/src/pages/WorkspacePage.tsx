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
    
    useEffect(() => {
        if (!userId) {
            navigate('/login');
        }
    }, [userId, navigate]);

    const [result, setResult] = useState<any>(null);
    const [pollStatus, setPollStatus] = useState('');

    const handleSelectSession = async (sessionId: string) => {
        try {
            setProcessing(true);
            setActiveSessionId(sessionId);
            const data = await getSessionDetail(sessionId);
            
            if (data.result) {
                setResult({
                    user_id: userId,
                    session_id: data.id,
                    ...data.result
                });
            } else {
                setResult(null);
                alert("This session is still being processed or has no results.");
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            alert("Could not load the selected journey.");
        } finally {
            setProcessing(false);
        }
    };

    const handleNewJourney = () => {
        setActiveSessionId(null);
        setResult(null);
        setProcessing(false);
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
                padding: '0 40px',
                background: 'rgba(10, 10, 10, 0.7)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                zIndex: 100
            }}>
                <div
                    onClick={() => navigate('/')}
                    style={{
                        fontWeight: 600,
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <span style={{ color: 'var(--text-secondary)' }}>←</span> Leave Workspace
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
                        padding: '8px 16px',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                    }}
                >
                    Log Out
                </button>
            </nav>

            <div style={{ display: 'flex', flex: 1, marginTop: 'var(--nav-height)' }}>
                {/* Sidebar */}
                {userId && (
                    <SessionSidebar 
                        key={sidebarKey}
                        userId={userId} 
                        activeSessionId={activeSessionId}
                        onSelectSession={handleSelectSession}
                        onNewJourney={handleNewJourney}
                    />
                )}

                {/* Main Content Area */}
                <main style={{ 
                    flex: 1, 
                    marginLeft: userId ? '280px' : 0, 
                    padding: '40px 24px 80px',
                    position: 'relative',
                    zIndex: 1 
                }}>
                    <div style={{ maxWidth: result ? '100%' : '1000px', margin: '0 auto' }}>
                        {!processing && !result && (
                            <div style={{ animation: 'fadeIn 0.5s ease' }}>
                                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                                    <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '16px', fontWeight: 700 }} className="text-gradient">
                                        Behavioral Architecture Engine v2.0
                                    </h1>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                                        Transform unstructured thoughts into a high-fidelity emotional blueprint.
                                    </p>
                                </div>
                                <InputForm onSubmit={handleIngest} isLoading={processing} />
                            </div>
                        )}

                        {processing && !result && (
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '100px auto',
                                maxWidth: '600px',
                                background: 'rgba(0,0,0,0.3)',
                                padding: '60px 40px',
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
                                <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    The Agents are orchestrating...
                                </h3>
                                <p style={{
                                    color: 'var(--text-accent)',
                                    fontSize: '1.1rem',
                                    height: '24px',
                                    transition: 'opacity 0.3s'
                                }}>
                                    {pollStatus || "Initializing agents..."}
                                </p>
                            </div>
                        )}

                        {result && (
                            <div style={{ animation: 'fadeIn 0.5s ease' }}>
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
            `}</style>
        </div>
    );
};

export default WorkspacePage;
