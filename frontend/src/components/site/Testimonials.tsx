import { Star, Quote, User } from 'lucide-react';
import { useWindowSize } from '../../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/**
 * Testimonial wall shown just above the footer.
 *
 * ── READ BEFORE FILLING THIS IN ──────────────────────────────────────────────
 * Every entry below is an unfilled placeholder. Only put a quote here once a
 * real user actually said it and agreed to it being published. Inventing
 * customers — made-up names, AI-generated faces, quotes nobody said — is
 * prohibited advertising in the markets this app already serves: the FTC's
 * Rule on Consumer Reviews and Testimonials (16 CFR Part 465) bans testimonials
 * from people who do not exist, and the EU Unfair Commercial Practices
 * Directive lists it as a banned practice outright. It also contradicts the
 * honesty commitments already made in our own Terms and Privacy pages.
 *
 * Legitimate ways to fill this section:
 *   • Real quotes from real users, with their permission (name/photo optional —
 *     "R.S., Pune" is fine, and stock or illustrated avatars are fine as long
 *     as the person and the quote are real).
 *   • Beta-tester or founding-member feedback, labelled as such.
 *   • Nothing at all — set TESTIMONIALS to [] and the section hides itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface Testimonial {
    quote: string;
    name: string;
    role: string;
    /** Optional avatar path, e.g. "/media/avatars/rs.jpg". Falls back to initials. */
    avatar?: string;
    rating?: number;
}

export const TESTIMONIALS: Testimonial[] = [
    {
        quote: 'Placeholder — paste a real user quote here. Roughly this long reads best: two or three sentences about what changed for them after a few weeks.',
        name: 'Name here',
        role: 'Goal · City',
    },
    {
        quote: 'Placeholder — a shorter quote works too. One punchy line about the locked week or the daily email.',
        name: 'Name here',
        role: 'Goal · City',
    },
    {
        quote: 'Placeholder — quotes about a specific outcome land hardest. What did they actually finish that they had been putting off?',
        name: 'Name here',
        role: 'Goal · City',
    },
    {
        quote: 'Placeholder — a quote about the weekly report or the streak. Keep the user\'s own words; do not polish them into marketing copy.',
        name: 'Name here',
        role: 'Goal · City',
    },
    {
        quote: 'Placeholder — feedback about voice check-ins or how the plan adapted to a bad week.',
        name: 'Name here',
        role: 'Goal · City',
    },
    {
        quote: 'Placeholder — six cards fill both marquee rows nicely. Add more and the row simply gets longer.',
        name: 'Name here',
        role: 'Goal · City',
    },
];

function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

function Card({ t }: { t: Testimonial }) {
    const rating = t.rating ?? 5;
    return (
        <figure
            style={{
                flexShrink: 0,
                width: '340px',
                // Spacing lives here, not as a flex `gap` on the track — see .tw-track in index.css.
                margin: '0 18px 0 0',
                padding: '24px',
                border: '1px solid var(--border-medium)',
                borderRadius: '10px',
                background: 'var(--card-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 5 }, (_, i) => (
                        <Star
                            key={i}
                            size={13}
                            style={{ color: i < rating ? 'var(--accent-warm)' : 'var(--border-focus)' }}
                            fill={i < rating ? 'currentColor' : 'none'}
                        />
                    ))}
                </div>
                <Quote size={16} style={{ color: 'var(--border-focus)' }} />
            </div>

            <blockquote style={{
                margin: 0, fontSize: '13.5px', lineHeight: 1.65,
                color: 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 500,
            }}>
                {t.quote}
            </blockquote>

            <figcaption style={{ display: 'flex', alignItems: 'center', gap: '11px', marginTop: 'auto' }}>
                {t.avatar ? (
                    <img
                        src={t.avatar}
                        alt=""
                        loading="lazy"
                        style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                ) : (
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                        border: '1px dashed var(--border-focus)', background: 'var(--glass-surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 700, fontFamily: satoshi, color: 'var(--text-muted)',
                    }}>
                        {initials(t.name) || <User size={14} />}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                        {t.name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500, marginTop: '2px' }}>
                        {t.role}
                    </div>
                </div>
            </figcaption>
        </figure>
    );
}

function Row({ items, reverse }: { items: Testimonial[]; reverse?: boolean }) {
    // Duplicated once so the translate(-50%) loop is seamless.
    const loop = [...items, ...items];
    return (
        <div className="tw-row">
            <div className={'tw-track' + (reverse ? ' tw-track--reverse' : '')}>
                {loop.map((t, i) => <Card key={i} t={t} />)}
            </div>
        </div>
    );
}

export default function Testimonials({ items = TESTIMONIALS }: { items?: Testimonial[] }) {
    const { isMobile } = useWindowSize();

    // No reviews yet → render nothing rather than an empty shell.
    if (!items.length) return null;

    const half = Math.ceil(items.length / 2);
    const rowA = items.slice(0, half);
    const rowB = items.slice(half).length ? items.slice(half) : rowA;

    return (
        <section
            style={{
                padding: isMobile ? '64px 0' : '96px 0',
                borderBottom: '1px solid var(--border-subtle)',
                overflow: 'hidden',
            }}
        >
            <div style={{ maxWidth: '1080px', margin: '0 auto', padding: isMobile ? '0 20px' : '0 48px', textAlign: 'center', marginBottom: '40px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: satoshi }}>
                    What people say
                </span>
                <h2 style={{
                    fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em',
                    lineHeight: 1.08, margin: '14px 0 0', fontFamily: clash,
                }}>
                    Weeks that actually got finished
                </h2>
            </div>

            <div className="tw-wall">
                <Row items={rowA} />
                <Row items={rowB} reverse />
            </div>
        </section>
    );
}
