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
function vehicleMatch(reqType, driverType){
  var r=normVehicle(reqType), d=normVehicle(driverType||'taxi');
  if(r==='any')return true;
  return r===d;
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
function rideAgeMs(r){
  try{return Date.now()-new Date(r.created_at||0).getTime();}catch(e){return 99999999;}
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
      '@keyframes duntaPulse{0%{box-shadow:0 0 0 0 rgba(193,15,6,.45)}70%{box-shadow:0 0 0 12px rgba(193,15,6,0)}100%{box-shadow:0 0 0 0 rgba(193,15,6,0)}}',
      '.driver-self-marker{width:42px;height:42px;border-radius:50%;background:#C10F06;border:3px solid #fff;display:grid;place-items:center}',
      '.driver-self-marker i{color:#FFD400}'
    ].join('');
    document.head.appendChild(s);
  }
}catch(e){}

window.driverIcon=function(type){
  var t=normVehicle(type);
  var isMota=t==='mota';
  var cls=isMota?'mota':'';
  var icon=isMota?'fa-motorcycle':'fa-taxi';
  return L.divIcon({
    className:'',
    html:'<div class="driver-fa-marker '+cls+' driver-live-pulse"><i class="fa-solid '+icon+'"></i></div>',
    iconSize:[42,42],
    iconAnchor:[21,21]
  });
};

window.loadNearbyDrivers=async function(){
  if(!window.duntaSupabase||!window.duntaMap)return;
  try{
    var res=await duntaSupabase.from('drivers_locations')
      .select('id,driver_id,driver_name,vehicle_type,avatar_url,phone,latitude,longitude,is_online,updated_at')
      .eq('is_online',true);
    var data=res.data||[];
    var active=new Set();
    var now=Date.now();
    var me=myLatLng();
    var s=null;try{s=getSession&&getSession()}catch(e){}
    data.forEach(function(d){
      var lat=+d.latitude, lng=+d.longitude;
      if(!validCoords(lat,lng))return;
      var u=d.updated_at?Date.parse(d.updated_at):now;
      if(now-u>90000)return;
      try{if(s&&d.driver_id&&d.driver_id===s.id)return}catch(e){}
      if(me&&typeof distanceKm==='function'){
        var dist=distanceKm(me.lat,me.lng,lat,lng);
        if(dist>15)return;
      }
      var id=d.id||d.driver_id;
      if(!id)return;
      active.add(id);
      if(typeof addDriver==='function'){
        addDriver(id,d.driver_name,normVehicle(d.vehicle_type),lat,lng,d.avatar_url,d.phone,u);
      }
    });
    if(window.duntaDrivers){
      try{
        [...duntaDrivers.keys()].forEach(function(id){
          if(!active.has(id)&&typeof clearDriver==='function')clearDriver(id);
        });
      }catch(e){}
    }
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
          if(typeof clearDriver==='function')clearDriver(payload.old&&payload.old.id);
          return;
        }
        var d=payload.new;
        if(!d||!d.is_online){
          if(typeof clearDriver==='function')clearDriver(d&&d.id);
          return;
        }
        var updated=d.updated_at?Date.parse(d.updated_at):Date.now();
        if(Date.now()-updated>90000){
          if(typeof clearDriver==='function')clearDriver(d.id);
          return;
        }
        var lat=+d.latitude,lng=+d.longitude;
        if(!validCoords(lat,lng))return;
        var s=null;try{s=getSession&&getSession()}catch(e){}
        if(s&&d.driver_id===s.id)return;
        var me=myLatLng();
        if(me&&typeof distanceKm==='function'&&distanceKm(me.lat,me.lng,lat,lng)>15)return;
        if(typeof addDriver==='function'){
          addDriver(d.id||d.driver_id,d.driver_name,normVehicle(d.vehicle_type),lat,lng,d.avatar_url,d.phone,updated);
        }
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
      var s=getSession&&getSession();
      if(s&&s.role==='driver'&&duntaMap&&L){
        var isMota=normVehicle(s.vehicle)==='mota';
        var html='<div class="driver-self-marker" style="background:'+(isMota?'#7C3AED':'#C10F06')+'"><i class="fa-solid '+(isMota?'fa-motorcycle':'fa-taxi')+'"></i></div>';
        if(!window._selfDrv){
          window._selfDrv=L.marker([+lat,+lng],{
            icon:L.divIcon({className:'',html:html,iconSize:[42,42],iconAnchor:[21,21]}),
            zIndexOffset:1000
          }).addTo(duntaMap);
          window._selfDrv.bindPopup('<b>A minha posição</b>');
        }else{
          window._selfDrv.setLatLng([+lat,+lng]);
        }
      }
      if(typeof loadNearbyDrivers==='function'){
        var n=Date.now();
        if(!window._lastLoadDrivers||n-window._lastLoadDrivers>4000){
          window._lastLoadDrivers=n;
          loadNearbyDrivers();
        }
      }
      if(s&&s.role==='driver'&&s.online&&typeof publishDriverLocation==='function'){
        var n2=Date.now();
        if(!window._lp||n2-window._lp>4000){
          window._lp=n2;
          publishDriverLocation();
        }
      }
    }catch(e){}
  };
}

window.subscribeRideRequests=function(){
  var s=getSession&&getSession();
  if(!s||s.role!=='driver'||!window.duntaSupabase)return;
  try{if(window._reqChan)duntaSupabase.removeChannel(window._reqChan)}catch(e){}
  window._reqChan=duntaSupabase.channel('req-live-'+Date.now())
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_requests'},function(p){
      try{
        var r=p.new;
        if(!r||r.status!=='pending')return;
        if(rideAgeMs(r)>120000)return;
        if(!vehicleMatch(r.vehicle_type,s.vehicle))return;
        if(window.duntaActiveRide&&window.duntaActiveRide.status==='accepted')return;
        var me=myLatLng();
        if(me&&validCoords(r.passenger_lat,r.passenger_lng)&&typeof distanceKm==='function'){
          if(distanceKm(me.lat,me.lng,+r.passenger_lat,+r.passenger_lng)>15)return;
        }
        if(typeof showDriverRequest==='function')showDriverRequest(r);
        if(typeof toast==='function')toast('Novo pedido próximo!');
      }catch(e){console.error(e)}
    }).subscribe();
};

if(typeof showDriverRequest==='function'&&!window.__duntaShowReqVehicleFixed){
  window.__duntaShowReqVehicleFixed=1;
  var _show=showDriverRequest;
  window.showDriverRequest=function(req){
    try{
      if(!req)return;
      if(req.status&&req.status!=='pending')return;
      if(rideAgeMs(req)>120000)return;
      var s=getSession&&getSession();
      if(s&&s.role==='driver'&&!vehicleMatch(req.vehicle_type,s.vehicle))return;
      if(window.duntaActiveRide&&window.duntaActiveRide.status==='accepted')return;
    }catch(e){}
    return _show(req);
  };
}

if(typeof acceptRide==='function'&&!window.__duntaAcceptVehicleFixed){
  window.__duntaAcceptVehicleFixed=1;
  var _acc=acceptRide;
  window.acceptRide=async function(){
    try{
      var s=getSession&&getSession();
      var req=window.duntaIncomingRequest;
      if(s&&req&&!vehicleMatch(req.vehicle_type,s.vehicle)){
        if(typeof toast==='function')toast(normVehicle(req.vehicle_type)==='mota'?'Este pedido é só para mototáxi':'Este pedido é só para táxi');
        return;
      }
      if(req&&rideAgeMs(req)>180000){
        if(typeof toast==='function')toast('Pedido expirado');
        return;
      }
    }catch(e){}
    return await _acc.apply(this,arguments);
  };
}

if(typeof startDriverSync==='function'&&!window.__duntaSyncLiveFixed){
  window.__duntaSyncLiveFixed=1;
  var _sync=startDriverSync;
  window.startDriverSync=function(){
    try{_sync()}catch(e){}
    try{
      if(window.duntaLocationTimer)clearInterval(window.duntaLocationTimer);
      window.duntaLocationTimer=setInterval(function(){
        try{if(typeof publishDriverLocation==='function')publishDriverLocation()}catch(e){}
      },5000);
      if(typeof publishDriverLocation==='function')publishDriverLocation();
      if(typeof subscribeRideRequests==='function')subscribeRideRequests();
      if(typeof loadNearbyDrivers==='function')loadNearbyDrivers();
      if(typeof subscribeDrivers==='function')subscribeDrivers();
    }catch(e){}
  };
}

if(!window.__duntaLiveRefresh){
  window.__duntaLiveRefresh=1;
  setInterval(function(){
    try{if(typeof loadNearbyDrivers==='function')loadNearbyDrivers()}catch(e){}
  },5000);
}

setTimeout(function(){
  try{
    if(typeof subscribeDrivers==='function')subscribeDrivers();
    if(typeof loadNearbyDrivers==='function')loadNearbyDrivers();
    var s=getSession&&getSession();
    if(s&&s.role==='driver'&&s.online&&typeof subscribeRideRequests==='function')subscribeRideRequests();
  }catch(e){}
},1500);

})();
