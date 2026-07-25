import PageShell from '../components/site/PageShell';
import { PageHero, PrimaryCta, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

const PRINCIPLES = [
  { title: 'Execution over inspiration', desc: 'Motivation is a feeling. It fades by Wednesday. We optimize for the thing that actually changes lives: doing the work, today.' },
  { title: 'Systems over willpower', desc: "You don't rise to your goals — you fall to your systems. So we build the system, and take willpower out of the equation." },
  { title: 'Honesty over comfort', desc: 'A mentor that only makes you feel good is useless. Feelivate shows you the real gap between what you said and what you did.' },
  { title: 'Small over grand', desc: 'Grand plans collapse. Small, non-negotiable daily actions compound into a different person. We obsess over the next right step.' },
];

const STORY = [
  {
    label: 'What Feelivate is',
    body: [
      "Feelivate is an AI behavioral mentor. You tell it what you actually want to become — fitter, focused, out of a rut, finally shipping the thing — and it turns that fuzzy wish into a locked, hyper-specific 7-day plan.",
      "Then it does the hard part: it holds you to it. A personalized task lands in your inbox every morning. Streaks reward momentum. Voice check-ins let you be honest on the bad days. And every week, an unflinching report shows you exactly where you stand — before the next, slightly harder week begins.",
    ],
  },
  {
    label: 'Our mission',
    body: ['To turn ambition into daily execution — converting vague goals into concrete, non-negotiable weekly plans that people actually finish, not just start.'],
  },
  {
    label: 'Our vision',
    body: ['A world where progress is a system, not a burst of motivation. Where becoming the person you describe is a matter of showing up to a plan — one honest week at a time — instead of hoping this year is finally different.'],
  },
  {
    label: 'What makes us different',
    body: [
      "A to-do app stores your tasks. A habit tracker counts your checkmarks. A coach costs a fortune and isn't there at 7am. Feelivate does what none of them do: it builds the plan for you, locks it so you can't quietly make it easier, drives you through each day, and reflects the honest truth back every week.",
      'It is not a passive tool you have to remember to use. It is an active mentor that shows up whether you feel like it or not.',
    ],
  },
  {
    label: 'Product philosophy',
    body: [
      "We built Feelivate to be direct — warm, but unwilling to let you off the hook. It respects your time and your emotions, and it refuses to sell you the comfortable lie that you'll 'start Monday'.",
      "Every feature exists to close one gap: the distance between intention and action. If it doesn't help you execute, it doesn't ship.",
    ],
  },
];

export default function AboutPage() {
  const { isMobile } = useWindowSize();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'About Feelivate',
      url: SITE_URL + '/about',
      description: 'Feelivate is an AI behavioral mentor built by JUNE64 to turn goals into locked weekly action plans people actually finish.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'About', item: SITE_URL + '/about' },
      ],
    },
  ];

  const pad = isMobile ? '48px 20px' : '72px 48px';

  return (
    <PageShell
      seo={{
        title: 'About Feelivate — Built to Turn Goals Into Execution',
        description: "Feelivate is an AI behavioral mentor by JUNE64. We don't sell motivation — we build execution, turning your goals into locked 7-day action plans you actually finish.",
        path: '/about',
        jsonLd,
      }}
    >
      <PageHero
        kicker="About Feelivate"
        title={<>We don't sell motivation. <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif", fontWeight: 400, color: 'var(--text-secondary)' }}>We build</span> execution.</>}
        subtitle="Most people don't fail from a lack of goals. They fail at execution. Feelivate exists to close that gap — turning what you want to become into what you actually do, every single day."
        isMobile={isMobile}
      />

      {/* Why we started */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? '26px' : '34px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, fontFamily: clash, marginBottom: '20px' }}>
            Why we started
          </h2>
          <p style={{ fontSize: isMobile ? '15px' : '16.5px', color: 'var(--text-secondary)', lineHeight: 1.75, fontFamily: satoshi, fontWeight: 500, marginBottom: '16px' }}>
            Feelivate began with a frustration we couldn't shake: the gap between who people say they want to be and what they actually do on a Tuesday afternoon. We watched driven, capable people set the same goals every January — get fit, write the book, launch the thing — and quietly abandon them by February.
          </p>
          <p style={{ fontSize: isMobile ? '15px' : '16.5px', color: 'var(--text-secondary)', lineHeight: 1.75, fontFamily: satoshi, fontWeight: 500, marginBottom: '16px' }}>
            Not because they were lazy. Because they were running on willpower and good intentions, with no system underneath. And willpower is a terrible system — loud on Monday, gone by Wednesday.
          </p>
          <p style={{ fontSize: isMobile ? '15px' : '16.5px', color: 'var(--text-primary)', lineHeight: 1.75, fontFamily: satoshi, fontWeight: 600 }}>
            So we built the one thing that actually moves people: structure, relentless accountability, and an honest mirror — in a mentor that shows up whether you feel like it or not.
          </p>
        </div>
      </section>

      {/* Principles */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div style={{ marginBottom: '32px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>What we believe</span>
            <h2 style={{ fontSize: isMobile ? '26px' : '34px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, fontFamily: clash, marginTop: '12px' }}>
              Four principles behind everything
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1px', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', borderRadius: '2px', overflow: 'hidden' }}>
            {PRINCIPLES.map((p, i) => (
              <div key={p.title} style={{ padding: isMobile ? '24px 20px' : '30px 26px', background: 'var(--bg-primary)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: satoshi, letterSpacing: '0.08em', marginBottom: '12px' }}>{String(i + 1).padStart(2, '0')}</div>
                <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '10px' }}>{p.title}</h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story blocks */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {STORY.map((s, i) => (
            <div key={s.label} style={{ paddingTop: i === 0 ? 0 : '30px', paddingBottom: '30px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-warm)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '14px', fontFamily: satoshi }}>{s.label}</h2>
              {s.body.map((para, j) => (
                <p key={j} style={{ fontSize: isMobile ? '15px' : '16px', color: 'var(--text-secondary)', lineHeight: 1.75, fontFamily: satoshi, fontWeight: 500, marginBottom: j === s.body.length - 1 ? 0 : '14px' }}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Team */}
      <section style={{ padding: pad, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>The team</span>
          <h2 style={{ fontSize: isMobile ? '26px' : '34px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, fontFamily: clash, margin: '12px 0 16px' }}>
            Built by JUNE64
          </h2>
          <p style={{ fontSize: isMobile ? '15px' : '16.5px', color: 'var(--text-secondary)', lineHeight: 1.75, fontFamily: satoshi, fontWeight: 500 }}>
            Feelivate is built by JUNE64 — a small team obsessed with behavior change, thoughtful AI, and clean, honest product design. We're building the mentor we always wished we had: one that doesn't flatter you, doesn't forget about you, and doesn't let you quit on yourself.
          </p>
        </div>
      </section>

      {/* Quote + CTA */}
      <section style={{ padding: isMobile ? '56px 20px 72px' : '80px 48px 100px', textAlign: 'center' }}>
        <p style={{ fontSize: isMobile ? '22px' : '28px', color: 'var(--text-primary)', lineHeight: 1.45, fontStyle: 'italic', fontFamily: "'Georgia', serif", marginBottom: '12px', maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
          "Your future self is watching. Don't disappoint them."
        </p>
        <p style={{ fontSize: '10px', color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '0.15em', fontFamily: satoshi, textTransform: 'uppercase', marginBottom: '34px' }}>The Feelivate Philosophy</p>
        <PrimaryCta>Start Your First Week</PrimaryCta>
      </section>
    </PageShell>
  );
}
