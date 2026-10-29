package com.june64.feelivate.ui.pages

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.data.LegalDocument
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Spinner
import com.june64.feelivate.ui.components.openUrl
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * LegalDoc.tsx — the published Privacy Policy and Terms, rendered from the
 * same section data the web ships (bundled as an asset so the wording is
 * identical and reviewable as text).
 */
@Composable
fun LegalScreen(assetName: String, title: String, kicker: String, heading: String, subtitle: String, onBack: () -> Unit) {
    val t = tokens()
    val context = LocalContext.current
    var doc by remember(assetName) { mutableStateOf<LegalDocument?>(null) }
    LaunchedEffect(assetName) {
        doc = withContext(Dispatchers.IO) {
            runCatching { ApiClient.json.decodeFromString<LegalDocument>(context.assets.open(assetName).bufferedReader().use { it.readText() }) }.getOrNull()
        }
    }

    SitePage(title, onBack, kicker, AnnotatedString(heading), subtitle) {
        val d = doc
        if (d == null) {
            Box(Modifier.fillMaxWidth().padding(vertical = 60.dp), contentAlignment = Alignment.Center) { Spinner(20.dp, t.textMuted) }
            return@SitePage
        }
        Column(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 40.dp, bottom = 80.dp)) {
            Text(
                "Last updated ${d.lastUpdated} · Version ${d.version}",
                style = satoshi(13f, 600, ls = 0.04f), color = t.textMuted, modifier = Modifier.padding(bottom = 8.dp),
            )
            d.sections.forEachIndexed { i, s ->
                Column(Modifier.fillMaxWidth().padding(vertical = 24.dp)) {
                    if (i > 0) { Hairline(); Box(Modifier.height(24.dp)) }
                    Text("${i + 1}. ${s.h}", style = clash(19f, 700, ls = -0.02f), color = t.textPrimary, modifier = Modifier.padding(bottom = 12.dp))
                    s.blocks.forEach { b ->
                        when (b.t) {
                            "p" -> Text(legalInline(b.text.orEmpty(), t.textPrimary, t.accentWarm, context), style = satoshi(14.5f, 500, lineHeight = 1.7f), color = t.textSecondary, modifier = Modifier.padding(bottom = 10.dp))
                            "h3" -> Text(legalInline(b.text.orEmpty(), t.textPrimary, t.accentWarm, context), style = satoshi(15.5f, 700, ls = -0.01f), color = t.textPrimary, modifier = Modifier.padding(top = 18.dp, bottom = 8.dp))
                            "ul" -> Column(Modifier.padding(bottom = 12.dp)) {
                                b.items.forEach { item ->
                                    Row(Modifier.fillMaxWidth().padding(bottom = 5.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Text("•", style = satoshi(14.5f, 500, lineHeight = 1.7f), color = t.textSecondary)
                                        Text(legalInline(item, t.textPrimary, t.accentWarm, context), style = satoshi(14.5f, 500, lineHeight = 1.7f), color = t.textSecondary)
                                    }
                                }
                            }
                            "note" -> Row(
                                Modifier.fillMaxWidth().padding(bottom = 10.dp).height(IntrinsicSize.Min)
                                    .clip(RoundedCornerShape(0.dp, 10.dp, 10.dp, 0.dp)).background(t.bgSurface),
                            ) {
                                Box(Modifier.width(3.dp).fillMaxHeight().background(t.accentWarm))
                                Text(legalInline(b.text.orEmpty(), t.textPrimary, t.accentWarm, context), style = satoshi(14.5f, 500, lineHeight = 1.7f), color = t.textPrimary, modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp))
                            }
                            "table" -> LegalTable(b.head, b.rows, context)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LegalTable(head: List<String>, rows: List<List<String>>, context: android.content.Context) {
    val t = tokens()
    val scroll = rememberScrollState()
    val wide = head.size > 2
    Box(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 16.dp).clip(RoundedCornerShape(12.dp)).border(1.dp, t.borderSubtle, RoundedCornerShape(12.dp))) {
        Column(Modifier.then(if (wide) Modifier.horizontalScroll(scroll) else Modifier)) {
            val cellWidth = if (wide) 190.dp else 0.dp
            if (head.any { it.isNotBlank() }) {
                Row(Modifier.fillMaxWidth().background(t.bgSecondary)) {
                    head.forEachIndexed { i, h ->
                        Text(
                            h.uppercase(), style = satoshi(12f, 700, ls = 0.04f), color = t.textPrimary,
                            modifier = (if (wide) Modifier.width(cellWidth) else Modifier.weight(if (i == 0) 0.8f else 1f)).padding(horizontal = 12.dp, vertical = 10.dp),
                        )
                    }
                }
                Hairline()
            }
            rows.forEachIndexed { k, r ->
                if (k > 0) Hairline()
                Row(Modifier.fillMaxWidth()) {
                    r.forEachIndexed { m, c ->
                        Text(
                            legalInline(c, t.textPrimary, t.accentWarm, context),
                            style = satoshi(13.5f, if (m == 0) 600 else 500, lineHeight = 1.55f),
                            color = if (m == 0) t.textPrimary else t.textSecondary,
                            modifier = (if (wide) Modifier.width(cellWidth) else Modifier.weight(if (m == 0) 0.8f else 1f)).padding(horizontal = 12.dp, vertical = 10.dp),
                        )
                    }
                }
            }
        }
    }
}

/** `[label](href)` → a link, `**bold**` → emphasis — the web's tiny inline markup. */
@Composable
private fun legalInline(text: String, primary: androidx.compose.ui.graphics.Color, underline: androidx.compose.ui.graphics.Color, context: android.content.Context): AnnotatedString {
    val pattern = remember { Regex("""(\[[^\]]+]\([^)]+\))|(\*\*[^*]+\*\*)""") }
    return buildAnnotatedString {
        var last = 0
        for (m in pattern.findAll(text)) {
            append(text.substring(last, m.range.first))
            val token = m.value
            if (token.startsWith("[")) {
                val close = token.indexOf("](")
                val label = token.substring(1, close)
                val href = token.substring(close + 2, token.length - 1)
                val style = SpanStyle(color = primary, textDecoration = TextDecoration.Underline)
                withLink(LinkAnnotation.Clickable(href, TextLinkStyles(style)) { openUrl(context, href) }) { append(label) }
            } else {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = primary)) { append(token.substring(2, token.length - 2)) }
            }
            last = m.range.last + 1
        }
        if (last < text.length) append(text.substring(last))
    }
}
