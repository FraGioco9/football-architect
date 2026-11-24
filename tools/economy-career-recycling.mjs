// #770 offline stationary cohort accounting; not live wages, price or settlement.
export function buildCareer(clubs,selection,base,renew,c,rewards,salary,round,cal){
 const sum=xs=>xs.reduce((a,b)=>a+b,0),rnd=Math.round,rs=c.rewardScale;
 const scaled={...rewards,competitionRewards:id=>{const v=rewards.competitionRewards(id);return {...v,pool:rnd(v.pool*rs),points:rnd(v.points*rs),awards:v.awards.map(a=>rnd(a*rs)),participationReference:rnd(v.participationReference*rs)}},rewardTotals:()=>({pool:rnd(rewards.rewardTotals().pool*rs)})};
 const pool=scaled.rewardTotals().pool,d1=8*scaled.competitionRewards("IT-1").pool+scaled.competitionRewards("int-1").pool+scaled.competitionRewards("int-2").pool,d2=8*scaled.competitionRewards("IT-2").pool;
 const payroll=rnd(d1*c.payrollShares[1]+d2*c.payrollShares[2]),clubCash=pool-payroll,arcOrders=c.annualRetirements-c.eurOrders;
 const license=cal(clubs,selection,{...base,horizon:c.forecastHorizon,staffArc:{1:0,2:0},aiShare:0,lowRankWeights:renew.lowRankWeights,replacementAnnualArc:c.clubRecruitmentArc,payrollShares:c.payrollShares},scaled,salary);
 const cohorts=[];
 for(const age of c.entryAges)for(let i=0;i<c.skills.length;i++){
  let surv=1,skill=c.skills[i],life=0,career=0;
  for(let a=age;a<=39;a++){career+=surv;life+=surv*salary.salaryMultiplier**((skill-60)/10)*(1+c.versatility);skill=Math.min(99,skill+salary.growth[a-16]);surv*=1-(salary.retirement[a+1]??0);}
  cohorts.push({age,skill:c.skills[i],weight:c.weights[i]/c.entryAges.length,career,life});
 }
 const mean=(xs,k)=>sum(xs.map(x=>x[k]*x.weight)),career=mean(cohorts,"career"),factor=payroll/(c.annualRetirements*mean(cohorts,"life"));
 const tickets=cohorts.map(x=>({...x,rawValue:x.life*factor,displayedValue:round(x.life*factor)}));
 const quote=(v,bps)=>Math.ceil(v*bps/10000);
 const meanDisplayed=mean(tickets,"displayedValue"),meanRaw=mean(tickets,"rawValue");
 const meanEur=sum(tickets.map(x=>x.weight*quote(x.displayedValue,c.eurPriceBps)));
 const meanNetEur=sum(tickets.map(x=>{const q=quote(x.displayedValue,c.eurPriceBps);return x.weight*(q-Math.ceil(q*c.paymentVariableBps/10000)-c.paymentFixedCents)}));
 const pricing=c.arcPriceBps.map(bps=>{const meanArc=sum(tickets.map(x=>x.weight*quote(x.displayedValue,bps))),demand=rnd(arcOrders*meanArc),funded=Math.min(payroll,demand);return {bps,meanArc,desiredArcReceipts:demand,fundedArcCeiling:funded,agentResidual:payroll-funded,unfundedArcDemand:demand-funded,reserveGapWithFullClubSpend:payroll-funded};});
 const targetMean=payroll/arcOrders,impliedBps=10000*targetMean/meanDisplayed;
 const flows=c.clubSpendFractions.map(f=>{
  const clubSpend=rnd(clubCash*f),recovered=payroll+clubSpend,gap=pool-recovered;let reserve=pool,club=license.totals.genesisArc,wallet=0,issued=0;const opening=reserve+club;
  for(let t=0;t<c.seasons;t++){const short=Math.max(0,pool-reserve);issued+=short;reserve+=short-pool+recovered;club+=clubCash-clubSpend;if(reserve+club+wallet!==opening+issued||Math.min(reserve,club,wallet)<0)throw Error("stock reconciliation");}
  return {clubSpendFraction:f,clubSpend,recovered,gap,totalIllustrativeIssuance:issued,closingReserve:reserve,closingClubCash:club};
 });
 // Initial per-club budget benchmark based on mean awards and fixed salary,
 // then adverse certified floor (no points and last domestic placement; cup participation only).
 // No assumption that all such worst ranks can occur together.
 const stress=license.rows.filter(x=>x.initialTier).map(x=>{
  const tier=x.initialTier,dom=scaled.competitionRewards("IT-"+tier),cup=x.initialCup?scaled.competitionRewards("int-"+x.initialCup):null;
  const expected=dom.pool/dom.capacity+(cup?cup.pool/cup.capacity:0);
  const wage=rnd(expected*c.payrollShares[tier]),first=rnd(wage/2),day28=(dom.participationReference+(cup?.participationReference??0))/2;
  const floor=dom.participationReference+dom.awards.at(-1)+(cup?.participationReference??0);
  const opening=x.genesisArc,at28=opening+day28-first,at56=opening+floor-wage;
  return {clubKey:x.clubKey,tier,cup:x.initialCup,openingArc:opening,annualPayrollArc:wage,day28ParticipationArc:day28,adverseRewardsArc:floor,day28BalanceArc:at28,adverseYearEndBeforeDiscretionaryArc:at56,annualAdverseOperatingGapArc:Math.max(0,wage-floor)};
 });
 if(Math.abs(meanRaw*c.annualRetirements-payroll)>1e-5||payroll+clubCash!==pool||flows.at(-1).gap!==0||flows.at(-1).totalIllustrativeIssuance!==0)throw Error("calibration identity");
 const groups=[...new Set(stress.map(x=>`${x.tier}/${x.cup}`))].map(key=>{const a=stress.filter(x=>`${x.tier}/${x.cup}`===key);return {tier:a[0].tier,cup:a[0].cup,count:a.length,day28Negative:a.filter(x=>x.day28BalanceArc<0).length,adverseYearEndNegative:a.filter(x=>x.adverseYearEndBeforeDiscretionaryArc<0).length,annualAdverseOperatingGapArc:a[0].annualAdverseOperatingGapArc,annualPayrollArc:a[0].annualPayrollArc,adverseRewardsArc:a[0].adverseRewardsArc};});
 return {version:c.version,status:"research-only",pool,payroll,clubCash,operatingSurplusBeforeDiscretionaryArc:clubCash-128*(c.clubRecruitmentArc[1]+c.clubRecruitmentArc[2]),retirements:c.annualRetirements,arcOrders,eurOrders:c.eurOrders,expectedCareer:career,stationaryActivePopulation:career*c.annualRetirements,normalizedWageAtSuitability60BeforeVersatility:factor,meanRaw,meanDisplayed,targetMeanArcTicket:targetMean,impliedArcPriceBps:impliedBps,meanEurCents:meanEur,grossEurCents:rnd(meanEur*c.eurOrders),illustrativeContributionCents:rnd(meanNetEur*c.eurOrders)-c.annualRetirements*c.activationCostCents,pricing,flows,license:{top:license.topReference,low:license.lowReference,groups:license.groups,totals:license.totals,rows:license.rows},clubLiquidityStress:groups,cohortTickets:tickets};
}
