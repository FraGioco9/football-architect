// #791 — isolated offline proposal only. No DB, API or runtime integration.
import {createHash} from 'node:crypto';
import {COUNTRIES,generateOpeningCandidateWithCatalog} from '../../backend/src/players-generator-core.mjs';

function requireThat(ok,msg){if(!ok)throw new Error(msg)}

function int(n,min,max){return Number.isSafeInteger(n)&&n>=min&&n<=max}

function order(a,b){return a<b?-1:a>b?1:0}

function token(s,max=64){return typeof s==="string"&&s.length<=max&&/^[A-Za-z0-9_.:-]+$/.test(s)}

function rng(seed){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return ()=>{h=(h+0x6D2B79F5)|0;let t=Math.imul(h^(h>>>15),1|h);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296}}

function shuffle(a,random){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b}

function apportion(total,weights){requireThat(int(total,0,100000)&&Array.isArray(weights)&&weights.length>0&&weights.every(w=>Number.isFinite(w)&&w>=0),"invalid weights");const sum=weights.reduce((a,b)=>a+b,0);requireThat(Number.isFinite(sum)&&sum>0,"zero weights");const exact=weights.map(w=>w/sum*total),out=exact.map(Math.floor);const ranked=exact.map((v,i)=>({i,frac:v-out[i]})).sort((a,b)=>b.frac-a.frac||a.i-b.i);const left=total-out.reduce((a,b)=>a+b,0);requireThat(left>=0&&left<=weights.length,"apportionment error");for(let j=0;j<left;j++)out[ranked[j].i]++;return out}

export function stationaryAgeQuotas(total,entryWeights,hazards){
 requireThat(int(total,1,100000)&&Array.isArray(entryWeights)&&entryWeights.length===4&&entryWeights.every(w=>Number.isFinite(w)&&w>=0),"invalid entrants");
 requireThat(Array.isArray(hazards)&&hazards.length===24&&hazards.every(p=>Number.isFinite(p)&&p>=0&&p<=1)&&hazards.at(-1)===1,"hazards must cover reached ages 17–40 with mandatory retirement at 40");
 const sum=entryWeights.reduce((a,b)=>a+b,0);requireThat(sum>0&&Number.isFinite(sum),"zero entrants");
 let previous=0;const mass=[];for(let age=16;age<=39;age++){previous=previous*(age===16?1:1-hazards[age-17])+(entryWeights[age-16]||0)/sum;mass.push(previous)}
 const career=mass.reduce((a,b)=>a+b,0),counts=apportion(total,mass);
 return {expectedAnnualEntrants:total/career,expectedActiveYears:career,expectedMeanAge:mass.reduce((a,b,i)=>a+b*(i+16),0)/career,ageCounts:counts.map((count,i)=>({age:i+16,count}))};
}

export function planOpeningPopulation(input){
 const {seed,versions,clubs,ageCounts,agePolicies,foreignWeights,localPercent=65,roster}=input;
 requireThat(token(seed,24),"seed must be 1–24 safe ASCII characters");
 requireThat(versions&&["worldGeneration","clubSnapshot","generator","catalog","policy"].every(k=>token(versions[k],128))&&int(versions.worldRevision,0,Number.MAX_SAFE_INTEGER),"missing pinned versions");
 const version={worldGeneration:versions.worldGeneration,worldRevision:versions.worldRevision,clubSnapshot:versions.clubSnapshot,generator:versions.generator,catalog:versions.catalog,policy:versions.policy};
 const roles="GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST".split(" ");
 requireThat(roster&&Object.keys(roster).length===roles.length&&roles.every(p=>int(roster[p],1,100)),"invalid roster");
 const positions=roles.flatMap(p=>Array(roster[p]).fill(p)),size=positions.length;
 requireThat(size<=100&&Array.isArray(clubs)&&clubs.length>0&&clubs.length<=1000,"invalid club count/roster size");
 const keys=new Set();for(const c of clubs){requireThat(c&&token(c.key,24)&&!keys.has(c.key)&&typeof c.active==="boolean"&&/^[A-Z]{3}$/.test(c.nationality)&&((c.active&&(c.division===1||c.division===2))||(!c.active&&c.division===null)),"invalid/duplicate club");keys.add(c.key)}
 const snapshot=clubs.map(c=>({key:c.key,nationality:c.nationality,division:c.division,active:c.active})).sort((a,b)=>order(a.key,b.key));
 const active=snapshot.filter(c=>c.active),total=active.length*size;requireThat(total>0&&total<=100000,"invalid population");
 requireThat(Array.isArray(ageCounts)&&ageCounts.length>0&&ageCounts.every(x=>x&&int(x.age,16,39)&&int(x.count,0,total))&&new Set(ageCounts.map(x=>x.age)).size===ageCounts.length&&ageCounts.reduce((s,x)=>s+x.count,0)===total,"age quota mismatch");
 const ages=ageCounts.map(x=>({age:x.age,count:x.count})).sort((a,b)=>a.age-b.age);
 requireThat(Array.isArray(agePolicies)&&agePolicies.length>0&&agePolicies.every(p=>p&&int(p.minAge,16,39)&&int(p.maxAge,p.minAge,39)&&int(p.d1Mean,1,90)&&int(p.d2Mean,1,90)&&Number.isFinite(p.sigma)&&p.sigma>0&&p.sigma<=30&&Array.isArray(p.termWeights)&&p.termWeights.length===3&&p.termWeights.every(w=>int(w,0,10000))&&p.termWeights.some(w=>w>0)),"invalid age policy");
 const policies=agePolicies.map(p=>({minAge:p.minAge,maxAge:p.maxAge,d1Mean:p.d1Mean,d2Mean:p.d2Mean,sigma:p.sigma,termWeights:[...p.termWeights]})).sort((a,b)=>a.minAge-b.minAge);
 requireThat(policies.every((p,i)=>i===0||p.minAge>policies[i-1].maxAge)&&ages.every(a=>a.count===0||policies.some(p=>p.minAge<=a.age&&a.age<=p.maxAge)),"overlapping or missing age policy");
 requireThat(int(localPercent,0,100)&&Array.isArray(foreignWeights)&&foreignWeights.length>0&&foreignWeights.every(x=>x&&/^[A-Z]{3}$/.test(x.code)&&int(x.weight,1,1000000))&&new Set(foreignWeights.map(x=>x.code)).size===foreignWeights.length,"invalid nationality weights");
 const countries=foreignWeights.map(x=>({code:x.code,weight:x.weight})).sort((a,b)=>order(a.code,b.code));
 requireThat(active.every(c=>countries.some(x=>x.code===c.nationality)&& (localPercent===100||countries.some(x=>x.code!==c.nationality))),"club nationality unavailable or no foreign options");
 const stream=(...parts)=>rng(JSON.stringify([seed,...parts]));
 // Round robin over a seeded club order: each single-age quota differs by at most one per club.
 const clubOrder=shuffle(active,stream("club-order")),ageByClub=new Map(active.map(c=>[c.key,[]]));let cursor=0;
 for(const a of ages)for(let i=0;i<a.count;i++){ageByClub.get(clubOrder[cursor%active.length].key).push(a.age);cursor++}
 const slots=[];
 for(const club of active){const clubAges=shuffle(ageByClub.get(club.key),stream("ages",club.key));requireThat(clubAges.length===size,"roster age mismatch");
  for(let i=0;i<size;i++){
   const age=clubAges[i],p=policies.find(p=>p.minAge<=age&&age<=p.maxAge),slotKey=club.key+"/"+String(i+1).padStart(3,"0");
   const random=stream("suitability",slotKey),u=1-random(),v=random(),mean=club.division===1?p.d1Mean:p.d2Mean;
   const target=Math.max(1,Math.min(90,Math.round(mean+p.sigma*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v))));
   // Unique stable generator seeds within the manifest; no permanent player IDs.
   const generatorSeed="ob1:"+seed+":"+club.key+":"+String(i+1);
   slots.push({slotKey,clubKey:club.key,division:club.division,age,primaryPosition:positions[i],primarySuitabilityTarget:target,generatorSeed,representation:"ai"});
  }
 }
 // Exact global local/foreign quota, no per-club nationality restriction.
 const localCount=apportion(total,[localPercent,100-localPercent])[0];
 const localKeys=new Set(shuffle(slots,stream("nationality-quota")).slice(0,localCount).map(s=>s.slotKey));
 const byKey=new Map(active.map(c=>[c.key,c]));
 for(const s of slots){const home=byKey.get(s.clubKey).nationality;if(localKeys.has(s.slotKey)){s.primaryNationality=home;continue}
  const choices=countries.filter(c=>c.code!==home),sum=choices.reduce((a,b)=>a+b.weight,0);let draw=stream("foreign",s.slotKey)()*sum;
  for(const c of choices){draw-=c.weight;if(draw<0){s.primaryNationality=c.code;break}}
  requireThat(!!s.primaryNationality,"foreign selection failed");
 }
 // Exact integer term quotas per explicitly configured age band.
 for(const p of policies){const members=shuffle(slots.filter(s=>s.age>=p.minAge&&s.age<=p.maxAge),stream("terms",p.minAge,p.maxAge)),quota=apportion(members.length,p.termWeights);let idx=0;for(let t=1;t<=3;t++)for(let j=0;j<quota[t-1];j++)members[idx++].intendedTermSeasons=t}
 return {schema:"opening-population-plan-v1",seed,versions:version,clubs:snapshot,config:{roster:Object.fromEntries(roles.map(p=>[p,roster[p]])),ageCounts:ages,agePolicies:policies,foreignWeights:countries,localPercent},slots};
}

export function readChunk(manifest,offset,limit){requireThat(manifest?.schema==="opening-population-plan-v1"&&Array.isArray(manifest.slots)&&int(offset,0,manifest.slots.length)&&int(limit,1,50),"invalid chunk");return manifest.slots.slice(offset,offset+limit)}

export function manifestDigest(manifest){return createHash('sha256').update(JSON.stringify(manifest),'utf8').digest('hex')}

// Owner-approved editable DRAFT reference, not a runtime default or an academy policy.
export const REFERENCE_PROFILE_VERSION="opening-demography-draft-v2";

export function approvedReferenceProfile(){
 const entryWeights=[30,35,20,15];
 const retirementHazards=Array.from({length:24},(_,i)=>({33:.02,34:.05,35:.12,36:.25,37:.45,38:.70,39:.90,40:1}[i+17]??0));
 const roster={GK:3,RB:2,CB:4,LB:2,RWB:1,LWB:1,DM:2,CM:3,AM:1,RM:1,LM:1,RW:1,LW:1,ST:2};
 const agePolicies=[
  {minAge:16,maxAge:19,d1Mean:61,d2Mean:61,sigma:7,termWeights:[15,35,50]},
  {minAge:20,maxAge:23,d1Mean:65,d2Mean:61,sigma:7,termWeights:[20,40,40]},
  {minAge:24,maxAge:28,d1Mean:67,d2Mean:63,sigma:7,termWeights:[25,45,30]},
  {minAge:29,maxAge:32,d1Mean:68,d2Mean:64,sigma:7,termWeights:[50,35,15]},
  {minAge:33,maxAge:35,d1Mean:68,d2Mean:64,sigma:7,termWeights:[70,25,5]},
  {minAge:36,maxAge:39,d1Mean:68,d2Mean:64,sigma:7,termWeights:[90,10,0]}
 ];
 const equilibrium=stationaryAgeQuotas(6400,entryWeights,retirementHazards);
 return {profileVersion:REFERENCE_PROFILE_VERSION,activeClubs:256,playersPerClub:25,entryWeights,retirementHazards,roster,agePolicies,localPercent:65,...equilibrium};
}

// Approved 50/50 foreign pool probability: 7*6 = 42*1 after excluding home.
export function approvedForeignWeights(){
 const playable=new Set(["BRA","GER","ENG","ESP","FRA","ITA","NED","POR"]);
 requireThat(COUNTRIES.length===50&&new Set(COUNTRIES.map(c=>c.code)).size===50&&[...playable].every(code=>COUNTRIES.some(c=>c.code===code)),"canonical nationality catalogue changed");
 return COUNTRIES.map(c=>({code:c.code,weight:playable.has(c.code)?6:1})).sort((a,b)=>order(a.code,b.code));
}
// Explicit opt-in to the reviewed reference. Generic planner remains configurable.
export function planApprovedReference({seed,versions,clubs,foreignWeights}){
 requireThat(Array.isArray(clubs)&&clubs.filter(c=>c?.active===true&&c.division===1).length===128&&clubs.filter(c=>c?.active===true&&c.division===2).length===128,"reference needs 128 active clubs per division");
 requireThat(versions?.policy===REFERENCE_PROFILE_VERSION,"reference policy version mismatch");
 const p=approvedReferenceProfile(),weights=approvedForeignWeights();
 requireThat(clubs.every(c=>c&&["BRA","GER","ENG","ESP","FRA","ITA","NED","POR"].includes(c.nationality)),"unsupported reference club nationality");
 if(foreignWeights!==undefined)requireThat(Array.isArray(foreignWeights)&&JSON.stringify(foreignWeights.slice().sort((a,b)=>order(a.code,b.code)).map(x=>({code:x.code,weight:x.weight})))===JSON.stringify(weights),"reference foreign weights mismatch");
 return planOpeningPopulation({seed,versions,clubs,foreignWeights:weights,roster:p.roster,ageCounts:p.ageCounts,agePolicies:p.agePolicies,localPercent:p.localPercent});
}

// Registry country IDs are not generator/FIFA codes. Keep the translation explicit.
export function clubCountryToNationality(countryId){
 const map={BR:"BRA",DE:"GER",ENG:"ENG",ES:"ESP",FR:"FRA",IT:"ITA",NL:"NED",PT:"POR"};
 requireThat(typeof countryId==="string"&&Object.hasOwn(map,countryId),"unsupported club country");
 return map[countryId];
}

// Pure reuse preflight. Inventory must come from a trusted, complete, pinned server snapshot.
// No transfers, writes, generated identities or retirement/aptitude data.
export function planYouthReuse(manifest,inventory){
 requireThat(manifest?.schema==="opening-population-plan-v1"&&Array.isArray(manifest.slots)&&manifest.versions,"invalid manifest");
 requireThat(inventory&&inventory.worldGeneration===manifest.versions.worldGeneration&&inventory.worldRevision===manifest.versions.worldRevision&&token(inventory.snapshotId,128)&&inventory.complete===true&&Array.isArray(inventory.players),"stale or incomplete player inventory");
 const roles=new Set(Object.keys(manifest.config.roster)),ids=new Set(),slotIds=new Set();
 const wanted=new Set(["ITA","GER","ENG"]);
 const target=s=>wanted.has(s.primaryNationality)&&int(s.age,16,19);
 for(const s of manifest.slots){requireThat(s&&typeof s.slotKey==="string"&&!slotIds.has(s.slotKey)&&roles.has(s.primaryPosition)&&int(s.primarySuitabilityTarget,1,90),"invalid manifest slot");slotIds.add(s.slotKey)}
 const players=inventory.players.map(p=>{
  requireThat(p&&int(p.id,1,Number.MAX_SAFE_INTEGER)&&!ids.has(p.id)&&int(p.age,16,40)&&/^[A-Z]{3}$/.test(p.primaryNationality)&&roles.has(p.primaryPosition)&&Number.isFinite(p.primarySuitability)&&p.primarySuitability>=1&&p.primarySuitability<=99&&(p.clubKey===null||token(p.clubKey,24))&&["ai","human","unknown"].includes(p.representation)&&["active","retired","unknown"].includes(p.careerStatus)&&typeof p.hasSignedContract==="boolean"&&typeof p.hasSportingHistory==="boolean"&&typeof p.hasApprovedPortrait==="boolean"&&typeof p.readyForReuse==="boolean","invalid or duplicate inventory player");
  ids.add(p.id);return {id:p.id,age:p.age,primaryNationality:p.primaryNationality,primaryPosition:p.primaryPosition,primarySuitability:p.primarySuitability,clubKey:p.clubKey,representation:p.representation,careerStatus:p.careerStatus,hasSignedContract:p.hasSignedContract,hasSportingHistory:p.hasSportingHistory,hasApprovedPortrait:p.hasApprovedPortrait,readyForReuse:p.readyForReuse};
 }).sort((a,b)=>a.id-b.id);
 const eligible=p=>wanted.has(p.primaryNationality)&&int(p.age,16,19)&&p.representation==="ai"&&p.careerStatus==="active"&&!p.hasSignedContract&&!p.hasSportingHistory&&p.readyForReuse;
 const candidates=players.filter(eligible).sort((a,b)=>Number(b.clubKey!==null)-Number(a.clubKey!==null)||Number(b.hasApprovedPortrait)-Number(a.hasApprovedPortrait)||a.id-b.id);
 const remaining=manifest.slots.filter(target).slice().sort((a,b)=>order(a.slotKey,b.slotKey)),bySlot=new Map(),matched=new Set();
 // Same-club candidates first: never move an existing affiliation. Free candidates
 // can then fill any compatible slot; exact age, primary nationality and role are preserved.
 for(const p of candidates){
  const choices=remaining.filter(s=>s.age===p.age&&s.primaryNationality===p.primaryNationality&&s.primaryPosition===p.primaryPosition&&(p.clubKey===null||s.clubKey===p.clubKey)&&!bySlot.has(s.slotKey));
  choices.sort((a,b)=>Math.abs(a.primarySuitabilityTarget-p.primarySuitability)-Math.abs(b.primarySuitabilityTarget-p.primarySuitability)||order(a.slotKey,b.slotKey));
  if(!choices.length)continue;
  const s=choices[0];matched.add(p.id);bySlot.set(s.slotKey,{slotKey:s.slotKey,kind:"reuse",playerId:p.id,primarySuitability:p.primarySuitability,suitabilityDeviation:p.primarySuitability-s.primarySuitabilityTarget,hasApprovedPortrait:p.hasApprovedPortrait});
 }
 const assignments=manifest.slots.map(s=>bySlot.get(s.slotKey)??{slotKey:s.slotKey,kind:"generate"});
 const unmatchedEligible=players.filter(p=>eligible(p)&&!matched.has(p.id)).map(p=>p.id);
 const excluded=players.filter(p=>!eligible(p)).map(p=>p.id);
 // No automatic disposal: any unallocated inventory needs owner reconciliation before activation.
 return {schema:"opening-youth-reuse-v1",worldGeneration:inventory.worldGeneration,worldRevision:inventory.worldRevision,inventorySnapshotId:inventory.snapshotId,assignments,reusedCount:matched.size,newCount:assignments.length-matched.size,unmatchedEligible,excluded,requiresReconciliation:unmatchedEligible.length+excluded.length>0};
}

// Repair only free youth slots after the initial exact matching. Preserve the
// per-club roster roles, youth-band size, exact global age/nationality quotas,
// every slot's domestic/foreign status, suitability and term-band quotas.
// No regeneration, age change to players, or modification of existing identities.
export function fitOpeningYouthSlots(manifest,inventory){
 const initial=planYouthReuse(manifest,inventory);
 if(!initial.requiresReconciliation||initial.excluded.length||inventory.players.some(p=>p.clubKey!==null))return manifest;
 const slots=manifest.slots.map(s=>({...s})),byKey=new Map(slots.map(s=>[s.slotKey,s])),home=new Map(manifest.clubs.map(c=>[c.key,c.nationality]));
 const youth=slots.filter(s=>int(s.age,16,19));
 const reserved=new Set(initial.assignments.filter(a=>a.kind==="reuse").map(a=>a.slotKey));
 const wanted=new Set(initial.unmatchedEligible);
 const candidates=inventory.players.filter(p=>wanted.has(p.id)).sort((a,b)=>Number(b.hasApprovedPortrait)-Number(a.hasApprovedPortrait)||a.id-b.id);
 for(const player of candidates){
  const free=youth.filter(s=>!reserved.has(s.slotKey));
  const ageDonor=free.find(s=>s.age===player.age);
  if(!ageDonor)continue;
  const nationalityDonors=free.filter(s=>s.primaryNationality===player.primaryNationality&&s.primaryNationality!==home.get(s.clubKey));
  const choices=[];
  for(const s of free){
   if(s.primaryPosition!==player.primaryPosition)continue;
   const donor=s.primaryNationality===player.primaryNationality?null:
    (s.primaryNationality===home.get(s.clubKey)||player.primaryNationality===home.get(s.clubKey)?undefined:
     nationalityDonors.find(d=>d.slotKey!==s.slotKey&&s.primaryNationality!==home.get(d.clubKey)));
   if(donor===undefined)continue;
   choices.push({s,donor,swaps:Number(!!donor)+Number(s.age!==player.age)});
  }
  choices.sort((a,b)=>a.swaps-b.swaps||Math.abs(a.s.primarySuitabilityTarget-player.primarySuitability)-Math.abs(b.s.primarySuitabilityTarget-player.primarySuitability)||order(a.s.slotKey,b.s.slotKey));
  const choice=choices[0];if(!choice)continue;
  const {s,donor}=choice;
  if(donor)[s.primaryNationality,donor.primaryNationality]=[donor.primaryNationality,s.primaryNationality];
  if(s.age!==player.age)[s.age,ageDonor.age]=[ageDonor.age,s.age];
  reserved.add(s.slotKey);
 }
 const fitted={...manifest,slots:manifest.slots.map(s=>byKey.get(s.slotKey))};
 // No partial success is considered ready. The persistence protocol rechecks
 // the entire inventory and rejects unmatched/excluded IDs before any writes.
 return fitted;
}

// Internal offline preview only: no permanent IDs for new players and no DB calls.
// The seed stream for private retirement is independent of identity/attributes.
export function sampleOpeningRetirementAge(slot){
 requireThat(slot&&int(slot.age,16,39)&&token(slot.generatorSeed,64),"invalid retirement slot");
 const hazards=approvedReferenceProfile().retirementHazards;
 const random=rng(JSON.stringify(["opening-retirement-v1",slot.generatorSeed]));
 for(let age=slot.age+1;age<=40;age++)if(random()<hazards[age-17])return age;
 throw Error("mandatory retirement missing");
}

export function prepareOpeningCandidateChunk(manifest,inventory,offset,limit,catalog){
 requireThat(manifest?.versions?.policy===REFERENCE_PROFILE_VERSION,"reference policy mismatch");
 const reuse=planYouthReuse(manifest,inventory);
 const slots=readChunk(manifest,offset,limit),assignments=reuse.assignments.slice(offset,offset+slots.length);
 const entries=slots.map((slot,i)=>{
  const assignment=assignments[i];
  requireThat(assignment.slotKey===slot.slotKey,"reuse alignment mismatch");
  if(assignment.kind==="reuse")return {slotKey:slot.slotKey,clubKey:slot.clubKey,kind:"reuse",playerId:assignment.playerId};
  const candidate=generateOpeningCandidateWithCatalog(slot,catalog);
  requireThat(candidate.initial_age===slot.age&&candidate.nationality===slot.primaryNationality&&candidate.primary_position===slot.primaryPosition,"generator slot mismatch");
  return {slotKey:slot.slotKey,clubKey:slot.clubKey,kind:"generate",candidate,privateRetirementAge:sampleOpeningRetirementAge(slot)};
 });
 return {schema:"opening-internal-candidate-chunk-v1",offset,entries,inventorySnapshotId:reuse.inventorySnapshotId,requiresReconciliation:reuse.requiresReconciliation};
}
