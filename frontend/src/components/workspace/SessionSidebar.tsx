import { useState, useEffect } from 'react';
import { PlusCircle, History, Calendar, ChevronRight, Brain } from 'lucide-react';
import { getUserSessions } from '../../api';

interface Session {
    id: string;
    created_at: string;
    focus_preview: string;
    has_result: boolean;
}

interface SessionSidebarProps {
    userId: string;
    activeSessionId: string | null;
    onSelectSession: (sessionId: string) => void;
    onNewJourney: () => void;
}

const SessionSidebar = ({ userId, activeSessionId, onSelectSession, onNewJourney }: SessionSidebarProps) => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSessions = async () => {
            try {
                const data = await getUserSessions(userId);
                setSessions(data);
            } catch (error) {
                console.error("Failed to load sessions:", error);
            } finally {
                setLoading(false);
            }
        };

        if (userId) {
            loadSessions();
        }
    }, [userId]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <div style={{
            width: '280px',
            height: 'calc(100vh - var(--nav-height))',
            background: 'rgba(10, 10, 10, 0.4)',
            backdropFilter: 'blur(20px)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            position: 'fixed',
            left: 0,
            top: 'var(--nav-height)',
            zIndex: 40,
            transition: 'transform 0.3s ease',
        }}>
            <div style={{ padding: '24px' }}>
                <button
                    onClick={onNewJourney}
                    style={{
                        width: '100%',
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        padding: '12px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.1)',
                        transition: 'transform 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                    <PlusCircle size={18} />
                    New Journey
                </button>
            </div>

            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '0 12px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }}>
                <div style={{ 
                    padding: '0 12px 12px', 
                    fontSize: '0.75rem', 
                    fontWeight: 600, 
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <History size={14} />
                    Past Journeys
                </div>

                {loading ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div className="spinner" style={{ width: '20px', height: '20px', margin: '0 auto 10px' }} />
                        Loading...
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ 
                        padding: '24px', 
                        textAlign: 'center', 
                        color: 'var(--text-secondary)',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: '12px',
                        margin: '0 12px',
                        fontSize: '0.9rem'
                    }}>
                        No past journeys found. Start your first one!
                    </div>
                ) : (
                    sessions.map((session) => (
                        <div
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                background: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                border: '1px solid',
                                borderColor: activeSessionId === session.id ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                                transition: 'all 0.2s',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                            onMouseEnter={(e) => {
                                if (activeSessionId !== session.id) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (activeSessionId !== session.id) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                <div style={{ 
                                    fontSize: '0.85rem', 
                                    fontWeight: 600, 
                                    color: activeSessionId === session.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '80%'
                                }}>
                                    {session.focus_preview}
                                </div>
                                <ChevronRight 
                                    size={14} 
                                    style={{ 
                                        opacity: activeSessionId === session.id ? 1 : 0,
                                        transition: 'opacity 0.2s',
                                        color: 'var(--text-accent)'
                                    }} 
                                />
                            </div>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '12px',
                                fontSize: '0.7rem', 
                                color: 'rgba(255,255,255,0.4)' 
                            }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Calendar size={10} />
                                    {formatDate(session.created_at)}
                                </span>
                                {session.has_result && (
                                    <span style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '4px',
                                        color: 'rgba(130, 202, 255, 0.6)'
                                    }}>
                                        <Brain size={10} />
                                        Analyzed
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            <style>{`
                .spinner {
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    border-top: 2px solid var(--text-accent);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default SessionSidebar;
