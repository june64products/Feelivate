"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, BrainCircuit, User, Sparkles, X } from 'lucide-react';
import { chatGlobal, getSessionHistory } from '@/lib/api';

interface Message {
    role: string;
    content: string;
}

interface ChatInterfaceProps {
    userId: string;
    sessionId: string;
    roadmap: any;
    isOpen: boolean;
    onClose: () => void;
}

export default function ChatInterface({ userId, sessionId, roadmap, isOpen, onClose }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            const fetchHistory = async () => {
                try {
                    const history = await getSessionHistory(sessionId);
                    if (history && history.length > 0) {
                        setMessages(history);
                    }
                } catch (err) {
                    console.error("Failed to load chat history:", err);
                }
            };
            fetchHistory();
        }
    }, [messages.length, isOpen, sessionId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = { role: 'user', content: input };
        const updatedHistory = [...messages, userMsg];
        
        setMessages(updatedHistory);
        setInput('');
        setIsLoading(true);

        try {
            const response = await chatGlobal({
                user_id: userId,
                session_id: sessionId,
                message: input,
                full_roadmap: roadmap,
                chat_history: messages // Pass history without the current user message as backend adds it
            });

            if (response.response_message) {
                setMessages([...updatedHistory, { role: 'assistant', content: response.response_message }]);
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages([...updatedHistory, { role: 'assistant', content: "SYSTEM ERROR: Could not synchronize with the Global Mentor. Please check your temporal connection." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="fixed right-0 top-0 h-screen w-full md:w-[450px] bg-deep-cosmic/95 backdrop-blur-3xl border-l border-white/5 z-[100] flex flex-col shadow-2xl"
        >
            {/* Header */}
            <div className="p-6 border-bottom border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-neon-cyan/20 flex items-center justify-center border border-neon-cyan/30">
                        <BrainCircuit className="w-5 h-5 text-neon-cyan" />
                    </div>
                    <div>
                        <h3 className="font-syncopate text-xs font-black text-white tracking-widest uppercase mb-1">GLOBAL MENTOR</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                            <span className="text-[9px] font-space-mono text-neon-cyan uppercase tracking-widest">Temporal Node Active</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                >
                    <X className="w-5 h-5 text-white/30 group-hover:text-white" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                        <Sparkles className="w-12 h-12 text-neon-cyan opacity-20" />
                        <div className="space-y-2">
                            <p className="font-space-mono text-xs text-white/40 leading-relaxed max-w-[250px]">
                                Your roadmap is fully synthesized. Ask me about your risks, trajectory, or specific action blocks.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div 
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center border ${
                                msg.role === 'user' ? 'bg-vivid-purple/20 border-vivid-purple/30' : 'bg-neon-cyan/20 border-neon-cyan/30'
                            }`}>
                                {msg.role === 'user' ? <User className="w-4 h-4 text-vivid-purple" /> : <BrainCircuit className="w-4 h-4 text-neon-cyan" />}
                            </div>
                            <div className={`p-4 rounded-2xl text-xs font-space-mono leading-relaxed ${
                                msg.role === 'user' 
                                ? 'bg-vivid-purple/10 text-vivid-purple border border-vivid-purple/20 rounded-tr-none' 
                                : 'bg-white/5 text-white/80 border border-white/10 rounded-tl-none shadow-xl'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-neon-cyan/20 border border-neon-cyan/30 flex items-center justify-center">
                                <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl rounded-tl-none border border-white/10">
                                <div className="flex gap-1.5">
                                    <div className="w-1 h-1 bg-neon-cyan rounded-full animate-bounce" />
                                    <div className="w-1 h-1 bg-neon-cyan rounded-full animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-1 h-1 bg-neon-cyan rounded-full animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-white/5 bg-white/5">
                <form onSubmit={handleSubmit} className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Query the mentor..."
                        className="w-full bg-deep-cosmic border border-white/10 rounded-2xl py-4 pl-6 pr-14 text-xs font-space-mono text-white placeholder:text-white/20 focus:outline-none focus:border-neon-cyan/50 transition-colors shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-neon-cyan rounded-xl text-deep-cosmic disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
                <p className="mt-4 text-[9px] text-center font-space-mono text-white/20 uppercase tracking-[0.2em]">
                    Powered by OpenAI v4.0-Mini Engine
                </p>
            </div>
        </motion.div>
    );
}
