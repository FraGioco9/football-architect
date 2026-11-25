import {beforeAll,it,expect} from 'vitest';
import {env} from 'cloudflare:workers';
import {applyD1Migrations} from 'cloudflare:test';
import {seedUnifiedAdminHttp} from './fixtures/unified-admin-http.ts';
import {digestOpaqueToken} from '../src/session-tokens.ts';
import {previewPlayerGeneration,commitPlayerGeneration} from '../src/players-generation-command.ts';
import {openingDigest,readOpeningObservation,beginLocalOpeningRun,commitLocalOpeningBatch,readLocalOpeningJournal} from '../src/opening-world-store.ts';
import {readLocalOpeningInventory} from '../src/opening-world-inventory.ts';
import {fundOpeningFixture} from './fixtures/opening-funding.ts';
import {readPublicPlayers} from '../src/public-players-read.ts';
import {readPublicClubRoster} from '../src/public-club-roster-read.ts';
import {signStagedOpeningContract,signInitialAiContract,readOpeningSalaryAuthority} from '../src/player-club-contracts.ts';
import {loadApprovedSnapshot} from '../src/approved-season-one.ts';
import {preparePayrollAffordability} from '../src/payroll-affordability.ts';
import {readWorld} from '../src/world-repository.ts';
import type {Database} from '../src/database.ts';
import type {AdminSession} from '../src/auth.ts';
const bindings=env as any,db=bindings.DB as Database;
beforeAll(async()=>{await applyD1Migrations(db,bindings.TEST_MIGRATIONS)});
it('local opening journal preserves existing player, atomically rolls back and retries one mixed batch',async()=>{
 const now=Math.floor(Date.now()/1000),actor='opening-fixture',email='opening@example.invalid',token='b'.repeat(64);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(actor,email,'fixture',now-100).run();
 const {csrf,playerId}=await seedUnifiedAdminHttp(db,actor,email,now,token);
 const session:AdminSession={actor:{id:actor,email},digest:'fixture',csrfDigest:await digestOpaqueToken(csrf),credentialVersion:1,unified:{playerId,sessionDigest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(csrf)}};
 const preview=await previewPlayerGeneration(db,session,{options:{count:1,seed:'reuse-fixture',age:18,primaryNationality:'ITA',primaryPosition:'ST'}},now);
 await commitPlayerGeneration(db,session,{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'},now);
 const initial=await readOpeningObservation(db);
 expect(initial.rows).toHaveLength(1);
 const certified=await readLocalOpeningInventory(db);
 expect(certified.players).toHaveLength(1);
 expect(certified.players[0]).toMatchObject({id:initial.rows[0].id,age:18,primaryNationality:'ITA',primaryPosition:'ST',clubKey:null,representation:'ai',hasSignedContract:false,hasSportingHistory:false,readyForReuse:true,fingerprint:initial.rows[0].fingerprint});
 expect(certified.snapshotId).toMatch(/^[0-9a-f]{64}$/);
 expect(await readLocalOpeningInventory(db)).toEqual(certified);
 expect(certified.players[0]).not.toHaveProperty('retirement_age');
 expect(certified.players[0]).not.toHaveProperty('attributes');
 expect(certified.players[0]).not.toHaveProperty('development_aptitude');
 const intents:Parameters<typeof commitLocalOpeningBatch>[5]=[{slotKey:'fixture/001',kind:'reuse',playerId:initial.rows[0].id},
  ...Array.from({length:24},(_,i)=>{const slotKey='fixture/'+String(i+2).padStart(3,'0');return {slotKey,kind:'generate' as const,slot:{slotKey,age:39,primaryNationality:'ITA',primaryPosition:'ST',primarySuitabilityTarget:65,generatorSeed:'opening-test-'+i},privateRetirementAge:40}})];
 const intentHash=await openingDigest(intents);
 // Only one synthetic batch is committed in this fixture. Remaining commitments are deliberately unusable.
 const identity={schema:'opening-persistence-v2',worldGeneration:initial.world.generation,worldRevision:0,manifestHash:'a'.repeat(64),inventoryHash:'b'.repeat(64),assignmentHash:'c'.repeat(64),batchSize:25,slotCount:6400,initialHighWater:initial.idHighWater,batchIntentHashes:[intentHash,...Array(255).fill('0'.repeat(64))],contractClubs:['fixture',...Array.from({length:255},(_,i)=>'fixture-'+i)],contractTerms:Array(6400).fill(1)};
 const root={...identity,runKey:await openingDigest(identity),baseline:initial.rows};
 await expect(beginLocalOpeningRun(db,session,root,now)).rejects.toThrow();
 await fundOpeningFixture(db,now);
 await beginLocalOpeningRun(db,session,root,now);
 await expect(readPublicPlayers(db,1)).rejects.toMatchObject({code:'opening_world_unavailable'});
 await expect(readPublicClubRoster(db,'IT-1')).rejects.toMatchObject({code:'opening_world_unavailable'});
 await expect(signStagedOpeningContract(db,session,{expectedGeneration:initial.world.generation,expectedRevision:0,clubKey:'IT-1',playerId:initial.rows[0].id,durationSeasons:1},'fixture-opening-signing',now,root.runKey)).rejects.toMatchObject({code:'contract_opening_staged'});
 await expect(beginLocalOpeningRun(db,session,root,now)).rejects.toThrow();
 await expect(readLocalOpeningInventory(db)).rejects.toThrow('opening inventory already frozen');
 const ordinary=await previewPlayerGeneration(db,session,{options:{count:1,seed:'locked-fixture'}},now);
 await expect(commitPlayerGeneration(db,session,{draftId:ordinary.draftId,confirmation:'GENERATE PLAYERS'},now)).rejects.toThrow();
 await expect(db.prepare("UPDATE world_state SET generation=? WHERE id=1").bind(crypto.randomUUID()).run()).rejects.toThrow();
 await expect(db.prepare("UPDATE generated_players SET payload_json=json_set(payload_json,'$.age',19) WHERE id=?").bind(initial.rows[0].id).run()).rejects.toThrow();
 await expect(db.prepare('DELETE FROM generated_players WHERE id=?').bind(initial.rows[0].id).run()).rejects.toThrow();
 expect((await readOpeningObservation(db)).rows).toEqual(initial.rows);
 const descriptor=intents.map(e=>e.kind==='reuse'?{slotKey:e.slotKey,kind:e.kind,playerId:e.playerId}:{slotKey:e.slotKey,kind:e.kind});
 const hash=await openingDigest({runKey:root.runKey,index:0,entries:descriptor});
 const altered=intents.map((e,i)=>i===1&&e.kind==='generate'?{...e,slot:{...e.slot,age:38}}:e);
 await expect(commitLocalOpeningBatch(db,session,root.runKey,0,hash,altered,now)).rejects.toThrow('opening batch parameters differ');
 expect((await readOpeningObservation(db)).rows).toEqual(initial.rows);
 await db.prepare("CREATE TRIGGER opening_fixture_rollback BEFORE INSERT ON opening_world_runs WHEN NEW.batch_index>=0 BEGIN SELECT RAISE(ABORT,'forced receipt failure'); END").run();
 await expect(commitLocalOpeningBatch(db,session,root.runKey,0,hash,intents,now)).rejects.toThrow();
 expect((await readOpeningObservation(db)).rows).toEqual(initial.rows);
 expect((await readLocalOpeningJournal(db,root.runKey)).receipts).toHaveLength(0);
 await db.prepare('DROP TRIGGER opening_fixture_rollback').run();
 const result=await commitLocalOpeningBatch(db,session,root.runKey,0,hash,intents,now);
 expect(result.alreadyCommitted).toBe(false);
 expect(result.receipt.entries).toHaveLength(25);
 const after=await readOpeningObservation(db);
 expect(after.rows).toHaveLength(25);
 expect(after.rows[0]).toEqual(initial.rows[0]);
 for(const id of [initial.rows[0].id,after.rows[1].id]){
  await expect(db.prepare("UPDATE player_portrait_profiles SET status='rejected' WHERE player_id=?").bind(id).run()).rejects.toThrow();
  await expect(db.prepare('DELETE FROM player_portrait_profiles WHERE player_id=?').bind(id).run()).rejects.toThrow();
  await expect(db.prepare("UPDATE player_market_values SET config_version=NULL,market_value_arc=NULL WHERE player_id=?").bind(id).run()).rejects.toThrow();
  await expect(db.prepare('DELETE FROM player_market_values WHERE player_id=?').bind(id).run()).rejects.toThrow();
 }
 expect((await readOpeningObservation(db)).rows).toEqual(after.rows);
 expect(after.idHighWater).toBe(initial.idHighWater+24);
 const adults=after.rawRows.slice(1).map(r=>JSON.parse(r.payload_json));
 expect(adults.every(p=>p.age===39&&p.retirement_age===40)).toBe(true);
 const replay=await commitLocalOpeningBatch(db,session,root.runKey,0,hash,intents,now);
 expect(replay).toEqual({receipt:result.receipt,alreadyCommitted:true});
 await expect(commitLocalOpeningBatch(db,session,root.runKey,0,hash,altered,now)).rejects.toThrow('opening batch parameters differ');
 expect((await readOpeningObservation(db)).rows).toEqual(after.rows);
 expect((await readLocalOpeningJournal(db,root.runKey)).receipts).toEqual([result.receipt]);
 await expect(db.prepare('DELETE FROM opening_world_runs').run()).rejects.toThrow();
 const privateDraft=await db.prepare("SELECT candidates_json FROM player_generation_drafts WHERE seed='opening-0'").first<{candidates_json:string}>();
 expect(JSON.parse(privateDraft!.candidates_json).every((p:any)=>!Object.hasOwn(p,'retirement_age'))).toBe(true);
},180000);

it('complete synthetic slot journal permits only shared audited initial signatures and resumes from actual terms',async()=>{
 // This is not a population-generation test: one canonical test payload is
 // cloned into disposable synthetic IDs solely to exercise the full SQL slot
 // geometry. No real catalogue or remote data, and no bypass of staging guards.
 const now=Math.floor(Date.now()/1000),actor='opening-sign-fixture',email='opening-sign@example.invalid',token='e'.repeat(64);
 await db.prepare('INSERT INTO admin_accounts(id,email_normalized,password_verifier,created_at) VALUES(?,?,?,?)').bind(actor,email,'fixture',now-100).run();
 const {csrf,playerId}=await seedUnifiedAdminHttp(db,actor,email,now,token);
 const session:AdminSession={actor:{id:actor,email},digest:'fixture',csrfDigest:await digestOpaqueToken(csrf),credentialVersion:1,unified:{playerId,sessionDigest:await digestOpaqueToken(token),csrfDigest:await digestOpaqueToken(csrf)}};
 const preview=await previewPlayerGeneration(db,session,{options:{count:1,seed:'staged-sign-fixture',age:18,primaryNationality:'ITA',primaryPosition:'ST'}},now);
 await commitPlayerGeneration(db,session,{draftId:preview.draftId,confirmation:'GENERATE PLAYERS'},now);
 const world=await readWorld(db),source=(await db.prepare('SELECT id,batch_id,payload_json FROM generated_players ORDER BY id LIMIT 1').first<{id:number;batch_id:string;payload_json:string}>())!;
 expect(source.id).toBe(1);
 // Bounded fixture inserts, not use of the product generation pipeline.
 for(let low=2;low<=6400;low+=250){
  const ids=Array.from({length:Math.min(250,6401-low)},(_,i)=>low+i);
  await db.prepare(`INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at)
   SELECT value,?,?,0,json_set(?,'$.id',value),? FROM json_each(?) ORDER BY value`).bind(source.batch_id,world.generation,source.payload_json,now,JSON.stringify(ids)).run();
 }
 await fundOpeningFixture(db,now);
 const snapshot=await loadApprovedSnapshot(),clubKeys=snapshot.bindings.filter(b=>!b.competitionId.startsWith('int-')).flatMap(b=>[...b.clubIds]).sort();
 expect(clubKeys).toHaveLength(256);
 const baseline=Array.from({length:6400},(_,i)=>({id:i+1,fingerprint:(i+1).toString(16).padStart(64,'0')}));
 const identity={schema:'opening-persistence-v2',worldGeneration:world.generation,worldRevision:0,manifestHash:'a'.repeat(64),inventoryHash:'b'.repeat(64),assignmentHash:'c'.repeat(64),batchSize:25,slotCount:6400,initialHighWater:6400,batchIntentHashes:Array(256).fill('d'.repeat(64)),contractClubs:clubKeys,contractTerms:Array(6400).fill(2)};
 const runKey=await openingDigest(identity),root={...identity,runKey,baseline};
 const insert=(index:number,hash:string,payload:unknown)=>db.prepare('INSERT INTO opening_world_runs(run_key,world_generation,batch_index,request_hash,before_high_water,after_high_water,payload_json,draft_id,created_at) VALUES(?,?,?,?,6400,6400,?,NULL,?)').bind(runKey,world.generation,index,hash,JSON.stringify(payload),now);
 await insert(-1,runKey,root).run();
 const statements=[];
 for(let index=0;index<256;index++){
  const entries=baseline.slice(index*25,index*25+25).map((x,i)=>({slotKey:clubKeys[index]+'/'+String(i+1).padStart(3,'0'),kind:'reuse',playerId:x.id,fingerprint:x.fingerprint}));
  const descriptor=entries.map(({slotKey,kind,playerId})=>({slotKey,kind,playerId}));
  const requestHash=await openingDigest({runKey,index,entries:descriptor});
  statements.push(insert(index,requestHash,{runKey,index,requestHash,beforeHighWater:6400,afterHighWater:6400,entries}));
  if(statements.length===8){await db.batch(statements.splice(0))}
 }
 expect((await db.prepare('SELECT COUNT(*) AS n FROM opening_world_contract_slots').first<{n:number}>())!.n).toBe(6400);
 const input={expectedGeneration:world.generation,expectedRevision:0,playerId:1,clubKey:clubKeys[0],durationSeasons:2},key='staged-opening-positive-01';
 await expect(signInitialAiContract(db,session,input,key,now,readOpeningSalaryAuthority)).rejects.toMatchObject({code:'contract_opening_staged'});
 await expect(signStagedOpeningContract(db,session,{...input,clubKey:clubKeys[1]},key,now,runKey)).rejects.toMatchObject({code:'contract_opening_staged'});
 await expect(signStagedOpeningContract(db,session,{...input,durationSeasons:1},key,now,runKey)).rejects.toMatchObject({code:'contract_opening_staged'});
 const signed=await signStagedOpeningContract(db,session,input,key,now,runKey);
 expect(signed.world.revision).toBe(1);
 expect(await signStagedOpeningContract(db,session,input,key,now,runKey)).toEqual(signed);
 expect((await db.prepare('SELECT COUNT(*) AS n FROM player_signed_contracts').first<{n:number}>())!.n).toBe(1);
 expect(await db.prepare('SELECT command FROM admin_operations WHERE id=?').bind(signed.operationId).first()).toEqual({command:'sign-opening-slot-v1'});
 const proof=await preparePayrollAffordability(db,signed.world,clubKeys[0],40);
 expect(proof.inputs.committedUncoveredWages).toBeGreaterThan(0);
 expect(proof.inputs.uncreditedGuaranteedParticipation).toBe(0);
 await expect(db.prepare('UPDATE world_state SET revision=2 WHERE id=1').run()).rejects.toThrow('opening world staging lock');
 await expect(db.prepare("UPDATE player_signed_contracts SET closed_tick=0,close_reason='release' WHERE player_id=1").run()).rejects.toThrow('opening world staging lock');
 const second=await signStagedOpeningContract(db,session,{...input,playerId:2,expectedRevision:1},'staged-opening-positive-02',now,runKey);
 expect(second.world.revision).toBe(2);
 await expect(readPublicPlayers(db,1)).rejects.toMatchObject({code:'opening_world_unavailable'});
 await expect(insert(256,'e'.repeat(64),{schema:'opening-publication-v1',runKey}).run()).rejects.toThrow('opening publication incomplete');
 expect((await db.prepare('SELECT COUNT(*) AS n FROM opening_world_staging').first<{n:number}>())!.n).toBe(1);
 expect((await db.prepare("SELECT COUNT(*) AS n FROM economic_transactions WHERE purpose IN ('PAYROLL_AI','PAYROLL_HUMAN')").first<{n:number}>())!.n).toBe(0);
},180000);
