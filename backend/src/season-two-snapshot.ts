/** Deterministic Season 2 membership snapshot, never activation approval.
 * Domestic membership derives from verified promotion/relegation; international
 * membership applies the separately approved titleholder policy.
 */
import {ApiError} from './errors.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import type {NextSeasonMembership} from './next-season-membership.ts';
import type {HolderReview} from './international-holder-review.ts';
import {proposeHolderAllocation} from './international-holder-allocation-proposal.ts';
const invalid=():never=>{throw new ApiError(422,'qualification_evidence_invalid')};
const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'] as const;
export async function buildSeasonTwoSnapshot(sourceArchiveHash:string,candidate:NextSeasonMembership,holders:readonly HolderReview[]){
 if(!/^[a-f0-9]{64}$/.test(sourceArchiveHash)||candidate.season!==2||candidate.status!=='provisional-results-derived')return invalid();
 const allocation=proposeHolderAllocation(candidate,holders);
 const international=new Map<string,readonly string[]>(allocation.bindings.map(b=>[b.competitionId,b.clubIds]));
 const expected=[...countries.flatMap(c=>[c+'-1',c+'-2']),'int-1','int-2'];
 if(candidate.bindings.length!==18||new Set(candidate.bindings.map(x=>x.competitionId)).size!==18)return invalid();
 const bindings=expected.map(id=>{
  const source=candidate.bindings.find(b=>b.competitionId===id);
  const clubIds=id.startsWith('int-')?international.get(id):source?.clubIds;
  if(!source||!clubIds||clubIds.length!==(id.startsWith('int-')?24:16)||new Set(clubIds).size!==clubIds.length)return invalid();
  return Object.freeze({competitionId:id,clubIds:Object.freeze([...clubIds])});
 });
 for(const country of countries){
  const first=bindings.find(b=>b.competitionId===country+'-1')!.clubIds;
  const second=bindings.find(b=>b.competitionId===country+'-2')!.clubIds;
  if(new Set([...first,...second]).size!==32||[...first,...second].some(id=>!id.startsWith(country+'-')))return invalid();
  for(const cup of ['int-1','int-2']){
   if(bindings.find(b=>b.competitionId===cup)!.clubIds.filter(id=>id.startsWith(country+'-')).length!==3)return invalid();
  }
 }
 const cups=bindings.filter(b=>b.competitionId.startsWith('int-'));
 if(new Set(cups.flatMap(b=>b.clubIds)).size!==48||holders.some(h=>!cups.find(b=>b.competitionId===h.competitionId)?.clubIds.includes(h.championClubId)))return invalid();
 const snapshot={schemaVersion:1 as const,season:2 as const,sourceSeason:1 as const,sourceArchiveHash,
  policyId:'int24ChampionAwareV1' as const,bindings:Object.freeze(bindings)};
 return Object.freeze({...snapshot,snapshotHash:await canonicalHash(snapshot),status:'awaiting-season-snapshot-approval' as const,readyForActivation:false as const});
}
