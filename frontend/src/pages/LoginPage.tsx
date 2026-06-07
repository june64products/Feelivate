import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, X, ArrowUpRight } from 'lucide-react';
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
  { title: 'Goal Intake', desc: 'Tell me your goal once — I ask just 3 smart questions to understand you completely.' },
  { title: 'Weekly Action Plans', desc: 'Get a hyper-specific 7-day roadmap. No vague advice — exact tasks, times, and steps.' },
  { title: 'Plan Locking', desc: "Once you approve a week, it's locked in. Commitment is the strategy." },
];

// ─── Shared input style — Swiss aesthetic ─────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px 14px 15px 46px',
  borderRadius: '4px',
  border: '1px solid rgba(17,17,17,0.15)',
  background: '#ffffff',
  color: '#111111',
  fontSize: '14px',
  fontWeight: 500,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
  letterSpacing: '-0.01em',
};

// ─── Label style ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: '#838282',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
};

// ─── Echo Stack Component ────────────────────────────────────────────────────
const EchoStack = ({ text, fontSize = '11vw' }: { text: string; fontSize?: string }) => {
  const layers = [
    { color: '#d9d9d9', offset: -0.16 },
    { color: '#d1d1d1', offset: -0.12 },
    { color: '#c9c9c9', offset: -0.08 },
    { color: '#bfbfbf', offset: -0.04 },
  ];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {layers.map((layer, i) => (
        <span
          key={i}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: `${layer.offset}em`,
            color: layer.color,
            fontSize,
            fontFamily: "'Clash Display', 'Inter', sans-serif",
            fontWeight: 700,
            lineHeight: 0.9,
            letterSpacing: '-0.05em',
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      ))}
      <span
        style={{
          position: 'relative',
          color: '#111111',
          fontSize,
          fontFamily: "'Clash Display', 'Inter', sans-serif",
          fontWeight: 700,
          lineHeight: 0.9,
          letterSpacing: '-0.05em',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </span>
    </div>
  );
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGooglePopup, setShowGooglePopup] = useState(false);
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

  const clashDisplay = "'Clash Display', 'Inter', system-ui, sans-serif";
  const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

  return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f2f2f2',
      fontFamily: satoshi,
      color: '#111111',
      overflowY: 'auto',
      overflowX: 'hidden',
    }}>

      {/* ══════════════════════════════════════════════════════════════════════
          NAVIGATION — Sticky, Swiss minimalist
          ══════════════════════════════════════════════════════════════════════ */}
      <nav className="login-nav" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        height: '80px',
        background: 'rgba(242, 242, 242, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        borderBottom: '1px solid rgba(30,30,30,0.06)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px',
            background: '#111111',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '28px', height: '28px', objectFit: 'contain', filter: 'invert(1)' }} />
          </div>
          <span style={{
            fontWeight: 700, fontSize: '18px', letterSpacing: '-0.03em',
            color: '#111111', fontFamily: clashDisplay,
          }}>
            Feelivate
          </span>
        </div>

        {/* Nav Links */}
        <div className="nav-links-swiss" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {['Platform', 'Solutions', 'About', 'Pricing'].map(item => (
            <button key={item} style={{
              background: 'transparent', border: 'none',
              color: '#111111', fontSize: '14px', fontWeight: 500,
              padding: '8px 14px', borderRadius: '4px', cursor: 'pointer',
              transition: 'color 120ms ease, background 120ms ease',
              fontFamily: satoshi, textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#b6b5b5'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#111111'; }}
            >{item}</button>
          ))}
        </div>

        {/* Contact CTA — pill button */}
        <button
          style={{
            background: 'transparent', color: '#111111',
            border: '1px solid #1e1e1e',
            padding: '10px 24px', borderRadius: '100px',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            transition: 'background 180ms ease, color 180ms ease',
            fontFamily: satoshi, letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1e1e1e'; e.currentTarget.style.color = '#f2f2f2'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#111111'; }}
        >
          Contact
        </button>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN SPLIT — Login left, Marketing right
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── LEFT: Sign-In Form ──────────────────────────────────────────── */}
        <div style={{
          flex: '0 0 48%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 48px',
          background: '#f2f2f2',
        }}>
          <div ref={formRef} style={{ width: '100%', maxWidth: '380px' }}>

            {/* Heading */}
            <div style={{ marginBottom: '36px' }}>
              <AnimatePresence mode="wait">
                <motion.h1
                  key={isLogin ? 'login-h' : 'signup-h'}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{
                    fontSize: '36px', fontWeight: 700,
                    letterSpacing: '-0.05em', color: '#111111',
                    marginBottom: '12px', lineHeight: 0.95,
                    fontFamily: clashDisplay,
                  }}
                >
                  {isLogin ? 'Sign in' : 'Create account'}
                </motion.h1>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={isLogin ? 'login-p' : 'signup-p'}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: 'easeOut', delay: 0.04 }}
                  style={{
                    fontSize: '14px', color: '#838282', lineHeight: 1.6,
                    fontFamily: satoshi, fontWeight: 500,
                  }}
                >
                  {isLogin
                    ? 'Your AI mentor is waiting. Pick up where you left off.'
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
                    padding: '12px 16px', borderRadius: '4px',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#dc2626', fontSize: '13px', marginBottom: '18px',
                    fontFamily: satoshi,
                  }}
                >{error}</motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Name field (signup only) */}
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
                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#b6b5b5', display: 'flex' }}>
                          <UserIcon size={16} />
                        </span>
                        <input
                          type="text" name="name" required placeholder="John Doe"
                          value={formData.name} onChange={handleInputChange}
                          style={inputStyle}
                          onFocus={e => { e.currentTarget.style.borderColor = '#111111'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(17,17,17,0.08)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(17,17,17,0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#b6b5b5', display: 'flex' }}>
                    <Mail size={16} />
                  </span>
                  <input
                    type="email" name="email" required placeholder="you@example.com"
                    value={formData.email} onChange={handleInputChange}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = '#111111'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(17,17,17,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(17,17,17,0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#b6b5b5', display: 'flex' }}>
                    <Lock size={16} />
                  </span>
                  <input
                    type="password" name="password" required placeholder="Enter password"
                    value={formData.password} onChange={handleInputChange}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = '#111111'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(17,17,17,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'rgba(17,17,17,0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* Continue button — sharp, Swiss */}
              <button
                type="submit" disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: '#111111', color: '#f2f2f2', border: 'none',
                  padding: '15px', borderRadius: '4px',
                  fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'opacity 180ms ease, transform 150ms ease',
                  marginTop: '4px', opacity: loading ? 0.6 : 1,
                  fontFamily: satoshi, letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.01)'; } }}
                onMouseLeave={e => { if (!loading) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; } }}
              >
                {loading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <>{isLogin ? 'Continue' : 'Create Account'}<ArrowRight size={15} /></>
                }
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '4px 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(17,17,17,0.1)' }} />
                <span style={{ fontSize: '11px', color: '#b6b5b5', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.1em' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(17,17,17,0.1)' }} />
              </div>

              {/* Google */}
              <button
                type="button" onClick={() => setShowGooglePopup(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: '#ffffff', color: '#111111',
                  border: '1px solid rgba(17,17,17,0.15)',
                  padding: '14px', borderRadius: '4px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'background 180ms ease, border-color 180ms ease',
                  fontFamily: satoshi,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f9f9f9'; e.currentTarget.style.borderColor = 'rgba(17,17,17,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(17,17,17,0.15)'; }}
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>

            {/* Toggle Login / Signup */}
            <p style={{ marginTop: '28px', textAlign: 'center', fontSize: '13.5px', color: '#838282', fontFamily: satoshi }}>
              {isLogin ? 'New to Feelivate? ' : 'Already have an account? '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                style={{
                  background: 'transparent', border: 'none', color: '#111111',
                  fontWeight: 700, cursor: 'pointer', padding: 0,
                  fontSize: '13.5px', transition: 'opacity 180ms ease', fontFamily: satoshi,
                  textDecoration: 'underline', textUnderlineOffset: '3px',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {isLogin ? 'Create account' : 'Log in here'}
              </button>
            </p>
          </div>
        </div>

        {/* ── RIGHT: Marketing / Brand Panel ──────────────────────────────── */}
        <div className="brand-panel-swiss" style={{
          flex: '0 0 52%',
          background: '#ebebeb',
          borderLeft: '1px solid rgba(30,30,30,0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 64px',
          position: 'relative',
          overflow: 'hidden',
        }}>

          {/* Vertical hairline accent */}
          <div style={{
            position: 'absolute', top: '0', left: '50%',
            width: '1px', height: '80px',
            background: 'rgba(30,30,30,0.1)',
          }} />

          {/* Echo Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
            style={{ marginBottom: '48px', textAlign: 'center' }}
          >
            <EchoStack text="EVOLVE" fontSize="clamp(60px, 9vw, 140px)" />
          </motion.div>

          {/* Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            style={{ textAlign: 'center', maxWidth: '460px', marginBottom: '48px' }}
          >
            <h2 style={{
              fontSize: 'clamp(22px, 2.8vw, 36px)', fontWeight: 700,
              lineHeight: 1.1, letterSpacing: '-0.05em',
              color: '#111111', marginBottom: '16px',
              fontFamily: clashDisplay,
            }}>
              Your AI-Powered
              <br />
              <span style={{
                fontStyle: 'italic',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontWeight: 400,
                color: '#838282',
              }}>
                Behavioral
              </span>
              {' '}Mentor
            </h2>
            <p style={{
              fontSize: '15px', color: '#838282', lineHeight: 1.7,
              fontFamily: satoshi, fontWeight: 500,
            }}>
              Not a to-do list. Not vague advice. A hyper-specific weekly commitment engine
              that builds who you become — week after week.
            </p>
          </motion.div>

          {/* Feature Cards — 3-column grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            width: '100%',
            maxWidth: '540px',
            marginBottom: '40px',
          }}>
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 + 0.3, duration: 0.5, ease: 'easeOut' }}
                style={{
                  padding: '24px 18px',
                  border: '1px solid rgba(30,30,30,0.1)',
                  borderRadius: '2px',
                  background: 'transparent',
                  transition: 'background 250ms ease, border-color 250ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = 'rgba(30,30,30,0.2)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(30,30,30,0.1)';
                }}
              >
                {/* Geometric icon container */}
                <div style={{
                  width: '40px', height: '40px',
                  border: '1px solid rgba(30,30,30,0.15)',
                  borderRadius: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px',
                  transition: 'transform 300ms ease',
                }}>
                  <ArrowUpRight size={16} color="#111111" />
                </div>
                <h3 style={{
                  fontSize: '14px', fontWeight: 700,
                  color: '#111111', marginBottom: '8px',
                  letterSpacing: '-0.02em',
                  fontFamily: clashDisplay,
                }}>{f.title}</h3>
                <p style={{
                  fontSize: '12px', color: '#838282',
                  lineHeight: 1.55, fontFamily: satoshi,
                  fontWeight: 500,
                }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Philosophy Quote */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            style={{
              textAlign: 'center',
              maxWidth: '400px',
              padding: '20px 0',
              borderTop: '1px solid rgba(30,30,30,0.08)',
            }}
          >
            <p style={{
              fontSize: '16px', color: '#b6b5b5', lineHeight: 1.6,
              fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif",
              marginBottom: '8px',
            }}>
              "Week 1 is easy. Week 4 is who you become."
            </p>
            <p style={{
              fontSize: '10px', color: '#111111', fontWeight: 700,
              letterSpacing: '0.15em', fontFamily: satoshi,
              textTransform: 'uppercase',
            }}>
              — Feelivate Philosophy
            </p>
          </motion.div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER — Deep dark theme
          ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        background: '#1e1e1e',
        padding: '48px 48px 32px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '32px',
          maxWidth: '1200px',
          margin: '0 auto',
          marginBottom: '40px',
        }}>
          {/* Brand Column */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{
                width: '32px', height: '32px',
                background: '#f2f2f2',
                borderRadius: '6px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
              </div>
              <span style={{
                fontWeight: 700, fontSize: '16px',
                color: 'rgba(246,246,246,0.9)',
                fontFamily: clashDisplay, letterSpacing: '-0.03em',
              }}>
                Feelivate
              </span>
            </div>
            <p style={{
              fontSize: '13px', color: 'rgba(246,246,246,0.5)',
              lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500,
              marginBottom: '16px',
            }}>
              AI-powered behavioral transformation.
              Hyper-specific weekly plans that build who you become.
            </p>
            <p style={{
              fontSize: '11px', color: 'rgba(246,246,246,0.35)',
              fontFamily: satoshi, fontWeight: 500,
              letterSpacing: '0.05em',
            }}>
              By <span style={{ fontWeight: 700, color: 'rgba(246,246,246,0.6)', letterSpacing: '0.08em' }}>JUNE64</span>
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 style={{
              fontSize: '11px', fontWeight: 700,
              color: 'rgba(246,246,246,0.4)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: '16px', fontFamily: satoshi,
            }}>Navigation</h4>
            {['Platform', 'Solutions', 'Pricing', 'About'].map(item => (
              <p key={item} style={{
                fontSize: '13px', color: 'rgba(246,246,246,0.6)',
                marginBottom: '10px', cursor: 'pointer',
                transition: 'color 150ms ease', fontFamily: satoshi,
                fontWeight: 500,
              }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(246,246,246,0.9)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(246,246,246,0.6)'; }}
              >{item}</p>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 style={{
              fontSize: '11px', fontWeight: 700,
              color: 'rgba(246,246,246,0.4)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: '16px', fontFamily: satoshi,
            }}>Company</h4>
            {['Careers', 'Blog', 'Press', 'Privacy Policy', 'Terms of Service'].map(item => (
              <p key={item} style={{
                fontSize: '13px', color: 'rgba(246,246,246,0.6)',
                marginBottom: '10px', cursor: 'pointer',
                transition: 'color 150ms ease', fontFamily: satoshi,
                fontWeight: 500,
              }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'rgba(246,246,246,0.9)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'rgba(246,246,246,0.6)'; }}
              >{item}</p>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 style={{
              fontSize: '11px', fontWeight: 700,
              color: 'rgba(246,246,246,0.4)',
              letterSpacing: '0.12em', textTransform: 'uppercase',
              marginBottom: '16px', fontFamily: satoshi,
            }}>Contact</h4>
            <p style={{ fontSize: '13px', color: 'rgba(246,246,246,0.6)', marginBottom: '10px', fontFamily: satoshi, fontWeight: 500 }}>
              hello@feelivate.com
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(246,246,246,0.6)', marginBottom: '10px', fontFamily: satoshi, fontWeight: 500 }}>
              @feelivate
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(246,246,246,0.6)', marginBottom: '10px', fontFamily: satoshi, fontWeight: 500 }}>
              San Francisco, CA
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <p style={{
            fontSize: '12px', color: 'rgba(246,246,246,0.35)',
            fontFamily: satoshi, fontWeight: 500,
          }}>
            © 2026 Feelivate. All rights reserved.
          </p>
          <p style={{
            fontSize: '12px', color: 'rgba(246,246,246,0.35)',
            fontFamily: satoshi, fontWeight: 500,
          }}>
            A product of <span style={{ fontWeight: 700, color: 'rgba(246,246,246,0.55)' }}>JUNE64</span>
          </p>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════════
          GOOGLE POPUP — Swiss minimal
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showGooglePopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGooglePopup(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.5)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#f2f2f2', border: '1px solid rgba(30,30,30,0.12)',
                borderRadius: '4px', padding: '40px 32px',
                zIndex: 201, textAlign: 'center',
                width: '100%', maxWidth: '380px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.15)',
                fontFamily: satoshi,
              }}
            >
              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'rgba(17,17,17,0.05)', border: 'none', borderRadius: '4px',
                  color: '#838282', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 180ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(17,17,17,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(17,17,17,0.05)'}
              ><X size={15} /></button>

              <div style={{
                width: '56px', height: '56px', background: '#ffffff',
                borderRadius: '4px', border: '1px solid rgba(17,17,17,0.1)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <GoogleIcon />
              </div>

              <h3 style={{
                fontSize: '22px', fontWeight: 700, color: '#111111',
                marginBottom: '10px', letterSpacing: '-0.04em',
                fontFamily: clashDisplay,
              }}>
                Coming Soon
              </h3>
              <p style={{
                fontSize: '14px', color: '#838282', lineHeight: 1.65,
                marginBottom: '24px', fontFamily: satoshi, fontWeight: 500,
              }}>
                Google authentication is on its way. For now, sign in with email and password — it takes 30 seconds.
              </p>

              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  width: '100%', background: '#111111', color: '#f2f2f2', border: 'none',
                  padding: '14px', borderRadius: '4px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'opacity 180ms ease',
                  fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Use Email Instead
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          STYLES — Clash Display + Satoshi + Swiss reset
          ══════════════════════════════════════════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=satoshi@300,400,500,600,700,900&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Satoshi', 'Inter', system-ui, sans-serif; }

        input::placeholder { color: #b6b5b5 !important; }
        input { box-sizing: border-box; }

        /* Responsive */
        @media (max-width: 960px) {
          .brand-panel-swiss { display: none !important; }
          .nav-links-swiss { display: none !important; }
          footer > div:first-child {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .login-nav { padding: 0 20px !important; }
          footer { padding: 32px 20px 24px !important; }
          footer > div:first-child {
            grid-template-columns: 1fr !important;
          }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 0.9s linear infinite; }

        /* Smooth scrolling for whole page */
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
