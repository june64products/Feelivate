import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Target, AlertTriangle, Zap, BrainCircuit, Rocket, Activity, ChevronRight } from 'lucide-react';

interface WeekDetails {
    week: string;
    focus: string;
    outcome: string;
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
    if (!data) return null;

    const past = data.past || {};
    const present = data.present || {};
    const future = data.future || {};
    const integration = data.integration || {};
    const roadmap: MonthPhase[] = integration.roadmap || [];

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
            <motion.div variants={itemVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

                {/* Past Card */}
                <div style={{ background: 'rgba(255, 123, 123, 0.03)', border: '1px solid rgba(255, 123, 123, 0.15)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
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
                    {past.predicted_context && (
                        <div style={{ background: 'rgba(255, 123, 123, 0.08)', padding: '16px', borderRadius: '12px', borderLeft: '2px solid rgba(255,123,123,0.3)' }}>
                            <span style={{ display: 'block', fontSize: '0.85rem', color: '#ff7b7b', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>Deep Insight</span>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>{past.predicted_context}</span>
                        </div>
                    )}
                </div>

                {/* Present Card */}
                <div style={{ background: 'rgba(249, 215, 28, 0.03)', border: '1px solid rgba(249, 215, 28, 0.15)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #f9d71c, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(249, 215, 28, 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <Zap size={24} color="#f9d71c" />
                        </div>
                        <h4 style={{ color: '#f9d71c', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Present Constraint</h4>
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '1.05rem', marginBottom: '24px' }}>
                        {present.primary_constraint || "No immediate constraints identified."}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(249, 215, 28, 0.08)', padding: '12px 16px', borderRadius: '12px', width: 'fit-content' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Energy Capacity:</span>
                        <span style={{ color: '#f9d71c', fontWeight: 600, fontSize: '0.95rem' }}>{present.energy_level || "Unknown"}</span>
                    </div>
                </div>

                {/* Future Card */}
                <div style={{ background: 'rgba(130, 202, 255, 0.03)', border: '1px solid rgba(130, 202, 255, 0.15)', borderRadius: '24px', padding: '32px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'linear-gradient(to bottom, #82caff, transparent)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(130, 202, 255, 0.1)', padding: '10px', borderRadius: '12px' }}>
                            <AlertTriangle size={24} color="#82caff" />
                        </div>
                        <h4 style={{ color: '#82caff', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Future Trajectory</h4>
                    </div>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.7, fontSize: '1.05rem' }}>
                        {future.failure_simulation || "Trajectory simulation pending."}
                    </p>
                </div>
            </motion.div>

            {/* Strategic Intervention (Mentor Message & Micro Task) */}
            <motion.div variants={itemVariants} style={{ background: 'rgba(10, 10, 10, 0.6)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '32px', padding: '48px', position: 'relative', overflow: 'hidden' }}>
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
                    {integration.micro_task && (
                        <div style={{
                            background: 'linear-gradient(145deg, rgba(80, 250, 123, 0.1) 0%, rgba(80, 250, 123, 0.02) 100%)',
                            border: '1px solid rgba(80, 250, 123, 0.2)',
                            borderRadius: '24px',
                            padding: '32px',
                            maxWidth: '600px',
                            width: '100%',
                            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                                <Rocket size={24} color="#50fa7b" />
                                <h4 style={{ color: '#50fa7b', fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Immediate Micro-Action</h4>
                            </div>
                            <h5 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '8px', fontWeight: 500 }}>{integration.micro_task.title}</h5>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>{integration.micro_task.description}</p>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(249, 215, 28, 0.1)', padding: '8px 16px', borderRadius: '20px' }}>
                                <span style={{ color: '#f9d71c', fontSize: '0.9rem', fontWeight: 600 }}>🎁 Expected Reward:</span>
                                <span style={{ color: 'rgba(249, 215, 28, 0.9)', fontSize: '0.9rem' }}>{integration.micro_task.reward}</span>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* The 6-Month Victory Path */}
            {roadmap && roadmap.length > 0 && (
                <motion.div variants={itemVariants} style={{ marginTop: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                        <div style={{ background: 'var(--text-primary)', padding: '12px', borderRadius: '16px' }}>
                            <Calendar size={28} color="var(--bg-primary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>6-Month Victory Path</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginTop: '8px' }}>Your customized trajectory based on your constraints and goals.</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
                        {roadmap.map((month, idx) => (
                            <motion.div
                                key={idx}
                                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '24px',
                                    padding: '32px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    height: '100%'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <span style={{ color: 'var(--text-accent)', fontWeight: 600, fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                        {month.phase}
                                    </span>
                                    <span style={{ color: 'rgba(255,255,255,0.1)', fontSize: '2rem', fontWeight: 800, lineHeight: 1 }}>0{idx + 1}</span>
                                </div>
                                <h4 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600, marginBottom: '12px', lineHeight: 1.3 }}>
                                    {month.theme}
                                </h4>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '24px', flexGrow: 1 }}>
                                    {month.expected_result}
                                </p>

                                {month.weeks && month.weeks.length > 0 && (
                                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {month.weeks.map((week, wIdx) => (
                                            <div key={wIdx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <CheckCircle2 size={16} color="var(--text-accent)" style={{ marginTop: '4px', flexShrink: 0 }} />
                                                <div>
                                                    <div style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500, marginBottom: '2px' }}>{week.week}: {week.focus}</div>
                                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{week.outcome}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Bottom Action */}
            <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                <button
                    onClick={resetIntegration}
                    className="group"
                    style={{
                        background: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        padding: '16px 40px',
                        borderRadius: '30px',
                        fontWeight: 600,
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                    }}
                >
                    Start New Analysis
                    <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
            </motion.div>

        </motion.div>
    );
};

export default ResultsDashboard;
