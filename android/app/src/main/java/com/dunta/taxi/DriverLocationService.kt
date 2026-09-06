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

class DriverLocationService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fused: FusedLocationProviderClient
    private var lastLat = 0.0
    private var lastLng = 0.0
    private var lastRide = ""
    private var tokenCheckedAt = 0L

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.lastLocation?.let { location ->
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
                delay(8000)
            }
        }
    }

    private fun startLocation() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10000L)
            .setMinUpdateIntervalMillis(5000L)
            .setMinUpdateDistanceMeters(10f)
            .build()
        try {
            fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
        } catch (_: SecurityException) {
        }
    }

    private fun publish(lat: Double, lng: Double) = scope.launch {
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
            put("vehicle_type", preferences.getString("vehicle", "taxi"))
            put("latitude", lat)
            put("longitude", lng)
            put("is_online", true)
            put("updated_at", java.time.Instant.now().toString())
        }
        request(url, "POST", token, body.toString(), "resolution=merge-duplicates,return=minimal")
    }

    private suspend fun checkRides() {
        refreshTokenIfNeeded()
        val preferences = getSharedPreferences("dunta", 0)
        val token = preferences.getString("access_token", "") ?: return
        val vehicle = preferences.getString("vehicle", "taxi") ?: "taxi"
        if (token.isBlank()) return
        val url = "https://keonvsakkkzxnxxduacz.supabase.co/rest/v1/ride_requests" +
            "?status=eq.pending&select=id,passenger_name,destination,vehicle_type,passenger_lat,passenger_lng" +
            "&order=created_at.desc&limit=10"
        val output = request(url, "GET", token, null, null) ?: return
        try {
            val rides = JSONArray(output)
            for (index in 0 until rides.length()) {
                val ride = rides.getJSONObject(index)
                val requestedVehicle = ride.optString("vehicle_type", "any")
                if (requestedVehicle != "any" && requestedVehicle != vehicle) continue
                val rideId = ride.optString("id")
                if (rideId.isBlank() || rideId == lastRide) continue
                val passengerLat = ride.optDouble("passenger_lat", Double.NaN)
                val passengerLng = ride.optDouble("passenger_lng", Double.NaN)
                if (!passengerLat.isFinite() || !passengerLng.isFinite()) continue
                if (lastLat != 0.0 && distance(lastLat, lastLng, passengerLat, passengerLng) > 15.0) continue
                lastRide = rideId
                notifyRide(ride.optString("passenger_name", "Passageiro"), ride.optString("destination", "Destino"))
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

    private fun notifyRide(name: String, destination: String) {
        val notification = NotificationCompat.Builder(this, "rides")
            .setSmallIcon(android.R.drawable.ic_dialog_map)
            .setContentTitle("Novo pedido DUNTA")
            .setContentText("$name → $destination")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(7001, notification)
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

    private fun distance(a: Double, b: Double, c: Double, d: Double): Double {
        val radius = 6371000.0
        val x = Math.toRadians(c - a)
        val y = Math.toRadians(d - b)
        val h = Math.sin(x / 2) * Math.sin(x / 2) + Math.cos(Math.toRadians(a)) * Math.cos(Math.toRadians(c)) * Math.sin(y / 2) * Math.sin(y / 2)
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
