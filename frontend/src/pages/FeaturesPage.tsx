import { Check } from 'lucide-react';
import PageShell from '../components/site/PageShell';
import { PageHero, PrimaryCta, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

type Feature = { title: string; desc: string; benefits: string[] };
type Group = { act: string; title: string; blurb: string; features: Feature[] };

const GROUPS: Group[] = [
  {
    act: 'Step 01',
    title: 'Plan it',
    blurb: 'Turn a fuzzy ambition into a concrete, non-negotiable week.',
    features: [
      {
        title: 'Goal-based plan generation',
        desc: 'Tell your mentor what you want in plain words. Feelivate interviews you like a sharp friend, strips away the noise, and generates a hyper-specific 7-day plan — exact daily actions, sequenced, timed, and scaled to where you actually are today.',
        benefits: ['No vague resolutions — a concrete daily what, when, and how', 'Plans tailored to your goal, schedule, and starting point', 'Built in a real conversation, not a blank template'],
      },
      {
        title: 'Plan customization',
        desc: "Nothing is locked until you say so. Shape the intensity, the days, and the focus in a natural back-and-forth until the week fits your real life — not an idealized version of it.",
        benefits: ['Refine through chat, not rigid forms', 'Set the difficulty to your reality', 'Own the plan before you commit to it'],
      },
      {
        title: 'The Lock-In Protocol',
        desc: "The moment you approve a week, it locks. You can't quietly water it down on Thursday when it gets hard. You do the work, or the streak breaks — the way real commitment actually works.",
        benefits: ['Removes the escape hatch that kills most goals', 'Turns intention into a promise you keep', "Protects future-you from present-you's excuses"],
      },
    ],
  },
  {
    act: 'Step 02',
    title: 'Execute daily',
    blurb: 'Show up every day without relying on motivation.',
    features: [
      {
        title: 'Daily task emails',
        desc: "Every morning a personalized email lands with today's exact task and how-to tips — sent at the time you choose, in your timezone. No opening an app, no deciding what's next. Just do the one thing in front of you.",
        benefits: ['Wake up knowing exactly what to do', 'Delivered at your time, in your timezone', 'Actionable tips, not just a reminder'],
      },
      {
        title: 'Daily micro-actions',
        desc: "Big goals are broken into the smallest actions that still move the needle — the kind you can't talk yourself out of. Momentum comes from finishing, not from planning.",
        benefits: ['Small enough to actually start', 'Sequenced so each day builds on the last', 'Finishing daily builds unstoppable momentum'],
      },
      {
        title: 'Streaks & daily check-ins',
        desc: 'Mark the day done in seconds. Streaks turn consistency into something you can see and protect — and quietly make skipping feel expensive.',
        benefits: ["Visible momentum you don't want to break", 'Frictionless, few-second check-ins', 'Consistency becomes its own reward'],
      },
      {
        title: 'Google Calendar sync',
        desc: 'Connect Google Calendar and your plan drops straight in with reminders. The work becomes a scheduled appointment with yourself — not a vague someday.',
        benefits: ['Plans live where your day already lives', 'Reminders so nothing slips', 'Scheduled, not left to willpower'],
      },
    ],
  },
  {
    act: 'Step 03',
    title: 'Reflect & adapt',
    blurb: 'An honest feedback loop that makes every week smarter.',
    features: [
      {
        title: 'Voice journaling',
        desc: 'Had a rough day? Talk instead of type. Send a voice memo and Feelivate transcribes it, reads between the lines, and understands the real reason behind a slip.',
        benefits: ['Faster and more honest than typing', "Captures the 'why', not just the 'what'", 'Turns a bad day into useful signal'],
      },
      {
        title: 'Emotion tracking',
        desc: "Log how you feel each day. Feelivate factors your emotional state into the next plan — easing off when you're depleted, pushing when you're ready.",
        benefits: ['Plans that respond to your real state', 'Spot the patterns behind wins and slips', 'A sustainable pace, not a blind grind'],
      },
      {
        title: 'Weekly reports',
        desc: 'At the end of each week, an honest report card: what you actually did versus what you committed to. No sugar-coating — just the truth, and the next, slightly harder week.',
        benefits: ['The honest feedback loop most tools skip', 'See real progress over time', 'Difficulty ramps as you grow'],
      },
      {
        title: 'Multi-week memory',
        desc: 'Feelivate remembers your history — your wins, your patterns, and your excuses. The longer you stay, the sharper and more personal the guidance becomes.',
        benefits: ['Context compounds week over week', 'Guidance gets more personal over time', 'No repeating yourself every session'],
      },
    ],
  },
];

export default function FeaturesPage() {
  const { isMobile } = useWindowSize();
  let n = 0;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Features', item: SITE_URL + '/features' },
      ],
    },
  ];

  return (
    <PageShell
      seo={{
        title: 'Features — Feelivate AI Behavioral Mentor',
        description: 'Explore every Feelivate feature across plan, execute, and reflect: goal-based weekly plans, the Lock-In Protocol, daily task emails, voice journaling, emotion tracking, streaks, calendar sync, and weekly reports.',
        path: '/features',
        jsonLd,
      }}
    >
      <PageHero
        kicker="Features"
        title="Everything Feelivate does"
        subtitle="A complete accountability system in three acts — plan the week, execute every day, then reflect and adapt. Here's exactly how each piece drives you from a fuzzy goal to real, compounding progress."
        isMobile={isMobile}
      />

      {GROUPS.map((group) => (
        <section key={group.title} style={{ padding: isMobile ? '44px 20px' : '64px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: '920px', margin: '0 auto' }}>
            {/* Group header */}
            <div style={{ marginBottom: '28px', maxWidth: '620px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-warm)', fontFamily: satoshi }}>{group.act}</span>
              <h2 style={{ fontSize: isMobile ? '28px' : '38px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, fontFamily: clash, margin: '12px 0 10px' }}>{group.title}</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{group.blurb}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {group.features.map((f) => {
                n += 1;
                return (
                  <div key={f.title} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '64px 1fr', gap: isMobile ? '8px' : '20px', padding: isMobile ? '24px' : '28px 30px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: satoshi, letterSpacing: '0.06em' }}>{String(n).padStart(2, '0')}</div>
                    <div>
                      <h3 style={{ fontSize: isMobile ? '19px' : '22px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.03em', marginBottom: '10px' }}>{f.title}</h3>
                      <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500, marginBottom: '18px' }}>{f.desc}</p>
                      <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                        {f.benefits.map((b) => (
                          <li key={b} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-primary)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.5 }}>
                            <Check size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-warm)' }} /> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* CTA */}
      <section style={{ padding: isMobile ? '56px 20px 72px' : '80px 48px 100px', textAlign: 'center' }}>
        <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', fontFamily: clash, marginBottom: '12px', lineHeight: 1.06 }}>See it work on your goal</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 500, marginBottom: '28px' }}>Free for founding members. Your first plan is one conversation away.</p>
        <PrimaryCta>Start Free</PrimaryCta>
      </section>
    </PageShell>
  );
}
