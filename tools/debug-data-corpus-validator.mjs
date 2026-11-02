// DEBUG-DATA-01: structural validation of five-season unsealed candidates.
// This is a guard, not a completion seal. It does not certify unimplemented
// pot, tie-break or titleholder rules.
import {DEBUG_COUNTRIES,DEBUG_SEASONS} from "./debug-data-schema.mjs";
export function validateFiveSeasonCandidate(corpus){
 if(corpus?.status!=="UNSEALED_NOT_FOR_RUNTIME"||corpus.seasons?.length!==5)throw Error("unsealed five-season candidate required");
 let prior=null;
 for(const [index,season] of corpus.seasons.entries()){
  if(season.seasonNumber!==DEBUG_SEASONS[index]||season.source?.kind!=="debug"||season.source.datasetId!==corpus.datasetId)throw Error("source/season mismatch");
  if(season.predecessorHash!==(prior?.candidateHash??null))throw Error("broken season hash chain");
  for(const country of DEBUG_COUNTRIES){
   for(const tier of [1,2]){
    const id=country+"-"+tier,fragment=season.domestic?.[id];
    if(fragment?.participants?.length!==16||fragment.events?.length!==240)throw Error("domestic fixture count "+id);
    if(fragment.events.some(e=>e.day<1||e.day>56||e.result===null))throw Error("unfinished domestic schedule "+id);
   }
  }
  for(const id of ["int-1","int-2"]){
   const cup=season.cups?.[id];
   if(cup?.participants?.length!==24||cup.events?.length!==93||cup.ties?.length!==11)throw Error("invalid INT24 tournament "+id);
   if(cup.events.some(e=>e.day<1||e.day>56||e.result===null))throw Error("invalid INT24 calendar "+id);
   if(!cup.participants.includes(cup.winner))throw Error("invalid cup winner "+id);
  }
  prior=season;
 }
 return {validCandidate:true,maySeal:false,reason:"unresolved sporting policy gates remain"};
}
