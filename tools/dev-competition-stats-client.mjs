import {readPreviewProgress,previewSeasonMatchdays,competitionModel,createPreviewClubSummary,readPreviewClubProgress} from "./dev-standings-preview-data.mjs";
import {aggregatePreviewStats} from "./stats-data.mjs";

async function startClubSummary(){
const enabled=()=>{try{return sessionStorage.getItem('football-architect:standings-dev-preview')==='on'}catch{return false}};
let catalogue,revision=0;
const publish=snapshot=>window.dispatchEvent(new CustomEvent('fa:club-competition-summary',{detail:snapshot}));
async function refresh(){
 const version=++revision;
 const route=window.faClubModel?.route(location.pathname);
 if(!enabled()||!route){publish(null);return;}
 try{
  catalogue??=fetch('/competitions/_shared/manifest.json',{credentials:'same-origin',cache:'no-store'}).then(async response=>{
   if(!response.ok)throw Error('Unavailable club competition data');
   const data=await response.json();if(!competitionModel.validManifest(data))throw Error('Invalid club competition data');return data;
  }).catch(error=>{catalogue=null;throw error});
  const data=await catalogue;
  if(version!==revision||!enabled())return;
  const division=data.divisions.find(d=>d.countryId===route.countryId&&d.clubs.some(c=>c.clubId===route.clubId));
  publish(division?createPreviewClubSummary(division,route.clubId,readPreviewClubProgress(sessionStorage)):null);
 }catch{if(version===revision)publish(null);}
}
await new Promise(resolve=>{
 if(document.documentElement.dataset.clubReady==='true')return resolve();
 const observer=new MutationObserver(()=>{
  if(document.documentElement.dataset.clubReady==='true'){observer.disconnect();resolve();}
 });
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-club-ready']});
});
for(const event of ['fa:fictional-standings-change','fa:dev-world-day-change','fa:dev-progress-change','pageshow'])window.addEventListener(event,refresh);
window.addEventListener('storage',event=>{if(event.key?.startsWith('football-architect:'))refresh();});
await refresh();

}
if(document.getElementById('club-page'))await startClubSummary();

// Data adapter only. Public presentation mounts from the generic competition context.
function createStatsPreviewProvider(){
 let epoch=0,destroyed=false;
 const enabled=()=>{try{return sessionStorage.getItem('football-architect:standings-dev-preview')==='on'}catch{return false}};
 const signature=statistics=>JSON.stringify(statistics?{overview:statistics.overview,teams:statistics.teams,players:statistics.players}:null);
 async function refresh(){
  const token=++epoch,context=window.faCompetitionContext,definition=context?.definition;
  if(destroyed||!enabled()||definition?.category!=='domestic'||!context.seasonData||!window.faCompetitionContextApi)return false;
  let progress;try{progress=readPreviewProgress(sessionStorage)}catch{return false}
  if(progress.season===0||document.documentElement.dataset.faDevCurrentSeason==='0')return false;
  const division=window.faCompetitionDivision;
  if(!division||division.id!==definition.id)return false;
  const days=previewSeasonMatchdays(context.selectedSeason,progress),data=context.seasonData;
  const league=definition.rules.phases.find(phase=>phase.type==='roundRobin');
  // The standings provider publishes its completed progress atomically first.
  // Do not race that writer or replace its fixtures/results with an older snapshot.
  if(days===0||data.season!==context.selectedSeason||data.rulesVersion!==definition.rules.version||
    !Array.isArray(data.results)||data.results.length!==days*definition.metrics.phases[league.id].matchesPerRound)return false;
  const aggregate=await aggregatePreviewStats({...division,rules:definition.rules},days,context.selectedSeason);
  const statistics={
   overview:{matchesPlayed:aggregate.overview.matchesPlayed,totalGoals:aggregate.overview.totalGoals,goalsPerMatch:aggregate.overview.goalsPerMatch},
   teams:aggregate.teams.map(team=>({clubKey:definition.countryId+'-'+team.clubId,clubName:team.clubName,mp:team.mp,gf:team.gf,ga:team.ga,w:team.w,cs:team.cs,ppg:team.ppg,gd:team.gd,unbeatenStreak:team.unbeatenStreak})),
   players:[]
  };
  const current=window.faCompetitionContext;
  if(destroyed||token!==epoch||!enabled()||current?.revision!==context.revision||current.selectedSeason!==context.selectedSeason||
    readPreviewProgress(sessionStorage).season===0||document.documentElement.dataset.faDevCurrentSeason==='0')return false;
  if(signature(current.seasonData.statistics)===signature(statistics))return false;
  return window.faCompetitionContextApi.replaceSeasonData({...data,statistics:{...data.statistics,...statistics}},context.revision);
 }
 const events=['fa:competition-context-change','fa:dev-progress-change','fa:fictional-standings-change','pageshow'];
 for(const event of events)window.addEventListener(event,refresh);
 return Object.freeze({refresh,destroy(){destroyed=true;epoch++;for(const event of events)window.removeEventListener(event,refresh)}});
}
// Start the protected competition provider; Club summary uses its independent read-only adapter above.
if(!document.getElementById('club-page')){
 const provider=createStatsPreviewProvider();window.faDevStatsProvider=provider;await provider.refresh();
}
