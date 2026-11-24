// Synthetic mixed launch: opening affordability, mandate distribution, realized exposure sensitivity.
export function buildOpening(reference,rewards,salary,round,c,sim){
 const pool=rewards.rewardTotals().pool,runs=[];
 const go=(opt,seed,launchOption,exposureFactor=1)=>{
  const x=sim(reference,rewards,salary,round,c,{...opt,contractPolicy:"guarded",launchOption,exposureFactor},seed);
  let injected=0,net=0,min=pool;const trace=x.series.map(s=>{min=Math.max(min,pool-net);injected+=s.diagnosticInjection;net=s.reserveArc-c.initialReserveArc-injected;return {season:s.season,requiredReserveArc:min,netReserveChangeArc:net,arrears56:s.arrears56,unpaid28:s.unpaid28,unpaid56:s.unpaid56,wagePaid:s.wagePaid,benchmarkWageArc:s.benchmarkWageArc,retired:s.retired,activated:s.activated,population:s.population,employed:s.employed,arcBuys:s.arcBuys,eurBuys:s.eurBuys,arcReceipts:s.arcReceipts,feeArc:s.feeArc,eurCents:s.eurCents,walletArc:s.walletArc,walletGini:s.walletGini,clubArc:s.clubArc};});
  const {series,...summary}=x;const reserveChecks=c.reserveOptionsArc.map(initial=>{const fail=trace.find(s=>s.requiredReserveArc>initial),completed=fail?fail.season-1:c.seasons;return {initial,completed,closingReserveArc:initial+(trace[completed-1]?.netReserveChangeArc??0)}});
  runs.push({...summary,minimumReserveArc:min,reserveChecks,trace});return x.careerSummary.observedExposureRatio;
 };
 for(const launch of c.launchOptions)for(const seed of c.seeds)go(c.scenarios[0],seed,launch);
 // Calibrate only the benchmark exposure from independent diagnostic reference training seeds.
 const training=runs.filter(x=>x.launchOption==="guarded-balanced"&&x.scenario===c.scenarios[0].name);
 const exposureFactor=Math.min(c.calibrationCeiling,Math.max(c.calibrationFloor,training.reduce((s,x)=>s+x.careerSummary.observedExposureRatio,0)/training.length));
 for(const opt of c.scenarios)for(const seed of c.calibrationSeeds)go(opt,seed,c.calibrationOption,exposureFactor);
 return {version:c.version,status:"research-only",config:c,exposureFactor,runs};
}
