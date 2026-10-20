import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';
import type { WeeklyReport, WeeklyReportDay } from '../../api';
import { satoshi } from '../mission/missionTheme';
import WeekReviewDashboard, { SectionHead, ViewButton, useReviewSections } from './WeekReviewDashboard';

/**
 * The weekly report. The dashboard (everything on one screen) is the default;
 * the View button swaps to swipe cards — the same five sections, one per
 * card, in a phone-sized frame — and back. Both views are built from the
 * same sections, so nothing differs but the layout.
 */

export type ReportData = NonNullable<WeeklyReport['report']>;

interface WeekReviewStoryProps {
    report: ReportData;
    /** The week's calendar (from the report, or rebuilt locally when the report has none). */
    days: WeeklyReportDay[];
    weekStart?: string;
    weekEnd?: string;
    /** The "Plan Week N+1" action, only when the next week isn't built yet. */
    onPlanNext?: () => void;
    /** Archive rows: a shorter swipe frame. */
    compact?: boolean;
    /** Swipe-frame height; defaults suit the Journey page and the Sunday card. */
    height?: string;
}

export default function WeekReviewStory({ report, days, weekStart, weekEnd, onPlanNext, compact = false, height }: WeekReviewStoryProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(0);
    // The View button: the dashboard by default, or the swipe cards.
    const [mode, setMode] = useState<'dashboard' | 'swipe'>('dashboard');
    const wk = report.week_number ?? 1;

    // The cards live in a ≤520px frame, so they always use the narrow layout.
    const sections = useReviewSections({ report, days, weekStart, weekEnd, onPlanNext, tier: 'narrow' });
    const count = sections.length;

    const pageRef = useRef(0);
    pageRef.current = page;
    const go = (n: number) => {
        const el = trackRef.current; if (!el) return;
        const i = Math.max(0, Math.min(count - 1, n));
        el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    };
    useEffect(() => {
        const el = trackRef.current; if (!el) return;
        const onScroll = () => {
            const p = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            pageRef.current = p;
            setPage(p);
        };
        onScroll(); // a fresh track starts on card 1, whatever page we were on before
        el.addEventListener('scroll', onScroll, { passive: true });
        // Keep the current card aligned when the frame changes width (rotation, resize).
        const ro = new ResizeObserver(() => { el.scrollTo({ left: pageRef.current * el.clientWidth }); });
        ro.observe(el);
        return () => { el.removeEventListener('scroll', onScroll); ro.disconnect(); };
    }, [mode]);
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(page + 1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(page - 1); }
    };

    // Mouse users can't swipe a scroll-snap track the way a thumb can, so a
    // horizontal drag with the mouse moves the cards too (touch keeps the
    // browser's own swipe). Snapping is off while the mouse is down and until
    // the settle animation ends, so the browser doesn't yank the cards back
    // mid-drag. A real drag swallows the click that would otherwise land on
    // whatever is under the pointer.
    const drag = useRef<{ x: number; left: number; page: number; moved: boolean; id: number } | null>(null);
    const [dragging, setDragging] = useState(false);
    const [snapOff, setSnapOff] = useState(false);
    const snapTimer = useRef(0);
    const swallowClick = useRef(false);
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        const el = trackRef.current; if (!el) return;
        window.clearTimeout(snapTimer.current);
        drag.current = { x: e.clientX, left: el.scrollLeft, page: pageRef.current, moved: false, id: e.pointerId };
        setDragging(true);
        setSnapOff(true);
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current; const el = trackRef.current; if (!d || !el) return;
        const dx = e.clientX - d.x;
        if (!d.moved && Math.abs(dx) > 4) {
            d.moved = true;
            // From here the drag follows the mouse even outside the frame, and
            // the text under it stops being selected.
            try { el.setPointerCapture(d.id); } catch { /* not supported */ }
            window.getSelection()?.removeAllRanges();
        }
        if (d.moved) el.scrollLeft = d.left - dx;
    };
    const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = drag.current; const el = trackRef.current; if (!d) return;
        drag.current = null;
        setDragging(false);
        const dx = e.clientX - d.x;
        swallowClick.current = d.moved;
        // One card per drag, counted from where the drag began (the page
        // counter already moves while the cards are being pulled).
        go(d.page + (dx < -40 ? 1 : dx > 40 ? -1 : 0));
        if (el?.hasPointerCapture?.(d.id)) el.releasePointerCapture(d.id);
        window.setTimeout(() => { swallowClick.current = false; }, 0);
        // Snap comes back once the smooth scroll has settled.
        snapTimer.current = window.setTimeout(() => setSnapOff(false), d.moved ? 500 : 0);
    };
    useEffect(() => () => window.clearTimeout(snapTimer.current), []);
    const onClickCapture = (e: React.MouseEvent) => {
        if (swallowClick.current) { e.stopPropagation(); e.preventDefault(); }
    };

    const swipe = mode === 'swipe';
    // The View button always names the OTHER way of reading.
    const viewToggle = swipe
        ? <ViewButton label="Dashboard" icon={<LayoutGrid size={12} />} onClick={() => setMode('dashboard')} />
        : <ViewButton label="Swipe" onClick={() => setMode('swipe')} />;

    if (!swipe) {
        return (
            <div aria-label={`Week ${wk} review`} style={{ width: '100%', fontFamily: satoshi }}>
                <WeekReviewDashboard report={report} days={days} weekStart={weekStart} weekEnd={weekEnd} onPlanNext={onPlanNext} viewButton={viewToggle} />
            </div>
        );
    }

    const frameH = height ?? (compact ? 'min(64vh, 560px)' : 'min(78vh, 760px)');
    const cap: React.CSSProperties = { fontSize: '10.5px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, fontFamily: satoshi };

    return (
        <div
            tabIndex={0}
            onKeyDown={onKey}
            aria-roledescription="carousel"
            aria-label={`Week ${wk} review`}
            style={{
                position: 'relative', width: '100%', maxWidth: '520px', margin: '0 auto', height: frameH,
                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: '24px',
                boxShadow: compact ? 'none' : 'var(--shadow-lg)', overflow: 'hidden', outline: 'none', fontFamily: satoshi,
            }}
        >
            {/* progress */}
            <div style={{ position: 'absolute', top: '12px', left: '16px', right: '16px', display: 'flex', gap: '4px', zIndex: 3 }}>
                {sections.map((sec, i) => (
                    <button key={sec.id} onClick={() => go(i)} aria-label={`${sec.n} ${sec.title}`} style={{ flex: 1, height: '10px', padding: 0, background: 'none', border: 0, cursor: 'pointer' }}>
                        <span style={{ display: 'block', height: '2px', borderRadius: '2px', background: i <= page ? 'var(--text-primary)' : 'var(--border-medium)', transition: 'background 0.25s' }} />
                    </button>
                ))}
            </div>
            {/* cards */}
            <div
                ref={trackRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerLeave={e => { if (drag.current && !drag.current.moved) endDrag(e); }}
                onClickCapture={onClickCapture}
                style={{ height: '100%', display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: snapOff ? 'none' : 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', cursor: dragging ? 'grabbing' : 'grab', userSelect: dragging ? 'none' : 'auto' }}
                className="hide-scrollbar"
            >
                {sections.map(sec => (
                    <section key={sec.id} style={{ flex: '0 0 100%', scrollSnapAlign: 'start', height: '100%', padding: compact ? '30px 14px 66px' : '32px 16px 70px', display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', boxSizing: 'border-box' }}>
                        <SectionHead n={sec.n} title={sec.title} meta={sec.meta} />
                        {sec.body}
                    </section>
                ))}
            </div>
            {/* folio */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                padding: '10px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                background: 'linear-gradient(to top, var(--bg-primary) 55%, transparent)', zIndex: 3,
            }}>
                {viewToggle}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => go(page - 1)} disabled={page === 0} aria-label="Previous section" style={navBtn(page === 0)}><ChevronLeft size={15} /></button>
                    <span style={{ ...cap, minWidth: '42px', textAlign: 'center' }}>{page + 1} / {count}</span>
                    <button onClick={() => go(page + 1)} disabled={page === count - 1} aria-label="Next section" style={navBtn(page === count - 1)}><ChevronRight size={15} /></button>
                </div>
            </div>
            <style>{`.hide-scrollbar::-webkit-scrollbar{display:none}`}</style>
        </div>
    );
}

const navBtn = (disabled: boolean): React.CSSProperties => ({
    width: '30px', height: '30px', borderRadius: '50%', border: '1px solid var(--border-medium)', background: 'var(--card-bg)',
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
});
