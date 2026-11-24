// #791 — offline pure planner tests; owned by Site FULL.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createOpeningPersistenceRun,inspectOpeningProgress,prepareOpeningBatchIntents} from '../tools/world-bootstrap-791/persistence.mjs';
import {loadRuntimePlayerCatalog} from '../backend/src/players-catalog.mjs';
import {stationaryAgeQuotas,planOpeningPopulation,readChunk,manifestDigest,approvedReferenceProfile,planApprovedReference,REFERENCE_PROFILE_VERSION,planYouthReuse,clubCountryToNationality,approvedForeignWeights,sampleOpeningRetirementAge,prepareOpeningCandidateChunk} from '../tools/world-bootstrap-791/planner.mjs';

function requireThat(ok,msg){if(!ok)throw new Error(msg)}

function int(n,min,max){return Number.isSafeInteger(n)&&n>=min&&n<=max}

function apportion(total,weights){requireThat(int(total,0,100000)&&Array.isArray(weights)&&weights.length>0&&weights.every(w=>Number.isFinite(w)&&w>=0),"invalid weights");const sum=weights.reduce((a,b)=>a+b,0);requireThat(Number.isFinite(sum)&&sum>0,"zero weights");const exact=weights.map(w=>w/sum*total),out=exact.map(Math.floor);const ranked=exact.map((v,i)=>({i,frac:v-out[i]})).sort((a,b)=>b.frac-a.frac||a.i-b.i);const left=total-out.reduce((a,b)=>a+b,0);requireThat(left>=0&&left<=weights.length,"apportionment error");for(let j=0;j<left;j++)out[ranked[j].i]++;return out}

function fixture(){
 const clubs=Array.from({length:320},(_,i)=>({key:"club-"+String(i).padStart(3,"0"),nationality:i%2?"ITA":"ENG",division:i<128?1:i<256?2:null,active:i<256}));
 return {seed:"fixture",versions:{worldGeneration:"fixture-world",worldRevision:0,clubSnapshot:"fixture",generator:"fixture",catalog:"fixture",policy:"fixture"},clubs,roster:{GK:3,RB:2,CB:4,LB:2,RWB:1,LWB:1,DM:2,CM:3,AM:1,RM:1,LM:1,RW:1,LW:1,ST:2},ageCounts:[{age:16,count:915},{age:23,count:1308},{age:28,count:1635},{age:32,count:1304},{age:35,count:891},{age:39,count:347}],agePolicies:[{minAge:16,maxAge:19,d1Mean:61,d2Mean:61,sigma:7,termWeights:[15,35,50]},{minAge:20,maxAge:23,d1Mean:65,d2Mean:61,sigma:7,termWeights:[20,40,40]},{minAge:24,maxAge:28,d1Mean:67,d2Mean:63,sigma:7,termWeights:[25,45,30]},{minAge:29,maxAge:39,d1Mean:68,d2Mean:64,sigma:7,termWeights:[50,35,15]}],foreignWeights:[{code:"ENG",weight:1},{code:"ITA",weight:1},{code:"BRA",weight:1}]};
}

function eq(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error("not equal")}

function throws(fn){let caught=false;try{fn()}catch{caught=true}requireThat(caught,"expected rejection")}

function testStationary(){const h=Array.from({length:24},(_,i)=>({33:.02,34:.05,35:.12,36:.25,37:.45,38:.70,39:.90,40:1}[i+17]||0));const s=stationaryAgeQuotas(6400,[30,35,20,15],h);eq(s.ageCounts.reduce((a,b)=>a+b.count,0),6400);eq(s.ageCounts.map(x=>x.count),[98,212,278,327,327,327,327,327,327,327,327,327,327,326,326,326,326,320,304,267,201,110,33,3]);requireThat(Math.abs(s.expectedAnnualEntrants-326.627)<.001,"wrong turnover");throws(()=>stationaryAgeQuotas(6400,[30,35,20,15],h.slice(0,-1)))}

function testReplay(){const f=fixture(),p=planOpeningPopulation(f);eq(p,planOpeningPopulation(f));eq(p,planOpeningPopulation({...f,clubs:[...f.clubs].reverse(),ageCounts:[...f.ageCounts].reverse(),agePolicies:[...f.agePolicies].reverse(),foreignWeights:[...f.foreignWeights].reverse()}));requireThat(JSON.stringify(p.slots)!==JSON.stringify(planOpeningPopulation({...f,seed:"different"}).slots),"seed did not change slots");const all=[];for(let offset=0;offset<p.slots.length;offset+=25)all.push(...readChunk(p,offset,25));eq(all,p.slots);eq(readChunk(p,6400,25),[]);throws(()=>readChunk(p,0,51));throws(()=>readChunk(p,-1,25))}

function testQuotas(){const f=fixture(),p=planOpeningPopulation(f),slots=p.slots;eq(slots.length,6400);eq(new Set(slots.map(s=>s.slotKey)).size,6400);eq(new Set(slots.map(s=>s.generatorSeed)).size,6400);const home=new Map(f.clubs.map(c=>[c.key,c.nationality]));eq(slots.filter(s=>s.primaryNationality===home.get(s.clubKey)).length,4160);for(const c of f.clubs){const group=slots.filter(s=>s.clubKey===c.key);eq(group.length,c.active?25:0);if(c.active)for(const [role,n] of Object.entries(f.roster))eq(group.filter(s=>s.primaryPosition===role).length,n)}for(const a of f.ageCounts)eq(slots.filter(s=>s.age===a.age).length,a.count);for(const policy of f.agePolicies){const group=slots.filter(s=>s.age>=policy.minAge&&s.age<=policy.maxAge);eq([1,2,3].map(t=>group.filter(s=>s.intendedTermSeasons===t).length),apportion(group.length,policy.termWeights))}requireThat(slots.every(s=>s.representation==="ai"&&s.primarySuitabilityTarget>=1&&s.primarySuitabilityTarget<=90&&s.generatorSeed.length<=64&&!Object.hasOwn(s,"playerId")&&!Object.hasOwn(s,"retirement_age")&&!Object.hasOwn(s,"salary")),"invalid intent")}

function testInvalid(){const f=fixture();throws(()=>planOpeningPopulation({...f,ageCounts:[]}));throws(()=>planOpeningPopulation({...f,agePolicies:f.agePolicies.slice(0,3)}));throws(()=>planOpeningPopulation({...f,clubs:[...f.clubs,f.clubs[0]]}));throws(()=>planOpeningPopulation({...f,foreignWeights:[{code:"ITA",weight:1}]}));throws(()=>planOpeningPopulation({...f,seed:"bad seed"}));throws(()=>planOpeningPopulation({...f,agePolicies:[...f.agePolicies,f.agePolicies[0]]}));throws(()=>planOpeningPopulation({...f,versions:{...f.versions,worldRevision:-1}}))}

test('testStationary',testStationary);
test('testReplay',testReplay);
test('testQuotas',testQuotas);
test('testInvalid',testInvalid);
test('SHA-256 manifest digest',()=>{const f=fixture(),p=planOpeningPopulation(f);assert.match(manifestDigest(p),/^[0-9a-f]{64}$/);assert.equal(manifestDigest(p),manifestDigest(planOpeningPopulation(f)));assert.notEqual(manifestDigest(p),manifestDigest(planOpeningPopulation({...f,seed:'different'}))) });

function referenceFixture(){
 const f=fixture();
 return {seed:f.seed,versions:{...f.versions,policy:REFERENCE_PROFILE_VERSION},clubs:f.clubs};
}

function testApprovedReference(){
 const p=approvedReferenceProfile();
 eq(p.ageCounts.map(x=>x.count),[98,212,278,327,327,327,327,327,327,327,327,327,327,326,326,326,326,320,304,267,201,110,33,3]);
 eq(p.agePolicies.map(x=>[x.minAge,x.maxAge,x.d1Mean,x.d2Mean,x.sigma,...x.termWeights]),[
 [16,19,61,61,7,15,35,50],[20,23,65,61,7,20,40,40],[24,28,67,63,7,25,45,30],
 [29,32,68,64,7,50,35,15],[33,35,68,64,7,70,25,5],[36,39,68,64,7,90,10,0]]);
 // Independent exact quota assertions (not calculated using planner apportionment).
 const f=referenceFixture(),m=planApprovedReference(f),s=m.slots;
 eq(s.length,6400);eq(new Set(s.map(x=>x.generatorSeed)).size,6400);
 for(const a of p.ageCounts)eq(s.filter(x=>x.age===a.age).length,a.count);
 eq(s.filter(x=>x.age>32).length,1238);
 eq(s.filter(x=>x.division===1).length,3200);
 eq(s.filter(x=>x.division===2).length,3200);
 const termCounts=band=>[1,2,3].map(t=>band.filter(x=>x.intendedTermSeasons===t).length);
 eq(termCounts(s.filter(x=>x.age>=33&&x.age<=35)),[624,223,44]);
 eq(termCounts(s.filter(x=>x.age>=36)),[312,35,0]);
 eq(termCounts(s),[2396,2293,1711]);
 const home=new Map(f.clubs.map(c=>[c.key,c.nationality]));
 eq(s.filter(x=>x.primaryNationality===home.get(x.clubKey)).length,4160);
 for(const c of f.clubs){
  const members=s.filter(x=>x.clubKey===c.key);
  eq(members.length,c.active?25:0);
  if(c.active)for(const [role,n] of Object.entries(p.roster))eq(members.filter(x=>x.primaryPosition===role).length,n);
 }
 eq(m,planApprovedReference({...f,clubs:[...f.clubs].reverse()}));
 throws(()=>planApprovedReference({...f,foreignWeights:[{code:'ITA',weight:1}]}));
 throws(()=>planApprovedReference({...f,versions:{...f.versions,policy:"wrong"}}));
 throws(()=>planApprovedReference({...f,clubs:f.clubs.slice(1)}));
 // Caller mutation cannot change the next profile.
 p.agePolicies[0].termWeights[0]=999;
 eq(approvedReferenceProfile().agePolicies[0].termWeights,[15,35,50]);
}
test('approved 6,400-slot demographic reference',testApprovedReference);

function testYouthReuse(){
 const manifest=planApprovedReference(referenceFixture());
 const targets=manifest.slots.filter(s=>["ITA","ENG"].includes(s.primaryNationality)&&s.age<=19);
 requireThat(targets.length>5,"missing test youth slots");
 const a=targets[0],b=targets.find(s=>s.slotKey!==a.slotKey&&s.clubKey!==a.clubKey);
 const candidate=(s,id,patch={})=>({id,age:s.age,primaryNationality:s.primaryNationality,primaryPosition:s.primaryPosition,primarySuitability:s.primarySuitabilityTarget,clubKey:null,representation:"ai",careerStatus:"active",hasSignedContract:false,hasSportingHistory:false,hasApprovedPortrait:true,readyForReuse:true,...patch});
 const inv={worldGeneration:manifest.versions.worldGeneration,worldRevision:manifest.versions.worldRevision,snapshotId:"fixture-inventory",complete:true,players:[candidate(a,1,{clubKey:a.clubKey}),candidate(b,2),candidate(a,3,{hasSignedContract:true}),candidate(b,4,{representation:"human"}),candidate(a,5,{clubKey:"inactive-club"}),candidate(a,6,{hasSportingHistory:true}),candidate(a,7,{age:20}),candidate(a,8,{readyForReuse:false})]};
 const result=planYouthReuse(manifest,inv);
 eq(result.reusedCount,2);eq(result.newCount,6398);
 eq(result.assignments.find(x=>x.slotKey===a.slotKey).playerId,1);
 eq(result.assignments.filter(x=>x.kind==="reuse").map(x=>x.playerId).sort((a,b)=>a-b),[1,2]);
 eq(result.unmatchedEligible,[5]);eq(result.excluded,[3,4,6,7,8]);eq(result.requiresReconciliation,true);
 eq(result,planYouthReuse(manifest,{...inv,players:[...inv.players].reverse()}));
 eq(result.assignments.length,manifest.slots.length);
 eq(result.assignments.map(x=>x.slotKey),manifest.slots.map(x=>x.slotKey));
 eq(planYouthReuse(manifest,{...inv,players:[]}).newCount,6400);
 throws(()=>planYouthReuse(manifest,{...inv,complete:false}));
 throws(()=>planYouthReuse(manifest,{...inv,worldRevision:inv.worldRevision+1}));
 throws(()=>planYouthReuse(manifest,{...inv,players:[inv.players[0],inv.players[0]]}));
 throws(()=>planYouthReuse(manifest,{...inv,players:[{...inv.players[0],readyForReuse:undefined}]}));
 eq(["BR","DE","ENG","ES","FR","IT","NL","PT"].map(clubCountryToNationality),["BRA","GER","ENG","ESP","FRA","ITA","NED","POR"]);
 throws(()=>clubCountryToNationality("ITa"));
}
test('reuse existing youth before new generation without changing slot quotas',testYouthReuse);

function testForeignPolicy(){
 const w=approvedForeignWeights(),playable=["BRA","GER","ENG","ESP","FRA","ITA","NED","POR"];
 eq(w.length,50);
 for(const home of playable){eq(w.filter(x=>x.code!==home&&playable.includes(x.code)).reduce((a,x)=>a+x.weight,0),42);eq(w.filter(x=>!playable.includes(x.code)).reduce((a,x)=>a+x.weight,0),42)}
 const f=referenceFixture(),m=planApprovedReference(f),home=new Map(f.clubs.map(c=>[c.key,c.nationality]));
 const foreign=m.slots.filter(s=>s.primaryNationality!==home.get(s.clubKey));
 eq(foreign.length,2240);requireThat(Math.abs(foreign.filter(s=>playable.includes(s.primaryNationality)).length-1120)<100,"foreign sample outside expected tolerance");
}
test('approved foreign weighting and exact domestic share',testForeignPolicy);

function testOpeningChunk(){
 const manifest=planApprovedReference(referenceFixture());
 const slot=manifest.slots.find(s=>["ITA","ENG","GER"].includes(s.primaryNationality)&&s.age<=19);
 const idx=manifest.slots.indexOf(slot);
 const p={id:44,age:slot.age,primaryNationality:slot.primaryNationality,primaryPosition:slot.primaryPosition,primarySuitability:slot.primarySuitabilityTarget,clubKey:slot.clubKey,representation:"ai",careerStatus:"active",hasSignedContract:false,hasSportingHistory:false,hasApprovedPortrait:true,readyForReuse:true};
 const inventory={worldGeneration:manifest.versions.worldGeneration,worldRevision:manifest.versions.worldRevision,snapshotId:"fixture",complete:true,players:[p]};
 // A reused slot must never invoke the generator (even with no catalogue supplied).
 const reused=prepareOpeningCandidateChunk(manifest,inventory,idx,1,null);
 eq(reused.entries,[{slotKey:slot.slotKey,clubKey:slot.clubKey,kind:"reuse",playerId:44}]);
 const old=manifest.slots.findIndex(s=>s.age===39);
 const catalog=loadRuntimePlayerCatalog();
 const chunk=prepareOpeningCandidateChunk(manifest,inventory,old,1,catalog);
 eq(chunk.entries[0].candidate.initial_age,39);eq(chunk.entries[0].privateRetirementAge,40);
 eq(chunk,prepareOpeningCandidateChunk(manifest,inventory,old,1,catalog));
 for(const s of manifest.slots){const age=sampleOpeningRetirementAge(s);requireThat(age>s.age&&age<=40&&age>=33,"invalid conditional retirement")}
}
test('internal candidate chunk preserves reused ID and conditionally retires new adults',testOpeningChunk);

function testPersistenceProtocol(){
 const base=referenceFixture();
 const manifest=planApprovedReference({...base,versions:{...base.versions,worldRevision:0}});
 const s=manifest.slots.find(s=>["ITA","ENG","GER"].includes(s.primaryNationality)&&s.age<=19);
 const prior={id:44,age:s.age,primaryNationality:s.primaryNationality,primaryPosition:s.primaryPosition,primarySuitability:s.primarySuitabilityTarget,clubKey:s.clubKey,representation:"ai",careerStatus:"active",hasSignedContract:false,hasSportingHistory:false,hasApprovedPortrait:true,readyForReuse:true,fingerprint:"a".repeat(64)};
 const inventory={worldGeneration:manifest.versions.worldGeneration,worldRevision:0,snapshotId:"opening",complete:true,idHighWater:100,players:[prior]};
 const world={generation:inventory.worldGeneration,revision:0,seasonNumber:0,day:0,phase:"unstarted"};
 const run=createOpeningPersistenceRun(manifest,inventory,world),rows=[{id:44,fingerprint:prior.fingerprint}],receipts=[];
 const observation={world,complete:true,idHighWater:100,rows};
 let progress=inspectOpeningProgress(run,manifest,inventory,receipts,observation);
 eq(progress.totalBatches,256);eq(progress.completedSlots,0);eq(progress.nextBatch.entries.length,25);
 eq(run.batchIntentHashes.length,256);
 const intents=prepareOpeningBatchIntents(run,manifest,inventory,0);
 eq(manifestDigest(intents),run.batchIntentHashes[0]);
 const generated=intents.find(e=>e.kind==="generate");
 requireThat(!!generated,"missing generation intent");
 const changed=intents.map(e=>e===generated?{...e,slot:{...e.slot,age:e.slot.age===39?38:39}}:e);
 requireThat(manifestDigest(changed)!==run.batchIntentHashes[0],"age change must alter hash");
 throws(()=>prepareOpeningBatchIntents({...run,batchIntentHashes:run.batchIntentHashes.map((x,i)=>i===0?"0".repeat(64):x)},manifest,inventory,0));
 throws(()=>createOpeningPersistenceRun(manifest,{...inventory,players:[{...prior,hasSignedContract:true}]},world));
 throws(()=>inspectOpeningProgress(run,manifest,inventory,receipts,{...observation,world:{...world,phase:"active"}}));
 throws(()=>inspectOpeningProgress(run,manifest,inventory,receipts,{...observation,rows:[]}));
 throws(()=>inspectOpeningProgress(run,manifest,{...inventory,snapshotId:"changed"},receipts,observation));
 const reuse=planYouthReuse(manifest,inventory);
 for(let index=0;index<256;index++){
  const entriesForBatch=manifest.slots.slice(index*25,index*25+25).map((s,i)=>{
   const a=reuse.assignments[index*25+i];return a.kind==="reuse"?{slotKey:s.slotKey,kind:"reuse",playerId:a.playerId}:{slotKey:s.slotKey,kind:"generate"};
  });
  const b={runKey:run.runKey,index,offset:index*25,requestHash:manifestDigest({runKey:run.runKey,index,entries:entriesForBatch}),entries:entriesForBatch};
  if([0,1,128].includes(index))eq(progress.nextBatch,b);
  const beforeHighWater=observation.idHighWater;
  const entries=b.entries.map(e=>{
   if(e.kind==="reuse")return {...e,fingerprint:prior.fingerprint};
   const id=++observation.idHighWater,fingerprint=id.toString(16).padStart(64,"0");
   rows.push({id,fingerprint});return {...e,playerId:id,fingerprint};
  });
  const receipt={runKey:b.runKey,index:b.index,requestHash:b.requestHash,beforeHighWater,afterHighWater:observation.idHighWater,entries};
  receipts.push(receipt);
  if(receipts.length===1){
   throws(()=>inspectOpeningProgress(run,manifest,inventory,[],observation));
   throws(()=>inspectOpeningProgress(run,manifest,inventory,[{...receipt,index:1}],observation));
   throws(()=>inspectOpeningProgress(run,manifest,inventory,[{...receipt,requestHash:"0".repeat(64)}],observation));
   throws(()=>inspectOpeningProgress(run,manifest,inventory,[{...receipt,entries:receipt.entries.slice(1)}],observation));
   throws(()=>inspectOpeningProgress(run,manifest,inventory,receipts,{...observation,rows:rows.map(r=>r.id===44?{...r,fingerprint:"b".repeat(64)}:r)}));
  }
  if([1,128,256].includes(receipts.length)){
   progress=inspectOpeningProgress(run,manifest,inventory,receipts,observation);
   eq(progress.completedSlots,receipts.length*25);
  }
 }
 eq(progress.readyForReconciliation,true);eq(progress.remainingSlots,0);eq(rows.length,6400);eq(observation.idHighWater,6499);
 eq(progress,inspectOpeningProgress(run,manifest,inventory,[...receipts].reverse(),observation));
 throws(()=>inspectOpeningProgress(run,manifest,inventory,receipts.slice(1),observation));
 throws(()=>inspectOpeningProgress(run,manifest,inventory,[...receipts,receipts[0]],observation));
}
test('opening persistence resumes from verified receipts and detects partial or changed catalogue',testPersistenceProtocol);
