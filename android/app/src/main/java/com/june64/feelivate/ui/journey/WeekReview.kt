@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
package com.june64.feelivate.ui.journey

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.june64.feelivate.R
import com.june64.feelivate.data.ReportData
import com.june64.feelivate.data.ReportDay
import com.june64.feelivate.ui.components.Hairline
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.theme.EaseSilk
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.clash
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import com.june64.feelivate.ui.tour.TourTarget
import com.june64.feelivate.ui.tour.tourTarget

/* ── small type bits, mirroring WeekReviewDashboard's `lab` / `cap` / `body` ── */

@Composable private fun Lab(text: String, color: Color = tokens().textSecondary, modifier: Modifier = Modifier) =
    Text(text.uppercase(), style = satoshi(10f, 700, lineHeight = 1.2f, ls = 0.14f), color = color, modifier = modifier)

@Composable private fun Cap(text: String, color: Color = tokens().textMuted, modifier: Modifier = Modifier) =
    Text(text.uppercase(), style = satoshi(10.5f, 500, lineHeight = 1.3f, ls = 0.06f), color = color, modifier = modifier)

@Composable private fun Body(text: String, modifier: Modifier = Modifier, color: Color = tokens().textPrimary, size: Float = 12.5f) =
    Text(text, style = satoshi(size, 500, lineHeight = 1.5f), color = color, modifier = modifier)

@Composable
private fun Tile(modifier: Modifier = Modifier, radius: Dp = 14.dp, padding: PaddingValues = PaddingValues(horizontal = 14.dp, vertical = 12.dp), borderColor: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    val t = tokens()
    val shape = RoundedCornerShape(radius)
    Column(
        modifier.fillMaxWidth().shadow(2.dp, shape, ambientColor = t.shadowColor.copy(alpha = 0.04f), spotColor = t.shadowColor.copy(alpha = 0.06f))
            .clip(shape).background(t.cardBg).border(1.dp, borderColor ?: t.borderSubtle, shape).padding(padding),
        verticalArrangement = Arrangement.spacedBy(6.dp), content = content,
    )
}

@Composable
private fun Chip(text: String, dotColor: Color? = null, textColor: Color? = null) {
    val t = tokens()
    Row(
        Modifier.clip(CircleShape).background(t.bgSurface).border(1.dp, t.borderMedium, CircleShape).padding(horizontal = 7.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        if (dotColor != null) Box(Modifier.size(7.dp).clip(CircleShape).background(dotColor))
        Text(text, style = satoshi(9.5f, 700, lineHeight = 1.2f, ls = 0.04f), color = textColor ?: t.textPrimary, maxLines = 1)
    }
}

@Composable
fun SectionHead(n: String, title: String, meta: String? = null, right: (@Composable () -> Unit)? = null) {
    val t = tokens()
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(n, style = clash(11f, 600, ls = 0.08f), color = t.textMuted)
        Text(title.uppercase(), style = satoshi(10f, 700, lineHeight = 1.2f, ls = 0.16f), color = t.textSecondary, maxLines = 1)
        Box(Modifier.weight(1f).height(1.dp).background(t.borderMedium))
        if (meta != null) Text(meta.uppercase(), style = satoshi(10f, 500, ls = 0.06f), color = t.textMuted, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 150.dp))
        right?.invoke()
    }
}

/** The View button — always names the other way of reading. */
@Composable
fun ViewButton(label: String, icon: Int, onClick: () -> Unit) {
    val t = tokens()
    Row(
        Modifier.tourTarget(TourTarget.REVIEW_VIEW).clip(CircleShape).background(t.cardBg).border(1.dp, t.borderMedium, CircleShape).tap(onClick = onClick).padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Lucide(icon, 12.dp, t.textPrimary)
        Text("VIEW · ${label.uppercase()}", style = satoshi(10f, 700, ls = 0.1f), color = t.textPrimary, maxLines = 1)
    }
}

/* ── date helpers (en-GB, like the web) ── */
private fun parseIso(iso: String): LocalDate? = runCatching { LocalDate.parse(iso) }.getOrNull()
private fun weekday(iso: String, long: Boolean = false): String =
    parseIso(iso)?.format(DateTimeFormatter.ofPattern(if (long) "EEEE" else "EEE", Locale.UK)) ?: ""
private fun dayNum(iso: String): String = parseIso(iso)?.dayOfMonth?.toString() ?: ""
private fun fmtRange(a: String?, b: String?): String {
    if (a.isNullOrBlank() || b.isNullOrBlank()) return ""
    val f = DateTimeFormatter.ofPattern("d MMM", Locale.UK)
    val da = parseIso(a) ?: return ""; val db = parseIso(b) ?: return ""
    return "${da.format(f)} – ${db.format(f)}"
}

/* ── the five sections ── */

data class ReviewSection(val id: String, val n: String, val title: String, val meta: String?, val body: @Composable () -> Unit)

@Composable
fun reviewSections(report: ReportData, days: List<ReportDay>, weekStart: String?, weekEnd: String?, onPlanNext: (() -> Unit)?): List<ReviewSection> {
    val t = tokens()
    val wk = report.weekNumber
    val pastDays = if (report.pastDaysCount > 0) report.pastDaysCount else days.size
    val noted = days.filter { it.hasJournal }
    val daysDone = if (report.daysDone > 0) report.daysDone else noted.size
    val bestDays = report.bestDays.ifEmpty { report.patterns?.bestDays ?: emptyList() }.ifEmpty { report.peakPerformanceDays }
    val worstDays = report.worstDays.ifEmpty { report.patterns?.worstDays ?: emptyList() }
    val moodTrend = report.moodTrend.ifBlank { report.patterns?.moodTrend.orEmpty() }.trim()
    val friction = report.recurringFriction.ifEmpty { report.patterns?.recurringFriction ?: emptyList() }
    val showTriggers = report.triggerPatterns.isNotEmpty() && wk >= 3
    val prev = if (wk >= 2) report.prevWeekStats else null
    val momentum = report.momentumScore ?: ((report.consistencyScore * 0.4) + ((report.avgScore / 10f) * 100 * 0.3) + (report.consistencyScore * 0.3)).roundToInt()
    val momentumLabel = report.momentumLabel ?: when { report.consistencyScore >= 85 -> "Peak"; report.consistencyScore >= 70 -> "Strong Week"; else -> "Building" }
    val planNotes = report.nextWeekPlanContext.split(Regex("\n+")).map { it.replace(Regex("^\\s*[-•·]\\s*"), "").trim() }.filter { it.isNotBlank() }
    val bestNoted = noted.maxByOrNull { it.score ?: 0 }
    val bestDayName = bestNoted?.let { weekday(it.date, true) }
    val headline = if (report.quietWeek) "This week went quiet." else "$daysDone of $pastDays days." + (bestDayName?.let { " $it was the high point." } ?: "")
    val quoteDay = remember(report.bestQuote, noted) {
        val q = report.bestQuote?.trim()?.lowercase().orEmpty()
        noted.firstOrNull { d -> !d.oneLiner.isNullOrBlank() && q.isNotBlank() && (q.contains(d.oneLiner!!.lowercase().take(30)) || d.oneLiner!!.lowercase().contains(q.take(30))) } ?: bestNoted
    }
    val summary = report.weekSummary
    val mentorRows = (if (summary != null) listOf(
        Triple("Wins", Status.Success, summary.wins), Triple("Dips", t.accentWarm, summary.dips), Triple("Pattern", Color(0xFF6366F1), summary.pattern),
    ) else listOf(
        Triple("What went well", Status.Success, report.whatWentWell),
        Triple("Where you slipped", t.accentWarm, report.whereYouSlipped),
        Triple("Consistency", Color(0xFF6366F1), report.consistencyAnalysis.ifBlank { report.emotionalArc }),
    )).filter { it.third.isNotBlank() }

    val out = ArrayList<Triple<String, Pair<String, String?>, @Composable () -> Unit>>()

    // 01 At a glance
    out.add(Triple("glance", "At a glance" to listOfNotNull("Week $wk", fmtRange(weekStart, weekEnd).ifBlank { null }, report.weekTheme.ifBlank { null }).joinToString(" · ")) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Tile {
                Text(headline, style = clash(19f, 600, lineHeight = 1.08f, ls = -0.03f), color = t.textPrimary)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 2.dp)) {
                    report.weekBadge?.name?.takeIf { it.isNotBlank() }?.let { Stamp(it) }
                    report.dominantEmotion.takeIf { it.isNotBlank() }?.let { Chip("mostly $it", emotionColor(it)) }
                    bestNoted?.let { Chip("best day ${weekday(it.date)}", emotionColor(it.emotion)) }
                }
                report.weekBadge?.reason?.takeIf { it.isNotBlank() }?.let { Body("Badge: $it", color = t.textSecondary, size = 11f) }
            }
            Tile {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    MomentumRing(momentum)
                    Column {
                        Lab("Momentum")
                        Text(momentumLabel, style = clash(20f, 600, lineHeight = 1f, ls = -0.03f), color = t.textPrimary, modifier = Modifier.padding(top = 2.dp))
                        Cap("out of 100")
                        Text("40% consistency · 30% mood · 30% execution", style = satoshi(10f, 500, lineHeight = 1.35f), color = t.textSecondary, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
            Tile(padding = PaddingValues(8.dp)) {
                val stats = listOf(
                    StatCell("Consistency", "${report.consistencyScore}", "%", prev?.let { DeltaSpec((report.consistencyScore - it.consistencyScore).toFloat(), "%") } ?: null, if (prev == null) "$daysDone of $pastDays days" else null),
                    StatCell("Days done", "$daysDone", "/$pastDays", prev?.let { DeltaSpec((daysDone - it.daysDone).toFloat(), "") }, if (prev == null) "${report.daysMissed} missed" else null),
                    StatCell("Avg mood", fmtScore(report.avgScore), "/10", prev?.let { DeltaSpec(report.avgScore - it.avgScore, "") }, if (prev == null) "${noted.size} evening note${if (noted.size == 1) "" else "s"}" else null),
                    if (prev != null) StatCell("Momentum", "$momentum", "", DeltaSpec((momentum - prev.momentumScore).toFloat(), ""), null)
                    else StatCell("vs last week", "—", "", null, "from Week 2"),
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    stats.chunked(2).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            row.forEach { s -> StatBox(Modifier.weight(1f), s) }
                            if (row.size == 1) Box(Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    })

    // 02 How it felt
    out.add(Triple("felt", "How it felt" to "dot = note · dashed = no note") {
        Tile(radius = 16.dp, padding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)) {
            FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Lab("Each evening, 1–10")
                if (bestDays.isNotEmpty()) Text("best ${bestDays.joinToString(" · ")}", style = satoshi(10.5f, 700, ls = 0.04f), color = Status.Success)
                if (worstDays.isNotEmpty()) Text("hardest ${worstDays.joinToString(" · ")}", style = satoshi(10.5f, 700, ls = 0.04f), color = t.accentWarm)
            }
            MoodChart(days)
            EmotionMix(days)
            if (moodTrend.isNotBlank() || friction.isNotEmpty()) {
                Hairline()
                if (moodTrend.isNotBlank()) Column(Modifier.padding(top = 8.dp)) { Cap("Mood trend"); Body(moodTrend, Modifier.padding(top = 2.dp)) }
                if (friction.isNotEmpty()) Column(Modifier.padding(top = 8.dp)) {
                    Cap("Recurring friction")
                    FlowRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { friction.forEach { Chip(it) } }
                }
            }
            if (showTriggers) {
                Column(Modifier.padding(top = 8.dp)) {
                    Cap("Trigger patterns")
                    report.triggerPatterns.forEachIndexed { i, tp ->
                        if (i > 0) Hairline()
                        Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(tp.pattern, style = satoshi(11.5f, 500), color = t.textPrimary, modifier = Modifier.weight(1f))
                            Text(tp.frequency, style = satoshi(11.5f, 500), color = t.textSecondary, maxLines = 1)
                        }
                    }
                }
            }
        }
    })

    // 03 What your mentor saw
    if (mentorRows.isNotEmpty() || !report.bestQuote.isNullOrBlank() || report.hiddenInsight.isNotBlank()) {
        out.add(Triple("mentor", "What your mentor saw" to null) {
            Tile(radius = 16.dp, padding = PaddingValues(horizontal = 16.dp, vertical = 14.dp)) {
                report.bestQuote?.takeIf { it.isNotBlank() }?.let { q ->
                    Row(Modifier.height(IntrinsicSize.Min)) {
                        Box(Modifier.width(3.dp).fillMaxHeight().background(t.textPrimary))
                        Column(Modifier.padding(start = 12.dp)) {
                            Text("“$q”", style = clash(15f, 600, lineHeight = 1.3f, ls = -0.03f), color = t.textPrimary)
                            Cap("In your words" + (quoteDay?.let { d -> " · ${weekday(d.date, true)}" + (d.emotion?.let { " · $it" } ?: "") + (d.score?.let { " $it/10" } ?: "") } ?: ""), modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
                mentorRows.forEach { (label, color, text) ->
                    Column(Modifier.padding(top = 6.dp)) {
                        Lab(label, color)
                        Body(text, Modifier.padding(top = 2.dp))
                    }
                }
                report.hiddenInsight.takeIf { it.isNotBlank() }?.let { insight ->
                    Column(
                        Modifier.fillMaxWidth().padding(top = 4.dp).clip(RoundedCornerShape(12.dp))
                            .background(Brush.verticalGradient(listOf(Color(0x1FF59E0B), Color(0x0AF59E0B))))
                            .border(1.dp, Color(0x59F59E0B), RoundedCornerShape(12.dp)).padding(horizontal = 12.dp, vertical = 10.dp),
                    ) {
                        Lab("💡 Hidden insight", Color(0xFFF59E0B))
                        Text(insight, style = satoshi(12.5f, 700, lineHeight = 1.5f), color = t.textPrimary, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        })
    }

    // 04 Next week
    if (report.nextWeekFocus.isNotBlank() || planNotes.isNotEmpty() || onPlanNext != null) {
        out.add(Triple("next", "Next week" to null) {
            Tile(radius = 16.dp, padding = PaddingValues(horizontal = 16.dp, vertical = 14.dp), borderColor = t.accentWarm) {
                Lab("One change", t.accentWarm)
                Text(report.nextWeekFocus.ifBlank { "Keep showing up every day." }, style = clash(18f, 600, lineHeight = 1.2f, ls = -0.03f), color = t.textPrimary)
                if (planNotes.isNotEmpty()) {
                    Lab("The plan will account for", modifier = Modifier.padding(top = 6.dp))
                    planNotes.forEach { Text("•  $it", style = satoshi(12f, 500, lineHeight = 1.5f), color = t.textSecondary) }
                }
                if (wk < 3) Cap("Week-over-week from Week 2 · Trigger patterns from Week 3", modifier = Modifier.padding(top = 6.dp))
                if (onPlanNext != null) {
                    Row(
                        Modifier.padding(top = 4.dp).clip(CircleShape).background(t.btnPrimaryBg).tap(onClick = onPlanNext).padding(horizontal = 16.dp, vertical = 9.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) { Text("Plan Week ${wk + 1} →", style = satoshi(11.5f, 700), color = t.btnPrimaryText) }
                }
            }
        })
    }

    // 05 Day by day
    if (days.isNotEmpty()) {
        out.add(Triple("days", "Day by day" to "task · your words · coaching") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                days.chunked(2).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        row.forEach { d -> Box(Modifier.weight(1f)) { DayCard(d) } }
                        if (row.size == 1) Box(Modifier.weight(1f))
                    }
                }
            }
        })
    }

    return out.mapIndexed { i, (id, titleMeta, body) ->
        ReviewSection(id, (i + 1).toString().padStart(2, '0'), titleMeta.first, titleMeta.second, body)
    }
}

private fun fmtScore(v: Float): String = if (v == v.toInt().toFloat()) v.toInt().toString() else String.format(Locale.US, "%.1f", v)

private data class DeltaSpec(val delta: Float, val suffix: String)
private data class StatCell(val label: String, val value: String, val unit: String, val delta: DeltaSpec?, val sub: String?)

@Composable
private fun StatBox(modifier: Modifier, s: StatCell) {
    val t = tokens()
    Column(
        modifier.clip(RoundedCornerShape(12.dp)).background(t.bgSurface).border(1.dp, t.borderSubtle, RoundedCornerShape(12.dp)).padding(horizontal = 11.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Lab(s.label)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(s.value, style = clash(if (s.value == "—") 16f else 24f, 600, lineHeight = 1f, ls = -0.04f), color = t.textPrimary)
            if (s.unit.isNotEmpty()) Text(s.unit, style = clash(12f, 600, lineHeight = 1f), color = t.textMuted)
        }
        when {
            s.delta != null -> Delta(s.delta)
            s.sub != null -> Cap(s.sub)
        }
    }
}

@Composable
private fun Delta(spec: DeltaSpec) {
    val t = tokens()
    val d = (spec.delta * 10).roundToInt() / 10f
    if (d == 0f) { Text("· same as last week", style = satoshi(11f, 500), color = t.textMuted); return }
    Text(
        "${if (d > 0) "▲" else "▼"} ${fmtScore(abs(d))}${spec.suffix} vs last week",
        style = satoshi(11f, 700), color = if (d > 0) Status.Success else t.accentWarm,
    )
}

@Composable
private fun Stamp(name: String) {
    val t = tokens()
    Box(
        Modifier.rotate(-4f).clip(RoundedCornerShape(6.dp)).background(t.cardBg).border(1.5.dp, t.accentWarm, RoundedCornerShape(6.dp)).padding(horizontal = 9.dp, vertical = 4.dp),
    ) { Text("★ ${name.uppercase()}", style = satoshi(10f, 700, ls = 0.12f), color = t.accentWarm, maxLines = 1) }
}

@Composable
private fun MomentumRing(momentum: Int) {
    val t = tokens()
    var shown by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { shown = true }
    val p by animateFloatAsState(if (shown) (momentum.coerceIn(0, 100) / 100f) else 0f, tween(900, easing = EaseSilk), label = "p")
    Box(Modifier.size(84.dp), contentAlignment = Alignment.Center) {
        androidx.compose.foundation.Canvas(Modifier.fillMaxSize()) {
            val stroke = 9.dp.toPx()
            val r = (size.minDimension - stroke) / 2
            drawCircle(t.borderSubtle, radius = r, style = Stroke(stroke))
            drawArc(
                color = t.accentWarm, startAngle = -90f, sweepAngle = 360f * p, useCenter = false,
                topLeft = Offset(center.x - r, center.y - r), size = Size(r * 2, r * 2),
                style = Stroke(stroke, cap = StrokeCap.Round),
            )
        }
        Text("$momentum", style = clash(32f, 600, lineHeight = 1f, ls = -0.04f), color = t.textPrimary)
    }
}

/** The evening-mood line: a 300×118 drawing, exactly as the web's SVG. */
@Composable
private fun MoodChart(days: List<ReportDay>) {
    val t = tokens()
    if (days.isEmpty()) return
    val textPrimary = t.textPrimary
    val textSecondary = t.textSecondary
    val textMuted = t.textMuted
    val borderSubtle = t.borderSubtle
    val accentWarm = t.accentWarm
    val noted = days.withIndex().filter { it.value.hasJournal && it.value.score != null }
    val dom = noted.groupBy { it.value.emotion }.maxByOrNull { it.value.size }?.key?.let { emotionColor(it) } ?: accentWarm
    val labelPaint = remember { android.graphics.Paint().apply { isAntiAlias = true; textAlign = android.graphics.Paint.Align.CENTER } }

    androidx.compose.foundation.Canvas(Modifier.fillMaxWidth().widthIn(max = 380.dp).height(118.dp)) {
        val w = size.width
        val sx = w / 300f
        val top = 18f * sx; val base = 94f * sx
        val left = 30f * sx; val right = 270f * sx
        val n = max(days.size, 1)
        fun x(i: Int) = if (n == 1) w / 2 else left + (i * (right - left)) / (n - 1)
        fun y(score: Int) = base - (score.coerceIn(0, 10) / 10f) * (base - top)

        listOf(top, (top + base) / 2, base).forEach { gy ->
            drawLine(borderSubtle, Offset(12f * sx, gy), Offset(w - 12f * sx, gy), 1f)
        }
        if (noted.size >= 2) {
            val path = Path().apply {
                moveTo(x(noted.first().index), y(noted.first().value.score!!))
                noted.drop(1).forEach { lineTo(x(it.index), y(it.value.score!!)) }
                lineTo(x(noted.last().index), base); lineTo(x(noted.first().index), base); close()
            }
            drawPath(path, Brush.verticalGradient(listOf(dom.copy(alpha = 0.32f), dom.copy(alpha = 0f)), startY = top, endY = base))
        }
        for (k in 1 until noted.size) {
            val a = noted[k - 1]; val b = noted[k]
            val gap = b.index - a.index > 1
            drawLine(
                textPrimary, Offset(x(a.index), y(a.value.score!!)), Offset(x(b.index), y(b.value.score!!)),
                strokeWidth = 2f * sx, cap = StrokeCap.Round,
                pathEffect = if (gap) PathEffect.dashPathEffect(floatArrayOf(4f * sx, 5f * sx)) else null,
            )
        }
        days.forEachIndexed { i, d ->
            if (d.hasJournal && d.score != null) drawCircle(emotionColor(d.emotion), 6f * sx, Offset(x(i), y(d.score!!)))
            else drawCircle(textMuted, 5f * sx, Offset(x(i), base), style = Stroke(1f * sx, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f * sx, 3f * sx))))
        }
        drawContext.canvas.nativeCanvas.apply {
            days.forEachIndexed { i, d ->
                if (d.hasJournal && d.score != null) {
                    labelPaint.color = textPrimary.toArgb(); labelPaint.textSize = 11f * sx; labelPaint.isFakeBoldText = true
                    drawText("${d.score}", x(i), y(d.score!!) - 12f * sx, labelPaint)
                }
                val done = d.hasJournal || d.checkin == "done"
                labelPaint.color = textSecondary.toArgb(); labelPaint.textSize = 9.5f * sx; labelPaint.isFakeBoldText = true
                drawText("${weekday(d.date).uppercase()} ${if (done) "✓" else if (d.checkin == "pending") "·" else "—"}", x(i), size.height - 6f * sx, labelPaint)
            }
        }
    }
}

private fun Color.toArgb(): Int = android.graphics.Color.argb((alpha * 255).roundToInt(), (red * 255).roundToInt(), (green * 255).roundToInt(), (blue * 255).roundToInt())

/** The week's emotions as one thin stacked bar with a legend under it. */
@Composable
private fun EmotionMix(days: List<ReportDay>) {
    val t = tokens()
    val counts = days.filter { it.hasJournal && !it.emotion.isNullOrBlank() }.groupingBy { it.emotion!! }.eachCount()
    val total = counts.values.sum()
    val entries = counts.entries.sortedByDescending { it.value }
    Column(Modifier.fillMaxWidth()) {
        Lab("Emotion mix", modifier = Modifier.padding(bottom = 5.dp))
        if (total == 0) Cap("No evening notes this week")
        else {
            Row(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(6.dp)), horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                entries.forEach { (label, n) -> Box(Modifier.weight(n.toFloat()).fillMaxHeight().background(emotionColor(label))) }
            }
            FlowRow(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                entries.forEach { (label, n) ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Box(Modifier.size(7.dp).clip(CircleShape).background(emotionColor(label)))
                        Text("$label ${(n * 100f / total).roundToInt()}%", style = satoshi(11f, 500), color = t.textSecondary)
                    }
                }
            }
        }
    }
}


@Composable
private fun DayCard(d: ReportDay) {
    val t = tokens()
    val done = d.hasJournal || d.checkin == "done"
    val col = emotionColor(d.emotion)
    val muted = !done
    Tile(padding = PaddingValues(horizontal = 12.dp, vertical = 10.dp)) {
        Row(Modifier.fillMaxWidth().height(20.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(weekday(d.date).uppercase(), style = satoshi(9f, 700, ls = 0.12f), color = if (muted) t.textMuted else t.textSecondary)
            Text(dayNum(d.date), style = clash(15f, 700, lineHeight = 1f, ls = -0.02f), color = if (muted) t.textMuted else t.textPrimary)
            Box(Modifier.weight(1f))
            if (d.hasJournal) Chip("${d.emotion ?: "noted"}${d.score?.let { " $it" } ?: ""}", col)
            else Chip(when (d.checkin) { "done" -> "done"; "pending" -> "ahead"; "skipped" -> "skipped"; else -> "missed" }, textColor = t.textMuted)
        }
        Box(Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(3.dp)).background(t.borderSubtle)) {
            if (d.hasJournal && d.score != null) Box(Modifier.fillMaxWidth(d.score!! / 10f).height(5.dp).clip(RoundedCornerShape(3.dp)).background(col))
        }
        if (d.plannedTask.isNotBlank()) Text(d.plannedTask, style = satoshi(11f, 500, lineHeight = 1.45f), color = t.textSecondary)
        if (d.hasJournal && !d.oneLiner.isNullOrBlank()) Text("“${d.oneLiner}”", style = satoshi(11.5f, 500, lineHeight = 1.45f), color = t.textPrimary)
        if (d.coachingInsight.isNotBlank() || !d.coachingMicroAction.isNullOrBlank()) {
            Text(
                "→ ${d.coachingInsight}${if (d.coachingInsight.isNotBlank() && !d.coachingMicroAction.isNullOrBlank()) " — " else ""}${d.coachingMicroAction.orEmpty()}",
                style = satoshi(11f, 500, lineHeight = 1.45f), color = if (d.hasJournal) col else t.textSecondary,
            )
        }
    }
}

/**
 * The report itself: the dashboard by default, swipe cards behind the View
 * button. Both are built from the same sections.
 */
@Composable
fun WeekReview(report: ReportData, days: List<ReportDay>, weekStart: String?, weekEnd: String?, onPlanNext: (() -> Unit)? = null, compact: Boolean = false) {
    val t = tokens()
    var swipe by remember { mutableStateOf(false) }
    val sections = reviewSections(report, days, weekStart, weekEnd, onPlanNext)
    if (sections.isEmpty()) return
    val toggle: @Composable () -> Unit = {
        if (swipe) ViewButton("Dashboard", R.drawable.lu_grid) { swipe = false }
        else ViewButton("Swipe", R.drawable.lu_chevrons_right) { swipe = true }
    }

    if (!swipe) {
        Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            sections.forEachIndexed { i, s ->
                Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    SectionHead(s.n, s.title, s.meta, if (i == 0) toggle else null)
                    s.body()
                }
            }
        }
        return
    }

    val pager = rememberPagerState { sections.size }
    val scope = rememberCoroutineScope()
    val frameH = if (compact) 480.dp else 620.dp
    Box(
        Modifier.fillMaxWidth().widthIn(max = 520.dp).height(frameH)
            .clip(RoundedCornerShape(24.dp)).background(t.bgPrimary).border(1.dp, t.borderSubtle, RoundedCornerShape(24.dp)),
    ) {
        HorizontalPager(pager, Modifier.fillMaxSize()) { page ->
            val s = sections[page]
            Column(
                Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, top = 32.dp, bottom = 70.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SectionHead(s.n, s.title, s.meta)
                s.body()
            }
        }
        // progress
        Row(Modifier.fillMaxWidth().align(Alignment.TopCenter).padding(horizontal = 16.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            sections.forEachIndexed { i, _ ->
                Box(
                    Modifier.weight(1f).height(2.dp).clip(RoundedCornerShape(2.dp))
                        .background(if (i <= pager.currentPage) t.textPrimary else t.borderMedium)
                        .tap { scope.launch { pager.animateScrollToPage(i) } },
                )
            }
        }
        // folio
        Row(
            Modifier.fillMaxWidth().align(Alignment.BottomCenter)
                .background(Brush.verticalGradient(listOf(Color.Transparent, t.bgPrimary), startY = 0f, endY = 60f))
                .padding(start = 14.dp, end = 14.dp, top = 10.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            toggle()
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                NavBtn(R.drawable.lu_chevron_left, pager.currentPage == 0) { scope.launch { pager.animateScrollToPage(pager.currentPage - 1) } }
                Text("${pager.currentPage + 1} / ${sections.size}", style = satoshi(10.5f, 500, ls = 0.06f), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.widthIn(min = 42.dp))
                NavBtn(R.drawable.lu_chevron_right, pager.currentPage == sections.size - 1) { scope.launch { pager.animateScrollToPage(pager.currentPage + 1) } }
            }
        }
    }
}

@Composable
private fun NavBtn(icon: Int, disabled: Boolean, onClick: () -> Unit) {
    val t = tokens()
    Box(
        Modifier.size(30.dp).alpha(if (disabled) 0.5f else 1f).clip(CircleShape).background(t.cardBg).border(1.dp, t.borderMedium, CircleShape).tap(!disabled, onClick),
        contentAlignment = Alignment.Center,
    ) { Lucide(icon, 15.dp, if (disabled) t.textMuted else t.textPrimary) }
}

