// #791 offline persistence protocol; no database access.
import {manifestDigest,planYouthReuse,readChunk,sampleOpeningRetirementAge} from './planner.mjs';
const positiveInt=(x,min=0)=>Number.isSafeInteger(x)&&x>=min;
const isHash=x=>typeof x==="string"&&/^[0-9a-f]{64}$/.test(x);
const insist=(ok,msg)=>{if(!ok)throw Error(msg)};
const equalJson=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const BATCH_SIZE=25;

function verifiedRows(rows,highWater){
 insist(Array.isArray(rows)&&positiveInt(highWater),"invalid inventory");
 const ids=new Set();
 return rows.map(r=>{
  insist(r&&positiveInt(r.id,1)&&r.id<=highWater&&!ids.has(r.id)&&isHash(r.fingerprint),"invalid or duplicate player row");
  ids.add(r.id);return {id:r.id,fingerprint:r.fingerprint};
 }).sort((a,b)=>a.id-b.id);
}
function verifyWorld(world,generation,revision){
 insist(world&&world.generation===generation&&world.revision===revision&&revision===0&&world.seasonNumber===0&&world.day===0&&world.phase==="unstarted","opening world changed or started");
}

// Only this canonical private projection is submitted to the local D1 adapter.
function intentsFor(manifest,reuse,index){
 insist(positiveInt(index)&&index<256,"invalid batch index");
 const offset=index*BATCH_SIZE;
 return readChunk(manifest,offset,BATCH_SIZE).map((s,i)=>{
  const a=reuse.assignments[offset+i];
  insist(a.slotKey===s.slotKey,"slot alignment");
  if(a.kind==="reuse")return {slotKey:s.slotKey,kind:"reuse",playerId:a.playerId};
  return {slotKey:s.slotKey,kind:"generate",slot:{slotKey:s.slotKey,age:s.age,primaryNationality:s.primaryNationality,primaryPosition:s.primaryPosition,primarySuitabilityTarget:s.primarySuitabilityTarget,generatorSeed:s.generatorSeed},privateRetirementAge:sampleOpeningRetirementAge(s)};
 });
}
export function prepareOpeningBatchIntents(run,manifest,inventory,index){
 const reuse=verifyRun(run,manifest,inventory);
 const intents=intentsFor(manifest,reuse,index);
 insist(manifestDigest(intents)===run.batchIntentHashes[index],"batch intent mismatch");
 return intents;
}

// Initial inventory must be complete and certified by a future trusted adapter.
// Fingerprint covers player payload, portrait association and index evidence.
function deriveOpeningPersistence(manifest,inventory,world){
 verifyWorld(world,manifest?.versions?.worldGeneration,manifest?.versions?.worldRevision);
 insist(manifest.slots.length===6400,"reference population size mismatch");
 const reuse=planYouthReuse(manifest,inventory);
 insist(!reuse.requiresReconciliation,"unallocated existing player requires reconciliation");
 const baseline=verifiedRows(inventory.players,inventory.idHighWater);
 const manifestHash=manifestDigest(manifest),inventoryHash=manifestDigest({snapshotId:inventory.snapshotId,idHighWater:inventory.idHighWater,players:inventory.players.slice().sort((a,b)=>a.id-b.id)}),assignmentHash=manifestDigest(reuse.assignments);
 const batchIntentHashes=Array.from({length:256},(_,i)=>manifestDigest(intentsFor(manifest,reuse,i)));
 const identity={schema:"opening-persistence-v2",worldGeneration:world.generation,worldRevision:world.revision,manifestHash,inventoryHash,assignmentHash,batchSize:BATCH_SIZE,slotCount:manifest.slots.length,initialHighWater:inventory.idHighWater,batchIntentHashes,contractClubs:manifest.slots.filter((_,i)=>i%25===0).map(s=>s.clubKey),contractTerms:manifest.slots.map(s=>s.intendedTermSeasons)};
 return {root:{...identity,runKey:manifestDigest(identity),baseline},reuse};
}
export function createOpeningPersistenceRun(manifest,inventory,world){
 return deriveOpeningPersistence(manifest,inventory,world).root;
}
function verifyRun(run,manifest,inventory){
 const rebuilt=deriveOpeningPersistence(manifest,inventory,{generation:run.worldGeneration,revision:run.worldRevision,seasonNumber:0,day:0,phase:"unstarted"});
 insist(equalJson(run,rebuilt.root),"run input or fingerprint changed");
 return rebuilt.reuse;
}
function descriptor(run,manifest,reuse,index){
 const offset=index*run.batchSize,slots=readChunk(manifest,offset,run.batchSize);
 insist(slots.length>0,"batch out of range");
 const entries=slots.map((s,i)=>{
  const a=reuse.assignments[offset+i];
  insist(s.slotKey===a.slotKey,"slot alignment");
  return a.kind==="reuse"?{slotKey:s.slotKey,kind:"reuse",playerId:a.playerId}:{slotKey:s.slotKey,kind:"generate"};
 });
 return {runKey:run.runKey,index,offset,requestHash:manifestDigest({runKey:run.runKey,index,entries}),entries};
}

// Receipts and observations must come from authoritative storage, never a client.
export function inspectOpeningProgress(run,manifest,inventory,receipts,observation){
 insist(run&&Array.isArray(receipts)&&observation?.complete===true,"missing trusted receipts or observation");
 verifyWorld(observation.world,run.worldGeneration,run.worldRevision);
 const reuse=verifyRun(run,manifest,inventory),totalBatches=Math.ceil(run.slotCount/run.batchSize);
 insist(receipts.length<=totalBatches,"too many receipts");
 const sorted=receipts.slice().sort((a,b)=>a.index-b.index);
 const expected=new Map(run.baseline.map(r=>[r.id,r.fingerprint])),used=new Set();
 let highWater=run.initialHighWater;
 for(let i=0;i<sorted.length;i++){
  const receipt=sorted[i],batch=descriptor(run,manifest,reuse,i);
  insist(receipt&&receipt.runKey===run.runKey&&receipt.index===i&&receipt.requestHash===batch.requestHash&&receipt.beforeHighWater===highWater&&Array.isArray(receipt.entries)&&receipt.entries.length===batch.entries.length,"receipt gap, duplicate or mismatch");
  for(let j=0;j<batch.entries.length;j++){
   const plan=batch.entries[j],actual=receipt.entries[j];
   insist(actual&&actual.slotKey===plan.slotKey&&actual.kind===plan.kind&&positiveInt(actual.playerId,1)&&isHash(actual.fingerprint)&&!used.has(actual.playerId),"invalid receipt entry");
   if(plan.kind==="reuse")insist(actual.playerId===plan.playerId&&expected.get(actual.playerId)===actual.fingerprint,"reused player changed");
   else{
    insist(positiveInt(highWater+1,1)&&actual.playerId===highWater+1&&!expected.has(actual.playerId),"new ID is not next high-water");
    highWater++;expected.set(actual.playerId,actual.fingerprint);
   }
   used.add(actual.playerId);
  }
  insist(receipt.afterHighWater===highWater,"receipt high-water mismatch");
 }
 const actual=verifiedRows(observation.rows,observation.idHighWater);
 insist(observation.idHighWater===highWater&&actual.length===expected.size&&actual.every(r=>expected.get(r.id)===r.fingerprint),"catalogue changed or receipt missing");
 const done=sorted.length===totalBatches;
 if(done)insist(used.size===run.slotCount&&expected.size===run.slotCount,"final population mismatch");
 return {runKey:run.runKey,committedBatches:sorted.length,totalBatches,completedSlots:used.size,remainingSlots:run.slotCount-used.size,idHighWater:highWater,nextBatch:done?null:descriptor(run,manifest,reuse,sorted.length),readyForReconciliation:done};
}

// Accept only a self-consistent, canonical inventory envelope from the private
// local adapter. The digest is integrity evidence, not authorization or a signature.
export function createCertifiedOpeningPersistenceRun(manifest,inventory,world){
 insist(inventory?.schema==="opening-inventory-v1"&&inventory.complete===true&&Array.isArray(inventory.players),"invalid certified opening inventory");
 const {worldGeneration,worldRevision,idHighWater,players}=inventory;
 insist(players.every((p,i)=>i===0||players[i-1].id<p.id),"inventory order or duplicate ID");
 insist(manifestDigest({worldGeneration,worldRevision,idHighWater,players})===inventory.snapshotId,"certified inventory digest mismatch");
 return createOpeningPersistenceRun(manifest,inventory,world);
}

// Read-only final audit. A receipt is not a signed club contract and this
// report neither changes world state nor publishes the staged players.
function completeOpeningAudit(run,manifest,inventory,receipts,observation){
 const progress=inspectOpeningProgress(run,manifest,inventory,receipts,observation);
 insist(progress.readyForReconciliation,"opening population incomplete");
 insist(Array.isArray(observation.rawRows)&&observation.rawRows.length===run.slotCount,"missing complete player payload evidence");
 const actual=new Map(observation.rawRows.map(r=>[r.id,r]));
 insist(actual.size===run.slotCount,"duplicate payload evidence");
 const assignments=new Map(receipts.flatMap(r=>r.entries).map(e=>[e.slotKey,e]));
 insist(assignments.size===run.slotCount,"duplicate slot assignments");
 const clubs=new Map(manifest.clubs.map(c=>[c.key,{clubKey:c.key,active:c.active,division:c.division,count:0}]));
 const home=new Map(manifest.clubs.map(c=>[c.key,c.nationality]));
 const ages={},positions={},nationalities={},terms={};
 let reused=0,generated=0,domestic=0,otherPlayable=0,otherCountries=0;
 const playable=new Set(manifest.clubs.map(c=>c.nationality));
 const increment=(map,key)=>{map[key]=(map[key]??0)+1};
 const allocations=[];
 for(const slot of manifest.slots){
  const entry=assignments.get(slot.slotKey),row=entry&&actual.get(entry.playerId),club=clubs.get(slot.clubKey);
  insist(row&&club?.active&&club.division===slot.division,"opening allocation missing or inactive");
  const p=JSON.parse(row.payload_json);
  insist(p.id===entry.playerId&&p.age===slot.age&&p.initial_age===slot.age&&p.nationality===slot.primaryNationality&&p.primary_position===slot.primaryPosition&&p.career_status==="active","opening payload differs from planned slot");
  const correctOrigin=row.world_generation===run.worldGeneration&&row.entry_season===0;
  insist(correctOrigin&&row.schema_version==="player-portraits-v5"&&row.prompt_version==="player-portrait-v4.2"&&typeof row.config_version==="string"&&row.config_version.length>0,"opening profile/index evidence missing");
  if(entry.kind==="reuse")reused++;
  else{generated++;insist(p.retirement_age===sampleOpeningRetirementAge(slot),"opening retirement differs from pinned slot")}
  club.count++;
  increment(ages,p.age);increment(positions,p.primary_position);increment(nationalities,p.nationality);increment(terms,slot.intendedTermSeasons);
  if(p.nationality===home.get(slot.clubKey))domestic++;
  else if(playable.has(p.nationality))otherPlayable++;
  else otherCountries++;
  // Include assignment intents in the private digest, not in the public report.
  allocations.push({slotKey:slot.slotKey,clubKey:slot.clubKey,playerId:entry.playerId,kind:entry.kind,intendedTermSeasons:slot.intendedTermSeasons,fingerprint:entry.fingerprint});
 }
 const clubCounts=[...clubs.values()];
 insist(clubCounts.length===320&&clubCounts.filter(c=>c.active&&c.division===1).length===128&&clubCounts.filter(c=>c.active&&c.division===2).length===128&&clubCounts.every(c=>c.count===(c.active?25:0)),"opening roster count mismatch");
 insist(domestic===4160&&reused===run.baseline.length&&generated+reused===6400,"opening population totals mismatch");
 for(const expected of manifest.config.ageCounts)insist((ages[expected.age]??0)===expected.count,"opening age quota mismatch");
 const report={schema:"opening-local-reconciliation-v1",runKey:run.runKey,manifestHash:run.manifestHash,allocationHash:manifestDigest(allocations),receiptHash:manifestDigest(receipts.slice().sort((a,b)=>a.index-b.index)),population:6400,reused,generated,activeClubs:256,inactiveClubs:64,clubCounts,ages,positions,nationalities,terms,domestic,otherPlayable,otherCountries,stagedOnly:true};
 return {report,allocations};
}
export function reconcileCompletedOpening(run,manifest,inventory,receipts,observation){
 return completeOpeningAudit(run,manifest,inventory,receipts,observation).report;
}

// Private, deterministic handoff to #801. No wage, signature, funds or consent
// are invented here. Source must be the reconciled D1 catalogue and receipts.
export function prepareOpeningContractHandoff(run,manifest,inventory,receipts,observation){
 const {report,allocations}=completeOpeningAudit(run,manifest,inventory,receipts,observation);
 const intents=allocations.map(a=>({playerId:a.playerId,clubKey:a.clubKey,division:manifest.clubs.find(c=>c.key===a.clubKey).division,durationSeasons:a.intendedTermSeasons,
  slotKey:a.slotKey,kind:a.kind,fingerprint:a.fingerprint,signingKey:'initial:'+run.worldGeneration+':'+a.playerId,
  idempotencyKey:'opening:'+manifestDigest({runKey:run.runKey,slotKey:a.slotKey,playerId:a.playerId})}));
 const payload={schema:"opening-contract-handoff-v1",worldGeneration:run.worldGeneration,runKey:run.runKey,
  allocationHash:report.allocationHash,receiptHash:report.receiptHash,intents};
 return {...payload,digest:manifestDigest(payload)};
}

// Read-only audit of authoritative signed contract rows, never allocation
// intents masquerading as club membership. Partial matching terms can resume;
// missing funding/quote authority must still block every signing in #801.
export function inspectOpeningContractHandoff(handoff,rows){
 const {digest,...payload}=handoff;
 insist(payload.schema==="opening-contract-handoff-v1"&&manifestDigest(payload)===digest&&Array.isArray(payload.intents)&&payload.intents.length===6400,"invalid opening contract handoff");
 const expected=new Map(payload.intents.map(x=>[x.playerId,x]));
 insist(expected.size===6400&&Array.isArray(rows),"invalid opening contract inventory");
 const seen=new Set(),ids=new Set();
 for(const row of rows){
  const intent=expected.get(row.player_id);
  insist(intent&&!seen.has(row.player_id)&&positiveInt(row.id,1)&&!ids.has(row.id)&&row.world_generation===payload.worldGeneration&&row.club_key===intent.clubKey&&row.duration_seasons===intent.durationSeasons&&row.start_tick===0&&row.scheduled_end_tick===56*intent.durationSeasons&&row.closed_tick===null&&row.close_reason===null&&row.signed_mandate_id===null&&row.signing_key===intent.signingKey&&positiveInt(row.signed_at_ms,1),"unexpected signed opening contract");
  // Contract schema enforces the approved DRAFT bounds; audit the persisted
  // policy/version and fixed AI demand, not a replacement salary calculation.
  insist(row.policy_version==="contract-draft-v1"&&row.minimum_arc===(intent.division===1?40:20)&&positiveInt(row.reference_arc,row.minimum_arc)&&positiveInt(row.maximum_arc,row.reference_arc)&&positiveInt(row.annual_salary_arc,row.minimum_arc)&&row.annual_salary_arc<=row.maximum_arc&&row.ai_demand_arc===row.annual_salary_arc&&row.maximum_arc===2*row.reference_arc&&row.ai_demand_arc===Math.ceil(5*row.reference_arc/4),"invalid signed opening wage snapshot");
  seen.add(row.player_id);ids.add(row.id);
 }
 const missing=payload.intents.filter(x=>!seen.has(x.playerId));
 return {schema:"opening-contract-progress-v1",handoffDigest:digest,signed:seen.size,remaining:missing.length,
  next:missing[0]??null,readyForContractReconciliation:missing.length===0,
  signedDigest:manifestDigest(rows.slice().sort((a,b)=>a.player_id-b.player_id))};
}
