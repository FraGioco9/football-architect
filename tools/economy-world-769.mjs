// #769 — isolated synthetic world sensitivity, not sporting or transactional implementation.
import { generateTrial } from './players-generation-trial.mjs';
import { researchApi as api } from './economy-recalibration-769.mjs';
function rngSeed(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296}}

function allocate(pool,weights){
 const denom=weights.reduce((a,b)=>a+b,0);if(!denom)throw Error("zero weight");
 const rows=weights.map((w,i)=>({i,amount:Math.floor(pool*w/denom),remainder:(pool*w)%denom}));
 const remaining=pool-rows.reduce((a,b)=>a+b.amount,0);
 [...rows].sort((a,b)=>b.remainder-a.remainder||a.i-b.i).slice(0,remaining).forEach(x=>x.amount++);
 return rows.map(x=>x.amount);
}

function simulate(profiles,api,opt){
 const rng=rngSeed(opt.seed??769), draw=xs=>xs[Math.floor(rng()*xs.length)],sum=xs=>xs.reduce((a,b)=>a+b,0);
 const scenario=api.scenarios.find(x=>x.id===opt.curve), clubs=Array.from({length:256},(_,id)=>({id,nation:Math.floor(id/32),tier:id%32<16?1:2,cash:opt.openingCash,rank:id%16+1,qual:0,forecast:id%32<16?250000:125000,arrears:[],squad:[]}));
 const agents=Array(256).fill(0);let reserve=0,issued=0,retiredCurrency=0,catalog=[],free=[],nextId=0;
 const newPlayer=(p,age=p.age)=>({...p,id:nextId++,age,skill:Math.min(99,p.skill+sum(api.growth.slice(p.age-16,Math.max(p.age-16,age-16)))),agent:rng()<opt.coverage?Math.floor(rng()*256):-1,wage:0,term:0});
 const ask=(p,c)=>api.normalSalary(p.skill,p.bonus,scenario,{tier:c.tier,rewards:c.forecast})*(p.agent<0?1.25:1);
 function contract(p,c,initial=false){
  const opening=ask(p,c);
  if(!initial&&rng()>opt.acceptance)return false;
  p.wage=Math.max(api.settings.floors[c.tier],Math.round(opening*(p.agent<0?.80+.20*rng():.90+.20*rng())));
  p.term=1+Math.floor(rng()*3);c.squad.push(p);return true;
 }
 for(const c of clubs)for(let i=0;i<opt.squad;i++)contract(newPlayer(draw(profiles),16+Math.floor(rng()*17)),c,true);
 const opening=clubs.length*opt.openingCash, series=[];
 for(let season=1;season<=32;season++){
  const m={season,purchases:0,retirements:0,offers:0,accepted:0,transfers:0,transferVolume:0,wageDue:0,wagePaid:0,commission:0,reserveWage:0,staffPaid:0,staffDue:0,unpaidClubs:0,partialPayments:0,issued:0,recycled:0,missedQualification:0,asks:0,acceptedWages:0,agentPayments:Array(256).fill(0)};
  // Candidate purchases are exogenous successful activation events; no price/checkout or money flow assumed.
  for(let i=0;i<768;i++)catalog.push(draw(profiles));
  const retained=[];
  for(const p of catalog){if(rng()<opt.purchase){free.push(newPlayer(p));m.purchases++}else retained.push(p)}
  catalog=retained;
  // Existing contracts may end; no wage decrease on relegation; promotion floor applies prospectively.
  for(const c of clubs){
   const existing=c.squad;c.squad=[];
   for(const p of existing){
    if(p.term>0){p.wage=Math.max(p.wage,api.settings.floors[c.tier]);c.squad.push(p);continue}
    if(rng()<.08)p.agent=rng()<opt.coverage?Math.floor(rng()*256):-1;
    m.offers++;m.asks+=ask(p,c);
    if(rng()<.88&&contract(p,c)){m.accepted++;m.acceptedWages+=p.wage}else free.push(p);
   }
  }
  // Fill vacancies from free agents; unsuccessful offers stay unemployed.
  free.sort((a,b)=>b.skill-a.skill||a.id-b.id);
  for(const c of [...clubs].sort((a,b)=>b.forecast-a.forecast||a.id-b.id)){
   while(c.squad.length<opt.squad&&free.length){
    const p=free.shift();m.offers++;m.asks+=ask(p,c);
    if(contract(p,c)){m.accepted++;m.acceptedWages+=p.wage}else{free.push(p);break}
   }
  }
  // Synthetic sporting transfer of already-contracted player, with a vacancy and funded bilateral payment.
  for(const from of clubs){if(from.squad.length<2||rng()>.18)continue;
   const to=draw(clubs);if(to===from||to.squad.length>=opt.squad)continue;
   const p=draw(from.squad);const fee=Math.round(p.wage*2);
   if(to.cash<fee||rng()>.6)continue;
   from.cash+=fee;to.cash-=fee;from.squad.splice(from.squad.indexOf(p),1);to.squad.push(p);
   p.wage=Math.max(p.wage,api.settings.floors[to.tier]);m.transfers++;m.transferVolume+=fee;
  }
  const awards=clubs.map(()=>({participation:0,results:0})), credit=(ids,pool,weights,key)=>allocate(pool,weights).forEach((v,i)=>awards[ids[i].id][key]+=v);
  const ranking=(list)=>list.map(c=>({c,score:sum(c.squad.map(p=>p.skill))/Math.max(1,c.squad.length)-Math.max(0,18-c.squad.length)*3+20*rng()})).sort((a,b)=>b.score-a.score||a.c.id-b.c.id).map(x=>x.c);
  const promoted=[],relegated=[],nextQual=new Map();
  for(let n=0;n<8;n++){
   const nation=clubs.filter(c=>c.nation===n);
   const top=ranking(nation.filter(c=>c.tier===1)),low=ranking(nation.filter(c=>c.tier===2));
   for(const [tier,list] of [[1,top],[2,low]]){
    const pool=tier===1?4000000:2000000;
    credit(list,pool*.6,list.map(()=>1),"participation");
    credit(list,pool*.15,list.map((_,i)=>70-3*i),"results");
    credit(list,pool*.25,list.map((_,i)=>16-i),"results");
    list.forEach((c,i)=>{c.rank=i+1});
   }
   top.slice(0,6).forEach((c,i)=>nextQual.set(c.id,i<3?1:2));
   promoted.push(...low.slice(0,2));relegated.push(...top.slice(-2));
   // Research proxy: one additional possible playoff/playout swap, not canonical match simulation.
   if(rng()<.5){promoted.push(draw(low.slice(2,6)));relegated.push(draw(top.slice(12,14)))}
  }
  for(const [cup,pool] of [[1,8000000],[2,4000000]]){
   const entrants=ranking(clubs.filter(c=>season===1?(c.tier===1&&c.id%32>=(cup-1)*3&&c.id%32<cup*3):c.qual===cup));
   if(entrants.length!==24)throw Error("cup entrants");
   credit(entrants,pool*.4,entrants.map(()=>1),"participation");
   credit(entrants,pool*.2,entrants.map((_,i)=>Math.max(1,18-Math.floor(i*.65))),"results");
   credit(entrants,pool*.4,[27,17,10,10,6,6,6,6,3,3,3,3,...Array(12).fill(0)],"results");
  }
  if(sum(awards.map(a=>a.participation+a.results))!==60000000)throw Error("reward pool");
  const recycle=opt.recycle?Math.min(reserve,60000000):0;reserve-=recycle;issued+=60000000-recycle;m.recycled=recycle;m.issued=60000000-recycle;
  // Funding temporarily held outside club accounts until simulated certification.
  let funding=60000000;
  const payReward=(c,amount)=>{funding-=amount;c.cash+=amount};
  const settle=(c)=>{
   for(const o of c.arrears){
    const payment=Math.min(c.cash,o.due-o.paid);
    if(!payment)continue;
    const before=o.paid;o.paid+=payment;c.cash-=payment;
    // Cumulative floor for one earned period/mandate obligation, not market-value rounding.
    const commission=o.agent<0?0:Math.floor(o.paid/20)-Math.floor(before/20);
    if(o.agent>=0){agents[o.agent]+=commission;m.agentPayments[o.agent]+=commission}
    reserve+=payment-commission;m.commission+=commission;m.reserveWage+=payment-commission;m.wagePaid+=payment;
    if(o.paid<o.due)m.partialPayments++;
   }
   c.arrears=c.arrears.filter(o=>o.paid<o.due);
  };
  for(const c of clubs){
   const award=awards[c.id];
   payReward(c,Math.floor(award.participation/2));
   payReward(c,award.participation-Math.floor(award.participation/2));
   // Staff/other costs are hypothetical virtual payments to reserve, not actual EUR costs.
   const staff=opt.staff*(c.tier===1?2:1);m.staffDue+=staff;
   const early=Math.min(c.cash,Math.floor(staff/2));c.cash-=early;reserve+=early;m.staffPaid+=early;
   const obligations=c.squad.map(p=>({agent:p.agent,due:Math.floor(p.wage/2),full:p.wage,paid:0}));
   m.wageDue+=sum(obligations.map(o=>o.full));c.arrears.push(...obligations);settle(c);
   payReward(c,award.results);
   // The same annual obligation accumulates both installments, even if first was fully paid.
   for(const o of obligations){o.due=o.full;if(!c.arrears.includes(o)&&o.due>o.paid)c.arrears.push(o)}
   settle(c);
   const later=Math.min(c.cash,staff-early);c.cash-=later;reserve+=later;m.staffPaid+=later;
   if(c.arrears.length)m.unpaidClubs++;
   if(c.qual&&!nextQual.has(c.id))m.missedQualification++;
   c.forecast=.5*c.forecast+.5*(award.participation+award.results);
   c.qual=nextQual.get(c.id)??0;
  }
  if(funding!==0||m.commission+m.reserveWage!==m.wagePaid)throw Error("settlement conservation");
  // All currency remains in named balances except explicit retirement scenario.
  const burn=Math.floor(reserve*(opt.burn??0));reserve-=burn;retiredCurrency+=burn;
  for(const c of clubs){const keep=[];for(const p of c.squad){p.term--;p.skill=Math.min(99,p.skill+api.growth[p.age-16]);p.age++;if(rng()<(api.retirement[p.age]??0))m.retirements++;else keep.push(p)}c.squad=keep}
  free=free.filter(p=>{p.skill=Math.min(99,p.skill+api.growth[p.age-16]);p.age++;if(rng()<(api.retirement[p.age]??0)){m.retirements++;return false}return true});
  for(const c of promoted)c.tier=1;for(const c of relegated)c.tier=2;
  const clubCash=sum(clubs.map(c=>c.cash)),agentCash=sum(agents),arrears=sum(clubs.flatMap(c=>c.arrears.map(o=>o.due-o.paid)));
  if(clubCash+agentCash+reserve!==opening+issued-retiredCurrency)throw Error("supply conservation");
  const sorted=clubs.map(c=>c.cash).sort((a,b)=>b-a);
  const employed=sum(clubs.map(c=>c.squad.length));
  series.push({...m,agentPayments:undefined,agentIncome:api.quantiles(m.agentPayments),clubCash,agentCash,reserve,arrears,employed,free:free.length,catalog:catalog.length,coverage:sum(clubs.flatMap(c=>c.squad.map(p=>Number(p.agent>=0))))/Math.max(1,employed),squad:api.quantiles(clubs.map(c=>c.squad.length)),clubBalance:api.quantiles(sorted),top10Share:sum(sorted.slice(0,26))/Math.max(1,clubCash),wages:api.quantiles(clubs.flatMap(c=>c.squad.map(p=>p.wage))),cumulativeIssued:issued,cumulativeRetired:retiredCurrency,realMoney:{receipts:null,costs:null}});
 }
 return {options:opt,opening,series};
}
const base={"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0};
const options=[{"seed":769,"coverage":0,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.25,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.75,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":1,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":false,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0.5},{"seed":769,"coverage":0.5,"openingCash":0,"squad":18,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":32,"curve":"candidate","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"candidate","purchase":0.015,"acceptance":0.5,"staff":80000,"recycle":true,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"lower-base","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0},{"seed":769,"coverage":0.5,"openingCash":0,"squad":25,"curve":"steeper","purchase":0.08,"acceptance":0.8,"staff":15000,"recycle":true,"burn":0}];
const profiles=[1,2,3].flatMap(n=>generateTrial({count:1000,seed:'769-cohort-'+n}).candidates.map(api.profile));
console.log(JSON.stringify(options.map(o=>simulate(profiles,api,o)),null,2));
