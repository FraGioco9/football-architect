// Paid existing-player mandate launch; offline no-issuance prefix analysis.
export function buildPaidLaunch(reference,rewards,salary,round,c,sim){
 const pool=rewards.rewardTotals().pool,runs=[];
 for(const policy of c.primaryPolicies)for(const opt of (policy.referenceOnly?c.scenarios.slice(0,1):c.scenarios))for(const seed of c.seeds){
  const x=sim(reference,rewards,salary,round,c,{...opt,contractPolicy:"guarded",launchOption:"paid-primary",primaryPolicy:policy,exposureFactor:c.exposureFactor},seed);
  let injected=0,net=0,min=pool;
  const trace=x.series.map(s=>{min=Math.max(min,pool-net);injected+=s.diagnosticInjection;net=s.reserveArc-c.initialReserveArc-injected;const {season,primaryArcBuys,primaryEurBuys,primaryArcReceipts,primaryEurCents,primaryUnsold,primaryRetiredUnsold,aiPaid,humanPaid,arcReceipts,eurCents,arcBuys,eurBuys,feeArc,walletArc,clubArc,population,employed,arrears56,unpaid28,unpaid56,humanCoverage,retired,activated}=s;return {season,requiredReserveArc:min,netReserveChangeArc:net,primaryArcBuys,primaryEurBuys,primaryArcReceipts,primaryEurCents,primaryUnsold,primaryRetiredUnsold,aiPaid,humanPaid,arcReceipts,eurCents,arcBuys,eurBuys,feeArc,walletArc,clubArc,population,employed,arrears56,unpaid28,unpaid56,humanCoverage,retired,activated};});
  const sum=(key,rows=trace)=>rows.reduce((s,v)=>s+v[key],0),reserves=c.reserveOptionsArc.map(initial=>{const fail=trace.find(s=>s.requiredReserveArc>initial),completed=fail?fail.season-1:c.seasons;return {initial,completed,closingReserveArc:initial+(trace[completed-1]?.netReserveChangeArc??0)};});
  if(sum("primaryArcBuys")+sum("primaryEurBuys")+sum("primaryRetiredUnsold")+trace.at(-1).primaryUnsold!==6400)throw Error("primary stock final");
  const {series,...summary}=x;runs.push({...summary,policy:policy.name,minimumReserveArc:min,reserves,primaryArcBuys:sum("primaryArcBuys"),primaryEurBuys:sum("primaryEurBuys"),primaryArcReceipts:sum("primaryArcReceipts"),primaryEurCents:sum("primaryEurCents"),primaryRetiredUnsold:sum("primaryRetiredUnsold"),primaryUnsold:trace.at(-1).primaryUnsold,primaryEurFirst10:sum("primaryEurCents",trace.slice(0,10)),youthEurCents:sum("eurCents"),aiSalaryArc:sum("aiPaid"),firstSeason:trace[0],coverageAt:[1,5,10,20,50,100].filter(n=>n<=trace.length).map(n=>({season:n,humanCoverage:trace[n-1].humanCoverage})),trace});
 }
 return {version:c.version,status:"research-only",config:c,runs};
}
