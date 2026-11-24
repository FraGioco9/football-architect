import {FORECAST_EXPOSURES} from './player-market-value-forecast-data.mjs';
// #769 provisional standardized population forecast, independent of actual club and agent.
// Compile weighted salary curves once. Prefix sums permit exact floor-aware expectation
// without scanning every reward context for every projected season/player.
const ageCenters=[17.5,22,27,31,36],skillCenters=[45,55,65,75,85];
function bracket(v,centers){
 if(v<=centers[0])return [0,0,0];
 const last=centers.length-1;if(v>=centers[last])return [last,last,0];
 for(let hi=1;hi<=last;hi++)if(v<=centers[hi])return [hi-1,hi,(v-centers[hi-1])/(centers[hi]-centers[hi-1])];
 throw Error('invalid_forecast_input');
}
function compileTier(contexts,tier,benchmark){
 const entries=[...contexts.values()].filter(x=>x.tier===tier).sort((a,b)=>a.rewards-b.rewards);
 const factors=entries.map(x=>Math.sqrt(x.rewards/benchmark)),weights=[0],weighted=[0];
 for(let i=0;i<entries.length;i++){weights.push(weights[i]+entries[i].n);weighted.push(weighted[i]+entries[i].n*factors[i])}
 return {factors,weights,weighted,total:weights.at(-1),factorTotal:weighted.at(-1)};
}
function expectedTier(base,floor,curve){
 let lo=0,hi=curve.factors.length;
 while(lo<hi){const mid=(lo+hi)>>>1;if(base*curve.factors[mid]<floor)lo=mid+1;else hi=mid}
 return floor*curve.weights[lo]+base*(curve.factorTotal-curve.weighted[lo]);
}
export function createStandardizedForecast({salaryScale,salaryMultiplier,rewardBenchmark,divisionFloors,priorExposure}){
 const rows=FORECAST_EXPOSURES.map(ageRows=>{
  const pool={active:0,employed:0,paid:0,contexts:new Map()};
  function add(map,tier,rewards,n){const key=tier+':'+rewards;const old=map.get(key);if(old)old.n+=n;else map.set(key,{tier,rewards,n})}
  for(const [active,employed,paid,contexts] of ageRows){
   if(!Number.isSafeInteger(active)||!Number.isSafeInteger(employed)||active<0||employed<0||employed>active||!Number.isFinite(paid)||paid<0||paid>employed)throw Error('invalid_forecast_exposures');
   pool.active+=active;pool.employed+=employed;pool.paid+=paid;
   let count=0;for(const [tier,rewards,n] of contexts){
    if(![1,2].includes(tier)||!Number.isSafeInteger(rewards)||rewards<=0||!Number.isSafeInteger(n)||n<=0)throw Error('invalid_forecast_context');
    count+=n;add(pool.contexts,tier,rewards,n);
   }if(count!==employed)throw Error('invalid_forecast_context_count');
  }
  if(!pool.active||!pool.employed)throw Error('empty_forecast_age_band');
  const prior=priorExposure/pool.active;
  return ageRows.map(([active,employed,paid,contexts])=>{
   const map=new Map();for(const x of pool.contexts.values())add(map,x.tier,x.rewards,prior*x.n);
   for(const [tier,rewards,n] of contexts)add(map,tier,rewards,n);
   const a=active+prior*pool.active,e=employed+prior*pool.employed,p=paid+prior*pool.paid;
   const one=compileTier(map,1,rewardBenchmark),two=compileTier(map,2,rewardBenchmark);
   return {employment:e/a,paid:p/e,one,two,total:one.total+two.total};
  });
 });
 return function forecast(age,skill,bonus,includeWage=true){
  const [a0,a1,aw]=bracket(age,ageCenters),[s0,s1,sw]=bracket(skill,skillCenters);
  const base=includeWage?salaryScale*salaryMultiplier**((skill-60)/10)*(1+bonus):0;
  let wage=0,employment=0,paid=0;
  const add=(a,s,w)=>{if(w===0)return;const row=rows[a][s];employment+=w*row.employment;paid+=w*row.paid;
   if(includeWage)wage+=w*(expectedTier(base,divisionFloors[1],row.one)+expectedTier(base,divisionFloors[2],row.two))/row.total;
  };
  add(a0,s0,(1-aw)*(1-sw));add(a0,s1,(1-aw)*sw);add(a1,s0,aw*(1-sw));add(a1,s1,aw*sw);
  return {wage,employment,paid};
 };
}
