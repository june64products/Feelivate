import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, AlertTriangle, Zap, BrainCircuit, Rocket, Activity, ChevronRight, ChevronLeft, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { submitCheckIn, chatWeek, chatGlobal, getGoogleAuthUrl, syncGoogleCalendar, stopGoogleCalendarSync } from '../../api';

interface DayDetails {
    day_name: string;
    action: string;
}

interface WeekDetails {
    week: string;
    focus: string;
    outcome: string;
    win_condition?: string;
    days?: DayDetails[];
}

interface MonthPhase {
    phase: string;
    theme: string;
    expected_result: string;
    weeks: WeekDetails[];
}

interface ResultData {
    past?: any;
    present?: any;
    future?: any;
    integration?: any;
}

interface ResultsDashboardProps {
    data: ResultData | null;
    userId: string;
    sessionId: string;
    resetIntegration: () => void;
}

// -----------------------------------------------------------------
// Core Renderers
// -----------------------------------------------------------------
const MarkdownRenderer = ({ text }: { text: string }) => {
    const lines = text.split('\n');
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lines.map((line, idx) => {
                const trimmedLine = line.trim();
                if (!trimmedLine) return <div key={idx} style={{ height: '2px' }} />;
                if (trimmedLine.startsWith('###')) {
                    return <h4 key={idx} style={{ color: 'var(--text-accent)', fontSize: '1.1rem', fontWeight: 600, marginTop: '8px' }}>{trimmedLine.replace(/^###\s*/, '')}</h4>;
                }
                if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•')) {
                    const content = trimmedLine.replace(/^[-•]\s*/, '');
                    return (
                        <div key={idx} style={{ display: 'flex', gap: '8px', paddingLeft: '8px' }}>
                            <span style={{ color: 'var(--text-accent)' }}>•</span>
                            <span style={{ flex: 1 }}>{parseInline(content)}</span>
                        </div>
                    );
                }
                return <p key={idx} style={{ margin: 0, lineHeight: 1.5 }}>{parseInline(trimmedLine)}</p>;
            })}
        </div>
    );
};

const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} style={{ color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
        }
        return part;
    });
};

// -----------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------
export default function ResultsDashboard({ data, userId, sessionId }: ResultsDashboardProps) {
    const [localRoadmap, setLocalRoadmap] = useState<MonthPhase[]>([]);
    const [localMicroTask, setLocalMicroTask] = useState<any>(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [futureToggle, setFutureToggle] = useState<'failure' | 'success'>('success');
    const [checkInPhase, setCheckInPhase] = useState<'initial' | 'success_details' | 'failure_details' | 'complete'>('initial');
    const [userFeedback, setUserFeedback] = useState('');
    const [timeLeft, setTimeLeft] = useState(300);
    const [timerActive, setTimerActive] = useState(false);
    const [streak, setStreak] = useState(0);
    const [isMobile, setIsMobile] = useState(false);

    // Timeline/Carousel State
    const [activeMonthIndex, setActiveMonthIndex] = useState(0);
    const [activeChatWeek, setActiveChatWeek] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<Record<string, { role: string; content: string }[]>>({});
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);

    // Global Chat Overlay State
    const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
    const [globalChatMessages, setGlobalChatMessages] = useState<{ role: string; content: string }[]>([]);
    const [globalChatInput, setGlobalChatInput] = useState('');
    const [isGlobalChatting, setIsGlobalChatting] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const globalMessagesEndRef = useRef<HTMLDivElement>(null);

    const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'linking' | 'syncing' | 'done'>('idle');
    const [preferredTime, setPreferredTime] = useState('08:00');

    const handleCalendarAction = async () => {
        setIsSyncingCalendar(true);
        try {
            // Check if user needs to link first (we'll implement this properly later, 
            // for now let's just trigger the link flow if they click)
            const { auth_url } = await getGoogleAuthUrl();
            window.location.href = auth_url;
        } catch (error) {
            console.error("Calendar action failed:", error);
            setIsSyncingCalendar(false);
        }
    };

    const handleManualSync = async () => {
        setIsSyncingCalendar(true);
        setSyncStatus('syncing');
        try {
            await syncGoogleCalendar(sessionId, userId, preferredTime);
            setSyncStatus('done');
            setTimeout(() => setSyncStatus('idle'), 5000);
        } catch (error) {
            console.error("Sync failed:", error);
            setSyncStatus('idle');
        } finally {
            setIsSyncingCalendar(false);
        }
    };

    const handleStopSync = async () => {
        setIsSyncingCalendar(true);
        try {
            await stopGoogleCalendarSync(userId);
            setSyncStatus('idle');
            alert("Calendar sync disabled and future events are being removed.");
        } catch (error) {
            console.error("Stop sync failed:", error);
        } finally {
            setIsSyncingCalendar(false);
        }
    };

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth <= 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (data?.integration) {
            setLocalRoadmap(data.integration.roadmap || []);
            setLocalMicroTask(data.integration.micro_task || null);
        }
    }, [data]);

    useEffect(() => {
        let interval: any = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => setTimeLeft(p => p - 1), 1000);
        } else if (timeLeft === 0) {
            setTimerActive(false);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    useEffect(() => {
        if (activeChatWeek) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, activeChatWeek]);

    useEffect(() => {
        if (isGlobalChatOpen) globalMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [globalChatMessages, isGlobalChatOpen]);

    if (!data) return null;

    const past = data.past || {};
    const present = data.present || {};
    const future = data.future || {};
    const integration = data.integration || {};

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // -----------------------------------------------------------------
    // Data Handlers
    // -----------------------------------------------------------------
    const handleGlobalChatSubmit = async (e?: React.FormEvent, manualText?: string) => {
        e?.preventDefault();
        const text = manualText || globalChatInput;
        if (!text.trim() || isGlobalChatting) return;

        const updatedHistory = [...globalChatMessages, { role: 'user', content: text }];
        setGlobalChatMessages(updatedHistory);
        setGlobalChatInput('');
        setIsGlobalChatting(true);

        try {
            const response = await chatGlobal({ user_id: userId, session_id: sessionId, message: text, chat_history: updatedHistory.slice(0, -1) });
            if (response.response_message) {
                setGlobalChatMessages([...updatedHistory, { role: 'assistant', content: response.response_message }]);
            }
        } catch (error) {
            console.error("Global chat error:", error);
        } finally {
            setIsGlobalChatting(false);
        }
    };

    const handleChatSubmit = async (e: React.FormEvent, weekData: any) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeChatWeek) return;

        const weekKey = `${weekData.phase}_${weekData.week}`;
        const updatedHistory = [...(chatMessages[weekKey] || []), { role: 'user', content: chatInput }];
        setChatMessages(prev => ({ ...prev, [weekKey]: updatedHistory }));
        setChatInput('');
        setIsChatting(true);

        try {
            const response = await chatWeek({ user_id: userId, session_id: sessionId, message: chatInput, week_context: weekData, chat_history: updatedHistory.slice(0, -1) });
            if (response.response_message) {
                setChatMessages(prev => ({ ...prev, [weekKey]: [...updatedHistory, { role: 'assistant', content: response.response_message }] }));
            }
        } catch (error) { console.error("Chat error", error); } finally { setIsChatting(false); }
    };

    const submitFinalCheckIn = async (status: 'Completed' | 'Struggled') => {
        setIsCheckingIn(true);
        setFeedbackMessage('');
        try {
            const response = await submitCheckIn({ user_id: userId, session_id: sessionId, status: `${status} - Feedback: ${userFeedback}`, current_plan: { micro_task: localMicroTask } });
            if (response.feedback_message) setFeedbackMessage(response.feedback_message);
            if (response.adjusted_micro_task) setLocalMicroTask(response.adjusted_micro_task);
            if (response.adjusted_roadmap) setLocalRoadmap(response.adjusted_roadmap);
            if (status === 'Completed') setStreak(prev => prev + 1);
            setCheckInPhase('complete');
            setTimerActive(false);
        } catch (error) {
            setFeedbackMessage("Failed to recalibrate plan. Try again.");
            setCheckInPhase('initial');
        } finally {
            setIsCheckingIn(false);
        }
    };

    return (
        <div style={{ 
            padding: '0', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '40px',
            marginRight: (isGlobalChatOpen && !isMobile) ? '400px' : '0',
            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
            
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={20} color="#50fa7b" />
                    <span style={{ color: '#50fa7b', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Core Analysis</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', color: '#ffa500', fontWeight: 600 }}>🔥 {streak} Streak</span>
                </div>
            </div>

            {/* BENTO BOX GRID: Past, Present, Future */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, 1fr)', gridTemplateRows: 'auto auto', gap: isMobile ? '16px' : '24px' }}>
                
                {/* PAST BENTO */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ gridColumn: isMobile ? 'span 1' : 'span 6', background: 'rgba(255, 123, 123, 0.03)', border: '1px solid rgba(255, 123, 123, 0.15)', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '20px' : '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, #ff7b7b, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <BrainCircuit size={24} color="#ff7b7b" />
                        <h4 style={{ color: '#ff7b7b', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Past Analysis</h4>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', lineHeight: 1.6, marginBottom: '24px' }}>
                        {past.pattern_detected || "No historical pattern identified."}
                    </p>
                    {past.predicted_context && (
                         <div style={{ background: 'rgba(255, 123, 123, 0.08)', padding: '16px', borderRadius: '12px' }}>
                             <span style={{ display: 'block', fontSize: '0.85rem', color: '#ff7b7b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 }}>Deep Context</span>
                             <span style={{ color: 'var(--text-secondary)' }}>{past.predicted_context}</span>
                         </div>
                    )}
                </motion.div>

                {/* PRESENT BENTO */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ gridColumn: isMobile ? 'span 1' : 'span 6', background: 'rgba(249, 215, 28, 0.03)', border: '1px solid rgba(249, 215, 28, 0.15)', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '20px' : '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, #f9d71c, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <Zap size={24} color="#f9d71c" />
                        <h4 style={{ color: '#f9d71c', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Present Analysis</h4>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', lineHeight: 1.6, marginBottom: '24px' }}>
                        {present.primary_blocker || present.primary_constraint || "No constraint."}
                    </p>
                    {present.physical_reframe && (
                         <div style={{ background: 'rgba(249, 215, 28, 0.08)', padding: '16px', borderRadius: '12px' }}>
                             <span style={{ display: 'block', fontSize: '0.85rem', color: '#f9d71c', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 }}>Action Reframe</span>
                             <span style={{ color: 'var(--text-secondary)' }}>{present.physical_reframe}</span>
                         </div>
                    )}
                </motion.div>

                {/* FUTURE BENTO (Full Width) */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ gridColumn: isMobile ? 'span 1' : 'span 12', background: 'rgba(130, 202, 255, 0.03)', border: '1px solid rgba(130, 202, 255, 0.15)', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '20px' : '32px', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '32px', alignItems: isMobile ? 'stretch' : 'center' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #82caff, transparent)' }} />
                    
                    <div style={{ flex: isMobile ? 'none' : '0 0 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <AlertTriangle size={24} color="#82caff" />
                            <h4 style={{ color: '#82caff', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Future Analysis</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div 
                                onClick={() => setFutureToggle(futureToggle === 'success' ? 'failure' : 'success')}
                                style={{ 
                                    padding: '12px 16px', 
                                    borderRadius: '12px', 
                                    cursor: 'pointer', 
                                    background: futureToggle === 'failure' ? 'rgba(255, 123, 123, 0.1)' : 'rgba(255,255,255,0.02)', 
                                    border: `1px solid ${futureToggle === 'failure' ? 'rgba(255, 123, 123, 0.3)' : 'rgba(255,255,255,0.05)'}`, 
                                    color: futureToggle === 'failure' ? '#ff7b7b' : 'var(--text-secondary)',
                                    transition: 'all 0.2s',
                                    textAlign: 'center',
                                    fontWeight: 600
                                }}
                            >
                                {futureToggle === 'success' ? '🚨 View Inaction Risk' : '✨ Return to Action Path'}
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, paddingLeft: isMobile ? '0' : '32px', borderLeft: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)', borderTop: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingTop: isMobile ? '16px' : '0' }}>
                        <AnimatePresence mode="wait">
                            <motion.p key={futureToggle} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ color: 'var(--text-primary)', fontSize: '1.2rem', lineHeight: 1.6, margin: 0 }}>
                                {futureToggle === 'failure' ? future.failure_simulation : future.success_simulation}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* MISSION CONTROL: Micro Task & Mentor Intervention */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} style={{ background: '#0a0a0a', border: '1px solid rgba(80, 250, 123, 0.3)', borderRadius: isMobile ? '20px' : '32px', padding: isMobile ? '24px' : '48px', position: 'relative', boxShadow: '0 20px 60px rgba(80,250,123,0.05)' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '1px', background: 'linear-gradient(90deg, transparent, #50fa7b, transparent)' }} />
                
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#50fa7b', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 16px 0' }}>Mission Control</h3>
                    <p style={{ fontSize: '1.5rem', color: 'var(--text-primary)', maxWidth: '800px', margin: '0 auto', fontStyle: 'italic' }}>
                        "{integration.message_from_mentor}"
                    </p>
                </div>

                {localMicroTask && (
                    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '20px' : '32px', background: 'rgba(255,255,255,0.02)', padding: isMobile ? '20px' : '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <Rocket color="#50fa7b" size={28} />
                                <h4 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>{localMicroTask.title}</h4>
                            </div>
                            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                                {localMicroTask.description}
                            </p>
                            <div style={{ display: 'inline-block', background: 'rgba(249, 215, 28, 0.1)', color: '#f9d71c', padding: '8px 16px', borderRadius: '20px', fontWeight: 600 }}>
                                🎯 Outcome: {localMicroTask.reward}
                            </div>
                        </div>

                        {/* Interactive Timer & Check-in */}
                        <div style={{ flex: isMobile ? 'none' : '0 0 350px', background: '#000', borderRadius: '20px', padding: isMobile ? '20px' : '24px', border: '1px solid rgba(80,250,123,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '3rem', fontFamily: 'monospace', color: timerActive ? '#50fa7b' : 'var(--text-primary)', marginBottom: '24px', fontWeight: 700 }}>
                                {formatTime(timeLeft)}
                            </div>
                            
                            <AnimatePresence mode="wait">
                                {checkInPhase === 'initial' && (
                                    <motion.div key="btns" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                                        <button onClick={() => setTimerActive(!timerActive)} style={{ background: timerActive ? 'rgba(255,255,255,0.1)' : '#50fa7b', color: timerActive ? 'white' : 'black', padding: '12px', borderRadius: '12px', border: 'none', fontWeight: 700, cursor: 'pointer' }}>
                                            {timerActive ? 'Pause Sequence' : 'Commence Sequence'}
                                        </button>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => setCheckInPhase('success_details')} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(80,250,123,0.3)', color: '#50fa7b', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>Completed</button>
                                            <button onClick={() => setCheckInPhase('failure_details')} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,123,123,0.3)', color: '#ff7b7b', padding: '10px', borderRadius: '12px', cursor: 'pointer' }}>Struggled</button>
                                        </div>
                                    </motion.div>
                                )}
                                
                                {(checkInPhase === 'success_details' || checkInPhase === 'failure_details') && (
                                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%' }}>
                                        <input autoFocus type="text" value={userFeedback} onChange={(e) => setUserFeedback(e.target.value)} placeholder="Provide context..." style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', padding: '12px', borderRadius: '8px', outline: 'none', marginBottom: '12px' }} />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button disabled={isCheckingIn || !userFeedback} onClick={() => submitFinalCheckIn(checkInPhase === 'success_details' ? 'Completed' : 'Struggled')} style={{ flex: 1, background: checkInPhase === 'success_details' ? '#50fa7b' : '#ff7b7b', color: checkInPhase === 'success_details' ? 'black' : 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                                                {isCheckingIn ? <Loader2 className="spinner" size={16} /> : 'Submit'}
                                            </button>
                                            <button onClick={() => setCheckInPhase('initial')} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                    </motion.div>
                                )}

                                {checkInPhase === 'complete' && (
                                     <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', color: '#50fa7b' }}>
                                         <CheckCircle2 size={32} style={{ marginBottom: '8px' }} />
                                         <div>{feedbackMessage || "Trajectory Updated."}</div>
                                     </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* RADICAL ROADMAP CAROUSEL */}
            {Array.isArray(localRoadmap) && localRoadmap.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <Calendar size={32} color="var(--text-primary)" />
                            <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0 }}>Timeline Vectors</h3>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setActiveMonthIndex(Math.max(0, activeMonthIndex - 1))} disabled={activeMonthIndex === 0} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activeMonthIndex === 0 ? 'not-allowed' : 'pointer', opacity: activeMonthIndex === 0 ? 0.3 : 1 }}><ChevronLeft size={24} /></button>
                            <button onClick={() => setActiveMonthIndex(Math.min(localRoadmap.length - 1, activeMonthIndex + 1))} disabled={activeMonthIndex === localRoadmap.length - 1} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: activeMonthIndex === localRoadmap.length - 1 ? 'not-allowed' : 'pointer', opacity: activeMonthIndex === localRoadmap.length - 1 ? 0.3 : 1 }}><ChevronRight size={24} /></button>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px', padding: '40px', position: 'relative', overflow: 'hidden' }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeMonthIndex}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.4 }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '24px' }}>
                                    <div style={{ fontSize: '4rem', fontWeight: 800, color: 'rgba(255,255,255,0.1)', lineHeight: 1 }}>0{activeMonthIndex + 1}</div>
                                    <div>
                                        <div style={{ color: 'var(--text-accent)', letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 600 }}>{localRoadmap[activeMonthIndex].phase}</div>
                                        <h4 style={{ fontSize: '2rem', color: 'var(--text-primary)', margin: 0 }}>{localRoadmap[activeMonthIndex].theme}</h4>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: isMobile ? '12px' : '24px', overflowX: 'auto', paddingBottom: '24px', WebkitOverflowScrolling: 'touch' }}>
                                    {localRoadmap[activeMonthIndex].weeks?.map((week, wIdx) => (
                                        <div key={wIdx} style={{ flex: isMobile ? '0 0 85vw' : '0 0 400px', background: 'rgba(0,0,0,0.4)', borderRadius: isMobile ? '16px' : '24px', padding: isMobile ? '16px' : '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                                <h5 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', margin: 0 }}>{week.week}</h5>
                                                <button onClick={() => setActiveChatWeek(activeChatWeek === `${localRoadmap[activeMonthIndex].phase}_${week.week}` ? null : `${localRoadmap[activeMonthIndex].phase}_${week.week}`)} style={{ background: 'rgba(130, 202, 255, 0.1)', color: '#82caff', border: 'none', padding: '6px 12px', borderRadius: '12px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={14} /> Adjust</button>
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.5, flex: 1 }}>{week.outcome}</p>
                                            
                                            {week.days && week.days.length > 0 && (
                                                <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                                                    {week.days.map((day, dIdx) => (
                                                        <div key={dIdx} style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                                                            <div style={{ color: 'var(--text-accent)', fontSize: '0.85rem', fontWeight: 600, minWidth: '40px' }}>{day.day_name}</div>
                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{day.action}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Immersive Week Chat */}
                                            <AnimatePresence>
                                                {activeChatWeek === `${localRoadmap[activeMonthIndex].phase}_${week.week}` && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: '16px', background: '#050505', borderRadius: '16px', border: '1px solid rgba(130, 202, 255, 0.2)' }}>
                                                        <div style={{ padding: '16px', maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            {chatMessages[`${localRoadmap[activeMonthIndex].phase}_${week.week}`]?.map((msg, mIdx) => (
                                                                <div key={mIdx} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'rgba(80, 250, 123, 0.1)' : 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '12px', color: msg.role === 'user' ? '#50fa7b' : 'white', maxWidth: '90%', fontSize: '0.9rem' }}>
                                                                    {msg.content}
                                                                </div>
                                                            ))}
                                                            {isChatting && <div style={{ alignSelf: 'flex-start', color: 'var(--text-secondary)' }}><Loader2 size={16} className="spinner" /></div>}
                                                            <div ref={messagesEndRef} />
                                                        </div>
                                                        <form onSubmit={(e) => handleChatSubmit(e, week)} style={{ display: 'flex', padding: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type..." style={{ flex: 1, background: 'transparent', border: 'none', color: 'white', padding: '8px', outline: 'none' }} />
                                                            <button type="submit" disabled={!chatInput.trim()} style={{ background: 'transparent', color: '#82caff', border: 'none', cursor: 'pointer' }}><Send size={18} /></button>
                                                        </form>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            )}

            {/* GLOBAL MENTOR COMMAND PALET            {/* GLOBAL MENTOR SIDEBAR */}
            <AnimatePresence>
                {isGlobalChatOpen && (
                    <>
                        {/* Mobile Overlay Backdrop */}
                        {isMobile && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                onClick={() => setIsGlobalChatOpen(false)}
                                style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 999 }}
                            />
                        )}
                        <motion.div 
                            initial={{ x: '100%' }} 
                            animate={{ x: 0 }} 
                            exit={{ x: '100%' }} 
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{ 
                                position: 'fixed', 
                                top: 'var(--nav-height)', 
                                right: 0, 
                                width: isMobile ? '100%' : '400px', 
                                height: `calc(100vh - var(--nav-height))`, 
                                background: '#0a0a0a', 
                                borderLeft: '1px solid rgba(130, 202, 255, 0.2)', 
                                zIndex: 1000, 
                                display: 'flex', 
                                flexDirection: 'column',
                                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
                            }}
                        >
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '10px', height: '10px', background: '#82caff', borderRadius: '50%', boxShadow: '0 0 10px #82caff' }} />
                                    <span style={{ color: 'white', fontWeight: 600, fontSize: '1rem', letterSpacing: '0.5px' }}>YOUR MENTOR</span>
                                </div>
                                <button onClick={() => setIsGlobalChatOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}><X size={20} /></button>
                            </div>
                            
                            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {globalChatMessages.length === 0 && (
                                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 'auto', padding: '20px' }}>
                                        <BrainCircuit size={40} style={{ margin: '0 auto 16px auto', opacity: 0.3 }} />
                                        <p style={{ fontSize: '0.95rem', lineHeight: 1.5 }}>System synchronized. Ask about your journey, challenges, or next steps.</p>
                                    </div>
                                )}
                                {globalChatMessages.map((msg, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        <div style={{ maxWidth: '90%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 0 16px' : '16px 16px 16px 0', background: msg.role === 'user' ? 'rgba(130, 202, 255, 0.15)' : 'rgba(255,255,255,0.05)', color: msg.role === 'user' ? '#82caff' : 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                            <MarkdownRenderer text={msg.content} />
                                        </div>
                                    </div>
                                ))}
                                {isGlobalChatting && (
                                    <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '16px 16px 16px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <Loader2 size={14} className="spinner" color="#82caff" /> <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Thinking...</span>
                                    </div>
                                )}
                                <div ref={globalMessagesEndRef} />
                            </div>

                            <form onSubmit={(e) => handleGlobalChatSubmit(e)} style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px' }}>
                                <input autoFocus type="text" value={globalChatInput} onChange={e => setGlobalChatInput(e.target.value)} placeholder="Type a message..." style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', color: 'white', fontSize: '0.95rem', outline: 'none' }} />
                                <button type="submit" disabled={!globalChatInput.trim() || isGlobalChatting} style={{ background: '#82caff', color: 'black', border: 'none', padding: '0 16px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' }}><Send size={18} /></button>
                            </form>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* FLOATING MENTOR BUTTON */}
            {!isGlobalChatOpen && (
                <motion.button
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    whileHover={{ scale: 1.1, boxShadow: '0 0 30px rgba(130, 202, 255, 0.4)' }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setIsGlobalChatOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: isMobile ? '24px' : '40px',
                        right: isMobile ? '24px' : '40px',
                        width: isMobile ? '56px' : '72px',
                        height: isMobile ? '56px' : '72px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #82caff 0%, #4a90e2 100%)',
                        border: 'none',
                        color: 'black',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        zIndex: 900,
                        boxShadow: '0 10px 40px rgba(0,0,0,0.3), 0 0 20px rgba(130, 202, 255, 0.2)',
                    }}
                >
                    <MessageSquare size={isMobile ? 28 : 32} />
                </motion.button>
            )}

            {/* Google Calendar Sync Card */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ 
                    background: 'rgba(204, 255, 0, 0.03)', 
                    border: '1px solid rgba(204, 255, 0, 0.15)', 
                    borderRadius: '24px', 
                    padding: isMobile ? '24px' : '32px',
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    alignItems: 'center',
                    gap: '24px',
                    marginBottom: '40px'
                }}
            >
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <Calendar size={24} color="#ccff00" />
                        <h4 style={{ color: '#ccff00', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Daily AI Motivation via Google Calendar</h4>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.5, margin: 0 }}>
                        Get daily English motivational notifications on your phone based on this roadmap. 
                        AI will send personalized messages to keep you on track every single day.
                    </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: isMobile ? '100%' : '300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '8px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Notify at:</span>
                        <input 
                            type="time" 
                            value={preferredTime}
                            onChange={(e) => setPreferredTime(e.target.value)}
                            style={{ 
                                background: 'transparent', 
                                border: 'none', 
                                color: 'white', 
                                fontSize: '1rem', 
                                fontWeight: 600, 
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleCalendarAction}
                            disabled={isSyncingCalendar}
                            style={{ 
                                flex: 2,
                                background: '#ccff00', 
                                color: 'black', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: 'none', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {isSyncingCalendar ? <Loader2 size={18} className="spinner" /> : <Calendar size={18} />}
                            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'done' ? 'Synced! ✅' : 'Connect & Sync'}
                        </button>
                        <button 
                            onClick={handleManualSync}
                            disabled={isSyncingCalendar || syncStatus === 'done'}
                            style={{ 
                                flex: 2,
                                background: 'rgba(255,255,255,0.05)', 
                                color: 'white', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                fontWeight: 700, 
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            {syncStatus === 'syncing' ? <Loader2 size={18} className="spinner" /> : <Zap size={18} />}
                            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'done' ? 'Synced! ✅' : 'Sync roadmap'}
                        </button>
                        <button 
                            onClick={handleStopSync}
                            disabled={isSyncingCalendar}
                            title="Stop all notifications"
                            style={{ 
                                flex: 1,
                                background: 'rgba(255, 123, 123, 0.1)', 
                                color: '#ff7b7b', 
                                padding: '12px', 
                                borderRadius: '12px', 
                                border: '1px solid rgba(255, 123, 123, 0.2)', 
                                fontWeight: 600, 
                                cursor: 'pointer'
                            }}
                        >
                            Stop
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
