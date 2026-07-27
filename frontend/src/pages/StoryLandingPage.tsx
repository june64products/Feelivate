import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll } from 'framer-motion';
import { ArrowRight, Play, ImageIcon } from 'lucide-react';
import Scene3D from '../components/three/Scene3D';
import Seo from '../components/site/Seo';
import BrandNav from '../components/site/BrandNav';
import { useWindowSize } from '../hooks/useWindowSize';
import { useTheme } from '../hooks/useTheme';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// Theme-aware translucent text/border built on --text-primary, so every shade
// flips correctly between light and dark mode.
const tp = (pct: number) => `color-mix(in srgb, var(--text-primary) ${pct}%, transparent)`;
const surface = 'var(--glass-surface)';
const surfaceHi = 'var(--glass-hover)';
const cardBorder = 'var(--border-medium)';

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
        border: `1px dashed ${tp(18)}`, background: surface,
        backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px', textAlign: 'center', padding: '20px',
      }}
    >
      <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: surfaceHi, border: `1px solid ${tp(15)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {kind === 'video' ? <Play size={20} style={{ color: 'var(--text-primary)' }} /> : <ImageIcon size={20} style={{ color: 'var(--text-primary)' }} />}
      </div>
      <span style={{ fontSize: '13px', fontWeight: 700, color: tp(80), fontFamily: satoshi }}>{label}</span>
      <span style={{ fontSize: '11px', color: tp(40), fontFamily: satoshi, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
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
  const { isDark } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ container: scrollRef });

  const big = isMobile ? '30px' : '58px';
  const huge = isMobile ? '42px' : '84px';

  return (
    <div
      ref={scrollRef}
      style={{ height: '100svh', overflowY: 'auto', overflowX: 'hidden', position: 'relative', background: 'var(--bg-primary)', color: 'var(--text-primary)', scrollSnapType: 'y mandatory' }}
    >
      <Seo
        title="Feelivate — AI Accountability Mentor for Your Goals & Habits"
        description="Feelivate is an AI accountability mentor that turns your goals into a locked weekly plan — daily tasks, streaks, and honest weekly reports so you actually follow through."
        path="/story"
        noindex
      />

      <Scene3D progress={scrollYProgress} isMobile={isMobile} isDark={isDark} />

      {/* Scroll progress bar */}
      <motion.div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '2px', background: 'var(--text-primary)', transformOrigin: '0%', scaleX: scrollYProgress, zIndex: 50, opacity: 0.7 }} />

      {/* Shared navbar — same as every other page, floating over the hero */}
      <BrandNav variant="floating" />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* HERO */}
        <Screen isMobile={isMobile}>
          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} style={{ maxWidth: '900px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: tp(50), fontFamily: satoshi }}>AI Accountability Mentor</span>
            <h1 style={{ fontSize: isMobile ? '40px' : '76px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.0, margin: '22px 0 18px', fontFamily: clash }}>
              You already know who<br />you want to become.
            </h1>
            <p style={{ fontSize: isMobile ? '17px' : '22px', color: tp(70), fontFamily: satoshi, fontWeight: 500, lineHeight: 1.5, maxWidth: '600px', margin: '0 auto' }}>
              The plan was never the problem. <span style={{ color: 'var(--text-primary)', fontStyle: 'italic', fontFamily: "'Georgia', serif" }}>Sticking to it</span> is.
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.55 }} transition={{ delay: 1.2, duration: 1 }} style={{ position: 'absolute', bottom: '30px', fontSize: '12px', letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: satoshi, color: tp(60) }}>Scroll ↓</motion.div>
        </Screen>

        {/* RELATE — one message per screen */}
        {RELATE.map((line, i) => (
          <Screen key={i} isMobile={isMobile}>
            <Reveal root={scrollRef}>
              <p style={{ fontSize: big, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.12, fontFamily: clash, maxWidth: '820px', color: 'var(--text-primary)' }}>{line}</p>
            </Reveal>
          </Screen>
        ))}

        {/* THE WEEK'S ARC — Monday / Wednesday / weekend together on ONE screen */}
        <Screen isMobile={isMobile}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '30px', maxWidth: '900px' }}>
            {RELATE_WEEK.map((line, i) => (
              <Reveal key={line} root={scrollRef} delay={i * 0.14}>
                <p style={{ fontSize: big, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.12, fontFamily: clash, color: i === RELATE_WEEK.length - 1 ? tp(60) : 'var(--text-primary)' }}>{line}</p>
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
                Here's the truth — <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif", color: tp(70) }}>it's not you.</span>
              </h2>
            </Reveal>
            <Reveal root={scrollRef} delay={0.05}>
              <p style={{ fontSize: isMobile ? '16px' : '19px', color: tp(65), fontFamily: satoshi, fontWeight: 500, lineHeight: 1.6, maxWidth: '620px', margin: '0 auto 44px' }}>
                Motivation was never a plan. And willpower runs out — every single time. The real problem is everything underneath.
              </p>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px' }}>
              {PROBLEMS.map(([t, d], i) => (
                <Reveal key={t} root={scrollRef} delay={i * 0.08}>
                  <div style={{ padding: '28px 22px', borderRadius: '14px', border: `1px solid ${cardBorder}`, background: surface, backdropFilter: 'blur(8px)', height: '100%' }}>
                    <h3 style={{ fontSize: '19px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '10px' }}>{t}</h3>
                    <p style={{ fontSize: '14px', color: tp(65), lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{d}</p>
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
              <p style={{ fontSize: isMobile ? '19px' : '25px', color: tp(70), fontFamily: satoshi, fontWeight: 500, marginBottom: '16px' }}>
                So what if something actually <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>held you to it?</span>
              </p>
            </Reveal>
            <Reveal root={scrollRef} delay={0.08}>
              <h2 style={{ fontSize: huge, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 0.95, fontFamily: clash, margin: '0 0 18px' }}>Meet Feelivate.</h2>
            </Reveal>
            <Reveal root={scrollRef} delay={0.14}>
              <p style={{ fontSize: isMobile ? '16px' : '19px', color: tp(70), fontFamily: satoshi, fontWeight: 500, lineHeight: 1.6, maxWidth: '520px', margin: '0 auto' }}>
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
                  <span style={{ fontSize: '13px', fontWeight: 700, color: tp(45), fontFamily: satoshi, letterSpacing: '0.08em' }}>{String(i + 1).padStart(2, '0')} / 06</span>
                  <h3 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.06, fontFamily: clash, margin: '14px 0 16px' }}>{f.title}</h3>
                  <p style={{ fontSize: isMobile ? '15px' : '18px', color: tp(68), lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500 }}>{f.body}</p>
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
                  <div style={{ padding: '28px 22px', borderRadius: '14px', border: `1px solid ${cardBorder}`, background: surface, backdropFilter: 'blur(8px)', height: '100%', textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: tp(45), fontFamily: satoshi, marginBottom: '12px' }}>{String(i + 1).padStart(2, '0')}</div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '10px' }}>{t}</h3>
                    <p style={{ fontSize: '14px', color: tp(65), lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{d}</p>
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
              <p style={{ fontSize: isMobile ? '17px' : '20px', color: tp(70), fontFamily: satoshi, fontWeight: 500, lineHeight: 1.6, marginBottom: '38px' }}>
                Your future self is watching. Don't disappoint them.
              </p>
            </Reveal>
            <Reveal root={scrollRef} delay={0.18}>
              <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '18px 34px', borderRadius: '100px', fontSize: '15px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
                Start Free — Today <ArrowRight size={17} />
              </Link>
              <p style={{ marginTop: '18px', fontSize: '13px', color: tp(50), fontFamily: satoshi, fontWeight: 500 }}>Free for founding members · No credit card</p>
            </Reveal>
          </div>
        </Screen>
      </div>
    </div>
  );
}
