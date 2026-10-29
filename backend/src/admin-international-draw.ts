/** International draw milestone: persist both cup draws from the immutable domestic-stage seed. */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {buildInitialSchedule} from './initial-schedule.ts';
import {initialDrawOutcomes} from './initial-draws.ts';
import {dueAdministrativeMilestones} from './admin-calendar-policy.ts';
interface Stage {generation:string;algorithm_version:string;seed:string;participants_hash:string;rules_hash:string;fixtures_hash:string;fixtures_json:string}
interface Event {event_id:string;kind:string;scope:string;scheduled_day:number;event_order:number;status:'scheduled'|'completed';completed_at:number|null;receipt_hash:string|null}
export async function executeInternationalDraw(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'calendar_event_unavailable');
 const hash=await hashText(JSON.stringify({command:'execute-international-draw-v1',actor:session.actor.id,...cmd}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==1||world.phase!=='active'||world.day>=13||world.revision===Number.MAX_SAFE_INTEGER)throw new ApiError(409,'calendar_event_prerequisites');
 const rows=(await db.prepare('SELECT * FROM season_admin_events WHERE season_number=1 ORDER BY scheduled_day,event_order').all<Event>()).results;
 const events=rows.map(r=>({id:r.event_id,kind:r.kind,scope:r.scope,day:r.scheduled_day,order:r.event_order,status:r.status}));
 if(dueAdministrativeMilestones(events,world.day)[0]?.id!=='international:draw'||events.some(e=>e.day<world.day&&e.status!=='completed'))throw new ApiError(409,'calendar_event_prerequisites');
 const stage=await db.prepare('SELECT * FROM season_domestic_stages WHERE season_number=1').first<Stage>(),snapshot=await loadApprovedSnapshot();
 if(!stage||stage.generation!==world.generation||stage.participants_hash!==snapshot.participantsHash||stage.rules_hash!==snapshot.rulesHash)throw new ApiError(422,'calendar_event_prerequisites');
 const stored=await db.prepare('SELECT snapshot_json FROM seasons WHERE season_number=1').first<{snapshot_json:string}>();
 if(!stored||await canonicalHash(JSON.parse(stored.snapshot_json))!==await canonicalHash(snapshot))throw new ApiError(422,'calendar_event_prerequisites');
 const schedule=await buildInitialSchedule(snapshot,stage.seed),domestic=schedule.fixtures.filter(f=>!f.competitionId.startsWith('int-'));
 if(stage.algorithm_version!==schedule.algorithmVersion||stage.fixtures_hash!==await canonicalHash(domestic)||await canonicalHash(JSON.parse(stage.fixtures_json))!==stage.fixtures_hash)throw new ApiError(422,'calendar_event_prerequisites');
 const draws=await initialDrawOutcomes(schedule,snapshot);
 const receipt=await canonicalHash({schemaVersion:1,generation:world.generation,season:1,eventId:'international:draw',domesticHash:stage.fixtures_hash,drawHashes:draws.map(d=>[d.competitionId,d.hash])});
 const operationId=crypto.randomUUID(),result:Outcome={world:{...world,revision:world.revision+1},operationId};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='active' AND day=?",[world.generation,world.revision,world.day]),
   abortUnless(db,'SELECT 1 FROM season_domestic_stages WHERE season_number=1 AND generation=? AND seed=? AND fixtures_hash=? AND fixtures_json=?',[stage.generation,stage.seed,stage.fixtures_hash,stage.fixtures_json]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_draws WHERE season_number=1)=0',[]),
   abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_admin_events WHERE season_number=1)=?',[rows.length]),
   ...rows.map(r=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=1 AND event_id=? AND scheduled_day=? AND event_order=? AND status=? AND completed_at IS ? AND receipt_hash IS ?',[r.event_id,r.scheduled_day,r.event_order,r.status,r.completed_at,r.receipt_hash])),
   ...draws.map(d=>db.prepare('INSERT INTO season_draws VALUES(?,?,?,?,?,?,?,?,?)').bind(1,d.competitionId,'league',schedule.algorithmVersion,stage.seed,d.hash,d.json,'generated',now)),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=1 AND event_id='international:draw' AND status='scheduled' AND scheduled_day=?").bind(now,receipt,world.day),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,key,hash,session.actor.id,'execute-international-draw-v1',world.revision,result.world.revision,JSON.stringify(result),now)
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'calendar_event_unavailable');
 }
}
