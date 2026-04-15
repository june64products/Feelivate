"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/Navbar';
import SessionSidebar from '@/components/workspace/SessionSidebar';
import InputForm from '@/components/workspace/InputForm';
import ResultsDashboard from '@/components/workspace/ResultsDashboard';
import { submitIngestStream, getSessionDetail } from '@/lib/api';
import { Loader2, Sparkles, BrainCircuit } from 'lucide-react';

export default function Workspace() {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [sidebarKey, setSidebarKey] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [pollStatus, setPollStatus] = useState('');

    useEffect(() => {
        const storedUserId = localStorage.getItem('user_id');
        if (!storedUserId) {
            router.push('/login');
        } else {
            setUserId(storedUserId);
        }
    }, [router]);

    const handleSelectSession = async (sessionId: string) => {
        try {
            setProcessing(true);
            setActiveSessionId(sessionId);
            const data = await getSessionDetail(sessionId);
            
            if (data.session?.result) {
                setResult({
                    user_id: userId,
                    session_id: data.session.id,
                    ...data.session.result
                });
            } else {
                setResult(null);
                alert("This session is still being processed or has no results.");
            }
        } catch (error) {
            console.error("Failed to load session:", error);
            alert("Could not load the selected journey.");
        } finally {
            setProcessing(false);
        }
    };

    const handleNewJourney = () => {
        setActiveSessionId(null);
        setResult(null);
        setProcessing(false);
    };

    const handleIngest = async (text: string) => {
        try {
            setProcessing(true);
            setResult(null);
            setPollStatus("🔍 INITIALIZING AGENTS...");

            await submitIngestStream({
                user_id: userId || 'anonymous',
                text
            }, (chunk) => {
                if (chunk.type === 'structured') {
                    const focusText = chunk.focus || "UNDEFINED PATTERN";
                    setPollStatus(`🧠 PATTERN DETECTED: ${focusText.substring(0, 30).toUpperCase()}...`);
                } else if (chunk.type === 'initial') {
                    setResult({
                        user_id: userId,
                        session_id: chunk.session_id,
                        past: chunk.past,
                        present: chunk.present,
                        future: chunk.future,
                        integration: {
                            ...(chunk.integration_meta || {}),
                            roadmap: chunk.first_month ? [chunk.first_month] : []
                        }
                    });
                    setProcessing(false); 
                    setActiveSessionId(chunk.session_id);
                    setSidebarKey(prev => prev + 1);
                } else if (chunk.type === 'month') {
                    setResult((prev: any) => {
                        if (!prev) return prev;
                        const roadmap = prev.integration.roadmap || [];
                        if (roadmap.some((m: any) => m.phase === chunk.month.phase)) return prev;
                        
                        return {
                            ...prev,
                            integration: {
                                ...prev.integration,
                                roadmap: [...roadmap, chunk.month]
                            }
                        };
                    });
                } else if (chunk.type === 'error') {
                    alert("Analysis error: " + chunk.message);
                    setProcessing(false);
                }
            });

        } catch (error) {
            console.error("Failed to start analysis:", error);
            setProcessing(false);
            alert("Failed to connect to the backend engine.");
        }
    };

    if (!userId) {
        return (
            <div className="min-h-screen bg-deep-cosmic flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-neon-cyan" />
            </div>
        );
    }

    return (
        <main className="relative min-h-screen bg-deep-cosmic overflow-x-hidden selection:bg-rose-pink selection:text-white">
            <div className="aurora-bg" />
            <div className="noise-overlay" />
            <Navbar />

            <div className="flex pt-[88px] min-h-screen relative z-10">
                <SessionSidebar 
                    key={sidebarKey}
                    userId={userId} 
                    activeSessionId={activeSessionId}
                    onSelectSession={handleSelectSession}
                    onNewJourney={handleNewJourney}
                />

                <div className="flex-1 px-6 py-12 md:px-12 md:pl-[380px] transition-all duration-700">
                    <div className="max-w-6xl mx-auto w-full">
                        <AnimatePresence mode="wait">
                            {!processing && !result && (
                                <motion.div
                                    key="welcome"
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                                >
                                    <div className="inline-flex items-center gap-3 mb-8 px-4 py-2 rounded-full bg-white/5 border border-white/5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                                        <span className="text-[9px] uppercase font-black tracking-[0.4em] text-neon-cyan">
                                            Behavioral Engine v2.0
                                        </span>
                                    </div>
                                    <h1 className="font-syncopate text-4xl md:text-6xl font-black text-white mb-6 leading-tight max-w-4xl">
                                        UNTANGLE YOUR <span className="text-neon-cyan">REALITY</span>
                                    </h1>
                                    <p className="font-space-mono text-white/40 max-w-xl mb-12 text-sm leading-relaxed">
                                        Translate your unstructured thoughts and recurring patterns into a strategic emotional roadmap.
                                    </p>
                                    <InputForm onSubmit={handleIngest} isLoading={processing} />
                                </motion.div>
                            )}

                            {processing && !result && (
                                <motion.div
                                    key="processing"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex flex-col items-center justify-center min-h-[60vh] text-center bg-glass border border-white/5 backdrop-blur-3xl rounded-[3rem] p-16 max-w-2xl mx-auto"
                                >
                                    <div className="relative w-24 h-24 mb-12">
                                        <div className="absolute inset-0 rounded-full border-2 border-neon-cyan/10 animate-ping" />
                                        <div className="absolute inset-2 rounded-full border-2 border-vivid-purple/20 animate-ping [animation-delay:0.5s]" />
                                        <div className="absolute inset-4 rounded-full border-2 border-white/10 flex items-center justify-center">
                                            <BrainCircuit className="w-8 h-8 text-neon-cyan animate-pulse" />
                                        </div>
                                    </div>
                                    <h3 className="font-syncopate text-2xl font-bold mb-4 text-white uppercase tracking-tighter">
                                        Orchestrating 13 Agents
                                    </h3>
                                    <div className="h-6 overflow-hidden">
                                        <AnimatePresence mode="wait">
                                            <motion.p
                                                key={pollStatus}
                                                initial={{ y: 20, opacity: 0 }}
                                                animate={{ y: 0, opacity: 1 }}
                                                exit={{ y: -20, opacity: 0 }}
                                                className="text-neon-cyan font-black text-[10px] tracking-[0.4em] font-space-mono uppercase"
                                            >
                                                {pollStatus || "Initializing sequence..."}
                                            </motion.p>
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            )}

                            {result && (
                                <motion.div
                                    key="results"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                >
                                    <ResultsDashboard
                                        data={result}
                                        userId={userId}
                                        sessionId={activeSessionId || ''}
                                        resetIntegration={handleNewJourney}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </main>
    );
}
