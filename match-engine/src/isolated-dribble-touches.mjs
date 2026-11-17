// #628 research: proposal only; actual ball impulse needs authentic Rapier START.
export const ISOLATED_DRIBBLE_TOUCH_VERSION='me-628-dribble-grounded-short-poke-v2';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function fraction(variantIndex,tick){
 let state=2166136261;
 for(const c of 'dribble-1v1|'+variantIndex+'|'+tick)
  state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
 return state/4294967296;
}
export function chooseIsolatedDribbleTouch({variantIndex,tick,attackingSide,ballPosition,defender}={}){
 if(!Number.isSafeInteger(variantIndex)||variantIndex<0||variantIndex>29||
    !Number.isSafeInteger(tick)||tick<1||!['home','away'].includes(attackingSide)||
    !ballPosition||!defender||defender.team!==(attackingSide==='home'?'away':'home')||
    ![ballPosition.x,ballPosition.y,defender.x,defender.y].every(Number.isFinite))
  throw new TypeError('Original isolated 1v1 defender/ball source required');
 const attack=attackingSide==='home'?1:-1,f=fraction(variantIndex,tick);
 const lateral=variantIndex===0?0:clamp((ballPosition.y-defender.y)*0.12,-0.38,0.38)+(f-0.5)*0.56;
 // Low-amplitude 0.095–0.170 Ns on authentic contact; no virtual hold.
 const magnitudeNs=variantIndex===0?0.12:0.095+f*0.075;
 return Object.freeze({version:ISOLATED_DRIBBLE_TOUCH_VERSION,variantIndex,tick,
  dx:attack*8,dy:8*lateral,magnitudeNs,lateralRatio:lateral,
  fromLiveOpponent:true,genuineRapierShoeStartRequired:true,decisionOnly:true,
  verifiedSecondTouch:false,verifiedDribble:false,
  officialPossession:false,officialMatchAction:false});
}
