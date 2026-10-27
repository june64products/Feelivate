package com.june64.feelivate.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/** A lucide icon from the generated vector drawables (stroke 2, round caps — like the web). */
@Composable
fun Lucide(@DrawableRes id: Int, size: Dp, tint: Color, modifier: Modifier = Modifier) {
    Icon(painterResource(id), contentDescription = null, tint = tint, modifier = modifier.size(size))
}

/** The logo mark, tinted. `logo_2_backup.png` on the web is a black mark; `--logo-filter` recolours it. */
@Composable
fun LogoMark(size: Dp, color: Color, modifier: Modifier = Modifier) {
    Image(painterResource(R.drawable.logo_mark), contentDescription = null, modifier = modifier.size(size), colorFilter = ColorFilter.tint(color))
}

/** Brand chip: square of `--accent-primary` with the mark in `--btn-primary-text`. */
@Composable
fun LogoChip(size: Dp, radius: Dp, markSize: Dp, modifier: Modifier = Modifier) {
    val t = tokens()
    Box(modifier.size(size).clip(RoundedCornerShape(radius)).background(t.accentPrimary), contentAlignment = Alignment.Center) {
        LogoMark(markSize, t.logoMarkOnChip)
    }
}

/** Hairline in the web's `--border-subtle`. */
@Composable
fun Hairline(modifier: Modifier = Modifier, color: Color = tokens().borderSubtle) {
    Box(modifier.fillMaxWidth().height(1.dp).background(color))
}

/** A clickable surface with no ripple — the web has none; press feedback is scale/colour. */
fun Modifier.tap(enabled: Boolean = true, onClick: () -> Unit): Modifier = composed {
    val src = remember { MutableInteractionSource() }
    clickable(interactionSource = src, indication = null, enabled = enabled, onClick = onClick)
}

/**
 * The Swiss primary button on the login page: `--btn-primary-bg`, radius 4,
 * uppercase 14/700, padding 15. Disabled = opacity .5.
 */
@Composable
fun SwissButton(
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    loading: Boolean = false,
    textStyle: TextStyle = satoshi(14f, 700, ls = 0.02f),
    verticalPadding: Dp = 15.dp,
    background: Color? = null,
    foreground: Color? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    leading: (@Composable RowScope.() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val t = tokens()
    val src = remember { MutableInteractionSource() }
    Row(
        modifier
            .alpha(if (enabled) 1f else 0.5f)
            .pressScale(0.99f, src)
            .clip(RoundedCornerShape(4.dp))
            .background(background ?: t.btnPrimaryBg)
            .clickable(interactionSource = src, indication = null, enabled = enabled && !loading, onClick = onClick)
            .padding(vertical = verticalPadding, horizontal = 15.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) {
            Spinner(16.dp, foreground ?: t.btnPrimaryText)
        } else {
            leading?.invoke(this)
            Text(text.uppercase(), style = textStyle, color = foreground ?: t.btnPrimaryText, textAlign = TextAlign.Center)
            trailing?.invoke(this)
        }
    }
}

/** Pill button (radius 100): the workspace's primary/secondary buttons. */
@Composable
fun PillButton(
    text: String,
    modifier: Modifier = Modifier,
    filled: Boolean = true,
    enabled: Boolean = true,
    size: Float = 12f,
    weight: Int = 700,
    uppercase: Boolean = true,
    ls: Float = 0.06f,
    horizontalPadding: Dp = 20.dp,
    verticalPadding: Dp = 12.dp,
    background: Color? = null,
    foreground: Color? = null,
    borderColor: Color? = null,
    press: Float = 0.97f,
    leading: (@Composable RowScope.() -> Unit)? = null,
    trailing: (@Composable RowScope.() -> Unit)? = null,
    onClick: () -> Unit,
) {
    val t = tokens()
    val src = remember { MutableInteractionSource() }
    val bg = background ?: if (filled) t.btnPrimaryBg else Color.Transparent
    val fg = foreground ?: if (filled) t.btnPrimaryText else t.textPrimary
    val border = borderColor ?: if (filled) Color.Transparent else t.borderMedium
    Row(
        modifier
            .alpha(if (enabled) 1f else 0.5f)
            .pressScale(press, src)
            .clip(CircleShape)
            .background(bg)
            .border(1.dp, border, CircleShape)
            .clickable(interactionSource = src, indication = null, enabled = enabled, onClick = onClick)
            .padding(horizontal = horizontalPadding, vertical = verticalPadding),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading?.invoke(this)
        Text(if (uppercase) text.uppercase() else text, style = satoshi(size, weight, ls = if (uppercase) ls else null), color = fg, maxLines = 1)
        trailing?.invoke(this)
    }
}

/** lucide `Loader2` spinning — the web's `.animate-spin` (0.9s linear). */
@Composable
fun Spinner(size: Dp, color: Color) {
    val transition = rememberInfiniteTransition(label = "spin")
    val angle by transition.animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "angle")
    Icon(painterResource(R.drawable.lu_loader), null, tint = color, modifier = Modifier.size(size).rotate(angle))
}

/** Card with the web's `--shadow-lg` (0 24px 60px rgba(30,30,30,.12)). */
@Composable
fun Elevated(modifier: Modifier = Modifier, shape: Shape, elevation: Dp = 24.dp, content: @Composable () -> Unit) {
    val t = tokens()
    Box(modifier.shadow(elevation, shape, ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f)).clip(shape)) { content() }
}

/** Small inline error strip (login page: rgba(239,68,68,.06) bg, .2 border, #dc2626 text). */
@Composable
fun ErrorBox(text: String, modifier: Modifier = Modifier, radius: Dp = 4.dp, size: Float = 13f) {
    Box(
        modifier.fillMaxWidth().clip(RoundedCornerShape(radius))
            .background(Color(0x0FEF4444)).border(1.dp, Color(0x33EF4444), RoundedCornerShape(radius))
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) { Text(text, style = satoshi(size, 500, lineHeight = 1.5f), color = Color(0xFFDC2626)) }
}

@Composable
fun HSpace(w: Dp) = Spacer(Modifier.width(w))

@Composable
fun VSpace(h: Dp) = Spacer(Modifier.height(h))

/** `{ opacity: 0 → 1 }` on first composition; returns the alpha to apply. */
@Composable
fun fadeInAlpha(delayMs: Int = 0, durationMs: Int = 400): Float {
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { started = true }
    val a by animateFloatAsState(if (started) 1f else 0f, tween(durationMs, delayMs), label = "fade")
    return a
}

/** `{ y: from → 0 }` on first composition; returns the offset in px-as-dp. */
@Composable
fun riseIn(from: Float, delayMs: Int = 0, durationMs: Int = 500, easing: androidx.compose.animation.core.Easing = com.june64.feelivate.ui.theme.EaseSilk): Float {
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { started = true }
    val y by animateFloatAsState(if (started) 0f else from, tween(durationMs, delayMs, easing), label = "rise")
    return y
}
