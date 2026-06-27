/**
 * GuidedDemo — the self-playing scripted walkthrough controller.
 *
 * Reads DEMO_STEPS and plays them: fires each step's UI side-effects, types out
 * scripted chat lines, and spotlights the target element. The user advances with
 * Next / Enter and exits with Skip / Escape. Everything it shows is driven through
 * the `handles` object into WorkspacePage's demo-mirror state — it never calls the
 * backend and never touches the user's real chat/session data.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_STEPS, DEMO_PLAN } from './demoScript';
import {
    SpotlightOverlay, findVisible,
    cardTitle, cardBody, primaryBtn, skipBtn, enterHint, ACCENT,
} from './spotlight';

export interface DemoHandles {
    appendMessage: (m: { role: 'user' | 'assistant'; content: string; plan?: any }) => void;
    setLastContent: (content: string) => void;
    setLoading: (v: boolean) => void;
    resetChat: () => void;
    approvePlan: () => void;
    setView: (v: 'chat' | 'journey') => void;
    openSidebar: () => void;
    closeSidebar: () => void;
    openWeekPanel: () => void;
    showEmotionOrb: () => void;
}

interface GuidedDemoProps {
    active: boolean;
    handles: DemoHandles;
    onExit: () => void;
}

export default function GuidedDemo({ active, handles, onExit }: GuidedDemoProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const [cardH, setCardH] = useState(180);
    const [, setAnimating] = useState(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const cardHRef = useRef(180);
    const handlesRef = useRef(handles);
    const stepIndexRef = useRef(0);
    const cancelledRef = useRef(false);
    const fastForwardRef = useRef(false);
    const animatingRef = useRef(false);
    const startedRef = useRef(false);
    const onExitRef = useRef(onExit);

    useEffect(() => { handlesRef.current = handles; }, [handles]);
    useEffect(() => { onExitRef.current = onExit; }, [onExit]);
    useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

    // A cancellable / fast-forwardable wait.
    const wait = (ms: number) => new Promise<void>(resolve => {
        const start = performance.now();
        const tick = () => {
            if (cancelledRef.current || fastForwardRef.current) return resolve();
            if (performance.now() - start >= ms) return resolve();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

    const typeOut = async (full: string) => {
        let i = 0;
        while (i < full.length) {
            if (cancelledRef.current) return;
            if (fastForwardRef.current) { handlesRef.current.setLastContent(full); return; }
            i = Math.min(full.length, i + 2);
            handlesRef.current.setLastContent(full.slice(0, i));
            await wait(18);
        }
    };

    const runStep = useCallback(async (idx: number) => {
        const step = DEMO_STEPS[idx];
        if (!step) return;
        fastForwardRef.current = false;
        animatingRef.current = true;
        setAnimating(true);
        setRect(null); // recompute spotlight for the new target

        const a = step.action || {};
        if (a.resetChat) handlesRef.current.resetChat();
        if (a.setView) handlesRef.current.setView(a.setView);
        if (a.openSidebar) handlesRef.current.openSidebar();
        if (a.closeSidebar) handlesRef.current.closeSidebar();
        if (a.approvePlan) handlesRef.current.approvePlan();
        if (a.showEmotionOrb) handlesRef.current.showEmotionOrb();
        if (a.openWeekPanel) handlesRef.current.openWeekPanel();

        if (step.chat) {
            for (const line of step.chat) {
                if (cancelledRef.current) return;
                if (line.thinkMs && !fastForwardRef.current) {
                    handlesRef.current.setLoading(true);
                    await wait(line.thinkMs);
                    handlesRef.current.setLoading(false);
                }
                if (cancelledRef.current) return;
                handlesRef.current.appendMessage({
                    role: line.role,
                    content: line.typewriter ? '' : line.content,
                    plan: line.withPlan ? DEMO_PLAN : undefined,
                });
                if (line.typewriter) await typeOut(line.content);
                await wait(220);
            }
        }
        animatingRef.current = false;
        setAnimating(false);
    }, []);

    const exit = useCallback(() => {
        cancelledRef.current = true;
        animatingRef.current = false;
        onExitRef.current();
    }, []);

    const advance = useCallback(() => {
        // Mid-animation: fast-forward the current step instead of jumping ahead.
        if (animatingRef.current) { fastForwardRef.current = true; return; }
        const next = stepIndexRef.current + 1;
        if (next >= DEMO_STEPS.length) { exit(); return; }
        stepIndexRef.current = next;
        setStepIndex(next);
        runStep(next);
    }, [exit, runStep]);

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
        stepIndexRef.current = 0;
        setStepIndex(0);
        runStep(0);
    }, [active, runStep]);

    // Track the spotlight target rect + measure the card height.
    useEffect(() => {
        if (!active) return;
        const step = DEMO_STEPS[stepIndex];
        if (!step) return;
        const tick = () => {
            if (step.target === 'center') setRect(null);
            else {
                const el = findVisible(step.target);
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
    }, [active, stepIndex]);

    // Enter advances, Escape exits — but never while typing in a real field.
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            const tag = (t?.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) return;
            if (e.key === 'Enter') { e.preventDefault(); advance(); }
            else if (e.key === 'Escape') { e.preventDefault(); exit(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, advance, exit]);

    if (!active) return null;
    const step = DEMO_STEPS[stepIndex];
    if (!step) return null;
    // Anchored step whose target isn't on screen yet → wait (don't flash a centered card).
    if (step.target !== 'center' && !rect) return null;

    const isLast = stepIndex === DEMO_STEPS.length - 1;

    return (
        <SpotlightOverlay rect={rect} preferredPlacement={step.placement} cardRef={cardRef} cardH={cardH}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: ACCENT, letterSpacing: '0.08em' }}>
                    {stepIndex + 1} / {DEMO_STEPS.length}
                </span>
                <button style={skipBtn} onClick={exit}>Skip tour</button>
            </div>
            <div style={cardTitle}>{step.title}</div>
            <div style={cardBody}>{step.body}</div>
            {step.showEnterHint && (
                <div style={enterHint}>Tip: press <strong style={{ color: 'var(--text-secondary)' }}>Enter</strong> for Next →</div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button style={primaryBtn} onClick={advance}>{isLast ? 'Finish' : 'Next'}</button>
            </div>
        </SpotlightOverlay>
    );
}
