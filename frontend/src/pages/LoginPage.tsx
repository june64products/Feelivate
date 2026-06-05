import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, X, Sparkles } from 'lucide-react';
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

// ─── Shared input style (Stitch lavender) ────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px 13px 44px',
  borderRadius: '14px',
  border: '1px solid #cbc3d7',
  background: '#ffffff',
  color: '#121c2a',
  fontSize: '14px',
  fontWeight: 400,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
  letterSpacing: '-0.01em',
};

// ─── Label style ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: '11.5px',
  fontWeight: 700,
  color: '#7b7486',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  fontFamily: "'Inter', sans-serif",
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

  const pageFont = "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif";

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8f9ff',
      fontFamily: pageFont,
      color: '#121c2a',
      overflow: 'hidden',
    }}>
      {/* Ambient lavender blobs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', top: '-10%', right: '5%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          filter: 'blur(80px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '0', left: '10%',
          width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(132,85,239,0.08) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }} />
      </div>

      {/* ── Top Navigation ─────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        height: '64px',
        background: 'rgba(248,249,255,0.8)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(203,195,215,0.35)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #8b5cf6, #8455ef)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
          }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '22px', height: '22px', objectFit: 'contain', filter: 'brightness(10)' }} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '17px', letterSpacing: '-0.03em', color: '#121c2a', fontFamily: pageFont }}>
            Feelivate
          </span>
        </div>

        {/* Nav Links */}
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {['Meet Feelivate', 'Platform', 'Solutions', 'Pricing', 'Resources', 'Contact sales'].map(item => (
            <button key={item} style={{
              background: 'transparent', border: 'none',
              color: '#7b7486', fontSize: '13.5px', fontWeight: 500,
              padding: '6px 12px', borderRadius: '9999px', cursor: 'pointer',
              transition: 'color 0.18s, background 0.18s',
              fontFamily: pageFont,
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#8b5cf6'; e.currentTarget.style.background = 'rgba(139,92,246,0.07)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7b7486'; e.currentTarget.style.background = 'transparent'; }}
            >{item}</button>
          ))}
        </div>

        {/* Try Feelivate CTA */}
        <button
          onClick={handleTryFeelivate}
          style={{
            background: 'var(--color-primary, #8b5cf6)', color: '#ffffff', border: 'none',
            padding: '10px 22px', borderRadius: '9999px',
            fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            transition: 'opacity 0.18s, transform 0.15s, box-shadow 0.18s',
            fontFamily: pageFont, letterSpacing: '-0.01em',
            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,92,246,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(139,92,246,0.3)'; }}
        >
          Try Feelivate
        </button>
      </nav>

      {/* ── Main Split ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', zIndex: 1 }}>

        {/* ── LEFT: Sign-In Form ─────────────────────────────────────────── */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 40px',
          background: 'transparent',
        }}>
          <div ref={formRef} style={{ width: '100%', maxWidth: '420px' }}>

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
                    fontSize: '32px', fontWeight: 800,
                    letterSpacing: '-0.04em', color: '#121c2a',
                    marginBottom: '8px', lineHeight: 1.15,
                    fontFamily: pageFont,
                  }}
                >
                  {isLogin ? 'Welcome back 👋' : 'Join Feelivate'}
                </motion.h1>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={isLogin ? 'login-p' : 'signup-p'}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: 'easeOut', delay: 0.04 }}
                  style={{ fontSize: '15px', color: '#7b7486', lineHeight: 1.6, fontFamily: pageFont }}
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
                    padding: '12px 16px', borderRadius: '12px',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444', fontSize: '13.5px', marginBottom: '18px',
                    fontFamily: pageFont,
                  }}
                >{error}</motion.div>
              )}
            </AnimatePresence>

            {/* Form Card */}
            <motion.div
              animate={tryGlow ? {
                boxShadow: [
                  '0 0 0px 0px rgba(139,92,246,0)',
                  '0 0 40px 16px rgba(139,92,246,0.18)',
                  '0 0 60px 24px rgba(139,92,246,0.10)',
                  '0 0 0px 0px rgba(139,92,246,0)',
                ],
              } : { boxShadow: '0 8px 40px rgba(139,92,246,0.08)' }}
              transition={{ duration: 2.2, ease: 'easeInOut' }}
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(230,238,255,0.9)',
                borderRadius: '24px',
                padding: '32px',
                boxShadow: '0 8px 40px rgba(139,92,246,0.08)',
              }}
            >
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

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
                          <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#cbc3d7', display: 'flex' }}>
                            <UserIcon size={16} />
                          </span>
                          <input
                            type="text" name="name" required placeholder="John Doe"
                            value={formData.name} onChange={handleInputChange}
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#cbc3d7'; e.currentTarget.style.boxShadow = 'none'; }}
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
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#cbc3d7', display: 'flex' }}>
                      <Mail size={16} />
                    </span>
                    <input
                      type="email" name="email" required placeholder="Enter your email"
                      value={formData.email} onChange={handleInputChange}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbc3d7'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Password */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#cbc3d7', display: 'flex' }}>
                      <Lock size={16} />
                    </span>
                    <input
                      type="password" name="password" required placeholder="Enter password"
                      value={formData.password} onChange={handleInputChange}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#8b5cf6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(139,92,246,0.12)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#cbc3d7'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="submit" disabled={loading}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    background: '#8b5cf6', color: '#ffffff', border: 'none',
                    padding: '14px', borderRadius: '9999px',
                    fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.18s',
                    marginTop: '4px', opacity: loading ? 0.7 : 1,
                    fontFamily: pageFont, letterSpacing: '-0.01em',
                    boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
                  }}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(139,92,246,0.45)'; } }}
                  onMouseLeave={e => { if (!loading) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,92,246,0.35)'; } }}
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <>{isLogin ? 'Continue' : 'Create Account'}<ArrowRight size={16} /></>
                  }
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(203,195,215,0.5)' }} />
                  <span style={{ fontSize: '12px', color: '#cbc3d7', fontWeight: 600, fontFamily: "'Inter', sans-serif", letterSpacing: '0.04em' }}>OR</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(203,195,215,0.5)' }} />
                </div>

                {/* Google */}
                <button
                  type="button" onClick={() => setShowGooglePopup(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    background: '#ffffff', color: '#121c2a',
                    border: '1px solid #cbc3d7',
                    padding: '13px', borderRadius: '9999px',
                    fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                    transition: 'all 0.18s',
                    fontFamily: pageFont,
                    boxShadow: '0 2px 8px rgba(139,92,246,0.06)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.4)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(139,92,246,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbc3d7'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(139,92,246,0.06)'; }}
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
              </form>
            </motion.div>

            {/* Toggle Login / Signup */}
            <p style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#7b7486', fontFamily: pageFont }}>
              {isLogin ? 'New to Feelivate? ' : 'Already have an account? '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                style={{
                  background: 'transparent', border: 'none', color: '#8b5cf6',
                  fontWeight: 700, cursor: 'pointer', padding: 0,
                  fontSize: '14px', transition: 'opacity 0.18s', fontFamily: pageFont,
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
          background: 'linear-gradient(145deg, rgba(139,92,246,0.08) 0%, rgba(228,224,245,0.4) 50%, rgba(248,249,255,0.8) 100%)',
          borderLeft: '1px solid rgba(203,195,215,0.35)',
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
            background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
            filter: 'blur(60px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '12%', left: '-8%',
            width: '220px', height: '220px',
            background: 'radial-gradient(circle, rgba(132,85,239,0.09) 0%, transparent 70%)',
            filter: 'blur(80px)', pointerEvents: 'none',
          }} />

          {/* ── THE CARD ─────────────────────────────────────────────── */}
          <div style={{
            position: 'relative',
            zIndex: 2,
            width: '100%',
            maxWidth: '440px',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(230,238,255,0.9)',
            borderRadius: '28px',
            padding: '36px 32px',
            boxShadow: '0 12px 48px rgba(139,92,246,0.1)',
          }}>

            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              background: 'rgba(139,92,246,0.08)',
              border: '1px solid rgba(139,92,246,0.2)',
              borderRadius: '100px',
              padding: '5px 14px',
              marginBottom: '22px',
            }}>
              <div style={{
                width: '20px', height: '20px',
                background: 'linear-gradient(135deg, #8b5cf6, #8455ef)',
                borderRadius: '6px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden',
                boxShadow: '0 2px 6px rgba(139,92,246,0.3)',
              }}>
                <Sparkles size={11} style={{ color: 'white' }} />
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.06em', fontFamily: "'Inter', sans-serif" }}>
                FEELIVATE AI MENTOR
              </span>
            </div>

            {/* Headline */}
            <h2 style={{
              fontSize: '28px', fontWeight: 800,
              lineHeight: 1.2, letterSpacing: '-0.035em',
              color: '#121c2a', marginBottom: '10px',
              fontFamily: pageFont,
            }}>
              Tell me your goal once.<br />
              <span style={{ color: '#8b5cf6' }}>I'll build the rest.</span>
            </h2>
            <p style={{ fontSize: '14px', color: '#7b7486', lineHeight: 1.65, marginBottom: '28px', fontFamily: pageFont }}>
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
                    background: 'rgba(139,92,246,0.04)',
                    border: '1px solid rgba(203,195,215,0.5)',
                    borderRadius: '16px', padding: '14px 16px',
                    transition: 'all 0.18s',
                    cursor: 'default',
                  }}
                  whileHover={{ backgroundColor: 'rgba(139,92,246,0.07)', borderColor: 'rgba(139,92,246,0.25)' } as any}
                >
                  <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0, marginTop: '1px' }}>{f.icon}</span>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#121c2a', marginBottom: '3px', letterSpacing: '-0.01em', fontFamily: pageFont }}>{f.title}</div>
                    <div style={{ fontSize: '12.5px', color: '#7b7486', lineHeight: 1.55, fontFamily: "'Inter', sans-serif" }}>{f.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Quote */}
            <div style={{
              padding: '16px 18px',
              background: 'rgba(139,92,246,0.05)',
              border: '1px solid rgba(139,92,246,0.15)',
              borderRadius: '16px',
            }}>
              <p style={{ fontSize: '13px', color: '#494454', lineHeight: 1.65, fontStyle: 'italic', margin: 0, fontFamily: "'Inter', sans-serif" }}>
                "Week 1 is easy. Week 4 is who you become."
              </p>
              <p style={{ fontSize: '11px', color: '#8b5cf6', fontWeight: 700, marginTop: '8px', marginBottom: 0, letterSpacing: '0.07em', fontFamily: "'Inter', sans-serif" }}>
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
              style={{ position: 'fixed', inset: 0, background: 'rgba(18,28,42,0.4)', backdropFilter: 'blur(8px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(203,195,215,0.6)',
                borderRadius: '24px', padding: '36px 32px',
                zIndex: 201, textAlign: 'center',
                width: '100%', maxWidth: '360px',
                boxShadow: '0 24px 80px rgba(139,92,246,0.15)',
                fontFamily: pageFont,
              }}
            >
              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'rgba(139,92,246,0.07)', border: 'none', borderRadius: '10px',
                  color: '#7b7486', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.18s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.07)'}
              ><X size={15} /></button>

              <div style={{
                width: '52px', height: '52px', background: 'rgba(139,92,246,0.08)',
                borderRadius: '16px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 18px',
              }}>
                <GoogleIcon />
              </div>

              <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#121c2a', marginBottom: '10px', letterSpacing: '-0.03em', fontFamily: pageFont }}>
                Google Sign In — Coming Soon
              </h3>
              <p style={{ fontSize: '14px', color: '#7b7486', lineHeight: 1.65, marginBottom: '22px', fontFamily: "'Inter', sans-serif" }}>
                We're working on Google authentication. For now, please sign in with your email and password — it takes just 30 seconds.
              </p>

              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  width: '100%', background: '#8b5cf6', color: '#ffffff', border: 'none',
                  padding: '13px', borderRadius: '9999px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s',
                  fontFamily: pageFont, letterSpacing: '-0.01em',
                  boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,92,246,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(139,92,246,0.3)'; }}
              >
                Use Email Instead
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Styles ──────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        input::placeholder { color: #cbc3d7 !important; }
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
