package com.dunta.taxi

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import com.google.firebase.messaging.FirebaseMessaging
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView

    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true || result[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            ContextCompat.startForegroundService(this, Intent(this, DriverLocationService::class.java))
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setGeolocationEnabled(true)
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url) ?: super.shouldInterceptRequest(view, request)
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                    if (hasLocationPermission()) {
                        callback?.invoke(origin, true, false)
                    } else {
                        requestLocationAndNotifications()
                    }
                }
            }
            addJavascriptInterface(NativeBridge(), "DuntaNative")
        }

        setContentView(web)
        // Local app content: available without mobile data/Wi-Fi.
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        requestLocationAndNotifications()
        registerFcmToken()
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun requestLocationAndNotifications() {
        val fineGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (fineGranted) return
        val p = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        if (Build.VERSION.SDK_INT >= 33) p.add(Manifest.permission.POST_NOTIFICATIONS)
        permissions.launch(p.toTypedArray())
    }

    private fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            getSharedPreferences("dunta", 0).edit().putString("fcm_token", token).apply()
            uploadFcmToken(token)
        }
    }

    private fun uploadFcmToken(token: String) {
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
                    put("user_id", userId)
                    put("token", token)
                    put("platform", "android")
                    put("enabled", true)
                }.toString()
                c.outputStream.use { it.write(body.toByteArray()) }
                c.responseCode
                c.disconnect()
            } catch (_: Exception) {}
        }.start()
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun setDriverSession(json: String) {
            try {
                val o = JSONObject(json)
                getSharedPreferences("dunta", 0).edit {
                    putString("access_token", o.optString("access_token"))
                    putString("refresh_token", o.optString("refresh_token"))
                    putString("user_id", o.optString("user_id"))
                    putString("name", o.optString("name"))
                    putString("phone", o.optString("phone"))
                    putString("vehicle", o.optString("vehicle"))
                }
                registerFcmToken()
            } catch (_: Exception) {}
        }

        @JavascriptInterface
        fun startDriverService() {
            requestLocationAndNotifications()
            ContextCompat.startForegroundService(this@MainActivity, Intent(this@MainActivity, DriverLocationService::class.java))
        }

        @JavascriptInterface
        fun stopDriverService() {
            stopService(Intent(this@MainActivity, DriverLocationService::class.java))
        }
    }
}
