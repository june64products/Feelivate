import { Play, Image as ImageIcon } from 'lucide-react';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clash = "'Clash Display', 'Inter', system-ui, sans-serif";

/**
 * Media placeholders for the marketing pages.
 *
 * Both slots render a labelled dashed box until you pass a `src`. Drop the file
 * into `frontend/public/` and pass the path (e.g. "/media/demo.mp4") — the
 * placeholder disappears and the real media renders in exactly the same box, so
 * the layout never shifts when the assets land.
 */

interface VideoSlotProps {
    /** e.g. "/media/demo.mp4". Leave undefined to show the placeholder. */
    src?: string;
    /** Still frame shown before playback, e.g. "/media/demo-poster.jpg". */
    poster?: string;
    label?: string;
    hint?: string;
    /** CSS aspect-ratio, default 16/9. */
    ratio?: string;
    autoPlay?: boolean;
}

export function VideoSlot({
    src,
    poster,
    label = 'Product demo video',
    hint = 'Drop an MP4 in /public/media and pass src="/media/demo.mp4"',
    ratio = '16 / 9',
    autoPlay = false,
}: VideoSlotProps) {
    const frame: React.CSSProperties = {
        position: 'relative',
        width: '100%',
        aspectRatio: ratio,
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'var(--card-bg)',
    };

    if (src) {
        return (
            <div style={{ ...frame, border: '1px solid var(--border-medium)', boxShadow: 'var(--shadow-xl)' }}>
                <video
                    src={src}
                    poster={poster}
                    controls={!autoPlay}
                    autoPlay={autoPlay}
                    muted={autoPlay}
                    loop={autoPlay}
                    playsInline
                    preload="metadata"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
            </div>
        );
    }

    return (
        <div
            style={{
                ...frame,
                border: '1px dashed var(--border-focus)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '20px',
                textAlign: 'center',
            }}
        >
            <div style={{
                width: '52px', height: '52px', borderRadius: '50%',
                border: '1px solid var(--border-medium)', background: 'var(--glass-surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Play size={20} style={{ color: 'var(--text-secondary)', marginLeft: '3px' }} />
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                {label}
            </span>
            <span style={{ fontSize: '11.5px', fontFamily: satoshi, fontWeight: 500, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '300px' }}>
                {hint}
            </span>
        </div>
    );
}

interface PhotoSlotProps {
    /** e.g. "/media/shot-1.jpg". Leave undefined to show the placeholder. */
    src?: string;
    alt?: string;
    label?: string;
    /** CSS aspect-ratio, default 4/3. */
    ratio?: string;
}

export function PhotoSlot({ src, alt = '', label = 'Photo', ratio = '4 / 3' }: PhotoSlotProps) {
    const frame: React.CSSProperties = {
        width: '100%',
        aspectRatio: ratio,
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--card-bg)',
    };

    if (src) {
        return (
            <div style={{ ...frame, border: '1px solid var(--border-medium)' }}>
                <img src={src} alt={alt} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
        );
    }

    return (
        <div
            style={{
                ...frame,
                border: '1px dashed var(--border-focus)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '14px', textAlign: 'center',
            }}
        >
            <ImageIcon size={17} style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {label}
            </span>
        </div>
    );
}
