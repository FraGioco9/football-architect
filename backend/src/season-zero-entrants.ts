/** The approved Season 1 snapshot is the *only* Season 0 entrant source.
 * Independent, generation-bound scope receipts are never inferred from static catalogues.
 */
import {ApiError} from './errors.ts';
import {hashText,type AdminSession} from './auth.ts';
import type {Database} from './database.ts';
import type {WorldV1} from './types.ts';
import {readWorld} from './world-repository.ts';
import {loadApprovedSnapshot} from './approved-season-one.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {parseIdempotencyKey,parsePrepareRequest} from './command-contract.ts';
import {abortUnless,sessionGuard,replay,type Outcome} from './command-guards.ts';

export type SeasonZeroScope='domestic'|'international';
export type ZeroReceipt={
 scope:SeasonZeroScope;generation:string;participants_hash:string;rules_hash:string;
 snapshot_hash:string;receipt_hash:string;approved_by:string;approved_at:number;approved_revision:number;
};
const scopes:readonly SeasonZeroScope[]=['domestic','international'];
const invalid=():never=>{throw new ApiError(422,'season_zero_approval_invalid')};
async function receiptFor(row:Omit<ZeroReceipt,'receipt_hash'>){
 return canonicalHash({schemaVersion:1,season:0,generation:row.generation,scope:row.scope,
  participantsHash:row.participants_hash,rulesHash:row.rules_hash,snapshotHash:row.snapshot_hash,
  actor:row.approved_by,approvedAt:row.approved_at,approvedRevision:row.approved_revision});
}
export async function readSeasonZeroAuthority(db:Database,world:WorldV1){
 const snapshot=await loadApprovedSnapshot(),snapshotHash=await canonicalHash(snapshot);
 const rows=(await db.prepare('SELECT scope,generation,participants_hash,rules_hash,snapshot_hash,receipt_hash,approved_by,approved_at,approved_revision FROM season_zero_approvals ORDER BY scope').all<ZeroReceipt>()).results;
 if(rows.length>2)return invalid();
 const approved:Partial<Record<SeasonZeroScope,ZeroReceipt>>={};
 for(const row of rows){
  if(!scopes.includes(row.scope)||approved[row.scope]||row.generation!==world.generation||
   row.participants_hash!==snapshot.participantsHash||row.rules_hash!==snapshot.rulesHash||
   row.snapshot_hash!==snapshotHash||!Number.isSafeInteger(row.approved_at)||row.approved_at<=0||
   !Number.isSafeInteger(row.approved_revision)||row.approved_revision<1||row.approved_revision>world.revision||
   row.receipt_hash!==await receiptFor(row))return invalid();
  approved[row.scope]=row;
 }
 const guards=[
  abortUnless(db,'SELECT 1 WHERE (SELECT count(*) FROM season_zero_approvals)=?',[rows.length]),
  ...rows.map(row=>abortUnless(db,
   'SELECT 1 FROM season_zero_approvals WHERE scope=? AND generation=? AND participants_hash=? AND rules_hash=? AND snapshot_hash=? AND receipt_hash=? AND approved_by=? AND approved_at=? AND approved_revision=?',
   [row.scope,row.generation,row.participants_hash,row.rules_hash,row.snapshot_hash,row.receipt_hash,row.approved_by,row.approved_at,row.approved_revision])),
 ];
 return {snapshot,snapshotHash,approved,guards};
}
export async function confirmSeasonZeroEntrants(db:Database,session:AdminSession,input:unknown,keyInput:string,now:number):Promise<Outcome>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError(422,'invalid_season_zero_confirmation');
 const v=input as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='expectedGeneration,expectedRevision,scope,snapshotHash'||
   !scopes.includes(v.scope as SeasonZeroScope)||typeof v.snapshotHash!=='string'||!/^[a-f0-9]{64}$/.test(v.snapshotHash))
  throw new ApiError(422,'invalid_season_zero_confirmation');
 const cmd=parsePrepareRequest({expectedGeneration:v.expectedGeneration,expectedRevision:v.expectedRevision});
 const key=parseIdempotencyKey(keyInput),scope=v.scope as SeasonZeroScope;
 if(!Number.isSafeInteger(now)||now<=0)throw new ApiError(503,'season_zero_confirmation_unavailable');
 const hash=await hashText(JSON.stringify({command:'confirm-season-zero-entrants-v1',actor:session.actor.id,...cmd,scope,snapshotHash:v.snapshotHash}));
 const saved=await replay(db,session,cmd,key,hash,now);if(saved)return saved;
 const world=await readWorld(db);
 if(world.generation!==cmd.expectedGeneration||world.revision!==cmd.expectedRevision)throw new ApiError(409,'stale_world');
 if(world.seasonNumber!==0||world.phase!=='unstarted'||world.day!==0||world.revision===Number.MAX_SAFE_INTEGER)
  throw new ApiError(409,'season_zero_confirmation_prerequisites');
 const authority=await readSeasonZeroAuthority(db,world);
 if(authority.snapshotHash!==v.snapshotHash)throw new ApiError(409,'stale_world');
 if(authority.approved[scope])throw new ApiError(409,'season_zero_already_confirmed');
 const approved_revision=world.revision+1;
 const row={scope,generation:world.generation,participants_hash:authority.snapshot.participantsHash,
  rules_hash:authority.snapshot.rulesHash,snapshot_hash:authority.snapshotHash,
  approved_by:session.actor.id,approved_at:now,approved_revision};
 const receipt_hash=await receiptFor(row),operationId=crypto.randomUUID();
 const result:Outcome={operationId,world:{...world,revision:approved_revision}};
 try{
  await db.batch([
   sessionGuard(db,session,now),...authority.guards,
   abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND season_number=0 AND phase='unstarted' AND day=0",[world.generation,world.revision]),
   abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM season_zero_approvals WHERE scope=?)',[scope]),
   db.prepare('INSERT INTO season_zero_approvals(scope,generation,participants_hash,rules_hash,snapshot_hash,receipt_hash,approved_by,approved_at,approved_revision) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(row.scope,row.generation,row.participants_hash,row.rules_hash,row.snapshot_hash,receipt_hash,row.approved_by,row.approved_at,row.approved_revision),
   db.prepare("UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=? AND season_number=0 AND phase='unstarted'").bind(world.generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(operationId,world.generation,key,hash,session.actor.id,'confirm-season-zero-entrants-v1',world.revision,result.world.revision,JSON.stringify(result),now),
  ]);
  return result;
 }catch{
  const winner=await replay(db,session,cmd,key,hash,now);if(winner)return winner;
  const current=await readWorld(db);
  if(current.generation!==world.generation||current.revision!==world.revision)throw new ApiError(409,'stale_world');
  throw new ApiError(503,'season_zero_confirmation_unavailable');
 }
}
