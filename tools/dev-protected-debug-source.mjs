// I03: isolated, opt-in shared source coordinator; NEVER loaded by public build.
// No bearer token is stored in browser code or storage.
const state={enabled:false,revision:0,abort:null,view:null};
const key="football-architect:local-debug-visible";
const readEnabled=()=>{try{return sessionStorage.getItem(key)==="1"}catch{return false}};
const getNumber=(key,defaultValue)=>{try{const n=Number(sessionStorage.getItem(key));return Number.isInteger(n)?n:defaultValue}catch{return defaultValue}};
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
  emit("fa:protected-debug-source-change",{kind:"global",enabled:state.enabled,revision});
  return;
 }
 if(season<1||season>5||day<1||day>56)return;
 // Request only via HttpOnly local session. Never send the owner bearer token.
 try{
  const query=new URLSearchParams({season:String(season),day:String(day),competition:competitionId});
  const response=await fetch("/__fa_dev_private__/season-view?"+query,{credentials:"same-origin",cache:"no-store",signal:state.abort.signal});
  if(revision!==state.revision)return;
  if(!response.ok){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:response.status});return;}
  const view=await response.json();
  if(revision!==state.revision)return;
  if(view.kind!=="protected-debug-projection"||view.seasonNumber!==season||view.worldDay!==day||view.competitionId!==competitionId)return;
  state.view=view;
  emit("fa:protected-debug-source-change",{kind:"protected-debug",enabled:true,revision,view});
 }catch(error){if(revision===state.revision&&error?.name!=="AbortError"){state.view=null;emit("fa:protected-debug-source-unavailable",{revision,status:0});}}
}
for(const name of ["fa:debug-mode-change","fa:dev-progress-change","fa:dev-world-day-change","fa:competition-route-change","pageshow"])window.addEventListener(name,()=>{void refreshDebugSource()});
void refreshDebugSource();
