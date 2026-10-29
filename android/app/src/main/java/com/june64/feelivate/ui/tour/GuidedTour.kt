package com.june64.feelivate.ui.tour

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import com.june64.feelivate.data.ChatMessage
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/* ── where the tour's targets are ── */

/** Every `Modifier.tourTarget("key")` reports its bounds here. */
class TourRegistry {
    private val bounds = mutableStateMapOf<String, Rect>()
    fun put(key: String, rect: Rect) { bounds[key] = rect }
    fun remove(key: String) { bounds.remove(key) }
    operator fun get(key: String): Rect? = bounds[key]
}

val LocalTourRegistry = compositionLocalOf { TourRegistry() }

/** Marks an element as something the walkthrough can point at. */
fun Modifier.tourTarget(key: String): Modifier = composed {
    val registry = LocalTourRegistry.current
    androidx.compose.runtime.DisposableEffect(key) { onDispose { registry.remove(key) } }
    onGloballyPositioned { registry.put(key, it.boundsInWindow()) }
}

/* ── the controller ── */

/**
 * GuidedDemo.tsx — the self-playing walkthrough. Navigating, forward or back,
 * just applies that step's scene; entering a "type a message" step forward
 * animates the typewriter. It never calls the backend.
 */
class TourState(private val scope: CoroutineScope) {
    var active by mutableStateOf(false); private set
    var stepIndex by mutableIntStateOf(0); private set
    /** The scene as the screens should read it right now (the typewriter mutates it). */
    var scene by mutableStateOf(TourScene()); private set
    private var typingJob: Job? = null
    private var fastForward = false
    private var onExit: (() -> Unit)? = null

    val step: TourStep get() = TOUR_STEPS[stepIndex.coerceIn(0, TOUR_STEPS.lastIndex)]
    val isFirst: Boolean get() = stepIndex == 0
    val isLast: Boolean get() = stepIndex == TOUR_STEPS.lastIndex

    fun start(onExit: () -> Unit) {
        this.onExit = onExit
        active = true
        go(0, animate = true)
    }

    fun exit() {
        typingJob?.cancel()
        active = false
        scene = TourScene()
        onExit?.invoke()
    }

    fun next() {
        // A tap mid-typing fast-forwards the text instead of skipping the step.
        if (typingJob?.isActive == true) { fastForward = true; return }
        if (isLast) { exit(); return }
        go(stepIndex + 1, animate = true)
    }

    fun back() {
        if (isFirst) return
        go(stepIndex - 1, animate = false)   // backward → no typewriter, snap to the scene
    }

    private fun go(index: Int, animate: Boolean) {
        typingJob?.cancel()
        fastForward = false
        stepIndex = index
        val target = TOUR_STEPS[index].scene
        if (animate && target.typeLast && target.messages.isNotEmpty()) {
            val head = target.messages.dropLast(1)
            val last = target.messages.last()
            scene = target.copy(messages = head)
            typingJob = scope.launch {
                if (last.role == "assistant") {
                    scene = scene.copy(messages = head)   // the loading dots show while this waits
                    typing = true
                    delay(950)
                    typing = false
                }
                var i = 0
                scene = target.copy(messages = head + last.copy(content = ""))
                while (i < last.content.length) {
                    if (fastForward) { scene = target; break }
                    i = minOf(last.content.length, i + 2)
                    scene = target.copy(messages = head + last.copy(content = last.content.take(i)))
                    delay(18)
                }
                scene = target
            }
        } else {
            scene = target
        }
    }

    /** True while the scripted mentor "thinks" — the chat shows its loading dots. */
    var typing by mutableStateOf(false); private set
}

/** The dim with a hole, the pulsing ring, the click-blocker and the card. */
@Composable
fun BoxScope.GuidedTour(state: TourState) {
    if (!state.active) return
    val t = tokens()
    val registry = LocalTourRegistry.current
    val density = LocalDensity.current
    val step = state.step
    val rect = if (step.target == TourTarget.CENTER) null else registry[step.target]
    val accent = t.accentWarm
    val inf = rememberInfiniteTransition(label = "tour")
    val pulse by inf.animateFloat(4f, 8f, infiniteRepeatable(tween(800), RepeatMode.Reverse), label = "pulse")

    // The walkthrough drives the UI, so the real elements underneath must not be tappable.
    Box(Modifier.fillMaxSize().pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent() } })

    Canvas(Modifier.fillMaxSize()) {
        val dim = Color(0x8C0F0F12)
        if (rect == null) {
            drawRect(Color(0x800F0F12))
        } else {
            val pad = with(density) { 6.dp.toPx() }
            val hole = Rect(rect.left - pad, rect.top - pad, rect.right + pad, rect.bottom + pad)
            drawRect(dim, Offset.Zero, Size(size.width, maxOf(0f, hole.top)))
            drawRect(dim, Offset(0f, hole.bottom), Size(size.width, maxOf(0f, size.height - hole.bottom)))
            drawRect(dim, Offset(0f, hole.top), Size(maxOf(0f, hole.left), hole.height))
            drawRect(dim, Offset(hole.right, hole.top), Size(maxOf(0f, size.width - hole.right), hole.height))
            val r = with(density) { 12.dp.toPx() }
            drawRoundRect(
                color = accent, topLeft = hole.topLeft, size = hole.size,
                cornerRadius = CornerRadius(r), style = Stroke(with(density) { 2.dp.toPx() }),
            )
            drawRoundRect(
                color = accent.copy(alpha = 0.22f), topLeft = Offset(hole.left - pulse, hole.top - pulse),
                size = Size(hole.width + pulse * 2, hole.height + pulse * 2),
                cornerRadius = CornerRadius(r + pulse), style = Stroke(pulse),
            )
        }
    }

    // The card goes to the edge away from the target, so it never covers it.
    val screenH = with(density) { androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp.dp.toPx() }
    val pinTop = when (step.pin) {
        "top" -> true
        "bottom" -> false
        else -> rect != null && (rect.top + rect.height / 2) > screenH * 0.5f
    }
    Column(
        Modifier.align(if (pinTop) Alignment.TopCenter else Alignment.BottomCenter)
            .statusBarsPadding().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 14.dp)
            .shadow(24.dp, RoundedCornerShape(16.dp), ambientColor = t.shadowColor.copy(alpha = 0.18f), spotColor = t.shadowColor.copy(alpha = 0.18f))
            .clip(RoundedCornerShape(16.dp)).background(t.bgSurface).border(1.dp, t.borderMedium, RoundedCornerShape(16.dp))
            .padding(20.dp),
    ) {
        Row(Modifier.fillMaxWidth().padding(bottom = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("${state.stepIndex + 1} / ${TOUR_STEPS.size}", style = satoshi(10f, 700, ls = 0.08f), color = accent, modifier = Modifier.weight(1f))
            Text("Skip tour", style = satoshi(12f, 600), color = t.textMuted, modifier = Modifier.tap { state.exit() }.padding(horizontal = 4.dp, vertical = 8.dp))
        }
        Text(step.title, style = clash(16f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(bottom = 6.dp))
        Text(step.body, style = satoshi(13f, 500, lineHeight = 1.55f), color = t.textSecondary)
        Row(Modifier.fillMaxWidth().padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            PillButton(
                "‹ Back", Modifier.weight(1f).alpha(if (state.isFirst) 0.35f else 1f), filled = false,
                enabled = !state.isFirst, size = 13f, ls = 0.04f, verticalPadding = 13.dp, foreground = t.textSecondary,
            ) { state.back() }
            PillButton(if (state.isLast) "Finish" else "Next ›", Modifier.weight(2f), size = 13f, ls = 0.04f, verticalPadding = 14.dp) { state.next() }
        }
    }
}
