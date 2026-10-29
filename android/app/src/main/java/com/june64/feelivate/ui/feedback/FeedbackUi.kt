@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.feedback

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.CloseButton
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.ModalCard
import com.june64.feelivate.ui.components.ModalOverlay
import com.june64.feelivate.ui.components.PillButton
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.SwissCheckbox
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import com.june64.feelivate.ui.workspace.ModalField
import kotlinx.coroutines.launch

/* ── the option sets, from feedbackApi.ts ── */

private val FEEDBACK_CHIPS = listOf(
    "signup" to "Sign-up", "tutorial" to "Tutorial", "plan" to "Weekly plan", "mentor_chat" to "Mentor chat",
    "alerts" to "Alerts & emails", "design" to "Look & feel", "speed" to "Speed", "other" to "Something else",
)
private val UPSET_OPTIONS = listOf(Triple("very", "Very upset", "I'd miss it"), Triple("a_bit", "A bit", "nice to have"), Triple("not_really", "Not really", "wouldn't notice"))
private val PLAN_FIT_OPTIONS = listOf(Triple("too_hard", "Too hard", null), Triple("about_right", "About right", null), Triple("too_easy", "Too easy", null))
private val TASK_QUALITY_OPTIONS = listOf(
    Triple("great", "Spot on", "exactly what I needed"), Triple("fine", "Fine", "did it, nothing special"),
    Triple("off", "A bit off", "not quite right for me"), Triple("didnt_fit", "Didn't fit my day", "wrong time or place"),
)
private val TASK_CLARITY_OPTIONS = listOf(Triple("clear", "Clear", null), Triple("somewhat", "Somewhat", null), Triple("unclear", "Unclear", null))
private val TASK_TIME_OPTIONS = listOf(Triple("shorter", "Took less", null), Triple("right", "As planned", null), Triple("longer", "Took longer", null))
private val TWEAK_REASON_OPTIONS = listOf(
    Triple("too_hard", "Too hard for where I am", null), Triple("too_easy", "Too easy, not worth it", null),
    Triple("wrong_time", "Wrong time of day / week", null), Triple("not_my_goal", "Doesn't match my goal", null),
    Triple("misunderstood", "The mentor misunderstood me", null), Triple("other", "Something else", null),
)

private val COPY = mapOf(
    Trigger.LOGOUT to ("Before you go — 20 seconds?" to "One honest answer helps more than you would think."),
    Trigger.TAB_RETURN to ("Welcome back" to "While it is fresh: how has Feelivate been so far?"),
    Trigger.FIRST_PLAN to ("Does this plan feel right?" to "Before you lock it — one tap."),
    Trigger.FIRST_CHATS to ("How is the mentor so far?" to "You have had a few exchanges. First impressions?"),
    Trigger.TIMER to ("Quick pulse check" to "You have been here a few minutes. How is it going?"),
    Trigger.SIDE_TAB to ("Tell us what you think" to "Every note goes straight to the people building Feelivate."),
    Trigger.AFTER_JOURNAL to ("How was today's task?" to "Voice note saved. Three taps and you are done."),
    Trigger.SECOND_TWEAK to ("Two tweaks in — what is off?" to "Help the mentor get it right next time."),
    Trigger.WEEKLY_REPORT to ("One week in. Be honest." to "You have seen a full week now — this is the feedback that matters most."),
)

@Composable
private fun FieldLabel(text: String, optional: Boolean = false) {
    val t = tokens()
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(bottom = 8.dp)) {
        Text(text.uppercase(), style = satoshi(11f, 700, ls = 0.1f), color = t.textSecondary)
        if (optional) Text("(optional)", style = satoshi(11f, 400), color = t.textMuted)
    }
}

@Composable
private fun Choice(label: String, options: List<Triple<String, String, String?>>, value: String?, block: Boolean = false, onChange: (String) -> Unit) {
    val t = tokens()
    Column(Modifier.fillMaxWidth().padding(bottom = 18.dp)) {
        FieldLabel(label)
        if (block) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { options.forEach { o -> ChoiceChip(o, value == o.first, Modifier.fillMaxWidth()) { onChange(o.first) } } }
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                options.forEach { o -> ChoiceChip(o, value == o.first) { onChange(o.first) } }
            }
        }
    }
}

@Composable
private fun ChoiceChip(option: Triple<String, String, String?>, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(12.dp)
    Row(
        modifier.clip(shape).background(if (selected) t.accentPrimary else Color.Transparent).border(1.dp, if (selected) t.accentPrimary else t.borderMedium, shape)
            .tap(onClick = onClick).padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text(option.second, style = satoshi(13f, 600), color = if (selected) t.btnPrimaryText else t.textPrimary)
        option.third?.let { Text(it, style = satoshi(12f, 400), color = (if (selected) t.btnPrimaryText else t.textMuted).copy(alpha = 0.8f)) }
    }
}

/** FeedbackModal.tsx — one short form per moment, the fuller one for the rest. */
@Composable
fun BoxScope.FeedbackModal(state: FeedbackState, sessionId: String?) {
    val t = tokens()
    val scope = rememberCoroutineScope()
    val trigger = state.trigger
    val kind = kindFor(trigger)
    val copy = COPY[trigger] ?: COPY[Trigger.SIDE_TAB]!!

    var upset by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var upsetReason by remember(state.isOpen) { mutableStateOf("") }
    var likedMost by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var confusing by remember(state.isOpen) { mutableStateOf(emptyList<String>()) }
    var quitReason by remember(state.isOpen) { mutableStateOf("") }
    var broke by remember(state.isOpen) { mutableStateOf("") }
    var brokeOpen by remember(state.isOpen) { mutableStateOf(false) }
    var fit by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var quality by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var clarity by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var timeTaken by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var reason by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var note by remember(state.isOpen) { mutableStateOf("") }
    var contactOk by remember(state.isOpen) { mutableStateOf(false) }
    var email by remember(state.isOpen) { mutableStateOf("") }
    var sending by remember(state.isOpen) { mutableStateOf(false) }
    var error by remember(state.isOpen) { mutableStateOf<String?>(null) }
    var done by remember(state.isOpen) { mutableStateOf(false) }

    val needsReason = upset == "a_bit" || upset == "not_really"
    val canSend = when (kind) {
        "full" -> upset != null && (!needsReason || upsetReason.isNotBlank())
        "plan_fit" -> fit != null
        "task_day" -> quality != null
        "tweaks" -> reason != null
        else -> false
    }

    ModalOverlay(state.isOpen, if (sending) null else ({ state.close(false) }), padding = PaddingValues(16.dp), stiffness = 300f, damping = 26f, fromScale = 0.94f, fromY = 18.dp) {
        ModalCard(maxWidth = 480.dp, radius = 20.dp, padding = PaddingValues(horizontal = 22.dp, vertical = 24.dp), background = t.bgSurface, maxHeightFraction = 0.9f) {
            Column {
                if (done) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(52.dp).clip(CircleShape).background(t.accentGlow), contentAlignment = Alignment.Center) { Lucide(R.drawable.lu_check, 24.dp, t.accentPrimary) }
                        Text("Thank you.", style = clash(20f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(top = 16.dp, bottom = 6.dp))
                        Text("It goes straight to the people building Feelivate.", style = satoshi(13.5f, 500, lineHeight = 1.6f), color = t.textSecondary)
                        PillButton("Close", Modifier.padding(top = 20.dp), size = 12f, ls = 0.04f) { state.close(true) }
                    }
                    return@ModalCard
                }

                Text(copy.first, style = clash(20f, 600, lineHeight = 1.2f), color = t.textPrimary, modifier = Modifier.padding(end = 36.dp, bottom = 4.dp))
                if (copy.second.isNotBlank()) Text(copy.second, style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 20.dp))

                when (kind) {
                    "plan_fit" -> {
                        Choice("Week ${state.details.weekNumber ?: 1}'s plan is…", PLAN_FIT_OPTIONS, fit, block = true) { fit = it }
                        if (fit == "too_hard" || fit == "too_easy") {
                            FieldLabel("What would make it fit?", optional = true)
                            ModalField(note, { note = it }, if (fit == "too_hard") "e.g. 3×12 push-ups is a lot for day one" else "e.g. I already run 5k, this is a warm-up", radius = 12, minHeight = 80, singleLine = false)
                        }
                    }
                    "task_day" -> {
                        state.details.taskLabel?.let { Text(it, style = satoshi(12.5f, 500, lineHeight = 1.5f), color = t.textMuted, modifier = Modifier.padding(bottom = 16.dp)) }
                        Choice("Today's task was…", TASK_QUALITY_OPTIONS, quality, block = true) { quality = it }
                        Choice("Was it clear what to do?", TASK_CLARITY_OPTIONS, clarity) { clarity = it }
                        Choice("Time it took vs the plan", TASK_TIME_OPTIONS, timeTaken) { timeTaken = it }
                        if (quality == "off" || quality == "didnt_fit") {
                            FieldLabel("What would have fit better?", optional = true)
                            ModalField(note, { note = it }, "One line is plenty.", radius = 12, minHeight = 80, singleLine = false)
                        }
                    }
                    "tweaks" -> {
                        Choice("The main reason the draft isn't landing", TWEAK_REASON_OPTIONS, reason, block = true) { reason = it }
                        FieldLabel("Anything the mentor keeps getting wrong?", optional = true)
                        ModalField(note, { note = it }, "e.g. I said mornings only, it keeps planning evenings", radius = 12, minHeight = 80, singleLine = false)
                    }
                    else -> {
                        Choice("If Feelivate went away tomorrow, you'd be…", UPSET_OPTIONS, upset, block = true) { upset = it }
                        if (needsReason) {
                            FieldLabel("What's the main reason?")
                            ModalField(upsetReason, { upsetReason = it }, "Honest is better than polite.", radius = 12, minHeight = 80, singleLine = false)
                            Box(Modifier.padding(bottom = 18.dp))
                        }
                        FieldLabel("The one thing you liked most", optional = true)
                        FlowRow(Modifier.padding(bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FEEDBACK_CHIPS.forEach { (key, label) ->
                                ChoiceChip(Triple(key, label, null), likedMost == key) { likedMost = if (likedMost == key) null else key }
                            }
                        }
                        FieldLabel("What was confusing?", optional = true)
                        FlowRow(Modifier.padding(bottom = 18.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            FEEDBACK_CHIPS.forEach { (key, label) ->
                                ChoiceChip(Triple(key, label, null), key in confusing) { confusing = if (key in confusing) confusing - key else confusing + key }
                            }
                        }
                        FieldLabel("What almost made you quit?", optional = true)
                        ModalField(quitReason, { quitReason = it }, "Or: what did you expect to happen that didn't?", radius = 12, minHeight = 80, singleLine = false)
                        Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 8.dp).tap { brokeOpen = !brokeOpen }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Lucide(if (brokeOpen) R.drawable.lu_chevron_up else R.drawable.lu_chevron_down, 14.dp, t.textSecondary)
                            Text("Something broke?", style = satoshi(13f, 600), color = t.textSecondary)
                        }
                        AnimatedVisibility(brokeOpen) {
                            Column {
                                FieldLabel("What broke, and where?", optional = true)
                                ModalField(broke, { broke = it }, "What you did, what you expected, what happened instead.", radius = 12, minHeight = 90, singleLine = false)
                            }
                        }
                    }
                }

                Row(Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 16.dp).tap { contactOk = !contactOk }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SwissCheckbox(contactOk, true, onChange = { contactOk = it })
                    Text("You can reply to me about this", style = satoshi(13f, 500), color = t.textSecondary)
                }
                if (contactOk) {
                    FieldLabel("Email", optional = true)
                    ModalField(email, { email = it }, "you@example.com", radius = 12, minHeight = 46, keyboardType = KeyboardType.Email)
                }
                error?.let { Text(it, style = satoshi(12.5f, 500), color = Status.ErrorText, modifier = Modifier.padding(top = 12.dp)) }

                Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PillButton("Not now", Modifier.weight(1f), filled = false, size = 12f, ls = 0.04f, verticalPadding = 12.dp, foreground = t.textSecondary, enabled = !sending) { state.close(false) }
                    PillButton(if (sending) "Sending…" else "Send", Modifier.weight(1f), enabled = canSend && !sending, size = 12f, ls = 0.04f, verticalPadding = 12.dp, leading = { if (sending) Spinner(14.dp, t.btnPrimaryText) }) {
                        sending = true; error = null
                        scope.launch {
                            val answers: Map<String, Any?> = when (kind) {
                                "plan_fit" -> mapOf("plan_fit" to fit, "note" to note, "week_number" to state.details.weekNumber)
                                "task_day" -> mapOf("task_quality" to quality, "task_clear" to clarity, "task_time" to timeTaken, "note" to note, "task_label" to state.details.taskLabel)
                                "tweaks" -> mapOf("tweak_reason" to reason, "note" to note, "tweak_count" to state.details.tweakCount)
                                else -> mapOf(
                                    "upset" to upset, "upset_reason" to upsetReason, "liked_most" to likedMost,
                                    "confusing" to confusing, "quit_reason" to quitReason,
                                    "broke" to if (brokeOpen) broke else null, "week_number" to state.details.weekNumber,
                                )
                            }
                            state.submit(answers, note.takeIf { kind == "full" }, contactOk, email, state.details.sessionId ?: sessionId)
                                .onSuccess { sending = false; done = true }
                                .onFailure { sending = false; error = "Could not send your feedback right now." }
                        }
                    }
                }
            }
        }
        CloseButton({ if (!sending) state.close(false) }, Modifier.align(Alignment.TopEnd).padding(14.dp), radius = 8.dp)
    }
}

/** FeedbackTab.tsx — the small pill in the bottom-right corner. */
@Composable
fun BoxScope.FeedbackTab(state: FeedbackState) {
    val t = tokens()
    AnimatedVisibility(
        state.tabVisible,
        modifier = Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(end = 14.dp, bottom = 14.dp),
        enter = fadeIn(), exit = fadeOut(),
    ) {
        Row(
            Modifier.pressScale(0.95f).clip(CircleShape).background(t.cardBg).border(1.dp, t.borderMedium, CircleShape)
                .tap { state.open() }.padding(horizontal = 14.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Lucide(R.drawable.lu_message_square, 14.dp, t.textSecondary)
            Text("Feedback", style = satoshi(12f, 700), color = t.textPrimary)
        }
    }
}
