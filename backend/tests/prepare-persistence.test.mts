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
