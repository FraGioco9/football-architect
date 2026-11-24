// #791 — isolated offline proposal only. No DB, API, runtime integration or approved age defaults.
import {createHash} from 'node:crypto';

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
