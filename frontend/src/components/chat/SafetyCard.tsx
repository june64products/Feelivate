import { LifeBuoy } from 'lucide-react';
import type { SafetyNotice } from '../../api';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";

/**
 * Crisis-support resources, rendered when the backend flags a message as
 * indicating risk of suicide or self-harm.
 *
 * Presented as its own card rather than as text inside the reply: someone in
 * that state should not have to parse a paragraph to find a phone number. Phone
 * numbers are tel: links and the directory is a real link, so help is one tap
 * away on mobile.
 */
export default function SafetyCard({ notice }: { notice: SafetyNotice }) {
    return (
        <div
            role="note"
            aria-label="Crisis support resources"
            style={{
                margin: '10px 0 16px',
                padding: '18px 20px',
                borderRadius: '14px',
                border: '1px solid rgba(239,68,68,0.28)',
                background: 'rgba(239,68,68,0.05)',
                fontFamily: satoshi,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <LifeBuoy size={17} style={{ color: '#dc2626', flexShrink: 0 }} />
                <h3
                    style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        margin: 0,
                        fontFamily: clashDisplay,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {notice.headline}
                </h3>
            </div>

            <p
                style={{
                    fontSize: '13px',
                    lineHeight: 1.65,
                    color: 'var(--text-secondary)',
                    margin: '0 0 14px',
                }}
            >
                {notice.body}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notice.resources.map((r) => (
                    <div
                        key={`${r.region}-${r.name}`}
                        style={{
                            paddingTop: '10px',
                            borderTop: '1px solid rgba(239,68,68,0.15)',
                        }}
                    >
                        <div
                            style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                                color: 'var(--text-muted)',
                                marginBottom: '4px',
                            }}
                        >
                            {r.region}
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {r.name}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                            {renderContact(r.contact)}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px', lineHeight: 1.5 }}>
                            {r.note}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

const linkStyle: React.CSSProperties = {
    color: '#dc2626',
    fontWeight: 700,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
};

/** Makes URLs clickable and plain phone numbers dialable on mobile. */
function renderContact(contact: string) {
    if (contact.startsWith('http')) {
        return (
            <a href={contact} target="_blank" rel="noopener noreferrer" style={linkStyle}>
                {contact.replace(/^https?:\/\//, '')}
            </a>
        );
    }

    // Split on separators so "14416 or 1-800-891-4416" yields two dialable
    // numbers while surrounding words stay as plain text.
    const parts = contact.split(/(\s+or\s+|\s+·\s+)/);
    return parts.map((part, i) => {
        const trimmed = part.trim();
        if (/^[\d][\d\-\s]{2,}$/.test(trimmed)) {
            return (
                <a key={i} href={`tel:${trimmed.replace(/[\s-]/g, '')}`} style={linkStyle}>
                    {trimmed}
                </a>
            );
        }
        return <span key={i}>{part}</span>;
    });
}
