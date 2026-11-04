// Shared generation/prepaint presentation. No sporting data is generated here.
import rules from '../assets/competition-rules.js';
import view from '../assets/competition-rules-view.js';
import calendarModel from '../assets/world-calendar-model.js';
const locales=['en','de','es','fr','it'];
const calendar=calendarModel.createSeason(1);
const nationalDays=calendar.days.filter(d=>d.events.some(e=>e.family==='national')).map(d=>d.day);
export function fixturesShellConfig(d){
 const league=d.rules.phases.find(p=>p.rankOutcomes),rounds=rules.phaseMetrics(d,league.id).rounds;
 const choices=view.fixturesDisplayChoices(d).map(choice=>{
  let groups;
  if(typeof choice.value==='number')groups=[{count:d.capacity/2}];
  else if(d.category==='international'){
   const phase=d.rules.phases.find(p=>p.id===choice.phaseId),legs=Math.max(...phase.ties.map(t=>t.legs));
   groups=Array.from({length:legs},(_,i)=>({count:phase.ties.filter(t=>t.legs>i).length,...(legs===1?{}:{key:i===0?'postseasonFirstLeg':'postseasonSecondLeg',label:i===0?'First leg':'Second leg'})}));
  }
  else{
   const phases=d.rules.phases.filter(p=>p.type==='knockout');
   const ties=phases[0].ties.filter(t=>t.legs===2).length;
   groups=[{count:ties,key:'postseasonFirstLeg',label:'First leg'},{count:ties,key:'postseasonSecondLeg',label:'Second leg'}];
   if(phases.some(p=>p.ties.some(t=>t.legs===1)))groups.push({count:1,key:'postseasonFinal',label:'Final'});
  }
  return {value:choice.value,aliases:rules.fixtureChoices(d).filter(c=>typeof c.value==='string'&&c.phaseId===choice.phaseId).map(c=>String(c.value)),key:typeof choice.value==='number'?'league':choice.value,groups,
   labels:Object.fromEntries(locales.map(locale=>[locale,view.fixturesChoiceLabel(d,choice,locale)]))};
 });
 return {international:d.category==='international',rounds,choices,nationalDays,
  currentByDay:Array.from({length:57},(_,day)=>day&&d.rules.phases.every(p=>Array.isArray(p.calendarEvents))?rules.currentFixtureChoice(d,calendar,{current:{season:1,day}}):null)};
}
// Pure and serializable, shared by generator tests and the synchronous browser bootstrap.
export function resolveFixtureSelection(config,options={}){
 const explicit=config.choices.find(c=>String(c.value)===String(options.matchday)||c.aliases.includes(String(options.matchday)));
 if(explicit)return explicit;
 if(options.matchday!==undefined&&options.matchday!==null)return config.choices[0];
 let selected=1;
 if(Number.isInteger(options.currentSeason)&&options.currentSeason>0){
  const viewed=Number(options.season)||options.currentSeason;
  if(config.international){
   if(viewed===options.currentSeason)selected=config.currentByDay[options.day||1]||1;
  }else{
   const played=Number.isInteger(options.day)&&options.day>=1&&options.day<=56?config.nationalDays.filter(day=>day<=options.day).length:options.matchdays||0;
   selected=played>=config.rounds?config.choices.find(c=>typeof c.value==='string')?.value||config.rounds:viewed===options.currentSeason?Math.min(config.rounds,played+1):1;
  }
 }
 return config.choices.find(c=>c.value===selected||c.aliases.includes(String(selected)))||config.choices[0];
}
const card='<li class="app-fixture-match" data-skeleton-fixture><div class="app-fixture-club app-fixture-home"><span class="app-fixtures-skeleton-crest"></span><span class="app-fixture-name"><span class="app-skeleton-bar"></span></span></div><div class="app-fixture-result"><span class="app-fixture-status"><span class="app-skeleton-bar"></span></span><span class="app-fixture-score"><span class="app-skeleton-bar"></span></span><span class="app-fixture-stadium"><span class="app-skeleton-bar"></span></span></div><div class="app-fixture-club"><span class="app-fixtures-skeleton-crest"></span><span class="app-fixture-name"><span class="app-skeleton-bar"></span></span></div></li>';
const rows=choice=>choice.groups.map(g=>(g.key?'<li class="app-fixture-stage"><h3 data-app-i18n="'+g.key+'">'+g.label+'</h3></li>':'')+Array(g.count).fill(card).join('')).join('');
export function renderFixturesSkeleton(d){
 const config=fixturesShellConfig(d),templates=[...new Map(config.choices.map(c=>[c.key,c])).values()];
 return '<ol id="app-fixtures-skeleton" class="app-fixtures-list app-fixtures-skeleton" aria-hidden="true">'+rows(config.choices[0])+'</ol>'+templates.map(c=>'<template data-fixtures-skeleton-template="'+c.key+'">'+rows(c)+'</template>').join('')+
  '<script data-fixtures-first-paint>('+fixturesShellBootstrap.toString()+')('+JSON.stringify(config)+','+resolveFixtureSelection.toString()+');</script>';
}
export function fixturesShellBootstrap(config,resolve){
 const skeleton=document.getElementById('app-fixtures-skeleton');
 if(!skeleton)return;
 const picker=document.getElementById('app-fixtures-picker');
 const number=document.getElementById('app-fixtures-round-number');
 const label=document.getElementById('app-fixtures-round-label');
 const params=new URLSearchParams(location.search);
 const options={...window.faFixturesInitialProgress,matchday:params.get('matchday'),season:params.get('season')};
 let shape;
 function select(value){
  const choice=config.choices.find(c=>String(c.value)===String(value)||c.aliases.includes(String(value)));
  if(!choice)return;
  if(shape!==choice.key){
   const template=document.querySelector('[data-fixtures-skeleton-template="'+choice.key+'"]');
   if(template)skeleton.replaceChildren(template.content.cloneNode(true));
   shape=choice.key;
  }
  const language=document.documentElement.lang||'en';
  const numeric=typeof choice.value==='number';
  label.hidden=!numeric;
  if(numeric)label.textContent=(choice.labels[language]||choice.labels.en).slice(0,-String(choice.value).length).trim();
  number.textContent=numeric?String(choice.value):(choice.labels[language]||choice.labels.en);
  if(numeric)delete number.dataset.competitionFixtureChoice;else number.dataset.competitionFixtureChoice=String(choice.value);
  for(const option of picker.querySelectorAll('[data-fixture-round-choice]'))option.setAttribute('aria-selected',String(option.dataset.fixtureRoundChoice===String(choice.value)));
  window.faFixturesInitialChoice=choice.value;
 }
 select(resolve(config,options).value);
 window.faFixturesShell={select};
 if(document.documentElement.dataset.competitionView==='fixtures'){
  const panel=document.getElementById('competition-panel-fixtures');if(panel)panel.hidden=false;
  document.documentElement.removeAttribute('data-fa-competition-prepaint');
 }
}
