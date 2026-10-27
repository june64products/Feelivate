package com.june64.feelivate.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.tokens

/**
 * The web's modal pattern: a fixed overlay (`--modal-overlay`, backdrop blur)
 * and a card that springs in (`scale 0.94 → 1`, slight rise). Rendered inside
 * the screen's root Box so z-order and blur-behind behave like the DOM.
 */
@Composable
fun BoxScope.ModalOverlay(
    visible: Boolean,
    onDismiss: (() -> Unit)?,
    modifier: Modifier = Modifier,
    overlayColor: Color = tokens().modalOverlay,
    alignment: Alignment = Alignment.Center,
    padding: PaddingValues = PaddingValues(20.dp),
    stiffness: Float = 300f,
    damping: Float = 24f,
    fromScale: Float = 0.94f,
    fromY: Dp = 16.dp,
    content: @Composable BoxScope.() -> Unit,
) {
    AnimatedVisibility(visible, modifier = Modifier.matchParentSize(), enter = fadeIn(tween(200)), exit = fadeOut(tween(200))) {
        Box(Modifier.fillMaxSize().background(overlayColor).tap(enabled = onDismiss != null) { onDismiss?.invoke() })
    }
    AnimatedVisibility(visible, modifier = Modifier.matchParentSize(), enter = fadeIn(tween(120)), exit = fadeOut(tween(180))) {
        var shown by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { shown = true }
        val s by animateFloatAsState(if (shown) 1f else fromScale, motionSpring(stiffness, damping), label = "s")
        val y by animateFloatAsState(if (shown) 0f else fromY.value, motionSpring(stiffness, damping), label = "y")
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = alignment) {
            Box(modifier.graphicsLayer { scaleX = s; scaleY = s; translationY = y * density }) { content() }
        }
    }
}

/** The common card: `--modal-bg`, `--modal-border`, radius, padding, shadow-lg, scroll when tall. */
@Composable
fun ModalCard(
    modifier: Modifier = Modifier,
    maxWidth: Dp = 400.dp,
    radius: Dp = 20.dp,
    padding: PaddingValues = PaddingValues(26.dp),
    background: Color = tokens().modalBg,
    borderColor: Color = tokens().modalBorder,
    maxHeightFraction: Float = 0.86f,
    scroll: Boolean = true,
    content: @Composable () -> Unit,
) {
    val t = tokens()
    val shape = RoundedCornerShape(radius)
    val screenH = LocalConfiguration.current.screenHeightDp.dp
    Box(
        modifier
            .fillMaxWidth()
            .widthIn(max = maxWidth)
            .heightIn(max = screenH * maxHeightFraction)
            .shadow(24.dp, shape, ambientColor = t.shadowColor.copy(alpha = 0.14f), spotColor = t.shadowColor.copy(alpha = 0.14f))
            .clip(shape)
            .background(background)
            .border(1.dp, borderColor, shape)
            .then(if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier)
            .padding(padding),
    ) { content() }
}

/** The small square close button the web puts in a modal's corner. */
@Composable
fun CloseButton(onClick: () -> Unit, modifier: Modifier = Modifier, size: Dp = 28.dp, radius: Dp = 4.dp, iconSize: Dp = 15.dp, background: Color? = null, tint: Color? = null) {
    val t = tokens()
    Box(
        modifier.size(size).clip(RoundedCornerShape(radius)).background(background ?: t.glassHover).tap(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Lucide(R.drawable.lu_x, iconSize, tint ?: t.textSecondary) }
}
