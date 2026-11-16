/** Read-only Season2 candidate rebuilt from a sealed and independently rechecked Season1.
 * This endpoint never writes seasons, allocations, approvals, or simulated results.
 */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {membershipCandidateFromProgression} from './domain/qualification/next-season-membership.ts';
import {reviewInternationalHolders} from './domain/qualification/international-holder-review.ts';
import {proposeHolderAllocation} from './domain/qualification/international-holder-allocation-proposal.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {verifyLineupSeasonArchiveV1} from './lineup-season-archive-proof.ts';
import {readClosedSeasonHistory} from './season-archive-read.ts';
import {buildQualificationReviewPacket} from './domain/qualification/qualification-review-packet.ts';
import {buildSeasonTwoSnapshot} from './season-two-snapshot.ts';
type Archive={generation:string;calendar_hash:string;results_hash:string;knockout_hash:string;archive_hash:string;results_count:number;days_count:number;ties_count:number;created_at:number};
export async function readSeasonTwoCandidateSource(db:Database,allowArchivedSource=false){
 const current=await readWorld(db);
 const world=allowArchivedSource&&current.seasonNumber===2?{...current,seasonNumber:1,day:56,phase:'closed' as const}:current;
 if(world.phase!=='closed'||world.seasonNumber!==1||world.day!==56)throw new ApiError(409,'qualification_prerequisites');
 // Season 2 membership MUST depend on the same sealed V2 replay that
 // authorized the prior season's archive and closure. Never rescore Season 1.
 const proof=await verifyLineupSeasonArchiveV1(db,world);
 const evidence=proof.evidence,receipts=proof.rows,ties=proof.ties;
 const archive=await db.prepare('SELECT * FROM season_archives WHERE season_number=1').first<Archive>();
 if(!archive||archive.generation!==world.generation||
    archive.calendar_hash!==evidence.calendar.calendar_hash||
    archive.results_hash!==proof.resultsHash||archive.knockout_hash!==proof.knockoutHash||
    archive.archive_hash!==proof.archiveHash||archive.days_count!==56||
    archive.results_count!==4082||archive.ties_count!==54)
  throw new ApiError(422,'qualification_evidence_invalid');
 const closed=await readClosedSeasonHistory(db,1);
 if(closed.archiveHash!==proof.archiveHash)
  throw new ApiError(422,'qualification_evidence_invalid');
 const state=proof.history.progression;
 const archiveHash=proof.archiveHash;
 const candidate=membershipCandidateFromProgression(state);
 const holderReview=reviewInternationalHolders(state,candidate);
 const holderProposal=proposeHolderAllocation(candidate,holderReview);
 const snapshot=await buildSeasonTwoSnapshot(archiveHash,candidate,holderReview);
 const review=await buildQualificationReviewPacket(archiveHash,candidate,holderReview);
 const approval=await db.prepare('SELECT snapshot_hash,source_archive_hash,generation,approved_at FROM season_two_approvals WHERE target_season=2').first<{snapshot_hash:string;source_archive_hash:string;generation:string;approved_at:number}>();
 if(approval&&(approval.snapshot_hash!==snapshot.snapshotHash||approval.source_archive_hash!==archiveHash||approval.generation!==world.generation))throw new ApiError(422,'qualification_evidence_invalid');
 const activation={targetSeason:2,ready:!!approval&&current.seasonNumber===1&&current.phase==='closed'&&current.day===56,blockingReasons:approval?[]:['season-two-owner-approval-required']};
 const reviewPacket={world:current,activation,sourceArchiveHash:archiveHash,candidate,holderReview,holderProposal,snapshot,review,approval:approval?{snapshotHash:approval.snapshot_hash,approvedAt:approval.approved_at}:null,requiresOwnerQualificationReview:!approval};
 return {review:reviewPacket,source:{world,evidence,archive,receipts,ties,proof}};
}
export async function readSeasonTwoCandidate(db:Database){return (await readSeasonTwoCandidateSource(db)).review;}
