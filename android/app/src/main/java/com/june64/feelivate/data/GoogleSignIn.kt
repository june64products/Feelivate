package com.june64.feelivate.data

import android.content.Context
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.mutableStateOf
import com.june64.feelivate.BuildConfig

/**
 * "Continue with Google" on Android — the website's own Google sign-in, in a
 * browser tab. Google's native sheet kept closing itself on some phones, so
 * the app sends the browser to the API, which sends it to Google's account
 * picker; Google returns the code to the API; the API hands the session back
 * as a `feelivate://auth` link that lands in MainActivity. No Android OAuth
 * client, no signature matching, nothing that can drift from the website.
 */
object GoogleSignIn {
    /** What the API wrote into the feelivate://auth link; the login screen consumes it. */
    val result = mutableStateOf<Result<AuthResponse>?>(null)

    fun start(context: Context) {
        CustomTabsIntent.Builder().setShowTitle(false).build()
            .launchUrl(context, Uri.parse(BuildConfig.API_BASE + "/auth/google/mobile/start"))
    }

    /** True when this intent is the API handing a session back. */
    fun isReturn(uri: Uri?): Boolean = uri != null && uri.scheme == "feelivate" && uri.host == "auth"

    /** The link carries everything in its fragment, so nothing lands in server logs. */
    fun parse(uri: Uri): Result<AuthResponse> {
        val params = (uri.fragment ?: "").split('&').mapNotNull { pair ->
            val i = pair.indexOf('=')
            if (i <= 0) null else Uri.decode(pair.substring(0, i)) to Uri.decode(pair.substring(i + 1).replace('+', ' '))
        }.toMap()
        params["error"]?.let { return Result.failure(Exception(it)) }
        val token = params["access_token"]; val userId = params["user_id"]
        if (token.isNullOrBlank() || userId.isNullOrBlank()) return Result.failure(Exception("Google sign-in returned without a session. Please try again."))
        return Result.success(
            AuthResponse(
                userId = userId, name = params["name"]?.takeIf { it.isNotBlank() }, accessToken = token,
                isNewUser = params["is_new_user"] == "1",
                consentRequired = params["consent_required"].orEmpty().split(',').filter { it.isNotBlank() },
            ),
        )
    }
}
