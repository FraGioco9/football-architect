// #770 no-staff/no-undefined-service sensitivity, offline only.
export function noStaff(clubs,selection,base,renew,c,scenarios,rewards,salary,round,cal,build){
 const cases=scenarios.map(o=>{
  const x=build(clubs,selection,base,renew,{...c,...o},rewards,salary,round,cal);
  const {flows,...rest}=x; // discard historical fictional direct club-spend closure
  const scenarios=x.pricing.map(p=>{
   const received=p.fundedArcCeiling,gap=x.pool-received,clubGrowth=x.pool-x.payroll,walletGrowth=x.payroll-received;let reserve=x.pool,clubs=x.license.totals.genesisArc,wallet=0,issued=0;
   const opening=reserve+clubs;for(let s=0;s<c.seasons;s++){const short=Math.max(0,x.pool-reserve);issued+=short;reserve+=short-x.pool+received;clubs+=clubGrowth;wallet+=walletGrowth;if(reserve+clubs+wallet!==opening+issued)throw Error('stock conservation');}
   return {...p,actualClubReserveReceipts:0,reserveRecoveryPct:100*received/x.pool,gap,clubGrowth,walletGrowth,marketplaceTurnoverAt5PctToClose:gap*20,firstUnaffordableSeasonWithoutIssuance:gap>0?2:null,totalIllustrativeIssuance:issued,closingReserve:reserve,closingClubs:clubs,closingWallet:wallet};
  });
  const maxReceipts=x.payroll,maxGap=x.pool-maxReceipts;
  return {name:o.name,...rest,scenarios,maxReceipts,maxGap,clubLiquidityStress:x.clubLiquidityStress};
 });
 return {version:c.version,status:"research-only",assumptions:"Zero staff/undefined services, zero verified marketplace fees in base, transfers redistribute, no compelled spend. Full wages paid and all targeted ARC purchase tickets affordable only in aggregate, not a demand proof.",cases};
}
