"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const navLinks = [
  { name: "Workspace", href: "/workspace" },
  { name: "Journey", href: "#" },
  { name: "Nexus", href: "#" },
];

export function Navbar() {
  const [isLogged, setIsLogged] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsLogged(!!localStorage.getItem('user_id'));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user_id');
    setIsLogged(false);
    router.push('/login');
  };

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: "circOut" }}
      className="fixed top-0 left-0 right-0 z-[60] flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md border-b border-white/5 bg-deep-cosmic/50 shadow-2xl"
    >
      <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity group">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-cyan via-vivid-purple to-rose-pink animate-pulse group-hover:scale-110 transition-transform" />
        <span className="font-syncopate font-black text-lg tracking-tighter text-white">
          EMOTION <span className="text-neon-cyan">ENGINE</span>
        </span>
      </Link>

      <div className="hidden lg:flex items-center gap-8">
        {navLinks.map((link) => (
          <Link
            key={link.name}
            href={link.href}
            className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-neon-cyan transition-all duration-300"
          >
            {link.name}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {isLogged ? (
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/workspace" 
              className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
            >
              WORKSPACE
            </Link>
            <button 
              onClick={handleLogout}
              className="px-6 py-2.5 rounded-full border border-white/10 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-rose-pink transition-all"
            >
              LOG OUT
            </button>
          </div>
        ) : (
          <div className="hidden md:flex items-center gap-6">
            <Link 
              href="/login" 
              className="text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-white transition-colors"
            >
              SIGN IN
            </Link>
            <Link 
              href="/login"
              className="px-6 py-3 rounded-full bg-white text-deep-cosmic font-black text-[10px] uppercase tracking-widest hover:bg-neon-cyan hover:scale-105 transition-all active:scale-95"
            >
              START JOURNEY
            </Link>
          </div>
        )}

        {/* Mobile Toggle */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="lg:hidden p-2 text-white/60 hover:text-white transition-colors"
        >
          <div className="w-5 h-4 relative flex flex-col justify-between">
            <motion.span 
              animate={isMenuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              className="w-full h-0.5 bg-current rounded-full" 
            />
            <motion.span 
              animate={isMenuOpen ? { opacity: 0 } : { opacity: 1 }}
              className="w-full h-0.5 bg-current rounded-full" 
            />
            <motion.span 
              animate={isMenuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              className="w-full h-0.5 bg-current rounded-full" 
            />
          </div>
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-deep-cosmic/95 backdrop-blur-xl border-b border-white/5 lg:hidden overflow-hidden"
          >
            <div className="flex flex-col p-8 gap-6">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-xs font-black uppercase tracking-[0.4em] text-white/40 hover:text-neon-cyan"
                >
                  {link.name}
                </Link>
              ))}
              <div className="h-[1px] bg-white/5 w-full my-2" />
              {isLogged ? (
                <button 
                  onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="text-left text-xs font-black uppercase tracking-[0.4em] text-rose-pink"
                >
                  LOG OUT
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-xs font-black uppercase tracking-[0.4em] text-neon-cyan"
                >
                  SIGN IN
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
