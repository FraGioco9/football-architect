/** #791: internal local rehearsal adapter. NOT reachable from Worker HTTP routes.
 * Caller must supply a server-verified, pinned offline manifest/assignment. Do
 * not enable shared use until inventory, publication and reset guards are wired.
 */
import type {Database,Statement} from './database.ts';
import type {AdminSession} from './auth.ts';
import {sessionGuard} from './command-guards.ts';
import {abortUnless} from './atomic-guard.ts';
import {readWorld} from './world-repository.ts';
import {playerRecord} from './players-generation-command.ts';
import {generateOpeningCandidateWithCatalog} from './players-generator-core.mjs';
import {loadRuntimePlayerCatalog} from './players-catalog.mjs';
import {buildFamilyV42PortraitSnapshotForPlayer} from './player-portrait-family-v42.mjs';
import {resolveCatalogueNameOrigins} from './player-portrait-name-origins.mjs';
import {marketValueIndexVersion,marketValueIndexUpdate,marketValueIndexWrite} from './player-market-value-index.ts';

type Fingerprint={id:number;fingerprint:string};
type Root={schema:string;worldGeneration:string;worldRevision:number;manifestHash:string;inventoryHash:string;assignmentHash:string;batchSize:number;slotCount:number;initialHighWater:number;runKey:string;baseline:Fingerprint[]};
type Slot={slotKey:string;age:number;primaryNationality:string;primaryPosition:string;primarySuitabilityTarget:number;generatorSeed:string};
type Intent={slotKey:string;kind:'reuse';playerId:number}|{slotKey:string;kind:'generate';slot:Slot;privateRetirementAge:number};
type Entry={slotKey:string;kind:'reuse'|'generate';playerId:number;fingerprint:string};
type Receipt={runKey:string;index:number;requestHash:string;beforeHighWater:number;afterHighWater:number;entries:Entry[]};
type SnapshotRow={id:number;batch_id:string;world_generation:string;entry_season:number;payload_json:string;schema_version:string;prompt_version:string;snapshot_json:string;status:string;asset_key:string|null;input_revision:number;config_version:string|null;market_value_arc:number|null};
const insist=(ok:unknown,message:string)=>{if(!ok)throw Error(message)};
const isHash=(x:string)=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
export async function openingDigest(value:unknown){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));
 return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
}
function tuple(r:SnapshotRow){return [r.id,r.batch_id,r.world_generation,r.entry_season,r.payload_json,r.schema_version,r.prompt_version,r.snapshot_json,r.status,r.asset_key,r.input_revision,r.config_version,r.market_value_arc]}
async function fingerprint(r:SnapshotRow):Promise<Fingerprint>{return {id:r.id,fingerprint:await openingDigest(tuple(r))}}
const selectRows=`SELECT p.id,p.batch_id,p.world_generation,p.entry_season,p.payload_json,
 q.schema_version,q.prompt_version,q.snapshot_json,q.status,q.asset_key,v.input_revision,v.config_version,v.market_value_arc
 FROM generated_players p LEFT JOIN player_portrait_profiles q ON q.player_id=p.id LEFT JOIN player_market_values v ON v.player_id=p.id`;
const highWaterSql="SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0) AS n";
export async function readOpeningObservation(db:Database){
 const world=await readWorld(db),seq=(await db.prepare(highWaterSql).first<{n:number}>())!.n;
 const rows:SnapshotRow[]=[];
 for(let id=0;;){
  const page=(await db.prepare(selectRows+' WHERE p.id>? ORDER BY p.id LIMIT 100').bind(id).all<SnapshotRow>()).results;
  rows.push(...page);if(page.length<100)break;id=page[page.length-1].id;
 }
 insist(rows.every(r=>r.snapshot_json!=null&&r.config_version!=null&&Number.isSafeInteger(r.id)&&r.id<=seq),'missing portrait or value index');
 const after=await readWorld(db);
 insist(JSON.stringify(after)===JSON.stringify(world)&&(await db.prepare(highWaterSql).first<{n:number}>())?.n===seq,'opening observation changed');
 return {world,complete:true,idHighWater:seq,rows:await Promise.all(rows.map(fingerprint)),rawRows:rows};
}
function worldGuard(db:Database,generation:string){
 return abortUnless(db,"SELECT 1 FROM world_state WHERE id=1 AND generation=? AND revision=0 AND season_number=0 AND day=0 AND phase='unstarted'",[generation]);
}
function sequenceGuard(db:Database,n:number,count:number){
 return abortUnless(db,"SELECT 1 WHERE COALESCE((SELECT seq FROM sqlite_sequence WHERE name='generated_players'),0)=? AND (SELECT COUNT(*) FROM generated_players)=?",[n,count]);
}
function receiptInsert(db:Database,root:Root,index:number,hash:string,before:number,after:number,value:unknown,draftId:string|null,now:number){
 return db.prepare('INSERT INTO opening_world_runs(run_key,world_generation,batch_index,request_hash,before_high_water,after_high_water,payload_json,draft_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
 .bind(root.runKey,root.worldGeneration,index,hash,before,after,JSON.stringify(value),draftId,now);
}
function sameRows(a:Fingerprint[],b:Fingerprint[]){
 const sorted=(v:Fingerprint[])=>v.slice().sort((x,y)=>x.id-y.id);
 return JSON.stringify(sorted(a))===JSON.stringify(sorted(b));
}
export async function beginLocalOpeningRun(db:Database,session:AdminSession,root:Root,now:number){
 const {runKey,baseline,...identity}=root;
 insist(identity.schema==='opening-persistence-v1'&&identity.worldRevision===0&&identity.batchSize===25&&identity.slotCount===6400&&[identity.manifestHash,identity.inventoryHash,identity.assignmentHash,runKey].every(isHash)&&await openingDigest(identity)===runKey,'invalid opening run identity');
 const observed=await readOpeningObservation(db);
 insist(observed.world.generation===root.worldGeneration&&observed.idHighWater===root.initialHighWater&&sameRows(observed.rows,baseline),'initial inventory mismatch');
 await db.batch([sessionGuard(db,session,now),worldGuard(db,root.worldGeneration),sequenceGuard(db,root.initialHighWater,baseline.length),receiptInsert(db,root,-1,runKey,root.initialHighWater,root.initialHighWater,root,null,now)]);
}

export async function readLocalOpeningJournal(db:Database,runKey:string){
 const rows=(await db.prepare('SELECT batch_index,payload_json FROM opening_world_runs WHERE run_key=? ORDER BY batch_index').bind(runKey).all<{batch_index:number;payload_json:string}>()).results;
 insist(rows.length>0&&rows[0].batch_index===-1,'opening run missing');
 const root=JSON.parse(rows[0].payload_json) as Root;
 const receipts=rows.slice(1).map((r,i)=>{insist(r.batch_index===i,'opening receipt gap');return JSON.parse(r.payload_json) as Receipt});
 return {root,receipts};
}
function reconcile(root:Root,receipts:Receipt[],observation:Awaited<ReturnType<typeof readOpeningObservation>>){
 insist(observation.world.generation===root.worldGeneration&&observation.world.seasonNumber===0&&observation.world.revision===0&&observation.world.phase==='unstarted','stale opening world');
 const expected=new Map(root.baseline.map(r=>[r.id,r.fingerprint]));
 const used=new Set<number>(),slots=new Set<string>();let seq=root.initialHighWater;
 for(const [i,r] of receipts.entries()){
  insist(r.runKey===root.runKey&&r.index===i&&r.beforeHighWater===seq&&r.entries.length===25,'invalid opening receipt');
  for(const e of r.entries){
   insist(!used.has(e.playerId)&&!slots.has(e.slotKey)&&isHash(e.fingerprint),'duplicate opening receipt entry');
   if(e.kind==='reuse')insist(expected.get(e.playerId)===e.fingerprint,'reused player changed');
   else{insist(e.kind==='generate'&&e.playerId===++seq&&!expected.has(e.playerId),'invalid new player id');expected.set(e.playerId,e.fingerprint)}
   used.add(e.playerId);slots.add(e.slotKey);
  }
  insist(r.afterHighWater===seq,'invalid receipt sequence');
 }
 insist(seq===observation.idHighWater&&sameRows([...expected].map(([id,fingerprint])=>({id,fingerprint})),observation.rows),'opening catalogue reconciliation failed');
 return {used,slots};
}

/** Local test/rehearsal only: no public route or activation. The offline planner
 * must have already checked manifest/assignment and provided the exact next intents.
 * New identity/attributes, portraits and values use the canonical generators.
 */
export async function commitLocalOpeningBatch(db:Database,session:AdminSession,runKey:string,index:number,requestHash:string,intents:Intent[],now:number){
 insist(Number.isInteger(index)&&index>=0&&index<256&&intents.length===25&&new Set(intents.map(e=>e.slotKey)).size===25,'invalid opening batch');
 const descriptor=intents.map(e=>e.kind==='reuse'?{slotKey:e.slotKey,kind:e.kind,playerId:e.playerId}:{slotKey:e.slotKey,kind:e.kind});
 insist(await openingDigest({runKey,index,entries:descriptor})===requestHash,'opening request hash mismatch');
 const {root,receipts}=await readLocalOpeningJournal(db,runKey),observed=await readOpeningObservation(db);
 const {used,slots}=reconcile(root,receipts,observed);
 // Live authorization also required on retries.
 if(index<receipts.length){
  insist(receipts[index].requestHash===requestHash,'opening retry conflict');
  await db.batch([sessionGuard(db,session,now),worldGuard(db,root.worldGeneration)]);
  return {receipt:receipts[index],alreadyCommitted:true};
 }
 insist(index===receipts.length&&intents.every(e=>!slots.has(e.slotKey)),'opening batch gap');
 const seen=new Set<number>(),baseline=new Map(root.baseline.map(x=>[x.id,x.fingerprint]));
 for(const e of intents)if(e.kind==='reuse'){
  insist(!used.has(e.playerId)&&!seen.has(e.playerId)&&baseline.has(e.playerId),'invalid reuse');
  seen.add(e.playerId);
 }
 const before=observed.idHighWater,entries:Entry[]=[],records:ReturnType<typeof playerRecord>[]=[],newRows:SnapshotRow[]=[],snapshots:Awaited<ReturnType<typeof buildFamilyV42PortraitSnapshotForPlayer>>[]=[],updates:ReturnType<typeof marketValueIndexUpdate>[]=[];
 const draftId=intents.some(e=>e.kind==='generate')?crypto.randomUUID():null;
 const catalog=draftId?loadRuntimePlayerCatalog():null,indexVersion=await marketValueIndexVersion();
 let seq=before;
 for(const e of intents){
  if(e.kind==='reuse'){entries.push({slotKey:e.slotKey,kind:e.kind,playerId:e.playerId,fingerprint:baseline.get(e.playerId)!});continue}
  insist(e.kind==='generate'&&e.slot.slotKey===e.slotKey&&Number.isInteger(e.privateRetirementAge)&&e.privateRetirementAge>e.slot.age&&e.privateRetirementAge>=33&&e.privateRetirementAge<=40,'invalid opening candidate');
  const candidate=playerRecord(generateOpeningCandidateWithCatalog(e.slot,catalog!)),id=++seq;
  insist(Number.isSafeInteger(id),'player sequence overflow');
  const payload=Object.fromEntries(Object.entries(candidate).flatMap(([key,value])=>key==='age'?[[key,value],['retirement_age',e.privateRetirementAge]]:[[key,value]]));
  payload.id=id;
  const portrait=await buildFamilyV42PortraitSnapshotForPlayer({...candidate,id,name_origins:resolveCatalogueNameOrigins(candidate)});
  const update=marketValueIndexUpdate(id,0,null,candidate);
  const row={id,batch_id:draftId!,world_generation:root.worldGeneration,entry_season:0,payload_json:JSON.stringify(payload),schema_version:portrait.schema_version,prompt_version:portrait.prompt_version,snapshot_json:JSON.stringify(portrait),status:'pending',asset_key:null,input_revision:0,config_version:indexVersion,market_value_arc:update.value};
  records.push(candidate);newRows.push(row);snapshots.push(portrait);updates.push(update);
  entries.push({slotKey:e.slotKey,kind:e.kind,playerId:id,fingerprint:(await fingerprint(row)).fingerprint});
 }
 const receipt={runKey,index,requestHash,beforeHighWater:before,afterHighWater:seq,entries};
 const statements:Statement[]=[sessionGuard(db,session,now),worldGuard(db,root.worldGeneration),sequenceGuard(db,before,observed.rows.length),
  abortUnless(db,'SELECT 1 WHERE (SELECT COUNT(*) FROM opening_world_runs WHERE run_key=? AND batch_index>=0)=?',[runKey,index])];
 if(draftId){
  // Private retirement is in the permanent payload only; ordinary draft JSON is sanitized.
  statements.push(db.prepare("INSERT INTO player_generation_drafts(id,world_generation,season_number,account_id,options_json,candidates_json,count,seed,status,created_at,expires_at,committed_at) VALUES(?,?,0,?,?,?,?,?,'committed',?,?,?)")
   .bind(draftId,root.worldGeneration,session.unified!.playerId,JSON.stringify({mode:'opening-world-internal',runKey,index}),JSON.stringify(records),records.length,'opening-'+index,now,now+3600,now));
  statements.push(db.prepare(`INSERT INTO generated_players(id,batch_id,world_generation,entry_season,payload_json,created_at)
   SELECT json_extract(value,'$.id'),?,?,0,json_extract(value,'$.payload_json'),? FROM json_each(?) ORDER BY CAST(key AS INTEGER)`)
   .bind(draftId,root.worldGeneration,now,JSON.stringify(newRows.map(r=>({id:r.id,payload_json:r.payload_json})))));
  statements.push(db.prepare(`INSERT INTO player_portrait_profiles(player_id,schema_version,prompt_version,snapshot_json,status,asset_key,created_at)
   SELECT json_extract(value,'$.player_id'),json_extract(value,'$.schema_version'),json_extract(value,'$.prompt_version'),value,'pending',NULL,? FROM json_each(?) ORDER BY CAST(key AS INTEGER)`).bind(now,JSON.stringify(snapshots)));
  statements.push(marketValueIndexWrite(db,indexVersion,updates));
  statements.push(abortUnless(db,`SELECT 1 WHERE (SELECT COUNT(*) FROM generated_players p JOIN player_portrait_profiles q ON q.player_id=p.id JOIN player_market_values v ON v.player_id=p.id WHERE p.batch_id=? AND q.schema_version='player-portraits-v5' AND q.prompt_version='player-portrait-v4.2' AND v.config_version=?)=?`,[draftId,indexVersion,records.length]));
 }
 statements.push(sequenceGuard(db,seq,observed.rows.length+records.length),receiptInsert(db,root,index,requestHash,before,seq,receipt,draftId,now));
 await db.batch(statements);
 return {receipt,alreadyCommitted:false};
}
