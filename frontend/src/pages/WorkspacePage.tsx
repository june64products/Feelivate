import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Calendar, PanelLeft, AlertCircle } from 'lucide-react';
import { 
    chatWithMentor, 
    approvePlan, 
    getSessionDetail, 
    getGoogleAuthUrl,
    syncGoogleCalendar
} from '../api';
import SessionSidebar from '../components/workspace/SessionSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import RadiantPromptInput from '../components/chat/RadiantPromptInput';

export default function WorkspacePage() {
    const navigate = useNavigate();
    const [userId] = useState<string | null>(localStorage.getItem('user_id'));
    
    const [activeSessionId, setActiveSessionId] = useState<string | null>(
        sessionStorage.getItem('active_session_id')
    );
    const [messages, setMessages] = useState<any[]>([]);
    const [activePlan, setActivePlan] = useState<any | null>(null);
    const [isPlanApproved, setIsPlanApproved] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    
    // Calendar sync states
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [preferredTime, setPreferredTime] = useState("08:00");
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState("");
    const [syncError, setSyncError] = useState("");

    // Auth validation
    useEffect(() => {
        if (!userId) {
            navigate('/login');
            return;
        }
    }, [userId, navigate]);

    // Fetch active session detail
    useEffect(() => {
        const fetchSession = async () => {
            if (!activeSessionId) {
                setMessages([]);
                setActivePlan(null);
                setIsPlanApproved(false);
                return;
            }

            try {
                setIsLoading(true);
                const data = await getSessionDetail(activeSessionId);
                setMessages(data.messages || []);
                setActivePlan(data.plan || null);
                setIsPlanApproved(data.phase === 'active');
            } catch (err) {
                console.error("Failed to load session details:", err);
            } finally {
                setIsLoading(false);
            }
        };

        if (activeSessionId) {
            fetchSession();
        }
    }, [activeSessionId]);

    // Handle session selection
    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        sessionStorage.setItem('active_session_id', sessionId);
    };

    // Start a new chat session
    const handleNewChat = () => {
        setActiveSessionId(null);
        sessionStorage.removeItem('active_session_id');
        setMessages([]);
        setActivePlan(null);
        setIsPlanApproved(false);
    };

    // Logout
    const handleLogout = () => {
        localStorage.clear();
        sessionStorage.clear();
        navigate('/login');
    };

    // Send a message
    const handleSendMessage = async (text: string) => {
        if (!userId) return;
        
        // 1. Add user message locally
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        
        try {
            // 2. Call chat API
            const res = await chatWithMentor(text, activeSessionId, userId);
            
            // 3. If new session was created on backend, set active session ID
            if (!activeSessionId && res.session_id) {
                setActiveSessionId(res.session_id);
                sessionStorage.setItem('active_session_id', res.session_id);
                setSidebarRefreshKey(prev => prev + 1);
            }
            
            // 4. Update messages list with AI reply and potential plan
            const assistantMsg = { 
                role: 'assistant', 
                content: res.reply,
                plan: res.plan 
            };
            setMessages(prev => [...prev, assistantMsg]);
            
            if (res.plan) {
                setActivePlan(res.plan);
                setIsPlanApproved(false); // New plan generated, not approved yet
            }
        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: "I'm sorry, I encountered an issue. Let's try that again." 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Approve the plan
    const handleApprovePlan = async () => {
        if (!activeSessionId) return;
        try {
            const res = await approvePlan(activeSessionId);
            if (res.status === 'approved') {
                setIsPlanApproved(true);
                // Fetch updated messages (the backend appends a system confirmation message)
                const data = await getSessionDetail(activeSessionId);
                setMessages(data.messages || []);
            }
        } catch (err) {
            console.error("Failed to approve plan:", err);
        }
    };

    // Tweak request
    const handleRequestPlanChange = (feedback: string) => {
        handleSendMessage(`I'd like to change some parts of this plan: ${feedback}`);
    };

    // Trigger Calendar Sync
    const handleSyncCalendar = async () => {
        if (!activeSessionId || !userId) return;
        setSyncLoading(true);
        setSyncMessage("");
        setSyncError("");
        try {
            const res = await syncGoogleCalendar(activeSessionId, userId, preferredTime);
            setSyncMessage(res.message || "Successfully synced to your Google Calendar!");
            setTimeout(() => setShowCalendarModal(false), 2000);
        } catch (err: any) {
            console.error("Sync failed:", err);
            // If calendar is not connected, redirect to auth flow
            if (err.message?.includes("Google Calendar not connected")) {
                try {
                    const authRes = await getGoogleAuthUrl();
                    if (authRes.auth_url) {
                        setSyncMessage("Redirecting to Google Calendar connection page...");
                        setTimeout(() => {
                            window.open(authRes.auth_url, '_blank');
                            setSyncLoading(false);
                            setSyncMessage("Once authorized, please click Sync again.");
                        }, 1000);
                        return;
                    }
                } catch (authErr) {
                    console.error("Failed to load Google Auth URL:", authErr);
                }
            }
            setSyncError(err.message || "Failed to sync calendar. Make sure your account is connected.");
        } finally {
            if (syncMessage !== "Redirecting to Google Calendar connection page...") {
                setSyncLoading(false);
            }
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
        }}>
            {/* Sidebar */}
            <SessionSidebar
                userId={userId || ''}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onLogout={handleLogout}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                refreshKey={sidebarRefreshKey}
            />

            {/* Chat Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    height: '52px',
                    borderBottom: '1px solid var(--border-subtle)',
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    zIndex: 15,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSidebarCollapsed && (
                            <button
                                onClick={() => setIsSidebarCollapsed(false)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    border: 'none', background: 'transparent',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginRight: '8px',
                                }}
                            >
                                <PanelLeft size={16} />
                            </button>
                        )}
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                            Feelivate Workspace
                        </span>
                    </div>

                    {/* Sync to Calendar button (only if plan is approved) */}
                    {isPlanApproved && (
                        <button
                            onClick={() => setShowCalendarModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                background: 'rgba(16, 185, 129, 0.06)',
                                color: 'var(--accent-green)',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.06)';
                            }}
                        >
                            <Calendar size={13} />
                            Sync to Google Calendar
                        </button>
                    )}
                </div>

                {/* Main Chat Display */}
                <ChatWindow
                    messages={messages}
                    isLoading={isLoading}
                    activePlan={activePlan}
                    onApprovePlan={handleApprovePlan}
                    onRequestPlanChange={handleRequestPlanChange}
                    isPlanApproved={isPlanApproved}
                />

                {/* Bottom Input Area */}
                <div style={{
                    padding: '0 20px 24px',
                    background: 'linear-gradient(180deg, transparent, var(--bg-primary) 20%)',
                    flexShrink: 0,
                }}>
                    <RadiantPromptInput
                        onSubmit={handleSendMessage}
                        disabled={isLoading}
                    />
                </div>
            </div>

            {/* Calendar Sync Modal */}
            <AnimatePresence>
                {showCalendarModal && (
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 200,
                    }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{
                                width: '100%',
                                maxWidth: '380px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: '16px',
                                padding: '24px',
                                boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
                            }}
                        >
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                Sync Weekly Roadmap to Calendar
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                                Connect Feelivate to your Google Calendar. We will automatically sync your week's schedule to notify you each day.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    Preferred Morning Notification Time
                                </label>
                                <input
                                    type="time"
                                    value={preferredTime}
                                    onChange={(e) => setPreferredTime(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '10px',
                                        border: '1px solid var(--border-medium)',
                                        background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '14px',
                                        outline: 'none',
                                    }}
                                />
                            </div>

                            {/* Status notifications */}
                            {syncMessage && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'rgba(16, 185, 129, 0.08)',
                                    color: 'var(--accent-green)', fontSize: '12px',
                                    marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center'
                                }}>
                                    <Sparkles size={14} />
                                    <span>{syncMessage}</span>
                                </div>
                            )}

                            {syncError && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    color: '#f87171', fontSize: '12px',
                                    marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center'
                                }}>
                                    <AlertCircle size={14} />
                                    <span>{syncError}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowCalendarModal(false)}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '8px 16px', borderRadius: '10px',
                                        border: '1px solid var(--border-medium)', background: 'transparent',
                                        color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSyncCalendar}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '8px 16px', borderRadius: '10px',
                                        border: 'none', background: 'var(--accent-green)',
                                        color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}
                                >
                                    {syncLoading ? "Syncing..." : "Sync Now"}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
