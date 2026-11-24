import {beforeAll,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import type {Database} from '../src/database.ts';
import {economicAssert,postEconomicOperation,provisionClubAccounts,provisionWallet,readEconomicBalance,reconcileEconomy,reserveEconomicFunds,releaseEconomicFunds,financeSessionGuard,reconcileAndFreezeEconomy,type LedgerIntent} from '../src/economic-ledger.ts';

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

it('reserves and releases capital atomically; blocks unreserved debits and permits exact hold consumption',async()=>{
 const h={id:'season-budget',accountId:'reserve',purpose:'REWARD_BUDGET' as const,sourceId:'synthetic-season',configVersion:version,amountArc:10000,actorId:'fixture'};
 expect(await reserveEconomicFunds(db,h,guards(),now)).toMatchObject({remaining_arc:10000});
 expect(await reserveEconomicFunds(db,h,guards(),now)).toMatchObject({remaining_arc:10000});
 await expect(reserveEconomicFunds(db,{...h,amountArc:10001},guards(),now)).rejects.toMatchObject({code:'economic_idempotency_conflict'});
 const available=(await readEconomicBalance(db,'reserve',access()))!.available_arc;
 await expect(post(intent('reserved-debit','CAPITAL_PURCHASE','reserve','club:IT-1',available+1))).rejects.toThrow();
 const spend={...intent('held-reward','REWARD','reserve','club:IT-2',4000),holdId:h.id};
 await post(spend);await post(spend);
 expect(await reserveEconomicFunds(db,h,guards(),now)).toMatchObject({remaining_arc:6000});
 await expect(post({...intent('overhold','REWARD','reserve','club:IT-2',6001),holdId:h.id})).rejects.toThrow();
 await expect(postEconomicOperation(db,{...intent('hold-late-fail','REWARD','reserve','club:IT-2',100),holdId:h.id},{...guards(),effects:[economicAssert(db,'SELECT 1 WHERE 0')]},now)).rejects.toThrow();
 expect(await reserveEconomicFunds(db,h,guards(),now)).toMatchObject({remaining_arc:6000});
 await releaseEconomicFunds(db,'release-budget',h.id,6000,'fixture',guards(),now);
 await releaseEconomicFunds(db,'release-budget',h.id,6000,'fixture',guards(),now);
 expect(await reserveEconomicFunds(db,h,guards(),now)).toMatchObject({remaining_arc:0});
 expect((await readEconomicBalance(db,'reserve',access()))!.reserved_arc).toBe(0);
});
it('validates explicit multi-leg settlement and reversal without enabling club ARC sales',async()=>{
 await db.prepare("INSERT INTO player_accounts(id,email_normalized,password_verifier,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,'active',?,?)")
 .bind('economy-seller','economy-seller@example.invalid','fixture',now,now,now).run();
 await provisionWallet(db,'economy-seller',now,access());
 await post(intent('buyer-funds','ARC_ACQUISITION','reserve','user:economy-fixture',1000));
 const trade={...intent('mandate-trade','MANDATE_TRADE','user:economy-fixture','user:economy-seller',1000),
 lines:[line('user:economy-fixture',-1000),line('user:economy-seller',950),line('reserve',50)]};
 const tx=await post(trade);
 expect(await balance('user:economy-seller')).toBe(950);
 await expect(post({...trade,businessKey:'bad-multi',requestKey:'bad-multi',purpose:'CAPITAL_PURCHASE'})).rejects.toThrow();
 await expect(post({...intent('partial-reverse','REVERSAL','user:economy-seller','user:economy-fixture',950),reversalOf:tx.id})).rejects.toThrow();
 await post({...trade,businessKey:'trade-reversal',requestKey:'trade-reversal',purpose:'REVERSAL',reversalOf:tx.id,lines:trade.lines.map(l=>line(l.accountId,-l.amountArc))});
 expect(await balance('user:economy-fixture')).toBe(1000);
 expect(await balance('user:economy-seller')).toBe(0);
});
it('separates existing primary mandate receipts from youth and secondary trades, with atomic entitlement guard',async()=>{
 const before=await balance('user:economy-fixture'),reserveBefore=await balance('reserve');
 const purchase=intent('existing-mandate-purchase','PRIMARY_MANDATE_PURCHASE','user:economy-fixture','reserve',100,'synthetic-primary-event');
 await expect(postEconomicOperation(db,purchase,{...guards(),preconditions:[economicAssert(db,'SELECT 1 WHERE 0')]},now)).rejects.toThrow();
 expect(await balance('user:economy-fixture')).toBe(before);
 await expect(postEconomicOperation(db,purchase,{...guards(),effects:[economicAssert(db,'SELECT 1 WHERE 0')]},now)).rejects.toThrow();
 expect(await balance('reserve')).toBe(reserveBefore);
 const receipt=await post(purchase);
 expect((await post(purchase)).id).toBe(receipt.id);
 expect(receipt.purpose).toBe('PRIMARY_MANDATE_PURCHASE');
 expect(await balance('user:economy-fixture')).toBe(before!-100);
 expect(await balance('reserve')).toBe(reserveBefore!+100);
 await expect(post(intent('primary-bad-route','PRIMARY_MANDATE_PURCHASE','club:IT-1','reserve',1))).rejects.toThrow();
 await expect(post(intent('primary-unfunded','PRIMARY_MANDATE_PURCHASE','user:economy-fixture','reserve',before!+1))).rejects.toThrow();
 expect(await reconcileEconomy(db,access())).toMatchObject({ok:true,stockArc:'2400000'});
});
it('checks dedicated live capability, blocks reset after initialization, reconciles and freezes',async()=>{
 const digest='a'.repeat(64),csrf='b'.repeat(64),id='economy-fixture';
 await db.prepare('INSERT INTO player_sessions VALUES(?,?,?,?,?,?,?)').bind(digest,id,1,csrf,now,now,now+1000).run();
 const guard=()=>[financeSessionGuard(db,id,digest,csrf,'read',now)];
 await expect(readEconomicBalance(db,'reserve',guard())).rejects.toThrow();
 await db.prepare("INSERT INTO account_permissions(account_id,permission,granted_at,granted_by) VALUES(?,'admin.access',?,'fixture')").bind(id,now).run();
 await expect(readEconomicBalance(db,'reserve',guard())).rejects.toThrow();
 await db.prepare("INSERT INTO economic_finance_permissions VALUES(?,'read','fixture',?)").bind(id,now).run();
 expect(await readEconomicBalance(db,'reserve',guard())).not.toBeNull();
 await db.prepare("DELETE FROM economic_finance_permissions WHERE account_id=? AND capability='read'").bind(id).run();
 await expect(readEconomicBalance(db,'reserve',guard())).rejects.toThrow();
 await expect(db.prepare('UPDATE world_state SET generation=? WHERE id=1').bind(crypto.randomUUID()).run()).rejects.toThrow();
 expect(await reconcileAndFreezeEconomy(db,access())).toMatchObject({ok:true,stockArc:'2400000',netIssuedArc:'2400000'});
 expect((await db.prepare('SELECT posting_enabled FROM economic_control WHERE id=1').first())?.posting_enabled).toBe(1);
 // Disposable fault injection: drop only the fixture's hold release immutability
 // trigger to simulate corrupt storage, not a production recovery procedure.
 await db.prepare('DROP TRIGGER economic_release_no_delete').run();
 await db.prepare("DELETE FROM economic_hold_releases WHERE id='release-budget'").run();
 // Lost release leaves a still-covered reservation; force a detected deficit.
 await db.prepare('DROP TRIGGER economic_hold_no_update').run();
 await db.prepare("UPDATE economic_holds SET amount_arc=1000000000000 WHERE id='season-budget'").run();
 expect(await reconcileAndFreezeEconomy(db,access())).toMatchObject({ok:false});
 expect((await db.prepare('SELECT posting_enabled FROM economic_control WHERE id=1').first())?.posting_enabled).toBe(0);
 await expect(post(intent('frozen-post','PAYROLL_AI','club:IT-1','reserve',1))).rejects.toMatchObject({code:'economic_posting_disabled'});
});
