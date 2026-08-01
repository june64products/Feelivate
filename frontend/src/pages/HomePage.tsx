import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Lock, Mail, LineChart, Mic, Calendar, ChevronDown, Check, Flame } from 'lucide-react';
import Seo, { SITE_URL } from '../components/site/Seo';
import BrandNav from '../components/site/BrandNav';
import SiteFooter from '../components/site/SiteFooter';
import Testimonials from '../components/site/Testimonials';
import { VideoSlot, PhotoSlot } from '../components/site/MediaSlots';
import { useWindowSize } from '../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// ─── Hero media ───────────────────────────────────────────────────────────────
// Drop the files into frontend/public/media/ and fill these in. Until then the
// slots render labelled placeholders at the exact final size, so adding the real
// assets never shifts the layout.
const HERO_VIDEO_SRC: string | undefined = undefined;   // e.g. '/media/demo.mp4'
const HERO_VIDEO_POSTER: string | undefined = undefined; // e.g. '/media/demo-poster.jpg'
const HERO_PHOTOS: { src?: string; label: string; alt: string }[] = [
  { src: undefined, label: 'Photo 1 · Chat', alt: 'Planning a week with the Feelivate mentor' },
  { src: undefined, label: 'Photo 2 · Daily email', alt: 'The daily task email' },
  { src: undefined, label: 'Photo 3 · Weekly report', alt: 'End-of-week report card' },
];

const STEPS = [
  { icon: MessageSquare, title: 'Tell your mentor the goal', desc: 'Chat naturally. Feelivate strips the noise and pulls out what you actually want to become.' },
  { icon: Lock, title: 'Get a locked 7-day plan', desc: 'Exact daily micro-actions, sequenced and timed. Once approved, the week locks — no softening it later.' },
  { icon: Mail, title: 'Execute daily', desc: 'A personalized task email lands each morning at your time. Do the task, keep the streak alive.' },
  { icon: LineChart, title: 'Review & level up', desc: 'An honest weekly report shows what you did vs. promised. Next week ramps as you grow.' },
];

const HIGHLIGHTS = [
  { icon: MessageSquare, title: 'AI Accountability Mentor', desc: 'A relentless mentor that learns your patterns and calls out your excuses.' },
  { icon: Lock, title: 'The Lock-In Protocol', desc: "Once your week is set, it's locked. You commit and execute — or the streak breaks." },
  { icon: Mail, title: 'Daily Task Emails', desc: "Today's exact task + how-to tips, delivered at your time, in your timezone." },
  { icon: LineChart, title: 'Streaks & Weekly Reports', desc: 'Track real momentum and get an honest end-of-week report card.' },
  { icon: Mic, title: 'Voice Journal & Emotions', desc: 'Talk or type how you feel — the plan adapts to your reality.' },
  { icon: Calendar, title: 'Calendar Sync', desc: 'Plans drop into your calendar with reminders. Scheduled, not left to willpower.' },
];

const USE_CASES = [
  { title: 'Get fit & consistent', desc: 'Turn "I want to get in shape" into a locked weekly training + nutrition rhythm.' },
  { title: 'Ship deep work', desc: 'Break a big project into daily focused blocks you actually complete.' },
  { title: 'Build a business', desc: 'Convert a vague ambition into concrete weekly launch actions.' },
  { title: 'Fix your habits', desc: 'Replace willpower with a system that nudges you every single day.' },
];

const FAQS = [
  { q: 'What is Feelivate?', a: 'Feelivate is an AI accountability mentor that turns your goals into locked 7-day action plans, then keeps you accountable with daily task emails, streaks, weekly reports, and voice check-ins.' },
  { q: 'How is it different from a to-do app?', a: "To-do apps store tasks; Feelivate builds the plan for you, locks it so you can't quietly make it easier, and actively drives you to execute every day." },
  { q: 'How much does it cost?', a: 'Feelivate is currently free — founding members get full access to the best version at no cost.' },
  { q: 'Do I have to talk to it?', a: 'No. You can type or send a voice memo. Feelivate reads your emotional state either way and adapts the plan.' },
  { q: 'What happens each week?', a: 'You get an honest report of what you actually did versus what you committed to, and the next week is generated — slightly harder as you improve.' },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>
      {children}
    </span>
  );
}

function PrimaryCta({ children = 'Get Started', to = '/login' }: { children?: React.ReactNode; to?: string }) {
  return (
    <Link to={to} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '15px 26px', borderRadius: '4px', fontSize: '14px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
      {children} <ArrowRight size={15} />
    </Link>
  );
}

export default function HomePage() {
  const { isMobile } = useWindowSize();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Logged-in users go straight to the app.
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('access_token') && localStorage.getItem('user_id')) {
      navigate('/app', { replace: true });
    }
  }, [navigate]);

  const pad = isMobile ? '64px 20px' : '96px 48px';
  const maxW = '1080px';

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Feelivate',
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      description: 'AI accountability mentor that turns goals into locked 7-day action plans with daily task emails, streaks, weekly reports, and voice check-ins.',
      url: SITE_URL + '/',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free for founding members' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', height: '100vh', overflowY: 'auto', overflowX: 'hidden' }}>
      <Seo
        title="Feelivate — AI Accountability Mentor for Weekly Action Plans"
        description="Turn your goals into locked 7-day action plans. Daily task emails, streaks, weekly reports, and voice check-ins keep you accountable — every single day. Free for founding members."
        path="/"
        jsonLd={jsonLd}
      />
      <BrandNav />

      {/* Hero — clear product explanation + live preview */}
      <header style={{ padding: isMobile ? '40px 20px 52px' : '68px 48px 84px', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: isMobile ? '38px' : '56px', alignItems: 'center' }}>
          {/* Left — what it is */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Kicker>AI Accountability Mentor</Kicker>
            <h1 style={{ fontSize: isMobile ? '37px' : '58px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.0, margin: '16px 0 18px', fontFamily: clash }}>
              Turn your goals into a plan you'll{' '}
              <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif", fontWeight: 400, color: 'var(--text-secondary)' }}>actually</span> finish.
            </h1>
            <p style={{ fontSize: isMobile ? '15px' : '17px', color: 'var(--text-secondary)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500, marginBottom: '26px', maxWidth: '520px' }}>
              Feelivate is your AI accountability mentor. Tell it what you want to achieve — it builds a locked 7-day plan, emails you the exact task every morning, tracks your streak, and hands you an honest weekly report. You just execute.
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <PrimaryCta>Start Free</PrimaryCta>
              <Link to="/features" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', padding: '15px 26px', borderRadius: '4px', fontSize: '14px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
                See How It Works
              </Link>
            </div>
            <p style={{ marginTop: '16px', fontSize: '12.5px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500 }}>
              Free for founding members · No credit card
            </p>
          </motion.div>

          {/* Right — product preview mock (div-based, no image) */}
          <motion.div
            initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
            style={{ border: '1px solid var(--border-medium)', borderRadius: '10px', background: 'var(--card-bg)', padding: isMobile ? '18px' : '22px', boxShadow: 'var(--shadow-xl)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>Week 1 · Wednesday</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: 'var(--accent-warm)', fontFamily: satoshi }}>
                <Flame size={13} /> 3-day streak
              </span>
            </div>

            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: '7px', padding: '16px', marginBottom: '14px', background: 'var(--bg-primary)' }}>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-warm)', fontFamily: satoshi }}>Today's task</span>
              <h3 style={{ fontSize: '17px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', margin: '8px 0 6px' }}>30-minute morning run</h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55, fontFamily: satoshi, fontWeight: 500 }}>Easy pace — the goal is to show up, not to race. Lay your shoes out tonight.</p>
            </div>

            {[
              { d: 'Mon', t: 'Meal prep + grocery run', done: true },
              { d: 'Tue', t: '20-minute walk', done: true },
              { d: 'Wed', t: '30-minute morning run', done: false },
            ].map((row) => (
              <div key={row.d} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '9px 0', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid ' + (row.done ? 'var(--accent-warm)' : 'var(--border-focus)'), background: row.done ? 'var(--accent-warm)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {row.done && <Check size={11} style={{ color: '#fff' }} />}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: satoshi, width: '30px' }}>{row.d}</span>
                <span style={{ fontSize: '13px', color: row.done ? 'var(--text-muted)' : 'var(--text-primary)', fontFamily: satoshi, fontWeight: 500, textDecoration: row.done ? 'line-through' : 'none' }}>{row.t}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Hero media — demo clip + supporting screenshots */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ maxWidth: '1140px', margin: isMobile ? '38px auto 0' : '56px auto 0' }}
        >
          <VideoSlot
            src={HERO_VIDEO_SRC}
            poster={HERO_VIDEO_POSTER}
            label="See a week get built in 60 seconds"
            hint="Video slot — drop demo.mp4 in /public/media, then set HERO_VIDEO_SRC in HomePage.tsx"
          />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px', marginTop: '14px' }}>
            {HERO_PHOTOS.map((p) => (
              <PhotoSlot key={p.label} src={p.src} alt={p.alt} label={p.label} ratio="16 / 10" />
            ))}
          </div>
        </motion.div>
      </header>

      {/* Problem */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <Kicker>The problem</Kicker>
          <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '14px 0 14px', fontFamily: clash, maxWidth: '620px' }}>
            You don't fail from a lack of goals. You fail at execution.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500, maxWidth: '620px', marginBottom: '36px' }}>
            Vague to-do lists, decision fatigue, zero accountability, and no honest feedback. Motivation is loud on Monday and gone by Wednesday. Willpower is a terrible system.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              ['Vague plans', '"Get fit", "be productive" — goals with no daily what, when, or how.'],
              ['No accountability', 'Nobody notices when you skip. So you skip again.'],
              ['No feedback loop', "You never see the honest gap between what you said and what you did."],
            ].map(([t, d]) => (
              <div key={t} style={{ padding: '22px 20px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '8px' }}>{t}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <Kicker>How it works</Kicker>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '14px 0', fontFamily: clash }}>
              From fuzzy goal to daily execution
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '18px' }}>
            {STEPS.map((s, i) => (
              <div key={s.title} className="svc-card" style={{ display: 'flex', gap: '16px', padding: '24px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                <div className="svc-icon" style={{ flexShrink: 0, width: '42px', height: '42px', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <s.icon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: satoshi, marginBottom: '4px' }}>{String(i + 1).padStart(2, '0')}</div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '6px' }}>{s.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '36px' }}>
            <div>
              <Kicker>What you get</Kicker>
              <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '14px 0 0', fontFamily: clash }}>
                A complete accountability system
              </h2>
            </div>
            <Link to="/features" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: satoshi, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              All features <ArrowRight size={14} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
            {HIGHLIGHTS.map((f) => (
              <div key={f.title} className="svc-card" style={{ padding: '26px 22px', background: 'var(--bg-primary)' }}>
                <div className="svc-icon" style={{ width: '40px', height: '40px', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <f.icon size={17} />
                </div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <Kicker>Use cases</Kicker>
          <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '14px 0 32px', fontFamily: clash }}>
            Whatever you're trying to become
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '18px' }}>
            {USE_CASES.map((u) => (
              <div key={u.title} className="svc-card" style={{ padding: '24px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '8px' }}>{u.title}</h3>
                <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof (placeholder) */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <p style={{ fontSize: isMobile ? '20px' : '26px', color: 'var(--text-primary)', lineHeight: 1.5, fontStyle: 'italic', fontFamily: "'Georgia', serif", marginBottom: '18px' }}>
            "Your future self is watching. Don't disappoint them."
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.15em', fontFamily: satoshi, textTransform: 'uppercase' }}>
            The Feelivate Philosophy
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <Kicker>FAQ</Kicker>
            <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '14px 0', fontFamily: clash }}>
              Questions, answered
            </h2>
          </div>
          <div style={{ border: '1px solid var(--border-medium)', borderRadius: '2px', overflow: 'hidden' }}>
            {FAQS.map((f, i) => (
              <div key={f.q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '20px 22px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}
                >
                  <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.01em' }}>{f.q}</span>
                  <ChevronDown size={18} style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', color: 'var(--text-secondary)' }} />
                </button>
                {openFaq === i && (
                  <p style={{ padding: '0 22px 20px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500 }}>{f.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: isMobile ? '72px 20px' : '110px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: '620px', margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? '30px' : '48px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.04, marginBottom: '18px', fontFamily: clash }}>
            Your first week is one conversation away.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500, marginBottom: '30px' }}>
            Free for founding members. Start now and let your mentor build the plan.
          </p>
          <PrimaryCta>Start Free</PrimaryCta>
        </div>
      </section>

      {/* Testimonial wall — placeholders until real, permissioned quotes exist.
          See the notes at the top of Testimonials.tsx before editing the copy. */}
      <Testimonials />

      <SiteFooter />
    </div>
  );
}
