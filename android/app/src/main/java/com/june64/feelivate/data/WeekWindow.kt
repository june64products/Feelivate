package com.june64.feelivate.data

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** frontend/src/lib/weekWindow.ts, verbatim in Kotlin. Keep in step with `_effective_lock_start` on the server. */
object WeekWindow {
    private const val MIN_WEEK_DAYS = 3
    const val MAX_START_LEAD_DAYS = 14

    data class Window(val start: String, val end: String, val dayCount: Int, val startsLater: Boolean)

    fun today(): String = LocalDate.now().toString()
    fun parse(iso: String): LocalDate = LocalDate.parse(iso)
    private fun weekdayMon0(d: LocalDate) = d.dayOfWeek.value - 1   // Mon=0 … Sun=6

    fun projectedWeekWindow(lockIso: String = today(), isFirstPlan: Boolean = false): Window {
        val lock = parse(lockIso)
        val daysLeft = 7 - weekdayMon0(lock)
        val rolls = !isFirstPlan && daysLeft < MIN_WEEK_DAYS
        val start = if (rolls) lock.plusDays(daysLeft.toLong()) else lock
        val end = start.plusDays((6 - weekdayMon0(start)).toLong())
        return Window(start.toString(), end.toString(), (end.toEpochDay() - start.toEpochDay()).toInt() + 1, rolls)
    }

    fun windowFrom(startIso: String): Window {
        val start = parse(startIso)
        val end = start.plusDays((6 - weekdayMon0(start)).toLong())
        return Window(start.toString(), end.toString(), (end.toEpochDay() - start.toEpochDay()).toInt() + 1, startIso > today())
    }

    fun addDays(iso: String, n: Int): String = parse(iso).plusDays(n.toLong()).toString()

    fun rollWeekendStart(iso: String): String {
        val d = parse(iso); val daysLeft = 7 - weekdayMon0(d)
        return if (daysLeft < MIN_WEEK_DAYS) d.plusDays(daysLeft.toLong()).toString() else iso
    }

    fun nextMonday(iso: String): String { val d = parse(iso); return d.plusDays((7 - weekdayMon0(d)).toLong()).toString() }

    fun daysBetween(aIso: String, bIso: String): Int = (parse(bIso).toEpochDay() - parse(aIso).toEpochDay()).toInt()

    /** "Thu, 6 Aug" (en-GB short) */
    fun formatDay(iso: String): String = parse(iso).format(DateTimeFormatter.ofPattern("EEE, d MMM", Locale.UK))

    /** "Thursday, 6 August" */
    fun formatLong(iso: String): String = parse(iso).format(DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.UK))

    fun dayLetter(iso: String): String = listOf("M", "T", "W", "T", "F", "S", "S")[weekdayMon0(parse(iso))]
    fun shortDay(iso: String): String = parse(iso).dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US)

    // ── missionTheme.ts helpers ──
    private val REST = Regex("^\\s*(?:optional\\s+)?(?:rest|recovery)\\b", RegexOption.IGNORE_CASE)
    fun isRestAction(action: String?): Boolean = REST.containsMatchIn(action ?: "")

    /** The plan's `day` label contains the weekday name; a stamped start date pins the plan to its window. */
    fun planEntryFor(plan: Plan?, iso: String): PlanDay? {
        val days = plan?.days ?: return null
        if (days.isEmpty()) return null
        val start = plan.startDate.orEmpty()
        if (start.isNotEmpty()) {
            if (iso < start) return null
            val s = parse(start)
            val end = s.plusDays(((7 - s.dayOfWeek.value % 7) % 7).toLong())  // getDay(): 0 = Sunday → days to Sunday
            if (iso > end.toString()) return null
        }
        val d = parse(iso)
        val long = d.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.US).lowercase()
        val short = d.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US).lowercase()
        return days.firstOrNull { val l = it.day.lowercase(); l.contains(long) || l.contains(short) }
    }

    fun isoDaysAgo(fromIso: String, days: Int): String = parse(fromIso).minusDays(days.toLong()).toString()

    fun planWeekOver(plan: Plan?, todayIso: String): Boolean {
        val days = plan?.days ?: return false
        if (days.isEmpty()) return false
        return planEntryFor(plan, todayIso) == null && !plan.startDate.isNullOrEmpty() && todayIso > plan.startDate
    }

    /** LockedWeeksPanel.correctDayLabel — repairs "Jun 24 (Mon)" when Jun 24 is a Wednesday. */
    private val MONTHS = listOf("jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec")
    fun correctDayLabel(raw: String): String {
        val m = Regex("^\\s*([A-Za-z]{3,9})\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?").find(raw) ?: return raw
        val mo = MONTHS.indexOf(m.groupValues[1].take(3).lowercase()); if (mo < 0) return raw
        val dayNum = m.groupValues[2].toInt()
        var year = m.groupValues[3].toIntOrNull() ?: LocalDate.now().year
        if (m.groupValues[3].isEmpty()) {
            val now = LocalDate.now().toEpochDay()
            year = listOf(year - 1, year, year + 1).minByOrNull { y -> runCatching { kotlin.math.abs(LocalDate.of(y, mo + 1, dayNum).toEpochDay() - now) }.getOrDefault(Long.MAX_VALUE) } ?: year
        }
        val d = runCatching { LocalDate.of(year, mo + 1, dayNum) }.getOrNull() ?: return raw
        val wd = d.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.US)
        val datePart = if (m.groupValues[3].isNotEmpty()) "${m.groupValues[1]} ${m.groupValues[2]}, ${m.groupValues[3]}" else "${m.groupValues[1]} ${m.groupValues[2]}"
        return "$datePart ($wd)"
    }

    fun DayOfWeek.mon0() = value - 1
}
