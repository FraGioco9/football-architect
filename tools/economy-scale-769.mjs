// #769 / #770 scale alternatives, no runtime or financial mutations.
// #769 isolated research; fresh generated cohorts, role-balanced recruitment, liquidity stress.
import {generateTrial} from './players-generation-trial.mjs';
import {researchApi as api} from './economy-recalibration-769.mjs';
function roleGroup(position){return position==="GK"?"GK":["RB","CB","LB","RWB","LWB"].includes(position)?"DEF":["DM","CM","AM","RM","LM"].includes(position)?"MID":"FWD"}

function entryProfile(candidate,api){return {...api.profile(candidate),group:roleGroup(candidate.primary_position)}}

function targetGroups(n){const counts=[Math.max(2,Math.round(n*.10)),Math.round(n*.36),Math.round(n*.32)];return {GK:counts[0],DEF:counts[1],MID:counts[2],FWD:n-counts.reduce((a,b)=>a+b,0)}}

function cellKey(age,skill){return `${age<20?16:age<25?20:age<30?25:age<33?30:33}:${skill<50?0:skill<60?50:skill<70?60:skill<80?70:80}`}

function splitPayment(previous,amount,human,rate=.05){
 if(!Number.isSafeInteger(previous)||previous<0||!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(previous+amount))throw Error("invalid payment");
 const agent=human?(rate===1?amount:Math.floor((previous+amount)/20)-Math.floor(previous/20)):0;
 return {agent,reserve:amount-agent};
}

function accountingChecks(){
 for(const total of [0,1,19,20,21,99,101,1001,999999]){
  for(const human of [true,false]){
   const whole=splitPayment(0,total,human);
   for(const part of [0,Math.floor(total/3),Math.floor(total/2),total]){
    const a=splitPayment(0,part,human),b=splitPayment(part,total-part,human);
    if(a.agent+b.agent!==whole.agent||a.reserve+b.reserve!==whole.reserve||whole.agent+whole.reserve!==total)throw Error("split reconciliation");
   }
  }
 }
 // Old obligation remains attributable to A after mandate changes to B.
 const a=splitPayment(0,39,true),arrears=splitPayment(39,61,true),b=splitPayment(0,120,true);
 if(a.agent+arrears.agent!==5||b.agent!==6)throw Error("mandate attribution");
 // Deduplication by earned obligation ID and payment ID is a candidate design, not production code.
 const seen=new Map(), paid=new Map(),apply=(id,obligation,amount,human)=>{
  const payload=JSON.stringify([obligation,amount,human]);
  if(seen.has(id)){if(seen.get(id)!==payload)throw Error("conflicting retry");return {agent:0,reserve:0}}
  const prior=paid.get(obligation)??0,split=splitPayment(prior,amount,human);
  seen.set(id,payload);paid.set(obligation,prior+amount);return split;
 };
 if(apply("p1","earned-A",39,true).agent!==1||apply("p1","earned-A",39,true).agent!==0||apply("p2","earned-A",61,true).agent!==4)throw Error("duplicate payment");
 let conflict=false;try{apply("p1","earned-A",40,true)}catch{conflict=true}
 if(!conflict||paid.get("earned-A")!==100)throw Error("conflicting retry");
 for(const human of [true,false])for(const total of [1,37,1000]){const a=splitPayment(0,Math.floor(total/2),human,1),b=splitPayment(Math.floor(total/2),total-Math.floor(total/2),human,1);if(a.agent+b.agent!==(human?total:0)||a.reserve+b.reserve!==(human?0:total))throw Error("full payout");}
 return "PASS";
}
// #769 — isolated synthetic world sensitivity, not sporting or transactional implementation.


function rngSeed(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296}}

function allocate(pool,weights){
 const denom=weights.reduce((a,b)=>a+b,0);if(!denom)throw Error("zero weight");
 const rows=weights.map((w,i)=>({i,amount:Math.floor(pool*w/denom),remainder:(pool*w)%denom}));
 const remaining=pool-rows.reduce((a,b)=>a+b.amount,0);
 [...rows].sort((a,b)=>b.remainder-a.remainder||a.i-b.i).slice(0,remaining).forEach(x=>x.amount++);
 return rows.map(x=>x.amount);
}

function simulate(profiles,annual,api,opt){
 const rng=rngSeed(opt.seed??769), draw=xs=>xs[Math.floor(rng()*xs.length)],sum=xs=>xs.reduce((a,b)=>a+b,0);
 const divisor=opt.divisor,worldPool=60000000/divisor,floors={1:1000/divisor,2:500/divisor},benchmark=250000/divisor,scenario={...api.scenarios.find(x=>x.id===opt.curve),K:1500/divisor}, clubs=Array.from({length:256},(_,id)=>({id,nation:Math.floor(id/32),tier:id%32<16?1:2,cash:opt.openingCash,rank:id%16+1,qual:0,forecast:id%32<16?250000/divisor:125000/divisor,arrears:[],staffDebt:0,squad:[]}));
 const agents=Array(256).fill(0),targets=targetGroups(opt.squad),observations={};let reserve=0,issued=0,retiredCurrency=0,catalog=[],free=[],nextId=0;
 const newPlayer=(p,age=p.age)=>({...p,id:nextId++,age,skill:Math.min(99,p.skill+sum(api.growth.slice(p.age-16,Math.max(p.age-16,age-16)))),agent:rng()<opt.coverage?Math.floor(rng()*256):-1,wage:0,term:0});
 const ask=(p,c)=>Math.max(floors[c.tier],scenario.K*scenario.slope**((p.skill-60)/10)*(1+p.bonus)*Math.sqrt(c.forecast/benchmark))*(p.agent<0?1.25:1)*(opt.wageShock??1);
 function contract(p,c,initial=false){
  const opening=ask(p,c);
  if(!initial&&rng()>opt.acceptance)return false;
  p.wage=Math.max(floors[c.tier],Math.round(opening*(p.agent<0?.80+.20*rng():.90+.20*rng())));
  p.term=1+Math.floor(rng()*3);c.squad.push(p);return true;
 }
 const groups=Object.fromEntries(Object.keys(targets).map(g=>[g,profiles.filter(p=>p.group===g)]));
 for(const c of clubs)for(const [g,n] of Object.entries(targets))for(let i=0;i<n;i++){const p=draw(groups[g]);contract(newPlayer(p,Math.max(p.age,16+Math.floor(rng()*17))),c,true)}
 const opening=clubs.length*opt.openingCash, series=[];
 for(let season=1;season<=32;season++){
  const startCash=clubs.map(c=>c.cash);const m={season,purchases:0,retirements:0,offers:0,accepted:0,transfers:0,transferVolume:0,wageDue:0,wagePaid:0,commission:0,reserveWage:0,staffPaid:0,staffDue:0,unpaidClubs:0,partialPayments:0,issued:0,recycled:0,missedQualification:0,asks:0,acceptedWages:0,agentPayments:Array(256).fill(0)};
  // Candidate purchases are exogenous successful activation events; no price/checkout or money flow assumed.
  catalog.push(...annual[season-1]);
  const retained=[];
  for(const p of catalog){if(rng()<opt.purchase){free.push(newPlayer(p));m.purchases++}else retained.push(p)}
  catalog=retained;
  // Existing contracts may end; no wage decrease on relegation; promotion floor applies prospectively.
  for(const c of clubs){
   const existing=c.squad;c.squad=[];
   for(const p of existing){
    if(p.term>0){p.wage=Math.max(p.wage,floors[c.tier]);c.squad.push(p);continue}
    if(rng()<.08)p.agent=rng()<opt.coverage?Math.floor(rng()*256):-1;
    m.offers++;m.asks+=ask(p,c);
    if(rng()<.88&&contract(p,c)){m.accepted++;m.acceptedWages+=p.wage}else free.push(p);
   }
  }
  // Fill vacancies from free agents; unsuccessful offers stay unemployed.
  // Group-specific recruitment targets are scenario preferences, not game rules/caps.
  const available=Object.fromEntries(Object.keys(targets).map(g=>[g,free.filter(p=>p.group===g).sort((a,b)=>b.skill-a.skill||a.id-b.id)]));
  free=[];
  for(const c of [...clubs].sort((a,b)=>b.forecast-a.forecast||a.id-b.id)){
   for(const [g,target] of Object.entries(targets)){
    let missing=Math.max(0,target-c.squad.filter(p=>p.group===g).length),attempts=0;
    while(missing&&available[g].length&&attempts<target*3){
     const p=available[g].shift();m.offers++;m.asks+=ask(p,c);attempts++;
     if(contract(p,c)){m.accepted++;m.acceptedWages+=p.wage;missing--}else free.push(p);
    }
   }
  }
  free.push(...Object.values(available).flat());
  // Synthetic sporting transfer of already-contracted player, with a vacancy and funded bilateral payment.
  for(const from of clubs){if(from.squad.length<2||rng()>.18)continue;
   const to=draw(clubs);if(to===from||to.squad.length>=opt.squad)continue;
   const p=draw(from.squad);if(to.squad.filter(x=>x.group===p.group).length>=targets[p.group])continue;
   const fee=Math.round(p.wage*2);
   if(to.cash<fee||rng()>.6)continue;
   from.cash+=fee;to.cash-=fee;from.squad.splice(from.squad.indexOf(p),1);to.squad.push(p);
   p.wage=Math.max(p.wage,floors[to.tier]);m.transfers++;m.transferVolume+=fee;
  }
  const awards=clubs.map(()=>({participation:0,results:0})), credit=(ids,pool,weights,key)=>allocate(pool,weights).forEach((v,i)=>awards[ids[i].id][key]+=v);
  const ranking=(list)=>list.map(c=>({c,score:sum(c.squad.map(p=>p.skill))/Math.max(1,c.squad.length)-Math.max(0,18-c.squad.length)*3+20*rng()})).sort((a,b)=>b.score-a.score||a.c.id-b.c.id).map(x=>x.c);
  const promoted=[],relegated=[],nextQual=new Map();
  for(let n=0;n<8;n++){
   const nation=clubs.filter(c=>c.nation===n);
   const top=ranking(nation.filter(c=>c.tier===1)),low=ranking(nation.filter(c=>c.tier===2));
   for(const [tier,list] of [[1,top],[2,low]]){
    const pool=(tier===1?4000000:2000000)/divisor;
    credit(list,pool*.6,list.map(()=>1),"participation");
    credit(list,pool*.15,list.map((_,i)=>70-3*i),"results");
    credit(list,pool/4,[120,110,105,95,90,80,75,65,60,50,45,35,30,20,15,5],"results");
    list.forEach((c,i)=>{c.rank=i+1});
   }
   top.slice(0,6).forEach((c,i)=>nextQual.set(c.id,i<3?1:2));
   promoted.push(...low.slice(0,2));relegated.push(...top.slice(-2));
   // Research proxy: one additional possible playoff/playout swap, not canonical match simulation.
   if(rng()<.5){promoted.push(draw(low.slice(2,6)));relegated.push(draw(top.slice(12,14)))}
  }
  for(const [cup,pool] of [[1,8000000/divisor],[2,4000000/divisor]]){
   const entrants=ranking(clubs.filter(c=>season===1?(c.tier===1&&c.id%32>=(cup-1)*3&&c.id%32<cup*3):c.qual===cup));
   if(entrants.length!==24)throw Error("cup entrants");
   credit(entrants,pool*.42,entrants.map(()=>1),"participation");
   credit(entrants,pool*.18,entrants.map((_,i)=>Math.max(1,18-Math.floor(i*.65))),"results");
   credit(entrants,pool*.4,[900,500,300,300,200,200,200,200,100,100,100,100,...Array(12).fill(0)],"results");
  }
  if(sum(awards.map(a=>a.participation/2))!==16920000/divisor||sum(awards.map(a=>a.participation/2+a.results))!==43080000/divisor||sum(awards.map(a=>a.participation+a.results))!==worldPool)throw Error("reward pool");
  const recycle=opt.recycle?Math.min(reserve,worldPool):0;reserve-=recycle;issued+=worldPool-recycle;m.recycled=recycle;m.issued=worldPool-recycle;
  // Funding temporarily held outside club accounts until simulated certification.
  let funding=worldPool;
  const payReward=(c,amount)=>{funding-=amount;c.cash+=amount};
  const settle=(c)=>{
   for(const o of c.arrears){
    const payment=Math.min(c.cash,o.due-o.paid);
    if(!payment)continue;
    const before=o.paid;o.paid+=payment;c.cash-=payment;
    // Cumulative floor for one earned period/mandate obligation, not market-value rounding.
    const commission=splitPayment(before,payment,o.agent>=0,opt.rate).agent;
    if(o.agent>=0){agents[o.agent]+=commission;m.agentPayments[o.agent]+=commission}
    reserve+=payment-commission;m.commission+=commission;m.reserveWage+=payment-commission;m.wagePaid+=payment;
    if(o.paid<o.due)m.partialPayments++;
   }
   c.arrears=c.arrears.filter(o=>o.paid<o.due);
  };
  const cell=(p)=>observations[cellKey(p.age,p.skill)]??=( {active:0,employed:0,paidShare:0,actualWage:0,contexts:{}} );
  const observe=season>12;
  if(observe)for(const p of free)cell(p).active++;
  let unpaidAt28=0,arrearsAt28=0,staffDebt=0,subEleven=0,missingGroups=0;
  for(const c of clubs){
   const award=awards[c.id];
   payReward(c,Math.floor(award.participation/2));
   // No second participation credit before day 28 payroll.
   // Staff/other costs are hypothetical virtual payments to reserve, not actual EUR costs.
   const staff=opt.staff*(c.tier===1?2:1);m.staffDue+=staff;
   c.staffDebt+=Math.floor(staff/2);
   const early=Math.min(c.cash,c.staffDebt);c.staffDebt-=early;c.cash-=early;reserve+=early;m.staffPaid+=early;
   const obligations=c.squad.map(p=>({agent:p.agent,due:Math.floor(p.wage/2),full:p.wage,paid:0,player:p}));
   m.wageDue+=sum(obligations.map(o=>o.full));c.arrears.push(...obligations);settle(c);
   if(c.arrears.length)unpaidAt28++;arrearsAt28+=sum(c.arrears.map(o=>o.due-o.paid));
   payReward(c,award.participation-Math.floor(award.participation/2)+award.results);
   // The same annual obligation accumulates both installments, even if first was fully paid.
   for(const o of obligations){o.due=o.full;if(!c.arrears.includes(o)&&o.due>o.paid)c.arrears.push(o)}
   settle(c);
   c.staffDebt+=staff-Math.floor(staff/2);
   const later=Math.min(c.cash,c.staffDebt);c.staffDebt-=later;c.cash-=later;reserve+=later;m.staffPaid+=later;staffDebt+=c.staffDebt;
   if(observe)for(const o of obligations){const p=o.player,row=cell(p);row.active++;row.employed++;row.paidShare+=o.paid/o.full;row.actualWage+=o.full;const ctx=c.tier+':'+Math.max(25000/divisor,Math.round(c.forecast/(50000/divisor))*(50000/divisor));row.contexts[ctx]=(row.contexts[ctx]??0)+1}
   // Keep only earned obligation data, never retain mutable player references in arrears.
   for(const o of obligations)delete o.player;
   if(c.squad.length<11)subEleven++;
   if(Object.keys(targets).some(g=>!c.squad.some(p=>p.group===g)))missingGroups++;
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
  const tierStats=Object.fromEntries([1,2].map(t=>{const rows=clubs.filter(c=>c.tier===t);return [t,{net:api.quantiles(rows.map(c=>c.cash-startCash[c.id])),balance:api.quantiles(rows.map(c=>c.cash)),rewards:api.quantiles(rows.map(c=>awards[c.id].participation+awards[c.id].results)),negative:rows.filter(c=>c.cash<startCash[c.id]).length}]}));
  for(const c of promoted)c.tier=1;for(const c of relegated)c.tier=2;
  const clubCash=sum(clubs.map(c=>c.cash)),agentCash=sum(agents),arrears=sum(clubs.flatMap(c=>c.arrears.map(o=>o.due-o.paid)));
  if(clubCash+agentCash+reserve!==opening+issued-retiredCurrency)throw Error("supply conservation");
  const sorted=clubs.map(c=>c.cash).sort((a,b)=>b-a);
  const employed=sum(clubs.map(c=>c.squad.length));
  series.push({...m,tierStats,unpaidAt28,arrearsAt28,staffDebt,subEleven,missingGroups,agentPayments:undefined,agentIncome:api.quantiles(m.agentPayments),clubCash,agentCash,reserve,arrears,employed,free:free.length,catalog:catalog.length,coverage:sum(clubs.flatMap(c=>c.squad.map(p=>Number(p.agent>=0))))/Math.max(1,employed),squad:api.quantiles(clubs.map(c=>c.squad.length)),clubBalance:api.quantiles(sorted),top10Share:sum(sorted.slice(0,26))/Math.max(1,clubCash),wages:api.quantiles(clubs.flatMap(c=>c.squad.map(p=>p.wage))),cumulativeIssued:issued,cumulativeRetired:retiredCurrency,realMoney:{receipts:null,costs:null}});
 }
 return {options:opt,opening,series,observations};
}
function summarizeRun(run){
 const last=run.series.at(-1),tail=run.series.slice(-10),mean=k=>tail.reduce((s,t)=>s+t[k],0)/tail.length,max=k=>Math.max(...run.series.map(x=>x[k]));
 return {name:run.options.name,seed:run.options.seed,closing:{clubCash:last.clubCash,agentCash:last.agentCash,reserve:last.reserve,issued:last.cumulativeIssued,retired:last.cumulativeRetired,arrears:last.arrears,staffDebt:last.staffDebt,employed:last.employed,free:last.free,catalog:last.catalog,top10Share:last.top10Share,medianSquad:last.squad.median,subEleven:last.subEleven,missingGroups:last.missingGroups},last10:{wages:mean("wagePaid"),commission:mean("commission"),unpaidClubs:mean("unpaidClubs"),recycled:mean("recycled"),purchases:mean("purchases"),subEleven:mean("subEleven"),staffDue:mean("staffDue"),staffPaid:mean("staffPaid"),acceptance:tail.reduce((s,x)=>s+x.accepted,0)/tail.reduce((s,x)=>s+x.offers,0)},peak:{unpaidAt28:max("unpaidAt28"),arrearsAt28:max("arrearsAt28"),unpaidClubs:max("unpaidClubs"),arrears:max("arrears"),staffDebt:max("staffDebt"),partialPayments:max("partialPayments")}};
}
function summarize(run){const tail=run.series.slice(-10),last=tail.at(-1),mean=fn=>tail.reduce((a,b)=>a+fn(b),0)/tail.length;return {name:run.options.name,seed:run.options.seed,wages:mean(x=>x.wagePaid),agent:mean(x=>x.commission),recycle:mean(x=>x.recycled),staff:mean(x=>x.staffPaid),d1net:mean(x=>x.tierStats[1].net.median),d2net:mean(x=>x.tierStats[2].net.median),d1negative:mean(x=>x.tierStats[1].negative),d2negative:mean(x=>x.tierStats[2].negative),club:last.clubCash,agentWallets:last.agentCash,reserve:last.reserve,issued:last.cumulativeIssued,peak28:Math.max(...run.series.map(x=>x.unpaidAt28)),peak56:Math.max(...run.series.map(x=>x.unpaidClubs)),arrears:Math.max(...run.series.map(x=>x.arrears)),free:last.free,catalog:last.catalog,employed:last.employed};}

function grid(runs){const cells={};for(const run of runs)for(const [k,row] of Object.entries(run.observations)){const c=cells[k]??={active:0,employed:0,paidShare:0,contexts:{}};for(const x of ["active","employed","paidShare"])c[x]+=row[x];for(const [ctx,n] of Object.entries(row.contexts))c.contexts[ctx]=(c.contexts[ctx]??0)+n;}return [16,20,25,30,33].map(a=>[0,50,60,70,80].map(s=>{const c=cells[a+":"+s];return c?[c.active,c.employed,c.paidShare,Object.entries(c.contexts).sort().map(([key,n])=>[...key.split(":").map(Number),n])]:[0,0,0,[]]}))}

function forecastValues(profiles,api,forecast,rate){return profiles.map(p=>{let skill=p.skill,wage=0,survival=1,value=0;for(let t=0;t<=39-p.age;t++){const renewal=t%2===0;const f=forecast(p.age+t,skill,p.bonus,renewal);if(renewal)wage=f.wage;value+=rate*wage*survival*f.employment*f.paid;skill=Math.min(99,skill+api.growth[p.age+t-16]);survival*=1-(api.retirement[p.age+t+1]??0)}return {raw:value,display:api.roundValue(value)}})}
const cases=[{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0.5,"rate":1,"name":"scale-50","divisor":50,"staff":300},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0.5,"rate":1,"name":"scale-25","divisor":25,"staff":600},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0.5,"rate":1,"name":"scale-20","divisor":20,"staff":750},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0,"rate":1,"name":"mid-coverage-0","divisor":25,"staff":600},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0.25,"rate":1,"name":"mid-coverage-0.25","divisor":25,"staff":600},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0.75,"rate":1,"name":"mid-coverage-0.75","divisor":25,"staff":600},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":1,"rate":1,"name":"mid-coverage-1","divisor":25,"staff":600},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":1,"coverage":0.5,"rate":0.05,"name":"mid-5pct-control","divisor":25,"staff":600},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.08,"acceptance":0.8,"recycle":true,"burn":0,"wageShock":2.5,"coverage":0.5,"rate":1,"name":"mid-stress","divisor":25,"staff":3200},{"openingCash":0,"squad":25,"curve":"candidate","purchase":0.015,"acceptance":0.5,"recycle":true,"burn":0,"wageShock":1,"coverage":0.5,"rate":1,"name":"mid-lower-activation","divisor":25,"staff":600}];
const profiles=[1,2,3].flatMap(n=>generateTrial({count:1000,seed:'769-cohort-'+n}).candidates.map(p=>entryProfile(p,api)));
const annual=Array.from({length:32},(_,i)=>generateTrial({count:768,seed:'769-annual-'+(i+1)}).candidates.map(p=>entryProfile(p,api)));
const runs=cases.flatMap(o=>[769,1770,2771].map(seed=>simulate(profiles,annual,api,{...o,seed})));
console.log(JSON.stringify({accounting:accountingChecks(),summaries:runs.map(summarize),runs},null,2));
