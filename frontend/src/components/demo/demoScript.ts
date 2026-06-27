/**
 * Self-playing guided demo — the declarative script.
 *
 * Every step is data: which element to spotlight, what narration to show, what
 * scripted chat lines to "type out", and what UI side-effects to fire when the
 * step opens. The GuidedDemo controller reads this array and plays it. To add a
 * step, just add an entry here — no controller changes needed.
 *
 * Nothing here calls the backend; DEMO_PLAN / DEMO_STREAK / DEMO_EMOTION are the
 * canned data the demo shows so the user's real account is never touched.
 */
import type { Placement } from './spotlight';

export type DemoTarget =
    | 'chat-input' | 'mic-button' | 'plan-actions' | 'lets-go' | 'tweak'
    | 'week-pill' | 'week-panel' | 'alerts-button' | 'logo-toggle' | 'streak'
    | 'journey-nav' | 'journey-mic' | 'archive-tab' | 'emotion-orb'
    | 'center';

/** A scripted chat line — assistant lines can "type out"; user lines appear instantly. */
export interface DemoChatLine {
    role: 'user' | 'assistant';
    content: string;
    /** stream the text char-by-char (assistant only). */
    typewriter?: boolean;
    /** attach the demo plan card to this assistant line. */
    withPlan?: boolean;
    /** ms of "thinking" (loading dots) before this line appears. */
    thinkMs?: number;
}

/** Imperative side-effects performed when a step opens. */
export interface DemoAction {
    resetChat?: boolean;
    openSidebar?: boolean;
    closeSidebar?: boolean;
    openWeekPanel?: boolean;
    approvePlan?: boolean;
    setView?: 'chat' | 'journey';
    showEmotionOrb?: boolean;
}

export interface DemoStep {
    id: string;
    target: DemoTarget;
    placement?: Placement;
    title: string;
    body: string;
    chat?: DemoChatLine[];
    action?: DemoAction;
    /** show the "Press Enter for Next" hint (step 1). */
    showEnterHint?: boolean;
}

/* ── Canned data the demo renders (never hits the backend) ─────────────────── */

export const DEMO_PLAN = {
    week_number: 1,
    week_label: 'Foundation Week',
    theme: 'Build the running habit',
    win_condition: 'Move your body 5 days this week — consistency over intensity.',
    days: [
        { day: 'Monday', action: 'Easy 20-minute walk + 5 minutes of light jogging.' },
        { day: 'Tuesday', action: 'Rest or gentle stretching. Recovery counts.' },
        { day: 'Wednesday', action: 'Run/walk intervals: 1 min jog, 2 min walk × 6.' },
        { day: 'Thursday', action: '20-minute brisk walk. Notice how your body feels.' },
        { day: 'Friday', action: 'Run/walk intervals: 2 min jog, 2 min walk × 5.' },
        { day: 'Saturday', action: 'Your longest effort yet — 25 minutes, any pace.' },
        { day: 'Sunday', action: 'Reflect on the week and rest. You earned it.' },
    ],
};

export const DEMO_STREAK = {
    current_streak: 5,
    longest_streak: 9,
    total_done: 23,
    last_checkin: null,
    days_this_week: [],
};

export const DEMO_EMOTION = {
    emotion_label: 'motivated',
    sentiment_score: 78,
    summary: 'You sounded energized and focused today.',
};

/* ── The 13-step script ────────────────────────────────────────────────────── */

export const DEMO_STEPS: DemoStep[] = [
    {
        id: 'welcome',
        target: 'chat-input',
        placement: 'top',
        showEnterHint: true,
        title: 'Meet your AI mentor',
        body: "Welcome to Feelivate! I'll give you a quick, hands-free tour — sit back and watch. Press Next or Enter to move on, and Skip anytime.",
    },
    {
        id: 'voice',
        target: 'mic-button',
        placement: 'top',
        title: 'Type or just talk',
        body: "This is where it all starts. Type what's on your mind — or tap the mic and say it out loud. Feelivate turns your voice into text for you.",
    },
    {
        id: 'first-plan',
        target: 'chat-input',
        placement: 'top',
        title: 'Tell Feelivate your goal',
        body: "Watch — I'll send a goal and Feelivate will build a personalized week plan in seconds. No setup, no forms.",
        chat: [
            { role: 'user', content: 'I want to get fit and run a 5K in a month.' },
            {
                role: 'assistant', thinkMs: 1100, typewriter: true, withPlan: true,
                content: "Love that goal — let's build up safely so it sticks. Here's your Week 1 plan, made just for you:",
            },
        ],
    },
    {
        id: 'plan-review',
        target: 'plan-actions',
        placement: 'top',
        title: 'Review your plan',
        body: 'Every plan is laid out day by day. Read it over and make sure it feels right for you before you commit.',
    },
    {
        id: 'tweak',
        target: 'tweak',
        placement: 'top',
        title: 'Want changes? Just ask',
        body: 'Not quite right? Tap “Tweak” and tell Feelivate what to change — more rest days, easier start, anything. It rebuilds the plan for you.',
    },
    {
        id: 'lock-plan',
        target: 'lets-go',
        placement: 'top',
        title: 'Lock it in',
        body: "When you're happy, you tap “Let's go” to commit. Once locked, the week stays fixed so you can focus on doing it — not second-guessing it.",
    },
    {
        id: 'week-panel',
        target: 'week-pill',
        placement: 'left',
        title: 'Your week lives here — W1',
        body: "Locked! Your plan is now saved as Week 1 (W1). Tap this button any time to revisit the week you committed to. New weeks stack up here too.",
        action: { approvePlan: true, openWeekPanel: true },
    },
    {
        id: 'alerts',
        target: 'alerts-button',
        placement: 'bottom',
        title: 'Daily reminders',
        body: "Turn on Alerts to get that day's task emailed to you every morning — so nothing slips through the cracks.",
    },
    {
        id: 'sidebar',
        target: 'logo-toggle',
        placement: 'right',
        title: 'Your sidebar',
        body: 'Tap the Feelivate logo any time to open or close your sidebar. Your chats, journey, and streak all live here.',
        action: { openSidebar: true },
    },
    {
        id: 'streak',
        target: 'streak',
        placement: 'right',
        title: 'Build your streak',
        body: 'Show up every day to grow your streak — a daily voice entry counts too. “Best” is your longest run ever. Try to beat it!',
        action: { openSidebar: true },
    },
    {
        id: 'journey-nav',
        target: 'journey-nav',
        placement: 'right',
        title: 'Open My Journey',
        body: 'This is your private space to record each day — how it went, your wins, how it felt. Let me open it for you.',
        action: { openSidebar: true },
    },
    {
        id: 'journey-mic',
        target: 'journey-mic',
        placement: 'bottom',
        title: 'Record your day by voice',
        body: 'Tap the mic and just talk about your day. Feelivate listens and turns it into your weekly report — the more you share, the better it gets.',
        action: { setView: 'journey', closeSidebar: true },
    },
    {
        id: 'finish',
        target: 'center',
        placement: 'center',
        title: "You're all set! 🎉",
        body: 'That\'s Feelivate — set a goal, lock a plan, show up daily, and watch your progress grow. You can replay this tour any time from your profile menu. Now it\'s your turn!',
        action: { setView: 'chat', showEmotionOrb: true },
    },
];
