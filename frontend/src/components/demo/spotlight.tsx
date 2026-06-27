/**
 * Shared spotlight engine for the guided demo.
 *
 * The targeting math (findVisible / resolvePlacement / cardPosition) and the
 * dim + ring + card chrome are adapted from the original OnboardingTour so the
 * demo looks identical, but this version is fully self-contained inside the
 * `demo/` folder and adds a full-screen click-blocker (the demo drives the UI
 * itself, so the real elements underneath must not be clickable).
 */
import type React from 'react';
import { createPortal } from 'react-dom';

export type Placement = 'auto' | 'top' | 'bottom' | 'left' | 'right' | 'center';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";
export const ACCENT = 'var(--accent-warm, #d97757)';

export const RING_PAD = 6;
export const CARD_W = 320;
export const Z = 99999;

/** First visible element matching `[data-tour="key"]` (skips hidden/off-screen). */
export function findVisible(key: string): HTMLElement | null {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const els = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`);
    for (const el of els) {
        const r = el.getBoundingClientRect();
        const onScreen =
            r.width > 0 && r.height > 0 &&
            r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
        if (onScreen) return el;
    }
    return null;
}

/** Pick the side of the target with the most room for the card. */
export function resolvePlacement(rect: DOMRect, preferred: Placement, cardH: number): Placement {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const room = {
        bottom: vh - rect.bottom,
        top: rect.top,
        right: vw - rect.right,
        left: rect.left,
    };
    const fits = (p: Placement) =>
        (p === 'bottom' && room.bottom >= cardH + 24) ||
        (p === 'top' && room.top >= cardH + 24) ||
        (p === 'right' && room.right >= CARD_W + 24) ||
        (p === 'left' && room.left >= CARD_W + 24);

    if (preferred !== 'auto' && preferred !== 'center' && fits(preferred)) return preferred;
    for (const p of ['bottom', 'top', 'right', 'left'] as Placement[]) {
        if (fits(p)) return p;
    }
    return 'bottom';
}

export function cardPosition(rect: DOMRect, placement: Placement, cardH: number) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampX = (x: number) => Math.max(16, Math.min(x, vw - CARD_W - 16));
    const clampY = (y: number) => Math.max(16, Math.min(y, vh - cardH - 16));
    const cx = rect.left + rect.width / 2 - CARD_W / 2;
    switch (placement) {
        case 'top':
            return { left: clampX(cx), top: clampY(rect.top - RING_PAD - 12 - cardH) };
        case 'right':
            return { left: clampX(rect.right + RING_PAD + 12), top: clampY(rect.top) };
        case 'left':
            return { left: clampX(rect.left - RING_PAD - 12 - CARD_W), top: clampY(rect.top) };
        case 'bottom':
        default:
            return { left: clampX(cx), top: clampY(rect.bottom + RING_PAD + 12) };
    }
}

interface SpotlightOverlayProps {
    /** Target rect to spotlight; null → centered card with a full dim. */
    rect: DOMRect | null;
    preferredPlacement?: Placement;
    cardRef: React.RefObject<HTMLDivElement | null>;
    cardH: number;
    children: React.ReactNode;
}

/** Renders the dim overlay, the pulsing ring, a click-blocker, and the card. */
export function SpotlightOverlay({ rect, preferredPlacement = 'auto', cardRef, cardH, children }: SpotlightOverlayProps) {
    const dim = 'rgba(15,15,18,0.55)';

    let cardStyle: React.CSSProperties;
    let hole: React.ReactNode = null;
    let ring: React.ReactNode = null;

    if (rect) {
        const placement = resolvePlacement(rect, preferredPlacement, cardH);
        const pos = cardPosition(rect, placement, cardH);
        const holeTop = rect.top - RING_PAD;
        const holeLeft = rect.left - RING_PAD;
        const holeW = rect.width + RING_PAD * 2;
        const holeH = rect.height + RING_PAD * 2;

        hole = (
            <>
                <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: Math.max(0, holeTop), background: dim, pointerEvents: 'none' }} />
                <div style={{ position: 'fixed', left: 0, top: holeTop + holeH, width: '100%', height: '100vh', background: dim, pointerEvents: 'none' }} />
                <div style={{ position: 'fixed', left: 0, top: holeTop, width: Math.max(0, holeLeft), height: holeH, background: dim, pointerEvents: 'none' }} />
                <div style={{ position: 'fixed', left: holeLeft + holeW, top: holeTop, width: '100vw', height: holeH, background: dim, pointerEvents: 'none' }} />
            </>
        );
        ring = (
            <div style={{
                position: 'fixed', left: holeLeft, top: holeTop, width: holeW, height: holeH,
                border: `2px solid ${ACCENT}`, borderRadius: '12px',
                boxShadow: '0 0 0 4px rgba(217,119,87,0.25)', pointerEvents: 'none',
                animation: 'demo-pulse 1.6s ease-in-out infinite',
                transition: 'left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease',
            }} />
        );
        cardStyle = { ...cardBase(), left: pos.left, top: pos.top };
    } else {
        hole = <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />;
        cardStyle = { ...cardBase(), left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }

    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: Z, fontFamily: satoshi }}>
            {/* Click-blocker — the demo drives the UI, so block stray clicks on the real app. */}
            <div style={{ position: 'fixed', inset: 0, background: 'transparent', pointerEvents: 'auto' }} />
            {hole}
            {ring}
            <div ref={cardRef} style={cardStyle}>{children}</div>
            <style>{`@keyframes demo-pulse {
                0%, 100% { box-shadow: 0 0 0 4px rgba(217,119,87,0.25); }
                50% { box-shadow: 0 0 0 8px rgba(217,119,87,0.12); }
            }`}</style>
        </div>,
        document.body,
    );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
export function cardBase(): React.CSSProperties {
    return {
        position: 'fixed',
        width: CARD_W,
        maxWidth: 'calc(100vw - 32px)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow-lg)',
        padding: '18px',
        pointerEvents: 'auto',
        zIndex: Z + 1,
    };
}

export const cardTitle: React.CSSProperties = {
    fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
    fontFamily: clashDisplay, letterSpacing: '-0.01em', marginBottom: '6px',
};

export const cardBody: React.CSSProperties = {
    fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)',
};

export const primaryBtn: React.CSSProperties = {
    padding: '9px 18px', borderRadius: '100px', border: 'none',
    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
};

export const skipBtn: React.CSSProperties = {
    border: 'none', background: 'transparent', color: 'var(--text-muted)',
    fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: satoshi,
    padding: '2px 4px',
};

export const enterHint: React.CSSProperties = {
    marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic',
};
