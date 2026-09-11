import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import PageShell from '../components/site/PageShell';
import { PageHero, PrimaryCta, clash, satoshi } from '../components/site/ui';
import { SITE_URL } from '../components/site/Seo';
import { useWindowSize } from '../hooks/useWindowSize';

type Feature = { title: string; desc: string; benefits: string[] };
type Group = { act: string; title: string; blurb: string; features: Feature[] };

// Copy follows the SEO content brief (Feelivate feature content doc) verbatim,
// mapped into the existing three-act layout.
const GROUPS: Group[] = [
  {
    act: 'Step 01',
    title: 'Plan it',
    blurb: 'Turn a fuzzy ambition into a concrete, non-negotiable week.',
    features: [
      {
        title: 'Turn Your Goal Into a 7-Day Action Plan',
        desc: 'Tell Feelivate what you want to accomplish in plain language, and it turns that goal into a specific seven-day plan with clear daily actions, timing, and priorities. Your plan is built around your goal, schedule, and current starting point, so you know exactly what to do next instead of relying on vague intentions.',
        benefits: ['Clear daily actions: Know what to do, when to do it, and how to start.', 'Built around your reality: Plans account for your goal, schedule, and current starting point.', 'No blank templates: Get a structured action plan through a real conversation with your AI mentor.'],
      },
      {
        title: 'Customize Your Plan Before You Commit',
        desc: 'Adjust the intensity, schedule, and daily focus through a conversation with Feelivate before your seven-day plan is locked. Your AI accountability coach adapts the plan to your actual time, priorities, and starting point, so the actions are realistic enough to follow.',
        benefits: ['Refine through conversation: Adjust your plan without rigid forms or fixed templates.', 'Match your reality: Set the difficulty and pace around your available time and current ability.', 'Commit with confidence: Review and shape the plan before making it your week.'],
      },
      {
        title: 'Lock In Your Plan and Follow Through',
        desc: 'Once you approve your seven-day plan, Feelivate locks it in. The actions you agreed to become your commitment for the week, giving you less room to quietly reduce the goal when motivation drops or the work gets difficult.',
        benefits: ['No changing the goal midweek: Stay accountable to the plan you approved.', 'Turn intention into commitment: Move from deciding what to do to actually doing it.', 'Stay accountable when motivation drops: Keep the original commitment in view when excuses start to appear.'],
      },
    ],
  },
  {
    act: 'Step 02',
    title: 'Execute daily',
    blurb: 'Show up every day without relying on motivation.',
    features: [
      {
        title: 'Get Your Daily Task Without Opening an App',
        desc: 'Feelivate sends your assigned task directly to your inbox at the time you choose. Each email tells you what to do that day and how to approach it, so you can act immediately instead of reopening a goal tracker and deciding what comes next.',
        benefits: ["Know today's action: Get one clear task tied to your weekly goal.", 'Fits your routine: Receive the email at your chosen time and in your timezone.', 'Actionable guidance: Get practical tips with the task, not just another reminder.'],
      },
      {
        title: 'Break Big Goals Into Daily Micro-Actions',
        desc: 'Feelivate breaks a larger goal into small, actionable steps that are easier to start and complete each day. Each action connects to the next, helping you build consistency through completed work rather than endless planning.',
        benefits: ['Easy to start: Get a focused action that feels manageable enough to begin.', 'Builds day by day: Each task follows the previous one to keep your goal moving forward.', 'Create momentum through action: Consistent completion turns daily effort into lasting progress.'],
      },
      {
        title: 'Track Daily Progress With Streaks and Check-Ins',
        desc: 'Feelivate makes daily accountability simple: mark your task complete, keep your streak visible, and see whether you are following through on the plan you committed to. Quick check-ins keep progress easy to record without turning accountability into another chore.',
        benefits: ['Keep your streak visible: See your consistency build from one completed day to the next.', 'Check in quickly: Mark daily progress in seconds without unnecessary tracking.', 'Make consistency tangible: A visible streak gives you a clear reason to keep showing up.'],
      },
      {
        title: 'Sync Your Goals With Google Calendar',
        desc: 'Connect Google Calendar so your Feelivate plan fits directly into your existing schedule. Turn planned actions into scheduled commitments with reminders, making it easier to protect time for the work instead of leaving it for an undefined "someday."',
        benefits: ['Plan around your schedule: Put goal-related actions where your day already happens.', 'Keep commitments visible: Calendar reminders help keep planned work from slipping.', 'Schedule action, not intention: Give each task a place in your day so follow-through does not depend entirely on willpower.'],
      },
    ],
  },
  {
    act: 'Step 03',
    title: 'Reflect & adapt',
    blurb: 'An honest feedback loop that makes every week smarter.',
    features: [
      {
        title: 'Use Voice Check-Ins With Your AI Accountability Partner',
        desc: 'Had a difficult day or missed a task? Send a voice memo instead of typing it out. Feelivate transcribes your check-in and helps identify why you slipped, giving your AI accountability partner useful context to guide the next step instead of simply marking the day as missed.',
        benefits: ['Speak instead of type: Explain what happened naturally through a quick voice check-in.', 'Capture the reason: Go beyond task completion and identify what affected your follow-through.', 'Turn setbacks into feedback: Use each check-in to make your next actions more realistic and focused.'],
      },
      {
        title: 'Adapt Your Routine With Emotion-Aware Tracking',
        desc: "Feelivate lets you record how you feel each day and uses that context when shaping your next actions. Your AI routine coach can account for your current state, helping you maintain a sustainable pace instead of following the same rigid routine regardless of how you're doing.",
        benefits: ['Track more than task completion: Record how you feel alongside your daily progress.', "Adapt to your real state: Adjust the pace when you're depleted and maintain momentum when you're ready.", 'Identify useful patterns: See what tends to support or disrupt your consistency over time.'],
      },
      {
        title: 'See What You Actually Accomplished Each Week',
        desc: 'Feelivate turns your weekly activity into a clear progress report, showing what you committed to versus what you actually completed. For your weekly productivity goals, this creates an honest feedback loop that helps your AI accountability partner adjust the next plan based on real follow-through, not assumptions.',
        benefits: ['See commitment vs. completion: Get a clear view of what you planned and what you actually did.', 'Track progress over time: Identify patterns in your consistency and see where your effort is moving.', 'Build on real performance: Use each weekly report to make the next set of actions more focused and challenging.'],
      },
      {
        title: 'Your AI Accountability Partner Remembers Your Progress',
        desc: 'Feelivate carries your wins, patterns, setbacks, and past actions from one week into the next. That ongoing context gives your AI accountability partner a clearer picture of how you work toward your goals, so guidance becomes increasingly relevant instead of resetting with every session.',
        benefits: ['Keep your history connected: Your progress and patterns carry forward across weeks.', 'Get guidance with context: Future plans can account for previous actions and setbacks.', 'Stop repeating yourself: Your goal journey stays connected without re-explaining your history each session.'],
      },
    ],
  },
];

const FEATURE_FAQS = [
  // ── SEO brief FAQs — order and wording from the feature content doc ──
  { q: 'What is an AI accountability coach?', a: 'An AI accountability coach helps turn a goal into specific actions and keeps you accountable for completing them. Feelivate creates a seven-day action plan, sends daily tasks, tracks your progress, and uses weekly feedback to guide your next steps.' },
  { q: 'How does Feelivate help you stay accountable to your goals?', a: 'Feelivate turns your goal into a locked seven-day plan with specific daily actions. Daily task emails, quick check-ins, streak tracking, and weekly reports keep your commitment visible and show the difference between what you planned and what you actually completed.' },
  { q: 'How is Feelivate different from a goal or habit tracking app?', a: 'A traditional tracker mainly records goals, habits, or completed tasks. Feelivate focuses on follow-through by creating the action plan for you, delivering the next task, tracking completion, and using your progress to shape future guidance.' },
  { q: 'Can Feelivate create a personalized action plan from a goal?', a: 'Yes. You describe what you want to accomplish in plain language, and Feelivate creates a structured seven-day action plan around your goal, schedule, and starting point. You can refine the plan before approving and locking it in.' },
  { q: 'How does Feelivate adapt when I miss a task or have a difficult day?', a: 'Feelivate uses check-ins, voice reflections, emotional context, and weekly reports to understand what affected your progress. This feedback helps make future actions more realistic instead of treating a missed task as simple failure.' },
  { q: 'Does Feelivate track progress over multiple weeks?', a: 'Yes. Feelivate maintains multi-week context around your goals, including progress, patterns, wins, and setbacks. This gives your AI accountability partner a longer-term view of your behavior instead of starting each session without previous context.' },
  { q: 'Can Feelivate fit goal-related tasks into my existing schedule?', a: 'Yes. Feelivate can connect with Google Calendar so planned actions can become scheduled commitments in your existing calendar. Daily tasks can also be delivered by email at your selected time and timezone.' },
  // ── Original product FAQs, kept below the brief's set ──
  { q: 'Do I have to use every feature?', a: 'No. Start with a goal and a weekly plan — voice journaling, calendar sync, and the rest are there when you want them.' },
  { q: 'Can I change my plan after it locks?', a: "You can't quietly make a locked week easier, but you can talk to your mentor to shape future weeks. The lock protects your commitment; it doesn't trap you." },
  { q: 'How do the daily task emails work?', a: "Each morning you get a personalized email with that day's exact task and how-to tips, at the time and timezone you choose. Change the time or pause anytime." },
  { q: 'Is my voice and emotion data private?', a: 'Yes. Journals and emotion logs are used only to personalize your plans, and sensitive fields are redacted from our logs by default.' },
];

export default function FeaturesPage() {
  const { isMobile } = useWindowSize();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  let n = 0;

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL + '/' },
        { '@type': 'ListItem', position: 2, name: 'Features', item: SITE_URL + '/features' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FEATURE_FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return (
    <PageShell
      seo={{
        title: 'AI Accountability Coach for Daily Goals | Feelivate',
        description: 'Stay on track with an AI accountability coach that turns goals into seven-day action plans, daily tasks, and progress tracking built for follow-through.',
        path: '/features',
        jsonLd,
      }}
    >
      <PageHero
        kicker="Features"
        title="AI Accountability Coach for Goal Follow-Through"
        subtitle="Feelivate turns your goals into a structured seven-day action plan, then keeps you accountable through daily tasks and progress reviews. Unlike a basic goal tracker, it connects what you want to achieve with the actions you need to take next, helping you stay consistent and make measurable progress."
        isMobile={isMobile}
      />

      {GROUPS.map((group) => (
        <section key={group.title} style={{ padding: isMobile ? '44px 20px' : '64px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ maxWidth: '920px', margin: '0 auto' }}>
            {/* Group header */}
            <div style={{ marginBottom: '28px', maxWidth: '620px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--accent-warm)', fontFamily: satoshi }}>{group.act}</span>
              <h2 style={{ fontSize: isMobile ? '28px' : '38px', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.08, fontFamily: clash, margin: '12px 0 10px' }}>{group.title}</h2>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, fontFamily: satoshi, fontWeight: 500 }}>{group.blurb}</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {group.features.map((f) => {
                n += 1;
                return (
                  <div key={f.title} className="svc-card" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '64px 1fr', gap: isMobile ? '8px' : '20px', padding: isMobile ? '24px' : '28px 30px', border: '1px solid var(--border-medium)', borderRadius: '2px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: satoshi, letterSpacing: '0.06em' }}>{String(n).padStart(2, '0')}</div>
                    <div>
                      <h3 style={{ fontSize: isMobile ? '19px' : '22px', fontWeight: 700, fontFamily: clash, letterSpacing: '-0.03em', marginBottom: '10px' }}>{f.title}</h3>
                      <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: satoshi, fontWeight: 500, marginBottom: '18px' }}>{f.desc}</p>
                      <ul style={{ listStyle: 'none', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
                        {f.benefits.map((b) => (
                          <li key={b} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px', color: 'var(--text-primary)', fontFamily: satoshi, fontWeight: 500, lineHeight: 1.5 }}>
                            <Check size={14} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-warm)' }} /> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      {/* FAQ */}
      <section style={{ padding: isMobile ? '48px 20px' : '72px 48px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 style={{ fontSize: isMobile ? '26px' : '34px', fontWeight: 700, letterSpacing: '-0.04em', fontFamily: clash, textAlign: 'center', marginBottom: '28px' }}>Feature FAQ</h2>
          <div style={{ border: '1px solid var(--border-medium)', borderRadius: '2px', overflow: 'hidden' }}>
            {FEATURE_FAQS.map((f, i) => (
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

      {/* CTA */}
      <section style={{ padding: isMobile ? '56px 20px 72px' : '80px 48px 100px', textAlign: 'center' }}>
        <h2 style={{ fontSize: isMobile ? '28px' : '40px', fontWeight: 700, letterSpacing: '-0.04em', fontFamily: clash, marginBottom: '12px', lineHeight: 1.06 }}>See it work on your goal</h2>
        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontFamily: satoshi, fontWeight: 500, marginBottom: '28px' }}>Free for founding members. Your first plan is one conversation away.</p>
        <PrimaryCta>Start Free</PrimaryCta>
      </section>
    </PageShell>
  );
}
