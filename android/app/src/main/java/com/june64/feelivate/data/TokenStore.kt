package com.june64.feelivate.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.time.LocalDate

/**
 * The sign-in token and who it belongs to, encrypted at rest (Android Keystore).
 * Same facts the web app keeps in localStorage: access_token, user_id, user_name, active_session_id.
 */
class TokenStore(context: Context) {
    private val prefs: SharedPreferences = run {
        val key = MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context, "feelivate_auth", key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    var token: String?
        get() = prefs.getString("access_token", null)
        set(v) = prefs.edit().putString("access_token", v).apply()

    var userId: String?
        get() = prefs.getString("user_id", null)
        set(v) = prefs.edit().putString("user_id", v).apply()

    var userName: String?
        get() = prefs.getString("user_name", null)
        set(v) = prefs.edit().putString("user_name", v).apply()

    var activeSessionId: String?
        get() = prefs.getString("active_session_id", null)
        set(v) = prefs.edit().putString("active_session_id", v).apply()

    val isSignedIn: Boolean get() = token != null && userId != null

    fun signIn(auth: AuthResponse, fallbackName: String) {
        prefs.edit()
            .putString("access_token", auth.accessToken)
            .putString("user_id", auth.userId)
            .putString("user_name", auth.name?.takeIf { it.isNotBlank() } ?: fallbackName)
            .remove("active_session_id")
            .apply()
    }

    /** `localStorage.clear()` */
    fun clear() = prefs.edit().clear().apply()
}

/** The web's non-secret localStorage keys (onboarding, mic lock, slip reasons, feedback flags). */
class Prefs(context: Context) {
    private val p: SharedPreferences = context.getSharedPreferences("feelivate_ui", Context.MODE_PRIVATE)

    fun getString(key: String): String? = p.getString(key, null)
    fun put(key: String, value: String?) = p.edit().apply { if (value == null) remove(key) else putString(key, value) }.apply()
    fun clear() = p.edit().clear().apply()

    // ── onboarding (lib/onboarding.ts) ──
    fun isDemoQueued(userId: String?): Boolean = userId != null && getString("feelivate_onboarding_$userId") == "active"
    fun startDemo(userId: String?) { if (userId != null) put("feelivate_onboarding_$userId", "active") }
    fun completeDemo(userId: String?) { if (userId != null) put("feelivate_onboarding_$userId", "done") }

    // ── mic lock: last_journal_date_<uid>_<session> ──
    fun journalLockedToday(userId: String?, sessionId: String?): Boolean =
        getString("last_journal_date_${userId}_${sessionId ?: "none"}") == LocalDate.now().toString()
    fun lockJournalToday(userId: String?, sessionId: String?) = put("last_journal_date_${userId}_${sessionId ?: "none"}", LocalDate.now().toString())

    // ── notifications: ask for the permission once, not on every launch ──
    fun notifAsked(): Boolean = getString("notif_permission_asked") == "1"
    fun setNotifAsked() = put("notif_permission_asked", "1")

    // ── emotion orb position (emotion_orb_position) ──
    fun orbX(): Float? = getString("emotion_orb_x")?.toFloatOrNull()
    fun orbY(): Float? = getString("emotion_orb_y")?.toFloatOrNull()
    fun saveOrb(x: Float, y: Float) { put("emotion_orb_x", x.toString()); put("emotion_orb_y", y.toString()) }

    // ── recovery card ──
    fun slipReason(dateIso: String): String? = getString("slip_reason_$dateIso")
    fun saveSlipReason(dateIso: String, reason: String) = put("slip_reason_$dateIso", reason)
    fun recoveryLine(dateIso: String, missCount: Int): String? = getString("recovery_line_${dateIso}_$missCount")
    fun saveRecoveryLine(dateIso: String, missCount: Int, line: String) = put("recovery_line_${dateIso}_$missCount", line)
}
