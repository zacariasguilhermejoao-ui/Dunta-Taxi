package com.dunta.taxi

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.content.edit
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import com.google.firebase.messaging.FirebaseMessaging
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var cameraImageUri: Uri? = null
    private var cameraImageFile: File? = null

    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
        if (result[Manifest.permission.ACCESS_FINE_LOCATION] == true || result[Manifest.permission.ACCESS_COARSE_LOCATION] == true) {
            ContextCompat.startForegroundService(this, Intent(this, DriverLocationService::class.java))
        }
    }

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val callback = filePathCallback
        filePathCallback = null
        if (callback == null) return@registerForActivityResult
        try {
            val uris: Array<Uri>? = when {
                result.resultCode != Activity.RESULT_OK -> null
                result.data?.clipData != null -> {
                    val clip = result.data!!.clipData!!
                    Array(clip.itemCount) { i -> makeReadableUri(clip.getItemAt(i).uri) }
                }
                result.data?.data != null -> arrayOf(makeReadableUri(result.data!!.data!!))
                cameraImageUri != null && cameraImageFile != null && cameraImageFile!!.exists() && cameraImageFile!!.length() > 0 -> arrayOf(Uri.fromFile(cameraImageFile))
                cameraImageUri != null -> arrayOf(makeReadableUri(cameraImageUri!!))
                else -> null
            }
            callback.onReceiveValue(uris)
        } catch (e: Exception) {
            e.printStackTrace()
            callback.onReceiveValue(null)
        }
        cameraImageUri = null
        cameraImageFile = null
    }

    private fun makeReadableUri(uri: Uri): Uri {
        return try {
            if (uri.scheme == "file") return uri
            val input = contentResolver.openInputStream(uri) ?: return uri
            val ext = when {
                uri.toString().contains("video") || (contentResolver.getType(uri) ?: "").startsWith("video") -> ".mp4"
                else -> ".jpg"
            }
            val outFile = File(cacheDir, "dunta_upload_${System.currentTimeMillis()}$ext")
            FileOutputStream(outFile).use { output -> input.copyTo(output) }
            input.close()
            Uri.fromFile(outFile)
        } catch (e: Exception) {
            e.printStackTrace()
            uri
        }
    }

    private val mediaPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        window.setBackgroundDrawableResource(com.dunta.taxi.R.drawable.dunta_splash)
        if (Build.VERSION.SDK_INT >= 23) {
            window.statusBarColor = Color.rgb(11, 15, 13)
            window.navigationBarColor = Color.rgb(11, 15, 13)
            window.decorView.systemUiVisibility = 0
        }
        super.onCreate(savedInstanceState)
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web = WebView(this).apply {
            setBackgroundColor(Color.TRANSPARENT)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.setGeolocationEnabled(true)
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            @Suppress("DEPRECATION")
            settings.allowFileAccessFromFileURLs = true
            @Suppress("DEPRECATION")
            settings.allowUniversalAccessFromFileURLs = true
            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false
            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url) ?: super.shouldInterceptRequest(view, request)
                }
                override fun onPageFinished(view: WebView, url: String?) {
                    super.onPageFinished(view, url)
                    injectDuntaFixes(view)
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                    if (hasLocationPermission()) callback?.invoke(origin, true, false)
                    else requestLocationAndNotifications()
                }
                override fun onPermissionRequest(request: PermissionRequest?) {
                    if (request == null) return
                    val resources = request.resources
                    val needed = mutableListOf<String>()
                    if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.CAMERA)
                    if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) needed.add(Manifest.permission.RECORD_AUDIO)
                    if (needed.isNotEmpty()) mediaPermissions.launch(needed.toTypedArray())
                    request.grant(resources)
                }
                override fun onShowFileChooser(webView: WebView?, filePathCallback: ValueCallback<Array<Uri>>?, fileChooserParams: FileChooserParams?): Boolean {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = filePathCallback
                    val perms = mutableListOf<String>()
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.CAMERA)
                    if (Build.VERSION.SDK_INT >= 33) {
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_MEDIA_IMAGES) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_MEDIA_IMAGES)
                        if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_MEDIA_VIDEO) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_MEDIA_VIDEO)
                    } else if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
                    }
                    if (perms.isNotEmpty()) mediaPermissions.launch(perms.toTypedArray())
                    val acceptTypes = fileChooserParams?.acceptTypes ?: arrayOf("*/*")
                    val isImage = acceptTypes.any { it.contains("image") || it == "*/*" || it.isEmpty() }
                    val isVideo = acceptTypes.any { it.contains("video") }
                    val intents = mutableListOf<Intent>()
                    val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = when { isVideo && !isImage -> "video/*"; isImage && !isVideo -> "image/*"; else -> "*/*" }
                        putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                    }
                    intents.add(contentIntent)
                    if (isImage || acceptTypes.isEmpty() || acceptTypes.any { it == "*/*" }) {
                        intents.add(Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply { type = "image/*" })
                        try {
                            val photoFile = File.createTempFile("dunta_cam_", ".jpg", getExternalFilesDir(Environment.DIRECTORY_PICTURES) ?: cacheDir)
                            cameraImageFile = photoFile
                            cameraImageUri = FileProvider.getUriForFile(this@MainActivity, "${packageName}.fileprovider", photoFile)
                            val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                                putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri)
                                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            }
                            cameraImageUri?.let { uri ->
                                packageManager.queryIntentActivities(cameraIntent, PackageManager.MATCH_DEFAULT_ONLY).forEach { resolve ->
                                    grantUriPermission(resolve.activityInfo.packageName, uri, Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                            }
                            intents.add(cameraIntent)
                        } catch (_: Exception) {}
                    }
                    if (isVideo || acceptTypes.isEmpty() || acceptTypes.any { it == "*/*" }) {
                        try { intents.add(Intent(MediaStore.ACTION_VIDEO_CAPTURE).apply { putExtra(MediaStore.EXTRA_DURATION_LIMIT, 60); putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 1) }) } catch (_: Exception) {}
                    }
                    val chooser = Intent(Intent.ACTION_CHOOSER).apply {
                        putExtra(Intent.EXTRA_INTENT, intents.firstOrNull() ?: contentIntent)
                        if (intents.size > 1) putExtra(Intent.EXTRA_INITIAL_INTENTS, intents.drop(1).toTypedArray())
                        putExtra(Intent.EXTRA_TITLE, "Escolher foto / vídeo")
                    }
                    try { fileChooserLauncher.launch(chooser) } catch (e: Exception) {
                        this@MainActivity.filePathCallback?.onReceiveValue(null)
                        this@MainActivity.filePathCallback = null
                        return false
                    }
                    return true
                }
            }
            addJavascriptInterface(NativeBridge(), "DuntaNative")
        }
        setContentView(web)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript("(function(){try{if(typeof window.duntaHandleBack==='function'){window.duntaHandleBack();}}catch(e){}})();", null)
            }
        })
        web.loadUrl("https://appassets.androidplatform.net/assets/index.html")
        requestLocationAndNotifications()
        registerFcmToken()
    }

    private fun injectDuntaFixes(view: WebView) {
        try {
            val code = assets.open("dunta-fixes.js").bufferedReader(Charsets.UTF_8).use { it.readText() }
            view.evaluateJavascript(code, null)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    private fun requestLocationAndNotifications() {
        val p = mutableListOf<String>()
        if (!hasLocationPermission()) {
            p.add(Manifest.permission.ACCESS_FINE_LOCATION)
            p.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            p.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (p.isNotEmpty()) permissions.launch(p.toTypedArray())
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
                    put("user_id", userId);put("token", token);put("platform", "android");put("enabled", true)
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
