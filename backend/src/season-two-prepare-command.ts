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
 const name='prepare-season-two-v1',hash=await hashText(JSON.stringify({command:name,actor:session.actor.id,...cmd}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==1||world.phase!=='closed'||world.day!==56)throw new ApiError(409,'qualification_prerequisites');
 const a=await loadApprovedSeasonTwoAuthority(db);
 if(a.world.generation!==world.generation||a.world.revision!==world.revision)throw new ApiError(409,'stale_world');
 const snapshot=a.snapshot;
 const proposal=proposeLifecycleTransition(world,'prepare-next',{calendarComplete:true,drawsComplete:true,dueActivitiesComplete:true,resultsComplete:true,archiveComplete:true,nextSeasonSnapshotApproved:true});
 const result:Outcome={operationId:crypto.randomUUID(),world:proposal.after};
 try{
  await db.batch([
   sessionGuard(db,session,now),
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=1 AND phase='closed' AND day=56",[world.generation,world.revision]),
   ...seasonTwoSourceGuards(db,a),
   ...['seasons','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_archives','season_admin_events','season_domestic_stages'].map(table=>abortUnless(db,`SELECT 1 WHERE (SELECT count(*) FROM ${table} WHERE season_number=2)=0`,[])),
   db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(?,?,?,?,?,?)').bind(2,world.generation,snapshot.participantsHash,snapshot.rulesHash,JSON.stringify(snapshot),now),
   db.prepare("UPDATE world_state SET season_number=2,day=0,phase='preparing',revision=revision+1 WHERE id=1 AND generation=? AND revision=?").bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(result.operationId,world.generation,key,hash,session.actor.id,name,world.revision,result.world.revision,JSON.stringify(result),now),
  ]);return result;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'prepare_next_unavailable');
 }
}
