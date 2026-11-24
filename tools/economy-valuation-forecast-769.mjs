// #769 public-input forecast sensitivity; research only, never a public API.
import {readFileSync} from 'node:fs';
import {generateTrial} from './players-generation-trial.mjs';
import {researchApi as api} from './economy-recalibration-769.mjs';
function combine(observations){
 const out={};for(const run of observations)for(const [key,row] of Object.entries(run.cells)){
  const cell=out[key]??={active:0,employed:0,paidShare:0,actualWage:0,contexts:{}};
  for(const k of ["active","employed","paidShare","actualWage"])cell[k]+=row[k];
  for(const [ctx,n] of Object.entries(row.contexts))cell.contexts[ctx]=(cell.contexts[ctx]??0)+n;
 }return out;
}

function bracket(value,centers){
 if(value<=centers[0])return [[0,1]];
 const last=centers.length-1;if(value>=centers[last])return [[last,1]];
 const hi=centers.findIndex(x=>x>=value),w=(value-centers[hi-1])/(centers[hi]-centers[hi-1]);
 return [[hi-1,1-w],[hi,w]];
}

function forecast(age,skill,bonus,scenario,cells,api){
 const ages=[16,20,25,30,33],skills=[0,50,60,70,80];
 // Interpolate midpoints to avoid artificial discontinuities across reporting bins.
 const ac=bracket(age,[17.5,22,27,31,36]),sc=bracket(skill,[45,55,65,75,85]);
 let wage=0,employment=0,paid=0,actualWage=0;
 for(const [i,aw] of ac)for(const [j,sw] of sc){
  const row=cells[ages[i]+":"+skills[j]],weight=aw*sw;
  // Sparse cells shrink toward same-age pooled cells; 250 exposure pseudo-counts is sensitivity, not approved.
  const fallback=combine([{cells:Object.fromEntries(Object.entries(cells).filter(([k])=>k.startsWith(ages[i]+":")))}]);
  const total={active:0,employed:0,paidShare:0,actualWage:0,contexts:{}};
  for(const v of Object.values(fallback)){for(const k of ["active","employed","paidShare","actualWage"])total[k]+=v[k];for(const [k,n] of Object.entries(v.contexts))total.contexts[k]=(total.contexts[k]??0)+n}
  const prior=250/Math.max(1,total.active),a=(row?.active??0)+prior*total.active,e=(row?.employed??0)+prior*total.employed,p=(row?.paidShare??0)+prior*total.paidShare;
  const contexts={};for(const [k,n] of Object.entries(total.contexts))contexts[k]=prior*n;for(const [k,n] of Object.entries(row?.contexts??{}))contexts[k]=(contexts[k]??0)+n;
  let conditional=0,count=0;for(const [ctx,n] of Object.entries(contexts)){const [tier,rewards]=ctx.split(":").map(Number);conditional+=api.normalSalary(skill,bonus,scenario,{tier,rewards})*n;count+=n}
  wage+=weight*(count?conditional/count:api.expectedSalary(skill,bonus,scenario));
  employment+=weight*(a?e/a:0);paid+=weight*(e?p/e:0);
  actualWage+=weight*(e?((row?.actualWage??0)+prior*total.actualWage)/e:0);
 }
 return {wage,employment,paid,actualWage};
}

function projectedValue(age,skill,bonus,scenario,cells,api,discount=0,fullEmployment=false){
 let value=0,survival=1,wage=0;
 for(let t=0;t<=39-age;t++){
  const f=forecast(age+t,skill,bonus,scenario,cells,api);
  if(t%api.settings.renewalSeasons===0)wage=f.wage;
  value+=api.settings.commission*wage*survival*(fullEmployment?1:f.employment*f.paid)/(1+discount)**(t+1);
  skill=Math.min(99,skill+api.growth[age+t-16]);survival*=1-(api.retirement[age+t+1]??0);
 }return value;
}
const stress=JSON.parse(readFileSync(new URL('../docs/economy-recalibration-769-stress.json',import.meta.url),'utf8'));
const cohort=[1,2,3].flatMap(n=>generateTrial({count:1000,seed:'769-cohort-'+n}).candidates.map(api.profile));
const cells=combine(stress.observations),scenario=api.scenarios.find(x=>x.id==='candidate');
function evaluate(cells,discount,fullEmployment){return api.quantiles(cohort.map(p=>api.roundValue(projectedValue(p.age,p.skill,p.bonus,scenario,cells,api,discount,fullEmployment))))}
const byAge=[16,24,32,39].map(age=>({age,values:[50,60,70,80].map(skill=>({skill,fullValue:api.roundValue(projectedValue(age,skill,0,scenario,cells,api,0,true)),employmentAdjustedValue:api.roundValue(projectedValue(age,skill,0,scenario,cells,api)),discount3Value:api.roundValue(projectedValue(age,skill,0,scenario,cells,api,.03)),...forecast(age,skill,0,scenario,cells,api)}))}));
console.log(JSON.stringify({byAge,fullContext:evaluate(cells,0,true),worldEmployment:evaluate(cells,0,false),discount3:evaluate(cells,.03,false),discount5:evaluate(cells,.05,false),seedSensitivity:stress.observations.map(run=>({seed:run.seed,values:evaluate(combine([run]),0,false)}))},null,2));
