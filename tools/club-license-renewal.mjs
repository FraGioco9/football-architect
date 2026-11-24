// #390/#586/#770 research only. Cohort mass is expected population, not actual player identities.
export function retirementReference(salary,entryAges,slots,active,annualActivations,seasons){
 const sum=xs=>xs.reduce((a,b)=>a+b,0),round=n=>Math.round(n*100)/100;
 if(!Number.isSafeInteger(slots)||slots<1||!Number.isSafeInteger(active)||active<1||!Number.isSafeInteger(seasons)||seasons<1||!entryAges.length||entryAges.some(a=>!Number.isInteger(a)||a<16||a>19)||annualActivations.some(a=>!Number.isSafeInteger(a)||a<0))throw Error("invalid cohort configuration");
 const ageMass=Array(40).fill(0);
 for(const start of entryAges){let survival=1;for(let age=start;age<=39;age++){ageMass[age]+=survival/entryAges.length;survival*=1-(salary.retirement[age+1]??0);}}
 const life=sum(ageMass),annualPerClub=slots/life,world=annualPerClub*active,target=slots*active;
 const scenarios=annualActivations.map(activations=>{
  let mass=ageMass.map(a=>a/life*target),totalRetired=0,minimum=target;
  for(let year=0;year<seasons;year++){
   const next=Array(40).fill(0);let retired=0;
   for(let age=16;age<=39;age++){const survive=mass[age]*(1-(salary.retirement[age+1]??0));retired+=mass[age]-survive;if(age<39)next[age+1]+=survive;}
   totalRetired+=retired;for(const age of entryAges)next[age]+=activations/entryAges.length;mass=next;minimum=Math.min(minimum,sum(mass));
  }
  const ending=sum(mass);
  if(Math.abs(ending-(target+activations*seasons-totalRetired))>1e-6)throw Error("cohort conservation");
  return {activations,endingActivePool:round(ending),minimumActivePool:round(minimum),expectedRetirements:round(totalRetired),endingShortfallAgainstSlots:round(Math.max(0,target-ending))};
 });
 return {expectedCareerSeasons:round(life),annualPerClub:round(annualPerClub),annualWorld:round(world),annualPerClubExact:annualPerClub,worldExact:world,targetSlots:target,scenarios};
}
export function buildRenewalCalibration(clubs,selection,base,c,rewards,salary,calibrate){
 const round=n=>Math.round(n*100)/100;
 const active=selection.bindings.filter(x=>!x.competitionId.startsWith("int-")).reduce((s,b)=>s+b.clubIds.length,0);
 const retirement=retirementReference(salary,c.youngEntryAges,base.squadSize,active,c.annualActivationScenarios,c.seasons);
 const supply=active*c.academyCandidatesPerActiveClub;
 if(c.annualActivationScenarios.some(x=>x>supply)||!Number.isSafeInteger(supply)||supply<=0)throw Error("invalid supply");
 const budget=fees=>Object.fromEntries([1,2].map(t=>[t,Math.round(retirement.annualPerClubExact*fees[t])]));
 const apply=(fees,extra=0)=>{const replacementAnnualArc=budget(fees);return calibrate(clubs,selection,{...base,version:c.version,horizon:c.horizon,lowRankWeights:c.lowRankWeights,replacementAnnualArc:{1:replacementAnnualArc[1]+extra,2:replacementAnnualArc[2]+extra}},rewards,salary);};
 const selected=apply(c.clubRecruitmentPerReplacementArc);
 const summarize=x=>({topBaseCents:x.topReference.baseLicenseCents,lowBaseCents:x.lowReference.baseLicenseCents,groups:x.groups,genesisArc:x.totals.genesisArc});
 return {version:c.version,status:"research-only-unapproved-quotes",retirement:{...retirement,annualCandidates:supply,minimumActivationShare:round(retirement.worldExact/supply*100)},annualRecruitmentBudgetArc:budget(c.clubRecruitmentPerReplacementArc),selected,feeSensitivity:c.feeSensitivityD1Arc.map(fee=>({feesArc:{1:fee,2:fee*c.d2RecruitmentRatio},...summarize(apply({1:fee,2:fee*c.d2RecruitmentRatio}))})),generationFeeSensitivity:c.potentialClubGenerationFeeArcScenarios.map(fee=>({unapprovedArcFeePerCandidate:fee,annualClubFeeArc:fee*c.academyCandidatesPerActiveClub,...summarize(apply(c.clubRecruitmentPerReplacementArc,fee*c.academyCandidatesPerActiveClub))})),platformGenerationCosts:c.platformGenerationCostCentsScenarios.map(unit=>({hypotheticalCostCentsPerCandidate:unit,seasonalCostCents:unit*supply,costCentsOverHorizon:unit*supply*c.seasons}))};
}
