// Individual synthetic financial stress; not production simulation or authority to issue currency.
export function simulateIndividuals(reference,rewards,salary,round,c,opt,seed){
 let state=seed>>>0;const rng=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296},sum=a=>a.reduce((s,n)=>s+n,0),pick=a=>a[Math.floor(rng()*a.length)],shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a},assert=(ok,msg)=>{if(!ok)throw Error(msg)};
 const clubs=reference.rows.map(x=>({id:x.clubKey,nation:x.clubKey.split("-")[0],tier:x.initialTier,cup:x.initialCup,cash:x.genesisArc,forecast:x.initialTier?rewards.competitionRewards("IT-"+x.initialTier).pool/16+(x.initialCup?rewards.competitionRewards("int-"+x.initialCup).pool/24:0):0,roster:[],debt:[]}));
 const active=clubs.filter(x=>x.tier),nations=[...new Set(active.map(x=>x.nation))],wallet=Array(c.agents).fill(c.initialWalletArc),pool=rewards.rewardTotals().pool;
 const drawWeighted=(a,w)=>{let u=rng();for(let i=0;i<a.length-1;i++){u-=w[i];if(u<0)return a[i]}return a.at(-1)};
 const ages=[],weights=[];for(let entry=16;entry<=19;entry++){let surv=1;for(let age=entry;age<=(c.initialAgeMax??39);age++){ages.push({entry,age});weights.push(surv);surv*=1-(salary.retirement[age+1]??0);}}const wsum=sum(weights),ageWeights=weights.map(v=>v/wsum);
 const skillWeight=p=>salary.salaryMultiplier**((p.skill-60)/10)*(1+p.bonus);
 let id=0;const create=(role,stationary=false)=>{const a=stationary?drawWeighted(ages,ageWeights):{entry:16+Math.floor(rng()*4)};const age=a.age??a.entry;const base=drawWeighted(c.entrySkills,c.entryWeights);return {id:++id,age,role,skill:Math.min(99,base+sum(salary.growth.slice(a.entry-16,age-16))),bonus:.05,agent:-1,wage:0,term:0}};
 const initialRoleTargets=c.roleTargets;for(const club of active){for(let g=0;g<4;g++)for(let i=0;i<initialRoleTargets[g];i++){const p=create(g,true);p.agent=rng()<opt.humanShare?Math.floor(rng()*c.agents):-1;club.roster.push(p);}const weights=club.roster.map(skillWeight),den=sum(weights);for(let i=0;i<club.roster.length;i++){const p=club.roster[i];p.wage=Math.max(salary.divisionFloors[club.tier],Math.round(club.forecast*weights[i]/den));p.term=1+Math.floor(rng()*3);}}
 // Initial mandate balance is a sensitivity, not an entitlement or actual assignment.
 const launch=opt.launchOption,track=Boolean(launch),ledger=track?new Map():null,primary=opt.primaryPolicy;const primarySold=new Set(),tenureMode=Boolean(opt.tenureMode),tenures=[],currentTenure=new Map(),agentFlows=Array.from({length:c.agents},()=>({salary:0,arcSpend:0,eurCents:0,resale:0}));
 const startTenure=(p,buyer,kind,currency,cost,season)=>{if(!tenureMode)return;const t={id:tenures.length,player:p.id,owner:buyer,kind,currency,cost,season,paid:0,resale:0,end:null,endReason:null};assert(!currentTenure.has(p.id),'one active tenure');tenures.push(t);currentTenure.set(p.id,t);if(currency==='ARC')agentFlows[buyer].arcSpend+=cost;else agentFlows[buyer].eurCents+=cost;};
 const endTenure=(p,reason,season,resale=0)=>{if(!tenureMode)return;const t=currentTenure.get(p.id);assert(t&&t.owner===p.agent,'tenure owner');t.end=season;t.endReason=reason;t.resale=resale;agentFlows[t.owner].resale+=resale;currentTenure.delete(p.id);};if(primary)assert(opt.humanShare===0&&c.initialWalletArc===0,'paid launch starts AI, zero wallets');
 let openingWagesBefore=0,openingWagesAfter=0,openingClubsAdjusted=0,openingMandateIncomeSpread=null;
 if(track){
  // Project fixed commitments at every half-season using current participation and future D2 floor.
  for(const club of active){
   const original=club.roster.map(p=>p.wage);openingWagesBefore+=sum(original);
   const feasible=factor=>{let cash=club.cash;for(let y=0;y<3;y++){
    const guaranteed=y===0?rewards.competitionRewards("IT-"+club.tier).participationReference+(club.cup?rewards.competitionRewards("int-"+club.cup).participationReference:0):rewards.competitionRewards("IT-2").participationReference;
    for(let half=0;half<2;half++){cash+=guaranteed/2;for(let i=0;i<club.roster.length;i++){const p=club.roster[i];if(p.term<=y)continue;const w=Math.max(salary.divisionFloors[club.tier],Math.floor(original[i]*factor));cash-=half===0?Math.floor(w/2):w-Math.floor(w/2);}if(cash<0)return false;}
   }return true};
   assert(feasible(0),"opening minimum infeasible");let lo=0,hi=1;
   if(feasible(1))lo=1;else{openingClubsAdjusted++;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(feasible(mid))lo=mid;else hi=mid;}}
   for(let i=0;i<club.roster.length;i++)club.roster[i].wage=Math.max(salary.divisionFloors[club.tier],Math.floor(original[i]*lo));
   openingWagesAfter+=sum(club.roster.map(p=>p.wage));assert(feasible(lo),"opening guard");
  }
  if(launch!=="guarded-random"){
   const assigned=Array(c.agents).fill(0),players=active.flatMap(x=>x.roster).filter(p=>p.agent>=0).sort((a,b)=>b.wage-a.wage||a.id-b.id);
   for(const p of players){let ix=0;for(let i=1;i<assigned.length;i++)if(assigned[i]<assigned[ix])ix=i;p.agent=ix;assigned[ix]+=p.wage;}
  }
  const incomes=Array(c.agents).fill(0);for(const p of active.flatMap(x=>x.roster))if(p.agent>=0)incomes[p.agent]+=p.wage;
  openingMandateIncomeSpread={min:Math.min(...incomes),max:Math.max(...incomes),mean:sum(incomes)/incomes.length};
 }
 const initialAgeHistogram=Object.fromEntries(Array.from({length:24},(_,i)=>[16+i,active.reduce((n,club)=>n+club.roster.filter(p=>p.age===16+i).length,0)]));let reserve=c.initialReserveArc,diagnosticInjection=0,firstShortfall=null,catalog=[],free=[],series=[];const opening=reserve+sum(clubs.map(x=>x.cash))+sum(wallet),target=active.length*c.squad;
 const count=()=>sum(active.map(x=>x.roster.length))+free.length;
 const quote=p=>{let survival=1,raw=0,skill=p.skill;for(let age=p.age;age<=39;age++){raw+=survival*c.salaryK*salary.salaryMultiplier**((skill-60)/10)*(1+p.bonus);skill=Math.min(99,skill+salary.growth[age-16]);survival*=1-(salary.retirement[age+1]??0);}const v=round(raw*c.marketValueMultiplier*(opt.exposureFactor??1));return {arc:Math.ceil(v*c.arcBps/10000),eur:Math.ceil(v*c.eurBps/10000),value:v,...(tenureMode?{raw}: {})}};
 // Assumed reservation threshold, heterogeneous but fixed per buyer; not fitted demand.
 const willing=(buyer,raw,price)=>!opt.gate||raw>=price*(c.minRecovery+(c.maxRecovery-c.minRecovery)*((buyer*73% c.agents)/Math.max(1,c.agents-1)));
 const chooseCurrency=(buyer,raw,arc,eur,canArc,canEur)=>({canArc:canArc&&willing(buyer,raw,arc),canEur:canEur&&willing(buyer,raw,eur)});
 const allocate=(total,rows,weights)=>{const den=sum(weights);if(!total)return rows.map(()=>0);assert(den>0,"allocation");const parts=weights.map((w,i)=>({i,a:Math.floor(total*w/den),r:(total*w)%den}));const left=total-sum(parts.map(x=>x.a));for(const x of [...parts].sort((a,b)=>b.r-a.r||a.i-b.i).slice(0,left))x.a++;return parts.map(x=>x.a)};
// Conservative signing guard: half-season prefix cash forecast. No actual holds or new funding.
 const canCommit=(club,wage,term,transfer=0)=>{
  let available=club.cash-transfer-sum(club.debt.map(batch=>sum(batch.map(o=>o.due))));
  for(let y=0;y<Math.max(term,...club.roster.map(p=>p.term));y++){
   const guaranteed=y===0?rewards.competitionRewards("IT-"+club.tier).participationReference+(club.cup?rewards.competitionRewards("int-"+club.cup).participationReference:0):rewards.competitionRewards("IT-2").participationReference;
   for(let half=0;half<2;half++){const installment=v=>half===0?Math.floor(v/2):v-Math.floor(v/2);available+=guaranteed/2-sum(club.roster.filter(p=>p.term>y).map(p=>installment(p.wage)))-(term>y?installment(wage):0);if(available<0)return false;}
  }return true;
 };
 for(let season=1;season<=c.seasons;season++){
  const m={season,retired:0,activated:0,arcBuys:0,eurBuys:0,arcReceipts:0,eurCents:0,feeArc:0,tradeVolume:0,transfers:0,transferVolume:0,wageDue:0,wagePaid:0,humanPaid:0,aiPaid:0,unpaid28:0,unpaid56:0,arrears56:0,diagnosticInjection:0,unaffordable:0,...(primary?{primaryArcBuys:0,primaryEurBuys:0,primaryArcReceipts:0,primaryEurCents:0,primaryUnsold:0,primaryRetiredUnsold:0}:{}),...(track?{benchmarkWageArc:0,paidNewCareerArc:0,walletP10:0,walletMedian:0,walletP90:0,walletGini:0}:{}),...(c.initialAgeMax?{rejectedSignings:0,rejectedTransfers:0}: {})};
  const short=Math.max(0,pool-reserve);if(short&&!firstShortfall)firstShortfall={season,shortfallArc:short};reserve+=short;diagnosticInjection+=short;m.diagnosticInjection=short;reserve-=pool;let escrow=pool;
  const sharedEurBudget=primary?Array(c.agents).fill(opt.eurBudgetCents):null;
  if(primary){
   const listed=[...active.flatMap(x=>x.roster),...free].filter(p=>p.id<=target&&p.agent<0).map(p=>{const q=quote(p),v=q.value;return {p,arc:Math.ceil(v*primary.arcBps/10000),eur:Math.ceil(v*primary.eurBps/10000),raw:q.raw};});
   for(let attempt=0;attempt<c.primaryAttempts&&listed.length;attempt++)for(const buyer of shuffle(wallet.map((_,i)=>i))){if(!listed.length||rng()>opt.shopping)continue;
    const candidates=Array.from({length:Math.min(8,listed.length)},()=>Math.floor(rng()*listed.length)).filter(i=>(primary.allowArc&&wallet[buyer]>=listed[i].arc&&willing(buyer,listed[i].raw,listed[i].arc))||(sharedEurBudget[buyer]>=listed[i].eur&&willing(buyer,listed[i].raw,listed[i].eur)));
    if(!candidates.length)continue;const i=pick(candidates),v=listed[i],canArc=primary.allowArc&&wallet[buyer]>=v.arc&&willing(buyer,v.raw,v.arc),canEur=sharedEurBudget[buyer]>=v.eur&&willing(buyer,v.raw,v.eur),useEur=canEur&&(!canArc||rng()<opt.eurPreference);
    assert(v.p.agent<0&&!primarySold.has(v.p.id),'duplicate primary mandate');if(useEur){sharedEurBudget[buyer]-=v.eur;m.primaryEurCents+=v.eur;m.primaryEurBuys++;}else{assert(canArc,'funded primary');wallet[buyer]-=v.arc;reserve+=v.arc;m.primaryArcReceipts+=v.arc;m.primaryArcBuys++;}
    startTenure(v.p,buyer,'existing',useEur?'EUR':'ARC',useEur?v.eur:v.arc,season);v.p.agent=buyer;primarySold.add(v.p.id);listed[i]=listed.at(-1);listed.pop();
   }
  }
  // Preserve fixed contracts. Only expiring contracts and new hires negotiate using last season's reward forecast.
  for(const club of active){
   const old=club.roster;club.roster=[];for(const p of old){if(p.term>0)club.roster.push(p);else free.push(p);}
  }
  const freeByRole=c.roles.map((_,g)=>free.filter(p=>p.role===g));free=[];
  for(const club of shuffle(active)){
   const fixed=sum(club.roster.map(p=>p.wage)),budget=Math.max(0,Math.round(club.forecast)-fixed);
   const selected=[];
   for(let g=0;g<4;g++){const need=Math.max(0,c.roleTargets[g]-club.roster.filter(p=>p.role===g).length);for(let j=0;j<need&&freeByRole[g].length;j++){const a=freeByRole[g],i=Math.floor(rng()*a.length),p=a[i];a[i]=a.at(-1);a.pop();selected.push(p);}}
   const weights=selected.map(skillWeight),den=sum(weights);let left=budget;
   for(let i=0;i<selected.length;i++){const p=selected[i],offer=Math.min(left,Math.round(budget*weights[i]/den));if(offer<salary.divisionFloors[club.tier]){free.push(p);continue;}const term=1+Math.floor(rng()*3);if(opt.contractPolicy==='guarded'&&!canCommit(club,offer,term)){free.push(p);m.rejectedSignings++;continue;}p.wage=offer;p.term=term;left-=offer;club.roster.push(p);}
  }
  free.push(...freeByRole.flat());
  // Sporting transfer proxy: existing contract retained, bilateral funded principal only.
  for(const from of active){if(rng()>.08||from.roster.length<20)continue;const to=pick(active),p=pick(from.roster);if(to===from||to.roster.length>=c.squad||to.roster.filter(x=>x.role===p.role).length>=c.roleTargets[p.role])continue;const price=p.wage; if(to.cash<price||sum(to.roster.map(x=>x.wage))+p.wage>to.forecast)continue;if(opt.contractPolicy==='guarded'&&!canCommit(to,p.wage,p.term,price)){m.rejectedTransfers++;continue;}to.cash-=price;from.cash+=price;from.roster.splice(from.roster.indexOf(p),1);to.roster.push(p);m.transfers++;m.transferVolume+=price;}
  const awards=new Map(active.map(x=>[x.id,{part:0,result:0}])),nextCup=new Map(),promote=[],relegate=[];
  const ranked=list=>list.map(club=>({club,score:sum(club.roster.map(p=>p.skill))/c.squad+20*rng()})).sort((a,b)=>b.score-a.score||a.club.id.localeCompare(b.club.id)).map(x=>x.club);
  for(const n of nations){const top=ranked(active.filter(x=>x.nation===n&&x.tier===1)),low=ranked(active.filter(x=>x.nation===n&&x.tier===2));assert(top.length===16&&low.length===16,"capacity");for(const [tier,list] of [[1,top],[2,low]]){const rule=rewards.competitionRewards("IT-"+tier),pts=allocate(rule.points,list,list.map((_,i)=>70-3*i));list.forEach((x,i)=>{const a=awards.get(x.id);a.part+=rule.participationReference;a.result+=rule.awards[i]+pts[i];});}top.slice(0,6).forEach((x,i)=>nextCup.set(x.id,i<3?1:2));promote.push(...low.slice(0,2),pick(low.slice(2,6)));relegate.push(...top.slice(-2),pick(top.slice(12,14)));}
  for(const cup of [1,2]){const list=ranked(active.filter(x=>x.cup===cup)),rule=rewards.competitionRewards("int-"+cup),pts=allocate(rule.points,list,list.map((_,i)=>Math.max(1,18-Math.floor(i*.65)))),outcomes=[0,1,2,2,3,3,3,3,4,4,4,4,...Array(12).fill(5)];assert(list.length===24,"cup capacity");list.forEach((x,i)=>{const a=awards.get(x.id);a.part+=rule.participationReference;a.result+=rule.awards[outcomes[i]]+pts[i];});}
  if(track)m.benchmarkWageArc=sum([...active.flatMap(x=>x.roster),...free].map(p=>c.salaryK*skillWeight(p)));assert(sum([...awards.values()].map(a=>a.part+a.result))===pool,"reward conservation");
  for(const day of [28,56]){
   for(const club of active){const a=awards.get(club.id),v=a.part/2+(day===56?a.result:0);club.cash+=v;escrow-=v;}
   for(const club of active){const obligations=[];for(const p of club.roster){const v=day===28?Math.floor(p.wage/2):p.wage-Math.floor(p.wage/2);if(v){obligations.push({agent:p.agent,due:v,...(track?{playerId:p.id}:{}),...(tenureMode?{tenureId:currentTenure.get(p.id)?.id??null}:{})});m.wageDue+=v;}}if(obligations.length)club.debt.push(obligations);
    while(club.debt.length&&club.cash>0){const batch=club.debt[0],due=sum(batch.map(o=>o.due)),pay=Math.min(club.cash,due),parts=allocate(pay,batch,batch.map(o=>o.due));for(let i=0;i<batch.length;i++){const o=batch[i],v=parts[i];o.due-=v;club.cash-=v;m.wagePaid+=v;if(track&&ledger.has(o.playerId)){ledger.get(o.playerId).paid+=v;m.paidNewCareerArc+=v;}if(o.agent<0){reserve+=v;m.aiPaid+=v}else{wallet[o.agent]+=v;m.humanPaid+=v;if(tenureMode){assert(o.tenureId!==null&&tenures[o.tenureId].owner===o.agent,'earned tenure attribution');tenures[o.tenureId].paid+=v;agentFlows[o.agent].salary+=v;}}}if(pay===due)club.debt.shift();else break;}
   }m["unpaid"+day]=active.filter(x=>x.debt.length).length;assert(reserve+escrow+sum(clubs.map(x=>x.cash))+sum(wallet)===opening+diagnosticInjection,"milestone stock");
  }
  assert(escrow===0,"escrow");m.arrears56=sum(active.flatMap(x=>x.debt.map(batch=>sum(batch.map(o=>o.due)))));
  assert((series.at(-1)?.arrears56??0)+m.wageDue-m.wagePaid===m.arrears56,"arrears");
  // Secondary mandate fee only if a funded transaction actually happens; no sporting transfer fee.
  for(const p of [...active.flatMap(x=>x.roster),...free]){if(p.agent<0||rng()>opt.secondary)continue;const buyer=Math.floor(rng()*c.agents);if(buyer===p.agent)continue;const q=quote(p),price=Math.max(1,Math.round(q.value*(.6+.4*rng())));if(wallet[buyer]<price||!willing(buyer,q.raw,price))continue;const fee=Math.floor(price*c.feeBps/10000);wallet[buyer]-=price;wallet[p.agent]+=price-fee;reserve+=fee;endTenure(p,'resale',season,price-fee);startTenure(p,buyer,'secondary','ARC',price,season);p.agent=buyer;m.feeArc+=fee;m.tradeVolume+=price;}
  const agePlayers=list=>list.filter(p=>{p.age++;if(rng()<(salary.retirement[p.age]??0)){m.retired++;if(tenureMode&&p.agent>=0)endTenure(p,'retirement',season);if(primary&&p.id<=target&&p.agent<0)m.primaryRetiredUnsold++;if(track&&ledger.has(p.id))ledger.get(p.id).retired=season;return false;}p.skill=Math.min(99,p.skill+salary.growth[p.age-17]);p.term=Math.max(0,p.term-1);return true});
  for(const club of active){club.roster=agePlayers(club.roster);const a=awards.get(club.id);club.forecast=(club.forecast+a.part+a.result)/2;club.cup=nextCup.get(club.id)??0;}
  free=agePlayers(free);for(const club of promote)club.tier=1;for(const club of relegate)club.tier=2;
  // Generate lightweight offers; only purchases activate, no free replacement. No hard currency quota.
  for(let i=0;i<active.length*3;i++){const p=create(drawWeighted([0,1,2,3],c.roleTargets.map(x=>x/c.squad)));catalog.push({p,...quote(p)});}
  const eurBudget=sharedEurBudget??Array(c.agents).fill(opt.eurBudgetCents),deficit=Math.max(0,target-count());
  for(let pass=0;pass<3&&m.activated<deficit;pass++)for(const buyer of shuffle(wallet.map((_,i)=>i))){if(m.activated>=deficit||!catalog.length||rng()>opt.shopping)continue;
   const candidates=Array.from({length:Math.min(8,catalog.length)},()=>Math.floor(rng()*catalog.length)).filter(i=>(wallet[buyer]>=catalog[i].arc&&willing(buyer,catalog[i].raw,catalog[i].arc))||(eurBudget[buyer]>=catalog[i].eur&&willing(buyer,catalog[i].raw,catalog[i].eur)));
   if(!candidates.length){m.unaffordable++;continue;}const i=pick(candidates),v=catalog[i],canArc=wallet[buyer]>=v.arc&&willing(buyer,v.raw,v.arc),canEur=eurBudget[buyer]>=v.eur&&willing(buyer,v.raw,v.eur),useEur=canEur&&(!canArc||rng()<opt.eurPreference);
   if(useEur){eurBudget[buyer]-=v.eur;m.eurCents+=v.eur;m.eurBuys++;}else{wallet[buyer]-=v.arc;reserve+=v.arc;m.arcReceipts+=v.arc;m.arcBuys++;}
   if(track)ledger.set(v.p.id,{season,retired:null,paid:0,value:v.value,arcEquivalent:useEur?v.eur:v.arc,currency:useEur?'EUR':'ARC'});startTenure(v.p,buyer,'youth',useEur?'EUR':'ARC',useEur?v.eur:v.arc,season);v.p.agent=buyer;free.push(v.p);catalog[i]=catalog.at(-1);catalog.pop();m.activated++;
  }
  if(primary){m.primaryUnsold=[...active.flatMap(x=>x.roster),...free].filter(p=>p.id<=target&&p.agent<0).length;assert((series.at(-1)?.primaryUnsold??target)-m.primaryArcBuys-m.primaryEurBuys-m.primaryRetiredUnsold===m.primaryUnsold,'initial mandate stock');assert(eurBudget.every(v=>v>=0),'shared EUR budget');}m.population=count();m.employed=sum(active.map(x=>x.roster.length));m.walletArc=sum(wallet);m.clubArc=sum(clubs.map(x=>x.cash));m.reserveArc=reserve;m.catalog=catalog.length;m.humanCoverage=sum(active.flatMap(x=>x.roster.map(p=>Number(p.agent>=0))))/Math.max(1,m.employed);m.walletsAbleToBuyMean=wallet.filter(w=>w>=8099).length;
  if(track){const w=[...wallet].sort((a,b)=>a-b);m.walletP10=w[Math.floor((w.length-1)*.1)];m.walletMedian=w[Math.floor((w.length-1)*.5)];m.walletP90=w[Math.floor((w.length-1)*.9)];m.walletGini=m.walletArc?sum(w.map((v,i)=>(2*(i+1)-w.length-1)*v))/(w.length*m.walletArc):0;}assert(m.population===(series.at(-1)?.population??target)-m.retired+m.activated,"population conservation");assert(m.activated===m.arcBuys+m.eurBuys&&m.wagePaid===m.humanPaid+m.aiPaid,"flow split");assert(m.walletArc+m.clubArc+reserve===opening+diagnosticInjection&&wallet.every(x=>x>=0)&&clubs.every(x=>x.cash>=0),"stock");
  if(tenureMode){assert(agentFlows.every((a,i)=>a.salary+a.resale-a.arcSpend===wallet[i]),'per-agent wallet reconciliation');assert(currentTenure.size===[...active.flatMap(x=>x.roster),...free].filter(p=>p.agent>=0).length,'tenure stock');}series.push(m);
 }
 const last=series.at(-1),tail=series.slice(-10),avg=k=>sum(tail.map(x=>x[k]))/tail.length;
 const retired=track?[...ledger.values()].filter(p=>p.retired!==null&&p.season>=21&&p.season<=70):[];const careerSummary=track?{count:retired.length,totalPaidArc:sum(retired.map(p=>p.paid)),totalQuotedValueArc:sum(retired.map(p=>p.value)),totalPriceEquivalent:sum(retired.map(p=>p.arcEquivalent)),meanPaidArc:retired.length?sum(retired.map(p=>p.paid))/retired.length:0,meanQuotedValueArc:retired.length?sum(retired.map(p=>p.value))/retired.length:0,paidOverQuoted:retired.length?sum(retired.map(p=>p.paid))/sum(retired.map(p=>p.value)):0,observedExposureRatio:sum(tail.map(s=>s.wagePaid))/sum(tail.map(s=>s.benchmarkWageArc))}:null;return {scenario:opt.name,seed,...(tenureMode?{tenures,agentFlows}:{}),...(track?{launchOption:launch,exposureFactor:opt.exposureFactor??1,openingWagesBefore,openingWagesAfter,openingClubsAdjusted,openingMandateIncomeSpread,careerSummary,finalWalletQuantiles:{p10:last.walletP10,median:last.walletMedian,p90:last.walletP90,gini:last.walletGini},firstSeasonArrears:last?series[0].arrears56:null,firstSeasonUnpaid28:series[0].unpaid28,firstSeasonUnpaid56:series[0].unpaid56}:{}),...(c.initialAgeMax?{initialAgeHistogram,contractPolicy:opt.contractPolicy}:{}),completedDiagnosticSeasons:series.length,firstShortfall,diagnosticInjectionArc:diagnosticInjection,finalPopulation:last.population,finalEmployed:last.employed,finalWalletArc:last.walletArc,finalClubArc:last.clubArc,finalReserveArc:last.reserveArc,finalArrearsArc:last.arrears56,peakUnpaid56:Math.max(...series.map(x=>x.unpaid56)),peakArrearsArc:Math.max(...series.map(x=>x.arrears56)),avgRetirementsLast10:avg("retired"),avgActivationsLast10:avg("activated"),avgArcBuysLast10:avg("arcBuys"),avgEurBuysLast10:avg("eurBuys"),avgEurGrossCentsLast10:avg("eurCents"),avgWagePaidLast10:avg("wagePaid"),avgArcReceiptsLast10:avg("arcReceipts"),avgFeeArcLast10:avg("feeArc"),avgInjectionLast10:avg("diagnosticInjection"),avgHumanCoverageLast10:avg("humanCoverage"),series};
}
