package com.dunta.taxi

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

class DriverLocationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fused: FusedLocationProviderClient
    private var lastLat = 0.0
    private var lastLng = 0.0
    private var tokenCheckedAt = 0L
    private val notifiedRideIds = mutableSetOf<String>()

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { location ->
                if (!validCoord(location.latitude, location.longitude)) return
                lastLat = location.latitude
                lastLng = location.longitude
                scope.launch { publish(location.latitude, location.longitude) }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannels()
        startForeground(91, notification("DUNTA TAXI está online"))
        startLocation()
        scope.launch {
            while (isActive) {
                checkRides()
                delay(10000)
            }
        }
    }

    private fun validCoord(lat: Double, lng: Double): Boolean {
        if (!lat.isFinite() || !lng.isFinite()) return false
        if (lat == 0.0 && lng == 0.0) return false
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
        return true
    }

    private fun startLocation() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L)
            .setMinUpdateIntervalMillis(3000L)
            .setMinUpdateDistanceMeters(5f)
            .build()
        try {
            fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
        } catch (_: SecurityException) {
        }
    }

    private fun publish(lat: Double, lng: Double) = scope.launch {
        if (!validCoord(lat, lng)) return@launch
        refreshTokenIfNeeded()
        val preferences = getSharedPreferences("dunta", 0)
        val token = preferences.getString("access_token", "") ?: return@launch
        val driverId = preferences.getString("user_id", "") ?: return@launch
        if (token.isBlank() || driverId.isBlank()) return@launch
        val url = "https://keonvsakkkzxnxxduacz.supabase.co/rest/v1/drivers_locations?on_conflict=driver_id"
        val body = JSONObject().apply {
            put("driver_id", driverId)
            put("driver_name", preferences.getString("name", "Motorista"))
            put("phone", preferences.getString("phone", ""))
            put("vehicle_type", normalizeVehicle(preferences.getString("vehicle", "taxi")))
            put("latitude", lat)
            put("longitude", lng)
            put("is_online", true)
            put("updated_at", Instant.now().toString())
        }
        request(url, "POST", token, body.toString(), "resolution=merge-duplicates,return=minimal")
    }

    private fun normalizeVehicle(v: String?): String {
        val x = (v ?: "taxi").lowercase().trim()
        return when {
            x.contains("mota") || x.contains("moto") -> "mota"
            else -> "taxi"
        }
    }

    private suspend fun checkRides() {
        refreshTokenIfNeeded()
        val preferences = getSharedPreferences("dunta", 0)
        val token = preferences.getString("access_token", "") ?: return
        val vehicle = normalizeVehicle(preferences.getString("vehicle", "taxi"))
        val active = preferences.getString("active_ride_id", "")
        if (!active.isNullOrBlank()) return
        if (token.isBlank()) return

        val since = Instant.now().minusSeconds(120).toString()
        val url = "https://keonvsakkkzxnxxduacz.supabase.co/rest/v1/ride_requests" +
            "?status=eq.pending&created_at=gte.$since" +
            "&select=id,passenger_name,destination,vehicle_type,passenger_lat,passenger_lng,created_at" +
            "&order=created_at.desc&limit=5"
        val output = request(url, "GET", token, null, null) ?: return
        try {
            val rides = JSONArray(output)
            for (index in 0 until rides.length()) {
                val ride = rides.getJSONObject(index)
                val rideId = ride.optString("id")
                if (rideId.isBlank() || notifiedRideIds.contains(rideId)) continue

                val reqRaw = ride.optString("vehicle_type", "any").lowercase()
                val requestedVehicle = normalizeVehicle(reqRaw)
                if (reqRaw != "any" && reqRaw.isNotBlank() && requestedVehicle != vehicle) continue

                val passengerLat = ride.optDouble("passenger_lat", Double.NaN)
                val passengerLng = ride.optDouble("passenger_lng", Double.NaN)
                if (!validCoord(passengerLat, passengerLng)) continue
                if (lastLat != 0.0 && distanceKm(lastLat, lastLng, passengerLat, passengerLng) > 15.0) continue

                val created = ride.optString("created_at", "")
                if (created.isNotBlank()) {
                    try {
                        val ageSec = Instant.now().epochSecond - Instant.parse(created).epochSecond
                        if (ageSec > 120) continue
                    } catch (_: Exception) {}
                }

                notifiedRideIds.add(rideId)
                if (notifiedRideIds.size > 40) {
                    val trim = notifiedRideIds.toList().takeLast(20)
                    notifiedRideIds.clear()
                    notifiedRideIds.addAll(trim)
                }
                notifyRide(ride.optString("passenger_name", "Passageiro"), ride.optString("destination", "Destino"), rideId)
                break
            }
        } catch (_: Exception) {
        }
    }

    private suspend fun refreshTokenIfNeeded() {
        val now = System.currentTimeMillis()
        if (now - tokenCheckedAt < 40 * 60 * 1000L) return
        val preferences = getSharedPreferences("dunta", 0)
        val refreshToken = preferences.getString("refresh_token", "") ?: return
        if (refreshToken.isBlank()) return
        val body = JSONObject().put("refresh_token", refreshToken).toString()
        val output = request("https://keonvsakkkzxnxxduacz.supabase.co/auth/v1/token?grant_type=refresh_token", "POST", ANON, body, null) ?: return
        try {
            val json = JSONObject(output)
            val accessToken = json.optString("access_token")
            val newRefreshToken = json.optString("refresh_token", refreshToken)
            if (accessToken.isNotBlank()) {
                preferences.edit().putString("access_token", accessToken).putString("refresh_token", newRefreshToken).apply()
                tokenCheckedAt = now
            }
        } catch (_: Exception) {
        }
    }

    private fun request(url: String, method: String, token: String, body: String?, prefer: String?): String? {
        return try {
            val connection = URL(url).openConnection() as HttpURLConnection
            connection.requestMethod = method
            connection.setRequestProperty("apikey", ANON)
            connection.setRequestProperty("Authorization", "Bearer $token")
            connection.setRequestProperty("Content-Type", "application/json")
            if (prefer != null) connection.setRequestProperty("Prefer", prefer)
            connection.doInput = true
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { output -> output.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val responseCode = connection.responseCode
            val stream = if (responseCode in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }
            connection.disconnect()
            response
        } catch (_: Exception) {
            null
        }
    }

    private fun notifyRide(name: String, destination: String, rideId: String) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("ride_id", rideId)
            putExtra("notification_type", "rides")
            putExtra("from_notification", true)
        }
        val pending = android.app.PendingIntent.getActivity(
            this, rideId.hashCode(), intent,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, "rides")
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle("Novo pedido DUNTA")
            .setContentText("$name → $destination")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(pending)
            .build()
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify("dunta_ride", rideId.hashCode(), notification)
    }

    private fun notification(text: String) = NotificationCompat.Builder(this, "location")
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setContentTitle("DUNTA TAXI")
        .setContentText(text)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()

    private fun createNotificationChannels() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(NotificationChannel("location", "Localização do motorista", NotificationManager.IMPORTANCE_LOW))
        manager.createNotificationChannel(NotificationChannel("rides", "Pedidos de corrida", NotificationManager.IMPORTANCE_HIGH))
    }

    private fun distanceKm(aLat: Double, aLng: Double, bLat: Double, bLng: Double): Double {
        val radius = 6371.0
        val x = Math.toRadians(bLat - aLat)
        val y = Math.toRadians(bLng - aLng)
        val h = Math.sin(x / 2) * Math.sin(x / 2) +
            Math.cos(Math.toRadians(aLat)) * Math.cos(Math.toRadians(bLat)) *
            Math.sin(y / 2) * Math.sin(y / 2)
        return 2 * radius * Math.asin(Math.sqrt(h))
    }

    override fun onDestroy() {
        scope.cancel()
        try { fused.removeLocationUpdates(callback) } catch (_: Exception) { }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlb252c2Fra2t6eG54eGR1YWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUxODQsImV4cCI6MjEwNDE4MTE4NH0.cgiVTH4txAUPwpQozH7AmGergXHIPGpPEFKHU2LBMHg"
    }
}
