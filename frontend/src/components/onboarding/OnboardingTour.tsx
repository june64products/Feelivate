import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    completeOnboarding,
    getOnboardingState,
    setOnboardingStep,
    startOnboarding,
} from '../../lib/onboarding';
import { TOUR_STEPS, type TourPlacement, type TourStep } from './tourSteps';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";
const ACCENT = 'var(--accent-warm, #d97757)'; // matches the top-right profile avatar

const RING_PAD = 6;      // breathing room around the highlighted element
const CARD_W = 320;
const Z = 99999;

interface OnboardingTourProps {
    userId: string | null;
    /** True when the workspace is on the empty "new chat" screen. */
    isEmptyState: boolean;
    /** Expand the sidebar (needed for the streak / journey steps). */
    onOpenSidebar: () => void;
    /** Start a fresh chat (used by the "Replay" → open new chat flow). */
    onNewChat: () => void;
}

/** First visible element matching `[data-tour="key"]` (skips hidden/off-screen ones). */
function findVisible(key: string): HTMLElement | null {
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
function resolvePlacement(rect: DOMRect, preferred: TourPlacement, cardH: number): TourPlacement {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const room = {
        bottom: vh - rect.bottom,
        top: rect.top,
        right: vw - rect.right,
        left: rect.left,
    };
    const fits = (p: TourPlacement) =>
        (p === 'bottom' && room.bottom >= cardH + 24) ||
        (p === 'top' && room.top >= cardH + 24) ||
        (p === 'right' && room.right >= CARD_W + 24) ||
        (p === 'left' && room.left >= CARD_W + 24);

    if (preferred !== 'auto' && fits(preferred)) return preferred;
    for (const p of ['bottom', 'top', 'right', 'left'] as TourPlacement[]) {
        if (fits(p)) return p;
    }
    return 'bottom'; // last resort — will be clamped on screen
}

function cardPosition(rect: DOMRect, placement: TourPlacement, cardH: number) {
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

export default function OnboardingTour({ userId, isEmptyState, onOpenSidebar, onNewChat }: OnboardingTourProps) {
    // Resume an in-progress walkthrough straight from localStorage (no mount effect).
    const [active, setActive] = useState(() => getOnboardingState(userId)?.status === 'active');
    const [stepIndex, setStepIndex] = useState(() => {
        const st = getOnboardingState(userId);
        return st?.status === 'active' ? Math.max(0, Math.min(st.step, TOUR_STEPS.length - 1)) : 0;
    });
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [cardH, setCardH] = useState(170);
    const [awaitingNewChat, setAwaitingNewChat] = useState(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const cardHRef = useRef(170);
    const stepIndexRef = useRef(0);
    const userIdRef = useRef(userId);
    const onOpenSidebarRef = useRef(onOpenSidebar);
    const onNewChatRef = useRef(onNewChat);

    useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);
    useEffect(() => { userIdRef.current = userId; }, [userId]);
    useEffect(() => { onOpenSidebarRef.current = onOpenSidebar; }, [onOpenSidebar]);
    useEffect(() => { onNewChatRef.current = onNewChat; }, [onNewChat]);

    const step: TourStep | undefined = active ? TOUR_STEPS[stepIndex] : undefined;

    const advance = useCallback(() => {
        const next = stepIndexRef.current + 1;
        if (next >= TOUR_STEPS.length) {
            completeOnboarding(userIdRef.current);
            setActive(false);
        } else {
            setOnboardingStep(userIdRef.current, next);
            setStepIndex(next);
            setRect(null); // recompute for the new target
        }
    }, []);

    const skip = useCallback(() => {
        completeOnboarding(userIdRef.current);
        setActive(false);
    }, []);

    // (Re)start the walkthrough from step 0. Wrapped in a callback so the effects
    // below trigger it indirectly rather than calling setState in their bodies.
    const startTour = useCallback(() => {
        startOnboarding(userIdRef.current);
        setStepIndex(0);
        setRect(null);
        setActive(true);
        setAwaitingNewChat(false);
    }, []);

    // ── "Replay tutorial" from the profile menu ─────────────────────────────
    useEffect(() => {
        const onReplay = () => {
            // The tour needs the empty "new chat" screen to start. If a chat is
            // open, ask the user to open a new chat first.
            if (isEmptyState) startTour();
            else setAwaitingNewChat(true);
        };
        window.addEventListener('feelivate-replay-tour', onReplay);
        return () => window.removeEventListener('feelivate-replay-tour', onReplay);
    }, [isEmptyState, startTour]);

    // Once the user opens a new chat (empty state), kick the replayed tour off.
    // This intentionally reacts to the parent's `isEmptyState` prop flipping true
    // after the user clicks "Open new chat" — a valid external-sync effect.
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (awaitingNewChat && isEmptyState) startTour();
    }, [awaitingNewChat, isEmptyState, startTour]);

    // ── Track the target element + auto-advance 'await' steps ───────────────
    useEffect(() => {
        if (!active || !step) return;
        if (step.requireSidebarOpen) onOpenSidebarRef.current?.();

        const tick = () => {
            const el = findVisible(step.target);
            setRect(el ? el.getBoundingClientRect() : null);
            // Measure the card so placement math knows its real height.
            const card = cardRef.current;
            if (card) {
                const h = card.offsetHeight;
                if (h && Math.abs(h - cardHRef.current) > 2) {
                    cardHRef.current = h;
                    setCardH(h);
                }
            }
            if (step.mode === 'await' && step.until && findVisible(step.until)) {
                advance();
            }
        };
        tick();
        const id = window.setInterval(tick, 120);
        window.addEventListener('resize', tick);
        window.addEventListener('scroll', tick, true);
        return () => {
            window.clearInterval(id);
            window.removeEventListener('resize', tick);
            window.removeEventListener('scroll', tick, true);
        };
    }, [active, step, advance]);

    // ── Enter advances 'read' steps (but not while typing in a field) ───────
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            const t = e.target as HTMLElement | null;
            const tag = (t?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
            if (TOUR_STEPS[stepIndexRef.current]?.mode === 'read') {
                e.preventDefault();
                advance();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, advance]);

    // ── Replay → "open a new chat first" prompt ─────────────────────────────
    if (awaitingNewChat) {
        return createPortal(
            <div style={overlayBase('auto')}>
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
                <div ref={cardRef} style={{ ...cardBase(), left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                    <div style={cardTitle}>Replay the walkthrough</div>
                    <div style={cardBody}>To replay the walkthrough, please open a new chat first. Your current chat stays saved in your history.</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                        <button style={primaryBtn} onClick={() => onNewChatRef.current?.()}>Open new chat</button>
                        <button style={ghostBtn} onClick={() => setAwaitingNewChat(false)}>Cancel</button>
                    </div>
                </div>
            </div>,
            document.body,
        );
    }

    if (!active || !step || !rect) return null;

    const isRead = step.mode === 'read';
    const placement = resolvePlacement(rect, step.placement ?? 'auto', cardH);
    const pos = cardPosition(rect, placement, cardH);

    const holeTop = rect.top - RING_PAD;
    const holeLeft = rect.left - RING_PAD;
    const holeW = rect.width + RING_PAD * 2;
    const holeH = rect.height + RING_PAD * 2;
    const dim = 'rgba(15,15,18,0.55)';

    return createPortal(
        <div style={overlayBase('none')}>
            {/* Dim — only for 'read' steps; 'await' steps stay interactive. The four
                panels leave a clickable "hole" over the highlighted element. */}
            {isRead && (
                <>
                    <div style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: Math.max(0, holeTop), background: dim, pointerEvents: 'auto' }} />
                    <div style={{ position: 'fixed', left: 0, top: holeTop + holeH, width: '100%', height: '100vh', background: dim, pointerEvents: 'auto' }} />
                    <div style={{ position: 'fixed', left: 0, top: holeTop, width: Math.max(0, holeLeft), height: holeH, background: dim, pointerEvents: 'auto' }} />
                    <div style={{ position: 'fixed', left: holeLeft + holeW, top: holeTop, width: '100vw', height: holeH, background: dim, pointerEvents: 'auto' }} />
                </>
            )}

            {/* Highlight ring */}
            <div
                style={{
                    position: 'fixed',
                    left: holeLeft,
                    top: holeTop,
                    width: holeW,
                    height: holeH,
                    border: `2px solid ${ACCENT}`,
                    borderRadius: '12px',
                    boxShadow: `0 0 0 4px rgba(217,119,87,0.25)`,
                    pointerEvents: 'none',
                    animation: isRead ? undefined : 'onboard-pulse 1.6s ease-in-out infinite',
                    transition: 'left 0.18s ease, top 0.18s ease, width 0.18s ease, height 0.18s ease',
                }}
            />

            {/* Tooltip card */}
            <div ref={cardRef} style={{ ...cardBase(), left: pos.left, top: pos.top }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, letterSpacing: '0.08em' }}>
                        {stepIndex + 1} / {TOUR_STEPS.length}
                    </span>
                    <button style={skipBtn} onClick={skip}>Skip</button>
                </div>
                <div style={cardTitle}>{step.title}</div>
                <div style={cardBody}>{step.body}</div>
                {isRead ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                        <button style={primaryBtn} onClick={advance}>
                            {stepIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                ) : (
                    <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Go ahead — the tour continues automatically.
                    </div>
                )}
            </div>

            <style>{`@keyframes onboard-pulse {
                0%, 100% { box-shadow: 0 0 0 4px rgba(217,119,87,0.25); }
                50% { box-shadow: 0 0 0 8px rgba(217,119,87,0.12); }
            }`}</style>
        </div>,
        document.body,
    );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
function overlayBase(pointer: 'auto' | 'none'): React.CSSProperties {
    return { position: 'fixed', inset: 0, zIndex: Z, pointerEvents: pointer, fontFamily: satoshi };
}

function cardBase(): React.CSSProperties {
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

const cardTitle: React.CSSProperties = {
    fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
    fontFamily: clashDisplay, letterSpacing: '-0.01em', marginBottom: '6px',
};

const cardBody: React.CSSProperties = {
    fontSize: '13px', lineHeight: 1.55, color: 'var(--text-secondary)',
};

const primaryBtn: React.CSSProperties = {
    padding: '9px 18px', borderRadius: '100px', border: 'none',
    background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
    fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const ghostBtn: React.CSSProperties = {
    padding: '9px 18px', borderRadius: '100px',
    border: '1px solid var(--border-medium)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
    cursor: 'pointer', fontFamily: satoshi, letterSpacing: '0.04em', textTransform: 'uppercase',
};

const skipBtn: React.CSSProperties = {
    border: 'none', background: 'transparent', color: 'var(--text-muted)',
    fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: satoshi,
    padding: '2px 4px',
};
