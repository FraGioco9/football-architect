import {beforeAll,expect,it} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import clubs from '../../data/clubs.json' with {type:'json'};
import type {Database} from '../src/database.ts';
import {economicAssert,postEconomicOperation,provisionClubAccounts,provisionWallet,readEconomicBalance,reconcileEconomy,reserveEconomicFunds} from '../src/economic-ledger.ts';
import {planEconomicGenesis,inspectGenesisReceipts,planGenesisRewardHold} from '../src/economic-genesis-plan.mjs';

const binding=env as any,db=binding.DB as Database;
const now=1770000000;
const access=()=>[economicAssert(db,'SELECT 1')]; // trusted disposable test fixture only
const guards=()=>({access:access()});
const input={version:'synthetic-genesis-775',clubs:clubs.map((c,i)=>({clubKey:c.countryId+'-'+c.clubId,amountArc:i+1})),freeReserveArc:1000,issuanceLimitArc:3000000};
const plan=planEconomicGenesis(input);
const journal=async()=>(await db.prepare('SELECT * FROM economic_transactions ORDER BY business_key').all()).results;
beforeAll(async()=>{await applyD1Migrations(db,binding.TEST_MIGRATIONS);});
it('validates a complete deterministic catalogue and fails closed on invalid configuration',()=>{
 expect(plan.clubs).toHaveLength(320);
 expect(plan.annualRewardsArc).toBe(2400000);
 expect(plan.clubCapitalArc).toBe(51360);
 expect(plan.grossGenesisArc).toBe(2452360);
 expect(planEconomicGenesis({...input,clubs:[...input.clubs].reverse()})).toEqual(plan);
 expect(()=>planEconomicGenesis({...input,clubs:input.clubs.slice(1)})).toThrow();
 expect(()=>planEconomicGenesis({...input,clubs:[...input.clubs.slice(1),input.clubs[1]]})).toThrow();
 expect(()=>planEconomicGenesis({...input,clubs:input.clubs.map((c,i)=>i===0?{...c,amountArc:0}:c)})).toThrow();
 expect(()=>planEconomicGenesis({...input,issuanceLimitArc:2400000})).toThrow();
});
it('rehearses all 321 sealed postings, interrupted resume, exact retries, wallets and reward hold on disposable local D1',async()=>{
 await provisionClubAccounts(db,now,access());
 await provisionClubAccounts(db,now,access());
 await db.prepare("INSERT INTO player_accounts(id,email_normalized,password_verifier,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,'active',?,?)")
  .bind('genesis-fixture','genesis-fixture@example.invalid','fixture',now,now,now).run();
 await provisionWallet(db,'genesis-fixture',now,access());
 await provisionWallet(db,'genesis-fixture',now,access());
 expect((await readEconomicBalance(db,'user:genesis-fixture',access()))?.balance_arc).toBe(0);
 expect(inspectGenesisReceipts(plan,await journal()).state).toBe('uninitialized');
 await db.prepare('INSERT INTO economic_policy_versions VALUES(?,?,?,?,?,?,?)')
  .bind(plan.version,now,'synthetic-fixture',plan.policy.genesisReserveArc,plan.policy.issuanceLimitArc,plan.policy.clubOpeningJson,plan.policy.rulesJson).run();
 // Test-only activation; never used by a route or production command.
 await db.prepare('INSERT INTO economic_control VALUES(1,?,1)').bind(plan.version).run();
 const first=await postEconomicOperation(db,plan.intents[0],guards(),now);
 const same=await Promise.all([postEconomicOperation(db,plan.intents[0],guards(),now),postEconomicOperation(db,plan.intents[0],guards(),now)]);
 expect(same.map(r=>r.id)).toEqual([first.id,first.id]);
 for(const intent of plan.intents.slice(1,17))await postEconomicOperation(db,intent,guards(),now);
 const progress=inspectGenesisReceipts(plan,await journal());
 expect(progress).toMatchObject({state:'funding',fundedClubs:16,pendingClubs:304});
 const pending=progress.pending[0];
 await expect(postEconomicOperation(db,pending,{...guards(),effects:[economicAssert(db,'SELECT 1 WHERE 0')]},now)).rejects.toThrow();
 expect(inspectGenesisReceipts(plan,await journal()).fundedClubs).toBe(16);
 for(const intent of inspectGenesisReceipts(plan,await journal()).pending)await postEconomicOperation(db,intent,guards(),now);
 const rows=await journal();
 expect(rows).toHaveLength(321);
 expect(inspectGenesisReceipts(plan,rows)).toMatchObject({state:'funded-unverified',fundedClubs:320,fundedArc:51360,expectedReserveArc:2401000,pendingClubs:0});
 expect(()=>inspectGenesisReceipts(plan,[...rows,rows[0]])).toThrow();
 expect(()=>inspectGenesisReceipts(plan,rows.map((r,i)=>i===0?{...r,lines_json:'[]'}:r))).toThrow();
 const balances=(await db.prepare("SELECT owner_id,balance_arc FROM economic_balances WHERE kind='CLUB_TREASURY' ORDER BY owner_id").all()).results;
 expect(balances).toEqual(plan.clubs.map(c=>({owner_id:c.clubKey,balance_arc:c.amountArc})));
 const hold=planGenesisRewardHold(plan,'00000000-0000-4000-8000-000000000001',1);
 expect(await reserveEconomicFunds(db,hold,guards(),now)).toMatchObject({remaining_arc:2400000});
 expect(await reserveEconomicFunds(db,hold,guards(),now)).toMatchObject({remaining_arc:2400000});
 expect(await readEconomicBalance(db,'reserve',access())).toMatchObject({balance_arc:2401000,reserved_arc:2400000,available_arc:1000});
 expect(await reconcileEconomy(db,access())).toMatchObject({ok:true,stockArc:'2452360',netIssuedArc:'2452360',accountCount:323});
 expect(await journal()).toHaveLength(321);
},120000);
