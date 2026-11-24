/** #775 internal, inert ledger core. No HTTP routes or runtime activation.
 * Trusted domain adapters must construct live authorization and source guards.
 */
import clubs from '../../data/clubs.json' with {type:'json'};
import type {Database,Statement} from './database.ts';
import {ApiError} from './errors.ts';
export const ARC_LIMIT=1_000_000_000_000;
const clubKeys=new Set(clubs.map(c=>c.countryId+'-'+c.clubId));
if(clubKeys.size!==320)throw Error('Invalid canonical club catalogue');
const purposes=['GENESIS_RESERVE','ISSUE_RESERVE','RETIRE_RESERVE','CLUB_OPENING','REWARD','PAYROLL_HUMAN','PAYROLL_AI','YOUTH_PURCHASE','PRIMARY_MANDATE_PURCHASE','SPORTING_TRANSFER','CAPITAL_PURCHASE','ARC_ACQUISITION','MANDATE_TRADE','REVERSAL'] as const;
type Purpose=typeof purposes[number];
type Kind='CLUB_TREASURY'|'USER_WALLET'|'PLATFORM_RESERVE'|'ISSUANCE_CONTROL';
type Line={accountId:string;amountArc:number};
export type LedgerIntent={
 businessKey:string;requestKey:string;purpose:Purpose;actorKind:'user'|'admin'|'system';actorId:string;
 configVersion:string;sourceId:string;generation?:string;season?:number;day?:number;
 reversalOf?:string;holdId?:string;lines:readonly Line[];
};
export type LedgerReceipt={id:string;business_key:string;request_key:string;request_hash:string;actor_kind:string;actor_id:string;purpose:Purpose;config_version:string;source_id:string;occurred_at:number;reversal_of:string|null;lines_json:string};
export type LedgerGuards={
 // Access guards must be replay-safe; domain preconditions apply only to a fresh operation.
 access:readonly Statement[];preconditions?:readonly Statement[];effects?:readonly Statement[];
};
export type LedgerBalance={id:string;kind:Kind;owner_id:string;balance_arc:number;reserved_arc:number;available_arc:number};
const invalid=()=>new ApiError(422,'economic_invalid_intent');
const text=(x:unknown,max:number):x is string=>typeof x==='string'&&x.length>0&&x.length<=max&&x.trim()===x&&!/[\u0000-\u001f]/.test(x);
const bounded=(n:unknown,min:number,max:number):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=min&&n<=max;
const timestamp=(n:number)=>{if(!bounded(n,1,Number.MAX_SAFE_INTEGER))throw invalid();};
export function clubTreasuryId(clubKey:string){
 if(!clubKeys.has(clubKey))throw invalid();
 return 'club:'+clubKey;
}
export function userWalletId(userId:string){
 if(!text(userId,160))throw invalid();
 return 'user:'+userId;
}
export function economicAssert(db:Database,condition:string,values:unknown[]=[]):Statement{
 // condition must be trusted static SQL supplied by server code, never request text.
 return db.prepare('INSERT INTO economic_assertions(must_be_true) SELECT 0 WHERE NOT EXISTS('+condition+')').bind(...values);
}
async function digest(value:string){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
 return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function normalize(i:LedgerIntent){
 if(!i||!text(i.businessKey,240)||!text(i.requestKey,160)||!purposes.includes(i.purpose)
 ||!['user','admin','system'].includes(i.actorKind)||!text(i.actorId,160)||!text(i.configVersion,100)||!text(i.sourceId,240)
 ||!Array.isArray(i.lines)||i.lines.length<2||i.lines.length>(['MANDATE_TRADE','REVERSAL'].includes(i.purpose)?3:2)
 ||(i.holdId!==undefined&&!text(i.holdId,240)))throw invalid();
 const scoped=i.generation!==undefined||i.season!==undefined||i.day!==undefined;
 if(scoped&&(!text(i.generation,36)||i.generation.length!==36||!bounded(i.season,0,Number.MAX_SAFE_INTEGER)||!bounded(i.day,0,56)))throw invalid();
 if(i.purpose==='REVERSAL'?(!text(i.reversalOf,36)||i.reversalOf.length!==36):i.reversalOf!==undefined)throw invalid();
 const lines=i.lines.map(l=>{
  if(!l||!text(l.accountId,165)||!bounded(l.amountArc,-ARC_LIMIT,ARC_LIMIT)||l.amountArc===0)throw invalid();
  return {accountId:l.accountId,amountArc:l.amountArc};
 }).sort((a,b)=>a.accountId<b.accountId?-1:a.accountId>b.accountId?1:0);
 if(new Set(lines.map(l=>l.accountId)).size!==lines.length||lines.reduce((sum,l)=>sum+l.amountArc,0)!==0)throw invalid();
 return {businessKey:i.businessKey,requestKey:i.requestKey,purpose:i.purpose,actorKind:i.actorKind,actorId:i.actorId,
  configVersion:i.configVersion,sourceId:i.sourceId,generation:i.generation??null,season:i.season??null,day:i.day??null,
  reversalOf:i.reversalOf??null,holdId:i.holdId??null,lines};
}
function requireAccess(g:LedgerGuards){
 if(!g||!Array.isArray(g.access)||g.access.length===0)throw new ApiError(403,'economic_authority_required');
}
async function authorizedReplay(db:Database,i:ReturnType<typeof normalize>,hash:string,g:LedgerGuards):Promise<LedgerReceipt|null>{
 const q=db.prepare('SELECT * FROM economic_transactions WHERE business_key=? OR (actor_kind=? AND actor_id=? AND request_key=?)')
  .bind(i.businessKey,i.actorKind,i.actorId,i.requestKey);
 const results=await db.batch([...g.access,q]);
 const rows=results[results.length-1].results as LedgerReceipt[];
 if(!rows.length)return null;
 if(rows.length!==1||rows[0].request_hash!==hash||rows[0].actor_kind!==i.actorKind||rows[0].actor_id!==i.actorId)
  throw new ApiError(409,'economic_idempotency_conflict');
 return rows[0];
}
function sealedInsert(db:Database,i:ReturnType<typeof normalize>,hash:string,id:string,now:number){
 return db.prepare('INSERT INTO economic_transactions(id,business_key,request_key,request_hash,purpose,actor_kind,actor_id,config_version,source_id,generation,season,day,occurred_at,reversal_of,hold_id,lines_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(id,i.businessKey,i.requestKey,hash,i.purpose,i.actorKind,i.actorId,i.configVersion,i.sourceId,i.generation,i.season,i.day,now,i.reversalOf,i.holdId,JSON.stringify(i.lines));
}
/** Bounded fresh-only atomic batch. Caller must reconcile immutable receipts
 * and retry from journal on any failure or unknown response. Same seal as single posting. */
export const ECONOMIC_FRESH_BATCH_LIMIT=24;
export async function postFreshEconomicBatch(db:Database,intents:readonly LedgerIntent[],guards:LedgerGuards,now:number){
 requireAccess(guards);timestamp(now);
 if(!Array.isArray(intents)||!intents.length||intents.length>ECONOMIC_FRESH_BATCH_LIMIT||!guards.preconditions?.length)throw invalid();
 const normalized=intents.map(normalize);
 if(new Set(normalized.map(i=>i.businessKey)).size!==normalized.length)throw invalid();
 const generations=[...new Set(normalized.map(i=>i.generation).filter((g):g is string=>g!==null))];
 const inserts=await Promise.all(normalized.map(async i=>sealedInsert(db,i,await digest(JSON.stringify(i)),crypto.randomUUID(),now)));
 try{
  await db.batch([...guards.access,...generations.map(g=>economicAssert(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=?',[g])),
   ...guards.preconditions,...inserts,...(guards.effects??[])]);
 }catch{throw new ApiError(409,'economic_batch_rejected');}
}
export async function postEconomicOperation(db:Database,intent:LedgerIntent,guards:LedgerGuards,now:number):Promise<LedgerReceipt>{
 requireAccess(guards);timestamp(now);
 const i=normalize(intent),hash=await digest(JSON.stringify(i));
 const existing=await authorizedReplay(db,i,hash,guards);
 if(existing)return existing;
 const id=crypto.randomUUID();
 const insert=sealedInsert(db,i,hash,id,now);
 // A sporting source must still belong to the current generation at posting.
 const generationGuard=i.generation===null?[]:[economicAssert(db,'SELECT 1 FROM world_state WHERE id=1 AND generation=?',[i.generation])];
 try{
  const result=await db.batch([...guards.access,...generationGuard,...(guards.preconditions??[]),insert,...(guards.effects??[]),
   db.prepare('SELECT * FROM economic_transactions WHERE id=?').bind(id)]);
  const receipt=result[result.length-1].results[0] as LedgerReceipt|undefined;
  if(!receipt)throw Error('Missing economic receipt');
  return receipt;
 }catch(error){
  // A racing identical request or lost response may already have committed.
  const replay=await authorizedReplay(db,i,hash,guards);
  if(replay)return replay;
  const message=String(error);
  if(message.includes('economic insufficient funds'))throw new ApiError(409,'economic_insufficient_funds_or_limit');
  if(message.includes('economic posting disabled'))throw new ApiError(409,'economic_posting_disabled');
  if(message.includes('economic issuance ceiling'))throw new ApiError(409,'economic_issuance_limit');
  // Never expose SQL or report success on an unconfirmed outcome.
  throw new ApiError(409,'economic_post_rejected');
 }
}
/** Zero-balance provisioning only; not a grant or license acquisition.
 * Bounded batches make retries safe without assuming all 320 fit a D1 request.
 */
export async function provisionClubAccounts(db:Database,now:number,access:readonly Statement[]){
 timestamp(now);requireAccess({access});
 const accounts:[string,Kind,string][]=[['reserve','PLATFORM_RESERVE','platform'],['issuance','ISSUANCE_CONTROL','platform'],
  ...[...clubKeys].sort().map((key):[string,Kind,string]=>[clubTreasuryId(key),'CLUB_TREASURY',key])];
 for(let n=0;n<accounts.length;n+=32){
  await db.batch([...access,...accounts.slice(n,n+32).map(([id,kind,owner])=>db.prepare(
   'INSERT INTO economic_accounts(id,kind,owner_id,created_at) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM economic_accounts WHERE id=?)'
  ).bind(id,kind,owner,now,id))]);
 }
}
export async function provisionWallet(db:Database,userId:string,now:number,access:readonly Statement[]){
 timestamp(now);requireAccess({access});
 const id=userWalletId(userId);
 await db.batch([...access,economicAssert(db,"SELECT 1 FROM player_accounts WHERE id=? AND status='active' AND email_verified_at IS NOT NULL",[userId]),
  db.prepare("INSERT INTO economic_accounts(id,kind,owner_id,created_at) SELECT ?,'USER_WALLET',?,? WHERE NOT EXISTS(SELECT 1 FROM economic_accounts WHERE id=?)").bind(id,userId,now,id)]);
 return id;
}
/** Protected internal read: caller supplies wallet-owner or appropriate finance read guard. */
export async function readEconomicBalance(db:Database,id:string,access:readonly Statement[]):Promise<LedgerBalance|null>{
 requireAccess({access});
 const results=await db.batch([...access,db.prepare('SELECT * FROM economic_available_balances WHERE id=?').bind(id)]);
 const row=results[results.length-1].results[0] as LedgerBalance|undefined;
 if(row&&!bounded(row.balance_arc,-ARC_LIMIT,ARC_LIMIT))throw new ApiError(503,'economic_integrity_error');
 return row??null;
}
/** Internal finance capability check. The HTTP boundary must still validate Origin,
 * CSRF and authenticated session, and supply the same actor to the intent.
 * No generic finance endpoint or permission-grant endpoint is exposed here.
 */
export type FinanceCapability='read'|'post'|'fund'|'reserve'|'reverse'|'freeze';
export function financeSessionGuard(db:Database,actorId:string,sessionDigest:string,csrfDigest:string,capability:FinanceCapability,now:number){
 timestamp(now);
 return economicAssert(db,`SELECT 1 FROM player_sessions s JOIN player_accounts a ON a.id=s.account_id
 JOIN economic_finance_permissions p ON p.account_id=a.id AND p.capability=?
 WHERE a.id=? AND s.token_digest=? AND s.csrf_digest=? AND a.status='active'
 AND a.email_verified_at IS NOT NULL AND a.credential_version=s.credential_version
 AND s.created_at>0 AND s.created_at<=? AND s.last_seen_at>=s.created_at AND s.last_seen_at<=?
 AND s.last_seen_at>? AND s.expires_at>? AND s.expires_at<=s.created_at+2592000
 AND EXISTS(SELECT 1 FROM account_permissions q WHERE q.account_id=a.id AND q.permission='admin.access')`,
 [capability,actorId,sessionDigest,csrfDigest,now,now,now-604800,now]);
}
export type EconomicHold={id:string;accountId:string;purpose:'REWARD_BUDGET'|'COMMITMENT';sourceId:string;configVersion:string;amountArc:number;actorId:string};
/** Stable identity, exact replay and guard composition; amounts are reservations, not debits. */
export async function reserveEconomicFunds(db:Database,h:EconomicHold,guards:LedgerGuards,now:number){
 requireAccess(guards);timestamp(now);
 if(!text(h.id,240)||!text(h.accountId,165)||!text(h.sourceId,240)||!text(h.configVersion,100)
 ||!text(h.actorId,160)||!bounded(h.amountArc,1,ARC_LIMIT)||!['REWARD_BUDGET','COMMITMENT'].includes(h.purpose))throw invalid();
 const match=()=>db.prepare('SELECT 1 AS ok FROM economic_holds WHERE id=? AND account_id=? AND purpose=? AND source_id=? AND config_version=? AND amount_arc=? AND actor_id=?')
 .bind(h.id,h.accountId,h.purpose,h.sourceId,h.configVersion,h.amountArc,h.actorId);
 const query=()=>db.prepare('SELECT * FROM economic_open_holds WHERE id=?').bind(h.id);
 const replay=async()=>{
  const r=await db.batch([...guards.access,match(),query()]);
  if(!r[r.length-1].results.length)return null;
  if(!r[r.length-2].results.length)throw new ApiError(409,'economic_idempotency_conflict');
  return r[r.length-1].results[0];
 };
 const old=await replay();if(old)return old;
 try{
  const r=await db.batch([...guards.access,...(guards.preconditions??[]),db.prepare('INSERT INTO economic_holds VALUES(?,?,?,?,?,?,?,?)')
   .bind(h.id,h.accountId,h.purpose,h.sourceId,h.configVersion,h.amountArc,h.actorId,now),...(guards.effects??[]),query()]);
  return r[r.length-1].results[0];
 }catch{const existing=await replay();if(existing)return existing;throw new ApiError(409,'economic_hold_rejected');}
}
export async function releaseEconomicFunds(db:Database,id:string,holdId:string,amount:number,actorId:string,guards:LedgerGuards,now:number){
 requireAccess(guards);timestamp(now);
 if(!text(id,240)||id.startsWith('post:')||!text(holdId,240)||!text(actorId,160)||!bounded(amount,1,ARC_LIMIT))throw invalid();
 const query=()=>db.prepare('SELECT * FROM economic_hold_releases WHERE id=?').bind(id);
 const replay=async()=>{
  const r=await db.batch([...guards.access,query()]);const row=r[r.length-1].results[0];
  if(!row)return null;
  if(row.hold_id!==holdId||row.amount_arc!==amount||row.actor_id!==actorId||row.transaction_id!==null)throw new ApiError(409,'economic_idempotency_conflict');
  return row;
 };
 const old=await replay();if(old)return old;
 try{
  const r=await db.batch([...guards.access,...(guards.preconditions??[]),db.prepare('INSERT INTO economic_hold_releases VALUES(?,?,?,NULL,?,?)')
   .bind(id,holdId,amount,actorId,now),...(guards.effects??[]),query()]);
  return r[r.length-1].results[0];
 }catch{const existing=await replay();if(existing)return existing;throw new ApiError(409,'economic_release_rejected');}
}
/** Aggregate audit in one snapshot: no unbounded result set crosses the D1 boundary.
 * SQL still scans indexed history; benchmark at production volume before activation.
 */
const invalidJournal="SELECT COUNT(*) AS n FROM economic_transactions t WHERE (SELECT COUNT(*) FROM economic_entries e WHERE e.transaction_id=t.id)<>json_array_length(t.lines_json) OR (SELECT COALESCE(SUM(amount_arc),0) FROM economic_entries e WHERE e.transaction_id=t.id)<>0 OR EXISTS(SELECT 1 FROM json_each(t.lines_json) j WHERE NOT EXISTS(SELECT 1 FROM economic_entries e WHERE e.transaction_id=t.id AND e.line_no=j.key AND e.account_id=json_extract(j.value,'$.accountId') AND e.amount_arc=json_extract(j.value,'$.amountArc')))";
const invalidBalances="SELECT COUNT(*) AS n FROM economic_available_balances WHERE balance_arc NOT BETWEEN CASE WHEN kind='ISSUANCE_CONTROL' THEN -1000000000000 ELSE 0 END AND CASE WHEN kind='ISSUANCE_CONTROL' THEN 0 ELSE 1000000000000 END OR reserved_arc<0 OR (kind<>'ISSUANCE_CONTROL' AND available_arc<0)";
const invalidHolds="SELECT COUNT(*) AS n FROM economic_open_holds WHERE remaining_arc<0 OR remaining_arc>amount_arc";
const totals="SELECT COUNT(*) AS account_count,COALESCE(SUM(CASE WHEN kind<>'ISSUANCE_CONTROL' THEN balance_arc ELSE 0 END),0) AS stock,COALESCE(-SUM(CASE WHEN kind='ISSUANCE_CONTROL' THEN balance_arc ELSE 0 END),0) AS issued FROM economic_balances";
/** Enforce the existing canonical aggregate audit inside a domain write batch. */
export function economicReconciliationGuard(db:Database,when?:{condition:string;values:unknown[]}){
 const valid="("+invalidJournal+")=0 AND ("+invalidBalances+")=0 AND ("+invalidHolds+")=0 AND EXISTS(SELECT 1 FROM ("+totals+") WHERE stock=issued AND stock BETWEEN 0 AND "+ARC_LIMIT+")";
 return economicAssert(db,"SELECT 1 WHERE "+(when?"NOT ("+when.condition+") OR ":"")+"("+valid+")",when?.values??[]);
}
export async function reconcileEconomy(db:Database,access:readonly Statement[]){
 requireAccess({access});
 const result=await db.batch([...access,db.prepare(invalidJournal),db.prepare(invalidBalances),db.prepare(invalidHolds),db.prepare(totals)]);
 const [j,b,h,t]=result.slice(-4).map(r=>r.results[0]);
 const invalidTransactions=Number(j?.n),invalidBalancesCount=Number(b?.n),invalidHoldsCount=Number(h?.n);
 const stock=Number(t?.stock),issued=Number(t?.issued);
 return {ok:invalidTransactions===0&&invalidBalancesCount===0&&invalidHoldsCount===0&&bounded(stock,0,ARC_LIMIT)&&bounded(issued,0,ARC_LIMIT)&&stock===issued,
 invalidTransactions,invalidBalances:invalidBalancesCount,invalidHolds:invalidHoldsCount,stockArc:String(stock),netIssuedArc:String(issued),accountCount:Number(t?.account_count)};
}
/** Fail-closed posting switch; audit and recovery require a separately authorized
 * workflow. Never automatically re-enable posting after a discrepancy.
 */
export async function reconcileAndFreezeEconomy(db:Database,access:readonly Statement[]){
 requireAccess({access});
 // The SQL audit and freeze are evaluated in the same batch, avoiding a stale
 // clean/dirty report authorizing a new write between reconciliation and freeze.
 await db.batch([...access,db.prepare("UPDATE economic_control SET posting_enabled=0 WHERE id=1 AND posting_enabled=1 AND (("+invalidJournal+")>0 OR ("+invalidBalances+")>0 OR ("+invalidHolds+")>0 OR EXISTS(SELECT 1 FROM ("+totals+") WHERE stock<>issued OR stock<0 OR stock>1000000000000))")]);
 return reconcileEconomy(db,access);
}
