/**
 * GuidedDemo — the self-playing scripted walkthrough controller.
 *
 * Each step is a SCENE (full state snapshot). Navigating — forward or backward —
 * just applies that step's scene through the `handles` object into WorkspacePage's
 * demo-mirror state. Forward entry into a "type a message" step animates the
 * typewriter; back/jump applies instantly. It never calls the backend.
 */
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DEMO_STEPS, DEMO_PLAN } from './demoScript';
import { useWindowSize } from '../../hooks/useWindowSize';
import {
    SpotlightOverlay, findVisible,
    cardTitle, cardBody, primaryBtn, skipBtn, enterHint, ACCENT,
} from './spotlight';

export interface DemoHandles {
    setMessages: (m: any[]) => void;
    setLastContent: (content: string) => void;
    setLoading: (v: boolean) => void;
    setPlanApproved: (v: boolean) => void;
    setView: (v: 'chat' | 'journey') => void;
    setEmotion: (v: boolean) => void;
    setSidebar: (open: boolean) => void;
    setSelectedWeek: (w: number | null) => void;
    setJourneyTab: (t: 'overview' | 'archive') => void;
    setBetweenWeeks: (v: boolean) => void;
}

interface GuidedDemoProps {
    active: boolean;
    handles: DemoHandles;
    onExit: () => void;
}

/** On phones the week pills live inside a bottom-sheet, but the mission top bar
 *  now carries a labeled "Weeks" tile with data-tour="week-pill" — so the same
 *  target resolves to a visible, uncovered element on both desktop and mobile.
 *  No remap needed. */
function effectiveTarget(target: string, _isMobile: boolean): string {
    return target;
}

export default function GuidedDemo({ active, handles, onExit }: GuidedDemoProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    // Target missing for a while → show a centered card instead of nothing, so
    // Next / Skip stay reachable (a touch user has no Enter key to escape).
    const [fallback, setFallback] = useState(false);
    const [cardH, setCardH] = useState(180);
    const { isMobile } = useWindowSize();

    const cardRef = useRef<HTMLDivElement>(null);
    const cardHRef = useRef(180);
    const handlesRef = useRef(handles);
    const stepIndexRef = useRef(0);
    const cancelledRef = useRef(false);
    const fastForwardRef = useRef(false);
    const animatingRef = useRef(false);
    const startedRef = useRef(false);
    const navTokenRef = useRef(0);
    const onExitRef = useRef(onExit);

    useEffect(() => { handlesRef.current = handles; }, [handles]);
    useEffect(() => { onExitRef.current = onExit; }, [onExit]);
    useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

    // A cancellable / fast-forwardable / navigation-aware wait.
    const wait = (ms: number, token: number) => new Promise<void>(resolve => {
        const start = performance.now();
        const tick = () => {
            if (cancelledRef.current || navTokenRef.current !== token || fastForwardRef.current) return resolve();
            if (performance.now() - start >= ms) return resolve();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

    const typeOut = async (full: string, token: number) => {
        let i = 0;
        while (i < full.length) {
            if (cancelledRef.current || navTokenRef.current !== token) return;
            if (fastForwardRef.current) { handlesRef.current.setLastContent(full); return; }
            i = Math.min(full.length, i + 2);
            handlesRef.current.setLastContent(full.slice(0, i));
            await wait(18, token);
        }
    };

    // Gentle, eased scroll of the chat to its top or bottom — so the right content
    // is visible for each step (the conversation, or the plan + its buttons) instead
    // of the view snapping around.
    const gentleScroll = (to: 'top' | 'bottom', token: number, duration: number) => {
        const el = document.querySelector('.chat-messages-area') as HTMLElement | null;
        if (!el) return;
        const start = el.scrollTop;
        const target = to === 'top' ? 0 : Math.max(0, el.scrollHeight - el.clientHeight);
        if (Math.abs(target - start) < 8) return;
        const t0 = performance.now();
        const stepFn = () => {
            if (cancelledRef.current || navTokenRef.current !== token || fastForwardRef.current) {
                el.scrollTop = target; // interrupted / fast-forwarded → jump to the end
                return;
            }
            const p = Math.min(1, (performance.now() - t0) / duration);
            const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
            el.scrollTop = start + (target - start) * ease;
            if (p < 1) requestAnimationFrame(stepFn);
        };
        requestAnimationFrame(stepFn);
    };

    const goToStep = useCallback(async (idx: number, animate: boolean) => {
        const token = ++navTokenRef.current;
        const step = DEMO_STEPS[idx];
        if (!step) return;
        stepIndexRef.current = idx;
        setStepIndex(idx);
        setRect(null);
        setFallback(false);
        // The demo owns the keyboard: drop focus from any text field (the empty
        // state and the mentor drawer autofocus their input) so a blinking caret
        // isn't left inside a field the click-blocker already covers.
        const ae = document.activeElement as HTMLElement | null;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) ae.blur();
        fastForwardRef.current = false;
        animatingRef.current = true;

        const h = handlesRef.current;
        const scene = step.scene ?? {};
        // Static state — applied instantly so the scene is correct even on back-nav.
        h.setView(scene.view ?? 'chat');
        if (scene.sidebar !== undefined) h.setSidebar(scene.sidebar); // only when the scene asks
        h.setPlanApproved(scene.planApproved ?? false);
        h.setEmotion(scene.emotion ?? false);
        h.setSelectedWeek(scene.selectedWeek ?? null);
        h.setJourneyTab(scene.journeyTab ?? 'overview');
        h.setBetweenWeeks(scene.betweenWeeks ?? false);

        const built = (scene.messages ?? []).map(m => ({
            role: m.role, content: m.content, plan: m.withPlan ? DEMO_PLAN : undefined,
        }));

        if (animate && scene.typeLast && built.length) {
            const head = built.slice(0, -1);
            const last = built[built.length - 1];
            h.setMessages(head);
            if (last.role === 'assistant') {
                h.setLoading(true);
                await wait(950, token);
                h.setLoading(false);
            }
            if (navTokenRef.current !== token) return;
            h.setMessages([...head, { ...last, content: '' }]);
            await typeOut(last.content, token);
        } else {
            h.setMessages(built);
        }
        // Position the chat for this step (after content has rendered).
        if (step.scrollChat && navTokenRef.current === token) {
            await wait(step.scrollChat === 'top' ? 150 : 350, token);
            gentleScroll(step.scrollChat, token, step.scrollChat === 'bottom' ? 1300 : 700);
        }
        if (navTokenRef.current === token) animatingRef.current = false;
    }, []);

    const exit = useCallback(() => {
        cancelledRef.current = true;
        animatingRef.current = false;
        navTokenRef.current++;
        onExitRef.current();
    }, []);

    const next = useCallback(() => {
        if (animatingRef.current) { fastForwardRef.current = true; return; } // fast-forward typing
        const n = stepIndexRef.current + 1;
        if (n >= DEMO_STEPS.length) { exit(); return; }
        goToStep(n, true);
    }, [exit, goToStep]);

    const back = useCallback(() => {
        const p = stepIndexRef.current - 1;
        if (p < 0) return;
        goToStep(p, false); // backward → no typewriter, just snap to the scene
    }, [goToStep]);

    // Start / stop the demo when `active` flips.
    useEffect(() => {
        if (!active) {
            startedRef.current = false;
            cancelledRef.current = true;
            animatingRef.current = false;
            return;
        }
        if (startedRef.current) return;
        startedRef.current = true;
        cancelledRef.current = false;
        goToStep(0, true);
    }, [active, goToStep]);

    // Track the spotlight target rect + measure the card height.
    // A per-frame rAF loop (not a 120ms interval): the mission surface animates
    // its cards in with framer-motion, and a slow poll made the ring visibly
    // trail the element. Reading one getBoundingClientRect per frame is cheap;
    // state only updates when the rect actually moved, so idle frames are free.
    useEffect(() => {
        if (!active) return;
        const step = DEMO_STEPS[stepIndex];
        if (!step) return;
        const target = effectiveTarget(step.target, isMobile);
        let raf = 0;
        let scrolled = false;
        let missingSince = 0;
        const tick = () => {
            if (target === 'center') {
                setRect(null);
            } else {
                const el = findVisible(target);
                if (!el) {
                    setRect(prev => (prev === null ? prev : null));
                    // Give the scene ~0.9s to render the target (framer enters,
                    // view switches); if it still isn't on screen, fall back to
                    // a centered card rather than stranding the tour.
                    if (!missingSince) missingSince = performance.now();
                    else if (performance.now() - missingSince > 900) setFallback(prev => (prev ? prev : true));
                } else {
                    missingSince = 0;
                    setFallback(prev => (prev ? false : prev));
                    // First sighting of this step's target → bring it into view.
                    // On phones/tablets the today card, path row or tiles can sit
                    // below the fold, which used to strand the tour with no card.
                    if (!scrolled) {
                        scrolled = true;
                        try { el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }); } catch { /* older browsers */ }
                    }
                    const r = el.getBoundingClientRect();
                    setRect(prev =>
                        prev &&
                            Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.top - r.top) < 0.5 &&
                            Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
                            ? prev : r
                    );
                }
            }
            const card = cardRef.current;
            if (card) {
                const h = card.offsetHeight;
                if (h && Math.abs(h - cardHRef.current) > 2) { cardHRef.current = h; setCardH(h); }
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [active, stepIndex, isMobile]);

    // Measure the card before paint, so its very first frame is placed for its
    // real height (the welcome card is taller than the default and used to
    // overlap the input for a frame). The rAF tick keeps it fresh afterwards.
    useLayoutEffect(() => {
        const h = cardRef.current?.offsetHeight;
        if (h && Math.abs(h - cardHRef.current) > 2) { cardHRef.current = h; setCardH(h); }
    });

    // Keyboard: Enter / → advance, ← back, Esc exit. Listened for in the capture
    // phase so the tour sees the key before any autofocused chat field does —
    // while the demo is active the real UI is click-blocked, so there's no
    // legitimate typing to protect, and the welcome card promises Enter works.
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); next(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); back(); }
            else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); exit(); }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [active, next, back, exit]);

    if (!active) return null;
    const step = DEMO_STEPS[stepIndex];
    if (!step) return null;
    // Anchored step whose target isn't on screen yet → wait briefly (don't flash a
    // centered card); after the grace period `fallback` shows one so the user can move on.
    if (step.target !== 'center' && !rect && !fallback) return null;

    const isLast = stepIndex === DEMO_STEPS.length - 1;
    const isFirst = stepIndex === 0;

    return (
        <SpotlightOverlay rect={fallback ? null : rect} preferredPlacement={step.placement} cardRef={cardRef} cardH={cardH} isMobile={isMobile} forcePin={isMobile ? step.mobileCard : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, letterSpacing: '0.08em' }}>
                    {stepIndex + 1} / {DEMO_STEPS.length}
                </span>
                <button style={{ ...skipBtn, ...(isMobile ? { padding: '8px 12px', fontSize: '12px' } : {}) }} onClick={exit}>Skip tour</button>
            </div>
            <div style={cardTitle}>{step.title}</div>
            <div style={cardBody}>{step.body}</div>
            {step.showEnterHint && (
                <div style={enterHint}>
                    {isMobile
                        ? 'Tap “Next” to continue, “Back” to revisit →'
                        : <>Tip: use <strong style={{ color: 'var(--text-secondary)' }}>Enter</strong> / <strong style={{ color: 'var(--text-secondary)' }}>← →</strong> keys too →</>}
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '18px' }}>
                <button
                    onClick={back}
                    disabled={isFirst}
                    style={{
                        ...backBtn,
                        opacity: isFirst ? 0.35 : 1,
                        cursor: isFirst ? 'default' : 'pointer',
                        ...(isMobile ? { flex: 1, padding: '13px 16px', fontSize: '13px' } : {}),
                    }}
                >
                    ‹ Back
                </button>
                <button
                    onClick={next}
                    style={{ ...primaryBtn, ...(isMobile ? { flex: 2, padding: '14px 18px', fontSize: '13px' } : {}) }}
                >
                    {isLast ? 'Finish' : 'Next ›'}
                </button>
            </div>
        </SpotlightOverlay>
    );
}

const backBtn: React.CSSProperties = {
    padding: '9px 16px', borderRadius: '100px',
    border: '1px solid var(--border-medium)', background: 'transparent',
    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
    fontFamily: "'Satoshi', 'Inter', system-ui, sans-serif",
    letterSpacing: '0.04em', textTransform: 'uppercase',
};
