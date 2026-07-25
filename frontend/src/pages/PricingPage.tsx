import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import PageShell from '../components/site/PageShell';
import { PageHero, PrimaryCta, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

const INCLUDED = [
  'AI behavioral mentor (unlimited chats)',
  'Goal-based weekly plan generation',
  'The Lock-In Protocol',
  'Daily personalized task emails',
  'Voice journaling & emotion tracking',
  'Streaks & daily check-ins',
  'Weekly report cards',
  'Google Calendar sync',
];

const FAQS = [
  { q: 'Is Feelivate really free?', a: 'Yes. Feelivate is currently free — founding members get full access to the best version at no cost while we grow.' },
  { q: 'Will I be charged later?', a: "No surprise charges. If paid plans launch in future, founding members will be told well in advance and there's no automatic billing today." },
  { q: 'Do I need a credit card?', a: 'No credit card is required to start.' },
  { q: 'What do founding members get?', a: 'Everything — every feature unlocked, plus a say in where the product goes as an early user.' },
];

export default function PricingPage() {
  const { isMobile } = useWindowSize();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'Feelivate',
      description: 'AI behavioral mentor — currently free for founding members.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: SITE_URL + '/pricing', description: 'Free for founding members' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: SITE_URL + '/pricing' },
      ],
    },
  ];

  return (
    <PageShell
      seo={{
        title: 'Pricing — Free for Founding Members | Feelivate',
        description: 'Feelivate is currently free. Founding members get the full AI behavioral mentor — weekly plans, daily task emails, streaks, and reports — at no cost. No credit card required.',
        path: '/pricing',
        jsonLd,
      }}
    >
      <PageHero
        kicker="Pricing"
        title="Free for founding members"
        subtitle="Feelivate is currently free. Founding members get the full, best version of the product at no cost — every feature unlocked, no credit card required."
        isMobile={isMobile}
      />

      {/* Plan card */}
      <section style={{ padding: isMobile ? '48px 20px' : '64px 48px' }}>
        <div style={{ maxWidth: '460px', margin: '0 auto', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: isMobile ? '28px 24px' : '36px 32px', background: 'var(--card-bg)' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-warm)', fontFamily: satoshi }}>Founding Member</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px' }}>
            <span style={{ fontSize: '52px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.05em', lineHeight: 1 }}>Free</span>
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500 }}>while in early access</span>
          </div>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500, marginBottom: '22px' }}>
            Everything unlocked. No credit card. No automatic billing.
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '26px' }}>
            {INCLUDED.map((item) => (
              <li key={item} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontSize: '13.5px', color: 'var(--text-primary)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.45 }}>
                <Check size={16} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--accent-warm)' }} /> {item}
              </li>
            ))}
          </ul>
          <PrimaryCta>Get Started Free</PrimaryCta>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: isMobile ? '16px 20px 72px' : '24px 48px 100px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? '24px' : '32px', fontWeight: 700, letterSpacing: '-0.04em', fontFamily: clash, textAlign: 'center', marginBottom: '28px' }}>Pricing FAQ</h2>
          <div style={{ border: '1px solid var(--border-medium)', borderRadius: '2px', overflow: 'hidden' }}>
            {FAQS.map((f, i) => (
              <div key={f.q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '18px 20px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.01em' }}>{f.q}</span>
                  <ChevronDown size={18} style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease', color: 'var(--text-secondary)' }} />
                </button>
                {openFaq === i && <p style={{ padding: '0 20px 18px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500 }}>{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}
