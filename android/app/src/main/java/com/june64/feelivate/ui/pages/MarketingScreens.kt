@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.pages

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.june64.feelivate.R
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.BlogCard
import com.june64.feelivate.data.ContactRequest
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.SwissButton
import com.june64.feelivate.ui.components.openUrl
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.components.webUrl
import com.june64.feelivate.ui.theme.Georgia
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import com.june64.feelivate.ui.workspace.ModalField
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/* ── Pricing ── */

private val INCLUDED = listOf(
    "AI accountability partner (unlimited chats)",
    "Goal-based weekly plan generation",
    "The Lock-In Protocol",
    "Daily personalized task emails",
    "Voice journaling & emotion tracking",
    "Streaks & daily check-ins",
    "Weekly report cards",
    "Google Calendar sync",
)

private val PRICING_FAQS = listOf(
    "Is Feelivate really free?" to "Yes. Feelivate is currently free — founding members get full access to the best version at no cost while we grow.",
    "Will I be charged later?" to "No surprise charges. If paid plans launch in future, founding members will be told well in advance and there's no automatic billing today.",
    "Do I need a credit card?" to "No credit card is required to start.",
    "What do founding members get?" to "Everything — every feature unlocked, plus a say in where the product goes as an early user.",
)

@Composable
fun PricingScreen(onBack: () -> Unit, onStart: () -> Unit) {
    val t = tokens()
    SitePage(
        "Pricing", onBack, "Pricing", buildAnnotatedString { append("Free for founding members") },
        "Feelivate is currently free. Founding members get the full, best version of the product at no cost — every feature unlocked, no credit card required.",
    ) {
        PageSection(top = 48, bottom = 48, divider = false) {
            Column(
                Modifier.fillMaxWidth().widthIn(max = 460.dp).clip(RoundedCornerShape(4.dp)).background(t.cardBg)
                    .border(1.dp, t.borderMedium, RoundedCornerShape(4.dp)).padding(horizontal = 24.dp, vertical = 28.dp),
            ) {
                Text("FOUNDING MEMBER", style = satoshi(11f, 700, ls = 0.12f), color = t.accentWarm)
                Row(Modifier.padding(top = 14.dp, bottom = 6.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Free", style = clash(52f, 700, lineHeight = 1f, ls = -0.05f), color = t.textPrimary)
                    Text("while in early access", style = satoshi(14f, 500), color = t.textMuted, modifier = Modifier.padding(bottom = 6.dp))
                }
                Text("Everything unlocked. No credit card. No automatic billing.", style = satoshi(13.5f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 22.dp))
                Column(Modifier.padding(bottom = 26.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    INCLUDED.forEach { CheckLine(it, 13.5f) }
                }
                PrimaryCta("Get Started Free", onStart)
            }
        }
        PageSection(top = 16, bottom = 72, divider = false) {
            Text("Pricing FAQ", style = clash(24f, 700, ls = -0.04f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 28.dp))
            FaqList(PRICING_FAQS)
        }
    }
}

/* ── About ── */

private val PRINCIPLES = listOf(
    "Execution over inspiration" to "Motivation is a feeling. It fades by Wednesday. We optimize for the thing that actually changes lives: doing the work, today.",
    "Systems over willpower" to "You don't rise to your goals — you fall to your systems. So we build the system, and take willpower out of the equation.",
    "Honesty over comfort" to "A mentor that only makes you feel good is useless. Feelivate shows you the real gap between what you said and what you did.",
    "Small over grand" to "Grand plans collapse. Small, non-negotiable daily actions compound into a different person. We obsess over the next right step.",
)

private val STORY = listOf(
    "What Feelivate is" to listOf(
        "Feelivate is an AI accountability partner. You tell it what you actually want to become — fitter, focused, out of a rut, finally shipping the thing — and it turns that fuzzy wish into a locked, hyper-specific 7-day plan.",
        "Then it does the hard part: it holds you to it. A personalized task lands in your inbox every morning. Streaks reward momentum. Voice check-ins let you be honest on the bad days. And every week, an unflinching report shows you exactly where you stand — before the next, slightly harder week begins.",
    ),
    "Our mission" to listOf("To turn ambition into daily execution — converting vague goals into concrete, non-negotiable weekly plans that people actually finish, not just start."),
    "Our vision" to listOf("A world where progress is a system, not a burst of motivation. Where becoming the person you describe is a matter of showing up to a plan — one honest week at a time — instead of hoping this year is finally different."),
    "What makes us different" to listOf(
        "A to-do app stores your tasks. A habit tracker counts your checkmarks. A coach costs a fortune and isn't there at 7am. Feelivate does what none of them do: it builds the plan for you, locks it so you can't quietly make it easier, drives you through each day, and reflects the honest truth back every week.",
        "It is not a passive tool you have to remember to use. It is an active mentor that shows up whether you feel like it or not.",
    ),
    "Product philosophy" to listOf(
        "We built Feelivate to be direct — warm, but unwilling to let you off the hook. It respects your time and your emotions, and it refuses to sell you the comfortable lie that you'll 'start Monday'.",
        "Every feature exists to close one gap: the distance between intention and action. If it doesn't help you execute, it doesn't ship.",
    ),
)

@Composable
fun AboutScreen(onBack: () -> Unit, onStart: () -> Unit) {
    val t = tokens()
    SitePage(
        "About", onBack, "About Feelivate",
        buildAnnotatedString {
            append("We don't sell motivation. ")
            withStyle(SpanStyle(fontFamily = Georgia, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Normal, color = t.textSecondary)) { append("We build") }
            append(" execution.")
        },
        "Most people don't fail from a lack of goals. They fail at execution. Feelivate exists to close that gap — turning what you want to become into what you actually do, every single day.",
    ) {
        PageSection(top = 48, bottom = 48) {
            Text("Why we started", style = clash(26f, 700, lineHeight = 1.1f, ls = -0.04f), color = t.textPrimary, modifier = Modifier.padding(bottom = 20.dp))
            Text("Feelivate began with a frustration we couldn't shake: the gap between who people say they want to be and what they actually do on a Tuesday afternoon. We watched driven, capable people set the same goals every January — get fit, write the book, launch the thing — and quietly abandon them by February.", style = satoshi(15f, 500, lineHeight = 1.75f), color = t.textSecondary, modifier = Modifier.padding(bottom = 16.dp))
            Text("Not because they were lazy. Because they were running on willpower and good intentions, with no system underneath. And willpower is a terrible system — loud on Monday, gone by Wednesday.", style = satoshi(15f, 500, lineHeight = 1.75f), color = t.textSecondary, modifier = Modifier.padding(bottom = 16.dp))
            Text("So we built the one thing that actually moves people: structure, relentless accountability, and an honest mirror — in a mentor that shows up whether you feel like it or not.", style = satoshi(15f, 600, lineHeight = 1.75f), color = t.textPrimary)
        }
        PageSection(top = 48, bottom = 48) {
            Text("WHAT WE BELIEVE", style = satoshi(11f, 700, ls = 0.15f), color = t.textMuted)
            Text("Four principles behind everything", style = clash(26f, 700, lineHeight = 1.1f, ls = -0.04f), color = t.textPrimary, modifier = Modifier.padding(top = 12.dp, bottom = 32.dp))
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(2.dp)).border(1.dp, t.borderSubtle, RoundedCornerShape(2.dp))) {
                PRINCIPLES.forEachIndexed { i, (title, desc) ->
                    if (i > 0) Hairline()
                    Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 24.dp)) {
                        Text((i + 1).toString().padStart(2, '0'), style = satoshi(11f, 700, ls = 0.08f), color = t.textMuted, modifier = Modifier.padding(bottom = 12.dp))
                        Text(title, style = clash(18f, 700, ls = -0.02f), color = t.textPrimary, modifier = Modifier.padding(bottom = 10.dp))
                        Text(desc, style = satoshi(14f, 500, lineHeight = 1.65f), color = t.textSecondary)
                    }
                }
            }
        }
        PageSection(top = 48, bottom = 48) {
            STORY.forEachIndexed { i, (label, paras) ->
                Column(Modifier.fillMaxWidth().padding(top = if (i == 0) 0.dp else 30.dp, bottom = 30.dp)) {
                    if (i > 0) { Hairline(); Box(Modifier.height(30.dp)) }
                    Text(label.uppercase(), style = satoshi(12f, 700, ls = 0.14f), color = t.accentWarm, modifier = Modifier.padding(bottom = 14.dp))
                    paras.forEachIndexed { j, p ->
                        Text(p, style = satoshi(15f, 500, lineHeight = 1.75f), color = t.textSecondary, modifier = Modifier.padding(bottom = if (j == paras.size - 1) 0.dp else 14.dp))
                    }
                }
            }
        }
        PageSection(top = 48, bottom = 48) {
            Text("THE TEAM", style = satoshi(11f, 700, ls = 0.15f), color = t.textMuted)
            Text("Built by JUNE64", style = clash(26f, 700, lineHeight = 1.1f, ls = -0.04f), color = t.textPrimary, modifier = Modifier.padding(top = 12.dp, bottom = 16.dp))
            Text("Feelivate is built by JUNE64 — a small team obsessed with behavior change, thoughtful AI, and clean, honest product design. We're building the mentor we always wished we had: one that doesn't flatter you, doesn't forget about you, and doesn't let you quit on yourself.", style = satoshi(15f, 500, lineHeight = 1.75f), color = t.textSecondary)
        }
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 56.dp, bottom = 72.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text("\"Your future self is watching. Don't disappoint them.\"", style = com.june64.feelivate.ui.theme.georgia(22f, 1.45f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 560.dp).padding(bottom = 12.dp))
            Text("THE FEELIVATE PHILOSOPHY", style = satoshi(10f, 700, ls = 0.15f), color = t.textPrimary, modifier = Modifier.padding(bottom = 34.dp))
            PrimaryCta("Start Your First Week", onStart)
        }
    }
}

/* ── Contact ── */

private const val CONTACT_EMAIL = "info@june64.com"

@Composable
fun ContactScreen(onBack: () -> Unit) {
    val t = tokens()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("idle") }

    SitePage("Contact", onBack, "Contact", buildAnnotatedString { append("Let's talk.") }, "Questions, press, or partnerships — reach out and we usually reply within a day.") {
        PageSection(top = 40, bottom = 72, divider = false) {
            if (status == "sent") {
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(4.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(4.dp)).padding(horizontal = 26.dp, vertical = 32.dp)) {
                    Text("Message sent ✓", style = satoshi(20f, 700), color = t.textPrimary, modifier = Modifier.padding(bottom = 10.dp))
                    Text(
                        "Thanks" + (name.trim().takeIf { it.isNotBlank() }?.let { ", ${it.split(" ").first()}" } ?: "") + " — we got it and usually reply within a day.",
                        style = satoshi(14f, 500, lineHeight = 1.65f), color = t.textSecondary,
                    )
                }
            } else {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    ModalField(name, { name = it }, "Your name", radius = 4, minHeight = 48)
                    ModalField(email, { email = it }, "you@example.com", radius = 4, minHeight = 48, keyboardType = KeyboardType.Email)
                    ModalField(message, { message = it }, "How can we help?", radius = 4, minHeight = 140, singleLine = false)
                    SwissButton(
                        if (status == "sending") "Sending…" else "Send Message", Modifier.fillMaxWidth(),
                        enabled = status != "sending" && name.isNotBlank() && email.isNotBlank() && message.isNotBlank(),
                    ) {
                        status = "sending"
                        scope.launch {
                            runCatching { ApiClient.get(context).contact(ContactRequest(name.trim(), email.trim(), message.trim())) }
                                .onSuccess { status = "sent" }
                                .onFailure {
                                    // Backend unavailable — fall back to the user's email app.
                                    status = "idle"
                                    val subject = android.net.Uri.encode("Feelivate contact — ${name.ifBlank { "App" }}")
                                    val body = android.net.Uri.encode("Name: $name\nEmail: $email\n\n$message")
                                    openUrl(context, "mailto:$CONTACT_EMAIL?subject=$subject&body=$body")
                                }
                        }
                    }
                }
            }
            Column(Modifier.padding(top = 36.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                listOf(
                    Triple(R.drawable.lu_mail, "Email", CONTACT_EMAIL),
                    Triple(R.drawable.lu_at_sign, "Social", "@feelivate"),
                    Triple(R.drawable.lu_map_pin, "Location", "London, UK"),
                    Triple(R.drawable.lu_life_buoy, "Support", "We usually reply within a day"),
                ).forEach { (icon, label, value) ->
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(2.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(2.dp))
                            .then(if (label == "Email") Modifier.tap { openUrl(context, "mailto:$CONTACT_EMAIL") } else Modifier)
                            .padding(horizontal = 18.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        Box(Modifier.size(40.dp).clip(RoundedCornerShape(4.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) { Lucide(icon, 16.dp, t.textPrimary) }
                        Column {
                            Text(label.uppercase(), style = satoshi(10f, 700, ls = 0.12f), color = t.textMuted, modifier = Modifier.padding(bottom = 4.dp))
                            Text(value, style = satoshi(14.5f, 600), color = t.textPrimary)
                        }
                    }
                }
                Text(
                    buildAnnotatedString { append("Feelivate is a product of "); withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("JUNE64") }; append(".") },
                    style = satoshi(12f, 500, lineHeight = 1.6f), color = t.textMuted, modifier = Modifier.padding(top = 16.dp),
                )
            }
            Text(
                buildAnnotatedString {
                    append("Prefer email? Write to ")
                    withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = t.textPrimary)) { append(CONTACT_EMAIL) }
                    append(" and we'll get back to you.")
                },
                style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary,
                modifier = Modifier.padding(top = 32.dp).tap { openUrl(context, "mailto:$CONTACT_EMAIL") },
            )
        }
    }
}

/* ── Blog ── */

private val TOPICS = listOf(
    Triple(R.drawable.lu_target, "Goal Setting", "Frameworks that turn vague ambition into a concrete weekly plan you can actually run."),
    Triple(R.drawable.lu_repeat, "Habit Building", "How small, non-negotiable daily actions compound into a completely different identity."),
    Triple(R.drawable.lu_zap, "Productivity", "Beating decision fatigue and spending your energy only on the work that moves the needle."),
    Triple(R.drawable.lu_heart_pulse, "Mental Wellness", "Emotion-aware routines that keep you consistent on the days you least feel like it."),
    Triple(R.drawable.lu_trending_up, "Personal Growth", "Practical ways to become the person you keep saying you want to be — on a schedule."),
    Triple(R.drawable.lu_compass, "AI Productivity", "Using AI as a real accountability partner, not just another app you forget to open."),
)

private fun formatPostDate(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    val f = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.US)
    return runCatching { OffsetDateTime.parse(iso).toLocalDate().format(f) }
        .recoverCatching { LocalDate.parse(iso.take(10)).format(f) }
        .getOrDefault("")
}

@Composable
fun BlogScreen(onBack: () -> Unit, onStart: () -> Unit) {
    val t = tokens()
    val context = LocalContext.current
    var posts by remember { mutableStateOf<List<BlogCard>?>(null) }
    var category by remember { mutableStateOf("All") }
    LaunchedEffect(Unit) { posts = runCatching { ApiClient.get(context).blogPosts().posts }.getOrDefault(emptyList()) }
    val hasPosts = !posts.isNullOrEmpty()
    val categories = if (hasPosts) listOf("All") + posts!!.map { it.category }.distinct() else emptyList()
    val visible = if (hasPosts) posts!!.filter { category == "All" || it.category == category } else emptyList()

    SitePage(
        "Blog", onBack, "Blog", buildAnnotatedString { append("Ideas for people who actually execute") },
        if (hasPosts) "Practical writing on goal setting, habits, productivity, and personal growth. No motivation posters — things you can run this week."
        else "Practical writing on goal setting, habits, productivity, and personal growth. New articles are on the way — here's what we'll be digging into.",
    ) {
        PageSection(top = 44, bottom = 40, divider = false) {
            when {
                posts == null -> Box(Modifier.fillMaxWidth().padding(vertical = 40.dp), contentAlignment = Alignment.Center) { Spinner(18.dp, t.textMuted) }
                hasPosts -> {
                    if (categories.size > 2) {
                        FlowRow(Modifier.fillMaxWidth().padding(bottom = 26.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            categories.forEach { c ->
                                val on = c == category
                                Box(
                                    Modifier.clip(CircleShape).background(if (on) t.accentPrimary else Color.Transparent).border(1.dp, if (on) t.accentPrimary else t.borderMedium, CircleShape)
                                        .tap { category = c }.padding(horizontal = 14.dp, vertical = 8.dp),
                                ) { Text(c, style = satoshi(12f, 600, ls = 0.04f), color = if (on) t.btnPrimaryText else t.textPrimary) }
                            }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                        visible.forEach { p ->
                            Column(
                                Modifier.fillMaxWidth().clip(RoundedCornerShape(2.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(2.dp))
                                    .tap { openUrl(context, p.url.ifBlank { webUrl("/blog/${p.slug}") }) },
                            ) {
                                if (!p.coverImageUrl.isNullOrBlank()) {
                                    AsyncImage(
                                        model = p.coverImageUrl, contentDescription = p.coverAlt ?: p.title,
                                        contentScale = androidx.compose.ui.layout.ContentScale.Crop,
                                        modifier = Modifier.fillMaxWidth().height(180.dp),
                                    )
                                    Hairline()
                                } else Box(Modifier.fillMaxWidth().height(6.dp).background(t.accentWarm))
                                Column(Modifier.padding(horizontal = 22.dp, vertical = 22.dp)) {
                                    Text(p.category.uppercase(), style = satoshi(10f, 700, ls = 0.12f), color = t.accentWarm)
                                    Text(p.title, style = clash(19f, 700, lineHeight = 1.2f, ls = -0.02f), color = t.textPrimary, modifier = Modifier.padding(top = 10.dp, bottom = 8.dp))
                                    Text(p.excerpt, style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary, modifier = Modifier.padding(bottom = 16.dp))
                                    Text("${formatPostDate(p.publishedAt)} · ${p.readingMinutes} min read", style = satoshi(12f, 500), color = t.textMuted)
                                }
                            }
                        }
                    }
                }
                else -> Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    TOPICS.forEach { (icon, title, desc) ->
                        SiteCard(padding = PaddingValues(horizontal = 24.dp, vertical = 28.dp)) {
                            Box(Modifier.size(44.dp).clip(RoundedCornerShape(4.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) { Lucide(icon, 18.dp, t.textPrimary) }
                            Text("COMING SOON", style = satoshi(10f, 700, ls = 0.12f), color = t.accentWarm, modifier = Modifier.padding(top = 18.dp))
                            Text(title, style = clash(18f, 700, ls = -0.02f), color = t.textPrimary, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                            Text(desc, style = satoshi(13f, 500, lineHeight = 1.6f), color = t.textSecondary)
                        }
                    }
                }
            }
        }
        Hairline()
        ClosingCta(
            buildAnnotatedString {
                append("Don't just read about it. ")
                withStyle(SpanStyle(fontFamily = Georgia, fontStyle = FontStyle.Italic, fontWeight = FontWeight.Normal, color = t.textSecondary)) { append("Do") }
                append(" it.")
            },
            "Turn the ideas into a plan this week. Free for founding members.", "Start Free", onStart,
        )
    }
}
