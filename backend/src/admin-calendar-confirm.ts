/** Finalize only participant-confirmation events against the immutable trusted Season 1 snapshot.
 * Artifact-producing events are explicitly not supported by this command.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parseIdempotencyKey,parsePrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {dueAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';

type Row={event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;status:AdministrativeMilestone['status']};
export function parseCompleteEventRequest(value:unknown){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ApiError(422,'invalid_calendar_event');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='eventId,expectedGeneration,expectedRevision'||
    typeof v.eventId!=='string'||!/^[a-z0-9:-]{3,120}$/.test(v.eventId))throw new ApiError(422,'invalid_calendar_event');
 return {...parsePrepareRequest({expectedGeneration:v.expectedGeneration,expectedRevision:v.expectedRevision}),eventId:v.eventId};
}
export async function completeConfirmationEvent(db:Database,session:AdminSession,input:unknown,keyInput:string,now:number):Promise<Outcome>{
 const command=parseCompleteEventRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_event_unavailable');
 const hash=await hashText(JSON.stringify({command:'confirm-admin-event-v1',actor:session.actor.id,...command}));
 const saved=await replay(db,session,command,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==command.expectedGeneration||world.revision!==command.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.phase!=='active'||world.day<1||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'calendar_event_prerequisites');
 const rows=(await db.prepare('SELECT event_id,kind,scope,scheduled_day,event_order,status FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<Row>()).results;
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 const due=dueAdministrativeMilestones(events,world.day);
 const first=due[0];
 if(!first||first.id!==command.eventId||!first.kind.startsWith('confirm-')||
    events.some(e=>e.day<world.day&&e.status!=='completed'))throw new ApiError(409,'calendar_event_prerequisites');
 const snapshot=await loadApprovedSnapshot();
 const stored=await db.prepare('SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=?').bind(world.seasonNumber).first<{generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}>();
 if(!stored||stored.generation!==world.generation||stored.participants_hash!==snapshot.participantsHash||stored.rules_hash!==snapshot.rulesHash||
    await canonicalHash(JSON.parse(stored.snapshot_json))!==await canonicalHash(snapshot))throw new ApiError(422,'calendar_event_prerequisites');
 const receipt=await canonicalHash({schemaVersion:1,season:world.seasonNumber,generation:world.generation,eventId:first.id,kind:first.kind,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash});
 const operationId=crypto.randomUUID(),result:Outcome={operationId,world:{...world,revision:world.revision+1}};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=? AND phase=? AND day=?',[world.generation,world.revision,world.seasonNumber,world.phase,world.day]),
   abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=? AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',[world.seasonNumber,stored.generation,stored.participants_hash,stored.rules_hash,stored.snapshot_json]),
   abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM season_admin_events WHERE season_number=?)=?',[world.seasonNumber,rows.length]),
   ...rows.map(r=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind=? AND scope=? AND scheduled_day=? AND event_order=? AND status=?',[world.seasonNumber,r.event_id,r.kind,r.scope,r.scheduled_day,r.event_order,r.status])),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=? AND event_id=? AND scheduled_day=? AND status='scheduled'").bind(now,receipt,world.seasonNumber,first.id,world.day),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,key,hash,session.actor.id,'confirm-admin-event-v1',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,command,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
