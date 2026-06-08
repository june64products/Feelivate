/**
 * PillNav — Swiss-minimalist GSAP pill navigation.
 * Adapted from PillNav component. Zero Tailwind dependency —
 * uses only inline styles to match the Feelivate Swiss design system.
 *
 * Animation: A circle "rises" from the bottom of each pill on hover,
 * while the label slides up and a white duplicate slides in.
 */

import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Menu, X } from 'lucide-react';

export type PillNavItem = {
  label: string;
  href?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

export interface PillNavProps {
  items: PillNavItem[];
  activeLabel?: string;
  /** Dark pill container bg — default #111111 */
  baseColor?: string;
  /** Individual pill bg — default #f2f2f2 */
  pillColor?: string;
  /** Pill text color — default #111111 */
  pillTextColor?: string;
  /** Text color when hovered — default #f2f2f2 */
  hoveredTextColor?: string;
  /** GSAP ease — default power3.out */
  ease?: string;
  fontFamily?: string;
}

const PillNav: React.FC<PillNavProps> = ({
  items,
  activeLabel,
  baseColor = '#111111',
  pillColor = '#f2f2f2',
  pillTextColor = '#111111',
  hoveredTextColor = '#f2f2f2',
  ease = 'power3.out',
  fontFamily = "'Satoshi', 'Inter', system-ui, sans-serif",
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const circleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const tlRefs = useRef<Array<gsap.core.Timeline | null>>([]);
  const activeTweenRefs = useRef<Array<gsap.core.Tween | null>>([]);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Layout & animation setup ──────────────────────────────────────────────
  const entranceDoneRef = useRef(false);

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle?.parentElement) return;
        const pill = circle.parentElement as HTMLElement;
        const { width: w, height: h } = pill.getBoundingClientRect();
        if (w === 0 || h === 0) return;

        const R = ((w * w) / 4 + h * h) / (2 * h);
        const D = Math.ceil(2 * R) + 2;
        const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
        const originY = D - delta;

        circle.style.width = `${D}px`;
        circle.style.height = `${D}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`,
        });

        const label = pill.querySelector<HTMLElement>('.pn-label');
        const hover = pill.querySelector<HTMLElement>('.pn-label-hover');

        if (label) gsap.set(label, { y: 0 });
        if (hover) gsap.set(hover, { y: h + 12, opacity: 0 });

        tlRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });

        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 0.8, ease, overwrite: 'auto' }, 0);
        if (label) tl.to(label, { y: -(h + 8), duration: 0.6, ease, overwrite: 'auto' }, 0);
        if (hover) {
          gsap.set(hover, { y: Math.ceil(h + 20), opacity: 0 });
          tl.to(hover, { y: 0, opacity: 1, duration: 0.6, ease, overwrite: 'auto' }, 0);
        }
        tlRefs.current[index] = tl;
      });
    };

    layout();
    window.addEventListener('resize', layout);
    document.fonts?.ready.then(layout).catch(() => {});

    // Entrance animation — fire only once
    if (!entranceDoneRef.current) {
      entranceDoneRef.current = true;
      const pillEls = containerRef.current?.querySelectorAll<HTMLElement>('.pn-pill');
      if (pillEls) {
        gsap.fromTo(pillEls,
          { opacity: 0, y: -10 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out', delay: 0.1 }
        );
      }
    }

    return () => window.removeEventListener('resize', layout);
  }, [items.length, ease]);

  const handleEnter = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(tl.duration(), { duration: 0.4, ease, overwrite: 'auto' });
  };

  const handleLeave = (i: number) => {
    const tl = tlRefs.current[i];
    if (!tl) return;
    activeTweenRefs.current[i]?.kill();
    activeTweenRefs.current[i] = tl.tweenTo(0, { duration: 0.3, ease, overwrite: 'auto' });
  };

  const toggleMobile = () => {
    const next = !mobileOpen;
    setMobileOpen(next);
    const el = mobileMenuRef.current;
    if (!el) return;
    if (next) {
      gsap.set(el, { display: 'block', opacity: 0, y: -12 });
      gsap.to(el, { opacity: 1, y: 0, duration: 0.35, ease: 'power3.out' });
    } else {
      gsap.to(el, {
        opacity: 0, y: -12, duration: 0.25, ease: 'power3.in',
        onComplete: () => gsap.set(el, { display: 'none' }),
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Desktop pill strip ───────────────────────────────────────────── */}
      <div
        className="pn-desktop"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '44px',
          background: baseColor,
          borderRadius: '100px',
          padding: '4px 6px',
        }}
      >
        {items.map((item, i) => {
          const isActive = activeLabel === item.label;
          return (
            <button
              key={item.label}
              className="pn-pill"
              aria-label={item.ariaLabel || item.label}
              onClick={item.onClick}
              onMouseEnter={() => handleEnter(i)}
              onMouseLeave={() => handleLeave(i)}
              style={{
                position: 'relative',
                overflow: 'hidden',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '36px',
                padding: '0 18px',
                borderRadius: '100px',
                border: 'none',
                cursor: 'pointer',
                background: pillColor,
                color: pillTextColor,
                fontSize: '12px',
                fontWeight: 700,
                fontFamily,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                outline: isActive ? `2px solid ${baseColor}` : 'none',
                outlineOffset: '2px',
                zIndex: 0,
              }}
            >
              {/* Rising circle */}
              <span
                ref={el => { circleRefs.current[i] = el; }}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: 0,
                  borderRadius: '50%',
                  background: baseColor,
                  zIndex: 1,
                  pointerEvents: 'none',
                  willChange: 'transform',
                  display: 'block',
                }}
              />
              {/* Label stack */}
              <span style={{
                position: 'relative',
                display: 'inline-block',
                lineHeight: 1,
                zIndex: 2,
                overflow: 'hidden',
                padding: '4px 0',
              }}>
                <span
                  className="pn-label"
                  style={{ display: 'inline-block', willChange: 'transform' }}
                >
                  {item.label}
                </span>
                <span
                  className="pn-label-hover"
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 4,
                    width: '100%',
                    textAlign: 'center',
                    display: 'inline-block',
                    color: hoveredTextColor,
                    willChange: 'transform, opacity',
                    pointerEvents: 'none',
                    opacity: 0,
                    transform: 'translateY(100%)',
                  }}
                >
                  {item.label}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Mobile hamburger ─────────────────────────────────────────────── */}
      <button
        onClick={toggleMobile}
        className="pn-hamburger"
        aria-label="Toggle navigation menu"
        aria-expanded={mobileOpen}
        style={{
          display: 'none', // shown via CSS media query
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: 'none',
          background: baseColor,
          color: pillColor,
          cursor: 'pointer',
        }}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* ── Mobile dropdown ──────────────────────────────────────────────── */}
      <div
        ref={mobileMenuRef}
        style={{
          display: 'none',
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          background: baseColor,
          borderRadius: '12px',
          overflow: 'hidden',
          zIndex: 999,
          minWidth: '160px',
          boxShadow: '0 8px 32px rgba(17,17,17,0.18)',
        }}
      >
        {items.map(item => (
          <button
            key={item.label}
            onClick={() => { item.onClick?.(); toggleMobile(); }}
            style={{
              display: 'block',
              width: '100%',
              padding: '14px 24px',
              background: 'transparent',
              border: 'none',
              color: pillColor,
              fontSize: '13px',
              fontWeight: 700,
              fontFamily,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'background 150ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 860px) {
          .pn-desktop { display: none !important; }
          .pn-hamburger { display: flex !important; }
        }
      `}</style>
    </div>
  );
};

export default PillNav;
