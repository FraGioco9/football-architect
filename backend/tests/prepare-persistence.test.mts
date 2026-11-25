import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openLocalDatabase} from '../tools/operator-local.mts';
import {prepareSeason} from '../src/commands.ts';
import {resetWorld} from '../src/reset-world-command.ts';
import {captureRetainedOpeningEvidence,verifyRetainedOpeningEvidence,rebaseLocalRetainedPlayers} from '../src/opening-world-retained.ts';
import {readWorld} from '../src/world-repository.ts';
import * as snapshots from '../src/catalogue-snapshot.ts';
import {syntheticApproval} from './fixtures/synthetic-approval.ts';
test('committed prepare and idempotency outcome survive local D1 close and reopen',async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-prepare-persist-')),now=Math.floor(Date.now()/1000);
 const session={actor:{id:'fixture',email:'fixture@example.invalid'},digest:'c'.repeat(64),credentialVersion:1,csrfDigest:'d'.repeat(64),unified:{playerId:'fixture-player',sessionDigest:'c'.repeat(64),csrfDigest:'d'.repeat(64)}};
 let handle=await openLocalDatabase(state);
 try{
  await handle.db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now).run();
  await handle.db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind('fixture-player',session.actor.email,'synthetic',1,now,'active',now,now).run();
  await handle.db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind('fixture-player',session.actor.id,now).run();
  await handle.db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(session.digest,'fixture-player',1,session.csrfDigest,now,now,now+1000).run();
  await handle.db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>handle.db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind('fixture-player',permission,now)));
  const youth=await previewPlayerGeneration(handle.db,session,{options:{count:1,seed:'retained-reset-fixture',age:18,primaryNationality:'ITA',primaryPosition:'ST'}},now);
  await commitPlayerGeneration(handle.db,session,{draftId:youth.draftId,confirmation:'GENERATE PLAYERS'},now);
  const world=await readWorld(handle.db),command={expectedGeneration:world.generation,expectedRevision:0};
  const result=await prepareSeason(handle.db,session,command,'synthetic-persistence-01',await syntheticApproval(snapshots),now);
  await handle.close();handle=await openLocalDatabase(state);
  assert.deepEqual(await readWorld(handle.db),result.world);
  assert.deepEqual(await prepareSeason(handle.db,session,command,'synthetic-persistence-01',await syntheticApproval(snapshots),now),result);
  assert.equal((await handle.db.prepare('SELECT COUNT(*) AS n FROM admin_operations').first<{n:number}>())!.n,1);
  const evidence=await captureRetainedOpeningEvidence(handle.db);
  assert.equal(evidence.players.length,1);
  assert.equal(evidence.players[0].originalGeneration,world.generation);
  assert.deepEqual(await captureRetainedOpeningEvidence(handle.db),evidence);
  await assert.rejects(verifyRetainedOpeningEvidence(handle.db,evidence,'not-reset'),/fresh reset world/);
  const reset=await resetWorld(handle.db,session,{expectedGeneration:result.world.generation,expectedRevision:result.world.revision,confirmation:'RESET SEASON 0'},'retained-reset-fixture',now);
  await handle.close();handle=await openLocalDatabase(state);
  await assert.rejects(verifyRetainedOpeningEvidence(handle.db,{...evidence,idHighWater:evidence.idHighWater+1},reset.operationId),/digest/);
  await assert.rejects(verifyRetainedOpeningEvidence(handle.db,evidence,'not-reset'),/audit mismatch/);
  const preserved=await verifyRetainedOpeningEvidence(handle.db,evidence,reset.operationId);
  assert.equal(preserved.preservedPlayers,1);
  assert.equal(preserved.eligibleForAutomaticReuse,false);
  assert.equal(preserved.worldGeneration,reset.world.generation);
  const after=await readOpeningObservation(handle.db);
  assert.deepEqual(after.rows,[{id:evidence.players[0].id,fingerprint:evidence.players[0].fingerprint}]);
  assert.equal(after.rawRows[0].world_generation,evidence.players[0].originalGeneration);
  // Existing strict automatic-reuse policy must remain closed until reviewed integration.
  assert.equal((await readLocalOpeningInventory(handle.db)).players[0].readyForReuse,false);
  await assert.rejects(readLocalOpeningInventory(handle.db,{evidence,resetOperationId:reset.operationId}),/metadata must be rebased/);
  const rebased=await rebaseLocalRetainedPlayers(handle.db,session,evidence,reset.operationId,now);
  assert.equal(rebased.metadataRebased,true);
  assert.equal(rebased.alreadyRebased,false);
  assert.equal((await rebaseLocalRetainedPlayers(handle.db,session,evidence,reset.operationId,now)).alreadyRebased,true);
  const reviewed=await readLocalOpeningInventory(handle.db,{evidence,resetOperationId:reset.operationId});
  assert.equal(reviewed.players[0].readyForReuse,true);
  assert.equal(reviewed.players[0].hasSportingHistory,false);
  const changed=await readOpeningObservation(handle.db);
  assert.equal(changed.rawRows[0].world_generation,reset.world.generation);
  assert.deepEqual({...changed.rawRows[0],world_generation:after.rawRows[0].world_generation,entry_season:after.rawRows[0].entry_season},after.rawRows[0]);
  await assert.rejects(readLocalOpeningInventory(handle.db,{evidence,resetOperationId:'wrong'}),/audit mismatch/);
 }finally{await handle.close();await rm(state,{recursive:true,force:true})}
});

import {openLocalOpeningRehearsal,buildLocalOpeningManifest} from '../tools/opening-world-local.mts';
import {previewPlayerGeneration,commitPlayerGeneration} from '../src/players-generation-command.ts';
import {readOpeningObservation} from '../src/opening-world-store.ts';
import {readLocalOpeningInventory} from '../src/opening-world-inventory.ts';
import {fundOpeningFixture,prepareOpeningFundingFixture} from './fixtures/opening-funding.ts';
import {seedUnifiedOperator} from './fixtures/unified-operator.ts';
import {changeClubLicense} from '../src/club-licenses.ts';
import {stepEconomicGenesis,completeEconomicGenesis,readEconomicGenesis} from '../src/economic-genesis.ts';
import {economicAssert,reconcileEconomy,financeSessionGuard} from '../src/economic-ledger.ts';
import {signStagedOpeningContract,signInitialAiContract,readOpeningSalaryAuthority} from '../src/player-club-contracts.ts';
import {preparePayrollAffordability} from '../src/payroll-affordability.ts';
import {readPublicPlayers} from '../src/public-players-read.ts';
import {readPublicClubRoster} from '../src/public-club-roster-read.ts';
import {loadApprovedSnapshot,serverCanonicalCatalogue} from '../src/approved-season-one.ts';
import type {Database} from '../src/database.ts';
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
import {earmarkNextRewardBudget} from '../src/economic-genesis.ts';
import {rewardCalendarBudget} from '../src/reward-settlement-plan.mjs';
import {prepareRewardSettlement} from '../src/reward-settlement-evidence.ts';
import {executeRewardSettlementBatch} from '../src/reward-settlement-command.ts';
import {settleNextPayrollBatch,reconcilePayrollPayday} from '../src/payroll-settlement-command.ts';
import {readAdminEconomyReconciliation,readAdminEconomySummary} from '../src/admin-inspection.ts';
import {marketValueIndexReadiness,marketValueIndexVersion,marketValueIndexUpdate,refreshMarketValueIndexBatch} from '../src/player-market-value-index.ts';
import type {AdminSession} from '../src/auth.ts';

test('opening world local plan and receipts survive close/reopen without rematching existing youth', {timeout:180000},async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-opening-persist-')),now=Math.floor(Date.now()/1000);
 const session={actor:{id:'opening-restart-fixture',email:'opening-restart@example.invalid'},digest:'c'.repeat(64),credentialVersion:1,csrfDigest:'d'.repeat(64),unified:{playerId:'opening-restart-player',sessionDigest:'c'.repeat(64),csrfDigest:'d'.repeat(64)}};
 let setup:Awaited<ReturnType<typeof openLocalDatabase>>|undefined,run:Awaited<ReturnType<typeof openLocalOpeningRehearsal>>|undefined;
 try{
  setup=await openLocalDatabase(state);
  const db=setup.db;
  await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(session.actor.id,session.actor.email,'synthetic',now).run();
  await db.prepare('INSERT INTO player_accounts(id,email_normalized,password_verifier,credential_version,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(session.unified.playerId,session.actor.email,'synthetic',1,now,'active',now,now).run();
  await db.prepare('INSERT INTO player_admin_operator_links(player_account_id,legacy_admin_account_id,linked_at) VALUES(?,?,?)').bind(session.unified.playerId,session.actor.id,now).run();
  await db.prepare('INSERT INTO player_sessions(token_digest,account_id,credential_version,csrf_digest,created_at,last_seen_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(session.digest,session.unified.playerId,1,session.csrfDigest,now,now,now+1000).run();
  await db.batch(['admin.access','admin.world.read','admin.world.write'].map(permission=>db.prepare('INSERT INTO account_permissions(account_id,permission,granted_at) VALUES(?,?,?)').bind(session.unified.playerId,permission,now)));
  const seed='local-restart-fixture',world=await readWorld(db),manifest=await buildLocalOpeningManifest(world,seed);
  assert.equal(manifest.clubs.length,320);assert.equal(manifest.clubs.filter(c=>c.active).length,256);assert.equal(manifest.slots.length,6400);
  const slot=manifest.slots.find(s=>['ITA','GER','ENG'].includes(s.primaryNationality)&&s.age<=19)!;assert.ok(slot);
  const preview=await previewPlayerGeneration(db,session,{options:{count:1,seed:'existing-youth-fixture',age:slot.age,primaryNationality:slot.primaryNationality,primaryPosition:slot.primaryPosition}},now);
  await commitPlayerGeneration(db,session,{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'},now);
  const before=await readOpeningObservation(db);
  assert.equal(before.rows.length,1);
  await fundOpeningFixture(db,now);
  await setup.close();setup=undefined;
  run=await openLocalOpeningRehearsal(state);
  const plan=await run.prepare(seed);assert.equal(plan.reused,1);assert.equal(plan.newPlayers,6399);assert.equal(plan.batches,256);
  await assert.rejects(run.prepare(seed),/EEXIST/);
  // Crash/reopen after private plan creation, before the root transaction.
  await run.close();run=undefined;
  run=await openLocalOpeningRehearsal(state);
  const started=await run.start(session,now);assert.equal(started.completedSlots,0);
  assert.deepEqual(await run.start(session,now),started);
  await assert.rejects(run.start(session,now+1001));
  await assert.rejects(run.reconcile(),/opening population incomplete/);
  await assert.rejects(run.signNextClub(session,now),/opening population incomplete/);
  await assert.rejects(run.publish(session,now),/opening population incomplete/);
  const first=await run.step(session,now);assert.equal(first.completedSlots,25);
  await run.close();run=undefined;
  run=await openLocalOpeningRehearsal(state);
  assert.deepEqual(await run.inspect(),first);
  // Lost response/replayed start after a durable batch must not recreate the root,
  // recertify a changed catalogue, allocate IDs, or bypass live authorization.
  await assert.rejects(run.start(session,now+1001));
  assert.deepEqual(await run.start(session,now),first);
  assert.deepEqual(await run.inspect(),first);
  const second=await run.step(session,now);assert.equal(second.completedSlots,50);
  assert.equal(second.committedBatches,2);assert.equal(second.readyForReconciliation,false);
  await assert.rejects(run.reconcile(),/opening population incomplete/);
  await run.close();run=undefined;
  setup=await openLocalDatabase(state,{requireExisting:true,migrate:false});
  const after=await readOpeningObservation(setup.db);
  assert.deepEqual(after.rows.find(row=>row.id===before.rows[0].id),before.rows[0]);
  assert.equal(after.world.seasonNumber,0);
  assert.equal((await setup.db.prepare('SELECT COUNT(*) AS n FROM opening_world_runs').first<{n:number}>())!.n,3);
  await assert.rejects(setup.db.prepare('INSERT INTO player_agent_mandates(player_id,world_generation,account_id,start_tick,acquired_at_ms,acquisition_key) VALUES(?,?,?,?,?,?)').bind(before.rows[0].id,world.generation,session.unified.playerId,0,now*1000,'fixture-locked-mandate').run(),/opening world staging lock/);
  await setup.close();setup=undefined;
  // Original input is required on reopen; a different seed must fail closed.
  const path=join(state,'opening-world-plan.private.json'),saved=JSON.parse(await readFile(path,'utf8'));
  await writeFile(path,JSON.stringify({...saved,seed:'tampered'}));
  run=await openLocalOpeningRehearsal(state);
  await assert.rejects(run.inspect(),/opening plan or canonical source changed|unallocated existing player/);
 }finally{try{if(run)await run.close();if(setup)await setup.close()}finally{await rm(state,{recursive:true,force:true})}}
});

/** Complete end-to-end rehearsal on disposable persisted local D1. No copied
 * DEV identities or images, no direct player/contract inserts in the opening,
 * no remote binding, no synthetic shortcut for the 6,400 actual signatures. */
test('opening world end-to-end: audited 150 + 6250, all 320 treasuries, 6400 terms, restart and publication',{timeout:45*60*1000},async()=>{
 const state=await mkdtemp(join(tmpdir(),'fa-opening-full-')),now=Math.floor(Date.now()/1000);
 let handle:Awaited<ReturnType<typeof openLocalDatabase>>|undefined,runner:Awaited<ReturnType<typeof openLocalOpeningRehearsal>>|undefined;
 const n=async(db:Database,sql:string)=>(await db.prepare(sql).first<{n:number}>())!.n;
 const open=()=>openLocalDatabase(state,{requireExisting:true,migrate:false});
 try{
  handle=await openLocalDatabase(state);
  let db=handle.db;
  const {session,playerId}=await seedUnifiedOperator(db,'opening-full-fixture','opening-full@example.invalid',now,'f'.repeat(64));
  const legacy=await readWorld(db);
  const historical=await prepareSeason(db,session,{expectedGeneration:legacy.generation,expectedRevision:legacy.revision},'opening-full-old-season',await syntheticApproval(snapshots),now);
  // Actual old-world generation, exactly the previously observed national and
  // age marginal totals. Roles are spread over the canonical roster capacities.
  const groups=[['ITA',[13,20,12,5]],['GER',[13,20,11,6]],['ENG',[13,19,12,6]]] as const;
  const positions=['GK','CB','CM','ST'] as const;
  for(const [nationality,counts] of groups)for(let i=0;i<counts.length;i++){
   const preview=await previewPlayerGeneration(db,session,{options:{count:counts[i],seed:'opening-existing-'+nationality+'-'+i,age:16+i,primaryNationality:nationality,primaryPosition:positions[i]}},now);
   await commitPlayerGeneration(db,session,{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'},now);
  }
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM generated_players'),150);
  // Exercise a historical ID gap like DEV's high-water 193. Fixture only.
  await db.prepare("UPDATE sqlite_sequence SET seq=193 WHERE name='generated_players'").run();
  // Synthetic approved portrait metadata only, not a real asset. Retain exact
  // approved/pending rows; no image upload or file copying.
  await db.prepare("UPDATE player_portrait_profiles SET status='approved',asset_key='synthetic/retained/'||player_id||'.webp' WHERE player_id<=26").run();
  assert.equal(await n(db,"SELECT COUNT(*) AS n FROM player_portrait_profiles WHERE status='approved'"),26);
  await changeClubLicense(db,session,{clubKey:'IT-1',accountId:playerId,expectedAccountId:null,expectedVersion:0},now);
  const old=await readOpeningObservation(db),evidence=await captureRetainedOpeningEvidence(db);
  assert.equal(old.rows.length,150);assert.equal(old.idHighWater,193);
  assert.equal(evidence.players.length,150);
  assert.equal(evidence.history.counts?.seasons,1);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM player_signed_contracts'),0);
  await changeClubLicense(db,session,{clubKey:'IT-1',accountId:null,expectedAccountId:playerId,expectedVersion:1},now);
  const reset=await resetWorld(db,session,{expectedGeneration:historical.world.generation,expectedRevision:historical.world.revision,confirmation:'RESET SEASON 0'},'opening-full-reset-fixture',now);
  const retained={evidence,resetOperationId:reset.operationId};
  await handle.close();handle=await open();db=handle.db;
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM seasons'),0);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM match_lineup_result_receipts'),0);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM season_archives'),0);
  assert.equal((await rebaseLocalRetainedPlayers(db,session,evidence,reset.operationId,now)).metadataRebased,true);
  assert.equal((await rebaseLocalRetainedPlayers(db,session,evidence,reset.operationId,now)).alreadyRebased,true);
  const rebased=await readOpeningObservation(db);
  assert.equal(rebased.idHighWater,old.idHighWater);
  assert.deepEqual(rebased.rawRows,old.rawRows.map(row=>({...row,world_generation:reset.world.generation,entry_season:0})));
  await handle.close();handle=undefined;
  runner=await openLocalOpeningRehearsal(state);
  const plan=await runner.prepare('opening-full-rehearsal',retained);
  assert.deepEqual({slots:plan.slots,reused:plan.reused,newPlayers:plan.newPlayers,batches:plan.batches},{slots:6400,reused:150,newPlayers:6250,batches:256});
  await assert.rejects(runner.start(session,now));
  await runner.close();runner=undefined;

  // Actual #802: restart during the first funding installment, then complete
  // remaining idempotent ledger postings and canonical annual Rewards hold.
  handle=await open();db=handle.db;
  // The reset is complete and retained identities have been rebased. Finance
  // authority is deliberately separate from the world operator's permissions.
  // Exercise the actual denial and grant before expensive opening generation.
  const finance=()=>['read','post'].map(capability=>financeSessionGuard(db,playerId,session.unified!.sessionDigest,session.unified!.csrfDigest,capability as 'read'|'post',now));
  await assert.rejects(db.batch(finance()),/CHECK constraint failed/);
  await db.batch(['read','post'].map(capability=>db.prepare('INSERT INTO economic_finance_permissions VALUES(?,?,?,?)').bind(playerId,capability,'fixture',now)));
  await db.batch(finance());
  // Synthetic reserve for the second annual hold; not a gameplay policy change.
  await prepareOpeningFundingFixture(db,now,rewardCalendarBudget().annual);
  const access=()=>[economicAssert(db,'SELECT 1')];
  const partial=await stepEconomicGenesis(db,access(),now);
  assert.equal(partial?.funded_clubs,15);
  await assert.rejects(completeEconomicGenesis(db,access(),now));
  await handle.close();handle=await open();db=handle.db;
  assert.equal((await readEconomicGenesis(db,access()))?.funded_clubs,15);
  for(let i=0;i<20;i++)await stepEconomicGenesis(db,access(),now);
  const funded=await completeEconomicGenesis(db,access(),now);
  assert.equal(funded?.completed,1);assert.equal(funded?.funded_clubs,320);
  assert.equal(await n(db,"SELECT COUNT(*) AS n FROM economic_balances WHERE kind='CLUB_TREASURY' AND balance_arc=100000"),320);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM economic_transactions'),321);
  assert.equal((await reconcileEconomy(db,access())).ok,true);
  await assert.rejects(prepareSeason(db,session,{expectedGeneration:reset.world.generation,expectedRevision:0},'opening-full-premature-prepare',await syntheticApproval(snapshots),now));
  await handle.close();handle=undefined;
  runner=await openLocalOpeningRehearsal(state);
  assert.equal((await runner.start(session,now)).completedSlots,0);
  assert.equal((await runner.step(session,now)).completedSlots,25);
  await runner.close();runner=await openLocalOpeningRehearsal(state);
  assert.equal((await runner.start(session,now)).completedSlots,25);
  for(let batch=1;batch<256;batch++){
   const progress=await runner.step(session,now);
   assert.equal(progress.committedBatches,batch+1);
   if((batch+1)%32===0)console.log('opening full fixture: generation batches',batch+1,'/256');
  }
  const report=await runner.reconcile();
  assert.equal(report.population,6400);assert.equal(report.reused,150);assert.equal(report.generated,6250);
  assert.equal(report.clubCounts.filter(c=>c.active&&c.count===25).length,256);
  assert.equal(report.clubCounts.filter(c=>!c.active&&c.count===0).length,64);
  assert.equal(report.domestic,4160);assert.equal(report.otherPlayable,1120);assert.equal(report.otherCountries,1120);
  await assert.rejects(runner.publish(session,now),/opening contracts incomplete/);
  const handoff=await runner.contractHandoff();
  assert.equal(handoff.intents.length,6400);
  await runner.close();runner=undefined;

  // Simulate power loss halfway through the first club: call the exact shared
  // #801 primitive for a single certified slot and reopen the local database.
  handle=await open();db=handle.db;
  await assert.rejects(readPublicPlayers(db,1),{code:'opening_world_unavailable'});
  await assert.rejects(readPublicClubRoster(db,handoff.intents[0].clubKey),{code:'opening_world_unavailable'});
  const first=handoff.intents[0],input={expectedGeneration:reset.world.generation,expectedRevision:0,clubKey:first.clubKey,playerId:first.playerId,durationSeasons:first.durationSeasons};
  const wrongClub=handoff.intents.find(i=>i.clubKey!==first.clubKey)!.clubKey;
  await assert.rejects(signInitialAiContract(db,session,input,first.idempotencyKey,now,readOpeningSalaryAuthority),{code:'contract_opening_staged'});
  await assert.rejects(signStagedOpeningContract(db,session,{...input,clubKey:wrongClub},first.idempotencyKey,now,handoff.runKey),{code:'contract_opening_staged'});
  await assert.rejects(signStagedOpeningContract(db,session,{...input,durationSeasons:first.durationSeasons===1?2:1},first.idempotencyKey,now,handoff.runKey),{code:'contract_opening_staged'});
  const signed=await signStagedOpeningContract(db,session,input,first.idempotencyKey,now,handoff.runKey);
  assert.equal(signed.world.revision,1);
  await assert.rejects(db.prepare('UPDATE world_state SET revision=2 WHERE id=1').run(),/opening world staging lock/);
  await assert.rejects(db.prepare('UPDATE player_signed_contracts SET closed_tick=0 WHERE player_id=?').bind(first.playerId).run(),/opening world staging lock/);
  await handle.close();handle=await open();db=handle.db;
  assert.deepEqual(await signStagedOpeningContract(db,session,input,first.idempotencyKey,now,handoff.runKey),signed);
  const funding=await preparePayrollAffordability(db,signed.world,first.clubKey,0);
  assert.ok(funding.inputs.committedUncoveredWages>0);
  assert.equal(funding.inputs.uncreditedGuaranteedParticipation,0);
  await assert.rejects(preparePayrollAffordability(db,signed.world,first.clubKey,1000000),{code:'contract_insufficient_cash_proof'});
  await handle.close();handle=undefined;
  runner=await openLocalOpeningRehearsal(state);
  for(let club=0;club<256;club++){
   const progress=await runner.signNextClub(session,now);
   assert.equal(progress.signed,(club+1)*25);
   if((club+1)%32===0)console.log('opening full fixture: signed clubs',club+1,'/256');
   if(club===127){await runner.close();runner=await openLocalOpeningRehearsal(state)}
  }
  const ready=await runner.signNextClub(session,now);
  assert.equal(ready.signed,6400);assert.equal(ready.remaining,0);assert.equal(ready.readyForContractReconciliation,true);
  const published=await runner.publish(session,now);
  assert.equal(published.population,6400);assert.equal(published.contracts,6400);assert.equal(published.world.revision,6401);
  await runner.close();runner=await openLocalOpeningRehearsal(state);
  assert.deepEqual(await runner.publish(session,now),published);
  assert.equal((await runner.inspect()).completedSlots,6400);
  await runner.close();runner=undefined;

  handle=await open();db=handle.db;
  const after=await readOpeningObservation(db);
  assert.equal(after.rows.length,6400);assert.equal(after.idHighWater,old.idHighWater+6250);
  assert.deepEqual(after.rawRows.slice(0,150),rebased.rawRows);
  assert.equal(await n(db,"SELECT COUNT(*) AS n FROM player_portrait_profiles WHERE status='approved'"),26);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM player_signed_contracts'),6400);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM player_agent_mandates'),0);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM opening_world_runs WHERE batch_index=256'),1);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM opening_world_staging'),0);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM economic_transactions'),321);
  assert.equal(await n(db,'SELECT COUNT(*) AS n FROM payroll_runs'),0);
  assert.equal((await reconcileEconomy(db,access())).ok,true);
  assert.equal((await readPublicPlayers(db,1)).count,6400);
  const catalogue=await loadApprovedSnapshot();
  const active=new Set(catalogue.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>[...b.clubIds]));
  for(const club of serverCanonicalCatalogue().clubIds)assert.equal((await readPublicClubRoster(db,club)).count,active.has(club)?25:0);
  assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
  const started=await prepareSeason(db,session,{expectedGeneration:published.world.generation,expectedRevision:published.world.revision},'opening-full-prepare-after-publication',catalogue,now);
  assert.equal(started.world.seasonNumber,1);assert.equal(started.world.phase,'preparing');
  console.log('opening full fixture: PASS 150 retained / 6250 new / 320 funded / 6400 signed / 256 full rosters / publication and restart');
  // #779: continue the SAME published local D1 (no second population, no
  // direct signing, no artificial expiry/retirement, no eligibility changes).
  await rehearsePublishedLifecycle(db,session,now,after,catalogue);

 }finally{
  try{if(runner)await runner.close();if(handle)await handle.close()}finally{await rm(state,{recursive:true,force:true})}
 }
});


/** #779: actual full-opening local fixture, not an estimate from slot intents.
 * All monetary operations use the same isolated D1 and canonical services.
 * The original 150 rows are synthetic stand-ins for DEV, not DEV identities.
 */
async function rehearsePublishedLifecycle(
 db:Database,session:AdminSession,now:number,
 before:Awaited<ReturnType<typeof readOpeningObservation>>,
 catalogue:Awaited<ReturnType<typeof loadApprovedSnapshot>>
){
 type World=Awaited<ReturnType<typeof readWorld>>;
 let world=await readWorld(db);
 const access=()=>[economicAssert(db,'SELECT 1')];
 const command=()=>({expectedGeneration:world.generation,expectedRevision:world.revision});
 const step=async(p:Promise<{world:World}>)=>{world=(await p).world;};
 const key=(s:string)=>'opening-lifecycle-'+world.seasonNumber+'-'+s;
 const budget=rewardCalendarBudget(),pin={rewardVersion:budget.version,configVersion:'synthetic-opening-world'};
 const count=async(sql:string)=>(await db.prepare(sql).first<{n:number}>())!.n;
 type Term={id:number;player_id:number;club_key:string;annual_salary_arc:number;scheduled_end_tick:number;closed_tick:number|null;close_reason:string|null};
 const terms=async()=>(await db.prepare("SELECT id,player_id,club_key,annual_salary_arc,scheduled_end_tick,closed_tick,close_reason FROM player_signed_contracts ORDER BY id").all<Term>()).results;
 const originalTerms=await terms();
 assert.equal(originalTerms.length,6400);
 const originalPlayers=new Map(before.rawRows.map(row=>[row.id,JSON.parse(row.payload_json)]));
 const payrollClaims=async(season:number)=>(await db.prepare("SELECT c.* FROM payroll_claims c JOIN payroll_runs r ON r.id=c.run_id WHERE r.season=? ORDER BY c.id").bind(season).all()).results;
 const payday=async(day:28|56)=>{
  assert.equal(world.day,day);
  console.log('opening lifecycle payday start:',JSON.stringify({season:world.seasonNumber,day}));
  await db.batch(['read','post'].map(capability=>financeSessionGuard(db,session.unified!.playerId,session.unified!.sessionDigest,session.unified!.csrfDigest,capability as 'read'|'post',now)));
  const prepared=await prepareRewardSettlement(db,pin);
  let complete=false;
  for(let i=0;i<100;i++){
   const result=await executeRewardSettlementBatch(db,session,prepared,now);
   if(result.status==='complete'){complete=true;break;}
   assert.equal(result.status,'pending');
  }
  assert.equal(complete,true,'bounded local Rewards loop');
  await executeRewardSettlementBatch(db,session,prepared,now,true);
  world=await readWorld(db);
  console.log('opening lifecycle Rewards complete:',JSON.stringify({season:world.seasonNumber,day}));
  let finished=false;
  for(let i=0;i<1000;i++){
   const result=await settleNextPayrollBatch(db,session,now);
   if(result===null){finished=true;break;}
   assert.ok(result.status==='pending'||result.status==='complete');
   if((i+1)%64===0)console.log('opening lifecycle payroll batches:',JSON.stringify({season:world.seasonNumber,day,batches:i+1}));
  }
  assert.equal(finished,true,'bounded local payroll loop');
  const report=await reconcilePayrollPayday(db,session,now);
  assert.equal(report.status,'complete');assert.equal(report.clubsComplete,320);assert.equal(report.pendingArc,0);
  assert.equal(report.dueArc,report.paidArc+report.arrearsArc);
  const audit=await readAdminEconomyReconciliation(db,access()),summary=await readAdminEconomySummary(db,access());
  assert.equal(audit.report.ok,true);assert.equal(audit.domainStatus,'domain_verified');
  const row=summary.payroll.rows.find(r=>r.season===world.seasonNumber&&r.day===day)!;
  assert.equal(row.completedClubs,320);assert.equal(row.pendingArc,'0');
  assert.equal(row.paidArc,String(report.paidArc));
  console.log('opening lifecycle payroll:',JSON.stringify({season:world.seasonNumber,day,clubs:report.clubsComplete,dueArc:report.dueArc,paidArc:report.paidArc,arrearsArc:report.arrearsArc}));
 };
 const play=async()=>{
  await step(initializeAdministrativeEvents(db,session,command(),key('events'),now));
  await step(advanceAdministrativeClockLineupV1(db,session,'start',command(),key('start'),now));
  for(const eventId of ['domestic:entrants','international:entrants']){
   // Season Zero confirmations, when present, were already carried forward.
   const event=await db.prepare("SELECT status FROM season_admin_events WHERE season_number=? AND event_id=?").bind(world.seasonNumber,eventId).first<{status:string}>();
   if(event?.status!=='completed')await step(completeConfirmationEvent(db,session,{...command(),eventId},key('confirm-'+eventId),now));
  }
  await step(advanceAdministrativeClockLineupV1(db,session,'advance',command(),key('day2'),now));
  await step(stageDomesticCalendar(db,session,command(),key('domestic'),now));
  await step(advanceAdministrativeClockLineupV1(db,session,'advance',command(),key('day3'),now));
  await step(executeInternationalDraw(db,session,command(),key('draw'),now));
  await step(publishInternationalCalendarLineupV1(db,session,command(),key('publish'),now));
  for(let day=4;day<=56;day++){
   await step(executeLineupLifecycleV1(db,session,'advance',command(),key('sport-'+day),now));
   assert.equal(world.day,day);
   if(day===28||day===56)await payday(day);
  }
  await step(archiveSeasonLineupV1(db,session,command(),key('archive'),now));
  await step(closeSeasonLineupV1(db,session,command(),key('close'),now));
  assert.equal(world.phase,'closed');
 };
 await play();
 const priorClaims=await payrollClaims(1);
 assert.equal(priorClaims.length,12800,'two claims per opening term (AI represented)');
 const priorReceipts=await count("SELECT COUNT(*) AS n FROM match_lineup_result_receipts WHERE season_number=1");
 assert.equal(priorReceipts,4082);
 const originalArchives=(await db.prepare("SELECT * FROM season_archives WHERE season_number=1").all()).results;
 const reviewed=await readSeasonTwoCandidate(db);
 await step(approveSeasonTwoSnapshot(db,session,{...command(),snapshotHash:reviewed.snapshot.snapshotHash},key('approve-next'),now));
 await earmarkNextRewardBudget(db,access(),now);
 const priorWorld=command(),prepareKey=key('prepare-next');
 const prepared=await prepareSeasonTwo(db,session,priorWorld,prepareKey,now);
 assert.deepEqual(await prepareSeasonTwo(db,session,priorWorld,prepareKey,now),prepared);
 world=prepared.world;
 assert.equal(world.seasonNumber,2);assert.equal(world.phase,'preparing');assert.equal(world.day,0);
 assert.equal(await count("SELECT COUNT(*) AS n FROM player_market_values WHERE config_version IS NULL"),6400);
 let updated=0;
 for(let i=0;i<40;i++){
  const result=await refreshMarketValueIndexBatch(db);
  updated+=result.updated;
  if(result.ready)break;
 }
 assert.equal(updated,6400);
 const version=await marketValueIndexVersion();
 assert.equal((await marketValueIndexReadiness(db,version).first<{ready:number}>())?.ready,1);
 const after=await readOpeningObservation(db);
 assert.equal(after.idHighWater,before.idHighWater);assert.equal(after.rawRows.length,6400);
 const retired=new Set<number>();
 let changedValues=0;
 for(let i=0;i<before.rawRows.length;i++){
  const old=before.rawRows[i],row=after.rawRows[i],p=originalPlayers.get(old.id)!;
  const retires=p.age+1>=p.retirement_age;
  if(retires)retired.add(old.id);
  assert.equal(row.id,old.id);
  assert.deepEqual(JSON.parse(row.payload_json),{...p,age:p.age+1,career_status:retires?'retired':'active'});
  assert.deepEqual({batch:row.batch_id,generation:row.world_generation,entry:row.entry_season,portrait:row.snapshot_json,status:row.status,asset:row.asset_key,schema:row.schema_version,prompt:row.prompt_version},
   {batch:old.batch_id,generation:old.world_generation,entry:old.entry_season,portrait:old.snapshot_json,status:old.status,asset:old.asset_key,schema:old.schema_version,prompt:old.prompt_version});
  assert.equal(row.input_revision,old.input_revision+1);
  assert.equal(row.config_version,version);
  assert.equal(row.market_value_arc,marketValueIndexUpdate(row.id,row.input_revision,null,JSON.parse(row.payload_json)).value);
  if(retires)assert.equal(row.market_value_arc,0);
  if(row.market_value_arc!==old.market_value_arc)changedValues++;
 }
 assert.ok(retired.size>0);assert.ok(changedValues>0);
 const actualTerms=await terms();
 const nextClubs=new Set(reviewed.snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>b.clubIds));
 const oldD2=new Set(catalogue.bindings.filter(b=>!b.competitionId.startsWith('int-')&&b.competitionId.endsWith('-2')).flatMap(b=>b.clubIds));
 const nextD1=new Set(reviewed.snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')&&b.competitionId.endsWith('-1')).flatMap(b=>b.clubIds));
 const promoted=new Set([...nextD1].filter(c=>oldD2.has(c)));
 const eligible=new Map<string,number[]>(),expectedRates=new Map<number,number>();
 let expiryOnly=0,overlap=0;
 for(let i=0;i<originalTerms.length;i++){
  const old=originalTerms[i],retiring=retired.has(old.player_id),expires=old.scheduled_end_tick===56;
  if(retiring&&expires)overlap++;
  if(expires&&!retiring)expiryOnly++;
  assert.deepEqual(actualTerms[i],{...old,closed_tick:retiring||expires?56:null,close_reason:retiring?'retirement':expires?'expiry':null});
  if(!retiring&&!expires){
   const ids=eligible.get(old.club_key)??[];ids.push(old.player_id);eligible.set(old.club_key,ids);
   expectedRates.set(old.id,promoted.has(old.club_key)?Math.max(40,old.annual_salary_arc):old.annual_salary_arc);
  }
 }
 const adjusted=(await db.prepare("SELECT contract_id,annual_salary_arc FROM player_contract_promotion_salary ORDER BY contract_id").all<{contract_id:number;annual_salary_arc:number}>()).results;
 assert.deepEqual(adjusted,originalTerms.filter(t=>expectedRates.has(t.id)&&expectedRates.get(t.id)!>t.annual_salary_arc).map(t=>({contract_id:t.id,annual_salary_arc:40})));
 const rosterReport:{clubKey:string;players:number;primaryGK:number;eligibleGK:number}[]=[];
 for(const clubKey of serverCanonicalCatalogue().clubIds){
  const roster=await readPublicClubRoster(db,clubKey);
  assert.deepEqual(roster.players.map(p=>p.id).sort((a,b)=>a-b),(eligible.get(clubKey)??[]).slice().sort((a,b)=>a-b));
  if(nextClubs.has(clubKey))rosterReport.push({clubKey,players:roster.count,primaryGK:roster.players.filter(p=>p.primary_position==='GK').length,eligibleGK:roster.players.filter(p=>p.primary_position==='GK'||p.secondary_positions.includes('GK')).length});
 }
 assert.equal(rosterReport.length,256);
 const report={population:6400,retained:150,retired:retired.size,expiryOnly,overlap,remaining:rosterReport.reduce((n,r)=>n+r.players,0),min:Math.min(...rosterReport.map(r=>r.players)),max:Math.max(...rosterReport.map(r=>r.players)),below11:rosterReport.filter(r=>r.players<11),withoutPrimaryGK:rosterReport.filter(r=>!r.primaryGK),withoutEligibleGK:rosterReport.filter(r=>!r.eligibleGK),adjustedContracts:adjusted.length,valuesRefreshed:updated,valuesChanged:changedValues};
 assert.equal(report.remaining,expectedRates.size);
 assert.equal(report.remaining+report.retired+report.expiryOnly,6400);
 console.log('opening lifecycle actual D1 roster report:',JSON.stringify(report));
 assert.deepEqual(await payrollClaims(1),priorClaims);
 await play();
 const nextClaims=(await db.prepare("SELECT c.contract_id,c.annual_salary_arc,c.due_arc,r.day FROM payroll_claims c JOIN payroll_runs r ON r.id=c.run_id WHERE r.season=2 ORDER BY c.contract_id,r.day").all<{contract_id:number;annual_salary_arc:number;due_arc:number;day:number}>()).results;
 assert.equal(nextClaims.length,expectedRates.size*2);
 for(const claim of nextClaims){
  const rate=expectedRates.get(claim.contract_id);
  assert.ok(rate!==undefined);
  assert.equal(claim.annual_salary_arc,rate);
  assert.equal(claim.due_arc,claim.day===28?Math.floor(rate/2):rate-Math.floor(rate/2));
 }
 assert.deepEqual(await payrollClaims(1),priorClaims);
 assert.deepEqual((await db.prepare("SELECT * FROM season_archives WHERE season_number=1").all()).results,originalArchives);
 assert.equal(await count("SELECT COUNT(*) AS n FROM payroll_runs"),1280);
 assert.equal(await count("SELECT COUNT(*) AS n FROM match_lineup_result_receipts"),8164);
 assert.equal((await reconcileEconomy(db,access())).ok,true);
 assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length,0);
 console.log('opening lifecycle full fixture: PASS actual opening, two seasons, four paydays, all identities/attributes/history/values and effective rosters');
}
