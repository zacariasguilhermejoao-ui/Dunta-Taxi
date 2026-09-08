(function(){
try{if(window.__duntaTripLoaded)return;window.__duntaTripLoaded=1;}catch(e){}

var MAX_RIDE_AGE_MS=90*60*1000;

function rideIsFresh(r){
  try{
    if(!r)return false;
    if(r.status!=='accepted')return false;
    var t=r.updated_at||r.created_at;
    if(!t)return false;
    var age=Date.now()-new Date(t).getTime();
    return age>=0 && age<=MAX_RIDE_AGE_MS;
  }catch(e){return false}
}

try{
  if(!document.getElementById('dunta-trip-css')){
    var st=document.createElement('style');st.id='dunta-trip-css';
    st.textContent=[
      'body.dunta-in-trip #live-badge,body.dunta-in-trip #eta,body.dunta-in-trip #ban,body.dunta-in-trip #dunta-driver-bar,body.dunta-in-trip #dunta-driver-trip{display:none!important}',
      'body.dunta-in-trip #home .hh,body.dunta-in-trip #home .svc,body.dunta-in-trip #home .search-box,body.dunta-in-trip #nav,body.dunta-in-trip .bottom-nav,body.dunta-in-trip #tabs,body.dunta-in-trip .fab{display:none!important}',
      'body.dunta-in-trip #map,body.dunta-in-trip #map-wrap,body.dunta-in-trip .leaflet-container{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:1!important;border-radius:0!important}',
      '#live-badge{display:none!important}',
      '#dunta-trip-top{position:fixed;top:0;left:0;right:0;z-index:10001;display:none;padding:calc(12px + env(safe-area-inset-top,0px)) 14px 10px;pointer-events:none}',
      '#dunta-trip-top.show{display:flex;justify-content:space-between;align-items:center}',
      '#dunta-trip-top button{pointer-events:auto;width:44px;height:44px;border:0;border-radius:50%;background:rgba(11,15,13,.92);color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.35);display:grid;place-items:center;cursor:pointer}',
      '#dunta-trip-top button i{font-size:18px}',
      '#dunta-trip-menu{position:fixed;top:calc(58px + env(safe-area-inset-top,0px));right:14px;z-index:10002;background:#111827;border:1px solid #2a332e;border-radius:14px;padding:8px;min-width:200px;display:none;box-shadow:0 12px 32px rgba(0,0,0,.45)}',
      '#dunta-trip-menu.show{display:block}',
      '#dunta-trip-menu button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;color:#fff;padding:12px 14px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;text-align:left}',
      '#dunta-trip-menu button:active{background:#1f2937}',
      '#dunta-trip-menu button.danger{color:#fca5a5}',
      '#dunta-trip-menu button.ok{color:#86efac}',
      '#dunta-trip-menu .sep{height:1px;background:#2a332e;margin:4px 0}',
      '#dunta-trip-chip{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom,0px));z-index:10000;display:none;background:rgba(11,15,13,.92);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,.4);max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#dunta-trip-chip.show{display:block}'
    ].join('');
    document.head.appendChild(st);
  }
}catch(e){}

try{var lb=document.getElementById('live-badge');if(lb)lb.style.display='none'}catch(e){}

function ensureTripChrome(){
  if(!document.getElementById('dunta-trip-top')){
    var top=document.createElement('div');top.id='dunta-trip-top';
    top.innerHTML='<button type="button" id="dunta-trip-back" aria-label="Voltar"><i class="fa-solid fa-arrow-left"></i></button>'+
      '<button type="button" id="dunta-trip-more" aria-label="Menu"><i class="fa-solid fa-ellipsis-vertical"></i></button>';
    document.body.appendChild(top);
    document.getElementById('dunta-trip-back').onclick=function(e){e.stopPropagation();duntaTripBack()};
    document.getElementById('dunta-trip-more').onclick=function(e){e.stopPropagation();duntaToggleTripMenu()};
  }
  if(!document.getElementById('dunta-trip-menu')){
    var menu=document.createElement('div');menu.id='dunta-trip-menu';
    document.body.appendChild(menu);
  }
  if(!document.getElementById('dunta-trip-chip')){
    var chip=document.createElement('div');chip.id='dunta-trip-chip';
    document.body.appendChild(chip);
  }
  if(!window.__duntaMenuCloseBound){
    window.__duntaMenuCloseBound=1;
    document.addEventListener('click',function(){
      var m=document.getElementById('dunta-trip-menu');
      if(m)m.classList.remove('show');
    });
  }
}

window.duntaToggleTripMenu=function(){
  ensureTripChrome();
  var m=document.getElementById('dunta-trip-menu');
  if(!m)return;
  if(m.classList.contains('show')){m.classList.remove('show');return}
  duntaBuildTripMenu();
  m.classList.add('show');
};

window.duntaBuildTripMenu=function(){
  var m=document.getElementById('dunta-trip-menu');
  if(!m)return;
  var s=null;try{s=getSession&&getSession()}catch(e){}
  var isDriver=s&&s.role==='driver';
  var phase=window.duntaTripPhase||'pickup';
  var html='';
  if(isDriver){
    html+='<button type="button" onclick="event.stopPropagation();duntaCallPassenger();duntaCloseTripMenu()"><i class="fa-solid fa-phone"></i> Ligar ao passageiro</button>';
    if(phase!=='in_trip'){
      html+='<button type="button" class="ok" onclick="event.stopPropagation();duntaStartTrip();duntaCloseTripMenu()"><i class="fa-solid fa-play"></i> Começar viagem</button>';
    }else{
      html+='<button type="button" class="ok" onclick="event.stopPropagation();duntaCompleteTrip();duntaCloseTripMenu()"><i class="fa-solid fa-flag-checkered"></i> Concluir viagem</button>';
    }
    html+='<div class="sep"></div>';
    html+='<button type="button" class="danger" onclick="event.stopPropagation();duntaCancelRide();duntaCloseTripMenu()"><i class="fa-solid fa-xmark"></i> Cancelar viagem</button>';
  }else{
    html+='<button type="button" onclick="event.stopPropagation();duntaCallDriver();duntaCloseTripMenu()"><i class="fa-solid fa-phone"></i> Ligar ao motorista</button>';
    html+='<div class="sep"></div>';
    html+='<button type="button" class="danger" onclick="event.stopPropagation();duntaCancelRide();duntaCloseTripMenu()"><i class="fa-solid fa-xmark"></i> Cancelar viagem</button>';
  }
  m.innerHTML=html;
};

window.duntaCloseTripMenu=function(){
  var m=document.getElementById('dunta-trip-menu');
  if(m)m.classList.remove('show');
};

window.duntaTripBack=function(){
  duntaCloseTripMenu();
  try{
    document.body.classList.remove('dunta-in-trip');
    var top=document.getElementById('dunta-trip-top');
    if(top)top.classList.remove('show');
    var chip=document.getElementById('dunta-trip-chip');
    if(chip)chip.classList.remove('show');
    setTimeout(function(){try{if(window.duntaMap)duntaMap.invalidateSize()}catch(e){}},200);
    if(typeof toast==='function')toast('Mapa em modo normal · viagem continua ativa');
  }catch(e){}
};

window.duntaEnterTripMap=function(){
  try{
    ensureTripChrome();
    document.body.classList.add('dunta-in-trip');
    var top=document.getElementById('dunta-trip-top');
    if(top)top.classList.add('show');
    var lb=document.getElementById('live-badge');
    if(lb)lb.style.display='none';
    setTimeout(function(){try{if(window.duntaMap)duntaMap.invalidateSize()}catch(e){}},200);
  }catch(e){}
};

window.duntaExitTripMap=function(){
  try{
    document.body.classList.remove('dunta-in-trip');
    var top=document.getElementById('dunta-trip-top');
    if(top)top.classList.remove('show');
    var menu=document.getElementById('dunta-trip-menu');
    if(menu)menu.classList.remove('show');
    var chip=document.getElementById('dunta-trip-chip');
    if(chip)chip.classList.remove('show');
    var old=document.getElementById('dunta-trip-panel');
    if(old)old.classList.remove('show');
    setTimeout(function(){try{if(window.duntaMap)duntaMap.invalidateSize()}catch(e){}},200);
  }catch(e){}
};

if(typeof window.duntaCallNumber!=='function'){
  window.duntaCallNumber=function(num){
    try{
      if(!num){if(typeof toast==='function')toast('Número indisponível');return}
      var clean=String(num).replace(/[^0-9+]/g,'');
      if(!clean){if(typeof toast==='function')toast('Número inválido');return}
      try{if(window.DuntaNative&&typeof DuntaNative.dialPhone==='function'){DuntaNative.dialPhone(clean);return}}catch(e){}
      var a=document.createElement('a');a.href='tel:'+clean;a.style.display='none';document.body.appendChild(a);a.click();
      setTimeout(function(){try{a.remove()}catch(e){}},500);
    }catch(e){try{window.location.href='tel:'+String(num).replace(/[^0-9+]/g,'')}catch(x){}}
  };
}
if(typeof window.duntaCallPassenger!=='function'){
  window.duntaCallPassenger=function(){
    try{
      var ride=window.duntaActiveRide||window.duntaIncomingRequest;
      var phone=(ride&&(ride.passenger_phone||ride.phone))||'';
      if(!phone){if(typeof toast==='function')toast('Telefone do passageiro indisponível');return}
      duntaCallNumber(phone);
    }catch(e){if(typeof toast==='function')toast('Não foi possível ligar')}
  };
}
if(typeof window.duntaCallDriver!=='function'){
  window.duntaCallDriver=function(){
    try{
      var ride=window.duntaActiveRide;
      var phone=(ride&&(ride.driver_phone||ride.phone))||'';
      if(!phone){if(typeof toast==='function')toast('Telefone do motorista indisponível');return}
      duntaCallNumber(phone);
    }catch(e){if(typeof toast==='function')toast('Não foi possível ligar')}
  };
}

window.duntaCancelRide=async function(){
  try{
    var ride=window.duntaActiveRide;
    if(!ride||!ride.id){
      try{
        var s=getSession&&getSession();
        if(s&&window.duntaSupabase){
          var q=duntaSupabase.from('ride_requests').select('*').eq('status','accepted').order('updated_at',{ascending:false}).limit(1);
          if(s.role==='driver')q=q.eq('driver_id',s.id);else q=q.eq('passenger_id',s.id);
          var res=await q.maybeSingle();
          if(res&&res.data&&rideIsFresh(res.data))ride=res.data;
        }
      }catch(e){}
    }
    if(!ride||!ride.id||!window.duntaSupabase){
      window.duntaActiveRide=null;
      duntaExitTripMap();
      if(typeof showBan==='function')showBan('');
      if(typeof toast==='function')toast('Não há viagem ativa');
      return;
    }
    if(!confirm('Cancelar esta viagem?'))return;
    if(typeof toast==='function')toast('A cancelar…');
    var res=await duntaSupabase.from('ride_requests').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',ride.id);
    if(res&&res.error){
      var res2=await duntaSupabase.from('ride_requests').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',ride.id);
      if(res2&&res2.error){if(typeof toast==='function')toast('Não foi possível cancelar');return}
    }
    window.duntaActiveRide=null;
    window.duntaTripPhase='pickup';
    duntaExitTripMap();
    try{if(typeof stopRideDriverWatch==='function')stopRideDriverWatch()}catch(e){}
    if(typeof toast==='function')toast('Viagem cancelada');
    try{if(typeof updUI==='function')updUI()}catch(e){}
    try{if(window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(ride.id))}catch(e){}
    try{if(window.DuntaNative&&DuntaNative.clearActiveRide)DuntaNative.clearActiveRide()}catch(e){}
  }catch(e){console.error(e);if(typeof toast==='function')toast('Erro ao cancelar')}
};

window.duntaStartTrip=async function(){
  try{
    var ride=window.duntaActiveRide;
    if(!ride||!ride.id){if(typeof toast==='function')toast('Sem viagem ativa');return}
    if(!rideIsFresh(ride)){if(typeof toast==='function')toast('Viagem expirada');window.duntaActiveRide=null;duntaExitTripMap();return}
    window.duntaTripPhase='in_trip';
    if(typeof toast==='function')toast('Viagem iniciada');
    try{
      if(window.duntaTripDestinationCoords&&typeof drawRoadRoute==='function'){
        await drawRoadRoute(duntaTripDestinationCoords.lat,duntaTripDestinationCoords.lng);
      }else if(ride.destination&&typeof geocodeDestination==='function'){
        await geocodeDestination(ride.destination);
        var x=window._duntaGeocodeResults&&window._duntaGeocodeResults[0];
        if(x&&typeof drawRoadRoute==='function'){
          window.duntaTripDestinationCoords={lat:+x.lat,lng:+x.lon,label:x.display_name};
          await drawRoadRoute(+x.lat,+x.lon);
        }
      }
    }catch(e){console.error(e)}
    duntaRefreshTripPanel();
    duntaEnterTripMap();
  }catch(e){console.error(e)}
};

window.duntaCompleteTrip=async function(){
  try{
    var ride=window.duntaActiveRide;
    if(!ride||!ride.id||!window.duntaSupabase)return;
    var res=await duntaSupabase.from('ride_requests').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',ride.id);
    if(res&&res.error){if(typeof toast==='function')toast('Erro ao concluir');return}
    window.duntaActiveRide=null;
    window.duntaTripPhase='pickup';
    duntaExitTripMap();
    try{if(typeof stopRideDriverWatch==='function')stopRideDriverWatch()}catch(e){}
    if(typeof toast==='function')toast('Viagem concluída');
    try{if(typeof updUI==='function')updUI()}catch(e){}
    try{if(window.DuntaNative&&DuntaNative.clearActiveRide)DuntaNative.clearActiveRide()}catch(e){}
  }catch(e){console.error(e)}
};

window.duntaRefreshTripPanel=function(){
  try{
    ensureTripChrome();
    var ride=window.duntaActiveRide;
    var chip=document.getElementById('dunta-trip-chip');
    var top=document.getElementById('dunta-trip-top');
    if(!ride||!rideIsFresh(ride)||ride.status!=='accepted'){
      if(chip)chip.classList.remove('show');
      if(!rideIsFresh(ride)&&ride){window.duntaActiveRide=null;duntaExitTripMap()}
      return;
    }
    duntaEnterTripMap();
    if(top)top.classList.add('show');
    var s=null;try{s=getSession&&getSession()}catch(e){}
    var isDriver=s&&s.role==='driver';
    var phase=window.duntaTripPhase||'pickup';
    var label='';
    if(isDriver){
      label=phase==='in_trip'?'Em viagem · '+(ride.destination||'') : 'A caminho · '+(ride.passenger_name||'Passageiro');
    }else{
      label=phase==='in_trip'?'Em viagem · '+(ride.destination||'') : 'Motorista a caminho · '+(ride.driver_name||'');
    }
    if(chip){chip.textContent=label;chip.classList.add('show')}
  }catch(e){console.error('trip panel',e)}
};

if(typeof acceptRide==='function'&&!window.__duntaAcceptTripFixed){
  window.__duntaAcceptTripFixed=1;
  var _accTrip=acceptRide;
  window.acceptRide=async function(){
    var req=window.duntaIncomingRequest;
    var rid=req&&req.id;
    try{
      if(rid){
        window.__duntaHandledRides=window.__duntaHandledRides||{};
        window.__duntaHandledRides[rid]=true;
        try{if(window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(rid))}catch(e){}
      }
    }catch(e){}
    var result=await _accTrip.apply(this,arguments);
    try{
      if(window.duntaActiveRide&&rideIsFresh(window.duntaActiveRide)){
        window.duntaTripPhase='pickup';
        duntaEnterTripMap();
        duntaRefreshTripPanel();
        var r=window.duntaActiveRide;
        if(r.passenger_lat&&r.passenger_lng){
          try{
            if(duntaMap)duntaMap.setView([+r.passenger_lat,+r.passenger_lng],15);
            if(typeof drawRoadRoute==='function')drawRoadRoute(+r.passenger_lat,+r.passenger_lng);
            if(typeof setPassengerMarker==='function')setPassengerMarker(+r.passenger_lat,+r.passenger_lng,r.passenger_name,r.passenger_avatar_url);
          }catch(e){}
        }
        setTimeout(function(){try{if(duntaMap)duntaMap.invalidateSize()}catch(e){}},300);
      }
    }catch(e){console.error(e)}
    return result;
  };
}

if(typeof handleRideUpdate==='function'&&!window.__duntaHandleRideFixed){
  window.__duntaHandleRideFixed=1;
  var _hru=handleRideUpdate;
  window.handleRideUpdate=function(r){
    try{if(r&&r.status==='accepted'&&!rideIsFresh(r))return}catch(e){}
    try{_hru(r)}catch(e){console.error(e)}
    try{
      if(!r)return;
      if(r.status==='accepted'&&rideIsFresh(r)){
        window.duntaActiveRide=r;
        var s=getSession&&getSession();
        if(s&&s.role==='passenger'){
          window.duntaTripPhase=window.duntaTripPhase||'pickup';
          duntaEnterTripMap();
          duntaRefreshTripPanel();
          if(r.driver_id&&typeof watchRideDriver==='function')watchRideDriver(r.driver_id);
          try{if(window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(r.id))}catch(e){}
          setTimeout(function(){try{if(duntaMap)duntaMap.invalidateSize()}catch(e){}},300);
        }else if(s&&s.role==='driver'){
          duntaEnterTripMap();
          duntaRefreshTripPanel();
        }
      }else if(r.status==='cancelled'||r.status==='completed'){
        window.duntaActiveRide=null;
        duntaExitTripMap();
        try{if(typeof updUI==='function')updUI()}catch(e){}
      }
    }catch(e){console.error(e)}
  };
}

function duntaClearStaleTripUI(){
  try{
    if(window.duntaActiveRide&&!rideIsFresh(window.duntaActiveRide)){
      window.duntaActiveRide=null;
      duntaExitTripMap();
      if(typeof showBan==='function')showBan('');
    }
    if(!window.duntaActiveRide||!rideIsFresh(window.duntaActiveRide)){
      duntaExitTripMap();
    }
    var lb=document.getElementById('live-badge');
    if(lb)lb.style.display='none';
  }catch(e){}
}
setTimeout(duntaClearStaleTripUI,600);
setTimeout(duntaClearStaleTripUI,2000);

if(!window.__duntaRidePoll){
  window.__duntaRidePoll=1;
  setInterval(function(){
    try{
      var s=getSession&&getSession();
      if(!s||!window.duntaSupabase)return;
      if(window.duntaActiveRide&&rideIsFresh(window.duntaActiveRide))return;
      if(window.duntaActiveRide&&!rideIsFresh(window.duntaActiveRide)){
        window.duntaActiveRide=null;duntaExitTripMap();
      }
      var since=new Date(Date.now()-MAX_RIDE_AGE_MS).toISOString();
      var q=duntaSupabase.from('ride_requests').select('*').eq('status','accepted').gte('updated_at',since).order('updated_at',{ascending:false}).limit(1);
      if(s.role==='driver')q=q.eq('driver_id',s.id);else q=q.eq('passenger_id',s.id);
      q.maybeSingle().then(function(res){
        if(res&&res.data&&rideIsFresh(res.data)){
          window.duntaActiveRide=res.data;
          window.duntaTripPhase=window.duntaTripPhase||'pickup';
          if(typeof handleRideUpdate==='function')handleRideUpdate(res.data);
          else duntaRefreshTripPanel();
        }
      });
    }catch(e){}
  },20000);
}

if(typeof showDriverRequest==='function'&&!window.__duntaShowReqAgeFixed){
  window.__duntaShowReqAgeFixed=1;
  var _sr=showDriverRequest;
  window.showDriverRequest=function(req){
    try{
      if(!req)return;
      var age=Date.now()-new Date(req.created_at||0).getTime();
      if(age>3*60*1000)return;
      if(req.status&&req.status!=='pending')return;
      if(window.duntaActiveRide&&rideIsFresh(window.duntaActiveRide))return;
    }catch(e){}
    return _sr(req);
  };
}

setInterval(function(){
  try{var lb=document.getElementById('live-badge');if(lb)lb.style.display='none'}catch(e){}
},3000);

})();
