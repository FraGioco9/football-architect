/** Atomic Season0 purge. Authorization and typed confirmation precede this D1 command. */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
export interface ResetRequest extends PrepareRequest {confirmation:string}
export async function resetWorld(db:Database,session:AdminSession,input:ResetRequest,keyInput:string,now:number):Promise<Outcome>{
 if(!input||typeof input!=='object'||Array.isArray(input)||input.confirmation!=='RESET SEASON 0'||Object.keys(input).sort().join(',')!=='confirmation,expectedGeneration,expectedRevision')
  throw new ApiError(422,'reset_confirmation_required');
 const cmd=parsePrepareRequest({expectedGeneration:input.expectedGeneration,expectedRevision:input.expectedRevision}),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'reset_unavailable');
 const requestHash=await hashText(JSON.stringify({command:'reset-world-v1',actor:session.actor.id,...cmd,confirmation:input.confirmation}));
 // A reset changes the world generation, so old-generation replay must fail closed.
 // A repeated request is explicitly stale, not a second destructive operation.
 const alreadyRecorded=await replay(db,session,cmd,key,requestHash,now);
 if(alreadyRecorded)throw new ApiError(409,'reset_already_processed');
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber===0||!['preparing','active','closed'].includes(world.phase))throw new ApiError(409,'reset_prerequisites');
 const nextGeneration=crypto.randomUUID(),operationId=crypto.randomUUID();
 const result:Outcome={operationId,world:{schemaVersion:1,generation:nextGeneration,revision:0,seasonNumber:0,day:0,phase:'unstarted'}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=?',[world.generation,world.revision,world.seasonNumber,world.phase,world.day]),
   abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM seasons WHERE generation<>?)',[world.generation]),
   db.prepare("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted' WHERE id=1 AND generation=? AND revision=?").bind(nextGeneration,world.generation,world.revision),
   db.prepare('DELETE FROM season_two_approvals'),
   db.prepare('DELETE FROM season_archive_summaries'),
   db.prepare('DELETE FROM season_archives'),
   db.prepare('DELETE FROM season_admin_events'),
   db.prepare('DELETE FROM season_domestic_stages'),
   db.prepare('DELETE FROM season_knockout_ties'),
   db.prepare('DELETE FROM season_day_outcomes'),
   db.prepare('DELETE FROM season_draws'),
   db.prepare('DELETE FROM season_calendars'),
   db.prepare('DELETE FROM seasons'),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(operationId,world.generation,key,requestHash,session.actor.id,'reset-world-v1',world.revision,world.revision+1,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'reset_unavailable');
 }
}
