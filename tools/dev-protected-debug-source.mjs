// I03: isolated, opt-in shared source coordinator; NEVER loaded by public build.
// No bearer token is stored in browser code or storage.
import {prepareProtectedDomesticContext} from "./protected-domestic-context.mjs";
import {createProtectedDomesticPresentation} from "./protected-domestic-presentation.mjs";
const state={enabled:false,revision:0,abort:null,view:null};
const key="football-architect:local-debug-visible";
const readEnabled=()=>{try{return sessionStorage.getItem(key)==="1"}catch{return false}};
const getNumber=(key,defaultValue)=>{try{const raw=sessionStorage.getItem(key);if(raw===null||raw.trim()==="")return defaultValue;const n=Number(raw);return Number.isInteger(n)?n:defaultValue}catch{return defaultValue}};
const routeCompetition=()=>location.pathname.match(/^\/competitions\/((?:it|eng|es|de|fr|pt|nl|br)-[12]|int-[12])(?:\/|$)/i)?.[1]?.toUpperCase().replace(/^INT-/,"int-")??null;
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
export function currentDebugSource(){return Object.freeze({enabled:state.enabled,revision:state.revision,view:state.view});}
export async function refreshDebugSource(){
 const revision=++state.revision;
 state.abort?.abort();state.abort=new AbortController();
 state.enabled=readEnabled();
 const season=getNumber("football-architect:standings-dev-season",1);
 const day=getNumber("football-architect:calendar-dev-world-day",1);
 const competitionId=routeCompetition();
 if(!state.enabled||season===0||!competitionId){
  state.view=null;
  emit("fa:protected-debug-source-change",{kind:!state.enabled?"global":"debug-unstarted",enabled:state.enabled,revision});
  return;
 }
 if(season<1||season>5||day<1||day>56){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:400});return;}
 // Request only via HttpOnly local session. Never send the owner bearer token.
 try{
  const query=new URLSearchParams({season:String(season),day:String(day),competition:competitionId});
  const response=await fetch("/__fa_dev_private__/season-view?"+query,{credentials:"same-origin",cache:"no-store",signal:state.abort.signal});
  if(revision!==state.revision)return;
  if(!response.ok){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:response.status});return;}
  const view=await response.json();
  if(revision!==state.revision)return;
  if(view.kind!=="protected-debug-projection"||view.status!=="UNSEALED_NOT_FOR_RUNTIME"||view.source?.kind!=="debug"||view.source?.namespace!=="local-debug"||view.source?.datasetId!=="debug-corpus-v1"||view.seasonNumber!==season||view.worldDay!==day||view.competitionId!==competitionId||!Array.isArray(view.events)||!Array.isArray(view.standings)){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:422});return;}
  let prepared=null,presentation=null;
  if(!competitionId.startsWith("int-")){
   try{prepared=prepareProtectedDomesticContext(view,{competitionId,season,day});presentation=createProtectedDomesticPresentation(prepared);}
   catch(error){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:422,reason:"invalid-domestic-context"});return;}
  }
  if(view.events.some(event=>event.day>day&&event.result!==null)){
   state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:422,reason:"future-result-leak"});return;
  }
  state.view=view;
  emit("fa:protected-debug-source-change",{kind:"protected-debug",enabled:true,revision,view});
  if(prepared){emit("fa:protected-debug-domestic-prepared",{revision,competitionId,season,day,prepared});
   emit("fa:protected-debug-domestic-presentation",{revision,competitionId,season,day,presentation});}
 }catch(error){if(revision===state.revision&&error?.name!=="AbortError"){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:0});}}
}
for(const name of ["fa:debug-mode-change","fa:dev-progress-change","fa:dev-world-day-change","fa:competition-route-change","pageshow"])window.addEventListener(name,()=>{void refreshDebugSource()});
void refreshDebugSource();
