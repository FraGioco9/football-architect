/** #791 explicit local rehearsal library. No CLI, HTTP route, auto-loop, remote
 * binding or publication. Only open the project's verified local Miniflare state.
 * Callers must hold exclusive access to this disposable directory.
 */
import {open,readFile,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {openLocalDatabase} from './operator-local.mts';
import {loadApprovedSnapshot,serverCanonicalCatalogue} from '../src/approved-season-one.ts';
import {loadRuntimePlayerCatalog} from '../src/players-catalog.mjs';
import {readWorld} from '../src/world-repository.ts';
import type {WorldV1} from '../src/types.ts';
import type {AdminSession} from '../src/auth.ts';
import {sessionGuard,abortUnless} from '../src/command-guards.ts';
import {requireEconomicGenesisGuard} from '../src/economic-genesis.ts';
import {economicReconciliationGuard} from '../src/economic-ledger.ts';
import {signStagedOpeningContract} from '../src/player-club-contracts.ts';
import {readLocalOpeningInventory,type RetainedOpeningInput} from '../src/opening-world-inventory.ts';
import {rebaseLocalRetainedPlayers} from '../src/opening-world-retained.ts';
import {beginLocalOpeningRun,commitLocalOpeningBatch,readLocalOpeningJournal,readOpeningObservation} from '../src/opening-world-store.ts';
import {clubCountryToNationality,planApprovedReference,reserveRetainedFirst,manifestDigest,REFERENCE_PROFILE_VERSION,type OpeningClub} from '../../tools/world-bootstrap-791/planner.mjs';
import {createCertifiedOpeningPersistenceRun,inspectOpeningProgress,prepareOpeningBatchIntents,reconcileCompletedOpening,prepareOpeningContractHandoff,inspectOpeningContractHandoff,type OpeningSignedRow,type OpeningInventory,type OpeningRoot} from '../../tools/world-bootstrap-791/persistence.mjs';

const assert=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg)};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const FILE='opening-world-plan.private.json';
const MAX_BYTES=8*1024*1024;
type Plan={schema:'opening-local-rehearsal-v1';seed:string;inventory:OpeningInventory;root:OpeningRoot;retained?:RetainedOpeningInput};
function checkWorld(world:WorldV1){
 assert(world.seasonNumber===0&&world.day===0&&world.revision===0&&world.phase==='unstarted','opening rehearsal requires fresh Season 0');
}
export async function buildLocalOpeningManifest(world:WorldV1,seed:string){
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
 const sources=await Promise.all(['../src/players-generator-core.mjs','../src/opening-world-inventory.ts','../src/opening-world-retained.ts','../../tools/world-bootstrap-791/planner.mjs','../../tools/world-bootstrap-791/persistence.mjs'].map(path=>readFile(new URL(path,import.meta.url))));
 const catalog=loadRuntimePlayerCatalog();
 const versions={worldGeneration:world.generation,worldRevision:world.revision,
  clubSnapshot:manifestDigest({participantsHash:snapshot.participantsHash,rulesHash:snapshot.rulesHash,clubs}),
  generator:manifestDigest(sources.map(sha)),catalog:manifestDigest({given:[...catalog.given],surnames:[...catalog.surnames],surnameSource:catalog.surnameSource}),policy:REFERENCE_PROFILE_VERSION};
 return planApprovedReference({seed,versions,clubs});
}
async function readPrivatePlan(path:string):Promise<Plan>{
 const info=await lstat(path);
 assert(info.isFile()&&!info.isSymbolicLink()&&info.size<=MAX_BYTES,'invalid private opening plan file');
 const plan=JSON.parse(await readFile(path,'utf8')) as Plan;
 assert(plan?.schema==='opening-local-rehearsal-v1'&&typeof plan.seed==='string'&&!!plan.inventory&&!!plan.root,'invalid opening plan');
 return plan;
}
async function savePrivatePlan(path:string,plan:Plan){
 const bytes=JSON.stringify(plan);
 assert(Buffer.byteLength(bytes)<=MAX_BYTES,'opening plan exceeds local file bound');
 // Exclusive creation; if interrupted before sync the file is invalid and no
 // journal has begun. Never overwrite an existing input or resume from a cursor.
 const handle=await open(path,'wx',0o600);
 try{await handle.writeFile(bytes,'utf8');await handle.sync()}finally{await handle.close()}
}
export async function openLocalOpeningRehearsal(persistTo:string){
 // Existing explicitly local state only. Test setup applies migrations separately.
 const handle=await openLocalDatabase(persistTo,{requireExisting:true,migrate:false});
 const db=handle.db,path=join(resolve(persistTo),FILE);
 async function verifiedPlan(){
  const plan=await readPrivatePlan(path),world=await readWorld(db);
  assert(world.generation===plan.root.worldGeneration&&world.seasonNumber===0&&world.day===0&&world.phase==='unstarted','opening world changed or started');
  const initialWorld={...world,revision:0};
  const manifest=reserveRetainedFirst(await buildLocalOpeningManifest(initialWorld,plan.seed),plan.inventory);
  const rebuilt=createCertifiedOpeningPersistenceRun(manifest,plan.inventory,initialWorld);
  assert(same(plan.root,rebuilt),'opening plan or canonical source changed');
  return {plan,manifest,world};
 }
 async function progress(){
  const {plan,manifest}=await verifiedPlan();
  const journal=await readLocalOpeningJournal(db,plan.root.runKey);
  assert(same(journal.root,plan.root),'opening journal root differs from private plan');
  const actual=await readOpeningObservation(db);
  const signed:OpeningSignedRow[]=[];
  for(let id=0;;){
   const rows=(await db.prepare('SELECT * FROM player_signed_contracts WHERE id>? ORDER BY id LIMIT 100').bind(id).all<OpeningSignedRow>()).results;
   signed.push(...rows);if(rows.length<100)break;id=rows[rows.length-1].id;
  }
  assert(same(actual.world,await readWorld(db))&&actual.world.generation===plan.root.worldGeneration&&actual.world.revision===signed.length&&(signed.length===0||journal.receipts.length===256),'opening signing progress changed');
  const observation={...actual,world:{...actual.world,revision:0}};
  return {plan,manifest,journal,observation,signed,world:actual.world,progress:inspectOpeningProgress(plan.root,manifest,plan.inventory,journal.receipts,observation)};
 }
 return {
  close:handle.close,
  async rebaseRetained(session:AdminSession,retained:RetainedOpeningInput,now:number){
   return rebaseLocalRetainedPlayers(db,session,retained.evidence,retained.resetOperationId,now);
  },
  async prepare(seed:string,retained?:RetainedOpeningInput){
   const world=await readWorld(db),inventory=await readLocalOpeningInventory(db,retained),manifest=reserveRetainedFirst(await buildLocalOpeningManifest(world,seed),inventory);
   const root=createCertifiedOpeningPersistenceRun(manifest,inventory,world);
   await savePrivatePlan(path,{schema:'opening-local-rehearsal-v1',seed,inventory,root,...(retained?{retained}:{})});
   return {runKey:root.runKey,slots:root.slotCount,reused:root.baseline.length,newPlayers:root.slotCount-root.baseline.length,batches:root.batchIntentHashes.length};
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
   await beginLocalOpeningRun(db,session,plan.root,now);
   return (await progress()).progress;
  },
  async inspect(){return (await progress()).progress},
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
  async signNextClub(session:AdminSession,now:number){
   await db.batch([sessionGuard(db,session,now)]);
   const current=await progress(),handoff=prepareOpeningContractHandoff(current.plan.root,current.manifest,current.plan.inventory,current.journal.receipts,current.observation);
   const status=inspectOpeningContractHandoff(handoff,current.signed);
   if(!status.next)return status;
   const club=status.next.clubKey,already=new Set(current.signed.map(r=>r.player_id));
   let revision=current.world.revision;
   for(const intent of handoff.intents.filter(i=>i.clubKey===club&&!already.has(i.playerId))){
    const result=await signStagedOpeningContract(db,session,{expectedGeneration:handoff.worldGeneration,expectedRevision:revision,playerId:intent.playerId,clubKey:club,durationSeasons:intent.durationSeasons},intent.idempotencyKey,now,handoff.runKey);
    revision=result.world.revision;
   }
   const after=await progress();
   return inspectOpeningContractHandoff(handoff,after.signed);
  },
  async publish(session:AdminSession,now:number){
   const plan=await readPrivatePlan(path);
   await db.batch([sessionGuard(db,session,now)]);
   const saved=await db.prepare('SELECT payload_json FROM opening_world_runs WHERE run_key=? AND batch_index=256').bind(plan.root.runKey).first<{payload_json:string}>();
   if(saved)return JSON.parse(saved.payload_json);
   const current=await progress(),handoff=prepareOpeningContractHandoff(current.plan.root,current.manifest,current.plan.inventory,current.journal.receipts,current.observation);
   const status=inspectOpeningContractHandoff(handoff,current.signed);
   assert(status.readyForContractReconciliation,'opening contracts incomplete');
   const world=current.world,operationId=crypto.randomUUID();
   const receipt={schema:'opening-publication-v1',runKey:handoff.runKey,allocationHash:handoff.allocationHash,receiptHash:handoff.receiptHash,signedDigest:status.signedDigest,population:6400,contracts:6400,operationId,world:{...world,revision:world.revision+1}};
   const hash=manifestDigest(receipt),seq=current.observation.idHighWater;
   try{
    await db.batch([sessionGuard(db,session,now),requireEconomicGenesisGuard(db,world.generation),economicReconciliationGuard(db),
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
