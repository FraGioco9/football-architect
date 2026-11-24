import {prepareRewardSettlement,readRewardSettlementManifest,projectFinalRewardEvidence,buildRewardManifest,type PreparedRewardSettlement} from '../src/reward-settlement-evidence.ts';
import {planRewardSettlement,type RewardPlan} from '../src/reward-settlement-plan.mjs';
import {canonicalHash} from '../src/catalogue-snapshot.ts';
import {rewardCalendarCompletionGuards,prepareRewardPayrollGuards} from '../src/reward-calendar-gate.ts';
import {annualRewardHoldId,executeRewardSettlementBatch,REWARD_BATCH_LIMIT} from '../src/reward-settlement-command.ts';
import {economicAssert,provisionClubAccounts,provisionWallet,postEconomicOperation,reserveEconomicFunds,reconcileEconomy} from '../src/economic-ledger.ts';
import {settleClubPayrollBatch,reconcilePayrollPayday} from '../src/payroll-settlement-command.ts';
import {seedSignedTestTerm} from './fixtures/signed-contracts.ts';
import {readMatchDirectory} from '../src/public-match-directory.ts';
/** #613 FULL 56-day V2 authority on isolated local Worker D1.
 * Deliberately a single immutable-fixture test. Never reset the user's world.
 * Runs the real protected day writer, archive and close, with no legacy score.
 */
import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {clearTestWorld} from './fixtures/test-world.ts';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {prepareSeason} from '../src/commands.ts';
import {initializeAdministrativeEvents} from '../src/admin-calendar-initialize.ts';
import {advanceAdministrativeClockLineupV1} from '../src/admin-calendar-clock-lineup-v1.ts';
import {completeConfirmationEvent} from '../src/admin-calendar-confirm.ts';
import {stageDomesticCalendar} from '../src/admin-domestic-stage.ts';
import {executeInternationalDraw} from '../src/admin-international-draw.ts';
import {publishInternationalCalendarLineupV1} from '../src/admin-calendar-publish-lineup-v1.ts';
import {executeLineupLifecycleV1} from '../src/lineup-lifecycle-command.ts';
import {archiveSeasonLineupV1} from '../src/season-archive-command-lineup-v1.ts';
import {closeSeasonLineupV1} from '../src/season-close-command-lineup-v1.ts';
import {readSeasonTwoCandidate} from '../src/season-two-candidate-read.ts';
import {approveSeasonTwoSnapshot} from '../src/season-two-approval-command.ts';
import {prepareSeasonTwo} from '../src/season-two-prepare-command.ts';
import {verifyLineupSeasonArchiveV1} from '../src/lineup-season-archive-proof.ts';
import {loadSeasonSportingEvidence} from '../src/season-sporting-evidence.ts';
import {replayLineupSeasonV1} from '../src/lineup-season-replay.ts';
import {planLineupSportingDayV1} from '../src/lineup-sporting-day-plan.ts';
import {readClosedSeasonHistory} from '../src/season-archive-read.ts';
import {readPublicSportingSeasonLineupV1} from '../src/public-sporting-read-lineup-v1.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {readWorld} from '../src/world-repository.ts';
import type {AdminSession} from '../src/auth.ts';

const bindings=env as any,db=bindings.DB,now=Math.floor(Date.now()/1000);
type World=Awaited<ReturnType<typeof readWorld>>;
const count=async(table:string):Promise<number>=>{
 const row=await db.prepare('SELECT COUNT(*) AS n FROM '+table).first() as {n:number}|null;
 if(!row)throw Error('Missing '+table);
 return row.n;
};
beforeAll(async()=>applyD1Migrations(db,bindings.TEST_MIGRATIONS));

it('#613 finalizes full V2 season (56 days, 4082 receipts, 54 ties), archives and closes with atomic rollback',async()=>{
 await clearTestWorld(db);
 const session:AdminSession=(await seedUnifiedOperator(
  db,'lineup-fullseason-qa','lineup-fullseason@example.invalid',now,'8'.repeat(64)
 )).session;
 let world:World=await readWorld(db);
 const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
 const advance=async(next:Promise<{world:World}>)=>{world=(await next).world;};

 await advance(prepareSeason(db,session,command(),'lineup-season-prepare-0001',
  await loadApprovedSnapshot(),now));
 const rewardPin={rewardVersion:'draft-5',configVersion:'synthetic-776'};
 const localAccess=()=>[economicAssert(db,'SELECT 1')]; // fixture-only activation/funding
 await provisionClubAccounts(db,now,localAccess());
 await db.prepare('INSERT INTO economic_policy_versions VALUES(?,?,?,?,?,?,?)')
  .bind(rewardPin.configVersion,now,'fixture',2400000,2400000,'{}',JSON.stringify({rewardVersion:'draft-5'})).run();
 await db.prepare('INSERT INTO economic_control VALUES(1,?,1)').bind(rewardPin.configVersion).run();
 await postEconomicOperation(db,{businessKey:'fixture-776-genesis',requestKey:'fixture-776-genesis',purpose:'GENESIS_RESERVE',
  actorKind:'system',actorId:'fixture',configVersion:rewardPin.configVersion,sourceId:'fixture-776-genesis',
  lines:[{accountId:'issuance',amountArc:-2400000},{accountId:'reserve',amountArc:2400000}]},{access:localAccess()},now);
 const holdId=annualRewardHoldId(world.generation,world.seasonNumber);
 await reserveEconomicFunds(db,{id:holdId,sourceId:holdId,accountId:'reserve',purpose:'REWARD_BUDGET',
  configVersion:rewardPin.configVersion,amountArc:2400000,actorId:'reward-settlement-v1'},{access:localAccess()},now);
 await db.batch(['read','post'].map(capability=>db.prepare('INSERT INTO economic_finance_permissions VALUES(?,?,?,?)')
  .bind(session.unified!.playerId,capability,'fixture',now)));
 await advance(initializeAdministrativeEvents(db,session,command(),
  'lineup-season-events-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'start',command(),
  'lineup-season-admin-start-0001',now));
 for(const eventId of ['domestic:entrants','international:entrants']){
  await advance(completeConfirmationEvent(db,session,{...command(),eventId},
   'lineup-season-confirm-'+eventId,now));
 }
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season-admin-day2-0001',now));
 await advance(stageDomesticCalendar(db,session,command(),
  'lineup-season-domestic-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season-admin-day3-0001',now));
 await advance(executeInternationalDraw(db,session,command(),
  'lineup-season-draw-0001',now));
 await advance(publishInternationalCalendarLineupV1(db,session,command(),
  'lineup-season-publish-0001',now));
 expect(world.day).toBe(3);
 let day28Proof:PreparedRewardSettlement|undefined;
 let day28ReceiptHash:string|null=null;
 let payrollProbeClub:string|null=null,payrollEmptyClub:string|null=null;
 const verifyTreasuries=async(plans:readonly RewardPlan[])=>{
  const expected=new Map<string,number>();
  for(const p of plans)for(const row of p.rows)expected.set('club:'+row.clubKey,(expected.get('club:'+row.clubKey)??0)+row.amountArc);
  const rows=(await db.prepare("SELECT id,balance_arc FROM economic_balances WHERE kind='CLUB_TREASURY' ORDER BY id").all()).results as {id:string;balance_arc:number}[];
  expect(rows).toHaveLength(320);
  for(const row of rows)expect(row.balance_arc,row.id).toBe(expected.get(row.id)??0);
  expect(rows.reduce((sum,row)=>sum+row.balance_arc,0)).toBe(plans.reduce((sum,p)=>sum+p.totalArc,0));
 };
 const finishRewards=async(prepared:PreparedRewardSettlement)=>{
  const positive=prepared.manifest.plan.rows.filter(r=>r.amountArc>0).length;
  let result=await executeRewardSettlementBatch(db,session,prepared,now);
  for(let i=0;result.status==='pending'&&i<Math.ceil(positive/REWARD_BATCH_LIMIT);i++)
   result=await executeRewardSettlementBatch(db,session,prepared,now);
  expect(result).toMatchObject({status:'complete',paidArc:prepared.manifest.plan.totalArc,missingKeys:[],
   holdRemainingArc:prepared.manifest.plan.endingHoldArc});
  expect(result.receiptHash).toMatch(/^[a-f0-9]{64}$/);
  const before=await count('economic_transactions');
  expect(await executeRewardSettlementBatch(db,session,prepared,now)).toEqual(result);
  expect(await count('economic_transactions')).toBe(before);
  return result;
 };
 await expect(readRewardSettlementManifest(db,rewardPin)).rejects.toMatchObject({code:'reward_payday_required'});
 expect(await count('season_lineup_day_outcomes')).toBe(3);
 expect(await count('match_lineup_result_receipts')).toBe(0);

 const milestones=await db.prepare(
  "SELECT event_id,status,scheduled_day FROM season_admin_events WHERE scope='season' ORDER BY event_order"
 ).all() as {results:{event_id:string;status:string;scheduled_day:number}[]};
 expect(milestones.results.map(e=>e.event_id)).toEqual([
  'season:archive','season:close','season:next-prepare'
 ]);
 expect(milestones.results.every(e=>e.status==='scheduled'&&e.scheduled_day===56)).toBe(true);

 let lastBatchError='';
 const boundStatements=new WeakMap<object,{sql:string;args:unknown[]}>();
 const guardStart='INSERT INTO world_state(id,generation) SELECT 2,? WHERE NOT EXISTS(';
 const tracedDb={
  prepare:(sql:string)=>{
   const stmt=db.prepare(sql);
   return {
    bind:(...args:unknown[])=>{
     const bound=stmt.bind(...args);
     boundStatements.set(bound,{sql,args});
     return bound;
    },
    first:(...args:any[])=>stmt.first(...args),
    all:(...args:any[])=>stmt.all(...args),
    run:(...args:any[])=>stmt.run(...args)
   };
  },
  batch:async(statements:any[])=>{
   try{return await db.batch(statements)}
   catch(error){
    const failedGuards:{index:number;query:string;params:string[]}[]=[];
    for(let i=0;i<statements.length;i++){
     const item=boundStatements.get(statements[i]);
     if(!item||!item.sql.startsWith(guardStart))continue;
     const query=item.sql.slice(guardStart.length,-1);
     const args=item.args.slice(1);
     try{
      const found=await db.prepare(query).bind(...args).first();
      if(!found)failedGuards.push({index:i,query:query.slice(0,450),
       params:args.map(x=>String(x).slice(0,70))});
     }catch(readError){failedGuards.push({index:i,query:'read failed '+String(readError),
       params:[]})}
    }
    lastBatchError=String(error)+'; failing source guards='+JSON.stringify(failedGuards.slice(0,8));
    throw error;
   }
  }
 } as any;
 for(let day=4;day<=56;day++){
  let result:{world:World};
  try{
   result=await executeLineupLifecycleV1(
    tracedDb,session,'advance',command(),'lineup-season-sport-day-'+day+'-0001',now
   );
  }catch(error){
   // This branch runs only when the real protected writer rejected a day.
   // Independently replay and plan that exact day for actionable diagnostics
   // WITHOUT mutating any persisted receipt or suppressing the failure.
   let diagnostic='planner succeeded, investigate atomic batch/SQL guards';
   try{
    const evidence=await loadSeasonSportingEvidence(db,world);
    const prefix=await replayLineupSeasonV1(db,world,evidence,world.day);
    await planLineupSportingDayV1(db,world,prefix.progression,
     evidence.calendar.calendar_hash,now);
   }catch(sourceError){diagnostic=String(sourceError)}
   throw new Error('V2 full-season day '+day+' failed: '+String(error)+'; '+diagnostic+'; D1 batch='+lastBatchError);
  }
  world=result.world;
  expect(world.day).toBe(day);
  if(day===28){
   const beforeReward=await readWorld(db);
   // Fault injection at the read boundary only: do not change official rows.
   const corruptConfirmationDb={
    prepare:(sql:string)=>{
     const statement=db.prepare(sql);
     if(!sql.includes("event_id IN ('domestic:entrants','international:entrants')"))return statement;
     return {bind:(...args:unknown[])=>({all:async()=>{
      const result=await statement.bind(...args).all();
      return {...result,results:result.results.map((row:any)=>row.event_id==='domestic:entrants'
       ?{...row,receipt_hash:'0'.repeat(64)}:row)};
     }})};
    },
    batch:(statements:any[])=>db.batch(statements)
   } as any;
   await expect(readRewardSettlementManifest(corruptConfirmationDb,rewardPin))
    .rejects.toMatchObject({code:'reward_evidence_invalid'});
   const first=await prepareRewardSettlement(db,rewardPin);
   expect(first.manifest.plan).toMatchObject({day:28,totalArc:676800,endingHoldArc:1723200});
   expect(first.manifest.plan.rows).toHaveLength(304);
   expect(first.manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
   expect(await buildRewardManifest(first.manifest.plan,rewardPin.configVersion)).toEqual(first.manifest);
   expect((await buildRewardManifest(first.manifest.plan,'another-synthetic-version')).manifestHash).not.toBe(first.manifest.manifestHash);
   expect(await readWorld(db)).toEqual(beforeReward);
   expect(await count('economic_transactions')).toBe(1);
   await expect(readRewardSettlementManifest(db,{...rewardPin,rewardVersion:'draft-4'})).rejects.toMatchObject({code:'reward_evidence_invalid'});
   // The real internal command writes only to this disposable local D1.
   // No default production grants, activation, or funding are introduced.
   await expect(db.batch(rewardCalendarCompletionGuards(db,world,28))).rejects.toThrow();
   await expect(prepareRewardPayrollGuards(db,world,28)).rejects.toMatchObject({code:'reward_calendar_pending'});
   await expect(settleClubPayrollBatch(db,session,first.manifest.plan.rows[0].clubKey,now)).rejects.toMatchObject({code:'reward_calendar_pending'});
   expect(await count('payroll_runs')).toBe(0);
   await expect(executeLineupLifecycleV1(db,session,'advance',command(),'reward-blocked-advance-0001',now)).rejects.toMatchObject({status:409});
   // Fault in second INSERT rolls back the entire chunk.
   const faultKey=first.manifest.plan.rows.filter(r=>r.amountArc>0)[1].businessKey;
   if(!/^[a-zA-Z0-9:-]+$/.test(faultKey))throw Error('Invalid fixture key');
   await db.prepare("CREATE TRIGGER fail_reward_chunk BEFORE INSERT ON economic_transactions WHEN NEW.business_key='"+faultKey+"' BEGIN SELECT RAISE(ABORT,'fixture reward fault'); END").run();
   try{await expect(executeRewardSettlementBatch(db,session,first,now)).rejects.toThrow();}
   finally{await db.prepare('DROP TRIGGER fail_reward_chunk').run()}
   expect(await count('economic_transactions')).toBe(1);
   expect((await db.prepare('SELECT remaining_arc FROM economic_open_holds WHERE id=?').bind(holdId).first()).remaining_arc).toBe(2400000);
   const paid=await executeRewardSettlementBatch(db,session,first,now);
   expect(paid.status).toBe('pending');
   expect(paid.receiptHash).toBeNull();
   expect(paid.missingKeys).toHaveLength(304-REWARD_BATCH_LIMIT);
   expect(paid.paidArc).toBeGreaterThan(0);
   const beforeDenied=await count('economic_transactions');
   await db.prepare("DELETE FROM economic_finance_permissions WHERE account_id=? AND capability='post'").bind(session.unified!.playerId).run();
   await expect(executeRewardSettlementBatch(db,session,first,now)).rejects.toThrow();
   expect(await count('economic_transactions')).toBe(beforeDenied);
   await db.prepare("INSERT INTO economic_finance_permissions VALUES(?,'post','fixture',?)").bind(session.unified!.playerId,now).run();
   const races=await Promise.allSettled([executeRewardSettlementBatch(db,session,first,now),executeRewardSettlementBatch(db,session,first,now)]);
   expect(races.some(r=>r.status==='fulfilled')).toBe(true);
   const finished=await finishRewards(first);
   day28Proof=first;
   day28ReceiptHash=finished.receiptHash;
   await executeRewardSettlementBatch(db,session,first,now,true);
   world=await readWorld(db);
   await db.batch(await prepareRewardPayrollGuards(db,world,28));
   // #778 consumer contract: use the actual ledger with the reconstructed
   // completion proof in the same transaction. Deliberately abort the fixture
   // posting after its guards, so the full reward-only balances remain intact.
   const guardedPayroll=await prepareRewardPayrollGuards(db,world,28);
   const beforeProbe=await count('economic_transactions');
   const probeClub=first.manifest.plan.rows[0].clubKey;
   await expect(postEconomicOperation(db,{businessKey:'fixture-payroll-probe',requestKey:'fixture-payroll-probe',purpose:'PAYROLL_AI',actorKind:'system',actorId:'fixture',configVersion:rewardPin.configVersion,sourceId:'fixture-payroll-probe',generation:world.generation,season:world.seasonNumber,day:28,lines:[{accountId:'club:'+probeClub,amountArc:-1},{accountId:'reserve',amountArc:1}]},{access:localAccess(),preconditions:guardedPayroll,effects:[economicAssert(db,'SELECT 1 WHERE 0')]},now)).rejects.toThrow();
   expect(await count('economic_transactions')).toBe(beforeProbe);
   expect(await db.prepare("SELECT status,receipt_hash FROM season_admin_events WHERE season_number=1 AND event_id='rewards:28'").first()).toEqual({status:'completed',receipt_hash:day28ReceiptHash});
   expect(await count('economic_transactions')).toBe(305);
   await verifyTreasuries([first.manifest.plan]);
   payrollProbeClub=probeClub;
   const emptyPayroll=await settleClubPayrollBatch(db,session,probeClub,now);
   expect(emptyPayroll).toMatchObject({status:'complete',dueArc:0,paidArc:0,arrearsArc:0});
   expect(await settleClubPayrollBatch(db,session,probeClub,now)).toEqual(emptyPayroll);
   const zeroClub=await db.prepare("SELECT owner_id FROM economic_available_balances WHERE kind='CLUB_TREASURY' AND available_arc=0 ORDER BY owner_id LIMIT 1").first();
   if(!zeroClub)throw Error('Missing zero-liquidity fixture club');
   payrollEmptyClub=String(zeroClub.owner_id);
   expect(await settleClubPayrollBatch(db,session,payrollEmptyClub,now)).toMatchObject({status:'complete',dueArc:0,paidArc:0});
   expect(await reconcilePayrollPayday(db,session,now)).toMatchObject({status:'pending',clubsComplete:2,dueArc:null});
   expect(await count('economic_transactions')).toBe(305);
   expect(await reconcileEconomy(db,localAccess())).toMatchObject({ok:true,stockArc:'2400000',netIssuedArc:'2400000'});
  }
  if(day===29){
   if(!day28Proof)throw Error('Missing Day28 fixture proof');
   await expect(executeRewardSettlementBatch(db,session,day28Proof,now)).rejects.toThrow();
   expect(await count('economic_transactions')).toBe(305);
  }
  if([12,13,30,43,55,56].includes(day)){
   const receiptCount=await count('match_lineup_result_receipts');
   expect(receiptCount).toBeGreaterThanOrEqual(day===13?128:0);
   expect(await count('season_lineup_day_outcomes')).toBe(day);
  }
 }
 expect(world.phase).toBe('active');
 expect(await count('season_lineup_day_outcomes')).toBe(56);
 expect(await count('match_lineup_result_receipts')).toBe(4082);
 expect(await count('season_knockout_ties')).toBe(54);
 expect(await count('season_day_outcomes')).toBe(0);

 const proof=await verifyLineupSeasonArchiveV1(db,world);
 expect(proof.history.resultCount).toBe(4082);
 expect(proof.history.progression.results.size).toBe(4082);
 expect(proof.history.progression.ties.size).toBe(54);
 expect(proof.summaryHash).toMatch(/^[a-f0-9]{64}$/);
 // Exercise the actual Day56 server entrypoint, independently comparing its
 // evidence digest and allocations against the archive proof used below.
 const beforeFinalReward=await readWorld(db);
 const certifiedFinal=await prepareRewardSettlement(db,rewardPin);
 const confirmationRows=(await db.prepare(
  "SELECT scope,receipt_hash FROM season_admin_events WHERE season_number=? AND event_id IN ('domestic:entrants','international:entrants') ORDER BY event_id"
 ).bind(world.seasonNumber).all()).results as {scope:string;receipt_hash:string}[];
 const expectedEvidenceHash=await canonicalHash({
  schemaVersion:1,generation:world.generation,season:world.seasonNumber,day:56,
  participantsHash:proof.evidence.snapshot.participantsHash,rulesHash:proof.evidence.snapshot.rulesHash,
  calendarHash:proof.evidence.calendar.calendar_hash,
  entrantReceipts:confirmationRows.map(row=>({scope:row.scope,receiptHash:row.receipt_hash})),
  dayHashes:proof.history.days.map(day=>day.hash),resultCount:proof.history.resultCount,
  archiveHash:proof.archiveHash
 });
 expect(certifiedFinal.worldRevision).toBe(world.revision);
 expect(certifiedFinal.manifest.plan.evidenceHash).toBe(expectedEvidenceHash);
 expect(await readWorld(db)).toEqual(beforeFinalReward);
 const finalProjection=await projectFinalRewardEvidence(proof);
 const finalPlan=planRewardSettlement({generation:world.generation,season:world.seasonNumber,day:56,
  rewardVersion:rewardPin.rewardVersion,evidenceHash:expectedEvidenceHash,competitions:finalProjection});
 const finalManifest=await buildRewardManifest(finalPlan,rewardPin.configVersion);
 expect(certifiedFinal.manifest).toEqual(finalManifest);
 expect(finalManifest.plan).toMatchObject({totalArc:1723200,startingHoldArc:1723200,endingHoldArc:0});
 expect(finalManifest.plan.rows).toHaveLength(912);
 expect(finalProjection.filter(c=>c.competitionId.startsWith('int-')).every(c=>c.outcomes?.length===24)).toBe(true);
 if(!day28Proof)throw Error('Missing Day28 fixture proof');
 expect(certifiedFinal.previousManifest).toEqual(day28Proof.manifest);
 await expect(archiveSeasonLineupV1(db,session,command(),'reward-blocked-archive-0001',now)).rejects.toMatchObject({status:409});
 await expect(db.batch(rewardCalendarCompletionGuards(db,world,56))).rejects.toThrow();
 const finalResult=await finishRewards(certifiedFinal);
 expect(finalResult.receiptHash).not.toBe(day28ReceiptHash);
 const finalCount=finalPlan.rows.filter(r=>r.amountArc>0).length;
 expect(await count('economic_transactions')).toBe(305+finalCount);
 expect(await count('economic_hold_releases')).toBe(304+finalCount);
 await verifyTreasuries([day28Proof.manifest.plan,finalPlan]);
 const reserve=await db.prepare("SELECT balance_arc,reserved_arc,available_arc FROM economic_available_balances WHERE id='reserve'").first();
 expect(reserve).toMatchObject({balance_arc:0,reserved_arc:0,available_arc:0});
 expect(await reconcileEconomy(db,localAccess())).toMatchObject({ok:true,stockArc:'2400000',netIssuedArc:'2400000',
  invalidTransactions:0,invalidBalances:0,invalidHolds:0});
 expect(await readWorld(db)).toEqual(beforeFinalReward);
 await executeRewardSettlementBatch(db,session,certifiedFinal,now,true);
 world=await readWorld(db);
 await db.batch(await prepareRewardPayrollGuards(db,world,56));
 expect(await db.prepare("SELECT status,receipt_hash FROM season_admin_events WHERE season_number=1 AND event_id='rewards:56'").first()).toEqual({status:'completed',receipt_hash:finalResult.receiptHash});
 // #778: synthetic signed history inserted only in this disposable fixture,
 // after the official match evidence is frozen. No production signing/backdating.
 if(!payrollProbeClub||!payrollEmptyClub)throw Error('Missing payroll probe club');
 const fixtureBatch=crypto.randomUUID(),agent=session.unified!.playerId;
 await provisionWallet(db,agent,now,localAccess());
 await db.prepare("INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,1,?,'{}','[]',2,'payroll-fixture','committed',?,?,?)").bind(fixtureBatch,world.generation,agent,now,now+3600,now).run();
 await db.prepare("INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES(1,?,?,1,?,?)").bind(fixtureBatch,world.generation,JSON.stringify({id:1,first_name:'Fixture',last_name:'Payroll',nationality:'ITA',age:22,career_status:'active'}),now).run();
 await seedSignedTestTerm(db,world.generation,1,payrollProbeClub,28,now,'payroll-local-fixture');
 await db.prepare("INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at) VALUES(2,?,?,1,?,?)").bind(fixtureBatch,world.generation,JSON.stringify({id:2,first_name:'Fixture',last_name:'Arrears',nationality:'ITA',age:22,career_status:'active'}),now).run();
 await seedSignedTestTerm(db,world.generation,2,payrollEmptyClub,28,now,'payroll-local-arrears');
 await db.prepare("INSERT INTO player_agent_mandates(player_id,world_generation,account_id,start_tick,acquired_at_ms,acquisition_key) VALUES(1,?,?,42,?,'payroll-local-mandate')").bind(world.generation,agent,now*1000).run();
 await db.prepare("UPDATE player_signed_contracts SET closed_tick=56,close_reason='expiry' WHERE player_id IN (1,2)").run();
 const balanceBeforePayroll=await db.prepare("SELECT balance_arc FROM economic_balances WHERE id=?").bind('club:'+payrollProbeClub).first();
 const beforePayroll=await count('economic_transactions');
 await db.prepare("CREATE TRIGGER fail_payroll_fixture BEFORE INSERT ON payroll_payment_receipts BEGIN SELECT RAISE(ABORT,'fixture payroll rollback'); END").run();
 try{await expect(settleClubPayrollBatch(db,session,payrollProbeClub,now)).rejects.toThrow()}
 finally{await db.prepare('DROP TRIGGER fail_payroll_fixture').run()}
 expect(await count('economic_transactions')).toBe(beforePayroll);
 expect(await count('payroll_payment_receipts')).toBe(0);
 const payroll=await settleClubPayrollBatch(db,session,payrollProbeClub,now);
 expect(payroll).toMatchObject({status:'complete',dueArc:62,paidArc:62,arrearsArc:0,outstandingArc:0});
 expect(await settleClubPayrollBatch(db,session,payrollProbeClub,now)).toEqual(payroll);
 expect(await count('economic_transactions')).toBe(beforePayroll+2);
 expect(await count('payroll_payment_receipts')).toBe(2);
 const unpaid=await settleClubPayrollBatch(db,session,payrollEmptyClub,now);
 expect(unpaid).toMatchObject({status:'complete',dueArc:62,paidArc:0,arrearsArc:62,outstandingArc:62});
 expect(await count('economic_transactions')).toBe(beforePayroll+2);
 expect(await reconcilePayrollPayday(db,session,now)).toMatchObject({status:'pending',clubsComplete:2,dueArc:null,recordedDueArc:124,paidArc:62,arrearsArc:62,pendingArc:0});
 expect(await db.prepare("SELECT balance_arc FROM economic_balances WHERE id=?").bind('club:'+payrollProbeClub).first()).toEqual({balance_arc:Number(balanceBeforePayroll!.balance_arc)-62});
 expect(await db.prepare("SELECT balance_arc FROM economic_balances WHERE id='reserve'").first()).toEqual({balance_arc:31});
 expect(await db.prepare("SELECT balance_arc FROM economic_balances WHERE id=?").bind('user:'+agent).first()).toEqual({balance_arc:31});
 expect(await reconcileEconomy(db,localAccess())).toMatchObject({ok:true,stockArc:'2400000',netIssuedArc:'2400000'});
 const sourceSummary=JSON.parse(proof.summaryJson);
 expect(sourceSummary.sourceSeason).toBe(1);
 expect(sourceSummary.divisions).toHaveLength(16);
 expect(sourceSummary.cupWinners).toHaveLength(2);
 expect(sourceSummary.statisticsAvailability).toBe('frozen-player-receipts-v1');
 expect(sourceSummary.playerStatistics).toEqual([]); // all clubs use team fallback

 // Closing cannot skip the independent archive milestone.
 await expect(closeSeasonLineupV1(db,session,command(),
  'lineup-season-too-early-close-0001',now)).rejects.toMatchObject({status:409});
 expect(await count('season_archives')).toBe(0);
 const before=world,archiveCommand=command();
 await db.prepare(
  "CREATE TRIGGER fail_v2_archive_late BEFORE INSERT ON admin_operations WHEN NEW.command='archive-season-v2' BEGIN SELECT RAISE(ABORT,'archive fault'); END"
 ).run();
 try{
  await expect(archiveSeasonLineupV1(db,session,archiveCommand,
   'lineup-season-archive-0001',now)).rejects.toMatchObject({status:503});
 }finally{await db.prepare('DROP TRIGGER fail_v2_archive_late').run()}
 expect(await readWorld(db)).toEqual(before);
 expect(await count('season_archives')).toBe(0);
 expect(await count('season_archive_summaries')).toBe(0);

 const archived=await archiveSeasonLineupV1(db,session,archiveCommand,
  'lineup-season-archive-0001',now);
 world=archived.world;
 expect(world.day).toBe(56);
 expect(world.phase).toBe('active');
 expect(await archiveSeasonLineupV1(db,session,archiveCommand,
  'lineup-season-archive-0001',now)).toEqual(archived);
 expect(await count('season_archives')).toBe(1);
 expect(await count('season_archive_summaries')).toBe(1);
 await expect(readClosedSeasonHistory(db,1)).rejects.toMatchObject({status:409});
 const archivedRow=await db.prepare(
  'SELECT archive_hash,results_count,days_count,ties_count FROM season_archives WHERE season_number=1'
 ).first() as {archive_hash:string;results_count:number;days_count:number;ties_count:number}|null;
 expect(archivedRow).toMatchObject({
  archive_hash:proof.archiveHash,results_count:4082,days_count:56,ties_count:54
 });
 const closeCommand=command();
 const closed=await closeSeasonLineupV1(db,session,closeCommand,
  'lineup-season-close-0001',now);
 world=closed.world;
 expect(world.phase).toBe('closed');
 expect(world.day).toBe(56);
 await expect(readRewardSettlementManifest(db,rewardPin)).rejects.toMatchObject({code:'reward_payday_required'});
 expect(await closeSeasonLineupV1(db,session,closeCommand,
  'lineup-season-close-0001',now)).toEqual(closed);
 const history=await readClosedSeasonHistory(db,1);
 expect(history.archiveHash).toBe(proof.archiveHash);
 expect(history.summary).toEqual(sourceSummary);
 const sport=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(sport.status).toBe('available');
 expect(sport.data.fixtures.every((fixture:any)=>fixture.result!==null)).toBe(true);
 expect(sport.data.fixtures).toHaveLength(242); // 240 league + 2 Tier-1 playout legs
 expect(sport.data.statistics.matchesPlayed).toBe(242);
 expect(sport.data.statistics.players,'fallback-only archive has no attributed players').toEqual([]);
 expect(sport.data.history.statistics).toEqual(sport.data.statistics);
 expect(await count('season_day_outcomes')).toBe(0);
 expect(await count('match_lineup_result_receipts')).toBe(4082);
 // V2 cutover includes the qualification authority feeding the *next* season.
 // The Season 2 candidate MUST be derived from frozen results, never rescore
 // the previous season with temporary-score-v1.
 const candidate=await readSeasonTwoCandidate(db);
 expect(candidate.sourceArchiveHash).toBe(proof.archiveHash);
 expect(candidate.snapshot.season).toBe(2);
 expect(candidate.snapshot.readyForActivation).toBe(false);
 const approved=await approveSeasonTwoSnapshot(db,session,{
  ...command(),snapshotHash:candidate.snapshot.snapshotHash
 },'lineup-season2-approval-0001',now);
 world=approved.world;
 const prepared=await prepareSeasonTwo(db,session,command(),
  'lineup-season2-prepare-0001',now);
 world=prepared.world;
 expect(world).toMatchObject({seasonNumber:2,day:0,phase:'preparing'});
 const finals=await readMatchDirectory(db,1,54);
 expect(finals.publication).toBe('published');
 expect(finals.fixtures).toContainEqual(expect.objectContaining({competitionId:'int-1',phaseId:'final',status:'completed'}));
 const historical=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(historical.data.statistics.matchesPlayed).toBe(242);
 expect(await count('season_day_outcomes')).toBe(0);
 expect(await count('season_lineup_day_outcomes')).toBe(56);
 // After owner approval and Season 2 preparation, the same replacement V2
 // commands must publish and finalize real Season 2 matches. No Season 1
 // re-simulation or history mutation is permitted during this transition.
 await advance(initializeAdministrativeEvents(db,session,command(),
  'lineup-season2-events-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'start',command(),
  'lineup-season2-admin-start-0001',now));
 for(const eventId of ['domestic:entrants','international:entrants']){
  await advance(completeConfirmationEvent(db,session,{...command(),eventId},
   'lineup-season2-confirm-'+eventId,now));
 }
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season2-admin-day2-0001',now));
 await advance(stageDomesticCalendar(db,session,command(),
  'lineup-season2-domestic-0001',now));
 await advance(advanceAdministrativeClockLineupV1(db,session,'advance',command(),
  'lineup-season2-admin-day3-0001',now));
 await advance(executeInternationalDraw(db,session,command(),
  'lineup-season2-draw-0001',now));
 await advance(publishInternationalCalendarLineupV1(db,session,command(),
  'lineup-season2-publish-0001',now));
 expect(world).toMatchObject({seasonNumber:2,phase:'active',day:3});
 for(let day=4;day<=13;day++){
  world=(await executeLineupLifecycleV1(db,session,'advance',command(),
   'lineup-season2-sport-day-'+day+'-0001',now)).world;
  expect(world.day).toBe(day);
 }
 const seasonTwo=await readPublicSportingSeasonLineupV1(db,'IT-1',2) as any;
 expect(seasonTwo.data.statistics.matchesPlayed).toBe(8);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM season_lineup_day_outcomes WHERE season_number=2')
  .first() as {n:number}).n).toBe(13);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE season_number=2')
  .first() as {n:number}).n).toBe(128);
 const oldSeason=await readPublicSportingSeasonLineupV1(db,'IT-1',1) as any;
 expect(oldSeason.data.statistics.matchesPlayed).toBe(242);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE season_number=1')
  .first() as {n:number}).n).toBe(4082);
},600000);
