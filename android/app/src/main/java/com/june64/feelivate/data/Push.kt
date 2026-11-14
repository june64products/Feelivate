package com.june64.feelivate.data

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.android.gms.tasks.Tasks
import com.june64.feelivate.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

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
            // Firebase's init provider may already have built the default app
            // from the string resources. If that app is missing the sender id
            // or API key (a build with partial resources), it can never fetch
            // a token: replace it with one built from the full config.
            val existing = FirebaseApp.getApps(context).firstOrNull { it.name == FirebaseApp.DEFAULT_APP_NAME }
            val usable = existing != null &&
                !existing.options.gcmSenderId.isNullOrBlank() &&
                !existing.options.apiKey.isNullOrBlank()
            if (existing != null && !usable) {
                Log.w(TAG, "default FirebaseApp lacks sender id / api key — re-initialising")
                runCatching { existing.delete() }
            }
            if (existing == null || !usable) {
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
     * Hands this device's token to the backend, and says what went wrong when
     * it cannot. Two things can fail and both used to fail in silence: Google
     * Play services may refuse to mint a token, and the server may refuse to
     * store it. The reason is kept so the Alerts screen can show it instead of
     * leaving a phone that simply never hears anything.
     *
     * Safe to call as often as you like: the server upserts by token.
     */
    suspend fun registerNow(context: Context): Result<String> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val prefs = Prefs(app)
        if (!configured) {
            val why = "This build has no Firebase keys, so this phone cannot be registered."
            prefs.savePushReg(false, why)
            return@withContext Result.failure(IllegalStateException(why))
        }
        if (!TokenStore(app).isSignedIn) {
            return@withContext Result.failure(IllegalStateException("Sign in first."))
        }
        start(app)
        val token = try {
            Tasks.await(FirebaseMessaging.getInstance().token, 30, TimeUnit.SECONDS)
                ?.takeIf { it.isNotBlank() } ?: error("no token returned")
        } catch (e: Throwable) {
            val why = "Couldn't get this phone's push token — ${tokenFailure(e)}"
            Log.w(TAG, why)
            prefs.savePushReg(false, why)
            return@withContext Result.failure(IllegalStateException(why))
        }
        try {
            ApiClient.get(app).registerDevice(DeviceTokenRequest(token))
        } catch (e: Throwable) {
            val why = "Couldn't tell the server about this phone — ${e.userMessage("please try again")}"
            Log.w(TAG, why)
            prefs.savePushReg(false, why)
            return@withContext Result.failure(IllegalStateException(why))
        }
        prefs.savePushReg(true, "")
        Result.success(token)
    }

    /** Google Play services' own codes, said in words. */
    private fun tokenFailure(e: Throwable): String {
        val m = (e.message ?: e.javaClass.simpleName).trim()
        return when {
            m.contains("SERVICE_NOT_AVAILABLE", true) ->
                "Google Play services couldn't reach Firebase (SERVICE_NOT_AVAILABLE). Usually the connection, or Play services needs an update."
            m.contains("MISSING_INSTANCEID_SERVICE", true) ->
                "this phone has no Google Play services for messaging (MISSING_INSTANCEID_SERVICE)."
            m.contains("AUTHENTICATION_FAILED", true) ->
                "Firebase rejected this app's credentials (AUTHENTICATION_FAILED)."
            m.contains("TOO_MANY_REGISTRATIONS", true) ->
                "Android is refusing new registrations on this phone (TOO_MANY_REGISTRATIONS)."
            m.contains("TimeoutException", true) || m.contains("timeout", true) ->
                "Google Play services didn't answer in 30 seconds."
            else -> m.take(160)
        }
    }

    /**
     * Fire-and-forget registration for the places that just want it done: the
     * launch, a sign-in, coming back to the foreground. Retries, because the
     * first seconds after a launch are exactly when the network may not be up.
     */
    fun register(context: Context) {
        if (!configured) return
        val app = context.applicationContext
        scope.launch {
            repeat(3) { attempt ->
                if (!TokenStore(app).isSignedIn) return@launch
                if (registerNow(app).isSuccess) return@launch
                delay(3_000L * (attempt + 1))
            }
        }
    }

    /** Google rotated this phone's token (FirebaseMessagingService.onNewToken). */
    fun sendToken(context: Context, token: String?) {
        if (token.isNullOrBlank()) return
        val app = context.applicationContext
        scope.launch {
            runCatching { ApiClient.get(app).registerDevice(DeviceTokenRequest(token)) }
                .onSuccess { Prefs(app).savePushReg(true, "") }
                .onFailure { Log.w(TAG, "token registration failed: ${it.message}") }
        }
    }

    /**
     * Logout: this phone should stop hearing from the account that left it.
     * Suspends until the server has been told — the caller clears the session
     * only after, or the call would go out without a session to authenticate.
     */
    suspend fun unregister(context: Context) {
        if (!configured) return
        val app = context.applicationContext
        val token = runCatching { Tasks.await(FirebaseMessaging.getInstance().token) }.getOrNull() ?: return
        runCatching { ApiClient.get(app).forgetDevice(DeviceTokenRequest(token)) }
            .onFailure { Log.w(TAG, "could not forget this device on the server: ${it.message}") }
        runCatching { FirebaseMessaging.getInstance().deleteToken() }
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
