import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MessageSquare, Lock, Mail, LineChart, Mic, Calendar, ChevronDown } from 'lucide-react';
import Seo, { SITE_URL } from '../components/site/Seo';
import BrandNav from '../components/site/BrandNav';
import SiteFooter from '../components/site/SiteFooter';
import Testimonials from '../components/site/Testimonials';
import AppWalkthrough from '../components/site/AppWalkthrough';
import { AmbientGlow, HeroPreviewCard, LiveKicker, MediaReveal, Pressable, Rise, TiltCard, Words } from '../components/site/HeroMotion';

// Hero choreography, seconds from mount. The card's own timing lives in HeroMotion.
const HERO_T = { kicker: 0.05, headline: 0.15, body: 0.62, ctas: 0.74, note: 0.86 };
import { ChatFrame, EmailFrame, ReportFrame } from '../components/site/ProductFrames';
import { useWindowSize } from '../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// ─── Hero media ───────────────────────────────────────────────────────────────
// The product shows itself. Each panel is the app's own markup, so it is sharp
// at any density, follows the visitor's theme, and can never drift into
// advertising an interface that isn't there.
const HERO_PANELS = [
  { Frame: ChatFrame, caption: 'Tell it the goal. It asks what it needs, then builds the week — and says why.' },
  { Frame: EmailFrame, caption: "Today's exact task lands at your hour, in your timezone." },
  { Frame: ReportFrame, caption: 'At week end: what you did versus what you said. Next week answers it.' },
];

// Copy below follows the SEO content brief (Home page doc) verbatim.
const STEPS = [
  { icon: MessageSquare, title: 'Say the goal, plainly', desc: "Type or talk it through like you would with a real coach. Feelivate turns that loose, everyday language into one specific action you can commit to today, not another mission statement sitting in a notes app." },
  { icon: Lock, title: 'Lock in the 7-day plan', desc: "Once you approve it, the week is set: exact daily actions, sequenced and timed, with nothing left to decide each morning. This is where Feelivate stops acting like a basic accountability tracker and starts working as an automated accountability mentor that's already planned three steps ahead." },
  { icon: Mail, title: 'Execute, one task at a time', desc: "A single task email lands at the time you picked. Open it, do the thing, and the streak takes care of itself. It's using AI for routine tracking in its simplest form: no dashboard to check, nothing to remember to log." },
  { icon: LineChart, title: 'Review honestly, then level up', desc: "At the end of the week, you get a clear report on what you actually did versus what you planned, no spin. Feelivate uses that gap the way an AI powered coach would: to adjust next week's plan, not just repeat the same list." },
];

const HIGHLIGHTS = [
  { icon: MessageSquare, title: 'AI Accountability Mentor', desc: 'The core of Feelivate: a mentor that learns how you actually behave week to week and calls it out when the same excuse starts repeating itself.' },
  { icon: Lock, title: 'The Lock-In Protocol', desc: "Once your week is approved, it's locked. You commit to the action, not the mood you're in that morning, and skipping breaks the streak instead of quietly resetting it." },
  { icon: Mail, title: 'Daily Task Emails', desc: "Today's exact task lands in your inbox at the time you set, in your own timezone, with a short note on how to actually get it done." },
  { icon: LineChart, title: 'Streaks & Weekly Reports', desc: 'Your streak reflects real momentum, not just logged checkmarks, and every week closes with an honest report on what actually got done versus what was planned.' },
  { icon: Mic, title: 'Voice Journal & Emotions', desc: "Talk or type through how the week actually felt, and Feelivate factors that in. It's the part that makes this feel closer to an AI life coach adjusting to your reality than a task manager running the same script." },
  { icon: Calendar, title: 'Calendar Sync', desc: "Each day's task drops straight into your calendar with a reminder attached, so the plan lives where you already look, not buried in a separate accountability app you forget to open." },
];

const USE_CASES = [
  { title: 'Get fit & consistent', desc: 'Turn "I want to get in shape" into a locked weekly training + nutrition rhythm.' },
  { title: 'Ship deep work', desc: 'Break a big project into daily focused blocks you actually complete.' },
  { title: 'Build a business', desc: 'Convert a vague ambition into concrete weekly launch actions.' },
  { title: 'Fix your habits', desc: 'Replace willpower with a system that nudges you every single day.' },
];

const FAQS = [
  // ── SEO brief FAQs (PAA-targeted) — order and wording from the Home page doc ──
  { q: 'What does an AI accountability mentor do differently than a regular habit tracker?', a: 'A habit tracker logs what you did after the fact. An AI accountability mentor builds the plan first, tells you the exact next action, and follows up if you skip it, so the accountability happens before the miss becomes a pattern, not after.' },
  { q: "Is an accountability app actually worth it if other habit apps haven't worked for me before?", a: "Most habit apps fail for the same reason: they track behavior without ever pushing you toward the next step. Feelivate works less like a passive tracker and more like an accountability coach online, one locked task at a time with a real follow-up, which is usually the missing piece for people who've dropped off other apps before." },
  { q: 'Can AI actually work as a personal coach, or is it just automated reminders?', a: "AI can't replace human judgment entirely, but it's well suited to the mechanical parts of coaching: building a plan, holding a fixed schedule, and reporting back honestly without excuses. Feelivate handles the structure and follow-through a personal development coach provides, minus the calendar of paid sessions." },
  { q: 'Can I use AI as a personal trainer for fitness goals specifically?', a: 'Feelivate isn\'t a certified trainer and won\'t design injury-specific programming, but it will turn "get in shape" into a locked weekly training and nutrition rhythm and hold you to it daily, covering the accountability half most fitness plans are missing.' },
  { q: "What's the easiest way to actually stick to a weekly routine instead of falling off after a few days?", a: 'Remove the decision-making. Most routines collapse because you have to decide what to do and when, every single day. Feelivate locks the whole week in advance and emails one task at a time, so sticking to it just means opening an email and doing the thing in front of you.' },
  { q: 'Is there a single best app to track personal goals?', a: 'It depends on why past goal tracking failed. If the problem was forgetting to log things, a tracker helps. If the problem was never really knowing what to do each day, an AI goal tracking app that builds the plan for you, like Feelivate, solves a different and usually bigger problem.' },
  { q: 'Does Feelivate turn my goal into something like a SMART plan automatically?', a: 'Yes, functionally. When you state a goal in plain language, Feelivate breaks it into specific, time-bound daily actions instead of leaving it as a broad intention, the same discipline behind SMART goal frameworks, just handled automatically.' },
  { q: 'What are practical ways to avoid goal drifting once the initial motivation fades?', a: 'The biggest driver of goal drifting isn\'t lack of willpower, it\'s lack of a fixed next step. Locking the week in advance, tracking the honest gap between plan and execution, and getting a factual weekly report instead of vague encouragement are what keep a goal from quietly dissolving into "I\'ll restart Monday."' },
  { q: 'Is there a free action plan template I can try before committing to anything?', a: "Feelivate's free tier works as a live version of that: describe one goal, and it generates a locked 7-day action plan at no cost, so you can see the actual output before deciding whether to continue." },
  { q: 'Are the weekly reports actually honest, or do they just show streaks and badges?', a: 'The weekly report is built around honest weekly progress reports rather than gamified streaks: it shows exactly what got completed against what was planned, without softening a bad week into a badge or a congratulatory push notification.' },
  // ── Original product FAQs, kept below the brief's set ──
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
        title="AI Accountability Mentor For Goals That Actually Stick"
        description="Feelivate is your AI accountability mentor: turn goals into a locked 7-day action plan with daily tasks, streak tracking, and honest weekly progress reports."
        path="/"
        jsonLd={jsonLd}
      />
      <BrandNav />

      {/* Hero — clear product explanation + live preview.
          Choreography (see HeroMotion.tsx): kicker → headline words → body → CTAs,
          while the card lands on the right and checks off today's task. The
          walkthrough and frames below reveal on scroll. Everything is transform/
          opacity only and honours prefers-reduced-motion. */}
      <header style={{ position: 'relative', padding: isMobile ? '40px 20px 52px' : '68px 48px 84px', borderBottom: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
        <AmbientGlow />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1140px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 0.95fr', gap: isMobile ? '38px' : '56px', alignItems: 'center' }}>
          {/* Left — what it is */}
          <div>
            <Rise delay={HERO_T.kicker} y={10}>
              <LiveKicker>Feelivate</LiveKicker>
            </Rise>
            <Words
              text="AI Accountability Mentor"
              accent="Accountability"
              delay={HERO_T.headline}
              style={{ fontSize: isMobile ? '37px' : '58px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.0, margin: '16px 0 18px', fontFamily: clash }}
            />
            <Rise delay={HERO_T.body}>
              <p style={{ fontSize: isMobile ? '14px' : '15.5px', color: 'var(--text-secondary)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500, marginBottom: '18px', maxWidth: '540px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>How does an AI accountability mentor work?</strong>{' '}
                An AI accountability mentor like Feelivate turns a single stated goal into a structured 7-day plan, then delivers one task at a time so you're never guessing what to do next. Feelivate tracks completion automatically and closes the week with a report that reflects what you actually did, not just what you checked off.
              </p>
              <div style={{ marginBottom: '26px', maxWidth: '540px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi, margin: '0 0 8px' }}>
                  Setup, in three steps
                </p>
                <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    'Tell Feelivate your goal, in plain language, no forms or templates',
                    'Feelivate builds a locked 7-day action plan and emails you the first task',
                    "You complete each day's task, Feelivate tracks the streak, and sends a full progress report at the end of the week",
                  ].map((s) => (
                    <li key={s} style={{ fontSize: isMobile ? '13px' : '13.5px', color: 'var(--text-secondary)', lineHeight: 1.55, fontFamily: satoshi, fontWeight: 500 }}>{s}</li>
                  ))}
                </ol>
              </div>
            </Rise>
            <Rise delay={HERO_T.ctas}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <Pressable><PrimaryCta>Start Free</PrimaryCta></Pressable>
                <Pressable>
                  <Link to="/features" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', padding: '15px 26px', borderRadius: '4px', fontSize: '14px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
                    See How It Works
                  </Link>
                </Pressable>
              </div>
            </Rise>
            <Rise delay={HERO_T.note} y={8}>
              <p style={{ marginTop: '16px', fontSize: '12.5px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500 }}>
                Free for founding members · No credit card
              </p>
            </Rise>
          </div>

          {/* Right — product preview, alive: lands, then checks off today's task.
              Tilts a few degrees toward the mouse on desktop; never on touch. */}
          <TiltCard>
            <HeroPreviewCard isMobile={isMobile} />
          </TiltCard>
        </div>

        {/* Hero media — the product in use, then three still frames of what it hands you.
            The walkthrough is capped at 800px so it reads as a window into the app,
            not a wall: at full row width it was taller than a laptop viewport. */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1140px', margin: isMobile ? '38px auto 0' : '56px auto 0' }}>
          <MediaReveal style={{ maxWidth: '800px', margin: '0 auto' }}>
            <AppWalkthrough />
          </MediaReveal>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '14px', marginTop: isMobile ? '18px' : '28px' }}>
            {HERO_PANELS.map(({ Frame, caption }, n) => (
              <Rise key={caption} inView delay={isMobile ? 0 : n * 0.12} y={28} amount={0.2}>
                <Frame />
                <p style={{
                  fontSize: '12.5px', color: 'var(--text-muted)', fontFamily: satoshi,
                  fontWeight: 500, lineHeight: 1.5, margin: '10px 2px 0',
                }}>
                  {caption}
                </p>
              </Rise>
            ))}
          </div>
        </div>
      </header>

      {/* Problem */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: maxW, margin: '0 auto' }}>
          <Kicker>The problem</Kicker>
          <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, margin: '14px 0 14px', fontFamily: clash, maxWidth: '620px' }}>
            Goals were never your problem. Follow-through was.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500, maxWidth: '620px', marginBottom: '36px' }}>
            Most goal-setting breaks the same way: a vague to-do list, decision fatigue by Tuesday, nobody checking in, and no honest read on what actually got done. Motivation shows up strong on Monday and quietly disappears by Wednesday. Relying on willpower alone was never a real system for building habits, it's just a hope with no backup plan.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '20px' }}>
            {[
              ['Vague plans', '"Get in shape" or "be more productive" aren\'t plans, they\'re wishes. Without one specific action for today, there\'s nothing to actually open your calendar and do.'],
              ['No one checking in', "When missing a day goes unnoticed, skipping gets easy, and one skipped day quietly turns into a pattern nobody catches until it's a habit of its own."],
              ['No honest feedback', "Without a clear record of what you committed to versus what you actually did, there's no honest way to see where the plan is actually breaking down."],
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
            <h2 style={{ fontSize: isMobile ? '28px' : '38px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.12, margin: '14px 0', fontFamily: clash, maxWidth: '760px', marginLeft: 'auto', marginRight: 'auto' }}>
              Here's exactly how an AI accountability mentor turns one goal into a finished week.
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
                One system, everything execution actually requires.
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
            "The version of you a week from now is built entirely by what you do today."
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
