import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelLeft, AlertCircle, Sparkles, Bell, BellOff, CheckCircle, Mail, Loader2, X, Clock } from 'lucide-react';
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
    sendEmailOTP,
    verifyEmailOTP,
    stopEmailNotifications,
    getEmailNotificationStatus,
    updateNotificationTime,
} from '../api';
import SessionSidebar from '../components/workspace/SessionSidebar';
import ChatWindow from '../components/chat/ChatWindow';
import RadiantPromptInput from '../components/chat/RadiantPromptInput';
import WeeklyReviewModal from '../components/workspace/WeeklyReviewModal';
import SessionCompleteModal from '../components/workspace/SessionCompleteModal';
import JourneyPage from './JourneyPage';
import EmotionOrb from '../components/workspace/EmotionOrb';
import LockedWeeksPanel from '../components/workspace/LockedWeeksPanel';
import PillNav from '../components/PillNav';
import type { PillNavItem } from '../components/PillNav';



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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

    // Auto-collapse sidebar on mobile
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            setIsSidebarCollapsed(true);
        }
    }, []);
    const [view, setView] = useState<'chat' | 'journey'>('chat');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [isSessionCompleted, setIsSessionCompleted] = useState(false);
    const [sessionFocus, setSessionFocus] = useState<string>('');
    const [todayEmotion, setTodayEmotion] = useState<TodayEmotionResult['entry'] | null>(null);

    // Derived: whether we're in the cinematic empty state
    const isEmptyState = messages.length === 0 && !isLoading;

    // Mic locked state — check localStorage for today's recording
    // Use getLocalISODate (YYYY-MM-DD in local TZ) to match the client_date sent to backend
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

    // Email Notification states
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailModalStep, setEmailModalStep] = useState<'email' | 'otp' | 'time' | 'subscribed'>('email');
    const [notifEmail, setNotifEmail] = useState('');
    const [notifOtp, setNotifOtp] = useState('');
    const [notifPreferredTime, setNotifPreferredTime] = useState('08:00');
    const [notifLoading, setNotifLoading] = useState(false);
    const [notifMessage, setNotifMessage] = useState('');
    const [notifError, setNotifError] = useState('');
    const [isNotifEnabled, setIsNotifEnabled] = useState(false);
    const [subscribedEmail, setSubscribedEmail] = useState<string | null>(null);
    const [subscribedTime, setSubscribedTime] = useState<string>('08:00');
    // Timezone — auto-detected from user's browser
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    const tzOffset = (() => {
        try {
            const s = new Intl.DateTimeFormat('en', { timeZoneName: 'short', timeZone: userTimezone }).formatToParts(new Date());
            return s.find(p => p.type === 'timeZoneName')?.value || userTimezone;
        } catch { return userTimezone; }
    })();
    const [notifTimezone, setNotifTimezone] = useState(userTimezone);

    // Auth validation — check both token AND user_id
    useEffect(() => {
        const token = localStorage.getItem('access_token');
        if (!userId || !token) {
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
                .catch(() => { });
            // Load email notification status
            getEmailNotificationStatus(userId)
                .then(res => {
                    setIsNotifEnabled(res.enabled);
                    setSubscribedEmail(res.notification_email);
                    if (res.preferred_time) {
                        setSubscribedTime(res.preferred_time);
                        setNotifPreferredTime(res.preferred_time);
                    }
                    if (res.preferred_timezone) {
                        setNotifTimezone(res.preferred_timezone);
                    }
                    if (res.enabled) setEmailModalStep('subscribed');
                })
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
                setPlanHistory(data.plan_history || []);
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
                        // Use location.href instead of window.open to prevent popup blockers
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

    // ── Email Notification Handlers ──
    const handleOpenEmailModal = () => {
        setNotifError('');
        setNotifMessage('');
        setNotifOtp('');
        if (isNotifEnabled) {
            setEmailModalStep('subscribed');
        } else {
            setEmailModalStep('email');
            setNotifEmail('');
        }
        setShowEmailModal(true);
    };

    const handleSendOTP = async () => {
        if (!userId || !notifEmail.trim()) return;
        setNotifLoading(true);
        setNotifError('');
        setNotifMessage('');
        try {
            await sendEmailOTP(userId, notifEmail.trim());
            setNotifMessage('OTP bhej diya! Apna inbox check karein.');
            setEmailModalStep('otp');
        } catch (err: any) {
            setNotifError(err.message || 'OTP bhejne me error aaya.');
        } finally {
            setNotifLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!userId || !notifOtp.trim()) return;
        setNotifLoading(true);
        setNotifError('');
        try {
            await verifyEmailOTP(userId, notifEmail.trim(), notifOtp.trim(), activeSessionId, notifPreferredTime, notifTimezone);
            setSubscribedEmail(notifEmail.trim());
            setIsNotifEnabled(true);
            // Go to time picker step
            setEmailModalStep('time');
        } catch (err: any) {
            setNotifError(err.message || 'OTP is incorrect. Please check your email.');
        } finally {
            setNotifLoading(false);
        }
    };

    const handleSaveTime = async () => {
        if (!userId) return;
        setNotifLoading(true);
        setNotifError('');
        try {
            await updateNotificationTime(userId, notifPreferredTime, notifTimezone);
            setSubscribedTime(notifPreferredTime);
            setNotifMessage(`Daily alerts set for ${notifPreferredTime} ${tzOffset} every day!`);
            setEmailModalStep('subscribed');
        } catch (err: any) {
            setNotifError(err.message || 'Failed to save time. Please try again.');
        } finally {
            setNotifLoading(false);
        }
    };

    const handleStopEmailNotifications = async () => {
        if (!userId) return;
        setNotifLoading(true);
        setNotifError('');
        try {
            await stopEmailNotifications(userId);
            setIsNotifEnabled(false);
            setSubscribedEmail(null);
            setEmailModalStep('email');
            setNotifEmail('');
            setNotifMessage('');
            setTimeout(() => setShowEmailModal(false), 800);
        } catch (err: any) {
            setNotifError(err.message || 'Notifications stop nahi hui. Try again.');
        } finally {
            setNotifLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            height: '100dvh',
            width: '100vw',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
        }}>
            {/* Sidebar Overlay Backdrop for Mobile */}
            {!isSidebarCollapsed && (
                <div
                    className="drawer-backdrop show-on-mobile"
                    onClick={() => setIsSidebarCollapsed(true)}
                />
            )}

            {/* Sidebar */}
            <div className={`sidebar-root ${!isSidebarCollapsed ? 'expanded' : 'collapsed'}`}>
                <SessionSidebar
                    userId={userId || ''}
                    activeSessionId={activeSessionId}
                    onSelectSession={(id) => { handleSelectSession(id); setView('chat'); setIsSidebarCollapsed(true); }}
                    onNewChat={() => { handleNewChat(); setView('chat'); setIsSidebarCollapsed(true); }}
                    onJourney={() => { setView('journey'); setIsSidebarCollapsed(true); }}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    refreshKey={sidebarRefreshKey}
                    isPlanActive={isPlanApproved}
                />
            </div>

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
                            // Lock mic for the rest of today in the parent scope too
                            setMicLocked(true);
                            // Persist to localStorage so mic stays locked after page refresh
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

                {/* Normal chat view */}
                {view === 'chat' && (<>

                    {/* Clean Swiss background — no gradient orbs */}

                    {/* Emotion Orb — floats on right edge of chat after today's journal */}
                    <AnimatePresence>
                        {todayEmotion && (
                            <EmotionOrb
                                emotion={todayEmotion}
                                onClick={() => setView('journey')}
                            />
                        )}
                    </AnimatePresence>

                    {/* Header — Swiss minimal */}
                    <div className="mobile-header" style={{
                        minHeight: '56px',
                        height: 'auto',
                        padding: 'calc(env(safe-area-inset-top, 0px) + 8px) 20px 8px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexShrink: 0,
                        zIndex: 15,
                        position: 'relative',
                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                        borderBottom: '1px solid var(--border-subtle)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className={isSidebarCollapsed ? '' : 'hide-on-mobile'}
                                onClick={() => setIsSidebarCollapsed(false)}
                                style={{
                                    width: '32px', height: '32px', borderRadius: '8px',
                                    border: 'none', background: 'transparent',
                                    color: 'var(--text-secondary)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'color 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <PanelLeft size={18} />
                            </button>
                            {/* Mobile: Weeks button */}
                            {isPlanApproved && activeSessionId && (
                                <button
                                    id="mobile-weeks-btn"
                                    className="show-on-mobile"
                                    onClick={() => window.dispatchEvent(new CustomEvent('toggle-mobile-weeks'))}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '6px 12px', borderRadius: '20px',
                                        border: '1px solid var(--border-medium)',
                                        background: 'var(--bg-surface)',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer', flexShrink: 0,
                                        fontSize: '11px', fontWeight: 700,
                                        letterSpacing: '0.05em',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                    }}
                                    title="View Weeks"
                                >
                                    <Clock size={13} />
                                    WEEKS
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {/* PillNav strip for header buttons — desktop only */}
                            <div className="hide-on-mobile">
                            {isPlanApproved && (() => {
                                const items: PillNavItem[] = [
                                    { label: 'Calendar', onClick: () => setShowCalendarModal(true) },
                                    { label: 'Alerts', onClick: handleOpenEmailModal },
                                ];
                                return (
                                    <PillNav
                                        items={items}
                                        activeLabel={isNotifEnabled ? 'Alerts' : undefined}
                                        baseColor="var(--text-primary)"
                                        pillColor="var(--bg-primary)"
                                        pillTextColor="var(--text-primary)"
                                        hoveredTextColor="var(--text-inverse)"
                                        fontFamily="'Satoshi', 'Inter', sans-serif"
                                        ease="power3.out"
                                    />
                                );
                            })()}
                            </div>

                            {/* Mobile: Alerts bell button */}
                            {isPlanApproved && (
                                <button
                                    className="show-on-mobile"
                                    onClick={handleOpenEmailModal}
                                    style={{
                                        width: '32px', height: '32px', borderRadius: '8px',
                                        border: '1px solid var(--border-medium)',
                                        background: isNotifEnabled ? 'var(--accent-primary)' : 'transparent',
                                        color: isNotifEnabled ? '#fff' : 'var(--text-secondary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}
                                    title="Daily Alerts"
                                >
                                    <Bell size={15} />
                                </button>
                            )}

                            <button className="upgrade-btn hide-on-mobile">
                                Upgrade
                            </button>

                            {isPlanApproved && !isSessionCompleted && activeSessionId && (
                                <button
                                    onClick={() => setShowCompleteModal(true)}
                                    title="Stop plan"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '7px',
                                        padding: '5px 14px', borderRadius: '100px',
                                        border: '1px solid rgba(239,68,68,0.25)',
                                        background: 'transparent',
                                        color: '#ef4444', fontSize: '11px',
                                        fontWeight: 700, cursor: 'pointer',
                                        transition: 'all 0.15s',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        width: '6px', height: '6px', borderRadius: '50%',
                                        background: '#ef4444',
                                        animation: 'pulse 1.5s ease-in-out infinite',
                                    }} />
                                    Running
                                </button>
                            )}

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
                                    padding: '24px 20px 0',
                                    position: 'relative',
                                    zIndex: 5,
                                    gap: '0px',
                                }}
                            >
                                {/* Hero Text — Swiss Echo */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ textAlign: 'center', marginBottom: '36px' }}
                                >
                                    {/* Logo + Name row */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        gap: '14px', marginBottom: '22px'
                                    }}>
                                        <div style={{
                                            width: '38px', height: '38px',
                                            background: 'var(--accent-primary)', borderRadius: '8px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            overflow: 'hidden', flexShrink: 0,
                                        }}>
                                            <img
                                                src="/logo_2_backup.png"
                                                alt="Feelivate"
                                                style={{ width: '26px', height: '26px', objectFit: 'contain', filter: 'var(--logo-filter)' }}
                                            />
                                        </div>
                                        <h1 style={{
                                            fontSize: '28px', fontWeight: 700,
                                            letterSpacing: '0.08em', color: 'var(--text-primary)', margin: 0,
                                            fontFamily: "'Clash Display', 'Inter', sans-serif",
                                            textTransform: 'uppercase',
                                        }}>
                                            Feelivate
                                        </h1>
                                    </div>

                                    <h2 style={{
                                        fontSize: '26px', fontWeight: 500,
                                        color: 'var(--text-secondary)',
                                        letterSpacing: '-0.01em',
                                        margin: 0,
                                        lineHeight: 1.3,
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
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
                                    padding: '0 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
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
                </>)} {/* end view === 'chat' */}
            </div>

            {/* ── Email Notification Modal ── */}
            <AnimatePresence>
                {showEmailModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'var(--modal-overlay)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 300, padding: '20px',
                        }}
                        onClick={(e) => { if (e.target === e.currentTarget) setShowEmailModal(false); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            style={{
                                width: '100%', maxWidth: '400px',
                                background: 'var(--modal-bg)',
                                border: '1px solid var(--modal-border)',
                                borderRadius: '20px', padding: '28px',
                                boxShadow: 'var(--shadow-lg)',
                                position: 'relative',
                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                            }}
                        >
                            {/* Close button */}
                            <button
                                onClick={() => setShowEmailModal(false)}
                                style={{
                                    position: 'absolute', top: '16px', right: '16px',
                                    width: '28px', height: '28px', borderRadius: '8px',
                                    border: 'none', background: 'var(--glass-hover)',
                                    color: 'var(--text-muted)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--btn-hover-bg)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'var(--glass-hover)'; }}
                            ><X size={14} /></button>

                            {/* Step: Email Input */}
                            {emailModalStep === 'email' && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                        <div style={{
                                            width: '38px', height: '38px', borderRadius: '10px',
                                            background: 'var(--btn-primary-bg)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}><Bell size={18} color="var(--btn-primary-text)" /></div>
                                        <div>
                                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Daily Task Alerts</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Get your daily tasks straight to your inbox</p>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                                        Enter your email to receive a <strong style={{ color: 'var(--text-primary)' }}>personalized daily task</strong> from
                                        Monday to Sunday, along with an AI-written motivation message made just for you.
                                    </p>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 700, color: '#b6b5b5', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
                                            Email Address
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#b6b5b5' }} />
                                            <input
                                                type="email"
                                                value={notifEmail}
                                                onChange={(e) => setNotifEmail(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                                                placeholder="you@example.com"
                                                style={{
                                                    width: '100%', padding: '11px 12px 11px 36px',
                                                    borderRadius: '10px', boxSizing: 'border-box',
                                                    border: '1px solid var(--border-medium)',
                                                    background: 'var(--input-bg)',
                                                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                                    transition: 'border-color 0.2s',
                                                    fontFamily: "'Satoshi', 'Inter', sans-serif",
                                                }}
                                                onFocus={(e) => { e.target.style.borderColor = 'var(--border-focus)'; }}
                                                onBlur={(e) => { e.target.style.borderColor = 'var(--border-medium)'; }}
                                            />
                                        </div>
                                    </div>

                                    {notifError && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>
                                            <AlertCircle size={13} /><span>{notifError}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSendOTP}
                                        disabled={notifLoading || !notifEmail.trim()}
                                        style={{
                                            width: '100%', padding: '12px',
                                            borderRadius: '100px', border: 'none',
                                            background: notifLoading || !notifEmail.trim()
                                                ? 'var(--btn-disabled-bg)'
                                                : 'var(--btn-primary-bg)',
                                            color: 'var(--btn-primary-text)', fontSize: '12px', fontWeight: 700,
                                            cursor: notifLoading || !notifEmail.trim() ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            transition: 'all 0.15s',
                                            fontFamily: "'Satoshi', 'Inter', sans-serif",
                                            letterSpacing: '0.06em', textTransform: 'uppercase',
                                        }}
                                    >
                                        {notifLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Mail size={15} />}
                                        {notifLoading ? 'Sending...' : 'Send Verification Code'}
                                    </button>
                                </>
                            )}

                            {/* Step: OTP Input */}
                            {emailModalStep === 'otp' && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                        <div style={{
                                            width: '38px', height: '38px', borderRadius: '10px',
                                            background: 'var(--btn-primary-bg)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}><Mail size={18} color="var(--btn-primary-text)" /></div>
                                        <div>
                                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Verify Your Code</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{notifEmail}</p>
                                        </div>
                                    </div>

                                    {notifMessage && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'var(--glass-hover)', color: 'var(--text-primary)', fontSize: '12px', marginBottom: '14px' }}>
                                            <Sparkles size={13} /><span>{notifMessage}</span>
                                        </div>
                                    )}

                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                                        We've sent a 6-digit code to <strong style={{ color: 'var(--text-primary)' }}>{notifEmail}</strong>.
                                        Enter it below to activate your daily alerts.
                                    </p>

                                    <div style={{ marginBottom: '16px' }}>
                                        <input
                                            type="text"
                                            value={notifOtp}
                                            onChange={(e) => setNotifOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleVerifyOTP()}
                                            placeholder="_ _ _ _ _ _"
                                            maxLength={6}
                                            style={{
                                                width: '100%', padding: '14px 16px', boxSizing: 'border-box',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-medium)',
                                                background: 'var(--input-bg)',
                                                color: 'var(--text-primary)', fontSize: '28px', fontWeight: 700,
                                                outline: 'none', textAlign: 'center',
                                                letterSpacing: '12px',
                                                fontFamily: "'Courier New', monospace",
                                            }}
                                            onFocus={(e) => { e.target.style.borderColor = 'var(--border-focus)'; }}
                                            onBlur={(e) => { e.target.style.borderColor = 'var(--border-medium)'; }}
                                        />
                                    </div>

                                    {notifError && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>
                                            <AlertCircle size={13} /><span>{notifError}</span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button
                                            onClick={() => { setEmailModalStep('email'); setNotifError(''); setNotifMessage(''); }}
                                            style={{
                                                flex: 1, padding: '11px', borderRadius: '100px',
                                                border: '1px solid var(--border-medium)', background: 'transparent',
                                                color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                                                letterSpacing: '0.04em', textTransform: 'uppercase',
                                            }}
                                        >← Back</button>
                                        <button
                                            onClick={handleVerifyOTP}
                                            disabled={notifLoading || notifOtp.length < 6}
                                            style={{
                                                flex: 2, padding: '11px', borderRadius: '100px', border: 'none',
                                                background: notifLoading || notifOtp.length < 6
                                                    ? 'var(--btn-disabled-bg)'
                                                    : 'var(--btn-primary-bg)',
                                                color: 'var(--btn-primary-text)', fontSize: '12px', fontWeight: 700,
                                                cursor: notifLoading || notifOtp.length < 6 ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                                                letterSpacing: '0.04em', textTransform: 'uppercase',
                                            }}
                                        >
                                            {notifLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={14} />}
                                            {notifLoading ? 'Verifying...' : 'Verify & Subscribe'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {/* Step: Time Picker */}
                            {emailModalStep === 'time' && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                                        <div style={{
                                            width: '38px', height: '38px', borderRadius: '10px',
                                            background: 'var(--btn-primary-bg)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}><Clock size={18} color="var(--btn-primary-text)" /></div>
                                        <div>
                                            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Choose Your Alert Time</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>When should we send your daily task? (IST)</p>
                                        </div>
                                    </div>

                                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '20px' }}>
                                        Every day at this time, you'll receive your <strong style={{ color: 'var(--text-primary)' }}>personalized task</strong> for the day —
                                        with an AI-written guide and a motivational thought made just for you.
                                    </p>

                                    {/* Popular times quick select */}
                                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px', fontWeight: 700, fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Quick select</p>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                        {['06:00', '07:00', '08:00', '09:00', '20:00', '21:00'].map(t => (
                                            <button key={t} onClick={() => setNotifPreferredTime(t)} style={{
                                                padding: '6px 14px', borderRadius: '100px', fontSize: '12px', fontWeight: 600,
                                                border: notifPreferredTime === t ? '1px solid var(--accent-primary)' : '1px solid var(--border-medium)',
                                                background: notifPreferredTime === t ? 'var(--btn-primary-bg)' : 'transparent',
                                                color: notifPreferredTime === t ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                                            }}>{t}</button>
                                        ))}
                                    </div>

                                    {/* Custom time input */}
                                    <div style={{ marginBottom: '20px' }}>
                                        <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
                                            Or set a custom time
                                        </label>
                                        <input
                                            type="time"
                                            value={notifPreferredTime}
                                            onChange={(e) => setNotifPreferredTime(e.target.value)}
                                            style={{
                                                width: '100%', padding: '11px 14px', boxSizing: 'border-box',
                                                borderRadius: '10px', border: '1px solid var(--border-medium)',
                                                background: 'var(--input-bg)', color: 'var(--text-primary)',
                                                fontSize: '20px', fontWeight: 700, outline: 'none',
                                                fontFamily: "'Satoshi', 'Inter', sans-serif", textAlign: 'center',
                                                cursor: 'pointer',
                                            }}
                                            onFocus={(e) => { e.target.style.borderColor = 'var(--border-focus)'; }}
                                            onBlur={(e) => { e.target.style.borderColor = 'var(--border-medium)'; }}
                                        />
                                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0', textAlign: 'center' }}>
                                            {userTimezone} &nbsp;·&nbsp; {tzOffset}
                                        </p>
                                    </div>

                                    {notifError && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '12px', marginBottom: '14px' }}>
                                            <AlertCircle size={13} /><span>{notifError}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleSaveTime}
                                        disabled={notifLoading}
                                        style={{
                                            width: '100%', padding: '13px', borderRadius: '100px', border: 'none',
                                            background: notifLoading ? 'var(--btn-disabled-bg)' : 'var(--btn-primary-bg)',
                                            color: 'var(--btn-primary-text)', fontSize: '12px', fontWeight: 700,
                                            cursor: notifLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                            fontFamily: "'Satoshi', 'Inter', sans-serif",
                                            letterSpacing: '0.06em', textTransform: 'uppercase',
                                        }}
                                    >
                                        {notifLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Bell size={15} />}
                                        {notifLoading ? 'Activating...' : `Activate at ${notifPreferredTime} IST`}
                                    </button>
                                </>
                            )}

                            {/* Step: Subscribed */}
                            {emailModalStep === 'subscribed' && (
                                <>
                                    <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                                            style={{
                                                width: '56px', height: '56px', borderRadius: '14px',
                                                background: 'var(--btn-primary-bg)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                margin: '0 auto 14px',
                                            }}
                                        >
                                            <Bell size={24} color="var(--btn-primary-text)" />
                                        </motion.div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Daily Alerts Active!</h3>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Your daily emails are now scheduled</p>
                                    </div>

                                    {/* Email + time info */}
                                    <div style={{
                                        background: 'var(--glass-surface)', border: '1px solid var(--border-subtle)',
                                        borderRadius: '12px', padding: '14px 16px', marginBottom: '14px',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Subscribed Email</span>
                                        </div>
                                        <p style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 10px' }}>{subscribedEmail}</p>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, display: 'block', marginBottom: '2px', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>Daily at</span>
                                                <span style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{subscribedTime} IST</span>
                                            </div>
                                            <button onClick={() => { setEmailModalStep('time'); setNotifError(''); }} style={{
                                                padding: '6px 14px', borderRadius: '100px', fontSize: '11px', fontWeight: 700,
                                                border: '1px solid var(--border-medium)', background: 'transparent',
                                                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Satoshi', 'Inter', sans-serif",
                                                letterSpacing: '0.04em', textTransform: 'uppercase',
                                            }}>Change time</button>
                                        </div>
                                    </div>

                                    {/* What you get */}
                                    <div style={{
                                        background: 'var(--glass-surface)', borderRadius: '10px',
                                        padding: '12px 14px', marginBottom: '16px',
                                    }}>
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>What you'll receive each day</p>
                                        {[
                                            'Your specific task for the day',
                                            'AI-written personalized guidance',
                                            'A motivational thought crafted just for you',
                                        ].map(t => (
                                            <p key={t} style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0' }}>• {t}</p>
                                        ))}
                                    </div>

                                    {notifMessage && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'var(--glass-hover)', color: 'var(--text-primary)', fontSize: '12px', marginBottom: '12px' }}>
                                            <Sparkles size={13} /><span>{notifMessage}</span>
                                        </div>
                                    )}
                                    {notifError && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: '12px', marginBottom: '12px' }}>
                                            <AlertCircle size={13} /><span>{notifError}</span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleStopEmailNotifications}
                                        disabled={notifLoading}
                                        style={{
                                            width: '100%', padding: '11px', borderRadius: '100px',
                                            border: '1px solid rgba(239,68,68,0.2)',
                                            background: 'transparent',
                                            color: '#ef4444', fontSize: '12px', fontWeight: 700, cursor: notifLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                            fontFamily: "'Satoshi', 'Inter', sans-serif", transition: 'all 0.15s',
                                            letterSpacing: '0.04em', textTransform: 'uppercase',
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {notifLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <BellOff size={14} />}
                                        {notifLoading ? 'Unsubscribing...' : 'Stop Notifications'}
                                    </button>
                                </>
                            )}

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Calendar Sync Modal */}
            <AnimatePresence>
                {showCalendarModal && (
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'var(--modal-overlay)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 200,
                    }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            style={{
                                width: '100%', maxWidth: '380px',
                                background: 'var(--modal-bg)',
                                border: '1px solid var(--modal-border)',
                                borderRadius: '20px', padding: '24px',
                                boxShadow: 'var(--shadow-lg)',
                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                            }}
                        >
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
                                Sync Weekly Roadmap
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                                Connect Feelivate to your Google Calendar. We will automatically sync your week's schedule to notify you each day.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
                                    Notification Time
                                </label>
                                <input
                                    type="time"
                                    value={preferredTime}
                                    onChange={(e) => setPreferredTime(e.target.value)}
                                    style={{
                                        width: '100%', padding: '10px 12px', borderRadius: '10px',
                                        border: '1px solid var(--border-medium)', background: 'var(--input-bg)',
                                        color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                    }}
                                />
                            </div>

                            {syncMessage && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'var(--glass-hover)', color: 'var(--text-primary)',
                                    fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center'
                                }}>
                                    <Sparkles size={14} />
                                    <span>{syncMessage}</span>
                                </div>
                            )}

                            {syncError && (
                                <div style={{
                                    padding: '10px 12px', borderRadius: '8px',
                                    background: 'rgba(239, 68, 68, 0.06)', color: '#ef4444',
                                    fontSize: '12px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center'
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
                                        padding: '8px 16px', borderRadius: '100px',
                                        border: '1px solid rgba(239, 68, 68, 0.2)', background: 'transparent',
                                        color: '#ef4444', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                >
                                    Stop Sync
                                </button>
                                <div style={{ flex: 1 }} />
                                <button
                                    onClick={() => setShowCalendarModal(false)}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '8px 16px', borderRadius: '100px',
                                        border: '1px solid var(--border-medium)', background: 'transparent',
                                        color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSyncCalendar}
                                    disabled={syncLoading}
                                    style={{
                                        padding: '8px 16px', borderRadius: '100px',
                                        border: 'none', background: 'var(--btn-primary-bg)',
                                        color: 'var(--btn-primary-text)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
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
