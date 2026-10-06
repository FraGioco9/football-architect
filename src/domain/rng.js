// Domain logic: no DOM, browser storage or UI dependencies.
// Keep Mulberry32 and its draw order frozen for v1 save/baseline compatibility.
export function randomFactory(seed=1){let a=seed>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

export function choose(rand,items){return items[Math.floor(rand()*items.length)];}

// Legacy v1 domains: NEVER change these formulas or the shared RNG draw order
// without a separately approved gameplay change and a save-schema migration.
export function worldSeed(seed,countryId){
  const salt=String(countryId).split('').reduce((acc,c)=>acc*31+c.charCodeAt(0),0);
  return (seed+salt)>>>0;
}
export const roundSeed=(seed,season,round)=>(seed+season*99991+round*2749)>>>0;
export const seasonSeed=(seed,season)=> (seed+season*7211)>>>0;

// Future independent streams. Defined and tested now, but NOT substituted into
// the v1 round simulator: per-match reseeding would change all frozen results.
// Delimit and length-prefix every part to prevent ambiguous seed namespaces.
export function scopedSeed(seed,scope,...parts){
  let hash=(0x811c9dc5^(seed>>>0))>>>0;
  for(const item of [scope,...parts]){
    const value=String(item);
    const token=`${value.length}:${value}|`;
    for(let i=0;i<token.length;i++){
      hash=Math.imul(hash^token.charCodeAt(i),0x01000193)>>>0;
    }
  }
  return hash>>>0;
}
export const competitionSeed=(seed,season,competitionId)=>scopedSeed(seed,'competition',season,competitionId);
export const matchSeed=(seed,season,competitionId,matchId)=>scopedSeed(seed,'match',season,competitionId,matchId);
