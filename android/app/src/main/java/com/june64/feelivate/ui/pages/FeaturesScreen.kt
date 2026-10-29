package com.june64.feelivate.ui.pages

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

private data class Feature(val title: String, val desc: String, val benefits: List<String>)
private data class Group(val act: String, val title: String, val blurb: String, val features: List<Feature>)

private val GROUPS = listOf(
    Group(
        "Step 01", "Plan it", "Turn a fuzzy ambition into a concrete, non-negotiable week.",
        listOf(
            Feature(
                "Turn Your Goal Into a 7-Day Action Plan",
                "Tell Feelivate what you want to accomplish in plain language, and it turns that goal into a specific seven-day plan with clear daily actions, timing, and priorities. Your plan is built around your goal, schedule, and current starting point, so you know exactly what to do next instead of relying on vague intentions.",
                listOf(
                    "Clear daily actions: Know what to do, when to do it, and how to start.",
                    "Built around your reality: Plans account for your goal, schedule, and current starting point.",
                    "No blank templates: Get a structured action plan through a real conversation with your AI mentor.",
                ),
            ),
            Feature(
                "Customize Your Plan Before You Commit",
                "Adjust the intensity, schedule, and daily focus through a conversation with Feelivate before your seven-day plan is locked. Your AI accountability coach adapts the plan to your actual time, priorities, and starting point, so the actions are realistic enough to follow.",
                listOf(
                    "Refine through conversation: Adjust your plan without rigid forms or fixed templates.",
                    "Match your reality: Set the difficulty and pace around your available time and current ability.",
                    "Commit with confidence: Review and shape the plan before making it your week.",
                ),
            ),
            Feature(
                "Lock In Your Plan and Follow Through",
                "Once you approve your seven-day plan, Feelivate locks it in. The actions you agreed to become your commitment for the week, giving you less room to quietly reduce the goal when motivation drops or the work gets difficult.",
                listOf(
                    "No changing the goal midweek: Stay accountable to the plan you approved.",
                    "Turn intention into commitment: Move from deciding what to do to actually doing it.",
                    "Stay accountable when motivation drops: Keep the original commitment in view when excuses start to appear.",
                ),
            ),
        ),
    ),
    Group(
        "Step 02", "Execute daily", "Show up every day without relying on motivation.",
        listOf(
            Feature(
                "Get Your Daily Task Without Opening an App",
                "Feelivate sends your assigned task directly to your inbox at the time you choose. Each email tells you what to do that day and how to approach it, so you can act immediately instead of reopening a goal tracker and deciding what comes next.",
                listOf(
                    "Know today's action: Get one clear task tied to your weekly goal.",
                    "Fits your routine: Receive the email at your chosen time and in your timezone.",
                    "Actionable guidance: Get practical tips with the task, not just another reminder.",
                ),
            ),
            Feature(
                "Break Big Goals Into Daily Micro-Actions",
                "Feelivate breaks a larger goal into small, actionable steps that are easier to start and complete each day. Each action connects to the next, helping you build consistency through completed work rather than endless planning.",
                listOf(
                    "Easy to start: Get a focused action that feels manageable enough to begin.",
                    "Builds day by day: Each task follows the previous one to keep your goal moving forward.",
                    "Create momentum through action: Consistent completion turns daily effort into lasting progress.",
                ),
            ),
            Feature(
                "Track Daily Progress With Streaks and Check-Ins",
                "Feelivate makes daily accountability simple: mark your task complete, keep your streak visible, and see whether you are following through on the plan you committed to. Quick check-ins keep progress easy to record without turning accountability into another chore.",
                listOf(
                    "Keep your streak visible: See your consistency build from one completed day to the next.",
                    "Check in quickly: Mark daily progress in seconds without unnecessary tracking.",
                    "Make consistency tangible: A visible streak gives you a clear reason to keep showing up.",
                ),
            ),
            Feature(
                "Sync Your Goals With Google Calendar",
                "Connect Google Calendar so your Feelivate plan fits directly into your existing schedule. Turn planned actions into scheduled commitments with reminders, making it easier to protect time for the work instead of leaving it for an undefined \"someday.\"",
                listOf(
                    "Plan around your schedule: Put goal-related actions where your day already happens.",
                    "Keep commitments visible: Calendar reminders help keep planned work from slipping.",
                    "Schedule action, not intention: Give each task a place in your day so follow-through does not depend entirely on willpower.",
                ),
            ),
        ),
    ),
    Group(
        "Step 03", "Reflect & adapt", "An honest feedback loop that makes every week smarter.",
        listOf(
            Feature(
                "Use Voice Check-Ins With Your AI Accountability Partner",
                "Had a difficult day or missed a task? Send a voice memo instead of typing it out. Feelivate transcribes your check-in and helps identify why you slipped, giving your AI accountability partner useful context to guide the next step instead of simply marking the day as missed.",
                listOf(
                    "Speak instead of type: Explain what happened naturally through a quick voice check-in.",
                    "Capture the reason: Go beyond task completion and identify what affected your follow-through.",
                    "Turn setbacks into feedback: Use each check-in to make your next actions more realistic and focused.",
                ),
            ),
            Feature(
                "Adapt Your Routine With Emotion-Aware Tracking",
                "Feelivate lets you record how you feel each day and uses that context when shaping your next actions. Your AI routine coach can account for your current state, helping you maintain a sustainable pace instead of following the same rigid routine regardless of how you're doing.",
                listOf(
                    "Track more than task completion: Record how you feel alongside your daily progress.",
                    "Adapt to your real state: Adjust the pace when you're depleted and maintain momentum when you're ready.",
                    "Identify useful patterns: See what tends to support or disrupt your consistency over time.",
                ),
            ),
            Feature(
                "See What You Actually Accomplished Each Week",
                "Feelivate turns your weekly activity into a clear progress report, showing what you committed to versus what you actually completed. For your weekly productivity goals, this creates an honest feedback loop that helps your AI accountability partner adjust the next plan based on real follow-through, not assumptions.",
                listOf(
                    "See commitment vs. completion: Get a clear view of what you planned and what you actually did.",
                    "Track progress over time: Identify patterns in your consistency and see where your effort is moving.",
                    "Build on real performance: Use each weekly report to make the next set of actions more focused and challenging.",
                ),
            ),
            Feature(
                "Your AI Accountability Partner Remembers Your Progress",
                "Feelivate carries your wins, patterns, setbacks, and past actions from one week into the next. That ongoing context gives your AI accountability partner a clearer picture of how you work toward your goals, so guidance becomes increasingly relevant instead of resetting with every session.",
                listOf(
                    "Keep your history connected: Your progress and patterns carry forward across weeks.",
                    "Get guidance with context: Future plans can account for previous actions and setbacks.",
                    "Stop repeating yourself: Your goal journey stays connected without re-explaining your history each session.",
                ),
            ),
        ),
    ),
)

private val FEATURE_FAQS = listOf(
    "What is an AI accountability coach?" to "An AI accountability coach helps turn a goal into specific actions and keeps you accountable for completing them. Feelivate creates a seven-day action plan, sends daily tasks, tracks your progress, and uses weekly feedback to guide your next steps.",
    "How does Feelivate help you stay accountable to your goals?" to "Feelivate turns your goal into a locked seven-day plan with specific daily actions. Daily task emails, quick check-ins, streak tracking, and weekly reports keep your commitment visible and show the difference between what you planned and what you actually completed.",
    "How is Feelivate different from a goal or habit tracking app?" to "A traditional tracker mainly records goals, habits, or completed tasks. Feelivate focuses on follow-through by creating the action plan for you, delivering the next task, tracking completion, and using your progress to shape future guidance.",
    "Can Feelivate create a personalized action plan from a goal?" to "Yes. You describe what you want to accomplish in plain language, and Feelivate creates a structured seven-day action plan around your goal, schedule, and starting point. You can refine the plan before approving and locking it in.",
    "How does Feelivate adapt when I miss a task or have a difficult day?" to "Feelivate uses check-ins, voice reflections, emotional context, and weekly reports to understand what affected your progress. This feedback helps make future actions more realistic instead of treating a missed task as simple failure.",
    "Does Feelivate track progress over multiple weeks?" to "Yes. Feelivate maintains multi-week context around your goals, including progress, patterns, wins, and setbacks. This gives your AI accountability partner a longer-term view of your behavior instead of starting each session without previous context.",
    "Can Feelivate fit goal-related tasks into my existing schedule?" to "Yes. Feelivate can connect with Google Calendar so planned actions can become scheduled commitments in your existing calendar. Daily tasks can also be delivered by email at your selected time and timezone.",
    "Do I have to use every feature?" to "No. Start with a goal and a weekly plan — voice journaling, calendar sync, and the rest are there when you want them.",
    "Can I change my plan after it locks?" to "You can't quietly make a locked week easier, but you can talk to your mentor to shape future weeks. The lock protects your commitment; it doesn't trap you.",
    "How do the daily task emails work?" to "Each morning you get a personalized email with that day's exact task and how-to tips, at the time and timezone you choose. Change the time or pause anytime.",
    "Is my voice and emotion data private?" to "Yes. Journals and emotion logs are used only to personalize your plans, and sensitive fields are redacted from our logs by default.",
)

@Composable
fun FeaturesScreen(onBack: () -> Unit, onStart: () -> Unit) {
    val t = tokens()
    SitePage(
        "Features", onBack, "Features",
        AnnotatedString("AI Accountability Coach for Goal Follow-Through"),
        "Feelivate turns your goals into a structured seven-day action plan, then keeps you accountable through daily tasks and progress reviews. Unlike a basic goal tracker, it connects what you want to achieve with the actions you need to take next, helping you stay consistent and make measurable progress.",
    ) {
        var n = 0
        GROUPS.forEach { group ->
            PageSection {
                Text(group.act.uppercase(), style = satoshi(11f, 700, ls = 0.15f), color = t.accentWarm)
                Text(group.title, style = clash(28f, 700, lineHeight = 1.08f, ls = -0.04f), color = t.textPrimary, modifier = Modifier.padding(top = 12.dp, bottom = 10.dp))
                Text(group.blurb, style = satoshi(15f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 28.dp))
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    group.features.forEach { f ->
                        n += 1
                        SiteCard {
                            Text(n.toString().padStart(2, '0'), style = satoshi(13f, 700, ls = 0.06f), color = t.textMuted, modifier = Modifier.padding(bottom = 8.dp))
                            Text(f.title, style = clash(19f, 700, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(bottom = 10.dp))
                            Text(f.desc, style = satoshi(14.5f, 500, lineHeight = 1.7f), color = t.textSecondary, modifier = Modifier.padding(bottom = 18.dp))
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { f.benefits.forEach { CheckLine(it) } }
                        }
                    }
                }
            }
        }
        PageSection(top = 48, bottom = 48) {
            Text("Feature FAQ", style = clash(26f, 700, ls = -0.04f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 28.dp))
            FaqList(FEATURE_FAQS)
        }
        ClosingCta(AnnotatedString("See it work on your goal"), "Free for founding members. Your first plan is one conversation away.", "Start Free", onStart)
    }
}
