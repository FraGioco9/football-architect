/** #778: internal per-club payday settlement. No HTTP route, scheduler or funding.
 * Read signed history, pin allocations, then post only missing amounts via #775/#796. */
import clubs from '../../data/clubs.json' with {type:'json'};
import type {Database} from './database.ts';
import type {AdminSession} from './auth.ts';
import {ApiError} from './errors.ts';
import {readWorld} from './world-repository.ts';
import {canonicalHash} from './catalogue-snapshot.ts';
import {prepareRewardPayrollGuards} from './reward-calendar-gate.ts';
import {clubTreasuryId,userWalletId,economicAssert,financeSessionGuard,economicReconciliationGuard,
 postFreshEconomicBatch,ECONOMIC_FRESH_BATCH_LIMIT,type LedgerIntent} from './economic-ledger.ts';
import {planContractClaims,allocateClubPayroll,type PayrollClaim,type PayrollContract,type PayrollMandate} from './payroll-plan.mjs';

const actorId='payroll-settlement-v1';
const fail=(code:string):never=>{throw new ApiError(409,code)};
type Run={id:string;generation:string;season:number;day:28|56;club_key:string;world_revision:number;policy_version:string;source_hash:string};
type ContractRow=[number,number,string,string,number,number,number];
type MandateRow=[number,number,string,string,number,number|null];
type AllocationRow=[string,string,number];
type ReceiptRow={id:string;claim_id:string;planned_arc:number;paid_arc:number;reversed:number;recipient_id:string;mandate_id:number|null;outstanding_arc:number};
const asJson=<T>(x:unknown):T=>{if(typeof x!=='string')return fail('payroll_snapshot_invalid');return JSON.parse(x) as T};

/** Each call is bounded to one club and at most one sealed journal batch.
 * Retrying after an uncertain response reads the same immutable run and ledger receipts.
 * This is a trusted Admin service, not a request-supplied contract/amount interface. */
export async function settleClubPayrollBatch(db:Database,session:AdminSession,clubKey:string,now:number){
 if(!session?.unified)throw new ApiError(403,'economic_authority_required');
 const operator=session.unified,treasury=clubTreasuryId(clubKey),world=await readWorld(db);
 if(world.phase!=='active'||(world.day!==28&&world.day!==56)||world.seasonNumber<1)return fail('payroll_payday_required');
 const {generation,seasonNumber:season,day}=world;
 const access=()=>['read','post'].map(cap=>financeSessionGuard(db,operator.playerId,operator.sessionDigest,operator.csrfDigest,cap as 'read'|'post',now));
 const rewardGuards=await prepareRewardPayrollGuards(db,world,day,true);
 const runId=['payroll',generation,season,day,clubKey].join(':');
 const lo=(season-1)*56+day-28,hi=lo+28;
 const contractsSql=`SELECT COALESCE(json_group_array(json_array(id,player_id,world_generation,club_key,start_tick,end_tick,annual_salary_arc)),'[]') AS snapshot
 FROM (SELECT id,player_id,world_generation,club_key,start_tick,COALESCE(closed_tick,scheduled_end_tick) AS end_tick,annual_salary_arc
 FROM player_signed_contracts WHERE world_generation=? AND club_key=? AND start_tick<? AND COALESCE(closed_tick,scheduled_end_tick)>? ORDER BY id)`;
 const mandatesSql=`SELECT COALESCE(json_group_array(json_array(id,player_id,world_generation,account_id,start_tick,end_tick)),'[]') AS snapshot
 FROM (SELECT m.id,m.player_id,m.world_generation,m.account_id,m.start_tick,m.end_tick FROM player_agent_mandates m
 WHERE m.world_generation=? AND m.start_tick<? AND COALESCE(m.end_tick,?)>?
 AND EXISTS(SELECT 1 FROM player_signed_contracts c WHERE c.world_generation=m.world_generation AND c.player_id=m.player_id AND c.club_key=? AND c.start_tick<? AND COALESCE(c.closed_tick,c.scheduled_end_tick)>?) ORDER BY m.id)`;
 const ca=[generation,clubKey,hi,lo],ma=[generation,hi,hi,lo,clubKey,hi,lo];
 const allocationSql="SELECT COALESCE(json_group_array(json_array(id,claim_id,planned_arc)),'[]') AS snapshot FROM (SELECT id,claim_id,planned_arc FROM payroll_allocations WHERE run_id=? ORDER BY id)";
 const priorGuard=()=>economicAssert(db,`SELECT 1 WHERE NOT EXISTS(
 SELECT 1 FROM season_admin_events e JOIN seasons s ON s.season_number=e.season_number
 WHERE s.generation=? AND e.kind='settle-rewards' AND (e.season_number*56+e.scheduled_day)<?
 AND NOT EXISTS(SELECT 1 FROM payroll_runs r JOIN payroll_run_milestones m ON m.run_id=r.id AND m.kind='completed'
 WHERE r.generation=? AND r.club_key=? AND r.season=e.season_number AND r.day=e.scheduled_day))`,
 [generation,season*56+day,generation,clubKey]);
 const guards=()=>[...access(),...rewardGuards,priorGuard(),economicReconciliationGuard(db)];
 const snap=await db.batch([...guards(),db.prepare(contractsSql).bind(...ca),db.prepare(mandatesSql).bind(...ma),
  db.prepare('SELECT * FROM payroll_runs WHERE id=?').bind(runId),
  db.prepare('SELECT active_version FROM economic_control WHERE id=1 AND posting_enabled=1'),
  db.prepare("SELECT available_arc,reserved_arc FROM economic_available_balances WHERE id=? AND kind='CLUB_TREASURY'").bind(treasury),
  db.prepare(`SELECT c.*,r.generation,r.club_key,r.season,r.day,p.player_id FROM payroll_claim_outstanding c
   JOIN payroll_runs r ON r.id=c.run_id JOIN player_signed_contracts p ON p.id=c.contract_id
   WHERE r.generation=? AND r.club_key=? AND c.outstanding_arc<>0 ORDER BY r.season,r.day,c.id`).bind(generation,clubKey)]);
 const [cs,ms,rs,ps,bs,os]=snap.slice(-6);
 const contractSnapshot=cs.results[0]?.snapshot,mandateSnapshot=ms.results[0]?.snapshot;
 const contracts=asJson<ContractRow[]>(contractSnapshot),mandates=asJson<MandateRow[]>(mandateSnapshot);
 const sourceHash=await canonicalHash({contracts,mandates});
 const policy=ps.results[0]?.active_version;
 if(typeof policy!=='string')return fail('payroll_policy_unavailable');
 const balance=bs.results[0],cash=balance?.available_arc;
 if(typeof cash!=='number'||!Number.isSafeInteger(cash)||cash<0)return fail('payroll_treasury_unavailable');
 // Signing hold attribution is #775/#801 territory; never mistake earmarked wages for lost liquidity.
 if(balance.reserved_arc!==0)return fail('payroll_commitment_hold_unavailable');
 const sourceGuards=()=>[
  economicAssert(db,'SELECT 1 WHERE ('+contractsSql.replace(' AS snapshot','')+')=?',[...ca,contractSnapshot]),
  economicAssert(db,'SELECT 1 WHERE ('+mandatesSql.replace(' AS snapshot','')+')=?',[...ma,mandateSnapshot]),
  economicAssert(db,'SELECT 1 FROM economic_control WHERE id=1 AND posting_enabled=1 AND active_version=?',[policy])
 ];
 let run=rs.results[0] as unknown as Run|undefined;
 if(!run){
  const currentClaims:PayrollClaim[]=[];
  for(const [id,playerId,gen,club,startTick,endTick,wage] of contracts){
   const contract:PayrollContract={id,playerId,generation:gen,clubKey:club,startTick,endTick};
   const history:PayrollMandate[]=mandates.filter(m=>m[1]===playerId).map(([id,playerId,generation,accountId,startTick,endTick])=>({id,playerId,generation,accountId,startTick,endTick}));
   currentClaims.push(...planContractClaims(contract,history,season,day,wage));
  }
  const oldClaims=os.results.map(row=>{
   if(typeof row.outstanding_arc!=='number'||row.outstanding_arc<=0||row.outstanding_arc>Number(row.due_arc))return fail('payroll_arrears_invalid');
   return {id:row.id,generation:row.generation,clubKey:row.club_key,contractId:row.contract_id,playerId:row.player_id,season:row.season,day:row.day,
    fromTick:row.from_tick,toTick:row.to_tick,annualSalaryArc:row.annual_salary_arc,mandateId:row.mandate_id,
    accountId:row.mandate_id===null?null:String(row.recipient_id).slice(5),dueArc:row.due_arc,previousPaidArc:Number(row.due_arc)-row.outstanding_arc} as PayrollClaim;
  });
  // Cap payload before preparing SQL; large pathological histories fail closed, not partially published.
  const all=[...oldClaims,...currentClaims];
  if(all.length>1000)return fail('payroll_club_manifest_too_large');
  const plan=allocateClubPayroll(clubKey,all,cash,season,day,generation);
  const allocations:AllocationRow[]=await Promise.all(plan.allocations.map(async a=>['payroll-allocation:'+await canonicalHash([runId,a.id]),a.id,a.paidArc] as AllocationRow));
  allocations.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
  const planHash=await canonicalHash({sourceHash,allocations});
  const claimRows=currentClaims.map(c=>[c.id,runId,c.contractId,c.mandateId,c.accountId===null?'reserve':userWalletId(c.accountId),c.fromTick,c.toTick,c.annualSalaryArc,c.dueArc]);
  const claimJson=JSON.stringify(claimRows),allocJson=JSON.stringify(allocations);
  if(claimJson.length+allocJson.length>500000)return fail('payroll_club_manifest_too_large');
  // Seal verifies every signed-contract entitlement and every older outstanding claim.
  // CAS the old outstanding amounts as well as the treasury and source snapshot.
  const oldJson=JSON.stringify(oldClaims.map(c=>[c.id,c.dueArc-c.previousPaidArc]));
  await db.batch([...guards(),...sourceGuards(),
   economicAssert(db,'SELECT 1 FROM economic_available_balances WHERE id=? AND available_arc=? AND reserved_arc=0',[treasury,cash]),
   economicAssert(db,`SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM json_each(?) j WHERE NOT EXISTS(
    SELECT 1 FROM payroll_claim_outstanding c WHERE c.id=json_extract(j.value,'$[0]') AND c.outstanding_arc=json_extract(j.value,'$[1]')))`,[oldJson]),
   db.prepare('INSERT INTO payroll_runs VALUES(?,?,?,?,?,?,?,?)').bind(runId,generation,season,day,clubKey,world.revision,policy,sourceHash),
   db.prepare(`INSERT INTO payroll_claims SELECT json_extract(value,'$[0]'),json_extract(value,'$[1]'),json_extract(value,'$[2]'),json_extract(value,'$[3]'),json_extract(value,'$[4]'),json_extract(value,'$[5]'),json_extract(value,'$[6]'),json_extract(value,'$[7]'),json_extract(value,'$[8]') FROM json_each(?)`).bind(claimJson),
   db.prepare(`INSERT INTO payroll_allocations SELECT json_extract(value,'$[0]'),?,json_extract(value,'$[1]'),json_extract(value,'$[2]') FROM json_each(?)`).bind(runId,allocJson),
   db.prepare("INSERT INTO payroll_run_milestones VALUES(?,'sealed',?)").bind(runId,planHash)]);
  run={id:runId,generation,season,day,club_key:clubKey,world_revision:world.revision,policy_version:policy,source_hash:sourceHash};
 }
 if(run.generation!==generation||run.season!==season||run.day!==day||run.club_key!==clubKey||run.world_revision!==world.revision||run.policy_version!==policy||run.source_hash!==sourceHash)return fail('payroll_run_stale');
 const inspect=async()=>{
  const result=await db.batch([...guards(),...sourceGuards(),
   db.prepare(allocationSql).bind(runId),
   db.prepare('SELECT kind,digest FROM payroll_run_milestones WHERE run_id=? ORDER BY kind').bind(runId),
   db.prepare(`SELECT p.id,p.claim_id,p.planned_arc,p.paid_arc,p.reversed,c.recipient_id,c.mandate_id,c.outstanding_arc
    FROM payroll_allocation_paid p JOIN payroll_claim_outstanding c ON c.id=p.claim_id WHERE p.run_id=? ORDER BY p.id`).bind(runId),
   db.prepare(`SELECT t.id,t.business_key,t.request_hash,p.allocation_id FROM payroll_payment_receipts p
    JOIN economic_transactions t ON t.id=p.transaction_id JOIN payroll_allocations a ON a.id=p.allocation_id WHERE a.run_id=? ORDER BY t.business_key`).bind(runId)]);
  const [a,m,p,t]=result.slice(-4),allocationSnapshot=a.results[0]?.snapshot;
  const allocations=asJson<AllocationRow[]>(allocationSnapshot);
  const seal=m.results.find(x=>x.kind==='sealed')?.digest,completed=m.results.find(x=>x.kind==='completed')?.digest;
  if(seal!==await canonicalHash({sourceHash,allocations}))return fail('payroll_plan_mismatch');
  const rows=p.results as unknown as ReceiptRow[];
  if(rows.length!==allocations.length||rows.some(x=>x.reversed!==0||!Number.isSafeInteger(x.paid_arc)||x.paid_arc<0||x.paid_arc>x.planned_arc||x.outstanding_arc<0))return fail('payroll_receipt_mismatch');
  const sum=(field:'planned_arc'|'paid_arc'|'outstanding_arc')=>rows.reduce((n,x)=>n+x[field],0);
  const plannedArc=sum('planned_arc'),paidArc=sum('paid_arc'),outstandingArc=sum('outstanding_arc');
  const arrearsArc=outstandingArc-(plannedArc-paidArc),dueArc=paidArc+outstandingArc;
  if(arrearsArc<0||![plannedArc,paidArc,outstandingArc,arrearsArc,dueArc].every(Number.isSafeInteger))return fail('payroll_total_invalid');
  const receiptHash=await canonicalHash({runId,seal,plannedArc,paidArc,arrearsArc,receipts:t.results});
  if(completed!==undefined&&(completed!==receiptHash||plannedArc!==paidArc))return fail('payroll_completion_mismatch');
  return {allocationSnapshot,seal,completed,rows,receiptHash,plannedArc,paidArc,arrearsArc,dueArc,outstandingArc};
 };
 let state=await inspect();
 const stateGuards=()=>[
  ...rewardGuards,...sourceGuards(),priorGuard(),economicReconciliationGuard(db),
  economicAssert(db,"SELECT 1 FROM payroll_run_milestones WHERE run_id=? AND kind='sealed' AND digest=?",[runId,state.seal]),
  economicAssert(db,"SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM payroll_run_milestones WHERE run_id=? AND kind='completed')",[runId]),
  economicAssert(db,'SELECT 1 WHERE ('+allocationSql.replace(' AS snapshot','')+')=?',[runId,state.allocationSnapshot])
 ];
 const missing=state.rows.filter(x=>x.paid_arc<x.planned_arc).slice(0,ECONOMIC_FRESH_BATCH_LIMIT);
 if(missing.length){
  // Current schema supports partial receipts; this runner posts each remaining allocation once.
  const intents:LedgerIntent[]=missing.map(row=>{
   const amount=row.planned_arc-row.paid_arc,key=row.id+':'+row.paid_arc;
   return {businessKey:key,requestKey:key,purpose:row.mandate_id===null?'PAYROLL_AI':'PAYROLL_HUMAN',actorKind:'system',actorId,configVersion:policy,
    sourceId:row.id,generation,season,day,lines:[{accountId:treasury,amountArc:-amount},{accountId:row.recipient_id,amountArc:amount}]};
  });
  await postFreshEconomicBatch(db,intents,{access:access(),
   preconditions:[...stateGuards(),...missing.map(row=>economicAssert(db,'SELECT 1 FROM payroll_allocation_paid WHERE id=? AND paid_arc=? AND reversed=0',[row.id,row.paid_arc]))],
   effects:[...intents.map(i=>db.prepare('INSERT INTO payroll_payment_receipts SELECT id,? FROM economic_transactions WHERE business_key=?').bind(i.sourceId,i.businessKey)),economicReconciliationGuard(db)]},now);
  state=await inspect();
 }
 if(state.plannedArc===state.paidArc&&state.completed===undefined){
  // Receipt and aggregate digest are derived from the journal. Completion guard
  // refuses orphan entries, missing allocations, stale world and reversals.
  await db.batch([...access(),...stateGuards(),
   economicAssert(db,"SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM payroll_allocation_paid WHERE run_id=? AND (paid_arc<>planned_arc OR reversed<>0))",[runId]),
   db.prepare("INSERT INTO payroll_run_milestones VALUES(?,'completed',?)").bind(runId,state.receiptHash)]);
  state=await inspect();
 }
 return {runId,clubKey,season,day,plannedArc:state.plannedArc,paidArc:state.paidArc,arrearsArc:state.arrearsArc,
  dueArc:state.dueArc,outstandingArc:state.outstandingArc,status:state.completed===undefined?'pending':'complete',receiptHash:state.completed??null};
}

/** World-level read-only reconciliation. A per-club receipt is not a full payday.
 * No new calendar event or global settlement table. Missing runs remain pending. */
export async function reconcilePayrollPayday(db:Database,session:AdminSession,now:number){
 if(!session?.unified)throw new ApiError(403,'economic_authority_required');
 const operator=session.unified,world=await readWorld(db);
 if(world.phase!=='active'||(world.day!==28&&world.day!==56))return fail('payroll_payday_required');
 const {generation,seasonNumber:season,day}=world;
 const canonicalClubs=clubs.map(c=>c.countryId+'-'+c.clubId).sort();
 if(new Set(canonicalClubs).size!==320||canonicalClubs.length!==320)return fail('payroll_club_catalogue_invalid');
 const scope=[generation,season,day];
 const results=await db.batch([
  financeSessionGuard(db,operator.playerId,operator.sessionDigest,operator.csrfDigest,'read',now),
  ...await prepareRewardPayrollGuards(db,world,day,true),
  economicReconciliationGuard(db),
  db.prepare('SELECT active_version FROM economic_control WHERE id=1 AND posting_enabled=1'),
  db.prepare(`SELECT r.id,r.club_key,r.world_revision,r.policy_version,r.source_hash,
   (SELECT digest FROM payroll_run_milestones m WHERE m.run_id=r.id AND m.kind='sealed') AS seal,
   (SELECT digest FROM payroll_run_milestones m WHERE m.run_id=r.id AND m.kind='completed') AS completed
   FROM payroll_runs r WHERE r.generation=? AND r.season=? AND r.day=? ORDER BY r.club_key`).bind(...scope),
  db.prepare(`SELECT p.run_id,p.id,p.claim_id,p.planned_arc,p.paid_arc,p.reversed,c.outstanding_arc
   FROM payroll_allocation_paid p JOIN payroll_claim_outstanding c ON c.id=p.claim_id JOIN payroll_runs r ON r.id=p.run_id
   WHERE r.generation=? AND r.season=? AND r.day=? ORDER BY p.id`).bind(...scope),
  db.prepare(`SELECT a.run_id,t.id,t.business_key,t.request_hash,p.allocation_id FROM payroll_payment_receipts p
   JOIN economic_transactions t ON t.id=p.transaction_id JOIN payroll_allocations a ON a.id=p.allocation_id
   JOIN payroll_runs r ON r.id=a.run_id WHERE r.generation=? AND r.season=? AND r.day=? ORDER BY t.business_key`).bind(...scope),
  db.prepare(`SELECT COUNT(*) AS n FROM economic_transactions t WHERE t.generation=? AND t.season=? AND t.day=?
   AND t.purpose IN ('PAYROLL_HUMAN','PAYROLL_AI') AND NOT EXISTS(SELECT 1 FROM payroll_payment_receipts p WHERE p.transaction_id=t.id)`).bind(...scope),
  db.prepare(`SELECT COUNT(*) AS n FROM payroll_allocation_paid p JOIN payroll_runs r ON r.id=p.run_id
   WHERE r.generation=? AND p.reversed<>0`).bind(generation)
 ]);
 const [policyResult,runsResult,allocResult,txResult,orphans,reversals]=results.slice(-6),policy=policyResult.results[0]?.active_version;
 if(typeof policy!=='string'||orphans.results[0]?.n!==0||reversals.results[0]?.n!==0)return fail('payroll_reconciliation_mismatch');
 const runs=runsResult.results,seen=new Set<string>(),completedClubs:string[]=[],receiptHashes:string[]=[];
 let recordedDueArc=0,paidArc=0,arrearsArc=0,pendingArc=0;
 for(const run of runs){
  const id=String(run.id),club=String(run.club_key);
  if(!canonicalClubs.includes(club)||seen.has(club)||run.world_revision!==world.revision||run.policy_version!==policy||typeof run.seal!=='string')return fail('payroll_run_stale');
  seen.add(club);
  const rows=allocResult.results.filter(x=>x.run_id===id) as unknown as ReceiptRow[];
  const allocations=rows.map(x=>[x.id,x.claim_id,x.planned_arc]);
  if(run.seal!==await canonicalHash({sourceHash:run.source_hash,allocations}))return fail('payroll_plan_mismatch');
  if(rows.some(x=>x.reversed!==0||![x.planned_arc,x.paid_arc,x.outstanding_arc].every(Number.isSafeInteger)||x.paid_arc<0||x.paid_arc>x.planned_arc||x.outstanding_arc<0))return fail('payroll_receipt_mismatch');
  const planned=rows.reduce((n,x)=>n+x.planned_arc,0),paid=rows.reduce((n,x)=>n+x.paid_arc,0),
   outstanding=rows.reduce((n,x)=>n+x.outstanding_arc,0),pending=planned-paid,arrears=outstanding-pending;
  if(arrears<0||![planned,paid,outstanding,pending,arrears].every(Number.isSafeInteger))return fail('payroll_total_invalid');
  const receipts=txResult.results.filter(x=>x.run_id===id).map(({run_id,...receipt})=>receipt);
  const hash=await canonicalHash({runId:id,seal:run.seal,plannedArc:planned,paidArc:paid,arrearsArc:arrears,receipts});
  if(run.completed!==null){
   if(run.completed!==hash||pending!==0)return fail('payroll_completion_mismatch');
   completedClubs.push(club);receiptHashes.push(hash);
  }
  recordedDueArc+=paid+outstanding;paidArc+=paid;arrearsArc+=arrears;pendingArc+=pending;
 }
 if(![recordedDueArc,paidArc,arrearsArc,pendingArc].every(Number.isSafeInteger)||recordedDueArc!==paidArc+arrearsArc+pendingArc)return fail('payroll_total_invalid');
 const missingClubs=canonicalClubs.filter(c=>!completedClubs.includes(c)),complete=missingClubs.length===0;
 return {generation,season,day,status:complete?'complete':'pending',clubsComplete:completedClubs.length,missingClubs,
  recordedDueArc,dueArc:complete?recordedDueArc:null,paidArc,arrearsArc,pendingArc,
  receiptHash:complete?await canonicalHash({generation,season,day,receiptHashes}):null};
}
