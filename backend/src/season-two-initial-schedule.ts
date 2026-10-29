/** Read-only authority loader; never persist or activate an unapproved Season2. */
import type {Database} from './database.ts';
import {ApiError} from './errors.ts';
import {canonicalHash,snapshotHashes,validateApprovedSnapshot} from './catalogue-snapshot.ts';
import {loadApprovedSnapshot,serverCanonicalCatalogue} from './approved-season-one.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
import {readWorld} from './world-repository.ts';
import {buildTrustedSeasonSchedule,type InitialSchedule} from './initial-schedule.ts';
function fail():never{throw new ApiError(422,'schedule_invalid')}
export async function loadApprovedSeasonTwoAuthority(db:Database){
 const review=await readSeasonTwoCandidate(db);
 const approved=await db.prepare('SELECT generation,source_archive_hash,snapshot_hash,snapshot_json FROM season_two_approvals WHERE target_season=2').first<{
  generation:string;source_archive_hash:string;snapshot_hash:string;snapshot_json:string
 }>();
 if(!approved||approved.generation!==review.world.generation||approved.source_archive_hash!==review.sourceArchiveHash||approved.snapshot_hash!==review.snapshot.snapshotHash)fail();
 const {snapshotHash,status,readyForActivation,...manifest}=review.snapshot;
 let stored:unknown;try{stored=JSON.parse(approved.snapshot_json)}catch{return fail()}
 if(await canonicalHash(manifest)!==snapshotHash||await canonicalHash(stored)!==snapshotHash)fail();
 const seasonOne=await loadApprovedSnapshot(),catalogue=serverCanonicalCatalogue();
 const versions=new Map(seasonOne.bindings.map(b=>[b.competitionId,b.rulesVersion]));
 const bindings=manifest.bindings.map(b=>{
  const rulesVersion=versions.get(b.competitionId);if(!rulesVersion)return fail();
  return {competitionId:b.competitionId,rulesVersion,clubIds:b.clubIds};
 });
 const hashes=await snapshotHashes(bindings,catalogue);
 if(hashes.rulesHash!==seasonOne.rulesHash)fail();
 const snapshot=await validateApprovedSnapshot({manifestVersion:1,approvalReference:'season-two-owner-approval:'+snapshotHash,bindings,...hashes},catalogue);
 const after=await readWorld(db);
 if(after.generation!==review.world.generation||after.revision!==review.world.revision||after.phase!=='closed'||after.seasonNumber!==1||after.day!==56)throw new ApiError(409,'stale_world');
 return {world:review.world,snapshot,sourceArchiveHash:review.sourceArchiveHash,snapshotHash,approval:approved};
}
export async function buildApprovedSeasonTwoInitialSchedule(db:Database,seed:string):Promise<InitialSchedule>{
 const authority=await loadApprovedSeasonTwoAuthority(db);
 return buildTrustedSeasonSchedule(authority.snapshot,seed,2);
}
