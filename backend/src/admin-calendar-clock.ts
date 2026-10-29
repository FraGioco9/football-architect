/** Transitional day-1/day-2/day-3 clock for independently scheduled milestones.
 * Legacy sporting progression remains unchanged until a compatible artifact bridge
 * can generate and validate all required schedules and receipts.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {proposeAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';

type EventRow={event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;status:AdministrativeMilestone['status'];receipt_hash:string|null};
export async function advanceAdministrativeClock(db:Database,session:AdminSession,action:'start'|'advance',input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_event_unavailable');
 const name=action==='start'?'start-admin-calendar-v1':'advance-admin-calendar-v1';
 const hash=await hashText(JSON.stringify({command:name,actor:session.actor.id,...cmd}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 const starting=action==='start'&&world.phase==='preparing'&&world.day===0;
 const advancing=action==='advance'&&world.phase==='active'&&world.day>=1&&world.day<12;
 if(world.seasonNumber!==1||world.revision===Number.MAX_SAFE_INTEGER||!(starting||advancing))throw new ApiError(409,'calendar_event_prerequisites');
 const rows=(await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<EventRow>()).results;
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 const template=proposeAdministrativeMilestones();
 if(events.length!==template.length||events.some(e=>!template.some(t=>t.id===e.id&&t.kind===e.kind&&t.scope===e.scope)))throw new ApiError(409,'calendar_event_prerequisites');
 if(events.some(e=>e.day<=world.day&&e.status!=='completed'))throw new ApiError(409,'calendar_event_prerequisites');
 if(await db.prepare('SELECT season_number FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first()||
    await db.prepare('SELECT day FROM season_day_outcomes WHERE season_number=? LIMIT 1').bind(world.seasonNumber).first())throw new ApiError(409,'calendar_event_prerequisites');
 if(world.day>=2){
  const stage=await db.prepare('SELECT generation,fixtures_hash,fixtures_json FROM season_domestic_stages WHERE season_number=1').first<{generation:string;fixtures_hash:string;fixtures_json:string}>();
  if(!stage||stage.generation!==world.generation)throw new ApiError(409,'calendar_event_prerequisites');
  const domestic=rows.find(r=>r.event_id==='domestic:calendar');
  if(!domestic||domestic.status!=='completed'||!domestic.receipt_hash)throw new ApiError(409,'calendar_event_prerequisites');
 }
 const after={...world,phase:'active' as const,day:world.day+1,revision:world.revision+1};
 const operationId=crypto.randomUUID(),result:Outcome={world:after,operationId};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=?',[world.generation,world.revision,world.seasonNumber,world.phase,world.day]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=?)=?',[world.seasonNumber,rows.length]),
   ...rows.map(r=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind=? AND scope=? AND scheduled_day=? AND event_order=? AND status=?',[world.seasonNumber,r.event_id,r.kind,r.scope,r.scheduled_day,r.event_order,r.status])),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_calendars WHERE season_number=?)=0',[world.seasonNumber]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_day_outcomes WHERE season_number=?)=0',[world.seasonNumber]),
   ...(world.day>=2?[abortUnless(db,'SELECT 1 FROM season_domestic_stages WHERE season_number=1 AND generation=?',[world.generation])]:[]),
   db.prepare('UPDATE world_state SET phase=?,day=?,revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(after.phase,after.day,world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,key,hash,session.actor.id,name,world.revision,after.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
