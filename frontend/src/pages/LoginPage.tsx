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

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 14px 13px 42px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
  color: '#e8e8ed',
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
  color: '#6a6a7a',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
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
        // Clear any stale session from a different account
        localStorage.removeItem('active_session_id');
        localStorage.setItem('user_id', res.user_id);
        localStorage.setItem('user_name', res.name || res.full_name || formData.email.split('@')[0]);
        navigate('/app');
      } else {
        const res = await signup({ email: formData.email, password: formData.password, name: formData.name });
        // Clear any stale session from a different account
        localStorage.removeItem('active_session_id');
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

  const pageFont = "'Inter', system-ui, -apple-system, sans-serif";

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#060608',
      fontFamily: pageFont,
      color: '#e8e8ed',
      overflow: 'hidden',
      position: 'relative',
      padding: '40px 20px',
    }}>

      {/* ── Ambient Background Orbs ─────────────────────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div
          animate={{ x: [0, 30, -20, 0], y: [0, -25, 15, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            top: '-8%', left: '15%',
            width: '420px', height: '420px',
            background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
            borderRadius: '50%', filter: 'blur(80px)',
          }}
        />
        <motion.div
          animate={{ x: [0, -25, 20, 0], y: [0, 20, -15, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{
            position: 'absolute',
            bottom: '-5%', right: '10%',
            width: '500px', height: '500px',
            background: 'radial-gradient(circle, rgba(217,119,87,0.08) 0%, transparent 70%)',
            borderRadius: '50%', filter: 'blur(90px)',
          }}
        />
        <motion.div
          animate={{ x: [0, 15, -10, 0], y: [0, -10, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
          style={{
            position: 'absolute',
            top: '50%', left: '60%',
            width: '280px', height: '280px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
            borderRadius: '50%', filter: 'blur(70px)',
          }}
        />
      </div>

      {/* ── Main Card ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Logo + Brand */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '12px', marginBottom: '36px',
        }}>
          <div style={{
            width: '36px', height: '36px',
            background: '#fff', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.03em', color: '#e8e8ed' }}>
            FEELIVATE
          </span>
        </div>

        {/* Glass Card */}
        <div ref={formRef} style={{
          background: 'rgba(255,255,255,0.025)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '24px',
          padding: '36px 32px 32px',
          boxShadow: '0 16px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)',
        }}>

          {/* Heading */}
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <AnimatePresence mode="wait">
              <motion.h1
                key={isLogin ? 'login-h' : 'signup-h'}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{
                  fontSize: '26px', fontWeight: 700,
                  letterSpacing: '-0.03em', color: '#e8e8ed',
                  marginBottom: '8px', lineHeight: 1.2,
                }}
              >
                {isLogin ? 'Welcome back' : 'Create your account'}
              </motion.h1>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              <motion.p
                key={isLogin ? 'login-p' : 'signup-p'}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2, ease: 'easeOut', delay: 0.04 }}
                style={{ fontSize: '13.5px', color: '#6a6a7a', lineHeight: 1.6 }}
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
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                  color: '#f87171', fontSize: '13px', marginBottom: '18px',
                }}
              >{error}</motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

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
                      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#44445a', display: 'flex' }}>
                        <UserIcon size={15} />
                      </span>
                      <input
                        type="text" name="name" required placeholder="John Doe"
                        value={formData.name} onChange={handleInputChange}
                        style={inputStyle}
                        onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.08)'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
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
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#44445a', display: 'flex' }}>
                  <Mail size={15} />
                </span>
                <input
                  type="email" name="email" required placeholder="Enter your email"
                  value={formData.email} onChange={handleInputChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#44445a', display: 'flex' }}>
                  <Lock size={15} />
                </span>
                <input
                  type="password" name="password" required placeholder="Enter password"
                  value={formData.password} onChange={handleInputChange}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(167,139,250,0.4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(167,139,250,0.08)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Continue button */}
            <button
              type="submit" disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                background: 'linear-gradient(135deg, #d97757 0%, #c96840 100%)',
                color: '#fff', border: 'none',
                padding: '14px', borderRadius: '12px',
                fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.18s, transform 0.15s, box-shadow 0.18s',
                marginTop: '4px', opacity: loading ? 0.7 : 1,
                letterSpacing: '-0.02em',
                boxShadow: '0 4px 20px rgba(217,119,87,0.35)',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(217,119,87,0.5)'; } }}
              onMouseLeave={e => { if (!loading) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(217,119,87,0.35)'; } }}
            >
              {loading
                ? <Loader2 size={16} className="animate-spin" />
                : <>{isLogin ? 'Continue' : 'Create Account'}<ArrowRight size={15} /></>
              }
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '2px 0' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
              <span style={{ fontSize: '11.5px', color: '#44445a', fontWeight: 500 }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Google */}
            <button
              type="button" onClick={() => setShowGooglePopup(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                background: 'transparent', color: '#e8e8ed',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '13px', borderRadius: '12px',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                transition: 'background 0.18s, border-color 0.18s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          {/* Toggle Login / Signup */}
          <p style={{ marginTop: '22px', textAlign: 'center', fontSize: '13.5px', color: '#6a6a7a' }}>
            {isLogin ? 'New to Feelivate? ' : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              style={{
                background: 'transparent', border: 'none', color: '#a78bfa',
                fontWeight: 700, cursor: 'pointer', padding: 0,
                fontSize: '13.5px', transition: 'opacity 0.18s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.72'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {isLogin ? 'Create account' : 'Log in here'}
            </button>
          </p>
        </div>

        {/* ── Footer: Claude-style horizontal ──────────────────────────── */}
        <div className="login-footer" style={{ marginTop: '32px' }}>
          <div className="footer-left">
            <img src="/logo_2_backup.png" alt="Feelivate" className="footer-logo-img" />
            <span className="footer-brand">Feelivate</span>
            <span className="footer-copy">© 2024</span>
          </div>
          <div className="footer-sep" />
          <div className="footer-right">
            <span className="footer-by">By</span>
            <img src="/june64-logo.png" alt="June64" className="footer-june64-img" />
            <span className="footer-june64-text">June64</span>
          </div>
        </div>
      </motion.div>

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
                background: '#111116', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '20px', padding: '36px 32px',
                zIndex: 201, textAlign: 'center',
                width: '100%', maxWidth: '350px',
                boxShadow: '0 32px 80px rgba(0,0,0,0.55)',
              }}
            >
              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  position: 'absolute', top: '14px', right: '14px',
                  background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '8px',
                  color: '#6a6a7a', cursor: 'pointer', padding: '6px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.18s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              ><X size={15} /></button>

              <div style={{
                width: '52px', height: '52px', background: 'rgba(255,255,255,0.04)',
                borderRadius: '14px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 18px',
              }}>
                <GoogleIcon />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#e8e8ed', marginBottom: '10px', letterSpacing: '-0.025em' }}>
                Google Sign In — Coming Soon
              </h3>
              <p style={{ fontSize: '13px', color: '#6a6a7a', lineHeight: 1.65, marginBottom: '22px' }}>
                We're working on Google authentication. For now, please sign in with your email and password — it takes just 30 seconds.
              </p>

              <button
                onClick={() => setShowGooglePopup(false)}
                style={{
                  width: '100%', background: '#fff', color: '#060608', border: 'none',
                  padding: '13px', borderRadius: '12px', fontSize: '14px',
                  fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.18s',
                  letterSpacing: '-0.02em',
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
        input::placeholder { color: #3a3a4a !important; }
        input { box-sizing: border-box; }
      `}</style>
    </div>
  );
}
