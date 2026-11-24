/** #788/#792 inspection primitives. No reset, financial writes or schema changes. */
import {ApiError} from './errors.ts';
import type {Database,Statement} from './database.ts';
import {parseWorldV1} from './types.ts';
import clubs from '../../data/clubs.json' with {type:'json'};
import {reconcileEconomy} from './economic-ledger.ts';

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
/** Balances are derived from canonical views; no user IDs or private policy JSON leave this adapter. */
export async function readAdminEconomySummary(db:Database,access:readonly Statement[]){
 assertAccess(access);
 const result=await db.batch([...access,db.prepare(worldSql),
  db.prepare('SELECT active_version,posting_enabled FROM economic_control WHERE id=1'),
  db.prepare('SELECT kind,COUNT(*) AS n,SUM(balance_arc) AS balance,SUM(reserved_arc) AS held,SUM(available_arc) AS available FROM economic_available_balances GROUP BY kind'),
  db.prepare('SELECT COUNT(*) AS n FROM economic_transactions')]);
 const [w,c,b,t]=result.slice(access.length);
 const control=c.results[0];
 const accounts=['PLATFORM_RESERVE','CLUB_TREASURY','USER_WALLET','ISSUANCE_CONTROL'].map(kind=>{
  const row=b.results.find(r=>r.kind===kind);
  return {kind,count:row?integer(row.n):0,balanceArc:row?amount(row.balance):null,heldArc:row?amount(row.held):null,availableArc:row?amount(row.available):null};
 });
 return {world:parseWorldV1(w.results[0]),status:!control?'uninitialized':control.posting_enabled===1?'active':'frozen',
  policyVersion:control?.active_version??null,accounts,transactionCount:integer(t.results[0]?.n),
  rewards:{status:'not_implemented'},payroll:{status:'not_implemented'}};
}
export async function readAdminEconomyReconciliation(db:Database,access:readonly Statement[]){
 assertAccess(access);
 // Read-only existing core audit. A clean empty ledger is not a funded world.
 const report=await reconcileEconomy(db,access);
 const [control]=await db.batch([...access,db.prepare('SELECT active_version FROM economic_control WHERE id=1')]).then(r=>r.slice(access.length));
 return {status:control.results.length?'core_checked':'uninitialized',report,domainStatus:'not_implemented'};
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
