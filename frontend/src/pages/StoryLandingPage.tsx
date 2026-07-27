import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll } from 'framer-motion';
import { ArrowRight, Play, ImageIcon } from 'lucide-react';
import Scene3D from '../components/three/Scene3D';
import Seo from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

type RootRef = React.RefObject<HTMLDivElement | null>;

function Reveal({ children, root, y = 40, delay = 0 }: { children: React.ReactNode; root: RootRef; y?: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px', root }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Screen({ children, isMobile }: { children: React.ReactNode; isMobile: boolean }) {
  return (
    <section
      style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        padding: isMobile ? '92px 22px' : '110px 48px',
        scrollSnapAlign: 'center', scrollSnapStop: 'normal', position: 'relative',
      }}
    >
      {children}
    </section>
  );
}

function MediaSlot({ kind, label }: { kind: 'video' | 'image'; label: string }) {
  return (
    <div
      style={{
        width: '100%', aspectRatio: '16 / 10', borderRadius: '16px',
        border: '1px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', padding: '20px',
      }}
    >
      <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'video' ? <Play size={20} style={{ color: '#f2f2f2' }} /> : <ImageIcon size={20} style={{ color: '#f2f2f2' }} />}
      </div>
      <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: satoshi }}>{label}</span>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontFamily: satoshi, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        {kind === 'video' ? 'Video clip here' : 'Screenshot here'}
      </span>
    </div>
  );
}

const FEATURES = [
  { kind: 'image' as const, media: 'Chat with your mentor', title: 'Just tell it your goal', body: 'Talk like you would to a friend. Feelivate listens, strips the noise, and builds a hyper-specific 7-day plan — exact daily actions, timed and sequenced.' },
  { kind: 'image' as const, media: 'Your locked weekly plan', title: 'Then it locks the week', body: "Once you approve, the week locks. No quietly making it easier on Thursday. You commit and execute — or the streak breaks." },
  { kind: 'image' as const, media: 'Daily task email', title: 'It shows up every morning', body: 'A personalized task lands in your inbox at your time, in your timezone. You always know the one thing to do next.' },
  { kind: 'image' as const, media: 'Streaks & weekly report', title: 'Keeps score, honestly', body: 'Streaks to protect. An unflinching weekly report that shows what you actually did versus what you promised.' },
  { kind: 'video' as const, media: 'Voice check-in', title: 'Reads how you feel', body: 'Talk or type on the hard days. Feelivate reads your emotional state and adapts next week to your reality — no guilt, just adjustment.' },
  { kind: 'image' as const, media: 'Calendar sync', title: 'Fits your real life', body: 'Syncs straight to your calendar with reminders. The work becomes a scheduled appointment with yourself, not a vague someday.' },
];

// Opening lines — one message per screen.
const RELATE = [
  'Every week starts with a promise.',
  '"This time, I\'ll actually be consistent."',
];

// The week's arc — shown together on ONE screen, revealed line by line.
const RELATE_WEEK = [
  'Monday: unstoppable.',
  'Wednesday… where did it go?',
  "By the weekend, you're already planning the next fresh start.",
];

const PROBLEMS = [
  ['Vague goals', '"Get better" isn\'t a task you can actually do today.'],
  ['Zero accountability', 'Nobody notices when you skip. So you skip again.'],
  ['No honest mirror', 'You never see the gap between what you said and what you did.'],
];

const STEPS = [
  ['Be brutally honest', 'Tell it the real goal — and the real reasons you keep quitting.'],
  ['Show up daily', 'Even five minutes counts. Momentum is built by finishing, not planning.'],
  ["Don't negotiate", "Respect the lock. Do the task in front of you and let it push you."],
];

export default function StoryLandingPage() {
  const { isMobile } = useWindowSize();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });

  const big = isMobile ? '30px' : '58px';
  const huge = isMobile ? '42px' : '84px';

  return (
    <div
      ref={scrollRef}
      style={{ height: '100svh', overflowY: 'auto', overflowX: 'hidden', position: 'relative', background: '#0a0a0a', color: '#f2f2f2', scrollSnapType: 'y mandatory' }}
    >
      <Seo
        title="Feelivate — Turn Your Goals Into What You Actually Do"
        description="You already know who you want to become. Feelivate is the AI accountability mentor that turns your goals into a locked weekly plan — and makes sure you follow through."
        path="/story"
        noindex
      />

      <Scene3D progress={scrollYProgress} isMobile={isMobile} />

      {/* Scroll progress bar */}
      <motion.div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '2px', background: '#f2f2f2', transformOrigin: '0%', scaleX: scrollYProgress, zIndex: 50, opacity: 0.7 }} />

      {/* Top bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: isMobile ? '16px 20px' : '22px 40px', pointerEvents: 'none' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', pointerEvents: 'auto' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f2f2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <img src="/logo_2_backup.png" alt="Feelivate" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '-0.03em', color: '#f2f2f2', fontFamily: clash }}>Feelivate</span>
        </Link>
        <Link to="/login" style={{ pointerEvents: 'auto', background: '#f2f2f2', color: '#111', padding: '9px 18px', borderRadius: '100px', fontSize: '13px', fontWeight: 700, fontFamily: satoshi, textDecoration: 'none', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Start Free</Link>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* HERO */}
        <Screen isMobile={isMobile}>
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ maxWidth: '900px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,242,242,0.5)', fontFamily: satoshi }}>AI Accountability Mentor</span>
            <h1 style={{ fontSize: isMobile ? '40px' : '76px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.0, margin: '22px 0 18px', fontFamily: clash }}>
              You already know who<br />you want to become.
            </h1>
            <p style={{ fontSize: isMobile ? '17px' : '22px', color: 'rgba(242,242,242,0.7)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.5, maxWidth: '600px', margin: '0 auto' }}>
              The plan was never the problem. <span style={{ color: '#f2f2f2', fontStyle: 'italic', fontFamily: "'Georgia', serif" }}>Sticking to it</span> is.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ delay: 1.2, duration: 1 }} style={{ position: 'absolute', bottom: '30px', fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: satoshi, color: 'rgba(242,242,242,0.6)' }}>Scroll ↓</motion.div>
        </Screen>

        {/* RELATE — one message per screen */}
        {RELATE.map((line, i) => (
          <Screen key={i} isMobile={isMobile}>
            <Reveal root={scrollRef}>
              <p style={{ fontSize: big, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.12, fontFamily: clash, maxWidth: '820px', color: '#f2f2f2' }}>{line}</p>
            </Reveal>
          </Screen>
        ))}

        {/* THE WEEK'S ARC — Monday / Wednesday / weekend together on ONE screen */}
        <Screen isMobile={isMobile}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '30px', maxWidth: '900px' }}>
            {RELATE_WEEK.map((line, i) => (
              <Reveal key={line} root={scrollRef} delay={i * 0.14}>
                <p style={{ fontSize: big, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.12, fontFamily: clash, color: i === RELATE_WEEK.length - 1 ? 'rgba(242,242,242,0.6)' : '#f2f2f2' }}>{line}</p>
              </Reveal>
            ))}
          </div>
        </Screen>
        <Screen isMobile={isMobile}>
          <Reveal root={scrollRef}>
            <p style={{ fontSize: huge, fontWeight: 700, letterSpacing: '-0.05em', fontFamily: clash }}>Sound familiar?</p>
          </Reveal>
        </Screen>

        {/* PROBLEM */}
        <Screen isMobile={isMobile}>
          <div style={{ maxWidth: '1000px' }}>
            <Reveal root={scrollRef}>
              <h2 style={{ fontSize: big, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.05, fontFamily: clash, marginBottom: '16px' }}>
                Here's the truth — <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif", color: 'rgba(242,242,242,0.7)' }}>it's not you.</span>
              </h2>
            </Reveal>
            <Reveal root={scrollRef} delay={0.05}>
              <p style={{ fontSize: isMobile ? '16px' : '19px', color: 'rgba(242,242,242,0.65)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.6, maxWidth: '620px', margin: '0 auto 44px' }}>
                Motivation was never a plan. And willpower runs out — every single time. The real problem is everything underneath.
              </p>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
              {PROBLEMS.map(([t, d], i) => (
                <Reveal key={t} root={scrollRef} delay={i * 0.08}>
                  <div style={{ padding: '28px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)', height: '100%' }}>
                    <h3 style={{ fontSize: '19px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '10px' }}>{t}</h3>
                    <p style={{ fontSize: '14px', color: 'rgba(242,242,242,0.65)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Screen>

        {/* MEET FEELIVATE */}
        <Screen isMobile={isMobile}>
          <div style={{ maxWidth: '860px' }}>
            <Reveal root={scrollRef}>
              <p style={{ fontSize: isMobile ? '19px' : '25px', color: 'rgba(242,242,242,0.7)', fontFamily: satoshi, fontWeight: 500, marginBottom: '16px' }}>
                So what if something actually <span style={{ color: '#f2f2f2', fontWeight: 700 }}>held you to it?</span>
              </p>
            </Reveal>
            <Reveal root={scrollRef} delay={0.08}>
              <h2 style={{ fontSize: huge, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.95, fontFamily: clash, margin: '0 0 18px' }}>Meet Feelivate.</h2>
            </Reveal>
            <Reveal root={scrollRef} delay={0.14}>
              <p style={{ fontSize: isMobile ? '16px' : '19px', color: 'rgba(242,242,242,0.7)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.6, maxWidth: '520px', margin: '0 auto' }}>
                Your AI accountability mentor — it turns what you <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif" }}>want</span> into what you <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif" }}>do.</span>
              </p>
            </Reveal>
          </div>
        </Screen>

        {/* FEATURES — one per screen, alternating */}
        {FEATURES.map((f, i) => {
          const flip = i % 2 === 1;
          return (
            <Screen key={f.title} isMobile={isMobile}>
              <div style={{ maxWidth: '1040px', width: '100%', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '26px' : '56px', alignItems: 'center', textAlign: isMobile ? 'center' : 'left' }}>
                <motion.div
                  initial={{ opacity: 0, x: isMobile ? 0 : flip ? 50 : -50, y: isMobile ? 30 : 0 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: '-90px', root: scrollRef }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  style={{ order: isMobile ? 1 : flip ? 2 : 1 }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(242,242,242,0.45)', fontFamily: satoshi, letterSpacing: '0.08em' }}>{String(i + 1).padStart(2, '0')} / 06</span>
                  <h3 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.06, fontFamily: clash, margin: '14px 0 16px' }}>{f.title}</h3>
                  <p style={{ fontSize: isMobile ? '15px' : '18px', color: 'rgba(242,242,242,0.68)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500 }}>{f.body}</p>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: isMobile ? 0 : flip ? -50 : 50, y: isMobile ? 24 : 0 }}
                  whileInView={{ opacity: 1, x: 0, y: 0 }}
                  viewport={{ once: true, margin: '-90px', root: scrollRef }}
                  transition={{ duration: 0.8, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                  style={{ order: isMobile ? 2 : flip ? 1 : 2 }}
                >
                  <MediaSlot kind={f.kind} label={f.media} />
                </motion.div>
              </div>
            </Screen>
          );
        })}

        {/* HOW-TO */}
        <Screen isMobile={isMobile}>
          <div style={{ maxWidth: '940px' }}>
            <Reveal root={scrollRef}>
              <h2 style={{ fontSize: big, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.05, fontFamily: clash, marginBottom: '44px' }}>Getting the most from it is simple.</h2>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
              {STEPS.map(([t, d], i) => (
                <Reveal key={t} root={scrollRef} delay={i * 0.08}>
                  <div style={{ padding: '28px 22px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(8px)', height: '100%', textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(242,242,242,0.45)', fontFamily: satoshi, marginBottom: '12px' }}>{String(i + 1).padStart(2, '0')}</div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '10px' }}>{t}</h3>
                    <p style={{ fontSize: '14px', color: 'rgba(242,242,242,0.65)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Screen>

        {/* FINAL CTA */}
        <Screen isMobile={isMobile}>
          <div style={{ maxWidth: '840px' }}>
            <Reveal root={scrollRef}>
              <h2 style={{ fontSize: isMobile ? '42px' : '86px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.98, fontFamily: clash, marginBottom: '22px' }}>
                One year from now, you'll wish you started <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif" }}>today.</span>
              </h2>
            </Reveal>
            <Reveal root={scrollRef} delay={0.1}>
              <p style={{ fontSize: isMobile ? '17px' : '20px', color: 'rgba(242,242,242,0.7)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.6, marginBottom: '38px' }}>
                Your future self is watching. Don't disappoint them.
              </p>
            </Reveal>
            <Reveal root={scrollRef} delay={0.18}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: '#f2f2f2', color: '#111', padding: '18px 34px', borderRadius: '100px', fontSize: '15px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Start Free — Today <ArrowRight size={17} />
              </Link>
              <p style={{ marginTop: '18px', fontSize: '13px', color: 'rgba(242,242,242,0.5)', fontFamily: satoshi, fontWeight: 500 }}>Free for founding members · No credit card</p>
            </Reveal>
          </div>
        </Screen>
      </div>
    </div>
  );
}
