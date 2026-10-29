@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.pages

import androidx.annotation.DrawableRes
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.SwissButton
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/**
 * site/ui.tsx + PageShell — the shared chrome for every marketing/legal page,
 * in the phone layout: a back bar, the editorial hero, then the sections.
 */
@Composable
fun SitePage(
    title: String,
    onBack: () -> Unit,
    kicker: String,
    heading: AnnotatedString,
    subtitle: String? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    val t = tokens()
    Column(Modifier.fillMaxSize().background(t.bgPrimary).statusBarsPadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(
                Modifier.size(36.dp).clip(RoundedCornerShape(12.dp)).background(t.cardBg).border(1.dp, t.borderMedium, RoundedCornerShape(12.dp)).tap(onClick = onBack),
                contentAlignment = Alignment.Center,
            ) { Lucide(R.drawable.lu_arrow_left, 16.dp, t.textSecondary) }
            Text(title, style = satoshi(13f, 700), color = t.textPrimary)
        }
        Hairline()
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding()) {
            // PageHero — the hairline lead-in, kicker, display heading, subtitle
            Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 52.dp, bottom = 44.dp)) {
                Box(Modifier.width(1.dp).height(36.dp).background(t.borderMedium).padding(bottom = 20.dp))
                Text(kicker.uppercase(), style = satoshi(11f, 700, ls = 0.15f), color = t.textMuted, modifier = Modifier.padding(top = 20.dp))
                Text(heading, style = clash(40f, 700, lineHeight = 0.98f, ls = -0.05f), color = t.textPrimary, modifier = Modifier.padding(vertical = 18.dp))
                if (subtitle != null) Text(subtitle, style = satoshi(15f, 500, lineHeight = 1.6f), color = t.textSecondary)
            }
            Hairline()
            content()
        }
    }
}

/** The page sections all share the phone's 20px gutter. */
@Composable
fun PageSection(top: Int = 44, bottom: Int = 44, divider: Boolean = true, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = top.dp, bottom = bottom.dp), content = content)
    if (divider) Hairline()
}

/** `PrimaryCta` — the ink button that sends you to sign-up. */
@Composable
fun PrimaryCta(label: String = "Start Free", onClick: () -> Unit) {
    val t = tokens()
    SwissButton(label, Modifier.widthIn(max = 320.dp), trailing = { Lucide(R.drawable.lu_arrow_right, 15.dp, t.btnPrimaryText) }, onClick = onClick)
}

/** The bordered card every page uses for a feature, a topic or a detail. */
@Composable
fun SiteCard(modifier: Modifier = Modifier, padding: PaddingValues = PaddingValues(24.dp), radius: Int = 2, content: @Composable ColumnScope.() -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(radius.dp)
    Column(modifier.fillMaxWidth().clip(shape).border(1.dp, t.borderMedium, shape).padding(padding), content = content)
}

/** The accordion used by the Features and Pricing FAQs. */
@Composable
fun FaqList(items: List<Pair<String, String>>) {
    val t = tokens()
    var open by remember { mutableIntStateOf(0) }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(2.dp)).border(1.dp, t.borderMedium, RoundedCornerShape(2.dp))) {
        items.forEachIndexed { i, (q, a) ->
            if (i > 0) Hairline()
            val rot by animateFloatAsState(if (open == i) 180f else 0f, tween(200), label = "rot")
            Row(
                Modifier.fillMaxWidth().tap { open = if (open == i) -1 else i }.padding(horizontal = 20.dp, vertical = 18.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(q, style = clash(15f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.weight(1f))
                Lucide(R.drawable.lu_chevron_down, 18.dp, t.textSecondary, Modifier.rotate(rot))
            }
            AnimatedVisibility(open == i) {
                Text(a, style = satoshi(13.5f, 500, lineHeight = 1.7f), color = t.textSecondary, modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 18.dp))
            }
        }
    }
}

/** A benefit line: the warm check plus the text. */
@Composable
fun CheckLine(text: String, size: Float = 13f) {
    val t = tokens()
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Lucide(R.drawable.lu_check, 14.dp, t.accentWarm, Modifier.padding(top = 2.dp))
        Text(text, style = satoshi(size, 500, lineHeight = 1.5f), color = t.textPrimary)
    }
}

/** The closing block every page ends on. */
@Composable
fun ClosingCta(heading: AnnotatedString, sub: String, cta: String, onStart: () -> Unit) {
    val t = tokens()
    Column(
        Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 56.dp, bottom = 72.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(heading, style = clash(28f, 700, lineHeight = 1.06f, ls = -0.04f), color = t.textPrimary, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 12.dp))
        Text(sub, style = satoshi(15f, 500, lineHeight = 1.6f), color = t.textSecondary, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 28.dp))
        PrimaryCta(cta, onStart)
    }
}
