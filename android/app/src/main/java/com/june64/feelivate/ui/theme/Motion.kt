package com.june64.feelivate.ui.theme

import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.Easing
import androidx.compose.animation.core.SpringSpec
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.graphics.graphicsLayer
import kotlin.math.sqrt

/* framer-motion's curves, verbatim. */
val EaseSilk: Easing = CubicBezierEasing(0.16f, 1f, 0.3f, 1f)      // easeSilk / --ease-out-expo
val EaseSpringCss: Easing = CubicBezierEasing(0.34f, 1.56f, 0.64f, 1f)  // --ease-spring
val EaseStandard: Easing = CubicBezierEasing(0.4f, 0f, 0.2f, 1f)
val EaseOut: Easing = CubicBezierEasing(0f, 0f, 0.2f, 1f)
val EaseInOut: Easing = CubicBezierEasing(0.42f, 0f, 0.58f, 1f)
val EaseLanding: Easing = CubicBezierEasing(0.77f, 0f, 0.175f, 1f)

/** framer `{ type: 'spring', stiffness, damping }` → Compose spring (mass 1). */
fun <T> motionSpring(stiffness: Float, damping: Float, visibilityThreshold: T? = null): SpringSpec<T> =
    spring(dampingRatio = damping / (2f * sqrt(stiffness)), stiffness = stiffness, visibilityThreshold = visibilityThreshold)

/** springSnappy from missionTheme.ts */
fun <T> springSnappy(): SpringSpec<T> = motionSpring(320f, 28f)

fun <T> tweenMs(ms: Int, easing: Easing = EaseOut, delayMs: Int = 0) = tween<T>(durationMillis = ms, delayMillis = delayMs, easing = easing)

/** framer `whileTap={{ scale }}` — a press shrinks the element, release springs it back. */
fun Modifier.pressScale(scale: Float = 0.97f, interaction: MutableInteractionSource? = null): Modifier = composed {
    val src = interaction ?: remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val s by animateFloatAsState(if (pressed) scale else 1f, motionSpring(500f, 30f), label = "press")
    graphicsLayer { scaleX = s; scaleY = s }
}

@Composable
fun rememberPressSource() = remember { MutableInteractionSource() }
