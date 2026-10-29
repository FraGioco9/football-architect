import {loadSeasonSnapshotAuthority} from './season-snapshot-authority.ts';
/** Explicit opt-in for next-generation administrative milestones.
 * No initial season fixtures or draws are created by this operation.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parseIdempotencyKey,parsePrepareRequest,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {proposeAdministrativeMilestones,proposeEndSeasonMilestones} from './admin-calendar-policy.ts';

export async function initializeAdministrativeEvents(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const command=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_event_unavailable');
 const hash=await hashText(JSON.stringify({command:'initialize-admin-events-v2',actor:session.actor.id,...command}));
 const saved=await replay(db,session,command,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==command.expectedGeneration||world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
 if(![1,2].includes(world.seasonNumber)||world.phase!=='preparing'||world.day!==0||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'calendar_event_prerequisites');
 const authority=await loadSeasonSnapshotAuthority(db,world);
 const count=(await db.prepare('SELECT count(*) AS n FROM season_admin_events WHERE season_number=?').bind(world.seasonNumber).first<{n:number}>())?.n;
 if(count!==0)throw new ApiError(409,'calendar_event_prerequisites');
 if(await db.prepare('SELECT season_number FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first()||
    await db.prepare('SELECT season_number FROM season_draws WHERE season_number=?').bind(world.seasonNumber).first())throw new ApiError(409,'calendar_event_prerequisites');
 const events=[...proposeAdministrativeMilestones(),...proposeEndSeasonMilestones()],operationId=crypto.randomUUID();
 const result:Outcome={world:{...world,revision:world.revision+1},operationId};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   ...authority.guards,
   abortUnless(db,`SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=${world.seasonNumber} AND phase='preparing' AND day=0`,[world.generation,world.revision]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=?)=0',[world.seasonNumber]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_calendars WHERE season_number=?)=0',[world.seasonNumber]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=?)=0',[world.seasonNumber]),
   ...events.map(e=>db.prepare('INSERT INTO season_admin_events(season_number,event_id,kind,scope,scheduled_day,event_order,created_at) VALUES(?,?,?,?,?,?,?)').bind(world.seasonNumber,e.id,e.kind,e.scope,e.day,e.order,now)),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,key,hash,session.actor.id,'initialize-admin-events-v2',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,command,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
