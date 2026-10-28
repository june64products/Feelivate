@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.Plan
import com.june64.feelivate.data.Streak
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.ui.components.HSpace
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** framer `initial → animate` on mount: opacity + y + scale. */
@Composable
fun Modifier.mountRise(fromY: Float, fromScale: Float = 1f, durationMs: Int = 550, delayMs: Int = 0): Modifier {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val a by animateFloatAsState(if (shown) 1f else 0f, tween(durationMs, delayMs, EaseSilk), label = "a")
    val y by animateFloatAsState(if (shown) 0f else fromY, tween(durationMs, delayMs, EaseSilk), label = "y")
    val s by animateFloatAsState(if (shown) 1f else fromScale, tween(durationMs, delayMs, EaseSilk), label = "s")
    return graphicsLayer { alpha = a; translationY = y * density; scaleX = s; scaleY = s }
}

/** The standard mission card: `--card-bg`, `--border-subtle`, shadow-sm. */
@Composable
fun MissionCard(modifier: Modifier = Modifier, radius: androidx.compose.ui.unit.Dp = 22.dp, padding: androidx.compose.foundation.layout.PaddingValues, borderColor: Color? = null, content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(radius)
    Column(
        modifier.fillMaxWidth().shadow(2.dp, shape, ambientColor = t.shadowColor.copy(alpha = 0.04f), spotColor = t.shadowColor.copy(alpha = 0.06f))
            .clip(shape).background(t.cardBg).border(1.dp, borderColor ?: t.borderSubtle, shape).padding(padding),
        content = content,
    )
}

/** TodayCard.tsx (phone: radius 18, padding 18). */
@Composable
fun TodayCard(plan: Plan?, todayIso: String, todayStatus: String, checkinLoading: Boolean, justCelebrated: Boolean, onCheckin: (String) -> Unit, onAskMentor: () -> Unit, onHowTo: (HowToTarget) -> Unit) {
    val t = tokens()
    val haptics = LocalHapticFeedback.current
    val entry = WeekWindow.planEntryFor(plan, todayIso)
    val weekNum = plan?.weekNumber ?: 1
    val dateLabel = LocalDate.parse(todayIso).format(DateTimeFormatter.ofPattern("EEEE, MMM d", Locale.US))
    val isDone = todayStatus == "done"
    val isSkipped = todayStatus == "skipped"
    Box(Modifier.mountRise(24f, 0.98f, 600)) {
        MissionCard(radius = 18.dp, padding = androidx.compose.foundation.layout.PaddingValues(18.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("TODAY · WEEK $weekNum", style = satoshi(11f, 700, ls = 0.12f), color = t.accentPrimary)
                Box(Modifier.weight(1f))
                Lucide(R.drawable.lu_clock, 13.dp, t.textMuted); HSpace(5.dp)
                Text(dateLabel, style = satoshi(12f, 500), color = t.textMuted)
            }
            if (entry != null) {
                Text(entry.action, style = clash(16f, 600, lineHeight = 1.55f, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(bottom = 16.dp).mountRise(10f, 1f, 500, 120))
                if (todayStatus == "pending") {
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Row(
                            Modifier.alpha(if (checkinLoading) 0.6f else 1f).pressScale(0.96f).shadow(9.dp, CircleShape, ambientColor = Color(0x59FF5A36), spotColor = Color(0x59FF5A36)).clip(CircleShape)
                                .background(Brush.linearGradient(listOf(Status.FlameFrom, Status.FlameTo)))
                                .tap(!checkinLoading) { haptics.performHapticFeedback(HapticFeedbackType.LongPress); onCheckin("done") }
                                .padding(horizontal = 28.dp, vertical = 13.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Lucide(R.drawable.lu_check, 15.dp, Color.White)
                            Text("DONE FOR TODAY", style = satoshi(13f, 700, ls = 0.05f), color = Color.White)
                        }
                        Box(Modifier.weight(1f))
                        Row(
                            Modifier.clip(CircleShape).background(t.bgSurface).border(1.dp, t.borderSubtle, CircleShape).tap { onHowTo(HowToTarget(entry.day, entry.action)) }.padding(horizontal = 16.dp, vertical = 11.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Lucide(R.drawable.lu_message_circle, 13.dp, t.textSecondary)
                            Text("How do I do this?", style = satoshi(12f, 600), color = t.textSecondary, maxLines = 1)
                        }
                    }
                } else {
                    val shape = RoundedCornerShape(14.dp)
                    Row(
                        Modifier.fillMaxWidth().clip(shape).background(if (isDone) Status.Amber.copy(alpha = 0.1f) else t.bgSurface).border(1.dp, if (isDone) Status.Amber.copy(alpha = 0.25f) else t.borderSubtle, shape).padding(horizontal = 18.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Lucide(R.drawable.lu_check, 15.dp, if (isDone) Status.Amber else t.textMuted)
                        Text(if (isDone) "Completed — the chain grows." else if (isSkipped) "Logged as skipped. Tomorrow is the day that matters." else "Logged.", style = satoshi(13f, 700), color = if (isDone) Status.Amber else t.textMuted)
                    }
                }
            } else {
                Text("Nothing scheduled for today in this week's plan. Rest is part of the work.", style = satoshi(15f, 500, lineHeight = 1.7f), color = t.textSecondary)
            }
        }
        CelebrationBurst(justCelebrated)
    }
}

/** PathRow.tsx — the week as a path. */
@Composable
fun PathRow(streak: Streak?, todayIso: String, currentWeek: Int, winCondition: String?, onOpenJourney: () -> Unit) {
    val t = tokens()
    val days = streak?.daysThisWeek?.takeIf { it.isNotEmpty() } ?: run {
        val d = LocalDate.parse(todayIso); val mon = d.minusDays(((d.dayOfWeek.value + 6) % 7).toLong())
        (0 until 7).map { com.june64.feelivate.data.DayStatus(mon.plusDays(it.toLong()).toString(), "pending") }
    }
    fun kindOf(d: com.june64.feelivate.data.DayStatus): String = when {
        d.date == todayIso && d.status != "done" && d.status != "skipped" -> "today"
        d.status == "done" -> "done"
        d.status == "shielded" -> "shielded"
        d.status == "skipped" || (d.date < todayIso && d.status == "pending") -> "skipped"
        else -> "upcoming"
    }
    Box(Modifier.mountRise(16f, 1f, 550, 100)) {
        MissionCard(radius = 18.dp, padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 16.dp)) {
            Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("YOUR PATH · WEEK $currentWeek", style = satoshi(11f, 700, ls = 0.1f), color = t.textMuted)
                Box(Modifier.weight(1f))
                if (!winCondition.isNullOrBlank()) Text("Win: $winCondition", style = satoshi(12f, 500), color = t.textSecondary, maxLines = 2, modifier = Modifier.widthIn(max = 180.dp), textAlign = TextAlign.End)
            }
            Row(Modifier.horizontalScroll(rememberScrollState()).padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                days.forEachIndexed { i, d ->
                    val kind = kindOf(d)
                    if (i > 0) Box(Modifier.width(22.dp).height(2.dp).background(if (kind == "upcoming") t.borderSubtle else t.borderMedium))
                    var shown by remember { mutableStateOf(false) }
                    LaunchedEffect(Unit) { delay(150L + i * 50L); shown = true }
                    val sc by animateFloatAsState(if (shown) 1f else 0.6f, motionSpring(300f, 22f), label = "sc")
                    val inf = rememberInfiniteTransition(label = "today")
                    val pulse by inf.animateFloat(1f, 1.06f, infiniteRepeatable(tween(1000), RepeatMode.Reverse), label = "p")
                    Box(Modifier.graphicsLayer { scaleX = sc; scaleY = sc; alpha = if (shown) 1f else 0f }) { PathNode(kind, d.date, if (kind == "today") pulse else 1f) }
                }
                Box(Modifier.width(22.dp).height(2.dp).background(t.borderSubtle))
                Box(
                    Modifier.pressScale(0.95f).size(42.dp).clip(RoundedCornerShape(13.dp)).background(t.bgSurface).border(1.dp, t.borderMedium, RoundedCornerShape(13.dp)).tap(onClick = onOpenJourney),
                    contentAlignment = Alignment.Center,
                ) { Lucide(R.drawable.lu_gift, 17.dp, t.textSecondary) }
                Box(Modifier.width(22.dp).height(2.dp).background(t.borderSubtle))
                Box(Modifier.size(38.dp).dashedCircle(t.borderSubtle, 1.5f), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_lock, 13.dp, t.textMuted) }
            }
        }
    }
}

private fun Modifier.dashedCircle(color: Color, widthDp: Float): Modifier = drawBehind {
    drawCircle(color, radius = size.minDimension / 2 - widthDp.dp.toPx() / 2, style = Stroke(widthDp.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))))
}

@Composable
private fun PathNode(kind: String, date: String, pulse: Float) {
    val t = tokens()
    val letter = WeekWindow.dayLetter(date)
    when (kind) {
        "done" -> Box(Modifier.size(38.dp).clip(CircleShape).background(Status.Amber.copy(alpha = 0.15f)).border(1.5.dp, Status.Amber, CircleShape), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_check_3, 17.dp, Status.Amber) }
        "shielded" -> Box(Modifier.size(38.dp).clip(CircleShape).background(Status.ShieldBlue.copy(alpha = 0.12f)).border(1.5.dp, Status.ShieldBlue, CircleShape), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_shield, 15.dp, Status.ShieldBlue) }
        "skipped" -> Box(Modifier.size(38.dp).dashedCircle(t.borderMedium, 1.5f), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_minus, 14.dp, t.textMuted) }
        "today" -> Box(Modifier.size(46.dp).graphicsLayer { scaleX = pulse; scaleY = pulse }.border(5.dp, t.glassHover, CircleShape).padding(5.dp).clip(CircleShape).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { Text(letter, style = satoshi(13f, 700), color = t.btnPrimaryText) }
        else -> Box(Modifier.size(38.dp).clip(CircleShape).background(t.cardBg).border(1.dp, t.borderSubtle, CircleShape), contentAlignment = Alignment.Center) { Text(letter, style = satoshi(12f, 700), color = t.textMuted) }
    }
}

/** The two entry tiles under the path: "Evening voice note" and "Ask your mentor". */
@Composable
fun EntryTiles(micLocked: Boolean, hasEmotion: Boolean, onJournal: () -> Unit, onMentor: () -> Unit) {
    val t = tokens()
    val logged = micLocked || hasEmotion
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        EntryTile(onJournal, "Evening voice note", if (logged) "Logged for today" else "How did today actually go? 60 seconds.", leading = {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_mic, 19.dp, t.btnPrimaryText) }
        }, accent = {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.padding(end = 2.dp)) {
                listOf(10, 17, 12, 20, 9).forEachIndexed { i, h ->
                    val inf = rememberInfiniteTransition(label = "wave")
                    val hh by inf.animateFloat(h * 0.5f, h.toFloat(), infiniteRepeatable(tween(600, i * 130, androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse), label = "h")
                    Box(Modifier.width(3.dp).height((if (logged) h * 0.6f else hh).dp).clip(CircleShape).background(if (logged) t.borderMedium else t.accentPrimary))
                }
            }
        })
        EntryTile(onMentor, "Ask your mentor", "Stuck on today's task? Talk it out.", leading = {
            Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(t.glassHover).border(1.dp, t.borderMedium, RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_message_circle, 19.dp, t.accentPrimary) }
        })
    }
}

@Composable
private fun EntryTile(onClick: () -> Unit, title: String, sub: String, leading: @Composable () -> Unit, accent: (@Composable () -> Unit)? = null) {
    val t = tokens()
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier.fillMaxWidth().pressScale(0.98f).shadow(2.dp, shape, ambientColor = t.shadowColor.copy(alpha = 0.04f), spotColor = t.shadowColor.copy(alpha = 0.06f))
            .clip(shape).background(t.cardBg).border(1.dp, t.borderSubtle, shape).tap(onClick = onClick).padding(horizontal = 18.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        leading()
        Column(Modifier.weight(1f)) {
            Text(title, style = satoshi(13.5f, 700), color = t.textPrimary)
            Text(sub, style = satoshi(11.5f, 500), color = t.textMuted, modifier = Modifier.padding(top = 2.dp))
        }
        accent?.invoke()
        Lucide(R.drawable.lu_chevron_right, 15.dp, t.textMuted)
    }
}

/** "Week N · locked — Starts in N days." */
@Composable
fun NotStartedCard(plan: Plan?, planStartsOn: String, daysUntilStart: Int, onSeeWeek: () -> Unit, onAskMentor: () -> Unit) {
    val t = tokens()
    Box(Modifier.mountRise(22f, 0.98f, 550)) {
        MissionCard(padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 28.dp, vertical = 30.dp)) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("WEEK ${plan?.weekNumber ?: 1} · LOCKED", style = satoshi(11f, 700, ls = 0.13f), color = t.accentPrimary, modifier = Modifier.padding(bottom = 10.dp))
                Text(if (daysUntilStart == 1) "Starts tomorrow." else "Starts in $daysUntilStart days.", style = clash(22f, 600, ls = -0.01f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 8.dp))
                Text(
                    "Your first task lands on ${WeekWindow.formatLong(planStartsOn)}. Nothing is due before then — use the runway to get set: the time slot, the gear, the headspace." + if (daysUntilStart <= 3) " A short note arrives each day until then." else "",
                    style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 440.dp).padding(bottom = 18.dp),
                )
                plan?.days?.firstOrNull()?.let { first ->
                    Column(Modifier.fillMaxWidth().widthIn(max = 520.dp).clip(RoundedCornerShape(14.dp)).background(t.bgSurface).border(1.dp, t.borderSubtle, RoundedCornerShape(14.dp)).padding(horizontal = 16.dp, vertical = 14.dp).padding(bottom = 0.dp)) {
                        Text("DAY 1 · ${first.day}".uppercase(), style = satoshi(10.5f, 700, ls = 0.12f), color = t.textSecondary, modifier = Modifier.padding(bottom = 4.dp))
                        Text(first.action, style = satoshi(14f, 500, lineHeight = 1.55f), color = t.textPrimary)
                    }
                    androidx.compose.foundation.layout.Spacer(Modifier.height(18.dp))
                }
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("See the whole week", filled = false, uppercase = false, size = 12.5f, horizontalPadding = 26.dp, verticalPadding = 13.dp, press = 0.96f, onClick = onSeeWeek)
                    PillButton("Ask your mentor", size = 12.5f, ls = 0.05f, horizontalPadding = 22.dp, verticalPadding = 13.dp, press = 0.96f, onClick = onAskMentor)
                }
            }
        }
    }
}

/** "Week N wrapped — That's a wrap on Week N." */
@Composable
fun WeekOverCard(weekNumber: Int, onSeeReport: () -> Unit, onPlanNext: () -> Unit) {
    val t = tokens()
    Box(Modifier.mountRise(22f, 0.98f, 550)) {
        MissionCard(padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 28.dp, vertical = 30.dp)) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("WEEK $weekNumber WRAPPED", style = satoshi(11f, 700, ls = 0.13f), color = t.accentPrimary, modifier = Modifier.padding(bottom = 10.dp))
                Text("That's a wrap on Week $weekNumber.", style = clash(22f, 600, ls = -0.01f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 8.dp))
                Text("This week's window has closed — your honest report is waiting in the Journey. Read it, then commit the next week. Fresh start, same fire.", style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 440.dp).padding(bottom = 20.dp))
                FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("See your week report", size = 12.5f, ls = 0.05f, horizontalPadding = 26.dp, verticalPadding = 13.dp, press = 0.96f, onClick = onSeeReport)
                    PillButton("Plan Week ${weekNumber + 1}", filled = false, uppercase = false, size = 12.5f, horizontalPadding = 22.dp, verticalPadding = 13.dp, press = 0.96f, onClick = onPlanNext)
                }
            }
        }
    }
}

/** The finished-goal card. */
@Composable
fun FinishedStage(title: String, onTalk: () -> Unit, onArchive: () -> Unit, onNewGoal: () -> Unit) {
    val t = tokens()
    Box(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 26.dp, bottom = 60.dp).mountRise(8f, 1f, 400), contentAlignment = Alignment.TopCenter) {
        MissionCard(Modifier.widthIn(max = 560.dp), padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 24.dp, vertical = 26.dp)) {
            Row(Modifier.clip(CircleShape).background(t.accentGlow).padding(horizontal = 11.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Lucide(R.drawable.lu_check_circle, 13.dp, t.accentPrimary)
                Text("GOAL FINISHED", style = satoshi(11f, 700, ls = 0.08f), color = t.accentPrimary)
            }
            Text(title, style = clash(22f, 700, lineHeight = 1.2f, ls = -0.02f), color = t.textPrimary, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
            Text("No new weekly plans, reviews or task emails for this one. Your mentor is still here to talk, and every week you recorded is in the archive.", style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 20.dp))
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FinishedRow(R.drawable.lu_message_circle, "Talk to your mentor", "Questions, reflection, what's next — just no new plan here.", onTalk)
                FinishedRow(R.drawable.lu_book_open, "See your weeks and reports", "Everything you recorded, kept as it was.", onArchive)
                PillButton("Start a new goal", Modifier.fillMaxWidth().padding(top = 4.dp), uppercase = false, size = 13f, horizontalPadding = 16.dp, verticalPadding = 12.dp, onClick = onNewGoal)
            }
        }
    }
}

@Composable
private fun FinishedRow(@DrawableRes icon: Int, title: String, sub: String, onClick: () -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(14.dp)
    Row(Modifier.fillMaxWidth().clip(shape).background(t.bgSurface).border(1.dp, t.borderSubtle, shape).tap(onClick = onClick).padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Lucide(icon, 18.dp, t.accentPrimary)
        Column(Modifier.weight(1f)) {
            Text(title, style = satoshi(13.5f, 700), color = t.textPrimary)
            Text(sub, style = satoshi(11.5f, 500), color = t.textMuted, modifier = Modifier.padding(top = 2.dp))
        }
        Lucide(R.drawable.lu_chevron_right, 15.dp, t.textMuted)
    }
}

/** Discovery — the mentor is asking / building; the conversation lives in the drawer. */
@Composable
fun DiscoveryStage(onOpenMentor: () -> Unit) {
    val t = tokens()
    val inf = rememberInfiniteTransition(label = "disc")
    val s by inf.animateFloat(1f, 1.06f, infiniteRepeatable(tween(1200, easing = androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse), label = "s")
    val a by inf.animateFloat(0.85f, 1f, infiniteRepeatable(tween(1200, easing = androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse), label = "a")
    Column(Modifier.fillMaxWidth().padding(20.dp).padding(vertical = 120.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Box(Modifier.size(54.dp).graphicsLayer { scaleX = s; scaleY = s; alpha = a }.clip(RoundedCornerShape(16.dp)).background(t.accentPrimary), contentAlignment = Alignment.Center) { com.june64.feelivate.ui.components.LogoMark(32.dp, t.logoMarkOnChip) }
        Text("Your mentor is shaping the plan.", style = satoshi(15f, 500, lineHeight = 1.6f), color = t.textSecondary, textAlign = TextAlign.Center)
        PillButton("Open the conversation", filled = false, uppercase = false, size = 12.5f, background = t.cardBg, horizontalPadding = 20.dp, verticalPadding = 10.dp, onClick = onOpenMentor)
    }
}
