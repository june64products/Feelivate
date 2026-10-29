package com.june64.feelivate.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.june64.feelivate.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * The phone's half of the alerts the backend already sends by email.
 *
 * Firebase is configured from build properties rather than a
 * `google-services.json`, so the app builds — and runs with push simply off —
 * in any checkout or CI job that has no Firebase values to hand.
 */
object Push {
    private const val TAG = "Push"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** The channels, one per kind of interruption, so each can be silenced on its own. */
    data class Channel(val id: String, val title: String, val description: String)

    private val CHANNELS = listOf(
        Channel("feelivate_daily", "Today's one thing", "The morning note with today's task."),
        Channel("feelivate_evening", "Evening journal", "A nudge at night when the day isn't logged yet."),
        Channel("feelivate_review", "Weekly review", "When a finished week's review is ready to read."),
        Channel("feelivate_default", "Feelivate", "Everything else."),
    )

    val configured: Boolean
        get() = BuildConfig.FIREBASE_APP_ID.isNotBlank() &&
            BuildConfig.FIREBASE_API_KEY.isNotBlank() &&
            BuildConfig.FIREBASE_SENDER_ID.isNotBlank()

    private var started = false

    /** Safe to call repeatedly; the first call does the work. */
    fun start(context: Context) {
        if (started || !configured) return
        started = true
        runCatching {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(
                    context,
                    FirebaseOptions.Builder()
                        .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                        .setApiKey(BuildConfig.FIREBASE_API_KEY)
                        .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                        .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                        .build(),
                )
            }
            createChannels(context)
        }.onFailure { Log.w(TAG, "Firebase init failed: ${it.message}") }
    }

    private fun createChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        CHANNELS.forEach { c ->
            manager.createNotificationChannel(
                NotificationChannel(c.id, c.title, NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = c.description
                },
            )
        }
    }

    /**
     * Hands this device's token to the backend. Called after sign-in and on
     * every launch, because Google rotates tokens on its own schedule and a
     * stale one simply stops delivering.
     */
    fun register(context: Context) {
        if (!configured) return
        start(context)
        val store = TokenStore(context)
        if (!store.isSignedIn) return
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token -> sendToken(context, token) }
            .addOnFailureListener { Log.w(TAG, "no FCM token: ${it.message}") }
    }

    fun sendToken(context: Context, token: String?) {
        if (token.isNullOrBlank()) return
        val app = context.applicationContext
        scope.launch {
            runCatching { ApiClient.get(app).registerDevice(DeviceTokenRequest(token)) }
                .onFailure { Log.w(TAG, "token registration failed: ${it.message}") }
        }
    }

    /** Logout: this phone should stop hearing from the account that left it. */
    fun unregister(context: Context) {
        if (!configured) return
        val app = context.applicationContext
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
                scope.launch {
                    runCatching { ApiClient.get(app).forgetDevice(DeviceTokenRequest(token)) }
                    runCatching { FirebaseMessaging.getInstance().deleteToken() }
                }
            }
        }
    }
}

/**
 * Where a notification tap wants to land. MainActivity fills this in from the
 * intent and the workspace consumes it once — the same route the email deep
 * links take.
 */
object OpenIntent {
    @Volatile
    var pending: String? = null

    fun take(): String? {
        val v = pending
        pending = null
        return v
    }
}
