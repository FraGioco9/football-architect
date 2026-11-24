function format(){const locale=document.documentElement.lang||'en';for(const node of document.querySelectorAll('[data-reward-amount]')){const value=Number(node.dataset.rewardAmount);if(Number.isFinite(value))node.textContent=(node.hasAttribute('data-reward-average')?'≈ ':'')+Math.round(value).toLocaleString(locale)+' ARC';}}
format();new MutationObserver(format).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
function evidence(root,key){
 for(const node of root.querySelectorAll('[data-reward-state]'))node.hidden=node.dataset.rewardState!==key;
}
const competition=document.querySelector('[data-competition-rewards]');
if(competition){
 const update=()=>{
  const ctx=window.faCompetitionContext,source=ctx?.seasonData,world=source?.world??window.faWorldState?.get?.()?.world;
  let state='rewardEvidencePending';
  if(window.faDebugEnabled===true)state='rewardEvidenceDebug';
  else if(world?.seasonNumber===0)state='rewardEvidenceZero';
  else if(Number.isSafeInteger(ctx?.selectedSeason)&&Number.isSafeInteger(world?.seasonNumber)&&ctx.selectedSeason<world.seasonNumber)state='rewardEvidenceHistory';
  else if(ctx?.definition?.id===competition.dataset.competitionRewards&&source?.provenance?.kind==='authoritative'&&source.season===ctx.selectedSeason){
   const rounds=ctx.definition.category==='international'?6:30,rows=source.statistics?.standings;
   state=source.entrantsOnly?'rewardEvidenceEntrants':Array.isArray(rows)&&rows.length===source.participants?.length&&rows.every(r=>r.played===rounds)&&(!ctx.definition.category||ctx.definition.category==='domestic'||source.status==='available')?'rewardEvidenceComplete':'rewardEvidencePartial';
  }
  evidence(competition,state);
 };
 for(const event of ['fa:competition-context-change','fa:competition-route-change','fa:source-change'])window.addEventListener(event,update);
 update();
}
const admin=document.querySelector('[data-admin-rewards]');
if(admin){
 const status=admin.querySelector('[data-admin-rewards-status]'),content=admin.querySelector('[data-admin-rewards-content]'),host=document.querySelector('#app-admin');
 const season=admin.querySelector('[data-admin-rewards-season]');
 let ticket=0,world=null;
 function seasonState(){evidence(admin,world?.seasonNumber===0?'rewardEvidenceZero':Number(season.value)<world?.seasonNumber?'rewardEvidenceHistory':'rewardEvidencePending');}
 season?.addEventListener('change',seasonState);
 async function check(){
  const id=++ticket;content.hidden=true;status.hidden=false;
  try{
   const res=await fetch('/api/admin/world',{credentials:'same-origin',cache:'no-store'});
   if(id!==ticket)return;
   if(!res.ok)throw Error(String(res.status));
   const data=await res.json();if(id!==ticket)return;
   if(!Number.isSafeInteger(data?.world?.seasonNumber))throw Error('invalid_world');
   world=data.world;
   if(season){const previous=Number(season.value);season.replaceChildren(...Array.from({length:Math.max(1,world.seasonNumber)},(_,i)=>{const n=world.seasonNumber===0?0:i+1;return new Option(String(n),String(n));}));season.value=String(previous>=1&&previous<=world.seasonNumber?previous:world.seasonNumber);season.disabled=world.seasonNumber===0;seasonState();}
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
