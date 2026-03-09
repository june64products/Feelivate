import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import InputForm from '../components/workspace/InputForm';
import ResultsDashboard from '../components/workspace/ResultsDashboard';
import { submitIngest, fetchResult, type IngestResponse } from '../api';

const WorkspacePage = () => {
    const navigate = useNavigate();
    const [userId] = useState(() => `user_${Math.random().toString(36).substr(2, 8)}`);
    const [traceId, setTraceId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [pollStatus, setPollStatus] = useState('');

    const handleIngest = async (text: string) => {
        try {
            setProcessing(true);
            const res: IngestResponse = await submitIngest({
                user_id: userId,
                text
            });
            setTraceId(res.trace_id);
        } catch (error) {
            console.error("Failed to start analysis:", error);
            setProcessing(false);
            alert("Failed to connect to the backend engine.");
        }
    };

    useEffect(() => {
        if (!traceId || !processing) return;

        let isMounted = true;

        const steps = [
            "🔍 Accessing Vector Memory (Qdrant)...",
            "🕵️ PastPatternAgent is scanning for contradictions...",
            "🛑 PresentConstraintAgent is checking energy levels...",
            "🎲 FutureSimulatorAgent is running pre-mortems...",
            "🏗️ IntegrationAgent is building your Micro-Plan..."
        ];
        let stepIndex = 0;

        const textInterval = setInterval(() => {
            if (isMounted) {
                setPollStatus(steps[stepIndex % steps.length]);
                stepIndex++;
            }
        }, 1500);

        const pollBackend = async () => {
            if (!isMounted) return;
            try {
                const data = await fetchResult(traceId);

                if (data && data.integration) {
                    if (isMounted) {
                        setResult(data);
                        setProcessing(false);
                        clearInterval(textInterval);
                    }
                } else if (data && data.status === 'error') {
                    if (isMounted) {
                        setProcessing(false);
                        clearInterval(textInterval);
                        alert("Agents encountered an error: " + data.error);
                    }
                } else {
                    // Continue polling
                    setTimeout(pollBackend, 2000);
                }
            } catch (e) {
                console.error("Polling error:", e);
                // Retry on network errors
                setTimeout(pollBackend, 2000);
            }
        };

        pollBackend();

        return () => {
            isMounted = false;
            clearInterval(textInterval);
        };
    }, [traceId, processing]);


    return (
        <div style={{
            minHeight: '100vh',
            padding: 'var(--nav-height) 24px 80px',
            position: 'relative',
            background: 'var(--bg-primary)'
        }}>
            {/* Ambient Background Glow */}
            <div style={{
                position: 'fixed',
                top: '-10%',
                right: '-10%',
                width: '50vw',
                height: '50vw',
                background: 'radial-gradient(circle, rgba(130, 202, 255, 0.05) 0%, transparent 70%)',
                zIndex: 0,
                pointerEvents: 'none'
            }} />

            {/* Workspace Navbar */}
            <nav style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                height: 'var(--nav-height)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 40px',
                background: 'rgba(10, 10, 10, 0.7)',
                backdropFilter: 'blur(16px)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                zIndex: 100
            }}>
                <div
                    onClick={() => navigate('/')}
                    style={{
                        fontWeight: 600,
                        fontSize: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        background: 'rgba(255,255,255,0.05)',
                        transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    <span style={{ color: 'var(--text-secondary)' }}>←</span> Leave Workspace
                </div>
            </nav>

            <div style={{ position: 'relative', zIndex: 1, marginTop: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', marginBottom: '16px', fontWeight: 700 }} className="text-gradient">
                        Behavioral Architecture Engine v2.0
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
                        Transform unstructured thoughts into a high-fidelity emotional blueprint.
                    </p>
                </div>

                {!processing && !result && (
                    <InputForm onSubmit={handleIngest} isLoading={processing} />
                )}

                {processing && !result && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '100px auto',
                        maxWidth: '600px',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '60px 40px',
                        borderRadius: '24px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 0 40px rgba(130, 202, 255, 0.05)'
                    }}>
                        <div className="spinner" style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            border: '3px solid rgba(130, 202, 255, 0.1)',
                            borderTopColor: 'var(--accent-glow)',
                            marginBottom: '32px'
                        }} />
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            The Agents are orchestrating...
                        </h3>
                        <p style={{
                            color: 'var(--text-accent)',
                            fontSize: '1.1rem',
                            height: '24px',
                            transition: 'opacity 0.3s'
                        }}>
                            {pollStatus || "Initializing agents..."}
                        </p>
                    </div>
                )}

                {result && (
                    <div style={{ animation: 'fadeIn 0.5s ease' }}>
                        <ResultsDashboard
                            data={result}
                            resetIntegration={() => {
                                setResult(null);
                                setTraceId(null);
                            }}
                        />
                    </div>
                )}
            </div>

            <style>{`
                .spinner {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default WorkspacePage;
