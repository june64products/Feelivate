/**
 * GuidedDemo — the self-playing scripted walkthrough controller.
 *
 * Each step is a SCENE (full state snapshot). Navigating — forward or backward —
 * just applies that step's scene through the `handles` object into WorkspacePage's
 * demo-mirror state. Forward entry into a "type a message" step animates the
 * typewriter; back/jump applies instantly. It never calls the backend.
 */
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
}

interface GuidedDemoProps {
    active: boolean;
    handles: DemoHandles;
    onExit: () => void;
}

/** On phones the W1 pill lives inside a bottom-sheet; point at the always-visible
 *  header WEEKS button instead so the spotlight has a stable, uncovered target. */
function effectiveTarget(target: string, isMobile: boolean): string {
    if (isMobile && target === 'week-pill') return 'week-panel';
    return target;
}

export default function GuidedDemo({ active, handles, onExit }: GuidedDemoProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
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
    useEffect(() => {
        if (!active) return;
        const step = DEMO_STEPS[stepIndex];
        if (!step) return;
        const target = effectiveTarget(step.target, isMobile);
        const tick = () => {
            if (target === 'center') setRect(null);
            else {
                const el = findVisible(target);
                setRect(el ? el.getBoundingClientRect() : null);
            }
            const card = cardRef.current;
            if (card) {
                const h = card.offsetHeight;
                if (h && Math.abs(h - cardHRef.current) > 2) { cardHRef.current = h; setCardH(h); }
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
    }, [active, stepIndex, isMobile]);

    // Keyboard: Enter / → advance, ← back, Esc exit — never while typing in a field.
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const tag = (t?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
            if (e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
            else if (e.key === 'Escape') { e.preventDefault(); exit(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, next, back, exit]);

    if (!active) return null;
    const step = DEMO_STEPS[stepIndex];
    if (!step) return null;
    // Anchored step whose target isn't on screen yet → wait (don't flash a centered card).
    if (step.target !== 'center' && !rect) return null;

    const isLast = stepIndex === DEMO_STEPS.length - 1;
    const isFirst = stepIndex === 0;

    return (
        <SpotlightOverlay rect={rect} preferredPlacement={step.placement} cardRef={cardRef} cardH={cardH} isMobile={isMobile} forcePin={isMobile ? step.mobileCard : undefined}>
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
