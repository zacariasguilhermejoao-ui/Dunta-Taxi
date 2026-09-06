package com.dunta.taxi

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
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
            }
            addJavascriptInterface(NativeBridge(), "DuntaNative")
        }

        setContentView(web)

        // O botão/gesto Voltar do Android nunca deve fechar a DUNTA TAXI nem
        // navegar pelo histórico do WebView. A navegação interna da interface
        // é controlada pelo próprio HTML; o evento do sistema é consumido aqui.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                web.evaluateJavascript(
                    """(function(){try{if(typeof window.duntaHandleBack==='function'){window.duntaHandleBack();}}catch(e){}})();""",
                    null
                )
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
                  style.textContent='html,body{width:100%!important;max-width:100%!important;overflow-x:hidden!important;overscroll-behavior-x:none!important}body{position:relative!important}#auth,#app,#dunta-splash{width:100%!important;max-width:100%!important;overflow-x:hidden!important}.dunta-studio-logo{display:block!important;width:min(110px,28vw)!important;height:auto!important;max-width:110px!important;max-height:58px!important;object-fit:contain!important;margin:14px auto!important}';
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
                      window.routeLine=L.polyline(coords.map(function(x){return [x[1],x[0]]}),{color:'#16A34A',weight:5,opacity:.9,dashArray:'10 8'}).addTo(window.duntaMap);
                      window.duntaMap.fitBounds(window.routeLine.getBounds(),{padding:[45,45]});
                      var km=(j.routes[0].distance||0)/1000,mins=Math.max(1,Math.round((j.routes[0].duration||0)/60)),eta=document.getElementById('eta');
                      if(eta){eta.style.display='block';eta.innerHTML='~'+mins+' min<small>'+km.toFixed(1)+' km até ao destino</small>'}
                    }catch(e){try{if(typeof toast==='function')toast('Não foi possível calcular a rota pelas estradas agora')}catch(x){}}
                  };
                }
              }catch(e){}
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
