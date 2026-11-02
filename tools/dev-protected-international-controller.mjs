// I05 candidate-only International outlet. Manual DEV import only.
import {attachProtectedInternationalPresenter} from "./dev-protected-international-presenter.mjs";
let detach=null;
const enabled=()=>document.documentElement.dataset.faI03Renderer==="1"&&document.documentElement.dataset.faI05International==="1";
function reset(){
 if(detach){const stop=detach;detach=null;stop()}

}
export function syncProtectedInternationalController(){
 if(!enabled()){reset();return false}
 if(detach)return true;
 const competitionId=window.faCompetitionContext?.currentDefinition?.id||window.faCompetitionContext?.definition?.id;
 const panel=document.getElementById("competition-panel-fixtures");
 if(!panel||!/^int-[12]$/.test(competitionId))return false;
 detach=attachProtectedInternationalPresenter({competitionId});
 return true;
}
for(const name of ["fa:competition-route-change","fa:debug-mode-change","pageshow"])
 window.addEventListener(name,()=>{reset();syncProtectedInternationalController()});
window.addEventListener("fa:protected-debug-source-pending",()=>{if(!enabled())reset()});
syncProtectedInternationalController();
