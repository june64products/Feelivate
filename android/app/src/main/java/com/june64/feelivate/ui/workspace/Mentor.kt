@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.workspace

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.ChatMessage
import com.june64.feelivate.data.Plan
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.LogoMark
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.motionSpring
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.delay

/**
 * MentorDrawer.tsx — a centered panel (min(720px,100%) × min(84vh,100%), radius 24)
 * over a blurred backdrop, with ChatWindow and the prompt input inside.
 */
@Composable
fun BoxScope.MentorDrawer(
    open: Boolean,
    onClose: () -> Unit,
    messages: List<ChatMessage>,
    isLoading: Boolean,
    isPlanApproved: Boolean,
    isFirstPlan: Boolean,
    inputDisabled: Boolean,
    onSend: (String) -> Unit,
    onApprovePlan: (String) -> Unit,
    onRequestPlanChange: (String) -> Unit,
    onPlanDialog: (PlanDialog?) -> Unit,
) {
    val t = tokens()
    val screenH = LocalConfiguration.current.screenHeightDp.dp
    AnimatedVisibility(open, modifier = Modifier.matchParentSize(), enter = fadeIn(tween(250)), exit = fadeOut(tween(250))) {
        Box(Modifier.fillMaxSize().background(t.modalOverlay).tap(onClick = onClose))
    }
    AnimatedVisibility(open, modifier = Modifier.matchParentSize(), enter = fadeIn(tween(150)), exit = fadeOut(tween(200))) {
        var shown by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) { shown = true }
        val s by animateFloatAsState(if (shown) 1f else 0.92f, motionSpring(300f, 30f), label = "s")
        val y by animateFloatAsState(if (shown) 0f else 24f, motionSpring(300f, 30f), label = "y")
        Box(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(14.dp), contentAlignment = Alignment.Center) {
            Column(
                Modifier.fillMaxWidth().widthIn(max = 720.dp).height(minOf(screenH * 0.84f, screenH))
                    .graphicsLayer { scaleX = s; scaleY = s; translationY = y * density }
                    .shadow(24.dp, RoundedCornerShape(24.dp), ambientColor = t.shadowColor.copy(alpha = 0.12f), spotColor = t.shadowColor.copy(alpha = 0.12f))
                    .clip(RoundedCornerShape(24.dp)).background(t.bgPrimary).border(1.dp, t.borderMedium, RoundedCornerShape(24.dp)),
            ) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.size(30.dp).clip(RoundedCornerShape(9.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_message_circle, 15.dp, t.btnPrimaryText) }
                    Column(Modifier.weight(1f)) {
                        Text("Your mentor", style = clash(14f, 700), color = t.textPrimary)
                        Text("Plans, slips, questions — anything", style = satoshi(11f, 500), color = t.textMuted)
                    }
                    Box(
                        Modifier.pressScale(0.92f).size(32.dp).clip(RoundedCornerShape(10.dp)).border(1.dp, t.borderSubtle, RoundedCornerShape(10.dp)).tap(onClick = onClose),
                        contentAlignment = Alignment.Center,
                    ) { Lucide(R.drawable.lu_x, 15.dp, t.textSecondary) }
                }
                Hairline()
                Column(Modifier.weight(1f).imePadding()) {
                    ChatWindow(Modifier.weight(1f), messages, isLoading, isPlanApproved, isFirstPlan, onApprovePlan, onRequestPlanChange, onPlanDialog)
                    var draft by remember { mutableStateOf("") }
                    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 14.dp)) {
                        RadiantPromptInput(draft, { draft = it }, { onSend(it) }, "Talk to your mentor...", inputDisabled, showHints = false)
                    }
                }
            }
        }
    }
}

/** ChatWindow.tsx */
@Composable
fun ChatWindow(
    modifier: Modifier = Modifier,
    messages: List<ChatMessage>,
    isLoading: Boolean,
    isPlanApproved: Boolean,
    isFirstPlan: Boolean,
    onApprovePlan: (String) -> Unit,
    onRequestPlanChange: (String) -> Unit,
    onPlanDialog: (PlanDialog?) -> Unit,
) {
    val t = tokens()
    if (messages.isEmpty() && !isLoading) {
        Column(modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically)) {
            Text("What can I help you plan?", style = clash(28f, 700, ls = -0.03f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.mountRise(10f, 1f, 400, 100))
            Text("Tell me your goal — fitness, coding, studying, music, anything. I'll build you a personalized week plan.", style = satoshi(14f, 500, lineHeight = 1.6f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 420.dp).mountRise(10f, 1f, 400, 200))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp).mountRise(10f, 1f, 400, 300)) {
                listOf("I want to get fit", "Help me learn coding", "Exam prep plan", "Learn guitar").forEach {
                    Box(Modifier.clip(CircleShape).background(t.cardBg).border(1.dp, t.borderMedium, CircleShape).padding(horizontal = 16.dp, vertical = 8.dp)) {
                        Text(it, style = satoshi(12f, 500, ls = 0.02f), color = t.textSecondary)
                    }
                }
            }
        }
        return
    }
    val listState = rememberLazyListState()
    LaunchedEffect(messages.size, isLoading, messages.lastOrNull()?.content?.length) {
        val n = messages.size + if (isLoading) 1 else 0
        if (n > 0) listState.animateScrollToItem(n - 1)
    }
    LazyColumn(modifier.fillMaxWidth(), state = listState, contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 20.dp)) {
        items(messages.size) { idx ->
            val msg = messages[idx]
            val isUser = msg.role == "user"
            Column(Modifier.fillMaxWidth()) {
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp).mountRise(8f, 1f, 300),
                    horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
                    verticalAlignment = Alignment.Bottom,
                ) {
                    if (!isUser) {
                        Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { LogoMark(16.dp, t.logoMarkOnChip) }
                        Box(Modifier.width(12.dp))
                    }
                    val shape = if (isUser) RoundedCornerShape(18.dp, 18.dp, 4.dp, 18.dp) else RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp)
                    Box(
                        Modifier.widthIn(max = 280.dp).clip(shape).background(if (isUser) t.btnPrimaryBg else t.cardBg)
                            .then(if (isUser) Modifier else Modifier.border(1.dp, t.borderSubtle, shape))
                            .padding(horizontal = 18.dp, vertical = if (isUser) 12.dp else 14.dp),
                    ) {
                        Text(markdown(msg.content), style = satoshi(14f, 500, lineHeight = 1.7f), color = if (isUser) t.btnPrimaryText else t.textPrimary)
                    }
                }
                msg.safety?.let { SafetyCard(it) }
                msg.blocked?.let { BlockedNoticeCard(it) }
                val plan = msg.plan
                if (plan != null && !isPlanApproved) PlanCard(plan, isFirstPlan, onApprovePlan, onRequestPlanChange, onPlanDialog)
            }
        }
        if (isLoading) item {
            Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(t.btnPrimaryBg), contentAlignment = Alignment.Center) { LogoMark(16.dp, t.logoMarkOnChip) }
                Row(
                    Modifier.clip(RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp)).background(t.cardBg).border(1.dp, t.borderSubtle, RoundedCornerShape(18.dp, 18.dp, 18.dp, 4.dp)).padding(horizontal = 18.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically,
                ) { repeat(3) { i -> LoadingDot(i) } }
            }
        }
    }
}

/** `.loading-dot` — 5px, dotBounce 1.4s, 0.16s stagger. */
@Composable
private fun LoadingDot(index: Int) {
    val t = tokens()
    val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "dot")
    val y by inf.animateFloat(0f, -6f, infiniteRepeatable(tween(560, index * 160, androidx.compose.animation.core.FastOutSlowInEasing), RepeatMode.Reverse, androidx.compose.animation.core.StartOffset(index * 160)), label = "y")
    Box(Modifier.size(5.dp).graphicsLayer { translationY = y * density }.clip(CircleShape).background(t.textMuted))
}

/** ChatWindow.formatMarkdown — bold, italic, inline code. */
@Composable
fun markdown(text: String) = buildAnnotatedString {
    var i = 0
    val patterns = listOf(
        Regex("""\*\*(.+?)\*\*""") to SpanStyle(fontWeight = FontWeight.Bold),
        Regex("""\*(.+?)\*""") to SpanStyle(fontStyle = FontStyle.Italic),
        Regex("""`(.+?)`""") to SpanStyle(fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = androidx.compose.ui.unit.TextUnit(12f, androidx.compose.ui.unit.TextUnitType.Sp)),
    )
    val matches = patterns.flatMap { (re, style) -> re.findAll(text).map { Triple(it.range, it.groupValues[1], style) } }.sortedBy { it.first.first }
    val taken = ArrayList<IntRange>()
    for ((range, inner, style) in matches) {
        if (taken.any { it.first <= range.first && range.last <= it.last }) continue
        if (range.first < i) continue
        append(text.substring(i, range.first))
        withStyle(style) { append(inner) }
        i = range.last + 1
        taken.add(range)
    }
    if (i < text.length) append(text.substring(i))
}

/** SafetyCard.tsx — crisis resources. */
@Composable
fun SafetyCard(notice: com.june64.feelivate.data.SafetyNotice) {
    val t = tokens()
    val context = androidx.compose.ui.platform.LocalContext.current
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 16.dp).clip(shape).background(Status.Error.copy(alpha = 0.05f)).border(1.dp, Status.Error.copy(alpha = 0.28f), shape).padding(horizontal = 20.dp, vertical = 18.dp),
    ) {
        Row(Modifier.padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Lucide(R.drawable.lu_life_buoy, 17.dp, Status.ErrorText)
            Text(notice.headline, style = clash(14f, 700, ls = -0.01f), color = t.textPrimary)
        }
        Text(notice.body, style = satoshi(13f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 14.dp))
        notice.resources.forEach { r ->
            Column(Modifier.fillMaxWidth().padding(top = 10.dp)) {
                Hairline(color = Status.Error.copy(alpha = 0.15f))
                Text(r.region.uppercase(), style = satoshi(10f, 700, ls = 0.12f), color = t.textMuted, modifier = Modifier.padding(top = 10.dp, bottom = 4.dp))
                Text(r.name, style = satoshi(13f, 700), color = t.textPrimary)
                Text(
                    r.contact, style = satoshi(13f, 700), color = Status.ErrorText,
                    modifier = Modifier.padding(top = 2.dp).tap {
                        val c = r.contact.trim()
                        com.june64.feelivate.ui.components.openUrl(context, if (c.startsWith("http")) c else "tel:" + c.filter { it.isDigit() })
                    },
                )
                Text(r.note, style = satoshi(11.5f, 500, lineHeight = 1.5f), color = t.textMuted, modifier = Modifier.padding(top = 3.dp))
            }
        }
    }
}

/** BlockedNoticeCard.tsx */
@Composable
fun BlockedNoticeCard(notice: com.june64.feelivate.data.BlockedNotice) {
    val t = tokens()
    val shape = RoundedCornerShape(14.dp)
    Column(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 16.dp).clip(shape).background(t.glassSurface).border(1.dp, t.borderMedium, shape).padding(horizontal = 18.dp, vertical = 16.dp)) {
        Row(Modifier.padding(bottom = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Lucide(R.drawable.lu_shield_alert, 16.dp, t.textSecondary)
            Text(notice.headline, style = clash(13f, 700, ls = -0.01f), color = t.textPrimary)
        }
        Text(notice.body, style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary)
    }
}
