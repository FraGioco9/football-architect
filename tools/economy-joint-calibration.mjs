// Offline economic feasibility grid, not live pricing or settlement.
export function buildJoint(clubs,selection,base,renew,c,rewards,salary,create,round,cal){
 const sum=xs=>xs.reduce((a,b)=>a+b,0),rnd=n=>Math.round(n),near=(a,b)=>Math.abs(a-b)<1e-7;
 const active=selection.bindings.filter(b=>!b.competitionId.startsWith("int-")).reduce((s,b)=>s+b.clubIds.length,0);
 if(active!==256||!near(sum(c.youngWeights),1)||c.annualRetirements<c.eurOrders)throw Error("invalid reference");
 const arcOrders=c.annualRetirements-c.eurOrders;
 const staffPolicy=c.staffOptional?{1:0,2:0}:base.staffArc;
 if(c.staffOptional&&c.staffReserveFraction!==0)throw Error('optional staff cannot be guaranteed reserve income');
 const candidates=c.rewardScales.flatMap(rs=>c.wageScales.map(ws=>{
  const scaled={...rewards,competitionRewards:id=>{const v=rewards.competitionRewards(id);return {...v,pool:v.pool*rs,points:v.points*rs,awards:v.awards.map(a=>a*rs),participationReference:v.participationReference*rs}},rewardTotals:()=>({pool:rewards.rewardTotals().pool*rs})};
  const s={...salary,salaryScale:salary.salaryScale*ws};
  const forecast=create({...s,rewardBenchmark:s.rewardBenchmark/rs});
  const tickets=[];
  for(const age of c.entryAges)for(let i=0;i<c.youngSkills.length;i++){
   let v=0,surv=1,sk=c.youngSkills[i],wage=0;
   for(let t=0;t<=39-age;t++){const a=forecast(age+t,sk,c.youngVersatility,t%s.renewalSeasons===0);if(t%s.renewalSeasons===0)wage=a.wage;v+=wage*surv*a.employment*a.paid*s.agentPayoutFraction;sk=Math.min(99,sk+s.growth[age+t-16]);surv*=1-(s.retirement[age+t+1]??0);}
   const value=round(v),arc=Math.ceil(value*c.arcPercent/100),eur=Math.ceil(value*c.eurPercent/100),weight=c.youngWeights[i]/c.entryAges.length;tickets.push({value,arc,eur,weight});
  }
  const mean=k=>sum(tickets.map(t=>t[k]*t.weight));
  const x=cal(clubs,selection,{...base,staffArc:staffPolicy,horizon:renew.horizon,lowRankWeights:renew.lowRankWeights,replacementAnnualArc:c.clubRecruitmentArc},scaled,s);
  const pool=scaled.rewardTotals().pool,staff=rnd(sum(x.rows.filter(r=>r.initialTier).map(r=>staffPolicy[r.initialTier]))),recruit=rnd(sum(x.rows.filter(r=>r.initialTier).map(r=>c.clubRecruitmentArc[r.initialTier]))),payroll=rnd(sum(x.rows.map(r=>r.expectedCostArc)))-staff-recruit;
  const ai=rnd(payroll*(1-c.referenceHumanShare)),human=payroll-ai,desiredYouth=rnd(mean("arc")*arcOrders),youth=Math.min(human,desiredYouth),staffReserve=rnd(staff*c.staffReserveFraction);
  const clubBudget=pool-payroll-staff-recruit,clubNet=pool-payroll-staff; // sporting transfer allowance is internal redistribution, not a world sink
  const baseReserve=ai+staffReserve+youth,required=Math.max(0,pool-baseReserve),walletNet=human-youth,nonreserveStaff=staff-staffReserve;
  if(pool!==baseReserve+clubNet+walletNet+nonreserveStaff)throw Error("flow reconciliation");
  const eurGross=rnd(c.eurOrders*mean("eur")),eurAfterProcessing=rnd(c.eurOrders*sum(tickets.map(t=>(t.eur-Math.ceil(t.eur*c.paymentVariableBps/10000)-c.paymentFixedCents)*t.weight)));
  return {rewardScale:rs,wageScale:ws,rewardsArc:pool,salaryK:s.salaryScale,meanYouthValueArc:rnd(mean("value")),meanYouthArcQuote:rnd(mean("arc")),meanYouthEurCents:rnd(mean("eur")),topLicenseEur:x.topReference.baseLicenseCents/100,lowLicenseEur:x.lowReference.baseLicenseCents/100,genesisArc:x.totals.genesisArc,estimatedPayrollArc:payroll,aiSalaryReserveArc:ai,humanSalaryArc:human,staffBudgetArc:staff,assumedStaffReserveArc:staffReserve,internalRecruitmentBudgetArc:recruit,clubSurplusBeforeDiscretionaryArc:clubBudget,worldClubCashGrowthBeforeDiscretionaryArc:clubNet,desiredYouthArcReceipts:desiredYouth,fundedYouthArcReceipts:youth,unfundedYouthArcDemand:desiredYouth-youth,walletNetArc:walletNet,baseReserveReceiptsArc:baseReserve,requiredAdditionalReserveReceiptsArc:required,baseRecyclePct:rnd(10000*baseReserve/pool)/100,academyOnlyRequiredMeanArc:arcOrders?Math.ceil(pool/arcOrders):null,eurGrossCents:eurGross,eurContributionBeforeOverheadCents:eurAfterProcessing-c.annualRetirements*c.annualActivationCostCents,licenseWithinTolerance:Math.abs(x.topReference.baseLicenseCents/100-c.targetTopEur)<=c.licenseToleranceEur&&Math.abs(x.lowReference.baseLicenseCents/100-c.targetLowEur)<=c.licenseToleranceEur};
 }));
 const baseline=candidates.find(x=>x.rewardScale===1&&x.wageScale===1);
 const feasible=candidates.filter(x=>x.licenseWithinTolerance&&x.clubSurplusBeforeDiscretionaryArc>=0&&x.unfundedYouthArcDemand===0).sort((a,b)=>b.baseRecyclePct-a.baseRecyclePct);
 // No assumed zero opening wallet purchases. Simulate aggregate balances and reward bridge;
 // the stated order mix is a conditional target, not a demand estimate. Spend only paid human income
 // or existing wallets; no individual-agent affordability or match placement is modeled.
 function cashFlow(row,closure){
  let reserve=c.referenceInitialReserveArc,clubs=row.genesisArc,wallet=0,issued=0;const series=[];
  const opening=reserve+clubs+wallet;
  for(let season=1;season<=c.seasons;season++){
   const short=Math.max(0,row.rewardsArc-reserve);issued+=short;reserve+=short-row.rewardsArc;clubs+=row.rewardsArc;
   if(clubs<row.estimatedPayrollArc+row.staffBudgetArc)throw Error("aggregate payroll liquidity");
   clubs-=row.estimatedPayrollArc+row.staffBudgetArc;reserve+=row.aiSalaryReserveArc+row.assumedStaffReserveArc;wallet+=row.humanSalaryArc;
   const arc=Math.min(wallet,row.desiredYouthArcReceipts);wallet-=arc;reserve+=arc;
   // Other staff spending retained in modeled external ARC holder account; reference fraction is 1.
   if(row.staffBudgetArc!==row.assumedStaffReserveArc)throw Error("cashflow reference requires full hypothetical staff reserve destination");
   const extraClub=closure?Math.max(0,row.worldClubCashGrowthBeforeDiscretionaryArc):0,extraWallet=closure?Math.max(0,row.humanSalaryArc-arc):0;
   if(extraClub>clubs||extraWallet>wallet)throw Error("discretionary affordability");clubs-=extraClub;wallet-=extraWallet;reserve+=extraClub+extraWallet;
   if(reserve+clubs+wallet!==opening+issued||[reserve,clubs,wallet].some(n=>n<0))throw Error("cashflow stock conservation");
   series.push({season,newIssuanceArc:short,reserveArc:reserve,clubsArc:clubs,walletArc:wallet,youthArcReceipts:arc,additionalClubSpendArc:extraClub,additionalWalletSpendArc:extraWallet});
  }
  return {closure,openingArc:opening,totalIssuedArc:issued,closing:series.at(-1),series};
 }
 return {version:c.version,status:"research-only",baseline,feasible,grid:candidates,aggregateCashFlow:[cashFlow(baseline,false),cashFlow(baseline,true)]};
}
