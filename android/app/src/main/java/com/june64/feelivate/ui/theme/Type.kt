package com.june64.feelivate.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.june64.feelivate.R

/* The web's faces. Fontshare ships Satoshi in 300/400/500/700/900 and Clash
 * Display in 200–700; CSS resolves a requested 600 to 700 and 800 to 900, and
 * Compose's matcher does the same, so the web's weights land on the same files. */
val Satoshi = FontFamily(
    Font(R.font.satoshi_400, FontWeight.Normal),
    Font(R.font.satoshi_500, FontWeight.Medium),
    Font(R.font.satoshi_700, FontWeight.Bold),
    Font(R.font.satoshi_900, FontWeight.Black),
)

val ClashDisplay = FontFamily(
    Font(R.font.clashdisplay_400, FontWeight.Normal),
    Font(R.font.clashdisplay_500, FontWeight.Medium),
    Font(R.font.clashdisplay_600, FontWeight.SemiBold),
    Font(R.font.clashdisplay_700, FontWeight.Bold),
)

val Inter = FontFamily(Font(R.font.inter, FontWeight.Normal), Font(R.font.inter, FontWeight.Medium), Font(R.font.inter, FontWeight.Bold))

/** "Georgia, Times New Roman, serif" — the italic pull-quote face. */
val Georgia = FontFamily.Serif

private val NoPadding = PlatformTextStyle(includeFontPadding = false)
private val Centered = LineHeightStyle(alignment = LineHeightStyle.Alignment.Center, trim = LineHeightStyle.Trim.None)

/**
 * A text style written the way the web writes it: px size, CSS line-height
 * multiplier, em letter-spacing. 1 CSS px == 1 dp on the phone layouts we copy.
 */
fun style(
    family: FontFamily,
    size: Float,
    weight: Int = 500,
    lineHeight: Float? = null,
    letterSpacingEm: Float? = null,
    color: Color = Color.Unspecified,
    italic: Boolean = false,
): TextStyle = TextStyle(
    fontFamily = family,
    fontWeight = FontWeight(weight),
    fontSize = size.sp,
    lineHeight = if (lineHeight != null) (size * lineHeight).sp else TextUnit.Unspecified,
    letterSpacing = if (letterSpacingEm != null) letterSpacingEm.em else TextUnit.Unspecified,
    color = color,
    fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal,
    platformStyle = NoPadding,
    lineHeightStyle = Centered,
)

fun satoshi(size: Float, weight: Int = 500, lineHeight: Float? = null, ls: Float? = null, color: Color = Color.Unspecified, italic: Boolean = false) =
    style(Satoshi, size, weight, lineHeight, ls, color, italic)

fun clash(size: Float, weight: Int = 700, lineHeight: Float? = null, ls: Float? = null, color: Color = Color.Unspecified) =
    style(ClashDisplay, size, weight, lineHeight, ls, color)

fun georgia(size: Float, lineHeight: Float? = null, color: Color = Color.Unspecified) =
    style(Georgia, size, 400, lineHeight, null, color, italic = true)

fun inter(size: Float, weight: Int = 500, lineHeight: Float? = null, ls: Float? = null, color: Color = Color.Unspecified) =
    style(Inter, size, weight, lineHeight, ls, color)
