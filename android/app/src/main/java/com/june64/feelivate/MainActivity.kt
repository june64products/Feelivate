package com.june64.feelivate

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.june64.feelivate.data.OpenIntent
import com.june64.feelivate.data.Push
import com.june64.feelivate.ui.AppNav
import com.june64.feelivate.ui.theme.FeelivateTheme
import com.june64.feelivate.ui.theme.ThemeStore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        readOpenTarget(intent)
        Push.register(applicationContext)
        setContent {
            val themeStore = remember { ThemeStore(applicationContext) }
            val dark = themeStore.isDark(isSystemInDarkTheme())
            // A manual override has to carry the system bars with it, or dark
            // mode on a light device leaves black icons on a black bar.
            LaunchedEffect(dark) {
                WindowCompat.getInsetsController(window, window.decorView).apply {
                    isAppearanceLightStatusBars = !dark
                    isAppearanceLightNavigationBars = !dark
                }
            }
            FeelivateTheme(themeStore) { AppNav() }
        }
    }

    /** A tap on the notification (or an email deep link) arrives here, not in onCreate. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readOpenTarget(intent)
    }

    /**
     * Both routes carry the same hint: the push puts it in an extra, the email
     * deep link in ?open= on https://feelivate.com/app.
     */
    private fun readOpenTarget(intent: Intent?) {
        val target = intent?.getStringExtra("open")
            // A tap on a tray notification (app in the background): FCM puts the
            // message's data keys straight on the launch intent.
            ?: intent?.getStringExtra("view")?.let { v -> intent.getStringExtra("week")?.takeIf { it.isNotBlank() }?.let { "$v:$it" } ?: v }
            ?: intent?.data?.takeIf { it.path?.startsWith("/app") == true }?.getQueryParameter("open")
        if (!target.isNullOrBlank()) OpenIntent.pending = target
    }
}
