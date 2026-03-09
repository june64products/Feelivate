import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateWeeklyFocus } from '../../api';
import { Sun, Battery, BatteryMedium, BatteryFull, Target, CheckCircle2, ListChecks, Calendar } from 'lucide-react';

interface WeeklyPlannerProps {
    data: any;
}

const WeeklyPlanner = ({ data }: WeeklyPlannerProps) => {
    const [focusAreas, setFocusAreas] = useState<any[]>([]);
    const [encouragement, setEncouragement] = useState('');
    const [loading, setLoading] = useState(true);
    const [energy, setEnergy] = useState<'low' | 'medium' | 'high' | null>(null);

    // Mock progress tasks for the daily check-in
    const [checkinTasks, setCheckinTasks] = useState([
        { id: 1, title: 'Reviewed my blueprint', done: false },
        { id: 2, title: 'Kept tiny promise today', done: false },
        { id: 3, title: 'Avoided the main blocker', done: false },
    ]);

    useEffect(() => {
        const fetchFocus = async () => {
            try {
                const currentPhase = data?.integration?.roadmap?.[0]?.phase || "Month 1";
                const currentWeek = data?.integration?.roadmap?.[0]?.weeks?.[0]?.week || "Week 1";

                const res = await generateWeeklyFocus({
                    user_id: 'default_user',
                    session_id: 'default_session',
                    current_phase: currentPhase,
                    current_week: currentWeek
                });

                if (res.focus_areas) setFocusAreas(res.focus_areas);
                if (res.encouragement) setEncouragement(res.encouragement);
            } catch (err) {
                console.error("Failed to generate weekly focus:", err);
            } finally {
                setLoading(false);
            }
        };

        if (data) fetchFocus();
    }, [data]);

    const handleEnergySelect = (level: 'low' | 'medium' | 'high') => {
        setEnergy(level);
    };

    const toggleCheckin = (id: number) => {
        setCheckinTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    };

    const getPacingAdvice = () => {
        if (!energy) return "Select your energy level to calibrate today's pacing.";
        if (energy === 'low') return "Protect your baseline. Do only the absolute minimum micro-task. Anything else is a bonus. Rest is productive.";
        if (energy === 'medium') return "Steady forward momentum. Hit your core focus areas without rushing. Maintain the groove.";
        if (energy === 'high') return "Leverage this momentum. Expand your output, but stay within the boundaries of your Behavioral Focus. Do not over-commit.";
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '16px', background: 'linear-gradient(to right, #ffffff, #50fa7b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Weekly Integration
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                    Your strategic pacing for this week, generated dynamically from your 6-month blueprint.
                </p>
            </div>

            {/* Morning Energy Input */}
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <Sun size={24} color="#f9d71c" />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Morning Calibration</h3>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Scan your body and mind. What is your honest energy capacity today?</p>

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => handleEnergySelect('low')}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: energy === 'low' ? 'rgba(255, 123, 123, 0.2)' : 'rgba(0,0,0,0.3)', border: `1px solid ${energy === 'low' ? '#ff7b7b' : 'rgba(255,255,255,0.1)'}`, padding: '16px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: energy === 'low' ? '#ff7b7b' : 'var(--text-primary)' }}
                    >
                        <Battery size={20} /> <span style={{ fontWeight: 600 }}>Low / Depleted</span>
                    </button>
                    <button
                        onClick={() => handleEnergySelect('medium')}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: energy === 'medium' ? 'rgba(249, 215, 28, 0.2)' : 'rgba(0,0,0,0.3)', border: `1px solid ${energy === 'medium' ? '#f9d71c' : 'rgba(255,255,255,0.1)'}`, padding: '16px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: energy === 'medium' ? '#f9d71c' : 'var(--text-primary)' }}
                    >
                        <BatteryMedium size={20} /> <span style={{ fontWeight: 600 }}>Medium / Stable</span>
                    </button>
                    <button
                        onClick={() => handleEnergySelect('high')}
                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: energy === 'high' ? 'rgba(80, 250, 123, 0.2)' : 'rgba(0,0,0,0.3)', border: `1px solid ${energy === 'high' ? '#50fa7b' : 'rgba(255,255,255,0.1)'}`, padding: '16px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', color: energy === 'high' ? '#50fa7b' : 'var(--text-primary)' }}
                    >
                        <BatteryFull size={20} /> <span style={{ fontWeight: 600 }}>High / Primed</span>
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {energy && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', borderLeft: `3px solid ${energy === 'low' ? '#ff7b7b' : energy === 'medium' ? '#f9d71c' : '#50fa7b'}` }}>
                                <p style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{getPacingAdvice()}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Behavioral Focus Areas */}
            <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                    <Target size={24} color="#82caff" />
                    <h3 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Behavioral Focus Areas</h3>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <div className="spinner" style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid rgba(130, 202, 255, 0.2)', borderTopColor: '#82caff' }} />
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                        {focusAreas.map((area, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} style={{ background: 'rgba(130, 202, 255, 0.05)', border: '1px solid rgba(130, 202, 255, 0.2)', borderRadius: '16px', padding: '24px' }}>
                                <div style={{ color: '#82caff', fontWeight: 800, fontSize: '2rem', opacity: 0.3, marginBottom: '8px' }}>0{idx + 1}</div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '12px', fontWeight: 600 }}>{area.title}</h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>{area.description}</p>
                            </motion.div>
                        ))}
                    </div>
                )}

                {encouragement && !loading && (
                    <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', fontStyle: 'italic', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        "{encouragement}"
                    </div>
                )}
            </div>

            {/* Daily Check-in & Sunday Reflection */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <ListChecks size={24} color="#50fa7b" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Daily Check-In</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {checkinTasks.map(task => (
                            <div key={task.id} onClick={() => toggleCheckin(task.id)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: task.done ? 'rgba(80, 250, 123, 0.1)' : 'rgba(0,0,0,0.3)', border: `1px solid ${task.done ? 'rgba(80, 250, 123, 0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                                <div style={{ color: task.done ? '#50fa7b' : 'rgba(255,255,255,0.2)' }}>
                                    <CheckCircle2 size={20} />
                                </div>
                                <span style={{ color: task.done ? 'var(--text-primary)' : 'var(--text-secondary)', textDecoration: task.done ? 'line-through' : 'none' }}>
                                    {task.title}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <Calendar size={24} color="#ccaaff" />
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Sunday Reflection</h3>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, flexGrow: 1 }}>
                        At the end of the week, log your wins and friction points. This feeds back into the engine to recalibrate your next 7 days dynamically.
                    </p>
                    <button style={{ width: '100%', padding: '14px', background: 'rgba(204, 170, 255, 0.1)', border: '1px solid rgba(204, 170, 255, 0.3)', color: '#ccaaff', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(204, 170, 255, 0.2)'} onMouseLeave={e => e.currentTarget.style.background = 'rgba(204, 170, 255, 0.1)'}>
                        Start Weekly Review
                    </button>
                </div>

            </div>
        </motion.div>
    );
};

export default WeeklyPlanner;
