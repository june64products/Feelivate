"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, History, ChevronRight, Loader2, BrainCircuit } from 'lucide-react';
import { getUserSessions } from '@/lib/api';

interface SessionSidebarProps {
    userId: string;
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onNewJourney: () => void;
}

export default function SessionSidebar({ userId, activeSessionId, onSelectSession, onNewJourney }: SessionSidebarProps) {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await getUserSessions(userId);
                setSessions(data.sessions || []);
            } catch (err) {
                console.error("Failed to load sessions", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [userId]);

    return (
        <aside className="fixed left-6 top-[108px] bottom-10 w-[320px] bg-deep-cosmic/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] z-40 hidden md:flex flex-col shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="p-8 relative z-10">
                <button
                    onClick={onNewJourney}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-deep-cosmic font-black text-[10px] uppercase tracking-[0.2em] hover:bg-neon-cyan transition-all active:scale-[0.98] shadow-lg shadow-white/5"
                >
                    <Plus className="w-4 h-4" />
                    Initialize Evolution
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 custom-scrollbar relative z-10">
                <div className="flex items-center gap-2 px-2 mb-6 mt-4">
                    <History className="w-3.5 h-3.5 text-white/20" />
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20">Temporal Logs</span>
                </div>

                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-5 h-5 animate-spin text-neon-cyan opacity-20" />
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sessions.map((session) => (
                            <motion.button
                                key={session.id}
                                whileHover={{ x: 4 }}
                                onClick={() => onSelectSession(session.id)}
                                className={`w-full text-left p-4 rounded-2xl border transition-all group relative overflow-hidden ${
                                    activeSessionId === session.id
                                        ? 'bg-white/10 border-white/10 ring-1 ring-neon-cyan/20'
                                        : 'bg-transparent border-transparent hover:bg-white/5'
                                }`}
                            >
                                <div className="flex flex-col gap-1 relative z-10">
                                    <div className={`text-[10px] font-black uppercase tracking-wider mb-1 ${
                                        activeSessionId === session.id ? 'text-neon-cyan' : 'text-white/60'
                                    }`}>
                                        {new Date(session.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                    <div className="text-xs text-white/40 group-hover:text-white transition-colors line-clamp-2 font-space-mono lowercase leading-relaxed">
                                        {session.context || "No description loaded."}
                                    </div>
                                </div>
                                <ChevronRight className={`absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-all ${
                                    activeSessionId === session.id ? 'text-neon-cyan opacity-100' : 'text-white/10 opacity-0 group-hover:opacity-40'
                                }`} />
                                
                                {activeSessionId === session.id && (
                                    <motion.div 
                                        layoutId="active-pill"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-neon-cyan rounded-r-full shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                                    />
                                )}
                            </motion.button>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-white/5">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-cyan to-vivid-purple" />
                    <div>
                        <div className="text-[10px] font-black text-white/60 uppercase">NEURAL_ID</div>
                        <div className="text-[9px] text-neon-cyan font-bold truncate max-w-[140px] lowercase">{userId.substring(0, 16)}...</div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
