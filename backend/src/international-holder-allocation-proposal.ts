/** Non-binding holder accommodation proposal. Never writes or grants qualification.
 * Preserve 3 clubs per country in each cup; all policy decisions remain owner-blocked.
 */
import {ApiError} from './errors.ts';
import type {NextSeasonMembership} from './next-season-membership.ts';
import type {HolderReview} from './international-holder-review.ts';
export interface HolderMove {
 readonly cup:'int-1'|'int-2';
 readonly championClubId:string;
 readonly removedClubId:string|null;
 readonly sourceCup:'int-1'|'int-2'|null;
 readonly swapClubId:string|null;
}
const invalid=():never=>{throw new ApiError(422,'qualification_evidence_invalid')};
export function proposeHolderAllocation(candidate:NextSeasonMembership,holders:readonly HolderReview[]){
 if(candidate.season!==2||candidate.status!=='provisional-results-derived'||holders.length!==2)return invalid();
 const countryIds=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const cupIds=['int-1','int-2'] as const;
 const cups=new Map(cupIds.map(id=>{
  const binding=candidate.bindings.find(b=>b.competitionId===id);
  if(!binding||binding.clubIds.length!==24)return invalid();
  return [id,[...binding.clubIds]] as const;
 }));
 if(new Set([...cups.values()].flat()).size!==48||cupIds.some(cup=>countryIds.some(country=>cups.get(cup)!.filter(id=>id.startsWith(country+'-')).length!==3)))return invalid();
 const moves:HolderMove[]=[];
 const seen=new Set<string>();
 for(const cup of cupIds){
  const holder=holders.find(h=>h.competitionId===cup);
  if(!holder||seen.has(holder.championClubId)||holder.countryId!==holder.championClubId.split('-')[0]||!countryIds.includes(holder.countryId))return invalid();
  seen.add(holder.championClubId);
  const target=cups.get(cup)!;
  const otherId=cup==='int-1'?'int-2':'int-1',other=cups.get(otherId)!;
  if(target.includes(holder.championClubId)){moves.push({cup,championClubId:holder.championClubId,removedClubId:null,sourceCup:null,swapClubId:null});continue}
  const displaced=target.filter(id=>id.startsWith(holder.countryId+'-')).at(-1);
  if(!displaced)return invalid();
  const oldIndex=other.indexOf(holder.championClubId);
  const sourceCup=oldIndex===-1?null:otherId;
  target[target.indexOf(displaced)]=holder.championClubId;
  if(sourceCup)other[oldIndex]=displaced;
  moves.push({cup,championClubId:holder.championClubId,removedClubId:displaced,sourceCup,swapClubId:sourceCup?displaced:null});
 }
 if(new Set([...cups.values()].flat()).size!==48||cupIds.some(cup=>countryIds.some(country=>cups.get(cup)!.filter(id=>id.startsWith(country+'-')).length!==3))||
    holders.some(h=>!cups.get(h.competitionId)!.includes(h.championClubId)))return invalid();
 return Object.freeze({status:'proposal-requires-owner-approval' as const,
  bindings:Object.freeze(cupIds.map(cup=>Object.freeze({competitionId:cup,clubIds:Object.freeze(cups.get(cup)!)}))),
  moves:Object.freeze(moves.map(x=>Object.freeze(x))),readyForActivation:false as const});
}
