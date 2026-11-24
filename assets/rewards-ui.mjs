import {formatRewardAmount,rewardEvidenceState} from './competition-rewards.mjs';
function format(){
 const locale=document.documentElement.lang||'en';
 for(const node of document.querySelectorAll('[data-reward-amount]')){
  const root=node.closest('[data-competition-rewards],[data-admin-rewards]');
  const historic=root?.dataset.rewardHistory==='true';
  node.textContent=historic?'—':formatRewardAmount(Number(node.dataset.rewardAmount),locale,{average:node.hasAttribute('data-reward-average')});
 }
}
format();new MutationObserver(format).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
function evidence(root,key){
 root.dataset.rewardHistory=String(key==='rewardEvidenceHistory');
 for(const node of root.querySelectorAll('[data-reward-state]'))node.hidden=node.dataset.rewardState!==key;
 format();
}
const competition=document.querySelector('[data-competition-rewards]');
if(competition){
 const update=()=>evidence(competition,rewardEvidenceState({
  id:competition.dataset.competitionRewards,context:window.faCompetitionContext,
  worldSnapshot:window.faWorldState?.get?.(),debug:window.faDebugEnabled===true
 }));
 for(const event of ['fa:competition-context-change','fa:competition-route-change','fa:source-change','fa:world-state-change'])window.addEventListener(event,update);
 update();
}
const admin=document.querySelector('[data-admin-rewards]');
if(admin){
 const status=admin.querySelector('[data-admin-rewards-status]'),content=admin.querySelector('[data-admin-rewards-content]'),host=document.querySelector('#app-admin');
 const season=admin.querySelector('[data-admin-rewards-season]');
 let ticket=0,world=null;
 function seasonState(){evidence(admin,world?.seasonNumber===0?'rewardEvidenceZero':Number(season.value)<world?.seasonNumber?'rewardEvidenceHistory':'rewardEvidenceConfigOnly');}
 season?.addEventListener('change',seasonState);
 async function check(){
  const id=++ticket;content.hidden=true;status.hidden=false;status.dataset.appI18n='rewardChecking';status.textContent='Checking access…';window.faAppRenderLanguage?.();
  try{
   const res=await fetch('/api/admin/world',{credentials:'same-origin',cache:'no-store'});
   if(id!==ticket)return;
   if(!res.ok)throw Error(String(res.status));
   const data=await res.json();if(id!==ticket)return;
   if(!Number.isSafeInteger(data?.world?.seasonNumber)||data.world.seasonNumber<0)throw Error('invalid_world');
   world=data.world;
   if(season){const previous=Number(season.value);season.replaceChildren(...Array.from({length:Math.max(1,world.seasonNumber)},(_,i)=>{const n=world.seasonNumber===0?0:i+1;return new Option(String(n),String(n));}));season.value=String(previous>=1&&previous<=world.seasonNumber?previous:world.seasonNumber);season.disabled=world.seasonNumber===0;seasonState();}
   host.dataset.adminAccess='granted';content.hidden=false;status.hidden=true;
   window.faAdminAccess=true;window.dispatchEvent(new CustomEvent('fa:admin-access',{detail:true}));
  }catch(error){
   if(id!==ticket)return;
   host.dataset.adminAccess='denied';content.hidden=true;status.hidden=false;
   status.dataset.appI18n=['401','403'].includes(error.message)?'rewardForbidden':'rewardUnavailable';
   status.textContent=['401','403'].includes(error.message)?'Access denied':'Rewards unavailable';window.faAppRenderLanguage?.();
   window.faAdminAccess=false;window.dispatchEvent(new CustomEvent('fa:admin-access',{detail:false}));
  }
 }
 void check();window.addEventListener('pageshow',e=>{if(e.persisted)void check()});
}
