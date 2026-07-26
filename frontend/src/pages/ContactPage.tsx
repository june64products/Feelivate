import { useState } from 'react';
import { Mail, AtSign, MapPin, LifeBuoy } from 'lucide-react';
import PageShell from '../components/site/PageShell';
import { PageHero, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';
import { API_BASE_URL } from '../api';

const CONTACT_EMAIL = 'info@june64.com';

const DETAILS = [
  { icon: Mail, label: 'Email', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  { icon: AtSign, label: 'Social', value: '@feelivate' },
  { icon: MapPin, label: 'Location', value: 'London, UK' },
  { icon: LifeBuoy, label: 'Support', value: 'We usually reply within a day' },
];

export default function ContactPage() {
  const { isMobile } = useWindowSize();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '13px 14px', borderRadius: '4px', border: '1px solid var(--border-medium)',
    background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '14px', fontFamily: satoshi,
    fontWeight: 500, outline: 'none',
  };

  const mailtoFallback = () => {
    const subject = encodeURIComponent(`Feelivate contact — ${form.name || 'Website'}`);
    const body = encodeURIComponent(`Name: ${form.name}\nEmail: ${form.email}\n\n${form.message}`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch(`${API_BASE_URL}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('send failed');
      setStatus('sent');
    } catch {
      // Backend unavailable — fall back to the user's email client.
      setStatus('idle');
      mailtoFallback();
    }
  };

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact Feelivate',
      url: SITE_URL + '/contact',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Feelivate',
      url: SITE_URL + '/',
      email: CONTACT_EMAIL,
      contactPoint: { '@type': 'ContactPoint', email: CONTACT_EMAIL, contactType: 'customer support' },
    },
  ];

  return (
    <PageShell
      seo={{
        title: 'Contact Feelivate — Get in Touch',
        description: 'Questions, press, or partnerships? Contact the Feelivate team at info@june64.com. We usually reply within a day.',
        path: '/contact',
        jsonLd,
      }}
    >
      <PageHero kicker="Contact" title="Let's talk." subtitle="Questions, press, or partnerships — reach out and we usually reply within a day." isMobile={isMobile} />

      <section style={{ padding: isMobile ? '40px 20px 72px' : '56px 48px 100px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: isMobile ? '36px' : '48px' }}>
          {/* Form */}
          {status === 'sent' ? (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid var(--border-medium)', borderRadius: '4px', padding: '32px 26px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, fontFamily: satoshi, marginBottom: '10px', color: 'var(--text-primary)' }}>Message sent ✓</h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65, fontFamily: satoshi, fontWeight: 500 }}>
                Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''} — we got it and usually reply within a day.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input required placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              <input required type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              <textarea required placeholder="How can we help?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} style={{ ...inputStyle, resize: 'vertical' }} />
              <button type="submit" disabled={status === 'sending'} style={{ background: 'var(--btn-primary-bg)', color: 'var(--btn-primary-text)', border: 'none', padding: '15px', borderRadius: '4px', fontSize: '14px', fontWeight: 700, fontFamily: satoshi, letterSpacing: '0.02em', textTransform: 'uppercase', cursor: status === 'sending' ? 'not-allowed' : 'pointer', opacity: status === 'sending' ? 0.7 : 1 }}>
                {status === 'sending' ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          )}

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {DETAILS.map((d) => {
              const inner = (
                <div className="svc-card" style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '16px 18px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                  <div className="svc-icon" style={{ flexShrink: 0, width: '40px', height: '40px', borderRadius: '4px', border: '1px solid var(--border-medium)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <d.icon size={16} />
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: satoshi, marginBottom: '4px' }}>{d.label}</div>
                    <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: satoshi }}>{d.value}</div>
                  </div>
                </div>
              );
              return d.href ? (
                <a key={d.label} href={d.href} style={{ textDecoration: 'none' }}>{inner}</a>
              ) : (
                <div key={d.label}>{inner}</div>
              );
            })}
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: satoshi, fontWeight: 500, marginTop: '16px', lineHeight: 1.6 }}>
              Feelivate is a product of <span style={{ fontWeight: 700 }}>JUNE64</span>.
            </p>
          </div>
        </div>
        <p style={{ maxWidth: '900px', margin: '32px auto 0', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 500, textAlign: isMobile ? 'left' : 'center' }}>
          Prefer email? Write to <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{CONTACT_EMAIL}</a> and we'll get back to you.
        </p>
      </section>
    </PageShell>
  );
}
