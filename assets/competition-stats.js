/* Public statistics presentation. Providers supply data; this module never simulates matches. */
((root,factory)=>{
 const api=factory();root.faCompetitionStats=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,()=>{
 'use strict';
 const views=[['overview','statsDevOverview','Overview'],['teams','statsDevTeams','Teams'],['players','statsDevPlayers','Players']];
 const overview=[['matchesPlayed','statsDevMatchesPlayed','Matches played'],['totalGoals','statsDevTotalGoals','Total goals'],['goalsPerMatch','statsDevGoalsPerMatch','Goals per match']];
 const teams=[['gf','statsDevGoalsScored','Goals scored',false],['ga','statsDevFewestConceded','Fewest conceded',true],['w','statsDevWins','Wins',false],['cs','statsDevCleanSheets','Clean sheets',false],['ppg','statsDevPointsPerMatch','Points per match',false],['gd','statsDevGoalDifference','Goal difference',false],['unbeatenStreak','statsDevUnbeatenStreak','Unbeaten streak',false]];
 const players=[['averageRating','statsDevAverageRating','Rating'],['goals','statsDevGoals','Goals'],['assists','statsDevAssists','Assists'],['goalsAssistsPer90','statsDevGoalsAssists90','Goal contributions per 90'],['cleanSheets','statsDevCleanSheets','Clean sheets'],['starts','statsDevStartsSubstitutes','Starts (substitutes)'],['redCards','statsDevRedCards','Red cards'],['minutes','statsDevMinutes','Minutes']];
 // Ranking qualifications scale with the recorded club's played matches.
 // Never modify frozen individual counters and never rank unavailable metrics.
 const eligible=(key,record,clubMatches)=>{
  if(record[key]===undefined||record[key]===null||!Number.isSafeInteger(clubMatches)||clubMatches<1)return false;
  const halfGames=Math.ceil(clubMatches*0.5),halfMinutes=clubMatches*90*0.5;
  if(key==='goals'||key==='assists'||key==='redCards')return record[key]>=1;
  if(key==='averageRating')return record.ratedAppearances>=halfGames;
  if(key==='cleanSheets')return record.cleanSheets>=1&&record.appearances>=halfGames;
  if(key==='goalsAssistsPer90')return count(record.goals)&&count(record.assists)&&record.goals+record.assists>=1&&record.minutes>=clubMatches*90*0.4;
  if(key==='starts')return record.starts>=halfGames;
  if(key==='minutes')return record.minutes>=halfMinutes;
  return true;
 };
 const mounted=new WeakMap(),identity=/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/;
 const text=value=>typeof value==='string'&&value.trim().length>0;
 const count=value=>Number.isSafeInteger(value)&&value>=0;
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 // Overview uses the current UI language for grouping and decimal separators.
 // The three existing values are integers except for the two-decimal goal average.
 const overviewNumber=(key,value)=>{
  const requested=document.documentElement?.lang;
  const locale=['en','de','es','fr','it'].includes(requested)?requested:'en';
  const decimals=key==='goalsPerMatch'?2:0;
  return new Intl.NumberFormat(locale,{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(value);
 };

 // Use only the verified public counters; unknown secondary metrics are never zero.
 const ratio=(number,denominator)=>finite(number)&&Number.isSafeInteger(denominator)&&denominator>0?number/denominator:null;
 const per90=(record,key)=>finite(record[key])?ratio(record[key]*90,record.minutes):null;
 const contributions=record=>count(record.goals)&&count(record.assists)?record.goals+record.assists:null;
 const tieBreakers={
  teams:{
   gf:[[r=>ratio(r.gf,r.mp),false],[r=>r.gd,false]],
   ga:[[r=>ratio(r.ga,r.mp),true],[r=>r.cs,false]],
   w:[[r=>ratio(r.w,r.mp),false],[r=>r.gd,false]],
   cs:[[r=>ratio(r.cs,r.mp),false],[r=>r.ga,true]],
   ppg:[[r=>ratio(r.gd,r.mp),false],[r=>ratio(r.gf,r.mp),false]],
   gd:[[r=>ratio(r.gd,r.mp),false],[r=>r.gf,false]],
   unbeatenStreak:[[r=>r.ppg,false],[r=>r.gd,false]]
  },
  players:{
   averageRating:[[r=>r.ratedAppearances,false],[r=>r.minutes,false]],
   goals:[[r=>per90(r,'goals'),false],[r=>r.assists,false]],
   assists:[[r=>per90(r,'assists'),false],[r=>r.goals,false]],
   goalsAssistsPer90:[[contributions,false],[r=>r.minutes,false]],
   cleanSheets:[[r=>ratio(r.cleanSheets,r.appearances),false],[r=>r.minutes,false]],
   starts:[[r=>r.minutes,false],[r=>r.subAppearances,true]],
   redCards:[[r=>r.yellowCards,false],[r=>r.minutes,true]],
   minutes:[[r=>r.starts,false],[r=>r.appearances,false]]
  }
 };
 // The primary value is compared at its displayed precision, never its hidden decimals.
 const displayedMetric=(key,value)=>['ppg','averageRating','goalsAssistsPer90'].includes(key)?Number(value.toFixed(2)):value;
 const compareNumber=(left,right,ascending=false)=>{
  const a=finite(left)?left:null,b=finite(right)?right:null;
  if(a===null||b===null)return a===null&&b===null?0:a===null?1:-1;
  return ascending?a-b:b-a;
 };
 const compareRank=(a,b,key,player,ascending=false)=>{
  const primary=compareNumber(displayedMetric(key,a[key]),displayedMetric(key,b[key]),ascending);
  if(primary)return primary;
  for(const [getter,tieAscending] of tieBreakers[player?'players':'teams'][key]){
   const secondary=compareNumber(getter(a),getter(b),tieAscending);
   if(secondary)return secondary;
  }
  return 0;
 };
 const compareIdentity=(a,b,player)=>
  (player?(a.name??'').localeCompare(b.name??'','en',{sensitivity:'base'}):a.clubName.localeCompare(b.clubName,'en'))||
  a.clubKey.localeCompare(b.clubKey,'en')||(player?a.playerId-b.playerId:0);
 const emptyHtml='<p data-app-i18n="statsDevNoData" class="fa-dev-stats-empty">No statistics yet.</p>';
 function renderEmpty(){
  return '<div id="fa-dev-stats"><div class="fa-dev-stats-nav" role="group" aria-label="Stats" data-app-aria="competitionTabStats">'+views.map(([id,key,label],i)=>'<button type="button" class="language-trigger" data-stats-view="'+id+'" data-app-i18n="'+key+'" aria-pressed="'+(i===0)+'" tabindex="'+(i===0?'0':'-1')+'">'+label+'</button>').join('')+'</div><div class="fa-dev-stats-content"><div class="app-competition-stat-grid fa-dev-stats-grid">'+overview.map(([,key,label])=>'<div class="app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-card"><span class="app-competition-stat-label" data-app-i18n="'+key+'">'+label+'</span>'+emptyHtml+'</div>').join('')+'</div></div></div>';
 }
 function renderSkeleton(selected='overview'){
  const bar='<span class="app-skeleton-bar"></span>';
  const nav='<div class="fa-dev-stats-nav" role="group" aria-label="Stats" data-app-aria="competitionTabStats">'+views.map(([id,key,label])=>'<button type="button" class="language-trigger" data-stats-view="'+id+'" aria-pressed="'+(id===selected)+'" tabindex="'+(id===selected?'0':'-1')+'" data-app-i18n="'+key+'">'+label+'</button>').join('')+'</div>';
  if(selected==='overview')return nav+'<div class="app-competition-stat-grid fa-dev-stats-grid" aria-hidden="true">'+overview.map(([,key,label])=>'<div class="app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-card"><span class="app-competition-stat-label" data-app-i18n="'+key+'">'+label+'</span><strong class="app-competition-stat-value">'+bar+'</strong></div>').join('')+'</div>';
  const player=selected==='players';
  const label='<span class="fa-dev-stats-team-name">'+bar+'</span>';
  const identityLabel=player?'<span class="fa-dev-stats-player-label">'+label+'<span class="fa-dev-stats-club-link">'+bar+'</span></span>':label;
  const row='<li><span class="fa-dev-stats-rank">'+bar+'</span><span class="app-world-club-identity"><span class="app-view-skeleton-crest-slot"></span>'+identityLabel+'</span><strong>'+bar+'</strong></li>';
  return nav+'<section class="fa-dev-stats-section" aria-hidden="true"><div class="fa-dev-stats-leader-grid">'+(player?players:teams).map(([,key,label])=>'<section class="app-competition-stat-card '+(player?'app-competition-stat-card--compact':'app-competition-stat-card--fluid')+' fa-dev-stats-leader-card'+(player?'':' fa-dev-stats-team-card')+'"><h4 class="app-competition-stat-label fa-dev-stats-leader-title" data-app-i18n="'+key+'">'+label+'</h4><ol class="fa-dev-stats-top">'+row.repeat(5)+'</ol><span class="fa-dev-stats-expand app-view-skeleton-stats-expand" aria-hidden="true"><span class="app-view-skeleton-stats-expand-label" data-app-i18n="statsDevShowAll">Show all</span>'+bar+'</span></section>').join('')+'</div></section>';
 }
 function normalize(context){
  const current=context?.seasonData;
  const selectors=typeof window!=='undefined'?window.faProviderSelectors:null;
  const authoritative=current?.provenance?.kind==='authoritative';
  const data=selectors&&current?selectors.selectSeasonData({
   schemaVersion:1,providerId:authoritative?'authoritative-world':'dev-fictional',competitionId:context.currentDefinition?.id||context.definition?.id,
   selectedSeason:context.selectedSeason,scope:'season',status:current.status,
   provenance:{kind:authoritative?'authoritative':'fictional',approved:false,coverage:'partial',sourceRef:authoritative?current.provenance.sourceRef:'dev-competition-context'},data:current
  },context.currentDefinition?.id||context.definition?.id,context.selectedSeason):current;
  const statistics=data?.statistics;
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
   const identity=player?.clubKey+':'+player?.playerId;
   if(!player||!count(player.playerId)||player.playerId<1||playerIds.has(identity)||player.name!==null&&!text(player.name)||!participants.has(player.clubKey)||!count(player.appearances)||player.appearances<1)throw Error('Invalid player statistic');
   playerIds.add(identity);
   for(const [key] of players)if(player[key]!==undefined&&player[key]!==null&&
    (['averageRating','goalsAssistsPer90'].includes(key)?!finite(player[key])||player[key]<0:!count(player[key])))throw Error('Invalid player metric');
   for(const metric of ['yellowCards','subAppearances','ratedAppearances'])if(player[metric]!==undefined&&player[metric]!==null&&!count(player[metric]))throw Error('Invalid player tiebreaker');
   if(!count(player.goals)||!count(player.starts)||!count(player.minutes))throw Error('Missing player counter');
   if(player.averageRating!==undefined&&player.averageRating!==null&&(!count(player.ratedAppearances)||player.ratedAppearances<1||player.ratedAppearances>player.appearances||player.averageRating<4||player.averageRating>10))throw Error('Invalid rating coverage');
   if(player.starts>player.appearances||player.minutes<player.appearances||player.minutes>120*player.appearances)throw Error('Invalid player participation');
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
  const content=create('div',undefined,'fa-dev-stats-content');root.append(nav,content);
  const shell=panel.querySelector?.('[data-competition-skeleton-root]');
  if(shell)panel.replaceChildren(shell,root);else panel.replaceChildren(root);
  let context=null,stats=null,view=views.some(([id])=>id===panel.dataset.faStatsSelectedView)?panel.dataset.faStatsSelectedView:'overview',revision=-1,dialog=null,opener=null,closeTimer=null,destroyed=false,invalid=false;
  const navButtons=[];
  const removeDialog=(restore=true)=>{
   if(!dialog)return;const current=dialog;dialog=null;clearTimeout(closeTimer);
   if(current.open)current.close();current.remove();
   if(restore&&opener?.isConnected)opener.focus({preventScroll:true});opener=null;
  };
  const empty=(player=false)=>localized('p',invalid?'statsDevUnavailable':player?'statsDevNoPlayerData':'statsDevNoData',invalid?'Statistics are unavailable.':player?'No players':'No statistics yet.','fa-dev-stats-empty');
  const format=(key,value,record)=>key==='averageRating'?value.toFixed(2)+' ('+record.ratedAppearances+')':key==='starts'?String(value)+' ('+(record.subAppearances??'—')+')':key==='cleanSheets'?String(value)+' ('+record.appearances+')':['ppg','goalsPerMatch','goalsAssistsPer90'].includes(key)?value.toFixed(2):String(value);
  function row(record,rank,key,player=false){
   const li=create('li');
   const identityNode=create('span',undefined,'app-world-club-identity'),crest=create('span',undefined,'app-world-club-crest-placeholder');
   crest.dataset.clubCrest=record.clubKey;crest.setAttribute('aria-hidden','true');
   const match=record.clubKey.match(identity),club=context.seasonData.participants.find(c=>c.countryId+'-'+c.clubId===record.clubKey);
   const clubRoute=window.faRoutesRegistry.buildRoute({kind:'club',country:match[1].toLowerCase(),id:match[2],view:'overview'});
   const name=create('a',player?(record.name??'#'+record.playerId):record.clubName,'fa-dev-stats-team-name app-world-standing-club-link');
   name.href=player?window.faRoutesRegistry.buildRoute({kind:'player',id:record.playerId}):clubRoute;
   if(player){
    const portrait=create('span',undefined,'fa-dev-stats-player-portrait');
    // Only the player name is interactive.
    portrait.setAttribute('aria-hidden','true');
    portrait.dataset.portraitState='loading';
    const photo=create('img');photo.alt='';photo.loading='lazy';photo.decoding='async';
    photo.onload=()=>{portrait.dataset.portraitState='ready'};
    photo.onerror=()=>{portrait.dataset.portraitState='missing';photo.removeAttribute('src')};
    // Generic persistent-ID paths: no player-specific crop rules or asset list.
    photo.src='/assets/players/portraits/'+record.playerId+'.webp';portrait.append(photo);
    const label=create('span',undefined,'fa-dev-stats-player-label');
    const clubLabel=create('a',club.primaryName,'fa-dev-stats-club-link');
    clubLabel.href=clubRoute;
    label.append(name,clubLabel);identityNode.append(portrait,label);
   }else identityNode.append(crest,name);
   li.append(create('span',rank,'fa-dev-stats-rank'),identityNode,create('strong',format(key,record[key],record)));return li;
  }
  function showAll(button,records,ranks,key,labelKey,label,player){
   removeDialog(false);opener=button;
   const current=create('dialog',undefined,'fa-dev-stats-dialog');dialog=current;
   const header=create('div',undefined,'fa-dev-stats-dialog-header'),title=localized('h3',labelKey,label);title.id='fa-dev-stats-dialog-title';
   current.setAttribute('aria-labelledby',title.id);
   const close=create('button',undefined,'fa-dev-stats-dialog-close app-search-close');close.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';close.type='button';close.dataset.appAria='statsDevClose';close.setAttribute('aria-label','Close');
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
   header.append(title,close);const all=create('ol',undefined,'fa-dev-stats-top');records.forEach((record,i)=>all.append(row(record,ranks[i],key,player)));current.append(header,all);
   window.dispatchEvent(new Event('fa:stats-dialog-open'));document.body.append(current);current.showModal();sync();close.focus();
  }
  let previousPresentation=null;
  function render(){
   panel.dataset.faStatsSelectedView=view;
   const presentation=JSON.stringify([view,invalid,stats,view==='overview'?document.documentElement.lang:null]);
   if(previousPresentation===presentation&&content.firstElementChild){sync();return;}
   previousPresentation=presentation;
   for(let i=0;i<navButtons.length;i++){const active=views[i][0]===view;navButtons[i].setAttribute('aria-pressed',active);navButtons[i].tabIndex=active?0:-1;}
   content.replaceChildren();
   if(view==='overview'){
    const grid=create('div',undefined,'app-competition-stat-grid fa-dev-stats-grid');
    for(const [key,labelKey,label] of overview){const card=create('div',undefined,'app-competition-stat-card app-competition-stat-card--compact fa-dev-stats-card');card.append(localized('span',labelKey,label,'app-competition-stat-label'),stats?create('strong',overviewNumber(key,stats.overview[key]),'app-competition-stat-value'):empty());grid.append(card)}
    content.append(grid);
   }else{
    const player=view==='players',section=create('section',undefined,'fa-dev-stats-section'),grid=create('div',undefined,'fa-dev-stats-leader-grid');
    const playedByClub=player?new Map((stats?.teams||[]).map(team=>[team.clubKey,team.mp])):null;
    for(const [key,labelKey,label,ascending=false] of player?players:teams){
     const card=create('section',undefined,'app-competition-stat-card '+(player?'app-competition-stat-card--compact':'app-competition-stat-card--fluid')+' fa-dev-stats-leader-card'+(player?'':' fa-dev-stats-team-card'));
     card.append(localized('h4',labelKey,label,'app-competition-stat-label fa-dev-stats-leader-title'));
     const records=[...(stats?.[player?'players':'teams']||[])].filter(record=>player?eligible(key,record,playedByClub.get(record.clubKey)):record[key]!==undefined&&record[key]!==null).sort((a,b)=>compareRank(a,b,key,player,ascending)||compareIdentity(a,b,player));
     const ranks=[];
     records.forEach((record,i)=>ranks.push(i&&compareRank(record,records[i-1],key,player,ascending)===0?ranks[i-1]:i+1));
     if(records.length){const top=create('ol',undefined,'fa-dev-stats-top');records.slice(0,5).forEach((record,i)=>top.append(row(record,ranks[i],key,player)));card.append(top)}
     else card.append(empty(player));
     if(records.length>5){const expand=localized('button','statsDevShowAll','Show all','fa-dev-stats-expand');expand.type='button';expand.addEventListener('click',()=>showAll(expand,records,ranks,key,labelKey,label,player));card.append(expand)}
     else{const spacer=create('span',undefined,'fa-dev-stats-expand-placeholder');spacer.setAttribute('aria-hidden','true');card.append(spacer)}
     grid.append(card);
    }
    section.append(grid);content.append(section);
   }
   sync();
  }
  // Translation is handled by app.js; refresh Overview's locale-sensitive
  // numbers when the language changes without waiting for a season revision.
  const languageObserver=typeof MutationObserver==='function'?new MutationObserver(()=>{
   if(!destroyed&&view==='overview')render();
  }):null;
  languageObserver?.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  const onShellSelection=event=>{
    if(!views.some(([id])=>id===event.detail)||event.detail===view)return;
    removeDialog(false);view=event.detail;render();
   };
   panel.addEventListener('fa:stats-shell-selection',onShellSelection);
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
     const hadDialog=Boolean(dialog);removeDialog(false);stats=null;invalid=true;panel.dataset.faContentState='unknown';render();
     if(hadDialog)navButtons[views.findIndex(item=>item[0]===view)].focus();return false;
    }
    if(context&&next.definition.id!==context.definition.id)return false;
    if(next.revision===revision){removeDialog(false);return false;}
    revision=next.revision;context=next;const hadDialog=Boolean(dialog);removeDialog(false);
    invalid=false;try{stats=normalize(next)}catch{stats=null;invalid=true}
    const noMatches=!invalid&&next.seasonData?.statistics?.overview?.matchesPlayed===0&&String(next.seasonData.season)===String(next.selectedSeason);
    panel.dataset.faContentState=noMatches?'empty':stats?'available':'unknown';
    panel.dataset.faContentSeason=String(next.selectedSeason);
    panel.dataset.faContentRevision=String(next.revision??'');
    render();if(hadDialog)navButtons[views.findIndex(item=>item[0]===view)].focus();return true;
   },
   destroy(){if(destroyed)return;destroyed=true;languageObserver?.disconnect();panel.removeEventListener('fa:stats-shell-selection',onShellSelection);removeDialog(false);root.remove();mounted.delete(panel)}
  });
  mounted.set(panel,api);api.update(initial);return api;
 }
 return Object.freeze({mount,renderEmpty,renderSkeleton});
});
