// #770/#775 isolated analytical research only; never a live quote or treasury posting.
export function makeCalibration(clubs,selection,c,rewards,salary){
 const sum=x=>x.reduce((a,b)=>a+b,0), near=(a,b)=>Math.abs(a-b)<1e-6, round=n=>Math.round(n*100)/100;
 const fail=msg=>{throw Error(msg)};
 const positive=(n)=>Number.isFinite(n)&&n>0;
 if(![c.horizon,c.longHorizon,c.minimumCents,c.roundingCents,c.squadSize,c.genesisStepArc].every(x=>Number.isSafeInteger(x)&&x>0)||c.longHorizon<c.horizon||!positive(c.multiple)||!positive(c.arcPerEur)||!positive(c.costFactor)||!Number.isFinite(c.suitability)||c.suitability<1||c.suitability>99||![c.aiShare,c.versatility].every(x=>Number.isFinite(x)&&x>=0&&x<=1)||!positive(c.aiWageMultiplier)||![0,1,2].every(t=>Number.isSafeInteger(c.genesisMinimumArc[t])&&c.genesisMinimumArc[t]>0)||![1,2].every(t=>Number.isSafeInteger(c.staffArc[t])&&c.staffArc[t]>=0)||!c.genesisCoefficientCandidates.every(x=>Number.isFinite(x)&&x>=0))fail("invalid config");
 const ids=clubs.map(x=>`${x.countryId}-${x.clubId}`).sort(), set=new Set(ids);
 if(ids.length!==320||set.size!==320||Object.keys(c.clubOverrides).some(id=>!set.has(id)))fail("invalid catalogue or override");
 const tiers=new Map(), cups=new Map();
 for(const b of selection.bindings){const international=b.competitionId.startsWith("int-"), map=international?cups:tiers, tier=Number(b.competitionId.at(-1));if(![1,2].includes(tier)||b.clubIds.length!==(international?24:16))fail("invalid selection");for(const id of b.clubIds){if(!set.has(id)||map.has(id)||(!international&&!id.startsWith(b.competitionId.slice(0,-1))))fail("invalid membership");map.set(id,tier);}}
 if(tiers.size!==256||cups.size!==48||[...cups.keys()].some(id=>tiers.get(id)!==1))fail("incomplete selection");
 const rankIds=Array.from({length:16},(_,i)=>String(i+1));
 const neutral=rankIds.map(()=>1);
 const norm=w=>{if(!Array.isArray(w)||w.length!==16||!w.every(positive)||!positive(sum(w)))fail("invalid rank weights");return w.map(v=>v/sum(w));};
 const rankAwards={};
 for(const t of [1,2]){const r=rewards.competitionRewards("IT-"+t),pts=rewards.largestRemainder(r.points,rankIds.map((id,i)=>({id,weight:70-3*i})),rankIds).allocations;rankAwards[t]=r.awards.map((a,i)=>r.participationReference+pts[i].amount+a);if(sum(rankAwards[t])!==r.pool)fail("domestic pool mismatch");}
 const cupMean=[0,...[1,2].map(t=>{const r=rewards.competitionRewards("int-"+t);return r.pool/r.capacity;})];
 const wage=(tier,amount)=>c.squadSize*Math.max(salary.divisionFloors[tier],salary.salaryScale*salary.salaryMultiplier**((c.suitability-60)/10)*(1+c.versatility)*Math.sqrt(amount/salary.rewardBenchmark))*(1+c.aiShare*(c.aiWageMultiplier-1));
 const cost=(tier,amount)=>c.costFactor*(wage(tier,amount)+c.staffArc[tier]);
 const quote=(surplus)=>Math.max(c.minimumCents,Math.round(c.multiple*Math.max(0,surplus)*100/c.arcPerEur/c.roundingCents)*c.roundingCents);
 // Joint state: D1 without cup, D1 Sovereign, D1 Federation, D2, inactive.
 function forecast(tier,cup,weights1,weights2,horizon){
  const p1=norm(weights1),p2=norm(weights2),sov=sum(p1.slice(0,3)),fed=sum(p1.slice(3,6)),down=sum(p1.slice(14))+sum(p1.slice(12,14))/2,up=sum(p2.slice(0,2))+sum(p2.slice(2,6))/4;
  let p=[0,0,0,0,0];p[tier===0?4:tier===2?3:cup]=1;
  let accum={domestic:0,international:0,cost:0,d1:0,d2:0,sov:0,fed:0};
  for(let y=0;y<horizon;y++){
   const d1=sum(p.slice(0,3)),d2=p[3];
   accum.d1+=d1;accum.d2+=d2;accum.sov+=p[1];accum.fed+=p[2];
   for(let s=0;s<4;s++){const t=s===3?2:1,prob=t===1?p1:p2,international=s===3?0:cupMean[s];for(let i=0;i<16;i++){const amount=rankAwards[t][i],weight=p[s]*prob[i];accum.domestic+=weight*amount;accum.international+=weight*international;accum.cost+=weight*cost(t,amount+international);}}
   p=[d1*(1-down-sov-fed)+d2*up,d1*sov,d1*fed,d1*down+d2*(1-up),p[4]];
   if(!near(sum(p),1)||p.some(v=>v< -1e-9))fail("transition mass");
  }
  const avg=Object.fromEntries(Object.entries(accum).map(([k,v])=>[k,v/horizon]));
  return {...avg,surplus:avg.domestic+avg.international-avg.cost};
 }
 const rows=ids.map(id=>{
  const tier=tiers.get(id)??0,cup=cups.get(id)??0,o=c.clubOverrides[id]??{},w1=o.d1RankWeights??neutral,w2=o.d2RankWeights??neutral;
  const f=forecast(tier,cup,w1,w2,c.horizon),long=forecast(tier,cup,w1,w2,c.longHorizon);
  const initialParticipation=tier===0?0:rewards.competitionRewards("IT-"+tier).participationReference+(cup?rewards.competitionRewards("int-"+cup).participationReference:0);
  const initialCost=tier===0?0:sum(norm(tier===1?w1:w2).map((p,i)=>p*cost(tier,rankAwards[tier][i]+cupMean[cup])));
  // Candidate buffer: half standardized annual costs, independent of initial award; positive minimum even if inactive.
  const genesis=o.genesisArc??Math.max(c.genesisMinimumArc[tier],Math.ceil(initialCost/2/c.genesisStepArc)*c.genesisStepArc);
  if(!Number.isSafeInteger(genesis)||genesis<=0)fail("invalid genesis override");
  const base=quote(f.surplus);
  return {clubKey:id,initialTier:tier,initialCup:cup,expectedDomesticArc:round(f.domestic),expectedInternationalArc:round(f.international),expectedCostArc:round(f.cost),expectedSurplusArc:round(f.surplus),d1Exposure:round(f.d1),d2Exposure:round(f.d2),sovereignExposure:round(f.sov),federationExposure:round(f.fed),baseLicenseCents:base,genesisArc:genesis,initialDay28ReferenceArc:initialParticipation/2,initialDay28CostReferenceArc:round(initialCost/2),initialDay28GapArc:round(Math.max(0,initialCost/2-initialParticipation/2-genesis)),longHorizonBaseCents:quote(long.surplus),costStressBaseCents:[.75,1.25].map(factor=>quote(f.domestic+f.international-f.cost*factor)),primaryPriceSensitivityCents:c.genesisCoefficientCandidates.map(k=>base+Math.round(genesis*k*100/c.arcPerEur))};
 });
 const total=k=>sum(rows.map(x=>x[k]));
 // Neutral population must conserve 18 pools; individual hypothetical overrides are not a league model.
 if(!Object.values(c.clubOverrides).some(o=>o.d1RankWeights||o.d2RankWeights)&&Math.abs(total("expectedDomesticArc")+total("expectedInternationalArc")-rewards.rewardTotals().pool)>4)fail("world award forecast mismatch");
 const groups=[0,1,2].flatMap(t=>t===1?[0,1,2].map(cup=>[t,cup]):[[t,0]]).map(([tier,cup])=>{const list=rows.filter(x=>x.initialTier===tier&&x.initialCup===cup);return {tier,cup,count:list.length,meanBaseCents:round(sum(list.map(x=>x.baseLicenseCents))/list.length),meanGenesisArc:round(sum(list.map(x=>x.genesisArc))/list.length),meanSurplusArc:round(sum(list.map(x=>x.expectedSurplusArc))/list.length)};});
 const top=forecast(1,1,c.topRankWeights,c.topRankWeights,c.horizon);
 return {version:c.version,status:"research-only-unapproved-quotes",horizon:c.horizon,longHorizon:c.longHorizon,groups,totals:{expectedRewardsArc:round(total("expectedDomesticArc")+total("expectedInternationalArc")),genesisArc:total("genesisArc"),initialReserveReferenceArc:2400000,combinedGenesisReferenceArc:total("genesisArc")+2400000,baseLicenseCents:total("baseLicenseCents"),firstDay28UncoveredClubs:rows.filter(x=>x.initialDay28GapArc>0).length},topReference:{expectedRewardsArc:round(top.domestic+top.international),expectedCostArc:round(top.cost),expectedSurplusArc:round(top.surplus),baseLicenseCents:quote(top.surplus),note:"Hypothetical persistent strength, not assigned to any canonical club."},rows};
}
