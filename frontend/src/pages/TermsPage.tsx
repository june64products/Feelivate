import PageShell from '../components/site/PageShell';
import { PageHero, clash, satoshi } from '../components/site/ui';
import { useWindowSize } from '../hooks/useWindowSize';

// NOTE: Boilerplate tailored to Feelivate — have it reviewed by legal before launch.
const SECTIONS: { h: string; p: string[] }[] = [
  { h: 'Acceptance of terms', p: [
    'By creating an account or using Feelivate, you agree to these Terms of Service. If you do not agree, please do not use the service.',
  ] },
  { h: 'The service', p: [
    'Feelivate is an AI accountability mentor that generates weekly action plans and sends reminders, reports, and related features.',
    'Feelivate provides guidance and accountability tools. It is not medical, psychological, or professional advice.',
  ] },
  { h: 'Free access', p: [
    'Feelivate is currently free for founding members. We may introduce paid plans in future; if we do, we will notify you in advance and will not charge you automatically without your consent.',
  ] },
  { h: 'Your account', p: [
    'You are responsible for keeping your login credentials secure and for activity under your account.',
    'You agree to provide accurate information and to use the service lawfully and respectfully.',
  ] },
  { h: 'Your content', p: [
    'You retain ownership of the goals, plans, journals, and other content you create. You grant us the limited rights needed to operate the service and deliver features to you.',
  ] },
  { h: 'Acceptable use', p: [
    'Do not misuse the service, attempt to disrupt it, or use it to harm others or violate any law.',
  ] },
  { h: 'Disclaimers & liability', p: [
    'The service is provided "as is" without warranties. To the extent permitted by law, Feelivate and JUNE64 are not liable for indirect or consequential damages arising from your use of the service.',
  ] },
  { h: 'Changes & contact', p: [
    'We may update these terms; material changes will be communicated. Questions? Contact info@june64.com. Feelivate is a product of JUNE64.',
  ] },
];

export default function TermsPage() {
  const { isMobile } = useWindowSize();
  return (
    <PageShell
      seo={{
        title: 'Terms of Service | Feelivate',
        description: 'The terms that govern your use of Feelivate, the AI accountability mentor by JUNE64.',
        path: '/terms',
      }}
    >
      <PageHero kicker="Legal" title="Terms of Service" subtitle="The rules for using Feelivate." isMobile={isMobile} />
      <section style={{ padding: isMobile ? '40px 20px 80px' : '56px 48px 100px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {SECTIONS.map((s, i) => (
            <div key={s.h} style={{ paddingTop: '24px', paddingBottom: '24px', borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}>
              <h2 style={{ fontSize: isMobile ? '19px' : '22px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.02em', marginBottom: '12px' }}>{s.h}</h2>
              {s.p.map((para) => (
                <p key={para} style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500, marginBottom: '10px' }}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
