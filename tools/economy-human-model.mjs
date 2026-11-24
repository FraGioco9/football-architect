// Offline research, not a payment or issuance authority.
export function buildHumanModel(clubs,selection,base,renew,c,rewards,salary,create,round,cal,build){
 const args=[clubs,selection], selected={...renew,horizon:c.forecastHorizon};
 const grid=build(...args,{...base,aiShare:0},selected,c,rewards,salary,create,round,cal);
 const humanShareSensitivity=c.humanShareScenarios.map(h=>{
  const x=build(...args,{...base,aiShare:1-h},selected,{...c,referenceHumanShare:h,rewardScales:[c.referenceRewardScale],wageScales:[c.referenceWageScale]},rewards,salary,create,round,cal).baseline;
  return {humanShare:h,...x};
 });
 const b=grid.baseline;
 const closure=c.discretionarySpendFractions.map(f=>{
  const clubSpend=Math.round(b.worldClubCashGrowthBeforeDiscretionaryArc*f),agentSpend=Math.round(b.walletNetArc*f);
  const recovered=b.baseReserveReceiptsArc+clubSpend+agentSpend,gap=b.rewardsArc-recovered;
  const series=[];let reserve=c.candidateReserveArc,clubs=b.genesisArc,wallet=0,issued=0;
  const opening=reserve+clubs;
  for(let season=1;season<=c.seasons;season++){
   const short=Math.max(0,b.rewardsArc-reserve);issued+=short;reserve+=short-b.rewardsArc;clubs+=b.rewardsArc-b.estimatedPayrollArc-clubSpend;wallet+=b.humanSalaryArc-b.fundedYouthArcReceipts-agentSpend;reserve+=recovered;
   if(reserve+clubs+wallet!==opening+issued||Math.min(reserve,clubs,wallet)<0)throw Error("stock reconciliation");
   series.push({season,issued:short,reserve,clubs,wallet});
  }
  return {spendFraction:f,clubSpend,agentSpend,recovered,gap,totalIssuedArc:issued,closing:series.at(-1)};
 });
 return {version:c.version,status:"research-only",grid,humanShareSensitivity,closure};
}
