"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Sparkles, Brain, Zap, Target, LayoutPanelLeft } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";

function KineticText({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <div className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: 50, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.8,
            delay: i * 0.05,
            ease: [0.215, 0.61, 0.355, 1],
          }}
          className="inline-block mr-[0.2em] whitespace-nowrap"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
}

export default function Home() {
  const containerRef = useRef(null);
  const [isLogged, setIsLogged] = useState(false);

  useEffect(() => {
    setIsLogged(!!localStorage.getItem('user_id'));
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -200]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -500]);

  return (
    <main ref={containerRef} className="relative min-h-screen flex flex-col items-center overflow-x-hidden selection:bg-rose-pink selection:text-white">
      <div className="aurora-bg" />
      <div className="noise-overlay" />
      <Navbar />

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center pt-24 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/5 backdrop-blur-md mb-6"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
          <span className="text-[9px] uppercase font-black tracking-[0.4em] text-neon-cyan">
            Behavioral Architecture Engine v2.0
          </span>
        </motion.div>

        <KineticText
          text="SYNCHRONIZE YOUR PSYCHE"
          className="font-syncopate text-6xl md:text-[8rem] font-black tracking-tighter leading-[0.8] mb-4 text-white uppercase"
        />
        <KineticText
          text="ACROSS TEMPORAL NODES"
          className="font-syncopate text-3xl md:text-[5rem] font-light tracking-[0.2em] mb-12 text-neon-cyan opacity-80 italic uppercase"
        />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-white/40 text-sm md:text-base max-w-2xl leading-relaxed mb-12 font-space-mono font-medium"
        >
          A 13-agent neural orchestra designed to map your subconscious friction and reconstruct your reality through high-precision behavioral archaeology.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="flex gap-6"
        >
          <Link 
            href={isLogged ? "/workspace" : "/login"}
            className="relative px-10 py-5 rounded-full bg-gradient-to-r from-neon-cyan to-vivid-purple text-deep-cosmic font-black text-xs uppercase tracking-widest overflow-hidden group"
          >
            <span className="relative z-10 flex items-center gap-3">
              {isLogged ? (
                <>
                  Return to Workspace <LayoutPanelLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </>
              ) : (
                <>
                  Initiate Search <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </span>
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity" />
          </Link>
        </motion.div>
      </section>

      {/* Bento Agents Section */}
      <section className="relative z-10 w-full max-w-7xl px-6 py-32">
        <div className="grid grid-cols-1 md:grid-cols-6 md:grid-rows-2 gap-6 h-auto md:h-[700px]">
          {/* AI Agent 01: The Profiler */}
          <motion.div 
            style={{ y: typeof window !== 'undefined' && window.innerWidth > 768 ? y1 : 0 }}
            className="md:col-span-3 md:row-span-2 p-8 md:p-12 rounded-[2rem] md:rounded-[3rem] bg-glass border border-white/5 backdrop-blur-3xl flex flex-col justify-end group overflow-hidden relative"
          >
             <div className="absolute top-0 right-0 p-8">
               <Brain className="w-32 h-32 text-neon-cyan opacity-10 group-hover:opacity-30 transition-opacity duration-700" />
             </div>
             <div className="relative z-10">
               <div className="text-neon-cyan font-black text-xs tracking-widest mb-4">AGENT_01: THE PROFILER</div>
               <h3 className="font-syncopate text-4xl font-bold mb-6 group-hover:text-neon-cyan transition-colors">PSYCHOLOGICAL ARCHAEOLOGY</h3>
               <p className="text-white/40 font-space-mono text-sm leading-relaxed max-w-sm">
                 Retrieving suppressed memory clusters and behavioral loops to identify the core origin of your current reality.
               </p>
             </div>
          </motion.div>

          {/* AI Agent 02: Constraint Analyst */}
          <motion.div 
            style={{ y: typeof window !== 'undefined' && window.innerWidth > 768 ? y2 : 0 }}
            className="md:col-span-3 p-8 rounded-[2rem] md:rounded-[3rem] bg-gradient-to-br from-white/5 to-transparent border border-white/5 backdrop-blur-3xl group relative overflow-hidden"
          >
            <Zap className="absolute top-6 right-6 w-8 h-8 text-vivid-purple opacity-20 group-hover:rotate-12 transition-transform" />
            <div className="text-vivid-purple font-black text-[10px] tracking-widest mb-2">AGENT_02: THE ANALYST</div>
            <h3 className="font-syncopate text-2xl font-bold mb-4">FRICTION DETECTION</h3>
            <p className="text-white/40 font-space-mono text-xs leading-relaxed max-w-md">
              Real-time telemetry of energy, time, and emotional constraints. Identifying why your standard plans fail.
            </p>
          </motion.div>

          {/* AI Agent 03: Tension Engine */}
          <motion.div 
            className="md:col-span-3 p-8 rounded-[2rem] md:rounded-[3rem] bg-glass border border-white/5 backdrop-blur-3xl group relative overflow-hidden"
          >
            <Target className="absolute top-6 right-6 w-8 h-8 text-rose-pink opacity-20 group-hover:scale-110 transition-transform" />
            <div className="text-rose-pink font-black text-[10px] tracking-widest mb-2">AGENT_03: TENSION ENGINE</div>
            <h3 className="font-syncopate text-2xl font-bold mb-4">SUBCONSCIOUS CONFLICT</h3>
            <p className="text-white/40 font-space-mono text-xs leading-relaxed max-w-md">
              Detecting contradictions between your desires and your history to release deep-seated behavioral gridlocks.
            </p>
          </motion.div>
        </div>

        {/* Second Grid for remaining key agents */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
           <motion.div className="p-8 rounded-[3rem] bg-white/5 border border-white/5 backdrop-blur-3xl group">
             <div className="text-amber-400 font-black text-[10px] tracking-widest mb-2">AGENT_04: THE SIMULATOR</div>
             <h3 className="font-syncopate text-xl font-bold mb-4">NARRATIVE PROJECTION</h3>
             <p className="text-white/40 font-space-mono text-[11px] leading-relaxed">
               Constructing vivid 6-month futures based on current nodes. Simulating the success of your evolution.
             </p>
           </motion.div>

           <motion.div className="p-8 rounded-[3rem] bg-white/5 border border-white/5 backdrop-blur-3xl group">
             <div className="text-emerald-400 font-black text-[10px] tracking-widest mb-2">AGENT_05: THE ARCHITECT</div>
             <h3 className="font-syncopate text-xl font-bold mb-4">STRATEGIC MAPPING</h3>
             <p className="text-white/40 font-space-mono text-[11px] leading-relaxed">
               Synthesizing temporal data into hyper-realistic roadmaps. Zero-fluff, outcome-driven daily execution.
             </p>
           </motion.div>

           <motion.div className="p-8 rounded-[3rem] bg-white/5 border border-white/5 backdrop-blur-3xl group">
             <div className="text-sky-400 font-black text-[10px] tracking-widest mb-2">AGENT_06: IDENTITY ARCHITECT</div>
             <h3 className="font-syncopate text-xl font-bold mb-4">LEGACY CRYSTALLIZATION</h3>
             <p className="text-white/40 font-space-mono text-[11px] leading-relaxed">
               Creating the verbal and psychological anchors for your new identity. Defining who you must become.
             </p>
           </motion.div>
        </div>
      </section>

      {/* Large Kinetic Quote */}
      <section className="relative z-10 w-full px-6 py-64 flex flex-col items-center">
        <KineticText 
          text="Stop living in the echo of yesterday."
          className="font-syncopate text-3xl md:text-6xl font-black text-center max-w-5xl text-white/90 leading-[0.9]"
        />
        <div className="mt-12 w-24 h-[1px] bg-gradient-to-r from-transparent via-vivid-purple to-transparent" />
      </section>

      {/* New Stats Hub */}
      <section className="relative z-10 w-full py-32 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-24">
           <div className="flex-1">
             <h2 className="font-syncopate text-5xl font-black mb-8 leading-tight">THE <span className="text-rose-pink">CLARITY</span> HUB</h2>
             <p className="text-white/40 font-space-mono max-w-md leading-relaxed">
               Our engine processed over 14M temporal nodes last year, providing deep insights for thousands across the globe.
             </p>
           </div>
           <div className="grid grid-cols-2 gap-4 flex-1 w-full text-center">
            {[
                { label: "TEMPORAL NODES", val: "42M+" },
                { label: "AGENT ORCHESTRA", val: "13" },
                { label: "PRECISION", val: "99.8%" },
                { label: "CLARITY", val: "∞" }
              ].map((stat, i) => (
                <div key={i} className="p-8 rounded-[2rem] border border-white/5 bg-white/5 backdrop-blur-md">
                   <div className="text-neon-cyan font-black text-3xl mb-1">{stat.val}</div>
                   <div className="text-[10px] uppercase font-black tracking-widest text-white/30">{stat.label}</div>
                </div>
              ))}
           </div>
        </div>
      </section>

      <footer className="relative z-10 w-full py-12 px-6 flex justify-between items-center border-t border-white/5 font-space-mono text-[9px] text-white/20 uppercase tracking-[0.4em]">
         <div>© 2026 EMOTION TIME TRAVEL</div>
         <div>DESIGNED BY ANTIGRAVITY</div>
         <div>NEXT-LEVEL MOTION ASSETS LOADED</div>
      </footer>
    </main>
  );
}
