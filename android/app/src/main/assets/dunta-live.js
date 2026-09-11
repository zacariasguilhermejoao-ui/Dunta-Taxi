(function(){
try{if(window.__duntaLiveLoaded)return;window.__duntaLiveLoaded=1;}catch(e){}

window.DUNTA_DRIVER_RADIUS_KM=15;
try{if(typeof DUNTA_DRIVER_RADIUS_KM!=='undefined')DUNTA_DRIVER_RADIUS_KM=15;}catch(e){}

function normVehicle(v){
  var x=String(v||'').toLowerCase().trim();
  if(!x||x==='any')return 'any';
  if(x.indexOf('mota')>=0||x.indexOf('moto')>=0)return 'mota';
  return 'taxi';
}
function validCoords(lat,lng){
  lat=+lat;lng=+lng;
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
  if(lat===0&&lng===0)return false;
  if(Math.abs(lat)>90||Math.abs(lng)>180)return false;
  return true;
}
function myLatLng(){
  try{
    if(window.duntaMe){var p=duntaMe.getLatLng();if(validCoords(p.lat,p.lng))return {lat:p.lat,lng:p.lng};}
    if(window.duntaPassengerLocation&&validCoords(duntaPassengerLocation.lat,duntaPassengerLocation.lng))
      return {lat:+duntaPassengerLocation.lat,lng:+duntaPassengerLocation.lng};
  }catch(e){}
  return null;
}
function distKm(a,b,c,d){
  try{if(typeof distanceKm==='function')return distanceKm(a,b,c,d);}catch(e){}
  var R=6371,to=Math.PI/180;
  var dLat=(c-a)*to,dLng=(d-b)*to;
  var x=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(a*to)*Math.cos(c*to)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

try{
  if(!document.getElementById('dunta-live-css')){
    var s=document.createElement('style');s.id='dunta-live-css';
    s.textContent=[
      '.driver-fa-marker{width:40px;height:40px;border-radius:50%;background:#C10F06;border:3px solid #fff;display:grid;place-items:center;box-shadow:0 2px 10px rgba(0,0,0,.35)}',
      '.driver-fa-marker i{color:#FFD400;font-size:16px}',
      '.driver-fa-marker.mota{background:#7C3AED}',
      '.driver-fa-marker.mota i{color:#fff}',
      '.driver-live-pulse{animation:duntaPulse 1.6s ease-out infinite}',
      '@keyframes duntaPulse{0%{box-shadow:0 0 0 0 rgba(193,15,6,.45)}70%{box-shadow:0 0 0 12px rgba(193,15,6,0)}100%{box-shadow:0 0 0 0 rgba(193,15,6,0)}}'
    ].join('');
    document.head.appendChild(s);
  }
}catch(e){}

window.driverIcon=function(type){
  var t=normVehicle(type);
  var isMota=t==='mota';
  return L.divIcon({
    className:'',
    html:'<div class="driver-fa-marker '+(isMota?'mota':'')+' driver-live-pulse"><i class="fa-solid '+(isMota?'fa-motorcycle':'fa-taxi')+'"></i></div>',
    iconSize:[42,42],
    iconAnchor:[21,21]
  });
};

if(typeof smoothMoveMarker!=='function'){
  window.smoothMoveMarker=function(marker,target){
    try{
      var start=marker.getLatLng(),startT=performance.now(),duration=800;
      function step(now){
        var t=Math.min(1,(now-startT)/duration),e=t*(2-t);
        marker.setLatLng([start.lat+(target[0]-start.lat)*e,start.lng+(target[1]-start.lng)*e]);
        if(t<1)requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }catch(e){try{marker.setLatLng(target)}catch(x){}}
  };
}

if(!window.duntaDrivers)window.duntaDrivers=new Map();

function putDriverOnMap(id,name,type,lat,lng,avatar,phone,updatedAt){
  if(!window.duntaMap||!validCoords(lat,lng))return;
  var me=myLatLng();
  if(me){
    var d=distKm(me.lat,me.lng,+lat,+lng);
    if(d>15){
      try{if(typeof clearDriver==='function')clearDriver(id);else if(duntaDrivers.has(id)){duntaMap.removeLayer(duntaDrivers.get(id));duntaDrivers.delete(id)}}catch(e){}
      return;
    }
  }
  if(typeof addDriver==='function'){
    addDriver(id,name,normVehicle(type),+lat,+lng,avatar,phone,updatedAt||Date.now());
    return;
  }
  try{
    var existing=duntaDrivers.get(id);
    if(existing){
      smoothMoveMarker(existing,[+lat,+lng]);
      try{existing.setIcon(driverIcon(type))}catch(e){}
      return;
    }
    var m=L.marker([+lat,+lng],{icon:driverIcon(type)}).addTo(duntaMap);
    m.bindPopup('<b>'+(name||'Motorista')+'</b><br>'+(normVehicle(type)==='mota'?'Mototáxi':'Táxi'));
    duntaDrivers.set(id,m);
  }catch(e){console.error(e)}
}

window.loadNearbyDrivers=async function(){
  if(!window.duntaSupabase)return;
  if(!window.duntaMap){
    try{if(typeof initMap==='function')initMap()}catch(e){}
    if(!window.duntaMap)return;
  }
  try{
    var res=await duntaSupabase.from('drivers_locations')
      .select('id,driver_id,driver_name,vehicle_type,avatar_url,phone,latitude,longitude,is_online,updated_at')
      .eq('is_online',true);
    var data=res.data||[];
    var active=new Set();
    var now=Date.now();
    var s=null;try{s=getSession&&getSession()}catch(e){}
    data.forEach(function(d){
      var lat=+d.latitude,lng=+d.longitude;
      if(!validCoords(lat,lng))return;
      var u=d.updated_at?Date.parse(d.updated_at):now;
      if(now-u>45000)return;
      try{if(s&&d.driver_id&&d.driver_id===s.id)return}catch(e){}
      var id=String(d.driver_id||d.id);
      if(!id)return;
      active.add(id);
      putDriverOnMap(id,d.driver_name,d.vehicle_type,lat,lng,d.avatar_url,d.phone,u);
    });
    try{
      if(window.duntaDrivers){
        [...duntaDrivers.keys()].forEach(function(id){
          if(!active.has(String(id))){
            if(typeof clearDriver==='function')clearDriver(id);
            else {try{duntaMap.removeLayer(duntaDrivers.get(id))}catch(e){}duntaDrivers.delete(id)}
          }
        });
      }
    }catch(e){}
  }catch(e){console.error('loadNearbyDrivers',e)}
};

window.subscribeDrivers=function(){
  if(!window.duntaSupabase)return;
  try{if(window._duntaDriversChan)duntaSupabase.removeChannel(window._duntaDriversChan)}catch(e){}
  window._duntaDriversSubscribed=true;
  window._duntaDriversChan=duntaSupabase.channel('drivers-live-'+Date.now())
    .on('postgres_changes',{event:'*',schema:'public',table:'drivers_locations'},function(payload){
      try{
        if(payload.eventType==='DELETE'){
          var oid=payload.old&&(payload.old.driver_id||payload.old.id);
          if(oid&&typeof clearDriver==='function')clearDriver(oid);
          return;
        }
        var d=payload.new;
        if(!d||!d.is_online){
          var rid=d&&(d.driver_id||d.id);
          if(rid&&typeof clearDriver==='function')clearDriver(rid);
          return;
        }
        var updated=d.updated_at?Date.parse(d.updated_at):Date.now();
        if(Date.now()-updated>45000)return;
        var lat=+d.latitude,lng=+d.longitude;
        if(!validCoords(lat,lng))return;
        var s=null;try{s=getSession&&getSession()}catch(e){}
        if(s&&d.driver_id===s.id)return;
        var id=String(d.driver_id||d.id);
        putDriverOnMap(id,d.driver_name,d.vehicle_type,lat,lng,d.avatar_url,d.phone,updated);
      }catch(e){console.error(e)}
    }).subscribe();
  loadNearbyDrivers();
};

if(typeof publishDriverLocation==='function'&&!window.__duntaPubFixed){
  window.__duntaPubFixed=1;
  var _pub=publishDriverLocation;
  window.publishDriverLocation=async function(){
    try{
      if(!duntaMe)return;
      var p=duntaMe.getLatLng();
      if(!validCoords(p.lat,p.lng))return;
      var s=getSession&&getSession();
      if(!s||s.role!=='driver')return;
      if(s.vehicle)s.vehicle=normVehicle(s.vehicle);
      return await _pub.apply(this,arguments);
    }catch(e){console.error(e)}
  };
}

if(typeof setMe==='function'&&!window.__duntaSetMeLiveFixed){
  window.__duntaSetMeLiveFixed=1;
  var _setMe=setMe;
  window.setMe=function(lat,lng,acc){
    if(!validCoords(lat,lng))return;
    try{_setMe(+lat,+lng,acc)}catch(e){console.error(e)}
    try{
      var n=Date.now();
      if(!window._lastLoadDrivers||n-window._lastLoadDrivers>3000){
        window._lastLoadDrivers=n;
        if(typeof loadNearbyDrivers==='function')loadNearbyDrivers();
      }
      var s=getSession&&getSession();
      if(s&&s.role==='driver'&&s.online&&typeof publishDriverLocation==='function'){
        if(!window._lp||n-window._lp>4000){
          window._lp=n;
          publishDriverLocation();
        }
      }
    }catch(e){}
  };
}

if(!window.__duntaLiveRefresh){
  window.__duntaLiveRefresh=1;
  setInterval(function(){
    try{
      if(typeof loadNearbyDrivers==='function')loadNearbyDrivers();
    }catch(e){}
  },3000);
}

function bootLiveMap(){
  try{
    if(!window.duntaMap&&typeof initMap==='function')initMap();
    if(typeof subscribeDrivers==='function')subscribeDrivers();
    if(typeof loadNearbyDrivers==='function')loadNearbyDrivers();
  }catch(e){}
}
setTimeout(bootLiveMap,800);
setTimeout(bootLiveMap,2000);
setTimeout(bootLiveMap,4000);

setInterval(function(){
  try{
    if(window.duntaSupabase&&!window._duntaDriversChan)subscribeDrivers();
  }catch(e){}
},15000);

if(typeof enterApp==='function'&&!window.__duntaLiveEnter){
  window.__duntaLiveEnter=1;
  var _ea=enterApp;
  window.enterApp=function(){
    try{_ea.apply(this,arguments)}catch(e){}
    setTimeout(bootLiveMap,600);
    setTimeout(bootLiveMap,1500);
  };
}

})();
