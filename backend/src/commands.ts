import {ApiError} from './errors.ts';
import {type AdminSession,hashText} from './auth.ts';
import type {Database} from './database.ts';
import {parseIdempotencyKey,parsePrepareRequest,type PrepareRequest} from './command-contract.ts';
import {requireApprovedSnapshot,type ApprovedSnapshot} from './catalogue-snapshot.ts';

import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';
/** D1 batch is the mutation boundary. All positive approval data is server-owned. */
export async function prepareSeason(db:Database,session:AdminSession,input:PrepareRequest,idempotencyKey:string,snapshot:ApprovedSnapshot|null,now:number):Promise<Outcome>{
 const command=parsePrepareRequest(input),key=parseIdempotencyKey(idempotencyKey),trusted=requireApprovedSnapshot(snapshot);
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'prepare_unavailable');
 const requestHash=await hashText(JSON.stringify({command:'prepare-season-v1',actor:session.actor.id,...command,snapshot:trusted}));
 try{
  const previous=await replay(db,session,command,key,requestHash,now);if(previous)return previous;
  const operationId=crypto.randomUUID();
  const result:Outcome={operationId,world:{schemaVersion:1,generation:command.expectedGeneration,revision:command.expectedRevision+1,seasonNumber:1,day:0,phase:'preparing'}};
  const worldGuard=abortUnless(db,`SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND phase='unstarted' AND season_number=0 AND day=0`,[command.expectedGeneration,command.expectedRevision]);
  try{
   await db.batch([
    sessionGuard(db,session,now),worldGuard,
    db.prepare('INSERT INTO seasons(season_number,generation,participants_hash,rules_hash,snapshot_json,created_at) VALUES(1,?,?,?,?,?)')
     .bind(command.expectedGeneration,trusted.participantsHash,trusted.rulesHash,JSON.stringify(trusted),now),
    db.prepare("UPDATE world_state SET revision=revision+1,season_number=1,day=0,phase='preparing' WHERE id=1 AND generation=? AND revision=?")
     .bind(command.expectedGeneration,command.expectedRevision),
    db.prepare(`INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at)
     VALUES(?,?,?,?,?,'prepare-season-v1',?,?,?,?)`)
     .bind(operationId,command.expectedGeneration,key,requestHash,session.actor.id,command.expectedRevision,result.world.revision,JSON.stringify(result),now)
   ]);
   return result;
  }catch{
   // A duplicate contender rolls back before reading the durable winner's outcome.
   const winner=await replay(db,session,command,key,requestHash,now);if(winner)return winner;
   const current=await db.prepare('SELECT revision,phase FROM world_state WHERE id=1').first<{revision:number;phase:string}>();
   if(current&&(current.revision!==command.expectedRevision||current.phase!=='unstarted'))throw new ApiError(409,'stale_world');
   throw new ApiError(503,'prepare_unavailable');
  }
 }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(503,'prepare_unavailable')}
}
