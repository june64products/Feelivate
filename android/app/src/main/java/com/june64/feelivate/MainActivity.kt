package com.june64.feelivate

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.WindowCompat
import com.june64.feelivate.ui.AppNav
import com.june64.feelivate.ui.theme.FeelivateTheme
import com.june64.feelivate.ui.theme.ThemeStore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
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
}
