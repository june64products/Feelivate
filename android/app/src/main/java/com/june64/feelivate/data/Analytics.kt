package com.june64.feelivate.data

import android.content.Context
import android.os.Bundle
import android.util.Log
import com.google.firebase.analytics.FirebaseAnalytics

/**
 * lib/track.ts — the same four funnel events the website sends to Vercel
 * Analytics, here through Firebase Analytics on the same Firebase project:
 * `signup` / `login` (method: email|google), `plan_built` and
 * `plan_committed` (week). Counts only: never emails, names or message text.
 *
 * Advertising-ID collection is switched off in the manifest, so the only
 * identifier is Firebase's own per-install id.
 */
object Analytics {
    private const val TAG = "Analytics"

    fun track(context: Context, event: String, vararg params: Pair<String, Any>) {
        if (!Push.configured) return   // no Firebase values in this build → nothing to send to
        runCatching {
            val bundle = Bundle()
            for ((k, v) in params) when (v) {
                is Int -> bundle.putInt(k, v)
                is Long -> bundle.putLong(k, v)
                is Double -> bundle.putDouble(k, v)
                else -> bundle.putString(k, v.toString())
            }
            FirebaseAnalytics.getInstance(context.applicationContext).logEvent(event, bundle)
        }.onFailure { Log.w(TAG, "event $event dropped: ${it.message}") }
    }
}
