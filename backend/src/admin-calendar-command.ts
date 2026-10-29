/** Protected future administrative milestone rescheduling. No fixture mutation. */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {rescheduleAdministrativeMilestone,type AdministrativeMilestone} from './admin-calendar-policy.ts';

interface EventRow {event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;status:AdministrativeMilestone['status']}
export function parseRescheduleRequest(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(422,'invalid_calendar_event');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='day,eventId,expectedGeneration,expectedRevision,order'||
    typeof v.eventId!=='string'||!/^[a-z0-9:-]{3,120}$/.test(v.eventId)||
    !Number.isSafeInteger(v.day)||!Number.isSafeInteger(v.order))throw new ApiError(422,'invalid_calendar_event');
 const expected=parsePrepareRequest({expectedGeneration:v.expectedGeneration,expectedRevision:v.expectedRevision});
 return {...expected,eventId:v.eventId,day:v.day as number,order:v.order as number};
}
export async function rescheduleSeasonEvent(db:Database,session:AdminSession,input:unknown,keyInput:string,now:number):Promise<Outcome>{
 const command=parseRescheduleRequest(input),key=parseIdempotencyKey(keyInput);
 const requestHash=await hashText(JSON.stringify({command:'reschedule-admin-event-v1',actor:session.actor.id,...command}));
 const previous=await replay(db,session,command,key,requestHash,now);if(previous)return previous;
 const world=await readWorld(db);
 if(world.generation!==command.expectedGeneration||world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase==='unstarted'||world.phase==='closed')throw new ApiError(409,'calendar_event_prerequisites');
 const rows=(await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<EventRow>()).results;
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 if(command.day>12)throw new ApiError(409,'calendar_event_prerequisites');
 // A published sporting calendar or finalized results forbids retroactive moves,
 // even if an event row were unexpectedly left in scheduled status.
 const published=await db.prepare('SELECT season_number FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first();
 const finalized=await db.prepare('SELECT day FROM season_day_outcomes WHERE season_number=? LIMIT 1').bind(world.seasonNumber).first();
 if(published||finalized)throw new ApiError(409,'calendar_event_prerequisites');
 const moved=rescheduleAdministrativeMilestone(events,command.eventId,command.day,command.order,world.day);
 const old=events.find(e=>e.id===command.eventId)!,next=moved.find(e=>e.id===command.eventId)!;
 const result:Outcome={operationId:crypto.randomUUID(),world:{...world,revision:world.revision+1}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=?',[world.generation,world.revision,world.seasonNumber,world.phase,world.day]),
   abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_admin_events WHERE season_number=?)=?',[world.seasonNumber,rows.length]),
   ...rows.map(r=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind=? AND scope=? AND scheduled_day=? AND event_order=? AND status=?',[world.seasonNumber,r.event_id,r.kind,r.scope,r.scheduled_day,r.event_order,r.status])),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_calendars WHERE season_number=?)=0',[world.seasonNumber]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_day_outcomes WHERE season_number=?)=0',[world.seasonNumber]),
   db.prepare("UPDATE season_admin_events SET scheduled_day=?,event_order=? WHERE season_number=? AND event_id=? AND scheduled_day=? AND event_order=? AND status='scheduled'").bind(next.day,next.order,world.seasonNumber,old.id,old.day,old.order),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(result.operationId,world.generation,key,requestHash,session.actor.id,'reschedule-admin-event-v1',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,command,key,requestHash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
