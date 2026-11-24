// #769 — isolated DRAFT research only; no Worker, D1, ledger or public API imports.
import {generateTrial,calculatePositionSuitability} from './players-generation-trial.mjs';
const growth=[0.7098,0.6808,0.651,0.6267,0.607,0.5908,0.5618,0.5357,0.515,0.4878,0.4666,0.4284,0.3716,0.2786,0.1782,0.0922,0.0403,0.0171,0.0059,0.0023,0.0008,0.0006,0,0];
const retirement={"33":0.02,"34":0.05,"35":0.12,"36":0.25,"37":0.45,"38":0.7,"39":0.9,"40":1};
const versatility=[0.05,0.025,0.0125,0.0075,0.005];
const settings={"version":"769-research-v1","commission":0.05,"benchmark":250000,"floors":{"1":1000,"2":500},"aiPremium":1.25,"renewalSeasons":2};
const scenarios=[{"id":"previous-rate-only","K":1226.223546184737,"slope":2.5,"context":false,"paid":1,"discount":0},{"id":"candidate","K":1500,"slope":2,"context":true,"paid":1,"discount":0},{"id":"lower-base","K":1250,"slope":2,"context":true,"paid":1,"discount":0},{"id":"flatter","K":1500,"slope":1.6,"context":true,"paid":1,"discount":0},{"id":"steeper","K":1500,"slope":2.5,"context":true,"paid":1,"discount":0},{"id":"collection-stress","K":1500,"slope":2,"context":true,"paid":0.75,"discount":0.03}];
const points=[70,65,60,55,51,48,45,42,39,36,33,30,27,24,21,18];
const sovereign=[0.8,0.7,0.6,0.4,0.3,0.2,0,0,0,0,0,0,0,0,0,0];
const federation=[0.1,0.2,0.3,0.6,0.7,0.6,0.5,0,0,0,0,0,0,0,0,0];

function sum(xs){return xs.reduce((a,b)=>a+b,0)}

function capacities(){
 const contexts=[];
 for(const tier of [1,2])for(let i=0;i<16;i++){
  const pool=tier===1?4000000:2000000;
  const domestic=pool*(.60/16+.15*points[i]/sum(points)+.25*(16-i)/136);
  const international=tier===1?sovereign[i]*8000000/24+federation[i]*4000000/24:0;
  contexts.push({tier,rank:i+1,rewards:domestic+international,domestic,international});
 }
 return contexts;
}

function normalSalary(skill,bonus,scenario,ctx){
 const base=scenario.K*scenario.slope**((skill-60)/10)*(1+bonus);
 return ctx?Math.max(settings.floors[ctx.tier],base*Math.sqrt(ctx.rewards/settings.benchmark)):base;
}

function expectedSalary(skill,bonus,scenario){
 if(!scenario.context)return normalSalary(skill,bonus,scenario);
 // Equal-weight future club contexts are a neutral sensitivity, not a fitted employment forecast.
 return sum(capacities().map(ctx=>normalSalary(skill,bonus,scenario,ctx)))/32;
}

function rawValue(age,skill,bonus,scenario,rate=settings.commission){
 if(!Number.isInteger(age)||age<16||age>39||!Number.isFinite(skill)||skill<1||skill>99||!Number.isFinite(bonus)||bonus<0||bonus>.1000000001)return null;
 let value=0,survival=1,wage=0;
 for(let t=0;t<=39-age;t++){
  if(t%settings.renewalSeasons===0)wage=expectedSalary(skill,bonus,scenario);
  value+=rate*wage*survival*scenario.paid/(1+scenario.discount)**(t+1);
  skill=Math.min(99,skill+growth[age+t-16]);
  survival*=1-(retirement[age+t+1]??0);
 }
 return value;
}

function roundValue(raw){
 if(!Number.isFinite(raw)||raw<0||raw>Number.MAX_SAFE_INTEGER)return null;
 if(raw===0)return 0;
 let step=1;while(raw>=step*100)step*=10;
 const lower=Math.floor(raw/step)*step, rounded=lower<raw?lower+step:lower;
 return Number.isSafeInteger(rounded)?rounded:null;
}

function quantiles(values){
 const v=[...values].sort((a,b)=>a-b);
 if(!v.length)return null;
 return {n:v.length,p10:v[Math.floor((v.length-1)*.1)],median:v[Math.floor((v.length-1)*.5)],p90:v[Math.floor((v.length-1)*.9)],mean:sum(v)/v.length};
}

function selfTest(){
 const check=(ok,msg)=>{if(!ok)throw new Error(msg)};
 for(const [age,old,rounded] of [[16,4147.935618,2100],[24,1879.241387,940],[32,589.798344,300],[39,122.622355,62]]){
  const previous=rawValue(age,60,0,scenarios[0],.1);
  const next=rawValue(age,60,0,scenarios[0]);
  check(Math.abs(previous-old)<.000001,"old golden mismatch");
  check(next===previous/2,"rate-only raw half");
  check(roundValue(next)===rounded,"rate-only display");
 }
 const c=capacities();
 check(Math.abs(sum(c.map(x=>x.rewards))*8-60000000)<1e-6,"reward conservation");
 check(Math.abs(sum(sovereign)-3)<1e-9&&Math.abs(sum(federation)-3)<1e-9,"qualification expectation");
 check(sovereign.every((p,i)=>p+federation[i]<=1),"exclusive qualification");
 check(normalSalary(1,0,scenarios[1],{tier:1,rewards:150000})===1000,"tier 1 floor");
 check(normalSalary(1,0,scenarios[1],{tier:2,rewards:75000})===500,"tier 2 floor");
 check(rawValue(40,60,0,scenarios[1])===null,"invalid active age");
 check(roundValue(99.9)===100&&roundValue(100.1)===110&&roundValue(0)===0,"rounding thresholds");
}

function profile(candidate){
 const scores=[...new Set([candidate.primary_position,...candidate.secondary_positions])].map(role=>calculatePositionSuitability(candidate.attributes,role)).sort((a,b)=>b-a);
 const skill=scores[0];
 const bonus=sum(scores.slice(1,6).map((score,i)=>versatility[i]*Math.max(0,1-(skill-score)/10)));
 return {age:candidate.initial_age,skill,bonus};
}

function cohortReport(){
 const cohort=[1,2,3].flatMap(n=>generateTrial({count:1000,seed:"769-cohort-"+n}).candidates.map(profile));
 return scenarios.map(scenario=>{
  const rows=cohort.map(p=>{const raw=rawValue(p.age,p.skill,p.bonus,scenario);return {...p,wage:expectedSalary(p.skill,p.bonus,scenario),raw,rounded:roundValue(raw)}});
  return {scenario:scenario.id,wages:quantiles(rows.map(p=>p.wage)),raw:quantiles(rows.map(p=>p.raw)),rounded:quantiles(rows.map(p=>p.rounded)),byAge:[16,17,18,19].map(age=>({age,raw:quantiles(rows.filter(p=>p.age===age).map(p=>p.raw))})),bySuitability:[1,50,60,70,80,90].map((min,i,mins)=>({min,max:mins[i+1]??100,wage:quantiles(rows.filter(p=>p.skill>=min&&p.skill<(mins[i+1]??100)).map(p=>p.wage)),raw:quantiles(rows.filter(p=>p.skill>=min&&p.skill<(mins[i+1]??100)).map(p=>p.raw))}))};
 });
}

selfTest();
if(process.argv.includes('--self-test')) console.log('769 reference checks PASS');
else console.log(JSON.stringify({status:'DRAFT research only',config:settings,scenarios,capacity:capacities(),cohort:cohortReport()},null,2));
