/** #763: approved final ARC rounding; not a salary or accounting rule. */
export function roundPlayerMarketValueArc(raw){
 if(typeof raw!=='number'||!Number.isFinite(raw)||raw<0)return null;
 if(raw===0)return 0;
 if(raw>Number.MAX_SAFE_INTEGER)return null;
 let step=1;
 // Compare magnitudes directly, avoiding log10 at decimal boundaries.
 while(raw>=step*100)step*=10;
 const lower=Math.floor(raw/step)*step;
 // Compare the reconstructed multiple with the input, not a rounded quotient.
 const rounded=lower<raw?lower+step:lower;
 return Number.isSafeInteger(rounded)?rounded:null;
}
