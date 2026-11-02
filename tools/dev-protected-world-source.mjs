// I05 DEV-only world coordinator. Explicit import only; never public runtime.
import {selectProtectedWorldDay,selectProtectedClubFixtures,selectProtectedClubSummary} from "./debug-data-i05-world-selectors.mjs";
let revision=0,abort=null,snapshot=null;
const enabled=()=>{try{return sessionStorage.getItem("football-architect:local-debug-visible")==="1"}catch{return false}};
const selected=(key,fallback)=>{try{const raw=sessionStorage.getItem(key);if(raw===null||raw.trim()==="")return fallback;const v=Number(raw);return Number.isInteger(v)?v:fallback}catch{return fallback}};
const clubRoute=()=>{const match=location.pathname.match(/^\/clubs\/(it|eng|es|de|fr|pt|nl|br)\/([1-9]|[1-3][0-9]|40)(?:\/|$)/i);return match?match[1].toUpperCase()+"-"+match[2]:null};
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
export function currentProtectedWorld(){return snapshot;}
export async function refreshProtectedWorld(){
 const token=++revision;
 abort?.abort();abort=new AbortController();snapshot=null;
 const season=selected("football-architect:standings-dev-season",1);
 const day=selected("football-architect:calendar-dev-world-day",1);
 const clubId=clubRoute(),calendar=location.pathname==="/calendar";
 emit("fa:protected-world-reset",{revision:token});
 if(!enabled()||season===0||(!calendar&&!clubId))return;
 if(season<1||season>5||day<1||day>56){emit("fa:protected-world-unavailable",{revision:token,status:400});return;}
 try{
  const params=new URLSearchParams({season:String(season),day:String(day)});
  const response=await fetch("/__fa_dev_private__/world-view?"+params,{credentials:"same-origin",cache:"no-store",signal:abort.signal});
  if(token!==revision)return;
  if(!response.ok){emit("fa:protected-world-unavailable",{revision:token,status:response.status});return;}
  const data=await response.json();
  if(token!==revision)return;
  if(data.seasonNumber!==season||data.worldDay!==day||data.source?.kind!=="debug"||data.source?.namespace!=="local-debug"||data.source?.datasetId!=="debug-corpus-v1")throw Error("I05 world identity");
  if(data.competitions.some(c=>c.events.some(e=>e.day>day&&e.result!==null)))throw Error("I05 future score leak");
  const events=calendar?selectProtectedWorldDay(data,day):selectProtectedClubFixtures(data,clubId);
  snapshot=Object.freeze({revision:token,season,day,clubId,kind:calendar?"calendar":"club",events,source:data.source,acceptance:"UNSEALED_NOT_FOR_RUNTIME"});
  emit("fa:protected-world-ready",snapshot);
  if(clubId){
   const summary=selectProtectedClubSummary(data,clubId);
   if(token===revision)emit("fa:club-competition-summary",summary);
  }
 }catch(error){if(token===revision&&error?.name!=="AbortError")emit("fa:protected-world-unavailable",{revision:token,status:0});}
}
for(const name of ["fa:debug-mode-change","fa:dev-progress-change","fa:dev-world-day-change","fa:competition-route-change","pageshow"]){
 window.addEventListener(name,()=>{void refreshProtectedWorld()});
}
void refreshProtectedWorld();
