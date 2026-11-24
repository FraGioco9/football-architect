// Historical finance stress v1 adapted only for dual youth quotes. Not a player supply or solvency proof.
import {quoteYouth} from './academy-dual-pricing.mjs';
// #775/#770 offline stress model, no ledger, live payments or sporting state.
export function runDualStress(reference,rewards,salary,config,opt,seed){
 const sum=xs=>xs.reduce((a,b)=>a+b,0), assert=(ok,msg)=>{if(!ok)throw Error(msg)};
 let rs=seed>>>0;const rng=()=>{rs=(Math.imul(1664525,rs)+1013904223)>>>0;return rs/4294967296};
 const pick=xs=>xs[Math.floor(rng()*xs.length)], shuffle=xs=>{const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const clubs=reference.rows.map(r=>({id:r.clubKey,nation:r.clubKey.split("-")[0],tier:r.initialTier,cup:r.initialCup,base:r.baseLicenseCents,cash:Math.max(1,Math.round(r.genesisArc*opt.genesisFactor)),forecast:r.initialTier===0?0:r.expectedDomesticArc+r.expectedInternationalArc,roster:[],arrears:[],staffDebt:0,licensed:false}));
 const active=clubs.filter(c=>c.tier),nations=[...new Set(clubs.map(c=>c.nation))].sort(),wallets=Array(config.agents).fill(config.initialPersonalArc);
 let reserve=config.initialReserveArc,issued=0,capitalIssued=0,academy=[],waiting=[],nextId=0,licenseGross=0,capitalGross=0,youthGross=0,bought=0,retired=0;
 const opening=reserve+sum(clubs.map(c=>c.cash))+sum(wallets);
 const salaryFor=(c,skill,agent)=>Math.max(salary.divisionFloors[c.tier],Math.round(opt.costFactor*salary.salaryScale*salary.salaryMultiplier**((skill-60)/10)*1.05*Math.sqrt(c.forecast/salary.rewardBenchmark)*(agent<0?1.125:1)));
 const contract=(c,agent)=>{const skill=pick(config.initialWageSkills);return {id:nextId++,agent,skill,wage:salaryFor(c,skill,agent),term:1+Math.floor(rng()*3)}};
 for(const c of active)for(let i=0;i<config.slots;i++)c.roster.push(contract(c,rng()<opt.humanShare?Math.floor(rng()*wallets.length):-1));
 const pool=rewards.rewardTotals().pool,series=[];
 const balance=()=>reserve+sum(clubs.map(c=>c.cash))+sum(wallets);
 const check=(escrow=0)=>{assert(balance()+escrow===opening+issued+capitalIssued,"ARC conservation");assert([reserve,...wallets,...clubs.map(c=>c.cash),escrow].every(x=>Number.isSafeInteger(x)&&x>=0),"nonnegative integer balance");assert(academy.length+bought===series.length*config.academyCandidates||escrow>0,"academy stock")};
 const allocate=(amount,rows,weights)=>rewards.largestRemainder(amount,rows.map((c,i)=>({id:c.id,weight:weights[i]})),rows.map(c=>c.id)).allocations;
 function payroll(c,metrics){
  const periods=[...new Set(c.arrears.map(o=>o.period))].sort((a,b)=>a-b);
  for(const period of periods){
   const due=c.arrears.filter(o=>o.period===period),total=sum(due.map(o=>o.remaining)),amount=Math.min(c.cash,total);
   if(!amount)break;
   const alloc=allocate(amount,due.map(o=>({id:String(o.id)})),due.map(o=>o.remaining));
   for(let i=0;i<due.length;i++){const o=due[i],v=alloc[i].amount;assert(v<=o.remaining,"overpayment");o.remaining-=v;c.cash-=v;metrics.wagePaid+=v;if(o.agent<0){reserve+=v;metrics.aiPaid+=v}else{wallets[o.agent]+=v;metrics.humanPaid+=v}}
   if(amount<total)break;
  }
  c.arrears=c.arrears.filter(o=>o.remaining>0);
 }
 let stopped=null;
 for(let season=1;season<=config.seasons;season++){
  // Fail closed: reserve whole certified pool before starting an economic season. No partial award promise.
  const shortfall=Math.max(0,pool-reserve);
  if(shortfall>opt.annualCapArc){stopped={season,requiredIssuanceArc:shortfall,capArc:opt.annualCapArc,reserveArc:reserve};break;}
  const recycled=Math.min(reserve,pool);reserve-=recycled;issued+=shortfall;let escrow=pool;
  const m={season,recycled,issued:shortfall,wageDue:0,wagePaid:0,humanPaid:0,aiPaid:0,staffPaid:0,staffDue:0,academyArcBuys:0,academyEurBuys:0,academyArcSpent:0,academyEurCents:0,licenseSales:0,licenseEurCents:0,capitalEurCents:0,unpaid28:0,unpaid56:0,arrears28:0,arrears56:0};
  // External receipts are hypothetical cents, not ARC wallet deposits. Optional capital issues ARC once directly to club.
  for(const c of shuffle(clubs.filter(c=>!c.licensed)).slice(0,opt.licenseSalesPerSeason)){
   c.licensed=true;const capital=opt.capitalEurCents;c.cash+=capital;capitalIssued+=capital;capitalGross+=opt.capitalEurCents;licenseGross+=c.base;
   m.licenseSales++;m.licenseEurCents+=c.base;m.capitalEurCents+=opt.capitalEurCents;
  }
  for(let i=0;i<config.academyCandidates;i++){const u=rng();let cumulative=0,index=0;while(index<config.academyPriceWeights.length-1&&(cumulative+=config.academyPriceWeights[index])<u)index++;academy.push(config.academyPriceArc[index]);}
  const budgets=Array(wallets.length).fill(opt.eurBudgetCents);
  for(const owner of shuffle(wallets.map((_,i)=>i)))for(let j=0;j<opt.attempts&&academy.length;j++){
   const ix=Math.floor(rng()*academy.length),value=academy[ix];
   const {arc,eurCents}=quoteYouth(value,opt.arcPercent,opt.eurPercent);
   const canArc=wallets[owner]>=arc,canEur=budgets[owner]>=eurCents;
   if(!canArc&&!canEur)continue;
   if(canArc&&(!canEur||rng()>=opt.eurPreference)){wallets[owner]-=arc;reserve+=arc;m.academyArcBuys++;m.academyArcSpent+=arc;}
   else{budgets[owner]-=eurCents;youthGross+=eurCents;m.academyEurBuys++;m.academyEurCents+=eurCents;}
   academy[ix]=academy.at(-1);academy.pop();waiting.push(owner);bought++;
  }
  // Fixed 25-slot synthetic squads. Two retirement/replacement events per club/year; paid mandate queue supplies replacements.
  // Existing mandates are synthetic opening rights, not free purchases. Renewal retains current agent and fixed term.
  for(const c of active){
   const positions=shuffle(c.roster.map((_,i)=>i)).slice(0,config.annualReplacements);
   for(const i of positions){retired++;const owner=waiting.length?waiting.shift():-1;c.roster[i]=contract(c,owner);}
   for(const p of c.roster){if(p.term===0){p.wage=salaryFor(c,p.skill,p.agent);p.term=2;}p.wage=Math.max(p.wage,salary.divisionFloors[c.tier]);}
  }
  const awards=new Map(active.map(c=>[c.id,{part:0,results:0}]));
  const reward=(c,part,results)=>{const a=awards.get(c.id);a.part+=part;a.results+=results};
  const promote=[],relegate=[],nextCup=new Map();
  // Equal sporting strength baseline; seeded ranks are scenario outcomes, never official match data.
  for(const nation of nations){
   const top=shuffle(active.filter(c=>c.nation===nation&&c.tier===1)),low=shuffle(active.filter(c=>c.nation===nation&&c.tier===2));
   assert(top.length===16&&low.length===16,"domestic capacity");
   for(const [tier,list] of [[1,top],[2,low]]){
    const rule=rewards.competitionRewards(nation+"-"+tier),pts=allocate(rule.points,list,list.map((_,i)=>70-3*i));
    list.forEach((c,i)=>reward(c,rule.participationReference,rule.awards[i]+pts[i].amount));
   }
   top.slice(0,6).forEach((c,i)=>nextCup.set(c.id,i<3?1:2));
   relegate.push(...top.slice(-2),pick(top.slice(12,14)));promote.push(...low.slice(0,2),pick(low.slice(2,6)));
  }
  for(const cup of [1,2]){
   const list=shuffle(active.filter(c=>c.cup===cup)),rule=rewards.competitionRewards("int-"+cup);
   assert(list.length===24,"cup capacity");
   const pts=allocate(rule.points,list,list.map((_,i)=>Math.max(1,18-Math.floor(i*.65))));
   const outcomes=[0,1,2,2,3,3,3,3,4,4,4,4,...Array(12).fill(5)];
   list.forEach((c,i)=>reward(c,rule.participationReference,rule.awards[outcomes[i]]+pts[i].amount));
  }
  assert(sum([...awards.values()].map(a=>a.part+a.results))===pool,"exact rewards");
  for(const day of [28,56]){
   let paidRewards=0;
   // Global rewards before global payroll; no future reward treated as spendable cash.
   for(const c of active){const a=awards.get(c.id),amount=day===28?a.part/2:a.part/2+a.results;c.cash+=amount;escrow-=amount;paidRewards+=amount;}
   assert(paidRewards===(day===28?676800:1723200),"milestone exact");
   for(const c of active){
    for(const p of c.roster){const due=day===28?Math.floor(p.wage/2):p.wage-Math.floor(p.wage/2);if(due){c.arrears.push({id:p.id,agent:p.agent,period:season*2+(day===56?1:0),remaining:due});m.wageDue+=due;}}
    payroll(c,m);
    const staff=Math.round(config.staffArc[c.tier]*opt.costFactor/2);m.staffDue+=staff;c.staffDebt+=staff;
    // No discretionary staff spending with wage arrears. Staff is a separate hypothetical payable, not a signed contract.
    if(!c.arrears.length){const v=Math.min(c.cash,c.staffDebt);c.cash-=v;reserve+=v;c.staffDebt-=v;m.staffPaid+=v;}
   }
   m["unpaid"+day]=active.filter(c=>c.arrears.length).length;m["arrears"+day]=sum(active.flatMap(c=>c.arrears.map(o=>o.remaining)));
   assert(balance()+escrow===opening+issued+capitalIssued,"milestone conservation");
  }
  assert(escrow===0&&m.wagePaid===m.humanPaid+m.aiPaid,"escrow and payroll split");
  const previousArrears=series.at(-1)?.arrears56??0;assert(previousArrears+m.wageDue-m.wagePaid===m.arrears56,"earned obligation reconciliation");
  for(const c of active){const a=awards.get(c.id);c.forecast=(c.forecast+a.part+a.results)/2;c.cup=nextCup.get(c.id)??0;for(const p of c.roster)p.term--;}
  for(const c of promote)c.tier=1;for(const c of relegate)c.tier=2;
  series.push({...m,reserveArc:reserve,clubArc:sum(clubs.map(c=>c.cash)),walletArc:sum(wallets),staffDebtArc:sum(active.map(c=>c.staffDebt)),humanCoverage:Math.round(10000*sum(active.flatMap(c=>c.roster.map(p=>Number(p.agent>=0))))/(active.length*config.slots))/10000,academyStock:academy.length,waitingMandates:waiting.length});
  assert(waiting.length<=bought&&clubs.filter(c=>c.licensed).length<=320,"rights stock");check();
 }
 const last=series.at(-1),avg=k=>series.length?Math.round(sum(series.slice(-10).map(x=>x[k]))/Math.min(10,series.length)):0;
 assert(sum(series.map(s=>s.licenseSales))===clubs.filter(c=>c.licensed).length,"finite licenses");
 assert(sum(series.map(s=>s.capitalEurCents))===capitalIssued&&sum(series.map(s=>s.licenseEurCents))===licenseGross&&sum(series.map(s=>s.academyEurCents))===youthGross,"external receipts separate");
 return {scenario:opt.name,seed,completed:series.length,stopped,openingArc:opening,totalIssuedArc:issued,capitalIssuedArc:capitalIssued,licenseGrossCents:licenseGross,capitalGrossCents:capitalGross,youthGrossCents:youthGross,retiredSlots:retired,peakUnpaid28:Math.max(0,...series.map(x=>x.unpaid28)),peakUnpaid56:Math.max(0,...series.map(x=>x.unpaid56)),peakArrears56:Math.max(0,...series.map(x=>x.arrears56)),lastArrears56:last?.arrears56??0,averageIssuedLast10:avg("issued"),averageAcademyArcLast10:avg("academyArcBuys"),averageAcademyEurLast10:avg("academyEurBuys"),closingReserveArc:reserve,closingClubArc:sum(clubs.map(c=>c.cash)),closingWalletArc:sum(wallets),closingCoverage:last?.humanCoverage??0,closingStaffDebtArc:last?.staffDebtArc??0,series};
}
