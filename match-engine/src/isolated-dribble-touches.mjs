// #628 research: proposal only; actual ball impulse needs authentic Rapier START.
export const ISOLATED_DRIBBLE_TOUCH_VERSION='me-628-dribble-grounded-pressure-paced-v3';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function fraction(variantIndex,tick){
 let state=2166136261;
 for(const c of 'dribble-1v1|'+variantIndex+'|'+tick)
  state=Math.imul(state^c.charCodeAt(0),16777619)>>>0;
 return state/4294967296;
}
export function chooseIsolatedDribbleTouch({variantIndex,tick,attackingSide,ballPosition,ballVelocity,defender=null,solo=false}={}){
 if(!Number.isSafeInteger(variantIndex)||variantIndex<0||variantIndex>29||
    !Number.isSafeInteger(tick)||tick<1||!['home','away'].includes(attackingSide)||
    !ballPosition||!ballVelocity||typeof solo!=='boolean'||
    (!solo&&(!defender||defender.team!==(attackingSide==='home'?'away':'home')))||
    (solo&&defender!==null)||
    ![ballPosition.x,ballPosition.y,ballVelocity.x,ballVelocity.y,
      ...(solo?[]:[defender.x,defender.y])].every(Number.isFinite))
  throw new TypeError('Original isolated 1v1 defender/ball source required');
 const attack=attackingSide==='home'?1:-1,f=fraction(variantIndex,tick);
 const distance=solo?Infinity:Math.hypot(ballPosition.x-defender.x,ballPosition.y-defender.y);
 // Stable seed-specific tendency, with small per-touch corrections, avoids
 // jagged random redirection on consecutive real 60Hz shoe contacts.
 const bias=(fraction(variantIndex,0)-0.5)*0.20;
 const lateralPressure=clamp((4-distance)/3,0,1);
 const awayFromDefender=solo?0:clamp((ballPosition.y-defender.y)*0.10,-0.24,0.24);
 const lateral=variantIndex===0?0:
  clamp(bias+awayFromDefender*lateralPressure+(f-0.5)*0.08,-0.34,0.34);
 // Speed-aware SMALL impulse: a rolling ball needs less added acceleration.
 // Never brakes by directly mutating ball velocity and never awards possession.
 const forwardSpeed=Math.max(0,attack*ballVelocity.x);
 const assistance=clamp((3.4-forwardSpeed)/1.8,0,1);
 const originalMagnitudeNs=variantIndex===0?0.12:
  0.095+f*0.075*(0.60+0.40*assistance);
 // Solo has no opponent-induced pressure and a closer genuine pursuit target.
 // Reduce actual native shoe-triggered impulse, not ball speed after the fact.
 // Original D-01 two-person measured physics stays byte-identical.
 // Two independently moving real shoes now provide more real contacts.
 // Soften the NATIVE START-only solo impulse (no post-step ball clamp).
 const magnitudeNs=solo?originalMagnitudeNs*0.44:originalMagnitudeNs;
 return Object.freeze({version:ISOLATED_DRIBBLE_TOUCH_VERSION,variantIndex,tick,
  dx:attack*8,dy:8*lateral,magnitudeNs,lateralRatio:lateral,
  fromLiveOpponent:!solo,soloCarry:solo,fromLiveBallVelocity:true,
  genuineRapierShoeStartRequired:true,decisionOnly:true,
  verifiedSecondTouch:false,verifiedDribble:false,
  officialPossession:false,officialMatchAction:false});
}

// D-02 active 1v1 only. Use live obstacle geometry rather than per-touch
// random direction. Carry toward a reachable opening; after passing the
// defender straighten toward goal. No success or possession guarantee.
export function chooseDirectedDribbleTouch({attackingSide,ballPosition:b,ballVelocity:v,defender,variantIndex,tick}={}){
 if(!['home','away'].includes(attackingSide)||!defender||
    defender.team==attackingSide||![b?.x,b?.y,v?.x,v?.y,defender.x,defender.y].every(Number.isFinite)||
    !Number.isSafeInteger(variantIndex)||variantIndex<0||variantIndex>29||!Number.isSafeInteger(tick)||tick<1)
  throw new TypeError('Directed dribble requires live ball and opposing defender');
 const dir=attackingSide==='home'?1:-1;
 const ahead=dir*(defender.x-b.x),lateral=defender.y-b.y;
 const pressure=clamp((5-Math.hypot(ahead,lateral))/3.5,0,1);
 const threatening=ahead>=-0.65&&ahead<=5&&Math.abs(lateral)<2.2;
 // Tie-break only a head-on geometry; do not vary the side with time.
 const side=Math.abs(lateral)>0.12?-Math.sign(lateral):(variantIndex%2===0?1:-1);
 const targetY=threatening?clamp(defender.y+side*1.35,-32,32):clamp(b.y,-24,24);
 const angle=clamp(Math.atan2(targetY-b.y,Math.max(1.5,ahead+1.0)),-0.70,0.70);
 const speed=threatening?2.5-0.5*pressure:3.0;
 const desired={x:dir*speed*Math.cos(angle),y:speed*Math.sin(angle)};
 const dx=desired.x-v.x,dy=desired.y-v.y,delta=Math.hypot(dx,dy);
 // Limit actual corrective impulse, including braking. Never set velocity.
 const magnitudeNs=Math.min(0.30,0.43*delta);
 return Object.freeze({version:'me-628-directed-dribble-v1',variantIndex,tick,
  dx,dy,magnitudeNs,desiredVelocity:Object.freeze(desired),targetY,
  bypassSide:threatening?side:0,defenderAheadM:ahead,pressure,
  fromLiveOpponent:true,soloCarry:false,fromLiveBallVelocity:true,
  genuineRapierShoeStartRequired:true,decisionOnly:true,officialPossession:false,officialMatchAction:false});
}
// Keep the original mover aligned with the real rolling ball so the next
// authentic shoe contact can follow a lateral touch; do not chase a fixed
// world-X offset after an evasion.
export function directedDribbleApproachTarget(attacker,b,v,attackingSide){
 const dir=attackingSide==='home'?1:-1;
 const gap=Math.hypot(b.x-attacker.x,b.y-attacker.y);
 const lead=clamp(gap/12,0,0.20);
 const speed=Math.hypot(v.x,v.y);
 const ux=speed>0.35&&v.x*dir>0.15?v.x/speed:dir;
 const uy=speed>0.35&&v.x*dir>0.15?v.y/speed:0;
 return Object.freeze({x:clamp(b.x+v.x*lead-0.30*ux,-51.99,51.99),
  y:clamp(b.y+v.y*lead-0.30*uy,-33.49,33.49)});
}
