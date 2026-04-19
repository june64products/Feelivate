import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, Target, AlertTriangle, Zap, BrainCircuit, Rocket, Activity, ChevronRight, ChevronLeft, Loader2, MessageSquare, Send, X } from 'lucide-react';
import { submitCheckIn, chatWeek, chatGlobal } from '../../api';

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
export default function ResultsDashboard({ data, userId, sessionId, resetIntegration }: ResultsDashboardProps) {
    const [localRoadmap, setLocalRoadmap] = useState<MonthPhase[]>([]);
    const [localMicroTask, setLocalMicroTask] = useState<any>(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [futureToggle, setFutureToggle] = useState<'failure' | 'success'>('failure');
    const [checkInPhase, setCheckInPhase] = useState<'initial' | 'success_details' | 'failure_details' | 'complete'>('initial');
    const [userFeedback, setUserFeedback] = useState('');
    const [timeLeft, setTimeLeft] = useState(300);
    const [timerActive, setTimerActive] = useState(false);
    const [streak, setStreak] = useState(0);

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
        <div style={{ padding: '0', display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* Top Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '16px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Activity size={20} color="#50fa7b" />
                    <span style={{ color: '#50fa7b', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>Core Analysis Active</span>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span style={{ fontSize: '1rem', color: '#ffa500', fontWeight: 600 }}>🔥 {streak} Streak</span>
                    <button 
                        onClick={() => setIsGlobalChatOpen(true)}
                        style={{ border: '1px solid rgba(130, 202, 255, 0.3)', background: 'rgba(130, 202, 255, 0.1)', color: '#82caff', padding: '8px 20px', borderRadius: '30px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                    >
                        <MessageSquare size={16} /> Mentor Omni-Chat
                    </button>
                </div>
            </div>

            {/* BENTO BOX GRID: Past, Present, Future */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'auto auto', gap: '24px' }}>
                
                {/* PAST BENTO */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ gridColumn: 'span 6', background: 'rgba(255, 123, 123, 0.03)', border: '1px solid rgba(255, 123, 123, 0.15)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, #ff7b7b, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <BrainCircuit size={24} color="#ff7b7b" />
                        <h4 style={{ color: '#ff7b7b', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>The True Pattern</h4>
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ gridColumn: 'span 6', background: 'rgba(249, 215, 28, 0.03)', border: '1px solid rgba(249, 215, 28, 0.15)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(to right, #f9d71c, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <Zap size={24} color="#f9d71c" />
                        <h4 style={{ color: '#f9d71c', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Current Friction</h4>
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
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ gridColumn: 'span 12', background: 'rgba(130, 202, 255, 0.03)', border: '1px solid rgba(130, 202, 255, 0.15)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden', display: 'flex', gap: '32px', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #82caff, transparent)' }} />
                    
                    <div style={{ flex: '0 0 300px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <AlertTriangle size={24} color="#82caff" />
                            <h4 style={{ color: '#82caff', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Future Projections</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div 
                                onClick={() => setFutureToggle('failure')}
                                style={{ padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', background: futureToggle === 'failure' ? 'rgba(255, 123, 123, 0.1)' : 'transparent', border: `1px solid ${futureToggle === 'failure' ? 'rgba(255, 123, 123, 0.3)' : 'rgba(255,255,255,0.05)'}`, color: futureToggle === 'failure' ? '#ff7b7b' : 'var(--text-secondary)' }}
                            >
                                Default Trajectory (Inaction)
                            </div>
                            <div 
                                onClick={() => setFutureToggle('success')}
                                style={{ padding: '12px 16px', borderRadius: '12px', cursor: 'pointer', background: futureToggle === 'success' ? 'rgba(80, 250, 123, 0.1)' : 'transparent', border: `1px solid ${futureToggle === 'success' ? 'rgba(80, 250, 123, 0.3)' : 'rgba(255,255,255,0.05)'}`, color: futureToggle === 'success' ? '#50fa7b' : 'var(--text-secondary)' }}
                            >
                                Altered Vector (Action)
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, paddingLeft: '32px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                        <AnimatePresence mode="wait">
                            <motion.p key={futureToggle} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ color: 'var(--text-primary)', fontSize: '1.2rem', lineHeight: 1.6, margin: 0 }}>
                                {futureToggle === 'failure' ? future.failure_simulation : future.success_simulation}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </motion.div>
            </div>

            {/* MISSION CONTROL: Micro Task & Mentor Intervention */}
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} style={{ background: '#0a0a0a', border: '1px solid rgba(80, 250, 123, 0.3)', borderRadius: '32px', padding: '48px', position: 'relative', boxShadow: '0 20px 60px rgba(80,250,123,0.05)' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '60%', height: '1px', background: 'linear-gradient(90deg, transparent, #50fa7b, transparent)' }} />
                
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h3 style={{ fontSize: '1rem', color: '#50fa7b', textTransform: 'uppercase', letterSpacing: '2px', margin: '0 0 16px 0' }}>Mission Control</h3>
                    <p style={{ fontSize: '1.5rem', color: 'var(--text-primary)', maxWidth: '800px', margin: '0 auto', fontStyle: 'italic' }}>
                        "{integration.message_from_mentor}"
                    </p>
                </div>

                {localMicroTask && (
                    <div style={{ display: 'flex', gap: '32px', background: 'rgba(255,255,255,0.02)', padding: '32px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
                        <div style={{ flex: '0 0 350px', background: '#000', borderRadius: '20px', padding: '24px', border: '1px solid rgba(80,250,123,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
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

                                <div style={{ display: 'flex', gap: '24px', overflowX: 'auto', paddingBottom: '24px' }}>
                                    {localRoadmap[activeMonthIndex].weeks?.map((week, wIdx) => (
                                        <div key={wIdx} style={{ flex: '0 0 400px', background: 'rgba(0,0,0,0.4)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column' }}>
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

            {/* GLOBAL MENTOR COMMAND PALETTE (OVERLAY) */}
            <AnimatePresence>
                {isGlobalChatOpen && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} style={{ width: '100%', maxWidth: '800px', background: '#0a0a0a', border: '1px solid rgba(130, 202, 255, 0.3)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '70vh', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ width: '12px', height: '12px', background: '#82caff', borderRadius: '50%', boxShadow: '0 0 10px #82caff' }} />
                                    <span style={{ color: 'white', fontWeight: 600, fontSize: '1.1rem', letterSpacing: '1px' }}>GLOBAL MENTOR UPLINK</span>
                                </div>
                                <button onClick={() => setIsGlobalChatOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                            </div>
                            
                            <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                {globalChatMessages.length === 0 && (
                                    <div style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: 'auto' }}>
                                        <BrainCircuit size={48} style={{ margin: '0 auto 16px auto', opacity: 0.5 }} />
                                        <p style={{ fontSize: '1.2rem', maxWidth: '400px', margin: '0 auto' }}>System synchronized. Ask any overarching questions about your journey, timeline, or resistance.</p>
                                    </div>
                                )}
                                {globalChatMessages.map((msg, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                        <div style={{ maxWidth: '80%', padding: '16px 20px', borderRadius: msg.role === 'user' ? '20px 20px 0 20px' : '20px 20px 20px 0', background: msg.role === 'user' ? 'var(--text-primary)' : 'rgba(255,255,255,0.05)', color: msg.role === 'user' ? '#000' : 'var(--text-primary)', border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,0.1)' : 'none', fontSize: '1.05rem', lineHeight: 1.6 }}>
                                            <MarkdownRenderer text={msg.content} />
                                        </div>
                                    </div>
                                ))}
                                {isGlobalChatting && (
                                    <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '16px 20px', borderRadius: '20px 20px 20px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Loader2 size={16} className="spinner" color="var(--text-primary)" /> <span style={{ color: 'var(--text-secondary)' }}>Synthesizing...</span>
                                    </div>
                                )}
                                <div ref={globalMessagesEndRef} />
                            </div>

                            <form onSubmit={(e) => handleGlobalChatSubmit(e)} style={{ padding: '24px', background: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '16px' }}>
                                <input autoFocus type="text" value={globalChatInput} onChange={e => setGlobalChatInput(e.target.value)} placeholder="Enter command or question..." style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 24px', borderRadius: '16px', color: 'white', fontSize: '1.1rem', outline: 'none' }} />
                                <button type="submit" disabled={!globalChatInput.trim() || isGlobalChatting} style={{ background: '#82caff', color: 'black', border: 'none', padding: '0 32px', borderRadius: '16px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><Send size={20} /></button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
