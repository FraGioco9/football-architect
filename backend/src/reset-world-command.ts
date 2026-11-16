/** Atomic Season 0 sporting reset; persisted players and their committed generator batches survive. */
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
   abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM world_reset_permits)',[]),
   abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_lineup_day_outcomes WHERE generation<>?)',[world.generation]),
   abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM match_lineup_result_receipts WHERE generation<>?)',[world.generation]),
   // This authorization is created and consumed within the exact same atomic
   // world-reset batch. Outside the batch, immutable V2 triggers stay active.
   db.prepare('INSERT INTO world_reset_permits(generation,operation_id) VALUES(?,?)')
    .bind(world.generation,operationId),
   db.prepare("UPDATE world_state SET generation=?,revision=0,season_number=0,day=0,phase='unstarted' WHERE id=1 AND generation=? AND revision=?").bind(nextGeneration,world.generation,world.revision),
   // Persisted players reference committed draft IDs: keep both rows and FK parents.
   // Abandon only uncommitted previews from the previous sporting generation.
   db.prepare("DELETE FROM player_generation_drafts WHERE status='preview'"),
   db.prepare('DELETE FROM season_two_approvals'),
   db.prepare('DELETE FROM season_archive_summaries'),
   db.prepare('DELETE FROM season_archives'),
   db.prepare('DELETE FROM season_admin_events'),
   // Old public URLs are deliberately invalidated only by this authorized
   // full-world reset. Clearing both rows and AUTOINCREMENT state in this
   // batch makes the next published match number 1, not the old high-water mark.
   db.prepare('DELETE FROM public_match_numbers'),
   db.prepare("DELETE FROM sqlite_sequence WHERE name='public_match_numbers'"),
   db.prepare('DELETE FROM season_knockout_match_slots'),
   db.prepare('DELETE FROM season_match_slots'),
   db.prepare('DELETE FROM season_domestic_stages'),
   // Match receipts and day envelopes must be removed before their canonical
   // parent rows. Generated players and current club affinities are untouched.
   db.prepare('DELETE FROM match_lineup_result_receipts WHERE generation=?').bind(world.generation),
   db.prepare('DELETE FROM season_lineup_day_outcomes WHERE generation=?').bind(world.generation),
   db.prepare('DELETE FROM season_knockout_ties'),
   db.prepare('DELETE FROM season_day_outcomes'),
   db.prepare('DELETE FROM season_draws'),
   db.prepare('DELETE FROM season_calendars'),
   db.prepare('DELETE FROM seasons'),
   db.prepare('DELETE FROM world_reset_permits WHERE generation=? AND operation_id=?')
    .bind(world.generation,operationId),
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
