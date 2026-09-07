(function(){
              try{if(!document.getElementById('dunta-native-fixes')){var s=document.createElement('style');s.id='dunta-native-fixes';s.textContent='html,body{width:100%!important;overflow-x:hidden!important}#dunta-driver-bar{position:fixed;left:12px;right:12px;bottom:18px;z-index:9999;background:#111;border:1px solid #333;border-radius:16px;padding:12px;display:none;color:#fff}#dunta-driver-bar.show{display:block}#dunta-driver-trip{position:fixed;left:12px;right:12px;top:64px;z-index:9998;background:#111827;border-radius:14px;padding:12px;color:#fff;display:none}#dunta-driver-trip.show{display:block}.driver-self-marker{width:42px;height:42px;border-radius:50%;background:#C10F06;border:3px solid #fff;display:grid;place-items:center}.driver-self-marker i{color:#FFD400}body.dunta-driver-mode #home .svc,body.dunta-driver-mode #home .search-box,body.dunta-driver-mode #btn-request,body.dunta-driver-mode #req{display:none!important}body.dunta-driver-mode #dunta-driver-bar{display:block}body.dunta-driver-mode .hh .brand:after{content:\' · App Motorista\';font-size:11px;opacity:.7}';document.head.appendChild(s)}}catch(e){}
              try{window.DUNTA_DRIVER_RADIUS_KM=15;if(typeof DUNTA_DRIVER_RADIUS_KM!=='undefined')DUNTA_DRIVER_RADIUS_KM=15}catch(e){}
              function isDrv(){try{var s=getSession&&getSession();return !!(s&&s.role==='driver')}catch(e){return false}}
              function ensureUI(){
                if(!document.getElementById('dunta-driver-bar')){
                  var b=document.createElement('div');b.id='dunta-driver-bar';
                  b.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div style="min-width:0"><div style="display:flex;align-items:center;gap:8px"><span id="db-badge" style="background:#C10F06;color:#FFD400;font-size:11px;font-weight:800;padding:3px 8px;border-radius:999px">MOTORISTA</span><b id="db-title" style="font-size:14px">—</b></div><div id="db-sub" style="font-size:12px;opacity:.8;margin-top:4px">Fique online para receber pedidos</div></div><button id="db-toggle" style="border:0;border-radius:12px;padding:12px 14px;font-weight:800;background:#C10F06;color:#fff;white-space:nowrap">Online</button></div>';
                  document.body.appendChild(b);
                  document.getElementById('db-toggle').onclick=function(){if(typeof toggleOnline==='function')toggleOnline();setTimeout(updUI,400)};
                }
              }
              window.duntaCallNumber=function(num){
                try{
                  if(!num){if(typeof toast==='function')toast('Número indisponível');return}
                  var clean=String(num).replace(/[^0-9+]/g,'');
                  if(!clean){if(typeof toast==='function')toast('Número inválido');return}
                  if(window.DuntaNative&&typeof DuntaNative.dialPhone==='function'){DuntaNative.dialPhone(clean);return;}
                  var a=document.createElement('a');a.href='tel:'+clean;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(function(){try{a.remove()}catch(e){}},500);
                }catch(e){console.error(e);try{window.location.href='tel:'+String(num).replace(/[^0-9+]/g,'')}catch(x){}}
              };
              window.duntaCallPassenger=function(){
                try{
                  var ride=window.duntaActiveRide||window.duntaIncomingRequest;
                  var phone=(ride&&(ride.passenger_phone||ride.phone))||'';
                  if(!phone){if(typeof toast==='function')toast('Telefone do passageiro indisponível');return}
                  duntaCallNumber(phone);
                }catch(e){console.error(e);if(typeof toast==='function')toast('Não foi possível ligar')}
              };
              window.duntaCallDriver=function(){
                try{
                  var ride=window.duntaActiveRide;
                  var phone=(ride&&(ride.driver_phone||ride.phone))||'';
                  if(!phone){if(typeof toast==='function')toast('Telefone do motorista indisponível');return}
                  duntaCallNumber(phone);
                }catch(e){console.error(e);if(typeof toast==='function')toast('Não foi possível ligar')}
              };
              function updUI(){
                try{
                  ensureUI();
                  var s=getSession&&getSession();
                  var d=!!(s&&s.role==='driver');
                  document.body.classList.toggle('dunta-driver-mode',d);
                  var bar=document.getElementById('dunta-driver-bar');
                  if(!d){if(bar)bar.classList.remove('show');return}
                  if(bar)bar.classList.add('show');
                  var on=!!(s&&s.online);
                  var title=document.getElementById('db-title'),sub=document.getElementById('db-sub'),btn=document.getElementById('db-toggle');
                  var roleLabel=s.vehicle==='mota'?'MOTOTAXISTA':'MOTORISTA';
                  var badge=document.getElementById('db-badge');
                  if(badge){badge.textContent=roleLabel;badge.style.background=s.vehicle==='mota'?'#7C3AED':'#C10F06'}
                  if(title)title.textContent=on?'Online':'Offline';
                  if(sub)sub.textContent=on?'A receber pedidos num raio de 15 km':'Toque para ficar online e receber pedidos';
                  if(btn){btn.textContent=on?'Ficar offline':'Ficar online';btn.style.background=on?'#16A34A':'#C10F06'}
                }catch(e){}
              }
              if(typeof setMe==='function'&&!window.__duntaSetMeFixed){
                window.__duntaSetMeFixed=1;var _sm=setMe;
                window.setMe=function(lat,lng,acc){
                  _sm(lat,lng,acc);
                  try{
                    if(isDrv()&&duntaMap&&L){
                      if(!window._selfDrv){
                        window._selfDrv=L.marker([lat,lng],{icon:L.divIcon({className:'',html:'<div class="driver-self-marker"><i class="fa-solid fa-taxi"></i></div>',iconSize:[42,42],iconAnchor:[21,21]}),zIndexOffset:1000}).addTo(duntaMap);
                        window._selfDrv.bindPopup('<b>A minha posição</b>');duntaMap.setView([lat,lng],16);
                      }else window._selfDrv.setLatLng([lat,lng]);
                    }
                    if(typeof loadNearbyDrivers==='function')loadNearbyDrivers();
                    var s=getSession&&getSession();
                    if(s&&s.role==='driver'&&s.online&&typeof publishDriverLocation==='function'){
                      var n=Date.now();if(!window._lp||n-window._lp>4000){window._lp=n;publishDriverLocation()}
                    }
                  }catch(e){}
                };
              }
              if(typeof loadNearbyDrivers==='function'&&!window.__duntaLoadDriversFixed){
                window.__duntaLoadDriversFixed=1;
                window.loadNearbyDrivers=async function(){
                  if(!duntaSupabase||!duntaMap)return;
                  try{
                    var res=await duntaSupabase.from('drivers_locations').select('id,driver_id,driver_name,vehicle_type,avatar_url,phone,latitude,longitude,is_online,updated_at').eq('is_online',true);
                    var data=res.data||[],active=new Set(),now=Date.now(),me=null;
                    if(duntaMe)me=duntaMe.getLatLng();else if(duntaPassengerLocation)me=duntaPassengerLocation;
                    data.forEach(function(d){
                      var lat=+d.latitude,lng=+d.longitude,u=d.updated_at?Date.parse(d.updated_at):now;
                      if(!Number.isFinite(lat)||!Number.isFinite(lng)||now-u>120000)return;
                      try{var s=getSession();if(s&&d.driver_id===s.id)return}catch(e){}
                      if(me){var dist=distanceKm(me.lat||me.latitude,me.lng||me.longitude,lat,lng);if(dist>15)return}
                      var id=d.id||d.driver_id;active.add(id);
                      if(typeof addDriver==='function')addDriver(id,d.driver_name,d.vehicle_type,lat,lng,d.avatar_url,d.phone,u);
                    });
                    if(duntaDrivers)[...duntaDrivers.keys()].forEach(function(id){if(!active.has(id)&&typeof clearDriver==='function')clearDriver(id)});
                  }catch(e){console.error(e)}
                };
              }
              if(typeof acceptRide==='function'&&!window.__duntaAcceptFixed){
                window.__duntaAcceptFixed=1;
                window.acceptRide=async function(){
                  try{
                    if(!duntaIncomingRequest||!duntaSupabase){toast&&toast('Pedido inválido');return}
                    var s=getSession&&getSession();
                    if(!s||s.role!=='driver'){toast&&toast('Só motoristas');return}
                    var req=duntaIncomingRequest;
                    var dm=document.getElementById('dm');if(dm)dm.classList.remove('show');
                    toast&&toast('A aceitar…');
                    if(!s.online){s.online=true;saveSession&&saveSession(s);startDriverSync&&startDriverSync()}
                    if(typeof publishDriverLocation==='function')await publishDriverLocation();
                    var payload={status:'accepted',driver_id:s.id,driver_location_id:duntaDriverRecordId||null,driver_name:s.name||'Motorista',driver_avatar_url:s.avatar_url||null,driver_phone:s.phone||null,driver_vehicle_type:s.vehicle||'taxi',updated_at:new Date().toISOString()};
                    var r=await duntaSupabase.from('ride_requests').update(payload).eq('id',req.id).eq('status','pending').select().single();
                    if(r.error||!r.data)r=await duntaSupabase.from('ride_requests').update(payload).eq('id',req.id).select().single();
                    if(r.error||!r.data){toast&&toast('Não foi possível aceitar');return}
                    duntaActiveRide=r.data;duntaIncomingRequest=null;
                    if(typeof watchRidePassenger==='function')watchRidePassenger(r.data.id);
                    if(r.data.passenger_lat&&r.data.passenger_lng){
                      var plat=+r.data.passenger_lat,plng=+r.data.passenger_lng;
                      if(typeof setPassengerMarker==='function')setPassengerMarker(plat,plng,r.data.passenger_name,r.data.passenger_avatar_url);
                      if(duntaMap)duntaMap.setView([plat,plng],15);
                      try{if(typeof drawLiveRideRoute==='function')drawLiveRideRoute()}catch(e){}
                      try{if(typeof drawRoadRoute==='function')drawRoadRoute(plat,plng)}catch(e){}
                    }
                    toast&&toast('Pedido aceite!');updUI();
                    if(typeof startDriverSync==='function')startDriverSync();
                    try{if(req&&req.id&&window.DuntaNative&&DuntaNative.markRideHandled)DuntaNative.markRideHandled(String(req.id))}catch(e){}
                  }catch(e){console.error(e);toast&&toast('Erro ao aceitar')}
                };
              }
              if(typeof subscribeRideRequests==='function'&&!window.__duntaReqFixed){
                window.__duntaReqFixed=1;
                window.subscribeRideRequests=function(){
                  var s=getSession&&getSession();if(!s||s.role!=='driver'||!duntaSupabase)return;
                  try{duntaSupabase.removeChannel(window._reqChan)}catch(e){}
                  window._reqChan=duntaSupabase.channel('req-f-'+Date.now()).on('postgres_changes',{event:'INSERT',schema:'public',table:'ride_requests'},function(p){
                    var r=p.new;if(!r||r.status!=='pending')return;
                    if(r.vehicle_type&&r.vehicle_type!=='any'&&r.vehicle_type!==(s.vehicle||'taxi'))return;
                    if(Date.now()-new Date(r.created_at||0).getTime()>18e4)return;
                    if(duntaMe){var x=duntaMe.getLatLng();if(distanceKm(x.lat,x.lng,+r.passenger_lat,+r.passenger_lng)>15)return}
                    if(window.duntaActiveRide&&window.duntaActiveRide.status==='accepted')return;
                    showDriverRequest&&showDriverRequest(r);toast&&toast('Novo pedido próximo!');
                  }).subscribe();
                };
              }
              if(typeof startDriverSync==='function'&&!window.__duntaLiveFixed){
                window.__duntaLiveFixed=1;
                window.startDriverSync=function(){
                  if(duntaLocationTimer)clearInterval(duntaLocationTimer);
                  try{syncNativeDriverSession&&syncNativeDriverSession()}catch(e){}
                  try{DuntaNative&&DuntaNative.startDriverService()}catch(e){}
                  startGPS&&startGPS();
                  duntaLocationTimer=setInterval(function(){publishDriverLocation&&publishDriverLocation()},5000);
                  publishDriverLocation&&publishDriverLocation();updUI();
                };
              }
              if(typeof drawDestinationRoute==='function'&&typeof drawFakeRoute==='function')drawFakeRoute=function(){return drawDestinationRoute()};
              if(!window.__duntaNativeEnterWrapped&&typeof enterApp==='function'){
                window.__duntaNativeEnterWrapped=1;var _en=enterApp;
                window.enterApp=function(){
                  try{_en()}catch(e){try{document.getElementById('auth').classList.add('hidden');document.getElementById('app').classList.remove('hidden');refreshAccount&&refreshAccount()}catch(x){}setTimeout(function(){initMap&&initMap();initSupabase&&initSupabase()},150)}
                  setTimeout(function(){
                    updUI();
                    if(isDrv()){var s=getSession();if(s&&s.online&&startDriverSync)startDriverSync();subscribeRideRequests&&subscribeRideRequests()}
                    loadNearbyDrivers&&loadNearbyDrivers();subscribeDrivers&&subscribeDrivers();
                  },700);
                };
              }
              if(!window.__duntaBootSplash){
                window.__duntaBootSplash=1;
                setTimeout(function(){
                  var has=!!localStorage.getItem('dunta_session');
                  if(typeof showDuntaSplash==='function')showDuntaSplash(function(){if(has&&enterApp)enterApp();else if(showAuth)showAuth('start')});
                  setTimeout(updUI,1000);
                },80);
              }
              if(!window.__duntaDriversRefresh){window.__duntaDriversRefresh=1;setInterval(function(){loadNearbyDrivers&&loadNearbyDrivers()},8000)}
              window.drawRoadRoute=async function(destLat,destLng){
                try{
                  if(!duntaMap||!duntaMe)return;
                  var p=duntaMe.getLatLng();
                  if(window.routeLine){try{duntaMap.removeLayer(window.routeLine)}catch(e){}}
                  var u='https://router.project-osrm.org/route/v1/driving/'+p.lng+','+p.lat+';'+destLng+','+destLat+'?overview=full&geometries=geojson';
                  var r=await fetch(u);if(!r.ok)throw new Error('route');
                  var j=await r.json();
                  var coords=j.routes&&j.routes[0]&&j.routes[0].geometry&&j.routes[0].geometry.coordinates;
                  if(!coords||!coords.length)throw new Error('empty');
                  window.routeLine=L.polyline(coords.map(function(x){return[x[1],x[0]]}),{color:'#16A34A',weight:6,opacity:0.95}).addTo(duntaMap);
                  duntaMap.fitBounds(window.routeLine.getBounds(),{padding:[50,50]});
                  var km=(j.routes[0].distance||0)/1000,mins=Math.max(1,Math.round((j.routes[0].duration||0)/60));
                  var eta=document.getElementById('eta');
                  if(eta){eta.style.display='block';eta.innerHTML='~'+mins+' min<small>'+km.toFixed(1)+' km pelas estradas</small>'}
                  if(window._routeEndMarker)try{duntaMap.removeLayer(window._routeEndMarker)}catch(e){}
                  window._routeEndMarker=L.marker([destLat,destLng]).addTo(duntaMap).bindPopup('<b>Destino</b>');
                }catch(e){console.error('drawRoadRoute',e)}
              };
              if(typeof drawDestinationRoute==='function'&&!window.__duntaRoadRouteFixed){
                window.__duntaRoadRouteFixed=1;var _ddr=drawDestinationRoute;
                window.drawDestinationRoute=async function(){
                  try{if(duntaDestinationCoords){await window.drawRoadRoute(duntaDestinationCoords.lat,duntaDestinationCoords.lng);return;}}catch(e){}
                  try{return await _ddr.apply(this,arguments)}catch(e){}
                };
              }
              setTimeout(updUI,400);
            })();
