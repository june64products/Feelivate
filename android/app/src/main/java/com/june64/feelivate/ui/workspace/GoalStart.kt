@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.annotation.DrawableRes
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.LogoMark
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

private data class Suggestion(@DrawableRes val icon: Int, val label: String, val prompt: String)

private val SUGGESTIONS = listOf(
    Suggestion(R.drawable.lu_dumbbell, "I want to get fit", "I want to get fit"),
    Suggestion(R.drawable.lu_leaf, "Help me quit smoking", "Help me quit smoking"),
    Suggestion(R.drawable.lu_code, "Learn coding, for real", "Learn coding, for real this time"),
    Suggestion(R.drawable.lu_graduation_cap, "Exam prep, no burnout", "Exam prep without burning out"),
)

private val HOW_IT_WORKS = listOf(
    R.drawable.lu_message_circle to "Say your goal",
    R.drawable.lu_lock to "Commit to one week",
    R.drawable.lu_flame to "Show up daily",
)

/** GoalStart.tsx — one question, not a chat thread. */
@Composable
fun GoalStart(firstName: String, disabled: Boolean, onSubmit: (String) -> Unit) {
    val t = tokens()
    var draft by remember { mutableStateOf("") }
    Column(
        Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 32.dp, bottom = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(Modifier.padding(bottom = 30.dp).mountRise(18f, 1f, 650, 60), horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.padding(bottom = 26.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                var chip by remember { mutableStateOf(false) }
                LaunchedEffect(Unit) { chip = true }
                val cs by animateFloatAsState(if (chip) 1f else 0.6f, motionSpring(260f, 18f), label = "cs")
                val cr by animateFloatAsState(if (chip) 0f else -8f, motionSpring(260f, 18f), label = "cr")
                Box(
                    Modifier.size(38.dp).graphicsLayer { scaleX = cs; scaleY = cs; rotationZ = cr; alpha = if (chip) 1f else 0f }
                        .clip(RoundedCornerShape(10.dp)).background(t.accentPrimary),
                    contentAlignment = Alignment.Center,
                ) { LogoMark(26.dp, t.logoMarkOnChip) }
                Text("FEELIVATE", style = clash(25f, 700, ls = 0.09f), color = t.textPrimary)
            }
            if (firstName.isNotBlank()) {
                Text("HI ${firstName.uppercase()}", style = satoshi(13f, 600, ls = 0.14f), color = t.textMuted, modifier = Modifier.padding(bottom = 12.dp).mountRise(0f, 1f, 500, 250))
            }
            // Word-staggered headline
            FlowRow(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)) {
                "What do you want to change?".split(" ").forEachIndexed { i, word ->
                    Text("$word ", style = clash(30f, 600, lineHeight = 1.2f, ls = -0.02f), color = t.textPrimary, modifier = Modifier.mountRise(14f, 1f, 500, 180 + i * 60))
                }
            }
            Text("Say it once. Your mentor turns it into a week you can actually keep.", style = satoshi(14.5f, 500, lineHeight = 1.6f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.mountRise(0f, 1f, 500, 550))
        }
        Box(Modifier.fillMaxWidth().widthIn(max = 680.dp).padding(bottom = 28.dp).mountRise(24f, 0.985f, 650, 300)) {
            RadiantPromptInput(
                value = draft, onValueChange = { draft = it },
                onSubmit = { onSubmit(it) },
                placeholder = "I keep starting and quitting… this time I want to…",
                disabled = disabled,
            )
        }
        FlowRow(
            Modifier.widthIn(max = 720.dp).padding(bottom = 44.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            SUGGESTIONS.forEachIndexed { i, s ->
                Row(
                    Modifier.mountRise(14f, 1f, 500, 450 + i * 70).pressScale(0.97f)
                        .shadow(2.dp, CircleShape, ambientColor = t.shadowColor.copy(alpha = 0.04f), spotColor = t.shadowColor.copy(alpha = 0.06f))
                        .clip(CircleShape).background(t.cardBg).border(1.dp, t.borderMedium, CircleShape)
                        .tap(!disabled) { onSubmit(s.prompt) }
                        .padding(start = 12.dp, end = 18.dp, top = 11.dp, bottom = 11.dp),
                    verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Box(Modifier.size(30.dp).clip(CircleShape).background(t.glassHover), contentAlignment = Alignment.Center) { Lucide(s.icon, 15.dp, t.accentPrimary) }
                    Text(s.label, style = satoshi(13f, 600, ls = 0.01f), color = t.textSecondary)
                }
            }
        }
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.mountRise(10f, 1f, 600, 850),
        ) {
            HOW_IT_WORKS.forEachIndexed { i, (icon, label) ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Lucide(icon, 14.dp, t.textMuted)
                        Text(label, style = satoshi(12f, 600), color = t.textMuted)
                    }
                    if (i < HOW_IT_WORKS.size - 1) Lucide(R.drawable.lu_arrow_right, 12.dp, t.borderMedium)
                }
            }
        }
    }
}
