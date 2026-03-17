import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, Target, AlertTriangle, Zap, BrainCircuit, Rocket, Activity, ChevronRight, Loader2, ChevronDown, ChevronUp, MessageSquare, Send } from 'lucide-react';
import { submitCheckIn, chatWeek } from '../../api';

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
    resetIntegration: () => void;
}

const ResultsDashboard = ({ data, resetIntegration }: ResultsDashboardProps) => {
    const [localRoadmap, setLocalRoadmap] = useState<MonthPhase[]>([]);
    const [localMicroTask, setLocalMicroTask] = useState<any>(null);
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState('');
    const [futureToggle, setFutureToggle] = useState<'failure' | 'success'>('failure');

    // Check-in Branching Logic
    const [checkInPhase, setCheckInPhase] = useState<'initial' | 'success_details' | 'failure_details' | 'complete'>('initial');
    const [userFeedback, setUserFeedback] = useState('');

    // Timer & Streak
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [timerActive, setTimerActive] = useState(false);
    const [streak, setStreak] = useState(0); // Mock streak

    // Save Gate State
    const [email, setEmail] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Accordion State
    const [expandedMonths, setExpandedMonths] = useState<number[]>([0]); // Open first month by default

    // Chatbot State
    const [activeChatWeek, setActiveChatWeek] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<Record<string, { role: string; content: string }[]>>({});
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const toggleMonth = (idx: number) => {
        setExpandedMonths(prev =>
            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
        );
    };

    const handleChatSubmit = async (e: React.FormEvent, weekData: any) => {
        e.preventDefault();
        if (!chatInput.trim() || !activeChatWeek) return;

        const weekKey = `${weekData.phase}_${weekData.week}`;
        const newUserMsg = { role: 'user', content: chatInput };
        const updatedHistory = [...(chatMessages[weekKey] || []), newUserMsg];

        setChatMessages(prev => ({ ...prev, [weekKey]: updatedHistory }));
        setChatInput('');
        setIsChatting(true);

        try {
            const response = await chatWeek({
                user_id: 'default_user',
                session_id: 'default_session',
                message: newUserMsg.content,
                week_context: weekData,
                chat_history: updatedHistory.slice(0, -1)
            });

            if (response.response_message) {
                setChatMessages(prev => ({
                    ...prev,
                    [weekKey]: [...updatedHistory, { role: 'assistant', content: response.response_message }]
                }));
            }
        } catch (error) {
            console.error("Chat error:", error);
        } finally {
            setIsChatting(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (activeChatWeek) scrollToBottom();
    }, [chatMessages, activeChatWeek]);

    useEffect(() => {
        let interval: any = null;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setTimerActive(false);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        if (data?.integration) {
            setLocalRoadmap(data.integration.roadmap || []);
            setLocalMicroTask(data.integration.micro_task || null);
            setFeedbackMessage('');
        }
    }, [data]);

    if (!data) return null;

    const past = data.past || {};
    const present = data.present || {};
    const future = data.future || {};
    const integration = data.integration || {};

    const handleInitialCheckInClick = (type: 'success' | 'failure') => {
        setCheckInPhase(type === 'success' ? 'success_details' : 'failure_details');
    };

    const submitFinalCheckIn = async (status: 'Completed' | 'Struggled') => {
        setIsCheckingIn(true);
        setFeedbackMessage('');
        try {
            const response = await submitCheckIn({
                user_id: 'default_user',
                session_id: 'default_session',
                status: `${status} - Feedback: ${userFeedback}`,
                current_plan: { micro_task: localMicroTask }
            });

            if (response.feedback_message) setFeedbackMessage(response.feedback_message);
            if (response.adjusted_micro_task) setLocalMicroTask(response.adjusted_micro_task);
            if (response.adjusted_roadmap) setLocalRoadmap(response.adjusted_roadmap);

            if (status === 'Completed') {
                setStreak(prev => prev + 1);
            }
            setCheckInPhase('complete');
            setTimerActive(false);
        } catch (error) {
            console.error("Check-in failed:", error);
            setFeedbackMessage("Failed to recalibrate plan. Please try again.");
            setCheckInPhase('initial');
        } finally {
            setIsCheckingIn(false);
        }
    };

    const handleSaveBlueprint = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setIsSaving(true);
        // Simulate API call to save/email the blueprint
        setTimeout(() => {
            setIsSaving(false);
            setSaveSuccess(true);
        }, 1500);
    };

    // Animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1, delayChildren: 0.2 } as any
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } as any }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="results-dashboard"
            style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '48px', paddingBottom: '80px' }}
        >
            {/* Header Section */}
            <motion.div variants={itemVariants} style={{ textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', background: 'rgba(80, 250, 123, 0.1)', padding: '8px 24px', borderRadius: '30px', border: '1px solid rgba(80, 250, 123, 0.2)', marginBottom: '24px' }}>
                    <Activity size={18} color="#50fa7b" />
                    <span style={{ color: '#50fa7b', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem' }}>Analysis Complete</span>
                </div>

                <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,165,0,0.1)', border: '1px solid rgba(255,165,0,0.3)', padding: '8px 16px', borderRadius: '20px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🔥</span>
                    <span style={{ color: '#ffa500', fontWeight: 600 }}>{streak} Days Engaged</span>
                </div>

                <h2 style={{ fontSize: '3rem', fontWeight: 700, marginBottom: '16px', background: 'linear-gradient(to right, #ffffff, #82caff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Your Behavioral Blueprint
                </h2>
                {integration.impact_statement && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.25rem', maxWidth: '800px', margin: '0 auto', lineHeight: 1.6 }}>
                        "{integration.impact_statement}"
                    </p>
                )}
            </motion.div>

            {/* Core Analysis (Past, Present, Future) - Premium Grid */}
            <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '24px' }}>

                {/* Past Card */}
                <div style={{ background: 'rgba(255, 123, 123, 0.03)', border: '1px solid rgba(255, 123, 123, 0.15)', borderRadius: '24px', padding: 'clamp(24px, 4vw, 32px)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #ff7b7b, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(255, 123, 123, 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <BrainCircuit size={24} color="#ff7b7b" />
                        </div>
                        <h4 style={{ color: '#ff7b7b', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>The Root Pattern</h4>
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '1.05rem', marginBottom: '24px' }}>
                        {past.pattern_detected || "No historical pattern detected."}
                    </p>

                    {past.origin_story && (
                        <div style={{ marginBottom: '24px' }}>
                            <span style={{ display: 'block', fontSize: '0.85rem', color: '#ff7b7b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', fontWeight: 600 }}>Origin Framing</span>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic', lineHeight: 1.5 }}>
                                "{past.origin_story}"
                            </p>
                        </div>
                    )}

                    {past.predicted_context && (
                        <div style={{ background: 'rgba(255, 123, 123, 0.08)', padding: '16px', borderRadius: '12px', borderLeft: '2px solid rgba(255,123,123,0.3)' }}>
                            <span style={{ display: 'block', fontSize: '0.85rem', color: '#ff7b7b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>Deep Insight</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>{past.predicted_context}</span>
                        </div>
                    )}
                </div>

                {/* Present Card */}
                <div style={{ background: 'rgba(249, 215, 28, 0.03)', border: '1px solid rgba(249, 215, 28, 0.15)', borderRadius: '24px', padding: 'clamp(24px, 4vw, 32px)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #f9d71c, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(249, 215, 28, 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Zap size={24} color="#f9d71c" />
                        </div>
                        <h4 style={{ color: '#f9d71c', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Present Constraint</h4>
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '1.05rem', marginBottom: '24px' }}>
                        <span style={{ fontWeight: 600 }}>Primary Blocker:</span> {present.primary_blocker || present.primary_constraint || "No immediate constraints identified."}
                    </p>

                    {present.weekly_cost_estimate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(249, 215, 28, 0.08)', padding: '12px 16px', borderRadius: '12px', width: 'fit-content', marginBottom: '16px' }}>
                            <span style={{ color: '#f9d71c', fontWeight: 600, fontSize: '0.9rem' }}>Cost:</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{present.weekly_cost_estimate}</span>
                        </div>
                    )}

                    {present.physical_reframe && (
                        <div style={{ background: 'rgba(249, 215, 28, 0.08)', padding: '16px', borderRadius: '12px', borderLeft: '2px solid rgba(249, 215, 28, 0.3)' }}>
                            <span style={{ display: 'block', fontSize: '0.85rem', color: '#f9d71c', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>Physical Reframe</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>{present.physical_reframe}</span>
                        </div>
                    )}
                </div>

                {/* Future Card */}
                <div style={{ background: 'rgba(130, 202, 255, 0.03)', border: '1px solid rgba(130, 202, 255, 0.15)', borderRadius: '24px', padding: 'clamp(24px, 4vw, 32px)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #82caff, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ background: 'rgba(130, 202, 255, 0.1)', padding: '10px', borderRadius: '12px' }}>
                                <AlertTriangle size={24} color="#82caff" />
                            </div>
                            <h4 style={{ color: '#82caff', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Future Trajectory</h4>
                        </div>
                    </div>

                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '4px', marginBottom: '24px' }}>
                        <button
                            onClick={() => setFutureToggle('failure')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: futureToggle === 'failure' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: futureToggle === 'failure' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: futureToggle === 'failure' ? 600 : 400,
                                transition: 'all 0.2s'
                            }}
                        >
                            If nothing changes
                        </button>
                        <button
                            onClick={() => setFutureToggle('success')}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: futureToggle === 'success' ? 'rgba(130, 202, 255, 0.2)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: futureToggle === 'success' ? '#82caff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontWeight: futureToggle === 'success' ? 600 : 400,
                                transition: 'all 0.2s'
                            }}
                        >
                            Your future self
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={futureToggle}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                                {futureToggle === 'failure'
                                    ? (future.failure_simulation || "Trajectory simulation pending.")
                                    : (future.success_simulation || "Success simulation pending.")}
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Strategic Intervention (Mentor Message & Micro Task) */}
            <motion.div variants={itemVariants} style={{ background: 'rgba(10, 10, 10, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px', padding: 'clamp(24px, 5vw, 48px)', position: 'relative', overflow: 'hidden' }}>
                {/* Subtle background glow */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%', background: 'radial-gradient(circle at center, rgba(130, 202, 255, 0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    {(integration.mentor_persona) && (
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '32px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '30px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                <Target size={14} /> Persona: {integration.mentor_persona}
                            </span>
                        </div>
                    )}

                    {integration.message_from_mentor && (
                        <div style={{ maxWidth: '800px', marginBottom: '48px' }}>
                            <h3 style={{ fontSize: '1.75rem', fontWeight: 600, marginBottom: '24px', color: 'var(--text-primary)' }}>The Strategic Intervention</h3>
                            <p style={{ fontSize: '1.2rem', lineHeight: 1.8, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                "{integration.message_from_mentor}"
                            </p>
                        </div>
                    )}

                    {/* Immediate Action - The Micro Task */}
                    {localMicroTask && (
                        <div style={{
                            background: 'linear-gradient(145deg, rgba(80, 250, 123, 0.1) 0%, rgba(80, 250, 123, 0.02) 100%)',
                            border: '1px solid rgba(80, 250, 123, 0.2)',
                            borderRadius: '24px',
                            padding: 'clamp(24px, 4vw, 32px)',
                            maxWidth: '600px',
                            width: '100%',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Rocket size={24} color="#50fa7b" />
                                    <h4 style={{ color: '#50fa7b', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Immediate Micro-Action</h4>
                                </div>
                                <div style={{
                                    background: 'rgba(0,0,0,0.5)',
                                    padding: '6px 12px',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer'
                                }} onClick={() => setTimerActive(!timerActive)}>
                                    <span style={{ color: timerActive ? '#ff7b7b' : 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 600 }}>
                                        {formatTime(timeLeft)}
                                    </span>
                                </div>
                            </div>
                            <h5 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '8px', fontWeight: 500 }}>{localMicroTask.title}</h5>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>{localMicroTask.description}</p>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(249, 215, 28, 0.1)', padding: '8px 16px', borderRadius: '20px', marginBottom: '24px' }}>
                                <span style={{ color: '#f9d71c', fontSize: '0.9rem', fontWeight: 600 }}>🎁 Expected Reward:</span>
                                <span style={{ color: 'rgba(249, 215, 28, 0.9)', fontSize: '0.9rem' }}>{localMicroTask.reward}</span>
                            </div>

                            {/* Check-in Module */}
                            <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '16px' }}>Submit Action Result:</h4>

                                <AnimatePresence mode="wait">
                                    {checkInPhase === 'initial' && (
                                        <motion.div key="initial" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => handleInitialCheckInClick('success')}
                                                style={{ flex: '1 1 auto', minWidth: '150px', background: 'rgba(80, 250, 123, 0.15)', border: '1px solid #50fa7b', color: '#50fa7b', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease' }}
                                            >
                                                ✅ I completed this
                                            </button>
                                            <button
                                                onClick={() => handleInitialCheckInClick('failure')}
                                                style={{ flex: '1 1 auto', minWidth: '150px', background: 'rgba(255, 123, 123, 0.15)', border: '1px solid #ff7b7b', color: '#ff7b7b', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s ease' }}
                                            >
                                                ❌ I struggled, adjust plan
                                            </button>
                                        </motion.div>
                                    )}

                                    {checkInPhase === 'success_details' && (
                                        <motion.form key="success" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={(e) => { e.preventDefault(); submitFinalCheckIn('Completed'); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <p style={{ color: '#50fa7b', fontSize: '0.95rem', margin: 0 }}>Awesome. What made it easier to start than usual?</p>
                                            <input type="text" value={userFeedback} onChange={(e) => setUserFeedback(e.target.value)} required placeholder="e.g., The timer helped, or it felt small enough..." style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(80,250,123,0.3)', color: 'white', padding: '12px', borderRadius: '8px', outline: 'none' }} />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="submit" disabled={isCheckingIn || !userFeedback} style={{ flex: 1, background: '#50fa7b', color: 'black', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: (!userFeedback || isCheckingIn) ? 'not-allowed' : 'pointer', opacity: (!userFeedback || isCheckingIn) ? 0.7 : 1 }}>
                                                    {isCheckingIn ? <Loader2 className="spinner" size={16} /> : 'Submit Momentum'}
                                                </button>
                                                <button type="button" onClick={() => setCheckInPhase('initial')} style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                                            </div>
                                        </motion.form>
                                    )}

                                    {checkInPhase === 'failure_details' && (
                                        <motion.form key="failure" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={(e) => { e.preventDefault(); submitFinalCheckIn('Struggled'); }} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <p style={{ color: '#ff7b7b', fontSize: '0.95rem', margin: 0 }}>That's okay. Where exactly did it break down?</p>
                                            <input type="text" value={userFeedback} onChange={(e) => setUserFeedback(e.target.value)} required placeholder="e.g., I got distracted by email, or I felt too tired..." style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,123,123,0.3)', color: 'white', padding: '12px', borderRadius: '8px', outline: 'none' }} />
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button type="submit" disabled={isCheckingIn || !userFeedback} style={{ flex: 1, background: '#ff7b7b', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: (!userFeedback || isCheckingIn) ? 'not-allowed' : 'pointer', opacity: (!userFeedback || isCheckingIn) ? 0.7 : 1 }}>
                                                    {isCheckingIn ? <Loader2 className="spinner" size={16} /> : 'Recalibrate'}
                                                </button>
                                                <button type="button" onClick={() => setCheckInPhase('initial')} style={{ background: 'transparent', color: 'var(--text-secondary)', padding: '12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                                            </div>
                                        </motion.form>
                                    )}

                                    {checkInPhase === 'complete' && (
                                        <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: 'rgba(130, 202, 255, 0.1)', border: '1px solid rgba(130, 202, 255, 0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                                            <p style={{ color: 'var(--text-primary)', margin: 0, fontSize: '0.95rem', fontStyle: 'italic' }}>
                                                {feedbackMessage || "Feedback recorded. Watch the path adjust."}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* The 6-Month Victory Path */}
            {Array.isArray(localRoadmap) && localRoadmap.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} style={{ marginTop: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                        <div style={{ background: 'var(--text-primary)', padding: '12px', borderRadius: '16px' }}>
                            <Calendar size={28} color="var(--bg-primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>6-Month Victory Path</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '8px' }}>Your customized trajectory based on your constraints and goals.</p>
                        </div>
                    </div>

                    <div style={{ position: 'relative', paddingLeft: '40px' }}>
                        {/* The Spine */}
                        <div style={{ position: 'absolute', left: '14px', top: '10px', bottom: '0', width: '2px', background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), rgba(255,255,255,0.05))' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                            {localRoadmap.map((month, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.5, delay: idx * 0.1 }}
                                    style={{ position: 'relative' }}
                                >
                                    {/* Spine Node */}
                                    <div style={{ position: 'absolute', left: '-34px', top: '24px', width: '16px', height: '16px', borderRadius: '50%', background: 'var(--bg-primary)', border: '2px solid var(--text-accent)', zIndex: 2 }} />

                                    <div style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        borderRadius: '24px',
                                        padding: 'clamp(24px, 4vw, 32px)',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div
                                            onClick={() => toggleMonth(idx)}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', marginBottom: expandedMonths.includes(idx) ? '16px' : '0' }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <span style={{ color: 'var(--text-accent)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                                        {month.phase}
                                                    </span>
                                                    <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '1.5rem', fontWeight: 800, lineHeight: 1 }}>{idx < 9 ? `0${idx + 1}` : idx + 1}</span>
                                                </div>
                                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600, marginBottom: '8px', lineHeight: 1.3 }}>
                                                    {month.theme}
                                                </h4>
                                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                                                    {month.expected_result}
                                                </p>
                                            </div>
                                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', color: 'var(--text-secondary)' }}>
                                                {expandedMonths.includes(idx) ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {expandedMonths.includes(idx) && Array.isArray(month.weeks) && month.weeks.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    style={{ overflow: 'hidden' }}
                                                >
                                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                        {month.weeks.map((week, wIdx) => (
                                                            <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                                                <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                                                    <CheckCircle2 size={18} color="rgba(255,255,255,0.3)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                                                    <div style={{ flex: 1 }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <div style={{ color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 600, marginBottom: '6px' }}>{week.week}: {week.focus}</div>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setActiveChatWeek(activeChatWeek === `${month.phase}_${week.week}` ? null : `${month.phase}_${week.week}`); }}
                                                                                style={{ background: 'rgba(80, 250, 123, 0.1)', color: '#50fa7b', border: '1px solid rgba(80, 250, 123, 0.2)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                                                            >
                                                                                <MessageSquare size={14} /> Mentor
                                                                            </button>
                                                                        </div>
                                                                        {week.win_condition ? (
                                                                            <div style={{ color: '#50fa7b', fontSize: '0.9rem', fontWeight: 600, marginTop: '8px', marginBottom: '12px' }}>🏆 Win Condition: {week.win_condition}</div>
                                                                        ) : (
                                                                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '12px' }}>{week.outcome}</div>
                                                                        )}

                                                                        {/* Day-by-Day View */}
                                                                        {Array.isArray(week.days) && week.days.length > 0 && (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-accent)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>Day-by-Day Action Plan</span>
                                                                                {week.days.map((day, dIdx) => (
                                                                                    <div key={dIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', paddingBottom: '8px', borderBottom: dIdx === week.days!.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)' }}>
                                                                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', minWidth: '45px', fontWeight: 600, marginTop: '2px' }}>{day.day_name}</span>
                                                                                        <span style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{day.action}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}

                                                                        {/* Embedded Chat System */}
                                                                        <AnimatePresence>
                                                                            {activeChatWeek === `${month.phase}_${week.week}` && (
                                                                                <motion.div
                                                                                    initial={{ opacity: 0, height: 0 }}
                                                                                    animate={{ opacity: 1, height: 'auto' }}
                                                                                    exit={{ opacity: 0, height: 0 }}
                                                                                    style={{ marginTop: '16px', background: 'rgba(10,10,10,0.8)', borderRadius: '12px', border: '1px solid rgba(130, 202, 255, 0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                                                                                >
                                                                                    <div style={{ background: 'rgba(130, 202, 255, 0.1)', padding: '12px 16px', borderBottom: '1px solid rgba(130, 202, 255, 0.2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                        <BrainCircuit size={16} color="#82caff" />
                                                                                        <span style={{ color: '#82caff', fontSize: '0.9rem', fontWeight: 600 }}>{week.week} Mentor Chat</span>
                                                                                    </div>

                                                                                    {/* Messages Area */}
                                                                                    <div style={{ padding: '16px', maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                                                        {chatMessages[`${month.phase}_${week.week}`]?.length > 0 ? (
                                                                                            chatMessages[`${month.phase}_${week.week}`].map((msg, mIdx) => (
                                                                                                <div key={mIdx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                                                                                    <div style={{
                                                                                                        background: msg.role === 'user' ? 'rgba(80, 250, 123, 0.1)' : 'rgba(255,255,255,0.05)',
                                                                                                        color: msg.role === 'user' ? '#50fa7b' : 'var(--text-primary)',
                                                                                                        padding: '10px 14px',
                                                                                                        borderRadius: msg.role === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                                                                                        maxWidth: '85%',
                                                                                                        fontSize: '0.9rem',
                                                                                                        lineHeight: 1.5,
                                                                                                        border: `1px solid ${msg.role === 'user' ? 'rgba(80, 250, 123, 0.3)' : 'rgba(255,255,255,0.1)'}`
                                                                                                    }}>
                                                                                                        {msg.content}
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))
                                                                                        ) : (
                                                                                            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '20px 0', fontStyle: 'italic' }}>
                                                                                                "How is {week.week} feeling so far? Remember, I'm here to make things impossibly easy for you. Ask me anything."
                                                                                            </div>
                                                                                        )}
                                                                                        {isChatting && (
                                                                                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                                                                                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '12px 12px 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                                    <Loader2 size={14} className="spinner" color="var(--text-secondary)" />
                                                                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Mentor typing...</span>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                        <div ref={messagesEndRef} />
                                                                                    </div>

                                                                                    {/* Input Area */}
                                                                                    <form onSubmit={(e) => handleChatSubmit(e, { ...week, phase: month.phase })} style={{ display: 'flex', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)', gap: '8px' }}>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={chatInput}
                                                                                            onChange={(e) => setChatInput(e.target.value)}
                                                                                            placeholder="Ask for help or modify the plan..."
                                                                                            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '0.9rem', outline: 'none' }}
                                                                                        />
                                                                                        <button
                                                                                            type="submit"
                                                                                            disabled={isChatting || !chatInput.trim()}
                                                                                            style={{ background: '#82caff', color: '#000', border: 'none', borderRadius: '8px', padding: '0 16px', cursor: (isChatting || !chatInput.trim()) ? 'not-allowed' : 'pointer', opacity: (isChatting || !chatInput.trim()) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                                        >
                                                                                            <Send size={18} />
                                                                                        </button>
                                                                                    </form>
                                                                                </motion.div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            ))}
                            
                            {/* Streaming Indicator */}
                            {localRoadmap.length < 6 && (
                                <motion.div 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={{ position: 'relative', display: 'flex', gap: '16px', alignItems: 'center', paddingLeft: '4px' }}
                                >
                                    <div className="spinner" style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#50fa7b' }} />
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', fontStyle: 'italic' }}>
                                        Orchestrating Month {localRoadmap.length + 1}...
                                    </span>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Bottom Action / Save Gate */}
            <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '60px' }}>

                <div style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '24px',
                    padding: '40px',
                    maxWidth: '500px',
                    width: '100%',
                    textAlign: 'center',
                    marginBottom: '24px'
                }}>
                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: '16px' }}>Save Your Blueprint</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.5 }}>
                        Don't lose this breakthough. We've built a system around this exact blueprint to keep you accountable.
                    </p>

                    {saveSuccess ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#50fa7b', background: 'rgba(80, 250, 123, 0.1)', padding: '12px 24px', borderRadius: '12px' }}>
                            <CheckCircle2 size={20} /> Blueprint secured. Check your inbox.
                        </div>
                    ) : (
                        <form onSubmit={handleSaveBlueprint} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid var(--border-color)',
                                    color: 'white',
                                    padding: '16px 20px',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                disabled={isSaving || !email}
                                style={{
                                    width: '100%',
                                    background: 'var(--accent-glow)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '16px',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    fontSize: '1.05rem',
                                    cursor: (isSaving || !email) ? 'not-allowed' : 'pointer',
                                    opacity: (isSaving || !email) ? 0.7 : 1,
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}
                            >
                                {isSaving ? <Loader2 className="spinner" size={20} /> : 'Send to my Inbox'}
                            </button>
                        </form>
                    )}
                </div>

                <button
                    onClick={resetIntegration}
                    className="group"
                    style={{
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        padding: '12px 24px',
                        borderRadius: '30px',
                        fontWeight: 500,
                        fontSize: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    Start New Analysis
                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </motion.div>

        </motion.div>
    );
};

export default ResultsDashboard;
