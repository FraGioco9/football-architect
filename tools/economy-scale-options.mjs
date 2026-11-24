// Offline scale options; no live quote or settlement.
export function buildScaleOptions(clubs,selection,base,renew,c,rewards,salary,round,cal,build,calc){
 const cases=c.rewardScaleOptions.map(scale=>{
  const x=calc(clubs,selection,base,renew,{...c,rewardScale:scale},rewards,salary,round,cal,build),b=x.reference;
  const schedules=["IT-1","IT-2","int-1","int-2"].map(id=>{const rule=rewards.competitionRewards(id);return {id,poolArc:Math.round(rule.pool*scale),participationArc:Math.round(rule.participationReference*scale),placementAwardsArc:rule.awards.map(a=>Math.round(a*scale)),pointsPoolArc:Math.round(rule.points*scale)};});
  return {rewardScale:scale,poolArc:x.pool,payrollArc:x.payroll,salaryCoefficient:x.normalizedWageAtSuitability60BeforeVersatility,meanPlayerValueArc:x.newDisplayedMean,meanYouthArcPrice:x.meanArc,meanYouthEurCents:x.meanEur,grossEurCents:b.grossEurCents,illustrativeContributionCents:b.illustrativeContributionCents,arcDemand:b.desiredArcReceipts,unfundedArcDemand:b.unfundedArcDemand,reserveGapArc:b.reserveGapArc,initialReserveArc:x.pool,initialClubCapitalArc:x.license.genesisArc,licenseTopEur:x.license.topBaseEur,licenseLowEur:x.license.lowBaseEur,licenseLowRewardReferenceArc:x.license.lowRewardReferenceArc,licenseExponent:x.license.exponent,licenseGroups:x.license.groups,schedules,clubLiquidityStress:x.clubLiquidityStress};
 });
 if(cases.some(x=>x.poolArc!==x.payrollArc||x.licenseTopEur!==300||x.licenseLowEur!==100))throw Error("scale invariant");
 return {version:c.version,status:"research-only",youthArcPriceBps:c.youthArcPriceBps,youthEurPriceBps:c.eurPriceBps,cases};
}
