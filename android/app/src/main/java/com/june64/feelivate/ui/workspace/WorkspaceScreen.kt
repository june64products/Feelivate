package com.june64.feelivate.ui.workspace

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.june64.feelivate.data.TaskHowTo
import com.june64.feelivate.data.userMessage
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.launch

/**
 * WorkspacePage.tsx — the mission surface on a phone: the top bar, one stage,
 * the mentor drawer, and every overlay the web mounts at the page root.
 */
@Composable
fun WorkspaceScreen(onSignedOut: () -> Unit, vm: WorkspaceViewModel = viewModel()) {
    val t = tokens()
    val ui = vm.ui
    val scope = rememberCoroutineScope()
    LaunchedEffect(vm.signedOut) { if (vm.signedOut) onSignedOut() }

    var menuOpen by remember { mutableStateOf(false) }
    var streakOpen by remember { mutableStateOf(false) }
    var profileOpen by remember { mutableStateOf(false) }
    var showDelete by remember { mutableStateOf(false) }
    var exporting by remember { mutableStateOf(false) }
    var exportError by remember { mutableStateOf<String?>(null) }
    var planDialog by remember { mutableStateOf<PlanDialog?>(null) }
    var howToGuide by remember { mutableStateOf<TaskHowTo?>(null) }
    var howToLoading by remember { mutableStateOf(false) }
    var howToError by remember { mutableStateOf<String?>(null) }

    // The plan card dispatches "open the guide for this day" the way the web does.
    DisposableEffect(Unit) {
        HowToBus.handler = { vm.openHowTo(it) }
        onDispose { HowToBus.handler = null }
    }
    LaunchedEffect(ui.howTo) {
        val target = ui.howTo ?: return@LaunchedEffect
        howToGuide = null; howToError = null
        val sid = ui.activeSessionId
        if (sid == null) { howToError = "Open a session to get a guide for this task."; return@LaunchedEffect }
        howToLoading = true
        runCatching { com.june64.feelivate.data.ApiClient.get(vm.getApplication()).howTo(sid, com.june64.feelivate.data.HowToRequest(target.action, target.day)) }
            .onSuccess { howToGuide = it }
            .onFailure { howToError = it.userMessage("Could not build the guide right now.") }
        howToLoading = false
    }

    Box(Modifier.fillMaxSize().background(t.bgPrimary)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            MissionTopBar(
                goalLabel = ui.goalLabelRaw,
                menuOpen = menuOpen, onToggleMenu = { menuOpen = !menuOpen; streakOpen = false; profileOpen = false },
                streak = ui.streak, isPlanActive = ui.isPlanApproved,
                streakOpen = streakOpen, onToggleStreak = { streakOpen = !streakOpen; menuOpen = false; profileOpen = false },
                initials = initialsOf(ui.userName), onToggleProfile = { profileOpen = !profileOpen; menuOpen = false; streakOpen = false },
                onOpenWeeks = { vm.setWeeksOpen(true) },
                onOpenArchive = { vm.openJourney("archive") },
                onOpenAlerts = vm::openEmailModal,
                onOpenCalendar = { vm.setShowCalendarMaintenance(true) },
            )
            Box(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).navigationBarsPadding()) {
                when {
                    ui.isEmptyState && !ui.isPlanApproved && !ui.isFinishedStage ->
                        GoalStart(ui.userName.substringBefore(' '), ui.isLoading) { vm.sendMessage(it) }

                    ui.isFinishedStage ->
                        FinishedStage(
                            title = ui.sessionFocus.takeIf { it.isNotBlank() } ?: ui.activePlan?.theme?.takeIf { it.isNotBlank() } ?: "This goal is closed.",
                            onTalk = { vm.setMentorOpen(true) }, onArchive = { vm.openJourney("archive") }, onNewGoal = vm::newGoal,
                        )

                    ui.isPlanningStage ->
                        CommitStage(ui.activePlan!!, ui.isFirstPlan, { vm.approvePlan(it) }, vm::requestPlanChange, { vm.setMentorOpen(true) }, { planDialog = it })

                    ui.isPlanApproved ->
                        Column(
                            Modifier.fillMaxWidth().widthIn(max = 820.dp).padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 60.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp),
                        ) {
                            val rec = ui.recoveryInfo
                            if (!ui.weekOver && rec != null) RecoveryCard(vm, rec, ui.commitmentWhy, ui.sessionFocus)
                            StreakStrip(ui.streak, ui.todayStatus == "done")
                            when {
                                ui.notStartedYet -> NotStartedCard(ui.activePlan, ui.planStartsOn!!, ui.daysUntilStart, { vm.openJourney() }, { vm.setMentorOpen(true) })
                                ui.weekOver -> WeekOverCard(ui.activePlan?.weekNumber ?: 1, { vm.openJourney() }, { vm.askNextWeekStart((ui.activePlan?.weekNumber ?: 1) + 1) })
                                else -> TodayCard(ui.activePlan, ui.todayIso, ui.todayStatus, ui.checkinLoading, ui.justCelebrated, vm::checkin, { vm.setMentorOpen(true) }, vm::openHowTo)
                            }
                            PathRow(ui.streak, ui.todayIso, ui.activePlan?.weekNumber ?: 1, ui.activePlan?.winCondition) { vm.openJourney() }
                            EntryTiles(ui.micLocked, ui.todayEmotion != null, { vm.openJourney() }, { vm.setMentorOpen(true) })
                        }

                    else -> DiscoveryStage { vm.setMentorOpen(true) }
                }
            }
        }

        // ── anchored dropdowns ──
        GoalMenu(
            menuOpen, { menuOpen = false }, ui.sessions, ui.activeSessionId, ui.isPlanApproved,
            onNewGoal = vm::newGoal, onSelect = vm::selectSession, onOpenArchive = { vm.openJourney("archive") }, onStopSession = { vm.setShowCompleteModal(true) },
            modifier = Modifier.align(Alignment.TopStart).statusBarsPadding().padding(start = 12.dp, top = 56.dp),
        )
        StreakPanel(
            streakOpen, { streakOpen = false }, ui.streak, ui.todayIso, ui.todayStatus == "done",
            modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(end = 12.dp, top = 56.dp),
        )
        ProfileMenu(
            profileOpen, { profileOpen = false }, ui.userName.ifBlank { "User" },
            ui.me?.createdAt?.let { joinedLabel(it) },
            onReplayTour = { vm.prefs.startDemo(ui.userId) },
            onDownload = { exportError = null; exporting = true; scope.launch { vm.downloadMyData().onFailure { exportError = "Export failed." }; exporting = false } },
            onDelete = { showDelete = true }, onLogout = vm::logout,
            modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(end = 12.dp, top = 56.dp),
            exporting = exporting, exportError = exportError,
        )

        // ── mentor + overlays ──
        MentorDrawer(
            ui.mentorOpen, { vm.setMentorOpen(false) }, ui.messages, ui.isLoading, ui.isPlanApproved, ui.isFirstPlan,
            inputDisabled = ui.isLoading, onSend = { vm.sendMessage(it) }, onApprovePlan = { vm.approvePlan(it) },
            onRequestPlanChange = vm::requestPlanChange, onPlanDialog = { planDialog = it },
        )
        CeremonyOverlay(ui.showCeremony, ui.activePlan?.weekNumber ?: 1)
        WeeksSheet(ui.weeksOpen, { vm.setWeeksOpen(false) }, ui.activePlan?.weekNumber ?: 1, ui.micLocked, ui.activePlan, ui.planHistory, ui.reports)

        (planDialog as? PlanDialog.Commit)?.let { d ->
            ConfirmDialog(true, "Commit to this week?", "Once you commit, this week's plan is set until the week wraps — no mid-week renegotiation, that's what makes it work. Next week always adapts to how this one goes. ${d.windowLine}", "I'm committing to this", "Not yet", onConfirm = d.onConfirm) { planDialog = null }
        }
        (planDialog as? PlanDialog.Stale)?.let { d -> StalePlanDialog(d) { planDialog = null } }

        SetupQuestionsModal(ui.setupQuestions, vm::submitSetupAnswers)
        NextWeekStartModal(ui.nextWeekAsk, vm::dismissNextWeekAsk, vm::confirmNextWeekStart)
        HowToModal(ui.howTo, howToGuide, howToLoading, howToError, { vm.openHowTo(null) }, vm::askMentorAboutHowTo)
        EmailAlertsModal(vm)
        CalendarMaintenanceModal(ui.showCalendarMaintenance, { vm.setShowCalendarMaintenance(false) }, vm::openEmailModal)
        PlanInfoModal(ui.showPlanInfo) { vm.setShowPlanInfo(false) }
        BlockedDialog(ui.blockedNotice) { vm.setBlockedNotice(null) }
        SessionCompleteModal(ui.showCompleteModal, ui.sessionFocus, { vm.setShowCompleteModal(false) }) { vm.completeSessionNow() }
        ConfirmDialog(ui.lockError != null, "Couldn't lock the plan", ui.lockError.orEmpty(), "Got it", "Close", onConfirm = vm::dismissLockError, onCancel = vm::dismissLockError)
        DeleteAccountModal(showDelete, { showDelete = false }) { showDelete = false; vm.logout() }
        ConsentGate(vm, vm::logout)
    }
}

private fun initialsOf(name: String): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.isEmpty() -> "U"
        parts.size == 1 -> parts[0].first().uppercase()
        else -> (parts.first().first().toString() + parts.last().first()).uppercase()
    }
}

/** "Joined June 2026" — the month name stays English, as on the web. */
private fun joinedLabel(createdAt: String): String? = runCatching {
    val date = java.time.OffsetDateTime.parse(createdAt).toLocalDate()
    date.format(java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy", java.util.Locale.US))
}.getOrElse {
    runCatching {
        java.time.LocalDateTime.parse(createdAt.substringBefore('Z')).toLocalDate()
            .format(java.time.format.DateTimeFormatter.ofPattern("MMMM yyyy", java.util.Locale.US))
    }.getOrNull()
}
