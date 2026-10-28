package com.june64.feelivate.ui.workspace

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.june64.feelivate.R
import com.june64.feelivate.data.ApiClient
import com.june64.feelivate.ui.components.Lucide
import com.june64.feelivate.ui.components.openUrl
import com.june64.feelivate.ui.components.tap
import com.june64.feelivate.ui.components.webUrl
import com.june64.feelivate.ui.theme.Status
import com.june64.feelivate.ui.theme.pressScale
import com.june64.feelivate.ui.theme.satoshi
import com.june64.feelivate.ui.theme.tokens
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File

/** Records to m4a and hands the file to POST /transcribe (the web sends webm/opus). */
class VoiceRecorder(private val context: Context) {
    private var recorder: MediaRecorder? = null
    private var file: File? = null

    fun start(): Boolean = runCatching {
        val f = File(context.cacheDir, "voice_${System.currentTimeMillis()}.m4a")
        val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(context) else @Suppress("DEPRECATION") MediaRecorder()
        r.setAudioSource(MediaRecorder.AudioSource.MIC)
        r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        r.setAudioEncodingBitRate(96_000)
        r.setAudioSamplingRate(44_100)
        r.setOutputFile(f.absolutePath)
        r.prepare(); r.start()
        recorder = r; file = f
        true
    }.getOrDefault(false)

    /** Stops and returns the file, or null when it was too short to be anything. */
    fun stop(): File? {
        runCatching { recorder?.stop() }
        runCatching { recorder?.release() }
        recorder = null
        val f = file; file = null
        return f?.takeIf { it.length() > 1000 }
    }

    fun cancel() { runCatching { recorder?.stop() }; runCatching { recorder?.release() }; recorder = null; file?.delete(); file = null }
}

/**
 * RadiantPromptInput.tsx: one row — textarea, mic, send — in a 16px-radius
 * `--bg-surface` box, with the Terms line and the AI disclosure underneath.
 */
@Composable
fun RadiantPromptInput(
    value: String,
    onValueChange: (String) -> Unit,
    onSubmit: (String) -> Unit,
    placeholder: String = "Message Feelivate...",
    disabled: Boolean = false,
    showHints: Boolean = true,
    modifier: Modifier = Modifier,
) {
    val t = tokens()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var focused by remember { mutableStateOf(false) }
    var isRecording by remember { mutableStateOf(false) }
    var isTranscribing by remember { mutableStateOf(false) }
    var micError by remember { mutableStateOf<String?>(null) }
    val recorder = remember { VoiceRecorder(context) }
    DisposableEffect(Unit) { onDispose { recorder.cancel() } }

    val transcribe: () -> Unit = {
        val f = recorder.stop()
        isRecording = false
        if (f == null) micError = "Too short — hold and speak!" else {
            isTranscribing = true
            scope.launch {
                val text = runCatching {
                    withContext(Dispatchers.IO) {
                        val part = MultipartBody.Part.createFormData("audio", f.name, f.asRequestBody("audio/mp4".toMediaType()))
                        ApiClient.get(context).transcribe(part).text
                    }
                }.getOrNull()
                isTranscribing = false
                f.delete()
                if (text.isNullOrBlank()) micError = "Couldn't hear anything. Try again."
                else onValueChange(if (value.isNotBlank()) "$value $text" else text)
            }
        }
    }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) { if (recorder.start()) isRecording = true else micError = "Microphone is busy." }
        else micError = "Microphone access denied."
    }
    val onMic: () -> Unit = {
        micError = null
        if (isRecording) transcribe()
        else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            if (recorder.start()) isRecording = true else micError = "Microphone is busy."
        } else micPermission.launch(Manifest.permission.RECORD_AUDIO)
    }

    val canSend = value.isNotBlank() && !isRecording && !isTranscribing && !disabled
    Column(modifier.fillMaxWidth().widthIn(max = 780.dp)) {
        val shape = RoundedCornerShape(16.dp)
        Row(
            Modifier.fillMaxWidth().clip(shape).background(t.bgSurface).border(1.dp, if (focused) t.inputBorderFocus else t.inputBorder, shape)
                .padding(start = 16.dp, top = 6.dp, bottom = 6.dp, end = 8.dp),
            verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            BasicTextField(
                value = value, onValueChange = onValueChange, enabled = !disabled && !isTranscribing,
                textStyle = satoshi(14.5f, 400, lineHeight = 1.6f, color = if (isRecording) Status.Error else t.textPrimary),
                cursorBrush = SolidColor(t.textPrimary),
                modifier = Modifier.weight(1f).heightIn(min = 32.dp, max = 180.dp).verticalScroll(rememberScrollState())
                    .padding(top = 4.dp, bottom = 5.dp).onFocusChanged { focused = it.isFocused },
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.CenterStart) {
                        if (value.isEmpty()) Text(if (isRecording) "Listening..." else if (isTranscribing) "Transcribing..." else placeholder, style = satoshi(14.5f, 400, lineHeight = 1.6f), color = t.textMuted)
                        inner()
                    }
                },
            )
            Box(
                Modifier.size(32.dp).clip(CircleShape).background(if (isRecording) Status.Error.copy(alpha = 0.1f) else Color.Transparent).tap(!disabled && !isTranscribing) { onMic() },
                contentAlignment = Alignment.Center,
            ) {
                when {
                    isTranscribing -> com.june64.feelivate.ui.components.Spinner(16.dp, t.textMuted)
                    isRecording -> Lucide(R.drawable.lu_mic_off, 16.dp, Status.Error)
                    else -> Lucide(R.drawable.lu_mic, 16.dp, t.textMuted)
                }
            }
            Box(
                Modifier.pressScale(0.94f).size(32.dp).clip(CircleShape).background(if (canSend) t.btnPrimaryBg else t.btnDisabledBg).tap(canSend) { onSubmit(value.trim()); onValueChange("") },
                contentAlignment = Alignment.Center,
            ) {
                if (isRecording) Row(horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                    listOf(0, 150, 300, 150, 0).forEach { d ->
                        val inf = androidx.compose.animation.core.rememberInfiniteTransition(label = "wave")
                        val h by inf.animateFloat(3f, 16f, infiniteRepeatable(tween(350, d), RepeatMode.Reverse), label = "h")
                        Box(Modifier.width(2.5.dp).height(h.dp).clip(CircleShape).background(t.waveBar))
                    }
                } else Lucide(R.drawable.lu_arrow_up, 16.dp, if (canSend) t.btnPrimaryText else t.textMuted)
            }
        }
        AnimatedVisibility(micError != null, enter = fadeIn(), exit = fadeOut()) {
            Text(micError.orEmpty(), style = satoshi(11f, 500), color = Status.Error, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
        }
        if (showHints) {
            val link = SpanStyle(textDecoration = TextDecoration.Underline)
            Text(
                buildAnnotatedString {
                    append("By using Feelivate you agree to our ")
                    withStyle(link) { append("Terms") }
                    append(" and ")
                    withStyle(link) { append("Privacy Policy") }
                },
                style = satoshi(11f, 500), color = t.textMuted, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp).tap { openUrl(context, webUrl("/terms")) },
            )
            Text("You are interacting with an AI, not a human.", style = satoshi(11f, 500), color = t.textMuted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        }
    }
}
