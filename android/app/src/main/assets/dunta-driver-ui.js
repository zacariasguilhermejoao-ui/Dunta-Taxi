(function(){
try{if(window.__duntaDriverUi)return;window.__duntaDriverUi=1}catch(e){}

try{
  if(!document.getElementById('dunta-driver-ui-css')){
    var ds=document.createElement('style');ds.id='dunta-driver-ui-css';
    ds.textContent=[
      'body.dunta-driver-mode #home .svc,body.dunta-driver-mode #home .search-box,body.dunta-driver-mode #home .search,body.dunta-driver-mode #btn-request,body.dunta-driver-mode #req,body.dunta-driver-mode .svc-card,body.dunta-driver-mode .where-to,body.dunta-driver-mode #go-btn,body.dunta-driver-mode #dest-sheet,body.dunta-driver-mode #destination,body.dunta-driver-mode #request,body.dunta-driver-mode .request-sheet{display:none!important;visibility:hidden!important;pointer-events:none!important;height:0!important;overflow:hidden!important}',
      'body.dunta-driver-mode #dunta-driver-bar,#dunta-driver-bar,#dunta-driver-trip{display:none!important}',
      '#dunta-drv-header{position:fixed;top:0;left:0;right:0;z-index:9000;display:none;padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;background:linear-gradient(180deg,rgba(11,15,13,.95),rgba(11,15,13,.7),transparent);pointer-events:none}',
      'body.dunta-driver-mode:not(.dunta-in-trip) #dunta-drv-header{display:block}',
      '#dunta-drv-header .dh-badge{display:inline-block;background:#C10F06;color:#FFD400;font-size:11px;font-weight:900;padding:4px 10px;border-radius:999px}',
      '#dunta-drv-header .dh-badge.mota{background:#7C3AED;color:#fff}',
      '#dunta-drv-header .dh-name{color:#fff;font-weight:800;font-size:15px;margin-top:4px}',
      '#dunta-drv-header .dh-status{font-size:12px;margin-top:2px}',
      '#dunta-drv-header .dh-status.on{color:#86efac}',
      '#dunta-drv-header .dh-status.off{color:#fca5a5}',
      'body.dunta-driver-mode .hh .brand:after{content:" · Motorista";font-size:11px;opacity:.75}',
      'body.dunta-driver-mode.dunta-mota .hh .brand:after{content:" · Mototaxista"}'
    ].join('');
    document.head.appendChild(ds);
  }
}catch(e){}

function ensureHeader(){
  if(document.getElementById('dunta-drv-header'))return;
  var h=document.createElement('div');h.id='dunta-drv-header';
  h.innerHTML='<span class="dh-badge" id="dh-badge">MOTORISTA</span><div class="dh-name" id="dh-name">—</div><div class="dh-status off" id="dh-status">Offline · abra ⋮ para ficar online</div>';
  document.body.appendChild(h);
}

window.duntaApplyDriverMode=function(){
  try{
    var s=null;try{s=getSession&&getSession()}catch(e){}
    var isDriver=!!(s&&s.role==='driver');
    document.body.classList.toggle('dunta-driver-mode',isDriver);
    if(isDriver&&s.vehicle&&String(s.vehicle).toLowerCase().indexOf('mota')>=0)document.body.classList.add('dunta-mota');
    else document.body.classList.remove('dunta-mota');
    ensureHeader();
    if(!isDriver)return;
    var isMota=s.vehicle&&String(s.vehicle).toLowerCase().indexOf('mota')>=0;
    var badge=document.getElementById('dh-badge');
    var name=document.getElementById('dh-name');
    var st=document.getElementById('dh-status');
    if(badge){badge.textContent=isMota?'MOTOTAXISTA':'MOTORISTA';badge.className='dh-badge'+(isMota?' mota':'')}
    if(name)name.textContent=s.name||'Motorista';
    var on=!!s.online;
    if(st){st.textContent=on?'Online · a receber pedidos (15 km)':'Offline · abra ⋮ para ficar online';st.className='dh-status '+(on?'on':'off')}
    ['btn-request','req','request','dest-sheet','destination','go-btn','where'].forEach(function(id){
      var el=document.getElementById(id);if(el){el.style.display='none';el.style.visibility='hidden';el.style.pointerEvents='none'}
    });
    try{document.querySelectorAll('#home .svc,#home .search-box,#home .search,.svc-card,.where-to').forEach(function(el){el.style.display='none'})}catch(e){}
    var bar=document.getElementById('dunta-driver-bar');if(bar){bar.style.display='none';bar.classList.remove('show')}
  }catch(e){console.error(e)}
};

(function blockRequests(){
  function block(){if(typeof toast==='function')toast('Motoristas não pedem viagem');return}
  function wrap(n){
    try{
      if(typeof window[n]==='function'&&!window['__blk_'+n]){
        window['__blk_'+n]=1;var o=window[n];
        window[n]=function(){try{var s=getSession&&getSession();if(s&&s.role==='driver')return block()}catch(e){}return o.apply(this,arguments)};
      }
    }catch(e){}
  }
  ['requestRide','openRequest','startRequest','showRequest','goRequest','submitRide'].forEach(wrap);
  if(!window.__drvClickBlk){
    window.__drvClickBlk=1;
    document.addEventListener('click',function(e){
      try{
        var s=getSession&&getSession();if(!s||s.role!=='driver')return;
        var t=e.target&&e.target.closest&&e.target.closest('#btn-request,#req,.svc-card,.where-to,[data-action="request"]');
        if(t){e.preventDefault();e.stopPropagation();block()}
      }catch(e){}
    },true);
  }
})();

setTimeout(function(){try{duntaApplyDriverMode()}catch(e){}},400);
setTimeout(function(){try{duntaApplyDriverMode()}catch(e){}},1200);
setInterval(function(){try{duntaApplyDriverMode()}catch(e){}},2500);

if(typeof updUI==='function'&&!window.__updDrv){
  window.__updDrv=1;var _u=updUI;
  window.updUI=function(){try{_u.apply(this,arguments)}catch(e){}try{duntaApplyDriverMode()}catch(e){}};
}
if(typeof window.duntaToggleOnlineFromMenu==='function'&&!window.__togHdr){
  window.__togHdr=1;var _t=window.duntaToggleOnlineFromMenu;
  window.duntaToggleOnlineFromMenu=function(){try{_t()}catch(e){}setTimeout(function(){try{duntaApplyDriverMode()}catch(e){}},500)};
}
})();
