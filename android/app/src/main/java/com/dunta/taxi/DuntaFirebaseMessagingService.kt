package com.dunta.taxi

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class DuntaFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        getSharedPreferences("dunta", 0).edit().putString("fcm_token", token).apply()
        uploadToken(token)
    }

    private fun uploadToken(token: String) {
        val p = getSharedPreferences("dunta", 0)
        val access = p.getString("access_token", "") ?: return
        val userId = p.getString("user_id", "") ?: return
        if (access.isBlank() || userId.isBlank() || token.isBlank()) return
        Thread {
            try {
                val c = URL("https://keonvsakkkzxnxxduacz.supabase.co/rest/v1/push_tokens?on_conflict=user_id,token").openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.setRequestProperty("apikey", DriverLocationService.ANON)
                c.setRequestProperty("Authorization", "Bearer $access")
                c.setRequestProperty("Content-Type", "application/json")
                c.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
                c.doOutput = true
                val body = JSONObject().apply { put("user_id", userId); put("token", token); put("platform", "android"); put("enabled", true) }.toString()
                c.outputStream.use { it.write(body.toByteArray()) }
                c.responseCode
                c.disconnect()
            } catch (_: Exception) {}
        }.start()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: "DUNTA TAXI"
        val body = data["body"] ?: message.notification?.body ?: "Tem uma nova atualização."
        val type = data["type"] ?: "alerts"
        val rideId = data["ride_id"]
        showNotification(title, body, type, rideId)
    }

    private fun showNotification(title: String, body: String, type: String, rideId: String?) {
        val channelId = if (type == "rides") "rides" else "alerts"
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val importance = if (channelId == "rides") NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
            manager.createNotificationChannel(NotificationChannel(channelId, if (channelId == "rides") "Pedidos de corrida" else "Alertas DUNTA", importance))
        }
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            if (!rideId.isNullOrBlank()) putExtra("ride_id", rideId)
            putExtra("notification_type", type)
        }
        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
        val pending = PendingIntent.getActivity(this, (rideId ?: System.currentTimeMillis().toString()).hashCode(), intent, pendingFlags)
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(if (channelId == "rides") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        manager.notify((rideId ?: System.currentTimeMillis().toString()).hashCode(), notification)
    }
}
