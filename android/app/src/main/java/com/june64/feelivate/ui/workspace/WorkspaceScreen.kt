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
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.june64.feelivate.data.TaskHowTo
import com.june64.feelivate.data.userMessage
import com.june64.feelivate.ui.feedback.FeedbackModal
import com.june64.feelivate.ui.feedback.FeedbackState
import com.june64.feelivate.ui.feedback.FeedbackTab
import com.june64.feelivate.ui.journey.EmotionOrb
import com.june64.feelivate.ui.journey.JourneyScreen
import com.june64.feelivate.ui.theme.tokens
import com.june64.feelivate.ui.tour.DEMO_ARCHIVE
import com.june64.feelivate.ui.tour.DEMO_EMOTION
import com.june64.feelivate.ui.tour.DEMO_PLAN
import com.june64.feelivate.ui.tour.DEMO_STREAK
import com.june64.feelivate.ui.tour.GuidedTour
import com.june64.feelivate.ui.tour.LocalTourRegistry
import com.june64.feelivate.ui.tour.TourRegistry
import com.june64.feelivate.ui.tour.TourState
import kotlinx.coroutines.launch

/**
 * WorkspacePage.tsx — the mission surface on a phone: the top bar, one stage,
 * the mentor drawer, and every overlay the web mounts at the page root.
 *
 * While the walkthrough runs, every `ui*` value below reads from its scene
 * instead of the account, so the tour never touches the backend or the user's
 * real data (the web does the same with its demo mirrors).
 */
@Composable
fun WorkspaceScreen(onSignedOut: () -> Unit, onOpenPage: (String) -> Unit, vm: WorkspaceViewModel = viewModel()) {
    val t = tokens()
    val ui = vm.ui
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val feedback = remember { FeedbackState(context.applicationContext) }
    val tour = remember { TourState(scope) }
    val registry = remember { TourRegistry() }

    LaunchedEffect(vm.signedOut) { if (vm.signedOut) onSignedOut() }
    LaunchedEffect(Unit) { vm.feedback = feedback; feedback.loadEligibility(); feedback.startTimer() }

    // ── the walkthrough's mirrors ──
    val sc = if (tour.active) tour.scene else null
    val uiMessages = sc?.messages ?: ui.messages
    val uiLoading = if (sc != null) tour.typing else ui.isLoading
    val uiPlanApproved = sc?.planApproved ?: ui.isPlanApproved
    val uiPlan = if (sc != null) DEMO_PLAN else ui.activePlan
    val uiStreak = if (sc != null) DEMO_STREAK else ui.streak
    val uiFinished = sc?.finished ?: ui.isFinishedStage
    val uiEmotion = if (sc != null) (if (sc.emotion) DEMO_EMOTION else null) else ui.todayEmotion
    val uiJourneyOpen = if (sc != null) sc.view == "journey" else ui.journeyOpen
    val uiEmpty = uiMessages.isEmpty() && !uiLoading
    val uiPlanning = !uiPlanApproved && uiPlan != null && !uiEmpty && !uiFinished
    // Demo drawer rule: open while the scripted conversation is being built,
    // closed once the scene locks the plan or shows the finished goal.
    val uiMentorOpen = if (sc != null) (sc.view == "chat" && sc.messages.isNotEmpty() && !sc.planApproved && !sc.finished) else ui.mentorOpen

    // New accounts get the walkthrough once; "Replay tutorial" queues it again.
    LaunchedEffect(ui.consent.status, ui.userId) {
        if (ui.consent.status == ConsentStatus.Clear && vm.prefs.isDemoQueued(ui.userId) && !tour.active) {
            tour.start { vm.prefs.completeDemo(ui.userId) }
        }
    }

    // The feedback prompt must never interrupt: while the mentor is replying, a
    // ceremony is running, the tour is on, or a dialog is up, it stands down.
    val busy = ui.isLoading || ui.showCeremony || ui.setupQuestions != null || ui.blockedNotice != null ||
        ui.showEmailModal || ui.showCompleteModal || ui.nextWeekAsk != null || ui.howTo != null ||
        ui.consent.status != ConsentStatus.Clear || ui.journeyOpen || tour.active
    LaunchedEffect(busy) { feedback.setBusy("workspace", busy) }

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
    val uiGoalMenuOpen = sc?.goalMenuOpen ?: menuOpen
    val uiWeeksOpen = if (sc != null) sc.selectedWeek != null else ui.weeksOpen

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

    CompositionLocalProvider(LocalTourRegistry provides registry) {
        Box(Modifier.fillMaxSize().background(t.bgPrimary)) {
            // The Journey replaces the whole mission surface, as the web's view swap does.
            if (uiJourneyOpen) {
                JourneyScreen(
                    sessionId = ui.activeSessionId,
                    initialTab = if (sc != null) sc.journeyTab else ui.journeyTab,
                    onClose = vm::closeJourney,
                    onJournalSaved = vm::onJournalSaved,
                    onPlanNextWeek = { week -> vm.closeJourney(); vm.askNextWeekStart(week) },
                    demoBetweenWeeks = sc?.betweenWeeks,
                    demoArchive = if (sc != null) DEMO_ARCHIVE else null,
                    demoArchiveWeek = sc?.archiveWeek,
                )
            } else {
                Column(Modifier.fillMaxSize().statusBarsPadding()) {
                    MissionTopBar(
                        goalLabel = ui.goalLabelRaw,
                        menuOpen = uiGoalMenuOpen, onToggleMenu = { menuOpen = !menuOpen; streakOpen = false; profileOpen = false },
                        streak = uiStreak, isPlanActive = uiPlanApproved,
                        streakOpen = streakOpen, onToggleStreak = { streakOpen = !streakOpen; menuOpen = false; profileOpen = false },
                        initials = initialsOf(ui.userName), onToggleProfile = { profileOpen = !profileOpen; menuOpen = false; streakOpen = false },
                        onOpenWeeks = { vm.setWeeksOpen(true) },
                        onOpenArchive = { vm.openJourney("archive") },
                        onOpenAlerts = vm::openEmailModal,
                        onOpenCalendar = { vm.setShowCalendarMaintenance(true) },
                    )
                    Box(Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).navigationBarsPadding()) {
                        when {
                            uiEmpty && !uiPlanApproved && !uiFinished ->
                                GoalStart(ui.userName.substringBefore(' '), uiLoading) { vm.sendMessage(it) }

                            uiFinished ->
                                FinishedStage(
                                    title = if (sc != null) DEMO_PLAN.theme else ui.sessionFocus.takeIf { it.isNotBlank() } ?: ui.activePlan?.theme?.takeIf { it.isNotBlank() } ?: "This goal is closed.",
                                    onTalk = { vm.setMentorOpen(true) }, onArchive = { vm.openJourney("archive") }, onNewGoal = vm::newGoal,
                                )

                            uiPlanning ->
                                CommitStage(uiPlan!!, ui.isFirstPlan, { vm.approvePlan(it) }, vm::requestPlanChange, { vm.setMentorOpen(true) }, { planDialog = it })

                            uiPlanApproved ->
                                Column(
                                    Modifier.fillMaxWidth().widthIn(max = 820.dp).padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 60.dp),
                                    verticalArrangement = Arrangement.spacedBy(14.dp),
                                ) {
                                    val rec = if (sc == null) ui.recoveryInfo else null
                                    if (!ui.weekOver && rec != null) RecoveryCard(vm, rec, ui.commitmentWhy, ui.sessionFocus)
                                    StreakStrip(uiStreak, ui.todayStatus == "done")
                                    when {
                                        sc == null && ui.notStartedYet -> NotStartedCard(ui.activePlan, ui.planStartsOn!!, ui.daysUntilStart, { vm.openJourney() }, { vm.setMentorOpen(true) })
                                        sc == null && ui.weekOver -> WeekOverCard(ui.activePlan?.weekNumber ?: 1, { vm.openJourney() }, { vm.askNextWeekStart((ui.activePlan?.weekNumber ?: 1) + 1) })
                                        else -> TodayCard(uiPlan, ui.todayIso, ui.todayStatus, ui.checkinLoading, ui.justCelebrated, vm::checkin, { vm.setMentorOpen(true) }, vm::openHowTo, demo = sc != null)
                                    }
                                    PathRow(uiStreak, ui.todayIso, uiPlan?.weekNumber ?: 1, uiPlan?.winCondition) { vm.openJourney() }
                                    EntryTiles(ui.micLocked, uiEmotion != null, { vm.openJourney() }, { vm.setMentorOpen(true) })
                                }

                            else -> DiscoveryStage { vm.setMentorOpen(true) }
                        }
                    }
                }
            }

            // Today's mood, draggable anywhere once the evening note is in.
            uiEmotion?.let { e -> EmotionOrb(e, vm.prefs) { vm.openJourney() } }

            // ── anchored dropdowns ──
            GoalMenu(
                uiGoalMenuOpen, { menuOpen = false }, ui.sessions, ui.activeSessionId, uiPlanApproved,
                onNewGoal = vm::newGoal, onSelect = vm::selectSession, onOpenArchive = { vm.openJourney("archive") }, onStopSession = { vm.setShowCompleteModal(true) },
                modifier = Modifier.align(Alignment.TopStart).statusBarsPadding().padding(start = 12.dp, top = 56.dp),
            )
            StreakPanel(
                streakOpen, { streakOpen = false }, uiStreak, ui.todayIso, ui.todayStatus == "done",
                modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(end = 12.dp, top = 56.dp),
            )
            ProfileMenu(
                profileOpen, { profileOpen = false }, ui.userName.ifBlank { "User" },
                ui.me?.createdAt?.let { joinedLabel(it) },
                onReplayTour = { tour.start { vm.prefs.completeDemo(ui.userId) } },
                onDownload = { exportError = null; exporting = true; scope.launch { vm.downloadMyData().onFailure { exportError = "Export failed." }; exporting = false } },
                onDelete = { showDelete = true }, onLogout = vm::logout, onOpenPage = onOpenPage,
                modifier = Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(end = 12.dp, top = 56.dp),
                exporting = exporting, exportError = exportError,
            )

            // ── mentor + overlays ──
            MentorDrawer(
                uiMentorOpen, { if (sc == null) vm.setMentorOpen(false) }, uiMessages, uiLoading, uiPlanApproved, ui.isFirstPlan,
                inputDisabled = uiLoading || sc != null, onSend = { vm.sendMessage(it) }, onApprovePlan = { vm.approvePlan(it) },
                onRequestPlanChange = vm::requestPlanChange, onPlanDialog = { planDialog = it },
            )
            CeremonyOverlay(ui.showCeremony, ui.activePlan?.weekNumber ?: 1)
            WeeksSheet(
                uiWeeksOpen, { vm.setWeeksOpen(false) }, uiPlan?.weekNumber ?: 1, ui.micLocked,
                uiPlan, if (sc != null) emptyList() else ui.planHistory, if (sc != null) emptyList() else ui.reports,
                demoSelectedWeek = sc?.selectedWeek,
            )

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
            FeedbackTab(feedback)
            FeedbackModal(feedback, ui.activeSessionId)
            GuidedTour(tour)
        }
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
