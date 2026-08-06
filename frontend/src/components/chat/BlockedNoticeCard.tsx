import { ShieldAlert } from 'lucide-react';
import type { BlockedNotice } from '../../api';

const satoshi = "'Satoshi', 'Inter', system-ui, sans-serif";
const clashDisplay = "'Clash Display', 'Inter', sans-serif";

/**
 * Shown in the thread when a request was refused before the mentor ever saw it.
 *
 * Kept calm and small on purpose. The user gets one clear "no" and a way
 * forward — not a warning banner that reads like an accusation. It also never
 * repeats what was asked, so scrolling back through a conversation doesn't
 * re-surface it.
 */
export default function BlockedNoticeCard({ notice }: { notice: BlockedNotice }) {
    return (
        <div
            role="note"
            aria-label="Request not supported"
            style={{
                margin: '10px 0 16px',
                padding: '16px 18px',
                borderRadius: '14px',
                border: '1px solid var(--border-medium)',
                background: 'var(--glass-surface)',
                fontFamily: satoshi,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <ShieldAlert size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
                <span style={{
                    fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                    fontFamily: clashDisplay, letterSpacing: '-0.01em',
                }}>
                    {notice.headline}
                </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                {notice.body}
            </p>
        </div>
    );
}
