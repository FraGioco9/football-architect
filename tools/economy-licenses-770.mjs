// #770 — isolated license/own-origin sensitivity; not a transaction implementation.
import {generateTrial,calculatePositionSuitability} from './players-generation-trial.mjs';
import * as api from '../backend/src/player-market-value.mjs';
if(api.MARKET_VALUE_CONFIG.version!=='remaining-commission-draft-v3-769')throw Error('rebaseline #770');
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}

function sum(a){return a.reduce((s,x)=>s+x,0)}

function median(a){const x=[...a].sort((a,b)=>a-b);return x.length?x[Math.floor((x.length-1)/2)]:null}

function allocate(pool,weights){
 const total=sum(weights),rows=weights.map((w,i)=>({i,n:Math.floor(pool*w/total),r:pool*w%total}));
 const extra=pool-sum(rows.map(x=>x.n));
 [...rows].sort((a,b)=>b.r-a.r||a.i-b.i).slice(0,extra).forEach(x=>x.n++);
 return rows.map(x=>x.n);
}

function profile(p,api,suitability){
 const input={age:p.initial_age,career_status:"active",primary_position:p.primary_position,secondary_positions:p.secondary_positions,attributes:p.attributes};
 const scores=[...new Set([input.primary_position,...input.secondary_positions])].map(x=>suitability(input.attributes,x)).sort((a,b)=>b-a),skill=scores[0];
 const bonus=sum(scores.slice(1,6).map((x,i)=>api.MARKET_VALUE_CONFIG.versatility[i]*Math.max(0,1-(skill-x)/10)));
 return {age:input.age,skill,bonus,raw:api.rawPlayerMarketValueArc(input)};
}

function salaryReference(p,club,c){
 return Math.max(c.divisionFloors[club.tier],c.salaryScale*c.salaryMultiplier**((p.skill-60)/10)*(1+p.bonus)*Math.sqrt(club.forecast/c.rewardBenchmark));
}

function licenseFee(price,rate){const fee=Math.floor(price*rate/100);return {fee,seller:price-fee}}

function simulate(annual,c,opt){
 const rng=random(opt.seed),pick=a=>a[Math.floor(rng()*a.length)];
 const clubs=Array.from({length:320},(_,id)=>({id,nation:Math.floor(id/40),tier:id%40<16?1:id%40<32?2:0,holder:null,listed:false,cash:0,forecast:id%40<16?250000:125000,contracts:[],arrears:0,staffDebt:0,qual:0}));
 const activeClubs=clubs.filter(x=>x.tier),users=[];let reserve=0,issued=0,catalog=[],next=0;
 function join(){const u={id:next++,cash:opt.wallet,active:true,licenses:0};users.push(u);issued+=opt.wallet;return u}
 for(let i=0;i<256;i++)join();
 const series=[];
 for(let year=1;year<=32;year++){
  const m={year,primary:0,primaryArc:0,resales:0,resaleVolume:0,fees:0,ownOffers:0,ownPurchases:0,ownPrice:0,ownRejectCash:0,ownRejectClub:0,ordinaryPurchases:0,ordinaryPrice:0,ownWages:0,ownCommission:0,arrears:0,defaultClubs:0,staffDebt:0,independentReview:0,listed:0,unaffordableLicense:0};
  for(const u of users.filter(x=>x.active))if(rng()<.05){u.active=false;join();for(const cl of clubs)if(cl.holder===u&&rng()<.8)cl.listed=true}
  const live=users.filter(x=>x.active);
  for(const cl of clubs)if(cl.holder?.active&&rng()<.04)cl.listed=true;
  // Voluntary listings only; inactive accounts retain title and wallet unless sale executes.
  // Purchase intent is exogenous; users with no license have stronger interest, not a one-license limit.
  for(const u of live){
   if(rng()>(u.licenses?.035:.45))continue;
   const available=clubs.filter(cl=>!cl.holder||cl.listed&&cl.holder!==u);if(!available.length)continue;
   const sampled=Array.from({length:6},()=>pick(available));
   const offers=sampled.map(cl=>({cl,price:Math.max(1,Math.round(opt.prices[cl.tier]*(cl.holder?(.7+.6*rng()):1)))})).filter(x=>x.price<=u.cash);
   if(!offers.length){m.unaffordableLicense++;continue}
   const {cl,price}=offers.sort((a,b)=>((b.cl.tier?1:0)-(a.cl.tier?1:0))||a.price-b.price)[0];
   u.cash-=price;
   if(cl.holder){const v=licenseFee(price,opt.fee);cl.holder.cash+=v.seller;cl.holder.licenses--;reserve+=v.fee;m.resales++;m.resaleVolume+=price;m.fees+=v.fee}else{reserve+=price;m.primary++;m.primaryArc+=price}
   cl.holder=u;cl.listed=false;u.licenses++;
  }
  // 3 fresh entries per active club; origin is explicit. Unsold age treatment is deliberately unresolved.
  annual[year-1].forEach((p,i)=>catalog.push({...p,origin:activeClubs[Math.floor(i/3)].id,price:Math.max(1,Math.ceil(.25*p.raw))}));
  const awards=new Map(activeClubs.map(cl=>[cl.id,{participation:0,results:0}]));
  function credit(list,pool,weights,key){allocate(pool,weights).forEach((n,i)=>awards.get(list[i].id)[key]+=n)}
  const nextQual=new Map(),up=[],down=[];
  for(let nation=0;nation<8;nation++){
   const ranks=[];
   for(const tier of [1,2]){
    const list=activeClubs.filter(cl=>cl.nation===nation&&cl.tier===tier).map(cl=>({cl,k:rng()})).sort((a,b)=>b.k-a.k).map(x=>x.cl),pool=tier===1?4000000:2000000;
    credit(list,pool*.6,list.map(()=>1),"participation");credit(list,pool*.15,list.map((_,i)=>70-3*i),"results");credit(list,pool*.25,list.map((_,i)=>16-i),"results");ranks.push(list);
   }
   ranks[0].slice(0,6).forEach((cl,i)=>nextQual.set(cl.id,i<3?1:2));up.push(...ranks[1].slice(0,2));down.push(...ranks[0].slice(-2));
   if(rng()<.5){up.push(pick(ranks[1].slice(2,6)));down.push(pick(ranks[0].slice(12,14)))}
   if(year===1)ranks[0].slice(0,6).forEach((cl,i)=>cl.qual=i<3?1:2);
  }
  for(const [cup,pool] of [[1,8000000],[2,4000000]]){
   const list=activeClubs.filter(cl=>cl.qual===cup).map(cl=>({cl,k:rng()})).sort((a,b)=>b.k-a.k).map(x=>x.cl);
   if(list.length!==24)throw Error("cup count");
   credit(list,pool*.4,list.map(()=>1),"participation");credit(list,pool*.2,list.map((_,i)=>Math.max(1,18-Math.floor(i*.65))),"results");credit(list,pool*.4,[27,17,10,10,6,6,6,6,3,3,3,3,...Array(12).fill(0)],"results");
  }
  if(sum([...awards.values()].map(x=>x.participation+x.results))!==60000000)throw Error("reward pool");
  const recycled=Math.min(60000000,reserve);reserve-=recycled;issued+=60000000-recycled;
  // Research only: base football payroll and staff cost proxies, plus separately modelled new own-origin contracts.
  const baseDue=cl=>Math.round(opt.basePayroll*(cl.tier===1?2:1));
  const staffDue=cl=>opt.staff*(cl.tier===1?2:1);
  for(const cl of activeClubs){
   cl.cash+=awards.get(cl.id).participation;
   for(const p of cl.contracts)p.wage=Math.max(p.wage,c.divisionFloors[cl.tier]);
  }
  // Own-origin transactions require personal price and separate club review; no personal-to-club funding.
  // Gate is illustrative independent liquidity underwriting, not a new sporting cap or approved policy.
  for(const cl of activeClubs){
   const u=cl.holder;if(!u?.active||rng()>.55)continue;
   const available=catalog.filter(p=>p.origin===cl.id);if(!available.length)continue;
   const p=pick(available);m.ownOffers++;
   if(u.cash<p.price){m.ownRejectCash++;continue}
   const wage=Math.round(salaryReference(p,cl,c)*(opt.selfWage??1));
   const existing=sum(cl.contracts.map(p=>p.wage));
   const due=baseDue(cl)+staffDue(cl)+existing+cl.arrears+cl.staffDebt;
   // Reviewer checks actual agreed wage and 3-year term against projected resources; no future award is credited early.
   const guarantee=cl.tier===1?150000:75000;
   const future=cl.cash+2*guarantee;
   const need=due+2*(baseDue(cl)+staffDue(cl)+existing)+3*wage;
   m.independentReview++;
   if(opt.review&&future<need){m.ownRejectClub++;continue}
   u.cash-=p.price;reserve+=p.price;m.ownPrice+=p.price;m.ownPurchases++;
   cl.contracts.push({...p,wage,term:3,agent:u,paid:0});catalog.splice(catalog.indexOf(p),1);
  }
  // Ordinary purchases remain separate; they activate a mandate, not a club contract.
  // Their post-activation career cash flows are excluded in this license/own-redemption model,
  // not assumed zero in actual economics. First #770 slice models those separately.
  for(const u of live){
   if(rng()>.6||!catalog.length)continue;
   const options=Array.from({length:6},()=>pick(catalog)).filter(p=>p.price<=u.cash&&clubs[p.origin].holder!==u);
   if(!options.length)continue;const p=pick(options);u.cash-=p.price;reserve+=p.price;m.ordinaryPurchases++;m.ordinaryPrice+=p.price;catalog.splice(catalog.indexOf(p),1);
  }
  for(const cl of activeClubs){
   cl.cash+=awards.get(cl.id).results;
   // End-season settlement proxy; explicit unpaid amounts, no automatic bailout.
   // Pay prior ordinary payroll debt, current ordinary payroll and staff first, then own obligations FIFO.
   const ordinary=cl.arrears+baseDue(cl);const paid=Math.min(cl.cash,ordinary);cl.cash-=paid;reserve+=paid;cl.arrears=ordinary-paid;
   const sd=cl.staffDebt+staffDue(cl),sp=Math.min(cl.cash,sd);cl.cash-=sp;reserve+=sp;cl.staffDebt=sd-sp;
   for(const p of cl.contracts){
    if(p.term>0){p.due=(p.due??0)+p.wage;p.term--}
    const payment=Math.min(cl.cash,p.due-p.paid);cl.cash-=payment;const commission=Math.floor((p.paid+payment)/20)-Math.floor(p.paid/20);p.paid+=payment;
    p.agent.cash+=commission;reserve+=payment-commission;m.ownWages+=payment;m.ownCommission+=commission;
   }
   cl.contracts=cl.contracts.filter(p=>p.term>0||p.due>p.paid);
   // Debt is not monetary stock; ended contracts retain earned agent attribution until fully paid.
   const overdue=sum(cl.contracts.map(p=>(p.due??0)-p.paid));
   m.arrears+=cl.arrears+overdue;m.staffDebt+=cl.staffDebt;if(cl.arrears+overdue>0)m.defaultClubs++;
   const a=awards.get(cl.id);cl.forecast=.5*cl.forecast+.5*(a.participation+a.results);cl.qual=nextQual.get(cl.id)??0;
  }
  up.forEach(cl=>cl.tier=1);down.forEach(cl=>cl.tier=2);
  const clubCash=sum(clubs.map(cl=>cl.cash)),wallets=sum(users.map(u=>u.cash));
  if(clubCash+wallets+reserve!==issued||sum(users.map(u=>u.licenses))!==clubs.filter(cl=>cl.holder).length)throw Error("stock/ownership");
  const licensed=clubs.filter(cl=>cl.holder),top=[...users].sort((a,b)=>b.licenses-a.licenses).slice(0,26);
  series.push({...m,recycled,issued,clubCash,wallets,reserve,catalog:catalog.length,licensed:licensed.length,activeLicensed:licensed.filter(cl=>cl.tier).length,inactiveLicensed:licensed.filter(cl=>!cl.tier).length,listed:licensed.filter(cl=>cl.listed).length,holders:users.filter(u=>u.licenses).length,liveHolders:live.filter(u=>u.licenses).length,top10Share:sum(top.map(u=>u.licenses))/Math.max(1,licensed.length),medianWallet:median(live.map(u=>u.cash)),inactiveWallets:sum(users.filter(u=>!u.active).map(u=>u.cash))});
 }
 return {options:opt,series};
}

function summarize(run){
 const last=run.series.at(-1),tail=run.series.slice(-10),mean=k=>sum(tail.map(x=>x[k]))/tail.length,tot=k=>sum(run.series.map(x=>x[k]));
 return {name:run.options.name,seed:run.options.seed,primaryTotal:tot("primary"),primaryArc:tot("primaryArc"),resales:mean("resales"),fees:mean("fees"),licensed:last.licensed,activeLicensed:last.activeLicensed,inactiveLicensed:last.inactiveLicensed,liveHolders:last.liveHolders,concentration:last.top10Share,unaffordable:mean("unaffordableLicense"),ownOffers:tot("ownOffers"),ownPurchases:tot("ownPurchases"),ownRejectCash:tot("ownRejectCash"),ownRejectClub:tot("ownRejectClub"),ownWages:tot("ownWages"),ownCommission:tot("ownCommission"),peakDefault:Math.max(...run.series.map(x=>x.defaultClubs)),peakArrears:Math.max(...run.series.map(x=>x.arrears)),clubCash:last.clubCash,wallets:last.wallets,reserve:last.reserve,catalog:last.catalog};
}

function euros(){
 // All input rates/volumes are illustrative, not actual tax/processor terms or conversion.
 const results=[];
 for(const ticket of [3,5,10])for(const orders of [1000,5000,10000]){
  const licenseOrders=100,licenseTicket=25,refundRate=.05,tax=.22,processorRate=.029,fixed=.30;
  const gross=orders*ticket+licenseOrders*licenseTicket,refunded=gross*refundRate,retained=gross-refunded;
  const net=retained/(1+tax),fees=gross*processorRate+(orders+licenseOrders)*fixed;
  const contribution=net-fees;
  results.push({ticket,orders,licenseOrders,licenseTicket,gross,refunded,illustrativeTax:retained-net,fees,contribution,netAfter5000:contribution-5000,netAfter15000:contribution-15000,netAfter30000:contribution-30000});
 }return results;
}

function checks(){
 for(const amount of [0,1,19,20,101,1000])for(const rate of [5,10]){const x=licenseFee(amount,rate);if(x.fee+x.seller!==amount)throw Error("fee split")}
 // Refund reference: reverse exact original transfer, no new fee or pricing. Insufficient funds => manual/escrow review.
 const original=licenseFee(101,5);let buyer=899,seller=original.seller,reserve=original.fee;
 buyer+=101;seller-=original.seller;reserve-=original.fee;
 if(buyer!==1000||seller!==0||reserve!==0)throw Error("refund");
 return "PASS";
}
const annual=Array.from({length:32},(_,i)=>generateTrial({count:768,seed:'770-fresh-'+(i+1)}).candidates.map(p=>profile(p,api,calculatePositionSuitability)));
const cases=[{"name":"low","wallet":5000,"prices":{"0":250,"1":1000,"2":600},"fee":5,"review":true,"basePayroll":26000,"staff":15000,"selfWage":1},{"name":"mid","wallet":5000,"prices":{"0":500,"1":2500,"2":1500},"fee":5,"review":true,"basePayroll":26000,"staff":15000,"selfWage":1},{"name":"high","wallet":5000,"prices":{"0":1000,"1":5000,"2":3000},"fee":5,"review":true,"basePayroll":26000,"staff":15000,"selfWage":1},{"name":"mid-wallet1500","wallet":1500,"prices":{"0":500,"1":2500,"2":1500},"fee":5,"review":true,"basePayroll":26000,"staff":15000,"selfWage":1},{"name":"mid-fee10","wallet":5000,"prices":{"0":500,"1":2500,"2":1500},"fee":10,"review":true,"basePayroll":26000,"staff":15000,"selfWage":1},{"name":"low-wallet1500","wallet":1500,"prices":{"0":250,"1":1000,"2":600},"fee":5,"review":true,"basePayroll":26000,"staff":15000,"selfWage":1},{"name":"low-cost-stress-review","wallet":5000,"prices":{"0":250,"1":1000,"2":600},"fee":5,"review":true,"basePayroll":65000,"staff":50000,"selfWage":5},{"name":"low-cost-stress-no-review","wallet":5000,"prices":{"0":250,"1":1000,"2":600},"fee":5,"review":false,"basePayroll":65000,"staff":50000,"selfWage":5}];
const runs=cases.flatMap(opt=>[770,1770,2770].map(seed=>simulate(annual,api.MARKET_VALUE_CONFIG,{...opt,seed})));
console.log(JSON.stringify({checks:checks(),summaries:runs.map(summarize),runs,eur:euros()},null,2));
