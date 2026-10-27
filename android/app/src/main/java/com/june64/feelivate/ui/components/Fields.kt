package com.june64.feelivate.ui.components

import android.content.Context
import android.net.Uri
import androidx.annotation.DrawableRes
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import com.june64.feelivate.BuildConfig
import com.june64.feelivate.R
import com.june64.feelivate.data.ConsentItem
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens

/** Opens a web page in a Chrome Custom Tab (Terms, Privacy, the marketing site). */
fun openUrl(context: Context, url: String) {
    runCatching { CustomTabsIntent.Builder().build().launchUrl(context, Uri.parse(url)) }
}

fun webUrl(path: String) = BuildConfig.WEB_BASE.trimEnd('/') + path

/** Uppercase 11/700 label with .12em tracking — the login form's field labels. */
@Composable
fun FieldLabel(text: String, modifier: Modifier = Modifier) {
    Text(text.uppercase(), style = satoshi(11f, 700, ls = 0.12f), color = tokens().textSecondary, modifier = modifier)
}

/**
 * The login page input: padding 15/14/15/46, radius 4, 1px `--border-medium`,
 * focus → `--accent-primary` border + 2px `--input-shadow-focus` ring, 14/500 text.
 */
@Composable
fun SwissField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    @DrawableRes icon: Int,
    modifier: Modifier = Modifier,
    password: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    enabled: Boolean = true,
) {
    val t = tokens()
    var focused by remember { mutableStateOf(false) }
    val border by animateColorAsState(if (focused) t.accentPrimary else t.borderMedium, tween(200), label = "border")
    val ring = t.inputShadowFocus
    val shape = RoundedCornerShape(4.dp)
    Box(
        modifier
            .fillMaxWidth()
            .height(47.dp)
            .drawBehind {
                if (focused) {
                    val inflate = 2.dp.toPx()
                    drawRoundRect(
                        color = ring, topLeft = Offset(-inflate, -inflate),
                        size = Size(size.width + 2 * inflate, size.height + 2 * inflate),
                        cornerRadius = CornerRadius(4.dp.toPx() + inflate), style = Stroke(inflate),
                    )
                }
            }
            .clip(shape)
            .background(t.bgInput)
            .border(1.dp, border, shape),
        contentAlignment = Alignment.CenterStart,
    ) {
        Lucide(icon, 16.dp, t.textMuted, Modifier.padding(start = 16.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = true,
            textStyle = satoshi(14f, 500, ls = -0.01f, color = t.textPrimary),
            cursorBrush = SolidColor(t.textPrimary),
            visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth().padding(start = 46.dp, end = 14.dp).onFocusChanged { focused = it.isFocused },
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) Text(placeholder, style = satoshi(14f, 500, ls = -0.01f), color = t.textPlaceholder)
                    inner()
                }
            },
        )
    }
}

/** 16×16 native-looking checkbox with `accent-color: var(--accent-primary)`. */
@Composable
fun SwissCheckbox(checked: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit, modifier: Modifier = Modifier) {
    val t = tokens()
    val shape = RoundedCornerShape(3.dp)
    Box(
        modifier
            .size(16.dp)
            .clip(shape)
            .background(if (checked) t.accentPrimary else t.bgInput)
            .border(1.5.dp, if (checked) t.accentPrimary else t.textMuted, shape)
            .tap(enabled) { onChange(!checked) },
        contentAlignment = Alignment.Center,
    ) {
        if (checked) Lucide(R.drawable.lu_check_3, 11.dp, t.btnPrimaryText)
    }
}

/**
 * legal/ConsentControls.tsx: one consent, the Art 9 ("explicit") one in its own bordered card.
 * "Terms of Service" / "Privacy Policy" inside the label become links.
 */
@Composable
fun ConsentCheckbox(item: ConsentItem, checked: Boolean, disabled: Boolean = false, onChange: (Boolean) -> Unit) {
    val t = tokens()
    val context = LocalContext.current
    val shape = RoundedCornerShape(6.dp)
    val base = if (item.explicit) Modifier.clip(shape).background(t.cardBg).border(1.dp, t.borderMedium, shape).padding(12.dp)
    else Modifier.padding(vertical = 2.dp)
    Row(
        Modifier.fillMaxWidth().alpha(if (disabled) 0.6f else 1f).tap(!disabled) { onChange(!checked) }.then(base),
        verticalAlignment = Alignment.Top,
    ) {
        SwissCheckbox(checked, !disabled, onChange, Modifier.padding(top = 2.dp))
        HSpace(10.dp)
        val linkStyle = SpanStyle(color = t.textPrimary, fontWeight = FontWeight.Bold, textDecoration = TextDecoration.Underline)
        val text = buildAnnotatedString {
            val pattern = Regex("(Terms of Service|Privacy Policy)")
            var last = 0
            for (m in pattern.findAll(item.label)) {
                append(item.label.substring(last, m.range.first))
                val href = if (m.value == "Terms of Service") webUrl("/terms") else webUrl("/privacy")
                withLink(LinkAnnotation.Clickable(href, TextLinkStyles(linkStyle)) { openUrl(context, href) }) { append(m.value) }
                last = m.range.last + 1
            }
            append(item.label.substring(last))
            if (!item.required) withStyle(SpanStyle(color = t.textMuted, fontWeight = FontWeight.SemiBold)) { append(" (optional)") }
        }
        Text(text, style = satoshi(12.5f, 500, lineHeight = 1.55f), color = t.textSecondary)
    }
}
