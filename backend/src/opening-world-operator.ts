/** Shared trusted #791 orchestration. Only local and explicitly gated DEV callers supply storage and source pins. */
import type {Database} from './database.ts';
import {loadApprovedSnapshot,serverCanonicalCatalogue} from './approved-season-one.ts';
import {loadRuntimePlayerCatalog} from './players-catalog.mjs';
import {readWorld} from './world-repository.ts';
import type {WorldV1} from './types.ts';
import type {AdminSession} from './auth.ts';
import {sessionGuard,abortUnless} from './command-guards.ts';
import {requireEconomicGenesisGuard} from './economic-genesis.ts';
import {preparePayrollAffordability} from './payroll-affordability.ts';
import {economicReconciliationGuard} from './economic-ledger.ts';
import {signStagedOpeningContract,readOpeningSalaryAuthority} from './player-club-contracts.ts';
import {readLocalOpeningInventory,type RetainedOpeningInput} from './opening-world-inventory.ts';
import {rebaseLocalRetainedPlayers,captureRetainedOpeningEvidence} from './opening-world-retained.ts';
import {beginLocalOpeningRun,commitLocalOpeningBatch,readLocalOpeningJournal,readOpeningObservation} from './opening-world-store.ts';
import {clubCountryToNationality,planApprovedReference,reserveRetainedFirst,manifestDigest,REFERENCE_PROFILE_VERSION,type OpeningClub} from '../../tools/world-bootstrap-791/planner.mjs';
import {createCertifiedOpeningPersistenceRun,inspectOpeningProgress,prepareOpeningBatchIntents,reconcileCompletedOpening,prepareOpeningContractHandoff,inspectOpeningContractHandoff,type OpeningContractHandoff,type OpeningSignedRow,type OpeningInventory,type OpeningRoot} from '../../tools/world-bootstrap-791/persistence.mjs';

const assert=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg)};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export type OpeningPrivatePlan={schema:'opening-local-rehearsal-v1';seed:string;inventory:OpeningInventory;root:OpeningRoot;retained?:RetainedOpeningInput};
function checkWorld(world:WorldV1){
 assert(world.seasonNumber===0&&world.day===0&&world.revision===0&&world.phase==='unstarted','opening rehearsal requires fresh Season 0');
}
export async function buildOpeningManifest(world:WorldV1,seed:string,sourceDigest:string){
 checkWorld(world);
 const snapshot=await loadApprovedSnapshot(),canonical=serverCanonicalCatalogue();
 const membership=new Map<string,1|2>();
 for(const binding of snapshot.bindings){
  if(binding.competitionId.startsWith('int-'))continue;
  const division=Number(binding.competitionId.split('-').at(-1));
  assert(division===1||division===2,'invalid domestic division');
  for(const id of binding.clubIds){assert(!membership.has(id),'duplicate domestic club');membership.set(id,division as 1|2)}
 }
 const clubs:OpeningClub[]=canonical.clubIds.map(key=>({key,nationality:clubCountryToNationality(key.split('-')[0]),division:membership.get(key)??null,active:membership.has(key)}));
 assert(clubs.length===320&&membership.size===256&&clubs.filter(c=>!c.active).length===64,'opening club catalogue mismatch');
 const catalog=loadRuntimePlayerCatalog();
 const versions={worldGeneration:world.generation,worldRevision:world.revision,
  clubSnapshot:manifestDigest({participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,clubs}),
  generator:sourceDigest,catalog:manifestDigest({given:[...catalog.given],surnames:[...catalog.surnames],surnameSource:catalog.surnameSource}),policy:REFERENCE_PROFILE_VERSION};
 return planApprovedReference({seed,versions,clubs});
}

export function createOpeningRehearsal(db:Database,store:{read:()=>Promise<OpeningPrivatePlan>;save:(plan:OpeningPrivatePlan)=>Promise<void>},manifestFor:(world:WorldV1,seed:string)=>ReturnType<typeof buildOpeningManifest>){
 async function verifiedPlan(){
  const plan=await store.read(),world=await readWorld(db);
  assert(world.generation===plan.root.worldGeneration&&world.seasonNumber===0&&world.day===0&&world.phase==='unstarted','opening world changed or started');
  const initialWorld={...world,revision:0};
  const manifest=reserveRetainedFirst(await manifestFor(initialWorld,plan.seed),plan.inventory);
  const rebuilt=createCertifiedOpeningPersistenceRun(manifest,plan.inventory,initialWorld);
  assert(same(plan.root,rebuilt),'opening plan or canonical source changed');
  return {plan,manifest,world};
 }
 // This cache contains only the immutable, certified allocation handoff.
 // Never cache a signing cursor: each call re-reads actual durable terms.
 // The staging triggers freeze player/portrait/index/receipt evidence;
 // reopening the local handle discards this cache and reaudits everything.
 let signingHandoff:OpeningContractHandoff|undefined;
 async function signedState(){
  const world=await readWorld(db),signed:OpeningSignedRow[]=[];
  for(let id=0;;){
   const rows=(await db.prepare('SELECT * FROM player_signed_contracts WHERE id>? ORDER BY id LIMIT 100').bind(id).all<OpeningSignedRow>()).results;
   signed.push(...rows);if(rows.length<100)break;id=rows[rows.length-1].id;
  }
  assert(same(world,await readWorld(db))&&world.seasonNumber===0&&world.day===0&&world.phase==='unstarted'&&world.revision===signed.length,'opening signing progress changed');
  return {world,signed};
 }
 async function progress(){
  const {plan,manifest}=await verifiedPlan();
  const journal=await readLocalOpeningJournal(db,plan.root.runKey);
  assert(same(journal.root,plan.root),'opening journal root differs from private plan');
  const actual=await readOpeningObservation(db),{world,signed}=await signedState();
  assert(same(actual.world,world)&&world.generation===plan.root.worldGeneration&&(signed.length===0||journal.receipts.length===256),'opening signing progress changed');
  const observation={...actual,world:{...actual.world,revision:0}};
  return {plan,manifest,journal,observation,signed,world,progress:inspectOpeningProgress(plan.root,manifest,plan.inventory,journal.receipts,observation)};
 }
 return {
  async captureRetained(){return captureRetainedOpeningEvidence(db)},
  async rebaseRetained(session:AdminSession,retained:RetainedOpeningInput,now:number){
   return rebaseLocalRetainedPlayers(db,session,retained.evidence,retained.resetOperationId,now);
  },
  async prepare(seed:string,retained?:RetainedOpeningInput){
   const world=await readWorld(db),inventory=await readLocalOpeningInventory(db,retained),manifest=reserveRetainedFirst(await manifestFor(world,seed),inventory);
   const root=createCertifiedOpeningPersistenceRun(manifest,inventory,world);
   await store.save({schema:'opening-local-rehearsal-v1',seed,inventory,root,...(retained?{retained}:{})});
   return {runKey:root.runKey,slots:root.slotCount,reused:root.baseline.length,newPlayers:root.slotCount-root.baseline.length,batches:root.batchIntentHashes.length};
  },
  async validatePrepared(){
   const {plan}=await verifiedPlan();
   assert(same(await readLocalOpeningInventory(db,plan.retained),plan.inventory),'opening inventory changed since prepare');
   assert(!await db.prepare('SELECT 1 FROM club_license_state WHERE account_id IS NOT NULL AND club_key IN (SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(plan.root.contractClubs)).first(),'opening requires AI-managed active clubs');
   return {runKey:plan.root.runKey,reused:plan.root.baseline.length,newPlayers:plan.root.slotCount-plan.root.baseline.length};
  },
  async start(session:AdminSession,now:number){
   const {plan}=await verifiedPlan();
   // A lost start response must not cause inventory recertification against
   // already-staged players or a second root insert. Only resume the exact
   // frozen root, and require the same live mutation guard as a new start.
   const existing=await db.prepare('SELECT run_key FROM opening_world_runs WHERE world_generation=? AND batch_index=-1').bind(plan.root.worldGeneration).first<{run_key:string}>();
   if(existing){
    assert(existing.run_key===plan.root.runKey,'opening journal root differs from private plan');
    await db.batch([sessionGuard(db,session,now)]);
    return (await progress()).progress;
   }
   // No implicit revocation; D2 must use the existing audited Admin Licenses command.
   assert(!await db.prepare('SELECT 1 FROM club_license_state WHERE account_id IS NOT NULL AND club_key IN (SELECT value FROM json_each(?)) LIMIT 1').bind(JSON.stringify(plan.root.contractClubs)).first(),'opening requires AI-managed active clubs');
   const fresh=await readLocalOpeningInventory(db,plan.retained);
   assert(same(fresh,plan.inventory),'opening inventory changed since prepare');
   const forecast=await readOpeningSalaryAuthority(db,await readWorld(db),plan.root.contractClubs[0]);
   await db.batch([sessionGuard(db,session,now),requireEconomicGenesisGuard(db,plan.root.worldGeneration),...forecast.guards]);
   await beginLocalOpeningRun(db,session,plan.root,now);
   return (await progress()).progress;
  },
  async inspect(){
   const plan=await store.read(),seal=await db.prepare('SELECT payload_json FROM opening_world_runs WHERE run_key=? AND batch_index=256').bind(plan.root.runKey).first<{payload_json:string}>();
   if(seal)return {runKey:plan.root.runKey,committedBatches:256,totalBatches:256,completedSlots:6400,remainingSlots:0,idHighWater:plan.root.initialHighWater+6400-plan.root.baseline.length,nextBatch:null,readyForReconciliation:true,published:true,publication:JSON.parse(seal.payload_json)};
   return (await progress()).progress;
  },
  async reconcile(){
   const current=await progress();
   return reconcileCompletedOpening(current.plan.root,current.manifest,current.plan.inventory,current.journal.receipts,current.observation);
  },
  // Private handoff only: actual signing is owned by #801 after #802 funding.
  async contractHandoff(){
   const current=await progress();
   return prepareOpeningContractHandoff(current.plan.root,current.manifest,current.plan.inventory,current.journal.receipts,current.observation);
  },
  /** Bounded sequential signing for one club. Durable rows, not a local cursor,
   * decide what remains after a crash, including a lost response. */
  async signNextClub(session:AdminSession,now:number,limit=25){
   assert(Number.isSafeInteger(limit)&&limit>=1&&limit<=25,'invalid opening signing bound');
   await db.batch([sessionGuard(db,session,now)]);
   if(!signingHandoff){
    const current=await progress();
    signingHandoff=prepareOpeningContractHandoff(current.plan.root,current.manifest,current.plan.inventory,current.journal.receipts,current.observation);
   }
   const handoff=signingHandoff,current=await signedState();
   const staging=await db.prepare('SELECT run_key FROM opening_world_staging WHERE world_generation=?').bind(current.world.generation).first<{run_key:string}>();
   assert(staging?.run_key===handoff.runKey&&current.world.generation===handoff.worldGeneration,'opening signing stage changed');
   const status=inspectOpeningContractHandoff(handoff,current.signed);
   if(!status.next)return status;
   const club=status.next.clubKey,already=new Set(current.signed.map(r=>r.player_id));
   let revision=current.world.revision;
   for(const intent of handoff.intents.filter(i=>i.clubKey===club&&!already.has(i.playerId)).slice(0,limit)){
    const result=await signStagedOpeningContract(db,session,{expectedGeneration:handoff.worldGeneration,expectedRevision:revision,playerId:intent.playerId,clubKey:club,durationSeasons:intent.durationSeasons},intent.idempotencyKey,now,handoff.runKey);
    revision=result.world.revision;
   }
   const after=await signedState();
   return inspectOpeningContractHandoff(handoff,after.signed);
  },
  async publish(session:AdminSession,now:number){
   const plan=await store.read();
   await db.batch([sessionGuard(db,session,now)]);
   const saved=await db.prepare('SELECT payload_json FROM opening_world_runs WHERE run_key=? AND batch_index=256').bind(plan.root.runKey).first<{payload_json:string}>();
   if(saved)return JSON.parse(saved.payload_json);
   const current=await progress(),handoff=prepareOpeningContractHandoff(current.plan.root,current.manifest,current.plan.inventory,current.journal.receipts,current.observation);
   const status=inspectOpeningContractHandoff(handoff,current.signed);
   assert(status.readyForContractReconciliation,'opening contracts incomplete');
   const world=current.world,operationId=crypto.randomUUID();
   // Recheck completed wage commitments against actual cash, not forecast
   // Rewards. The financial journal and holds are append-only. Pin their
   // cardinalities and active policy so no intervening posting/reservation can
   // invalidate any per-club proof before the atomic publication.
   const financeSql="SELECT active_version,posting_enabled,(SELECT COUNT(*) FROM economic_transactions) AS transactions,(SELECT COUNT(*) FROM economic_entries) AS entries,(SELECT COUNT(*) FROM economic_holds) AS holds,(SELECT COUNT(*) FROM economic_hold_releases) AS releases FROM economic_control WHERE id=1";
   const finance=await db.prepare(financeSql).first<{active_version:string;posting_enabled:number;transactions:number;entries:number;holds:number;releases:number}>();
   assert(finance?.posting_enabled===1,'opening finance unavailable');
   for(const club of plan.root.contractClubs)await preparePayrollAffordability(db,world,club,0);
   const f=finance!;
   const financeGuard=abortUnless(db,"SELECT 1 FROM ("+financeSql+") WHERE active_version=? AND posting_enabled=1 AND transactions=? AND entries=? AND holds=? AND releases=?",[f.active_version,f.transactions,f.entries,f.holds,f.releases]);
   const receipt={schema:'opening-publication-v1',runKey:handoff.runKey,allocationHash:handoff.allocationHash,receiptHash:handoff.receiptHash,signedDigest:status.signedDigest,population:6400,contracts:6400,operationId,world:{...world,revision:world.revision+1}};
   const hash=manifestDigest(receipt),seq=current.observation.idHighWater;
   try{
    await db.batch([sessionGuard(db,session,now),requireEconomicGenesisGuard(db,world.generation),economicReconciliationGuard(db),financeGuard,
     abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=? AND phase='unstarted' AND season_number=0 AND day=0",[world.generation,world.revision]),
     db.prepare('INSERT INTO admin_operations(id,generation,idempotency_key,request_hash,account_id,command,expected_revision,resulting_revision,outcome_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(operationId,world.generation,'opening-publish:'+handoff.runKey,hash,session.actor.id,'publish-opening-world-v1',world.revision,receipt.world.revision,JSON.stringify({...receipt,openingRunKey:handoff.runKey}),now),
     db.prepare('INSERT INTO opening_world_runs(run_key,world_generation,batch_index,request_hash,before_high_water,after_high_water,payload_json,draft_id,created_at) VALUES(?,?,256,?,?,?,?,NULL,?)').bind(handoff.runKey,world.generation,hash,seq,seq,JSON.stringify(receipt),now),
     db.prepare('UPDATE world_state SET revision=revision+1 WHERE id=1 AND generation=? AND revision=?').bind(world.generation,world.revision)]);
   }catch(error){
    const existing=await db.prepare('SELECT payload_json FROM opening_world_runs WHERE run_key=? AND batch_index=256').bind(handoff.runKey).first<{payload_json:string}>();
    if(!existing)throw error;
    await db.batch([sessionGuard(db,session,now)]);return JSON.parse(existing.payload_json);
   }
   return receipt;
  },
  async step(session:AdminSession,now:number){
   const current=await progress(),next=current.progress.nextBatch;
   if(!next)return current.progress;
   const intents=prepareOpeningBatchIntents(current.plan.root,current.manifest,current.plan.inventory,next.index);
   await commitLocalOpeningBatch(db,session,current.plan.root.runKey,next.index,next.requestHash,intents,now);
   // Read back durable receipt and catalogue; no in-memory cursor or automatic loop.
   return (await progress()).progress;
  }
 };
}

