import { useState, useEffect, useRef } from 'react';

/** Roughly two lines in a plan column — past this, a day earns a "See more". */
export const CLAMP_CHARS = 110;

/**
 * "One day opened out at a time, closes when you click elsewhere."
 *
 * Shared by the week drawer and the chat plan card so a day behaves the same
 * wherever a plan is shown — including in an old session, which renders its
 * plan cards in full rather than collapsed to a pill.
 *
 * The dismiss test is containment against the opened element, not a backdrop:
 * a backdrop would swallow text selection and the "Show less" tap inside the
 * card itself.
 */
export function useExpandableDay() {
    const [openDay, setOpenDay] = useState<number | null>(null);
    const openRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (openDay === null) return;
        const onPointerDown = (e: MouseEvent | TouchEvent) => {
            if (openRef.current && !openRef.current.contains(e.target as Node)) {
                setOpenDay(null);
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenDay(null); };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [openDay]);

    return { openDay, setOpenDay, openRef };
}
