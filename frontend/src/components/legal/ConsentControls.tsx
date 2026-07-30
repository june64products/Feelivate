import type { ConsentItem } from '../../api';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";

/**
 * A single consent checkbox.
 *
 * Deliberately plain: no pre-ticked boxes, no bundling of several permissions
 * into one control, and the Art 9 ("explicit") item is visually separated so it
 * reads as its own decision rather than fine print attached to the terms.
 */
export function ConsentCheckbox({
    item,
    checked,
    onChange,
    disabled = false,
}: {
    item: ConsentItem;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label
            htmlFor={`consent-${item.key}`}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: item.explicit ? '12px' : '2px 0',
                borderRadius: '6px',
                border: item.explicit ? '1px solid var(--border-medium)' : 'none',
                background: item.explicit ? 'var(--card-bg)' : 'transparent',
                opacity: disabled ? 0.6 : 1,
            }}
        >
            <input
                id={`consent-${item.key}`}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
                style={{
                    marginTop: '2px',
                    width: '16px',
                    height: '16px',
                    flexShrink: 0,
                    accentColor: 'var(--accent-primary)',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                }}
            />
            <span
                style={{
                    fontSize: '12.5px',
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    fontFamily: satoshi,
                    fontWeight: 500,
                }}
            >
                {renderLabel(item.label)}
                {!item.required && (
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> (optional)</span>
                )}
            </span>
        </label>
    );
}

/** Document names that become links wherever they appear in a consent label. */
const LINKED_DOCUMENTS: { phrase: string; href: string }[] = [
    { phrase: 'Terms of Service', href: '/terms' },
    { phrase: 'Privacy Policy', href: '/privacy' },
];

/**
 * Turns Terms / Privacy Policy mentions in the label into real links.
 *
 * Consent is only informed if the person can actually read what they are
 * agreeing to without leaving the form to hunt for it.
 *
 * Matches on the phrase rather than the consent key, because the labels are
 * authored server-side: rewording a consent or splitting one in two would
 * otherwise silently drop the links and leave the text unreadable in place.
 */
function renderLabel(label: string) {
    const pattern = new RegExp(`(${LINKED_DOCUMENTS.map(d => d.phrase).join('|')})`, 'g');
    const linkStyle: React.CSSProperties = {
        color: 'var(--text-primary)',
        fontWeight: 700,
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
    };

    return label.split(pattern).map((part, i) => {
        const doc = LINKED_DOCUMENTS.find(d => d.phrase === part);
        if (!doc) return <span key={i}>{part}</span>;
        return (
            <a
                key={i}
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                style={linkStyle}
                // The label is itself a <label>, so a click on the link would
                // otherwise also toggle the checkbox the user is trying to read
                // about before deciding.
                onClick={e => e.stopPropagation()}
            >
                {part}
            </a>
        );
    });
}
