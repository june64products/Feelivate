import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, X } from 'lucide-react';
import { login, signup } from '../api';

// ─── Google SVG Icon ─────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335" />
  </svg>
);

// ─── Feature Cards ────────────────────────────────────────────────────────────
const features = [
  { icon: '🎯', title: 'Goal Intake', desc: 'Tell me your goal once — I ask just 3 smart questions to understand you completely.' },
  { icon: '📅', title: 'Weekly Action Plans', desc: 'Get a hyper-specific 7-day roadmap. No vague advice — exact tasks, times, and steps.' },
  { icon: '🔒', title: 'Plan Locking', desc: "Once you approve a week, it's locked in. Commitment is the strategy." },
  { icon: '📈', title: 'Progressive Growth', desc: 'Every week builds on the last. Week 4 you is not Week 1 you.' },
];

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px 13px 42px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: '#1a1a1a',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 400,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: "'Inter', system-ui, sans-serif",
  letterSpacing: '-0.01em',
};

// ─── Label style ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 600,
  color: '#9c9a92',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGooglePopup, setShowGooglePopup] = useState(false);
  const [tryGlow, setTryGlow] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({ email: '', password: '', name: '' });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const res = await login({ email: formData.email, password: formData.password });
        localStorage.setItem('user_id', res.user_id);
        localStorage.setItem('user_name', res.name || res.full_name || formData.email.split('@')[0]);
        navigate('/app');
      } else {
        const res = await signup({ email: formData.email, password: formData.password, name: formData.name });
        localStorage.setItem('user_id', res.user_id);
        localStorage.setItem('user_name', formData.name || res.name || formData.email.split('@')[0]);
        navigate('/app');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleTryFeelivate = () => {
    setTryGlow(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setTryGlow(false), 2400);
  };

  // ─── FONT: Inter everywhere ─────────────────────────────────────────────────
  const pageFont = "'Inter', system-ui, -apple-system, sans-serif";

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#0d0d0d',
      fontFamily: pageFont,          // ← Inter for ENTIRE page
      color: '#ffffff',
      overflow: 'hidden',
    }}>

      {/* ── Top Navigation ─────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: '64px',
        background: '#0d0d0d',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px',
            background: '#ffffff',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
          </div>
          {/* Same font as rest of page — Inter Bold */}
          <span style={{ fontWeight: 700, fontSize: '16px', letterSpacing: '-0.03em', color: '#fff', fontFamily: pageFont }}>
            Feelivate
          </span>
        </div>

        {/* Nav Links */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {['Meet Feelivate', 'Platform', 'Solutions', 'Pricing', 'Resources', 'Contact sales'].map(item => (
            <button key={item} style={{
              background: 'transparent', border: 'none',
              color: '#9c9a92', fontSize: '13px', fontWeight: 500,
              padding: '6px 11px', borderRadius: '8px', cursor: 'pointer',
              transition: 'color 0.18s, background 0.18s',
              fontFamily: pageFont,
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#9c9a92'; e.currentTarget.style.background = 'transparent'; }}
            >{item}</button>
          ))}
        </div>

        {/* Try Feelivate CTA */}
        <button
          onClick={handleTryFeelivate}
          style={{
            background: '#ffffff', color: '#0d0d0d', border: 'none',
            padding: '9px 20px', borderRadius: '10px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.18s, transform 0.15s',
            fontFamily: pageFont, letterSpacing: '-0.02em',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.87'; e.currentTarget.style.transform = 'scale(1.03)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          Try Feelivate
        </button>
      </nav>

      {/* ── Main Split ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── LEFT: Sign-In Form ─────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          background: '#0d0d0d',
        }}>
          <div ref={formRef} style={{ width: '100%', maxWidth: '400px' }}>

            {/* Heading — animated when toggling */}
            <div style={{ marginBottom: '32px' }}>
              <AnimatePresence mode="wait">
                <motion.h1
                  key={isLogin ? 'login-h' : 'signup-h'}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{
                    fontSize: '30px', fontWeight: 700,
                    letterSpacing: '-0.035em', color: '#ffffff',
                    marginBottom: '8px', lineHeight: 1.18,
                    fontFamily: pageFont,
                  }}
                >
                  {isLogin ? 'Sign in to Feelivate' : 'Create your account'}
                </motion.h1>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={isLogin ? 'login-p' : 'signup-p'}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: 'easeOut', delay: 0.04 }}
                  style={{ fontSize: '13.5px', color: '#9c9a92', lineHeight: 1.6, fontFamily: pageFont }}
                >
                  {isLogin
                    ? 'Your AI mentor is waiting. Pick up right where you left off.'
                    : 'Start your journey. Your first weekly plan is one conversation away.'}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  style={{
                    padding: '12px 16px', borderRadius: '10px',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#f87171', fontSize: '13px', marginBottom: '18px',
                    fontFamily: pageFont,
                  }}
                >{error}</motion.div>
              )}
            </AnimatePresence>

            {/* Glow wrapper */}
            <motion.div
              animate={tryGlow ? {
                boxShadow: [
                  '0 0 0px 0px rgba(217,119,87,0)',
                  '0 0 32px 14px rgba(217,119,87,0.32)',
                  '0 0 52px 22px rgba(217,119,87,0.18)',
                  '0 0 0px 0px rgba(217,119,87,0)',
                ],
              } : { boxShadow: '0 0 0px 0px rgba(217,119,87,0)' }}
              transition={{ duration: 2.2, ease: 'easeInOut' }}
              style={{ borderRadius: '16px' }}
            >
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* ── Name field (signup only) — smooth height + fade ───── */}
                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingBottom: '2px' }}>
                        <label style={labelStyle}>Full Name</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#555', display: 'flex' }}>
                            <UserIcon size={15} />
                          </span>
                          <input
                            type="text" name="name" required placeholder="John Doe"
                            value={formData.name} onChange={handleInputChange}
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#d97757'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,119,87,0.13)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Email */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={labelStyle}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#555', display: 'flex' }}>
                      <Mail size={15} />
                    </span>
                    <input
                      type="email" name="email" required placeholder="Enter your email"
                      value={formData.email} onChange={handleInputChange}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#d97757'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,119,87,0.13)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#555', display: 'flex' }}>
                      <Lock size={15} />
                    </span>
                    <input
                      type="password" name="password" required placeholder="Enter password"
                      value={formData.password} onChange={handleInputChange}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#d97757'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(217,119,87,0.13)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="submit" disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    background: '#ffffff', color: '#0d0d0d', border: 'none',
                    padding: '14px', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.18s, transform 0.15s',
                    marginTop: '4px', opacity: loading ? 0.7 : 1,
                    fontFamily: pageFont, letterSpacing: '-0.02em',
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.01)'; } }}
                  onMouseLeave={e => { if (!loading) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; } }}
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <>{isLogin ? 'Continue' : 'Create Account'}<ArrowRight size={15} /></>
                  }
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{ fontSize: '11.5px', color: '#555', fontWeight: 500, fontFamily: pageFont }}>OR</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                </div>

                {/* Google */}
                <button
                  type="button" onClick={() => setShowGooglePopup(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    background: 'transparent', color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.14)',
                    padding: '13px', borderRadius: '12px',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    transition: 'background 0.18s, border-color 0.18s',
                    fontFamily: pageFont,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.26)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </form>
            </motion.div>

            {/* Toggle Login / Signup */}
            <p style={{ marginTop: '26px', textAlign: 'center', fontSize: '13.5px', color: '#9c9a92', fontFamily: pageFont }}>
              {isLogin ? 'New to Feelivate? ' : 'Already have an account? '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                style={{
                  background: 'transparent', border: 'none', color: '#d97757',
                  fontWeight: 700, cursor: 'pointer', padding: 0,
                  fontSize: '13.5px', transition: 'opacity 0.18s', fontFamily: pageFont,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.72'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {isLogin ? 'Create account' : 'Log in here'}
              </button>
            </p>
          </div>
        </div>

        {/* ── RIGHT: Brand Panel ─────────────────────────────────────────── */}
        <div className="brand-panel" style={{
          flex: 1,
          background: 'radial-gradient(ellipse at 35% 45%, #1a1208 0%, #111 45%, #0d0d0d 100%)',
          borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}>

          {/* Ambient glow blobs */}
          <div style={{
            position: 'absolute', top: '8%', right: '8%',
            width: '280px', height: '280px',
            background: 'radial-gradient(circle, rgba(217,119,87,0.09) 0%, transparent 70%)',
            filter: 'blur(60px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '12%', left: '-8%',
            width: '220px', height: '220px',
            background: 'radial-gradient(circle, rgba(217,119,87,0.06) 0%, transparent 70%)',
            filter: 'blur(80px)', pointerEvents: 'none',
          }} />

          {/* ── THE CARD — centered, contained ───────────────────────────── */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '440px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '24px',
            padding: '36px 32px',
            backdropFilter: 'blur(12px)',
          }}>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(217,119,87,0.1)',
              border: '1px solid rgba(217,119,87,0.22)',
              borderRadius: '100px',
              padding: '4px 12px',
              marginBottom: '22px',
            }}>
              <div style={{
                width: '18px', height: '18px', background: '#fff',
                borderRadius: '4px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden',
              }}>
                <img src="/logo_2_backup.png" alt="" style={{ width: '13px', height: '13px', objectFit: 'contain' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97757', letterSpacing: '0.06em', fontFamily: pageFont }}>
                FEELIVATE AI MENTOR
              </span>
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: '28px', fontWeight: 700,
              lineHeight: 1.2, letterSpacing: '-0.03em',
              color: '#ffffff', marginBottom: '10px',
              fontFamily: pageFont,
            }}>
              Tell me your goal once.<br />
              <span style={{ color: '#d97757' }}>I'll build the rest.</span>
            </h2>
            <p style={{ fontSize: '13.5px', color: '#9c9a92', lineHeight: 1.65, marginBottom: '28px', fontFamily: pageFont }}>
              Not a to-do list. A commitment. Hyper-specific weekly plans, locked in, week after week.
            </p>

            {/* Feature Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.09 + 0.15, duration: 0.36, ease: 'easeOut' }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px', padding: '13px 15px',
                    transition: 'background 0.18s, border-color 0.18s',
                  }}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(217,119,87,0.22)' } as any}
                >
                  <span style={{ fontSize: '19px', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '2px', letterSpacing: '-0.01em', fontFamily: pageFont }}>{f.title}</div>
                    <div style={{ fontSize: '12px', color: '#9c9a92', lineHeight: 1.55, fontFamily: pageFont }}>{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quote */}
            <div style={{
              padding: '15px 18px',
              background: 'rgba(217,119,87,0.07)',
              border: '1px solid rgba(217,119,87,0.18)',
              borderRadius: '12px',
            }}>
              <p style={{ fontSize: '12.5px', color: '#c8c3bb', lineHeight: 1.6, fontStyle: 'italic', margin: 0, fontFamily: pageFont }}>
                "Week 1 is easy. Week 4 is who you become."
              </p>
              <p style={{ fontSize: '10.5px', color: '#d97757', fontWeight: 700, marginTop: '7px', marginBottom: 0, letterSpacing: '0.07em', fontFamily: pageFont }}>
                — FEELIVATE PHILOSOPHY
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Google Coming Soon Popup ─────────────────────────────────────── */}
      <AnimatePresence>
        {showGooglePopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGooglePopup(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#161616', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '20px', padding: '36px 32px',
                zIndex: 201, textAlign: 'center',
                width: '100%', maxWidth: '350px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
                fontFamily: pageFont,
              }}
            >
              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '8px',
                  color: '#9c9a92', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.18s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              ><X size={15} /></button>

              <div style={{
                width: '52px', height: '52px', background: 'rgba(255,255,255,0.06)',
                borderRadius: '14px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 18px',
              }}>
                <GoogleIcon />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '10px', letterSpacing: '-0.025em', fontFamily: pageFont }}>
                Google Sign In — Coming Soon
              </h3>
              <p style={{ fontSize: '13px', color: '#9c9a92', lineHeight: 1.65, marginBottom: '22px', fontFamily: pageFont }}>
                We're working on Google authentication. For now, please sign in with your email and password — it takes just 30 seconds.
              </p>

              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  width: '100%', background: '#fff', color: '#0d0d0d', border: 'none',
                  padding: '13px', borderRadius: '12px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.18s',
                  fontFamily: pageFont, letterSpacing: '-0.02em',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.87'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Use Email Instead
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Styles ──────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', system-ui, sans-serif; }
        input::placeholder { color: #4a4a4a !important; }
        input { box-sizing: border-box; }

        @media (max-width: 860px) {
          .brand-panel { display: none !important; }
          .nav-links   { display: none !important; }
        }
        @media (max-width: 540px) {
          nav { padding: 0 18px !important; }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
}
