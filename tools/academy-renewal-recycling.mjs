// Offline arithmetic sensitivity; not payment or issuance authority.
export function renewalRecycling(c){
 const sum=xs=>xs.reduce((a,b)=>a+b,0),round=n=>Math.round(n*100)/100;
 if(!Number.isSafeInteger(c.rewardsArc)||c.rewardsArc<=0||!Number.isSafeInteger(c.referenceAnnualRetirements)||c.referenceAnnualRetirements<=0||![c.arcPercent,c.eurPercent].every(x=>Number.isSafeInteger(x)&&x>0&&x<=100)||c.referenceDisplayedValuesArc.length!==c.weights.length||Math.abs(sum(c.weights)-1)>1e-9||c.weights.some(x=>x<0)||c.referenceDisplayedValuesArc.some(x=>!Number.isSafeInteger(x)||x<=0)||c.eurOrderCounts.some(n=>!Number.isSafeInteger(n)||n<0||n>c.referenceAnnualRetirements)||c.otherReserveReceiptScenariosArc.some(x=>!Number.isSafeInteger(x)||x<0))throw Error("invalid scenario");
 const mean=xs=>sum(xs.map((v,i)=>v*c.weights[i]));
 const arc=mean(c.referenceDisplayedValuesArc.map(v=>Math.ceil(v*c.arcPercent/100))),eur=mean(c.referenceDisplayedValuesArc.map(v=>Math.ceil(v*c.eurPercent/100)));
 const net=mean(c.referenceDisplayedValuesArc.map(v=>{const q=Math.ceil(v*c.eurPercent/100);return q-Math.ceil(q*c.illustrativePaymentVariableBps/10000)-c.illustrativePaymentFixedCents}));
 return {version:c.version,status:"research-only",annualRetirements:c.referenceAnnualRetirements,referenceMeanArc:round(arc),referenceMeanEurCents:round(eur),mix:c.eurOrderCounts.map(eurOrders=>{
  const arcOrders=c.referenceAnnualRetirements-eurOrders,receipts=arcOrders*arc;
  return {arcOrders,eurOrders,totalActivations:arcOrders+eurOrders,arcReceipts:round(receipts),rewardsRecoveredPct:round(100*receipts/c.rewardsArc),requiredAverageArcPriceForAcademyOnly:arcOrders?Math.ceil(c.rewardsArc/arcOrders):null,grossEurCents:round(eurOrders*eur),contributionBeforeFixedCostsCents:c.soldGenerationCostCents.map(unit=>({soldGenerationCostCents:unit,contributionCents:round(eurOrders*net-c.referenceAnnualRetirements*unit)})),reserveScenarios:c.otherReserveReceiptScenariosArc.map(other=>({otherReserveReceiptsArc:other,totalReserveReceiptsArc:round(other+receipts),uncoveredRewardsArc:round(Math.max(0,c.rewardsArc-other-receipts)),requiredMeanYouthArcPrice:arcOrders?Math.ceil(Math.max(0,c.rewardsArc-other)/arcOrders):null}))};
 })};
}
