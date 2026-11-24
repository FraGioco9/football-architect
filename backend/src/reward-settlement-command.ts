/** #776 bounded internal settlement executor. No HTTP/calendar caller, automatic
 * funding, policy activation or migrations. All monetary writes reuse #775. */
import type {Database} from './database.ts';
import type {AdminSession} from './auth.ts';
import {ApiError} from './errors.ts';
import {economicAssert,financeSessionGuard,postEconomicOperation,reconcileEconomy} from './economic-ledger.ts';
import {assertPreparedRewardSettlement,type PreparedRewardSettlement} from './reward-settlement-evidence.ts';
import {reconcileRewardPlan,rewardPostingIntents,type RewardBinding} from './reward-settlement-plan.mjs';

const actorId='reward-settlement-v1';
const batchLimit=4;
const blocked=(code:string):never=>{throw new ApiError(409,code)};
export function annualRewardHoldId(generation:string,season:number){
 return ['reward-budget',generation,season,'draft-5'].join(':');
}

/** Prepared proof is an in-process capability from the official verifier.
 * The live finance operator is checked on every read and write; the immutable
 * business actor is independent of who retries. A prior approved annual hold
 * and matching active policy are prerequisites, not created by this command.
 * Report is a guarded point-in-time observation, NOT a calendar completion receipt. */
export async function executeRewardSettlementBatch(db:Database,session:AdminSession,prepared:PreparedRewardSettlement,now:number){
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
 const noManual=()=>economicAssert(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_hold_releases WHERE hold_id=? AND transaction_id IS NULL)',[holdId]);
 const stateGuards=(receiptCount:number,remaining:number)=>[
  ...prepared.guards,policy(),hold(),accounts(),noManual(),
  economicAssert(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM economic_transactions WHERE '+scope+')=?',[...scopeArgs,receiptCount]),
  economicAssert(db,'SELECT 1 FROM economic_open_holds WHERE id=? AND remaining_arc=?',[holdId,remaining]),
  economicAssert(db,'SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM economic_transactions WHERE reversal_of IN (SELECT id FROM economic_transactions WHERE '+scope+'))',scopeArgs)
 ];
 const inspect=async()=>{
  const reads=await db.batch([...access(),...prepared.guards,policy(),hold(),accounts(),noManual(),
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
  // The immutable receipts and hold amount are guarded again in the same
  // snapshot as the existing aggregate ledger audit, and for each fresh write.
  const guards=stateGuards(receipts.length,remaining);
  const ledger=await reconcileEconomy(db,[...access(),...guards]);
  const report=reconcileRewardPlan(plan,binding,{
   receipts:receipts.filter(row=>row.day===day),reversedIds:[],holdRemainingArc:remaining,ledgerOk:ledger.ok
  });
  if(report.status!=='pending'&&report.status!=='complete')return blocked('reward_reconciliation_mismatch');
  return {report,receiptCount:receipts.length,remaining};
 };
 let state=await inspect();
 const intents=rewardPostingIntents(plan,binding),missing=new Set(state.report.missingKeys);
 // No unbounded write loop. Each positive component is sealed atomically;
 // if any write fails, stop and reconstruct from immutable receipts on retry.
 for(const intent of intents.filter(i=>missing.has(i.businessKey)).slice(0,batchLimit)){
  await postEconomicOperation(db,intent,{access:access(),preconditions:stateGuards(state.receiptCount,state.remaining)},now);
  state={...state,receiptCount:state.receiptCount+1,remaining:state.remaining-intent.lines.find(l=>l.amountArc>0)!.amountArc};
 }
 state=await inspect();
 return Object.freeze({manifestHash:manifest.manifestHash,day,...state.report,holdRemainingArc:state.remaining});
}
