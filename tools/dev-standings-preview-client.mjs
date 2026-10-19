// DEV-only browser enhancement injected in memory by the loopback server.
// This file must never be copied into a public artifact or loaded by public HTML.
import { competitionModel, DEBUG_MAX_MATCHDAY, createPreviewStandings, createPreviewPostseason, previewSeasonProgress, createPreviewHistory, readPreviewProgress, previewSeasonMatchdays, previewCurrentMatchday } from "./dev-standings-preview-data.mjs";
import { createDebugWidget, registerDebugControls } from "./debug-widget.mjs";

const FLAG = "football-architect:standings-dev-preview";
const SEASON_KEY = "football-architect:standings-dev-season";
const ROUNDS_KEY = "football-architect:standings-dev-matchdays";
function readMatchdays(){
 try{const raw=sessionStorage.getItem(ROUNDS_KEY);if(raw===null)return 0;
  const value=Number(raw);return Number.isInteger(value)&&value>=0&&value<=DEBUG_MAX_MATCHDAY?value:0;
 }catch{return 0}
}
let matchdays=readMatchdays();
let debugSeason=(()=>{try{return readPreviewProgress(sessionStorage).season}catch{return 1}})();
let refreshSeason=async()=>true;
let progressRevision=0;
const renderKey=()=>[selectedSeason(),debugSeason,matchdays].join(":");
let routeSeasonOverride=null;
function availablePreviewSeasons(){
 const seasons=(document.documentElement.dataset.faDevSeasons||"1").split(",")
  .map(Number).filter(season=>Number.isInteger(season)&&season>=1&&season<=4);
 return seasons.length?seasons:[1];
}
function selectedSeason(){
 const available=availablePreviewSeasons();
 // Initial deep links are canonical until the app router emits an explicit route change.
 if(available.includes(routeSeasonOverride))return routeSeasonOverride;
 const requested=Number(new URL(window.location.href).searchParams.get("season"));
 if(available.includes(requested))return requested;
 const routed=Number(window.faCompetitionRoute?.get?.().season);
 if(available.includes(routed))return routed;
 return available[0];
}
function syncCompetitionLinks(){
 for(const link of document.querySelectorAll('a.app-division-card')){
  const url=new URL(link.getAttribute('href'),location.href);
  url.searchParams.set('season',String(debugSeason));
  link.setAttribute('data-dev-latest-season',String(debugSeason));
  link.setAttribute('href',url.href);
 }
}
function syncDebugControls(){
 syncCompetitionLinks();
 for(const [id,value] of [["season",debugSeason],["matchdays",matchdays]])
  for(const input of document.querySelectorAll(`[data-dev-control="${id}"],[data-dev-control="${id}-number"]`)){
   input.value=String(value);input.dataset.previous=String(value);
  }
}
async function refreshProgress(){
 window.faCompetitionRoute?.setSeasonLimit?.(debugSeason);
 if(validPath){
  if(!await setPreviewEnabled(true))return false;
  if(await refreshSeason()===false)return false;
  await syncHistoryPreview();
 }
 syncDebugControls();
 window.dispatchEvent(new CustomEvent("fa:dev-progress-change",{detail:{season:debugSeason,matchdays}}));
 return true;
}
async function setDebugProgress(key,value){
 const previous={season:debugSeason,matchdays},previousView=window.faCompetitionRoute?.get?.().season;let saved;
 try{saved=sessionStorage.getItem(key);sessionStorage.setItem(key,String(value))}catch{return false}
 const revision=++progressRevision;
 if(key===SEASON_KEY)debugSeason=value;else matchdays=value;
 let ok=false;
 try{ok=await refreshProgress()}catch(error){console.error("DEV progress refresh failed:",error)}
 if(revision!==progressRevision)return true;
 if(ok)return true;
 debugSeason=previous.season;matchdays=previous.matchdays;
 try{if(saved===null)sessionStorage.removeItem(key);else sessionStorage.setItem(key,saved)}catch{}
 window.faCompetitionRoute?.setSeasonLimit?.(debugSeason);
 if(previousView)window.faCompetitionRoute?.set?.({season:previousView},{replace:true});
 syncDebugControls();
 window.dispatchEvent(new CustomEvent("fa:dev-progress-change",{detail:previous}));
 return false;
}
async function setSeason(value){
 if(!Number.isInteger(value)||value<1||value>4)return false;
 if(value===debugSeason)return true;
 return setDebugProgress(SEASON_KEY,value);
}
async function setMatchdays(value){
 if(!Number.isInteger(value)||value<0||value>DEBUG_MAX_MATCHDAY)return false;
 if(value===matchdays)return true;
 return setDebugProgress(ROUNDS_KEY,value);
}
async function resetPreview(){
 if(validPath&&previewState!=="OFF" && !await setPreviewEnabled(false))return false;
 try{sessionStorage.removeItem(SEASON_KEY);sessionStorage.removeItem(ROUNDS_KEY)}catch{return false}
 progressRevision++;debugSeason=1;matchdays=0;
 await refreshSeason();
 return refreshProgress();
}
const DETAIL = /^\/(?:app\/)?competitions\/([a-z]{2,3}-[12])(?:\/(?:index\.html)?)?$/;
const LANG = {
  en: { round: "Matchday", dateUnknown: "Date TBD",
    home: "Home", away: "Away", W: "Win", D: "Draw", L: "Loss",
    letters: {W:"W",D:"D",L:"L"},
    recent: "latest match" },
  de: { round: "Spieltag", dateUnknown: "Datum offen",
    home: "Heim", away: "Auswärts", W: "Sieg", D: "Remis", L: "Niederlage",
    letters: {W:"S",D:"U",L:"N"},
    recent: "letztes Spiel" },
  es: { round: "Jornada", dateUnknown: "Fecha pendiente",
    home: "Local", away: "Visitante", W: "Victoria", D: "Empate", L: "Derrota",
    letters: {W:"V",D:"E",L:"D"},
    recent: "último partido" },
  fr: { round: "Journée", dateUnknown: "Date à définir",
    home: "Domicile", away: "Extérieur", W: "Victoire", D: "Nul", L: "Défaite",
    letters: {W:"V",D:"N",L:"D"},
    recent: "dernier match" },
  it: { round: "Giornata", dateUnknown: "Data da definire",
    home: "Casa", away: "Trasferta", W: "Vittoria", D: "Pareggio", L: "Sconfitta",
    letters: {W:"V",D:"N",L:"P"},
    recent: "ultima partita" }
};
const validPath = location.pathname.match(DETAIL);
const indexPath=/^\/(?:app\/)?competitions(?:\/(?:index\.html)?)?$/.test(location.pathname);
let activePreview=null;
let previewState="OFF";
let widgetRoot;
function isPreviewEnabled(){return previewState==="ON";}
let historyRenderVersion=0;
let historyManifest=null;
function clearHistoryPreview(){
 historyRenderVersion++;
 const panel=document.getElementById("competition-panel-history");if(!panel)return;
 panel.querySelector(".app-history-dev")?.remove();
 const empty=panel.querySelector('[data-history-empty]');
 if(empty)empty.hidden=false;
 const error=panel.querySelector('[data-history-error]');if(error)error.hidden=true;
 window.faSyncHistoryRecords?.();
 window.faAppRenderLanguage?.();
}
// Records are derived from complete final tables, keyed by canonical club identity.
function historyRecords(seasons,played=seasons){
 const clubs=new Map();let previous=null,previousSeason=null,run=0;
 for(const {season,rows} of [...seasons].sort((a,b)=>a.season-b.season)){
  rows.forEach(({club},index)=>{
   const id=club.countryId+"-"+club.clubId;
   if(!clubs.has(id))clubs.set(id,{club,titles:0,podiums:0,streak:0,totalWins:0,totalGoals:0,totalPoints:0});
   const entry=clubs.get(id);if(index===0)entry.titles++;if(index<3)entry.podiums++;
  });
  const winner=rows[0]?.club;if(!winner)continue;
  const id=winner.countryId+"-"+winner.clubId;
  run=id===previous&&season===previousSeason+1?run+1:1;
  clubs.get(id).streak=Math.max(clubs.get(id).streak,run);
  previous=id;previousSeason=season;
 }
 for(const {rows} of played)for(const {club,won,gf,pts} of rows){
  const id=club.countryId+"-"+club.clubId;
  if(!clubs.has(id))clubs.set(id,{club,titles:0,podiums:0,streak:0,totalWins:0,totalGoals:0,totalPoints:0});
  const entry=clubs.get(id);
  if(Number.isFinite(won))entry.totalWins+=won;
  if(Number.isFinite(gf))entry.totalGoals+=gf;
  if(Number.isFinite(pts))entry.totalPoints+=pts;
 }
 const record=key=>{
  if(!clubs.size||(!seasons.length&&["titles","podiums","streak"].includes(key)))return {value:null,clubs:[]};
  const value=Math.max(0,...[...clubs.values()].map(entry=>entry[key]));
  return {value,clubs:[...clubs.values()].filter(entry=>entry[key]===value).map(entry=>entry.club)};
 };
 const seasonalRecord=(field,extreme,tables=seasons)=>{
  const entries=[...tables].sort((a,b)=>a.season-b.season).flatMap(({season,rows})=>
   rows.filter(row=>Number.isFinite(row[field])).map(row=>({club:row.club,season,value:row[field]})));
  if(!entries.length)return {value:null,entries:[]};
  const value=extreme(...entries.map(entry=>entry.value));
  return {value,entries:entries.filter(entry=>entry.value===value).map(({club,season})=>({club,season}))};
 };
 const margins=seasons.map(({season,rows})=>({season,rows:Number.isFinite(rows[0]?.pts)&&Number.isFinite(rows[1]?.pts)?[{club:rows[0].club,margin:rows[0].pts-rows[1].pts}]:[]}));
 return {titles:record("titles"),podiums:record("podiums"),streak:record("streak"),attack:seasonalRecord("gf",Math.max),defence:seasonalRecord("ga",Math.min),wins:seasonalRecord("won",Math.max),totalWins:record("totalWins"),totalGoals:record("totalGoals"),points:seasonalRecord("pts",Math.max),goalDifference:seasonalRecord("gd",Math.max),margin:seasonalRecord("margin",Math.max,margins),totalPoints:record("totalPoints")};
}
function historyRecordValue(metric,value){
 if(metric==="goalDifference")return value>0?"+"+value:value<0?"−"+Math.abs(value):"0";
 return String(value);
}
function historyNode(tag,className="",text){
 const element=document.createElement(tag);if(className)element.className=className;
 if(text!==undefined)element.textContent=String(text);return element;
}
function historyLabel(key,tag="span"){
 const element=historyNode(tag);element.dataset.appI18n=key;return element;
}
function historyIdentity(club){
 const identity=historyNode("span","app-world-club-identity");
 const crest=historyNode("span","app-world-club-crest-placeholder");
 crest.dataset.clubCrest=club.countryId+"-"+club.clubId;crest.setAttribute("aria-hidden","true");
 identity.append(crest,historyNode("span","app-world-club-name",club.primaryName));return identity;
}
function historySeasonLabel(season){
 const label=historyNode("span","app-history-dev-season");
 label.append(historyLabel("historySeasonLabel"),document.createTextNode(" "+season));return label;
}
function openHistorySeason(season){
 // Set the first-paint guard before the router reveals Standings.
 if(String(window.faCompetitionRoute?.get?.().season)!==String(season))
  document.documentElement.dataset.faDevSeasonTransition="true";
 window.faCompetitionRoute?.set?.({season:String(season),view:"standings"},{focus:true});
}
function historyExpandableHolders(card,holders,metric){
 const extra=[...holders.children].slice(2);
 if(!extra.length)return;
 holders.id="app-history-record-holders-"+metric;
 for(const entry of extra){entry.hidden=true;entry.dataset.historyTieExtra="";}
 const expand=historyNode("button","app-history-record-expand");
 expand.type="button";expand.dataset.historyRecordExpand=metric;
 expand.setAttribute("aria-controls",holders.id);expand.setAttribute("aria-expanded","false");
 const count=historyNode("span","app-history-record-more-count","+"+extra.length);
 const show=historyLabel("historyShowAll"),less=historyLabel("historyShowLess");
 less.hidden=true;expand.append(count,show,less);
 expand.addEventListener("click",()=>{
  const opened=expand.getAttribute("aria-expanded")!=="true";
  for(const entry of extra)entry.hidden=!opened;
  count.hidden=opened;show.hidden=opened;less.hidden=!opened;
  expand.setAttribute("aria-expanded",String(opened));
 });
 card.append(expand);
}
async function renderHistoryPreview(){
 const version=++historyRenderVersion,route=window.faCompetitionRoute?.get?.(),progressDay=matchdays,progressSeason=debugSeason;
 const panel=document.getElementById("competition-panel-history");if(!panel)return;
 if(!isPreviewEnabled()){clearHistoryPreview();return}
 if(route?.view!=="history")return;
 const current=()=>version===historyRenderVersion&&isPreviewEnabled()&&
  debugSeason===progressSeason&&matchdays===progressDay&&window.faCompetitionRoute?.get?.().view==="history"&&window.faCompetitionRoute.get().season===route.season;
 const status=panel.querySelector('[data-history-empty]');
 const errorMessage=panel.querySelector('[data-history-error]');if(errorMessage)errorMessage.hidden=true;
 if(status)status.hidden=true;
 try{
  if(!historyManifest)historyManifest=fetch("/competitions/_shared/manifest.json",{cache:"no-store",credentials:"same-origin"}).then(async response=>{
   if(!response.ok)throw Error("DEV History manifest unavailable");
   const manifest=await response.json();
   if(!competitionModel.validManifest(manifest))throw Error("Invalid DEV History manifest");
   return manifest;
  }).catch(error=>{historyManifest=null;throw error});
  const manifest=await historyManifest;if(!current())return;
  const division=manifest.divisions.find(item=>item.id===validPath[1].toUpperCase());if(!division)throw Error("Unknown DEV History division");
  const {completed:seasons,played}=createPreviewHistory(division,progressSeason,progressDay);
  if(!played.length){clearHistoryPreview();return;}
  const root=historyNode("div","app-history-dev");
  const section=(key,id)=>{
   const box=historyNode("section","app-history-dev-section");box.id=id;
   const h=historyLabel(key,"h3");box.append(h);root.append(box);return box;
  };
  const archive=section("historySeasonArchive","app-history-archive"),list=historyNode("ol","app-history-dev-archive");
  const archiveHeader=historyNode("div","app-history-dev-archive-head");archiveHeader.setAttribute("aria-hidden","true");
  for(const key of ["historySeasonLabel","historyChampionLabel","historyRunnerUp","historyThirdPlace"])archiveHeader.append(historyLabel(key));
  const archiveTable=historyNode("div","app-world-standings");
  if(seasons.length)archiveTable.append(archiveHeader,list);
  else{
   const empty=historyLabel("competitionHistoryEmpty","p");
   empty.className="app-competition-empty-row";archiveTable.append(empty);
  }
  archive.append(archiveTable);
  for(const item of [...seasons].reverse()){
   const li=historyNode("li"),button=historyNode("button","app-history-dev-season-button");button.type="button";
   // Archive rows navigate to Standings; they are not toggle selections in History.
   button.dataset.historySeason=String(item.season);
   const action=historyLabel("historySelectSeason");action.className="sr-only";
   button.append(historySeasonLabel(item.season),action);
   item.rows.slice(0,3).forEach((row,index)=>{
    const rank=historyNode("span","app-history-dev-archive-club"+(index===0?" app-history-dev-archive-champion":""));
    const label=historyLabel(["historyChampionLabel","historyRunnerUp","historyThirdPlace"][index]);label.className="app-history-dev-podium-label";
    rank.append(label,historyIdentity(row.club));button.append(rank);
   });
   button.addEventListener("click",()=>openHistorySeason(item.season));
   li.append(button);list.append(li);
  }
  const records=section("historyHistoricalRecords","app-history-records"),grid=historyNode("div","app-competition-stat-grid app-history-dev-records");
  const controls=panel.querySelector('[data-history-record-controls]').cloneNode(true);records.append(controls);
  const teams=historyNode("section","app-history-record-group");teams.dataset.historyTeamRecords="";
  teams.append(historyLabel("historyTeamRecords","h4"),grid);records.append(teams);
  const values=historyRecords(seasons,played);
  const shown={season:0,"all-time":0};
  for(const [key,metric] of [["historyBestAttack","attack"],["historyBestDefence","defence"],["historyMostSeasonWins","wins"],["historyMostSeasonPoints","points"],["historyBestGoalDifference","goalDifference"],["historyLargestTitleMargin","margin"],["historyMostTitles","titles"],["historyMostPodiums","podiums"],["historyLongestTitleStreak","streak"],["historyMostTotalWins","totalWins"],["historyMostTotalGoals","totalGoals"],["historyMostTotalPoints","totalPoints"]]){
   const result=values[metric];
   // Omit empty metric tiles; one empty message per scope is more meaningful.
   if(result.value===null)continue;
   const scope=result.entries?"season":"all-time";
   shown[scope]++;
   const card=historyNode("article","app-competition-stat-card app-history-dev-record");
   card.dataset.historyRecord=metric;card.dataset.historyScope=scope;
   card.hidden=scope!==(panel.dataset.historyRecordScope||"season");
   const label=historyLabel(key,"h5");label.className="app-competition-stat-label";
   card.append(label,historyNode("strong","app-competition-stat-value",historyRecordValue(metric,result.value)));
   const holders=historyNode("div","app-history-record-holders");
   if(result.entries){
    for(const {club,season} of result.entries){
     const entry=historyNode("div","app-history-dev-record-entry");entry.dataset.historyRecordSeason=String(season);
     entry.append(historyIdentity(club),historySeasonLabel(season));holders.append(entry);
    }
   }else for(const club of result.clubs){
    const entry=historyNode("div","app-history-dev-record-entry");
    entry.append(historyIdentity(club));holders.append(entry);
   }
   card.append(holders);
   historyExpandableHolders(card,holders,metric);
   grid.append(card);
  }
  for(const scope of ["season","all-time"])if(shown[scope]===0){
   const empty=historyLabel("historyNoData","p");
   empty.className="app-competition-status app-history-records-empty";
   empty.dataset.historyScope=scope;empty.hidden=scope!==(panel.dataset.historyRecordScope||"season");
   grid.append(empty);
  }
  records.append(panel.querySelector('[data-history-player-records]').cloneNode(true));
  if(!current())return;
  panel.querySelector(".app-history-dev")?.remove();if(status)status.hidden=true;panel.append(root);window.faSyncHistoryRecords?.();window.faAppRenderLanguage?.();

 }catch(error){
  if(!current())return;
  console.error("DEV History preview unavailable:",error);panel.querySelector(".app-history-dev")?.remove();
  if(status)status.hidden=false;
  if(errorMessage)errorMessage.hidden=false;
  window.faAppRenderLanguage?.();
 }
}
function syncHistoryPreview(){
 const route=window.faCompetitionRoute?.get?.();
 if(!isPreviewEnabled()){clearHistoryPreview();return;}
 if(route?.view==="history")return renderHistoryPreview();else historyRenderVersion++;
}

let transition=Promise.resolve();
function setPreviewEnabled(enabled) {
 transition=transition.catch(()=>false).then(async()=>{
  if(previewState==="ERROR"){
   try{activePreview()}
   catch(error){console.error("DEV preview retry restore failed:",error);return false}
   try{sessionStorage.removeItem(FLAG)}
   catch(error){console.error("DEV preview retry storage failed:",error);return false}
   activePreview=null;
   previewState="OFF";
   if(!enabled)return true;
  }
  if(enabled===(previewState==="ON"))return true;
  if(enabled){
   if(activePreview){activePreview();activePreview=null;}
   const cleanup=await boot(validPath[1].toUpperCase());
   if(typeof cleanup!=="function")return false;
   activePreview=cleanup;
   previewState="ON";
   // Do not synthesize a route-change event here: the router may still expose
   // its pre-hydration default season, which would override a valid deep-link URL.
   // Real router events are handled by syncSeason after initialization.
   widgetRoot?.syncVisibility();
   await syncHistoryPreview();
   try{sessionStorage.setItem(FLAG,"on")}catch{}
   window.dispatchEvent(new CustomEvent("fa:fictional-standings-change",{detail:{enabled:true}}));
   return true;
  }
  try{activePreview()}
  catch(error){
   previewState="ERROR";
   console.error("DEV preview restore failed:",error);
   try{sessionStorage.setItem(FLAG,"on")}
   catch(storageError){console.error("DEV preview rollback storage failed:",storageError)}
   return false;
  }
  activePreview=null;
  previewState="OFF";
  widgetRoot?.syncVisibility();
  clearHistoryPreview();
  delete document.documentElement.dataset.faDevSeasonTransition;
  try{sessionStorage.removeItem(FLAG)}catch{}
  window.dispatchEvent(new CustomEvent("fa:fictional-standings-change",{detail:{enabled:false}}));
  return true;
 });
 return transition;
}

if(validPath||indexPath){
 syncCompetitionLinks();
 (validPath?waitForRows():Promise.resolve()).then(() => {
  registerDebugControls("standings",[{type:"button",id:"reset-page",label:"Reset current page",onChange:resetPreview}]);
  registerDebugControls("general",[{
   type:"range",id:"season",label:"Season",min:1,max:4,step:1,scope:"general",
   value:()=>debugSeason,onChange:setSeason
  },{type:"range",id:"matchdays",label:"Matchdays",min:0,max:DEBUG_MAX_MATCHDAY,step:1,scope:"general",
   value:()=>matchdays,onChange:setMatchdays
  },{type:"button",id:"reset-global",label:"Reset all",scope:"general",onChange:async()=>{
   if(!await resetPreview())return false;
   return widgetRoot?.resetWidgetState()===true;
  }}]);
  widgetRoot=createDebugWidget({page:validPath?"standings":"competitions"});
  // Keep the canonical placeholders invisible until DEV results are ready.
  // A failed preview must release the guard rather than leave an empty table.
  const reveal=()=>{delete document.documentElement.dataset.faDevStandingsPending;window.faDebugFirstPaintRelease?.()};
  if(validPath)setPreviewEnabled(true).catch(error=>console.error("DEV initial hydration failed:",error)).finally(reveal);
  else reveal();
  let renderedSeason=renderKey();
  let seasonRefresh=Promise.resolve(true);
  let seasonRequest=0;
  function syncSeason(){
   const routed=Number(window.faCompetitionRoute?.get?.().season);
   if(availablePreviewSeasons().includes(routed))routeSeasonOverride=routed;
   const next=renderKey();
   if(next===renderedSeason)return seasonRefresh;
   const request=++seasonRequest;
   renderedSeason=next;
   // Prevent even one frame of previous-season data while DEV hydration is pending.
   if(previewState!=="ON"){
    delete document.documentElement.dataset.faDevSeasonTransition;
    return seasonRefresh;
   }
   // Keep standings visible while detached DEV rows are prepared for a synchronous swap.
   seasonRefresh=seasonRefresh.then(async()=>{
    await transition;
    if(previewState!=="ON"||request!==seasonRequest)return;
    const previous=activePreview;
    const replacement=await boot(validPath[1].toUpperCase(),previous,()=>request===seasonRequest&&renderKey()===next);
    if(typeof replacement!=="function"){
     if(request===seasonRequest){
      previewState="OFF";
      // On failure show canonical placeholders rather than stale DEV results.
      try{activePreview?.()}catch(error){console.error("DEV season fallback restore failed:",error)}
      activePreview=null;
     }
     return false;
    }
    // A newer route may have been selected while this season was hydrating.
    // Discard stale work and let the newest queued request render instead.
    if(request!==seasonRequest||renderKey()!==next){
     try{replacement()}catch(error){console.error("Stale DEV season cleanup failed:",error)}
     return;
    }
    activePreview=replacement;
    return true;
   }).catch(error=>{
    console.error("DEV season preview refresh failed:",error);
    if(request===seasonRequest){
     previewState="OFF";
     try{activePreview?.()}catch(restoreError){console.error("DEV season fallback restore failed:",restoreError)}
     activePreview=null;
    }
    return false;
   }).finally(()=>{
    // A stale request must never release the newest season's paint guard.
    if(request===seasonRequest)delete document.documentElement.dataset.faDevSeasonTransition;
   });
   return seasonRefresh;
  }
  if(validPath)refreshSeason=syncSeason;
  // The competition router notifies subscribers after updating its URL state.
  // Avoid delayed document click polling (which can briefly display stale scores).
  // A DEV module can initialize before the public router. Listen to its
  // explicit route event rather than relying on popstate (pushState does not
  // emit popstate), and handle browser back/forward navigation as well.
  window.addEventListener("fa:competition-route-change",syncSeason);
  window.addEventListener("fa:competition-route-change",syncHistoryPreview);
  window.addEventListener("popstate",syncSeason);
  window.addEventListener("popstate",syncHistoryPreview);
 }).catch(error => {
  delete document.documentElement.dataset.faDevStandingsPending;
  window.faDebugFirstPaintRelease?.();
  console.error("DEV Debug unavailable:", error);
 });
}

function strings() { return LANG[document.documentElement.lang] || LANG.en; }
function formatMatchDate(game,language) {
  if(typeof game.kickoff!=="string"||!Number.isFinite(Date.parse(game.kickoff)))return null;
  return new Intl.DateTimeFormat(language,{dateStyle:"medium",timeStyle:"short"})
    .format(new Date(game.kickoff));
}
function node(tag, className = "", value = "") {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = value;
  return el;
}
function waitForFixturesApi(timeoutMs=7000) {
  if(typeof window.faFixtures?.prepare==="function")return Promise.resolve(window.faFixtures);
  return new Promise((resolve,reject)=>{
    const started=Date.now();
    const check=()=>{
      if(typeof window.faFixtures?.prepare==="function"){resolve(window.faFixtures);return;}
      if(Date.now()-started>=timeoutMs){reject(Error("Fixtures DEV hydration timeout"));return;}
      setTimeout(check,25);
    };
    check();
  });
}
function waitForRows() {
  return new Promise((resolve, reject) => {
    let done = false;
    const table = () => {
      const tbody = document.getElementById("app-standings-body");
      if (tbody?.rows.length === competitionModel.profile.capacity && document.querySelector(".app-world-standing-table") &&
          typeof window.faCompetitionRoute?.get === "function" &&
          typeof window.faFixtures?.prepare === "function") {
        finish(null, tbody);
      }
    };
    const observer = new MutationObserver(table);
    const timer = setTimeout(() => finish(Error("Standings hydration timeout")), 7000);
    function finish(error, body) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      observer.disconnect();
      if (error) reject(error);
      else resolve(body);
    }
    observer.observe(document.documentElement, { childList: true, subtree: true });
    table();
  });
}

async function boot(routeId,restorePrevious=null,isCurrent=()=>true) {
  try {
    const response = await fetch("/competitions/_shared/manifest.json",
      { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw Error("DEV manifest unavailable");
    const manifest = await response.json();
    if (!competitionModel.validManifest(manifest)) {
      throw Error("Invalid DEV manifest");
    }
    const division = manifest.divisions.find(d => d.id === routeId);
    if (!division) throw Error("Unknown DEV division");
    // Resolve the season only after the manifest is loaded, then capture it for both
    // standings and fixtures. Read router state first only when it agrees with the
    // current URL; URL remains canonical for direct navigation and browser refresh.
    const season=selectedSeason(),progress={season:debugSeason,matchdays};
    const playedDays=previewSeasonMatchdays(season,progress);
    const { rows, clubs } = createPreviewStandings(division,playedDays,season);
    // Prepare the complete DEV calendar from the same deterministic season seed.
    // Future rounds have no result; standings and fixtures share completed scores.
    const complete=createPreviewStandings(division,competitionModel.schedule.rounds,season);
    const fixtureData=complete.fixtures.map(game=>({
      round:game.round,
      homeId:game.homeId,
      awayId:game.awayId,
      homeGoals:game.round<=playedDays?game.homeGoals:null,
      awayGoals:game.round<=playedDays?game.awayGoals:null,
      kickoff:null
    }));
    // Complete all asynchronous preparation before touching the visible table.
    const [tbody,fixturesApi] = await Promise.all([waitForRows(),waitForFixturesApi()]);
    // Delayed manifest/Fixtures responses must not commit data for an obsolete season.
    if(!isCurrent()||selectedSeason()!==season||debugSeason!==progress.season||matchdays!==progress.matchdays)return;
    // Keep the active page, scroll position and focus stable during DEV data swaps.
    // Only the standings/fixtures/postseason data is rehydrated; never navigate or reload.
    const scrollHosts=[document.scrollingElement,document.querySelector(".fa-shell-content-scroll"),
      document.querySelector(".app-world-standing-scroll")].filter(Boolean);
    const scrollState=scrollHosts.map(el=>({el,top:el.scrollTop,left:el.scrollLeft}));
    const focused=document.activeElement;
    if(restorePrevious)restorePrevious();
    const restoreFixtures=typeof fixturesApi?.snapshot==="function"
      ?fixturesApi.snapshot():null;
    // Only an active season has a "current matchday" shortcut. The router owns
    // the selected round from URL/state, including completed-season archives.
    const regularRound=previewCurrentMatchday(season,progress);
     // Once the post-season starts, the current-round shortcut targets its named fixture stage.
     const currentRound=progress.matchdays>=30
       ?(division.tier===1?'playout':'playoffs'):regularRound;
    const postResults=createPreviewPostseason(division,previewSeasonProgress(season,progress),season);
    const postFixtures=[];
    for(const tie of postResults.ties)for(const leg of [0,1])postFixtures.push({
      round:31+leg,homeId:tie.clubIds[leg===0?1:0],awayId:tie.clubIds[leg===0?0:1],
      homeGoals:null,awayGoals:null,kickoff:null,afterExtraTime:false,penalties:null,...tie.legs[leg]
    });
    if(postResults.final)postFixtures.push({round:33,kickoff:null,...postResults.final});
    const commitFixtures=typeof fixturesApi?.prepare==="function"
      ?fixturesApi.prepare(fixtureData,{currentMatchday:currentRound,postseason:postFixtures}):null;
    const restorePostseason=window.faPostseason?.snapshot();
    const commitPostseason=window.faPostseason?.prepare(rows,postResults);
    // Fast path: reuse the mounted standings DOM, tooltip handlers and club crests.
    // The original preview cleanup remains active for eventual DEV disable/reset.
    if(restorePrevious?.refresh && restorePrevious.refresh(rows,commitFixtures,commitPostseason,
      window.faStandingsMobile?.prepare(rows)))return restorePrevious;
    const originalIds = new Set([...tbody.rows].map(x => x.dataset.worldClub));
    if (originalIds.size !== competitionModel.profile.capacity || rows.some(r =>
      !originalIds.has(r.club.countryId + "-" + r.club.clubId))) {
      throw Error("DEV standings identities mismatch");
    }

    // Construct the entire table detached. Inconsistencies cannot partly alter the UI.
    const fragment = document.createDocumentFragment();
    const entries = [];
    rows.forEach((r, position) => {
      const tr = node("tr");
      tr.dataset.worldClub = r.club.countryId + "-" + r.club.clubId;
      window.faStandingsOutcomes?.decorate(tr, position + 1);
      const value = (text, cls = "app-world-stat-value") => {
        const td = node("td", cls, String(text));
        tr.appendChild(td);
        return td;
      };
      value(position + 1);
      const clubCell = node("th", "app-world-standing-club");
      clubCell.scope = "row";
      const identity = node("span", "app-world-club-identity");
      const crest = node("span", "app-world-club-crest-placeholder");
      crest.dataset.clubCrest = tr.dataset.worldClub;
      crest.setAttribute("aria-hidden", "true");
      identity.append(crest, node("span", "app-world-club-name", r.club.primaryName));
      clubCell.append(identity);
      tr.append(clubCell);
      for (const number of [r.played, r.won, r.drawn, r.lost, r.gf, r.ga,
        r.gd > 0 ? "+" + r.gd : r.gd, r.pts]) value(number);
      const formCell = node("td");
      const strip = node("span", "app-world-form-strip");
      for (const [index, game] of r.recent.entries()) {
        const button = node("button", "app-world-form-dot app-world-form-control app-world-form-" +
          game.result.toLowerCase() + (index === 0 ? " app-world-form-last" : ""));
        button.type = "button";
        button.setAttribute("aria-haspopup","true");
        const glyph = node("span","app-world-form-glyph",game.result);
        button.append(glyph);
        entries.push({ button, glyph, game, ownId: r.club.clubId, latest: index === 0 });
        strip.append(button);
      }
      formCell.append(strip);
      tr.append(formCell);
      fragment.append(tr);
    });
    if (entries.length !== competitionModel.profile.capacity*Math.min(5,playedDays) || fragment.childNodes.length !== competitionModel.profile.capacity) {
      throw Error("Incomplete DEV standings rendering");
    }
    // Prepare mobile from the validated fixture model before changing the table.
    const mobile = window.faStandingsMobile;
    if (typeof mobile?.prepare !== "function") throw Error("Mobile standings unavailable");
    const commitMobile = mobile.prepare(rows);

    const caption = document.getElementById("app-standings-caption");
    if(!caption)throw Error("Missing standings caption");
    const canonicalRows=[...tbody.childNodes];
    const mobileList=document.getElementById("app-standings-compact-list");
    if(!mobileList)throw Error("Mobile standings list unavailable");
    const canonicalMobile=[...mobileList.childNodes];
    const mobileEntries=[];
    const captionI18n=caption.getAttribute("data-app-i18n");
    const captionText=caption.textContent;
    const listeners=new AbortController();
    const tooltip = node("div", "app-world-form-tooltip");
    tooltip.setAttribute("role", "tooltip");
    tooltip.id = "fa-dev-form-tooltip";
    tooltip.hidden = true;
    const meta = node("div", "app-world-form-tooltip-meta");
    const round = node("span", "app-world-form-tooltip-round");
    const roundLabel = node("span");
    const roundNumber = node("strong");
    round.append(roundLabel, roundNumber);
    const date = node("time", "app-world-form-tooltip-date");
    meta.append(round,date);
    const scoreline = node("div", "app-world-form-tooltip-scoreline");
    const homeName = node("span", "app-world-form-tooltip-team");
    const score = node("strong", "app-world-form-tooltip-score");
    const awayName = node("span", "app-world-form-tooltip-team");
    scoreline.append(homeName, score, awayName);
    const context = node("div", "app-world-form-tooltip-context");
    const perspective = node("span");
    const stadium = node("span", "app-world-form-tooltip-stadium");
    context.append(perspective,stadium);
    tooltip.append(meta, scoreline, context);
    const lookup = new Map(clubs.map(c => [c.clubId, c]));
    let active = null;
    let selected = null;
    let pressedWhenOpen = false;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    function close() {
      active?.button.removeAttribute("aria-describedby");
      active = null;
      tooltip.setAttribute("aria-hidden", "true");
      if (reduced || tooltip.hidden) {
        tooltip.className = "app-world-form-tooltip";
        tooltip.hidden = true;
      } else {
        tooltip.className = "app-world-form-tooltip is-closing";
      }
    }
    const listen=(target,type,handler,options={})=>
      target?.addEventListener(type,handler,{...options,signal:listeners.signal});
    listen(tooltip,"animationend", e => {
      if (e.target === tooltip && e.animationName === "app-world-tooltip-out" && !active) {
        tooltip.hidden = true;
        tooltip.className = "app-world-form-tooltip";
      }
    });
    function place() {
      if (!active || tooltip.hidden) return;
      const rect = active.button.getBoundingClientRect();
      const width = innerWidth, height = innerHeight;
      const topbarBottom = Math.max(0,
        document.querySelector(".fa-shell-topbar")?.getBoundingClientRect().bottom ?? 0);
      const topLimit = Math.max(8, topbarBottom + 8), bottomLimit = height - 8;
      const w = tooltip.offsetWidth || 300, h = tooltip.offsetHeight || 124;
      if (rect.bottom <= topbarBottom || rect.top >= height || rect.right <= 0 ||
          rect.left >= width || bottomLimit - topLimit < h) return close();
      const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, width - w - 8));
      const above = rect.top - h - 8, below = rect.bottom + 8;
      const top = above >= topLimit ? above : below + h <= bottomLimit ? below :
        (rect.top - topLimit >= bottomLimit - rect.bottom ? topLimit : bottomLimit - h);
      tooltip.style.left = Math.round(left) + "px";
      tooltip.style.top = Math.round(Math.max(topLimit, Math.min(top, bottomLimit - h))) + "px";
    }
    function translate() {
      const t = strings();
      for (const entry of entries) {
         entry.glyph.textContent = t.letters[entry.game.result];
         entry.button.setAttribute("aria-label", t[entry.game.result] +
           (entry.latest ? " — " + t.recent : ""));
       }
      if (selected) {
        const formattedDate=formatMatchDate(selected.game,document.documentElement.lang||"en");
        date.textContent=formattedDate||t.dateUnknown;
        if(formattedDate)date.setAttribute("datetime",selected.game.kickoff);
        else date.removeAttribute("datetime");
        roundLabel.textContent = t.round + " ";
        perspective.textContent = selected.game.isHome ? t.home : t.away;
      }
    }
    function open(entry) {
      active?.button.removeAttribute("aria-describedby");
      active = entry;
      selected = entry;
      const game = entry.game;
      homeName.textContent = lookup.get(game.homeId).primaryName;
      awayName.textContent = lookup.get(game.awayId).primaryName;
      score.textContent = game.homeGoals + " – " + game.awayGoals;
      roundNumber.textContent = String(game.round);
      stadium.textContent = lookup.get(game.homeId).stadiumName;
      tooltip.hidden = false;
      tooltip.className = "app-world-form-tooltip";
      tooltip.removeAttribute("aria-hidden");
      entry.button.setAttribute("aria-describedby", tooltip.id);
      translate();
      place();
    }
    const languageObserver=new MutationObserver(translate);
    let committed=false;
    let restored=false;
    function restore(){
      if(restored)return;
      const failures=[];
      const attempt=fn=>{try{fn()}catch(error){failures.push(error)}};
      attempt(()=>listeners.abort());
      attempt(()=>languageObserver.disconnect());
      attempt(()=>tooltip.remove());
      if(committed){
       if(restoreFixtures)attempt(restoreFixtures);
       if(restorePostseason)attempt(restorePostseason);
       attempt(()=>tbody.replaceChildren(...canonicalRows));
       attempt(()=>mobileList.replaceChildren(...canonicalMobile));
       attempt(()=>{
        if(captionI18n===null)caption.removeAttribute("data-app-i18n");
        else caption.setAttribute("data-app-i18n",captionI18n);
        caption.textContent=captionText;
       });
       attempt(()=>window.faAppRenderLanguage?.());
      }
      if(failures.length)throw new AggregateError(failures,"DEV standings restore incomplete");
      restored=true;
    }
    try {
    committed=true;
    // Commit to DOM only after all integrity checks and node construction passed.
    if(commitFixtures)commitFixtures();
    tbody.replaceChildren(fragment);
    commitMobile();
    if(commitPostseason)commitPostseason();
    for(const {el,top,left} of scrollState){el.scrollTop=top;el.scrollLeft=left;}
    if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
    // Preserve the canonical compact-form marks exactly as rendered. Bind taps
    // directly to those marks and cancel the enclosing <summary> activation.
    const mobileItems=[...mobileList.querySelectorAll(".app-world-mobile-item")];
    if(mobileItems.length!==rows.length)throw Error("Mobile standings row/model mismatch");
    mobileItems.forEach((item,rowIndex)=>{
      const row=rows[rowIndex];
      const marks=[...item.querySelectorAll(".app-world-mobile-form .app-world-form-dot")];
      if(marks.length!==row.recent.length)throw Error("Mobile recent-form count mismatch");
      marks.forEach((mark,index)=>{
        const game=row.recent[index];
        mobileEntries.push({button:mark,glyph:mark,game,ownId:row.club.clubId,latest:index===0,mobile:true});
      });
    });
    caption.dataset.appI18n="standingsFilledCaption";
    window.faAppRenderLanguage?.();
    document.body.appendChild(tooltip);
    translate();
    languageObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ["lang"]
    });
    for (const entry of [...entries,...mobileEntries]) {
      const btn = entry.button;
      listen(btn,"pointerenter", e => {
        if (e.pointerType === "mouse" || e.pointerType === "pen") open(entry);
      });
      listen(btn,"pointerleave", e => {
        if ((e.pointerType === "mouse" || e.pointerType === "pen") &&
            active === entry && document.activeElement !== btn) close();
      });
      listen(btn,"focus", () => open(entry));
      listen(btn,"blur", () => { if (active === entry) close(); });
      listen(btn,"pointerdown", e => {
        pressedWhenOpen = (e.pointerType === "touch" || e.pointerType === "pen") &&
          active === entry;
      });
      listen(btn,"click", e => {
        if(entry.mobile){e.preventDefault();e.stopPropagation();}
        if (pressedWhenOpen && active === entry) close();
        else open(entry);
        pressedWhenOpen = false;
      });
    }
    listen(document,"pointerdown", e => {
      if (active && !tooltip.contains(e.target) && e.target !== active.button) close();
    });
    listen(document,"keydown", e => {
      if (e.key === "Escape" && active) { close(); e.stopPropagation(); }
    });
    listen(window,"resize", place);
    listen(window,"scroll", place, { passive: true });
    listen(document.querySelector(".fa-shell-content-scroll"),"scroll",place,{passive:true});
    listen(document.querySelector(".app-world-standing-scroll"),"scroll",place,{passive:true});
    restore.refresh=(nextRows,nextFixtures,nextPostseason,nextMobile)=>{
      if(restored||!committed)return false;
      const desktop=new Map([...tbody.rows].map(tr=>[tr.dataset.worldClub,tr]));
      const compact=new Map([...mobileList.children].map(li=>[li.dataset.worldClub,li]));
      if(nextRows.some(row=>{
        const id=row.club.countryId+"-"+row.club.clubId;
        const tr=desktop.get(id),li=compact.get(id);
        return !tr||!li||
          tr.querySelectorAll(".app-world-form-control").length!==row.recent.length||
          li.querySelectorAll(".app-world-mobile-form .app-world-form-dot").length!==row.recent.length;
      }))return false;
      close();
      // Validate the new fixture/postseason data before changing visible standings.
      if(nextFixtures)nextFixtures();
      if(nextPostseason)nextPostseason();
      for(let index=0;index<nextRows.length;index++){
        const row=nextRows[index],id=row.club.countryId+"-"+row.club.clubId;
        const tr=desktop.get(id);
        window.faStandingsOutcomes?.decorate(tr,index+1);
        tr.cells[0].textContent=String(index+1);
        const numbers=[row.played,row.won,row.drawn,row.lost,row.gf,row.ga,
          row.gd>0?"+"+row.gd:row.gd,row.pts];
        numbers.forEach((number,i)=>{tr.cells[i+2].textContent=String(number)});
        const buttons=[...tr.querySelectorAll(".app-world-form-control")];
        buttons.forEach((button,i)=>{
          const game=row.recent[i];
          button.className="app-world-form-dot app-world-form-control app-world-form-"+
            game.result.toLowerCase()+(i===0?" app-world-form-last":"");
          const entry=entries.find(item=>item.button===button);
          if(!entry)throw Error("Missing desktop form entry");
          entry.game=game;entry.latest=i===0;
          entry.glyph.textContent=game.result;
        });
        tbody.appendChild(tr);
      }
      nextMobile(true);
      for(const entry of mobileEntries){
        const row=nextRows.find(r=>r.club.clubId===entry.ownId);
        const li=compact.get(row.club.countryId+"-"+row.club.clubId);
        const marks=[...li.querySelectorAll(".app-world-mobile-form .app-world-form-dot")];
        const index=marks.indexOf(entry.button);
        if(index<0)throw Error("Mobile form mark identity changed");
        entry.game=row.recent[index];entry.latest=index===0;
      }
      translate();
      return true;
    };
    return restore;
    } catch(error){restore();throw error}
  } catch (error) {
    // Fail closed: do not disclose partial standings or mutate canonical sources.
    console.error("Standings DEV Preview unavailable:", error);
  }
}
