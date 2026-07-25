import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWindowSize } from '../../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

const dim = 'rgba(246,246,246,0.6)';
const dimmer = 'rgba(246,246,246,0.4)';

function Col({ heading, links }: { heading: string; links: { label: string; to: string }[] }) {
  return (
    <div>
      <h4 style={{ fontSize: '11px', fontWeight: 700, color: dimmer, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px', fontFamily: satoshi }}>
        {heading}
      </h4>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          style={{ display: 'block', fontSize: '13px', color: dim, marginBottom: '10px', textDecoration: 'none', fontFamily: satoshi, fontWeight: 500, transition: 'color 150ms ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(246,246,246,0.9)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = dim)}
        >
          {l.label}
        </Link>
      ))}
    </div>
  );
}

export default function SiteFooter() {
  const { isMobile } = useWindowSize();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  return (
    <footer style={{ background: '#1e1e1e', padding: isMobile ? '40px 24px 28px' : '56px 48px 32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1.4fr 1fr 1fr 1fr 1.3fr', gap: '32px', maxWidth: '1200px', margin: '0 auto 40px' }}>
        {/* Brand */}
        <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <div style={{ width: '32px', height: '32px', background: '#f2f2f2', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src="/logo_2_backup.png" alt="Feelivate logo" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: 'rgba(246,246,246,0.9)', fontFamily: clash, letterSpacing: '-0.03em' }}>Feelivate</span>
          </div>
          <p style={{ fontSize: '13px', color: 'rgba(246,246,246,0.5)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500, marginBottom: '16px', maxWidth: '260px' }}>
            AI behavioral mentor. Hyper-specific weekly plans that build who you become.
          </p>
          <p style={{ fontSize: '11px', color: 'rgba(246,246,246,0.35)', fontFamily: satoshi, fontWeight: 500, letterSpacing: '0.05em' }}>
            By <span style={{ fontWeight: 700, color: 'rgba(246,246,246,0.6)', letterSpacing: '0.08em' }}>JUNE64</span>
          </p>
        </div>

        <Col heading="Product" links={[{ label: 'Features', to: '/features' }, { label: 'Pricing', to: '/pricing' }, { label: 'Get Started', to: '/login' }]} />
        <Col heading="Company" links={[{ label: 'About', to: '/about' }, { label: 'Blog', to: '/blog' }, { label: 'Contact', to: '/contact' }]} />
        <Col heading="Legal" links={[{ label: 'Privacy Policy', to: '/privacy' }, { label: 'Terms of Service', to: '/terms' }]} />

        {/* Contact + Newsletter */}
        <div style={{ gridColumn: isMobile ? '1 / -1' : 'auto' }}>
          <h4 style={{ fontSize: '11px', fontWeight: 700, color: dimmer, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px', fontFamily: satoshi }}>Contact</h4>
          <a href="mailto:info@june64.com" style={{ display: 'block', fontSize: '13px', color: dim, marginBottom: '10px', textDecoration: 'none', fontFamily: satoshi, fontWeight: 500 }}>info@june64.com</a>
          <p style={{ fontSize: '13px', color: dim, marginBottom: '10px', fontFamily: satoshi, fontWeight: 500 }}>@feelivate</p>
          <p style={{ fontSize: '13px', color: dim, marginBottom: '16px', fontFamily: satoshi, fontWeight: 500 }}>London, UK</p>

          {/* Newsletter */}
          {sent ? (
            <p style={{ fontSize: '12.5px', color: 'rgba(246,246,246,0.7)', fontFamily: satoshi, fontWeight: 500 }}>Thanks — you're on the list.</p>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (email.trim()) setSent(true); }}
              style={{ display: 'flex', gap: '8px', maxWidth: '260px' }}
            >
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email"
                style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '4px', padding: '9px 11px', color: '#f2f2f2', fontSize: '12.5px', fontFamily: satoshi, outline: 'none' }}
              />
              <button type="submit" style={{ background: '#f2f2f2', color: '#111', border: 'none', borderRadius: '4px', padding: '0 14px', fontSize: '12px', fontWeight: 700, fontFamily: satoshi, cursor: 'pointer' }}>
                Join
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', margin: '0 auto', flexWrap: 'wrap', gap: '8px' }}>
        <p style={{ fontSize: '12px', color: 'rgba(246,246,246,0.35)', fontFamily: satoshi, fontWeight: 500 }}>© 2026 Feelivate. All rights reserved.</p>
        <p style={{ fontSize: '12px', color: 'rgba(246,246,246,0.35)', fontFamily: satoshi, fontWeight: 500 }}>
          A product of <span style={{ fontWeight: 700, color: 'rgba(246,246,246,0.55)' }}>JUNE64</span>
        </p>
      </div>
    </footer>
  );
}
