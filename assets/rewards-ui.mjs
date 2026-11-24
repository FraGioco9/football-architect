import {formatRewardAmount,seasonRewardReference} from './competition-rewards.mjs';
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
 const tbody=competition.querySelector('[data-season-reward-rows]'),status=competition.querySelector('[data-season-reward-status]');
 const placeholder=tbody.innerHTML;
 const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node};
 let signature='';
 function update(){
  const context=window.faCompetitionContext;
  const model=seasonRewardReference(competition.dataset.competitionRewards,context,{debug:window.faDebugEnabled===true});
  const locale=document.documentElement.lang||'en';
  if(!model){
   signature='';
   if(!tbody.querySelector('[data-reward-placeholder]'))tbody.innerHTML=placeholder;
   const waiting=!context?.seasonData&&window.faWorldState?.get?.()?.worldStatus!=='ready';
   tbody.dataset.rewardUnavailable=String(!waiting);
   status.hidden=waiting;
   return;
  }
  delete tbody.dataset.rewardUnavailable;
  status.hidden=!model.pending;
  const next=JSON.stringify([context.selectedSeason,locale,model]);
  if(next===signature)return;
  signature=next;
  tbody.replaceChildren(...model.rows.map(row=>{
   const tr=make('tr'),th=make('th');th.scope='row';
   const identity=make('span',undefined,'app-world-club-identity'),crest=make('span',undefined,'app-world-club-crest-placeholder');
   crest.dataset.clubCrest=row.id;crest.setAttribute('aria-hidden','true');
   const name=make('a',row.club.primaryName,'app-world-club-name app-world-standing-club-link');
   name.href='/clubs/'+row.club.countryId.toLowerCase()+'/'+row.club.clubId+'/overview';
   identity.append(crest,name);th.append(identity);
   tr.append(th,make('td',row.amount===null?'—':formatRewardAmount(row.amount,locale,{average:row.amount!==0})));
   return tr;
  }));
 }
 for(const event of ['fa:competition-context-change','fa:competition-route-change','fa:source-change','fa:world-state-change'])window.addEventListener(event,update);
 new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
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
