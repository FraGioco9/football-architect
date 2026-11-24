import {beforeAll,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {economicAssert,postEconomicOperation,provisionClubAccounts,provisionWallet,readEconomicBalance,reconcileEconomy,type LedgerIntent} from '../src/economic-ledger.ts';

const binding=env as any,db=binding.DB as Database;
const now=1770000000,version='synthetic-775-v1';
const access=()=>[economicAssert(db,'SELECT 1')]; // disposable trusted fixture only
const guards=()=>({access:access()});
const line=(accountId:string,amountArc:number)=>({accountId,amountArc});
const intent=(key:string,purpose:LedgerIntent['purpose'],from:string,to:string,amount:number,sourceId=key):LedgerIntent=>({
 businessKey:key,requestKey:key,purpose,actorKind:'system',actorId:'fixture',configVersion:version,sourceId,
 lines:[line(from,-amount),line(to,amount)]
});
const post=(i:LedgerIntent)=>postEconomicOperation(db,i,guards(),now);
const balance=async(id:string)=>(await readEconomicBalance(db,id,access()))?.balance_arc;
beforeAll(async()=>{
 await applyD1Migrations(db,binding.TEST_MIGRATIONS);
 await provisionClubAccounts(db,now,access());
 await provisionClubAccounts(db,now,access());
 await db.prepare("INSERT INTO player_accounts(id,email_normalized,password_verifier,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,'active',?,?)")
  .bind('economy-fixture','economy-fixture@example.invalid','fixture',now,now,now).run();
 await provisionWallet(db,'economy-fixture',now,access());
 await db.prepare('INSERT INTO economic_policy_versions VALUES(?,?,?,?,?,?,?)')
  .bind(version,now,'synthetic-fixture',2400000,3000000,JSON.stringify({'IT-1':3000,'IT-2':1500}),JSON.stringify({draft:true})).run();
});
it('seals balanced postings, enforces atomic guards, exact retries, route and stock conservation',async()=>{
 expect((await reconcileEconomy(db,access())).accountCount).toBe(323);
 expect(await balance('club:IT-1')).toBe(0);
 const genesis=intent('genesis','GENESIS_RESERVE','issuance','reserve',2400000);
 await expect(post(genesis)).rejects.toMatchObject({code:'economic_posting_disabled'});
 await db.prepare('INSERT INTO economic_control VALUES(1,?,1)').bind(version).run();
 const first=await post(genesis);
 expect((await post(genesis)).id).toBe(first.id);
 await expect(post({...genesis,sourceId:'changed'})).rejects.toMatchObject({code:'economic_idempotency_conflict'});
 await expect(post(intent('genesis-again','GENESIS_RESERVE','issuance','reserve',2400000))).rejects.toThrow();
 await post(intent('opening-1','CLUB_OPENING','reserve','club:IT-1',3000,'IT-1'));
 await expect(post(intent('opening-again','CLUB_OPENING','reserve','club:IT-1',3000,'IT-1'))).rejects.toThrow();
 await expect(post(intent('wrong-opening','CLUB_OPENING','reserve','club:IT-2',1400,'IT-2'))).rejects.toThrow();
 await post(intent('opening-2','CLUB_OPENING','reserve','club:IT-2',1500,'IT-2'));
 await expect(post(intent('overmint','ISSUE_RESERVE','issuance','reserve',600001))).rejects.toMatchObject({code:'economic_issuance_limit'});
 await expect(post(intent('bad-route','YOUTH_PURCHASE','club:IT-1','reserve',10))).rejects.toThrow();
 await expect(postEconomicOperation(db,intent('unauthorized','PAYROLL_AI','club:IT-1','reserve',10),{access:[]},now)).rejects.toMatchObject({code:'economic_authority_required'});
 await expect(postEconomicOperation(db,intent('late-fail','PAYROLL_AI','club:IT-1','reserve',100),{...guards(),effects:[economicAssert(db,'SELECT 1 WHERE 0')]},now)).rejects.toThrow();
 expect(await balance('club:IT-1')).toBe(3000);
 const human=await post(intent('human','PAYROLL_HUMAN','club:IT-1','user:economy-fixture',1000));
 expect(await balance('user:economy-fixture')).toBe(1000);
 await post(intent('ai','PAYROLL_AI','club:IT-1','reserve',200));
 expect(await balance('club:IT-1')).toBe(1800);
 const reverse={...intent('reverse','REVERSAL','user:economy-fixture','club:IT-1',1000),reversalOf:human.id};
 await post(reverse);
 await expect(post({...reverse,businessKey:'reverse-again',requestKey:'reverse-again'})).rejects.toThrow();
 expect(await balance('user:economy-fixture')).toBe(0);
 expect(await balance('club:IT-1')).toBe(2800);
 const spend=await Promise.allSettled([post(intent('race-a','PAYROLL_AI','club:IT-1','reserve',2000)),post(intent('race-b','PAYROLL_AI','club:IT-1','reserve',2000))]);
 expect(spend.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(await balance('club:IT-1')).toBe(800);
 const duplicate=intent('same-race','PAYROLL_AI','club:IT-1','reserve',100);
 const retries=await Promise.all([post(duplicate),post(duplicate)]);
 expect(retries[0].id).toBe(retries[1].id);
 expect(await balance('club:IT-1')).toBe(700);
 await expect(db.prepare('DELETE FROM economic_transactions WHERE id=?').bind(first.id).run()).rejects.toThrow();
 await expect(db.prepare('UPDATE economic_entries SET amount_arc=1 WHERE transaction_id=?').bind(first.id).run()).rejects.toThrow();
 await expect(db.prepare('INSERT INTO economic_entries VALUES(?,?,?,?)').bind(first.id,2,'club:IT-1',10).run()).rejects.toThrow();
 await expect(db.prepare("UPDATE economic_policy_versions SET genesis_reserve_arc=1 WHERE version=?").bind(version).run()).rejects.toThrow();
 expect(await reconcileEconomy(db,access())).toMatchObject({ok:true,invalidTransactions:0,invalidBalances:0,stockArc:'2400000',netIssuedArc:'2400000'});
});
