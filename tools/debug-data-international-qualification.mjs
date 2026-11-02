// DEBUG-DATA-01: explicit, fail-closed championship-aware INT24 allocation.
// The sporting policy for replacing a domestic slot must be supplied by a
// canonical rules adapter; we must not silently invent a holder exception.
import {DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
const cups=["int-1","int-2"];
const country=id=>id.split("-")[0];
export function allocateInternationalEntrants({previousPlacements,previousWinners,holderReplacementPolicy}){
 if(!previousPlacements||!previousWinners)throw Error("previous season closure required");
 const allocations={};
 for(const cupId of cups){
  const index=cupId==="int-1"?0:3,participants=[];
  for(const c of DEBUG_COUNTRIES){
   const order=previousPlacements[c];
   if(!Array.isArray(order)||order.length!==16||new Set(order).size!==16||order.some(id=>country(id)!==c))throw Error("invalid previous top division "+c);
   participants.push(...order.slice(index,index+3));
  }
  const holder=previousWinners[cupId];
  if(typeof holder!=="string"||!holder)throw Error("missing titleholder "+cupId);
  if(!participants.includes(holder)){
   if(typeof holderReplacementPolicy!=="function")throw Error("titleholder exception requires approved policy for "+cupId);
   const proposal=holderReplacementPolicy({cupId,holder,baseParticipants:[...participants],previousPlacements});
   if(!Array.isArray(proposal)||proposal.length!==24||!proposal.includes(holder))throw Error("invalid holder resolution "+cupId);
   participants.splice(0,participants.length,...proposal);
  }
  if(new Set(participants).size!==24||DEBUG_COUNTRIES.some(c=>participants.filter(id=>country(id)===c).length!==3))throw Error("international quotas invalid after holder resolution "+cupId);
  allocations[cupId]=participants;
 }
 if(new Set([...allocations["int-1"],...allocations["int-2"]]).size!==48)throw Error("overlapping cup allocations");
 return allocations;
}
