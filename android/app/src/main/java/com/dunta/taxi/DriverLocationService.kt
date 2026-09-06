package com.dunta.taxi

import android.app.*
import android.content.*
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class DriverLocationService: Service() {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.IO); private lateinit var fused:FusedLocationProviderClient; private var lastLat=0.0; private var lastLng=0.0; private var lastRide=""; private var tokenCheckedAt=0L
    private val cb=object:LocationCallback(){override fun onLocationResult(r:LocationResult){r.lastLocation?.let{lastLat=it.latitude;lastLng=it.longitude;scope.launch{publish(it.latitude,it.longitude)}}}}
    override fun onCreate(){super.onCreate();fused=LocationServices.getFusedLocationProviderClient(this);createChannel();startForeground(91,notification("DUNTA TAXI está online"));startLocation();scope.launch{while(isActive){checkRides();delay(8000)}}}
    private fun startLocation(){val req=LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY,10000).setMinUpdateIntervalMillis(5000).setMinUpdateDistanceMeters(10f).build();try{fused.requestLocationUpdates(req,cb,Looper.getMainLooper())}catch(_:SecurityException){}}
    private fun publish(lat:Double,lng:Double)=scope.launch{refreshTokenIfNeeded();val p=getSharedPreferences("dunta",0);val token=p.getString("access_token","")?:return@launch;val url="https://keonvsakkkzxnxxduacz.supabase.co/rest/v1/drivers_locations?on_conflict=driver_id";val body=JSONObject().apply{put("driver_id",p.getString("user_id",""));put("driver_name",p.getString("name","Motorista"));put("phone",p.getString("phone",""));put("vehicle_type",p.getString("vehicle","taxi"));put("latitude",lat);put("longitude",lng);put("is_online",true);put("updated_at",java.time.Instant.now().toString())};request(url,"POST",token,body.toString(),"resolution=merge-duplicates,return=minimal")}
    private suspend fun checkRides(){refreshTokenIfNeeded();val p=getSharedPreferences("dunta",0);val token=p.getString("access_token","")?:return;val id=p.getString("user_id","")?:return;val vehicle=p.getString("vehicle","taxi")?:"taxi";val u="https://keonvsakkkzxnxxduacz.supabase.co/rest/v1/ride_requests?status=eq.pending&select=id,passenger_name,destination,vehicle_type,passenger_lat,passenger_lng&order=created_at.desc&limit=10";val out=request(u,"GET",token,null,null)?:return;try{val arr=org.json.JSONArray(out);for(i in 0 until arr.length()){val r=arr.getJSONObject(i);val t=r.optString("vehicle_type","any");if(t!="any"&&t!=vehicle)continue;val rid=r.optString("id");if(rid.isBlank()||rid==lastRide)continue;val lat=r.optDouble("passenger_lat",Double.NaN);val lng=r.optDouble("passenger_lng",Double.NaN);if(!lat.isFinite()||!lng.isFinite())continue;if(lastLat!=0.0&&distance(lastLat,lastLng,lat,lng)>15)continue;lastRide=rid;notifyRide(r.optString("passenger_name","Passageiro"),r.optString("destination","Destino"));break}}catch(_:Exception){}}
    private suspend fun refreshTokenIfNeeded(){
        val now=System.currentTimeMillis(); if(now-tokenCheckedAt<40*60*1000L)return
        val p=getSharedPreferences("dunta",0); val refresh=p.getString("refresh_token","")?:return
        if(refresh.isBlank())return
        val body=JSONObject().put("refresh_token",refresh).toString()
        val out=request("https://keonvsakkkzxnxxduacz.supabase.co/auth/v1/token?grant_type=refresh_token","POST",ANON,body,null) ?: return
        try{val o=JSONObject(out);val access=o.optString("access_token");val rt=o.optString("refresh_token",refresh);if(access.isNotBlank()){p.edit().putString("access_token",access).putString("refresh_token",rt).apply();tokenCheckedAt=now}}catch(_:Exception){}
    }
    private fun request(url:String,method:String,token:String,body:String?,prefer:String?):String?{return try{val c=URL(url).openConnection() as HttpURLConnection;c.requestMethod=method;c.setRequestProperty("apikey",ANON);c.setRequestProperty("Authorization","Bearer $token");c.setRequestProperty("Content-Type","application/json");if(prefer!=null)c.setRequestProperty("Prefer",prefer);c.doInput=true;if(body!=null){c.doOutput=true;c.outputStream.use{it.write(body.toByteArray())}} val code=c.responseCode;val stream=if(code in 200..299)c.inputStream else c.errorStream;stream?.bufferedReader()?.readText()}catch(_:Exception){null}}
    private fun notifyRide(name:String,dest:String){val n=NotificationCompat.Builder(this,"rides").setSmallIcon(android.R.drawable.ic_dialog_map).setContentTitle("Novo pedido DUNTA").setContentText("$name → $dest").setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).build();(getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(7001,n)}
    private fun notification(text:String)=NotificationCompat.Builder(this,"location").setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("DUNTA TAXI").setContentText(text).setOngoing(true).setPriority(NotificationCompat.PRIORITY_LOW).build()
    private fun createChannel(){val m=getSystemService(NOTIFICATION_SERVICE) as NotificationManager;m.createNotificationChannel(NotificationChannel("location","Localização do motorista",NotificationManager.IMPORTANCE_LOW));m.createNotificationChannel(NotificationChannel("rides","Pedidos de corrida",NotificationManager.IMPORTANCE_HIGH))}
    private fun distance(a:Double,b:Double,c:Double,d:Double):Double{val R=6371000.0;val x=Math.toRadians(c-a);val y=Math.toRadians(d-b);val h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(Math.toRadians(a))*Math.cos(Math.toRadians(c))*Math.sin(y/2)*Math.sin(y/2);return 2*R*Math.asin(Math.sqrt(h))}
    override fun onDestroy(){scope.cancel();try{fused.removeLocationUpdates(cb)}catch(_:Exception){};super.onDestroy()}
    override fun onBind(i:Intent?):IBinder?=null
    companion object { const val ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlb252c2Fra2t6eG54eGR1YWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MDUxODQsImV4cCI6MjEwNDE4MTE4NH0.cgiVTH4txAUPwpQozH7AmGergXHIPGpPEFKHU2LBMHg" }
}
