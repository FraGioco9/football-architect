// Full-payroll DRAFT research, not live pricing or settlement.
export function buildFullPayroll(clubs,selection,base,renew,c,rewards,salary,round,cal,build){
 const x=build(clubs,selection,base,renew,c,rewards,salary,round,cal),sum=xs=>xs.reduce((a,b)=>a+b,0),rnd=Math.round;
 if(x.payroll!==x.pool||x.clubCash!==0||c.marketValuePremiumBps!==11000)throw Error("invalid full-payroll target");
 const top=x.license.top.expectedRewardsArc,low=x.license.low.expectedRewardsArc;
 const exponent=Math.log(c.licenseTopEur/c.licenseLowEur)/Math.log(top/low);
 const licenseQuote=gross=>Math.max(c.licenseMinimumEur,rnd(c.licenseLowEur*(gross/low)**exponent/c.licenseRoundingEur)*c.licenseRoundingEur);
 const rows=x.license.rows.map(v=>({clubKey:v.clubKey,initialTier:v.initialTier,initialCup:v.initialCup,expectedDomesticArc:v.expectedDomesticArc,expectedInternationalArc:v.expectedInternationalArc,expectedRewardsArc:rnd((v.expectedDomesticArc+v.expectedInternationalArc)*100)/100,expectedPayrollArc:v.expectedCostArc,genesisArc:v.genesisArc,baseLicenseEur:licenseQuote(v.expectedDomesticArc+v.expectedInternationalArc)}));
 const groups=x.license.groups.map(g=>{const a=rows.filter(v=>v.initialTier===g.tier&&v.initialCup===g.cup);return {tier:g.tier,cup:g.cup,count:a.length,meanBaseEur:sum(a.map(v=>v.baseLicenseEur))/a.length,meanGenesisArc:sum(a.map(v=>v.genesisArc))/a.length};});
 const tickets=x.cohortTickets.map(t=>{const newRaw=t.rawValue*c.marketValuePremiumBps/10000,newDisplayed=round(newRaw),eurCents=Math.ceil(newDisplayed*c.eurPriceBps/10000);return {...t,newRaw,newDisplayed,arcQuote:newDisplayed,eurCents};});
 const mean=k=>sum(tickets.map(t=>t.weight*t[k])),meanArc=mean("arcQuote"),meanEur=mean("eurCents"),meanNet=sum(tickets.map(t=>t.weight*(t.eurCents-Math.ceil(t.eurCents*c.paymentVariableBps/10000)-c.paymentFixedCents)));
 const scenarios=c.referenceEurOrders.map(eurOrders=>{
  const arcOrders=c.annualRetirements-eurOrders,desired=rnd(arcOrders*meanArc),funded=Math.min(x.payroll,desired),gap=x.pool-funded,unfunded=desired-funded;
  const flow=c.reserveBufferSeasons.map(n=>{let reserve=x.pool*n,clubs=x.license.totals.genesisArc,wallet=0,completed=0;const opening=reserve+clubs;for(let s=0;s<c.seasons;s++){if(reserve<x.pool)break;reserve-=x.pool;clubs+=x.pool-x.payroll;wallet+=x.payroll-funded;reserve+=funded;completed++;if(reserve+clubs+wallet!==opening)throw Error("stock conservation");}return {initialReserveArc:x.pool*n,completedSeasons:completed,closingReserveArc:reserve,closingClubArc:clubs,closingWalletArc:wallet};});
  return {arcOrders,eurOrders,desiredArcReceipts:desired,fundedArcCeiling:funded,unfundedArcDemand:unfunded,agentResidualArc:gap,reserveGapArc:gap,recoveryPct:100*funded/x.pool,grossEurCents:rnd(eurOrders*meanEur),illustrativeContributionCents:rnd(eurOrders*meanNet)-c.annualRetirements*c.activationCostCents,feeTurnoverToCoverGapArc:Math.ceil(gap*10000/c.feeBps),flow};
 });
 const reference=scenarios.find(s=>s.eurOrders===c.eurOrders),balancedMeanArc=x.pool/(c.annualRetirements-c.eurOrders);
 const scaleSensitivity=[2.4,5.4,6.6].map(m=>({poolArc:m*1000000,payrollArc:m*1000000,rawCareerMeanArc:m*1000000/c.annualRetirements,newRawMeanArc:m*1000000/c.annualRetirements*1.1,rawRecoveryPct:100*1.1*(c.annualRetirements-c.eurOrders)/c.annualRetirements}));
 return {version:c.version,status:"research-only",pool:x.pool,payroll:x.payroll,clubCash:0,meanCareer:x.expectedCareer,normalizedWageAtSuitability60BeforeVersatility:x.normalizedWageAtSuitability60BeforeVersatility,oldRawMean:x.meanRaw,oldDisplayedMean:x.meanDisplayed,newRawMean:mean("newRaw"),newDisplayedMean:mean("newDisplayed"),meanArc,meanEur,balancedMeanArc,reference,scenarios,scaleSensitivity,license:{topRewardReferenceArc:top,lowRewardReferenceArc:low,exponent,topBaseEur:licenseQuote(top),lowBaseEur:licenseQuote(low),groups,rows,totalBaseEur:sum(rows.map(v=>v.baseLicenseEur)),genesisArc:x.license.totals.genesisArc},clubLiquidityStress:x.clubLiquidityStress,tickets};
}
