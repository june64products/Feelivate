@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.journey

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.june64.feelivate.R
import com.june64.feelivate.data.JournalEntry
import com.june64.feelivate.data.ReportDay
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import com.june64.feelivate.ui.workspace.VoiceRecorder
import com.june64.feelivate.ui.workspace.MissionCard
import com.june64.feelivate.ui.workspace.mountRise
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import com.june64.feelivate.ui.components.ModalOverlay
import com.june64.feelivate.ui.components.ModalCard
import com.june64.feelivate.ui.tour.TourTarget
import com.june64.feelivate.ui.tour.tourTarget

/**
 * JourneyPage.tsx — the private space: the evening voice note, the week's
 * calendar, the review, and the archive of past weeks.
 */
@Composable
fun JourneyScreen(
    sessionId: String?,
    initialTab: String,
    onClose: () -> Unit,
    onJournalSaved: (JournalEntry) -> Unit,
    onPlanNextWeek: (Int) -> Unit,
    /** A notification tap can land on one archived week, open. */
    focusWeek: Int? = null,
    /* The walkthrough's scene, when it is running — the screen reads these instead of the account. */
    demoBetweenWeeks: Boolean? = null,
    demoArchive: List<com.june64.feelivate.data.ArchivedReport>? = null,
    demoArchiveWeek: Int? = null,
    vm: JourneyViewModel = viewModel(),
) {
    val t = tokens()
    val ui = vm.ui
    val demo = demoArchive != null
    val context = LocalContext.current
    val recorder = remember { VoiceRecorder(context) }
    var moodMode by remember { mutableStateOf(false) }
    LaunchedEffect(sessionId, initialTab) { vm.start(sessionId, initialTab) }
    LaunchedEffect(focusWeek) { if (focusWeek != null) vm.expandWeek(focusWeek) }
    DisposableEffect(Unit) { onDispose { recorder.cancel() } }

    val beginRecording: (Boolean) -> Unit = { mood ->
        moodMode = mood
        if (recorder.start()) vm.setRecording(true)
    }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) beginRecording(moodMode)
    }
    val requestRecord: (Boolean) -> Unit = { mood ->
        moodMode = mood
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) beginRecording(mood)
        else micPermission.launch(Manifest.permission.RECORD_AUDIO)
    }
    val stopRecording = {
        val f = recorder.stop()
        vm.setRecording(false)
        if (f != null) { if (moodMode) vm.uploadMood(f) else vm.uploadJournal(f, onJournalSaved) }
    }

    val days = vm.weekDays()
    val todayEntry = if (demo) null else ui.journals.firstOrNull { it.date == ui.today }
    val noActiveWeek = demoBetweenWeeks ?: ui.noActiveWeek
    val archive = demoArchive ?: ui.archive
    val tab = if (!demoArchive.isNullOrEmpty() && demoArchiveWeek != null) "archive" else ui.tab

    Box(Modifier.fillMaxSize().background(t.bgPrimary)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            // ── header ──
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp).mountRise(-10f, 1f, 400),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Box(
                    Modifier.pressScale(0.94f).size(36.dp).clip(RoundedCornerShape(12.dp)).background(t.cardBg).border(1.dp, t.borderMedium, RoundedCornerShape(12.dp)).tap(onClick = onClose),
                    contentAlignment = Alignment.Center,
                ) { Lucide(R.drawable.lu_arrow_left, 16.dp, t.textSecondary) }
                Column(Modifier.weight(1f)) {
                    Text("YOUR PRIVATE SPACE", style = satoshi(10f, 700, ls = 0.14f), color = t.accentPrimary, modifier = Modifier.padding(bottom = 2.dp))
                    Text("My Journey", style = clash(19f, 700, ls = -0.02f), color = t.textPrimary)
                }
                Row(Modifier.clip(CircleShape).background(t.bgSurface).border(1.dp, t.borderSubtle, CircleShape).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                    listOf("overview", "archive").forEach { tb ->
                        val active = tab == tb
                        Box(
                            Modifier.then(if (tb == "archive") Modifier.tourTarget(TourTarget.ARCHIVE_TAB) else Modifier)
                                .clip(CircleShape).background(if (active) t.btnPrimaryBg else Color.Transparent).tap { vm.setTab(tb) }.padding(horizontal = 14.dp, vertical = 7.dp),
                        ) { Text(tb.replaceFirstChar { c -> c.uppercase() }, style = satoshi(12f, 700), color = if (active) t.btnPrimaryText else t.textMuted) }
                    }
                }
            }
            Hairline()

            // ── body ──
            AnimatedContent(tab, transitionSpec = { (fadeIn(tween(200)) + slideInVertically { 8 }) togetherWith (fadeOut(tween(200)) + slideOutVertically { -8 }) }, label = "tab") { tab ->
                Column(
                    Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding()
                        .padding(start = 16.dp, end = 16.dp, top = 20.dp, bottom = 60.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    if (tab == "overview") {
                        // ── the recorder, the hero of this page ──
                        MissionCard(radius = 24.dp, padding = PaddingValues(start = 20.dp, end = 20.dp, top = 36.dp, bottom = 32.dp)) {
                            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    (if (noActiveWeek) "Between weeks" else if (todayEntry != null) "Today logged" else "Tonight's ritual").uppercase(),
                                    style = satoshi(10f, 700, ls = 0.14f), color = t.accentPrimary, modifier = Modifier.padding(bottom = 8.dp),
                                )
                                Text(
                                    if (noActiveWeek) "No active week right now"
                                    else if (todayEntry != null) "Feeling ${todayEntry.emotionLabel} — ${todayEntry.emotionScore}/10"
                                    else "How did today actually go?",
                                    style = clash(21f, 600, ls = -0.01f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 6.dp),
                                )
                                Text(
                                    if (noActiveWeek) "Your journal is locked because no week is committed — it unlocks the moment your next week starts. Meanwhile the small mic below logs a quick mood: just for you, it joins no report."
                                    else if (todayEntry != null) "Captured. Your mentor folds this into your week report."
                                    else "60 honest seconds. Your mentor listens, reads the mood, and shapes next week around it.",
                                    style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 460.dp).padding(bottom = 22.dp),
                                )
                                when {
                                    !demo && ui.isUploading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Spinner(16.dp, t.textSecondary); Text("Analyzing your mood...", style = satoshi(13f, 500), color = t.textSecondary)
                                    }
                                    !demo && ui.isRecording -> RecordingButton(stopRecording)
                                    noActiveWeek -> BetweenWeeks { requestRecord(true) }
                                    !demo && ui.notStartedYet -> LockedMic("Starts ${ui.weekInfo?.weekStart?.let { WeekWindow.formatDay(it) } ?: ""}")
                                    !demo && ui.micLocked -> LockedMic("Recorded today")
                                    else -> RecordButton { requestRecord(false) }
                                }
                                ui.moodResult?.let { m ->
                                    Column(
                                        Modifier.fillMaxWidth().padding(top = 16.dp).clip(RoundedCornerShape(12.dp)).background(t.glassHover).border(1.dp, t.borderSubtle, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 12.dp),
                                    ) {
                                        Text(
                                            buildAnnotatedString {
                                                withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = t.textPrimary)) { append("Mood noted — ${m.emotionLabel} (${m.emotionScore}/10)") }
                                                append(" — ${m.oneLiner}")
                                            },
                                            style = satoshi(12.5f, 500, lineHeight = 1.6f), color = t.textSecondary,
                                        )
                                        Text("Just for you — this joins no report. Your journal unlocks when the next week is committed.", style = satoshi(11f, 500), color = t.textMuted, modifier = Modifier.padding(top = 4.dp))
                                    }
                                }
                                ui.justSaved?.let { j ->
                                    val c = emotionColor(j.emotionLabel)
                                    Box(
                                        Modifier.fillMaxWidth().padding(top = 12.dp).clip(RoundedCornerShape(10.dp)).background(c.copy(alpha = 0.06f)).border(1.dp, c.copy(alpha = 0.19f), RoundedCornerShape(10.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
                                    ) {
                                        Text(
                                            buildAnnotatedString {
                                                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold, color = c)) { append("${j.emotionLabel} (${j.emotionScore}/10)") }
                                                append(" — ${j.oneLiner}")
                                            },
                                            style = satoshi(12f, 500, lineHeight = 1.5f), color = t.textSecondary,
                                        )
                                    }
                                }
                                ui.error?.let { Text(it, style = satoshi(12f, 500), color = Status.Error, modifier = Modifier.padding(top = 12.dp)) }
                            }
                        }

                        // ── the week's calendar ──
                        MissionCard(radius = 20.dp, padding = PaddingValues(horizontal = 20.dp, vertical = 20.dp)) {
                            Row(Modifier.fillMaxWidth().padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    (if (ui.weekInfo?.hasPlan == true) "Your week · Week ${ui.weekInfo?.currentWeek}" else "This week").uppercase(),
                                    style = satoshi(10f, 700, ls = 0.14f), color = t.accentPrimary, modifier = Modifier.weight(1f),
                                )
                                val wi = ui.weekInfo
                                if (wi?.hasPlan == true && wi.weekStart != null && wi.weekEnd != null) Text("${wi.weekStart} – ${wi.weekEnd}", style = satoshi(10f, 500), color = t.textMuted)
                            }
                            WeekCalendar(days, ui.today, ui.weekInfo?.weekStart ?: ui.weekInfo?.planStartDate)
                            FlowRow(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                LegendDot(Color(0xFF10B981), "Logged", filled = true)
                                LegendDot(Status.Error, "Missed", filled = false)
                                LegendDot(t.textMuted, "Upcoming", filled = false)
                            }
                            val wi = ui.weekInfo
                            if (wi?.hasPlan == true && wi.isWeekComplete && wi.hasReport && !wi.hasNextPlan && !ui.goalFinished) {
                                Box(Modifier.fillMaxWidth().padding(top = 10.dp), contentAlignment = Alignment.Center) {
                                    PillButton("Plan Week ${wi.currentWeek + 1}", size = 12f, ls = 0.04f, horizontalPadding = 20.dp, verticalPadding = 8.dp) { onPlanNextWeek(wi.currentWeek + 1) }
                                }
                            }
                        }

                        // ── the review ──
                        val wi = ui.weekInfo
                        val isWeekComplete = wi?.weekEnd?.let { ui.today >= it } ?: (wi?.isWeekComplete == true)
                        if (!isWeekComplete && !ui.goalFinished && days.any { it.hasJournal }) {
                            MissionCard(radius = 18.dp, padding = PaddingValues(horizontal = 20.dp, vertical = 18.dp)) {
                                Text("Great start! Keep logging each day.", style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                                Text("Your full AI week review will appear after ${wi?.weekEnd ?: "the last day"}.", style = satoshi(11f, 500), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
                            }
                        }
                        when {
                            ui.loadingReport -> MissionCard(radius = 18.dp, padding = PaddingValues(32.dp)) {
                                Text("Generating week report...", style = satoshi(13f, 500), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                            }
                            !isWeekComplete -> {}
                            ui.report?.status == "no_data" -> MissionCard(radius = 18.dp, padding = PaddingValues(28.dp)) {
                                Text(
                                    if (ui.goalFinished) "This goal is finished — no new review is written for it.\nReviews from before you finished are in the archive below."
                                    else "Record voice journals across the week.\nAt the end of the week, your AI performance review will appear here.",
                                    style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                                )
                            }
                            ui.report?.status == "in_progress" || ui.report?.status == "waiting_for_sunday_entry" -> MissionCard(radius = 18.dp, padding = PaddingValues(28.dp)) {
                                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("🎯", style = satoshi(20f, 500), modifier = Modifier.padding(bottom = 8.dp))
                                    Text("Week complete! One last step.", style = satoshi(13f, 700), color = t.textPrimary, modifier = Modifier.padding(bottom = 4.dp))
                                    Text("Record today's voice journal to unlock your weekly review.", style = satoshi(12f, 500), color = t.textSecondary, textAlign = TextAlign.Center)
                                }
                            }
                            ui.reportData != null -> WeekReview(
                                ui.reportData!!, days, ui.report?.weekStart, ui.report?.weekEnd,
                                onPlanNext = if (wi?.hasNextPlan != true && !ui.goalFinished) ({ onPlanNextWeek((ui.reportData!!.weekNumber) + 1) }) else null,
                            )
                        }
                    } else {
                        // ── archive ──
                        Text("SESSION WEEKLY REPORTS", style = satoshi(10f, 700, ls = 0.08f), color = t.textMuted)
                        when {
                            !demo && ui.loadingArchive -> Column(Modifier.fillMaxWidth().padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                                Spinner(18.dp, t.textMuted)
                                Text("Loading archive...", style = satoshi(13f, 500), color = t.textMuted, modifier = Modifier.padding(top = 10.dp))
                            }
                            archive.isEmpty() -> MissionCard(radius = 12.dp, padding = PaddingValues(40.dp)) {
                                Text("No weekly reports found for this session yet.", style = satoshi(13f, 500), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                            }
                            else -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                archive.forEach { aw ->
                                    val expanded = (demoArchiveWeek ?: ui.expandedWeek) == aw.weekNumber
                                    val consistency = aw.report?.consistencyScore ?: 0
                                    Column(
                                        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(t.cardBg)
                                            .border(1.dp, if (expanded) t.borderMedium else t.borderSubtle, RoundedCornerShape(18.dp)),
                                    ) {
                                        Row(
                                            Modifier.fillMaxWidth().tap { vm.toggleWeek(aw.weekNumber) }.padding(horizontal = 18.dp, vertical = 16.dp),
                                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
                                        ) {
                                            Box(Modifier.size(38.dp).clip(RoundedCornerShape(10.dp)).background(t.bgSurface), contentAlignment = Alignment.Center) {
                                                Lucide(if (expanded) R.drawable.lu_book_open else R.drawable.lu_file_text, 16.dp, if (expanded) t.textPrimary else t.textSecondary)
                                            }
                                            Column(Modifier.weight(1f)) {
                                                Text("Week ${aw.weekNumber} Report", style = clash(14f, 700, ls = -0.02f), color = t.textPrimary)
                                                Row(Modifier.padding(top = 2.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                                    Text("${aw.weekStart} – ${aw.weekEnd}", style = satoshi(11f, 500), color = t.textSecondary)
                                                    if (aw.report != null) Text("$consistency% consistency", style = satoshi(11f, 600), color = if (consistency >= 70) Status.Success else Status.Warning)
                                                }
                                            }
                                            val rot by animateFloatAsState(if (expanded) 180f else 0f, tween(200), label = "rot")
                                            Lucide(R.drawable.lu_chevron_down, 16.dp, t.textMuted, Modifier.rotate(rot))
                                        }
                                        AnimatedVisibility(expanded) {
                                            Column {
                                                Hairline()
                                                Box(Modifier.padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 16.dp)) {
                                                    aw.report?.let { WeekReview(it, it.days, aw.weekStart, aw.weekEnd, compact = true) }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ── Sunday night: the week's review is in ──
        WeekEndCelebration(vm, days) { onPlanNextWeek(it) }
    }
}

@Composable
private fun RecordButton(onClick: () -> Unit) {
    val t = tokens()
    val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "ring")
    Box(contentAlignment = Alignment.Center) {
        listOf(0, 1100).forEach { delay ->
            val s by inf.animateFloat(1f, 1.45f, infiniteRepeatable(tween(2200, delay)), label = "rs$delay")
            val a by inf.animateFloat(0.45f, 0f, infiniteRepeatable(tween(2200, delay)), label = "ra$delay")
            Box(Modifier.size(88.dp).graphicsLayer { scaleX = s; scaleY = s; alpha = a }.border(1.5.dp, t.accentPrimary, CircleShape))
        }
        Box(
            Modifier.tourTarget(TourTarget.JOURNEY_MIC).pressScale(0.94f).size(88.dp).shadow(24.dp, CircleShape, ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f))
                .clip(CircleShape).background(t.btnPrimaryBg).tap(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) { Lucide(R.drawable.lu_mic, 32.dp, t.btnPrimaryText) }
    }
}

@Composable
private fun RecordingButton(onClick: () -> Unit) {
    val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "rec")
    val ring by inf.animateFloat(0f, 1f, infiniteRepeatable(tween(1400)), label = "ring")
    Box(contentAlignment = Alignment.Center) {
        Box(Modifier.size(88.dp).graphicsLayer { scaleX = 1f + ring * 0.25f; scaleY = 1f + ring * 0.25f; alpha = 0.3f * (1f - ring) }.clip(CircleShape).background(Status.Error))
        Box(
            Modifier.pressScale(0.95f).size(88.dp).clip(CircleShape).background(Status.Error.copy(alpha = 0.12f)).border(2.dp, Status.Error.copy(alpha = 0.4f), CircleShape).tap(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) { Lucide(R.drawable.lu_square_fill, 28.dp, Color(0xFFF87171)) }
    }
}

@Composable
private fun LockedMic(label: String) {
    val t = tokens()
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.size(60.dp).clip(CircleShape).background(t.bgSurface).border(2.dp, t.borderSubtle, CircleShape), contentAlignment = Alignment.Center) {
            Lucide(R.drawable.lu_lock, 18.dp, t.textMuted)
        }
        Text(label, style = satoshi(11f, 500), color = t.textMuted, textAlign = TextAlign.Center)
    }
}

@Composable
private fun BetweenWeeks(onMood: () -> Unit) {
    val t = tokens()
    FlowRow(horizontalArrangement = Arrangement.spacedBy(36.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(Modifier.width(150.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.size(72.dp).clip(CircleShape).background(t.bgSurface).border(2.dp, t.borderSubtle, CircleShape), contentAlignment = Alignment.Center) {
                Lucide(R.drawable.lu_lock, 22.dp, t.textMuted)
            }
            Text("Journal locked — unlocks with your next week", style = satoshi(11f, 600, lineHeight = 1.5f), color = t.textMuted, textAlign = TextAlign.Center)
        }
        Column(Modifier.width(150.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(
                Modifier.tourTarget(TourTarget.MOOD_MIC).pressScale(0.94f).size(72.dp).clip(CircleShape).background(t.glassHover).border(2.dp, t.accentPrimary, CircleShape).tap(onClick = onMood),
                contentAlignment = Alignment.Center,
            ) { Lucide(R.drawable.lu_mic, 26.dp, t.accentPrimary) }
            Text("Mood check-in — unlocked", style = satoshi(11f, 700, lineHeight = 1.5f), color = t.accentPrimary, textAlign = TextAlign.Center)
        }
    }
}

/** The 7-day strip: a ring per day, filled when the evening note is in. */
@Composable
private fun WeekCalendar(days: List<ReportDay>, today: String, planStartDate: String?) {
    val t = tokens()
    val visible = if (planStartDate != null) days.filter { it.date >= planStartDate } else days
    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        visible.forEachIndexed { i, d ->
            val isPast = d.date < today
            val isToday = d.date == today
            val done = d.hasJournal
            val missed = isPast && !done && !isToday
            val color = if (done) emotionColor(d.emotion) else if (missed) Status.Error else t.textMuted
            var shown by remember(d.date) { mutableStateOf(false) }
            LaunchedEffect(d.date) { kotlinx.coroutines.delay(i * 50L); shown = true }
            val s by animateFloatAsState(if (shown) 1f else 0f, tween(350, easing = com.june64.feelivate.ui.theme.EaseSilk), label = "s")
            Column(Modifier.widthIn(min = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(runCatching { LocalDate.parse(d.date).format(DateTimeFormatter.ofPattern("EEE", Locale.US)) }.getOrDefault(""), style = satoshi(9f, 600), color = t.textSecondary)
                Box(
                    Modifier.size(28.dp).graphicsLayer { scaleX = s; scaleY = s }.clip(CircleShape)
                        .background(if (done) color.copy(alpha = 0.08f) else Color.Transparent).border(2.dp, color, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    when {
                        done -> Box(Modifier.size(10.dp).clip(CircleShape).background(color))
                        missed -> Box(Modifier.size(8.dp).clip(CircleShape).background(Status.Error.copy(alpha = 0.3f)))
                        isToday -> Box(Modifier.size(5.dp).clip(CircleShape).background(t.textMuted))
                    }
                }
                if (done) Text("${d.score}/10", style = satoshi(8f, 600), color = color)
                else if (missed) Text("missed", style = satoshi(8f, 500), color = Status.Error.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun LegendDot(color: Color, label: String, filled: Boolean) {
    val t = tokens()
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(8.dp).clip(CircleShape).then(if (filled) Modifier.background(color) else Modifier.border(1.5.dp, color, CircleShape)))
        Text(label, style = satoshi(10f, 500), color = t.textSecondary)
    }
}

/** The Sunday-night card: "Week N, complete." */
@Composable
private fun BoxScope.WeekEndCelebration(vm: JourneyViewModel, days: List<ReportDay>, onPlanNext: (Int) -> Unit) {
    val t = tokens()
    val ui = vm.ui
    val report = ui.reportData
    ModalOverlay(
        ui.showWeekEndCelebration && report != null, vm::dismissCelebration,
        padding = PaddingValues(16.dp), stiffness = 260f, damping = 24f, fromScale = 0.92f, fromY = 24.dp,
    ) {
        if (report == null) return@ModalOverlay
        ModalCard(
            maxWidth = 560.dp, radius = 28.dp, padding = PaddingValues(start = 14.dp, end = 14.dp, top = 18.dp, bottom = 18.dp),
            background = t.cardBg, borderColor = t.borderSubtle, maxHeightFraction = 0.94f,
        ) {
            Column {
                Row(Modifier.fillMaxWidth().padding(start = 8.dp, end = 8.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            ("Week ${report.weekNumber}" + if (report.weekTheme.isNotBlank()) " · ${report.weekTheme}" else "").uppercase(),
                            style = satoshi(10.5f, 700, ls = 0.14f), color = t.accentWarm,
                        )
                        Text("Week ${report.weekNumber}, complete.", style = clash(24f, 600, lineHeight = 1.05f, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(top = 6.dp))
                    }
                    Text("LATER", style = satoshi(12f, 500, ls = 0.06f), color = t.textMuted, modifier = Modifier.tap { vm.dismissCelebration() }.padding(vertical = 4.dp))
                }
                Box(Modifier.padding(horizontal = 0.dp, vertical = 6.dp)) {
                    WeekReview(report, days, ui.report?.weekStart, ui.report?.weekEnd, compact = true)
                }
                val wi = ui.weekInfo
                Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("View Full Report", Modifier.weight(1f), filled = false, uppercase = false, size = 13f, verticalPadding = 11.dp) { vm.dismissCelebration() }
                    if (wi?.hasNextPlan != true && !ui.goalFinished) {
                        PillButton("Plan Week ${report.weekNumber + 1} →", Modifier.weight(1f), uppercase = false, size = 13f, verticalPadding = 11.dp) {
                            vm.dismissCelebration(); onPlanNext(report.weekNumber + 1)
                        }
                    }
                }
            }
        }
    }
}
