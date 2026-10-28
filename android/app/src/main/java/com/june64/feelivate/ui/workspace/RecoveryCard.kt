@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.launch

private val CHIPS = listOf("No time", "Low energy", "Forgot", "Life happened")
private val COUNT_WORDS = listOf("", "One", "Two", "Three", "Four", "Five", "Six", "Seven")

private fun headingFor(missCount: Int): String = when {
    missCount <= 1 -> "One missed day changes nothing."
    missCount == 2 -> "Two quiet days — today is the comeback."
    else -> "${COUNT_WORDS.getOrNull(missCount) ?: missCount.toString()} days quiet — the door is still open."
}

/** RecoveryCard.tsx — the morning after a real scheduled-day miss. */
@Composable
fun RecoveryCard(vm: WorkspaceViewModel, info: RecoveryInfo, commitmentWhy: String?, focus: String) {
    val t = tokens()
    val scope = rememberCoroutineScope()
    var line by remember { mutableStateOf("") }
    var savedReason by remember { mutableStateOf(vm.prefs.slipReason(info.missedDateIso)) }
    var saving by remember { mutableStateOf(false) }
    LaunchedEffect(info.missCount, focus) { line = vm.recoveryLine(info.missCount, focus) }

    Box(Modifier.mountRise(-14f, 0.99f, 550)) {
        MissionCard(radius = 20.dp, padding = androidx.compose.foundation.layout.PaddingValues(horizontal = 26.dp, vertical = 22.dp), borderColor = t.accentWarm) {
            Row(Modifier.padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Lucide(R.drawable.lu_sunrise, 15.dp, t.accentWarm)
                Text(
                    (if (info.missCount <= 1) (if (info.wasShielded) "Yesterday slipped · streak shielded" else "Yesterday slipped") else "${info.missCount} days missed").uppercase(),
                    style = satoshi(11f, 700, ls = 0.12f), color = t.accentWarm,
                )
            }
            Text(headingFor(info.missCount), style = clash(18f, 600, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(bottom = 6.dp))
            AnimatedContent(line, transitionSpec = { (fadeIn() + slideInVertically { 6 }) togetherWith fadeOut() }, label = "line") { l ->
                if (l.isNotEmpty()) Text(l, style = satoshi(13.5f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 14.dp))
            }
            if (!commitmentWhy.isNullOrBlank()) {
                Row(Modifier.padding(bottom = 16.dp).height(IntrinsicSize.Min)) {
                    Box(Modifier.width(2.dp).fillMaxHeight().background(t.borderMedium))
                    Column(Modifier.padding(start = 14.dp, top = 4.dp, bottom = 4.dp)) {
                        Text("“${commitmentWhy.trim()}”", style = satoshi(14f, 500, lineHeight = 1.6f, italic = true), color = t.textPrimary, modifier = Modifier.padding(bottom = 4.dp))
                        Text("— you, when you started", style = satoshi(11f, 500), color = t.textMuted)
                    }
                }
            }
            AnimatedContent(savedReason, transitionSpec = { (fadeIn() + slideInVertically { 6 }) togetherWith (fadeOut() + slideOutVertically { -6 }) }, label = "reason") { reason ->
                if (reason != null) {
                    Row(Modifier.clip(CircleShape).background(t.glassHover).border(1.dp, t.borderSubtle, CircleShape).padding(horizontal = 16.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Lucide(R.drawable.lu_check, 14.dp, t.accentPrimary)
                        Text("Noted — “$reason”. It'll shape your week report.", style = satoshi(12.5f, 600), color = t.textSecondary)
                    }
                } else {
                    Column {
                        Text("What got in the way?", style = satoshi(12f, 700), color = t.textPrimary, modifier = Modifier.padding(bottom = 8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            CHIPS.forEach { chip ->
                                Box(
                                    Modifier.pressScale(0.95f).clip(CircleShape).border(1.dp, t.borderMedium, CircleShape).tap(!saving) {
                                        saving = true
                                        scope.launch { if (vm.saveSlipReason(info.missedDateIso, chip)) savedReason = chip; saving = false }
                                    }.padding(horizontal = 14.dp, vertical = 8.dp),
                                ) { Text(chip, style = satoshi(12f, 600), color = t.textSecondary) }
                            }
                        }
                    }
                }
            }
        }
    }
}
