// Historical #770 sensitivity, superseded by #775. Uses frozen v3 valuation.
// #770 isolated DRAFT monetization sensitivity, no wallet/checkout or runtime writes.
import {generateTrial,calculatePositionSuitability} from './players-generation-trial.mjs';
import * as api from './economy-history-v3/player-market-value.mjs';
import {createStandardizedForecast} from './economy-history-v3/player-market-value-forecast.mjs';
const c=api.MARKET_VALUE_CONFIG,forecast=createStandardizedForecast(c);
if(c.version!=='remaining-commission-draft-v3-769')throw Error('Rebaseline #770 before changing the valuation version');
const policies=[{"id":"25pct","rate":0.25,"min":0,"max":null},{"id":"40pct","rate":0.4,"min":0,"max":null},{"id":"60pct","rate":0.6,"min":0,"max":null},{"id":"40pct-banded","rate":0.4,"min":50,"max":2500}];
const payroll=[14474177,14936357,15953541,17304836,18020650,18473088,18687022,18811962,18890588,18997536,19090802,19159663,19253002,19403123,19531128,19770233,19833218,19912427,20033850,20173254,20323775,20608305,21072824,21519756,21949560,22309572,22584204,22905801,23056710,23292445,23481951,23665548]; // #771 base 3-seed annual paid salary means, aggregate overlay
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}

function quantile(v,q){const x=[...v].sort((a,b)=>a-b);return x.length?x[Math.floor((x.length-1)*q)]:null}

function stats(v){return {n:v.length,p10:quantile(v,.1),median:quantile(v,.5),p90:quantile(v,.9),mean:v.length?v.reduce((s,x)=>s+x,0)/v.length:null}}

function profile(candidate,api,calculatePositionSuitability){
 const input={age:candidate.initial_age,career_status:"active",primary_position:candidate.primary_position,secondary_positions:candidate.secondary_positions,attributes:candidate.attributes};
 const scores=[...new Set([input.primary_position,...input.secondary_positions])].map(p=>calculatePositionSuitability(input.attributes,p)).sort((a,b)=>b-a);
 const skill=scores[0],bonus=scores.slice(1,6).reduce((s,v,i)=>s+api.MARKET_VALUE_CONFIG.versatility[i]*Math.max(0,1-(skill-v)/10),0);
 return {age:input.age,skill,bonus,raw:api.rawPlayerMarketValueArc(input),display:api.calculatePlayerMarketValueArc(input)};
}

function price(raw,policy){return Math.max(policy.min,Math.min(policy.max??Infinity,Math.ceil(raw*policy.rate)))}

function feeSplit(consideration,rate,payer){
 if(!Number.isSafeInteger(consideration)||consideration<0||![5,10].includes(rate)||!["buyer","seller","split"].includes(payer))throw Error("invalid trade");
 const fee=Math.floor(consideration*rate/100);
 const buyerFee=payer==="buyer"?fee:payer==="split"?Math.floor(fee/2):0;
 return {buyerDebit:consideration+buyerFee,sellerCredit:consideration-(fee-buyerFee),fee};
}

function checks(){
 for(const amount of [1,19,20,101,1000,99999])for(const rate of [5,10])for(const payer of ["buyer","seller","split"]){
  const v=feeSplit(amount,rate,payer);
  if(v.buyerDebit!==v.sellerCredit+v.fee||v.sellerCredit<0)throw Error("fee reconciliation");
 }
 if(price(1250,policies[1])!==500||price(1,policies[3])!==50||price(10000,policies[3])!==2500)throw Error("price boundaries");
 // No transfer on cancel, successful payment ID applied once; conflicting payload rejected.
 const seen=new Map(),balances=[1000,0,0];
 function execute(id,amount,status){if(status!=="executed")return;const old=seen.get(id);if(old!==undefined){if(old!==amount)throw Error("conflict");return}const v=feeSplit(amount,5,"seller");if(balances[0]<v.buyerDebit)throw Error("funds");balances[0]-=v.buyerDebit;balances[1]+=v.sellerCredit;balances[2]+=v.fee;seen.set(id,amount)}
 execute("a",500,"cancelled");execute("a",500,"executed");execute("a",500,"executed");if(balances.join(",")!=="500,475,25")throw Error("duplicate fee");
 return "PASS";
}

function career(p,rng,forecast,c,opt){
 let age=p.age,skill=p.skill,term=0,wage=0,held=true,employed=false;const income=[];
 const growthFactor=.5+rng(); // independent hypothetical progression variation, never private aptitude
 const ownTier=opt.ownTier??0;
 for(let t=0;age<40;t++,age++){
  if(t&&held&&rng()<opt.churn)held=false;
  const f=forecast(age,skill,p.bonus,true);
  const forced=ownTier&&t<3;
  if(forced){
   if(t===0){wage=Math.max(c.divisionFloors[ownTier],Math.round(f.wage));term=3}
   employed=true;
  }else if(term<=0){
   // Employment probability is synthetic aggregate, conditional on active player.
   employed=rng()<Math.min(1,f.employment*opt.employment);
   wage=Math.round(f.wage*(.85+.3*rng()));term=employed?1+Math.floor(rng()*3):1;
  }
  const paid=employed&&rng()<opt.collection?Math.round(wage*f.paid):0;
  income.push(held?Math.floor(paid/20):0);
  term--;skill=Math.min(99,skill+c.growth[age-16]*growthFactor);
  if(rng()<(c.retirement[age+1]??0))break;
 }
 return income;
}

function analyzeCareer(profiles,forecast,c){
 const variants=[{id:"retained",churn:0,employment:1,collection:1},{id:"5pct-mandate-loss",churn:.05,employment:1,collection:1},{id:"10pct-mandate-loss",churn:.1,employment:1,collection:1},{id:"stress",churn:.1,employment:.7,collection:.75},{id:"origin-tier1",churn:.05,employment:1,collection:1,ownTier:1},{id:"origin-tier2",churn:.05,employment:1,collection:1,ownTier:2}];
 return variants.map((opt,index)=>{
  const rng=random(770+index),paths=profiles.flatMap(p=>Array.from({length:12},()=>({p,income:career(p,rng,forecast,c,opt)})));
  return {variant:opt.id,policies:policies.map(policy=>{
   const rows=paths.map(({p,income})=>{const cost=price(p.raw,policy);let total=0,breakEven=null;income.forEach((v,i)=>{total+=v;if(breakEven===null&&total>=cost)breakEven=i+1});return {cost,total,breakEven,skill:p.skill,age:p.age}});
   const recovered=rows.filter(x=>x.breakEven!==null);
   return {policy:policy.id,price:stats(rows.map(x=>x.cost)),income:stats(rows.map(x=>x.total)),lossRate:1-recovered.length/rows.length,zeroIncomeRate:rows.filter(x=>x.total===0).length/rows.length,breakEven:stats(recovered.map(x=>x.breakEven)),skillBands:[0,50,60,70,80].map((lo,i,arr)=>{const b=rows.filter(x=>x.skill>=lo&&x.skill<(arr[i+1]??100));return {lo,n:b.length,price:stats(b.map(x=>x.cost)),income:stats(b.map(x=>x.total)),lossRate:b.length?b.filter(x=>x.breakEven===null).length/b.length:null}})};
  })};
 });
}

function world(profiles,forecast,c,payroll,opt){
 const rng=random(opt.seed),pick=xs=>xs[Math.floor(rng()*xs.length)],sum=xs=>xs.reduce((a,b)=>a+b,0);
 let reserve=0,club=0,issued=0,catalog=[],players=[],nextUser=0,nextPlayer=0;
 const users=[],join=()=>{const u={id:nextUser++,cash:opt.starting,active:true,mandates:0};users.push(u);issued+=opt.starting;return u};
 for(let i=0;i<256;i++)join();
 const series=[];
 for(let season=1;season<=32;season++){
  const m={season,purchases:0,primaryReceipts:0,tradeCount:0,tradeVolume:0,secondaryFees:0,commission:0,churned:0,retired:0,offers:0,unaffordable:0,activated:0};
  let active=users.filter(u=>u.active);
  for(const u of active)if(rng()<opt.churn){u.active=false;m.churned++;join()}
  active=users.filter(u=>u.active);
  // Hypothetical loss on account churn; no confiscation of wallet or resale proceeds.
  for(const p of players)if(p.owner&&!p.owner.active){p.owner.mandates--;p.owner=null}
  const recycle=opt.recycle?Math.min(60000000,reserve):0;reserve-=recycle;issued+=60000000-recycle;club+=60000000;
  for(let i=0;i<768;i++){const q=pick(profiles);catalog.push({...q,price:price(q.raw,opt.policy),id:nextPlayer++})}
  // One or two shopping attempts per user per season, sample a small menu from persistent catalog.
  // Fixed shopping effort is an assumption; no empirical demand elasticity or fresh annual generation.
  for(const u of active){
   const attempts=rng()<opt.shopping?2:1;
   for(let j=0;j<attempts&&catalog.length;j++){
    if(rng()>opt.shopping)continue;m.offers++;
    const available=[];for(let k=0;k<Math.min(6,catalog.length);k++){const idx=Math.floor(rng()*catalog.length);if(catalog[idx].price<=u.cash)available.push(idx)}
    if(!available.length){m.unaffordable++;continue}
    const idx=pick(available),p=catalog[idx];catalog[idx]=catalog.at(-1);catalog.pop();
    u.cash-=p.price;reserve+=p.price;u.mandates++;m.purchases++;m.primaryReceipts+=p.price;
    players.push({...p,owner:u,term:0,wage:0,employed:false,growthFactor:.5+rng()});
   }
  }
  // Secondary mandate trades only; separate from sporting transfer and license prices.
  for(const p of players){
   if(!p.owner||rng()>opt.resale)continue;
   const buyer=pick(active);if(buyer===p.owner)continue;
   const f=forecast(p.age,p.skill,p.bonus,true);
   // Simple negotiated consideration proxy: 50% of remaining conditional commission exposure.
   const years=Math.max(0,36-p.age);
   const consideration=Math.max(1,Math.round(.5*years*c.commission*f.wage*f.employment*f.paid*(.75+.5*rng())));
   const split=feeSplit(consideration,opt.fee,opt.payer);
   if(buyer.cash<split.buyerDebit)continue;
   buyer.cash-=split.buyerDebit;p.owner.cash+=split.sellerCredit;reserve+=split.fee;p.owner.mandates--;buyer.mandates++;p.owner=buyer;
   m.tradeCount++;m.tradeVolume+=consideration;m.secondaryFees+=split.fee;
  }
  let representedPayroll=0,modeledPayroll=0;
  for(const p of players){
   const f=forecast(p.age,p.skill,p.bonus,true);
   if(p.term<=0){p.employed=rng()<f.employment;p.wage=Math.round(f.wage*(.85+.3*rng()));p.term=p.employed?1+Math.floor(rng()*3):1}
   const paid=p.employed&&rng()<opt.collection?Math.round(p.wage*f.paid):0;
   modeledPayroll+=paid;
   if(p.owner){const commission=Math.floor(paid/20);representedPayroll+=paid;p.owner.cash+=commission;m.commission+=commission}
   p.term--;p.skill=Math.min(99,p.skill+c.growth[p.age-16]*p.growthFactor);p.age++;
  }
  // Aggregate economic overlay: residual AI wages fill the previous #769 payroll reference;
  // if modeled salaries exceed that reference, pay full modeled amount (no hard wage cap).
  const paidPayroll=Math.max(payroll[season-1],modeledPayroll),staff=5760000;
  if(club<paidPayroll+staff)throw Error("aggregate liquidity exceeded; scenario requires club-level arrears model");
  club-=paidPayroll+staff;reserve+=paidPayroll-m.commission+staff;
  players=players.filter(p=>{if(rng()<(c.retirement[p.age]??0)){if(p.owner)p.owner.mandates--;m.retired++;return false}return true});
  const allCash=sum(users.map(u=>u.cash)),activeCash=sum(active.map(u=>u.cash));
  if(!Number.isSafeInteger(issued)||club+reserve+allCash!==issued||sum(users.map(u=>u.mandates))!==players.filter(p=>p.owner).length)throw Error("stock/mandate conservation");
  const top=[...active].sort((a,b)=>b.mandates-a.mandates).slice(0,26);
  series.push({...m,recycled:recycle,issued,club,reserve,allCash,activeCash,inactiveCash:allCash-activeCash,catalog:catalog.length,players:players.length,represented:players.filter(p=>p.owner).length,employed:players.filter(p=>p.employed).length,representedPayroll,paidPayroll,activeWallet:stats(active.map(u=>u.cash)),mandates:stats(active.map(u=>u.mandates)),top10MandateShare:sum(top.map(u=>u.mandates))/Math.max(1,sum(active.map(u=>u.mandates))),noMandates:active.filter(u=>!u.mandates).length,realMoney:{receipts:null,costs:null}});
 }
 return {options:opt,series};
}

function summarize(run){
 const tail=run.series.slice(-10),l=run.series.at(-1),mean=k=>tail.reduce((s,x)=>s+x[k],0)/tail.length;
 return {name:run.options.name,seed:run.options.seed,purchases:mean("purchases"),tradeCount:mean("tradeCount"),tradeVolume:mean("tradeVolume"),primary:mean("primaryReceipts"),fees:mean("secondaryFees"),commission:mean("commission"),unaffordable:mean("unaffordable"),catalog:l.catalog,represented:l.represented,players:l.players,club:l.club,reserve:l.reserve,agentCash:l.allCash,inactiveCash:l.inactiveCash,issued:l.issued,top10MandateShare:l.top10MandateShare,medianWallet:l.activeWallet.median,noMandates:l.noMandates,recycled:mean("recycled")};
}
const profiles=[1,2,3].flatMap(n=>generateTrial({count:1000,seed:'769-cohort-'+n}).candidates.map(p=>profile(p,api,calculatePositionSuitability)));
const cases=[{"name":"25pct","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"seller","recycle":true,"policy":{"id":"25pct","rate":0.25,"min":0,"max":null}},{"name":"40pct","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"seller","recycle":true,"policy":{"id":"40pct","rate":0.4,"min":0,"max":null}},{"name":"60pct","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"seller","recycle":true,"policy":{"id":"60pct","rate":0.6,"min":0,"max":null}},{"name":"40pct-banded","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"seller","recycle":true,"policy":{"id":"40pct-banded","rate":0.4,"min":50,"max":2500}},{"name":"40pct-fee10","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":10,"payer":"seller","recycle":true,"policy":{"id":"40pct","rate":0.4,"min":0,"max":null}},{"name":"40pct-buyer5","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"buyer","recycle":true,"policy":{"id":"40pct","rate":0.4,"min":0,"max":null}},{"name":"40pct-low-wallet","starting":500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"seller","recycle":true,"policy":{"id":"40pct","rate":0.4,"min":0,"max":null}},{"name":"40pct-high-churn","starting":1500,"churn":0.1,"shopping":0.8,"resale":0.04,"collection":0.75,"fee":5,"payer":"seller","recycle":true,"policy":{"id":"40pct","rate":0.4,"min":0,"max":null}},{"name":"40pct-fresh-issuance","starting":1500,"churn":0.05,"shopping":0.8,"resale":0.04,"collection":1,"fee":5,"payer":"seller","recycle":false,"policy":{"id":"40pct","rate":0.4,"min":0,"max":null}}];
console.log(JSON.stringify({checks:checks(),career:analyzeCareer(profiles,forecast,c),world:cases.flatMap(opt=>[770,1770,2770].map(seed=>world(profiles,forecast,c,payroll,{...opt,seed})))},null,2));
