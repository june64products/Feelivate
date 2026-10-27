package com.june64.feelivate.ui.login

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.LogoMark
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

private const val TICKER = "AI ACCOUNTABILITY PARTNER   //   WEEKLY ACTION PLANS   //   DAILY MAIL NOTIFICATIONS   //   STREAK TRACKING   //   WEEKLY REPORTS   //   DAILY EMOTION LOGS   //   VOICE MEMO INTAKE   //   RELENTLESS ACCOUNTABILITY   //   "

/** LoginPage's ticker: `--accent-primary` band, Clash 12/600 .12em, scrolls -50% every 40s. */
@Composable
fun Marquee() {
    val t = tokens()
    val text = TICKER.repeat(8)
    var oneWidth by remember { mutableIntStateOf(0) }
    val transition = rememberInfiniteTransition(label = "marquee")
    val p by transition.animateFloat(0f, 1f, infiniteRepeatable(tween(40_000, easing = LinearEasing)), label = "p")
    Box(Modifier.fillMaxWidth().background(t.accentPrimary).padding(vertical = 16.dp).clipToBounds()) {
        Row(Modifier.wrapContentWidth(Alignment.Start, unbounded = true).graphicsLayer { translationX = -p * oneWidth }) {
            Text(text, style = clash(12f, 600, ls = 0.12f), color = t.textInverse, maxLines = 1, softWrap = false, modifier = Modifier.onSizeChanged { oneWidth = it.width })
            Text(text, style = clash(12f, 600, ls = 0.12f), color = t.textInverse, maxLines = 1, softWrap = false)
        }
    }
}

/** LoginPage's footer — stays dark in both themes (#1e1e1e). Mobile: one column. */
@Composable
fun SiteFooter(onFeatures: () -> Unit, onAbout: () -> Unit, onLink: (String) -> Unit) {
    val ink = Color(0xFF1E1E1E)
    val f = Color(0xFFF6F6F6)
    Column(Modifier.fillMaxWidth().background(ink).padding(start = 24.dp, end = 24.dp, top = 32.dp, bottom = 24.dp)) {
        Hairline(Modifier.padding(bottom = 0.dp), color = Color(0x0DFFFFFF))
        Column(Modifier.padding(top = 32.dp), verticalArrangement = Arrangement.spacedBy(32.dp)) {
            // Brand
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(32.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFF2F2F2)), contentAlignment = Alignment.Center) { LogoMark(22.dp, Color.Black) }
                    Text("Feelivate", style = clash(16f, 700, ls = -0.03f), color = f.copy(alpha = 0.9f), modifier = Modifier.padding(start = 10.dp))
                }
                Text(
                    "AI-powered accountability transformation. Hyper-specific weekly plans that build who you become.",
                    style = satoshi(13f, 500, lineHeight = 1.65f), color = f.copy(alpha = 0.5f), modifier = Modifier.padding(top = 14.dp, bottom = 16.dp),
                )
                Text(
                    buildAnnotatedString { append("By "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = f.copy(alpha = 0.6f), letterSpacing = 0.08.em)) { append("JUNE64") } },
                    style = satoshi(11f, 500, ls = 0.05f), color = f.copy(alpha = 0.35f),
                )
            }
            FooterCol("Navigation", listOf("Features" to onFeatures, "Pricing" to { onLink("/pricing") }, "About" to onAbout))
            FooterCol("Company", listOf("Blog" to { onLink("/blog") }, "Privacy Policy" to { onLink("/privacy") }, "Terms of Service" to { onLink("/terms") }))
            FooterCol("Contact", listOf("info@june64.com" to { onLink("mailto:info@june64.com") }, "@feelivate" to {}, "London, UK" to {}))
        }
        Box(Modifier.padding(top = 40.dp)) { Hairline(color = Color(0x0DFFFFFF)) }
        Row(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("© 2026 Feelivate. All rights reserved.", style = satoshi(12f, 500), color = f.copy(alpha = 0.35f))
            Text(
                buildAnnotatedString { append("A product of "); withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = f.copy(alpha = 0.55f))) { append("JUNE64") } },
                style = satoshi(12f, 500), color = f.copy(alpha = 0.35f),
            )
        }
    }
}

@Composable
private fun FooterCol(title: String, items: List<Pair<String, () -> Unit>>) {
    val f = Color(0xFFF6F6F6)
    Column {
        Text(title.uppercase(), style = satoshi(11f, 700, ls = 0.12f), color = f.copy(alpha = 0.4f), modifier = Modifier.padding(bottom = 16.dp))
        items.forEach { (label, onClick) ->
            Text(label, style = satoshi(13f, 500), color = f.copy(alpha = 0.6f), modifier = Modifier.tap(onClick = onClick).padding(bottom = 10.dp))
        }
    }
}
