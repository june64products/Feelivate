import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
export const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

export function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>
      {children}
    </span>
  );
}

export function PrimaryCta({ children = 'Start Free', to = '/login' }: { children?: React.ReactNode; to?: string }) {
  return (
    <Link to={to} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', padding: '15px 26px', borderRadius: '4px', fontSize: '14px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none' }}>
      {children} <ArrowRight size={15} />
    </Link>
  );
}

/** Shared page-title block used at the top of subpages. */
export function PageHero({ kicker, title, subtitle, isMobile }: { kicker: string; title: React.ReactNode; subtitle?: string; isMobile?: boolean }) {
  return (
    <header style={{ padding: isMobile ? '48px 20px 40px' : '80px 48px 56px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <Kicker>{kicker}</Kicker>
        <h1 style={{ fontSize: isMobile ? '34px' : '54px', fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1.04, margin: '16px 0 16px', fontFamily: clash, maxWidth: '760px' }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: isMobile ? '15px' : '17px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500, maxWidth: '620px' }}>
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
