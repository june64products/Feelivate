import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, PanelLeft, AlertCircle, Sparkles } from 'lucide-react';
import { 
    chatWithMentor, 
    approvePlan, 
    getSessionDetail, 
    getGoogleAuthUrl,
    syncGoogleCalendar,
    getTodayEmotion,
    type TodayEmotionResult,
} from '../api';
import SessionSidebar from '../components/workspace/SessionSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import RadiantPromptInput from '../components/chat/RadiantPromptInput';
import WeeklyReviewModal from '../components/workspace/WeeklyReviewModal';
import SessionCompleteModal from '../components/workspace/SessionCompleteModal';
import JourneyPage from './JourneyPage';
import EmotionOrb from '../components/workspace/EmotionOrb';



export default function WorkspacePage() {
    const navigate = useNavigate();
    const [userId] = useState<string | null>(localStorage.getItem('user_id'));
    
    const [activeSessionId, setActiveSessionId] = useState<string | null>(
        localStorage.getItem('active_session_id')
    );
    const [messages, setMessages] = useState<any[]>([]);
    const [activePlan, setActivePlan] = useState<any | null>(null);
    const [isPlanApproved, setIsPlanApproved] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    const [view, setView] = useState<'chat' | 'journey'>('chat');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [isSessionCompleted, setIsSessionCompleted] = useState(false);
    const [sessionFocus, setSessionFocus] = useState<string>('');
    const [todayEmotion, setTodayEmotion] = useState<TodayEmotionResult['entry'] | null>(null);


    // Derived: whether we're in the cinematic empty state
    const isEmptyState = messages.length === 0 && !isLoading;
    
    // Calendar sync states
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [preferredTime, setPreferredTime] = useState("08:00");
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState("");
    const [syncError, setSyncError] = useState("");

    // Auth validation — check both token AND user_id
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!userId || !token) {
            // Clear any stale data
            localStorage.removeItem('user_id');
            localStorage.removeItem('active_session_id');
            navigate('/login');
            return;
        }
        // Load today's emotion scoped to current session
        if (userId) {
            const storedSession = localStorage.getItem('active_session_id');
            getTodayEmotion(userId, storedSession ?? undefined)
                .then(res => { if (res.has_entry) setTodayEmotion(res.entry); })
                .catch(() => {});
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
                
                const phase = data.phase;
                let msgs: any[] = data.messages || [];
                
                // If there's an unapproved plan, attach it to the last assistant message
                // so it gets rendered by ChatWindow
                if (phase === 'planning' && data.plan && msgs.length > 0) {
                    for (let i = msgs.length - 1; i >= 0; i--) {
                        if (msgs[i].role === 'assistant') {
                            msgs[i].plan = data.plan;
                            break;
                        }
                    }
                }
                
                setMessages(msgs);
                setActivePlan(data.plan || null);
                setIsPlanApproved(phase === 'active');
                setIsSessionCompleted(phase === 'completed');
                setSessionFocus(data.focus || '');
            } catch (err: any) {
                console.error("Failed to load session details:", err);
                // If session not found (404) or auth expired (401 throws), clear stale session
                if (err?.message?.includes('Session expired') || err?.message?.includes('404')) {
                    localStorage.removeItem('active_session_id');
                    setActiveSessionId(null);
                }
                // If session just doesn't exist, silently reset to empty state
                setMessages([]);
                setActivePlan(null);
            } finally {
                setIsLoading(false);
            }
        };

        if (activeSessionId) {
            fetchSession();
        }
    }, [activeSessionId]);

    // Listen for "Plan Week N+1" button from JourneyPage
    useEffect(() => {
        const handleNextWeekPlan = (e: Event) => {
            const week = (e as CustomEvent).detail?.week ?? 2;
            setView('chat');
            // Small delay so view switches before sending
            setTimeout(() => {
                handleSendMessage(
                    `I've reviewed my week report. Please build me Week ${week} plan based on my performance data and what I need to improve.`
                );
            }, 300);
        };
        const handleCloseJourney = () => setView('chat');
        window.addEventListener('request-next-week-plan', handleNextWeekPlan);
        window.addEventListener('close-journey', handleCloseJourney);
        return () => {
            window.removeEventListener('request-next-week-plan', handleNextWeekPlan);
            window.removeEventListener('close-journey', handleCloseJourney);
        };
    }, [activeSessionId]);

    // Handle session selection
    const handleSelectSession = (sessionId: string) => {
        setActiveSessionId(sessionId);
        localStorage.setItem('active_session_id', sessionId);
        // Reset session-specific state
        setTodayEmotion(null);
        setIsSessionCompleted(false);
        setView('chat');
        // Re-fetch today's emotion scoped to the newly selected session
        if (userId) {
            getTodayEmotion(userId, sessionId)
                .then(res => { if (res.has_entry) setTodayEmotion(res.entry); else setTodayEmotion(null); })
                .catch(() => { setTodayEmotion(null); });
        }
    };


    // Start a new chat session
    const handleNewChat = () => {
        setActiveSessionId(null);
        localStorage.removeItem('active_session_id');
        setMessages([]);
        setActivePlan(null);
        setIsPlanApproved(false);
    };

    // Logout
    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    // Send a message
    const handleSendMessage = async (text: string) => {
        if (!userId) return;
        
        const userMsg = { role: 'user', content: text };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        
        try {
            const res = await chatWithMentor(text, activeSessionId, userId);
            
            if (!activeSessionId && res.session_id) {
                setActiveSessionId(res.session_id);
                localStorage.setItem('active_session_id', res.session_id);
                setSidebarRefreshKey(prev => prev + 1);
            }
            
            const assistantMsg = { 
                role: 'assistant', 
                content: res.reply,
                plan: res.plan 
            };
            setMessages(prev => [...prev, assistantMsg]);
            
            if (res.plan) {
                setActivePlan(res.plan);
                setIsPlanApproved(false);
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
                const data = await getSessionDetail(activeSessionId);
                setMessages(data.messages || []);
            }
        } catch (err) {
            console.error("Failed to approve plan:", err);
        }
    };

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
                onSelectSession={(id) => { handleSelectSession(id); setView('chat'); }}
                onNewChat={() => { handleNewChat(); setView('chat'); }}
                onJourney={() => setView('journey')}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                refreshKey={sidebarRefreshKey}
                isPlanActive={isPlanApproved}
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
                {/* Journey view — full-panel replacement */}
                {view === 'journey' && userId && (
                    <JourneyPage
                        userId={userId}
                        sessionId={activeSessionId ?? undefined}
                        onJournalSaved={(entry) => {
                            // Directly update the orb with the saved entry — no refetch needed
                            setTodayEmotion(entry);
                        }}
                        onClose={() => setView('chat')}
                    />
                )}

                {/* Weekly Review Modal */}
                {showReviewModal && activeSessionId && activePlan && (
                    <WeeklyReviewModal
                        sessionId={activeSessionId}
                        weekNumber={activePlan.week_number ?? 1}
                        onClose={() => setShowReviewModal(false)}
                        onComplete={() => {
                            setShowReviewModal(false);
                            setView('chat');
                        }}
                    />
                )}

                {/* Normal chat view */}
                {view === 'chat' && (<>

                {/* Ambient Background Orbs — always visible, brightest in empty state */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                    <motion.div
                        animate={{ opacity: isEmptyState ? 0.45 : 0.18, scale: isEmptyState ? 1.1 : 1 }}
                        transition={{ duration: 1.2, ease: 'easeInOut' }}
                        style={{
                            position: 'absolute',
                            top: '-10%',
                            left: '20%',
                            width: '500px',
                            height: '500px',
                            background: 'radial-gradient(circle, rgba(192,132,252,0.25) 0%, transparent 70%)',
                            borderRadius: '50%',
                            filter: 'blur(60px)',
                        }}
                    />
                    <motion.div
                        animate={{ opacity: isEmptyState ? 0.35 : 0.12, scale: isEmptyState ? 1.05 : 1 }}
                        transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.1 }}
                        style={{
                            position: 'absolute',
                            bottom: '-5%',
                            right: '15%',
                            width: '600px',
                            height: '600px',
                            background: 'radial-gradient(circle, rgba(129,140,248,0.2) 0%, transparent 70%)',
                            borderRadius: '50%',
                            filter: 'blur(80px)',
                        }}
                    />
                    <motion.div
                        animate={{ opacity: isEmptyState ? 0.25 : 0.08 }}
                        transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                        style={{
                            position: 'absolute',
                            top: '40%',
                            left: '60%',
                            width: '300px',
                            height: '300px',
                            background: 'radial-gradient(circle, rgba(201,100,66,0.2) 0%, transparent 70%)',
                            borderRadius: '50%',
                            filter: 'blur(50px)',
                        }}
                    />
                </div>

                {/* Emotion Orb — floats on right edge of chat after today's journal */}
                <AnimatePresence>
                    {todayEmotion && (
                        <EmotionOrb
                            emotion={todayEmotion}
                            onClick={() => setView('journey')}
                        />
                    )}
                </AnimatePresence>

                {/* Header */}
                <div style={{
                    height: '56px',
                    padding: '0 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                    zIndex: 15,
                    position: 'relative',
                    fontFamily: "'Inter', sans-serif"
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isSidebarCollapsed && (
                            <button
                                onClick={() => setIsSidebarCollapsed(false)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    border: 'none', background: 'transparent',
                                    color: '#a1a1aa', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                <PanelLeft size={18} />
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        {isPlanApproved && (
                            <button
                                onClick={() => setShowCalendarModal(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '6px 14px', borderRadius: '20px',
                                    border: '1px solid rgba(74,222,128,0.25)',
                                    background: 'rgba(74,222,128,0.05)',
                                    color: '#4ade80', fontSize: '12.5px',
                                    fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                                    fontFamily: "'Inter', sans-serif",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.1)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.05)'; }}
                            >
                                <Calendar size={12} />
                                Calendar Sync
                            </button>
                        )}
                        {/* Pricing */}
                        <span style={{
                            fontSize: '13.5px', color: '#71717a', cursor: 'pointer',
                            fontWeight: 500, fontFamily: "'Inter', sans-serif",
                            transition: 'color 0.15s',
                        }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#a1a1aa'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#71717a'}
                        >
                            Pricing
                        </span>

                        {/* Upgrade */}
                        <button className="upgrade-btn">
                            Upgrade
                        </button>

                        {/* Running indicator — shown when plan is active */}
                        {isPlanApproved && !isSessionCompleted && activeSessionId && (
                            <button
                                onClick={() => setShowCompleteModal(true)}
                                title="Stop plan"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '7px',
                                    padding: '5px 12px', borderRadius: '20px',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    background: 'rgba(239,68,68,0.05)',
                                    color: '#f87171', fontSize: '12px',
                                    fontWeight: 500, cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    fontFamily: "'Inter', sans-serif",
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; }}
                            >
                                <div style={{
                                    width: '6px', height: '6px', borderRadius: '50%',
                                    background: '#f87171',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                                Running
                            </button>
                        )}

                        {/* User avatar with first+last initials */}
                        <div
                            className="user-avatar"
                            onClick={handleLogout}
                            title="Logout"
                        >
                            {(() => {
                                const name = localStorage.getItem('user_name') || '';
                                const parts = name.trim().split(' ');
                                const first = parts[0]?.[0]?.toUpperCase() || '';
                                const last = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() : '';
                                return first + last || 'U';
                            })()}
                        </div>
                    </div>
                </div>

                {/* ─── EMPTY STATE: Cinematic Hero ─── */}
                <AnimatePresence mode="wait">
                    {isEmptyState ? (
                        <motion.div
                            key="empty-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '24px 20px 0',
                                position: 'relative',
                                zIndex: 5,
                                gap: '0px',
                            }}
                        >
                            {/* Hero Text — Feelivate logo + greeting */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                                style={{ textAlign: 'center', marginBottom: '36px', fontFamily: "'Inter', sans-serif" }}
                            >
                                {/* Logo + Name row */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    gap: '14px', marginBottom: '22px'
                                }}>
                                    <div style={{
                                        width: '38px', height: '38px',
                                        background: '#fff', borderRadius: '10px',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden', flexShrink: 0,
                                    }}>
                                        <img
                                            src="/logo_2_backup.png"
                                            alt="Feelivate"
                                            style={{ width: '26px', height: '26px', objectFit: 'contain' }}
                                        />
                                    </div>
                                    <h1 style={{
                                        fontSize: '30px', fontWeight: 700,
                                        letterSpacing: '-0.025em', color: '#f0f0f0', margin: 0,
                                    }}>
                                        FEELIVATE
                                    </h1>
                                </div>

                                {/* Personalised greeting */}
                                <h2 style={{
                                    fontSize: '26px', fontWeight: 500,
                                    color: '#a1a1aa',
                                    letterSpacing: '-0.01em',
                                    margin: 0,
                                    lineHeight: 1.3,
                                }}>
                                    Hi {localStorage.getItem('user_name')?.split(' ')[0] || 'there'}, what's on your mind?
                                </h2>
                            </motion.div>

                            {/* Radiant Input — centered hero position */}
                            <motion.div
                                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                style={{ width: '100%', maxWidth: '720px', padding: '0 16px', marginBottom: '48px' }}
                            >
                                <RadiantPromptInput
                                    onSubmit={handleSendMessage}
                                    disabled={isLoading}
                                    placeholder="Share what's on your mind..."
                                />
                            </motion.div>

                            {/* Capabilities Grid — removed to match Blackbox minimal */}
                        </motion.div>
                    ) : (
                        /* ─── CHAT STATE ─── */
                        <motion.div
                            key="chat-state"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4 }}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 5 }}
                        >
                            <ChatWindow
                                messages={messages}
                                isLoading={isLoading}
                                activePlan={activePlan}
                                onApprovePlan={handleApprovePlan}
                                onRequestPlanChange={handleRequestPlanChange}
                                isPlanApproved={isPlanApproved}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Bottom Input (always visible in chat state, hidden in empty state since input is inline there) */}
                <AnimatePresence>
                    {!isEmptyState && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            style={{
                                padding: '0 20px 24px',
                                background: 'linear-gradient(180deg, transparent, var(--bg-primary) 20%)',
                                flexShrink: 0,
                                position: 'relative',
                                zIndex: 10,
                            }}
                        >
                            <RadiantPromptInput
                                onSubmit={handleSendMessage}
                                disabled={isLoading}
                                placeholder="Continue the conversation..."
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
                </>) } {/* end view === 'chat' */}
            </div>

            {/* Calendar Sync Modal */}
            <AnimatePresence>
                {showCalendarModal && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 200,
                    }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{
                                width: '100%', maxWidth: '380px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: '16px', padding: '24px',
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
                                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                                        border: '1px solid var(--border-medium)', background: 'var(--bg-primary)',
                                        color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                    }}
                                />
                            </div>

                            {syncMessage && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'rgba(16, 185, 129, 0.08)', color: 'var(--accent-green)',
                                    fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center'
                                }}>
                                    <Sparkles size={14} />
                                    <span>{syncMessage}</span>
                                </div>
                            )}

                            {syncError && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.08)', color: '#f87171',
                                    fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center'
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

            {/* Session Complete Modal */}
            {showCompleteModal && activeSessionId && (
                <SessionCompleteModal
                    sessionId={activeSessionId}
                    sessionFocus={sessionFocus}
                    onClose={() => setShowCompleteModal(false)}
                    onConfirmed={() => {
                        setIsSessionCompleted(true);
                        setIsPlanApproved(false);
                        setShowCompleteModal(false);
                    }}
                />
            )}
        </div>
    );
}
