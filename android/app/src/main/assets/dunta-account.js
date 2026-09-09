(function(){
try{if(window.__duntaAccountDel)return;window.__duntaAccountDel=1}catch(e){}

function ensureDeleteUI(){
  try{
    var settings=document.getElementById('panel-settings');
    if(settings && !document.getElementById('dunta-delete-account-row')){
      var lc=settings.querySelector('.lc');
      if(lc){
        var btn=document.createElement('button');
        btn.id='dunta-delete-account-row';
        btn.className='lr';
        btn.type='button';
        btn.onclick=function(){duntaDeleteAccount()};
        btn.innerHTML='<span class="li" style="color:#C10F06"><i class="fa-solid fa-user-xmark real-icon"></i></span><span class="bd"><b style="color:#C10F06">Excluir conta</b><small>Apagar permanentemente os seus dados</small></span><span class="ch">›</span>';
        lc.appendChild(btn);
      }
    }
    var sec=document.getElementById('panel-security-settings');
    if(sec && !document.getElementById('dunta-delete-account-sec')){
      var box=sec.querySelector('.lc')||sec;
      var b2=document.createElement('button');
      b2.id='dunta-delete-account-sec';
      b2.className='lr';
      b2.type='button';
      b2.style.cssText='margin-top:8px;border:1px solid #7f1d1d';
      b2.onclick=function(){duntaDeleteAccount()};
      b2.innerHTML='<span class="bd"><b style="color:#C10F06">Excluir conta</b><small>Esta ação não pode ser anulada</small></span>';
      box.appendChild(b2);
    }
  }catch(e){console.error(e)}
}

window.duntaDeleteAccount=async function(){
  try{
    var s=null;try{s=getSession&&getSession()}catch(e){}
    if(!s||!s.id){
      if(typeof toast==='function')toast('Sessão inválida');
      return;
    }
    if(!confirm('Tem a certeza que deseja excluir a sua conta DUNTA TÁXI?'))return;
    if(!confirm('Todos os seus dados serão apagados de forma permanente. Continuar?'))return;
    if(typeof toast==='function')toast('A excluir conta…');

    try{if(typeof stopDriverSync==='function')stopDriverSync()}catch(e){}
    try{if(window.DuntaNative&&DuntaNative.stopDriverService)DuntaNative.stopDriverService()}catch(e){}

    if(window.duntaSupabase){
      var uid=s.id;
      try{await duntaSupabase.from('push_tokens').delete().eq('user_id',uid)}catch(e){}
      try{await duntaSupabase.from('drivers_locations').delete().eq('driver_id',uid)}catch(e){}
      try{await duntaSupabase.from('passenger_locations').delete().eq('passenger_id',uid)}catch(e){}
      try{
        await duntaSupabase.from('ride_requests').update({
          passenger_name:'Conta eliminada',
          passenger_phone:null,
          passenger_avatar_url:null,
          status:'cancelled',
          updated_at:new Date().toISOString()
        }).eq('passenger_id',uid).in('status',['pending','accepted']);
      }catch(e){}
      try{
        await duntaSupabase.from('ride_requests').update({
          driver_name:'Conta eliminada',
          driver_phone:null,
          driver_avatar_url:null,
          status:'cancelled',
          updated_at:new Date().toISOString()
        }).eq('driver_id',uid).in('status',['pending','accepted']);
      }catch(e){}
      try{await duntaSupabase.from('profiles').delete().eq('id',uid)}catch(e){}
      try{
        await duntaSupabase.from('profiles').update({
          name:'Conta eliminada',
          phone:null,
          avatar_url:null,
          deleted_at:new Date().toISOString()
        }).eq('id',uid);
      }catch(e){}
      try{await duntaSupabase.rpc('delete_own_account')}catch(e){}
      try{await duntaSupabase.auth.signOut()}catch(e){}
    }

    try{if(typeof saveSession==='function')saveSession(null)}catch(e){}
    try{localStorage.removeItem('dunta_session')}catch(e){}
    try{localStorage.clear()}catch(e){}

    if(typeof toast==='function')toast('Conta excluída');
    setTimeout(function(){
      try{location.reload()}catch(e){}
    },800);
  }catch(e){
    console.error(e);
    if(typeof toast==='function')toast('Erro ao excluir. Contacte o suporte.');
  }
};

setTimeout(ensureDeleteUI,600);
setTimeout(ensureDeleteUI,1500);
setInterval(ensureDeleteUI,4000);

if(typeof openPanel==='function'&&!window.__duntaOpenPanelDel){
  window.__duntaOpenPanelDel=1;
  var _op=openPanel;
  window.openPanel=function(n){
    try{_op(n)}catch(e){}
    if(n==='settings'||n==='security-settings'||n==='account')setTimeout(ensureDeleteUI,100);
  };
}
})();
