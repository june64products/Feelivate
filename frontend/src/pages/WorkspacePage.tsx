import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Sparkles, Bell, BellOff, CheckCircle, Mail, Loader2, X, Clock, ShieldAlert } from 'lucide-react';
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
import type { BlockedNotice, SetupQuestion } from '../api';
import SetupQuestionsModal from '../components/chat/SetupQuestionsModal';
import MissionTopBar from '../components/mission/MissionTopBar';
import TodayCard from '../components/mission/TodayCard';
import PathRow from '../components/mission/PathRow';
import RecoveryCard from '../components/mission/RecoveryCard';
import MentorDrawer, { MENTOR_MORPH_ID } from '../components/mission/MentorDrawer';
import GoalStart from '../components/mission/GoalStart';
import { CommitStage, CeremonyOverlay } from '../components/mission/CommitStage';
import { useStreak } from '../hooks/useStreak';
import { StreakStrip } from '../components/mission/StreakShowcase';
import { satoshi as missionSatoshi, clashDisplay as missionClash, planEntryFor, isRestAction, isoDaysAgo, planWeekOver } from '../components/mission/missionTheme';
import { Mic, MessageCircle, ChevronRight } from 'lucide-react';
import WeeklyReviewModal from '../components/workspace/WeeklyReviewModal';
import SessionCompleteModal from '../components/workspace/SessionCompleteModal';
import JourneyPage from './JourneyPage';
import EmotionOrb from '../components/workspace/EmotionOrb';
import LockedWeeksPanel from '../components/workspace/LockedWeeksPanel';
import ConsentGate, { type ConsentStatus } from '../components/legal/ConsentGate';
import GuidedDemo, { type DemoHandles } from '../components/demo/GuidedDemo';
import { DEMO_PLAN, DEMO_EMOTION } from '../components/demo/demoScript';
import { isDemoQueued, startDemo, completeDemo } from '../lib/onboarding';



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
    // Setter-only now: the demo handles still drive it, but no sidebar reads it.
    const [, setIsSidebarCollapsed] = useState(false);
    const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
    // ── Mission layout state (declared early — derived values below read these) ──
    const [mentorOpen, setMentorOpen] = useState(false);
    const [showCeremony, setShowCeremony] = useState(false);
    const [commitmentWhy, setCommitmentWhy] = useState<string | null>(null);

    // Auto-collapse sidebar on mobile
    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            setIsSidebarCollapsed(true);
        }
    }, []);

    // Cross-tab isolation: detect when another tab changes user_id (different user logged in)
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'user_id') {
                // Another tab changed the user — force this tab to re-validate
                const newUserId = e.newValue;
                if (newUserId !== userId) {
                    // Different user logged in from another tab — force logout in this tab
                    localStorage.removeItem('active_session_id');
                    navigate('/login');
                }
            }
            if (e.key === 'access_token' && !e.newValue) {
                // Token was cleared in another tab (logout) — redirect this tab too
                navigate('/login');
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, [userId, navigate]);
    const [view, setView] = useState<'chat' | 'journey'>('chat');
    // Which Journey tab to open on (the header "Archive" button opens straight to Archive)
    const [journeyInitialTab, setJourneyInitialTab] = useState<'overview' | 'archive'>('overview');
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [isSessionCompleted, setIsSessionCompleted] = useState(false);
    const [sessionFocus, setSessionFocus] = useState<string>('');
    const [todayEmotion, setTodayEmotion] = useState<TodayEmotionResult['entry'] | null>(null);

    // ── Guided demo: self-playing walkthrough mirror state ──
    // When demoMode is on, the UI reads these mirrors instead of the real state,
    // so nothing the demo shows ever touches the backend or the user's real data.
    const [demoMode, setDemoMode] = useState(false);
    const [demoMessages, setDemoMessages] = useState<any[]>([]);
    const [demoLoading, setDemoLoading] = useState(false);
    const [demoPlanApproved, setDemoPlanApproved] = useState(false);
    const [demoView, setDemoView] = useState<'chat' | 'journey'>('chat');
    const [demoEmotion, setDemoEmotion] = useState<any | null>(null);
    const [demoSelectedWeek, setDemoSelectedWeek] = useState<number | null>(null);
    const [demoJourneyTab, setDemoJourneyTab] = useState<'overview' | 'archive'>('overview');

    const uiMessages = demoMode ? demoMessages : messages;
    const uiLoading = demoMode ? demoLoading : isLoading;
    const uiIsPlanApproved = demoMode ? demoPlanApproved : isPlanApproved;
    const uiView = demoMode ? demoView : view;
    const uiTodayEmotion = demoMode ? demoEmotion : todayEmotion;
    const uiActivePlan = demoMode ? DEMO_PLAN : activePlan;
    const uiSessionId = demoMode ? 'demo-session' : activeSessionId;

    // Derived: whether we're in the cinematic empty state
    const isEmptyState = uiMessages.length === 0 && !uiLoading;

    // ── Streak data (the old StreakBar's logic, shared across the layout) ──
    const {
        streak, todayStatus, checkinLoading, justCelebrated, checkin, today: todayIso,
    } = useStreak(userId, isPlanApproved && !demoMode, demoMode);

    // Recovery: shows ONLY when yesterday was a real scheduled plan day that
    // was missed (or shielded) and today is still unlogged. A freshly locked
    // plan can never trigger it — yesterday wasn't a plan day yet. Rest days
    // never count as misses either.
    const recoveryInfo = (() => {
        if (demoMode || !isPlanApproved || todayStatus !== 'pending') return null;
        if (!streak?.days_this_week?.length || !activePlan) return null;
        const planStart = String(activePlan?.start_date || '');
        if (!planStart) return null; // can't prove yesterday was in-plan — stay quiet

        const missedOn = (iso: string): 'missed' | 'shielded' | null => {
            if (iso < planStart) return null;          // before the week began
            const entry = planEntryFor(activePlan, iso);
            if (!entry || isRestAction(entry.action)) return null;  // not a scheduled work day
            const row = streak.days_this_week.find(d => d.date === iso);
            if (!row) return null;
            if (row.status === 'shielded') return 'shielded';
            if (row.status === 'skipped' || row.status === 'pending') return 'missed';
            return null;                                // done — chain intact
        };

        const yIso = isoDaysAgo(todayIso, 1);
        const yState = missedOn(yIso);
        if (!yState) return null;

        // Count consecutive scheduled misses walking back from yesterday
        // (shielded still counts as a slipped day; rest days are skipped over).
        let missCount = 0;
        for (let back = 1; back <= 7; back++) {
            const iso = isoDaysAgo(todayIso, back);
            if (iso < planStart) break;
            const entry = planEntryFor(activePlan, iso);
            if (!entry || isRestAction(entry.action)) continue;  // rest day — look further back
            const st = missedOn(iso);
            if (st) missCount += 1;
            else break;                                  // hit a done day — run ends
        }

        return { wasShielded: yState === 'shielded', missCount: Math.max(1, missCount), missedDateIso: yIso };
    })();

    // The locked week's window has fully ended (e.g. it's Monday after a
    // Thu–Sun Week 0). Today has nothing to show from that plan — the honest
    // state is "wrapped": read the report, commit the next week.
    const weekOver = !demoMode && isPlanApproved && planWeekOver(activePlan, todayIso);

    // Which mission stage fills the screen (demo mirrors respected).
    // Demo drawer rule: open while the scripted conversation is being built,
    // closed once the scene locks the plan — the Today surface takes the stage.
    const uiMentorOpen = demoMode
        ? (demoView === 'chat' && demoMessages.length > 0 && !demoPlanApproved)
        : mentorOpen;
    const isPlanningStage = !uiIsPlanApproved && !!uiActivePlan && !isEmptyState;

    // Mic locked state — check localStorage for today's recording (PER SESSION, so a
    // recording in one session doesn't lock the mic in another fresh session).
    // Use getLocalISODate (YYYY-MM-DD in local TZ) to match the client_date sent to backend
    const [micLocked, setMicLocked] = useState<boolean>(() => {
        const uid = localStorage.getItem('user_id');
        const key = `last_journal_date_${uid}_${activeSessionId ?? 'none'}`;
        return localStorage.getItem(key) === getLocalISODate();
    });

    // Refresh micLocked on mount / session switch
    useEffect(() => {
        const uid = localStorage.getItem('user_id');
        if (uid) {
            const key = `last_journal_date_${uid}_${activeSessionId ?? 'none'}`;
            setMicLocked(localStorage.getItem(key) === getLocalISODate());
        }
    }, [activeSessionId, userId]);

    // Calendar sync states
    const [showCalendarModal, setShowCalendarModal] = useState(false);
    const [showCalendarMaintenance, setShowCalendarMaintenance] = useState(false);
    // "Upgrade" in the header opens a reassurance popup, not a checkout — there is
    // no paid tier yet, every account already runs the full-feature build.
    const [showPlanInfo, setShowPlanInfo] = useState(false);
    // Set when the backend refuses a request outright (see app/guardrail.py).
    const [blockedNotice, setBlockedNotice] = useState<BlockedNotice | null>(null);
    // Discovery questions for a brand-new goal — rendered as a popup form
    // instead of a one-at-a-time chat interrogation.
    const [setupQuestions, setSetupQuestions] = useState<SetupQuestion[] | null>(null);
    // Reported by ConsentGate. The walkthrough waits until this is 'clear'.
    const [consentStatus, setConsentStatus] = useState<ConsentStatus>('checking');
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
                setCommitmentWhy(data.commitment_why || null);
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
        // The conversation lives in the drawer now — make sure it's visible
        // whenever a message goes out, from wherever it was sent.
        setMentorOpen(true);

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
                plan: res.plan,
                // Only present when the message triggered the crisis screen.
                safety: res.safety,
                // Only present when the request was refused before the model ran.
                blocked: res.blocked,
            };
            setMessages(prev => [...prev, assistantMsg]);

            // Raise it as a dialog too — the refusal has to be impossible to
            // miss, and a card in the thread can scroll past unread.
            if (res.blocked) setBlockedNotice(res.blocked);

            // New-goal discovery: the mentor sent its setup questions as one
            // form — open the popup instead of letting it interrogate in chat.
            if (res.questions && res.questions.length > 0 && !res.plan) {
                setSetupQuestions(res.questions);
            }

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
                // Commitment gets a ceremony, not a toast. Drawer closes so the
                // user lands on Today with the week sealed.
                setMentorOpen(false);
                setShowCeremony(true);
                setTimeout(() => setShowCeremony(false), 2300);
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

    // ── Guided demo control ──────────────────────────────────────────────────
    const resetDemoState = () => {
        setDemoMessages([]);
        setDemoLoading(false);
        setDemoPlanApproved(false);
        setDemoView('chat');
        setDemoEmotion(null);
        setDemoSelectedWeek(null);
        setDemoJourneyTab('overview');
    };

    // Called when the user Skips/Stops or the demo finishes its last step.
    // Turns demoMode off and clears every mirror, so the demo session vanishes
    // entirely and the user is back on their real, clean screen.
    const exitDemo = () => {
        completeDemo(userId);
        setDemoMode(false);
        resetDemoState();
        setIsSidebarCollapsed(typeof window !== 'undefined' && window.innerWidth <= 768);
    };

    // Imperative API the demo controller drives — all of it writes to mirror state only.
    const demoHandles: DemoHandles = useMemo(() => ({
        setMessages: (m) => setDemoMessages(m),
        setLastContent: (content) => setDemoMessages(prev =>
            prev.length ? [...prev.slice(0, -1), { ...prev[prev.length - 1], content }] : prev),
        setLoading: (v) => setDemoLoading(v),
        setPlanApproved: (v) => setDemoPlanApproved(v),
        setView: (v) => setDemoView(v),
        setEmotion: (v) => setDemoEmotion(v ? DEMO_EMOTION : null),
        setSidebar: (open) => setIsSidebarCollapsed(!open),
        setSelectedWeek: (w) => setDemoSelectedWeek(w),
        setJourneyTab: (t) => setDemoJourneyTab(t),
    }), []);

    // Auto-open the demo for newly signed-up users, and on "Replay tutorial".
    //
    // Gated on the consent gate being settled. A brand new account hits both at
    // once — consent is required before we may process anything, and the demo
    // wants to open the moment the workspace mounts — and the two were landing
    // on top of each other, with the tour explaining a screen the user could
    // not yet reach. Consent is the blocking one, so the tour waits its turn.
    useEffect(() => {
        if (consentStatus !== 'clear') return;
        if (isDemoQueued(userId)) setDemoMode(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, consentStatus]);

    // If the gate re-opens mid-tour (a stale policy version, say), stand down
    // without marking the tour done — it resumes once consent is settled.
    useEffect(() => {
        if (consentStatus === 'blocking') setDemoMode(false);
    }, [consentStatus]);

    useEffect(() => {
        const onReplay = () => {
            startDemo(userId);
            resetDemoState();
            setDemoMode(true);
        };
        window.addEventListener('feelivate-replay-tour', onReplay);
        return () => window.removeEventListener('feelivate-replay-tour', onReplay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    return (
        <>
        {/* Mounted here rather than in App so it can never cover /privacy or
            /terms — the pages the user has to be able to read in order to
            give informed consent in the first place. */}
        <ConsentGate onStatusChange={setConsentStatus} />
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100dvh',
            width: '100vw',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
        }}>
            {/* First-time self-playing guided demo (auto-opens for new accounts, or via Replay) */}
            <GuidedDemo active={demoMode} handles={demoHandles} onExit={exitDemo} />

            {/* Mission surface — no sidebar; the goal pill in the top bar
                carries session switching, and the mentor lives in a drawer. */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
            }}>
                {/* Journey view — full-panel replacement */}
                {uiView === 'journey' && userId && (
                    <JourneyPage
                        userId={userId}
                        sessionId={uiSessionId ?? undefined}
                        demoMode={demoMode}
                        demoTab={demoJourneyTab}
                        initialTab={journeyInitialTab}
                        onJournalSaved={(entry) => {
                            // Directly update the orb with the saved entry — no refetch needed
                            setTodayEmotion(entry);
                            // Lock mic for the rest of today in the parent scope too
                            setMicLocked(true);
                            // Persist to localStorage so mic stays locked after page refresh
                            const uid = localStorage.getItem('user_id');
                            if (uid) {
                                localStorage.setItem(`last_journal_date_${uid}_${activeSessionId ?? 'none'}`, getLocalISODate());
                            }
                        }}
                        onClose={() => { setView('chat'); setJourneyInitialTab('overview'); }}
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
                {uiView === 'chat' && (<>

                    {/* Clean Swiss background — no gradient orbs */}

                    {/* Emotion Orb — draggable anywhere on screen after today's journal */}
                    {uiTodayEmotion && (
                        <EmotionOrb
                            emotion={uiTodayEmotion}
                            onClick={() => setView('journey')}
                        />
                    )}

                    {/* Mission top bar — goal pill (sessions), streak cluster, utilities */}
                    <MissionTopBar
                        userId={userId}
                        activeSessionId={uiSessionId}
                        sessionFocus={sessionFocus}
                        currentWeek={uiActivePlan?.week_number ?? 0}
                        streak={streak}
                        isPlanActive={uiIsPlanApproved}
                        todayDone={todayStatus === 'done'}
                        todayIso={todayIso}
                        demoMode={demoMode}
                        refreshKey={sidebarRefreshKey}
                        onSelectSession={(id) => { handleSelectSession(id); }}
                        onNewGoal={handleNewChat}
                        onOpenArchive={() => { setJourneyInitialTab('archive'); setView('journey'); }}
                        onOpenAlerts={handleOpenEmailModal}
                        onOpenCalendar={() => setShowCalendarMaintenance(true)}
                        onOpenPlanInfo={() => setShowPlanInfo(true)}
                        onStopSession={() => setShowCompleteModal(true)}
                        onLogout={handleLogout}
                    />

                    {/* Locked Weeks Panel (Desktop: Fixed Right / Mobile: Relative under Header)
                        Also shown once a session is finished, and for any session
                        that has weeks behind it. It was gated on the plan being
                        currently active, so reopening an old session left no way
                        to get at its weeks at all — the panel is the only route
                        to the week drawer. */}
                    {uiSessionId && (uiIsPlanApproved || isSessionCompleted || planHistory.length > 0) && (
                        <LockedWeeksPanel
                            sessionId={uiSessionId}
                            currentWeek={uiActivePlan?.week_number ?? 1}
                            micLocked={micLocked}
                            activePlan={uiActivePlan}
                            planHistory={demoMode ? [] : planHistory}
                            demoMode={demoMode}
                            demoSelectedWeek={demoMode ? demoSelectedWeek : undefined}
                        />
                    )}

                    {/* ─── MISSION CONTENT ─── */}
                    {/* Approved plan wins over everything: a session mid-week must
                        land on Today even if its chat history is empty. */}
                    <div style={{ flex: 1, overflowY: 'auto', position: 'relative', zIndex: 5 }}>
                        {/* Plain conditional (no AnimatePresence): the stages swap
                            rapidly while a session loads, and mode="wait" was
                            dropping the entering stage's animation — leaving the
                            whole screen stuck at opacity 0. Entry animations on
                            each stage still play on mount. */}
                        <>
                            {isEmptyState && !uiIsPlanApproved ? (
                                /* No goal yet — one question, not a chat thread */
                                <GoalStart
                                    key="goal-start"
                                    onSubmit={handleSendMessage}
                                    disabled={isLoading || demoMode}
                                    demoMode={demoMode}
                                />
                            ) : isPlanningStage ? (
                                /* A draft week exists — center stage, commit or tweak */
                                <motion.div
                                    key="commit-stage"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{ padding: '18px 20px 60px' }}
                                >
                                    <CommitStage
                                        plan={uiActivePlan}
                                        isFirstPlan={!demoMode && planHistory.length === 0}
                                        onApprove={demoMode ? () => demoHandles.setPlanApproved(true) : handleApprovePlan}
                                        onRequestChange={demoMode ? () => { } : handleRequestPlanChange}
                                        onOpenMentor={() => setMentorOpen(true)}
                                    />
                                </motion.div>
                            ) : uiIsPlanApproved ? (
                                /* The daily loop — today's task, the path, the chips */
                                <motion.div
                                    key="today-stage"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{
                                        maxWidth: '820px', margin: '0 auto',
                                        padding: '14px 20px 60px', display: 'flex',
                                        flexDirection: 'column', gap: '14px',
                                    }}
                                >
                                    {!weekOver && recoveryInfo && (
                                        <RecoveryCard
                                            missCount={recoveryInfo.missCount}
                                            missedDateIso={recoveryInfo.missedDateIso}
                                            commitmentWhy={commitmentWhy}
                                            wasShielded={recoveryInfo.wasShielded}
                                            focus={sessionFocus}
                                            sessionId={uiSessionId}
                                        />
                                    )}
                                    <StreakStrip streak={streak} todayDone={todayStatus === 'done'} />
                                    {weekOver ? (
                                        /* The plan's window has ended — no misleading "rest day".
                                           Report first, then commit the next week. */
                                        <motion.div
                                            initial={{ opacity: 0, y: 22, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                                            style={{
                                                background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
                                                borderRadius: '22px', padding: '30px 28px',
                                                boxShadow: 'var(--shadow-sm)', textAlign: 'center',
                                            }}
                                        >
                                            <p style={{
                                                fontSize: '11px', fontWeight: 800, letterSpacing: '0.13em',
                                                textTransform: 'uppercase', color: 'var(--accent-primary)',
                                                margin: '0 0 10px', fontFamily: missionSatoshi,
                                            }}>
                                                Week {uiActivePlan?.week_number ?? 1} wrapped
                                            </p>
                                            <p style={{
                                                fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)',
                                                margin: '0 0 8px', fontFamily: missionClash, letterSpacing: '-0.01em',
                                            }}>
                                                That's a wrap on Week {uiActivePlan?.week_number ?? 1}.
                                            </p>
                                            <p style={{
                                                fontSize: '13.5px', color: 'var(--text-secondary)', margin: '0 auto 20px',
                                                fontFamily: missionSatoshi, lineHeight: 1.65, maxWidth: '440px',
                                            }}>
                                                This week's window has closed — your honest report is waiting in the Journey. Read it, then commit the next week. Fresh start, same fire.
                                            </p>
                                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <motion.button
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => setView('journey')}
                                                    style={{
                                                        padding: '13px 26px', borderRadius: '100px', border: 'none',
                                                        background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                                                        fontSize: '12.5px', fontWeight: 800, cursor: 'pointer',
                                                        fontFamily: missionSatoshi, letterSpacing: '0.05em', textTransform: 'uppercase',
                                                    }}
                                                >
                                                    See your week report
                                                </motion.button>
                                                <motion.button
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => handleSendMessage(
                                                        `I've reviewed my week report. Please build me Week ${(uiActivePlan?.week_number ?? 1) + 1} plan based on my performance data and what I need to improve.`
                                                    )}
                                                    style={{
                                                        padding: '13px 22px', borderRadius: '100px',
                                                        border: '1px solid var(--border-medium)', background: 'transparent',
                                                        color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 700,
                                                        cursor: 'pointer', fontFamily: missionSatoshi,
                                                    }}
                                                >
                                                    Plan Week {(uiActivePlan?.week_number ?? 1) + 1}
                                                </motion.button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <TodayCard
                                            activePlan={uiActivePlan}
                                            todayIso={todayIso}
                                            todayStatus={todayStatus}
                                            checkinLoading={checkinLoading}
                                            justCelebrated={justCelebrated}
                                            onCheckin={checkin}
                                            onAskMentor={() => setMentorOpen(true)}
                                            demoMode={demoMode}
                                        />
                                    )}
                                    <PathRow
                                        streak={streak}
                                        todayIso={todayIso}
                                        currentWeek={uiActivePlan?.week_number ?? 1}
                                        winCondition={uiActivePlan?.win_condition}
                                        onOpenJourney={() => setView('journey')}
                                    />
                                    {/* Journal + mentor entry points */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                        gap: '12px',
                                    }}>
                                        <motion.button
                                            data-tour="journey-nav"
                                            whileTap={{ scale: 0.98 }}
                                            whileHover={{ y: -2 }}
                                            onClick={() => setView('journey')}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '14px',
                                                padding: '16px 18px', borderRadius: '18px',
                                                border: '1px solid var(--border-subtle)',
                                                background: 'var(--card-bg)',
                                                cursor: 'pointer', textAlign: 'left', fontFamily: missionSatoshi,
                                                boxShadow: 'var(--shadow-sm)',
                                                transition: 'border-color 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                        >
                                            <span style={{
                                                width: '42px', height: '42px', borderRadius: '13px', flexShrink: 0,
                                                background: 'var(--btn-primary-bg)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Mic size={19} style={{ color: 'var(--btn-primary-text)' }} />
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    Evening voice note
                                                </span>
                                                <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {micLocked || uiTodayEmotion ? 'Logged for today' : 'How did today actually go? 60 seconds.'}
                                                </span>
                                            </span>
                                            {/* Waveform accent — alive until today is logged */}
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0, marginRight: '2px' }}>
                                                {[10, 17, 12, 20, 9].map((h, i) => (
                                                    <motion.span
                                                        key={i}
                                                        animate={(micLocked || uiTodayEmotion) ? { height: h * 0.6 } : { height: [h * 0.5, h, h * 0.5] }}
                                                        transition={(micLocked || uiTodayEmotion) ? {} : { duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.13 }}
                                                        style={{
                                                            width: '3px', borderRadius: '100px',
                                                            background: (micLocked || uiTodayEmotion) ? 'var(--border-medium)' : 'var(--accent-primary)',
                                                            height: h,
                                                        }}
                                                    />
                                                ))}
                                            </span>
                                            <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </motion.button>
                                        <motion.button
                                            data-tour="mentor-chip"
                                            layoutId={uiMentorOpen ? undefined : MENTOR_MORPH_ID}
                                            whileTap={{ scale: 0.98 }}
                                            whileHover={{ y: -2 }}
                                            onClick={() => setMentorOpen(true)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: '14px',
                                                padding: '16px 18px', borderRadius: '18px',
                                                border: '1px solid var(--border-subtle)',
                                                background: 'var(--card-bg)',
                                                cursor: 'pointer', textAlign: 'left', fontFamily: missionSatoshi,
                                                boxShadow: 'var(--shadow-sm)',
                                                transition: 'border-color 0.15s',
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                                        >
                                            <span style={{
                                                width: '42px', height: '42px', borderRadius: '13px', flexShrink: 0,
                                                background: 'var(--glass-hover)',
                                                border: '1px solid var(--border-medium)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <MessageCircle size={19} style={{ color: 'var(--accent-primary)' }} />
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    Ask your mentor
                                                </span>
                                                <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    Stuck on today's task? Talk it out.
                                                </span>
                                            </span>
                                            <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                        </motion.button>
                                    </div>
                                </motion.div>
                            ) : (
                                /* Discovery — the mentor is asking / building; keep the
                                   stage calm, the conversation lives in the drawer */
                                <motion.div
                                    key="discovery-stage"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{
                                        flex: 1, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center',
                                        minHeight: '60vh', gap: '14px', padding: '20px',
                                    }}
                                >
                                    <motion.div
                                        animate={{ scale: [1, 1.06, 1], opacity: [0.85, 1, 0.85] }}
                                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                                        style={{
                                            width: '54px', height: '54px', borderRadius: '16px',
                                            background: 'var(--accent-primary)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                        }}
                                    >
                                        <img src="/logo_2_backup.png" alt="" style={{ width: '32px', height: '32px', objectFit: 'contain', filter: 'var(--logo-filter)' }} />
                                    </motion.div>
                                    <p style={{
                                        fontSize: '15px', color: 'var(--text-secondary)', margin: 0,
                                        fontFamily: missionSatoshi, textAlign: 'center', lineHeight: 1.6,
                                    }}>
                                        Your mentor is shaping the plan.
                                    </p>
                                    <button
                                        onClick={() => setMentorOpen(true)}
                                        style={{
                                            padding: '10px 20px', borderRadius: '100px',
                                            border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
                                            color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 700,
                                            cursor: 'pointer', fontFamily: missionSatoshi,
                                        }}
                                    >
                                        Open the conversation
                                    </button>
                                </motion.div>
                            )}
                        </>
                    </div>

                    {/* Mentor drawer — the chat, summonable from anywhere */}
                    <MentorDrawer
                        open={uiMentorOpen}
                        onClose={() => demoMode ? undefined : setMentorOpen(false)}
                        messages={uiMessages}
                        isLoading={uiLoading}
                        onSend={demoMode ? () => { } : handleSendMessage}
                        onApprovePlan={demoMode ? () => demoHandles.setPlanApproved(true) : handleApprovePlan}
                        onRequestPlanChange={demoMode ? () => { } : handleRequestPlanChange}
                        isPlanApproved={uiIsPlanApproved}
                        isFirstPlan={!demoMode && planHistory.length === 0}
                        demoMode={demoMode}
                        inputDisabled={isLoading || demoMode}
                    />

                    {/* Commitment ceremony seal */}
                    <CeremonyOverlay show={showCeremony} weekNumber={uiActivePlan?.week_number ?? 1} />
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

            {/* Calendar — under maintenance popup */}
            <AnimatePresence>
                {showCalendarMaintenance && (
                    <div style={{
                        position: 'fixed', inset: 0,
                        background: 'var(--modal-overlay)',
                        backdropFilter: 'blur(12px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, padding: '20px',
                    }}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                            style={{
                                width: '100%', maxWidth: '380px',
                                background: 'var(--modal-bg)',
                                border: '1px solid var(--modal-border)',
                                borderRadius: '20px', padding: '24px',
                                boxShadow: 'var(--shadow-lg)',
                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'var(--glass-surface)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
                            }}>
                                <Clock size={18} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', fontFamily: "'Clash Display', 'Inter', sans-serif" }}>
                                Calendar is under maintenance
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '20px' }}>
                                Calendar sync is temporarily unavailable. Use the app's daily alerts instead to get reminded each day — tap the Alerts button to set them up.
                            </p>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowCalendarMaintenance(false)}
                                    style={{
                                        padding: '8px 16px', borderRadius: '100px',
                                        border: '1px solid var(--border-medium)', background: 'transparent',
                                        color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                >
                                    Got it
                                </button>
                                <button
                                    onClick={() => { setShowCalendarMaintenance(false); handleOpenEmailModal(); }}
                                    style={{
                                        padding: '8px 16px', borderRadius: '100px',
                                        border: 'none', background: 'var(--btn-primary-bg)',
                                        color: 'var(--btn-primary-text)', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                >
                                    <Bell size={13} />
                                    Open Alerts
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* New-goal setup form — all discovery questions in one popup;
                answers go back as a single message and the plan builds
                immediately. Dismiss = answer in chat instead; skip = the
                mentor makes smart assumptions and drafts anyway. */}
            {setupQuestions && !demoMode && (
                <SetupQuestionsModal
                    questions={setupQuestions}
                    onSubmit={(text) => { setSetupQuestions(null); handleSendMessage(text); }}
                />
            )}

            {/* Request refused before the mentor ran (app/guardrail.py). Stated
                once, plainly, with no detail about which rule was hit — that
                detail is only useful to someone probing the boundary. */}
            <AnimatePresence>
                {blockedNotice && (
                    <div
                        onClick={() => setBlockedNotice(null)}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'var(--modal-overlay)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1200, padding: '20px',
                        }}
                    >
                        <motion.div
                            onClick={e => e.stopPropagation()}
                            role="alertdialog"
                            aria-label={blockedNotice.headline}
                            initial={{ scale: 0.95, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                            style={{
                                width: '100%', maxWidth: '400px',
                                background: 'var(--modal-bg)',
                                border: '1px solid var(--modal-border)',
                                borderRadius: '20px', padding: '26px',
                                boxShadow: 'var(--shadow-lg)',
                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                            }}
                        >
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '12px',
                                background: 'var(--glass-surface)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
                            }}>
                                <ShieldAlert size={18} style={{ color: 'var(--text-secondary)' }} />
                            </div>
                            <h3 style={{
                                fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
                                marginBottom: '8px', fontFamily: "'Clash Display', 'Inter', sans-serif",
                            }}>
                                {blockedNotice.headline}
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '22px' }}>
                                {blockedNotice.body}
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    autoFocus
                                    onClick={() => setBlockedNotice(null)}
                                    style={{
                                        padding: '9px 18px', borderRadius: '100px',
                                        border: 'none', background: 'var(--btn-primary-bg)',
                                        color: 'var(--btn-primary-text)', fontSize: '11px', fontWeight: 700,
                                        cursor: 'pointer',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                >
                                    Got it
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* "Upgrade" → you're already on the top plan */}
            <AnimatePresence>
                {showPlanInfo && (
                    <div
                        onClick={() => setShowPlanInfo(false)}
                        style={{
                            position: 'fixed', inset: 0,
                            background: 'var(--modal-overlay)',
                            backdropFilter: 'blur(12px)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 1000, padding: '20px',
                        }}
                    >
                        <motion.div
                            onClick={e => e.stopPropagation()}
                            initial={{ scale: 0.95, opacity: 0, y: 12 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                            style={{
                                width: '100%', maxWidth: '420px',
                                background: 'var(--modal-bg)',
                                border: '1px solid var(--modal-border)',
                                borderRadius: '20px', padding: '26px',
                                boxShadow: 'var(--shadow-lg)',
                                fontFamily: "'Satoshi', 'Inter', sans-serif",
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '12px',
                                    background: 'var(--glass-surface)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <Sparkles size={18} style={{ color: 'var(--accent-warm)' }} />
                                </div>
                                <span style={{
                                    padding: '4px 10px', borderRadius: '100px',
                                    border: '1px solid var(--border-medium)',
                                    color: 'var(--text-secondary)', fontSize: '10px', fontWeight: 700,
                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                }}>
                                    Current plan · Max
                                </span>
                            </div>

                            <h3 style={{
                                fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)',
                                marginBottom: '8px', fontFamily: "'Clash Display', 'Inter', sans-serif",
                                letterSpacing: '-0.01em',
                            }}>
                                You're already on the highest plan
                            </h3>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '18px' }}>
                                There's nothing to upgrade to — every account is on Feelivate Max. Your coach
                                runs on our highest-tier reasoning models, and no feature is locked behind a
                                paywall. You're getting the best version of Feelivate we ship.
                            </p>

                            <div style={{ display: 'grid', gap: '9px', marginBottom: '22px' }}>
                                {[
                                    'Highest-tier AI reasoning — no throttled or cut-down model',
                                    'Unlimited chats, plans and check-ins',
                                    'Adaptive week plans that rebuild around your progress',
                                    'Voice check-ins, weekly reviews and full journey history',
                                    'Daily alerts, data export and account deletion — always included',
                                ].map(item => (
                                    <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                                        <CheckCircle size={14} style={{ color: 'var(--accent-warm)', flexShrink: 0, marginTop: '1px' }} />
                                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {item}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowPlanInfo(false)}
                                    style={{
                                        padding: '9px 18px', borderRadius: '100px',
                                        border: 'none', background: 'var(--btn-primary-bg)',
                                        color: 'var(--btn-primary-text)', fontSize: '11px', fontWeight: 700,
                                        cursor: 'pointer',
                                        fontFamily: "'Satoshi', 'Inter', sans-serif",
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                    }}
                                >
                                    Got it
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
        </>
    );
}
