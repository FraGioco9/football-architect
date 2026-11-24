function format(){const locale=document.documentElement.lang||'en';for(const node of document.querySelectorAll('[data-reward-amount]')){const value=Number(node.dataset.rewardAmount);if(Number.isFinite(value))node.textContent=(node.hasAttribute('data-reward-average')?'≈ ':'')+Math.round(value).toLocaleString(locale)+' ARC';}}
format();new MutationObserver(format).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
const admin=document.querySelector('[data-admin-rewards]');
if(admin){
 const status=admin.querySelector('[data-admin-rewards-status]'),content=admin.querySelector('[data-admin-rewards-content]'),host=document.querySelector('#app-admin');
 let ticket=0;
 async function check(){
  const id=++ticket;content.hidden=true;status.hidden=false;
  try{
   const res=await fetch('/api/admin/world',{credentials:'same-origin',cache:'no-store'});
   if(id!==ticket)return;
   if(!res.ok)throw Error(String(res.status));
   const data=await res.json();if(id!==ticket)return;
   if(!Number.isSafeInteger(data?.world?.seasonNumber))throw Error('invalid_world');
   host.dataset.adminAccess='granted';content.hidden=false;status.hidden=true;
   window.faAdminAccess=true;window.dispatchEvent(new CustomEvent('fa:admin-access',{detail:true}));
  }catch(error){
   if(id!==ticket)return;
   host.dataset.adminAccess='denied';content.hidden=true;status.hidden=false;
   status.dataset.appI18n=['401','403'].includes(error.message)?'rewardForbidden':'rewardUnavailable';
   status.textContent=['401','403'].includes(error.message)?'Access denied':'Rewards unavailable';
   window.faAdminAccess=false;window.dispatchEvent(new CustomEvent('fa:admin-access',{detail:false}));
  }
 }
 void check();window.addEventListener('pageshow',e=>{if(e.persisted)void check()});
}
