package com.june64.feelivate.ui.login

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.ui.components.HSpace
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.LogoChip
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseStandard
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/** site/BrandNav.tsx — the mobile branch: 60px bar, logo chip + wordmark, menu toggle, dropdown. */
val NAV_LINKS = listOf("Features" to "/features", "Pricing" to "/pricing", "About" to "/about", "Blog" to "/blog", "Contact" to "/contact")

@Composable
fun BrandNav(
    modifier: Modifier = Modifier,
    activePath: String? = null,
    onBrand: () -> Unit = {},
    onLink: (path: String) -> Unit,
    onStartFree: () -> Unit,
) {
    val t = tokens()
    var open by remember { mutableStateOf(false) }
    Column(modifier.fillMaxWidth()) {
        Box(Modifier.fillMaxWidth().height(60.dp).background(t.navBg)) {
            Row(Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                Row(Modifier.tap { onBrand() }, verticalAlignment = Alignment.CenterVertically) {
                    LogoChip(38.dp, 10.dp, 26.dp)
                    HSpace(11.dp)
                    Text("Feelivate", style = clash(18f, 700, ls = -0.03f), color = t.textPrimary)
                }
                Box(Modifier.weight(1f))
                // menu toggle: glass-hover bg, border-medium, radius 8, padding 7, icon 18
                Box(
                    Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(t.glassHover)
                        .border(1.dp, t.borderMedium, RoundedCornerShape(8.dp))
                        .tap { open = !open }
                        .padding(7.dp),
                ) { Lucide(if (open) R.drawable.lu_x else R.drawable.lu_menu, 18.dp, t.textPrimary) }
            }
            Hairline(Modifier.align(Alignment.BottomCenter))
        }
        AnimatedVisibility(open, enter = expandVertically(androidx.compose.animation.core.tween(220, easing = EaseStandard)) + fadeIn(), exit = shrinkVertically(androidx.compose.animation.core.tween(180, easing = EaseStandard)) + fadeOut()) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .shadow(32.dp, spotColor = t.shadowColor.copy(alpha = 0.15f), ambientColor = t.shadowColor.copy(alpha = 0.15f))
                    .background(t.bgPrimary)
                    .padding(start = 20.dp, end = 20.dp, top = 12.dp, bottom = 22.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                NAV_LINKS.forEach { (label, path) ->
                    Text(
                        label, style = satoshi(15f, 600),
                        color = if (path == activePath) t.textPrimary else t.textSecondary,
                        modifier = Modifier.fillMaxWidth().tap { open = false; onLink(path) }.padding(vertical = 12.dp),
                    )
                }
                Box(
                    Modifier.padding(top = 10.dp).fillMaxWidth().clip(CircleShape).background(t.btnPrimaryBg).tap { open = false; onStartFree() }.padding(horizontal = 18.dp, vertical = 9.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("START FREE", style = satoshi(13f, 700, ls = 0.03f), color = t.btnPrimaryText, textAlign = TextAlign.Center) }
                Hairline(color = t.borderMedium)
            }
        }
    }
}
