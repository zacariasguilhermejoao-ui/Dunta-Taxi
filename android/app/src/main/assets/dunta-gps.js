(function(){
try{if(window.__duntaGpsFresh)return;window.__duntaGpsFresh=1}catch(e){}

var GEO_OPTS={enableHighAccuracy:true,maximumAge:0,timeout:15000};
var GEO_OPTS_WATCH={enableHighAccuracy:true,maximumAge:0,timeout:20000};
var MAX_POS_AGE_MS=20000;

function isFreshPos(pos){
  try{
    if(!pos||!pos.coords)return false;
    var ts=pos.timestamp||Date.now();
    if(Date.now()-ts>MAX_POS_AGE_MS)return false;
    var lat=+pos.coords.latitude,lng=+pos.coords.longitude;
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
    if(lat===0&&lng===0)return false;
    return true;
  }catch(e){return false}
}

function applyPos(pos,src){
  if(!isFreshPos(pos)){
    console.warn('[dunta-gps] posicao antiga/invalida ignorada',src);
    return;
  }
  var lat=+pos.coords.latitude,lng=+pos.coords.longitude,acc=+pos.coords.accuracy||0;
  try{
    window.duntaPassengerLocation={lat:lat,lng:lng,acc:acc,ts:Date.now()};
  }catch(e){}
  try{
    if(typeof setMe==='function')setMe(lat,lng,acc);
  }catch(e){console.error(e)}
  try{
    if(window.duntaMe&&window.duntaMap){
      duntaMe.setLatLng([lat,lng]);
    }
  }catch(e){}
}

window.duntaForceFreshLocation=function(cb){
  if(!navigator.geolocation){if(cb)cb(null);return}
  navigator.geolocation.getCurrentPosition(function(pos){
    applyPos(pos,'force');
    if(cb)cb(pos);
  },function(err){
    console.warn('[dunta-gps] force error',err&&err.message);
    if(cb)cb(null);
  },GEO_OPTS);
};

window.startGPS=function(){
  try{
    if(window.__duntaWatchId!=null){
      try{navigator.geolocation.clearWatch(window.__duntaWatchId)}catch(e){}
      window.__duntaWatchId=null;
    }
  }catch(e){}
  if(!navigator.geolocation)return;
  navigator.geolocation.getCurrentPosition(function(pos){
    applyPos(pos,'start-get');
  },function(){},GEO_OPTS);
  try{
    window.__duntaWatchId=navigator.geolocation.watchPosition(function(pos){
      applyPos(pos,'watch');
    },function(err){
      console.warn('[dunta-gps] watch',err&&err.message);
    },GEO_OPTS_WATCH);
  }catch(e){console.error(e)}
};

window.requestMyLocation=function(force){
  window.duntaForceFreshLocation(function(pos){
    if(pos&&window.duntaMap){
      try{
        var lat=pos.coords.latitude,lng=pos.coords.longitude;
        duntaMap.setView([lat,lng],Math.max(duntaMap.getZoom(),15));
      }catch(e){}
    }
  });
};

setTimeout(function(){try{startGPS()}catch(e){}},400);
setTimeout(function(){try{startGPS()}catch(e){}},2000);

if(!window.__duntaGpsPulse){
  window.__duntaGpsPulse=1;
  setInterval(function(){
    try{window.duntaForceFreshLocation()}catch(e){}
  },15000);
}

try{
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){
      try{window.duntaForceFreshLocation();startGPS()}catch(e){}
    }
  });
}catch(e){}

if(typeof requestRide==='function'&&!window.__duntaRideGpsWrap){
  window.__duntaRideGpsWrap=1;
  var _rr=requestRide;
  window.requestRide=function(){
    window.duntaForceFreshLocation(function(pos){
      if(!pos){
        if(typeof toast==='function')toast('A obter localizacao atual…');
        setTimeout(function(){try{_rr.apply(null,arguments)}catch(e){}},800);
        return;
      }
      try{_rr.apply(null,arguments)}catch(e){console.error(e)}
    });
  };
}

})();
