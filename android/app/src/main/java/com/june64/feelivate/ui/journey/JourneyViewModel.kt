package com.june64.feelivate.ui.journey

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.ArchivedReport
import com.june64.feelivate.data.JournalEntry
import com.june64.feelivate.data.MoodCheckinResult
import com.june64.feelivate.data.Plan
import com.june64.feelivate.data.Prefs
import com.june64.feelivate.data.ReportDay
import com.june64.feelivate.data.TokenStore
import com.june64.feelivate.data.WeekInfo
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.data.WeeklyReport
import com.june64.feelivate.data.userMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.time.LocalDate

data class JourneyUi(
    val tab: String = "overview",
    val journals: List<JournalEntry> = emptyList(),
    val report: WeeklyReport? = null,
    val weekInfo: WeekInfo? = null,
    val archive: List<ArchivedReport> = emptyList(),
    val planHistory: List<Plan> = emptyList(),
    val currentPlan: Plan? = null,
    val loadingReport: Boolean = true,
    val loadingArchive: Boolean = false,
    val micLocked: Boolean = false,
    val isRecording: Boolean = false,
    val isUploading: Boolean = false,
    val justSaved: JournalEntry? = null,
    val moodResult: MoodCheckinResult? = null,
    val error: String? = null,
    val expandedWeek: Int? = null,
    val showWeekEndCelebration: Boolean = false,
) {
    val today: String get() = WeekWindow.today()
    val goalFinished: Boolean get() = weekInfo?.isCompleted == true
    /** No week is running: nothing locked, or the last week's window ended with no next plan. */
    val noActiveWeek: Boolean get() {
        val wi = weekInfo ?: return true
        if (!wi.hasPlan) return true
        val end = wi.weekEnd
        return end != null && today > end && !wi.hasNextPlan
    }
    val notStartedYet: Boolean get() = weekInfo?.weekStart?.let { today < it } == true
    val reportData get() = report?.report
}

class JourneyViewModel(app: Application) : AndroidViewModel(app) {
    private val api = ApiClient.get(app)
    private val store = TokenStore(app)
    val prefs = Prefs(app)
    private val userId get() = store.userId.orEmpty()
    private var sessionId: String? = null
    var ui by mutableStateOf(JourneyUi())
        private set

    fun start(sessionId: String?, initialTab: String) {
        this.sessionId = sessionId
        ui = ui.copy(tab = initialTab, micLocked = prefs.journalLockedToday(userId, sessionId))
        loadAll()
        if (initialTab == "archive") loadArchive()
    }

    fun setTab(tab: String) {
        ui = ui.copy(tab = tab)
        if (tab == "archive" && ui.archive.isEmpty()) loadArchive()
    }

    fun toggleWeek(week: Int) { ui = ui.copy(expandedWeek = if (ui.expandedWeek == week) null else week) }
    fun expandWeek(week: Int) { ui = ui.copy(tab = "archive", expandedWeek = week) }
    fun dismissCelebration() { ui = ui.copy(showWeekEndCelebration = false) }
    fun clearError() { ui = ui.copy(error = null) }

    private fun loadAll() {
        viewModelScope.launch {
            val sid = sessionId
            val wi = if (sid != null) runCatching { api.weekInfo(sid, WeekWindow.today()) }.getOrNull() else null
            ui = ui.copy(weekInfo = wi)
            val journals = runCatching { api.journals(userId, sid) }.getOrDefault(emptyList())
            val report = if (sid != null) loadReport(wi?.currentWeek) else null
            val archive = if (sid != null) runCatching { api.archivedReports(sid, WeekWindow.today()) }.getOrDefault(emptyList()) else emptyList()
            val detail = if (sid != null) runCatching { api.sessionDetail(sid) }.getOrNull() else null
            val todayJournal = journals.firstOrNull { it.date == WeekWindow.today() }
            if (todayJournal != null) prefs.lockJournalToday(userId, sid) else prefs.put("last_journal_date_${userId}_${sid ?: "none"}", null)
            ui = ui.copy(
                journals = journals, report = report, archive = archive,
                planHistory = detail?.planHistory ?: emptyList(), currentPlan = detail?.plan,
                micLocked = todayJournal != null, loadingReport = false,
            )
        }
    }

    /** The web's V2 auto-upgrade: a cached report with no momentum is regenerated. */
    private suspend fun loadReport(weekNumber: Int?): WeeklyReport? {
        val sid = sessionId ?: return null
        val first = runCatching { api.weeklyReport(userId, sid, weekNumber, WeekWindow.today()) }.getOrNull() ?: return null
        if (first.status == "cached" && first.report != null && first.report.momentumScore == null) {
            return runCatching { api.weeklyReport(userId, sid, weekNumber, WeekWindow.today(), forceRefresh = true) }.getOrNull() ?: first
        }
        return first
    }

    private fun loadArchive() {
        val sid = sessionId ?: return
        ui = ui.copy(loadingArchive = true)
        viewModelScope.launch {
            runCatching { api.archivedReports(sid, WeekWindow.today()) }.onSuccess { ui = ui.copy(archive = it) }
            ui = ui.copy(loadingArchive = false)
        }
    }

    fun setRecording(v: Boolean) { ui = ui.copy(isRecording = v, error = null) }

    /** The evening journal: it joins the streak, the report and the orb. */
    fun uploadJournal(file: File, onSaved: (JournalEntry) -> Unit) {
        ui = ui.copy(isUploading = true, isRecording = false, error = null)
        viewModelScope.launch {
            val sid = sessionId
            runCatching {
                withContext(Dispatchers.IO) {
                    val part = MultipartBody.Part.createFormData("audio", file.name, file.asRequestBody("audio/mp4".toMediaType()))
                    api.voiceJournal(part, sid, WeekWindow.today())
                }
            }.onSuccess { entry ->
                file.delete()
                prefs.lockJournalToday(userId, sid)
                ui = ui.copy(
                    justSaved = entry, micLocked = true, isUploading = false, loadingReport = true,
                    journals = listOf(entry) + ui.journals.filter { it.date != entry.date },
                )
                onSaved(entry)
                val r = loadReport(ui.weekInfo?.currentWeek)
                val wi = sessionId?.let { runCatching { api.weekInfo(it, WeekWindow.today()) }.getOrNull() }
                val isLastDay = wi?.weekEnd == WeekWindow.today()
                val celebrate = isLastDay && wi?.isCompleted != true && r?.report != null && r.status != "no_data" && r.status != "in_progress"
                ui = ui.copy(report = r ?: ui.report, weekInfo = wi ?: ui.weekInfo, loadingReport = false)
                if (celebrate) { delay(800); ui = ui.copy(showWeekEndCelebration = true) }
            }.onFailure { e ->
                file.delete()
                ui = ui.copy(isUploading = false, error = e.userMessage("Upload failed"))
            }
        }
    }

    /** The between-weeks mood mic: detected and shown, joined to nothing. */
    fun uploadMood(file: File) {
        ui = ui.copy(isUploading = true, isRecording = false, error = null)
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val part = MultipartBody.Part.createFormData("audio", file.name, file.asRequestBody("audio/mp4".toMediaType()))
                    api.moodCheckin(part)
                }
            }.onSuccess { ui = ui.copy(moodResult = it, isUploading = false) }
                .onFailure { e -> ui = ui.copy(isUploading = false, error = e.userMessage("Mood check-in failed")) }
            file.delete()
        }
    }

    /** The week's calendar: the report's own days, else rebuilt from the journals. */
    fun weekDays(): List<ReportDay> {
        ui.reportData?.days?.takeIf { it.isNotEmpty() }?.let { return it }
        val byDate = ui.journals.associateBy { it.date }
        val wi = ui.weekInfo
        val start: LocalDate
        val end: LocalDate
        when {
            wi?.weekStart != null && wi.weekEnd != null -> { start = LocalDate.parse(wi.weekStart); end = LocalDate.parse(wi.weekEnd) }
            wi?.planStartDate != null -> { start = LocalDate.parse(wi.planStartDate); end = start.plusDays((7 - (start.dayOfWeek.value % 7)) % 7L) }
            else -> { val td = LocalDate.now(); start = td.minusDays(((td.dayOfWeek.value + 6) % 7).toLong()); end = start.plusDays(6) }
        }
        val count = (end.toEpochDay() - start.toEpochDay()).toInt() + 1
        return (0 until maxOf(1, count)).map { i ->
            val iso = start.plusDays(i.toLong()).toString()
            val j = byDate[iso]
            ReportDay(
                date = iso, emotion = j?.emotionLabel, score = j?.emotionScore,
                oneLiner = j?.oneLiner, checkin = if (j != null) "done" else if (iso < WeekWindow.today()) "missed" else "pending",
                hasJournal = j != null,
            )
        }
    }
}
