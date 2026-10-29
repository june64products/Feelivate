package com.june64.feelivate.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * The web app's CSS variables (frontend/src/index.css), one field per token,
 * so every Android surface reads the exact same value the browser does.
 */
data class Tokens(
    val isDark: Boolean,
    val bgPrimary: Color,
    val bgSecondary: Color,
    val bgSidebar: Color,
    val bgSurface: Color,
    val bgInput: Color,
    val cardBg: Color,
    val cardBorder: Color,
    val modalBg: Color,
    val modalBorder: Color,
    val modalOverlay: Color,
    val sheetBg: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textPlaceholder: Color,
    val textInverse: Color,
    val accentPrimary: Color,
    val accentSecondary: Color,
    val accentWarm: Color,
    val accentGlow: Color,
    val btnPrimaryBg: Color,
    val btnPrimaryText: Color,
    val btnSecondaryText: Color,
    val btnSecondaryBorder: Color,
    val btnDisabledBg: Color,
    val btnHoverBg: Color,
    val inputBorder: Color,
    val inputBorderFocus: Color,
    val inputShadowFocus: Color,
    val borderSubtle: Color,
    val borderMedium: Color,
    val borderFocus: Color,
    val glassSurface: Color,
    val glassHover: Color,
    val shadowColor: Color,
    val insightBg: Color,
    val insightBorder: Color,
    val navBg: Color,
    val waveBar: Color,
) {
    /** Colour of the logo mark inside a brand chip (`--logo-filter`: inverted on light). */
    val logoMarkOnChip: Color get() = btnPrimaryText
}

val LightTokens = Tokens(
    isDark = false,
    bgPrimary = Color(0xFFF2F2F2),
    bgSecondary = Color(0xFFEBEBEB),
    bgSidebar = Color(0xFF111111),
    bgSurface = Color(0xFFFFFFFF),
    bgInput = Color(0xFFFFFFFF),
    cardBg = Color(0xFFFFFFFF),
    cardBorder = Color(0x0F1E1E1E),
    modalBg = Color(0xFFFFFFFF),
    modalBorder = Color(0x141E1E1E),
    modalOverlay = Color(0x59111111),
    sheetBg = Color(0xFFFFFFFF),
    textPrimary = Color(0xFF111111),
    textSecondary = Color(0xFF838282),
    textMuted = Color(0xFFB6B5B5),
    textPlaceholder = Color(0xFFB6B5B5),
    textInverse = Color(0xFFF2F2F2),
    accentPrimary = Color(0xFF111111),
    accentSecondary = Color(0xFF838282),
    accentWarm = Color(0xFFD97757),
    accentGlow = Color(0x0A111111),
    btnPrimaryBg = Color(0xFF111111),
    btnPrimaryText = Color(0xFFF2F2F2),
    btnSecondaryText = Color(0xFF838282),
    btnSecondaryBorder = Color(0x1A1E1E1E),
    btnDisabledBg = Color(0x261E1E1E),
    btnHoverBg = Color(0x0A1E1E1E),
    inputBorder = Color(0x141E1E1E),
    inputBorderFocus = Color(0x401E1E1E),
    inputShadowFocus = Color(0x14111111),
    borderSubtle = Color(0x0F1E1E1E),
    borderMedium = Color(0x1A1E1E1E),
    borderFocus = Color(0x401E1E1E),
    glassSurface = Color(0x051E1E1E),
    glassHover = Color(0x0A1E1E1E),
    shadowColor = Color(0xFF1E1E1E),
    insightBg = Color(0xFFF2F2F2),
    insightBorder = Color(0xFF111111),
    navBg = Color(0xD1F2F2F2),
    waveBar = Color(0xFF111111),
)

val DarkTokens = Tokens(
    isDark = true,
    bgPrimary = Color(0xFF0F0F0F),
    bgSecondary = Color(0xFF1A1A1A),
    bgSidebar = Color(0xFF0A0A0A),
    bgSurface = Color(0xFF1E1E1E),
    bgInput = Color(0xFF252525),
    cardBg = Color(0xFF1E1E1E),
    cardBorder = Color(0x0FFFFFFF),
    modalBg = Color(0xFF1E1E1E),
    modalBorder = Color(0x14FFFFFF),
    modalOverlay = Color(0x99000000),
    sheetBg = Color(0xFF1A1A1A),
    textPrimary = Color(0xFFF2F2F2),
    textSecondary = Color(0xFF9A9A9A),
    textMuted = Color(0xFF666666),
    textPlaceholder = Color(0xFF555555),
    textInverse = Color(0xFF111111),
    accentPrimary = Color(0xFFF2F2F2),
    accentSecondary = Color(0xFF9A9A9A),
    accentWarm = Color(0xFFE89070),
    accentGlow = Color(0x0AFFFFFF),
    btnPrimaryBg = Color(0xFFF2F2F2),
    btnPrimaryText = Color(0xFF111111),
    btnSecondaryText = Color(0xFF9A9A9A),
    btnSecondaryBorder = Color(0x1AFFFFFF),
    btnDisabledBg = Color(0x1AFFFFFF),
    btnHoverBg = Color(0x0FFFFFFF),
    inputBorder = Color(0x14FFFFFF),
    inputBorderFocus = Color(0x40FFFFFF),
    inputShadowFocus = Color(0x0FFFFFFF),
    borderSubtle = Color(0x0FFFFFFF),
    borderMedium = Color(0x1AFFFFFF),
    borderFocus = Color(0x40FFFFFF),
    glassSurface = Color(0x08FFFFFF),
    glassHover = Color(0x0FFFFFFF),
    shadowColor = Color(0xFF000000),
    insightBg = Color(0xFF1A1A1A),
    insightBorder = Color(0xFFF2F2F2),
    navBg = Color(0xD10F0F0F),
    waveBar = Color(0xFFF2F2F2),
)

/** Status colours — identical in both themes. */
object Status {
    val Success = Color(0xFF10B981)
    val Error = Color(0xFFEF4444)
    val ErrorText = Color(0xFFDC2626)
    val Warning = Color(0xFFF59E0B)
    val FlameFrom = Color(0xFFFFB24D)
    val FlameTo = Color(0xFFFF5A36)
    val Amber = Color(0xFFF59E0B)
    val ShieldBlue = Color(0xFF60A5FA)
}

val LocalTokens = staticCompositionLocalOf { LightTokens }

/** Shorthand used everywhere: `val t = tokens()`. */
@Composable
fun tokens(): Tokens = LocalTokens.current

@Composable
fun FeelivateTheme(themeStore: ThemeStore? = null, content: @Composable () -> Unit) {
    val systemDark = isSystemInDarkTheme()
    // The device decides until the user picks a side (hooks/useTheme.ts).
    val dark = themeStore?.isDark(systemDark) ?: systemDark
    CompositionLocalProvider(
        LocalTokens provides if (dark) DarkTokens else LightTokens,
        LocalThemeStore provides themeStore,
        content = content,
    )
}
