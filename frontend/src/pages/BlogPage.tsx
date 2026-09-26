import { useEffect, useState } from 'react';
import { Target, Repeat, Zap, HeartPulse, TrendingUp, Sparkles } from 'lucide-react';
import PageShell from '../components/site/PageShell';
import { PageHero, PrimaryCta, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';
import { fetchPublishedPosts, type BlogCard } from '../components/blog/blogApi';

const TOPICS = [
  { icon: Target, title: 'Goal Setting', desc: 'Frameworks that turn vague ambition into a concrete weekly plan you can actually run.' },
  { icon: Repeat, title: 'Habit Building', desc: 'How small, non-negotiable daily actions compound into a completely different identity.' },
  { icon: Zap, title: 'Productivity', desc: 'Beating decision fatigue and spending your energy only on the work that moves the needle.' },
  { icon: HeartPulse, title: 'Mental Wellness', desc: 'Emotion-aware routines that keep you consistent on the days you least feel like it.' },
  { icon: TrendingUp, title: 'Personal Growth', desc: 'Practical ways to become the person you keep saying you want to be — on a schedule.' },
  { icon: Sparkles, title: 'AI Productivity', desc: 'Using AI as a real accountability mentor, not just another app you forget to open.' },
];

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function BlogPage() {
  const { isMobile } = useWindowSize();
  // null = still loading; [] = nothing published yet (the topic cards stay up).
  const [posts, setPosts] = useState<BlogCard[] | null>(null);
  const [category, setCategory] = useState<string>('All');

  useEffect(() => {
    let active = true;
    fetchPublishedPosts()
      .then((res) => { if (active) setPosts(res.posts); })
      .catch(() => { if (active) setPosts([]); });
    return () => { active = false; };
  }, []);

  const hasPosts = !!posts && posts.length > 0;
  const categories = hasPosts ? ['All', ...Array.from(new Set(posts.map((p) => p.category)))] : [];
  const visible = hasPosts ? posts.filter((p) => category === 'All' || p.category === category) : [];

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Feelivate Blog',
      url: SITE_URL + '/blog',
      description: 'Ideas on goal setting, habits, productivity, and personal growth from Feelivate.',
      ...(hasPosts
        ? {
            blogPost: posts.slice(0, 20).map((p) => ({
              '@type': 'BlogPosting',
              headline: p.title,
              url: p.url,
              datePublished: p.published_at,
              image: p.cover_image_url ?? undefined,
            })),
          }
        : {}),
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
      <PageHero
        kicker="Blog"
        title="Ideas for people who actually execute"
        subtitle={hasPosts
          ? 'Practical writing on goal setting, habits, productivity, and personal growth. No motivation posters — things you can run this week.'
          : "Practical writing on goal setting, habits, productivity, and personal growth. New articles are on the way — here's what we'll be digging into."}
        isMobile={isMobile}
      />

      <section style={{ padding: isMobile ? '44px 20px 40px' : '64px 48px 48px' }}>
        <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
          {hasPosts ? (
            <>
              {categories.length > 2 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '26px' }} role="group" aria-label="Filter by topic">
                  {categories.map((c) => {
                    const on = c === category;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setCategory(c)}
                        style={{
                          padding: '8px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em',
                          fontFamily: satoshi, cursor: 'pointer',
                          border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border-medium)'}`,
                          background: on ? 'var(--accent-primary)' : 'transparent',
                          color: on ? 'var(--btn-primary-text)' : 'var(--text-primary)',
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: '18px' }}>
                {visible.map((p) => (
                  // A plain link on purpose: the article is served as finished HTML
                  // (with all its SEO metadata) rather than rendered in the app.
                  <a
                    key={p.id}
                    href={`/blog/${p.slug}`}
                    className="svc-card"
                    style={{
                      display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit',
                      border: '1px solid var(--border-medium)', borderRadius: '2px', overflow: 'hidden',
                    }}
                  >
                    {p.cover_image_url ? (
                      <img
                        src={p.cover_image_url}
                        alt={p.cover_alt || p.title}
                        loading="lazy"
                        style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block', borderBottom: '1px solid var(--border-subtle)' }}
                      />
                    ) : (
                      <div style={{ height: '6px', background: 'var(--accent-warm)' }} />
                    )}
                    <div style={{ padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-warm)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi }}>{p.category}</span>
                      <h2 style={{ fontSize: '19px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', margin: '10px 0 8px', lineHeight: 1.2 }}>{p.title}</h2>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500, margin: '0 0 16px', flex: 1 }}>{p.excerpt}</p>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500 }}>
                        {formatDate(p.published_at)} · {p.reading_minutes} min read
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : (
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
          )}
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
