/** #775 internal, inert ledger core. No HTTP routes or runtime activation.
 * Trusted domain adapters must construct live authorization and source guards.
 */
import clubs from '../../data/clubs.json' with {type:'json'};
import type {Database,Statement} from './database.ts';
import {ApiError} from './errors.ts';
export const ARC_LIMIT=1_000_000_000_000;
const clubKeys=new Set(clubs.map(c=>c.countryId+'-'+c.clubId));
if(clubKeys.size!==320)throw Error('Invalid canonical club catalogue');
const purposes=['GENESIS_RESERVE','ISSUE_RESERVE','RETIRE_RESERVE','CLUB_OPENING','REWARD','PAYROLL_HUMAN','PAYROLL_AI','YOUTH_PURCHASE','SPORTING_TRANSFER','CAPITAL_PURCHASE','ARC_ACQUISITION','REVERSAL'] as const;
type Purpose=typeof purposes[number];
type Kind='CLUB_TREASURY'|'USER_WALLET'|'PLATFORM_RESERVE'|'ISSUANCE_CONTROL';
type Line={accountId:string;amountArc:number};
export type LedgerIntent={
 businessKey:string;requestKey:string;purpose:Purpose;actorKind:'user'|'admin'|'system';actorId:string;
 configVersion:string;sourceId:string;generation?:string;season?:number;day?:number;
 reversalOf?:string;lines:readonly Line[];
};
export type LedgerReceipt={id:string;business_key:string;request_key:string;request_hash:string;actor_kind:string;actor_id:string;purpose:Purpose;config_version:string;source_id:string;occurred_at:number;reversal_of:string|null;lines_json:string};
export type LedgerGuards={
 // Access guards must be replay-safe; domain preconditions apply only to a fresh operation.
 access:readonly Statement[];preconditions?:readonly Statement[];effects?:readonly Statement[];
};
export type LedgerBalance={id:string;kind:Kind;owner_id:string;balance_arc:number};
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
 ||!Array.isArray(i.lines)||i.lines.length!==2)throw invalid();
 const scoped=i.generation!==undefined||i.season!==undefined||i.day!==undefined;
 if(scoped&&(!text(i.generation,36)||i.generation.length!==36||!bounded(i.season,0,Number.MAX_SAFE_INTEGER)||!bounded(i.day,0,56)))throw invalid();
 if(i.purpose==='REVERSAL'?(!text(i.reversalOf,36)||i.reversalOf.length!==36):i.reversalOf!==undefined)throw invalid();
 const lines=i.lines.map(l=>{
  if(!l||!text(l.accountId,165)||!bounded(l.amountArc,-ARC_LIMIT,ARC_LIMIT)||l.amountArc===0)throw invalid();
  return {accountId:l.accountId,amountArc:l.amountArc};
 }).sort((a,b)=>a.accountId<b.accountId?-1:a.accountId>b.accountId?1:0);
 if(lines[0].accountId===lines[1].accountId||lines[0].amountArc+lines[1].amountArc!==0)throw invalid();
 return {businessKey:i.businessKey,requestKey:i.requestKey,purpose:i.purpose,actorKind:i.actorKind,actorId:i.actorId,
  configVersion:i.configVersion,sourceId:i.sourceId,generation:i.generation??null,season:i.season??null,day:i.day??null,
  reversalOf:i.reversalOf??null,lines};
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
export async function postEconomicOperation(db:Database,intent:LedgerIntent,guards:LedgerGuards,now:number):Promise<LedgerReceipt>{
 requireAccess(guards);timestamp(now);
 const i=normalize(intent),hash=await digest(JSON.stringify(i));
 const existing=await authorizedReplay(db,i,hash,guards);
 if(existing)return existing;
 const id=crypto.randomUUID();
 const insert=db.prepare('INSERT INTO economic_transactions(id,business_key,request_key,request_hash,purpose,actor_kind,actor_id,config_version,source_id,generation,season,day,occurred_at,reversal_of,lines_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
  .bind(id,i.businessKey,i.requestKey,hash,i.purpose,i.actorKind,i.actorId,i.configVersion,i.sourceId,i.generation,i.season,i.day,now,i.reversalOf,JSON.stringify(i.lines));
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
 const results=await db.batch([...access,db.prepare('SELECT * FROM economic_balances WHERE id=?').bind(id)]);
 const row=results[results.length-1].results[0] as LedgerBalance|undefined;
 if(row&&!bounded(row.balance_arc,-ARC_LIMIT,ARC_LIMIT))throw new ApiError(503,'economic_integrity_error');
 return row??null;
}
/** Full audit for bounded local fixtures. Production scale needs a paginated/checkpointed
 * implementation before activation. BigInt totals are serialized as decimal strings.
 */
export async function reconcileEconomy(db:Database,access:readonly Statement[]){
 requireAccess({access});
 const result=await db.batch([...access,
  db.prepare("SELECT COUNT(*) AS n FROM economic_transactions t WHERE (SELECT COUNT(*) FROM economic_entries e WHERE e.transaction_id=t.id)<>2 OR (SELECT COALESCE(SUM(amount_arc),0) FROM economic_entries e WHERE e.transaction_id=t.id)<>0 OR EXISTS(SELECT 1 FROM json_each(t.lines_json) j WHERE NOT EXISTS(SELECT 1 FROM economic_entries e WHERE e.transaction_id=t.id AND e.line_no=j.key AND e.account_id=json_extract(j.value,'$.accountId') AND e.amount_arc=json_extract(j.value,'$.amountArc')))"),
  db.prepare('SELECT * FROM economic_balances')]);
 const invalidTransactions=Number(result[result.length-2].results[0]?.n);
 const balances=result[result.length-1].results as LedgerBalance[];
 let stock=0n,netIssued=0n,invalidBalances=0;
 for(const b of balances){
  if(!bounded(b.balance_arc,-ARC_LIMIT,ARC_LIMIT)||(b.kind==='ISSUANCE_CONTROL'?b.balance_arc>0:b.balance_arc<0)){invalidBalances++;continue;}
  if(b.kind==='ISSUANCE_CONTROL')netIssued-=BigInt(b.balance_arc);
  else stock+=BigInt(b.balance_arc);
 }
 return {ok:invalidTransactions===0&&invalidBalances===0&&stock===netIssued,
  invalidTransactions,invalidBalances,stockArc:stock.toString(),netIssuedArc:netIssued.toString(),accountCount:balances.length};
}
