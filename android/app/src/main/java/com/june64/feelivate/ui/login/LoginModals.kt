package com.june64.feelivate.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.CloseButton
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.ModalCard
import com.june64.feelivate.ui.components.ModalOverlay
import com.june64.feelivate.ui.components.SwissButton
import com.june64.feelivate.ui.components.openUrl
import com.june64.feelivate.ui.components.riseIn
import com.june64.feelivate.ui.components.fadeInAlpha
import com.june64.feelivate.ui.theme.Georgia
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.georgia
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/* The three overlays reachable from the login page's footer (LoginPage.tsx). Mobile paddings. */

val PLATFORM_FEATURES = listOf(
    "AI Accountability Partner" to "Not another chatbot. A relentless mentor that learns your patterns, calls out your excuses, and coaches you toward the person you said you wanted to become.",
    "7-Day Action Sprints" to "Every goal is broken down into a hyper-specific weekly plan — exact daily micro-actions, timed and sequenced. No vague resolutions, just a clear path.",
    "The Lock-In Protocol" to "Once your week is set, it's locked. You can't quietly soften it to make it easier. You commit, you execute — or the streak breaks.",
    "Daily Task Emails" to "Every day a personalized email lands in your inbox with today's exact task and how-to tips — sent at your chosen time, in your timezone. Direct task notifications, so you never wonder what to do next.",
    "Weekly Reports" to "At the end of each week you get an honest report card — what you actually did versus what you committed to — plus streaks that track your real momentum day over day.",
    "Emotion Logs & Voice Intake" to "Talk or type how you feel — Feelivate reads your emotional state, understands the \"why\" behind the slip, and adapts next week to your reality.",
    "Persistent Memory" to "It remembers your history, your wins, and your patterns. Context compounds week over week, so the guidance gets sharper the longer you stay.",
    "Calendar Integration" to "Your plan drops straight into your calendar with reminders, so there is no \"I forgot.\" The work is scheduled, not left to willpower.",
)

@Composable
private fun Kicker(text: String) = Text(text.uppercase(), style = satoshi(11f, 700, ls = 0.15f), color = tokens().textMuted)

@Composable
fun BoxScope.FeaturesModal(visible: Boolean, onClose: () -> Unit, onStart: () -> Unit) {
    val t = tokens()
    ModalOverlay(visible, onClose, padding = PaddingValues(16.dp), stiffness = 260f, damping = 24f, fromScale = 0.94f) {
        ModalCard(maxWidth = 760.dp, radius = 4.dp, padding = PaddingValues(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 28.dp)) {
            Column {
                Column(Modifier.padding(bottom = 24.dp)) {
                    Kicker("What you get")
                    Text("Everything Feelivate does", style = clash(26f, 700, lineHeight = 1.05f, ls = -0.05f), color = t.textPrimary, modifier = Modifier.padding(vertical = 12.dp))
                    Text("A complete accountability system — from turning a fuzzy goal into a locked weekly plan, to dragging you across the finish line every single day.", style = satoshi(14f, 500, lineHeight = 1.65f), color = t.textSecondary)
                }
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(2.dp)).background(t.borderSubtle).border(1.dp, t.borderSubtle, RoundedCornerShape(2.dp)), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    PLATFORM_FEATURES.forEachIndexed { i, (title, desc) ->
                        val a = fadeInAlpha(i * 50, 350); val y = riseIn(12f, i * 50, 350)
                        Column(Modifier.fillMaxWidth().background(t.modalBg).padding(horizontal = 18.dp, vertical = 20.dp).alpha(a).offset(y = y.dp)) {
                            Text(String.format("%02d", i + 1), style = satoshi(11f, 700, ls = 0.08f), color = t.textMuted)
                            Text(title, style = clash(15f, 700, ls = -0.02f), color = t.textPrimary, modifier = Modifier.padding(top = 10.dp, bottom = 8.dp))
                            Text(desc, style = satoshi(12.5f, 500, lineHeight = 1.6f), color = t.textSecondary)
                        }
                    }
                }
                SwissButton("Start Free", Modifier.fillMaxWidth().padding(top = 24.dp), trailing = { Lucide(R.drawable.lu_arrow_right, 15.dp, t.btnPrimaryText) }, onClick = onStart)
            }
            CloseButton(onClose, Modifier.align(Alignment.TopEnd).padding(top = 0.dp))
        }
    }
}

@Composable
fun BoxScope.AboutModal(visible: Boolean, onClose: () -> Unit, onStart: () -> Unit) {
    val t = tokens()
    ModalOverlay(visible, onClose, padding = PaddingValues(16.dp), stiffness = 260f, damping = 24f) {
        ModalCard(maxWidth = 640.dp, radius = 4.dp, padding = PaddingValues(horizontal = 20.dp, vertical = 30.dp)) {
            Column {
                Kicker("About Feelivate")
                Text(
                    buildAnnotatedString {
                        append("We don't sell motivation.\n")
                        withStyle(SpanStyle(fontFamily = Georgia, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Normal, color = t.textSecondary)) { append("We build") }
                        append(" execution.")
                    },
                    style = clash(27f, 700, lineHeight = 1.04f, ls = -0.05f), color = t.textPrimary, modifier = Modifier.padding(top = 14.dp, bottom = 20.dp),
                )
                Text(
                    "Feelivate is an AI accountability partner. You tell it what you actually want to become — fitter, focused, out of a rut — and it turns that fuzzy wish into a locked, hyper-specific 7-day plan, then holds you to it every single day until the person you described becomes the person you are.",
                    style = satoshi(15f, 500, lineHeight = 1.7f), color = t.textSecondary, modifier = Modifier.padding(bottom = 30.dp),
                )
                listOf(
                    "Why we exist" to "Almost nobody fails from a lack of goals — they fail at execution. Vague to-do lists, decision fatigue, zero accountability, and no honest feedback. Motivation is loud on Monday and gone by Wednesday. We built Feelivate because willpower is a terrible system, and most people just need one relentless partner who won't let them quietly give up.",
                    "How it works" to "You talk to your mentor like a friend. It extracts the real goal, breaks it into exact daily micro-actions, and locks the week so you can't soften it. Then it shows up: a personalized task email every morning at your time, streaks to protect, voice check-ins on hard days, and an honest report card every week. It remembers your patterns and quietly raises the difficulty as you grow.",
                    "What we believe" to "You don't rise to your goals; you fall to your systems. Accountability beats inspiration. Small, non-negotiable daily actions compound into a different life. Your future self is watching — Feelivate exists to make sure you don't disappoint them.",
                ).forEachIndexed { i, (label, body) ->
                    Column(Modifier.padding(top = if (i == 0) 0.dp else 4.dp, bottom = 18.dp)) {
                        Hairline()
                        Text(label.uppercase(), style = satoshi(11f, 700, ls = 0.12f), color = t.textPrimary, modifier = Modifier.padding(top = 20.dp, bottom = 10.dp))
                        Text(body, style = satoshi(13.5f, 500, lineHeight = 1.7f), color = t.textSecondary)
                    }
                }
                Text("\"Your future self is watching. Don't disappoint them.\"", style = georgia(17f, 1.6f), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 14.dp, bottom = 4.dp))
                Text("BUILT BY JUNE64", style = satoshi(10f, 700, ls = 0.15f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 26.dp))
                SwissButton("Start Your First Week", Modifier.fillMaxWidth(), trailing = { Lucide(R.drawable.lu_arrow_right, 15.dp, t.btnPrimaryText) }, onClick = onStart)
            }
            CloseButton(onClose, Modifier.align(Alignment.TopEnd))
        }
    }
}

@Composable
fun BoxScope.ContactModal(visible: Boolean, onClose: () -> Unit) {
    val t = tokens()
    val context = LocalContext.current
    ModalOverlay(visible, onClose, padding = PaddingValues(16.dp), stiffness = 280f, damping = 22f, fromScale = 0.92f) {
        ModalCard(maxWidth = 440.dp, radius = 4.dp, padding = PaddingValues(horizontal = 22.dp, vertical = 32.dp)) {
            Column {
                Kicker("Contact")
                Text("Let's talk.", style = clash(26f, 700, lineHeight = 1.05f, ls = -0.05f), color = t.textPrimary, modifier = Modifier.padding(vertical = 12.dp))
                Text("Questions, press, or partnerships — reach out and we usually reply within a day.", style = satoshi(14f, 500, lineHeight = 1.65f), color = t.textSecondary, modifier = Modifier.padding(bottom = 26.dp))
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(2.dp)).border(1.dp, t.borderSubtle, RoundedCornerShape(2.dp))) {
                    listOf("Email" to "info@june64.com", "Social" to "@feelivate", "Location" to "London, UK").forEachIndexed { i, (label, value) ->
                        if (i > 0) Hairline()
                        Row(Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 16.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(label.uppercase(), style = satoshi(10f, 700, ls = 0.12f), color = t.textMuted)
                            Text(value, style = satoshi(14f, 600), color = t.textPrimary)
                        }
                    }
                }
                SwissButton("Email Us", Modifier.fillMaxWidth().padding(top = 24.dp), leading = { Lucide(R.drawable.lu_mail, 15.dp, t.btnPrimaryText) }) { openUrl(context, "mailto:info@june64.com") }
            }
            CloseButton(onClose, Modifier.align(Alignment.TopEnd))
        }
    }
}
