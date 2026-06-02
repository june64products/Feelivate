import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, AlertCircle, Sparkles, LogOut } from 'lucide-react';
import { 
    chatWithMentor, 
    approvePlan, 
    getSessionDetail, 
    getGoogleAuthUrl,
    syncGoogleCalendar,
    stopGoogleCalendarSync,
    getTodayEmotion,
    type TodayEmotionResult,
    getLocalISODate,
} from '../api';
import FloatingDock from '../components/workspace/FloatingDock';
import ChatWindow from '../components/chat/ChatWindow';
import RadiantPromptInput from '../components/chat/RadiantPromptInput';
import WeeklyReviewModal from '../components/workspace/WeeklyReviewModal';
import SessionCompleteModal from '../components/workspace/SessionCompleteModal';
import JourneyPage from './JourneyPage';
import EmotionOrb from '../components/workspace/EmotionOrb';
import LockedWeeksPanel from '../components/workspace/LockedWeeksPanel';



export default function WorkspacePage() {
    const navigate = useNavigate();
    const [userId] = useState<string | null>(localStorage.getItem('user_id'));
    
    const [activeSessionId, setActiveSessionId] = useState<string | null>(
        localStorage.getItem('active_session_id')
    );
    const [messages, setMessages] = useState<any[]>([]);
    const [activePlan, setActivePlan] = useState<any | null>(null);
    const [planHistory, setPlanHistory] = useState<any[]>([]);
    const [isPlanApproved, setIsPlanApproved] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

    const [view, setView] = useState<'chat' | 'journey'>('chat');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [isSessionCompleted, setIsSessionCompleted] = useState(false);
    const [sessionFocus, setSessionFocus] = useState<string>('');
    const [todayEmotion, setTodayEmotion] = useState<TodayEmotionResult['entry'] | null>(null);
    const [showLogoutMenu, setShowLogoutMenu] = useState(false);

    // Derived: whether we're in the cinematic empty state
    const isEmptyState = messages.length === 0 && !isLoading;

    // Mic locked state
    const [micLocked, setMicLocked] = useState<boolean>(() => {
        const uid = localStorage.getItem('user_id');
        const key = `last_journal_date_${uid}`;
        return localStorage.getItem(key) === getLocalISODate();
    });

    // Refresh micLocked on mount
    useEffect(() => {
        const uid = localStorage.getItem('user_id');
        if (uid) {
            const key = `last_journal_date_${uid}`;
            setMicLocked(localStorage.getItem(key) === getLocalISODate());
        }
    }, [activeSessionId, userId]);
    
    // Calendar sync states
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [preferredTime, setPreferredTime] = useState("08:00");
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncMessage, setSyncMessage] = useState("");
    const [syncError, setSyncError] = useState("");

    // Auth validation
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!userId || !token) {
            localStorage.removeItem('user_id');
            localStorage.removeItem('active_session_id');
            navigate('/login');
            return;
        }
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
                setPlanHistory(data.plan_history || []);
                setIsPlanApproved(phase === 'active');
                setIsSessionCompleted(phase === 'completed');
                setSessionFocus(data.focus || '');
            } catch (err: any) {
                console.error("Failed to load session details:", err);
                if (err?.message?.includes('Session expired') || err?.message?.includes('404')) {
                    localStorage.removeItem('active_session_id');
                    setActiveSessionId(null);
                }
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
        setTodayEmotion(null);
        setIsSessionCompleted(false);
        setView('chat');
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
        setIsSessionCompleted(false);
        setSessionFocus('');
        setTodayEmotion(null);
        setView('chat');
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
                        window.location.href = authRes.auth_url;
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

    // Stop Calendar Sync
    const handleStopSyncCalendar = async () => {
        if (!userId) return;
        setSyncLoading(true);
        setSyncMessage("");
        setSyncError("");
        try {
            const res = await stopGoogleCalendarSync(userId);
            setSyncMessage(res.message || "Sync stopped and events removed.");
            setTimeout(() => setShowCalendarModal(false), 2000);
        } catch (err: any) {
            console.error("Stop sync failed:", err);
            setSyncError(err.message || "Failed to stop calendar sync.");
        } finally {
            setSyncLoading(false);
        }
    };

    // User initials
    const userInitials = (() => {
        const name = localStorage.getItem('user_name') || '';
        const parts = name.trim().split(' ');
        const first = parts[0]?.[0]?.toUpperCase() || '';
        const last = parts.length > 1 ? parts[parts.length - 1][0]?.toUpperCase() : '';
        return first + last || 'U';
    })();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* Journey view — full-panel replacement */}
            {view === 'journey' && userId && (
                <JourneyPage
                    userId={userId}
                    sessionId={activeSessionId ?? undefined}
                    onJournalSaved={(entry) => {
                        setTodayEmotion(entry);
                        setMicLocked(true);
                        const uid = localStorage.getItem('user_id');
                        if (uid) {
                            localStorage.setItem(`last_journal_date_${uid}`, getLocalISODate());
                        }
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

            {/* ── Chat View ──────────────────────────────────────────── */}
            {view === 'chat' && (<>

            {/* Ambient Background Orbs */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
                <motion.div
                    animate={{ opacity: isEmptyState ? 0.4 : 0.15, scale: isEmptyState ? 1.1 : 1 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    style={{
                        position: 'absolute', top: '-10%', left: '20%',
                        width: '500px', height: '500px',
                        background: 'radial-gradient(circle, rgba(167,139,250,0.2) 0%, transparent 70%)',
                        borderRadius: '50%', filter: 'blur(80px)',
                    }}
                />
                <motion.div
                    animate={{ opacity: isEmptyState ? 0.3 : 0.1, scale: isEmptyState ? 1.05 : 1 }}
                    transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.1 }}
                    style={{
                        position: 'absolute', bottom: '-5%', right: '15%',
                        width: '600px', height: '600px',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
                        borderRadius: '50%', filter: 'blur(100px)',
                    }}
                />
                <motion.div
                    animate={{ opacity: isEmptyState ? 0.2 : 0.06 }}
                    transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.2 }}
                    style={{
                        position: 'absolute', top: '40%', left: '60%',
                        width: '300px', height: '300px',
                        background: 'radial-gradient(circle, rgba(217,119,87,0.15) 0%, transparent 70%)',
                        borderRadius: '50%', filter: 'blur(60px)',
                    }}
                />
            </div>

            {/* ── Minimal Top Bar ──────────────────────────────────── */}
            <div className="mobile-header" style={{
                minHeight: '52px',
                height: 'auto',
                padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 20px 10px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                zIndex: 15,
                position: 'relative',
            }}>
                {/* Left: Brand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                        width: '28px', height: '28px', background: '#fff', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                    }}>
                        <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    </div>
                    <span className="hide-on-mobile" style={{
                        fontWeight: 700, fontSize: '14px', color: '#e8e8ed',
                        letterSpacing: '-0.02em',
                    }}>
                        FEELIVATE
                    </span>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Calendar Sync */}
                    {isPlanApproved && (
                        <button
                            onClick={() => setShowCalendarModal(true)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 12px', borderRadius: '20px',
                                border: '1px solid rgba(74,222,128,0.2)',
                                background: 'rgba(74,222,128,0.05)',
                                color: '#4ade80', fontSize: '12px',
                                fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
                                fontFamily: 'var(--font-sans)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,222,128,0.05)'; }}
                        >
                            <Calendar size={12} />
                            <span className="hide-on-mobile">Sync</span>
                        </button>
                    )}

                    {/* Running indicator */}
                    {isPlanApproved && !isSessionCompleted && activeSessionId && (
                        <button
                            onClick={() => setShowCompleteModal(true)}
                            title="Stop plan"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '5px 12px', borderRadius: '20px',
                                border: '1px solid rgba(239,68,68,0.2)',
                                background: 'rgba(239,68,68,0.05)',
                                color: '#f87171', fontSize: '12px',
                                fontWeight: 500, cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontFamily: 'var(--font-sans)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; }}
                        >
                            <div style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: '#f87171',
                                animation: 'pulse 1.5s ease-in-out infinite',
                            }} />
                            <span className="hide-on-mobile">Running</span>
                        </button>
                    )}

                    {/* User avatar */}
                    <div style={{ position: 'relative' }}>
                        <div
                            className="user-avatar"
                            onClick={() => setShowLogoutMenu(!showLogoutMenu)}
                            title="Account"
                        >
                            {userInitials}
                        </div>
                        <AnimatePresence>
                            {showLogoutMenu && (
                                <>
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onClick={() => setShowLogoutMenu(false)}
                                        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        style={{
                                            position: 'absolute', right: 0, top: '42px',
                                            background: 'rgba(14,14,20,0.95)',
                                            backdropFilter: 'blur(16px)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '12px', padding: '4px',
                                            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                                            zIndex: 100, minWidth: '140px',
                                        }}
                                    >
                                        <button
                                            onClick={handleLogout}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                                                padding: '10px 14px', borderRadius: '8px',
                                                border: 'none', background: 'transparent',
                                                color: '#f87171', fontSize: '13px', fontWeight: 500,
                                                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <LogOut size={14} />
                                            Log out
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Emotion Orb — floats on right edge */}
            <AnimatePresence>
                {todayEmotion && (
                    <EmotionOrb
                        emotion={todayEmotion}
                        onClick={() => setView('journey')}
                    />
                )}
            </AnimatePresence>

            {/* Locked Weeks Panel (Desktop: Fixed Right / Mobile: Relative under Header) */}
            {isPlanApproved && activeSessionId && (
                <LockedWeeksPanel
                    sessionId={activeSessionId}
                    currentWeek={activePlan?.week_number ?? 1}
                    micLocked={micLocked}
                    activePlan={activePlan}
                    planHistory={planHistory}
                />
            )}

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
                            padding: '24px 20px 100px',
                            position: 'relative',
                            zIndex: 5,
                        }}
                    >
                        {/* Hero */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                            style={{ textAlign: 'center', marginBottom: '36px' }}
                        >
                            {/* Logo + Name */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '14px', marginBottom: '22px'
                            }}>
                                <div style={{
                                    width: '42px', height: '42px',
                                    background: '#fff', borderRadius: '12px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden', flexShrink: 0,
                                    boxShadow: '0 6px 24px rgba(167,139,250,0.15)',
                                }}>
                                    <img
                                        src="/logo_2_backup.png" alt="Feelivate"
                                        style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                                    />
                                </div>
                                <h1 style={{
                                    fontSize: '32px', fontWeight: 700,
                                    letterSpacing: '-0.03em', color: '#e8e8ed', margin: 0,
                                }}>
                                    FEELIVATE
                                </h1>
                            </div>

                            <h2 style={{
                                fontSize: '24px', fontWeight: 500,
                                color: '#9d9daa', letterSpacing: '-0.01em',
                                margin: 0, lineHeight: 1.3,
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
                            onApprovePlan={handleApprovePlan}
                            onRequestPlanChange={handleRequestPlanChange}
                            isPlanApproved={isPlanApproved}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bottom Input (chat state only — not in empty state since input is inline there) */}
            <AnimatePresence>
                {!isEmptyState && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            padding: '0 20px 80px',
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

            {/* ── Floating Dock (replaces sidebar) ──────────────── */}
            <FloatingDock
                userId={userId || ''}
                activeSessionId={activeSessionId}
                onSelectSession={(id) => { handleSelectSession(id); setView('chat'); }}
                onNewChat={() => { handleNewChat(); setView('chat'); }}
                onJourney={() => { setView('journey'); }}
                refreshKey={sidebarRefreshKey}
                isPlanActive={isPlanApproved}
            />

            </>)} {/* end view === 'chat' */}

            {/* Calendar Sync Modal */}
            <AnimatePresence>
                {showCalendarModal && (
                    <div style={{
                        position: 'fixed', inset: 0,
                        background: 'rgba(0,0,0,0.65)',
                        backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 200, padding: '20px',
                    }}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowCalendarModal(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{
                                width: '100%', maxWidth: '400px',
                                background: '#111116',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '20px', padding: '28px',
                                boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
                            }}
                        >
                            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                                Sync to Calendar
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                                Connect Feelivate to your Google Calendar. We'll sync your week's schedule to notify you each day.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                    Preferred Notification Time
                                </label>
                                <input
                                    type="time"
                                    value={preferredTime}
                                    onChange={(e) => setPreferredTime(e.target.value)}
                                    style={{
                                        width: '100%', padding: '11px 14px', borderRadius: '12px',
                                        border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
                                        color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                        fontFamily: 'var(--font-sans)',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)'; }}
                                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                                />
                            </div>

                            {syncMessage && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: 'rgba(16, 185, 129, 0.06)', color: 'var(--accent-green)',
                                    fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center',
                                    border: '1px solid rgba(16,185,129,0.15)',
                                }}>
                                    <Sparkles size={14} />
                                    <span>{syncMessage}</span>
                                </div>
                            )}

                            {syncError && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: 'rgba(239, 68, 68, 0.06)', color: '#f87171',
                                    fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center',
                                    border: '1px solid rgba(239,68,68,0.15)',
                                }}>
                                    <AlertCircle size={14} />
                                    <span>{syncError}</span>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                <button
                                    onClick={handleStopSyncCalendar}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '9px 16px', borderRadius: '10px',
                                        border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.05)',
                                        color: '#f87171', fontSize: '13px', cursor: 'pointer',
                                        fontFamily: 'var(--font-sans)', fontWeight: 500,
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.05)'; }}
                                >
                                    Stop Sync
                                </button>
                                <div style={{ flex: 1 }} />
                                <button
                                    onClick={() => setShowCalendarModal(false)}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '9px 16px', borderRadius: '10px',
                                        border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                                        color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                                        fontFamily: 'var(--font-sans)', fontWeight: 500,
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSyncCalendar}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '9px 16px', borderRadius: '10px',
                                        border: 'none', background: 'var(--accent-green)',
                                        color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontFamily: 'var(--font-sans)',
                                        transition: 'opacity 0.15s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; }}
                                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
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
