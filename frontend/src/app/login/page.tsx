"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, BrainCircuit } from 'lucide-react';
import { login, signup } from '@/lib/api';
import { Navbar } from '@/components/Navbar';

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            if (isLogin) {
                const res = await login({
                    email: formData.email,
                    password: formData.password
                });
                localStorage.setItem('user_id', res.user_id);
                router.push('/workspace');
            } else {
                const res = await signup({
                    email: formData.email,
                    password: formData.password,
                    name: formData.name
                });
                localStorage.setItem('user_id', res.user_id);
                router.push('/workspace');
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen bg-deep-cosmic flex flex-col md:flex-row overflow-hidden selection:bg-rose-pink selection:text-white">
            <div className="aurora-bg" />
            <div className="noise-overlay" />
            <Navbar />
            
            {/* Left Side: Immersive Branding */}
            <div className="hidden md:flex flex-1 relative items-center justify-center p-20 overflow-hidden border-r border-white/5">
                <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 via-transparent to-vivid-purple/10" />
                <div className="relative z-10 w-full max-w-lg">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-4 mb-12"
                    >
                        <BrainCircuit className="w-16 h-16 text-neon-cyan" />
                        <span className="font-syncopate font-black text-4xl tracking-tighter text-white">
                            EMOTION <span className="text-neon-cyan">ENGINE</span>
                        </span>
                    </motion.div>
                    
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="font-syncopate text-6xl font-black text-white mb-8 leading-tight uppercase"
                    >
                        Map Your <span className="text-gradient">Temporal</span> Destiny.
                    </motion.h2>
                    
                    <motion.p 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="font-space-mono text-white/40 text-lg leading-relaxed mb-12"
                    >
                        Sync your neural patterns with our 13-agent architecture. Transform chaos into a strategic 6-month evolution path.
                    </motion.p>
                    
                    <div className="grid grid-cols-2 gap-4 opacity-50">
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="text-[10px] font-black text-neon-cyan mb-1">PRECISION</div>
                            <div className="text-xs text-white/60 font-space-mono lowercase">0.02ms latency</div>
                        </div>
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                            <div className="text-[10px] font-black text-vivid-purple mb-1">ACCURACY</div>
                            <div className="text-xs text-white/60 font-space-mono lowercase">whisper-large-v3</div>
                        </div>
                    </div>
                </div>
                
                {/* Visual Accent */}
                <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-neon-cyan/20 blur-[120px] rounded-full" />
                <div className="absolute -top-20 -right-20 w-80 h-80 bg-vivid-purple/20 blur-[120px] rounded-full" />
            </div>

            {/* Right Side: Login Form */}
            <div className="flex-1 flex items-center justify-center p-6 md:p-20 relative z-10">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full max-w-[440px]"
                >
                    <div className="md:hidden text-center mb-12">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex items-center gap-3 mb-6"
                        >
                            <BrainCircuit className="w-10 h-10 text-neon-cyan" />
                            <span className="font-syncopate font-black text-2xl tracking-tighter text-white">
                                EMOTION <span className="text-neon-cyan">ENGINE</span>
                            </span>
                        </motion.div>
                        <h1 className="font-syncopate text-3xl font-bold mb-3 text-white uppercase">
                            {isLogin ? 'WELCOME BACK' : 'START JOURNEY'}
                        </h1>
                    </div>

                    <div className="bg-glass border border-white/10 backdrop-blur-3xl rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                        
                        <div className="relative z-10">
                            <h2 className="hidden md:block font-syncopate text-2xl font-black text-white mb-8 border-b border-white/5 pb-6 uppercase tracking-tight">
                                {isLogin ? 'AUTHORIZE ACCESS' : 'INITIALIZE PROFILE'}
                            </h2>

                            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                                <AnimatePresence mode="wait">
                                    {!isLogin && (
                                        <motion.div
                                            key="name-field"
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-2"
                                        >
                                            <label className="block text-white/40 text-[10px] uppercase font-black tracking-widest ml-1">Full Name</label>
                                            <div className="relative group">
                                                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-neon-cyan transition-colors" />
                                                <input
                                                    type="text"
                                                    required={!isLogin}
                                                    placeholder="John Doe"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                    className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-neon-cyan/50 focus:bg-white/10 transition-all font-space-mono"
                                                />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-2">
                                    <label className="block text-white/40 text-[10px] uppercase font-black tracking-widest ml-1">Email Address</label>
                                    <div className="relative group/input">
                                        <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within/input:text-neon-cyan transition-colors" />
                                        <input
                                            type="email"
                                            required
                                            placeholder="name@nexus.com"
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white text-sm outline-none focus:border-neon-cyan/50 transition-all font-space-mono"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-white/40 text-[10px] uppercase font-black tracking-widest ml-1">Access Key</label>
                                    <div className="relative group/input">
                                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within/input:text-neon-cyan transition-colors" />
                                        <input
                                            type="password"
                                            required
                                            placeholder="••••••••"
                                            value={formData.password}
                                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-5 pl-14 pr-6 text-white text-sm outline-none focus:border-neon-cyan/50 transition-all font-space-mono"
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-rose-pink text-[10px] uppercase font-black tracking-widest text-center py-2 bg-rose-pink/10 rounded-xl"
                                    >
                                        TERMINAL_ERROR: {error}
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="relative w-full py-5 rounded-2xl bg-gradient-to-r from-neon-cyan to-vivid-purple text-deep-cosmic font-black text-[10px] uppercase tracking-widest overflow-hidden group disabled:opacity-50 mt-4 shadow-[0_0_30px_rgba(34,211,238,0.2)] hover:shadow-[0_0_50px_rgba(34,211,238,0.4)] transition-all"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-3">
                                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                            <>
                                                {isLogin ? 'AUTHORIZE ACCESS' : 'INITIALIZE PROFILE'}
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </span>
                                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
                                </button>
                            </form>

                            <div className="mt-10 text-center">
                                <p className="text-white/30 text-[10px] uppercase font-black tracking-widest">
                                    {isLogin ? "No active profile?" : "Profile already active?"}
                                    <button
                                        onClick={() => setIsLogin(!isLogin)}
                                        className="ml-3 text-neon-cyan hover:text-white underline-offset-4 hover:underline transition-all"
                                    >
                                        {isLogin ? 'CREATE ONE' : 'LOG IN'}
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="mt-12 flex justify-center gap-8 opacity-20 hover:opacity-100 transition-opacity duration-1000">
                        <div className="text-[8px] font-black uppercase text-white/50 tracking-[0.4em]">SYSTEM_STABLE</div>
                        <div className="text-[8px] font-black uppercase text-white/50 tracking-[0.4em]">ENCRYPTED_AUTH</div>
                        <div className="text-[8px] font-black uppercase text-white/50 tracking-[0.4em]">V2.0.4</div>
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
