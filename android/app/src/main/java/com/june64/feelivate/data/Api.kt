package com.june64.feelivate.data

import android.content.Context
import com.june64.feelivate.BuildConfig
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.HttpException
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.HTTP
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import java.io.IOException
import java.util.concurrent.TimeUnit

/** The same endpoints the web client calls (frontend/src/api.ts). */
interface FeelivateApi {
    // auth
    @POST("login") suspend fun login(@Body body: LoginRequest): AuthResponse
    @POST("signup") suspend fun signup(@Body body: SignupRequest): AuthResponse
    @POST("auth/google/mobile") suspend fun googleMobile(@Body body: GoogleMobileRequest): AuthResponse
    @GET("me") suspend fun me(): Me
    // consent
    @GET("legal/consents") suspend fun consentCatalogue(): ConsentCatalogue
    @GET("account/consents") suspend fun consents(): ConsentState
    @POST("account/consents") suspend fun submitConsents(@Body body: ConsentSubmit): JsonObject
    // sessions / chat
    @GET("sessions/{userId}") suspend fun sessions(@Path("userId") userId: String): List<SessionSummary>
    @GET("sessions/detail/{sessionId}") suspend fun sessionDetail(@Path("sessionId") sessionId: String): SessionDetail
    @POST("chat") suspend fun chat(@Body body: ChatRequest): ChatResponse
    @POST("chat/{sessionId}/approve_plan") suspend fun approvePlan(@Path("sessionId") sessionId: String, @Query("client_date") clientDate: String, @Query("start_date") startDate: String?): ApproveResponse
    @POST("sessions/{sessionId}/complete") suspend fun completeSession(@Path("sessionId") sessionId: String): CompleteResponse
    @GET("sessions/{sessionId}/reports") suspend fun sessionReports(@Path("sessionId") sessionId: String, @Query("client_date") clientDate: String): List<ArchivedWeekReport>
    @POST("sessions/{sessionId}/howto") suspend fun howTo(@Path("sessionId") sessionId: String, @Body body: HowToRequest): TaskHowTo
    // streak
    @GET("streak/{userId}") suspend fun streak(@Path("userId") userId: String, @Query("client_date") clientDate: String): Streak
    @POST("streak/backfill") suspend fun backfill(@Query("client_date") clientDate: String): BackfillResponse
    @POST("checkin") suspend fun checkin(@Body body: CheckinRequest): CheckinResponse
    @POST("checkin/slip_reason") suspend fun slipReason(@Body body: SlipReasonRequest): SavedResponse
    @POST("recovery/motivation") suspend fun recoveryMotivation(@Body body: RecoveryRequest): RecoveryResponse
    // journal
    @GET("journal/{userId}/today-emotion") suspend fun todayEmotion(@Path("userId") userId: String, @Query("session_id") sessionId: String?, @Query("client_date") clientDate: String): TodayEmotion
    @GET("journal/{userId}") suspend fun journals(@Path("userId") userId: String, @Query("session_id") sessionId: String?, @Query("limit") limit: Int = 30): List<JournalEntry>
    @Multipart @POST("journal/voice") suspend fun voiceJournal(@Part audio: MultipartBody.Part, @Query("session_id") sessionId: String?, @Query("client_date") clientDate: String): JournalEntry
    @Multipart @POST("mood/checkin") suspend fun moodCheckin(@Part audio: MultipartBody.Part): MoodCheckinResult
    @GET("journal/{userId}/weekly-report") suspend fun weeklyReport(@Path("userId") userId: String, @Query("session_id") sessionId: String?, @Query("week_number") weekNumber: Int?, @Query("client_date") clientDate: String, @Query("force_refresh") forceRefresh: Boolean? = null): WeeklyReport
    @GET("sessions/{sessionId}/week-info") suspend fun weekInfo(@Path("sessionId") sessionId: String, @Query("client_date") clientDate: String): WeekInfo
    @GET("sessions/{sessionId}/reports") suspend fun archivedReports(@Path("sessionId") sessionId: String, @Query("client_date") clientDate: String): List<ArchivedReport>
    // notifications
    @GET("notifications/email/status") suspend fun emailStatus(@Query("user_id") userId: String): EmailStatus
    @POST("notifications/email/send-otp") suspend fun sendOtp(@Body body: SendOtpRequest): MessageResponse
    @POST("notifications/email/verify-otp") suspend fun verifyOtp(@Body body: VerifyOtpRequest): MessageResponse
    @PUT("notifications/email/update-time") suspend fun updateTime(@Body body: UpdateTimeRequest): MessageResponse
    @POST("notifications/email/stop") suspend fun stopEmail(@Body body: UserIdRequest): MessageResponse
    @GET("notifications/push/status") suspend fun pushStatus(): PushStatus
    @PUT("notifications/push/preferences") suspend fun setPushPrefs(@Body body: PushPrefsRequest): PushStatus
    @POST("notifications/device") suspend fun registerDevice(@Body body: DeviceTokenRequest): JsonObject
    @HTTP(method = "DELETE", path = "notifications/device", hasBody = true) suspend fun forgetDevice(@Body body: DeviceTokenRequest): JsonObject
    // account
    @GET("account/export") suspend fun export(): ResponseBody
    @HTTP(method = "DELETE", path = "account", hasBody = true) suspend fun deleteAccount(@Body body: DeleteAccountRequest): DeleteAccountResult
    // voice
    @Multipart @POST("transcribe") suspend fun transcribe(@Part audio: MultipartBody.Part): TranscribeResponse
    // site
    @POST("contact") suspend fun contact(@Body body: ContactRequest): JsonObject
    @GET("blog/posts") suspend fun blogPosts(@Query("category") category: String? = null): PublishedPosts
    @POST("feedback") suspend fun feedback(@Body body: FeedbackRequest): JsonObject
    @GET("feedback/me") suspend fun myFeedbackStatus(): FeedbackStatus
}

/** One client for the whole app; the bearer token is read from the secure store on every call. */
object ApiClient {
    @Volatile private var api: FeelivateApi? = null

    val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true; isLenient = true }

    /** Feedback answers are free-form; this turns the form's map into the body the API stores. */
    fun toJsonObject(map: Map<String, Any?>): JsonObject = buildJsonObject {
        for ((k, v) in map) {
            when (v) {
                null -> {}
                is String -> if (v.isNotBlank()) put(k, JsonPrimitive(v))
                is Boolean -> put(k, JsonPrimitive(v))
                is Number -> put(k, JsonPrimitive(v))
                is List<*> -> if (v.isNotEmpty()) put(k, buildJsonArray { v.forEach { add(JsonPrimitive(it.toString())) } })
                is Map<*, *> -> if (v.isNotEmpty()) put(k, toJsonObject(v.entries.associate { it.key.toString() to it.value }))
                else -> put(k, JsonPrimitive(v.toString()))
            }
        }
    }

    fun get(context: Context): FeelivateApi = api ?: synchronized(this) {
        api ?: build(context.applicationContext).also { api = it }
    }

    private fun build(context: Context): FeelivateApi {
        val store = TokenStore(context)
        val auth = Interceptor { chain ->
            val token = store.token
            val req = if (token != null) chain.request().newBuilder().header("Authorization", "Bearer $token").build() else chain.request()
            chain.proceed(req)
        }
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC else HttpLoggingInterceptor.Level.NONE
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(auth)
            .addInterceptor(logging)
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)   // the mentor and reports can take a while
            .build()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(FeelivateApi::class.java)
    }
}

/** True when the backend refused because consent is outstanding (api.ts's `feelivate:consent-required`). */
fun Throwable.isConsentRequired(): Boolean {
    val e = this as? HttpException ?: return false
    if (e.code() != 403) return false
    return runCatching { (ApiClient.json.parseToJsonElement(e.response()?.errorBody()?.string().orEmpty()) as? JsonObject)?.get("detail") }
        .getOrNull()?.let { (it as? JsonObject)?.get("error") as? JsonPrimitive }?.content == "consent_required"
}

/** Turns the backend's `{"detail": "..."}` errors into a readable message. */
fun Throwable.userMessage(fallback: String = "Something went wrong"): String = when (this) {
    is HttpException -> {
        val raw = response()?.errorBody()?.string().orEmpty()
        val detail = runCatching {
            val d = (ApiClient.json.parseToJsonElement(raw) as? JsonObject)?.get("detail")
            when (d) {
                is JsonPrimitive -> d.content
                is JsonObject -> (d["message"] as? JsonPrimitive)?.content
                else -> null
            }
        }.getOrNull()
        detail ?: when (code()) {
            401 -> "Session expired. Please log in again."
            429 -> "Too many attempts. Try again in a minute."
            else -> fallback
        }
    }
    is IOException -> "No connection. Check your internet and try again."
    else -> message ?: fallback
}
