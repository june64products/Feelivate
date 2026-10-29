package com.june64.feelivate.ui.tour

import com.june64.feelivate.data.ChatMessage
import com.june64.feelivate.data.EmotionEntry
import com.june64.feelivate.data.Plan
import com.june64.feelivate.data.PlanDay
import com.june64.feelivate.data.ReportData
import com.june64.feelivate.data.ReportDay
import com.june64.feelivate.data.Streak
import com.june64.feelivate.data.WeekSummary
import com.june64.feelivate.data.WeekBadge
import com.june64.feelivate.data.ArchivedReport

/**
 * demoScript.ts — the self-playing walkthrough, declared as scenes.
 *
 * Each step is a SCENE: a complete description of the app state at that point.
 * Because every step declares the FULL state, the controller can jump to any
 * step — forward or backward — just by applying that scene. Nothing here calls
 * the backend; the canned data below means the real account is never touched.
 */

/** Where the spotlight sits. `center` dims the whole screen instead. */
object TourTarget {
    const val CHAT_INPUT = "chat-input"
    const val MIC_BUTTON = "mic-button"
    const val PLAN_ACTIONS = "plan-actions"
    const val LETS_GO = "lets-go"
    const val TWEAK = "tweak"
    const val WEEK_PILL = "week-pill"
    const val WEEK_PANEL = "week-panel"
    const val WEEK_DRAWER = "week-drawer"
    const val ALERTS_BUTTON = "alerts-button"
    const val TODAY_CARD = "today-card"
    const val DONE_BUTTON = "done-button"
    const val GOAL_PILL = "goal-pill"
    const val STREAK = "streak"
    const val JOURNEY_NAV = "journey-nav"
    const val JOURNEY_MIC = "journey-mic"
    const val MOOD_MIC = "mood-mic"
    const val ARCHIVE_TAB = "archive-tab"
    const val REPORTS_BUTTON = "reports-button"
    const val MENTOR_CHIP = "mentor-chip"
    const val EMOTION_ORB = "emotion-orb"
    const val PROFILE_MENU = "profile-menu"
    const val FINISH_GOAL = "finish-goal"
    const val FINISHED_CARD = "finished-card"
    const val REVIEW_VIEW = "review-view"
    const val CENTER = "center"
}

/** A full snapshot of the demo state for a step. Applying it is idempotent. */
data class TourScene(
    val messages: List<ChatMessage> = emptyList(),
    /** Type the last message out when entering this step going forward. */
    val typeLast: Boolean = false,
    val planApproved: Boolean = false,
    /** "chat" or "journey" */
    val view: String = "chat",
    val emotion: Boolean = false,
    val selectedWeek: Int? = null,
    val journeyTab: String = "overview",
    /** Journey shows the between-weeks state: journal locked + mood-only mic. */
    val betweenWeeks: Boolean = false,
    /** The goal pill's menu is held open (to point at "Finish this goal"). */
    val goalMenuOpen: Boolean = false,
    /** The workspace shows the finished-goal card instead of the plan. */
    val finished: Boolean = false,
    /** Archive tab: this week's report is open (to point at the View button). */
    val archiveWeek: Int? = null,
)

data class TourStep(
    val id: String,
    val target: String,
    val title: String,
    val body: String,
    val scene: TourScene = TourScene(),
    /** Force the card to the top or bottom edge, overriding the auto side. */
    val pin: String? = null,
)

/* ── Canned data the tour renders ── */

val DEMO_PLAN = Plan(
    weekNumber = 1,
    weekLabel = "Foundation Week",
    theme = "Build the running habit",
    winCondition = "Move your body 5 days this week — consistency over intensity.",
    days = listOf(
        PlanDay("Monday", "Easy 20-minute walk + 5 minutes of light jogging."),
        PlanDay("Tuesday", "Rest or gentle stretching. Recovery counts."),
        PlanDay("Wednesday", "Run/walk intervals: 1 min jog, 2 min walk × 6."),
        PlanDay("Thursday", "20-minute brisk walk. Notice how your body feels."),
        PlanDay("Friday", "Run/walk intervals: 2 min jog, 2 min walk × 5."),
        PlanDay("Saturday", "Your longest effort yet — 25 minutes, any pace."),
        PlanDay("Sunday", "Reflect on the week and rest. You earned it."),
    ),
)

val DEMO_STREAK = Streak(currentStreak = 5, longestStreak = 9, totalDone = 23, shieldsLeft = 1)

val DEMO_EMOTION = EmotionEntry(date = "", emotionLabel = "motivated", emotionScore = 8f, oneLiner = "You sounded energized and focused today.")

/** Two example past-week reports for the Archive tab. */
val DEMO_ARCHIVE = listOf(
    ArchivedReport(
        weekNumber = 1, weekStart = "2026-06-01", weekEnd = "2026-06-07",
        report = ReportData(
            avgScore = 7f, consistencyScore = 86, daysDone = 6, daysMissed = 1,
            pastDaysCount = 7, entryCount = 6, weekNumber = 1,
            weekTheme = "Build the running habit", dominantEmotion = "motivated",
            momentumScore = 78, momentumLabel = "Strong Week",
            weekBadge = WeekBadge("Steady Climber", "Six evenings logged, and the pace went up each time."),
            bestQuote = "The 25 minutes felt like 10. I think I like this now.",
            weekSummary = WeekSummary(
                wins = "Five runs in six days, each one a little longer than the last.",
                dips = "Thursday slipped — a late meeting ate the evening.",
                pattern = "Mornings beat evenings every time you tried both.",
            ),
            hiddenInsight = "Your mood on run days was two points higher than on rest days — the run is doing more than fitness.",
            nextWeekFocus = "Move the Thursday run to the morning, before meetings can touch it.",
            nextWeekPlanContext = "- keep mornings\n- one long run on Saturday\n- rest Sunday",
            bestDays = listOf("Sat", "Wed"), worstDays = listOf("Thu"), moodTrend = "steady climb, one dip",
            days = listOf(
                ReportDay("2026-06-01", "Jun 01 (Mon)", "Easy 20-minute walk + 5 minutes of light jogging.", "motivated", 7, "Legs felt fresh. Easy start.", "done", true, "Strong start", "Keep the 7am slot."),
                ReportDay("2026-06-02", "Jun 02 (Tue)", "Rest or gentle stretching.", "calm", 6, "Stretched on the balcony.", "done", true, "", ""),
                ReportDay("2026-06-03", "Jun 03 (Wed)", "Run/walk intervals: 1 min jog, 2 min walk × 6.", "focused", 8, "Intervals clicked today.", "done", true, "Best session yet", "Repeat the same warm-up."),
                ReportDay("2026-06-04", "Jun 04 (Thu)", "20-minute brisk walk.", null, null, null, "missed", false, "Late meeting", "Move it to the morning."),
                ReportDay("2026-06-05", "Jun 05 (Fri)", "Run/walk intervals: 2 min jog, 2 min walk × 5.", "motivated", 7, "Back on it. Not as hard as I feared.", "done", true, "", ""),
                ReportDay("2026-06-06", "Jun 06 (Sat)", "Your longest effort yet — 25 minutes, any pace.", "excited", 8, "The 25 minutes felt like 10.", "done", true, "Longest run", "Note what you ate before — it worked."),
                ReportDay("2026-06-07", "Jun 07 (Sun)", "Reflect on the week and rest.", "calm", 7, "Proud of this week.", "done", true, "", ""),
            ),
        ),
    ),
    ArchivedReport(
        weekNumber = 2, weekStart = "2026-06-08", weekEnd = "2026-06-14",
        report = ReportData(
            avgScore = 6f, consistencyScore = 71, daysDone = 5, daysMissed = 2,
            pastDaysCount = 7, entryCount = 5, weekNumber = 2,
            weekTheme = "Increase your distance", dominantEmotion = "focused",
        ),
    ),
)

/** The scripted conversation reused across scenes. */
private val CHAT = listOf(
    ChatMessage("user", "I want to get fit and run a 5K in a month."),
    ChatMessage("assistant", "Love that goal — let's build up safely so it sticks. Here's your Week 1 plan, made just for you:", plan = DEMO_PLAN),
)

val TOUR_STEPS = listOf(
    TourStep("welcome", TourTarget.CHAT_INPUT, "Welcome to Feelivate", "Quick hands-free tour of your new home base. Use Next / Back to move around, and Skip anytime."),
    TourStep("voice", TourTarget.MIC_BUTTON, "Type or just talk", "Everything starts with one question: what do you want to change? Type it — or tap the mic and say it out loud."),
    TourStep("first-plan", TourTarget.CHAT_INPUT, "Your mentor gets to work", "Watch — I'll send a goal. Your mentor opens up right here and turns it into a personalized week plan in seconds.", TourScene(messages = CHAT, typeLast = true)),
    TourStep("week-numbering", TourTarget.PLAN_ACTIONS, "This is your week plan", "Day by day, built around your goal, each task in your own words. First plan only: start it Thu–Sun and that short stretch is Week 0; start Mon–Wed and it's Week 1.", TourScene(messages = CHAT)),
    TourStep("tweak", TourTarget.TWEAK, "Want changes? Just ask", "Not quite right? Tap “Tweak” and tell your mentor what to change — more rest, an easier start, anything. It rebuilds the plan for you.", TourScene(messages = CHAT)),
    TourStep("lock-plan", TourTarget.LETS_GO, "Commit to the week", "Happy with it? Tap “Let's go” and confirm — the week locks until Sunday, no softening it mid-week. That commitment is what makes it work.", TourScene(messages = CHAT)),
    TourStep("today-home", TourTarget.TODAY_CARD, "Committed — this is home now", "Every day you land here: ONE task, front and center, in your own plan's words. No scrolling, no thinking — just today.", TourScene(messages = CHAT, planApproved = true), pin = "bottom"),
    TourStep("done-tap", TourTarget.DONE_BUTTON, "One tap when it's done", "Did the thing? Tap Done — your streak grows, the path lights up, and tomorrow's task is queued. Skipping honestly counts too.", TourScene(messages = CHAT, planApproved = true), pin = "bottom"),
    TourStep("streak", TourTarget.STREAK, "Your streak & shields", "The flame is your streak; the shield protects it automatically when a day slips — you start with one, and every 7-day run earns another. Tap it anytime for the full picture.", TourScene(messages = CHAT, planApproved = true)),
    TourStep("goal-pill", TourTarget.GOAL_PILL, "Your goals live here", "This pill is your goal switcher. Tap it to jump between goals, start a brand-new one, or finish the current goal when you're done with it.", TourScene(messages = CHAT, planApproved = true)),
    TourStep("finish-goal", TourTarget.FINISH_GOAL, "Stopping a goal", "Reached it — or just done with it? Open the goal pill and tap “Finish this goal”. One confirm and the whole session closes for good. (Watch — I'll show you what that looks like next.)", TourScene(messages = CHAT, planApproved = true, goalMenuOpen = true)),
    TourStep("finished-view", TourTarget.FINISHED_CARD, "A finished goal looks like this", "No new weeks, no new reports, no task emails for it. Your mentor still talks, every week you recorded stays in the archive, and a fresh start is simply a new goal.", TourScene(messages = CHAT, finished = true), pin = "bottom"),
    TourStep("path", TourTarget.WEEK_PANEL, "Your week as a path", "Done days glow, shielded days show the shield, today pulses, and the gift at the end is your week report. Watch it fill up as you show up.", TourScene(messages = CHAT, planApproved = true), pin = "top"),
    TourStep("week-button", TourTarget.WEEK_PILL, "Your locked weeks live here", "Each committed week is saved as a button (W1, W2…). Let me open W1 so you can see the full plan inside…", TourScene(messages = CHAT, planApproved = true)),
    TourStep("week-inside", TourTarget.WEEK_DRAWER, "What's inside W1", "The complete locked week — every day, every task. This is the commitment you made, kept visible.", TourScene(messages = CHAT, planApproved = true, selectedWeek = 1)),
    TourStep("voice-tile", TourTarget.JOURNEY_NAV, "Your evening ritual", "60 seconds before bed: how did today actually go? Your mentor reads the mood behind your words and shapes next week around it.", TourScene(messages = CHAT, planApproved = true), pin = "top"),
    TourStep("mentor-chip", TourTarget.MENTOR_CHIP, "Stuck? Ask your mentor", "Not sure how to do today's task? Tap here and your mentor opens right on top of this screen — talk it out, get unstuck, then get back to it.", TourScene(messages = CHAT, planApproved = true), pin = "top"),
    TourStep("alerts", TourTarget.ALERTS_BUTTON, "Daily reminders", "Turn on Alerts to get that day's task emailed to you every morning — with a one-tap Done button right in the email.", TourScene(messages = CHAT, planApproved = true)),
    TourStep("reports", TourTarget.REPORTS_BUTTON, "Your weekly reports", "Every finished week gets an honest report. Tap Reports to open the archive of all your past weeks — one tap, any time.", TourScene(messages = CHAT, planApproved = true)),
    TourStep("journey-mic", TourTarget.JOURNEY_MIC, "Record your day by voice", "During an active week, tap this mic and just talk — 60 honest seconds. Feelivate reads the mood behind your words and turns the week's entries into one honest report.", TourScene(messages = CHAT, planApproved = true, view = "journey")),
    TourStep("mood-mic", TourTarget.MOOD_MIC, "Between weeks: a mood-only mic", "When no week is running (an old week ended, the next isn't committed yet), the journal mic locks — it needs an active week. This mood-only mic takes over: it just captures how you feel, joining no report and no streak. Your journal unlocks the moment your next week starts.", TourScene(messages = CHAT, planApproved = true, view = "journey", betweenWeeks = true)),
    TourStep("archive", TourTarget.ARCHIVE_TAB, "Overview vs Archive", "Your CURRENT week's AI review builds in “Overview”. Once a week ends, its report moves to “Archive” — here are 2 example weekly reports.", TourScene(messages = CHAT, planApproved = true, view = "journey", journeyTab = "archive")),
    TourStep("review-view", TourTarget.REVIEW_VIEW, "Dashboard, or swipe", "A report opens as a dashboard: everything on one screen — your numbers, how the week felt, what your mentor saw, next week, and each day. Prefer one thing at a time? Tap the View button to switch to swipeable cards; tap it again to come back.", TourScene(messages = CHAT, planApproved = true, view = "journey", journeyTab = "archive", archiveWeek = 1)),
    TourStep("orb", TourTarget.EMOTION_ORB, "Your mood orb", "After your daily entry, this orb lights up with today's mood. You can DRAG it anywhere on screen, and TAP it to jump straight into your Journey.", TourScene(messages = CHAT, planApproved = true, emotion = true)),
    TourStep("replay", TourTarget.PROFILE_MENU, "Replay this tour anytime", "Want to see this again later? Tap your profile avatar here → “Replay tutorial”. It's always one tap away.", TourScene(messages = CHAT, planApproved = true, emotion = true)),
    TourStep("finish", TourTarget.CENTER, "You're all set! 🎉", "Say your goal, commit to a week, show up daily — and let the streak, shields, and reports carry you. What will you change first?", TourScene(messages = CHAT, planApproved = true, emotion = true)),
)
