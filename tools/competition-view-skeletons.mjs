import calendarModel from '../assets/world-calendar-model.js';
import rules from '../assets/competition-rules.js';
// Decorative shells use the live component classes and known competition structure only.
import stats from '../assets/competition-stats.js';
const bar='<span class="app-skeleton-bar"></span>';
const label=(tag,key,text,cls='')=>'<'+tag+(tag==='button'?' type="button" disabled tabindex="-1"':'')+(cls?' class="'+cls+'"':'')+' data-app-i18n="'+key+'">'+text+'</'+tag+'>';
const recordKeys=[['historyBestAttack','Best attack in a season'],['historyBestDefence','Best defence in a season'],['historyMostSeasonWins','Most wins in a season'],['historyMostSeasonPoints','Most points in a season'],['historyBestGoalDifference','Best goal difference in a season'],['historyLargestTitleMargin','Largest title-winning points margin']];
const playerKeys=[['historyPlayerSeasonGoals','Most goals in a season'],['historyPlayerSeasonAssists','Most assists in a season'],['historyPlayerSeasonCleanSheets','Most clean sheets in a season']];
const recordCards=items=>'<div class="app-competition-stat-grid">'+items.map(([key,text])=>'<article class="app-competition-stat-card">'+label('h5',key,text,'app-competition-stat-label')+'<strong class="app-competition-stat-value">'+bar+'</strong><div class="app-view-skeleton-record-holder">'+bar+'</div></article>').join('')+'</div>';
function history(d,preview){
 let first;
 if(preview){
  const cells=Array(4).fill('<span>'+bar+'</span>').join('');
  first=label('h3','historySeasonArchive','Season archive')+'<div class="app-view-skeleton-history-archive"><div class="app-history-dev-archive-head">'+['Season','Champion','Runner-up','Third place'].map((text,i)=>label('span',['historySeasonLabel','historyChampionLabel','historyRunnerUp','historyThirdPlace'][i],text)).join('')+'</div><ol class="app-history-dev-archive">'+Array.from({length:4},(_,i)=>'<li data-skeleton-archive-row="'+i+'"><div class="app-history-dev-season-button">'+cells+'</div></li>').join('')+'</ol></div>';
 }else{
  first=label('h3','historyHallOfChampions','Hall of Champions')+'<div class="app-view-skeleton-champion">'+bar+'</div>'+label('h3','historyFinalLeagueTable','Final league table')+'<table class="app-history-authoritative-table app-view-skeleton-history-table"><thead><tr><th>#</th>'+label('th','standingsClub','Club')+label('th','historyPlayed','Played')+label('th','historyPoints','Points')+'</tr></thead><tbody>'+Array(d.capacity).fill('<tr>'+Array(4).fill('<td>'+bar+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 }
 return '<div class="app-history-dev"><section class="app-history-dev-section">'+first+'</section><section class="app-history-dev-section">'+label('h3','historyHistoricalRecords','Historical records')+'<div class="app-history-record-controls">'+label('button','historySeasonRecords','Season records')+label('button','historyAllTimeRecords','All-time')+'</div><section class="app-history-record-group">'+label('h4','historyTeamRecords','Team records')+recordCards(recordKeys)+'</section><section class="app-history-record-group">'+label('h4','historyPlayerRecords','Player records')+recordCards(playerKeys)+'</section></section></div>';
}
const awards={champion:['honours','awardsChampion','Champion'],promotion:['honours','awardsPromotion','Direct Promotion'],playoff:['honours','awardsPlayoff','Playoff Winner'],manager:['excellence','awardsManager','Manager of the Season'],player:['excellence','awardsPlayer','Player of the Season'],young:['excellence','awardsYoung','Young Player of the Season'],boot:['performance','awardsBoot','Golden Boot'],assists:['performance','awardsAssists','Top Assists'],glove:['performance','awardsGlove','Golden Glove'],defender:['performance','awardsDefender','Defender of the Season'],midfielder:['performance','awardsMidfielder','Midfielder of the Season'],forward:['performance','awardsForward','Forward of the Season'],xi:['xi','awardsXi','Team of the Season']};
function awardCards(d){
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
 const key=variant||(view==='stats'?'stats-overview':view==='history'?'history-authoritative':'awards');
 const league=d.rules.phases.find(p=>p.rankOutcomes),marker=league.calendarEvents?.at(-1);
 const lastDay=calendarModel.createSeason(1).days.find(day=>day.events.some(event=>event.marker===marker))?.day||0;
 const historyAttrs=key==='history-preview'?' data-skeleton-last-league-day="'+lastDay+'" data-skeleton-league-rounds="'+rules.phaseMetrics(d,league.id).rounds+'"':'';
 const content=view==='stats'?stats.renderSkeleton(key.split('-')[1]):view==='history'?history(d,key==='history-preview'):awardCards(d);
 return '<div class="app-competition-view-skeleton" data-competition-skeleton-root="'+key+'"'+historyAttrs+' aria-hidden="true">'+content+'</div>';
}
export function renderViewTemplates(d,view){
 const keys=view==='stats'?['stats-overview','stats-teams','stats-players']:view==='history'?['history-authoritative','history-preview']:['awards'];
 return keys.map(key=>'<template data-competition-skeleton="'+key+'">'+renderViewSkeleton(d,view,key)+'</template>').join('');
}
export function viewSkeletonScript(view){return '<script data-view-skeleton-first-paint="'+view+'">('+viewSkeletonFirstPaint.toString()+')('+JSON.stringify(view)+');</script>';}
export function viewSkeletonFirstPaint(view){
 const panel=document.getElementById('competition-panel-'+view);if(!panel)return;
 if(view==='history'&&window.faFixturesInitialProgress){
  const template=document.querySelector('template[data-competition-skeleton="history-preview"]');
  const skeleton=panel.querySelector('[data-competition-skeleton-root]');
  if(template&&skeleton)skeleton.replaceWith(template.content.cloneNode(true));
 }
 if(view==='history'&&window.faFixturesInitialProgress){
  const progress=window.faFixturesInitialProgress,skeleton=panel.querySelector('[data-competition-skeleton-root]');
  const last=Number(skeleton?.dataset.skeletonLastLeagueDay),rounds=Number(skeleton?.dataset.skeletonLeagueRounds);
  const completed=Math.max(1,progress.currentSeason-1+((last>0&&progress.day>=last)||(!progress.day&&rounds>0&&progress.matchdays>=rounds)?1:0));
  for(const row of skeleton?.querySelectorAll('[data-skeleton-archive-row]')||[])row.hidden=Number(row.dataset.skeletonArchiveRow)>=completed;
 }
 if(document.documentElement.dataset.competitionView===view){panel.hidden=false;document.documentElement.removeAttribute('data-fa-competition-prepaint');}
}
