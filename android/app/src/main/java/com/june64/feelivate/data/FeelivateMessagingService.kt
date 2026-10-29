package com.june64.feelivate.data

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.june64.feelivate.MainActivity
import com.june64.feelivate.R

/**
 * Receives the pushes the scheduler sends alongside its emails. The backend
 * always sends a `notification` block, so Android draws the alert itself when
 * the app is in the background; this service handles the foreground case and
 * the token rotations.
 */
class FeelivateMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        Push.sendToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val n = message.notification
        val title = n?.title ?: message.data["title"] ?: return
        val body = n?.body ?: message.data["body"].orEmpty()
        val channel = n?.channelId ?: message.data["channel"] ?: "feelivate_default"
        val view = message.data["view"]

        Push.start(applicationContext)

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (view != null) putExtra("open", view)
        }
        val pending = PendingIntent.getActivity(
            this, view?.hashCode() ?: 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val built = NotificationCompat.Builder(this, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(channel.hashCode(), built)
    }
}
