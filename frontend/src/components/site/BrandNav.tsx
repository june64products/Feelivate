import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import PillNav from '../PillNav';
import { useWindowSize } from '../../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

// Single source of truth for the site's primary navigation links.
export const NAV_LINKS = [
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Blog', to: '/blog' },
  { label: 'Contact', to: '/contact' },
];

type Props = {
  /**
   * 'sticky'   — solid translucent bar, in normal flow (marketing pages)
   * 'floating' — fixed + transparent, sits over a full-bleed hero (story/landing)
   * 'fixed'    — fixed + solid, edge-to-edge (login) so its margins match the
   *              floating hero nav instead of being inset by the scrollbar
   */
  variant?: 'sticky' | 'floating' | 'fixed';
};

/**
 * The one navbar used across every page: theme-aware logo + animated PillNav
 * + Start Free CTA. Colours are driven entirely by CSS variables so it adapts
 * to the device's light/dark mode via the `data-theme` attribute.
 */
export default function BrandNav({ variant = 'sticky' }: Props) {
  const { isMobile } = useWindowSize();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  const floating = variant === 'floating';
  const isFixed = variant === 'floating' || variant === 'fixed';
  const activeLabel = NAV_LINKS.find((l) => l.to === pathname)?.label;

  const ctaStyle: React.CSSProperties = {
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    padding: '9px 18px',
    borderRadius: '100px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: satoshi,
    textDecoration: 'none',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    transition: 'opacity 160ms ease',
    pointerEvents: 'auto',
  };

  return (
    <nav
      style={{
        position: isFixed ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 20px' : '0 40px',
        height: isMobile ? '60px' : '76px',
        background: floating ? 'transparent' : 'color-mix(in srgb, var(--bg-primary) 82%, transparent)',
        backdropFilter: floating ? 'none' : 'blur(12px)',
        WebkitBackdropFilter: floating ? 'none' : 'blur(12px)',
        borderBottom: floating ? 'none' : '1px solid var(--border-subtle)',
        pointerEvents: floating ? 'none' : 'auto',
      }}
    >
      {/* Brand — logo in a rounded square: black chip on light theme, white on
          dark theme (--accent-primary), with the mark recoloured via --logo-filter. */}
      <Link
        to="/"
        style={{ display: 'flex', alignItems: 'center', gap: '11px', textDecoration: 'none', pointerEvents: 'auto' }}
      >
        <div
          style={{
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'var(--accent-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          <img
            src="/logo_2_backup.png"
            alt="Feelivate"
            style={{ width: '26px', height: '26px', objectFit: 'contain', filter: 'var(--logo-filter)' }}
          />
        </div>
        <span style={{ fontWeight: 700, fontSize: '18px', letterSpacing: '-0.03em', color: 'var(--text-primary)', fontFamily: clash }}>
          Feelivate
        </span>
      </Link>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '18px', pointerEvents: 'auto' }}>
        {!isMobile && (
          <PillNav
            items={NAV_LINKS.map((l) => ({ label: l.label, onClick: () => navigate(l.to) }))}
            activeLabel={activeLabel}
            baseColor="var(--text-primary)"
            pillColor="var(--bg-primary)"
            pillTextColor="var(--text-primary)"
            hoveredTextColor="var(--bg-primary)"
            fontFamily={satoshi}
            ease="power3.out"
          />
        )}

        {!isMobile ? (
          <Link
            to="/login"
            style={ctaStyle}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Start Free
          </Link>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            style={{
              background: 'var(--glass-hover)',
              border: '1px solid var(--border-medium)',
              borderRadius: '8px',
              padding: '7px',
              color: 'var(--text-primary)',
              display: 'flex',
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        )}
      </div>

      {/* Mobile dropdown */}
      {isMobile && open && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: 0,
            right: 0,
            background: 'var(--bg-primary)',
            borderBottom: '1px solid var(--border-medium)',
            padding: '12px 20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            boxShadow: 'var(--shadow-xl)',
            pointerEvents: 'auto',
          }}
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              style={{
                padding: '12px 0',
                fontSize: '15px',
                fontWeight: 600,
                fontFamily: satoshi,
                textDecoration: 'none',
                color: pathname === l.to ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {l.label}
            </Link>
          ))}
          <Link to="/login" onClick={() => setOpen(false)} style={{ ...ctaStyle, marginTop: '10px', textAlign: 'center' }}>
            Start Free
          </Link>
        </div>
      )}
    </nav>
  );
}
