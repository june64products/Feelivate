@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.Plan
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.ui.components.HSpace
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.ModalCard
import com.june64.feelivate.ui.components.ModalOverlay
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.georgia
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.delay

/** lib/useExpandableDay.ts */
const val CLAMP_CHARS = 110

/** A plan left unlocked longer than this is worth a second look before it starts. */
private const val STALE_AFTER_DAYS = 7

/**
 * CommitStage.tsx + PlanCard.tsx — the draft week, center stage. The dialogs
 * (commit / stale plan) are hoisted to the caller's root Box so they overlay
 * the whole screen exactly as the web's fixed-position ones do.
 */
@Composable
fun CommitStage(plan: Plan, isFirstPlan: Boolean, onApprove: (String) -> Unit, onRequestChange: (String) -> Unit, onOpenMentor: () -> Unit, onDialog: (PlanDialog?) -> Unit) {
    val t = tokens()
    Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 60.dp).mountRise(26f, 1f, 600)) {
        Column(Modifier.fillMaxWidth().padding(bottom = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("WEEK ${plan.weekNumber} · READY TO COMMIT", style = satoshi(11f, 700, ls = 0.14f), color = t.accentPrimary, modifier = Modifier.padding(bottom = 8.dp).mountRise(0f, 1f, 300, 150))
            Text("Your week, built for you", style = clash(24f, 700, ls = -0.02f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.mountRise(8f, 1f, 500, 200))
            Text(
                buildAnnotatedString {
                    append("Read it. Tweak it. Then commit — no renegotiation mid-week. ")
                    withStyle(SpanStyle(color = t.accentPrimary, textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline)) { append("Ask about it") }
                },
                style = satoshi(13f, 500, lineHeight = 1.55f), color = t.textSecondary, textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp).tap(onClick = onOpenMentor).mountRise(0f, 1f, 300, 300),
            )
        }
        PlanCard(plan, isFirstPlan, onApprove, onRequestChange, onDialog)
    }
}

sealed interface PlanDialog {
    data class Commit(val windowLine: String, val onConfirm: () -> Unit) : PlanDialog
    data class Stale(val plan: Plan, val planAge: Int, val windowLine: String, val onRebuild: () -> Unit, val onStartToday: () -> Unit) : PlanDialog
}

@Composable
fun PlanCard(plan: Plan, isFirstPlan: Boolean, onApprove: (String) -> Unit, onRequestChange: (String) -> Unit, onDialog: (PlanDialog?) -> Unit) {
    val t = tokens()
    var openDay by remember { mutableIntStateOf(-1) }
    var approveAnimation by remember { mutableStateOf(false) }

    val today = WeekWindow.today()
    val defaultWindow = WeekWindow.projectedWeekWindow(today, isFirstPlan)
    val planAge = plan.generatedDate?.let { WeekWindow.daysBetween(it, today) } ?: 0
    val isStale = planAge >= STALE_AFTER_DAYS
    val chosenStart = plan.startDate?.takeIf { it >= today }
    var startDate by remember(plan) { mutableStateOf(chosenStart ?: WeekWindow.rollWeekendStart(defaultWindow.start)) }
    val window = WeekWindow.windowFrom(startDate)
    val lead = WeekWindow.daysBetween(today, startDate)

    val windowLine = if (lead > 0)
        "This week starts ${WeekWindow.formatDay(window.start)} (${if (lead == 1) "tomorrow" else "in $lead days"}) and runs to ${WeekWindow.formatDay(window.end)} — ${window.dayCount} days. Nothing is due before then; the journal opens on ${WeekWindow.formatDay(window.start)}."
    else "This week runs ${WeekWindow.formatDay(window.start)} → ${WeekWindow.formatDay(window.end)} — ${window.dayCount} days. Days before today won't appear in your journal."

    val doApprove = {
        approveAnimation = true
    }
    LaunchedEffect(approveAnimation) { if (approveAnimation) { delay(600); onApprove(startDate) } }

    val shape = RoundedCornerShape(16.dp)
    Box(Modifier.fillMaxWidth().padding(vertical = 16.dp)) {
        Column(
            Modifier.fillMaxWidth().planSlideIn()
                .shadow(12.dp, shape, ambientColor = t.shadowColor.copy(alpha = 0.04f), spotColor = t.shadowColor.copy(alpha = 0.06f))
                .clip(shape).background(t.cardBg).border(1.dp, t.modalBorder, shape),
        ) {
            // Header
            Column(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 20.dp, bottom = 16.dp)) {
                Text("WEEK ${plan.weekNumber}", style = satoshi(10f, 700, ls = 0.12f), color = t.textMuted, modifier = Modifier.padding(bottom = 6.dp))
                Text(plan.theme, style = clash(22f, 700, lineHeight = 1.1f, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
                plan.winCondition?.takeIf { it.isNotBlank() }?.let { Text("Win: $it", style = georgia(13f, 1.4f), color = t.textSecondary) }
            }
            Hairline()
            // Days
            Column(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
                plan.days.forEachIndexed { idx, day ->
                    val action = day.action
                    val isLong = action.length > CLAMP_CHARS
                    val isOpen = openDay == idx
                    val rowShape = if (isOpen) RoundedCornerShape(12.dp) else RoundedCornerShape(0.dp)
                    Column(
                        Modifier.fillMaxWidth().padding(if (isOpen) 6.dp else 0.dp).animateContentSize(motionSpring(380f, 32f))
                            .then(if (isOpen) Modifier.shadow(16.dp, rowShape, ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f)) else Modifier)
                            .clip(rowShape)
                            .background(if (isOpen) t.bgSurface else if (idx % 2 == 1) t.glassSurface else Color.Transparent)
                            .tap(isLong) { openDay = if (isOpen) -1 else idx }
                            .padding(horizontal = if (isOpen) 22.dp else 20.dp, vertical = if (isOpen) 18.dp else 16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(day.day.uppercase(), style = clash(12f, 700, ls = 0.04f), color = if (isOpen) t.accentWarm else t.textPrimary)
                        Text(
                            action, style = satoshi(if (isOpen) 14f else 13f, 400, lineHeight = if (isOpen) 1.75f else 1.6f),
                            color = if (isOpen) t.textPrimary else t.textSecondary,
                            maxLines = if (isOpen || !isLong) Int.MAX_VALUE else 2, overflow = TextOverflow.Ellipsis,
                        )
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            if (isLong) Text(if (isOpen) "SHOW LESS" else "SEE MORE", style = satoshi(10f, 700, ls = 0.08f), color = t.accentWarm)
                            if (!WeekWindow.isRestAction(action) && action.length >= 8) {
                                Row(
                                    Modifier.clip(CircleShape).border(1.dp, t.borderSubtle, CircleShape).tap { HowToBus.request(HowToTarget(day.day, action)) }.padding(horizontal = 9.dp, vertical = 5.dp),
                                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
                                ) {
                                    Lucide(R.drawable.lu_circle_help, 11.dp, t.textSecondary)
                                    Text("HOW DO I DO THIS?", style = satoshi(10f, 700, ls = 0.06f), color = t.textSecondary)
                                }
                            }
                        }
                    }
                    if (idx < plan.days.size - 1 && !isOpen) Hairline()
                }
            }
            // Start date
            Hairline()
            if (chosenStart != null) {
                Box(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 14.dp, bottom = 4.dp)) {
                    Text(
                        buildAnnotatedString {
                            withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold)) { append(if (lead > 0) "Starts ${WeekWindow.formatDay(window.start)}" else "Starts today") }
                            append(" and runs to ${WeekWindow.formatDay(window.end)} — ${window.dayCount} day${if (window.dayCount == 1) "" else "s"}, a task on each.")
                        },
                        style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary,
                    )
                }
            } else {
                StartDatePicker(isFirstPlan, null, startDate) { startDate = it }
            }
            // Actions
            Hairline()
            Column(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 12.dp, bottom = 20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                PillButton(
                    if (lead > 0) "Lock it — start ${WeekWindow.formatDay(startDate).substringBefore(',')}" else "Let's go",
                    Modifier.fillMaxWidth(), size = 12f, verticalPadding = 12.dp,
                    leading = { Lucide(R.drawable.lu_arrow_right, 14.dp, t.btnPrimaryText) },
                ) { onDialog(if (isStale) PlanDialog.Stale(plan, planAge, windowLine, { onDialog(null); onRequestChange("it was built $planAge days ago and is out of date — please rebuild Week ${plan.weekNumber} from scratch for ${window.dayCount} days starting ${window.start}, based on where I am now.") }, { onDialog(null); doApprove() }) else PlanDialog.Commit(windowLine) { onDialog(null); doApprove() }) }
                PillButton("Tweak", Modifier.fillMaxWidth(), filled = false, size = 12f, verticalPadding = 12.dp, borderColor = t.accentPrimary) { onRequestChange("I want to change something in this plan") }
            }
        }
        AnimatedVisibility(approveAnimation, enter = fadeIn(), exit = fadeOut()) {
            Box(Modifier.matchParentSize().clip(shape).background(t.glassHover), contentAlignment = Alignment.Center) {
                var s by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) { s = true }
                val sc by animateFloatAsState(if (s) 1f else 0f, tween(500), label = "sc")
                Lucide(R.drawable.lu_check, 48.dp, t.textPrimary, Modifier.graphicsLayer { scaleX = sc; scaleY = sc })
            }
        }
    }
}

/** `.plan-slide-in` — 0.5s --ease-spring, from y 24 scale .97. */
@Composable
private fun Modifier.planSlideIn(): Modifier {
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val a by animateFloatAsState(if (shown) 1f else 0f, tween(500, easing = com.june64.feelivate.ui.theme.EaseSpringCss), label = "a")
    val y by animateFloatAsState(if (shown) 0f else 24f, tween(500, easing = com.june64.feelivate.ui.theme.EaseSpringCss), label = "y")
    val s by animateFloatAsState(if (shown) 1f else 0.97f, tween(500, easing = com.june64.feelivate.ui.theme.EaseSpringCss), label = "s")
    return graphicsLayer { alpha = a; translationY = y * density; scaleX = s; scaleY = s }
}

/** StartDatePicker.tsx — today / tomorrow / next Monday / pick a date. */
@Composable
fun StartDatePicker(isFirstPlan: Boolean, earliest: String?, value: String, onChange: (String) -> Unit) {
    val t = tokens()
    val today = WeekWindow.today()
    val base = if (earliest != null && earliest > today) earliest else today
    val defaultWindow = remember(today, base, isFirstPlan) {
        if (isFirstPlan) WeekWindow.projectedWeekWindow(today, true)
        else WeekWindow.windowFrom(WeekWindow.rollWeekendStart(base))
    }
    val tomorrow = WeekWindow.rollWeekendStart(WeekWindow.addDays(base, 1))
    val monday = WeekWindow.nextMonday(base)
    val maxDate = WeekWindow.addDays(today, WeekWindow.MAX_START_LEAD_DAYS)
    var customOpen by remember { mutableStateOf(false) }
    val window = WeekWindow.windowFrom(value)
    val lead = WeekWindow.daysBetween(today, value)

    val firstLabel = if (defaultWindow.start == today) "Today" else if (base > today && defaultWindow.start == base) WeekWindow.formatDay(defaultWindow.start) else "Next ${WeekWindow.formatDay(defaultWindow.start).substringBefore(',')}"
    val firstSub = if (defaultWindow.start == today) "start right now" else if (base > today && defaultWindow.start == base) "the earliest day" else "the default"
    data class Opt(val key: String, val label: String, val sub: String, val iso: String)
    val options = listOf(
        Opt("today", firstLabel, firstSub, defaultWindow.start),
        Opt("tomorrow", if (base == today) "Tomorrow" else "The day after", if (tomorrow == WeekWindow.addDays(base, 1)) WeekWindow.formatDay(tomorrow) else "weekend → ${WeekWindow.formatDay(tomorrow)}", tomorrow),
        Opt("monday", "Next Monday", WeekWindow.formatDay(monday), monday),
    )
    val seen = HashSet<String>()
    val distinct = options.filter { seen.add(it.iso) }
    val choice = when (value) { defaultWindow.start -> "today"; tomorrow -> "tomorrow"; monday -> "monday"; else -> "custom" }

    Column(Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, top = 14.dp, bottom = 4.dp)) {
        Row(Modifier.padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            Lucide(R.drawable.lu_calendar_days, 13.dp, t.textSecondary)
            Text("WHEN DO YOU WANT TO START?", style = satoshi(10.5f, 700, ls = 0.12f), color = t.textSecondary)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            distinct.forEach { o ->
                val active = choice == o.key && !customOpen
                StartPill(o.label, o.sub, active) { customOpen = false; onChange(o.iso) }
            }
            StartPill("Pick a date", if (choice == "custom") WeekWindow.formatDay(value) else "within ${WeekWindow.MAX_START_LEAD_DAYS} days", choice == "custom" || customOpen) { customOpen = true }
        }
        if (customOpen) {
            Column(Modifier.padding(top = 10.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    var d = base
                    while (d <= maxDate) {
                        val iso = d
                        val rolled = WeekWindow.rollWeekendStart(iso)
                        StartPill(WeekWindow.formatDay(iso).substringAfter(", "), WeekWindow.formatDay(iso).substringBefore(','), value == rolled && choice == "custom") { onChange(rolled) }
                        d = WeekWindow.addDays(d, 1)
                    }
                }
                Text(
                    if (base > today) "From ${WeekWindow.formatDay(base)} (when the current week ends) up to ${WeekWindow.formatDay(maxDate)}. Weekend dates move to the next Monday."
                    else "Up to ${WeekWindow.formatDay(maxDate)}. Weekend dates move to the next Monday.",
                    style = satoshi(11.5f, 500, lineHeight = 1.5f), color = t.textMuted, modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
        Text(
            buildAnnotatedString {
                if (lead > 0) {
                    withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold)) { append("Week starts ${WeekWindow.formatDay(window.start)}") }
                    append(" (${if (lead == 1) "tomorrow" else "in $lead days"}) and runs to ${WeekWindow.formatDay(window.end)} — ${window.dayCount} day${if (window.dayCount == 1) "" else "s"}.")
                    append(" Nothing is due before then; you'll get a short note each of the last ${minOf(lead, 3)} day${if (minOf(lead, 3) == 1) "" else "s"} to get ready.")
                } else {
                    withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold)) { append("Starts today") }
                    append(" and runs to ${WeekWindow.formatDay(window.end)} — ${window.dayCount} day${if (window.dayCount == 1) "" else "s"}. Your first task is today's.")
                }
            },
            style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp),
        )
    }
}

@Composable
private fun StartPill(label: String, sub: String, active: Boolean, onClick: () -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier.widthIn(min = 120.dp).clip(shape).background(if (active) t.accentPrimary else Color.Transparent).border(1.dp, if (active) t.accentPrimary else t.borderMedium, shape)
            .tap(onClick = onClick).padding(horizontal = 13.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, style = satoshi(13f, 700), color = if (active) t.btnPrimaryText else t.textPrimary, maxLines = 1)
        Text(sub, style = satoshi(11f, 500), color = (if (active) t.btnPrimaryText else t.textPrimary).copy(alpha = 0.75f), maxLines = 1)
    }
}

/** ConfirmDialog.tsx */
@Composable
fun BoxScope.ConfirmDialog(visible: Boolean, title: String, message: String, confirmLabel: String, cancelLabel: String, danger: Boolean = false, onConfirm: () -> Unit, onCancel: () -> Unit) {
    val t = tokens()
    ModalOverlay(visible, onCancel, stiffness = 300f, damping = 24f, fromScale = 0.92f) {
        ModalCard(maxWidth = 400.dp, radius = 20.dp, padding = PaddingValues(26.dp), background = t.bgSurface, scroll = false) {
            Column {
                Text(title, style = clash(17f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
                Text(message, style = satoshi(13f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(bottom = 22.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                    PillButton(cancelLabel, filled = false, size = 12f, ls = 0.04f, horizontalPadding = 18.dp, verticalPadding = 9.dp, foreground = t.textSecondary, onClick = onCancel)
                    PillButton(confirmLabel, size = 12f, ls = 0.04f, horizontalPadding = 18.dp, verticalPadding = 9.dp, background = if (danger) com.june64.feelivate.ui.theme.Status.Error else null, foreground = if (danger) Color.White else null, onClick = onConfirm)
                }
            }
        }
    }
}

/** The stale-plan dialog: rebuild, or start it today anyway. */
@Composable
fun BoxScope.StalePlanDialog(d: PlanDialog.Stale, onCancel: () -> Unit) {
    val t = tokens()
    ModalOverlay(true, onCancel, stiffness = 300f, damping = 24f, fromScale = 0.92f) {
        ModalCard(maxWidth = 430.dp, radius = 20.dp, padding = PaddingValues(26.dp), background = t.bgSurface) {
            Column {
                Box(Modifier.size(38.dp).clip(RoundedCornerShape(11.dp)).background(t.accentWarm.copy(alpha = 0.10f)), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_alert_triangle, 17.dp, t.accentWarm) }
                Text("This plan is ${d.planAge} days old", style = clash(17f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
                Text("You built Week ${d.plan.weekNumber} on ${d.plan.generatedDate?.let { WeekWindow.formatDay(it) } ?: ""} and haven't locked it yet. A week starts the day you lock it, so this one would begin now, not back then.", style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 10.dp))
                Text(d.windowLine, style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 22.dp))
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("Not yet", Modifier.fillMaxWidth(), filled = false, size = 12f, ls = 0.04f, verticalPadding = 9.dp, foreground = t.textSecondary, onClick = onCancel)
                    PillButton("Build a fresh plan", Modifier.fillMaxWidth(), filled = false, size = 12f, ls = 0.04f, verticalPadding = 9.dp, borderColor = t.accentPrimary, onClick = d.onRebuild)
                    PillButton("Start it today", Modifier.fillMaxWidth(), size = 12f, ls = 0.04f, verticalPadding = 9.dp, onClick = d.onStartToday)
                }
            }
        }
    }
}

/** CeremonyOverlay — the 2.2s seal after approval. */
@Composable
fun BoxScope.CeremonyOverlay(show: Boolean, weekNumber: Int) {
    val t = tokens()
    AnimatedVisibility(show, modifier = Modifier.matchParentSize(), enter = fadeIn(), exit = fadeOut()) {
        Column(Modifier.fillMaxSize().background(t.modalOverlay), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            var s by remember { mutableStateOf(false) }
            LaunchedEffect(Unit) { s = true }
            val sc by animateFloatAsState(if (s) 1f else 0f, tween(700, easing = EaseSilk), label = "sc")
            val rot by animateFloatAsState(if (s) 0f else -20f, tween(700, easing = EaseSilk), label = "rot")
            Box(
                Modifier.size(88.dp).graphicsLayer { scaleX = sc; scaleY = sc; rotationZ = rot }
                    .shadow(30.dp, CircleShape, ambientColor = com.june64.feelivate.ui.theme.Status.FlameTo.copy(alpha = 0.4f), spotColor = com.june64.feelivate.ui.theme.Status.FlameTo.copy(alpha = 0.4f))
                    .clip(CircleShape).background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(com.june64.feelivate.ui.theme.Status.FlameFrom, com.june64.feelivate.ui.theme.Status.FlameTo))),
                contentAlignment = Alignment.Center,
            ) { Lucide(R.drawable.lu_check_3, 44.dp, Color.White) }
            Text("Week $weekNumber is set.", style = clash(26f, 700, ls = -0.02f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 18.dp).mountRise(14f, 1f, 500, 350))
            Row(Modifier.padding(top = 18.dp).mountRise(0f, 1f, 300, 550), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Lucide(R.drawable.lu_flame, 14.dp, com.june64.feelivate.ui.theme.Status.FlameTo)
                Text("Commitment made — that's the hard part done.", style = satoshi(14f, 500), color = t.textSecondary)
            }
        }
    }
}

/** The web dispatches a window event from the plan card; this is the same bus. */
object HowToBus {
    var handler: ((HowToTarget) -> Unit)? = null
    fun request(t: HowToTarget) { handler?.invoke(t) }
}
