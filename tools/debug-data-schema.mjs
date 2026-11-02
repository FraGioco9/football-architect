// DEBUG-DATA-01 I01: local-only domain contract. This module never accesses D1.
import {createHash} from "node:crypto";
export const DEBUG_DATA_SCHEMA_VERSION=1;
export const DEBUG_SEASONS=Object.freeze([1,2,3,4,5]);
export const DEBUG_COUNTRIES=Object.freeze(["IT","ENG","ES","DE","FR","PT","NL","BR"]);
export const DEBUG_COMPETITIONS=Object.freeze([...DEBUG_COUNTRIES.flatMap(c=>[c+"-1",c+"-2"]),"int-1","int-2"]);
const ensure=(ok,message)=>{if(!ok)throw new TypeError("DEBUG-DATA-01: "+message);};
export const hash=value=>createHash("sha256").update(typeof value==="string"?value:JSON.stringify(value)).digest("hex");
export function assertApprovedBaseline(input){
 ensure(input?.schemaVersion===1&&input.kind==="season-one-participant-selection","baseline schema");
 ensure(input.status==="owner-approved-participants-only"&&input.season===1,"unapproved baseline");
 ensure(Array.isArray(input.bindings)&&input.bindings.length===18,"18 competition bindings required");
 const seen=new Set();
 const byId=new Map();
 for(const binding of input.bindings){
   const id=binding.competitionId;
   ensure(DEBUG_COMPETITIONS.includes(id)&&!byId.has(id),"duplicate/unknown competition "+id);
   const expected=id.startsWith("int-")?24:16;
   ensure(Array.isArray(binding.clubIds)&&binding.clubIds.length===expected,"invalid participant count: "+id);
   ensure(new Set(binding.clubIds).size===expected,"duplicate participants: "+id);
   for(const clubId of binding.clubIds){
     ensure(/^(IT|ENG|ES|DE|FR|PT|NL|BR)-([1-9]|[1-3][0-9]|40)$/.test(clubId),"invalid club ID");
     if(!id.startsWith("int-")){ensure(clubId.startsWith(id.split("-")[0]+"-"),"wrong country");ensure(!seen.has(clubId),"club in two domestic divisions");seen.add(clubId);}
   }
   byId.set(id,Object.freeze([...binding.clubIds]));
 }
 ensure(seen.size===256,"expected 256 unique domestic clubs");
 for(const id of DEBUG_COMPETITIONS)ensure(byId.has(id),"missing "+id);
 const cups=[...byId.get("int-1"),...byId.get("int-2")];
 ensure(new Set(cups).size===48,"cup participants overlap");
 return byId;
}
export function validateSeasonFragment(fragment){
 ensure(fragment?.schemaVersion===DEBUG_DATA_SCHEMA_VERSION,"schema version");
 ensure(fragment?.source?.kind==="debug"&&fragment.source.namespace==="local-debug","forbidden source");
 ensure(DEBUG_SEASONS.includes(fragment.seasonNumber),"season out of range");
 ensure(DEBUG_COMPETITIONS.includes(fragment.competitionId),"competition unknown");
 ensure(Array.isArray(fragment.participants)&&new Set(fragment.participants).size===fragment.participants.length,"participants invalid");
 ensure(Array.isArray(fragment.events),"events required");
 const ids=new Set();
 for(const event of fragment.events){
   ensure(typeof event.eventId==="string"&&!ids.has(event.eventId),"duplicate/invalid event ID");
   ids.add(event.eventId);
   ensure(Number.isInteger(event.day)&&event.day>=1&&event.day<=56,"day out of range");
   ensure(Number.isInteger(event.order)&&event.order>=0,"event order invalid: "+fragment.seasonNumber+"/"+fragment.competitionId+"/"+event.eventId+" value="+String(event.order));
   ensure(fragment.participants.includes(event.homeId)&&fragment.participants.includes(event.awayId)&&event.homeId!==event.awayId,"invalid fixture participants");
   if(event.result!==null){ensure(Number.isInteger(event.result?.homeGoals)&&event.result.homeGoals>=0&&Number.isInteger(event.result.awayGoals)&&event.result.awayGoals>=0,"invalid score");}
 }
 return true;
}
