import { Link } from 'react-router-dom';
import PageShell from '../components/site/PageShell';
import { PrimaryCta, clash, satoshi } from '../components/site/ui';
import { useWindowSize } from '../hooks/useWindowSize';

export default function NotFoundPage() {
  const { isMobile } = useWindowSize();
  return (
    <PageShell
      seo={{
        title: 'Page not found — Feelivate',
        description: "The page you're looking for doesn't exist.",
        path: '/404',
        noindex: true,
      }}
    >
      <section style={{ padding: isMobile ? '80px 20px' : '140px 48px', textAlign: 'center' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h1 style={{ fontSize: isMobile ? '96px' : '160px', fontWeight: 700, letterSpacing: '-0.06em', lineHeight: 0.9, fontFamily: clash, color: 'var(--text-primary)', marginBottom: '8px' }}>
            404
          </h1>
          <h2 style={{ fontSize: isMobile ? '22px' : '30px', fontWeight: 700, letterSpacing: '-0.03em', fontFamily: clash, marginBottom: '14px' }}>
            This page took a day off.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500, marginBottom: '30px' }}>
            The page you're looking for doesn't exist or has moved. Let's get you back on plan.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <PrimaryCta to="/">Back to Home</PrimaryCta>
            <Link to="/features" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', padding: '15px 26px', borderRadius: '4px', fontSize: '14px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
              See Features
            </Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
