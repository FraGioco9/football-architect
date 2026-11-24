/** #776 bounded internal settlement executor. No HTTP/calendar caller, automatic
 * funding, policy activation or migrations. All monetary writes reuse #775. */
import type {Database} from './database.ts';
import type {AdminSession} from './auth.ts';
import {ApiError} from './errors.ts';
import {economicAssert,financeSessionGuard,postFreshEconomicBatch,ECONOMIC_FRESH_BATCH_LIMIT,economicReconciliationGuard} from './economic-ledger.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {annualRewardHoldId,rewardCompletionDigest} from './reward-calendar-gate.ts';
import {sessionGuard} from './command-guards.ts';
import {readWorld} from './world-repository.ts';
export {annualRewardHoldId} from './reward-calendar-gate.ts';
import {assertPreparedRewardSettlement,type PreparedRewardSettlement} from './reward-settlement-evidence.ts';
import {reconcileRewardPlan,rewardPostingIntents,type RewardBinding} from './reward-settlement-plan.mjs';

const actorId='reward-settlement-v1';
export const REWARD_BATCH_LIMIT=ECONOMIC_FRESH_BATCH_LIMIT;
const blocked=(code:string):never=>{throw new ApiError(409,code)};


/** Prepared proof is an in-process capability from the official verifier.
 * The live finance operator is checked on every read and write; the immutable
 * business actor is independent of who retries. A prior approved annual hold
 * and matching active policy are prerequisites, not created by this command.
 * Report is a point-in-time observation unless completeCalendar explicitly
 * persists it on the official calendar. No production caller is wired yet. */
export async function executeRewardSettlementBatch(db:Database,session:AdminSession,prepared:PreparedRewardSettlement,now:number,completeCalendar=false){
 assertPreparedRewardSettlement(db,prepared);
 if(!session?.unified)throw new ApiError(403,'economic_authority_required');
 const operator=session.unified,{manifest,previousManifest}=prepared,{plan}=manifest;
 const {generation,season,day}=plan,holdId=annualRewardHoldId(generation,season);
 const binding:RewardBinding={manifestHash:manifest.manifestHash,configVersion:manifest.configVersion,actorId,holdId};
 const access=()=>[
  financeSessionGuard(db,operator.playerId,operator.sessionDigest,operator.csrfDigest,'read',now),
  financeSessionGuard(db,operator.playerId,operator.sessionDigest,operator.csrfDigest,'post',now)
 ];
 const scope="((purpose='REWARD' AND generation=? AND season=?) OR hold_id=? OR business_key LIKE ?)";
 const scopeArgs=[generation,season,holdId,'reward:'+generation+':'+season+':%'];
 const policy=()=>economicAssert(db,`SELECT 1 FROM economic_control c JOIN economic_policy_versions p ON p.version=c.active_version
  WHERE c.id=1 AND c.posting_enabled=1 AND c.active_version=? AND json_extract(p.rules_json,'$.rewardVersion')=?`,
  [manifest.configVersion,plan.rewardVersion]);
 const hold=()=>economicAssert(db,`SELECT 1 FROM economic_holds WHERE id=? AND source_id=? AND account_id='reserve'
  AND purpose='REWARD_BUDGET' AND config_version=? AND amount_arc=? AND actor_id=?`,
  [holdId,holdId,manifest.configVersion,plan.annualBudgetArc,actorId]);
 const treasuries=JSON.stringify([...new Set(plan.rows.map(r=>'club:'+r.clubKey))]);
 const accounts=()=>economicAssert(db,`SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
  SELECT 1 FROM economic_accounts a WHERE a.id=j.value AND a.kind='CLUB_TREASURY'))`,[treasuries]);
 const reversals=()=>db.prepare('SELECT reversal_of FROM economic_transactions WHERE reversal_of IN (SELECT id FROM economic_transactions WHERE '+scope+')').bind(...scopeArgs);
 // Verify every release against its actual reserve debit and immutable receipt.
 const releaseGuard=()=>economicAssert(db,`SELECT 1 WHERE NOT EXISTS(
  SELECT 1 FROM economic_transactions t WHERE t.hold_id=? AND NOT EXISTS(
   SELECT 1 FROM economic_hold_releases h JOIN economic_entries e ON e.transaction_id=t.id AND e.account_id='reserve'
   WHERE h.transaction_id=t.id AND h.id='post:'||t.id AND h.hold_id=t.hold_id
   AND h.amount_arc=-e.amount_arc AND h.actor_id=t.actor_id AND h.created_at=t.occurred_at))
  AND NOT EXISTS(SELECT 1 FROM economic_hold_releases h WHERE h.hold_id=? AND NOT EXISTS(
   SELECT 1 FROM economic_transactions t WHERE t.id=h.transaction_id AND t.hold_id=h.hold_id AND t.purpose='REWARD'))`,[holdId,holdId]);
 const stateGuards=(receiptCount:number,remaining:number)=>[
  ...prepared.guards,policy(),hold(),accounts(),releaseGuard(),
  economicAssert(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM economic_transactions WHERE '+scope+')=?',[...scopeArgs,receiptCount]),
  economicAssert(db,'SELECT 1 FROM economic_open_holds WHERE id=? AND remaining_arc=?',[holdId,remaining]),
  economicAssert(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_transactions WHERE reversal_of IN (SELECT id FROM economic_transactions WHERE '+scope+'))',scopeArgs)
 ];
 const inspect=async()=>{
  const reads=await db.batch([...access(),...prepared.guards,policy(),hold(),accounts(),releaseGuard(),economicReconciliationGuard(db),
   db.prepare('SELECT * FROM economic_transactions WHERE '+scope+' ORDER BY business_key').bind(...scopeArgs),
   reversals(),db.prepare('SELECT remaining_arc FROM economic_open_holds WHERE id=?').bind(holdId)]);
  const [tx,rev,h]=reads.slice(-3);
  const receipts=tx.results,remaining=h.results[0]?.remaining_arc;
  if(typeof remaining!=='number'||!Number.isSafeInteger(remaining)||remaining<0||rev.results.length) return blocked('reward_reconciliation_mismatch');
  if(receipts.some(row=>row.day!==28&&row.day!==56||day===28&&row.day!==28))return blocked('reward_reconciliation_mismatch');
  if(day===56){
   if(!previousManifest)return blocked('reward_previous_missing');
   const prior=reconcileRewardPlan(previousManifest.plan,{...binding,manifestHash:previousManifest.manifestHash},{
    receipts:receipts.filter(row=>row.day===28),reversedIds:[],holdRemainingArc:previousManifest.plan.endingHoldArc,ledgerOk:true
   });
   if(prior.status!=='complete')return blocked('reward_previous_incomplete');
  }
  // One guarded snapshot of receipts, releases, sources and aggregate audit.
  const report=reconcileRewardPlan(plan,binding,{
   receipts:receipts.filter(row=>row.day===day),reversedIds:[],holdRemainingArc:remaining,ledgerOk:true
  });
  if(report.status!=='pending'&&report.status!=='complete')return blocked('reward_reconciliation_mismatch');
  const receiptHash=report.status==='complete'?await rewardCompletionDigest({
   generation,season,day,manifestHash:manifest.manifestHash,
   priorManifestHash:previousManifest?.manifestHash??null,holdId,holdRemainingArc:remaining,paidArc:report.paidArc,
   receipts:receipts.map(row=>({id:row.id,business_key:row.business_key,request_hash:row.request_hash}))
  }):null;
  return {report,receiptCount:receipts.length,remaining,receiptHash};
 };
 let state=await inspect();
 const intents=rewardPostingIntents(plan,binding),missing=new Set(state.report.missingKeys);
 const eventId='rewards:'+day;
 const milestone=await db.prepare("SELECT status,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id=? AND kind='settle-rewards' AND scope=? AND scheduled_day=? AND event_order=7000")
  .bind(season,eventId,'rewards-'+day,day).first<{status:string;receipt_hash:string|null}>();
 if(!milestone) return blocked('reward_calendar_missing');
 if(milestone.status==='completed'&&(state.report.status!=='complete'||milestone.receipt_hash!==state.receiptHash))
  return blocked('reward_calendar_mismatch');
 const scheduled=()=>economicAssert(db,"SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind='settle-rewards' AND scope=? AND scheduled_day=? AND event_order=7000 AND status='scheduled' AND receipt_hash IS NULL",
  [season,eventId,'rewards-'+day,day]);
 // A chunk commits atomically; on conflict/unknown response retry from receipts.
 const chunk=intents.filter(i=>missing.has(i.businessKey)).slice(0,REWARD_BATCH_LIMIT);
 if(chunk.length){
  await postFreshEconomicBatch(db,chunk,{
   access:access(),preconditions:[...stateGuards(state.receiptCount,state.remaining),scheduled(),economicReconciliationGuard(db)],
   effects:[releaseGuard(),economicReconciliationGuard(db)]
  },now);
  state=await inspect();
 }
 // Optional explicit finalization for the existing official calendar. A fresh
 // exact guard is mandatory; the journal and event are rechecked in one batch.
 if(completeCalendar&&state.report.status==='complete'&&milestone.status==='scheduled'){
  const world=await readWorld(db);
  if(world.revision!==prepared.worldRevision||world.revision===Number.MAX_SAFE_INTEGER)return blocked('reward_world_stale');
  const operationId=crypto.randomUUID(),key='reward-calendar:'+season+':'+day;
  const result={operationId,world:{...world,revision:world.revision+1},receiptHash:state.receiptHash};
  const requestHash=await canonicalHash({generation,season,day,manifestHash:manifest.manifestHash,receiptHash:state.receiptHash});
  await db.batch([...access(),sessionGuard(db,session,now),...stateGuards(state.receiptCount,state.remaining),scheduled(),economicReconciliationGuard(db),
   db.prepare("UPDATE season_admin_events SET status='completed',completed_at=?,receipt_hash=? WHERE season_number=? AND event_id=? AND status='scheduled'")
    .bind(now,state.receiptHash,season,eventId),
   db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(generation,world.revision),
   db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(operationId,generation,key,requestHash,session.actor.id,'complete-reward-calendar-v1',world.revision,world.revision+1,JSON.stringify(result),now)
  ]);
 }
 return Object.freeze({manifestHash:manifest.manifestHash,day,...state.report,holdRemainingArc:state.remaining,
  receiptHash:state.receiptHash});
}
