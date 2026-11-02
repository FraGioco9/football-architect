// I05 DEV-only History controller; never injected by public page bundles.
import {attachProtectedHistoryPresenter} from "./dev-protected-history-presenter.mjs";
let detach=null,outlet=null;
const enabled=()=>document.documentElement.dataset.faI03Renderer==="1"&&
 document.documentElement.dataset.faI05History==="1";
function reset(){
 if(detach){const dispose=detach;detach=null;dispose()}
 if(outlet){outlet.remove();outlet=null}
}
export function syncProtectedHistoryController(){
 if(!enabled()){reset();return false}
 if(detach)return true;
 const panel=document.getElementById("competition-panel-history");
 const definition=window.faCompetitionContext?.currentDefinition||window.faCompetitionContext?.definition;
 if(!panel||!definition?.id)return false;
 // Add only an empty, hidden candidate outlet; preserve existing History UI.
 outlet=document.createElement("p");
 outlet.dataset.i05HistoryCandidate="";
 outlet.className="app-competition-status";
 outlet.hidden=true;
 panel.append(outlet);
 detach=attachProtectedHistoryPresenter({panel,competitionId:definition.id});
 return true;
}
for(const name of ["fa:competition-route-change","fa:debug-mode-change","pageshow"])
 window.addEventListener(name,()=>{reset();syncProtectedHistoryController()});
window.addEventListener("fa:protected-debug-source-pending",()=>{if(!enabled())reset()});
syncProtectedHistoryController();
