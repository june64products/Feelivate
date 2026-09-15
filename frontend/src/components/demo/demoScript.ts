/**
 * Self-playing guided demo — the declarative script (mission layout).
 *
 * Each step is a SCENE: a complete description of the app state at that point
 * (which messages are shown, whether the plan is locked, which view/tab is open,
 * whether the week drawer is open, etc.). Because every step declares the FULL
 * state, the controller can jump to any step — forward OR backward — just by
 * applying that scene. To add a step, add an entry here; no controller changes.
 *
 * Drawer rule: in demo mode the mentor drawer is open while a conversation
 * exists and the plan is NOT yet approved; approving closes it and the Today
 * mission surface takes over (see WorkspacePage's uiMentorOpen).
 *
 * Nothing here calls the backend; DEMO_PLAN / DEMO_STREAK / DEMO_EMOTION /
 * DEMO_ARCHIVE are canned data so the user's real account is never touched.
 */
import type { Placement } from './spotlight';

export type DemoTarget =
    | 'chat-input' | 'mic-button' | 'plan-actions' | 'lets-go' | 'tweak'
    | 'week-pill' | 'week-panel' | 'week-drawer' | 'alerts-button'
    | 'today-card' | 'done-button' | 'goal-pill' | 'streak'
    | 'journey-nav' | 'journey-mic' | 'mood-mic' | 'archive-tab'
    | 'reports-button' | 'mentor-chip'
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
    sidebar?: boolean;          // legacy no-op (the mission layout has no sidebar)
    emotion?: boolean;          // show the mood orb
    selectedWeek?: number | null; // open the week drawer for this week
    journeyTab?: 'overview' | 'archive';
    /** Journey shows the between-weeks state: journal locked + mood-only mic (demo only). */
    betweenWeeks?: boolean;
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
    shields_left: 1,
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
        title: 'Welcome to Feelivate',
        body: "Quick hands-free tour of your new home base. Use Next / Back (or Enter) to move around, and Skip anytime.",
        scene: {},
    },
    {
        id: 'voice',
        target: 'mic-button',
        placement: 'top',
        title: 'Type or just talk',
        body: "Everything starts with one question: what do you want to change? Type it — or tap the mic and say it out loud.",
        scene: {},
    },
    {
        id: 'first-plan',
        target: 'chat-input',
        placement: 'top',
        title: 'Your mentor gets to work',
        body: "Watch — I'll send a goal. Your mentor opens up right here and turns it into a personalized week plan in seconds.",
        scene: { messages: CHAT, typeLast: true },
        scrollChat: 'top',
        // No forced pin: on phones the mentor input sits at the bottom, so the
        // sheet auto-pins to the top and never covers the highlighted input.
    },
    {
        id: 'week-numbering',
        target: 'plan-actions',
        placement: 'top',
        title: 'This is your week plan',
        body: "Day by day, built around your goal, each task in your own words. First plan only: start it Thu–Sun and that short stretch is Week 0; start Mon–Wed and it's Week 1.",
        scene: { messages: CHAT },
        scrollChat: 'bottom',
    },
    {
        id: 'tweak',
        target: 'tweak',
        placement: 'top',
        title: 'Want changes? Just ask',
        body: 'Not quite right? Tap “Tweak” and tell your mentor what to change — more rest, an easier start, anything. It rebuilds the plan for you.',
        scene: { messages: CHAT },
        scrollChat: 'bottom',
    },
    {
        id: 'lock-plan',
        target: 'lets-go',
        placement: 'top',
        title: 'Commit to the week',
        body: "Happy with it? Tap “Let's go” and confirm — the week locks until Sunday, no softening it mid-week. That commitment is what makes it work.",
        scene: { messages: CHAT },
        scrollChat: 'bottom',
    },
    {
        id: 'today-home',
        target: 'today-card',
        placement: 'bottom',
        title: 'Committed — this is home now',
        body: "Every day you land here: ONE task, front and center, in your own plan's words. No scrolling, no thinking — just today.",
        scene: { messages: CHAT, planApproved: true },
        mobileCard: 'bottom',
    },
    {
        id: 'done-tap',
        target: 'done-button',
        placement: 'bottom',
        title: 'One tap when it’s done',
        body: 'Did the thing? Tap Done — your streak grows, the path lights up, and tomorrow’s task is queued. Skipping honestly counts too.',
        scene: { messages: CHAT, planApproved: true },
        mobileCard: 'bottom',
    },
    {
        id: 'streak',
        target: 'streak',
        placement: 'bottom',
        title: 'Your streak & shields',
        body: 'The flame is your streak; the shield protects it automatically when a day slips — you start with one, and every 7-day run earns another. Tap it anytime for the full picture.',
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'goal-pill',
        target: 'goal-pill',
        placement: 'bottom',
        title: 'Your goals live here',
        body: 'This pill is your goal switcher. Tap it to jump between goals, start a brand-new one, or finish the current goal when you\'re done with it.',
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'path',
        target: 'week-panel',
        placement: 'top',
        title: 'Your week as a path',
        body: 'Done days glow, shielded days show the shield, today pulses, and the gift at the end is your week report. Watch it fill up as you show up.',
        scene: { messages: CHAT, planApproved: true },
        mobileCard: 'top',
    },
    {
        id: 'week-button',
        target: 'week-pill',
        placement: 'left',
        title: 'Your locked weeks live here',
        body: 'Each committed week is saved as a button (W1, W2…). Let me open W1 so you can see the full plan inside…',
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'week-inside',
        target: 'week-drawer',
        placement: 'left',
        title: "What's inside W1",
        body: 'The complete locked week — every day, every task. This is the commitment you made, kept visible.',
        scene: { messages: CHAT, planApproved: true, selectedWeek: 1 },
    },
    {
        id: 'voice-tile',
        target: 'journey-nav',
        placement: 'top',
        title: 'Your evening ritual',
        body: '60 seconds before bed: how did today actually go? Your mentor reads the mood behind your words and shapes next week around it.',
        scene: { messages: CHAT, planApproved: true },
        mobileCard: 'top',
    },
    {
        id: 'mentor-chip',
        target: 'mentor-chip',
        placement: 'top',
        title: 'Stuck? Ask your mentor',
        body: 'Not sure how to do today\'s task? Tap here and your mentor opens right on top of this screen — talk it out, get unstuck, then get back to it.',
        scene: { messages: CHAT, planApproved: true },
        mobileCard: 'top',
    },
    {
        id: 'alerts',
        target: 'alerts-button',
        placement: 'bottom',
        title: 'Daily reminders',
        body: "Turn on Alerts to get that day's task emailed to you every morning — with a one-tap Done button right in the email.",
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'reports',
        target: 'reports-button',
        placement: 'bottom',
        title: 'Your weekly reports',
        body: 'Every finished week gets an honest report. Tap Reports to open the archive of all your past weeks — one tap, any time.',
        scene: { messages: CHAT, planApproved: true },
    },
    {
        id: 'journey-mic',
        target: 'journey-mic',
        placement: 'bottom',
        title: 'Record your day by voice',
        body: "During an active week, tap this mic and just talk — 60 honest seconds. Feelivate reads the mood behind your words and turns the week's entries into one honest report.",
        scene: { messages: CHAT, planApproved: true, view: 'journey' },
    },
    {
        id: 'mood-mic',
        target: 'mood-mic',
        placement: 'bottom',
        title: 'Between weeks: a mood-only mic',
        body: "When no week is running (an old week ended, the next isn't committed yet), the journal mic locks — it needs an active week. This mood-only mic takes over: it just captures how you feel, joining no report and no streak. Your journal unlocks the moment your next week starts.",
        scene: { messages: CHAT, planApproved: true, view: 'journey', betweenWeeks: true },
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
        body: 'Say your goal, commit to a week, show up daily — and let the streak, shields, and reports carry you. What will you change first?',
        scene: { messages: CHAT, planApproved: true, view: 'chat', emotion: true },
    },
];
