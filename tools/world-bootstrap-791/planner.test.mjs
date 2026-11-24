// Explicit offline check; not yet registered in shared CI (PR #790 owns a concurrent edit).
import test from 'node:test';
import assert from 'node:assert/strict';
import {stationaryAgeQuotas,planOpeningPopulation,readChunk,manifestDigest} from './planner.mjs';

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
