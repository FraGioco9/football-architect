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
 const tbody=competition.querySelector('[data-season-reward-rows]'),status=competition.querySelector('[data-season-reward-status]'),table=tbody.closest('table');
 const placeholder=tbody.innerHTML;
 const make=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node};
 let signature='';
 function update(){
  const context=window.faCompetitionContext,read=window.faCompetitionSeasonReadState;
  const debug=window.faDebugEnabled===true;
  const model=seasonRewardReference(competition.dataset.competitionRewards,context,{debug});
  const locale=document.documentElement.lang||'en';
  const sameRead=!!read&&!!context&&read?.id===context?.definition?.id&&read?.season===context?.selectedSeason;
  // The world may already be ready while the selected season GET is pending.
  // Only a settled read for this exact competition and season can end its skeleton.
  const settled=debug||read?.state==='unavailable'&&read.id===null||sameRead&&['empty','unavailable','available','partial','debug'].includes(read.state);
  if(!model){
   signature='';
   if(!tbody.querySelector('[data-reward-placeholder]'))tbody.innerHTML=placeholder;
   const loading=!settled;
   tbody.dataset.rewardUnavailable=String(!loading);
   table.setAttribute('aria-busy',String(loading));
   status.hidden=loading;
   return;
  }
  delete tbody.dataset.rewardUnavailable;
  table.setAttribute('aria-busy','false');
  status.hidden=true;
  const next=JSON.stringify([context.selectedSeason,locale,model]);
  if(next===signature)return;
  signature=next;
  const rows=model.rows.map(row=>{
   const tr=make('tr'),th=make('th');th.scope='row';tr.dataset.rewardClub=row.id;
   const identity=make('span',undefined,'app-world-club-identity'),crest=make('span',undefined,'app-world-club-crest-placeholder');
   crest.dataset.clubCrest=row.id;crest.setAttribute('aria-hidden','true');
   if(Object.hasOwn(window.faClubCrests||{},row.id))crest.dataset.clubCrestPending='true';
   const name=make('a',row.club.primaryName,'app-world-club-name app-world-standing-club-link');
   name.href=window.faRoutesRegistry?.buildRoute({kind:'club',country:row.club.countryId.toLowerCase(),id:row.club.clubId,view:'overview'})||'/clubs/'+row.club.countryId.toLowerCase()+'/'+row.club.clubId+'/overview';
   identity.append(crest,name);th.append(identity);
   const td=make('td',undefined,'fa-reward-value-cell');
   td.append(make('span',row.amount===null?'—':formatRewardAmount(row.amount,locale,{average:!Number.isSafeInteger(row.amount)}),'fa-reward-value'));
   tr.append(th,td);return tr;
  });
  if(window.faCompetitionRenderDOM)window.faCompetitionRenderDOM.keyed(tbody,rows,row=>row.dataset.rewardClub);
  else tbody.replaceChildren(...rows);
 }
 for(const event of ['fa:competition-context-change','fa:competition-route-change','fa:source-change','fa:competition-season-read-state'])window.addEventListener(event,update);
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
