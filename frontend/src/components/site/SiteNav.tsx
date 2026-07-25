import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import { useWindowSize } from '../../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

export const NAV_LINKS = [
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
];

export default function SiteNav() {
  const { isMobile } = useWindowSize();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const linkStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: satoshi,
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    textDecoration: 'none',
    transition: 'color 160ms ease',
  });

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 20px' : '0 48px',
        height: isMobile ? '60px' : '72px',
        background: 'color-mix(in srgb, var(--bg-primary) 82%, transparent)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Brand */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div
          style={{
            width: '30px', height: '30px', borderRadius: '7px',
            background: 'var(--card-bg)', border: '1px solid var(--border-medium)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
          }}
        >
          <img src="/logo_2_backup.png" alt="Feelivate logo" style={{ width: '20px', height: '20px', objectFit: 'contain', filter: 'var(--logo-filter)' }} />
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.03em', color: 'var(--text-primary)', fontFamily: clash }}>
          Feelivate
        </span>
      </Link>

      {/* Desktop links */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              style={linkStyle(pathname === l.to)}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = pathname === l.to ? 'var(--text-primary)' : 'var(--text-secondary)')}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}

      {/* Right actions */}
      {!isMobile ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <Link to="/login" style={linkStyle(false)}>Login</Link>
          <Link
            to="/login"
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              padding: '10px 18px', borderRadius: '4px',
              fontSize: '13.5px', fontWeight: 700, fontFamily: satoshi,
              letterSpacing: '0.02em', textTransform: 'uppercase', textDecoration: 'none',
              transition: 'opacity 160ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Get Started <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          style={{
            background: 'var(--glass-hover)', border: '1px solid var(--border-medium)',
            borderRadius: '6px', padding: '7px', color: 'var(--text-primary)',
            display: 'flex', cursor: 'pointer',
          }}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      )}

      {/* Mobile dropdown */}
      {isMobile && open && (
        <div
          style={{
            position: 'absolute', top: '60px', left: 0, right: 0,
            background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-medium)',
            padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '4px',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
              style={{ ...linkStyle(pathname === l.to), padding: '12px 0', fontSize: '15px' }}>
              {l.label}
            </Link>
          ))}
          <Link to="/login" onClick={() => setOpen(false)} style={{ ...linkStyle(false), padding: '12px 0', fontSize: '15px' }}>
            Login
          </Link>
          <Link
            to="/login" onClick={() => setOpen(false)}
            style={{
              marginTop: '10px', textAlign: 'center', textDecoration: 'none',
              background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
              padding: '14px', borderRadius: '4px', fontSize: '14px', fontWeight: 700,
              fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase',
            }}
          >
            Get Started
          </Link>
        </div>
      )}
    </nav>
  );
}
