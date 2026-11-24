// #791 offline persistence protocol; no database access.
import {manifestDigest,planYouthReuse,readChunk} from './planner.mjs';
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

// Initial inventory must be complete and certified by a future trusted adapter.
// Fingerprint covers player payload, portrait association and index evidence.
export function createOpeningPersistenceRun(manifest,inventory,world){
 verifyWorld(world,manifest?.versions?.worldGeneration,manifest?.versions?.worldRevision);
 insist(manifest.slots.length===6400,"reference population size mismatch");
 const reuse=planYouthReuse(manifest,inventory);
 insist(!reuse.requiresReconciliation,"unallocated existing player requires reconciliation");
 const baseline=verifiedRows(inventory.players,inventory.idHighWater);
 const manifestHash=manifestDigest(manifest),inventoryHash=manifestDigest({snapshotId:inventory.snapshotId,idHighWater:inventory.idHighWater,players:inventory.players.slice().sort((a,b)=>a.id-b.id)}),assignmentHash=manifestDigest(reuse.assignments);
 const identity={schema:"opening-persistence-v1",worldGeneration:world.generation,worldRevision:world.revision,manifestHash,inventoryHash,assignmentHash,batchSize:BATCH_SIZE,slotCount:manifest.slots.length,initialHighWater:inventory.idHighWater};
 return {...identity,runKey:manifestDigest(identity),baseline};
}
function verifyRun(run,manifest,inventory){
 const rebuilt=createOpeningPersistenceRun(manifest,inventory,{generation:run.worldGeneration,revision:run.worldRevision,seasonNumber:0,day:0,phase:"unstarted"});
 insist(equalJson(run,rebuilt),"run input or fingerprint changed");
 return planYouthReuse(manifest,inventory);
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
