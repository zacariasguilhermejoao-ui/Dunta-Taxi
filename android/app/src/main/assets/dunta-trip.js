(function(){
// === Trip UI: fullscreen map, cancel, start trip, stop notifs ===
try{
if(!document.getElementById('dunta-trip-css')){
var st=document.createElement('style');st.id='dunta-trip-css';
st.textContent=['body.dunta-in-trip #dunta-driver-bar{display:none!important}','body.dunta-in-trip #home .hh,body.dunta-in-trip #home .svc,body.dunta-in-trip #home .search-box,body.dunta-in-trip #nav,body.dunta-in-trip .bottom-nav,body.dunta-in-trip #tabs{display:none!important}','body.dunta-in-trip #map,body.dunta-in-trip #map-wrap,body.dunta-in-trip .leaflet-container{position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:1!important;border-radius:0!important}','#dunta-trip-panel{position:fixed;left:12px;right:12px;bottom:18px;z-index:10000;background:linear-gradient(180deg,#1a1f1c,#0B0F0D);border:1px solid #2a332e;border-radius:18px;padding:14px;color:#fff;display:none;box-shadow:0 12px 40px rgba(0,0,0,.5)}','#dunta-trip-panel.show{display:block}','#dunta-trip-panel .tp-title{font-weight:800;font-size:15px;margin-bottom:4px}','#dunta-trip-panel .tp-sub{font-size:12px;opacity:.8;margin-bottom:12px;line-height:1.4}','#dunta-trip-panel .tp-row{display:flex;gap:8px;flex-wrap:wrap}','#dunta-trip-panel button{flex:1;min-width:110px;border:0;border-radius:12px;padding:12px 10px;font-weight:800;cursor:pointer}','.tp-call{background:#2563EB;color:#fff}','.tp-start{background:#16A34A;color:#fff}','.tp-cancel{background:#374151;color:#fff}','.tp-done{background:#C10F06;color:#fff}'].join('');
document.head.appendChild(st);
}
}catch(e){}

function ensureTripPanel(){
if(document.getElementById('dunta-trip-panel'))return;
var p=document.createElement('div');p.id='dunta-trip-panel';
p.innerHTML='<div class="tp-title" id="tp-title">Viagem</div><div class="tp-sub" id="tp-sub">—</div><div class="tp-row" id="tp-actions"></div>';
document.body.appendChild(p);
}

window.duntaEnterTripMap=function(){
try{
document.body.classList.add('dunta-in-trip');
setTimeout(function(){try{if(window.duntaMap)duntaMap.invalidateSize()}catch(e){}},200);
}catch(e){}
};
window.duntaExitTripMap=function(){
try{
document.body.classList.remove('dunta-in-trip');
var p=document.getElementById('dunta-trip-panel');
if(p)p.classList.remove('show');
setTimeout(function(){try{if(window.duntaMap)duntaMap.invalidateSize()}catch(e){}},200);
}catch(e){}
};

window.duntaCancelRide=async function(){
try{
var ride=window.duntaActiveRide;
if(!ride||!ride.id||!window.duntaSupabase){if(typeof toast==='function')toast('Sem viagem ativa');return}
if(!confirm('Cancelar esta viagem?'))return;
var {error}=await duntaSupabase.from('ride_requests').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',ride.id);
if(error){console.error(error);if(typeof toast==='function')toast('Não foi possível cancelar');return}
window.duntaActiveRide=null;window.duntaTripPhase='pickup';
duntaExitTripMap();
if(typeof stopRideDriverWatch==='function')stopRideDriverWatch();
if(typeof showBan==='function')showBan('Viagem cancelada');
setTimeout(function(){if(typeof showBan==='function')showBan('')},2500);
if(typeof toast==='function')toast('Viagem cancelada');
if(typeof updUI==='function')updUI();
try{if(window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(ride.id))}catch(e){}
}catch(e){console.error(e);if(typeof toast==='function')toast('Erro ao cancelar')}
};

window.duntaStartTrip=async function(){
try{
var ride=window.duntaActiveRide;
if(!ride||!ride.id){if(typeof toast==='function')toast('Sem viagem ativa');return}
window.duntaTripPhase='in_trip';
if(typeof toast==='function')toast('Viagem iniciada');
try{
if(window.duntaTripDestinationCoords){
await drawRoadRoute(duntaTripDestinationCoords.lat,duntaTripDestinationCoords.lng);
} else if(ride.destination&&typeof geocodeDestination==='function'){
await geocodeDestination(ride.destination);
var x=window._duntaGeocodeResults&&window._duntaGeocodeResults[0];
if(x){window.duntaTripDestinationCoords={lat:+x.lat,lng:+x.lon,label:x.display_name};await drawRoadRoute(+x.lat,+x.lon);}
}
}catch(e){console.error(e)}
duntaRefreshTripPanel();duntaEnterTripMap();
}catch(e){console.error(e)}
};

window.duntaCompleteTrip=async function(){
try{
var ride=window.duntaActiveRide;
if(!ride||!ride.id||!window.duntaSupabase)return;
var {error}=await duntaSupabase.from('ride_requests').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',ride.id);
if(error){if(typeof toast==='function')toast('Erro ao concluir');return}
window.duntaActiveRide=null;window.duntaTripPhase='pickup';
duntaExitTripMap();
if(typeof stopRideDriverWatch==='function')stopRideDriverWatch();
if(typeof showBan==='function')showBan('Viagem concluída');
setTimeout(function(){if(typeof showBan==='function')showBan('')},3000);
if(typeof toast==='function')toast('Viagem concluída');
if(typeof updUI==='function')updUI();
try{if(window.DuntaNative&&DuntaNative.clearActiveRide)DuntaNative.clearActiveRide()}catch(e){}
}catch(e){console.error(e)}
};

window.duntaRefreshTripPanel=function(){
try{
ensureTripPanel();
var ride=window.duntaActiveRide;
var panel=document.getElementById('dunta-trip-panel');
var title=document.getElementById('tp-title');
var sub=document.getElementById('tp-sub');
var actions=document.getElementById('tp-actions');
if(!ride||!panel){if(panel)panel.classList.remove('show');return}
var s=getSession&&getSession();
var isDriver=s&&s.role==='driver';
var phase=window.duntaTripPhase||'pickup';
panel.classList.add('show');
duntaEnterTripMap();
if(isDriver){
if(phase==='in_trip'){
if(title)title.textContent='Em viagem';
if(sub)sub.textContent='Destino: '+(ride.destination||'—')+' · Passageiro: '+(ride.passenger_name||'—');
if(actions)actions.innerHTML='<button class="tp-call" type="button" onclick="duntaCallPassenger()"><i class="fa-solid fa-phone"></i> Ligar</button><button class="tp-done" type="button" onclick="duntaCompleteTrip()">Concluir</button>';
}else{
if(title)title.textContent='A caminho do passageiro';
if(sub)sub.textContent=(ride.passenger_name||'Passageiro')+(ride.passenger_phone?' · '+ride.passenger_phone:'')+'<br>Destino: '+(ride.destination||'—');
if(actions)actions.innerHTML='<button class="tp-call" type="button" onclick="duntaCallPassenger()"><i class="fa-solid fa-phone"></i> Ligar</button><button class="tp-start" type="button" onclick="duntaStartTrip()">Começar viagem</button><button class="tp-cancel" type="button" onclick="duntaCancelRide()">Cancelar</button>';
}
}else{
if(title)title.textContent=phase==='in_trip'?'Em viagem':'Motorista a caminho';
if(sub)sub.textContent=(ride.driver_name||'Motorista')+(ride.driver_phone?' · '+ride.driver_phone:'')+' · '+(ride.driver_vehicle_type==='mota'?'Mototáxi':'Táxi')+'<br>Destino: '+(ride.destination||'—');
if(actions)actions.innerHTML='<button class="tp-call" type="button" onclick="duntaCallDriver()"><i class="fa-solid fa-phone"></i> Ligar</button><button class="tp-cancel" type="button" onclick="duntaCancelRide()">Cancelar viagem</button>';
}
}catch(e){console.error('trip panel',e)}
};

if(typeof acceptRide==='function'&&!window.__duntaAcceptTripFixed){
window.__duntaAcceptTripFixed=1;
var _accTrip=acceptRide;
window.acceptRide=async function(){
var req=window.duntaIncomingRequest;var rid=req&&req.id;
try{if(rid){window.__duntaHandledRides=window.__duntaHandledRides||{};window.__duntaHandledRides[rid]=true;try{if(window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(rid))}catch(e){}}}catch(e){}
var result=await _accTrip.apply(this,arguments);
try{
if(window.duntaActiveRide){
window.duntaTripPhase='pickup';
duntaEnterTripMap();duntaRefreshTripPanel();
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
try{_hru(r)}catch(e){console.error(e)}
try{
if(!r)return;
window.duntaActiveRide=r;
if(r.status==='accepted'){
var s=getSession&&getSession();
if(s&&s.role==='passenger'){
window.duntaTripPhase=window.duntaTripPhase||'pickup';
duntaEnterTripMap();duntaRefreshTripPanel();
if(r.driver_id&&typeof watchRideDriver==='function')watchRideDriver(r.driver_id);
try{if(window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(r.id))}catch(e){}
setTimeout(function(){try{if(duntaMap)duntaMap.invalidateSize()}catch(e){}},300);
} else if(s&&s.role==='driver'){
duntaEnterTripMap();duntaRefreshTripPanel();
}
} else if(r.status==='cancelled'||r.status==='completed'){
duntaExitTripMap();window.duntaActiveRide=null;
if(typeof updUI==='function')updUI();
}
}catch(e){console.error(e)}
};
}

var _updUI0=typeof updUI==='function'?updUI:null;
if(_updUI0&&!window.__duntaUpdTripFixed){
window.__duntaUpdTripFixed=1;
window.updUI=function(){
_updUI0();
try{
if(window.duntaActiveRide&&window.duntaActiveRide.status==='accepted'){
duntaRefreshTripPanel();
var oldTrip=document.getElementById('dunta-driver-trip');
if(oldTrip)oldTrip.classList.remove('show');
}
}catch(e){}
};
}

if(!window.__duntaRidePoll){
window.__duntaRidePoll=1;
setInterval(function(){
try{
var s=getSession&&getSession();
if(!s||!duntaSupabase)return;
if(window.duntaActiveRide&&window.duntaActiveRide.status==='accepted')return;
if(!window.duntaActiveRide){
var q=duntaSupabase.from('ride_requests').select('*').eq('status','accepted').order('updated_at',{ascending:false}).limit(1);
if(s.role==='driver')q=q.eq('driver_id',s.id);else q=q.eq('passenger_id',s.id);
q.maybeSingle().then(function(res){
if(res.data){
window.duntaActiveRide=res.data;
window.duntaTripPhase=window.duntaTripPhase||'pickup';
if(typeof handleRideUpdate==='function')handleRideUpdate(res.data);
else duntaRefreshTripPanel();
}
});
}
}catch(e){}
},15000);
}
})();
