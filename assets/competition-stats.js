/* Public statistics presentation. Providers supply data; this module never simulates matches. */
((root,factory)=>{
 const api=factory();root.faCompetitionStats=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const views=[['overview','statsDevOverview','Overview'],['teams','statsDevTeams','Teams'],['players','statsDevPlayers','Players']];
 const overview=[['matchesPlayed','statsDevMatchesPlayed','Matches played'],['totalGoals','statsDevTotalGoals','Total goals'],['goalsPerMatch','statsDevGoalsPerMatch','Goals per match']];
 const teams=[['gf','statsDevGoalsScored','Goals scored',false],['ga','statsDevFewestConceded','Fewest conceded',true],['w','statsDevWins','Wins',false],['cs','statsDevCleanSheets','Clean sheets',false],['ppg','statsDevPointsPerMatch','Points per match',false],['gd','statsDevGoalDifference','Goal difference',false],['unbeatenStreak','statsDevUnbeatenStreak','Unbeaten streak',false]];
 const players=[['goals','statsDevGoals','Goals'],['assists','statsDevAssists','Assists'],['averageRating','statsDevAverageRating','Average rating'],['cleanSheets','statsDevCleanSheets','Clean sheets']];
 const mounted=new WeakMap(),identity=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
 const text=value=>typeof value==='string'&&value.trim().length>0;
 const count=value=>Number.isSafeInteger(value)&&value>=0;
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const emptyHtml='<p data-app-i18n="statsDevNoData" class="fa-dev-stats-empty">No statistics yet.</p>';
 function renderEmpty(){
  return '<div id="fa-dev-stats"><div class="fa-dev-stats-nav" role="group" aria-label="Stats" data-app-aria="competitionTabStats">'+views.map(([id,key,label],i)=>'<button type="button" class="language-trigger" data-stats-view="'+id+'" data-app-i18n="'+key+'" aria-pressed="'+(i===0)+'" tabindex="'+(i===0?'0':'-1')+'">'+label+'</button>').join('')+'</div><div class="fa-dev-stats-content"><div class="app-competition-stat-grid fa-dev-stats-grid">'+overview.map(([,key,label])=>'<div class="app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-card"><span class="app-competition-stat-label" data-app-i18n="'+key+'">'+label+'</span>'+emptyHtml+'</div>').join('')+'</div></div></div>';
 }
 function normalize(context){
  const data=context?.seasonData,statistics=data?.statistics;
  if(!statistics||!statistics.overview)return null;
  if(data.season!==context.selectedSeason||data.rulesVersion!==context.definition.rules.version)throw Error('Statistics season/rules mismatch');
  const o=statistics.overview;
  if(!count(o.matchesPlayed)||!count(o.totalGoals)||!finite(o.goalsPerMatch)||o.goalsPerMatch<0||!Array.isArray(statistics.teams)||!Array.isArray(data.participants)||data.participants.length!==context.definition.capacity)throw Error('Invalid supplied statistics');
  if(o.matchesPlayed===0)return null;
  const participants=new Map(data.participants.map(club=>[club.countryId+'-'+club.clubId,club]));
  if(participants.size!==context.definition.capacity||[...participants.keys()].some(key=>!identity.test(key)))throw Error('Invalid statistics participants');
  const seen=new Set();
  const records=statistics.teams.map(team=>{
   if(!team||!participants.has(team.clubKey)||seen.has(team.clubKey)||!text(team.clubName)||!count(team.mp))throw Error('Invalid team statistic identity');
   seen.add(team.clubKey);
   if(team.mp===0)return null;
   for(const [key] of teams)if(!finite(team[key])||(key!=='gd'&&team[key]<0)||(key!=='ppg'&&!Number.isSafeInteger(team[key])))throw Error('Invalid team statistic');
   return {...team};
  }).filter(Boolean);
  const playerIds=new Set();
  const people=(statistics.players||[]).map(player=>{
   if(!player||!text(player.playerId)||playerIds.has(player.playerId)||!text(player.name)||!participants.has(player.clubKey)||!count(player.appearances)||player.appearances<1)throw Error('Invalid player statistic');
   playerIds.add(player.playerId);
   for(const [key] of players)if(player[key]!==undefined&&(!finite(player[key])||player[key]<0||key!=='averageRating'&&!Number.isSafeInteger(player[key])))throw Error('Invalid player metric');
   return {...player};
  });
  return {overview:{...o},teams:records,players:people};
 }
 function mount(panel,initial){
  if(mounted.has(panel)){const api=mounted.get(panel);api.update(initial);return api;}
  const create=(tag,value,cls)=>{const node=document.createElement(tag);if(value!==undefined)node.textContent=String(value);if(cls)node.className=cls;return node};
  const localized=(tag,key,value,cls)=>{const node=create(tag,value,cls);node.dataset.appI18n=key;return node};
  const sync=()=>window.faAppRenderLanguage?.();
  const root=create('div');root.id='fa-dev-stats';
  const nav=create('div',undefined,'fa-dev-stats-nav');nav.setAttribute('role','group');nav.setAttribute('aria-label','Stats');nav.dataset.appAria='competitionTabStats';
  const content=create('div',undefined,'fa-dev-stats-content');root.append(nav,content);panel.replaceChildren(root);
  let context=null,stats=null,view='overview',revision=-1,dialog=null,opener=null,closeTimer=null,destroyed=false,invalid=false;
  const navButtons=[];
  const removeDialog=(restore=true)=>{
   if(!dialog)return;const current=dialog;dialog=null;clearTimeout(closeTimer);
   if(current.open)current.close();current.remove();
   if(restore&&opener?.isConnected)opener.focus({preventScroll:true});opener=null;
  };
  const empty=(player=false)=>localized('p',invalid?'statsDevUnavailable':player&&stats?'statsDevNoPlayerData':'statsDevNoData',invalid?'Statistics are unavailable.':player&&stats?'No player statistics yet.':'No statistics yet.','fa-dev-stats-empty');
  const format=(key,value)=>key==='ppg'||key==='goalsPerMatch'||key==='averageRating'?value.toFixed(2):String(value);
  function row(record,index,list,key,player=false){
   const li=create('li'),rank=list.findIndex(candidate=>candidate[key]===record[key])+1;
   const identityNode=create('span',undefined,'app-world-club-identity'),crest=create('span',undefined,'app-world-club-crest-placeholder');
   crest.dataset.clubCrest=record.clubKey;crest.setAttribute('aria-hidden','true');
   const match=record.clubKey.match(identity),name=create(player?'span':'a',player?record.name:record.clubName,'fa-dev-stats-team-name'+(player?'':' app-world-standing-club-link'));
   if(!player)name.href='/clubs/'+match[1].toLowerCase()+'/'+match[2]+'/overview';
   identityNode.append(crest,name);li.append(create('span',rank,'fa-dev-stats-rank'),identityNode,create('strong',format(key,record[key])));return li;
  }
  function showAll(button,records,key,labelKey,label,player){
   removeDialog(false);opener=button;
   const current=create('dialog',undefined,'fa-dev-stats-dialog');dialog=current;
   const header=create('div',undefined,'fa-dev-stats-dialog-header'),title=localized('h3',labelKey,label);title.id='fa-dev-stats-dialog-title';
   current.setAttribute('aria-labelledby',title.id);
   const close=create('button','×','fa-dev-stats-dialog-close');close.type='button';close.dataset.appAria='statsDevClose';close.setAttribute('aria-label','Close');
   let closing=false,pointerDismiss=false,pressedOutside=false;
   const finish=()=>{
    if(dialog!==current)return;
    const pointer=pointerDismiss;removeDialog(!pointer);
    if(pointer&&document.activeElement===button)button.blur();
   };
   const dismiss=()=>{
    if(closing||dialog!==current)return;closing=true;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finish();return;}
    current.classList.add('fa-dev-stats-closing');closeTimer=setTimeout(finish,250);
   };
   close.addEventListener('pointerdown',()=>{pointerDismiss=true});close.addEventListener('click',dismiss);
   current.addEventListener('cancel',event=>{event.preventDefault();dismiss()});
   current.addEventListener('animationend',event=>{if(event.target===current&&event.animationName==='fa-stats-dialog-out')finish()});
   const outside=event=>{if(event.target!==current)return false;const b=current.getBoundingClientRect();return event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom};
   current.addEventListener('pointerdown',event=>{pressedOutside=outside(event)});
   current.addEventListener('pointercancel',()=>{pressedOutside=false});
   current.addEventListener('click',event=>{if(event.detail!==0&&event.button===0&&pressedOutside&&outside(event)){pointerDismiss=true;dismiss()}pressedOutside=false});
   current.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();current.scrollBy({top:event.key==='ArrowDown'?64:-64,behavior:'smooth'})}
    else if(event.key==='Home'||event.key==='End'){event.preventDefault();current.scrollTo({top:event.key==='Home'?0:current.scrollHeight,behavior:'smooth'})}
   });
   current.addEventListener('close',()=>{if(dialog===current){dialog=null;clearTimeout(closeTimer);current.remove();if(opener?.isConnected)opener.focus({preventScroll:true});opener=null}});
   header.append(title,close);const all=create('ol',undefined,'fa-dev-stats-top');records.forEach((record,i)=>all.append(row(record,i,records,key,player)));current.append(header,all);
   window.dispatchEvent(new Event('fa:stats-dialog-open'));document.body.append(current);current.showModal();sync();close.focus();
  }
  function render(){
   for(let i=0;i<navButtons.length;i++){const active=views[i][0]===view;navButtons[i].setAttribute('aria-pressed',active);navButtons[i].tabIndex=active?0:-1;}
   content.replaceChildren();
   if(view==='overview'){
    const grid=create('div',undefined,'app-competition-stat-grid fa-dev-stats-grid');
    for(const [key,labelKey,label] of overview){const card=create('div',undefined,'app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-card');card.append(localized('span',labelKey,label,'app-competition-stat-label'),stats?create('strong',format(key,stats.overview[key]),'app-competition-stat-value'):empty());grid.append(card)}
    content.append(grid);
   }else{
    const player=view==='players',section=create('section',undefined,'fa-dev-stats-section'),grid=create('div',undefined,'fa-dev-stats-leader-grid');
    for(const [key,labelKey,label,ascending=false] of player?players:teams){
     const card=create('section',undefined,'app-competition-stat-card '+(player?'app-competition-stat-card--compact':'app-competition-stat-card--fluid')+' fa-dev-stats-leader-card'+(player?'':' fa-dev-stats-team-card'));
     card.append(localized('h4',labelKey,label,'app-competition-stat-label fa-dev-stats-leader-title'));
     const records=[...(stats?.[player?'players':'teams']||[])].filter(record=>record[key]!==undefined).sort((a,b)=>(ascending?a[key]-b[key]:b[key]-a[key])||(player?a.name.localeCompare(b.name):a.clubName.localeCompare(b.clubName))||(a.clubKey.localeCompare(b.clubKey)));
     if(records.length){const top=create('ol',undefined,'fa-dev-stats-top');records.slice(0,5).forEach((record,i)=>top.append(row(record,i,records,key,player)));card.append(top)}else card.append(empty(player));
     if(records.length>5){const expand=localized('button','statsDevShowAll','Show all','fa-dev-stats-expand');expand.type='button';expand.addEventListener('click',()=>showAll(expand,records,key,labelKey,label,player));card.append(expand)}
     grid.append(card);
    }
    section.append(grid);content.append(section);
   }
   sync();
  }
  views.forEach(([id,key,label],index)=>{
   const button=localized('button',key,label,'language-trigger');button.type='button';button.dataset.statsView=id;
   const select=focus=>{removeDialog(false);view=id;render();if(focus)button.focus()};
   button.addEventListener('click',()=>select(false));
   button.addEventListener('keydown',event=>{
    const next=event.key==='ArrowRight'?(index+1)%3:event.key==='ArrowLeft'?(index+2)%3:event.key==='Home'?0:event.key==='End'?2:null;
    if(next===null)return;event.preventDefault();removeDialog(false);view=views[next][0];render();navButtons[next].focus();
   });navButtons.push(button);nav.append(button);
  });
  const api=Object.freeze({
   update(next){
    if(destroyed||Number.isSafeInteger(next?.revision)&&next.revision<revision)return false;
    const valid=next&&Number.isSafeInteger(next.revision)&&next.revision>=0&&text(next.definition?.id)&&count(next.definition.capacity)&&next.definition.capacity>0&&text(next.definition.rules?.version)&&Number.isSafeInteger(next.selectedSeason)&&next.selectedSeason>0;
    if(!valid){
     if(Number.isSafeInteger(next?.revision))revision=next.revision;
     const hadDialog=Boolean(dialog);removeDialog(false);stats=null;invalid=true;render();
     if(hadDialog)navButtons[views.findIndex(item=>item[0]===view)].focus();return false;
    }
    if(context&&next.definition.id!==context.definition.id)return false;
    if(next.revision===revision){removeDialog(false);return false;}
    revision=next.revision;context=next;const hadDialog=Boolean(dialog);removeDialog(false);
    invalid=false;try{stats=normalize(next)}catch{stats=null;invalid=true}render();if(hadDialog)navButtons[views.findIndex(item=>item[0]===view)].focus();return true;
   },
   destroy(){if(destroyed)return;destroyed=true;removeDialog(false);root.remove();mounted.delete(panel)}
  });
  mounted.set(panel,api);api.update(initial);return api;
 }
 return Object.freeze({mount,renderEmpty});
});
