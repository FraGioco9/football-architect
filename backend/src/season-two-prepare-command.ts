/** Protected Season1→2 preparation; HTTP/UI callers enforce Origin and CSRF. */
import type {Database} from './database.ts';
import {hashText,type AdminSession} from './auth.ts';
import {ApiError} from './errors.ts';
import {parsePrepareRequest,parseIdempotencyKey,type PrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSeasonTwoAuthority} from './season-two-initial-schedule.ts';
import {seasonTwoSourceGuards} from './season-snapshot-authority.ts';
import {proposeLifecycleTransition} from './lifecycle-policy.ts';
export async function prepareSeasonTwo(db:Database,session:AdminSession,input:PrepareRequest,keyInput:string,now:number):Promise<Outcome>{
 const cmd=parsePrepareRequest(input),key=parseIdempotencyKey(keyInput);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'prepare_next_unavailable');
 const name='prepare-season-two-v2',hash=await hashText(JSON.stringify({command:name,actor:session.actor.id,...cmd}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==1||world.phase!=='closed'||world.day!==56)throw new ApiError(409,'qualification_prerequisites');
 const a=await loadApprovedSeasonTwoAuthority(db);
 if(a.world.generation!==world.generation||a.world.revision!==world.revision)throw new ApiError(409,'stale_world');
 const completion=(await db.prepare("SELECT event_id,kind,scope,scheduled_day,event_order,status,receipt_hash FROM season_admin_events WHERE season_number=1 AND event_id IN ('season:archive','season:close','season:next-prepare')").all<{event_id:string;kind:string;scope:string;scheduled_day:number;event_order:number;status:string;receipt_hash:string|null}>()).results;
 const archive=completion.find(e=>e.event_id==='season:archive'),close=completion.find(e=>e.event_id==='season:close'),next=completion.find(e=>e.event_id==='season:next-prepare');
 if(!archive||!close||!next||archive.kind!=='archive-season'||close.kind!=='close-season'||next.kind!=='prepare-next-season'||
    completion.some(e=>e.scope!=='season'||e.scheduled_day!==56)||
    !(archive.event_order<close.event_order&&close.event_order<next.event_order)||
    archive.status!=='completed'||close.status!=='completed'||next.status!=='scheduled'||
    archive.receipt_hash!==a.sourceArchiveHash||close.receipt_hash!==a.sourceArchiveHash||next.receipt_hash!==null)
    throw new ApiError(409,'prepare_next_prerequisites');
 const snapshot=a.snapshot;
 const proposal=proposeLifecycleTransition(world,'prepare-next',{calendarComplete:true,drawsComplete:true,dueActivitiesComplete:true,resultsComplete:true,archiveComplete:true,nextSeasonSnapshotApproved:true});
 const result:Outcome={operationId:crypto.randomUUID(),world:proposal.after};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='closed' AND day=56",[world.generation,world.revision]),
   ...seasonTwoSourceGuards(db,a),
   ...completion.map(e=>abortUnless(db,'SELECT 1 FROM season_admin_events WHERE season_number=1 AND event_id=? AND kind=? AND scope=? AND scheduled_day=? AND event_order=? AND status=? AND receipt_hash IS ?',[e.event_id,e.kind,e.scope,e.scheduled_day,e.event_order,e.status,e.receipt_hash])),
   abortUnless(db,"SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_admin_events WHERE season_number=1 AND status='scheduled' AND event_id<>'season:next-prepare')",[]),
   ...['seasons','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_archives','season_admin_events','season_domestic_stages','season_archive_summaries'].map(table=>abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM ${table} WHERE season_number=2)=0`,[])),
   db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(?,?,?,?,?,?)').bind(2,world.generation,snapshot.participantsHash,snapshot.rulesHash,JSON.stringify(snapshot),now),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=1 AND event_id='season:next-prepare' AND status='scheduled'").bind(now,a.snapshotHash,world.seasonNumber),
   db.prepare("UPDATE world_state SET season_number=2,day=0,phase='preparing',revision=revision+1 WHERE id=1 AND generation=? AND revision=?").bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(result.operationId,world.generation,key,hash,session.actor.id,name,world.revision,result.world.revision,JSON.stringify(result),now),
  ]);return result;
 }catch(error){
  console.error('ADMIN-WORLD-02 prepare-next D1 batch failure',error);
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'prepare_next_unavailable');
 }
}
