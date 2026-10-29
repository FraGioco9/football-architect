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
 if(!/^[a-f0-9]{64}$/.test(archiveHash)||candidate.status!=='provisional-results-derived'||candidate.season!==2||
  candidate.bindings.length!==18||holders.length!==2||new Set(holders.map(h=>h.competitionId)).size!==2)
  throw new ApiError(422,'qualification_evidence_invalid');
 const reasons=['season-two-snapshot-not-approved','next-season-holder-allocation-policy-not-finalized'];
 for(const holder of holders){
  if(holder.requiresQualificationPolicyDecision)reasons.push(holder.competitionId+':holder-conflict');
 }
 return Object.freeze({schemaVersion:1,sourceSeason:1,targetSeason:2,sourceArchiveHash:archiveHash,
  candidateHash:await canonicalHash(candidate),qualificationPolicyId:'int24ChampionAwareV1',
  status:'requires-owner-approval',blockingReasons:Object.freeze(reasons),readyForActivation:false});
}
