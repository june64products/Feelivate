/**
 * Self-playing guided demo — the declarative script.
 *
 * Each step is a SCENE: a complete description of the app state at that point
 * (which messages are shown, whether the plan is locked, which view/tab is open,
 * whether the week drawer is open, etc.). Because every step declares the FULL
 * state, the controller can jump to any step — forward OR backward — just by
 * applying that scene. To add a step, add an entry here; no controller changes.
 *
 * Nothing here calls the backend; DEMO_PLAN / DEMO_STREAK / DEMO_EMOTION /
 * DEMO_ARCHIVE are canned data so the user's real account is never touched.
 */
import type { Placement } from './spotlight';

export type DemoTarget =
    | 'chat-input' | 'mic-button' | 'plan-actions' | 'lets-go' | 'tweak'
    | 'week-pill' | 'week-panel' | 'week-drawer' | 'alerts-button'
    | 'logo-toggle' | 'streak' | 'journey-nav' | 'journey-mic' | 'archive-tab'
    | 'emotion-orb' | 'profile-menu' | 'center';

export interface DemoSceneMessage {
    role: 'user' | 'assistant';
    content: string;
    /** attach the demo plan card to this assistant message. */
    withPlan?: boolean;
}

/** A full snapshot of the demo state for a step. Applying it is idempotent. */
export interface DemoScene {
    messages?: DemoSceneMessage[];
    /** animate-type the last message when ENTERING this step going forward. */
    typeLast?: boolean;
    planApproved?: boolean;
    view?: 'chat' | 'journey';
    sidebar?: boolean;          // sidebar expanded
    emotion?: boolean;          // show the mood orb
    selectedWeek?: number | null; // open the week drawer for this week
    journeyTab?: 'overview' | 'archive';
}

export interface DemoStep {
    id: string;
    target: DemoTarget;
    placement?: Placement;
    title: string;
    body: string;
    scene?: DemoScene;
    /** show the "Press Enter for Next" hint (step 1). */
    showEnterHint?: boolean;
    /** scroll the chat to top/bottom on entry, so the right content is visible. */
    scrollChat?: 'top' | 'bottom';
    /** force the mobile card to the top/bottom edge (override the auto side). */
    mobileCard?: 'top' | 'bottom';
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

/** Two example past-week reports for the Archive tab (collapsed cards). */
export const DEMO_ARCHIVE = [
    {
        week_number: 1, week_start: '2026-06-01', week_end: '2026-06-07',
        report: {
            avg_score: 7, consistency_score: 86, days_done: 6, days_missed: 1,
            past_days_count: 7, entry_count: 6, week_number: 1,
            week_theme: 'Build the running habit', dominant_emotion: 'motivated',
            hidden_insight: '', next_week_focus: '', next_week_plan_context: '', days: [],
        },
    },
    {
        week_number: 2, week_start: '2026-06-08', week_end: '2026-06-14',
        report: {
            avg_score: 6, consistency_score: 71, days_done: 5, days_missed: 2,
            past_days_count: 7, entry_count: 5, week_number: 2,
            week_theme: 'Increase your distance', dominant_emotion: 'focused',
            hidden_insight: '', next_week_focus: '', next_week_plan_context: '', days: [],
        },
    },
];

/* ── The scripted conversation reused across scenes ─────────────────────────── */

const CHAT: DemoSceneMessage[] = [
    { role: 'user', content: 'I want to get fit and run a 5K in a month.' },
    {
        role: 'assistant', withPlan: true,
        content: "Love that goal — let's build up safely so it sticks. Here's your Week 1 plan, made just for you:",
    },
];

/* ── The script ─────────────────────────────────────────────────────────────── */

export const DEMO_STEPS: DemoStep[] = [
    {
        id: 'welcome',
        target: 'chat-input',
        placement: 'top',
        showEnterHint: true,
        title: 'Meet your AI mentor',
        body: "Welcome to Feelivate! I'll give you a quick, hands-free tour. Use Next / Back (or Enter) to move around, and Skip anytime.",
        scene: {},
    },
    {
        id: 'voice',
        target: 'mic-button',
        placement: 'top',
        title: 'Type or just talk',
        body: "This is where it all starts. Type what's on your mind — or tap the mic and say it out loud. Feelivate turns your voice into text.",
        scene: {},
    },
    {
        id: 'first-plan',
        target: 'chat-input',
        placement: 'top',
        title: 'Tell Feelivate your goal',
        body: "Watch — I'll send a goal and Feelivate builds a personalized week plan in seconds. No setup, no forms.",
        scene: { messages: CHAT, typeLast: true },
        scrollChat: 'top',     // keep the conversation (your message + reply) in view
        mobileCard: 'bottom',  // card at the bottom so it never covers your message
    },
    {
        id: 'week-numbering',
        target: 'plan-actions',
        placement: 'top',
        title: 'This is your Week 1 plan',
        body: "Day by day, built around your goal. Heads-up for your FIRST plan only: if you start it on a Thursday–Sunday, that short stretch becomes Week 0 (W0); start it Mon–Wed and it's Week 1 (W1).",
        scene: { messages: CHAT },
        scrollChat: 'bottom',
    },
    {
        id: 'tweak',
        target: 'tweak',
        placement: 'top',
        title: 'Want changes? Just ask',
        body: 'Not quite right? Tap “Tweak” and tell Feelivate what to change — more rest, easier start, anything. It rebuilds the plan for you.',
        scene: { messages: CHAT },
        scrollChat: 'bottom',
    },
    {
        id: 'lock-plan',
        target: 'lets-go',
        placement: 'top',
        title: 'Lock it in',
        body: "When you're happy, tap “Let's go” to commit. Once locked, the week stays fixed so you can focus on doing it.",
        scene: { messages: CHAT },
        scrollChat: 'bottom',
    },
    {
        id: 'week-button',
        target: 'week-pill',
        placement: 'left',
        title: 'Your weeks live here',
        body: 'Locked! Your plan is saved as a week button (W1). New weeks stack up next to it. Let me tap W1 to open it…',
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'week-inside',
        target: 'week-drawer',
        placement: 'left',
        title: "What's inside W1",
        body: 'Tapping a week opens its full plan — every day of your locked week, right here. This is what W1 holds.',
        scene: { messages: CHAT, planApproved: true, selectedWeek: 1 },
    },
    {
        id: 'alerts',
        target: 'alerts-button',
        placement: 'bottom',
        title: 'Daily reminders',
        body: "Turn on Alerts to get that day's task emailed to you every morning — so nothing slips through.",
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'sidebar',
        target: 'logo-toggle',
        placement: 'right',
        title: 'Your sidebar',
        body: 'Tap the Feelivate logo any time to open or close your sidebar. Your chats, journey, and streak all live here.',
        scene: { messages: CHAT, planApproved: true, sidebar: true },
    },
    {
        id: 'streak',
        target: 'streak',
        placement: 'right',
        title: 'Build your streak',
        body: 'Show up every day to grow your streak — a daily voice entry counts too. “Best” is your longest run ever. Try to beat it!',
        scene: { messages: CHAT, planApproved: true, sidebar: true },
    },
    {
        id: 'journey-nav',
        target: 'journey-nav',
        placement: 'right',
        title: 'Open My Journey',
        body: 'Your private space to record each day. Tap “My Journey” to open it — let me show you.',
        scene: { messages: CHAT, planApproved: true, sidebar: true },
    },
    {
        id: 'journey-mic',
        target: 'journey-mic',
        placement: 'bottom',
        title: 'Record your day by voice',
        body: 'Tap the mic and just talk about your day. Feelivate listens and turns it into your weekly report — the more you share, the better.',
        scene: { messages: CHAT, planApproved: true, view: 'journey', sidebar: false },
    },
    {
        id: 'archive',
        target: 'archive-tab',
        placement: 'bottom',
        title: 'Overview vs Archive',
        body: 'Your CURRENT week\'s AI review builds in “Overview”. Once a week ends, its report moves to “Archive” — here are 2 example weekly reports.',
        scene: { messages: CHAT, planApproved: true, view: 'journey', journeyTab: 'archive' },
    },
    {
        id: 'orb',
        target: 'emotion-orb',
        placement: 'auto',
        title: 'Your mood orb',
        body: "After your daily entry, this orb lights up with today's mood. You can DRAG it anywhere on screen, and TAP it to jump straight into your Journey.",
        scene: { messages: CHAT, planApproved: true, view: 'chat', emotion: true },
    },
    {
        id: 'replay',
        target: 'profile-menu',
        placement: 'bottom',
        title: 'Replay this tour anytime',
        body: 'Want to see this again later? Tap your profile avatar here → “Replay tutorial”. It\'s always one tap away.',
        scene: { messages: CHAT, planApproved: true, view: 'chat', emotion: true },
    },
    {
        id: 'finish',
        target: 'center',
        placement: 'center',
        title: "You're all set! 🎉",
        body: 'Set a goal, lock a plan, show up daily, and watch your progress grow. Now it\'s your turn — what will you work on first?',
        scene: { messages: CHAT, planApproved: true, view: 'chat', emotion: true },
    },
];
