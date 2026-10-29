package com.june64.feelivate.ui.feedback

import android.content.Context
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.FeedbackRequest
import com.june64.feelivate.data.Prefs
import com.june64.feelivate.data.TokenStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray

/*
 * FeedbackContext.tsx — when the form may open on its own.
 *
 * The rule that matters most: a person is asked automatically at most once,
 * and never at a bad moment. Every trigger is only an opportunity; the first
 * one that finds the user eligible wins and the rest stand down. The tab is
 * always there for anyone who wants to say more.
 */
private const val MIN_SESSION_MS = 3 * 60_000L
private const val MILESTONE_MIN_MS = 60_000L
private const val TIMER_MS = 8 * 60_000L
private const val SNOOZE_MS = 3 * 24 * 3_600_000L
private const val MAX_DISMISSALS = 2
private const val NEW_ACCOUNT_DAYS = 30
private const val RETRY_AFTER_BUSY_MS = 1_500L

/** The moment that opened the form. Stored with every submission. */
object Trigger {
    const val SIDE_TAB = "side_tab"
    const val TIMER = "timer"
    const val LOGOUT = "logout"
    const val FIRST_CHATS = "first_chats"
    const val FIRST_PLAN = "first_plan"
    const val AFTER_JOURNAL = "after_journal"
    const val SECOND_TWEAK = "second_tweak"
    const val WEEKLY_REPORT = "weekly_report"
    const val TAB_RETURN = "tab_return"
}

/** Which questions a form asks — each moment gets its own few. */
fun kindFor(trigger: String): String = when (trigger) {
    Trigger.FIRST_PLAN -> "plan_fit"
    Trigger.AFTER_JOURNAL -> "task_day"
    Trigger.SECOND_TWEAK -> "tweaks"
    else -> "full"
}

private fun isMoment(trigger: String) =
    trigger == Trigger.FIRST_PLAN || trigger == Trigger.AFTER_JOURNAL || trigger == Trigger.SECOND_TWEAK || trigger == Trigger.WEEKLY_REPORT

/** Extra facts a moment hands to the form (shown back, stored with the answer). */
data class MomentDetails(val sessionId: String? = null, val taskLabel: String? = null, val tweakCount: Int? = null, val weekNumber: Int? = null)

class FeedbackState(private val context: Context) {
    private val prefs = Prefs(context)
    private val store = TokenStore(context)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val startedAt = System.currentTimeMillis()

    var isOpen by mutableStateOf(false); private set
    var trigger by mutableStateOf(Trigger.SIDE_TAB); private set
    var details by mutableStateOf(MomentDetails()); private set
    private var busyKeys by mutableStateOf(emptySet<String>())
    private var pendingMoment: Triple<String, String, MomentDetails>? = null
    private var pendingTrigger: String? = null
    private var afterClose: (() -> Unit)? = null

    /** Filled once per visit from the account: age in days and how often they've already written in. */
    private var accountAgeDays: Int? = null
    private var serverCount: Int? = null

    val isLoggedIn: Boolean get() = store.isSignedIn
    val tabVisible: Boolean get() = !isOpen && busyKeys.isEmpty() && isLoggedIn

    private val userId get() = store.userId
    private fun stateKey() = "feelivate-feedback:${userId ?: "anon"}"
    private fun momentKey() = "feelivate-feedback-moments:${userId ?: "anon"}"

    private data class PromptState(val dismissed: Int = 0, val snoozeUntil: Long = 0, val submitted: Boolean = false)

    private fun loadState(): PromptState {
        val raw = prefs.getString(stateKey()) ?: return PromptState()
        return runCatching {
            val o = org.json.JSONObject(raw)
            PromptState(o.optInt("dismissed"), o.optLong("snoozeUntil"), o.optBoolean("submitted"))
        }.getOrDefault(PromptState())
    }

    private fun saveState(s: PromptState) {
        prefs.put(stateKey(), org.json.JSONObject().put("dismissed", s.dismissed).put("snoozeUntil", s.snoozeUntil).put("submitted", s.submitted).toString())
    }

    private fun momentAsked(key: String): Boolean = runCatching {
        val raw = prefs.getString(momentKey()) ?: return false
        val arr = JSONArray(raw)
        (0 until arr.length()).any { arr.getString(it) == key }
    }.getOrDefault(false)

    private fun markMoment(key: String) {
        runCatching {
            val arr = prefs.getString(momentKey())?.let { JSONArray(it) } ?: JSONArray()
            val list = (0 until arr.length()).map { arr.getString(it) }
            if (key !in list) prefs.put(momentKey(), JSONArray((list + key).takeLast(200)).toString())
        }
    }

    /** The eligibility facts, fetched once per visit. */
    fun loadEligibility() {
        if (!isLoggedIn || (accountAgeDays != null && serverCount != null)) return
        scope.launch {
            runCatching {
                val api = ApiClient.get(context)
                val me = api.me()
                val status = runCatching { api.myFeedbackStatus() }.getOrNull()
                val created = me.createdAt?.let { iso ->
                    runCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
                        .recoverCatching { java.time.LocalDateTime.parse(iso.substringBefore('Z')).toInstant(java.time.ZoneOffset.UTC).toEpochMilli() }
                        .getOrNull()
                }
                accountAgeDays = created?.let { ((System.currentTimeMillis() - it) / 86_400_000L).toInt() }
                serverCount = status?.count
            }
        }
    }

    /** Is the one-time prompt still due for this person, whatever the timing? */
    private fun promptDue(): Boolean {
        if (!isLoggedIn) return false
        val s = loadState()
        if (s.submitted || s.dismissed >= MAX_DISMISSALS) return false
        if (System.currentTimeMillis() < s.snoozeUntil) return false
        val count = serverCount ?: return false
        if (count > 0) return false
        val age = accountAgeDays ?: return false
        return age <= NEW_ACCOUNT_DAYS
    }

    private fun openNow(t: String, d: MomentDetails = MomentDetails()) {
        trigger = t; details = d; isOpen = true; pendingTrigger = null
    }

    /** Open the form deliberately (the tab). Always allowed. */
    fun open(t: String = Trigger.SIDE_TAB) = openNow(t)

    /** While any key is busy — a modal, the mentor typing, the tutorial — nothing opens on its own. */
    fun setBusy(key: String, busy: Boolean) {
        val next = if (busy) busyKeys + key else busyKeys - key
        if (next == busyKeys) return
        busyKeys = next
        if (next.isEmpty()) scope.launch {
            delay(RETRY_AFTER_BUSY_MS)
            pendingMoment?.let { (t, k, d) -> pendingMoment = null; askMoment(t, k, d) }
            pendingTrigger?.let { t -> tryOpen(t, 0, true) }
        }
    }

    /** Try an automatic trigger. Returns false (and may queue a retry) when the moment is wrong. */
    private fun tryOpen(t: String, minMs: Long, retryWhenFree: Boolean): Boolean {
        if (isOpen || !promptDue()) return false
        if (System.currentTimeMillis() - startedAt < minMs) return false
        if (busyKeys.isNotEmpty()) { if (retryWhenFree) pendingTrigger = t; return false }
        openNow(t)
        return true
    }

    /** A milestone the engine may use (the first few mentor exchanges). */
    fun signal(milestone: String) {
        if (milestone == Trigger.FIRST_PLAN) return   // the first plan has its own one-question form
        tryOpen(milestone, MILESTONE_MIN_MS, true)
    }

    /**
     * Ask a moment question. `key` makes it once-only: the same key never asks
     * twice (`after_journal:<session>:<date>`, `second_tweak:<session>:<week>`…).
     */
    fun askMoment(t: String, key: String, d: MomentDetails = MomentDetails()): Boolean {
        if (!isLoggedIn) return false
        if (momentAsked(key)) return false
        if (isOpen || busyKeys.isNotEmpty()) { pendingMoment = Triple(t, key, d); return false }
        markMoment(key)
        openNow(t, d)
        return true
    }

    /** The pulse check, a few minutes into the first session. */
    fun startTimer() {
        scope.launch {
            delay(TIMER_MS)
            tryOpen(Trigger.TIMER, TIMER_MS, true)
        }
    }

    /** Coming back after a while away stands in for the web's exit intent. */
    fun onReturnedAfterAway() { tryOpen(Trigger.TAB_RETURN, MIN_SESSION_MS, true) }

    /** Ask before logging out while the prompt is still due; otherwise log out straight away. */
    fun requestLogout(proceed: () -> Unit) {
        if (isOpen || !promptDue()) { proceed(); return }
        afterClose = proceed
        openNow(Trigger.LOGOUT)
    }

    fun close(submitted: Boolean) {
        val t = trigger
        val wasMoment = isMoment(t)
        val wasAutomatic = t != Trigger.SIDE_TAB && !wasMoment
        var s = loadState()
        if (submitted) {
            // Only the fuller forms count as "they've given feedback"; a one-tap
            // moment answer shouldn't silence the general prompt for good.
            if (!wasMoment || t == Trigger.WEEKLY_REPORT) s = s.copy(submitted = true)
            serverCount = (serverCount ?: 0) + 1
        } else if (wasAutomatic) {
            s = s.copy(dismissed = s.dismissed + 1, snoozeUntil = System.currentTimeMillis() + SNOOZE_MS)
        }
        saveState(s)
        isOpen = false
        val after = afterClose
        afterClose = null
        after?.let { it(); saveState(s) }   // logging out clears the token, not this history
    }

    suspend fun submit(answers: Map<String, Any?>, comment: String?, contactOk: Boolean, email: String?, sessionId: String?): Result<Unit> =
        runCatching {
            ApiClient.get(context).feedback(
                FeedbackRequest(
                    kind = kindFor(trigger),
                    answers = ApiClient.toJsonObject(answers),
                    comment = comment?.takeIf { it.isNotBlank() },
                    contactOk = contactOk,
                    email = email?.takeIf { it.isNotBlank() },
                    trigger = trigger,
                    page = "app",
                    sessionId = sessionId,
                ),
            )
            Unit
        }
}

val LocalFeedback = compositionLocalOf<FeedbackState?> { null }
