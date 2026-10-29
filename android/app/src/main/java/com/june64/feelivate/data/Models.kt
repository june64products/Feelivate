package com.june64.feelivate.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

/* Mirrors of the backend's JSON (app/main.py) and the web's api.ts types. Field names are the API's own. */

@Serializable data class LoginRequest(val email: String, val password: String)
@Serializable data class SignupRequest(val email: String, val password: String, val name: String? = null, val consents: Map<String, Boolean>)
@Serializable data class GoogleMobileRequest(@SerialName("id_token") val idToken: String)

@Serializable
data class AuthResponse(
    val message: String? = null,
    @SerialName("user_id") val userId: String,
    val name: String? = null,
    @SerialName("access_token") val accessToken: String,
    @SerialName("is_new_user") val isNewUser: Boolean = false,
    @SerialName("consent_required") val consentRequired: List<String> = emptyList(),
)

@Serializable
data class Me(
    val id: String,
    val name: String? = null,
    val email: String,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("consent_required") val consentRequired: List<String> = emptyList(),
)

@Serializable data class ConsentItem(val key: String, val label: String, val required: Boolean, val explicit: Boolean)
@Serializable data class ConsentCatalogue(@SerialName("policy_version") val policyVersion: String, val catalogue: List<ConsentItem>)
@Serializable data class ConsentRecord(val granted: Boolean, @SerialName("policy_version") val policyVersion: String? = null, @SerialName("recorded_at") val recordedAt: String? = null)
@Serializable
data class ConsentState(
    @SerialName("policy_version") val policyVersion: String,
    val catalogue: List<ConsentItem>,
    val state: Map<String, ConsentRecord> = emptyMap(),
    val missing: List<String> = emptyList(),
)
@Serializable data class ConsentSubmit(val consents: Map<String, Boolean>)

@Serializable
data class SessionSummary(
    val id: String,
    @SerialName("created_at") val createdAt: String? = null,
    val title: String? = null,
    @SerialName("focus_preview") val focusPreview: String? = null,
    @SerialName("current_week") val currentWeek: Int = 0,
    val phase: String? = null,
)

@Serializable data class PlanDay(val day: String = "", val action: String = "")

@Serializable
data class Plan(
    @SerialName("week_number") val weekNumber: Int = 1,
    @SerialName("week_label") val weekLabel: String = "",
    val theme: String = "",
    @SerialName("win_condition") val winCondition: String? = null,
    val days: List<PlanDay> = emptyList(),
    @SerialName("generated_date") val generatedDate: String? = null,
    @SerialName("start_date") val startDate: String? = null,
)

@Serializable
data class ChatMessage(
    val role: String,
    val content: String,
    @SerialName("created_at") val createdAt: String? = null,
    val plan: Plan? = null,
    val safety: SafetyNotice? = null,
    val blocked: BlockedNotice? = null,
)

@Serializable
data class SessionDetail(
    val id: String,
    @SerialName("created_at") val createdAt: String? = null,
    val focus: String? = null,
    @SerialName("current_week") val currentWeek: Int = 0,
    val phase: String? = null,
    val plan: Plan? = null,
    @SerialName("plan_history") val planHistory: List<Plan> = emptyList(),
    @SerialName("plan_starts_on") val planStartsOn: String? = null,
    @SerialName("commitment_why") val commitmentWhy: String? = null,
    val messages: List<ChatMessage> = emptyList(),
)

@Serializable data class SafetyResource(val region: String = "", val name: String = "", val contact: String = "", val note: String = "")
@Serializable data class SafetyNotice(val type: String = "", val headline: String = "", val body: String = "", val resources: List<SafetyResource> = emptyList())
@Serializable data class BlockedNotice(val type: String = "", val headline: String = "", val body: String = "", val category: String = "")
@Serializable data class SetupQuestion(val id: String? = null, val label: String, val placeholder: String? = null)
@Serializable data class NeedsStartDate(val week: Int, val earliest: String)

@Serializable
data class ChatRequest(
    val message: String,
    @SerialName("session_id") val sessionId: String? = null,
    @SerialName("user_id") val userId: String,
    val timezone: String,
    @SerialName("start_date") val startDate: String? = null,
)

@Serializable
data class ChatResponse(
    val reply: String = "",
    val plan: Plan? = null,
    @SerialName("session_id") val sessionId: String? = null,
    val questions: List<SetupQuestion>? = null,
    val safety: SafetyNotice? = null,
    val blocked: BlockedNotice? = null,
    @SerialName("needs_start_date") val needsStartDate: NeedsStartDate? = null,
)

@Serializable
data class ApproveResponse(
    val status: String = "",
    val week: Int = 1,
    @SerialName("plan_start_date") val planStartDate: String? = null,
    @SerialName("starts_on") val startsOn: String? = null,
    @SerialName("starts_later") val startsLater: Boolean = false,
    val message: String? = null,
)

@Serializable data class DayStatus(val date: String, val status: String)

@Serializable
data class Streak(
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("longest_streak") val longestStreak: Int = 0,
    @SerialName("total_done") val totalDone: Int = 0,
    @SerialName("last_checkin") val lastCheckin: String? = null,
    @SerialName("days_this_week") val daysThisWeek: List<DayStatus> = emptyList(),
    @SerialName("shield_applied") val shieldApplied: Boolean = false,
    @SerialName("shields_left") val shieldsLeft: Int? = null,
)

@Serializable data class CheckinRequest(val status: String, val note: String? = null, @SerialName("session_id") val sessionId: String? = null, @SerialName("client_date") val clientDate: String)
@Serializable
data class CheckinResponse(
    val date: String = "",
    val status: String = "",
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("longest_streak") val longestStreak: Int = 0,
    @SerialName("total_done") val totalDone: Int = 0,
    @SerialName("shields_left") val shieldsLeft: Int? = null,
)
@Serializable data class BackfillResponse(@SerialName("checkins_created") val checkinsCreated: Int = 0, @SerialName("current_streak") val currentStreak: Int = 0, @SerialName("longest_streak") val longestStreak: Int = 0, @SerialName("total_done") val totalDone: Int = 0)
@Serializable data class SlipReasonRequest(val date: String, val reason: String, @SerialName("session_id") val sessionId: String? = null)
@Serializable data class SavedResponse(val saved: Boolean = true)
@Serializable data class RecoveryRequest(@SerialName("miss_count") val missCount: Int, val focus: String? = null)
@Serializable data class RecoveryResponse(val line: String = "")

@Serializable
data class EmailStatus(
    val enabled: Boolean = false,
    @SerialName("notification_email") val notificationEmail: String? = null,
    @SerialName("preferred_time") val preferredTime: String? = null,
    @SerialName("preferred_timezone") val preferredTimezone: String? = null,
)
@Serializable data class SendOtpRequest(@SerialName("user_id") val userId: String, val email: String)
@Serializable
data class VerifyOtpRequest(
    @SerialName("user_id") val userId: String,
    val email: String,
    val code: String,
    @SerialName("session_id") val sessionId: String? = null,
    @SerialName("preferred_time") val preferredTime: String = "08:00",
    @SerialName("preferred_timezone") val preferredTimezone: String = "UTC",
)
@Serializable data class UpdateTimeRequest(@SerialName("user_id") val userId: String, @SerialName("preferred_time") val preferredTime: String, @SerialName("preferred_timezone") val preferredTimezone: String)
@Serializable data class UserIdRequest(@SerialName("user_id") val userId: String)
@Serializable data class MessageResponse(val message: String? = null, val status: String? = null)

@Serializable data class HowToRequest(val action: String, @SerialName("day_label") val dayLabel: String? = null)
@Serializable data class HowToItem(val name: String = "", val steps: List<String> = emptyList(), val mistakes: List<String> = emptyList(), val easier: String? = null)
@Serializable
data class TaskHowTo(
    val summary: String? = null,
    val items: List<HowToItem> = emptyList(),
    @SerialName("bare_minimum") val bareMinimum: String? = null,
    @SerialName("time_minutes") val timeMinutes: Int? = null,
    val action: String = "",
    @SerialName("day_label") val dayLabel: String? = null,
    val cached: Boolean = false,
)

@Serializable data class FinishedGoalStats(@SerialName("total_weeks") val totalWeeks: Int = 0, @SerialName("days_done") val daysDone: Int = 0, @SerialName("days_total") val daysTotal: Int = 0)
@Serializable data class CompleteResponse(val status: String = "", val stats: FinishedGoalStats? = null)

/** The archived report is a large, loosely typed object; we read the keys we show. */
@Serializable
data class ArchivedWeekReport(
    @SerialName("week_number") val weekNumber: Int,
    @SerialName("week_start") val weekStart: String = "",
    @SerialName("week_end") val weekEnd: String = "",
    val report: JsonObject? = null,
)

@Serializable data class EmotionEntry(val id: Int = 0, val date: String = "", @SerialName("emotion_label") val emotionLabel: String = "", @SerialName("emotion_score") val emotionScore: Float = 0f, @SerialName("one_liner") val oneLiner: String = "")
@Serializable data class TodayEmotion(@SerialName("has_entry") val hasEntry: Boolean = false, val entry: EmotionEntry? = null)

/* ── journal & the weekly review (JourneyPage.tsx) ── */

@Serializable
data class JournalEntry(
    val id: Int = 0,
    val date: String = "",
    val transcript: String = "",
    @SerialName("emotion_label") val emotionLabel: String = "",
    @SerialName("emotion_score") val emotionScore: Int = 0,
    @SerialName("one_liner") val oneLiner: String = "",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("recorded_today") val recordedToday: Boolean? = null,
)

@Serializable
data class MoodCheckinResult(
    @SerialName("emotion_label") val emotionLabel: String = "",
    @SerialName("emotion_score") val emotionScore: Int = 0,
    @SerialName("one_liner") val oneLiner: String = "",
    @SerialName("mood_only") val moodOnly: Boolean = true,
)

@Serializable
data class ReportDay(
    val date: String = "",
    @SerialName("day_label") val dayLabel: String = "",
    @SerialName("planned_task") val plannedTask: String = "",
    val emotion: String? = null,
    val score: Int? = null,
    @SerialName("one_liner") val oneLiner: String? = null,
    /** done · skipped · missed · pending */
    val checkin: String = "pending",
    @SerialName("has_journal") val hasJournal: Boolean = false,
    @SerialName("coaching_insight") val coachingInsight: String = "",
    @SerialName("coaching_micro_action") val coachingMicroAction: String? = null,
)

@Serializable data class WeekBadge(val name: String = "", val reason: String = "")
@Serializable data class WeekSummary(val wins: String = "", val dips: String = "", val pattern: String = "")
@Serializable data class TriggerPattern(val pattern: String = "", val frequency: String = "", @SerialName("weeks_detected") val weeksDetected: List<Int> = emptyList())
@Serializable data class PrevWeekStats(@SerialName("consistency_score") val consistencyScore: Int = 0, @SerialName("avg_score") val avgScore: Float = 0f, @SerialName("momentum_score") val momentumScore: Int = 0, @SerialName("days_done") val daysDone: Int = 0)
@Serializable data class ReportPatterns(@SerialName("best_days") val bestDays: List<String> = emptyList(), @SerialName("worst_days") val worstDays: List<String> = emptyList(), @SerialName("mood_trend") val moodTrend: String = "", @SerialName("recurring_friction") val recurringFriction: List<String> = emptyList())

@Serializable
data class ReportData(
    @SerialName("avg_score") val avgScore: Float = 0f,
    @SerialName("consistency_score") val consistencyScore: Int = 0,
    @SerialName("days_done") val daysDone: Int = 0,
    @SerialName("days_missed") val daysMissed: Int = 0,
    @SerialName("past_days_count") val pastDaysCount: Int = 0,
    @SerialName("entry_count") val entryCount: Int = 0,
    @SerialName("week_number") val weekNumber: Int = 1,
    @SerialName("week_theme") val weekTheme: String = "",
    @SerialName("momentum_score") val momentumScore: Int? = null,
    @SerialName("momentum_label") val momentumLabel: String? = null,
    @SerialName("peak_performance_days") val peakPerformanceDays: List<String> = emptyList(),
    @SerialName("prev_week_stats") val prevWeekStats: PrevWeekStats? = null,
    @SerialName("dominant_emotion") val dominantEmotion: String = "",
    @SerialName("week_summary") val weekSummary: WeekSummary? = null,
    @SerialName("week_badge") val weekBadge: WeekBadge? = null,
    @SerialName("best_quote") val bestQuote: String? = null,
    @SerialName("trigger_patterns") val triggerPatterns: List<TriggerPattern> = emptyList(),
    @SerialName("hidden_insight") val hiddenInsight: String = "",
    @SerialName("next_week_focus") val nextWeekFocus: String = "",
    @SerialName("next_week_plan_context") val nextWeekPlanContext: String = "",
    @SerialName("quiet_week") val quietWeek: Boolean = false,
    @SerialName("best_days") val bestDays: List<String> = emptyList(),
    @SerialName("worst_days") val worstDays: List<String> = emptyList(),
    @SerialName("mood_trend") val moodTrend: String = "",
    @SerialName("recurring_friction") val recurringFriction: List<String> = emptyList(),
    val patterns: ReportPatterns? = null,
    @SerialName("emotional_arc") val emotionalArc: String = "",
    @SerialName("what_went_well") val whatWentWell: String = "",
    @SerialName("where_you_slipped") val whereYouSlipped: String = "",
    @SerialName("consistency_analysis") val consistencyAnalysis: String = "",
    val days: List<ReportDay> = emptyList(),
)

@Serializable
data class WeeklyReport(
    /** generated · cached · no_data · waiting_for_sunday_entry · in_progress */
    val status: String = "",
    @SerialName("week_start") val weekStart: String = "",
    @SerialName("week_end") val weekEnd: String = "",
    val message: String? = null,
    val report: ReportData? = null,
)

@Serializable
data class WeekInfo(
    @SerialName("has_plan") val hasPlan: Boolean = false,
    @SerialName("current_week") val currentWeek: Int = 1,
    @SerialName("plan_start_date") val planStartDate: String? = null,
    @SerialName("week_start") val weekStart: String? = null,
    @SerialName("week_end") val weekEnd: String? = null,
    @SerialName("day_count") val dayCount: Int? = null,
    @SerialName("is_week_complete") val isWeekComplete: Boolean = false,
    @SerialName("is_completed") val isCompleted: Boolean = false,
    @SerialName("has_report") val hasReport: Boolean = false,
    @SerialName("has_next_plan") val hasNextPlan: Boolean = false,
)

/** The archive row's report is the same shape as a live one. */
@Serializable
data class ArchivedReport(
    @SerialName("week_number") val weekNumber: Int,
    @SerialName("week_start") val weekStart: String = "",
    @SerialName("week_end") val weekEnd: String = "",
    val report: ReportData? = null,
)

/* ── the site pages ── */

@Serializable data class ContactRequest(val name: String, val email: String, val message: String)

@Serializable
data class FeedbackRequest(
    val kind: String = "full",
    val answers: JsonObject,
    val comment: String? = null,
    @SerialName("contact_ok") val contactOk: Boolean = false,
    val email: String? = null,
    val trigger: String = "side_tab",
    val page: String? = null,
    @SerialName("session_id") val sessionId: String? = null,
)
@Serializable data class FeedbackStatus(val count: Int = 0, @SerialName("last_at") val lastAt: String? = null)

@Serializable
data class BlogCard(
    val id: Int = 0,
    val slug: String = "",
    val url: String = "",
    val title: String = "",
    val category: String = "",
    val excerpt: String = "",
    @SerialName("cover_image_url") val coverImageUrl: String? = null,
    @SerialName("cover_alt") val coverAlt: String? = null,
    val tags: List<String> = emptyList(),
    val author: String = "",
    @SerialName("reading_minutes") val readingMinutes: Int = 0,
    @SerialName("published_at") val publishedAt: String? = null,
)

@Serializable data class PublishedPosts(val posts: List<BlogCard> = emptyList(), val categories: List<String> = emptyList())

/** The legal documents ship as assets, in the same shape the web renders. */
@Serializable
data class LegalBlock(
    val t: String,
    val text: String? = null,
    val items: List<String> = emptyList(),
    val head: List<String> = emptyList(),
    val rows: List<List<String>> = emptyList(),
)
@Serializable data class LegalSection(val id: String, val h: String, val blocks: List<LegalBlock> = emptyList())
@Serializable data class LegalDocument(val version: String = "", val lastUpdated: String = "", val sections: List<LegalSection> = emptyList())

@Serializable data class DeleteAccountRequest(val confirmation: String, val password: String? = null)
@Serializable data class DeleteAccountResult(val status: String = "", val message: String = "", val deleted: JsonElement? = null, val incomplete: List<String> = emptyList())
@Serializable data class TranscribeResponse(val text: String = "")

@Serializable data class DeviceTokenRequest(val token: String, val platform: String = "android")
