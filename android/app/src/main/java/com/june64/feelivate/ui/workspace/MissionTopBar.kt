package com.june64.feelivate.ui.workspace

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.keyframes
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.SessionSummary
import com.june64.feelivate.data.Streak
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.LogoMark
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/**
 * MissionTopBar.tsx, the phone branch: row 1 = goal pill · streak cluster · avatar,
 * row 2 = the labeled tiles. Dropdowns (goal menu, streak panel, profile menu) are
 * rendered by the caller inside the screen's root Box, anchored to this bar.
 */
@Composable
fun MissionTopBar(
    goalLabel: String,
    menuOpen: Boolean,
    onToggleMenu: () -> Unit,
    streak: Streak?,
    isPlanActive: Boolean,
    streakOpen: Boolean,
    onToggleStreak: () -> Unit,
    initials: String,
    onToggleProfile: () -> Unit,
    onOpenWeeks: () -> Unit,
    onOpenArchive: () -> Unit,
    onOpenAlerts: () -> Unit,
    onOpenCalendar: () -> Unit,
) {
    val t = tokens()
    val label = if (goalLabel.length > 16) goalLabel.take(16) + "…" else goalLabel
    val currentStreak = streak?.currentStreak ?: 0
    val shields = streak?.shieldsLeft
    val flameActive = currentStreak > 0
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            // goal pill
            val chev by animateFloatAsState(if (menuOpen) 180f else 0f, tween(200), label = "chev")
            Row(
                Modifier.widthIn(max = 160.dp).pressScale(0.97f).clip(CircleShape).background(t.cardBg).border(1.dp, t.borderMedium, CircleShape)
                    .tap { onToggleMenu() }.padding(horizontal = 11.dp, vertical = 7.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Box(Modifier.size(22.dp).clip(RoundedCornerShape(7.dp)).background(t.accentPrimary), contentAlignment = Alignment.Center) { LogoMark(15.dp, t.logoMarkOnChip) }
                Text(label, style = satoshi(12f, 700), color = t.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                Lucide(R.drawable.lu_chevron_down, 14.dp, t.textMuted, Modifier.graphicsLayer { rotationZ = chev })
            }
            Box(Modifier.weight(1f))
            // streak cluster
            if (isPlanActive) {
                var shown by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) { shown = true }
                val a by animateFloatAsState(if (shown) 1f else 0f, tween(300), label = "a")
                val y by animateFloatAsState(if (shown) 0f else -6f, tween(300), label = "y")
                val inf = rememberInfiniteTransition(label = "pillflame")
                val fs by inf.animateFloat(1f, 1f, infiniteRepeatable(keyframes { durationMillis = 2200; 1f at 0; 1.18f at 1100; 1f at 2200 }), label = "fs")
                val fr by inf.animateFloat(0f, 0f, infiniteRepeatable(keyframes { durationMillis = 2200; 0f at 0; -3f at 733; 3f at 1466; 0f at 2200 }), label = "fr")
                Row(
                    Modifier.graphicsLayer { alpha = a; translationY = y * density }.pressScale(0.95f).clip(CircleShape).background(t.cardBg)
                        .then(if (flameActive) Modifier.background(Brush.horizontalGradient(listOf(Status.FlameTo.copy(alpha = 0.094f), Color.Transparent))) else Modifier)
                        .border(1.dp, if (flameActive) Status.FlameTo.copy(alpha = 0.33f) else t.borderSubtle, CircleShape)
                        .tap { onToggleStreak() }.padding(horizontal = 13.dp, vertical = 7.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Box(Modifier.graphicsLayer { if (flameActive) { scaleX = fs; scaleY = fs; rotationZ = fr } }) {
                        if (flameActive) Lucide(R.drawable.lu_flame_fill, 15.dp, Status.FlameFrom)
                        Lucide(if (flameActive) R.drawable.lu_flame else R.drawable.lu_flame, 15.dp, if (flameActive) Status.FlameTo else t.textMuted)
                    }
                    Text("$currentStreak", style = clash(13f, 700), color = t.textPrimary)
                    if (shields != null) {
                        Box(Modifier.width(1.dp).height(14.dp).background(t.borderSubtle))
                        Lucide(R.drawable.lu_shield, 13.dp, t.accentPrimary)
                        Text("$shields", style = satoshi(12f, 700), color = t.textSecondary)
                    }
                }
            }
            // avatar (.user-avatar)
            Box(Modifier.size(32.dp).clip(CircleShape).background(t.accentWarm).tap { onToggleProfile() }, contentAlignment = Alignment.Center) {
                Text(initials, style = satoshi(12f, 700), color = Color.White)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (isPlanActive) LabeledTile(R.drawable.lu_layers, "Weeks", onOpenWeeks)
            LabeledTile(R.drawable.lu_archive, "Reports", onOpenArchive)
            LabeledTile(R.drawable.lu_bell, "Alerts", onOpenAlerts)
            LabeledTile(R.drawable.lu_calendar, "Calendar", onOpenCalendar)
        }
    }
}

@Composable
private fun RowScope.LabeledTile(@DrawableRes icon: Int, label: String, onClick: () -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier.weight(1f).clip(shape).background(t.cardBg).border(1.dp, t.borderSubtle, shape).tap(onClick = onClick).padding(horizontal = 6.dp, vertical = 9.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Lucide(icon, 16.dp, t.textSecondary)
        Text(label, style = satoshi(10f, 700, ls = 0.02f), color = t.textPrimary)
    }
}

/** The goal dropdown (300px, radius 16): new goal · your goals · archive · finish. */
@Composable
fun BoxScope.GoalMenu(
    open: Boolean, onClose: () -> Unit, sessions: List<SessionSummary>, activeSessionId: String?, isPlanActive: Boolean,
    onNewGoal: () -> Unit, onSelect: (String) -> Unit, onOpenArchive: () -> Unit, onStopSession: () -> Unit, modifier: Modifier = Modifier,
) {
    val t = tokens()
    AnimatedVisibility(open, modifier = Modifier.matchParentSize(), enter = fadeIn(tween(1)), exit = fadeOut(tween(1))) { Box(Modifier.matchParentSize().tap { onClose() }) }
    AnimatedVisibility(open, modifier = modifier, enter = fadeIn(tween(180, easing = EaseSilk)), exit = fadeOut(tween(180, easing = EaseSilk))) {
        var shown by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { shown = true }
        val s by animateFloatAsState(if (shown) 1f else 0.98f, tween(180, easing = EaseSilk), label = "s")
        val y by animateFloatAsState(if (shown) 0f else -8f, tween(180, easing = EaseSilk), label = "y")
        Column(
            Modifier.width(300.dp).heightIn(max = 380.dp).graphicsLayer { scaleX = s; scaleY = s; translationY = y * density }
                .shadow(24.dp, RoundedCornerShape(16.dp), ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f))
                .clip(RoundedCornerShape(16.dp)).background(t.bgSurface).border(1.dp, t.modalBorder, RoundedCornerShape(16.dp))
                .verticalScroll(rememberScrollState()).padding(8.dp),
        ) {
            MenuRow(R.drawable.lu_plus, "Start a new goal", t.textPrimary, t.accentPrimary, bold = true, pad = 10.dp) { onClose(); onNewGoal() }
            if (sessions.isNotEmpty()) Text("YOUR GOALS", style = satoshi(10.5f, 700, ls = 0.1f), color = t.textMuted, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 4.dp))
            sessions.forEach { s ->
                val active = s.id == activeSessionId
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(if (active) t.glassHover else Color.Transparent).tap { onClose(); onSelect(s.id) }.padding(horizontal = 12.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (active) Lucide(R.drawable.lu_check, 14.dp, t.accentPrimary) else Box(Modifier.width(14.dp))
                    Text(s.title?.takeIf { it.isNotBlank() } ?: s.focusPreview?.takeIf { it.isNotBlank() } ?: "Untitled goal", style = satoshi(13f, 500), color = t.textPrimary, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    if (s.phase == "active") Text("W${s.currentWeek}", style = satoshi(10f, 700), color = t.accentPrimary)
                }
            }
            Box(Modifier.padding(horizontal = 4.dp, vertical = 8.dp)) { Hairline() }
            MenuRow(R.drawable.lu_archive, "Report archive", t.textSecondary, t.textSecondary) { onClose(); onOpenArchive() }
            if (activeSessionId != null && isPlanActive) MenuRow(R.drawable.lu_stop_circle, "Finish this goal", t.accentWarm, t.accentWarm) { onClose(); onStopSession() }
        }
    }
}

@Composable
private fun MenuRow(@DrawableRes icon: Int, label: String, color: Color, iconColor: Color, bold: Boolean = false, pad: androidx.compose.ui.unit.Dp = 9.dp, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).tap(onClick = onClick).padding(horizontal = 12.dp, vertical = pad),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Lucide(icon, if (bold) 15.dp else 14.dp, iconColor)
        Text(label, style = satoshi(13f, if (bold) 700 else 500), color = color)
    }
}
