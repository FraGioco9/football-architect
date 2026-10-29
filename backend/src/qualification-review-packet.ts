/** Audit-friendly, read-only Season2 qualification review packet. No approval capability. */
import {ApiError} from './errors.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import type {NextSeasonMembership} from './next-season-membership.ts';
import type {HolderReview} from './international-holder-review.ts';
export interface QualificationReviewPacket {
 schemaVersion:1;
 sourceSeason:1;
 targetSeason:2;
 sourceArchiveHash:string;
 candidateHash:string;
 qualificationPolicyId:'int24ChampionAwareV1';
 status:'requires-owner-approval';
 blockingReasons:readonly string[];
 readyForActivation:false;
}
export async function buildQualificationReviewPacket(archiveHash:string,candidate:NextSeasonMembership,holders:readonly HolderReview[]):Promise<QualificationReviewPacket>{
 const countries=['IT','ENG','ES','DE','FR','PT','NL','BR'];
 const expectedIds=[...countries.flatMap(c=>[c+'-1',c+'-2']),'int-1','int-2'];
 const ids=new Set(candidate.bindings.map(b=>b.competitionId));
 const cups=candidate.bindings.filter(b=>b.competitionId.startsWith('int-'));
 if(!/^[a-f0-9]{64}$/.test(archiveHash)||candidate.status!=='provisional-results-derived'||candidate.season!==2||
  candidate.bindings.length!==18||ids.size!==18||expectedIds.some(id=>!ids.has(id))||
  candidate.bindings.some(b=>!Array.isArray(b.clubIds)||b.clubIds.length!==(b.competitionId.startsWith('int-')?24:16)||new Set(b.clubIds).size!==b.clubIds.length)||
  new Set(cups.flatMap(b=>b.clubIds)).size!==48||
  holders.length!==2||new Set(holders.map(h=>h.competitionId)).size!==2||
  holders.some(h=>!['int-1','int-2'].includes(h.competitionId)||!countries.includes(h.countryId)||!h.championClubId.startsWith(h.countryId+'-')||
   (h.allocatedCup!==null&&!['int-1','int-2'].includes(h.allocatedCup))||
   h.requiresQualificationPolicyDecision!==(h.allocatedCup!==h.competitionId)))
  throw new ApiError(422,'qualification_evidence_invalid');
 const reasons=['season-two-snapshot-not-approved','next-season-holder-allocation-policy-not-finalized'];
 for(const holder of holders){
  if(holder.requiresQualificationPolicyDecision)reasons.push(holder.competitionId+':holder-conflict');
 }
 return Object.freeze({schemaVersion:1,sourceSeason:1,targetSeason:2,sourceArchiveHash:archiveHash,
  candidateHash:await canonicalHash(candidate),qualificationPolicyId:'int24ChampionAwareV1',
  status:'requires-owner-approval',blockingReasons:Object.freeze(reasons),readyForActivation:false});
}
