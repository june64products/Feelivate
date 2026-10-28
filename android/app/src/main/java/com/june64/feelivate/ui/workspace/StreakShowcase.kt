package com.june64.feelivate.ui.workspace

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.Streak
import com.june64.feelivate.data.WeekWindow
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.delay

/** StreakShowcase.useCountUp — 800ms cubic ease-out. */
@Composable
fun countUp(target: Int, run: Boolean, durationMs: Int = 800): Int {
    var n by remember { mutableIntStateOf(0) }
    LaunchedEffect(target, run) {
        if (!run) { n = 0; return@LaunchedEffect }
        val start = System.nanoTime()
        while (true) {
            val p = ((System.nanoTime() - start) / 1_000_000f / durationMs).coerceIn(0f, 1f)
            n = Math.round(target * (1 - Math.pow((1 - p).toDouble(), 3.0))).toInt()
            if (p >= 1f) break
            delay(16)
        }
    }
    return n
}

/** FlameHero — layered glow, flicker, alive. */
@Composable
fun FlameHero(active: Boolean, size: Dp = 84.dp) {
    val t = tokens()
    val inf = rememberInfiniteTransition(label = "flame")
    val glowScale by inf.animateFloat(1f, 1f, infiniteRepeatable(keyframes { durationMillis = 2800; 1f at 0; 1.25f at 700; 1.05f at 1400; 1.2f at 2100; 1f at 2800 }), label = "gs")
    val glowAlpha by inf.animateFloat(0.35f, 0.35f, infiniteRepeatable(keyframes { durationMillis = 2800; 0.35f at 0; 0.6f at 700; 0.4f at 1400; 0.55f at 2100; 0.35f at 2800 }), label = "ga")
    val scale by inf.animateFloat(1f, 1f, infiniteRepeatable(keyframes { durationMillis = 2200; 1f at 0; 1.07f at 550; 0.98f at 1100; 1.05f at 1650; 1f at 2200 }), label = "s")
    val rot by inf.animateFloat(0f, 0f, infiniteRepeatable(keyframes { durationMillis = 2200; 0f at 0; -1.5f at 550; 1f at 1100; -1f at 1650; 0f at 2200 }), label = "r")
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        if (active) {
            Box(
                Modifier.size(size * 1.36f).graphicsLayer { scaleX = glowScale; scaleY = glowScale; alpha = glowAlpha }
                    .background(Brush.radialGradient(listOf(Status.FlameTo.copy(alpha = 0.33f), Color.Transparent), radius = with(androidx.compose.ui.platform.LocalDensity.current) { (size * 0.68f * 0.65f).toPx() }), CircleShape),
            )
        }
        Box(
            Modifier.size(size)
                .graphicsLayer { if (active) { scaleX = scale; scaleY = scale; rotationZ = rot } }
                .then(if (active) Modifier.shadow(16.dp, CircleShape, ambientColor = Status.FlameTo.copy(alpha = 0.4f), spotColor = Status.FlameTo.copy(alpha = 0.4f)) else Modifier)
                .clip(CircleShape)
                .background(if (active) Brush.radialGradient(listOf(Status.FlameFrom, Status.FlameTo), center = Offset(0.5f, 0.3f).let { Offset.Unspecified }) else Brush.linearGradient(listOf(t.glassHover, t.glassHover))),
            contentAlignment = Alignment.Center,
        ) {
            if (active) {
                Lucide(R.drawable.lu_flame_fill, size * 0.46f, Color.White.copy(alpha = 0.4f))
                Lucide(R.drawable.lu_flame, size * 0.46f, Color.White)
            } else {
                Lucide(R.drawable.lu_flame, size * 0.46f, t.textMuted)
            }
        }
    }
}

/** ShieldProgress — 7-day run toward the next shield, bank cap 2. */
@Composable
fun ShieldProgress(streak: Streak) {
    val t = tokens()
    val banked = streak.shieldsLeft ?: 0
    val intoRun = streak.currentStreak % 7
    val bankFull = banked >= 2
    var started by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { started = true }
    val target = if (bankFull) 1f else maxOf(0.04f, intoRun / 7f)
    val w by animateFloatAsState(if (started) target else 0f, tween(900, easing = EaseSilk), label = "w")
    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(bottom = 7.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Lucide(R.drawable.lu_shield, 13.dp, Status.ShieldBlue)
            Text("$banked shield${if (banked != 1) "s" else ""} banked", style = satoshi(11.5f, 700), color = t.textSecondary)
            Box(Modifier.weight(1f))
            Text(if (bankFull) "bank full (max 2)" else "$intoRun/7 to the next", style = satoshi(11f, 500), color = t.textMuted)
        }
        Box(Modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(t.glassHover)) {
            Box(
                Modifier.fillMaxWidth(w).height(6.dp).clip(CircleShape)
                    .background(if (bankFull) Brush.horizontalGradient(listOf(Status.ShieldBlue, Status.ShieldBlue)) else Brush.horizontalGradient(listOf(Status.ShieldBlue.copy(alpha = 0.53f), Status.ShieldBlue))),
            )
        }
    }
}

/** StreakPanel — the showcase under the top-bar pill (312px, radius 20). */
@Composable
fun BoxScope.StreakPanel(open: Boolean, onClose: () -> Unit, streak: Streak?, todayIso: String, todayDone: Boolean, modifier: Modifier = Modifier) {
    val t = tokens()
    val current = streak?.currentStreak ?: 0
    val animated = countUp(current, open)
    val active = current > 0
    AnimatedVisibility(open, modifier = Modifier.matchParentSize(), enter = fadeIn(), exit = fadeOut()) {
        Box(Modifier.fillMaxSize().tap { onClose() })
    }
    AnimatedVisibility(open, modifier = modifier, enter = fadeIn(tween(120)), exit = fadeOut(tween(160))) {
        var shown by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { shown = true }
        val s by animateFloatAsState(if (shown) 1f else 0.96f, motionSpring(340f, 26f), label = "s")
        val y by animateFloatAsState(if (shown) 0f else -10f, motionSpring(340f, 26f), label = "y")
        Column(
            Modifier.width(312.dp).graphicsLayer { scaleX = s; scaleY = s; translationY = y * density }
                .shadow(24.dp, RoundedCornerShape(20.dp), ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f))
                .clip(RoundedCornerShape(20.dp)).background(t.bgSurface).border(1.dp, t.modalBorder, RoundedCornerShape(20.dp))
                .padding(horizontal = 22.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(Modifier.padding(bottom = 14.dp)) { FlameHero(active) }
            Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(bottom = 2.dp)) {
                Text("$animated", style = clash(40f, 700, lineHeight = 1f, ls = -0.03f), color = if (active) t.textPrimary else t.textMuted)
                Text("day streak", style = clash(15f, 700), color = if (active) t.textPrimary else t.textMuted, modifier = Modifier.padding(start = 8.dp, bottom = 4.dp))
            }
            Text(
                (if (todayDone) "Today's in the bank" else if (active) "Today keeps it alive" else "Day 1 begins today").uppercase(),
                style = satoshi(11f, 700, ls = 0.1f), color = if (todayDone) Status.Amber else t.textMuted, modifier = Modifier.padding(bottom = 16.dp),
            )
            val days = streak?.daysThisWeek.orEmpty()
            if (days.isNotEmpty()) {
                Row(Modifier.padding(bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                    days.forEach { d ->
                        val isToday = d.date == todayIso
                        val bg = when (d.status) { "done" -> Status.Amber; "shielded" -> Status.ShieldBlue; else -> t.glassHover }
                        var dotShown by remember { mutableStateOf(false) }
                        LaunchedEffect(Unit) { delay(120); dotShown = true }
                        val ds by animateFloatAsState(if (dotShown) 1f else 0.5f, motionSpring(300f, 20f), label = "ds")
                        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Box(Modifier.size(12.dp).graphicsLayer { scaleX = ds; scaleY = ds; alpha = if (dotShown) 1f else 0f }.clip(CircleShape).background(bg).then(if (isToday) Modifier.border(2.dp, t.accentPrimary, CircleShape) else Modifier))
                            Text(WeekWindow.dayLetter(d.date), style = satoshi(9.5f, 700), color = t.textMuted)
                        }
                    }
                }
            }
            if (streak != null) ShieldProgress(streak)
            Row(Modifier.padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                Lucide(R.drawable.lu_trending_up, 12.dp, t.textMuted)
                Text("Best run: ${streak?.longestStreak ?: 0} days", style = satoshi(11f, 600), color = t.textMuted)
            }
        }
    }
}

/** StreakStrip — the slim flame strip on the Today stage. */
@Composable
fun StreakStrip(streak: Streak?, todayDone: Boolean) {
    val t = tokens()
    val current = streak?.currentStreak ?: 0
    val active = current > 0
    val intoRun = current % 7
    val banked = streak?.shieldsLeft ?: 0
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val a by animateFloatAsState(if (shown) 1f else 0f, tween(500, 50, EaseSilk), label = "a")
    val y by animateFloatAsState(if (shown) 0f else 10f, tween(500, 50, EaseSilk), label = "y")
    val shape = RoundedCornerShape(16.dp)
    Row(
        Modifier.fillMaxWidth().graphicsLayer { alpha = a; translationY = y * density }
            .clip(shape).background(t.cardBg)
            .then(if (active) Modifier.background(Brush.horizontalGradient(0f to Status.FlameTo.copy(alpha = 0.08f), 0.55f to Color.Transparent)) else Modifier)
            .border(1.dp, t.borderSubtle, shape).padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        FlameHero(active, 40.dp)
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                Text("$current", style = clash(19f, 700, lineHeight = 1f, ls = -0.02f), color = if (active) t.textPrimary else t.textMuted)
                Text("day streak", style = satoshi(12f, 700), color = t.textSecondary)
                if (banked > 0) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                    Lucide(R.drawable.lu_shield, 11.dp, Status.ShieldBlue)
                    Text("×$banked", style = satoshi(11f, 700), color = Status.ShieldBlue)
                }
            }
            Text(
                if (todayDone) "Today counted. See you tomorrow." else if (active) "$current day${if (current != 1) "s" else ""} on the line — today decides." else "Day 1 begins today. Light it up.",
                style = satoshi(11f, 500), color = t.textMuted, modifier = Modifier.padding(top = 3.dp),
            )
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            repeat(7) { i ->
                var ds by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) { delay(200L + i * 45L); ds = true }
                val sc by animateFloatAsState(if (ds) 1f else 0.4f, motionSpring(300f, 22f), label = "sc")
                Box(
                    Modifier.width(7.dp).height(if (i < intoRun) 18.dp else 10.dp).graphicsLayer { scaleX = sc; scaleY = sc; alpha = if (ds) 1f else 0f }.clip(CircleShape)
                        .background(if (i < intoRun) Brush.verticalGradient(listOf(Status.FlameFrom, Status.FlameTo)) else Brush.verticalGradient(listOf(t.glassHover, t.glassHover))),
                )
            }
        }
    }
}

/** TodayCard's 14-particle burst, drawn on a canvas for 1.1s. */
@Composable
fun CelebrationBurst(show: Boolean) {
    var started by remember(show) { mutableStateOf(false) }
    LaunchedEffect(show) { started = show }
    val p by animateFloatAsState(if (started) 1f else 0f, tween(1100, easing = FastOutSlowInEasing), label = "burst")
    if (!show) return
    Canvas(Modifier.fillMaxSize()) {
        for (i in 0 until 14) {
            val ang = Math.toRadians(i * (360.0 / 14))
            val dx = (Math.cos(ang) * (90 + (i % 3) * 30)).toFloat() * p
            val dy = (Math.sin(ang) * (70 + (i % 4) * 24)).toFloat() * p
            val c = if (i % 2 == 1) Status.Amber else Status.FlameFrom
            drawCircle(c.copy(alpha = 1f - p), radius = 4.dp.toPx() * (1f - 0.8f * p), center = Offset(size.width / 2 + dx * density, size.height * 0.55f + dy * density))
        }
    }
}
