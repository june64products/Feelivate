import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, X, ArrowUpRight } from 'lucide-react';
import { login, signup } from '../api';
import { startOnboarding } from '../lib/onboarding';
import PillNav from '../components/PillNav';
import { useWindowSize } from '../hooks/useWindowSize';

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
  { title: 'No More Bullshit', desc: 'Tell us what you want. Our AI strips away the noise and extracts the exact daily micro-actions needed.' },
  { title: 'Zero Decision Fatigue', desc: 'Forget vague to-do lists. You get a hyper-precise schedule: what to do, when, and exactly how.' },
  { title: 'The Lock-In Protocol', desc: "Once your week is set, it's locked. You can't edit it to make it easier. You do the work, or you don't." },
];

// ─── Full Feature List (Features modal) ───────────────────────────────────────
const platformFeatures = [
  {
    title: 'AI Behavioral Mentor',
    desc: 'Not another chatbot. A relentless mentor that learns your patterns, calls out your excuses, and coaches you toward the person you said you wanted to become.',
  },
  {
    title: '7-Day Action Sprints',
    desc: 'Every goal is broken down into a hyper-specific weekly plan — exact daily micro-actions, timed and sequenced. No vague resolutions, just a clear path.',
  },
  {
    title: 'The Lock-In Protocol',
    desc: "Once your week is set, it's locked. You can't quietly soften it to make it easier. You commit, you execute — or the streak breaks.",
  },
  {
    title: 'Daily Task Emails',
    desc: "Every day a personalized email lands in your inbox with today's exact task and how-to tips — sent at your chosen time, in your timezone. Direct task notifications, so you never wonder what to do next.",
  },
  {
    title: 'Weekly Reports',
    desc: 'At the end of each week you get an honest report card — what you actually did versus what you committed to — plus streaks that track your real momentum day over day.',
  },
  {
    title: 'Emotion Logs & Voice Intake',
    desc: 'Talk or type how you feel — Feelivate reads your emotional state, understands the "why" behind the slip, and adapts next week to your reality.',
  },
  {
    title: 'Persistent Memory',
    desc: 'It remembers your history, your wins, and your patterns. Context compounds week over week, so the guidance gets sharper the longer you stay.',
  },
  {
    title: 'Calendar Integration',
    desc: 'Your plan drops straight into your calendar with reminders, so there is no "I forgot." The work is scheduled, not left to willpower.',
  },
];

// ─── Shared input style — Swiss aesthetic ─────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px 14px 15px 46px',
  borderRadius: '4px',
  border: '1px solid var(--border-medium)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
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
  color: 'var(--text-secondary)',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
};

// ─── Echo Stack Component ────────────────────────────────────────────────────
const EchoStack = ({ text, fontSize = '11vw' }: { text: string; fontSize?: string }) => {
  const layers = [
    { opacity: 0.15, offset: -0.16 },
    { opacity: 0.25, offset: -0.12 },
    { opacity: 0.35, offset: -0.08 },
    { opacity: 0.45, offset: -0.04 },
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
            color: 'var(--text-primary)',
            opacity: layer.opacity,
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
          color: 'var(--text-primary)',
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
  const { isMobile } = useWindowSize();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showGooglePopup, setShowGooglePopup] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Already logged in (token persists in localStorage across tabs/restarts)?
  // Skip the login page and go straight to the workspace.
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const uid = localStorage.getItem('user_id');
    if (token && uid) navigate('/app', { replace: true });
  }, [navigate]);

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
        // Brand-new account → queue the first-time walkthrough (runs once on /app).
        startOnboarding(res.user_id);
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
      height: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-primary)',
      fontFamily: satoshi,
      color: 'var(--text-primary)',
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
        padding: isMobile ? '0 20px' : '0 48px',
        height: isMobile ? '56px' : '72px',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px',
            background: 'var(--accent-primary)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '28px', height: '28px', objectFit: 'contain', filter: 'var(--logo-filter)' }} />
          </div>
          <span style={{
            fontWeight: 700, fontSize: '18px', letterSpacing: '-0.03em',
            color: 'var(--text-primary)', fontFamily: clashDisplay,
          }}>
            Feelivate
          </span>
        </div>

        {/* Animated Pill Nav — Hidden on mobile to save space */}
        {!isMobile && (
          <div className="nav-links-swiss">
            <PillNav
              items={[
                { label: 'Features', onClick: () => setShowFeatures(true) },
                { label: 'About', onClick: () => setShowAbout(true) },
                { label: 'Pricing' },
                { label: 'Contact', onClick: () => setShowContact(true) },
              ]}
              baseColor="var(--text-primary)"
              pillColor="var(--bg-primary)"
              pillTextColor="var(--text-primary)"
              hoveredTextColor="var(--text-inverse)"
              fontFamily={satoshi}
              ease="power3.out"
            />
          </div>
        )}
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN SPLIT — Login left, Marketing right
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>

        {/* ── LEFT: Sign-In Form ────────────────────────────────────────────── */}
        <div style={{
          flex: isMobile ? '1 1 auto' : '0 0 48%',
          width: isMobile ? '100%' : 'auto',
          display: 'flex',
          alignItems: isMobile ? 'flex-start' : 'center',
          justifyContent: 'center',
          padding: isMobile ? '32px 24px 40px' : '60px 48px',
          background: 'var(--bg-primary)',
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
                    letterSpacing: '-0.05em', color: 'var(--text-primary)',
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
                    fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6,
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
                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
                          <UserIcon size={16} />
                        </span>
                        <input
                          type="text" name="name" required placeholder="John Doe"
                          value={formData.name} onChange={handleInputChange}
                          style={inputStyle}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = 'var(--input-shadow-focus)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
                    <Mail size={16} />
                  </span>
                  <input
                    type="email" name="email" required placeholder="you@example.com"
                    value={formData.email} onChange={handleInputChange}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = 'var(--input-shadow-focus)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex' }}>
                    <Lock size={16} />
                  </span>
                  <input
                    type="password" name="password" required placeholder="Enter password"
                    value={formData.password} onChange={handleInputChange}
                    style={inputStyle}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.boxShadow = 'var(--input-shadow-focus)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-medium)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
              </div>

              {/* Continue button — sharp, Swiss */}
              <button
                type="submit" disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none',
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
                <div style={{ flex: 1, height: '1px', background: 'var(--border-medium)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.1em' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-medium)' }} />
              </div>

              {/* Google */}
              <button
                type="button" onClick={() => setShowGooglePopup(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: 'var(--card-bg)', color: 'var(--text-primary)',
                  border: '1px solid var(--border-medium)',
                  padding: '14px', borderRadius: '4px',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                  transition: 'background 180ms ease, border-color 180ms ease',
                  fontFamily: satoshi,
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--glass-hover)'; e.currentTarget.style.borderColor = 'var(--border-focus)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--card-bg)'; e.currentTarget.style.borderColor = 'var(--border-medium)'; }}
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>

            {/* Toggle Login / Signup */}
            <p style={{ marginTop: '28px', textAlign: 'center', fontSize: '13.5px', color: 'var(--text-secondary)', fontFamily: satoshi }}>
              {isLogin ? 'New to Feelivate? ' : 'Already have an account? '}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                style={{
                  background: 'transparent', border: 'none', color: 'var(--text-primary)',
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
        {!isMobile && (
          <div className="brand-panel-swiss" style={{
            flex: '0 0 52%',
            background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border-subtle)',
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
            background: 'var(--border-medium)',
          }} />

          {/* Echo Hero Text */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.77, 0, 0.175, 1] }}
            style={{ marginBottom: '48px', textAlign: 'center' }}
          >
            <EchoStack text="EXECUTE" fontSize="clamp(60px, 9vw, 140px)" />
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
              color: 'var(--text-primary)', marginBottom: '16px',
              fontFamily: clashDisplay,
            }}>
              Stop lying to yourself
              <br />
              <span style={{
                fontStyle: 'italic',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                fontWeight: 400,
                color: 'var(--text-secondary)',
              }}>
                about
              </span>
              {' '}tomorrow.
            </h2>
            <p style={{
              fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7,
              fontFamily: satoshi, fontWeight: 500,
            }}>
              Feelivate is a ruthless AI mentor that breaks your biggest goals into non-negotiable 7-day sprints. No fluff. No escape. Just execution.
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
                  border: '1px solid var(--border-medium)',
                  borderRadius: '2px',
                  background: 'transparent',
                  transition: 'background 250ms ease, border-color 250ms ease',
                  cursor: 'default',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.background = 'var(--card-bg)';
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                }}
              >
                {/* Geometric icon container */}
                <div style={{
                  width: '40px', height: '40px',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '16px',
                  transition: 'transform 300ms ease',
                }}>
                  <ArrowUpRight size={16} style={{ color: 'var(--text-primary)' }} />
                </div>
                <h3 style={{
                  fontSize: '14px', fontWeight: 700,
                  color: 'var(--text-primary)', marginBottom: '8px',
                  letterSpacing: '-0.02em',
                  fontFamily: clashDisplay,
                }}>{f.title}</h3>
                <p style={{
                  fontSize: '12px', color: 'var(--text-secondary)',
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
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <p style={{
              fontSize: '16px', color: 'var(--text-muted)', lineHeight: 1.6,
              fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif",
              marginBottom: '8px',
            }}>
              "Your future self is watching. Don't disappoint them."
            </p>
            <p style={{
              fontSize: '10px', color: 'var(--text-primary)', fontWeight: 700,
              letterSpacing: '0.15em', fontFamily: satoshi,
              textTransform: 'uppercase',
            }}>
            </p>
          </motion.div>
        </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TICKER MARQUEE
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        width: '100%',
        overflow: 'hidden',
        background: 'var(--accent-primary)',
        padding: '16px 0',
        flexShrink: 0,
      }}>
        <div className="marquee-content" style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          color: 'var(--text-inverse)',
          fontSize: '12px',
          fontWeight: 600,
          fontFamily: clashDisplay,
          letterSpacing: '0.12em',
        }}>
          {Array(8).fill("AI BEHAVIORAL MENTOR   //   WEEKLY ACTION PLANS   //   DAILY MAIL NOTIFICATIONS   //   STREAK TRACKING   //   WEEKLY REPORTS   //   DAILY EMOTION LOGS   //   VOICE MEMO INTAKE   //   RELENTLESS ACCOUNTABILITY   //   ").join("")}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER — Deep dark theme (stays dark in both modes)
          ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        background: '#1e1e1e',
        padding: isMobile ? '32px 24px 24px' : '48px 48px 32px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div className="footer-grid-mobile" style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
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
              info@june64.com
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(246,246,246,0.6)', marginBottom: '10px', fontFamily: satoshi, fontWeight: 500 }}>
              @feelivate
            </p>
            <p style={{ fontSize: '13px', color: 'rgba(246,246,246,0.6)', marginBottom: '10px', fontFamily: satoshi, fontWeight: 500 }}>
              London, UK
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
          flexWrap: 'wrap',
          gap: '8px',
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
          CONTACT MODAL — Reach the team
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showContact && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowContact(false)}
              style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, x: '-50%', y: '-44%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-47%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                borderRadius: '4px',
                padding: isMobile ? '32px 22px' : '42px 38px 34px',
                zIndex: 201,
                width: 'calc(100% - 32px)', maxWidth: '440px',
                maxHeight: '86vh', overflowY: 'auto',
                boxShadow: 'var(--shadow-xl)', fontFamily: satoshi,
              }}
            >
              <button
                onClick={() => setShowContact(false)}
                style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'var(--glass-hover)', border: 'none', borderRadius: '4px',
                  color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 180ms ease', zIndex: 2,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-hover)'}
              ><X size={15} /></button>

              <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
              }}>
                Contact
              </span>
              <h2 style={{
                fontSize: isMobile ? '26px' : '32px', fontWeight: 700,
                letterSpacing: '-0.05em', lineHeight: 1.05,
                color: 'var(--text-primary)', margin: '12px 0 12px',
                fontFamily: clashDisplay,
              }}>
                Let's talk.
              </h2>
              <p style={{
                fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65,
                fontFamily: satoshi, fontWeight: 500, marginBottom: '26px',
              }}>
                Questions, press, or partnerships — reach out and we usually reply within a day.
              </p>

              {/* Contact rows */}
              <div style={{
                border: '1px solid var(--border-subtle)', borderRadius: '2px',
                overflow: 'hidden', marginBottom: '24px',
              }}>
                {[
                  { label: 'Email', value: 'info@june64.com', href: 'mailto:info@june64.com' },
                  { label: 'Social', value: '@feelivate', href: undefined },
                  { label: 'Location', value: 'London, UK', href: undefined },
                ].map((row, i) => {
                  const inner = (
                    <>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                        letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi,
                      }}>
                        {row.label}
                      </span>
                      <span style={{
                        fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                        fontFamily: satoshi,
                      }}>
                        {row.value}
                      </span>
                    </>
                  );
                  const rowStyle: React.CSSProperties = {
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 18px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    transition: 'background 200ms ease',
                  };
                  return row.href ? (
                    <a
                      key={i} href={row.href} style={rowStyle}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >{inner}</a>
                  ) : (
                    <div key={i} style={rowStyle}>{inner}</div>
                  );
                })}
              </div>

              {/* CTA — mailto */}
              <a
                href="mailto:info@june64.com"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', textDecoration: 'none',
                  background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none',
                  padding: '15px', borderRadius: '4px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'opacity 180ms ease',
                  fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase',
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <Mail size={15} /> Email Us
              </a>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          ABOUT MODAL — What Feelivate is, the why & the how
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAbout && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAbout(false)}
              style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-44%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-47%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                borderRadius: '4px',
                padding: isMobile ? '30px 20px' : '48px 48px 38px',
                zIndex: 201,
                width: 'calc(100% - 32px)', maxWidth: '640px',
                maxHeight: '86vh', overflowY: 'auto',
                boxShadow: 'var(--shadow-xl)',
                fontFamily: satoshi,
              }}
            >
              <button
                onClick={() => setShowAbout(false)}
                style={{
                  position: 'absolute', top: '16px', right: '16px',
                  background: 'var(--glass-hover)', border: 'none', borderRadius: '4px',
                  color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 180ms ease', zIndex: 2,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-hover)'}
              ><X size={15} /></button>

              {/* Kicker + Mission heading */}
              <span style={{
                fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em',
                textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
              }}>
                About Feelivate
              </span>
              <h2 style={{
                fontSize: isMobile ? '27px' : '38px', fontWeight: 700,
                letterSpacing: '-0.05em', lineHeight: 1.04,
                color: 'var(--text-primary)', margin: '14px 0 20px',
                fontFamily: clashDisplay,
              }}>
                We don't sell motivation.
                <br />
                <span style={{
                  fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif",
                  fontWeight: 400, color: 'var(--text-secondary)',
                }}>We build</span> execution.
              </h2>

              <p style={{
                fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7,
                fontFamily: satoshi, fontWeight: 500, marginBottom: '30px',
              }}>
                Feelivate is an AI behavioral mentor. You tell it what you actually want to become — fitter, focused, out of a rut — and it turns that fuzzy wish into a locked, hyper-specific 7-day plan, then holds you to it every single day until the person you described becomes the person you are.
              </p>

              {/* Story blocks */}
              {[
                {
                  label: 'Why we exist',
                  body: "Almost nobody fails from a lack of goals — they fail at execution. Vague to-do lists, decision fatigue, zero accountability, and no honest feedback. Motivation is loud on Monday and gone by Wednesday. We built Feelivate because willpower is a terrible system, and most people just need one relentless partner who won't let them quietly give up.",
                },
                {
                  label: 'How it works',
                  body: "You talk to your mentor like a friend. It extracts the real goal, breaks it into exact daily micro-actions, and locks the week so you can't soften it. Then it shows up: a personalized task email every morning at your time, streaks to protect, voice check-ins on hard days, and an honest report card every week. It remembers your patterns and quietly raises the difficulty as you grow.",
                },
                {
                  label: 'What we believe',
                  body: "You don't rise to your goals; you fall to your systems. Accountability beats inspiration. Small, non-negotiable daily actions compound into a different life. Your future self is watching — Feelivate exists to make sure you don't disappoint them.",
                },
              ].map((block, i) => (
                <div
                  key={i}
                  style={{
                    paddingTop: '20px', marginTop: i === 0 ? 0 : '4px',
                    borderTop: '1px solid var(--border-subtle)',
                    marginBottom: '18px',
                  }}
                >
                  <h3 style={{
                    fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)',
                    letterSpacing: '0.12em', textTransform: 'uppercase',
                    marginBottom: '10px', fontFamily: satoshi,
                  }}>
                    {block.label}
                  </h3>
                  <p style={{
                    fontSize: '13.5px', color: 'var(--text-secondary)',
                    lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500,
                  }}>
                    {block.body}
                  </p>
                </div>
              ))}

              {/* Pull quote */}
              <p style={{
                fontSize: '17px', color: 'var(--text-muted)', lineHeight: 1.6,
                fontStyle: 'italic', fontFamily: "'Georgia', 'Times New Roman', serif",
                textAlign: 'center', padding: '14px 0 4px',
              }}>
                "Your future self is watching. Don't disappoint them."
              </p>
              <p style={{
                fontSize: '10px', color: 'var(--text-primary)', fontWeight: 700,
                letterSpacing: '0.15em', fontFamily: satoshi,
                textTransform: 'uppercase', textAlign: 'center', marginBottom: '26px',
              }}>
                Built by JUNE64
              </p>

              {/* CTA */}
              <button
                onClick={() => { setShowAbout(false); setIsLogin(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%',
                  background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none',
                  padding: '15px', borderRadius: '4px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'opacity 180ms ease',
                  fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Start Your First Week <ArrowRight size={15} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES MODAL — Full capability breakdown, Swiss grid
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showFeatures && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFeatures(false)}
              style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, x: '-50%', y: '-44%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.96, x: '-50%', y: '-47%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                borderRadius: '4px',
                padding: isMobile ? '28px 20px' : '44px 44px 36px',
                zIndex: 201,
                width: 'calc(100% - 32px)', maxWidth: '760px',
                maxHeight: '86vh', overflowY: 'auto',
                boxShadow: 'var(--shadow-xl)',
                fontFamily: satoshi,
              }}
            >
              <button
                onClick={() => setShowFeatures(false)}
                style={{
                  position: 'absolute', top: '16px', right: '16px',
                  background: 'var(--glass-hover)', border: 'none', borderRadius: '4px',
                  color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 180ms ease', zIndex: 2,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-hover)'}
              ><X size={15} /></button>

              {/* Header */}
              <div style={{ marginBottom: isMobile ? '24px' : '32px', maxWidth: '480px' }}>
                <span style={{
                  fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em',
                  textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi,
                }}>
                  What you get
                </span>
                <h2 style={{
                  fontSize: isMobile ? '26px' : '34px', fontWeight: 700,
                  letterSpacing: '-0.05em', lineHeight: 1.05,
                  color: 'var(--text-primary)', margin: '12px 0 12px',
                  fontFamily: clashDisplay,
                }}>
                  Everything Feelivate does
                </h2>
                <p style={{
                  fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65,
                  fontFamily: satoshi, fontWeight: 500,
                }}>
                  A complete accountability system — from turning a fuzzy goal into a locked weekly plan, to dragging you across the finish line every single day.
                </p>
              </div>

              {/* Feature grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: '1px',
                background: 'var(--border-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                {platformFeatures.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.35, ease: 'easeOut' }}
                    style={{
                      padding: isMobile ? '20px 18px' : '24px 22px',
                      background: 'var(--modal-bg)',
                      transition: 'background 220ms ease',
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'var(--card-bg)'; }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'var(--modal-bg)'; }}
                  >
                    <span style={{
                      fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)',
                      letterSpacing: '0.08em', fontFamily: satoshi,
                    }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 style={{
                      fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)',
                      margin: '10px 0 8px', letterSpacing: '-0.02em', fontFamily: clashDisplay,
                    }}>
                      {f.title}
                    </h3>
                    <p style={{
                      fontSize: '12.5px', color: 'var(--text-secondary)',
                      lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500,
                    }}>
                      {f.desc}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <button
                onClick={() => { setShowFeatures(false); setIsLogin(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', marginTop: isMobile ? '24px' : '28px',
                  background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none',
                  padding: '15px', borderRadius: '4px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'opacity 180ms ease',
                  fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Start Free <ArrowRight size={15} />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          GOOGLE POPUP — Swiss minimal
          ══════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showGooglePopup && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGooglePopup(false)}
              style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay)', backdropFilter: 'blur(6px)', zIndex: 200 }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, x: '-50%', y: '-44%' }}
              animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
              exit={{ opacity: 0, scale: 0.94, x: '-50%', y: '-47%' }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              style={{
                position: 'fixed', top: '50%', left: '50%',
                background: 'var(--modal-bg)', border: '1px solid var(--modal-border)',
                borderRadius: '4px', padding: '40px 32px',
                zIndex: 201, textAlign: 'center',
                width: '100%', maxWidth: '380px',
                boxShadow: 'var(--shadow-xl)',
                fontFamily: satoshi,
              }}
            >
              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'var(--glass-hover)', border: 'none', borderRadius: '4px',
                  color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 180ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--btn-hover-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-hover)'}
              ><X size={15} /></button>

              <div style={{
                width: '56px', height: '56px', background: 'var(--card-bg)',
                borderRadius: '4px', border: '1px solid var(--border-medium)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <GoogleIcon />
              </div>

              <h3 style={{
                fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)',
                marginBottom: '10px', letterSpacing: '-0.04em',
                fontFamily: clashDisplay,
              }}>
                Coming Soon
              </h3>
              <p style={{
                fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65,
                marginBottom: '24px', fontFamily: satoshi, fontWeight: 500,
              }}>
                Google authentication is on its way. For now, sign in with email and password — it takes 30 seconds.
              </p>

              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  width: '100%', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none',
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

        input::placeholder { color: var(--text-placeholder) !important; }
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

        /* Marquee Animation */
        .marquee-content {
          animation: scrollMarquee 40s linear infinite;
        }
        @keyframes scrollMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Smooth scrolling for whole page */
        html { scroll-behavior: smooth; }
      `}</style>
    </div>
  );
}
