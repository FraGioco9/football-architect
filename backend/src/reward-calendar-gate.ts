/** #776 calendar enrollment and guarded consumer prerequisite.
 * Existing event rows are the only scheduling/completion authority. */
import type {Database,Statement} from './database.ts';
import type {WorldV1} from './types.ts';
import {ApiError} from './errors.ts';
import {abortUnless} from './atomic-guard.ts';
import {economicReconciliationGuard} from './economic-ledger.ts';
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';
import {canonicalHash} from './catalogue-snapshot.ts';
const budget=rewardCalendarBudget();
export function annualRewardHoldId(generation:string,season:number){
 return ['reward-budget',generation,season,budget.version].join(':');
}
const annualHold="SELECT 1 FROM economic_holds WHERE id=? AND source_id=? AND account_id='reserve' AND purpose='REWARD_BUDGET' AND amount_arc=? AND actor_id='reward-settlement-v1'";
/** Explicit annual earmark enrolls the calendar at preparation; no auto funding. */
export async function rewardCalendarEnrollment(db:Database,world:WorldV1){
 const id=annualRewardHoldId(world.generation,world.seasonNumber);
 const existing=await db.prepare('SELECT id FROM economic_holds WHERE id=?').bind(id).first();
 const guards:Statement[]=[];
 if(existing){
  const valid=await db.prepare(annualHold+" AND config_version IN (SELECT p.version FROM economic_policy_versions p JOIN economic_control c ON c.active_version=p.version WHERE c.id=1 AND c.posting_enabled=1 AND json_extract(p.rules_json,'$.rewardVersion')=?) AND EXISTS(SELECT 1 FROM economic_open_holds WHERE id=? AND remaining_arc=?)").bind(id,id,budget.annual,budget.version,id,budget.annual).first();
  if(!valid)throw new ApiError(409,'reward_budget_invalid');
  guards.push(abortUnless(db,annualHold+" AND config_version IN (SELECT p.version FROM economic_policy_versions p JOIN economic_control c ON c.active_version=p.version WHERE c.id=1 AND c.posting_enabled=1 AND json_extract(p.rules_json,'$.rewardVersion')=?) AND EXISTS(SELECT 1 FROM economic_open_holds WHERE id=? AND remaining_arc=?)",[id,id,budget.annual,budget.version,id,budget.annual]));
 }else guards.push(abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_holds WHERE id=?)',[id]));
 return {enrolled:!!existing,guards};
}
/** Low-level transactional predicates. Consumers MUST use the independently
 * reconstructed completion proof below rather than these predicates alone.
 * No caller-supplied money or calendar clock.
 * For enrolled seasons the immutable completed event plus ledger scope, hold,
 * absence of reversals and global reconciliation must still be valid. */
export function rewardCalendarCompletionGuards(db:Database,world:WorldV1,day:28|56,required=true):Statement[]{
 if(world.day!==day||world.phase!=='active')throw new ApiError(409,'reward_payday_required');
 const holdId=annualRewardHoldId(world.generation,world.seasonNumber);
 const eventId='rewards:'+day;
 const enrolled="EXISTS(SELECT 1 FROM season_admin_events WHERE season_number=? AND kind='settle-rewards') OR EXISTS(SELECT 1 FROM economic_holds WHERE id=?)";
 const complete=`EXISTS(SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND kind='settle-rewards' AND scope=? AND scheduled_day=? AND event_order=7000 AND status='completed' AND completed_at>0 AND receipt_hash IS NOT NULL)
 AND EXISTS(SELECT 1 FROM economic_open_holds WHERE id=? AND account_id='reserve' AND purpose='REWARD_BUDGET' AND amount_arc=? AND remaining_arc=?)
 AND NOT EXISTS(SELECT 1 FROM economic_transactions t JOIN economic_transactions r ON r.reversal_of=t.id WHERE t.hold_id=?)
 AND NOT EXISTS(SELECT 1 FROM economic_hold_releases WHERE hold_id=? AND transaction_id IS NULL)
 AND (SELECT COALESCE(SUM(-e.amount_arc),0) FROM economic_transactions t JOIN economic_entries e ON e.transaction_id=t.id AND e.account_id='reserve' WHERE t.hold_id=? AND t.purpose='REWARD' AND t.generation=? AND t.season=? AND t.day=?)=?`;
 const args=[world.seasonNumber,eventId,'rewards-'+day,day,holdId,budget.annual,day===28?budget.day56:0,holdId,holdId,holdId,world.generation,world.seasonNumber,day,day===28?budget.day28:budget.day56];
 return [abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND season_number=? AND day=? AND revision=? AND phase='active'",[world.generation,world.seasonNumber,day,world.revision]),abortUnless(db,'SELECT 1 WHERE '+(required?'':`NOT (${enrolled}) OR `)+`(${complete})`,required?args:[world.seasonNumber,holdId,...args]),
  economicReconciliationGuard(db,required?undefined:{condition:enrolled,values:[world.seasonNumber,holdId]})];
}
type DigestReceipt={id:unknown;business_key:unknown;request_hash:unknown};
export function rewardCompletionDigest(input:{
 generation:string;season:number;day:28|56;manifestHash:string;priorManifestHash:string|null;
 holdId:string;holdRemainingArc:number;paidArc:number|null;receipts:readonly DigestReceipt[]
}){
 const {receipts,...scope}=input;
 return canonicalHash({schemaVersion:1,...scope,
  receipts:receipts.map(row=>({id:row.id,businessKey:row.business_key,requestHash:row.request_hash}))});
}
type ReceiptRow={id:string;business_key:string;request_hash:string;source_id:string;config_version:string;
 actor_id:string;actor_kind:string;purpose:string;generation:string;season:number;day:number;hold_id:string;request_key:string};
type EventRow={event_id:string;receipt_hash:string;completed_at:number};
type AuditRow={id:string;request_hash:string;outcome_json:string;expected_revision:number;resulting_revision:number};
const invalid=():never=>{throw new ApiError(409,'reward_calendar_pending')};
const hash64=/^[a-f0-9]{64}$/;

/** Read-only integration boundary for payroll #778 and sporting transitions.
 * Reconstruct the stored receipt from the immutable journal and audited
 * calendar completion, not just a boolean or total. Returned guards MUST be
 * included in the same batch as the consumer's monetary/world mutation.
 * No finance permission is granted here: caller adds its own live authority.
 * Existing sporting-only seasons are bypassed ONLY by the transition caller,
 * never by payroll. */
export async function prepareRewardPayrollGuards(db:Database,world:WorldV1,day:28|56,required=true):Promise<Statement[]>{
 const base=rewardCalendarCompletionGuards(db,world,day,required);
 const holdId=annualRewardHoldId(world.generation,world.seasonNumber);
 const receiptsQuery="SELECT id,business_key,request_hash,source_id,config_version,actor_id,actor_kind,purpose,generation,season,day,hold_id,request_key FROM economic_transactions WHERE (purpose='REWARD' AND generation=? AND season=?) OR hold_id=? OR business_key LIKE ? ORDER BY business_key";
 const scopeArgs=[world.generation,world.seasonNumber,holdId,'reward:'+world.generation+':'+world.seasonNumber+':%'];
 try{
  const rows=await db.batch([...base,
   db.prepare('SELECT config_version FROM economic_holds WHERE id=?').bind(holdId),
   db.prepare(receiptsQuery).bind(...scopeArgs),
   db.prepare("SELECT event_id,receipt_hash,completed_at FROM season_admin_events WHERE season_number=? AND kind='settle-rewards' AND status='completed' ORDER BY scheduled_day").bind(world.seasonNumber),
   db.prepare("SELECT id,request_hash,outcome_json,expected_revision,resulting_revision FROM admin_operations WHERE generation=? AND command='complete-reward-calendar-v1' AND idempotency_key IN (?,?) ORDER BY idempotency_key").bind(world.generation,'reward-calendar:'+world.seasonNumber+':28','reward-calendar:'+world.seasonNumber+':56')
  ]);
  const [h,tx,ev,au]=rows.slice(-4),hold=h.results[0];
  if(!hold){
   if(required||tx.results.length||ev.results.length||au.results.length)return invalid();
   return [...base,abortUnless(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_holds WHERE id=?) AND NOT EXISTS(SELECT 1 FROM economic_transactions WHERE (purpose=\'REWARD\' AND generation=? AND season=?) OR hold_id=? OR business_key LIKE ?)',[holdId,...scopeArgs])];
  }
  const receipts=tx.results as ReceiptRow[],events=ev.results as EventRow[],audits=au.results as AuditRow[];
  const days=day===28?[28] as const:[28,56] as const;
  if(events.length!==days.length||audits.length!==days.length||!receipts.length)return invalid();
  if(receipts.some(r=>r.purpose!=='REWARD'||r.generation!==world.generation||r.season!==world.seasonNumber||
    r.actor_kind!=='system'||r.actor_id!=='reward-settlement-v1'||r.config_version!==hold.config_version||
    r.hold_id!==holdId||r.request_key!==r.business_key||!hash64.test(r.request_hash)||
    !days.some(d=>d===r.day)))return invalid();
  const extra:Statement[]=[];
  let priorManifestHash:string|null=null;
  for(let i=0;i<days.length;i++){
   const payday=days[i],event=events[i],audit=audits[i];
   const own=receipts.filter(r=>r.day===payday);
   const manifestHash=own[0]?.source_id.slice('reward-manifest:'.length);
   if(!manifestHash||!hash64.test(manifestHash)||own.some(r=>r.source_id!=='reward-manifest:'+manifestHash))return invalid();
   const receiptHash=await rewardCompletionDigest({
    generation:world.generation,season:world.seasonNumber,day:payday,manifestHash,priorManifestHash,
    holdId,holdRemainingArc:payday===28?budget.day56:0,paidArc:payday===28?budget.day28:budget.day56,
    receipts:receipts.filter(r=>r.day<=payday)
   });
   if(event.event_id!=='rewards:'+payday||event.receipt_hash!==receiptHash)return invalid();
   const requestHash=await canonicalHash({generation:world.generation,season:world.seasonNumber,day:payday,manifestHash,receiptHash});
   const outcome=JSON.parse(audit.outcome_json);
   if(audit.request_hash!==requestHash||audit.resulting_revision!==audit.expected_revision+1||
     audit.resulting_revision>world.revision||outcome.operationId!==audit.id||outcome.receiptHash!==receiptHash||
     outcome.world?.generation!==world.generation||outcome.world?.seasonNumber!==world.seasonNumber||
     outcome.world?.day!==payday||outcome.world?.phase!=='active'||outcome.world?.revision!==audit.resulting_revision)return invalid();
   extra.push(abortUnless(db,"SELECT 1 FROM season_admin_events WHERE season_number=? AND event_id=? AND status='completed' AND receipt_hash=? AND completed_at=?",[world.seasonNumber,event.event_id,receiptHash,event.completed_at]),
    abortUnless(db,"SELECT 1 FROM admin_operations WHERE id=? AND generation=? AND command='complete-reward-calendar-v1' AND request_hash=? AND outcome_json=? AND expected_revision=? AND resulting_revision=?",[audit.id,world.generation,requestHash,audit.outcome_json,audit.expected_revision,audit.resulting_revision]));
   priorManifestHash=manifestHash;
  }
  // The journal is append-only; exact scope cardinality and each immutable
  // identity/hash ensure this proof cannot be swapped between read and write.
  extra.push(abortUnless(db,"SELECT 1 WHERE (SELECT COUNT(*) FROM economic_transactions WHERE (purpose='REWARD' AND generation=? AND season=?) OR hold_id=? OR business_key LIKE ?)=?",[...scopeArgs,receipts.length]),
   abortUnless(db,`SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
    SELECT 1 FROM economic_transactions t WHERE t.id=json_extract(j.value,'$.id') AND t.business_key=json_extract(j.value,'$.key') AND t.request_hash=json_extract(j.value,'$.hash')))`,
    [JSON.stringify(receipts.map(r=>({id:r.id,key:r.business_key,hash:r.request_hash}))) ]));
  return [...base,...extra];
 }catch(error){if(error instanceof ApiError)throw error;return invalid()}
}
export async function assertRewardCalendarCompletion(db:Database,world:WorldV1,day:28|56){
 return prepareRewardPayrollGuards(db,world,day,false);
}
