/** #788/#792 inspection primitives. No reset, financial writes or schema changes. */
import {ApiError} from './errors.ts';
import type {Database,Statement} from './database.ts';
import {parseWorldV1} from './types.ts';
import clubs from '../../data/clubs.json' with {type:'json'};
import {reconcileEconomy} from './economic-ledger.ts';
import {rewardCalendarBudget} from './reward-settlement-plan.mjs';
import {prepareRewardPayrollGuards} from './reward-calendar-gate.ts';
import {readPayrollPaydayEvidence} from './payroll-settlement-command.ts';

export const resetScopes=['sporting','players','contracts','economy'] as const;
export type ResetScope=typeof resetScopes[number];
const sportingTables=['seasons','season_calendars','season_draws','season_day_outcomes','season_knockout_ties','season_admin_events','season_domestic_stages','season_archives','season_archive_summaries','season_match_slots','season_knockout_match_slots','season_lineup_day_outcomes','season_zero_approvals','season_two_approvals','match_lineup_result_receipts','public_match_numbers'] as const;
const playerTables=['generated_players','player_portrait_profiles','player_market_values','player_generation_drafts'] as const;
const economyTables=['economic_accounts','economic_control','economic_transactions','economic_entries','economic_holds','economic_hold_releases'] as const;
const contractTables=['player_signed_contracts','player_agent_mandates'] as const;
export function parseResetScopes(value:unknown):ResetScope[]{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).join(',')!=='scopes')throw new ApiError(422,'invalid_reset_scope');
 const scopes=(value as {scopes:unknown}).scopes;
 if(!Array.isArray(scopes)||!scopes.length||scopes.length>resetScopes.length||new Set(scopes).size!==scopes.length||scopes.some(s=>!resetScopes.includes(s)))throw new ApiError(422,'invalid_reset_scope');
 return resetScopes.filter(s=>scopes.includes(s));
}
const worldSql='SELECT schema_version AS schemaVersion,generation,revision,season_number AS seasonNumber,day,phase FROM world_state WHERE id=1';
const count=(table:string)=>'SELECT COUNT(*) AS n FROM '+table;
const integer=(value:unknown)=>{
 if(typeof value!=='number'||!Number.isSafeInteger(value))throw new ApiError(503,'admin_inspection_unavailable');
 return value;
};
function assertAccess(access:readonly Statement[]){
 if(!access.length)throw new ApiError(403,'permission_denied');
}
/** Preview-only. Optional 0040 tables are inspected, not assumed deployed. */
export async function previewAdminReset(db:Database,access:readonly Statement[],scopes:readonly ResetScope[]){
 assertAccess(access);
 const schema=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('player_signed_contracts','player_agent_mandates')").all<{name:string}>();
 const present=contractTables.filter(t=>schema.results.some(r=>r.name===t));
 const tables=[...sportingTables,...playerTables,...economyTables,...present];
 const results=await db.batch([...access,db.prepare(worldSql),...tables.map(t=>db.prepare(count(t))),db.prepare("SELECT COUNT(*) AS n FROM player_generation_drafts WHERE status='preview'"),db.prepare("SELECT COUNT(*) AS n FROM world_reset_permits")]);
 const rows=results.slice(access.length);
 const world=parseWorldV1(rows[0].results[0]);
 const counts:Record<string,number|null>=Object.fromEntries(tables.map((t,i)=>[t,integer(rows[i+1].results[0]?.n)]));
 for(const t of contractTables)if(!present.includes(t))counts[t]=null;
 const blockers:string[]=['preview_only'];
 if(scopes.includes('sporting')){
  if(counts.economic_control||counts.economic_transactions)blockers.push('economic_generation_guard');
  if(await db.prepare("SELECT 1 FROM sqlite_schema WHERE type='view' AND name='opening_world_staging'").first()&&await db.prepare('SELECT 1 FROM opening_world_staging LIMIT 1').first())blockers.push('opening_world_staged');
  if(present.length!==0&&present.length!==2)blockers.push('contract_schema_incomplete');
  if(counts.player_signed_contracts||counts.player_agent_mandates)blockers.push('contract_generation_guard');
  if(counts.season_archives||counts.season_archive_summaries)blockers.push('sporting_history_protected');
  if(world.seasonNumber===0&&!counts.season_zero_approvals)blockers.push('reset_prerequisites');
  if(integer(rows[rows.length-1].results[0]?.n)>0)blockers.push('reset_in_progress');
 }
 if(scopes.includes('players'))blockers.push('population_rebuild_not_implemented');
 if(scopes.includes('contracts'))blockers.push('contract_history_protected');
 if(scopes.includes('economy'))blockers.push('economic_history_protected');
 return {world,scopes,counts,abandonedPreviewDrafts:scopes.includes('sporting')?integer(rows[rows.length-2].results[0]?.n):0,
  contractSchema:present.length===2?'present':present.length===0?'not_implemented':'incomplete',
  blockers,executable:false as const,protected:['accounts','permissions','licenses','audit','ledger','signed_history','source_assets'],confirmation:null};
}
const amount=(v:unknown)=>v===null?null:String(integer(v));
// The first rehearsal covers exactly the four canonical paydays. All amounts
// below are read from the canonical policy, journal and payroll evidence;
// no forecast is posted or treated as a balance.
const rehearsalPaydays=[{season:1,day:28},{season:1,day:56},{season:2,day:28},{season:2,day:56}] as const;
const rewardBudget=rewardCalendarBudget();
async function monitoringSchema(db:Database,access:readonly Statement[]){
 const rows=await db.batch([...access,db.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE type='view' AND name IN ('economic_genesis_status','payroll_allocation_paid','payroll_claim_outstanding')")]);
 return rows.at(-1)!.results[0]?.n===3;
}
const currentGeneration="(SELECT generation FROM world_state WHERE id=1)";
const journalAmounts=`SELECT t.season,t.day,t.purpose,SUM(e.amount_arc) AS amount
 FROM economic_transactions t JOIN economic_entries e ON e.transaction_id=t.id AND e.amount_arc>0
 WHERE t.purpose IN ('GENESIS_RESERVE','CLUB_OPENING','REWARD','PAYROLL_HUMAN','PAYROLL_AI')
 AND (t.purpose IN ('GENESIS_RESERVE','CLUB_OPENING') OR (t.generation=${currentGeneration} AND t.season IN (1,2) AND t.day IN (28,56)))
 AND NOT EXISTS(SELECT 1 FROM economic_transactions v WHERE v.reversal_of=t.id)
 GROUP BY t.season,t.day,t.purpose`;
const rewardEvents=`SELECT e.season_number AS season,e.scheduled_day AS day,e.status
 FROM season_admin_events e JOIN seasons s ON s.season_number=e.season_number
 WHERE s.generation=${currentGeneration} AND e.kind='settle-rewards' AND e.season_number IN (1,2)
 AND e.event_id='rewards:'||e.scheduled_day AND e.scheduled_day IN (28,56)`;
const payrollCoverage=`SELECT r.season,r.day,COUNT(*) AS sealed,
 SUM(CASE WHEN EXISTS(SELECT 1 FROM payroll_run_milestones m WHERE m.run_id=r.id AND m.kind='completed') THEN 1 ELSE 0 END) AS completed
 FROM payroll_runs r JOIN payroll_run_milestones s ON s.run_id=r.id AND s.kind='sealed'
 WHERE r.generation=${currentGeneration} AND r.season IN (1,2) GROUP BY r.season,r.day`;
// Claims are attributed to their original payday; a later allocation pays
// the same claim, not a second wage. Only its latest allocation can be pending.
const payrollClaims=`WITH latest AS (
 SELECT a.claim_id,a.planned_arc-a.paid_arc AS pending,a.reversed,
 ROW_NUMBER() OVER(PARTITION BY a.claim_id ORDER BY r.season DESC,r.day DESC) AS rn
 FROM payroll_allocation_paid a JOIN payroll_runs r ON r.id=a.run_id
 WHERE r.generation=${currentGeneration}
 ) SELECT r.season,r.day,SUM(c.due_arc) AS earned,SUM(c.outstanding_arc) AS outstanding,
 SUM(COALESCE(l.pending,0)) AS pending,
 SUM(CASE WHEN c.outstanding_arc<0 OR l.claim_id IS NULL OR l.reversed<>0 OR l.pending<0 OR l.pending>c.outstanding_arc THEN 1 ELSE 0 END) AS invalid
 FROM payroll_claim_outstanding c JOIN payroll_runs r ON r.id=c.run_id
 LEFT JOIN latest l ON l.claim_id=c.id AND l.rn=1
 WHERE r.generation=${currentGeneration} AND r.season IN (1,2) GROUP BY r.season,r.day`;
const domainReversals=`SELECT t.season,t.day,t.purpose,COUNT(*) AS n FROM economic_transactions v
 JOIN economic_transactions t ON t.id=v.reversal_of WHERE t.generation=${currentGeneration}
 AND t.purpose IN ('REWARD','PAYROLL_AI','PAYROLL_HUMAN') AND t.season IN (1,2)
 GROUP BY t.season,t.day,t.purpose`;
function monitoringStatements(db:Database){
 return [
  db.prepare("SELECT g.generation,g.version,g.funded_clubs,g.completed,g.free_reserve_arc,g.annual_rewards_arc,p.genesis_reserve_arc FROM economic_genesis_status g JOIN economic_policy_versions p ON p.version=g.version"),
  db.prepare(journalAmounts),db.prepare(rewardEvents),db.prepare(payrollCoverage),db.prepare(payrollClaims),db.prepare(domainReversals)
 ];
}
type MonitoringRows=Awaited<ReturnType<Database['batch']>>;
function monitoringData(world:ReturnType<typeof parseWorldV1>,control:Record<string,unknown>|undefined,rows:MonitoringRows){
 const available=rows.length===6,initialized=!!control;
 const [root,journal,events,coverage,claims,reversals]=rows.map(r=>r.results);
 const genesis=root?.[0];
 const currentGenesis=genesis?.generation===world.generation?genesis:undefined;
 const sum=(list:Record<string,unknown>[]|undefined)=>integer((list??[]).reduce((n,r)=>n+integer(r.amount),0));
 const actual=(list:Record<string,unknown>[]|undefined)=>available&&initialized?String(sum(list)):null;
 const reached=(season:number,day:number)=>world.seasonNumber>season||world.seasonNumber===season&&world.day>=day;
 const scoped=(list:Record<string,unknown>[]|undefined,season:number,day:number)=>(list??[]).filter(r=>r.season===season&&r.day===day);
 return {
  genesis:{status:!available?'unavailable':!initialized?'uninitialized':!currentGenesis?'unavailable':currentGenesis.completed===1?'funded':integer(currentGenesis.funded_clubs)>0?'funding':'prepared',
   fundedClubs:currentGenesis?integer(currentGenesis.funded_clubs):null,
   plannedArc:currentGenesis?amount(currentGenesis.genesis_reserve_arc):null,
   issuedArc:currentGenesis?actual(journal?.filter(x=>x.purpose==='GENESIS_RESERVE')):null,
   clubCapitalArc:currentGenesis?actual(journal?.filter(x=>x.purpose==='CLUB_OPENING')):null,
   plannedFreeReserveArc:currentGenesis?amount(currentGenesis.free_reserve_arc):null},
  rewards:{status:!available?'unavailable':!initialized?'uninitialized':'ready',
   version:rewardBudget.version,rows:rehearsalPaydays.map(({season,day})=>{
    const event=scoped(events,season,day)[0];
    const posted=scoped(journal,season,day).filter(r=>r.purpose==='REWARD');
    const forecast=day===28?rewardBudget.day28:rewardBudget.day56;
    const paid=actual(posted);
    const reversed=scoped(reversals,season,day).some(r=>r.purpose==='REWARD');
    const observable=available&&initialized&&(!!event||posted.length>0);
    return {season,day,forecastArc:String(forecast),creditedArc:observable?paid:null,
     status:!available?'unavailable':!initialized?'uninitialized':reversed||event?.status==='completed'&&paid!==String(forecast)||posted.length>0&&!event?'mismatch':event?.status==='completed'?'recorded':event?(reached(season,day)?'settlement_pending':'scheduled'):'not_scheduled'};
   })},
  payroll:{status:!available?'unavailable':!initialized?'uninitialized':'ready',
   rows:rehearsalPaydays.map(({season,day})=>{
    const c=scoped(claims,season,day)[0],v=scoped(coverage,season,day)[0];
    const sealed=v?integer(v.sealed):0,completed=v?integer(v.completed):0;
    const posted=scoped(journal,season,day).filter(r=>r.purpose==='PAYROLL_AI'||r.purpose==='PAYROLL_HUMAN');
    const hasEvidence=available&&initialized&&(sealed>0||posted.length>0);
    const outstanding=c?integer(c.outstanding):0,pending=c?integer(c.pending):0;
    const invalid=!!c&&integer(c.invalid)>0||scoped(reversals,season,day).some(r=>r.purpose!=='REWARD')||completed>sealed||sealed>320||!sealed&&posted.length>0;
    return {season,day,earnedArc:sealed>0?String(c?integer(c.earned):0):null,
     paidArc:hasEvidence?actual(posted):null,outstandingArc:sealed>0?String(outstanding):null,
     pendingArc:sealed>0&&!invalid?String(pending):null,arrearsArc:sealed>0&&!invalid?String(outstanding-pending):null,
     sealedClubs:available&&initialized&&reached(season,day)?sealed:null,completedClubs:available&&initialized&&reached(season,day)?completed:null,
     status:!available?'unavailable':!initialized?'uninitialized':invalid?'mismatch':completed===320?'recorded':reached(season,day)?'settlement_pending':'scheduled'};
   })}
 };
}

/** Balances are derived from canonical views; no user IDs or private policy JSON leave this adapter. */
export async function readAdminEconomySummary(db:Database,access:readonly Statement[]){
 assertAccess(access);
 const monitor=await monitoringSchema(db,access);
 const result=await db.batch([...access,db.prepare(worldSql),
  db.prepare('SELECT active_version,posting_enabled FROM economic_control WHERE id=1'),
  db.prepare('SELECT kind,COUNT(*) AS n,SUM(balance_arc) AS balance,SUM(reserved_arc) AS held,SUM(available_arc) AS available FROM economic_available_balances GROUP BY kind'),
  db.prepare('SELECT COUNT(*) AS n FROM economic_transactions'),...(monitor?monitoringStatements(db):[])]);
 const [w,c,b,t,...domain]=result.slice(access.length);
 const control=c.results[0];
 const accounts=['PLATFORM_RESERVE','CLUB_TREASURY','USER_WALLET','ISSUANCE_CONTROL'].map(kind=>{
  const row=b.results.find(r=>r.kind===kind);
  return {kind,count:row?integer(row.n):0,balanceArc:row?amount(row.balance):null,heldArc:row?amount(row.held):null,availableArc:row?amount(row.available):null};
 });
 const world=parseWorldV1(w.results[0]);
 return {world,status:!control?'uninitialized':control.posting_enabled===1?'active':'frozen',
  policyVersion:control?.active_version??null,accounts,transactionCount:integer(t.results[0]?.n),
  ...monitoringData(world,control,domain)};
}
export async function readAdminEconomyReconciliation(db:Database,access:readonly Statement[]){
 assertAccess(access);
 // Read-only existing core audit. A clean empty ledger is not a funded world.
 const report=await reconcileEconomy(db,access);
 const summary=await readAdminEconomySummary(db,access);
 const {world}=summary;
 const base={status:summary.status==='uninitialized'?'uninitialized':'core_checked',report};
 // Historical rows report recorded completion, not a fresh proof. The existing
 // domain verifiers require the live payday/revision and cannot be replayed
 // against a later world without changing their safety contract.
 const mismatch=[...summary.rewards.rows,...summary.payroll.rows].some(r=>r.status==='mismatch');
 if(mismatch)return {...base,domainStatus:'mismatch'};
 if(summary.genesis.status!=='funded'||summary.status!=='active')return {...base,domainStatus:'unavailable'};
 if(world.phase!=='active'||(world.day!==28&&world.day!==56)||world.seasonNumber<1||world.seasonNumber>2)
  return {...base,domainStatus:'outside_payday'};
 const reward=summary.rewards.rows.find(r=>r.season===world.seasonNumber&&r.day===world.day);
 if(reward?.status!=='recorded')return {...base,domainStatus:'settlement_pending'};
 try{
  const guards=await prepareRewardPayrollGuards(db,world,world.day,true);
  await db.batch([...access,...guards]);
  const payroll=await readPayrollPaydayEvidence(db,world,[...access,...guards]);
  return {...base,domainStatus:payroll.status==='complete'?'domain_verified':'settlement_pending'};
 }catch(error){
  // No automatic freeze or settlement, even on discrepancy. Permission and
  // storage errors remain errors rather than being presented as a clean audit.
  if(error instanceof ApiError&&error.status===409){
   await db.batch([...access,db.prepare(worldSql)]);
   return {...base,domainStatus:'mismatch'};
  }
  throw error;
 }
}

const clubCatalogue=clubs.map(c=>({clubKey:c.countryId+'-'+c.clubId,name:c.primaryName})).sort((a,b)=>a.clubKey.localeCompare(b.clubKey,'en',{numeric:true}));
const snapshotSql="SELECT (SELECT generation FROM world_state WHERE id=1) AS generation,(SELECT revision FROM world_state WHERE id=1) AS revision,(SELECT COUNT(*) FROM economic_accounts) AS accounts,(SELECT COUNT(*) FROM economic_transactions) AS transactions,(SELECT COUNT(*) FROM economic_holds) AS holds,(SELECT COUNT(*) FROM economic_hold_releases) AS releases,(SELECT active_version FROM economic_control WHERE id=1) AS policy,(SELECT posting_enabled FROM economic_control WHERE id=1) AS posting";
const fingerprint=async(row:unknown)=>{
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(row)));
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
};
export function parseEconomyPage(query:URLSearchParams,kind:'clubs'|'ledger'){
 const allowed=kind==='clubs'?['page','checkpoint']:['cursor','checkpoint'];
 query.forEach((_value,k)=>{if(!allowed.includes(k)||query.getAll(k).length!==1)throw new ApiError(422,'invalid_economy_query')});
 const checkpoint=query.get('checkpoint');
 if(checkpoint!==null&&!/^[0-9a-f]{64}$/.test(checkpoint))throw new ApiError(422,'invalid_economy_query');
 const page=query.get('page')??'1',cursor=query.get('cursor');
 if(!/^[1-7]$/.test(page)||cursor!==null&&!/^[1-9][0-9]{0,14}:[0-9a-f-]{36}$/i.test(cursor))throw new ApiError(422,'invalid_economy_query');
 if((page!=='1'||cursor!==null)&&checkpoint===null)throw new ApiError(422,'invalid_economy_query');
 return {page:Number(page),cursor,checkpoint};
}
export async function readAdminEconomyClubs(db:Database,access:readonly Statement[],query:ReturnType<typeof parseEconomyPage>){
 assertAccess(access);
 const list=clubCatalogue.slice((query.page-1)*50,query.page*50);
 const result=await db.batch([...access,db.prepare(snapshotSql),db.prepare("SELECT owner_id,balance_arc,reserved_arc,available_arc FROM economic_available_balances WHERE kind='CLUB_TREASURY' AND owner_id IN ("+list.map(()=>'?').join(',')+")").bind(...list.map(c=>c.clubKey))]);
 const [snapshot,data]=result.slice(access.length),checkpoint=await fingerprint(snapshot.results[0]);
 if(query.checkpoint!==null&&query.checkpoint!==checkpoint)throw new ApiError(409,'stale_economy_snapshot');
 return {checkpoint,page:query.page,pages:Math.ceil(clubCatalogue.length/50),rows:list.map(c=>{
  const a=data.results.find(r=>r.owner_id===c.clubKey);
  return {...c,status:a?'ready':'uninitialized',balanceArc:a?amount(a.balance_arc):null,heldArc:a?amount(a.reserved_arc):null,availableArc:a?amount(a.available_arc):null};
 })};
}
/** Redacted journal page: only account kinds, never wallet owner IDs, request keys or actor IDs. */
export async function readAdminEconomyLedger(db:Database,access:readonly Statement[],query:ReturnType<typeof parseEconomyPage>){
 assertAccess(access);
 const split=query.cursor?.split(':');
 const rows=db.prepare(`WITH page AS (SELECT id,purpose,generation,season,day,occurred_at,reversal_of FROM economic_transactions
 WHERE (? IS NULL OR occurred_at<? OR (occurred_at=? AND id<?)) ORDER BY occurred_at DESC,id DESC LIMIT 51)
 SELECT p.id,p.purpose,p.generation,p.season,p.day,p.occurred_at,p.reversal_of,
 (SELECT group_concat(DISTINCT a.kind) FROM economic_entries e JOIN economic_accounts a ON a.id=e.account_id WHERE e.transaction_id=p.id AND e.amount_arc<0) AS debit,
 (SELECT group_concat(DISTINCT a.kind) FROM economic_entries e JOIN economic_accounts a ON a.id=e.account_id WHERE e.transaction_id=p.id AND e.amount_arc>0) AS credit,
 (SELECT SUM(e.amount_arc) FROM economic_entries e WHERE e.transaction_id=p.id AND e.amount_arc>0) AS amount
 FROM page p ORDER BY p.occurred_at DESC,p.id DESC`).bind(split?Number(split[0]):null,split?Number(split[0]):null,split?Number(split[0]):null,split?.[1]??null);
 const result=await db.batch([...access,db.prepare(snapshotSql),rows]);
 const [snapshot,data]=result.slice(access.length),checkpoint=await fingerprint(snapshot.results[0]);
 if(query.checkpoint!==null&&query.checkpoint!==checkpoint)throw new ApiError(409,'stale_economy_snapshot');
 const page=data.results.slice(0,50),last=page[page.length-1];
 return {checkpoint,nextCursor:data.results.length>50?String(last.occurred_at)+':'+String(last.id):null,rows:page.map(r=>({id:r.id,purpose:r.purpose,season:r.season,day:r.day,occurredAt:r.occurred_at,reversalOf:r.reversal_of,debit:r.debit,credit:r.credit,amountArc:amount(r.amount)}))};
}
