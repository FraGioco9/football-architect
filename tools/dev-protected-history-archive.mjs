// I05 local-only historical candidate archive. Explicit DEV import only.
// Historical winners are not a sealed/official History dataset.
import {currentDebugSource} from "./dev-protected-debug-source.mjs";
let abort=null,revision=0,holder=null;
const enabled=()=>document.documentElement.dataset.faI03Renderer==="1"&&document.documentElement.dataset.faI05History==="1";
const inHistory=()=>new URL(location.href).searchParams.get("view")==="history"||/\/history\/?$/.test(location.pathname);
const clear=()=>{abort?.abort();holder?.remove();holder=null;};
const text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node};
async function refresh(detail){
 clear();revision=detail?.revision??currentDebugSource().revision;
 if(!enabled()||!inHistory()||detail?.kind!=="protected-debug")return;
 const season=detail.view?.seasonNumber,competitionId=detail.view?.competitionId;
 if(!Number.isInteger(season)||season<2||season>5||!competitionId)return;
 abort=new AbortController();
 try{
  const response=await fetch("/__fa_dev_private__/history-view?season="+season,
   {cache:"no-store",credentials:"same-origin",signal:abort.signal});
  if(!response.ok)throw Error("History unavailable");
  const data=await response.json();
  if(revision!==currentDebugSource().revision||!enabled()||!inHistory())return;
  if(data.kind!=="protected-debug-history"||data.status!=="UNSEALED_NOT_FOR_RUNTIME"||
   data.source?.namespace!=="local-debug"||data.source.datasetId!=="debug-corpus-v1"||
   data.seasonNumber!==season||!Array.isArray(data.records)||data.records.length!==season-1)throw Error("Invalid History candidate");
  const panel=document.getElementById("competition-panel-history");if(!panel)return;
  const section=document.createElement("section");section.dataset.faI05HistoryArchive="";
  section.setAttribute("aria-label","Unsealed local Debug historical candidates");
  const list=document.createElement("ol");
  for(const record of data.records){
   const winner=competitionId.startsWith("int-")?
    record.internationalWinners?.[competitionId]:record.domesticChampions?.[competitionId];
   if(winner)list.append(text("li","Season "+record.seasonNumber+" · "+winner));
  }
  if(!list.childElementCount)return;
  section.append(list);panel.append(section);holder=section;
 }catch(error){if(error?.name!=="AbortError")clear();}
}
window.addEventListener("fa:protected-debug-source-change",event=>{void refresh(event.detail)});
for(const name of ["fa:protected-debug-source-unavailable","fa:protected-debug-source-pending","fa:debug-mode-change","fa:competition-route-change"])
 window.addEventListener(name,clear);
