/** Day-scoped domestic schedule staging. International fixtures/draws are NOT published here. */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {buildInitialSchedule} from './initial-schedule.ts';
import {dueAdministrativeMilestones,type AdministrativeMilestone} from './admin-calendar-policy.ts';
type Row={event_id:string;kind:AdministrativeMilestone['kind'];scope:string;scheduled_day:number;event_order:number;status:AdministrativeMilestone['status'];completed_at:number|null;receipt_hash:string|null};
export async function stageDomesticCalendar(db:Database,session:AdminSession,input:PrepareRequest,idempotencyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(idempotencyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_event_unavailable');
 const hash=await hashText(JSON.stringify({command:'stage-domestic-calendar-v1',actor:session.actor.id,...cmd}));
 const existing=await replay(db,session,cmd,key,hash,now);if(existing)return existing;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==1||world.phase!=='active'||world.day>=13||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'calendar_event_prerequisites');
 const rows=(await db.prepare('SELECT * FROM season_admin_events WHERE season_number=? ORDER BY scheduled_day,event_order').bind(world.seasonNumber).all<Row>()).results;
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 const due=dueAdministrativeMilestones(events,world.day);
 if(due[0]?.id!=='domestic:calendar'||events.some(e=>e.day<world.day&&e.status!=='completed'))throw new ApiError(409,'calendar_event_prerequisites');
 if(await db.prepare('SELECT season_number FROM season_domestic_stages WHERE season_number=?').bind(world.seasonNumber).first()||
    await db.prepare('SELECT season_number FROM season_calendars WHERE season_number=?').bind(world.seasonNumber).first())throw new ApiError(409,'calendar_event_prerequisites');
 const snapshot=await loadApprovedSnapshot();
 const stored=await db.prepare('SELECT generation,participants_hash,rules_hash,snapshot_json FROM seasons WHERE season_number=?').bind(world.seasonNumber).first<{generation:string;participants_hash:string;rules_hash:string;snapshot_json:string}>();
 if(!stored||stored.generation!==world.generation||stored.participants_hash!==snapshot.participantsHash||stored.rules_hash!==snapshot.rulesHash||
    await canonicalHash(JSON.parse(stored.snapshot_json))!==await canonicalHash(snapshot))throw new ApiError(422,'calendar_event_prerequisites');
 const seed=crypto.randomUUID()+':'+crypto.randomUUID(),schedule=await buildInitialSchedule(snapshot,seed);
 const fixtures=schedule.fixtures.filter(f=>!f.competitionId.startsWith('int-'));
 if(fixtures.length!==3840)throw new ApiError(422,'calendar_event_prerequisites');
 const fixturesJson=JSON.stringify(fixtures),fixturesHash=await canonicalHash(fixtures);
 const receipt=await canonicalHash({schemaVersion:1,season:1,generation:world.generation,eventId:'domestic:calendar',fixturesHash,seed,participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash});
 const operationId=crypto.randomUUID(),result:Outcome={world:{...world,revision:world.revision+1},operationId};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='active' AND day=?",[world.generation,world.revision,world.day]),
   abortUnless(db,'SELECT 1 FROM seasons WHERE season_number=1 AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_json=?',[world.generation,stored.participants_hash,stored.rules_hash,stored.snapshot_json]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=1)=?',[rows.length]),
   ...rows.map(r=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=1 AND event_id=? AND kind=? AND scope=? AND scheduled_day=? AND event_order=? AND status=? AND completed_at IS ? AND receipt_hash IS ?',[r.event_id,r.kind,r.scope,r.scheduled_day,r.event_order,r.status,r.completed_at,r.receipt_hash])),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_domestic_stages WHERE season_number=1)=0',[]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_calendars WHERE season_number=1)=0',[]),
   db.prepare('INSERT INTO season_domestic_stages VALUES(?,?,?,?,?,?,?,?,?)').bind(1,world.generation,schedule.algorithmVersion,seed,snapshot.participantsHash,snapshot.rulesHash,fixturesHash,fixturesJson,now),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=1 AND event_id='domestic:calendar' AND status='scheduled' AND scheduled_day=?").bind(now,receipt,world.day),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,key,hash,session.actor.id,'stage-domestic-calendar-v1',world.revision,result.world.revision,JSON.stringify(result),now)
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
