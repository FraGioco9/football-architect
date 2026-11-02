// DEBUG-DATA-01: structural validation of five-season unsealed candidates.
// This is a guard, not a completion seal. It does not certify unimplemented
// pot, tie-break or titleholder rules.
import {DEBUG_COUNTRIES,DEBUG_SEASONS,hash} from "./debug-data-schema.mjs";
import {nextDomesticMembership} from "./debug-data-postseason.mjs";
import {validateInternationalPotDraw} from "./debug-data-international-pots.mjs";
import {allocateInternationalEntrants} from "./debug-data-international-qualification.mjs";
export function validateFiveSeasonCandidate(corpus){
 if(corpus?.status!=="UNSEALED_NOT_FOR_RUNTIME"||corpus.seasons?.length!==5)throw Error("unsealed five-season candidate required");
 let prior=null;
 for(const [index,season] of corpus.seasons.entries()){
  if(season.seasonNumber!==DEBUG_SEASONS[index]||season.source?.kind!=="debug"||season.source.datasetId!==corpus.datasetId)throw Error("source/season mismatch");
  if(season.predecessorHash!==(prior?.candidateHash??null))throw Error("broken season hash chain");
  const {candidateHash,...unsigned}=season;
  if(hash(unsigned)!==candidateHash)throw Error("tampered season candidate hash");
  if(prior){
   const memberships=new Map(DEBUG_COUNTRIES.flatMap(c=>[1,2].map(t=>{const id=c+"-"+t;return [id,prior.domestic[id].participants]})));
   const outcomes=new Map(Object.entries(prior.domesticOutcomes));
   const expected=nextDomesticMembership(memberships,outcomes);
   for(const [id,clubs] of expected){if(JSON.stringify([...clubs].sort())!==JSON.stringify([...season.domestic[id].participants].sort()))throw Error("season succession mismatch "+id);}
   const slots=allocateInternationalEntrants({previousPlacements:prior.domesticPlacements,previousWinners:prior.internationalWinners}).allocations;
   for(const id of ["int-1","int-2"])if(JSON.stringify(slots[id])!==JSON.stringify(season.cups[id].participants))throw Error("qualification mismatch "+id);
  }
  for(const country of DEBUG_COUNTRIES){
   for(const tier of [1,2]){
    const id=country+"-"+tier,fragment=season.domestic?.[id];
    if(fragment?.participants?.length!==16||fragment.events?.length!==240)throw Error("domestic fixture count "+id);
    if(fragment.events.some(e=>e.day<1||e.day>56||e.result===null))throw Error("unfinished domestic schedule "+id);
    const post=season.domesticPostseasonEvents?.[id],outcome=season.domesticOutcomes?.[id];
    if(post?.length!==(tier===1?2:5)||post.some(e=>e.day<52||e.day>54||e.result===null)||outcome?.ties?.length!==(tier===1?1:3))throw Error("invalid postseason "+id);
    for(const tie of outcome.ties){const final=tie.fixtures.at(-1);if(!final?.tiebreak||final.tiebreak.winner!==tie.winner||!tie.participants.includes(tie.winner)||!tie.participants.includes(tie.loser)||tie.winner===tie.loser)throw Error("domestic knockout outcome mismatch "+id);}
   }
  }
  for(const id of ["int-1","int-2"]){
   const cup=season.cups?.[id];
   if(cup?.participants?.length!==24||cup.events?.length!==93||cup.ties?.length!==11)throw Error("invalid INT24 tournament "+id);
   if(cup.events.some(e=>e.day<1||e.day>56||e.result===null))throw Error("invalid INT24 calendar "+id);
   if(!cup.participants.includes(cup.winner))throw Error("invalid cup winner "+id);
   for(const tie of cup.ties){const final=tie.fixtures.at(-1);if(!final?.tiebreak||final.tiebreak.winner!==tie.winner||!tie.participants.includes(tie.winner)||!tie.participants.includes(tie.loser)||tie.winner===tie.loser)throw Error("international knockout outcome mismatch "+id);}
   if(cup.pots?.length!==3||cup.pots.some(p=>p.length!==8))throw Error("invalid cup pots "+id);
   validateInternationalPotDraw({participants:cup.participants,pots:cup.pots,events:cup.leagueEvents});
  }
  prior=season;
 }
 return {validCandidate:true,maySeal:false,reason:"unresolved sporting policy gates remain"};
}
