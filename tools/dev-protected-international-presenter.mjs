// I05 opt-in candidate International Cup presenter.
// Uses an isolated readout within the existing fixtures panel; never changes
// matchday navigation, official fixture containers, or public route state.
import {attachProtectedPresenter} from "./dev-protected-page-bridge.mjs";
const item=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node};
export function attachProtectedInternationalPresenter({panel,competitionId}){
 if(!panel||!/^int-[12]$/.test(competitionId))return ()=>{};
 return attachProtectedPresenter({
  kind:"international",
  prepare(payload,{cursor}){
   if(cursor.competitionId!==competitionId||payload.acceptance!=="UNSEALED_NOT_FOR_RUNTIME")throw Error("I05 International source mismatch");
   const target=panel.querySelector("[data-i05-international-candidate]");
   if(!target)throw Error("I05 International outlet missing");
   const old=[...target.childNodes],hidden=target.hidden;
   const list=document.createElement("ol");
   const played=payload.fixtures.filter(e=>e.result!==null&&e.day<=cursor.worldDay);
   for(const fixture of played){
    const score=fixture.result;
    if(!Number.isInteger(score.homeGoals)||!Number.isInteger(score.awayGoals))throw Error("I05 International invalid result");
    list.append(item("li",fixture.homeId+" "+score.homeGoals+" – "+score.awayGoals+" "+fixture.awayId));
   }
   return {target,old,hidden,list,visible:played.length>0};
  },
  commit(tx){tx.target.replaceChildren(tx.list);tx.target.hidden=!tx.visible},
  rollback(tx){tx.target.replaceChildren(...tx.old);tx.target.hidden=tx.hidden}
 });
}
