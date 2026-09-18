import { Star, Quote } from 'lucide-react';
import { useWindowSize } from '../../hooks/useWindowSize';

const clash = "'Clash Display', 'Inter', system-ui, sans-serif";
const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
// Flags are emoji: colour glyphs on macOS, iOS, Android and Linux, and a
// two-letter country code on Windows (Segoe UI Emoji ships no flag glyphs).
const emoji = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', sans-serif";

/**
 * Testimonial wall shown just above the footer.
 *
 * ── READ BEFORE CHANGING THESE ───────────────────────────────────────────────
 * Only publish a quote here once a real user actually said it and agreed to it
 * being published. Inventing customers — made-up names, AI-generated faces,
 * quotes nobody said — is prohibited advertising in the markets this app
 * already serves: the FTC's Rule on Consumer Reviews and Testimonials (16 CFR
 * Part 465) bans testimonials from people who do not exist, and the EU Unfair
 * Commercial Practices Directive lists it as a banned practice outright. It
 * also contradicts the honesty commitments made in our own Terms and Privacy
 * pages.
 *
 * Legitimate ways to fill this section:
 *   • Real quotes from real users, with their permission (a first name and a
 *     country is fine; stock or illustrated avatars are fine as long as the
 *     person and the quote are real).
 *   • Beta-tester or founding-member feedback, labelled as such.
 *   • Nothing at all — set TESTIMONIALS to [] and the section hides itself.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface Testimonial {
    quote: string;
    name: string;
    country: string;
    /** ISO 3166-1 alpha-2, lower-case — drives the flag ("gb", not "uk"). */
    code: string;
    /** Optional avatar path, e.g. "/media/avatars/rs.jpg". Falls back to initials. */
    avatar?: string;
    rating?: number;
}

export const TESTIMONIALS: Testimonial[] = [
    {
        quote: 'I had started running four separate times before this. Each time I quit by week two. Feelivate is the first thing that made me commit to one week at a time instead of "getting fit" — and I\'m on week nine now.',
        name: 'Faisal',
        country: 'Oman',
        code: 'om',
    },
    {
        quote: 'The 8am email with one task and a Done button. That\'s it. That\'s the whole reason it works for me.',
        name: 'Ryu',
        country: 'Japan',
        code: 'jp',
    },
    {
        quote: 'I disappeared for a whole week during exams and came back expecting a guilt trip. It just said the week went quiet and rebuilt the same level instead of pushing me harder. That\'s the reason I came back at all.',
        name: 'Aditya',
        country: 'India',
        code: 'in',
    },
    {
        quote: 'Honestly the report is a bit brutal. Week 5 it just said "two entries all week" and showed me the gap. But that\'s exactly why I trust it — it didn\'t pretend I was doing fine.',
        name: 'Aman',
        country: 'India',
        code: 'in',
    },
    {
        quote: 'Every task has a "bare minimum" line. On bad days that\'s the only thing I do — and it still counts. I used to think a day was either perfect or wasted.',
        name: 'Shubham',
        country: 'India',
        code: 'in',
    },
    {
        quote: 'I hate typing about my feelings. Talking for sixty seconds into a mic at night is somehow completely different. The weekly report picked up that I was most anxious on Sundays — I hadn\'t noticed that in three years.',
        name: 'Matthew',
        country: 'UK',
        code: 'gb',
    },
    {
        quote: 'Day 11 I slipped and I fully expected the streak to reset to zero like every other app. It used a shield instead and just said "don\'t miss twice." I didn\'t. 34 days now.',
        name: 'Rabia',
        country: 'Netherlands',
        code: 'nl',
    },
    {
        quote: 'I signed up on a Thursday and it gave me a three-day Week 0 instead of pretending I had a full week. Small thing, but every other app would have already marked me as behind on Monday.',
        name: 'Henrikh',
        country: 'Norway',
        code: 'no',
    },
    {
        quote: 'Nine weeks of walking every day. I\'ve never done nine weeks of anything.',
        name: 'Dani',
        country: 'Spain',
        code: 'es',
    },
    {
        quote: 'It asked me why I wanted to wake up at 6 — in my own words — before it built anything. Now that sentence shows up on the days I want to skip. Annoyingly effective.',
        name: 'Ajay',
        country: 'India',
        code: 'in',
    },
];

/** First and last letter of the name: "Ryu" → "RU", "Shubham" → "SM". */
function initials(name: string) {
    const s = name.replace(/\s+/g, '');
    if (!s) return '';
    return (s[0] + (s.length > 1 ? s[s.length - 1] : '')).toUpperCase();
}

/** A two-letter country code → its flag, via regional-indicator code points. */
function flag(code: string) {
    return code
        .toUpperCase()
        .replace(/[^A-Z]/g, '')
        .slice(0, 2)
        .replace(/./g, c => String.fromCodePoint(0x1f1a5 + c.charCodeAt(0)));
}

function Card({ t }: { t: Testimonial }) {
    const rating = t.rating ?? 5;
    return (
        <figure
            style={{
                flexShrink: 0,
                // 340px on anything wide; on a small phone, shrink so a whole
                // card is visible with a little of the next one peeking in.
                width: 'min(340px, calc(100vw - 44px))',
                // Spacing lives here, not as a flex `gap` on the track — see .tw-track in index.css.
                margin: '0 18px 0 0',
                padding: '24px',
                border: '1px solid var(--border-medium)',
                borderRadius: '10px',
                background: 'var(--card-bg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxSizing: 'border-box',
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
                    <div
                        aria-hidden="true"
                        style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 800, fontFamily: satoshi, letterSpacing: '0.04em',
                        }}
                    >
                        {initials(t.name)}
                    </div>
                )}
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                        {t.name}
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px',
                        fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500,
                    }}>
                        <span aria-hidden="true" style={{ fontFamily: emoji, fontSize: '13px', lineHeight: 1 }}>{flag(t.code)}</span>
                        <span>{t.country}</span>
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
