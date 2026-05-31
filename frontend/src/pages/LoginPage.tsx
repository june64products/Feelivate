import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User as UserIcon, ArrowRight, Loader2, X, ArrowDown } from 'lucide-react';
import { login, signup } from '../api';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

const features = [
  { icon: '🎯', title: 'Goal Intake',         desc: 'Tell me your goal once — I ask just 3 smart questions to understand you completely.' },
  { icon: '📅', title: 'Weekly Action Plans', desc: 'Get a hyper-specific 7-day roadmap. No vague advice — exact tasks, times, and steps.' },
  { icon: '🔒', title: 'Plan Locking',        desc: "Once you approve a week, it's locked in. Commitment is the strategy." },
  { icon: '📈', title: 'Progressive Growth',  desc: 'Every week builds on the last. Week 4 you is not Week 1 you.' },
];

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

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#F2EFE9',
      fontFamily: "'Inter', system-ui, sans-serif",
      color: '#000000',
      overflowX: 'hidden',
      overflowY: 'auto',
    }}>
      {/* Fonts & Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700;800&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        
        ::selection { background: #000000; color: #FF4D00; }
        
        .archivo-black { font-family: 'Archivo Black', sans-serif; text-transform: uppercase; letter-spacing: -0.04em; }
        .space-mono { font-family: 'Space Mono', monospace; letter-spacing: -0.02em; }
        
        .brutalist-input {
          width: 100%;
          padding: 16px 14px 16px 48px;
          border-radius: 0px;
          border: 2px solid #000000;
          background: #ffffff;
          color: #000000;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Space Mono', monospace;
          outline: none;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .brutalist-input:focus {
          transform: translate(-4px, -4px);
          box-shadow: 4px 4px 0px #000000;
        }
        .brutalist-input::placeholder { color: #888; }
        
        .brutalist-btn {
          border: 2px solid #000000;
          border-radius: 9999px;
          transition: all 0.2s;
          cursor: pointer;
        }
        .brutalist-btn:hover {
          transform: scale(1.05) translateX(4px);
          box-shadow: -4px 4px 0px rgba(0,0,0,0.2);
        }

        .service-card {
          transition: all 0.3s;
        }
        .service-card:hover {
          background: rgba(255,255,255,0.05);
        }
        .service-card:hover .service-title {
          transform: translateX(16px);
        }
        .service-card:hover .service-arrow {
          opacity: 1 !important;
          transform: rotate(45deg);
        }

        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .marquee-content { display: flex; white-space: nowrap; animation: marquee 20s linear infinite; }
        .marquee-reverse { display: flex; white-space: nowrap; animation: marquee 25s linear infinite reverse; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 12s linear infinite; }
        .animate-spin { animation: spin 1s linear infinite; }

        .footer-link {
          color: #9c9a92;
          text-decoration: none;
          transition: color 0.2s;
        }
        .footer-link:hover {
          color: #FF4D00;
        }

        @media (max-width: 960px) {
          .split-container { flex-direction: column !important; }
          .split-left { min-height: 100vh; }
          .split-right { display: none !important; }
          .footer-links-container { flex-direction: column; gap: 40px !important; }
          .pill-nav { display: none !important; }
        }
      `}</style>

      {/* Floating Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '80px', padding: '0 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        zIndex: 100, pointerEvents: 'none'
      }}>
        {/* Left Logo */}
        <div className="archivo-black" style={{ fontSize: '24px', pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '34px', height: '34px',
            background: '#e0e0e0',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
            border: '2px solid #000'
          }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
          </div>
          FEELIVATE
        </div>

        {/* Center Pill */}
        <div className="pill-nav" style={{
          background: '#000000', borderRadius: '9999px',
          padding: '8px 24px', display: 'flex', gap: '24px',
          pointerEvents: 'auto', border: '2px solid rgba(255,255,255,0.1)'
        }}>
          {['Meet Feelivate', 'Platform', 'Solutions', 'Pricing', 'Resources'].map(item => (
            <button key={item} className="space-mono" style={{
              background: 'transparent', border: 'none', color: '#ffffff',
              fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s', padding: '4px 8px', borderRadius: '4px'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.color = '#000000'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ffffff'; }}
            >{item}</button>
          ))}
        </div>

        {/* Right CTA */}
        <div style={{ pointerEvents: 'auto' }}>
          <button className="brutalist-btn space-mono" style={{
            background: '#000000', color: '#ffffff', padding: '10px 24px',
            fontSize: '12px', fontWeight: 'bold'
          }} onClick={() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); setIsLogin(false); }}>
            TRY FEELIVATE
          </button>
        </div>
      </nav>

      {/* Main Split Content */}
      <div className="split-container" style={{ flex: 1, display: 'flex', minHeight: '100vh', paddingTop: '80px', borderBottom: '2px solid #000' }}>
        
        {/* LEFT: Sign-In Form */}
        <div className="split-left" style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '60px 40px', background: '#F2EFE9', position: 'relative'
        }}>
          <div ref={formRef} style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
            <div style={{
              background: '#000000', padding: '48px', border: '2px solid #000000',
              boxShadow: '8px 8px 0px rgba(0,0,0,1)', borderRadius: '0px'
            }}>
              
              <div style={{ marginBottom: '32px' }}>
                <h1 className="archivo-black" style={{ fontSize: '32px', color: '#FF4D00', marginBottom: '8px', lineHeight: 1.1 }}>
                  {isLogin ? 'Sign in to Feelivate' : 'Create your account'}
                </h1>
                <p className="space-mono" style={{ fontSize: '13px', color: '#ffffff', opacity: 0.8, textTransform: 'uppercase' }}>
                  {isLogin 
                    ? 'Your AI mentor is waiting. Pick up right where you left off.' 
                    : 'Start your journey. Your first weekly plan is one conversation away.'}
                </p>
              </div>

              {error && (
                <div className="space-mono" style={{
                  padding: '12px', border: '2px solid #FF4D00', color: '#FF4D00',
                  fontSize: '12px', marginBottom: '20px', fontWeight: 'bold'
                }}>{error}</div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                <AnimatePresence initial={false}>
                  {!isLogin && (
                    <motion.div
                      key="name-field"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="space-mono" style={{ fontSize: '12px', color: '#FF4D00', fontWeight: 'bold' }}>FULL_NAME</label>
                        <div style={{ position: 'relative' }}>
                          <UserIcon size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#000' }} />
                          <input type="text" name="name" required placeholder="John Doe" value={formData.name} onChange={handleInputChange} className="brutalist-input" />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="space-mono" style={{ fontSize: '12px', color: '#FF4D00', fontWeight: 'bold' }}>EMAIL</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#000' }} />
                    <input type="email" name="email" required placeholder="Enter your email" value={formData.email} onChange={handleInputChange} className="brutalist-input" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="space-mono" style={{ fontSize: '12px', color: '#FF4D00', fontWeight: 'bold' }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#000' }} />
                    <input type="password" name="password" required placeholder="Enter password" value={formData.password} onChange={handleInputChange} className="brutalist-input" />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="brutalist-btn archivo-black" style={{
                  background: '#FF4D00', color: '#000000', border: '2px solid #FF4D00',
                  padding: '16px', fontSize: '16px', marginTop: '8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  borderRadius: '0px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if(!loading) { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#ffffff'; } }}
                onMouseLeave={e => { if(!loading) { e.currentTarget.style.background = '#FF4D00'; e.currentTarget.style.borderColor = '#FF4D00'; } }}
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <>{isLogin ? 'Continue' : 'Create Account'}<ArrowRight size={20} /></>}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
                  <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.2)' }} />
                  <span className="space-mono" style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>OR</span>
                  <div style={{ flex: 1, height: '2px', background: 'rgba(255,255,255,0.2)' }} />
                </div>

                <button type="button" onClick={() => setShowGooglePopup(true)} className="brutalist-btn space-mono" style={{
                  background: '#ffffff', color: '#000000', border: '2px solid #ffffff',
                  padding: '14px', fontSize: '14px', borderRadius: '0px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                  fontWeight: 'bold',
                }}>
                  <GoogleIcon /> CONTINUE WITH GOOGLE
                </button>
              </form>

              <p className="space-mono" style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#fff', textTransform: 'uppercase' }}>
                {isLogin ? 'New to Feelivate? ' : 'Already have an account? '}
                <button onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{
                  background: 'transparent', border: 'none', color: '#FF4D00',
                  fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline',
                  fontFamily: 'inherit'
                }}>
                  {isLogin ? 'Create account' : 'Log in here'}
                </button>
              </p>

            </div>
          </div>
          
          {/* Rotating Indicator */}
          <div style={{ position: 'absolute', bottom: '40px', right: '40px', zIndex: 1 }}>
            <div style={{ width: '120px', height: '120px', position: 'relative' }}>
              <svg viewBox="0 0 100 100" className="animate-spin-slow" style={{ width: '100%', height: '100%' }}>
                <path id="circlePath" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
                <text className="space-mono" style={{ fontSize: '11px', fontWeight: 'bold', fill: '#000' }}>
                  <textPath href="#circlePath" startOffset="0%">SCROLL DOWN • SCROLL DOWN • SCROLL DOWN • </textPath>
                </text>
              </svg>
              <ArrowDown size={24} color="#000" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
            </div>
          </div>
        </div>

        {/* RIGHT: Brand Panel / Service List */}
        <div className="split-right" style={{
          flex: 1, background: '#000000', borderLeft: '2px solid #000000',
          display: 'flex', flexDirection: 'column', padding: '60px 0',
          overflow: 'hidden', position: 'relative'
        }}>
          
          <div style={{ padding: '0 60px', marginBottom: '40px' }}>
            <div className="space-mono" style={{
              display: 'inline-block', color: '#FF4D00', border: '2px solid #FF4D00',
              padding: '6px 12px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px'
            }}>
              [ FEELIVATE AI MENTOR ]
            </div>
            <h2 className="archivo-black" style={{ fontSize: '3.5vw', color: '#ffffff', lineHeight: 0.9, marginBottom: '24px' }}>
              TELL ME YOUR GOAL ONCE.<br/>
              <span style={{ color: '#FF4D00' }}>I'LL BUILD THE REST.</span>
            </h2>
            <p className="space-mono" style={{ fontSize: '14px', color: '#ffffff', opacity: 0.8, maxWidth: '80%', textTransform: 'uppercase' }}>
              Not a to-do list. A commitment. Hyper-specific weekly plans, locked in, week after week.
            </p>
          </div>

          {/* Brutalist Service Card List */}
          <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
            {features.map((f, i) => (
              <div key={i} className="service-card" style={{
                display: 'flex', alignItems: 'center', padding: '30px 60px',
                borderBottom: '1px solid rgba(255,255,255,0.2)', cursor: 'default',
                position: 'relative', overflow: 'hidden'
              }}>
                <div className="space-mono" style={{ fontSize: '18px', color: '#FF4D00', fontWeight: 'bold', width: '60px' }}>
                  0{i+1}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="archivo-black service-title" style={{ fontSize: '24px', color: '#ffffff', transition: 'transform 0.3s' }}>
                    {f.title}
                  </div>
                  <div className="space-mono" style={{ fontSize: '12px', color: '#aaaaaa', marginTop: '8px', textTransform: 'uppercase' }}>
                    {f.desc}
                  </div>
                </div>
                <ArrowRight className="service-arrow" size={32} color="#FF4D00" style={{ opacity: 0, transition: 'all 0.3s' }} />
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Skewed Marquee Section */}
      <div style={{ background: '#000000', borderBottom: '2px solid #000', padding: '60px 0', overflow: 'hidden', transform: 'skewY(-2deg)', transformOrigin: '0 100%', zIndex: 10, position: 'relative' }}>
        <div className="marquee-content" style={{ marginBottom: '10px' }}>
          {[...Array(6)].map((_, i) => (
            <span key={i} className="archivo-black" style={{ fontSize: '6vw', color: '#FF4D00', marginRight: '40px', lineHeight: 0.9 }}>
              EMOTIONAL TIME TRAVEL • AI MENTOR • 
            </span>
          ))}
        </div>
        <div className="marquee-reverse">
          {[...Array(6)].map((_, i) => (
            <span key={i} className="archivo-black" style={{ fontSize: '4.5vw', color: 'rgba(255,255,255,0.8)', marginRight: '40px', lineHeight: 0.9 }}>
              BEHAVIORAL TRANSFORMATION • GOAL INTELLIGENCE • 
            </span>
          ))}
        </div>
      </div>

      {/* Giant CTA & Footer */}
      <div style={{ background: '#000000', color: '#ffffff', paddingTop: '100px' }}>
        
        <div style={{ textAlign: 'center', padding: '0 40px 100px' }}>
          <h2 className="archivo-black" style={{ fontSize: '10vw', lineHeight: 0.85, marginBottom: '40px' }}>
            READY TO <br/><span style={{ color: '#FF4D00' }}>START?</span>
          </h2>
          <button className="brutalist-btn space-mono" style={{
            background: '#ffffff', color: '#000000', padding: '20px 48px',
            fontSize: '18px', fontWeight: 'bold', borderRadius: '9999px'
          }} onClick={() => { formRef.current?.scrollIntoView({ behavior: 'smooth' }); setIsLogin(false); }}>
            CREATE YOUR ACCOUNT
          </button>
        </div>

        {/* Footer Inspired by Claude Screenshot */}
        <footer style={{
          borderTop: '2px solid #ffffff',
          padding: '60px 40px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: '60px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '40px' }}>
            
            {/* Left Logo - June64 */}
            <div style={{ flex: '1 1 300px' }}>
              <div className="archivo-black" style={{ fontSize: '32px', color: '#FF4D00', marginBottom: '8px' }}>
                FEELIVATE
              </div>
              <div className="space-mono" style={{ fontSize: '12px', color: '#9c9a92', marginBottom: '40px' }}>
                Next Generation Goal Intelligence
              </div>
            </div>

            {/* Links Columns */}
            <div className="footer-links-container" style={{ display: 'flex', gap: '80px', flexWrap: 'wrap', flex: '2 1 auto' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="space-mono" style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Products</div>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Feelivate Pro</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Feelivate Teams</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Enterprise</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Pricing</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Download App</a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="space-mono" style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Solutions</div>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>AI Coaching</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Personal Growth</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Habit Tracking</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Team Accountability</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Education</a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="space-mono" style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Resources</div>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Blog</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Methodology</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Customer Stories</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Help Center</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Community</a>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="space-mono" style={{ color: '#ffffff', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Company</div>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>About June64</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Careers</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Research</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Terms of Service</a>
                <a href="#" className="footer-link space-mono" style={{ fontSize: '13px' }}>Privacy Policy</a>
              </div>

            </div>
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap',
            paddingTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div className="space-mono" style={{ fontSize: '12px', color: '#9c9a92' }}>
              <span style={{ fontWeight: 'bold', color: '#ffffff' }}>BY. JUNE64</span><br/>
              © 2026 June64 Ltd. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              {/* Social icons placeholders */}
              <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
              <div style={{ width: '24px', height: '24px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
            </div>
          </div>
        </footer>

      </div>

      {/* Google Popup Modal */}
      <AnimatePresence>
        {showGooglePopup && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowGooglePopup(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)' }}
            />
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 20, opacity: 0 }}
              style={{
                position: 'relative', background: '#F2EFE9', padding: '40px',
                border: '4px solid #000000', width: '100%', maxWidth: '400px',
                boxShadow: '16px 16px 0px #000000'
              }}
            >
              <button onClick={() => setShowGooglePopup(false)} style={{
                position: 'absolute', top: '16px', right: '16px', background: 'transparent',
                border: 'none', cursor: 'pointer', color: '#000'
              }}><X size={24} /></button>
              
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <div style={{ background: '#fff', padding: '16px', border: '2px solid #000' }}>
                  <GoogleIcon />
                </div>
              </div>

              <h3 className="archivo-black" style={{ fontSize: '24px', color: '#000', textAlign: 'center', marginBottom: '16px' }}>
                GOOGLE SIGN IN UNAVAILABLE
              </h3>
              <p className="space-mono" style={{ fontSize: '14px', color: '#000', textAlign: 'center', marginBottom: '32px', fontWeight: 'bold' }}>
                SYSTEM IS CURRENTLY BEING UPGRADED. PLEASE USE EMAIL AND PASSWORD TO AUTHENTICATE.
              </p>

              <button onClick={() => setShowGooglePopup(false)} className="brutalist-btn archivo-black" style={{
                width: '100%', background: '#000', color: '#fff', padding: '16px', fontSize: '16px', borderRadius: '0px'
              }}>
                ACKNOWLEDGE
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
