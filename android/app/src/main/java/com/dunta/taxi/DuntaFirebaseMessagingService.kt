package com.dunta.taxi

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.RingtoneManager
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
                val body = JSONObject().apply {
                    put("user_id", userId); put("token", token); put("platform", "android"); put("enabled", true)
                }.toString()
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

        val prefs = getSharedPreferences("dunta", 0)
        val active = prefs.getString("active_ride_id", "")
        // Em viagem ativa: não mostrar novos pedidos
        if (type == "rides" && !active.isNullOrBlank()) return
        if (!rideId.isNullOrBlank()) {
            val handled = prefs.getStringSet("handled_ride_ids", emptySet()) ?: emptySet()
            if (handled.contains(rideId)) return
            if (!active.isNullOrBlank() && active == rideId) return
        }

        showNotification(title, body, type, rideId)
    }

    private fun showNotification(title: String, body: String, type: String, rideId: String?) {
        val channelId = if (type == "rides") "rides" else "alerts"
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(
                channelId,
                if (channelId == "rides") "Pedidos de corrida" else "Alertas DUNTA",
                if (channelId == "rides") NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Notificações DUNTA TAXI"
                enableVibration(true)
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }

        val intent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            if (!rideId.isNullOrBlank()) putExtra("ride_id", rideId)
            putExtra("notification_type", type)
            putExtra("from_notification", true)
        }
        val requestCode = (rideId ?: System.currentTimeMillis().toString()).hashCode()
        val pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT or if (Build.VERSION.SDK_INT >= 23) PendingIntent.FLAG_IMMUTABLE else 0
        val pending = PendingIntent.getActivity(this, requestCode, intent, pendingFlags)

        val sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(if (channelId == "rides") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(if (channelId == "rides") NotificationCompat.CATEGORY_MESSAGE else NotificationCompat.CATEGORY_STATUS)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setSound(sound)
            .setVibrate(longArrayOf(0, 400, 200, 400))
            .setContentIntent(pending)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        val notifId = if (!rideId.isNullOrBlank()) rideId.hashCode() else System.currentTimeMillis().toInt()
        manager.notify("dunta_ride", notifId, builder.build())
    }

    companion object {
        fun markRideHandled(context: android.content.Context, rideId: String) {
            if (rideId.isBlank()) return
            val prefs = context.getSharedPreferences("dunta", 0)
            val set = prefs.getStringSet("handled_ride_ids", emptySet())?.toMutableSet() ?: mutableSetOf()
            set.add(rideId)
            val trimmed = set.toList().takeLast(50).toSet()
            prefs.edit().putStringSet("handled_ride_ids", trimmed).putString("active_ride_id", rideId).apply()
            val manager = context.getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            manager.cancel("dunta_ride", rideId.hashCode())
            try { manager.cancelAll() } catch (_: Exception) {}
        }

        fun clearActiveRide(context: android.content.Context) {
            context.getSharedPreferences("dunta", 0).edit().remove("active_ride_id").apply()
        }
    }
}
