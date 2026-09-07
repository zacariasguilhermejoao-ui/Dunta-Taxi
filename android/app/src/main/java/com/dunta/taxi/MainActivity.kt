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
        val assetLoader = WebViewAssetLoader.Builder().addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this)).build()
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
                    } else if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) perms.add(Manifest.permission.READ_EXTERNAL_STORAGE)
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
        val js = """
            (function(){
              try{
                if(!document.getElementById('dunta-native-fixes')){
                  var style=document.createElement('style');style.id='dunta-native-fixes';
                  style.textContent='html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important;overscroll-behavior-x:none!important}body{position:relative!important;background:#0B0F0D!important}#auth,#app,#dunta-splash{width:100%!important;max-width:100%!important;overflow-x:hidden!important}';
                  document.head.appendChild(style);
                }
              }catch(e){}
              try{
                if(!window.__duntaNativeEnterWrapped && typeof window.enterApp==='function'){
                  window.__duntaNativeEnterWrapped=true;
                  window.enterApp=function(){
                    try{document.getElementById('auth').classList.add('hidden');document.getElementById('app').classList.remove('hidden');if(typeof refreshAccount==='function')refreshAccount()}catch(e){}
                    setTimeout(function(){try{if(typeof initMap==='function')initMap()}catch(e){};try{if(typeof initSupabase==='function')initSupabase()}catch(e){}},150);
                  };
                }
              }catch(e){}
              try{
                if(!window.__duntaRouteWrapped && typeof window.drawDestinationRoute==='function'){
                  window.__duntaRouteWrapped=true;
                  window.drawDestinationRoute=async function(){
                    if(!window.duntaMap||!window.duntaMe||!window.duntaDestinationCoords)return;
                    var p=window.duntaMe.getLatLng(),d=window.duntaDestinationCoords;
                    try{if(typeof setDestinationOnMap==='function')setDestinationOnMap(d.lat,d.lng,window.pendingDestination||'Destino')}catch(e){}
                    try{if(window.routeLine)window.duntaMap.removeLayer(window.routeLine)}catch(e){}
                    try{
                      var u='https://router.project-osrm.org/route/v1/driving/'+p.lng+','+p.lat+';'+d.lng+','+d.lat+'?overview=full&geometries=geojson';
                      var r=await fetch(u);if(!r.ok)throw new Error('route');
                      var j=await r.json(),coords=j.routes&&j.routes[0]&&j.routes[0].geometry&&j.routes[0].geometry.coordinates;if(!coords||!coords.length)throw new Error('route');
                      window.routeLine=L.polyline(coords.map(function(x){return [x[1],x[0]]}),{color:'#16A34A',weight:5,opacity:.9}).addTo(window.duntaMap);
                      window.duntaMap.fitBounds(window.routeLine.getBounds(),{padding:[45,45]});
                      var km=(j.routes[0].distance||0)/1000,mins=Math.max(1,Math.round((j.routes[0].duration||0)/60)),eta=document.getElementById('eta');
                      if(eta){eta.style.display='block';eta.innerHTML='~'+mins+' min<small>'+km.toFixed(1)+' km pelas estradas</small>'}
                    }catch(e){try{if(typeof toast==='function')toast('Não foi possível calcular a rota pelas estradas agora')}catch(x){}}
                  };
                }
              }catch(e){}
              try{window.DUNTA_DRIVER_RADIUS_KM=15;if(typeof DUNTA_DRIVER_RADIUS_KM!=='undefined')DUNTA_DRIVER_RADIUS_KM=15;
              if(!window.__duntaReqFixed&&typeof subscribeRideRequests==='function'){window.__duntaReqFixed=1;window.subscribeRideRequests=function(){var s=getSession&&getSession();if(!s||s.role!=='driver'||!duntaSupabase)return;duntaSupabase.channel('req-f').on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_requests'},function(p){var r=p.new;if(!r||r.status!=='pending')return;if(r.vehicle_type!=='any'&&r.vehicle_type!==(s.vehicle||'taxi'))return;if(Date.now()-new Date(r.created_at||0).getTime()>18e4)return;if(duntaMe&&distanceKm(duntaMe.getLatLng().lat,duntaMe.getLatLng().lng,+r.passenger_lat,+r.passenger_lng)>15)return;showDriverRequest&&showDriverRequest(r)}).subscribe()};try{subscribeRideRequests()}catch(e){}}
              if(!window.__duntaLiveFixed&&typeof startDriverSync==='function'){window.__duntaLiveFixed=1;window.startDriverSync=function(){if(duntaLocationTimer)clearInterval(duntaLocationTimer);duntaLocationTimer=setInterval(function(){publishDriverLocation&&publishDriverLocation()},5e3);publishDriverLocation&&publishDriverLocation()}}
              if(typeof drawDestinationRoute==='function'&&typeof drawFakeRoute==='function')drawFakeRoute=function(){return drawDestinationRoute()}}catch(e){}
              try{
                if(!window.__duntaBootSplash){
                  window.__duntaBootSplash=true;
                  setTimeout(function(){
                    var has=!!localStorage.getItem('dunta_session');
                    if(typeof showDuntaSplash==='function')showDuntaSplash(function(){if(has&&typeof enterApp==='function')enterApp();else if(typeof showAuth==='function')showAuth('start')});
                  },80);
                }
              }catch(e){}
            })();
        """.trimIndent()
        view.evaluateJavascript(js, null)
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
