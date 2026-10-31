@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.june64.feelivate.R
import com.june64.feelivate.data.SetupQuestion
import com.june64.feelivate.data.TaskHowTo
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.ui.components.CloseButton
import com.june64.feelivate.ui.components.HSpace
import com.june64.feelivate.ui.components.LogoMark
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.ModalCard
import com.june64.feelivate.ui.components.ModalOverlay
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.VSpace
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.launch
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.offset
import androidx.compose.ui.unit.IntOffset
import kotlin.math.roundToInt
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import android.os.Build
import android.content.pm.PackageManager
import com.june64.feelivate.data.Push
import androidx.compose.ui.unit.Dp
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.bleed

/* ── small shared pieces ── */

@Composable
fun ModalKicker(text: String) = Text(text.uppercase(), style = satoshi(10f, 700, ls = 0.1f), color = tokens().textMuted)

/** The modals' input: radius 10, `--input-bg`, 1px border-medium, focus → border-focus. */
@Composable
fun ModalField(
    value: String, onValueChange: (String) -> Unit, placeholder: String,
    modifier: Modifier = Modifier, @DrawableRes icon: Int? = null, keyboardType: KeyboardType = KeyboardType.Text,
    textStyle: androidx.compose.ui.text.TextStyle = satoshi(14f, 500), radius: Int = 10, singleLine: Boolean = true,
    minHeight: Int = 42, textAlign: TextAlign = TextAlign.Start, enabled: Boolean = true,
) {
    val t = tokens()
    var focused by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(radius.dp)
    Box(
        modifier.fillMaxWidth().heightIn(min = minHeight.dp).clip(shape).background(t.bgInput).border(1.dp, if (focused) t.borderFocus else t.borderMedium, shape),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (icon != null) Lucide(icon, 14.dp, t.textPlaceholder, Modifier.padding(start = 12.dp))
        BasicTextField(
            value = value, onValueChange = onValueChange, enabled = enabled, singleLine = singleLine,
            textStyle = textStyle.copy(color = t.textPrimary, textAlign = textAlign),
            cursorBrush = SolidColor(t.textPrimary),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth().padding(start = if (icon != null) 36.dp else 12.dp, end = 12.dp, top = 11.dp, bottom = 11.dp).onFocusChanged { focused = it.isFocused },
            decorationBox = { inner ->
                Box(contentAlignment = if (textAlign == TextAlign.Center) Alignment.Center else Alignment.CenterStart) {
                    if (value.isEmpty()) Text(placeholder, style = textStyle.copy(textAlign = textAlign), color = t.textPlaceholder, modifier = Modifier.fillMaxWidth())
                    inner()
                }
            },
        )
    }
}

@Composable
private fun ModalHeader(@DrawableRes icon: Int, title: String, sub: String) {
    val t = tokens()
    Row(Modifier.fillMaxWidth().padding(bottom = 20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { Lucide(icon, 18.dp, t.btnPrimaryText) }
        Column(Modifier.weight(1f)) {
            Text(title, style = clash(15f, 700), color = t.textPrimary)
            Text(sub, style = satoshi(12f, 500), color = t.textMuted)
        }
    }
}

@Composable
private fun InfoStrip(text: String, success: Boolean) {
    val t = tokens()
    Row(
        Modifier.fillMaxWidth().padding(bottom = 14.dp).clip(RoundedCornerShape(8.dp))
            .background(if (success) t.glassHover else Status.Error.copy(alpha = 0.08f)).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Lucide(if (success) R.drawable.lu_check_circle else R.drawable.lu_alert_circle, 13.dp, if (success) t.textPrimary else Status.Error)
        Text(text, style = satoshi(12f, 500), color = if (success) t.textPrimary else Status.Error)
    }
}

/* ── Alerts: the day's notes, on this phone (email alerts live on the website) ── */

/** The five phone alerts — one switch each, the same five the emails send. */
private val PUSH_ROWS = listOf(
    Triple("morning", "Morning — today's one thing", "At your time, with last night's note answered."),
    Triple("evening", "Evening journal nudge", "20:30, only when the day isn't logged yet."),
    Triple("review", "Weekly review", "21:30, the evening a finished week's review is ready."),
    Triple("recovery", "After a missed day", "The morning after a slip — the day's task, no lecture."),
    Triple("countdown", "Week countdown", "The last days before a locked week begins."),
)

@Composable
private fun SectionLabel(text: String, top: Dp = 22.dp) {
    Text(text, style = clash(10f, 700, ls = 0.1f), color = tokens().textMuted, modifier = Modifier.padding(top = top, bottom = 8.dp))
}

/** A label, a line under it, the toggle on the right. The whole row is the tap target. */
@Composable
private fun SwitchRow(label: String, sub: String?, checked: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    val t = tokens()
    Row(
        Modifier.fillMaxWidth().alpha(if (enabled) 1f else 0.45f).tap(enabled) { onChange(!checked) }.padding(vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f).padding(end = 14.dp)) {
            Text(label, style = satoshi(13.5f, 600), color = t.textPrimary)
            if (sub != null) Text(sub, style = satoshi(11.5f, 500, lineHeight = 1.45f), color = t.textMuted, modifier = Modifier.padding(top = 2.dp))
        }
        Toggle(checked)
    }
}

@Composable
private fun Toggle(on: Boolean) {
    val t = tokens()
    val track by animateColorAsState(if (on) t.btnPrimaryBg else t.borderMedium, tween(180), label = "track")
    val x by animateFloatAsState(if (on) 1f else 0f, tween(180), label = "x")
    Box(Modifier.width(40.dp).height(22.dp).clip(CircleShape).background(track).padding(3.dp)) {
        Box(Modifier.offset { IntOffset((x * 18.dp.toPx()).roundToInt(), 0) }.size(16.dp).clip(CircleShape).background(Color.White))
    }
}

/** The modal's first screen: the phone's switches and the morning time. */
@Composable
private fun AlertsHome(vm: WorkspaceViewModel, onRequestPermission: () -> Unit) {
    val t = tokens()
    val ui = vm.ui
    val e = ui.email
    val p = ui.push
    val context = LocalContext.current
    val systemAllowed = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    ModalHeader(R.drawable.lu_bell, "Alerts", "The day's notes, on this phone.")

    SectionLabel("ON THIS PHONE", top = 4.dp)
    when {
        !Push.configured || (p.loaded && !p.configured) -> Text(
            "Phone alerts aren't switched on for this build yet.",
            style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary,
        )
        !systemAllowed -> Column {
            Text("Android is blocking Feelivate's notifications. Allow them to get the day's note on this phone.", style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(bottom = 12.dp))
            PillButton("Allow notifications", Modifier.fillMaxWidth(), size = 12f, verticalPadding = 12.dp, leading = { Lucide(R.drawable.lu_bell, 15.dp, t.btnPrimaryText) }, onClick = onRequestPermission)
        }
        else -> Column {
            val onCount = PUSH_ROWS.count { p.prefs[it.first] != false }
            SwitchRow("Phone notifications", if (p.enabled) "On — $onCount of ${PUSH_ROWS.size} alerts" else "Off — nothing is sent to this phone", p.enabled, !p.saving) { vm.setPushEnabled(it) }
            Hairline()
            PUSH_ROWS.forEach { (kind, label, sub) ->
                SwitchRow(label, sub, p.prefs[kind] != false, p.enabled && !p.saving) { vm.setPushPref(kind, it) }
            }
        }
    }
    if (p.error.isNotEmpty()) InfoStrip(p.error, false)

    // The morning time is one setting for both channels.
    Row(
        Modifier.fillMaxWidth().padding(top = 14.dp).clip(RoundedCornerShape(12.dp)).background(t.glassSurface).border(1.dp, t.borderSubtle, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text("MORNING NOTE AT", style = clash(10f, 700, ls = 0.1f), color = t.textMuted, modifier = Modifier.padding(bottom = 2.dp))
            Text(e.subscribedTime, style = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 20.sp, fontWeight = FontWeight.Bold), color = t.textPrimary)
            Text("${vm.timezone} · ${vm.tzShort}", style = satoshi(11f, 500), color = t.textMuted)
        }
        PillButton("Change", filled = false, size = 11f, ls = 0.04f, horizontalPadding = 14.dp, verticalPadding = 6.dp, foreground = t.textSecondary, onClick = vm::emailChangeTime)
    }

}

@Composable
fun BoxScope.AlertsModal(vm: WorkspaceViewModel, onRequestPermission: () -> Unit) {
    val t = tokens()
    val ui = vm.ui
    val e = ui.email
    ModalOverlay(ui.showEmailModal, vm::closeEmailModal, stiffness = 300f, damping = 20f, fromScale = 0.9f, fromY = 20.dp) {
        ModalCard(maxWidth = 400.dp, radius = 20.dp, padding = PaddingValues(28.dp), maxHeightFraction = 0.9f) {
            Column {
                when (e.step) {
                    EmailStep.Home -> AlertsHome(vm, onRequestPermission)
                    EmailStep.Time -> {
                        Text("← Alerts", style = satoshi(12f, 600), color = t.textMuted, modifier = Modifier.tap(onClick = vm::emailHome).padding(bottom = 14.dp))
                        ModalHeader(R.drawable.lu_clock, "Morning note — what time?", "When the day's one thing should arrive.")
                        Text(
                            buildAnnotatedString {
                                append("Every day at this time, you'll receive your ")
                                withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold)) { append("personalized task") }
                                append(" for the day — with an AI-written guide and a motivational thought made just for you.")
                            },
                            style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 20.dp),
                        )
                        Text("QUICK SELECT", style = clash(10f, 700, ls = 0.1f), color = t.textMuted, modifier = Modifier.padding(bottom = 10.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 16.dp)) {
                            listOf("06:00", "07:00", "08:00", "09:00", "20:00", "21:00").forEach { time ->
                                val active = e.preferredTime == time
                                Box(
                                    Modifier.clip(CircleShape).background(if (active) t.btnPrimaryBg else Color.Transparent).border(1.dp, if (active) t.accentPrimary else t.borderMedium, CircleShape)
                                        .tap { vm.setNotifTime(time) }.padding(horizontal = 14.dp, vertical = 6.dp),
                                ) { Text(time, style = satoshi(12f, 600), color = if (active) t.btnPrimaryText else t.textSecondary) }
                            }
                        }
                        Text("OR SET A CUSTOM TIME", style = clash(10f, 700, ls = 0.1f), color = t.textMuted, modifier = Modifier.padding(bottom = 6.dp))
                        ModalField(e.preferredTime, { v -> vm.setNotifTime(v.filter { it.isDigit() || it == ':' }.take(5)) }, "08:00", keyboardType = KeyboardType.Number, textAlign = TextAlign.Center, textStyle = satoshi(20f, 700), minHeight = 46)
                        Text("${vm.timezone} · ${vm.tzShort}", style = satoshi(11f, 500), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 20.dp))
                        if (e.error.isNotEmpty()) InfoStrip(e.error, false)
                        PillButton(if (e.loading) "Saving..." else "Save ${e.preferredTime} ${vm.tzShort}", Modifier.fillMaxWidth(), enabled = !e.loading, size = 12f, verticalPadding = 13.dp, leading = { if (e.loading) Spinner(15.dp, t.btnPrimaryText) else Lucide(R.drawable.lu_bell, 15.dp, t.btnPrimaryText) }, onClick = vm::saveTime)
                    }

                }
            }
            CloseButton(vm::closeEmailModal, Modifier.align(Alignment.TopEnd), radius = 8.dp, iconSize = 14.dp)
        }
    }
}

/* ── Calendar maintenance ── */
@Composable
fun BoxScope.CalendarMaintenanceModal(visible: Boolean, onClose: () -> Unit, onOpenAlerts: () -> Unit) {
    val t = tokens()
    ModalOverlay(visible, onClose, stiffness = 300f, damping = 24f) {
        ModalCard(maxWidth = 380.dp, radius = 20.dp, padding = PaddingValues(24.dp), scroll = false) {
            Column {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(t.glassSurface), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_clock, 18.dp, t.textSecondary) }
                Text("Calendar is under maintenance", style = clash(16f, 700), color = t.textPrimary, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
                Text("Calendar sync is temporarily unavailable. Use the app's daily alerts instead to get reminded each day — tap the Alerts button to set them up.", style = satoshi(13f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(bottom = 20.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.End)) {
                    PillButton("Got it", filled = false, size = 11f, ls = 0.04f, horizontalPadding = 16.dp, verticalPadding = 8.dp, foreground = t.textSecondary, onClick = onClose)
                    PillButton("Open Alerts", size = 11f, ls = 0.04f, horizontalPadding = 16.dp, verticalPadding = 8.dp, leading = { Lucide(R.drawable.lu_bell, 13.dp, t.btnPrimaryText) }) { onClose(); onOpenAlerts() }
                }
            }
        }
    }
}

/* ── "Upgrade" → already on the top plan ── */
@Composable
fun BoxScope.PlanInfoModal(visible: Boolean, onClose: () -> Unit) {
    val t = tokens()
    ModalOverlay(visible, onClose, stiffness = 300f, damping = 24f, fromY = 12.dp) {
        ModalCard(maxWidth = 420.dp, radius = 20.dp, padding = PaddingValues(26.dp)) {
            Column {
                Row(Modifier.padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(t.accentPrimary), contentAlignment = Alignment.Center) { LogoMark(22.dp, t.logoMarkOnChip) }
                    Box(Modifier.clip(CircleShape).border(1.dp, t.borderMedium, CircleShape).padding(horizontal = 10.dp, vertical = 4.dp)) {
                        Text("CURRENT PLAN · MAX", style = satoshi(10f, 700, ls = 0.08f), color = t.textSecondary)
                    }
                }
                Text("You're already on the highest plan", style = clash(17f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
                Text("There's nothing to upgrade to — every account is on Feelivate Max. Your coach runs on our highest-tier reasoning models, and no feature is locked behind a paywall. You're getting the best version of Feelivate we ship.", style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 18.dp))
                Column(verticalArrangement = Arrangement.spacedBy(9.dp), modifier = Modifier.padding(bottom = 22.dp)) {
                    listOf(
                        "Highest-tier AI reasoning — no throttled or cut-down model",
                        "Unlimited chats, plans and check-ins",
                        "Adaptive week plans that rebuild around your progress",
                        "Voice check-ins, weekly reviews and full journey history",
                        "Daily alerts, data export and account deletion — always included",
                    ).forEach {
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                            Lucide(R.drawable.lu_check_circle, 14.dp, t.accentWarm, Modifier.padding(top = 1.dp))
                            Text(it, style = satoshi(12.5f, 500, lineHeight = 1.5f), color = t.textSecondary)
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    PillButton("Got it", size = 11f, ls = 0.04f, horizontalPadding = 18.dp, verticalPadding = 9.dp, onClick = onClose)
                }
            }
        }
    }
}

/* ── Blocked by the guardrail ── */
@Composable
fun BoxScope.BlockedDialog(notice: com.june64.feelivate.data.BlockedNotice?, onClose: () -> Unit) {
    val t = tokens()
    ModalOverlay(notice != null, onClose, stiffness = 300f, damping = 24f, fromY = 12.dp) {
        ModalCard(maxWidth = 400.dp, radius = 20.dp, padding = PaddingValues(26.dp)) {
            Column {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(t.glassSurface), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_shield_alert, 18.dp, t.textSecondary) }
                Text(notice?.headline.orEmpty(), style = clash(16f, 700), color = t.textPrimary, modifier = Modifier.padding(top = 14.dp, bottom = 8.dp))
                Text(notice?.body.orEmpty(), style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 22.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    PillButton("Got it", size = 11f, ls = 0.04f, horizontalPadding = 18.dp, verticalPadding = 9.dp, onClick = onClose)
                }
            }
        }
    }
}

/* ── Week N: when do you start? ── */
@Composable
fun BoxScope.NextWeekStartModal(ask: NextWeekAsk?, onClose: () -> Unit, onConfirm: (String) -> Unit) {
    val t = tokens()
    if (ask == null) { ModalOverlay(false, onClose) {}; return }
    var startDate by remember(ask) { mutableStateOf(WeekWindow.rollWeekendStart(if (ask.earliest > WeekWindow.today()) ask.earliest else WeekWindow.today())) }
    ModalOverlay(true, onClose, stiffness = 300f, damping = 26f, fromScale = 0.94f, fromY = 18.dp) {
        ModalCard(maxWidth = 480.dp, radius = 20.dp, padding = PaddingValues(horizontal = 20.dp, vertical = 22.dp), background = t.bgSurface) {
            Column {
                Row(Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_calendar_days, 16.dp, t.btnPrimaryText) }
                    Text("Week ${ask.week}: when do you start?", style = clash(18f, 700, ls = -0.01f), color = t.textPrimary)
                }
                Text("Your mentor builds Week ${ask.week} for exactly these days, from the day you pick to its Sunday, with a task on each. Pick the day you'll actually be ready.", style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 6.dp))
                Box(Modifier.bleed(20.dp)) { StartDatePicker(false, ask.earliest, startDate) { startDate = it } }
                Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("Build Week ${ask.week}", Modifier.fillMaxWidth(), size = 13f, ls = 0.04f, verticalPadding = 13.dp, trailing = { Lucide(R.drawable.lu_arrow_right, 14.dp, t.btnPrimaryText) }) { onConfirm(startDate) }
                    Text("Not now", style = satoshi(12.5f, 500), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().tap(onClick = onClose).padding(vertical = 10.dp))
                }
            }
        }
    }
}

/* ── 30 seconds of setup ── */
@Composable
fun BoxScope.SetupQuestionsModal(questions: List<SetupQuestion>?, onSubmit: (String, String) -> Unit) {
    val t = tokens()
    if (questions == null) { ModalOverlay(false, null) {}; return }
    var answers by remember(questions) { mutableStateOf(questions.map { "" }) }
    var step by remember(questions) { mutableStateOf("answers") }
    var startDate by remember(questions) { mutableStateOf(WeekWindow.rollWeekendStart(WeekWindow.today())) }
    val essential = minOf(3, questions.size)
    val canContinue = (0 until essential).all { answers[it].isNotBlank() }

    ModalOverlay(true, null, stiffness = 300f, damping = 26f, fromScale = 0.94f, fromY = 18.dp) {
        ModalCard(maxWidth = 480.dp, radius = 20.dp, padding = PaddingValues(horizontal = 20.dp, vertical = 22.dp), background = t.bgSurface) {
            Column {
                if (step == "answers") {
                    Row(Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_clipboard_list, 16.dp, t.btnPrimaryText) }
                        Text("30 seconds of setup", style = clash(18f, 700, ls = -0.01f), color = t.textPrimary)
                    }
                    Text("Answer what you can — short and honest beats long and polished. One more tap after this and your plan builds.", style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 20.dp))
                    questions.forEachIndexed { i, q ->
                        Column(Modifier.padding(bottom = 16.dp)) {
                            Text(q.label, style = satoshi(13f, 700, lineHeight = 1.45f), color = t.textPrimary, modifier = Modifier.padding(bottom = 7.dp))
                            ModalField(answers[i], { v -> answers = answers.toMutableList().also { it[i] = v } }, q.placeholder.orEmpty(), radius = 12, minHeight = 64, singleLine = false, textStyle = satoshi(13.5f, 500, lineHeight = 1.55f))
                        }
                    }
                    Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        PillButton("Next: when do you start?", Modifier.fillMaxWidth(), enabled = canContinue, size = 13f, ls = 0.04f, verticalPadding = 13.dp, trailing = { Lucide(R.drawable.lu_arrow_right, 14.dp, t.btnPrimaryText) }) { step = "start" }
                        if (!canContinue) Text("Answer the first few so your plan actually fits you — no guessing.", style = satoshi(11.5f, 500), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                    }
                } else {
                    Row(Modifier.padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(10.dp)).background(t.cardBg).tap { step = "answers" }, contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_arrow_left, 15.dp, t.textPrimary) }
                        Text("When do you start?", style = clash(18f, 700, ls = -0.01f), color = t.textPrimary)
                    }
                    Text("Your week runs from that day to its Sunday, with a real task on every day of it. Pick the day you'll actually be ready — not the day you wish you were.", style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 6.dp))
                    Box(Modifier.bleed(20.dp)) { StartDatePicker(true, null, startDate) { startDate = it } }
                    PillButton("Build my plan", Modifier.fillMaxWidth().padding(top = 16.dp), size = 13f, ls = 0.04f, verticalPadding = 13.dp, trailing = { Lucide(R.drawable.lu_arrow_right, 14.dp, t.btnPrimaryText) }) {
                        val lines = questions.mapIndexed { i, q -> q to answers[i].trim() }.filter { it.second.isNotBlank() }.joinToString("\n\n") { "${it.first.label}\n→ ${it.second}" }
                        val startLine = if (startDate == WeekWindow.today()) "I start today." else "I start on ${WeekWindow.formatDay(startDate)} — build the week from that day through its Sunday."
                        onSubmit("Setup answers:\n\n$lines\n\n$startLine\n\nThat's everything — build my plan.", startDate)
                    }
                }
            }
        }
    }
}

/* ── Finish this goal? ── */
@Composable
fun BoxScope.SessionCompleteModal(visible: Boolean, sessionFocus: String, onClose: () -> Unit, onConfirmed: suspend () -> Boolean) {
    val scope = rememberCoroutineScope()
    var busy by remember(visible) { mutableStateOf(false) }
    var error by remember(visible) { mutableStateOf<String?>(null) }
    val ink = Color(0xFF111111)
    ModalOverlay(visible, if (busy) null else onClose, overlayColor = Color(0xB8000000), padding = PaddingValues(24.dp), stiffness = 300f, damping = 26f, fromScale = 0.97f, fromY = 24.dp) {
        ModalCard(maxWidth = 480.dp, radius = 20.dp, padding = PaddingValues(32.dp), background = ink, borderColor = Color(0x1AFFFFFF)) {
            Column {
                Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x1FD97757)).border(1.dp, Color(0x47D97757), RoundedCornerShape(14.dp)), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_flag, 22.dp, Color(0xFFD97757)) }
                Text("Finish this goal?", style = clash(20f, 700, ls = -0.02f), color = Color(0xFFF0F0F0), modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                Text(
                    buildAnnotatedString {
                        if (sessionFocus.isNotBlank()) { append("You're closing "); withStyle(SpanStyle(color = Color(0xFFE4E4E7))) { append("\"$sessionFocus\"") }; append(".") } else append("You are closing this goal.")
                    },
                    style = satoshi(13.5f, 500, lineHeight = 1.6f), color = Color(0xFFA1A1AA), modifier = Modifier.padding(bottom = 14.dp),
                )
                Column(Modifier.padding(start = 4.dp, bottom = 24.dp)) {
                    listOf(
                        "No more weekly plans, reviews or task emails for it.",
                        "Your mentor stays here to talk, any time.",
                        "Every week you recorded stays in the archive.",
                        "This can't be undone — a fresh start is a new goal.",
                    ).forEach { Text("•  $it", style = satoshi(13f, 500, lineHeight = 1.7f), color = Color(0xFF71717A)) }
                }
                error?.let {
                    Box(Modifier.fillMaxWidth().padding(bottom = 16.dp).clip(RoundedCornerShape(10.dp)).background(Color(0x14EF4444)).border(1.dp, Color(0x26EF4444), RoundedCornerShape(10.dp)).padding(12.dp)) {
                        Text(it, style = satoshi(12.5f, 500), color = Color(0xFFFCA5A5))
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(10.dp)).tap(!busy, onClose).padding(vertical = 11.dp), contentAlignment = Alignment.Center) {
                        Text("Keep going", style = satoshi(13.5f, 500), color = Color(0xFFA1A1AA))
                    }
                    Box(
                        Modifier.weight(1f).alpha(if (busy) 0.7f else 1f).clip(RoundedCornerShape(10.dp)).background(Color(0x1FD97757)).border(1.dp, Color(0x66D97757), RoundedCornerShape(10.dp))
                            .tap(!busy) { busy = true; scope.launch { if (!onConfirmed()) { busy = false; error = "Couldn't reach the server. Check your connection and try once more." } } }
                            .padding(vertical = 11.dp),
                        contentAlignment = Alignment.Center,
                    ) { Text(if (busy) "Finishing…" else "Yes, finish it", style = satoshi(13.5f, 600), color = Color(0xFFE8A07F)) }
                }
            }
        }
    }
}

/* ── How do I do this? (bottom sheet on a phone) ── */
@Composable
fun BoxScope.HowToModal(target: HowToTarget?, guide: TaskHowTo?, loading: Boolean, error: String?, onClose: () -> Unit, onAskMentor: (HowToTarget) -> Unit) {
    val t = tokens()
    ModalOverlay(
        target != null, onClose, overlayColor = Color(0x8C000000), alignment = Alignment.BottomCenter,
        padding = PaddingValues(0.dp), stiffness = 320f, damping = 26f, fromScale = 1f, fromY = 40.dp,
    ) {
        ModalCard(maxWidth = 560.dp, radius = 22.dp, padding = PaddingValues(start = 18.dp, end = 18.dp, top = 20.dp, bottom = 36.dp), background = t.bgSurface, borderColor = t.borderMedium, maxHeightFraction = 0.92f) {
            Column {
                Text("HOW DO I DO THIS?", style = satoshi(10.5f, 700, ls = 0.12f), color = t.accentWarm, modifier = Modifier.padding(bottom = 6.dp))
                Text(target?.day.orEmpty(), style = clash(19f, 600, lineHeight = 1.2f, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(end = 36.dp, bottom = 4.dp))
                Text(target?.action.orEmpty(), style = satoshi(13f, 500, lineHeight = 1.55f), color = t.textSecondary, modifier = Modifier.padding(bottom = 18.dp))
                if (loading) Row(Modifier.padding(vertical = 22.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Spinner(16.dp, t.textSecondary); Text("Breaking it into steps…", style = satoshi(13f, 500), color = t.textSecondary)
                }
                if (error != null && !loading) Row(
                    Modifier.fillMaxWidth().padding(bottom = 18.dp).clip(RoundedCornerShape(14.dp)).background(t.bgSecondary).border(1.dp, t.borderSubtle, RoundedCornerShape(14.dp)).padding(horizontal = 16.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) { Lucide(R.drawable.lu_alert_triangle, 16.dp, t.accentWarm); Text(error, style = satoshi(13f, 500, lineHeight = 1.5f), color = t.textPrimary) }
                if (guide != null && !loading) {
                    if (!guide.summary.isNullOrBlank() || guide.timeMinutes != null) {
                        Row(Modifier.fillMaxWidth().padding(bottom = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            guide.summary?.let { Text(it, style = satoshi(14f, 500, lineHeight = 1.5f), color = t.textPrimary, modifier = Modifier.weight(1f)) }
                            guide.timeMinutes?.let {
                                Row(Modifier.clip(CircleShape).border(1.dp, t.borderSubtle, CircleShape).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Lucide(R.drawable.lu_clock, 12.dp, t.textSecondary); Text("~$it min", style = satoshi(12f, 600), color = t.textSecondary)
                                }
                            }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                        guide.items.forEach { item ->
                            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(16.dp)).padding(horizontal = 16.dp, vertical = 14.dp)) {
                                Text(item.name, style = clash(15f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(bottom = 10.dp))
                                item.steps.forEachIndexed { j, s ->
                                    Row(Modifier.padding(bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text("${j + 1}.", style = satoshi(13.5f, 700, lineHeight = 1.55f), color = t.textMuted)
                                        Text(s, style = satoshi(13.5f, 500, lineHeight = 1.55f), color = t.textPrimary)
                                    }
                                }
                                if (item.mistakes.isNotEmpty()) Text(
                                    buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = t.accentWarm)) { append("Watch out: ") }; append(item.mistakes.joinToString(" · ")) },
                                    style = satoshi(12.5f, 500, lineHeight = 1.5f), color = t.textSecondary, modifier = Modifier.padding(top = 10.dp),
                                )
                                item.easier?.let {
                                    Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Too hard? ") }; append(it) }, style = satoshi(12.5f, 500, lineHeight = 1.5f), color = t.textSecondary, modifier = Modifier.padding(top = 6.dp))
                                }
                            }
                        }
                    }
                    guide.bareMinimum?.let {
                        Box(Modifier.fillMaxWidth().padding(top = 16.dp).clip(RoundedCornerShape(14.dp)).background(t.accentGlow).border(1.dp, t.borderSubtle, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 12.dp)) {
                            Text(buildAnnotatedString { withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Bare minimum that still counts: ") }; append(it) }, style = satoshi(13f, 500, lineHeight = 1.5f), color = t.textPrimary)
                        }
                    }
                }
                Column(Modifier.padding(top = 22.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("Still confused → Ask mentor", Modifier.fillMaxWidth(), filled = false, uppercase = false, size = 13f, verticalPadding = 11.dp, foreground = t.btnSecondaryText, borderColor = t.btnSecondaryBorder, leading = { Lucide(R.drawable.lu_message_circle, 14.dp, t.btnSecondaryText) }) { target?.let(onAskMentor) }
                    PillButton("Got it", Modifier.fillMaxWidth(), uppercase = false, size = 13f, verticalPadding = 11.dp, leading = { Lucide(R.drawable.lu_check, 14.dp, t.btnPrimaryText) }, onClick = onClose)
                }
            }
            CloseButton(onClose, Modifier.align(Alignment.TopEnd), size = 34.dp, radius = 17.dp, iconSize = 16.dp, background = t.bgSecondary)
        }
    }
}
