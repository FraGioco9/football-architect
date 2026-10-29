/** Read-only Season2 candidate rebuilt from a sealed and independently rechecked Season1.
 * This endpoint never writes seasons, allocations, approvals, or simulated results.
 */
import {ApiError} from './errors.ts';
import type {Database} from './database.ts';
import {readWorld} from './world-repository.ts';
import {loadSeasonSportingEvidence} from './season-sporting-evidence.ts';
import {createProgression,processSportingDay,tieKey} from './knockout-progression.ts';
import {membershipCandidateFromProgression} from './next-season-membership.ts';
import {reviewInternationalHolders} from './international-holder-review.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
type Receipt={day:number;generation:string;calendar_hash:string;simulation_version:string;outcome_hash:string;outcome_json:string};
type Tie={generation:string;competition_id:string;phase_id:string;tie_id:string;plan_hash:string;plan_json:string};
type Archive={generation:string;calendar_hash:string;results_hash:string;knockout_hash:string;archive_hash:string;results_count:number;days_count:number;ties_count:number};
export async function readSeasonTwoCandidate(db:Database){
 const world=await readWorld(db);
 if(world.phase!=='closed'||world.seasonNumber!==1||world.day!==56)throw new ApiError(409,'qualification_prerequisites');
 const evidence=await loadSeasonSportingEvidence(db,world);
 const archive=await db.prepare('SELECT * FROM season_archives WHERE season_number=1').first<Archive>();
 if(!archive||archive.generation!==world.generation||archive.calendar_hash!==evidence.calendar.calendar_hash||
    archive.days_count!==56||archive.results_count!==4082||archive.ties_count!==54)throw new ApiError(422,'qualification_evidence_invalid');
 const receipts=(await db.prepare('SELECT day,generation,calendar_hash,simulation_version,outcome_hash,outcome_json FROM season_day_outcomes WHERE season_number=1 ORDER BY day').all<Receipt>()).results;
 const ties=(await db.prepare('SELECT generation,competition_id,phase_id,tie_id,plan_hash,plan_json FROM season_knockout_ties WHERE season_number=1 ORDER BY competition_id,phase_id,tie_id').all<Tie>()).results;
 if(receipts.length!==56||ties.length!==54)throw new ApiError(422,'qualification_evidence_invalid');
 const state=createProgression(evidence.snapshot,evidence.schedule);
 for(let i=0;i<receipts.length;i++){
  const expected=await processSportingDay(state,i+1),r=receipts[i];
  const payload={schemaVersion:1,season:1,generation:world.generation,day:i+1,calendarHash:evidence.calendar.calendar_hash,simulationVersion:'temporary-score-v1',results:expected.results};
  const digest=await canonicalHash(payload);
  if(r.day!==i+1||r.generation!==world.generation||r.calendar_hash!==evidence.calendar.calendar_hash||r.simulation_version!=='temporary-score-v1'||r.outcome_hash!==digest||
     await canonicalHash(JSON.parse(r.outcome_json))!==digest)throw new ApiError(422,'qualification_evidence_invalid');
 }
 if(state.results.size!==4082||state.ties.size!==54)throw new ApiError(422,'qualification_evidence_invalid');
 for(const t of ties){
  const expected=state.ties.get(tieKey({competitionId:t.competition_id,phaseId:t.phase_id,tieId:t.tie_id}));
  if(!expected||t.generation!==world.generation||t.plan_hash!==await canonicalHash(expected)||
     await canonicalHash(JSON.parse(t.plan_json))!==t.plan_hash)throw new ApiError(422,'qualification_evidence_invalid');
 }
 const resultsHash=await canonicalHash(receipts.map(x=>x.outcome_hash));
 const knockoutHash=await canonicalHash(ties.map(x=>x.plan_hash));
 const archiveHash=await canonicalHash({schemaVersion:1,season:1,generation:world.generation,calendarHash:evidence.calendar.calendar_hash,resultsHash,knockoutHash,resultsCount:4082,daysCount:56,tiesCount:54});
 if(archive.results_hash!==resultsHash||archive.knockout_hash!==knockoutHash||archive.archive_hash!==archiveHash)throw new ApiError(422,'qualification_evidence_invalid');
 const candidate=membershipCandidateFromProgression(state);
 const holderReview=reviewInternationalHolders(state,candidate);
 return {world,sourceArchiveHash:archiveHash,candidate,holderReview,requiresOwnerQualificationReview:holderReview.some(h=>h.requiresQualificationPolicyDecision)};
}
