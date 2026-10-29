@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.ArchivedWeekReport
import com.june64.feelivate.data.DeleteAccountRequest
import com.june64.feelivate.data.Plan
import com.june64.feelivate.data.userMessage
import com.june64.feelivate.ui.components.ConsentCheckbox
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.ModalCard
import com.june64.feelivate.ui.components.ModalOverlay
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.SwissButton
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.georgia
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/* ── ConsentGate.tsx — blocking, cannot be dismissed ── */
@Composable
fun BoxScope.ConsentGate(vm: WorkspaceViewModel, onLogout: () -> Unit) {
    val t = tokens()
    val c = vm.ui.consent
    val required = c.catalogue.filter { it.required }
    val canContinue = required.isNotEmpty() && required.all { c.decisions[it.key] == true } && !c.saving
    ModalOverlay(c.status == ConsentStatus.Blocking, null, stiffness = 260f, damping = 24f, fromScale = 0.95f, fromY = 8.dp, padding = PaddingValues(16.dp)) {
        ModalCard(maxWidth = 520.dp, radius = 14.dp, padding = PaddingValues(24.dp), maxHeightFraction = 0.92f) {
            Column {
                Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_shield_check, 18.dp, t.textPrimary) }
                Text("Before you continue", style = clash(22f, 700, lineHeight = 1.15f, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(top = 18.dp, bottom = 10.dp))
                Text("We've updated how we explain the way Feelivate handles your data. Because your journals, voice notes and emotion logs say something about your wellbeing, we need your clear permission before we process them. Please review and confirm.", style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 22.dp))
                if (c.loading) Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) { Spinner(18.dp, t.textMuted) }
                else Column(Modifier.padding(bottom = 22.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    c.catalogue.forEach { item -> ConsentCheckbox(item, c.decisions[item.key] == true, c.saving) { vm.setConsentDecision(item.key, it) } }
                }
                if (c.error.isNotEmpty()) Text(c.error, style = satoshi(12.5f, 500, lineHeight = 1.5f), color = Status.ErrorText, modifier = Modifier.padding(bottom = 14.dp))
                SwissButton("Agree and continue", Modifier.fillMaxWidth(), enabled = canContinue, loading = c.saving, textStyle = satoshi(13.5f, 700, ls = 0.02f), verticalPadding = 14.dp, onClick = vm::submitConsent)
                Text(
                    buildAnnotatedString {
                        append("Don't want to agree? ")
                        withStyle(SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold, textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline)) { append("Log out") }
                        append(". Your data stays untouched, and you can delete your account any time from your profile menu.")
                    },
                    style = satoshi(12f, 500, lineHeight = 1.6f), color = t.textMuted, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 16.dp).tap(onClick = onLogout),
                )
            }
        }
    }
}

/* ── ProfileMenu.tsx ── */
@Composable
fun BoxScope.ProfileMenu(
    open: Boolean, onClose: () -> Unit, name: String, joined: String?,
    onReplayTour: () -> Unit, onDownload: () -> Unit, onDelete: () -> Unit, onLogout: () -> Unit,
    onOpenPage: (String) -> Unit,
    modifier: Modifier = Modifier, exporting: Boolean = false, exportError: String? = null,
) {
    val t = tokens()
    val themeStore = com.june64.feelivate.ui.theme.LocalThemeStore.current
    val systemDark = androidx.compose.foundation.isSystemInDarkTheme()
    val isDark = themeStore?.isDark(systemDark) ?: systemDark
    val initials = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }.let { parts ->
        when { parts.isEmpty() -> "U"; parts.size == 1 -> parts[0].first().uppercase(); else -> (parts.first().first().toString() + parts.last().first()).uppercase() }
    }
    AnimatedVisibility(open, modifier = Modifier.matchParentSize(), enter = fadeIn(tween(1)), exit = fadeOut(tween(1))) { Box(Modifier.matchParentSize().tap { onClose() }) }
    AnimatedVisibility(open, modifier = modifier, enter = fadeIn(tween(160)), exit = fadeOut(tween(160))) {
        var shown by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { shown = true }
        val s by animateFloatAsState(if (shown) 1f else 0.96f, tween(160), label = "s")
        val y by animateFloatAsState(if (shown) 0f else -8f, tween(160), label = "y")
        Column(
            Modifier.width(240.dp).graphicsLayer { scaleX = s; scaleY = s; translationY = y * density }
                .shadow(24.dp, RoundedCornerShape(16.dp), ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f))
                .clip(RoundedCornerShape(16.dp)).background(t.bgSurface).border(1.dp, t.borderMedium, RoundedCornerShape(16.dp)),
        ) {
            Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(32.dp).clip(CircleShape).background(t.accentWarm), contentAlignment = Alignment.Center) { Text(initials, style = satoshi(12f, 700), color = Color.White) }
                Column(Modifier.weight(1f)) {
                    Text(name, style = clash(13f, 700, lineHeight = 1.2f), color = t.textPrimary, maxLines = 1)
                    Text(joined?.let { "Joined $it" } ?: "Member", style = satoshi(11f, 500), color = t.textMuted, modifier = Modifier.padding(top = 3.dp))
                }
            }
            Hairline()
            // Theme: the device decides until you pick a side here.
            ProfileRow(if (isDark) R.drawable.lu_sun else R.drawable.lu_moon, if (isDark) "Light mode" else "Dark mode") { themeStore?.toggle(systemDark) }
            ProfileRow(R.drawable.lu_circle_help, "Replay tutorial") { onClose(); onReplayTour() }
            ProfileRow(if (exporting) R.drawable.lu_loader else R.drawable.lu_download, if (exporting) "Preparing…" else "Download my data", onClick = onDownload)
            exportError?.let { Text(it, style = satoshi(11f, 500, lineHeight = 1.5f), color = Status.Error, modifier = Modifier.padding(horizontal = 12.dp)) }
            ProfileRow(R.drawable.lu_trash, "Delete account") { onClose(); onDelete() }
            ProfileRow(R.drawable.lu_file_text, "Privacy & terms") { onClose(); onOpenPage(com.june64.feelivate.ui.Routes.PRIVACY) }
            Box(Modifier.padding(8.dp)) {
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, Status.Error.copy(alpha = 0.25f), RoundedCornerShape(10.dp)).tap { onClose(); onLogout() }.padding(horizontal = 12.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Lucide(R.drawable.lu_log_out, 14.dp, Status.Error)
                    Text("LOG OUT", style = satoshi(12f, 700, ls = 0.04f), color = Status.Error)
                }
            }
        }
    }
}

@Composable
private fun ProfileRow(@DrawableRes icon: Int, label: String, onClick: () -> Unit) {
    val t = tokens()
    Box(Modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp)) {
        Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp)).tap(onClick = onClick).padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Lucide(icon, 14.dp, t.textSecondary)
            Text(label.uppercase(), style = satoshi(12f, 700, ls = 0.04f), color = t.textSecondary)
        }
    }
}

/* ── DeleteAccountModal.tsx ── */
@Composable
fun BoxScope.DeleteAccountModal(visible: Boolean, onClose: () -> Unit, onDeleted: () -> Unit) {
    val t = tokens()
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var confirmation by remember(visible) { mutableStateOf("") }
    var password by remember(visible) { mutableStateOf("") }
    var busy by remember(visible) { mutableStateOf(false) }
    var error by remember(visible) { mutableStateOf("") }
    var warning by remember(visible) { mutableStateOf<List<String>?>(null) }
    val canDelete = confirmation.trim().uppercase() == "DELETE" && !busy

    ModalOverlay(visible, if (busy) null else onClose, stiffness = 260f, damping = 24f, fromScale = 0.95f, fromY = 8.dp, padding = PaddingValues(16.dp)) {
        ModalCard(maxWidth = 460.dp, radius = 14.dp, padding = PaddingValues(24.dp), maxHeightFraction = 0.92f) {
            Column {
                Row(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(Status.Error.copy(alpha = 0.06f)).border(1.dp, Status.Error.copy(alpha = 0.3f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_alert_triangle, 18.dp, Status.Error) }
                    if (!busy) Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(t.glassHover).tap(onClick = onClose), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_x, 16.dp, t.textSecondary) }
                }
                Text("Delete your account", style = clash(21f, 700, lineHeight = 1.15f, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(bottom = 10.dp))
                val w = warning
                if (w != null) {
                    Text("Your account and database records have been deleted. One external store could not be reached, so a small amount of data may still be held there:", style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 16.dp))
                    w.forEach { Text("•  ${it.replace('_', ' ')}", style = satoshi(13f, 500, lineHeight = 1.7f), color = t.textSecondary) }
                    Text(buildAnnotatedString { append("Please email "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("info@june64.com") }; append(" and we will confirm its removal.") }, style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(top = 18.dp, bottom = 20.dp))
                    SwissButton("Done", Modifier.fillMaxWidth(), textStyle = satoshi(13f, 700, ls = 0.02f), verticalPadding = 14.dp, onClick = onDeleted)
                } else {
                    Text("This is permanent and immediate. There is no undo and no recovery period. Everything below is erased:", style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 14.dp))
                    listOf(
                        "Your account, name and email",
                        "Every chat, goal and weekly plan",
                        "All voice journal entries and their transcripts",
                        "Your emotion logs, check-ins, streaks and weekly reports",
                        "Your long-term memory and any Google Calendar connection",
                    ).forEach { Text("•  $it", style = satoshi(12.5f, 500, lineHeight = 1.75f), color = t.textSecondary) }
                    Text(buildAnnotatedString { append("Want a copy first? Close this and choose "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Download my data") }; append(".") }, style = satoshi(12.5f, 500, lineHeight = 1.6f), color = t.textMuted, modifier = Modifier.padding(top = 18.dp, bottom = 20.dp))
                    Text("TYPE DELETE TO CONFIRM", style = satoshi(11f, 700, ls = 0.1f), color = t.textSecondary, modifier = Modifier.padding(bottom = 6.dp))
                    ModalField(confirmation, { confirmation = it }, "DELETE", radius = 4, minHeight = 46, textStyle = satoshi(16f, 500), enabled = !busy)
                    Text("PASSWORD", style = satoshi(11f, 700, ls = 0.1f), color = t.textSecondary, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                    ModalField(password, { password = it }, "Leave blank if you sign in with Google", radius = 4, minHeight = 46, textStyle = satoshi(16f, 500), keyboardType = KeyboardType.Password, enabled = !busy)
                    if (error.isNotEmpty()) Text(error, style = satoshi(12.5f, 500, lineHeight = 1.5f), color = Status.ErrorText, modifier = Modifier.padding(top = 14.dp))
                    SwissButton(
                        "Delete my account permanently", Modifier.fillMaxWidth().padding(top = 18.dp), enabled = canDelete, loading = busy,
                        textStyle = satoshi(13f, 700, ls = 0.02f), verticalPadding = 14.dp, background = Status.ErrorText, foreground = Color.White,
                    ) {
                        busy = true; error = ""
                        scope.launch {
                            runCatching { ApiClient.get(context).deleteAccount(DeleteAccountRequest(confirmation, password.ifBlank { null })) }
                                .onSuccess { r -> busy = false; if (r.incomplete.isNotEmpty()) warning = r.incomplete else onDeleted() }
                                .onFailure { e -> busy = false; error = e.userMessage("Could not delete your account. Please try again.") }
                        }
                    }
                }
            }
        }
    }
}

/* ── LockedWeeksPanel.tsx — the phone bottom sheet + the week drawer ── */
@Composable
fun BoxScope.WeeksSheet(
    open: Boolean, onClose: () -> Unit, currentWeek: Int, micLocked: Boolean,
    activePlan: Plan?, planHistory: List<Plan>, reports: List<ArchivedWeekReport>,
) {
    val t = tokens()
    var selectedWeek by remember { mutableStateOf<Int?>(null) }
    LaunchedEffect(open) { if (!open) selectedWeek = null }
    val weekNums = (planHistory.map { it.weekNumber } + reports.map { it.weekNumber }).toSortedSet().filter { it != currentWeek } + currentWeek

    AnimatedVisibility(open, modifier = Modifier.matchParentSize(), enter = fadeIn(), exit = fadeOut()) {
        Box(Modifier.fillMaxSize().background(Color(0x8C000000)).tap { onClose() })
    }
    AnimatedVisibility(
        open, modifier = Modifier.align(Alignment.BottomCenter),
        enter = slideInVertically(motionSpring(320f, 28f)) { it } + fadeIn(),
        exit = slideOutVertically(motionSpring(320f, 28f)) { it } + fadeOut(),
    ) {
        Column(
            Modifier.fillMaxWidth().heightIn(max = (LocalConfiguration.current.screenHeightDp * 0.7f).dp)
                .shadow(24.dp, RoundedCornerShape(24.dp, 24.dp, 0.dp, 0.dp), ambientColor = t.shadowColor.copy(alpha = 0.18f), spotColor = t.shadowColor.copy(alpha = 0.18f))
                .clip(RoundedCornerShape(24.dp, 24.dp, 0.dp, 0.dp)).background(t.bgSurface).border(1.dp, t.borderSubtle, RoundedCornerShape(24.dp, 24.dp, 0.dp, 0.dp))
                .navigationBarsPadding(),
        ) {
            Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("YOUR WEEKS", style = satoshi(11f, 700, ls = 0.12f), color = t.textMuted, modifier = Modifier.weight(1f))
                Box(Modifier.size(30.dp).clip(CircleShape).background(t.cardBg).border(1.dp, t.borderSubtle, CircleShape).tap(onClick = onClose), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_x, 14.dp, t.textSecondary) }
            }
            Hairline()
            FlowRow(
                Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 24.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                weekNums.forEach { wn ->
                    val isCurrent = wn == currentWeek
                    val isOngoing = isCurrent && micLocked
                    val isActiveCurrent = isCurrent && !micLocked
                    val color = if (isOngoing) Color(0xFF4F46E5) else if (isActiveCurrent) Color(0xFF059669) else Color(0xFF7C3AED)
                    val selected = selectedWeek == wn
                    Column(
                        Modifier.width(44.dp).clip(RoundedCornerShape(9.dp)).background(color.copy(alpha = if (selected) 0.16f else 0.07f)).border(1.dp, color.copy(alpha = if (selected) 0.55f else 0.3f), RoundedCornerShape(9.dp))
                            .tap { selectedWeek = if (selected) null else wn }.padding(horizontal = 4.dp, vertical = 7.dp),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp),
                    ) {
                        when { isOngoing -> Lucide(R.drawable.lu_mic, 10.dp, color); isActiveCurrent -> Lucide(R.drawable.lu_play_fill, 10.dp, color); else -> Lucide(R.drawable.lu_lock, 10.dp, color) }
                        Text("W$wn", style = satoshi(8.5f, 700, ls = -0.01f), color = color)
                    }
                }
            }
        }
    }
    // The week drawer (phone: a right-hand sheet)
    val wn = selectedWeek
    AnimatedVisibility(
        open && wn != null, modifier = Modifier.align(Alignment.CenterEnd),
        enter = slideInHorizontally(motionSpring(300f, 28f)) { it } + fadeIn(),
        exit = slideOutHorizontally(motionSpring(300f, 28f)) { it } + fadeOut(),
    ) {
        if (wn != null) {
            val report = reports.firstOrNull { it.weekNumber == wn }
            val plan = if (wn == currentWeek) activePlan else planHistory.firstOrNull { it.weekNumber == wn }
            WeekDrawer(wn, report, wn == currentWeek, micLocked, plan) { selectedWeek = null }
        }
    }
}

@Composable
private fun WeekDrawer(weekNumber: Int, report: ArchivedWeekReport?, isCurrent: Boolean, micLocked: Boolean, plan: Plan?, onClose: () -> Unit) {
    val t = tokens()
    val conf = LocalConfiguration.current
    val r = report?.report
    var showReport by remember { mutableStateOf(false) }
    Column(
        Modifier.width(minOf(conf.screenWidthDp * 0.85f, 340f).dp).heightIn(max = (conf.screenHeightDp * 0.82f).dp)
            .shadow(24.dp, RoundedCornerShape(16.dp), ambientColor = t.shadowColor.copy(alpha = 0.18f), spotColor = t.shadowColor.copy(alpha = 0.18f))
            .clip(RoundedCornerShape(16.dp)).background(t.bgSurface).border(1.dp, t.borderMedium, RoundedCornerShape(16.dp)),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("WEEK $weekNumber${if (!isCurrent) " — PLAN" else ""}", style = satoshi(10f, 700, ls = 0.1f), color = t.textMuted)
                Text(
                    if (isCurrent && micLocked) "Recorded today" else if (isCurrent) "Active now" else report?.let { "${it.weekStart} – ${it.weekEnd}" } ?: "Completed",
                    style = satoshi(11f, 500), color = t.textSecondary, modifier = Modifier.padding(top = 2.dp),
                )
            }
            Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(t.btnPrimaryBg).tap(onClick = onClose), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_x, 13.dp, t.btnPrimaryText) }
        }
        Hairline()
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).background(t.bgPrimary).padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (isCurrent && r == null) {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(12.dp)).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (micLocked) "Voice logged today — great work." else "This is your current active week.", style = satoshi(12f, 500, lineHeight = 1.5f), color = t.textSecondary, textAlign = TextAlign.Center)
                    Text(if (micLocked) "Keep up the momentum." else "Keep journaling — report at week end.", style = satoshi(11f, 500), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
                }
            }
            if (plan != null && plan.days.isNotEmpty()) WeekPlanDays(plan)
            else if (!isCurrent) Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(12.dp)).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Lucide(R.drawable.lu_file_text, 18.dp, t.textMuted)
                Text("Plan data not available for this week.", style = satoshi(12f, 500, lineHeight = 1.6f), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp))
            }
            if (r != null) {
                if (!isCurrent) {
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp))) {
                        Row(Modifier.fillMaxWidth().tap { showReport = !showReport }.padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("WEEK PERFORMANCE", style = satoshi(10f, 700, ls = 0.08f), color = t.textSecondary, modifier = Modifier.weight(1f))
                            Lucide(if (showReport) R.drawable.lu_chevron_up else R.drawable.lu_chevron_down, 12.dp, t.textSecondary)
                        }
                        AnimatedVisibility(showReport) { Column(Modifier.padding(horizontal = 14.dp).padding(bottom = 10.dp)) { ReportBody(r) } }
                    }
                } else ReportBody(r)
            }
        }
    }
}

@Composable
private fun ReportBody(r: JsonObject) {
    val t = tokens()
    fun str(key: String) = (r[key] as? JsonPrimitive)?.contentOrNull.orEmpty()
    fun num(key: String) = (r[key] as? JsonPrimitive)?.intOrNull ?: 0
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MiniStat(Modifier.weight(1f), "Consistency", "${num("consistency_score")}%", Status.Success)
            MiniStat(Modifier.weight(1f), "Avg Mood", "${num("avg_score")}/10", t.textPrimary)
        }
        str("week_theme").takeIf { it.isNotBlank() }?.let {
            Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(t.glassSurface).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 10.dp)) {
                Text(it, style = clash(12f, 600), color = t.textPrimary)
            }
        }
        MiniAnalysis("Emotional Arc", str("emotional_arc"))
        MiniAnalysis("What Went Well", str("what_went_well"))
        MiniAnalysis("Where You Slipped", str("where_you_slipped"))
        str("hidden_insight").takeIf { it.isNotBlank() }?.let {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(t.glassSurface).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 12.dp)) {
                Text("HIDDEN INSIGHT", style = satoshi(9f, 700, ls = 0.08f), color = t.textMuted, modifier = Modifier.padding(bottom = 5.dp))
                Text(it, style = satoshi(12f, 500, lineHeight = 1.6f), color = t.textSecondary)
            }
        }
    }
}

@Composable
private fun MiniStat(modifier: Modifier, label: String, value: String, color: Color) {
    val t = tokens()
    Column(modifier.clip(RoundedCornerShape(10.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(label.uppercase(), style = satoshi(9f, 700, ls = 0.08f), color = t.textMuted)
        Text(value, style = clash(18f, 700, lineHeight = 1f, ls = -0.02f), color = color)
    }
}

@Composable
private fun MiniAnalysis(label: String, content: String) {
    if (content.isBlank()) return
    val t = tokens()
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 12.dp)) {
        Text(label.uppercase(), style = satoshi(9f, 700, ls = 0.08f), color = t.textMuted, modifier = Modifier.padding(bottom = 6.dp))
        Text(content, style = satoshi(12f, 500, lineHeight = 1.6f), color = t.textSecondary)
    }
}

/** The week drawer's day list (WeekPlanDays). */
@Composable
private fun WeekPlanDays(plan: Plan) {
    val t = tokens()
    var openDay by remember { mutableStateOf(-1) }
    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 10.dp)) {
            Text("WEEK ${plan.weekNumber}", style = satoshi(10f, 700, ls = 0.12f), color = t.textMuted, modifier = Modifier.padding(bottom = 5.dp))
            Text(plan.theme, style = clash(16f, 700, lineHeight = 1.2f, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(bottom = 6.dp))
            plan.winCondition?.takeIf { it.isNotBlank() }?.let { Text("Win: $it", style = georgia(12f, 1.4f), color = t.textSecondary) }
        }
        Hairline()
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp)).background(t.cardBg)) {
            plan.days.forEachIndexed { idx, day ->
                val action = day.action
                val isLong = action.length > CLAMP_CHARS
                val isOpen = openDay == idx
                Column(
                    Modifier.fillMaxWidth().padding(if (isOpen) 6.dp else 0.dp)
                        .then(if (isOpen) Modifier.shadow(12.dp, RoundedCornerShape(12.dp), ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f)) else Modifier)
                        .clip(RoundedCornerShape(if (isOpen) 12.dp else 0.dp))
                        .background(if (isOpen) t.bgSurface else if (idx % 2 == 1) t.glassSurface else Color.Transparent)
                        .tap(isLong) { openDay = if (isOpen) -1 else idx }
                        .padding(horizontal = 16.dp, vertical = if (isOpen) 16.dp else 11.dp),
                    verticalArrangement = Arrangement.spacedBy(if (isOpen) 8.dp else 4.dp),
                ) {
                    Text(com.june64.feelivate.data.WeekWindow.correctDayLabel(day.day).uppercase(), style = clash(11f, 700, ls = 0.04f), color = if (isOpen) t.accentWarm else t.textPrimary)
                    Text(action, style = satoshi(if (isOpen) 13f else 12f, 400, lineHeight = if (isOpen) 1.7f else 1.55f), color = if (isOpen) t.textPrimary else t.textSecondary, maxLines = if (isOpen || !isLong) Int.MAX_VALUE else 2, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    if (isLong) Text(if (isOpen) "SHOW LESS" else "SEE MORE", style = satoshi(10f, 700, ls = 0.08f), color = t.accentWarm)
                }
                if (idx < plan.days.size - 1 && !isOpen) Hairline()
            }
        }
    }
}
