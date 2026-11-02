// I05 opt-in History presentation against the existing competition History panel.
// Only candidate-complete results are shown; unsealed data is never authoritative.
import {attachProtectedPresenter} from "./dev-protected-page-bridge.mjs";
export function attachProtectedHistoryPresenter({panel,competitionId}){
 if(!panel||!competitionId)return ()=>{};
 return attachProtectedPresenter({
  kind:"history",
  prepare(payload,{cursor}){
   if(cursor.competitionId!==competitionId||payload.acceptance!=="UNSEALED_NOT_FOR_RUNTIME")
    throw Error("I05 History source mismatch");
   const holder=panel.querySelector("[data-i05-history-candidate]");
   if(!holder)throw Error("I05 History candidate outlet absent");
   const previous={text:holder.textContent,hidden:holder.hidden};
   const text=payload.status==="candidate-complete"&&payload.champion
    ?String(payload.champion):"";
   return {holder,previous,text,visible:!!text};
  },
  commit(tx){tx.holder.textContent=tx.text;tx.holder.hidden=!tx.visible},
  rollback(tx){tx.holder.textContent=tx.previous.text;tx.holder.hidden=tx.previous.hidden}
 });
}
