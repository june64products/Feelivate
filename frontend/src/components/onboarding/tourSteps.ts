/**
 * First-time walkthrough — the ordered list of steps.
 *
 * Each step points at an element via its `data-tour="..."` attribute. Two modes:
 *
 *   - 'read'  : a normal explanation. We dim the screen, spotlight the element,
 *               and the user reads and presses Enter / "Next" to continue.
 *   - 'await' : a "do this to continue" step. We highlight the element WITHOUT
 *               dimming (so the user can actually interact), and automatically
 *               move on as soon as the `until` element appears on screen.
 *
 * IMPORTANT — order vs. the original request:
 * Some elements only exist after the user reaches a certain point, so the tour
 * is ordered so every element is on screen by the time its step runs:
 *   • The Streak bar, the "Alerts" button, the Week panel and the "My Journey"
 *     sidebar item only render AFTER the first plan is approved.
 * So the "open sidebar / streak / alerts" explanations come right after the
 * plan is locked, instead of on the very first screen. Everything else follows
 * the requested sequence.
 */

export type TourMode = 'read' | 'await';
export type TourPlacement = 'auto' | 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
    /** Stable id (used for analytics / debugging only). */
    id: string;
    /** `data-tour` key of the element to spotlight. */
    target: string;
    mode: TourMode;
    /** For 'await' steps: advance as soon as this `data-tour` element appears. */
    until?: string;
    /** Make sure the sidebar is expanded before showing this step. */
    requireSidebarOpen?: boolean;
    /** Preferred side for the tooltip card; 'auto' picks the side with most room. */
    placement?: TourPlacement;
    title: string;
    body: string;
}

export const TOUR_STEPS: TourStep[] = [
    {
        id: 'chat-input',
        target: 'chat-input',
        mode: 'read',
        title: "Tell Feelivate what's on your mind",
        body:
            "This is where you start. Type a goal, a habit, or anything you want to work on this week. " +
            "Feelivate will ask you 1–3 quick questions, then build a plan made just for you. " +
            "(If it ever replies without a plan, just type “Make a plan” and it will create one.)",
    },
    {
        id: 'mic-button',
        target: 'mic-button',
        mode: 'read',
        placement: 'top',
        title: 'Or just talk',
        body: "Prefer speaking? Tap the mic and say it out loud — Feelivate turns your voice into text for you.",
    },
    {
        id: 'create-plan',
        target: 'chat-input',
        mode: 'await',
        until: 'lets-go',
        title: 'Now create your first plan',
        body: "Go ahead — tell Feelivate your goal and answer its questions. Your plan will appear here in a moment.",
    },
    {
        id: 'plan-review',
        target: 'plan-actions',
        mode: 'read',
        placement: 'top',
        title: 'Review your plan',
        body:
            "Here's your plan. Tap “Tweak” to change anything — just tell Feelivate what you'd like different. " +
            "Tap “Let's go” when you're happy with it. Note: once it's locked, the plan can't be changed, so review it first.",
    },
    {
        id: 'lock-plan',
        target: 'lets-go',
        mode: 'await',
        until: 'week-panel',
        placement: 'top',
        title: 'Lock it in',
        body: "When you're ready, tap “Let's go” to lock this week's plan.",
    },
    {
        id: 'week-panel',
        target: 'week-panel',
        mode: 'read',
        placement: 'left',
        title: 'Your week is saved here',
        body: "Your plan is now locked for the week. Tap this “Week” button any time to see the plan you approved.",
    },
    {
        id: 'alerts-button',
        target: 'alerts-button',
        mode: 'read',
        placement: 'bottom',
        title: 'Daily reminders',
        body: "Turn on Alerts to get a daily email of that day's tasks, so nothing slips through.",
    },
    {
        id: 'sidebar-logo',
        target: 'logo-toggle',
        mode: 'read',
        requireSidebarOpen: true,
        placement: 'right',
        title: 'Your sidebar',
        body: "Tap the Feelivate logo any time to open or close your sidebar. Everything lives here.",
    },
    {
        id: 'streak',
        target: 'streak',
        mode: 'read',
        requireSidebarOpen: true,
        placement: 'right',
        title: 'Build your streak',
        body:
            "Show up and check in every day to keep your streak growing — a daily voice entry counts too. " +
            "“Best” is the longest streak you've ever reached. Try to beat it, and show it off to your friends!",
    },
    {
        id: 'journey-nav',
        target: 'journey-nav',
        mode: 'await',
        until: 'journey-mic',
        requireSidebarOpen: true,
        placement: 'right',
        title: 'Open My Journey',
        body: "This is your private space to record each day. Tap “My Journey” to open it.",
    },
    {
        id: 'journey-mic',
        target: 'journey-mic',
        mode: 'read',
        placement: 'bottom',
        title: 'Record your day',
        body:
            "Tap the mic and talk about your day — your tasks, your wins, how it felt. This is your space, so be open. " +
            "The more you share, the better your weekly report.",
    },
    {
        id: 'archive-tab',
        target: 'archive-tab',
        mode: 'read',
        placement: 'bottom',
        title: 'Look back any time',
        body: "The Archive keeps every week's report in one place, so you can revisit your progress whenever you want.",
    },
    {
        id: 'emotion-orb',
        target: 'emotion-orb',
        mode: 'read',
        placement: 'auto',
        title: "Today's mood",
        body: "Each day, Feelivate reads the feeling in your entry and lights up this orb. This is how today felt.",
    },
];
