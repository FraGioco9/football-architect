// DRAFT analytical targets only, not actual charges or revenue forecasts.
export function reinvestmentTarget(b,retirements,eurOrders){
 const arcOrders=retirements-eurOrders;
 if(!Number.isSafeInteger(arcOrders)||arcOrders<=0||b.aiSalaryReserveArc!==0||b.staffBudgetArc!==0||b.fundedYouthArcReceipts!==b.desiredYouthArcReceipts)throw Error('invalid human-only reference');
 const ratio=b.fundedYouthArcReceipts/b.humanSalaryArc;
 const rows=[.7,.75,.8,1].map(share=>{
  const payroll=Math.round(b.rewardsArc*share),clubSpend=b.rewardsArc-payroll,youth=Math.round(payroll*ratio),agentResidual=payroll-youth;
  return {payrollShare:share,payrollArc:payroll,clubSpendTargetArc:clubSpend,youthArcReceiptsSensitivity:youth,agentResidualArc:agentResidual,requiredAverageArcTicketForFullPayroll:Math.ceil(payroll/arcOrders),impliedCurrentRatioMeanArc:Math.round(youth/arcOrders),reserveIfOnlyClubAndYouthSpendArc:clubSpend+youth,additionalAgentReceiptsRequiredArc:agentResidual};
 });
 const current={rewardsArc:b.rewardsArc,payrollArc:b.humanSalaryArc,clubSpendTargetArc:b.worldClubCashGrowthBeforeDiscretionaryArc,youthArcReceipts:b.fundedYouthArcReceipts,agentResidualArc:b.walletNetArc,reserveIfOnlyClubAndYouthSpendArc:b.worldClubCashGrowthBeforeDiscretionaryArc+b.fundedYouthArcReceipts,additionalAgentReceiptsRequiredArc:b.walletNetArc,requiredMeanYouthArcTicketForFullPayroll:Math.ceil(b.humanSalaryArc/arcOrders),grossEurCents:b.eurGrossCents};
 if(current.reserveIfOnlyClubAndYouthSpendArc+current.additionalAgentReceiptsRequiredArc!==current.rewardsArc||rows.some(x=>x.reserveIfOnlyClubAndYouthSpendArc+x.additionalAgentReceiptsRequiredArc!==current.rewardsArc))throw Error('flow conservation');
 return {status:'research-only',retirements,arcOrders,eurOrders,referenceYouthReceiptToPayrollRatio:ratio,current,payrollShareSensitivities:rows};
}
