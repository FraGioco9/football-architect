/** Explicit, owner-authenticated immutable approval of verified Season 2 members.
 * Does not advance world_state; future sporting engine must support season N.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parseIdempotencyKey,parsePrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {readSeasonTwoCandidate} from './season-two-candidate-read.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
export async function approveSeasonTwoSnapshot(db:Database,session:AdminSession,input:unknown,keyInput:string,now:number):Promise<Outcome>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(422,'invalid_prerequisites');
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='expectedGeneration,expectedRevision,snapshotHash'||typeof v.snapshotHash!=='string'||!/^[a-f0-9]{64}$/.test(v.snapshotHash))throw new ApiError(422,'invalid_prerequisites');
 const cmd=parsePrepareRequest({expectedGeneration:v.expectedGeneration,expectedRevision:v.expectedRevision}),key=parseIdempotencyKey(keyInput);
 const hash=await hashText(JSON.stringify({command:'approve-season-two-v1',actor:session.actor.id,...cmd,snapshotHash:v.snapshotHash}));
 const previous=await replay(db,session,cmd,key,hash,now);if(previous)return previous;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==1||world.phase!=='closed'||world.day!==56||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'qualification_prerequisites');
 const candidate=await readSeasonTwoCandidate(db),snapshot=candidate.snapshot;
 if(snapshot.snapshotHash!==v.snapshotHash||snapshot.readyForActivation!==false)throw new ApiError(409,'stale_world');
 const existing=await db.prepare('SELECT target_season FROM season_two_approvals WHERE target_season=2').first();
 if(existing)throw new ApiError(409,'qualification_already_approved');
 const persisted={schemaVersion:snapshot.schemaVersion,season:snapshot.season,sourceSeason:snapshot.sourceSeason,sourceArchiveHash:snapshot.sourceArchiveHash,policyId:snapshot.policyId,bindings:snapshot.bindings};
 if(await canonicalHash(persisted)!==snapshot.snapshotHash)throw new ApiError(422,'qualification_evidence_invalid');
 const outcome:Outcome={world:{...world,revision:world.revision+1},operationId:crypto.randomUUID()};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='closed' AND day=56",[world.generation,world.revision]),
   abortUnless(db,'SELECT 1 FROM season_archives WHERE season_number=1 AND generation=? AND archive_hash=?',[world.generation,snapshot.sourceArchiveHash]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_two_approvals WHERE target_season=2)=0',[]),
   db.prepare('INSERT INTO season_two_approvals(target_season,generation,source_archive_hash,snapshot_hash,snapshot_json,approved_by,approved_at) VALUES(2,?,?,?,?,?,?)').bind(world.generation,snapshot.sourceArchiveHash,snapshot.snapshotHash,JSON.stringify(persisted),session.actor.id,now),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(outcome.operationId,world.generation,key,hash,session.actor.id,'approve-season-two-v1',world.revision,outcome.world.revision,JSON.stringify(outcome),now)
  ]);
  return outcome;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.revision!==world.revision||current.generation!==world.generation)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'qualification_unavailable');
 }
}
