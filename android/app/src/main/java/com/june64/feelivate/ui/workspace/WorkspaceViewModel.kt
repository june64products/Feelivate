package com.june64.feelivate.ui.workspace

import android.app.Application
import android.content.ContentValues
import android.os.Environment
import android.provider.MediaStore
import android.widget.Toast
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.BlockedNotice
import com.june64.feelivate.data.ChatMessage
import com.june64.feelivate.data.ChatRequest
import com.june64.feelivate.data.CheckinRequest
import com.june64.feelivate.data.ConsentItem
import com.june64.feelivate.data.ConsentSubmit
import com.june64.feelivate.data.DayStatus
import com.june64.feelivate.data.EmotionEntry
import com.june64.feelivate.data.Me
import com.june64.feelivate.data.Plan
import com.june64.feelivate.data.Prefs
import com.june64.feelivate.data.RecoveryRequest
import com.june64.feelivate.data.SendOtpRequest
import com.june64.feelivate.data.SessionSummary
import com.june64.feelivate.data.SetupQuestion
import com.june64.feelivate.data.SlipReasonRequest
import com.june64.feelivate.data.Streak
import com.june64.feelivate.data.TokenStore
import com.june64.feelivate.data.UpdateTimeRequest
import com.june64.feelivate.data.UserIdRequest
import com.june64.feelivate.data.VerifyOtpRequest
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.data.isConsentRequired
import com.june64.feelivate.data.userMessage
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.TimeZone

/* ── State mirrors of WorkspacePage.tsx ── */

enum class ConsentStatus { Checking, Blocking, Clear }
enum class EmailStep { Email, Otp, Time, Subscribed }

data class HowToTarget(val day: String, val action: String)
data class NextWeekAsk(val week: Int, val earliest: String, val text: String)
data class RecoveryInfo(val wasShielded: Boolean, val missCount: Int, val missedDateIso: String)

data class EmailUi(
    val step: EmailStep = EmailStep.Email,
    val email: String = "",
    val otp: String = "",
    val preferredTime: String = "08:00",
    val loading: Boolean = false,
    val message: String = "",
    val error: String = "",
    val enabled: Boolean = false,
    val subscribedEmail: String? = null,
    val subscribedTime: String = "08:00",
)

data class ConsentUi(
    val status: ConsentStatus = ConsentStatus.Checking,
    val catalogue: List<ConsentItem> = emptyList(),
    val decisions: Map<String, Boolean> = emptyMap(),
    val loading: Boolean = false,
    val saving: Boolean = false,
    val error: String = "",
)

data class WorkspaceUi(
    val userId: String = "",
    val userName: String = "",
    val me: Me? = null,
    val activeSessionId: String? = null,
    val sessions: List<SessionSummary> = emptyList(),
    val reports: List<com.june64.feelivate.data.ArchivedWeekReport> = emptyList(),
    val messages: List<ChatMessage> = emptyList(),
    val activePlan: Plan? = null,
    val planHistory: List<Plan> = emptyList(),
    val isPlanApproved: Boolean = false,
    val planStartsOn: String? = null,
    val isSessionCompleted: Boolean = false,
    val sessionFocus: String = "",
    val commitmentWhy: String? = null,
    val isLoading: Boolean = false,
    val sessionLoading: Boolean = false,
    // streak (useStreak.ts)
    val streak: Streak? = null,
    val todayStatus: String = "pending",
    val checkinLoading: Boolean = false,
    val justCelebrated: Boolean = false,
    // journal
    val todayEmotion: EmotionEntry? = null,
    val micLocked: Boolean = false,
    // surfaces
    val mentorOpen: Boolean = false,
    val showCeremony: Boolean = false,
    val setupQuestions: List<SetupQuestion>? = null,
    val blockedNotice: BlockedNotice? = null,
    val howTo: HowToTarget? = null,
    val nextWeekAsk: NextWeekAsk? = null,
    val showEmailModal: Boolean = false,
    val showCalendarMaintenance: Boolean = false,
    val showPlanInfo: Boolean = false,
    val showCompleteModal: Boolean = false,
    val weeksOpen: Boolean = false,
    val journeyOpen: Boolean = false,
    val journeyTab: String = "overview",
    val lockError: String? = null,
    val email: EmailUi = EmailUi(),
    val consent: ConsentUi = ConsentUi(),
) {
    val todayIso: String get() = WeekWindow.today()
    val isEmptyState: Boolean get() = messages.isEmpty() && !isLoading
    val isFinishedStage: Boolean get() = isSessionCompleted
    val isPlanningStage: Boolean get() = !isPlanApproved && activePlan != null && !isEmptyState && !isFinishedStage
    val weekOver: Boolean get() = isPlanApproved && WeekWindow.planWeekOver(activePlan, todayIso)
    val notStartedYet: Boolean get() = isPlanApproved && planStartsOn != null && planStartsOn > todayIso
    val daysUntilStart: Int get() = if (notStartedYet) WeekWindow.daysBetween(todayIso, planStartsOn!!) else 0
    val isFirstPlan: Boolean get() = planHistory.isEmpty()
    val goalLabelRaw: String get() {
        val active = sessions.firstOrNull { it.id == activeSessionId }
        return active?.title?.takeIf { it.isNotBlank() } ?: sessionFocus.takeIf { it.isNotBlank() } ?: active?.focusPreview?.takeIf { it.isNotBlank() } ?: "New goal"
    }

    /** WorkspacePage.recoveryInfo, verbatim. */
    val recoveryInfo: RecoveryInfo? get() {
        if (!isPlanApproved || todayStatus != "pending") return null
        val days = streak?.daysThisWeek ?: return null
        if (days.isEmpty()) return null
        val plan = activePlan ?: return null
        val planStart = plan.startDate.orEmpty()
        if (planStart.isEmpty()) return null
        fun missedOn(iso: String): String? {
            if (iso < planStart) return null
            val entry = WeekWindow.planEntryFor(plan, iso)
            if (entry == null || WeekWindow.isRestAction(entry.action)) return null
            val row = days.firstOrNull { it.date == iso } ?: return null
            return when (row.status) { "shielded" -> "shielded"; "skipped", "pending" -> "missed"; else -> null }
        }
        val yIso = WeekWindow.isoDaysAgo(todayIso, 1)
        val yState = missedOn(yIso) ?: return null
        var missCount = 0
        for (back in 1..7) {
            val iso = WeekWindow.isoDaysAgo(todayIso, back)
            if (iso < planStart) break
            val entry = WeekWindow.planEntryFor(plan, iso)
            if (entry == null || WeekWindow.isRestAction(entry.action)) continue
            if (missedOn(iso) != null) missCount += 1 else break
        }
        return RecoveryInfo(yState == "shielded", maxOf(1, missCount), yIso)
    }
}

class WorkspaceViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient.get(app)
    private val store = TokenStore(app)
    val prefs = Prefs(app)
    var ui by mutableStateOf(WorkspaceUi(userId = store.userId.orEmpty(), userName = store.userName.orEmpty(), activeSessionId = store.activeSessionId))
        private set
    var signedOut by mutableStateOf(false)
        private set
    private var celebrateJob: Job? = null
    private var ceremonyJob: Job? = null
    private val tweakCount = HashMap<String, Int>()

    val timezone: String get() = TimeZone.getDefault().id
    val tzShort: String get() = TimeZone.getDefault().getDisplayName(TimeZone.getDefault().inDaylightTime(java.util.Date()), TimeZone.SHORT)

    init {
        loadConsent()
        loadSessions()
        loadEmailStatus()
        loadTodayEmotion(ui.activeSessionId)
        ui = ui.copy(micLocked = prefs.journalLockedToday(ui.userId, ui.activeSessionId))
        viewModelScope.launch { runCatching { api.me() }.onSuccess { ui = ui.copy(me = it, userName = it.name?.takeIf { n -> n.isNotBlank() } ?: ui.userName) } }
        if (ui.activeSessionId != null) loadSession(ui.activeSessionId!!)
    }

    // ── consent gate (ConsentGate.tsx) ──
    fun loadConsent() {
        ui = ui.copy(consent = ui.consent.copy(loading = true, error = ""))
        viewModelScope.launch {
            runCatching { api.consents() }.onSuccess { data ->
                val decisions = data.catalogue.associate { it.key to (if (it.required) false else data.state[it.key]?.granted == true) }
                val missing = data.missing.isNotEmpty()
                ui = ui.copy(consent = ui.consent.copy(loading = false, catalogue = data.catalogue, decisions = decisions, status = if (missing) ConsentStatus.Blocking else ConsentStatus.Clear))
            }.onFailure {
                ui = ui.copy(consent = ui.consent.copy(loading = false, error = "Could not load the consent terms. Please refresh and try again.", status = ConsentStatus.Clear))
            }
        }
    }
    fun setConsentDecision(key: String, v: Boolean) { ui = ui.copy(consent = ui.consent.copy(decisions = ui.consent.decisions + (key to v))) }
    fun submitConsent() {
        ui = ui.copy(consent = ui.consent.copy(saving = true, error = ""))
        viewModelScope.launch {
            runCatching { api.submitConsents(ConsentSubmit(ui.consent.decisions)) }
                .onSuccess { ui = ui.copy(consent = ui.consent.copy(saving = false, status = ConsentStatus.Clear)) }
                .onFailure { e -> ui = ui.copy(consent = ui.consent.copy(saving = false, error = e.userMessage("Could not save your choices."))) }
        }
    }
    private fun consentRequired() { ui = ui.copy(consent = ui.consent.copy(status = ConsentStatus.Blocking)); loadConsent() }

    // ── sessions ──
    fun loadSessions() {
        viewModelScope.launch { runCatching { api.sessions(ui.userId) }.onSuccess { ui = ui.copy(sessions = it) } }
    }

    private fun loadSession(sessionId: String) {
        viewModelScope.launch {
            ui = ui.copy(isLoading = true, sessionLoading = true)
            runCatching { api.sessionDetail(sessionId) }.onSuccess { data ->
                var msgs = data.messages
                if (data.phase == "planning" && data.plan != null && msgs.isNotEmpty()) {
                    val last = msgs.indexOfLast { it.role == "assistant" }
                    if (last >= 0) msgs = msgs.toMutableList().also { it[last] = it[last].copy(plan = data.plan) }
                }
                ui = ui.copy(
                    messages = msgs, activePlan = data.plan, planHistory = data.planHistory,
                    isPlanApproved = data.phase == "active", planStartsOn = data.planStartsOn,
                    isSessionCompleted = data.phase == "completed", sessionFocus = data.focus.orEmpty(),
                    commitmentWhy = data.commitmentWhy, isLoading = false, sessionLoading = false,
                )
                if (data.phase == "active") loadStreak(backfill = true)
            }.onFailure { e ->
                if (e.isConsentRequired()) consentRequired()
                val msg = e.userMessage()
                if (msg.contains("Session expired") || msg.contains("404") || (e as? retrofit2.HttpException)?.code() == 404) {
                    store.activeSessionId = null
                    ui = ui.copy(activeSessionId = null)
                }
                ui = ui.copy(messages = emptyList(), activePlan = null, isLoading = false, sessionLoading = false)
            }
        }
    }

    fun selectSession(id: String) {
        store.activeSessionId = id
        ui = ui.copy(activeSessionId = id, todayEmotion = null, isSessionCompleted = false, journeyOpen = false, micLocked = prefs.journalLockedToday(ui.userId, id))
        loadTodayEmotion(id)
        loadSession(id)
    }

    fun newGoal() {
        store.activeSessionId = null
        ui = ui.copy(activeSessionId = null, messages = emptyList(), activePlan = null, isPlanApproved = false, isSessionCompleted = false, planStartsOn = null, sessionFocus = "", planHistory = emptyList(), journeyOpen = false)
    }

    fun logout() { store.clear(); signedOut = true }

    // ── streak (useStreak.ts) ──
    private fun loadStreak(backfill: Boolean = false) {
        viewModelScope.launch {
            val today = WeekWindow.today()
            if (backfill) runCatching { api.backfill(today) }.onSuccess { r ->
                val prev = ui.streak
                ui = ui.copy(streak = Streak(r.currentStreak, r.longestStreak, r.totalDone, prev?.lastCheckin, prev?.daysThisWeek ?: emptyList(), false, prev?.shieldsLeft))
            }
            runCatching { api.streak(ui.userId, today) }.onSuccess { data ->
                val entry = data.daysThisWeek.firstOrNull { it.date == today }
                ui = ui.copy(streak = data, todayStatus = if (entry != null && entry.status != "shielded") entry.status else "pending")
            }
        }
    }

    fun checkin(status: String) {
        if (ui.checkinLoading) return
        ui = ui.copy(checkinLoading = true)
        viewModelScope.launch {
            val today = WeekWindow.today()
            runCatching { api.checkin(CheckinRequest(status = status, clientDate = today)) }.onSuccess { r ->
                val prev = ui.streak
                val days = prev?.daysThisWeek?.map { if (it.date == today) it.copy(status = status) else it } ?: listOf(DayStatus(today, status))
                ui = ui.copy(todayStatus = status, streak = Streak(r.currentStreak, r.longestStreak, r.totalDone, r.date, days, false, r.shieldsLeft ?: prev?.shieldsLeft))
                if (status == "done") {
                    celebrateJob?.cancel()
                    ui = ui.copy(justCelebrated = true)
                    celebrateJob = launch { delay(2400); ui = ui.copy(justCelebrated = false) }
                }
                loadStreak()
            }
            ui = ui.copy(checkinLoading = false)
        }
    }

    /** The Journey saved tonight's note: the orb lights up and the mic locks. */
    fun onJournalSaved(entry: com.june64.feelivate.data.JournalEntry) {
        prefs.lockJournalToday(ui.userId, ui.activeSessionId)
        ui = ui.copy(
            micLocked = true,
            todayEmotion = EmotionEntry(entry.id, entry.date, entry.emotionLabel, entry.emotionScore.toFloat(), entry.oneLiner),
        )
        loadStreak()
    }

    // ── journal / orb ──
    private fun loadTodayEmotion(sessionId: String?) {
        viewModelScope.launch {
            runCatching { api.todayEmotion(ui.userId, sessionId, WeekWindow.today()) }
                .onSuccess { ui = ui.copy(todayEmotion = if (it.hasEntry) it.entry else null) }
        }
    }

    // ── chat (handleSendMessage) ──
    private fun nextWeekRequestText(week: Int) = "I've reviewed my week report. Please build me Week $week plan based on my performance data and what I need to improve."

    fun askNextWeekStart(week: Int, text: String? = null, earliestFromServer: String? = null) {
        val planStart = ui.activePlan?.startDate?.takeIf { it.isNotBlank() }
        val earliest = earliestFromServer ?: (if (planStart != null) WeekWindow.addDays(WeekWindow.windowFrom(planStart).end, 1) else WeekWindow.today())
        ui = ui.copy(nextWeekAsk = NextWeekAsk(week, earliest, text ?: nextWeekRequestText(week)))
    }
    fun dismissNextWeekAsk() { ui = ui.copy(nextWeekAsk = null) }
    fun confirmNextWeekStart(iso: String) {
        val ask = ui.nextWeekAsk ?: return
        ui = ui.copy(nextWeekAsk = null, journeyOpen = false)
        sendMessage(ask.text, iso)
    }

    fun sendMessage(text: String, startDate: String? = null) {
        if (ui.userId.isBlank()) return
        ui = ui.copy(messages = ui.messages + ChatMessage("user", text), isLoading = true, mentorOpen = true)
        viewModelScope.launch {
            runCatching { api.chat(ChatRequest(text, ui.activeSessionId, ui.userId, timezone, startDate)) }.onSuccess { res ->
                res.needsStartDate?.let { nsd ->
                    val msgs = ui.messages
                    ui = ui.copy(messages = if (msgs.isNotEmpty() && msgs.last().role == "user") msgs.dropLast(1) else msgs, isLoading = false)
                    askNextWeekStart(nsd.week, text, nsd.earliest)
                    return@onSuccess
                }
                if (ui.activeSessionId == null && res.sessionId != null) {
                    store.activeSessionId = res.sessionId
                    ui = ui.copy(activeSessionId = res.sessionId)
                    loadSessions()
                }
                ui = ui.copy(messages = ui.messages + ChatMessage("assistant", res.reply, plan = res.plan, safety = res.safety, blocked = res.blocked), isLoading = false)
                if (res.blocked != null) ui = ui.copy(blockedNotice = res.blocked)
                if (!res.questions.isNullOrEmpty() && res.plan == null) ui = ui.copy(setupQuestions = res.questions)
                if (res.plan != null) ui = ui.copy(activePlan = res.plan, isPlanApproved = false)
            }.onFailure { e ->
                if (e.isConsentRequired()) consentRequired()
                ui = ui.copy(messages = ui.messages + ChatMessage("assistant", "I'm sorry, I encountered an issue. Let's try that again."), isLoading = false)
            }
        }
    }

    fun submitSetupAnswers(text: String, startDate: String) { ui = ui.copy(setupQuestions = null); sendMessage(text, startDate) }

    fun requestPlanChange(text: String) {
        sendMessage("I'd like to change some parts of this plan: $text")
        val sid = ui.activeSessionId ?: return
        tweakCount[sid] = (tweakCount[sid] ?: 0) + 1
    }

    fun approvePlan(startDate: String?) {
        val sid = ui.activeSessionId ?: return
        viewModelScope.launch {
            runCatching { api.approvePlan(sid, WeekWindow.today(), startDate) }.onSuccess { res ->
                if (res.status == "approved") {
                    ceremonyJob?.cancel()
                    ui = ui.copy(isPlanApproved = true, planStartsOn = res.startsOn, mentorOpen = false, showCeremony = true)
                    ceremonyJob = launch { delay(2300); ui = ui.copy(showCeremony = false) }
                    runCatching { api.sessionDetail(sid) }.onSuccess { data ->
                        ui = ui.copy(messages = data.messages, activePlan = data.plan ?: ui.activePlan, planHistory = data.planHistory, planStartsOn = data.planStartsOn ?: ui.planStartsOn)
                    }
                    loadStreak(backfill = true)
                    loadSessions()
                }
            }.onFailure { e ->
                ui = ui.copy(blockedNotice = null, lockError = e.userMessage("Could not lock the plan. Please try again."))
            }
        }
    }
    fun dismissLockError() { ui = ui.copy(lockError = null) }

    // ── surfaces ──
    fun setMentorOpen(v: Boolean) { ui = ui.copy(mentorOpen = v) }
    fun setBlockedNotice(v: BlockedNotice?) { ui = ui.copy(blockedNotice = v) }
    fun openHowTo(t: HowToTarget?) { ui = ui.copy(howTo = t) }
    fun askMentorAboutHowTo(t: HowToTarget) {
        ui = ui.copy(howTo = null, mentorOpen = true)
        sendMessage("I read the quick guide for ${t.day}'s task but I'm still not sure how to do it: \"${t.action}\". Please explain it step by step, simpler — no new plan, just help me do this one.")
    }
    fun setShowCalendarMaintenance(v: Boolean) { ui = ui.copy(showCalendarMaintenance = v) }
    fun setShowPlanInfo(v: Boolean) { ui = ui.copy(showPlanInfo = v) }
    fun setShowCompleteModal(v: Boolean) { ui = ui.copy(showCompleteModal = v) }
    fun setWeeksOpen(v: Boolean) {
        ui = ui.copy(weeksOpen = v)
        val sid = ui.activeSessionId
        if (v && sid != null && ui.reports.isEmpty()) viewModelScope.launch {
            runCatching { api.sessionReports(sid, WeekWindow.today()) }.onSuccess { ui = ui.copy(reports = it) }
        }
    }
    fun openJourney(tab: String = "overview") { ui = ui.copy(journeyOpen = true, journeyTab = tab) }
    fun closeJourney() { ui = ui.copy(journeyOpen = false, journeyTab = "overview") }

    fun completeSession() {
        val sid = ui.activeSessionId ?: return
        viewModelScope.launch {
            runCatching { api.completeSession(sid) }
                .onSuccess { ui = ui.copy(isSessionCompleted = true, isPlanApproved = false, showCompleteModal = false); loadSessions() }
                .onFailure { throw it }
        }
    }
    suspend fun completeSessionNow(): Boolean {
        val sid = ui.activeSessionId ?: return false
        return runCatching { api.completeSession(sid) }.onSuccess { ui = ui.copy(isSessionCompleted = true, isPlanApproved = false, showCompleteModal = false); loadSessions() }.isSuccess
    }

    // ── recovery card helpers ──
    suspend fun recoveryLine(missCount: Int, focus: String?): String {
        val today = WeekWindow.today()
        prefs.recoveryLine(today, missCount)?.let { return it }
        return runCatching { api.recoveryMotivation(RecoveryRequest(missCount, focus?.takeIf { it.isNotBlank() })).line }
            .getOrNull()?.takeIf { it.isNotBlank() }?.also { prefs.saveRecoveryLine(today, missCount, it) }
            ?: "One lapse never broke a habit. Walking away did — and you just walked back in."
    }
    suspend fun saveSlipReason(dateIso: String, chip: String): Boolean =
        runCatching { api.slipReason(SlipReasonRequest(dateIso, chip.lowercase(), ui.activeSessionId)) }.onSuccess { prefs.saveSlipReason(dateIso, chip) }.isSuccess

    // ── email alerts (WorkspacePage handlers) ──
    private fun loadEmailStatus() {
        viewModelScope.launch {
            runCatching { api.emailStatus(ui.userId) }.onSuccess { res ->
                var e = ui.email.copy(enabled = res.enabled, subscribedEmail = res.notificationEmail)
                if (!res.preferredTime.isNullOrBlank()) e = e.copy(subscribedTime = res.preferredTime, preferredTime = res.preferredTime)
                if (res.enabled) e = e.copy(step = EmailStep.Subscribed)
                ui = ui.copy(email = e)
                if (res.enabled && res.preferredTimezone != timezone) runCatching { api.updateTime(UpdateTimeRequest(ui.userId, res.preferredTime ?: "08:00", timezone)) }
            }
        }
    }
    private fun email(f: (EmailUi) -> EmailUi) { ui = ui.copy(email = f(ui.email)) }
    fun openEmailModal() {
        email { it.copy(error = "", message = "", otp = "", step = if (it.enabled) EmailStep.Subscribed else EmailStep.Email, email = if (it.enabled) it.email else "") }
        ui = ui.copy(showEmailModal = true)
    }
    fun closeEmailModal() { ui = ui.copy(showEmailModal = false) }
    fun setNotifEmail(v: String) = email { it.copy(email = v) }
    fun setNotifOtp(v: String) = email { it.copy(otp = v.filter { c -> c.isDigit() }.take(6)) }
    fun setNotifTime(v: String) = email { it.copy(preferredTime = v) }
    fun emailBackToEmail() = email { it.copy(step = EmailStep.Email, error = "", message = "") }
    fun emailChangeTime() = email { it.copy(step = EmailStep.Time, error = "") }
    fun sendOtp() {
        val e = ui.email; if (e.email.isBlank()) return
        email { it.copy(loading = true, error = "", message = "") }
        viewModelScope.launch {
            runCatching { api.sendOtp(SendOtpRequest(ui.userId, e.email.trim())) }
                .onSuccess { email { it.copy(loading = false, message = "Code sent — check your inbox.", step = EmailStep.Otp) } }
                .onFailure { err -> email { it.copy(loading = false, error = err.userMessage("Couldn't send the code. Please try again.")) } }
        }
    }
    fun verifyOtp() {
        val e = ui.email; if (e.otp.isBlank()) return
        email { it.copy(loading = true, error = "") }
        viewModelScope.launch {
            runCatching { api.verifyOtp(VerifyOtpRequest(ui.userId, e.email.trim(), e.otp.trim(), ui.activeSessionId, e.preferredTime, timezone)) }
                .onSuccess { email { it.copy(loading = false, subscribedEmail = e.email.trim(), enabled = true, step = EmailStep.Time) } }
                .onFailure { err -> email { it.copy(loading = false, error = err.userMessage("OTP is incorrect. Please check your email.")) } }
        }
    }
    fun saveTime() {
        email { it.copy(loading = true, error = "") }
        viewModelScope.launch {
            val t = ui.email.preferredTime
            runCatching { api.updateTime(UpdateTimeRequest(ui.userId, t, timezone)) }
                .onSuccess { email { it.copy(loading = false, subscribedTime = t, message = "Daily alerts set for $t $tzShort every day!", step = EmailStep.Subscribed) } }
                .onFailure { err -> email { it.copy(loading = false, error = err.userMessage("Failed to save time. Please try again.")) } }
        }
    }
    fun stopEmail() {
        email { it.copy(loading = true, error = "") }
        viewModelScope.launch {
            runCatching { api.stopEmail(UserIdRequest(ui.userId)) }
                .onSuccess {
                    email { it.copy(loading = false, enabled = false, subscribedEmail = null, step = EmailStep.Email, email = "", message = "") }
                    delay(800); ui = ui.copy(showEmailModal = false)
                }
                .onFailure { err -> email { it.copy(loading = false, error = err.userMessage("Couldn't turn off notifications. Please try again.")) } }
        }
    }

    // ── profile menu ──
    /** "Download my data" → the export JSON lands in the phone's Downloads folder. */
    suspend fun downloadMyData(): Result<String> = runCatching {
        val body = api.export()
        val name = "feelivate-export-${WeekWindow.today()}.json"
        val resolver = getApplication<Application>().contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, "application/json")
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("Could not create the file")
        resolver.openOutputStream(uri)!!.use { out -> body.byteStream().use { it.copyTo(out) } }
        Toast.makeText(getApplication(), "Saved to Downloads: $name", Toast.LENGTH_LONG).show()
        name
    }
}
