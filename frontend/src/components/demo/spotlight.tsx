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

/**
 * True when `el` is actually the thing the user sees at its centre — not sat
 * under another layer (the mentor drawer over the mission surface, a modal…).
 * The tour's own overlay is hidden for the hit-test; no paint happens in
 * between, so nothing flickers.
 */
function isUncovered(el: HTMLElement, r: DOMRect): boolean {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2));
    const overlay = document.querySelector<HTMLElement>('[data-demo-overlay]');
    const prev = overlay?.style.visibility;
    if (overlay) overlay.style.visibility = 'hidden';
    let hit: Element | null = null;
    try { hit = document.elementFromPoint(cx, cy); }
    finally { if (overlay) overlay.style.visibility = prev ?? ''; }
    return !!hit && (hit === el || el.contains(hit));
}

/**
 * The element to spotlight for `[data-tour="key"]`: the first on-screen match
 * that isn't covered by another layer. The plan card, for instance, exists
 * both on the mission surface and inside the mentor drawer that sits over it —
 * only the drawer's copy is what the user is looking at.
 */
export function findVisible(key: string): HTMLElement | null {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const els = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`);
    let fallback: HTMLElement | null = null;
    for (const el of els) {
        const r = el.getBoundingClientRect();
        const onScreen =
            r.width > 0 && r.height > 0 &&
            r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
        if (!onScreen) continue;
        if (isUncovered(el, r)) return el;
        fallback ??= el; // every match is covered → keep the old behaviour
    }
    return fallback;
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
    // Nothing fits cleanly (short laptop viewports, tall targets): take the
    // vertical side with the most room so the card overlaps the target least.
    return room.top > room.bottom ? 'top' : 'bottom';
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
    /** On phones the card becomes a full-width sheet pinned away from the target. */
    isMobile?: boolean;
    /** Force the mobile sheet to a specific edge (overrides the auto away-from-target). */
    forcePin?: 'top' | 'bottom';
    children: React.ReactNode;
}

/** Renders the dim overlay, the pulsing ring, a click-blocker, and the card. */
export function SpotlightOverlay({ rect, preferredPlacement = 'auto', cardRef, cardH, isMobile = false, forcePin, children }: SpotlightOverlayProps) {
    const dim = 'rgba(15,15,18,0.55)';

    let hole: React.ReactNode;
    let ring: React.ReactNode = null;

    if (rect) {
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
                // No position transition: the rect is tracked per-frame (rAF), so a
                // CSS ease only adds trailing latency behind the moving element.
            }} />
        );
    } else {
        hole = <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', pointerEvents: 'none' }} />;
    }

    // Card placement.
    let cardStyle: React.CSSProperties;
    if (isMobile) {
        // Full-width sheet pinned to the screen edge AWAY from the target, so it
        // never covers the highlighted element. No keyboard/Enter needed on phones.
        const pinTop = forcePin
            ? forcePin === 'top'
            : (rect ? (rect.top + rect.height / 2) > window.innerHeight * 0.5 : false);
        cardStyle = {
            ...cardBase(),
            width: 'auto', maxWidth: 'none', left: 16, right: 16, padding: '20px',
            ...(pinTop
                ? { top: 'calc(env(safe-area-inset-top, 0px) + 14px)', bottom: 'auto' }
                : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', top: 'auto' }),
        };
    } else if (rect) {
        const placement = resolvePlacement(rect, preferredPlacement, cardH);
        const pos = cardPosition(rect, placement, cardH);
        cardStyle = { ...cardBase(), left: pos.left, top: pos.top };
    } else {
        cardStyle = { ...cardBase(), left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }

    return createPortal(
        <div data-demo-overlay="" style={{ position: 'fixed', inset: 0, zIndex: Z, fontFamily: satoshi }}>
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
