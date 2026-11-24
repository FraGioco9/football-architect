// Aggregate equilibrium sensitivity only; never a purchase quota or pricing rule.
export function flexibleMix(input,retirements=332,seasons=32){
 const cases=input.cases.map(c=>{
  const {poolArc:pool,meanYouthArcPrice:mean,meanYouthEurCents:eur}=c;
  const equilibrium=retirements-pool/mean, minOrders=Math.max(0,Math.floor(equilibrium)),maxOrders=Math.min(retirements,Math.ceil(equilibrium));
  const orders=e=>Math.round((retirements-e)*mean);
  const neighbors=[...new Set([minOrders,maxOrders])].map(e=>({eurOrders:e,arcOrders:retirements-e,desiredArc:orders(e),deltaArc:orders(e)-pool,grossEurCents:Math.round(e*eur)}));
  // Illustrative aggregate balancing path, never a quota, allocation algorithm or demand forecast.
  const buffer=Math.ceil(mean),initialReserve=pool+buffer;let wallet=0,reserve=initialReserve,totalEurOrders=0,totalArcReceipts=0,peakWallet=0;const path=[];
  for(let s=1;s<=seasons;s++){
   if(reserve<pool)throw Error("reserve bridge");
   const available=wallet+pool;let e=Math.max(0,Math.min(retirements,Math.floor(retirements-available/mean)));
   while(e<retirements&&orders(e)>available)e++;
   while(e>0&&orders(e-1)<=available)e--;
   const received=orders(e);wallet=available-received;reserve=reserve-pool+received;
   if(wallet<0||reserve+wallet!==initialReserve)throw Error("stock reconciliation");
   totalEurOrders+=e;totalArcReceipts+=received;peakWallet=Math.max(peakWallet,wallet);path.push({season:s,eurOrders:e,arcOrders:retirements-e,receivedArc:received,walletArc:wallet,reserveArc:reserve});
  }
  return {poolArc:pool,meanYouthArcPrice:mean,meanYouthEurCents:eur,breakEvenEurOrders:equilibrium,breakEvenEurShare:equilibrium/retirements,neighbors,illustrativePath:{seasons,bufferArc:buffer,initialReserveArc:initialReserve,totalEurOrders,totalArcReceipts,meanEurShare:totalEurOrders/(retirements*seasons),grossEurCents:Math.round(totalEurOrders*eur),closingWalletArc:wallet,closingReserveArc:reserve,peakWalletArc:peakWallet,path}};
 });
 return {version:"economy-flexible-eur-mix-v1",status:"research-only",retirements,seasons,rawBreakEvenEurShare:1-1/(1.1*.99),cases};
}
