// Reserve sensitivity from a shared diagnostic path, exact prefix under reserve-independent behavior.
export function buildMixedLaunch(reference,rewards,salary,round,c,sim){
 const pool=rewards.rewardTotals().pool, runs=[];
 for(const policy of c.contractPolicies)for(const opt of c.scenarios)for(const seed of c.seeds){
  const x=sim(reference,rewards,salary,round,c,{...opt,contractPolicy:policy},seed);
  let injected=0,minReserve=pool, cumulativeNet=0;
  const trace=x.series.map(s=>{injected+=s.diagnosticInjection;const startRequired=pool-cumulativeNet;minReserve=Math.max(minReserve,startRequired);cumulativeNet=s.reserveArc-c.initialReserveArc-injected;return {season:s.season,requiredOpeningReserveArc:minReserve,netReserveChangeArc:cumulativeNet,retired:s.retired,activated:s.activated,population:s.population,employed:s.employed,arcBuys:s.arcBuys,eurBuys:s.eurBuys,arcReceipts:s.arcReceipts,eurCents:s.eurCents,feeArc:s.feeArc,wageDue:s.wageDue,wagePaid:s.wagePaid,arrears56:s.arrears56,unpaid56:s.unpaid56,walletArc:s.walletArc,clubArc:s.clubArc,rejectedSignings:s.rejectedSignings,rejectedTransfers:s.rejectedTransfers};});
  const reserves=c.reserveOptionsArc.map(initial=>{const fail=trace.find(s=>s.requiredOpeningReserveArc>initial),completed=fail?fail.season-1:c.seasons,last=trace[completed-1];return {initialReserveArc:initial,completedSeasons:completed,firstUnfundedSeason:fail?.season??null,closingReserveArc:initial+(last?.netReserveChangeArc??0),closingArrearsArc:last?.arrears56??0,peakArrearsArc:Math.max(0,...trace.slice(0,completed).map(s=>s.arrears56)),closingPopulation:last?.population??6400};});
  const {series,...summary}=x; runs.push({...summary,minimumReserveForDiagnosticPathArc:minReserve,firstTenRetirements:trace.slice(0,10).reduce((a,s)=>a+s.retired,0),firstTenArcReceipts:trace.slice(0,10).reduce((a,s)=>a+s.arcReceipts,0),rejectedSignings:trace.reduce((a,s)=>a+s.rejectedSignings,0),reserves,trace});
 }
 return {version:c.version,status:"research-only",config:c,runs};
}
