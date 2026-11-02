// DEBUG-DATA-01: local implementation of approved ChampionAwareV1 policy.
// Mirrors docs/admin-world-int24-holder-policy.md; never calls D1.
import {DEBUG_COUNTRIES} from "./debug-data-schema.mjs";
const IDS=["int-1","int-2"];
const country=id=>id.split("-")[0];
export function allocateInternationalEntrants({previousPlacements,previousWinners}){
 if(!previousPlacements||!previousWinners)throw Error("previous closed season required");
 const cups=new Map(IDS.map(id=>[id,[]])),moves=[];
 for(const c of DEBUG_COUNTRIES){
  const ranks=previousPlacements[c];
  if(!Array.isArray(ranks)||ranks.length!==16||new Set(ranks).size!==16||ranks.some(id=>country(id)!==c))throw Error("invalid country closure "+c);
  cups.get("int-1").push(...ranks.slice(0,3));
  cups.get("int-2").push(...ranks.slice(3,6));
 }
 const holders=IDS.map(cup=>({cup,clubId:previousWinners[cup]}));
 if(holders.some(h=>typeof h.clubId!=="string"||!DEBUG_COUNTRIES.includes(country(h.clubId)))||new Set(holders.map(h=>h.clubId)).size!==2)throw Error("invalid holders");
 const protectedHolders=new Set(holders.map(h=>h.clubId));
 for(const {cup,clubId} of holders){
  const target=cups.get(cup);
  if(target.includes(clubId)){moves.push({cup,holder:clubId,removed:null,sourceCup:null});continue;}
  const oldCup=cup==="int-1"?"int-2":"int-1",other=cups.get(oldCup),c=country(clubId);
  const displaced=target.filter(id=>country(id)===c&&!protectedHolders.has(id)).at(-1);
  if(!displaced)throw Error("no valid unprotected holder replacement "+cup);
  const oldIndex=other.indexOf(clubId);
  target[target.indexOf(displaced)]=clubId;
  if(oldIndex!==-1)other[oldIndex]=displaced;
  moves.push({cup,holder:clubId,removed:displaced,sourceCup:oldIndex!==-1?oldCup:null});
 }
 const allocations=Object.fromEntries(IDS.map(id=>[id,[...cups.get(id)]]));
 const all=IDS.flatMap(id=>allocations[id]);
 if(new Set(all).size!==48||IDS.some(id=>DEBUG_COUNTRIES.some(c=>allocations[id].filter(x=>country(x)===c).length!==3))||holders.some(h=>!allocations[h.cup].includes(h.clubId)))throw Error("holder allocation invalid");
 return {allocations,moves,policyId:"int24ChampionAwareV1"};
}
