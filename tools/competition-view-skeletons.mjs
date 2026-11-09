import calendarModel from '../assets/world-calendar-model.js';
import rules from '../assets/competition-rules.js';
// Decorative shells use the live component classes and known competition structure only.
import stats from '../assets/competition-stats.js';
const bar='<span class="app-skeleton-bar"></span>';
const label=(tag,key,text,cls='')=>'<'+tag+(tag==='button'?' type="button" disabled tabindex="-1"':'')+(cls?' class="'+cls+'"':'')+' data-app-i18n="'+key+'">'+text+'</'+tag+'>';
const recordKeys=[['historyBestAttack','Best attack in a season'],['historyBestDefence','Best defence in a season'],['historyMostSeasonWins','Most wins in a season'],['historyMostSeasonPoints','Most points in a season'],['historyBestGoalDifference','Best goal difference in a season'],['historyLargestTitleMargin','Largest title-winning points margin']];
const playerKeys=[['historyPlayerSeasonGoals','Most goals in a season'],['historyPlayerSeasonAssists','Most assists in a season'],['historyPlayerSeasonCleanSheets','Most clean sheets in a season']];
const renderRecordSkeletonCards=items=>'<div class="app-competition-stat-grid">'+items.map(([key,text])=>'<article class="app-competition-stat-card">'+label('h5',key,text,'app-competition-stat-label')+'<strong class="app-competition-stat-value">'+bar+'</strong><div class="app-view-skeleton-record-holder">'+bar+'</div></article>').join('')+'</div>';
function renderHistorySkeletonMarkup(d,preview){
 const cells='<span class="app-history-dev-season-link app-world-standing-club-link"><span class="app-history-dev-season">'+bar+'</span></span>'+Array.from({length:3},(_,i)=>'<span class="app-history-dev-archive-club'+(i===0?' app-history-dev-archive-champion':'')+'">'+label('span',['historyChampionLabel','historyRunnerUp','historyThirdPlace'][i],['Champion','Runner-up','Third place'][i],'app-history-dev-podium-label')+'<span class="app-world-club-identity"><span class="app-world-club-crest-placeholder" aria-hidden="true"></span><span class="app-world-club-name">'+bar+'</span></span></span>').join('');
 const first=label('h3','historySeasonArchive','Season archive')+'<div class="app-world-standings app-view-skeleton-history-archive"><div class="app-history-dev-archive-head">'+['Season','Champion','Runner-up','Third place'].map((text,i)=>label('span',['historySeasonLabel','historyChampionLabel','historyRunnerUp','historyThirdPlace'][i],text)).join('')+'</div><ol class="app-history-dev-archive">'+Array.from({length:1},(_,i)=>'<li data-skeleton-archive-row="'+i+'"><div class="app-history-dev-season-button">'+cells+'</div></li>').join('')+'</ol></div>';
 const archiveSection='<section class="app-history-dev-section">'+first+'</section>';
 const recordsSection='<section class="app-history-dev-section">'+label('h3','historyHistoricalRecords','Historical records')+'<div class="app-history-record-controls">'+label('button','historySeasonLabel','Season')+label('button','historyAllTimeRecords','All-time')+'</div><section class="app-history-record-group">'+label('h4','historyTeamRecords','Team records')+renderRecordSkeletonCards(recordKeys)+'</section><section class="app-history-record-group">'+label('h4','historyPlayerRecords','Player records')+renderRecordSkeletonCards(playerKeys)+'</section></section>';
 return '<div class="app-history-dev">'+recordsSection+archiveSection+'</div>';
}
const awards={champion:['honours','awardsChampion','Champion'],promotion:['honours','awardsPromotion','Direct Promotion'],playoff:['honours','awardsPlayoff','Playoff Winner'],manager:['excellence','awardsManager','Manager of the Season'],player:['excellence','awardsPlayer','Player of the Season'],young:['excellence','awardsYoung','Young Player of the Season'],boot:['performance','awardsBoot','Golden Boot'],assists:['performance','awardsAssists','Top Assists'],glove:['performance','awardsGlove','Golden Glove'],defender:['performance','awardsDefender','Defender of the Season'],midfielder:['performance','awardsMidfielder','Midfielder of the Season'],forward:['performance','awardsForward','Forward of the Season'],xi:['xi','awardsXi','Team of the Season']};
function renderAwardSkeletonCards(d){
 const sections={excellence:['awardsExcellence','Individual Excellence'],performance:['awardsPerformance','Performance & Position Awards'],xi:['awardsXi','Team of the Season']};
 let html='',previous;
 for(const id of d.rules.awards){
  const [section,key,text]=awards[id]||[];if(!section)continue;
  if(section!==previous){if(previous)html+='</div></section>';html+='<section class="fa-awards-section fa-awards-'+section+'">'+(sections[section]?label('h3',...sections[section],'fa-awards-section-title'):'')+'<div class="fa-awards-grid">';previous=section;}
  html+='<article class="fa-awards-card fa-awards-card-'+id+'" data-skeleton-award="'+id+'"><span class="fa-awards-medallion"></span>'+label('h4',key,text,'fa-awards-card-title')+(id==='xi'?'<div class="app-view-skeleton-awards-pitch"></div>':'')+'<span class="fa-awards-chip app-view-skeleton-award-recipient">'+bar+'</span></article>';
 }
 return '<div class="fa-awards">'+html+(previous?'</div></section>':'')+'</div>';
}
export function renderViewSkeleton(d,view,variant){
 const key=variant||(view==='stats'?'stats-overview':view==='history'?'history-preview':'awards');
 const league=d.rules.phases.find(p=>p.rankOutcomes),marker=league.calendarEvents?.at(-1);
 const lastDay=calendarModel.createSeason(1).days.find(day=>day.events.some(event=>event.marker===marker))?.day||0;
 const historyAttrs=key==='history-preview'?' data-skeleton-last-league-day="'+lastDay+'" data-skeleton-league-rounds="'+rules.phaseMetrics(d,league.id).rounds+'"':'';
 const content=view==='stats'?stats.renderSkeleton(key.split('-')[1]):view==='history'?renderHistorySkeletonMarkup(d,key==='history-preview'):renderAwardSkeletonCards(d);
 return '<div class="app-competition-view-skeleton" data-competition-skeleton-root="'+key+'"'+historyAttrs+(view==='stats'?'':' aria-hidden="true"')+'>'+content+'</div>';
}
export function renderViewTemplates(d,view){
 const keys=view==='stats'?['stats-overview','stats-teams','stats-players']:view==='history'?['history-authoritative','history-preview']:['awards'];
 return keys.map(key=>'<template data-competition-skeleton="'+key+'">'+renderViewSkeleton(d,view,key)+'</template>').join('');
}
export function viewSkeletonScript(view){return '<script data-view-skeleton-first-paint="'+view+'">('+viewSkeletonFirstPaint.toString()+')('+JSON.stringify(view)+');</script>';}
export function viewSkeletonFirstPaint(view){
 const panel=document.getElementById('competition-panel-'+view);if(!panel)return;
 if(view==='stats'){
   const subviews=['overview','teams','players'];
   const selected=event=>{
    const button=event.target?.closest?.('[data-stats-view]');
    return button?.closest?.('[data-competition-skeleton-root]')?button:null;
   };
   const select=(value,focus)=>{
    if(!subviews.includes(value))return;
    panel.dataset.faStatsSelectedView=value;
    const current=panel.querySelector('[data-competition-skeleton-root]');
    if(current&&current.dataset.competitionSkeletonRoot!=='stats-'+value){
     const template=document.querySelector('template[data-competition-skeleton="stats-'+value+'"]');
     if(template)current.replaceWith(template.content.cloneNode(true));
     window.faAppRenderLanguage?.();
    }
    if(focus)panel.querySelector('[data-competition-skeleton-root] [data-stats-view="'+value+'"]')?.focus({preventScroll:true});
    panel.dispatchEvent(new CustomEvent('fa:stats-shell-selection',{detail:value}));
   };
   panel.addEventListener('click',event=>{const button=selected(event);if(button)select(button.dataset.statsView,true);});
   panel.addEventListener('keydown',event=>{
    const button=selected(event);if(!button||event.altKey||event.ctrlKey||event.metaKey)return;
    const index=subviews.indexOf(button.dataset.statsView);
    const next=event.key==='ArrowRight'?subviews[(index+1)%3]:event.key==='ArrowLeft'?subviews[(index+2)%3]:event.key==='Home'?subviews[0]:event.key==='End'?subviews[2]:null;
    if(next===null)return;event.preventDefault();select(next,true);
   });
  }
  if(view==='history'&&window.faDebugEnabled!==false&&
    document.documentElement.dataset.faDevSeasons!==undefined&&
    document.documentElement.dataset.faDevCurrentSeason==='0'){
  panel.querySelector('[data-competition-skeleton-root]')?.remove();
  panel.querySelector('[data-history-empty]')?.removeAttribute('hidden');
  if(document.documentElement.dataset.competitionView===view){panel.hidden=false;document.documentElement.removeAttribute('data-fa-competition-prepaint');}
  return;
 }
 if(view==='history'){
  const template=document.querySelector('template[data-competition-skeleton="history-preview"]');
  const skeleton=panel.querySelector('[data-competition-skeleton-root]');
  if(template&&skeleton)skeleton.replaceWith(template.content.cloneNode(true));
 }
 if(view==='history'){
  const progress=window.faFixturesInitialProgress||{},skeleton=panel.querySelector('[data-competition-skeleton-root]');
  const last=Number(skeleton?.dataset.skeletonLastLeagueDay),rounds=Number(skeleton?.dataset.skeletonLeagueRounds);
  const devSeason=window.faDebugEnabled!==false?document.documentElement.dataset.faDevCurrentSeason:undefined;
  const knownSeason=devSeason??progress.currentSeason;
  const season=Number(knownSeason??1);
  const day=window.faDevWorldClockSnapshot?.current?.day??progress.day;
  const knownCompleted=knownSeason!==undefined&&(day!==undefined||progress.matchdays!==undefined);
  const completed=Math.max(0,season-1+((last>0&&day>=last)||(!day&&rounds>0&&progress.matchdays>=rounds)?1:0));
  const archive=skeleton?.querySelector('.app-history-dev-archive');
  if(archive){
   if(completed===0&&knownCompleted){
    const shell=archive.closest('.app-view-skeleton-history-archive');
    if(shell)shell.innerHTML='<p class="app-competition-empty-row" data-app-i18n="competitionHistoryEmpty">No completed seasons available yet.</p>';
   }else{
   // Unknown season count reserves exactly one row; known completed seasons expand it.
   const needed=knownCompleted?Math.max(1,completed):1;
   const sample=archive.querySelector('[data-skeleton-archive-row]');
   while(sample&&archive.children.length<needed){
    const row=sample.cloneNode(true);
    row.dataset.skeletonArchiveRow=String(archive.children.length);
    archive.append(row);
   }
   for(const row of archive.querySelectorAll('[data-skeleton-archive-row]'))
    row.hidden=Number(row.dataset.skeletonArchiveRow)>=needed;
   }
  }
 }
 if(document.documentElement.dataset.competitionView===view){panel.hidden=false;document.documentElement.removeAttribute('data-fa-competition-prepaint');}
}
