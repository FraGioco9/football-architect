// #770 DRAFT research only; EUR cents and ARC are separate accounting units.
export function quoteYouth(value,arcPercent,eurPercent){
 if(!Number.isSafeInteger(value)||value<1||![arcPercent,eurPercent].every(p=>Number.isSafeInteger(p)&&p>0&&p<=100))throw Error("invalid DRAFT quote");
 const quote=p=>{const q=(BigInt(value)*BigInt(p)+99n)/100n;if(q>BigInt(Number.MAX_SAFE_INTEGER))throw Error("quote overflow");return Number(q)};
 return {arc:quote(arcPercent),eurCents:quote(eurPercent)};
}
export function unitEconomics(c,quote){
 const avg=values=>values.reduce((s,v,i)=>s+v*c.weights[i],0),round=v=>Math.round(v*100)/100;
 return c.pairs.map(p=>{
  const quotes=c.referenceDisplayedValuesArc.map(v=>quote(v,p.arcPercent,p.eurPercent));
  const meanArc=avg(quotes.map(q=>q.arc)),meanEur=avg(quotes.map(q=>q.eurCents)),net=avg(quotes.map(q=>q.eurCents-Math.ceil(q.eurCents*c.paymentVariableBps/10000)-c.paymentFixedCents));
  return {...p,relativeEurDiscountPct:round(100*(1-p.eurPercent/p.arcPercent)),quotes,meanArc:round(meanArc),meanEurCents:round(meanEur),meanAfterIllustrativePaymentCostCents:round(net),breakEven:c.generationUnitCostsCents.map(cost=>({generationCostCents:cost,annualCostCents:cost*c.annualCandidates,eurOrdersNeeded:Math.ceil(cost*c.annualCandidates/net),shareAtMinimumActivationsPct:round(100*Math.ceil(cost*c.annualCandidates/net)/c.minimumActivations)})),mix:c.annualActivationScenarios.flatMap(n=>c.eurShareScenarios.map(share=>{const eurOrders=Math.round(n*share),arcOrders=n-eurOrders;return {activations:n,eurOrders,arcOrders,arcToReserve:round(arcOrders*meanArc),grossEurCents:round(eurOrders*meanEur),afterIllustrativePaymentCostCents:round(eurOrders*net)};}))};
 });
}
export function summarizeDual(c,reference,simCfg,scenario,rewards,salary,run){
 const sum=xs=>xs.reduce((a,b)=>a+b,0),mean=xs=>Math.round(sum(xs)/xs.length);
 return c.pairs.flatMap(p=>c.stressPreferences.map(pref=>{
  const runs=c.stressSeeds.map(seed=>run(reference,rewards,salary,simCfg,{...scenario,...p,eurPreference:pref},seed));
  const tail=runs.flatMap(r=>r.series.slice(-10));
  return {...p,eurPreferenceWhenBothAffordable:pref,completed:runs.map(r=>r.completed),arcOrders:mean(tail.map(s=>s.academyArcBuys)),eurOrders:mean(tail.map(s=>s.academyEurBuys)),totalOrders:mean(tail.map(s=>s.academyArcBuys+s.academyEurBuys)),arcToReserve:mean(tail.map(s=>s.academyArcSpent)),grossEurCents:mean(tail.map(s=>s.academyEurCents)),rewardIssuanceArc:mean(tail.map(s=>s.issued)),peakUnpaid56:Math.max(...runs.map(r=>r.peakUnpaid56))};
 }));
}
