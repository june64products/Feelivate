package com.june64.feelivate.ui.journey

import android.graphics.RenderEffect
import android.graphics.RuntimeShader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import com.june64.feelivate.data.EmotionEntry
import com.june64.feelivate.data.Prefs
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlin.math.roundToInt
import androidx.compose.foundation.gestures.detectTapGestures
import com.june64.feelivate.ui.tour.TourTarget
import com.june64.feelivate.ui.tour.tourTarget

/** JourneyPage/EmotionOrb's shared palette. */
val EMOTION_COLORS = mapOf(
    "motivated" to Color(0xFFF59E0B), "stressed" to Color(0xFFEF4444), "focused" to Color(0xFF6366F1),
    "anxious" to Color(0xFFF97316), "confident" to Color(0xFF10B981), "drained" to Color(0xFF8B5CF6),
    "excited" to Color(0xFFEC4899), "neutral" to Color(0xFF6B7280), "frustrated" to Color(0xFFDC2626),
    "hopeful" to Color(0xFF22C55E), "calm" to Color(0xFF0EA5E9),
)

fun emotionColor(label: String?): Color = EMOTION_COLORS[(label ?: "neutral").lowercase()] ?: Color(0xFF6B7280)

/**
 * The orb's surface, written once in AGSL: two slow-turning noise lobes lit
 * from the upper left, so the sphere looks alive rather than painted. Android
 * 13 and up run it; older phones get the gradient below, which is what the web
 * draws anyway.
 */
private const val ORB_SHADER = """
uniform float2 size;
uniform float time;
uniform float4 tint;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }

float noise(float2 p) {
    float2 i = floor(p), f = fract(p);
    float2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + float2(1.0, 0.0)), u.x),
               mix(hash(i + float2(0.0, 1.0)), hash(i + float2(1.0, 1.0)), u.x), u.y);
}

half4 main(float2 coord) {
    float2 uv = (coord / size) * 2.0 - 1.0;
    float r = length(uv);
    if (r > 1.0) return half4(0.0);

    // Sphere normal, so the light wraps the way a ball's does.
    float z = sqrt(max(0.0, 1.0 - r * r));
    float3 n = float3(uv, z);
    float3 l = normalize(float3(-0.45, -0.5, 0.75));
    float lambert = clamp(dot(n, l), 0.0, 1.0);

    // Two drifting lobes of noise give the surface its slow churn.
    float t = time * 0.35;
    float swirl = noise(uv * 2.4 + float2(t, -t * 0.6)) * 0.6
                + noise(uv * 4.8 - float2(t * 0.8, t)) * 0.4;

    float3 base = tint.rgb;
    float3 deep = base * 0.52;
    float3 col = mix(deep, base, clamp(0.35 + lambert * 0.75 + (swirl - 0.5) * 0.35, 0.0, 1.0));

    // Specular highlight, then a rim that keeps the edge from going flat.
    float spec = pow(lambert, 24.0) * 0.55;
    col += spec;
    col += base * pow(1.0 - z, 3.0) * 0.35;

    float edge = smoothstep(1.0, 0.94, r);
    return half4(col * edge, edge);
}
"""

/**
 * EmotionOrb.tsx — today's mood, draggable anywhere, position remembered.
 * Tapping opens the Journey; a drag never counts as a tap.
 */
@Composable
fun EmotionOrb(entry: EmotionEntry, prefs: Prefs, onClick: () -> Unit) {
    val t = tokens()
    val color = emotionColor(entry.emotionLabel)
    val density = LocalDensity.current
    val conf = LocalConfiguration.current
    val maxX = with(density) { (conf.screenWidthDp.dp - 60.dp).toPx() }
    val maxY = with(density) { (conf.screenHeightDp.dp - 150.dp).toPx() }

    var x by remember { mutableFloatStateOf(prefs.orbX() ?: (maxX - 16f)) }
    var y by remember { mutableFloatStateOf(prefs.orbY() ?: (maxY - 80f)) }
    var dragged by remember { mutableStateOf(false) }
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val appear by animateFloatAsState(if (shown) 1f else 0.6f, motionSpring(200f, 20f), label = "appear")

    val inf = rememberInfiniteTransition(label = "orb")
    val glow by inf.animateFloat(0.25f, 0.45f, infiniteRepeatable(tween(1500), RepeatMode.Reverse), label = "glow")
    val glowScale by inf.animateFloat(1f, 1.18f, infiniteRepeatable(tween(1500), RepeatMode.Reverse), label = "gs")
    val breathe by inf.animateFloat(1f, 1.06f, infiniteRepeatable(tween(1750), RepeatMode.Reverse), label = "breathe")

    Column(
        Modifier
            .tourTarget(TourTarget.EMOTION_ORB)
            .offset { IntOffset(x.roundToInt(), y.roundToInt()) }
            .graphicsLayer { scaleX = appear; scaleY = appear; alpha = appear }
            .pointerInput(Unit) {
                detectDragGestures(
                    onDragStart = { dragged = false },
                    onDragEnd = { if (dragged) prefs.saveOrb(x, y) },
                ) { change, drag ->
                    change.consume()
                    dragged = true
                    x = (x + drag.x).coerceIn(0f, maxX)
                    y = (y + drag.y).coerceIn(0f, maxY)
                }
            }
            .pointerInput(Unit) {
                detectTapGestures { if (!dragged) onClick() }
            },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            // Outer glow ring
            Box(
                Modifier.size(62.dp).graphicsLayer { scaleX = glowScale; scaleY = glowScale; alpha = glow }
                    .background(Brush.radialGradient(listOf(color.copy(alpha = 0.33f), Color.Transparent)), CircleShape),
            )
            Box(Modifier.size(44.dp).graphicsLayer { scaleX = breathe; scaleY = breathe }) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) ShaderOrb(color) else GradientOrb(color)
            }
        }
        Text(entry.emotionLabel.replaceFirstChar { it.uppercase() }, style = satoshi(10f, 700, ls = 0.03f), color = color)
        Text("${entry.emotionScore.toInt()}/10", style = satoshi(9f, 500), color = t.textMuted)
    }
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
@Composable
private fun ShaderOrb(color: Color) {
    val shader = remember { RuntimeShader(ORB_SHADER) }
    var time by remember { mutableFloatStateOf(0f) }
    LaunchedEffect(Unit) {
        val start = withFrameMillis { it }
        while (true) withFrameMillis { time = (it - start) / 1000f }
    }
    Canvas(Modifier.size(44.dp)) {
        shader.setFloatUniform("size", size.width, size.height)
        shader.setFloatUniform("time", time)
        shader.setFloatUniform("tint", color.red, color.green, color.blue, 1f)
        drawRect(brush = ShaderBrush(shader))
    }
}

/** The web's `radial-gradient(circle at 35% 35%, …)` plus its inner shine dot. */
@Composable
private fun GradientOrb(color: Color) {
    Box(
        Modifier.size(44.dp).clip(CircleShape)
            .background(Brush.radialGradient(listOf(color.copy(alpha = 0.93f), color.copy(alpha = 0.53f)), center = Offset(0.35f * 44f, 0.35f * 44f), radius = 44f))
            .border(2.dp, color.copy(alpha = 0.33f), CircleShape),
    ) {
        Box(
            Modifier.offset(x = 11.dp, y = 9.dp).size(8.dp).clip(CircleShape)
                .background(Brush.radialGradient(listOf(Color.White.copy(alpha = 0.55f), Color.White.copy(alpha = 0.0f)))),
        )
    }
}
