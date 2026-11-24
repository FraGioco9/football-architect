// Offline agent tenure and reserve circulation sensitivity.
export function buildCirculation(reference,rewards,salary,round,c,sim){
 const pool=rewards.rewardTotals().pool,runs=[];
 for(const v of c.variants)for(const seed of c.seeds){
  const x=sim(reference,rewards,salary,round,c,{...c.scenarios[0],secondary:v.secondary,gate:v.gate,tenureMode:true,contractPolicy:"guarded",launchOption:"paid-primary",primaryPolicy:c.primaryPolicies[0],exposureFactor:1},seed);
  const sum=(a,k)=>a.reduce((n,o)=>n+o[k],0),mean=(a,k)=>sum(a,k)/a.length;
  const phases=[[1,Math.min(10,c.seasons)],[11,Math.min(20,c.seasons)],[21,c.seasons]].filter(([a,b])=>b>=a).map(([a,b])=>{
   const rows=x.series.filter(s=>s.season>=a&&s.season<=b),n=rows.length,ai=sum(rows,"aiPaid"),human=sum(rows,"humanPaid"),youth=sum(rows,"arcReceipts"),primary=sum(rows,"primaryArcReceipts"),fee=sum(rows,"feeArc"),market=sum(rows,"tradeVolume"),recovered=ai+youth+primary+fee,prior=x.series[a-2],last=rows.at(-1),walletChange=last.walletArc-(prior?.walletArc??0);
   if(walletChange!==human-youth-primary-fee)throw Error("wallet flow mismatch");return {from:a,to:b,seasons:n,rewards:pool*n,ai,human,youth,primary,fee,market,recovered,recoveryRatio:recovered/(pool*n),annualReserveGap:pool-recovered/n,walletChange,annualWalletChange:walletChange/n,clubChange:pool*n-ai-human,eurYouth:sum(rows,"eurCents"),eurPrimary:sum(rows,"primaryEurCents")};
  });
  const cohort=x.tenures.filter(t=>t.season<=Math.min(70,c.seasons-24)),groups=[];
  for(const kind of ["existing","youth","secondary"])for(const currency of ["ARC","EUR"]){const all=cohort.filter(t=>t.kind===kind&&t.currency===currency),closed=all.filter(t=>t.end!==null);if(!all.length)continue;const income=closed.reduce((s,t)=>s+t.paid+t.resale,0),cost=sum(closed,"cost"),ratios=closed.map(t=>(t.paid+t.resale)/t.cost).sort((a,b)=>a-b);groups.push({kind,currency,acquired:all.length,closed:closed.length,open:all.length-closed.length,meanCost:closed.length?cost/closed.length:0,meanSalary:closed.length?mean(closed,"paid"):0,meanResale:closed.length?mean(closed,"resale"):0,recoveryRatio:cost?income/cost:null,medianRecovery:ratios.length?ratios[Math.floor((ratios.length-1)/2)]:null,breakEvenFraction:closed.length?closed.filter(t=>t.paid+t.resale>=t.cost).length/closed.length:null});}
  let net=0,min=pool;const trace=x.series.map(s=>{min=Math.max(min,pool-net);net+=s.aiPaid+s.arcReceipts+s.primaryArcReceipts+s.feeArc-pool;return {season:s.season,requiredReserveArc:min,netReserveChangeArc:net,aiPaid:s.aiPaid,humanPaid:s.humanPaid,youthArc:s.arcReceipts,primaryArc:s.primaryArcReceipts,fee:s.feeArc,marketVolume:s.tradeVolume,walletArc:s.walletArc,clubArc:s.clubArc,population:s.population,employed:s.employed,eurYouth:s.eurCents,eurPrimary:s.primaryEurCents,arrears:s.arrears56};});
  const last=trace.at(-1);const reserveChecks=c.reserveOptionsArc.map(initial=>({initial,completed:(trace.find(s=>s.requiredReserveArc>initial)?.season??c.seasons+1)-1}));const {series,tenures,agentFlows,...summary}=x;
  const agentTotals={salary:sum(agentFlows,"salary"),arcSpend:sum(agentFlows,"arcSpend"),eurCents:sum(agentFlows,"eurCents"),resale:sum(agentFlows,"resale")};
  runs.push({...summary,variant:v.name,phases,groups,agentTotals,minimumReserveArc:min,reserveChecks,trace});
 }return {version:c.version,status:"research-only",config:c,runs};
}
