import { Target, Repeat, Zap, HeartPulse, TrendingUp, Sparkles } from 'lucide-react';
import PageShell from '../components/site/PageShell';
import { PageHero, PrimaryCta, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

const TOPICS = [
  { icon: Target, title: 'Goal Setting', desc: 'Frameworks that turn vague ambition into a concrete weekly plan you can actually run.' },
  { icon: Repeat, title: 'Habit Building', desc: 'How small, non-negotiable daily actions compound into a completely different identity.' },
  { icon: Zap, title: 'Productivity', desc: 'Beating decision fatigue and spending your energy only on the work that moves the needle.' },
  { icon: HeartPulse, title: 'Mental Wellness', desc: 'Emotion-aware routines that keep you consistent on the days you least feel like it.' },
  { icon: TrendingUp, title: 'Personal Growth', desc: 'Practical ways to become the person you keep saying you want to be — on a schedule.' },
  { icon: Sparkles, title: 'AI Productivity', desc: 'Using AI as a real accountability mentor, not just another app you forget to open.' },
];

export default function BlogPage() {
  const { isMobile } = useWindowSize();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Feelivate Blog',
      url: SITE_URL + '/blog',
      description: 'Ideas on goal setting, habits, productivity, and personal growth from Feelivate.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE_URL + '/blog' },
      ],
    },
  ];

  return (
    <PageShell
      seo={{
        title: 'Blog — Goal Setting, Habits & Growth | Feelivate',
        description: 'Practical ideas on goal setting, habit building, productivity, mental wellness, and personal growth from the Feelivate team.',
        path: '/blog',
        jsonLd,
      }}
    >
      <PageHero kicker="Blog" title="Ideas for people who actually execute" subtitle="Practical writing on goal setting, habits, productivity, and personal growth. New articles are on the way — here's what we'll be digging into." isMobile={isMobile} />

      <section style={{ padding: isMobile ? '44px 20px 40px' : '64px 48px 48px' }}>
        <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '18px' }}>
            {TOPICS.map((t) => (
              <div key={t.title} className="svc-card" style={{ padding: '28px 24px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                <div className="svc-icon" style={{ width: '44px', height: '44px', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                  <t.icon size={18} />
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-warm)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi }}>Coming soon</span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', margin: '12px 0 8px' }}>{t.title}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section style={{ padding: isMobile ? '24px 20px 72px' : '32px 48px 100px', textAlign: 'center', borderTop: '1px solid var(--border-subtle)' }}>
        <h2 style={{ fontSize: isMobile ? '26px' : '38px', fontWeight: 700, letterSpacing: '-0.04em', fontFamily: clash, margin: '48px 0 12px', lineHeight: 1.05 }}>
          Don't just read about it. <span style={{ fontStyle: 'italic', fontFamily: "'Georgia', serif", fontWeight: 400, color: 'var(--text-secondary)' }}>Do</span> it.
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 500, marginBottom: '26px' }}>Turn the ideas into a plan this week. Free for founding members.</p>
        <PrimaryCta>Start Free</PrimaryCta>
      </section>
    </PageShell>
  );
}
