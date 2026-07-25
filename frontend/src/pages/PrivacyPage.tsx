import PageShell from '../components/site/PageShell';
import { PageHero, clash, satoshi } from '../components/site/ui';
import { useWindowSize } from '../hooks/useWindowSize';

// NOTE: Boilerplate tailored to Feelivate — have it reviewed by legal before launch.
const SECTIONS: { h: string; p: string[] }[] = [
  { h: 'Information we collect', p: [
    'Account details you provide: your name, email address, and password.',
    'Content you create: your goals, weekly plans, tasks, check-ins, streaks, voice memos and their transcripts, and daily emotion logs.',
    'Optional integrations: if you connect Google Calendar, we access the calendar scope you grant to sync your plan.',
    'Usage and device data collected automatically to keep the service secure and improve it.',
  ] },
  { h: 'How we use your information', p: [
    'To generate and personalize your weekly plans, daily task emails, streaks, and weekly reports.',
    'To transcribe voice memos and adapt guidance based on your logged emotions.',
    'To send you the daily and account emails you opt into, at your chosen time.',
    'To secure, maintain, and improve the product.',
  ] },
  { h: 'Third-party services', p: [
    'We use trusted processors to run the service — for AI processing of your inputs, email delivery, and (if you connect it) Google Calendar. These providers process data only to deliver the feature you use.',
    'We do not sell your personal data.',
  ] },
  { h: 'Data retention & security', p: [
    'We keep your data while your account is active and as needed to provide the service. You can request deletion at any time.',
    'We apply reasonable technical and organizational measures to protect your data, and redact sensitive fields from our logs by default.',
  ] },
  { h: 'Your rights', p: [
    'You can access, correct, export, or delete your personal data, and stop daily emails at any time from your settings.',
    'To exercise any of these rights, email us at info@june64.com.',
  ] },
  { h: 'Contact', p: [
    'Questions about privacy? Contact info@june64.com. Feelivate is a product of JUNE64.',
  ] },
];

export default function PrivacyPage() {
  const { isMobile } = useWindowSize();
  return (
    <PageShell
      seo={{
        title: 'Privacy Policy | Feelivate',
        description: "How Feelivate collects, uses, and protects your data — including plans, voice memos, and emotion logs. We don't sell your personal data.",
        path: '/privacy',
      }}
    >
      <PageHero kicker="Legal" title="Privacy Policy" subtitle="How we collect, use, and protect your information." isMobile={isMobile} />
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
