import PageShell from '../components/site/PageShell';
import { PageHero, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

const TOPICS = [
  { title: 'Goal Setting', desc: 'Frameworks that turn vague ambition into weekly action.' },
  { title: 'Habit Building', desc: 'How small, non-negotiable actions compound into identity.' },
  { title: 'Productivity', desc: 'Beating decision fatigue and doing the work that matters.' },
  { title: 'Mental Wellness', desc: 'Emotion-aware routines that keep you consistent.' },
  { title: 'Personal Growth', desc: 'Becoming the person you keep saying you want to be.' },
  { title: 'AI Productivity', desc: 'Using AI as a mentor, not just another tool.' },
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
      <PageHero kicker="Blog" title="Ideas for people who actually execute" subtitle="Practical writing on goal setting, habits, productivity, and personal growth. New articles are on the way." isMobile={isMobile} />

      <section style={{ padding: isMobile ? '40px 20px 80px' : '56px 48px 100px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '18px' }}>
            {TOPICS.map((t) => (
              <div key={t.title} style={{ padding: '26px 22px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-warm)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi }}>Coming soon</span>
                <h2 style={{ fontSize: '17px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', margin: '12px 0 8px' }}>{t.title}</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{t.desc}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '40px', fontSize: '14px', color: 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 500 }}>
            Want the first articles in your inbox? Subscribe in the footer below.
          </p>
        </div>
      </section>
    </PageShell>
  );
}
