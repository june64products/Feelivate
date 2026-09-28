import type { ReactNode } from 'react';
import { clash, satoshi } from '../site/ui';
import { useWindowSize } from '../../hooks/useWindowSize';

/*
 * The renderer for the published legal documents (Privacy Policy, Terms).
 *
 * The documents are data, not JSX: a list of sections, each a list of
 * blocks. That keeps the text reviewable as text — counsel can read the
 * arrays top to bottom — and keeps the two pages typographically identical.
 *
 * Inline markup inside any string is deliberately tiny:
 *   [label](https://…)  → a link (external links open in a new tab)
 *   **bold**            → emphasis
 */

export type LegalBlock =
    | { t: 'p'; text: string }
    | { t: 'h3'; text: string }
    | { t: 'ul'; items: string[] }
    | { t: 'table'; head: string[]; rows: string[][] }
    | { t: 'note'; text: string };

export interface LegalSection {
    id: string;
    h: string;
    blocks: LegalBlock[];
}

const INLINE = /(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)/g;

/** Turns the inline markup into React nodes. */
export function inline(text: string): ReactNode[] {
    const out: ReactNode[] = [];
    let last = 0;
    let key = 0;
    for (const m of text.matchAll(INLINE)) {
        const start = m.index ?? 0;
        if (start > last) out.push(text.slice(last, start));
        const token = m[0];
        if (token.startsWith('[')) {
            const close = token.indexOf('](');
            const label = token.slice(1, close);
            const href = token.slice(close + 2, -1);
            const external = /^https?:\/\//.test(href) && !href.startsWith('https://feelivate.com');
            out.push(
                <a
                    key={key++}
                    href={href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noreferrer' : undefined}
                    style={{ color: 'var(--text-primary)', textDecorationColor: 'var(--accent-warm)', textUnderlineOffset: '3px' }}
                >
                    {label}
                </a>,
            );
        } else {
            out.push(<strong key={key++} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{token.slice(2, -2)}</strong>);
        }
        last = start + token.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

export default function LegalDoc({
    lastUpdated,
    version,
    sections,
}: {
    lastUpdated: string;
    version: string;
    sections: LegalSection[];
}) {
    const { isMobile } = useWindowSize();

    const body: React.CSSProperties = {
        fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.7,
        fontFamily: satoshi, fontWeight: 500, marginBottom: '10px',
    };

    return (
        <section style={{ padding: isMobile ? '40px 20px 80px' : '56px 48px 100px' }}>
            <div style={{ maxWidth: '760px', margin: '0 auto' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 600, letterSpacing: '0.04em', marginBottom: '8px' }}>
                    Last updated {lastUpdated} · Version {version}
                </p>

                {/* Contents: the documents are long, and a reader usually wants one section. */}
                <nav aria-label="Contents" style={{ margin: '18px 0 6px', display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
                    {sections.map((s, i) => (
                        <a key={s.id} href={`#${s.id}`} style={{ fontSize: '12.5px', color: 'var(--text-secondary)', textDecoration: 'none', fontFamily: satoshi, fontWeight: 600 }}>
                            {i + 1}. {s.h}
                        </a>
                    ))}
                </nav>

                {sections.map((s, i) => (
                    <div key={s.id} id={s.id} style={{ paddingTop: '24px', paddingBottom: '24px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)', scrollMarginTop: '90px' }}>
                        <h2 style={{ fontSize: isMobile ? '19px' : '22px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '12px' }}>
                            {i + 1}. {s.h}
                        </h2>
                        {s.blocks.map((b, j) => {
                            switch (b.t) {
                                case 'p':
                                    return <p key={j} style={body}>{inline(b.text)}</p>;
                                case 'h3':
                                    return (
                                        <h3 key={j} style={{ fontSize: '15.5px', fontWeight: 700, fontFamily: satoshi, color: 'var(--text-primary)', margin: '18px 0 8px', letterSpacing: '-0.01em' }}>
                                            {inline(b.text)}
                                        </h3>
                                    );
                                case 'ul':
                                    return (
                                        <ul key={j} style={{ ...body, paddingLeft: '22px', margin: '0 0 12px' }}>
                                            {b.items.map((it, k) => <li key={k} style={{ marginBottom: '5px' }}>{inline(it)}</li>)}
                                        </ul>
                                    );
                                case 'note':
                                    return (
                                        <p key={j} style={{ ...body, padding: '12px 16px', borderLeft: '3px solid var(--accent-warm)', background: 'var(--bg-surface)', borderRadius: '0 10px 10px 0', color: 'var(--text-primary)' }}>
                                            {inline(b.text)}
                                        </p>
                                    );
                                case 'table':
                                    return (
                                        <div key={j} style={{ overflowX: 'auto', margin: '6px 0 16px', border: '1px solid var(--border-subtle)', borderRadius: '12px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', fontFamily: satoshi, minWidth: b.head.length > 2 ? '560px' : '0' }}>
                                                <thead>
                                                    <tr>
                                                        {b.head.map((h, k) => (
                                                            <th key={k} style={{ textAlign: 'left', padding: '10px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                                                                {h}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {b.rows.map((r, k) => (
                                                        <tr key={k}>
                                                            {r.map((c, m) => (
                                                                <td key={m} style={{ padding: '10px 12px', verticalAlign: 'top', color: m === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: m === 0 ? 600 : 500, lineHeight: 1.55, borderTop: k === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                                                                    {inline(c)}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                default:
                                    return null;
                            }
                        })}
                    </div>
                ))}
            </div>
        </section>
    );
}
