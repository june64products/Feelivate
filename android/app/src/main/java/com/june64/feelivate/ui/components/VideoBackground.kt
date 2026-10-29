package com.june64.feelivate.ui.components

import android.graphics.SurfaceTexture
import android.media.MediaPlayer
import android.view.Surface
import android.view.TextureView
import androidx.annotation.RawRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver

/**
 * A silent, looping video from `res/raw`, drawn on a TextureView so it can sit
 * under Compose content with the page colour showing through until the first
 * frame arrives (no black flash).
 *
 * The composable is expected to be sized to the video's own aspect ratio; the
 * frame is then stretched to the surface one-to-one and needs no transform.
 * Playback follows the lifecycle — paused in the background, released on
 * dispose — because a MediaPlayer left running is a battery drain nobody sees.
 */
@Composable
fun VideoBackground(@RawRes resId: Int, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val holder = remember { PlayerHolder() }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE -> holder.pause()
                Lifecycle.Event.ON_RESUME -> holder.resume()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            holder.release()
        }
    }

    AndroidView(
        modifier = modifier,
        factory = { ctx ->
            TextureView(ctx).apply {
                isOpaque = false
                surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                    override fun onSurfaceTextureAvailable(texture: SurfaceTexture, width: Int, height: Int) {
                        holder.start(ctx.resources.openRawResourceFd(resId), Surface(texture))
                    }
                    override fun onSurfaceTextureSizeChanged(texture: SurfaceTexture, width: Int, height: Int) = Unit
                    override fun onSurfaceTextureUpdated(texture: SurfaceTexture) = Unit
                    override fun onSurfaceTextureDestroyed(texture: SurfaceTexture): Boolean {
                        holder.release()
                        return true
                    }
                }
            }
        },
    )
}

/** Owns the one MediaPlayer; every call is safe to make in any state. */
private class PlayerHolder {
    private var player: MediaPlayer? = null
    private var surface: Surface? = null
    private var wantsToPlay = true

    fun start(fd: android.content.res.AssetFileDescriptor, target: Surface) {
        release()
        surface = target
        player = MediaPlayer().apply {
            runCatching {
                setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
                fd.close()
                setSurface(target)
                isLooping = true
                setVolume(0f, 0f)            // the loop is a backdrop, never a soundtrack
                setOnPreparedListener { if (wantsToPlay) it.start() }
                setOnErrorListener { _, _, _ -> true }   // a broken clip just stays blank
                prepareAsync()
            }.onFailure { release() }
        }
    }

    fun pause() {
        wantsToPlay = false
        runCatching { player?.takeIf { it.isPlaying }?.pause() }
    }

    fun resume() {
        wantsToPlay = true
        runCatching { player?.takeIf { !it.isPlaying }?.start() }
    }

    fun release() {
        runCatching { player?.stop() }
        runCatching { player?.release() }
        player = null
        runCatching { surface?.release() }
        surface = null
    }
}
