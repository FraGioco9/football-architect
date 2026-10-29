import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
import {buildTrustedSeasonSchedule,type InitialSchedule,type SchedulingSnapshot} from './initial-schedule.ts';
const fail=():never=>{throw new ApiError(422,'schedule_invalid')};
/** Read-only fixture generation from a *persisted* approved Season 2 catalog.
 * No client-provided participant list is trusted, and no fixture is persisted.
 * The existing sporting executor remains restricted to Season 1 until its
 * result/knockout/archive machinery has been made season-aware.
 */
export async function buildApprovedSeasonTwoInitialSchedule(db:Database,seed:string):Promise<InitialSchedule>{
 const review=await readSeasonTwoCandidate(db);
 const approved=await db.prepare('SELECT generation,source_archive_hash,snapshot_hash,snapshot_json FROM season_two_approvals WHERE target_season=2').first<{
  generation:string;source_archive_hash:string;snapshot_hash:string;snapshot_json:string
 }>();
 if(!approved||approved.generation!==review.world.generation||approved.source_archive_hash!==review.sourceArchiveHash||
  approved.snapshot_hash!==review.snapshot.snapshotHash)return fail();
 const {snapshotHash,status,readyForActivation,...manifest}=review.snapshot;
 let stored:unknown;
 try{stored=JSON.parse(approved.snapshot_json)}catch{return fail()}
 if(await canonicalHash(manifest)!==snapshotHash||await canonicalHash(stored)!==snapshotHash)return fail();
 const seasonOne=await loadApprovedSnapshot();
 const versions=new Map(seasonOne.bindings.map(b=>[b.competitionId,b.rulesVersion]));
 const bindings=manifest.bindings.map(b=>{
  const rulesVersion=versions.get(b.competitionId);if(!rulesVersion)return fail();
  return {competitionId:b.competitionId,rulesVersion,clubIds:b.clubIds};
 });
 const participantsHash=await canonicalHash([...bindings].sort((a,b)=>a.competitionId.localeCompare(b.competitionId,'en'))
  .map(b=>({competitionId:b.competitionId,clubIds:[...b.clubIds].sort()})));
 const trusted:SchedulingSnapshot={bindings,participantsHash,rulesHash:seasonOne.rulesHash};
 return buildTrustedSeasonSchedule(trusted,seed,2);
}
