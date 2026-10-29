package com.june64.feelivate.ui.theme

import android.content.Context
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

/**
 * hooks/useTheme.ts — the device decides until the user picks a side, and that
 * choice is remembered. Null means "follow the device".
 */
class ThemeStore(context: Context) {
    private val prefs = context.getSharedPreferences("feelivate_ui", Context.MODE_PRIVATE)
    var override by mutableStateOf(prefs.getString(KEY, null)?.takeIf { it == "light" || it == "dark" })
        private set

    fun set(theme: String?) {
        override = theme
        prefs.edit().apply { if (theme == null) remove(KEY) else putString(KEY, theme) }.apply()
    }

    fun isDark(systemDark: Boolean): Boolean = when (override) { "dark" -> true; "light" -> false; else -> systemDark }
    fun toggle(systemDark: Boolean) = set(if (isDark(systemDark)) "light" else "dark")

    private companion object { const val KEY = "feelivate-theme" }
}

val LocalThemeStore = compositionLocalOf<ThemeStore?> { null }
