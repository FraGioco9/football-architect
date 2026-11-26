// #628 research: proposal only; actual ball impulse needs authentic Rapier START.
import {selectDefensiveIntervention} from './defensive-intervention-selection.mjs';
export const ISOLATED_DRIBBLE_TOUCH_VERSION='me-628-dribble-grounded-pressure-paced-v3';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const opposite=side=>side==='home'?'away':'home';
export function isOpposingDuelPair(side,actor,opponent){
 return ['home','away'].includes(side)&&typeof actor?.id==='string'&&
  typeof opponent?.id==='string'&&actor.id.startsWith(side+'-')&&opponent.id.startsWith(opposite(side)+'-')&&
  (actor.team===undefined||actor.team===side)&&(opponent.team===undefined||opponent.team===opposite(side));
}
// Initial IDs select fixture participants, not action capabilities.
export function resolveDuelActors(players,initialSide,state=null){
 const ids=[initialSide+'-10',opposite(initialSide)+'-2'];
 const carrierId=ids.includes(state?.carrierId)?state.carrierId:ids[0];
 const candidateId=ids.includes(state?.candidateId)&&state.candidateId!==carrierId?state.candidateId:null;
 const primaryId=candidateId??carrierId;
 const attacker=players.find(p=>p.id===primaryId),defender=players.find(p=>ids.includes(p.id)&&p.id!==primaryId);
 if(!attacker||!defender)throw new TypeError('Original two physical duel actors required');
 return {attacker,defender,attackingSide:attacker.team,carrierId,candidateId};
}
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
export function chooseDirectedDribbleTouch({attackingSide,ballPosition:b,ballVelocity:v,defender,variantIndex,tick,attacker=null}={}){
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
 const shield=planDribbleShield(attacker,defender,b,v,attackingSide);
 const speed=threatening?2.5-0.5*pressure:3.0;
 const desired=shield?{x:0.85*shield.away.x+dir*0.30,y:0.85*shield.away.y}:
  {x:dir*speed*Math.cos(angle),y:speed*Math.sin(angle)};
 const dx=desired.x-v.x,dy=desired.y-v.y,delta=Math.hypot(dx,dy);
 // Limit actual corrective impulse, including braking. Never set velocity.
 const magnitudeNs=Math.min(shield?0.18:0.30,0.43*delta);
 return Object.freeze({version:'me-628-directed-dribble-v1',variantIndex,tick,
  dx,dy,magnitudeNs,desiredVelocity:Object.freeze(desired),targetY,
  bypassSide:threatening?side:0,defenderAheadM:ahead,pressure,shieldingIntent:shield!==null,
  fromLiveOpponent:true,soloCarry:false,fromLiveBallVelocity:true,
  genuineRapierShoeStartRequired:true,decisionOnly:true,officialPossession:false,officialMatchAction:false});
}
// Keep the original mover aligned with the real rolling ball so the next
// authentic shoe contact can follow a lateral touch; do not chase a fixed
// world-X offset after an evasion.
export function directedDribbleApproachTarget(attacker,b,v,attackingSide,defender=null){
 const shield=planDribbleShield(attacker,defender,b,v,attackingSide);
 if(shield)return shield.target;
 const dir=attackingSide==='home'?1:-1;
 const gap=Math.hypot(b.x-attacker.x,b.y-attacker.y);
 const lead=clamp(gap/12,0,0.20);
 const speed=Math.hypot(v.x,v.y);
 const ux=speed>0.35&&v.x*dir>0.15?v.x/speed:dir;
 const uy=speed>0.35&&v.x*dir>0.15?v.y/speed:0;
 return Object.freeze({x:clamp(b.x+v.x*lead-0.30*ux,-51.99,51.99),
  y:clamp(b.y+v.y*lead-0.30*uy,-33.49,33.49)});
}

// D-03: protect a reachable ball from close side/rear pressure. The
// target is only intent; the existing mover and Rapier contacts decide
// whether the player can actually get his body between opponent and ball.
export function planDribbleShield(attacker,defender,b,v,attackingSide){
 if(!['home','away'].includes(attackingSide)||!attacker||!defender||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,v?.x,v?.y].every(Number.isFinite))return null;
 const dir=attackingSide==='home'?1:-1;
 const dx=defender.x-b.x,dy=defender.y-b.y,pressureGap=Math.hypot(dx,dy);
 const ballGap=Math.hypot(attacker.x-b.x,attacker.y-b.y);
 // Do not turn an open forward lane or a lost ball into shielding.
 if(pressureGap<0.15||pressureGap>1.8||ballGap>0.9||
    dir*dx>0.65||Math.hypot(v.x,v.y)>3.5)return null;
 const ux=dx/pressureGap,uy=dy/pressureGap;
 return Object.freeze({target:Object.freeze({x:clamp(b.x+0.36*ux,-51.99,51.99),y:clamp(b.y+0.36*uy,-33.49,33.49)}),
  away:Object.freeze({x:-ux,y:-uy}),pressureGap,ballGap});
}
// Observe actual body-between-ball geometry, not successful possession.
export function observeDribbleShield(attacker,defender,b){
 const dx=defender.x-b.x,dy=defender.y-b.y,gap=Math.hypot(dx,dy);
 if(gap<0.15||gap>1.8)return false;
 const ax=attacker.x-b.x,ay=attacker.y-b.y;
 const along=(ax*dx+ay*dy)/gap,across=Math.abs(ax*dy-ay*dx)/gap;
 return along>=0.12&&along<=Math.min(0.85,gap-0.12)&&across<=0.30&&Math.hypot(ax,ay)<=0.85;
}
// A retained touch must follow an actual shielding sample and actual
// pressure, with no intervening defender ball contact. No inferred win.
export function createDribbleShieldObserver(side){
 const ids=[side+'-10',opposite(side)+'-2'];
 let samples=0,retainedTouches=0,priorShieldTick=null,latest=null,lastCarrier=null;
 return Object.freeze({observe({tick,players,ball,starts,bodyStarts,action,carrierId=ids[0]}){
  const attackerId=ids.includes(carrierId)?carrierId:ids[0],defenderId=ids.find(id=>id!==attackerId);
  if(lastCarrier!==attackerId)priorShieldTick=null;
  lastCarrier=attackerId;
  const attacker=players.find(p=>p.id===attackerId),defender=players.find(p=>p.id===defenderId);
  const shielding=observeDribbleShield(attacker,defender,ball.position);
  const opponentContact=starts.includes(defenderId)||bodyStarts.includes(defenderId);
  if(opponentContact||priorShieldTick!==null&&tick-priorShieldTick>60)priorShieldTick=null;
  let retained=false;
  if(priorShieldTick!==null&&tick>priorShieldTick&&!opponentContact&&
     starts.length===1&&starts[0]===attackerId&&action?.tick===tick&&
     action.playerId===attackerId&&action.action==='carry'&&action.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true){
   retained=true;retainedTouches++;priorShieldTick=null;
  }
  if(shielding){samples++;if(!opponentContact&&!retained)priorShieldTick=tick;}
  latest=Object.freeze({tick,actorId:attackerId,shielding,samples,retained,retainedTouches,opponentContact,officialPossession:false,shieldingOutcomeProven:false});
  return latest;
 }});
}

// D-04: defensive movement in the active 1v1 only. Read the current
// carrier/ball separation and rolling trajectory, contain a controlled
// ball from the goal side, close a loose ball, recover when bypassed.
// These are movement intents, not tackles or possession decisions.
export function planDribbleDefender({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}={}){
 if(!isOpposingDuelPair(attackingSide,attacker,defender)||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,v?.x,v?.y].every(Number.isFinite))
  throw new TypeError('Original 1v1 actors and live ball required');
 const dir=attackingSide==='home'?1:-1;
 const gap=Math.hypot(defender.x-b.x,defender.y-b.y);
 const carrierGap=Math.hypot(attacker.x-b.x,attacker.y-b.y);
 const goalSide=dir*(defender.x-b.x);
 const lead=clamp(gap/12,0,0.35);
 const bx=clamp(b.x+v.x*lead,-51.99,51.99),by=clamp(b.y+v.y*lead,-33.49,33.49);
 const exposed=carrierGap<=1.15&&gap<=1.8&&goalSide>=-0.55&&
  !observeDribbleShield(attacker,defender,b)&&Math.hypot(v.x,v.y)<=3.5;
 const mode=carrierGap>1.15||exposed?'press':goalSide< -0.55?'recover':gap>3.2?'press':'contain';
 // In a controlled duel, block the goal-facing route instead of chasing
 // an arbitrary side. A loose ball may be attacked directly.
 const goalDx=dir*52.5-bx,goalDy=-by,goalDistance=Math.max(0.01,Math.hypot(goalDx,goalDy));
 const standOff=mode==='recover'?1.35:mode==='contain'?1.15:carrierGap>1.15||exposed?0.22:0.85;
 const target=Object.freeze({x:clamp(bx+standOff*goalDx/goalDistance,-51.99,51.99),
  y:clamp(by+standOff*goalDy/goalDistance,-33.49,33.49)});
 return Object.freeze({mode,target,carrierGapM:carrierGap,defenderGapM:gap,goalSideM:goalSide,
  decisionOnly:true,officialPossession:false});
}

// D-09a: choose a short open ball route beside the tackler, rather
// than kicking straight through the old carrier or into the tackler's body.
// Score only current geometry. The actual impulse is still native and
// bounded, and either player can reach the real ball afterwards.
export const STANDING_TACKLE_TARGET_SPEED_MPS=2.8;
export const SLIDING_TACKLE_TARGET_SPEED_MPS=6.5;
export const SLIDING_TACKLE_MAX_IMPULSE_NS=3.2;
export function planDefensiveBallRelease(attacker,defender,b,attackingSide,{sliding=false}={}){
 const dir=attackingSide==='home'?1:-1;
 const da=Math.hypot(defender.x-attacker.x,defender.y-attacker.y);
 if(da<0.15)return null;
 const ax=(defender.x-attacker.x)/da,ay=(defender.y-attacker.y)/da;
 const tx=-dir*ay,ty=dir*ax;
 const candidates=[];
 const distance=sliding?2.4:1.05;
 for(const sign of [1,-1])for(const along of [0,0.28,0.35,0.50,-0.20]){
  const norm=Math.hypot(along,1),ux=(ax*along+tx*sign)/norm,uy=(ay*along+ty*sign)/norm;
  const end={x:b.x+ux*distance,y:b.y+uy*distance};
  if(Math.abs(end.x)>51.95||Math.abs(end.y)>33.35)continue;
  const gap=(p,x,y)=>Math.hypot(p.x-x,p.y-y);
  const d=gap(defender,end.x,end.y),a=gap(attacker,end.x,end.y);
  const startD=gap(defender,b.x,b.y),startA=gap(attacker,b.x,b.y);
  let clearance=Infinity;
  // Reject a route that first travels deeper into either player.
  for(const t of [0.10,0.25,0.50,0.75,1]){
   const x=b.x+ux*distance*t,y=b.y+uy*distance*t;
   clearance=Math.min(clearance,gap(defender,x,y)-Math.min(startD,0.58),
    gap(attacker,x,y)-Math.min(startA,0.58));
  }
  // Do not select a direction that drives the ball deeper into a body.
  if(clearance< -0.03)continue;
  const advance=(a-startA);
  const score=2.5*(a-d)+1.8*clearance+0.5*advance-0.9*Math.abs(d-(sliding?2.1:0.95));
  candidates.push({ux,uy,end,d,a,clearance,score});
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>b.score-a.score);
 const best=candidates[0];
 return Object.freeze({target:Object.freeze(best.end),ux:best.ux,uy:best.uy,
  projectedTacklerGapM:best.d,projectedOpponentGapM:best.a,
  pathClearanceGainM:best.clearance,decisionOnly:true});
}

// Pursue the released ball from the player's actual approach side.
// Do not aim a recovery runner behind the opponent's body just because
// that is the normal attacking direction.
export function planDuelRecoveryApproach(player,b,v){
 const gap=Math.hypot(b.x-player.x,b.y-player.y),lead=clamp(gap/7,0.08,0.28);
 const x=b.x+v.x*lead,y=b.y+v.y*lead;
 const dx=x-player.x,dy=y-player.y,d=Math.hypot(dx,dy);
 return Object.freeze({x:clamp(x-(d>0.05?dx/d:0)*0.20,-51.99,51.99),
  y:clamp(y-(d>0.05?dy/d:0)*0.20,-33.49,33.49)});
}

// D-09b: avoid steering through a real opponent after the ball changes side.
// Only a waypoint is returned; the canonical mover owns collision rejection.
const duelBound=(x,y)=>Object.freeze({x:clamp(x,-51.99,51.99),y:clamp(y,-33.49,33.49)});
function segmentGap(start,end,other){
 const dx=end.x-start.x,dy=end.y-start.y,den=dx*dx+dy*dy;
 const t=den>1e-10?clamp(((other.x-start.x)*dx+(other.y-start.y)*dy)/den,0,1):0;
 return Math.hypot(start.x+dx*t-other.x,start.y+dy*t-other.y);
}
export function routeDuelAroundOpponent(player,opponent,target){
 const gap=Math.hypot(player.x-opponent.x,player.y-opponent.y);
 const travel=Math.hypot(target.x-player.x,target.y-player.y);
 const originalClearance=segmentGap(player,target,opponent);
 if(gap<0.05||travel<0.10||originalClearance>=Math.min(gap,1.05)-0.02)
  return Object.freeze({target,detour:false,clearanceM:originalClearance});
 const ux=(player.x-opponent.x)/gap,uy=(player.y-opponent.y)/gap;
 const choices=[1,-1].map(sign=>{
  const waypoint=duelBound(opponent.x+1.12*ux-0.80*sign*uy,opponent.y+1.12*uy+0.80*sign*ux);
  const clearance=segmentGap(player,waypoint,opponent);
  return {waypoint,clearance,score:Math.hypot(waypoint.x-target.x,waypoint.y-target.y)
   +0.25*Math.hypot(waypoint.x-player.x,waypoint.y-player.y)};
 }).filter(x=>x.clearance>=Math.min(gap,1.05)-0.02&&Math.hypot(x.waypoint.x-player.x,x.waypoint.y-player.y)>0.10);
 choices.sort((a,b)=>a.score-b.score);
 const best=choices[0];
 return best?Object.freeze({target:best.waypoint,detour:true,clearanceM:best.clearance}):
  Object.freeze({target,detour:false,clearanceM:originalClearance});
}

// Separate approach lanes after a contact. If the recovering actor can
// reach the ball at least as soon as his rival, the rival takes a distinct
// pressing/containment stance instead of aiming at the same foot space.
// A rival with a better route remains free to contest the actual ball.
export function planDuelPostContactAlignment({attacker,defender,attackingSide,candidateId,ballPosition:b,ballVelocity:v}){
 const first=candidateId===attacker.id?planDuelRecoveryApproach(attacker,b,v):
  directedDribbleApproachTarget(attacker,b,v,attackingSide,defender);
 const defense=planDribbleDefender({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v});
 let second=defense.target;
 const ag=Math.hypot(attacker.x-b.x,attacker.y-b.y),dg=Math.hypot(defender.x-b.x,defender.y-b.y);
 if(dg>=ag-0.20&&Math.hypot(first.x-second.x,first.y-second.y)<1.12){
  const dx=defender.x-first.x,dy=defender.y-first.y,d=Math.hypot(dx,dy);
  const ux=d>0.05?dx/d:attackingSide==='home'?1:-1,uy=d>0.05?dy/d:0;
  second=duelBound(first.x+ux*1.12,first.y+uy*1.12);
 }
 const a=routeDuelAroundOpponent(attacker,defender,first);
 const d=routeDuelAroundOpponent(defender,attacker,second);
 return Object.freeze({[attacker.id]:a,[defender.id]:d});
}

// D-05: grounded defensive intent, authorized only by the existing
// exclusive native shoe START gate. No automatic turnover.
export function chooseDribbleDefensiveTouch({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v,sliding=false}={}){
 if(!isOpposingDuelPair(attackingSide,attacker,defender)||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,b?.z,v?.x,v?.y,v?.z].every(Number.isFinite))return null;
 const dir=attackingSide==='home'?1:-1;
 const gap=Math.hypot(defender.x-b.x,defender.y-b.y),carrierGap=Math.hypot(attacker.x-b.x,attacker.y-b.y);
 const speed=Math.hypot(v.x,v.y);
 if(gap>0.85||b.z<0.095||b.z>0.23||speed>8||observeDribbleShield(attacker,defender,b))return null;
 const incoming=dir*v.x>0.7&&(defender.x-b.x)*v.x+(defender.y-b.y)*v.y>=-0.10;
 const kind=carrierGap>1.15&&incoming?'interception':carrierGap<=1.15?'tackle':null;
 if(!kind)return null;
 const slidingStrike=sliding&&kind==='tackle';
 const release=planDefensiveBallRelease(attacker,defender,b,attackingSide,{sliding:slidingStrike});
 if(!release)return null;
 const desiredSpeed=kind==='interception'?2.4:slidingStrike?SLIDING_TACKLE_TARGET_SPEED_MPS:STANDING_TACKLE_TARGET_SPEED_MPS;
 const desiredX=release.ux*desiredSpeed,desiredY=release.uy*desiredSpeed;
 const dx=desiredX-v.x,dy=desiredY-v.y;
 const magnitudeNs=Math.min(slidingStrike?SLIDING_TACKLE_MAX_IMPULSE_NS:1.25,0.43*Math.hypot(dx,dy));
 if(magnitudeNs<0.025)return null;
 return Object.freeze({version:'me-628-duel-defensive-touch-v1',kind,dx,dy,magnitudeNs,
  actorId:defender.id,opponentId:attacker.id,carrierGapM:carrierGap,defenderGapM:gap,
  release,slidingStrike,desiredVelocity:Object.freeze({x:desiredX,y:desiredY}),
  nativeExclusiveShoeRequired:true,physicalAttemptOnly:true,tackleWon:false,interceptionConfirmed:false,officialPossession:false});
}

// Observe the post-impulse Rapier trajectory, not a promised success.
// A useful deflection opens an attainable lane away from the opponent.
export function observeEffectiveDuelIntervention(actor,rival,b,v){
 if(!actor||!rival||![actor.x,actor.y,rival.x,rival.y,b?.x,b?.y,v?.x,v?.y].every(Number.isFinite))return false;
 const speed=Math.hypot(v.x,v.y),dt=0.22;
 if(speed<0.65||speed>9)return false;
 const x=b.x+dt*v.x,y=b.y+dt*v.y;
 if(Math.abs(x)>52.39||Math.abs(y)>33.89)return false;
 const a=Math.hypot(x-actor.x,y-actor.y),r=Math.hypot(x-rival.x,y-rival.y);
 return a<=2.35&&a<=r+0.15&&r-Math.hypot(b.x-rival.x,b.y-rival.y)>=0.10;
}

// A contact can nominate a recovery candidate; only an authenticated
// carry changes the carrier used for tactical decisions, never official possession.
// D-11: enter the carrier's lateral running lane, not his back.
// This is only a movement proposal. Actual torso contact is reported
// separately by the original Rapier solver, without a ball impulse.
export function planDuelShoulderApproach({attacker,defender,attackingSide,ballPosition:b,ballVelocity:v}){
 if(!isOpposingDuelPair(attackingSide,attacker,defender)||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,v?.x,v?.y].every(Number.isFinite))return null;
 if(Math.hypot(attacker.x-b.x,attacker.y-b.y)>1.35)return null;
 const dir=attackingSide==='home'?1:-1;
 const speed=Math.hypot(attacker.vx??0,attacker.vy??0);
 const ux=speed>0.55?attacker.vx/speed:dir,uy=speed>0.55?attacker.vy/speed:0;
 const rx=defender.x-attacker.x,ry=defender.y-attacker.y;
 const along=rx*ux+ry*uy,across=-rx*uy+ry*ux;
 const side=Math.abs(across)>0.10?Math.sign(across):b.y>0?-1:1;
 const gap=Math.hypot(rx,ry);
 // Do not abandon normal defending in order to manufacture an overlap.
 // Only maintain an already adjacent running lane; otherwise fall back
 // to the ordinary goal-side/loose-ball positioning.
 if(Math.abs(along)>0.80||Math.abs(across)<0.70||gap>1.50)return null;
 const defenderSpeed=Math.hypot(defender.vx??0,defender.vy??0);
 const parallel=defenderSpeed>0.25&&((defender.vx??0)*ux+(defender.vy??0)*uy)/defenderSpeed>=0.55;
 const sideOn=speed>=0.55&&parallel&&Math.abs(along)<=0.55&&Math.abs(across)>=0.78&&gap<=1.28;
 // Close on a shoulder-width lateral waypoint and then run alongside.
 // A finite predicted point follows the carrier instead of aiming through him.
 const offset=sideOn?0.99:1.10,lead=clamp(0.32+speed*0.18,0.32,0.85);
 const target=duelBound(attacker.x+ux*lead-uy*side*offset,
  attacker.y+uy*lead+ux*side*offset);
 const route=routeDuelAroundOpponent(defender,attacker,target);
 if(route.detour)return null;
 return Object.freeze({actorId:defender.id,opponentId:attacker.id,target:route.target,
  sideOn,parallel,forward:Object.freeze({x:ux,y:uy}),away:Object.freeze({x:uy*side,y:-ux*side}),
  detour:route.detour,alongM:along,acrossM:across,decisionOnly:true});
}
// A challenge is observed only from an actual native opposing torso
// solver pair and a playable-ball, side-on approach. No invented impact.
export const SHOULDER_DISPLACE_TICKS=12;
export const SHOULDER_BALANCE_TICKS=30;
export const SHOULDER_COLLECTION_TICKS=60;
export function observeNativeShoulderChallenge({tick,plan,players,ball,torsoPairs,bodies=[]}){
 if(!plan||!Array.isArray(torsoPairs)||!torsoPairs.includes([plan.actorId,plan.opponentId].sort().join('|')))return null;
 const actor=players.find(p=>p.id===plan.actorId),rival=players.find(p=>p.id===plan.opponentId);
 if(!actor||!rival||!plan.sideOn||Math.hypot(rival.x-ball.x,rival.y-ball.y)>1.35||
    Math.hypot(actor.x-ball.x,actor.y-ball.y)>1.9)return null;
 const body=bodies.find(p=>p.id===rival.id);
 const {forward,away}=plan;
 const before=forward&&Number.isFinite(rival.vx)&&Number.isFinite(rival.vy)?
  rival.vx*forward.x+rival.vy*forward.y:0;
 const dvx=(body?.velocity?.x??rival.vx)-rival.vx,dvy=(body?.velocity?.y??rival.vy)-rival.vy;
 const lateralResponseMps=away&&Number.isFinite(dvx)&&Number.isFinite(dvy)?dvx*away.x+dvy*away.y:0;
 const forwardLossMps=forward&&Number.isFinite(dvx)&&Number.isFinite(dvy)?-(dvx*forward.x+dvy*forward.y):0;
 // Only measurable native lateral response qualifies for a short
 // balance reaction. A manifold by itself does not win a challenge.
 const successful=before>=0.45&&lateralResponseMps>=0.045;
 const balance=successful?Object.freeze({until:tick+SHOULDER_BALANCE_TICKS,
  forward,away,forwardSpeedMps:0.15,
  lateralSpeedMps:clamp(1.25+lateralResponseMps,1.35,1.85)}):null;
 return Object.freeze({tick,actorId:actor.id,opponentId:rival.id,
  source:'native-rapier-solver-manifold',physicalContact:true,ballImpulseCreated:false,
  lateralResponseMps,forwardLossMps,successful,balance,
  officialPossession:false,challengeWon:false});
}
// A bounded response to a confirmed physical shoulder impact. A movement
// target and speed cap only; the original mover and body guard decide XY.
export function planShoulderBalanceRecovery(player,state,tick){
 const impact=state?.lastShoulder,b=impact?.balance;
 if(!b||impact.opponentId!==player.id||tick<=impact.tick||tick>b.until)return null;
 const elapsed=tick-impact.tick;
 if(elapsed>SHOULDER_DISPLACE_TICKS)return Object.freeze({target:duelBound(player.x,player.y),maxSpeed:0.01,phase:'pause',movementOnly:true});
 const dt=0.22;
 return Object.freeze({target:duelBound(player.x+dt*(b.forward.x*b.forwardSpeedMps+b.away.x*b.lateralSpeedMps),
  player.y+dt*(b.forward.y*b.forwardSpeedMps+b.away.y*b.lateralSpeedMps)),
  maxSpeed:Math.hypot(b.forwardSpeedMps,b.lateralSpeedMps),phase:'displace',movementOnly:true});
}
// A successful shoulder impact opens a real collection opportunity, not a
// possession grant. It ends on the first authenticated carry or deadline.
export function isShoulderCollecting(state,id,tick){
 const impact=state?.lastShoulder;
 return impact?.successful===true&&impact.actorId===id&&state.candidateId===id&&
  tick>impact.tick&&tick<=impact.tick+SHOULDER_COLLECTION_TICKS;
}
// D-12: read the live rolling trajectory, not an opponent contact.
// The predicted point is a movement decision; only an actual exclusive
// shoe START can authorize the interception touch.
export function planDuelInterception({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}){
 if(!isOpposingDuelPair(attackingSide,attacker,defender)||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,v?.x,v?.y].every(Number.isFinite))return null;
 const speed=Math.hypot(v.x,v.y),dir=attackingSide==='home'?1:-1;
 if(speed<0.70||speed>14||v.x*dir<0.45||Math.hypot(attacker.x-b.x,attacker.y-b.y)<=1.15)return null;
 const ux=v.x/speed,uy=v.y/speed;
 if((defender.x-b.x)*ux+(defender.y-b.y)*uy< -0.65)return null;
 let best=null;
 for(let i=1;i<=10;i++){
  const eta=i*0.08,travel=Math.max(0,speed*eta-0.45*eta*eta);
  const point=duelBound(b.x+ux*travel,b.y+uy*travel);
  const dx=point.x-defender.x,dy=point.y-defender.y,d=Math.hypot(dx,dy);
  const approach=Math.max(0,d>0.05?((defender.vx??0)*dx+(defender.vy??0)*dy)/d:0);
  const reachable=0.48+Math.min(6.5*eta,approach*eta+4.5*eta*eta);
  const target=duelBound(point.x-(d>0.05?dx/d:0)*0.24,point.y-(d>0.05?dy/d:0)*0.24);
  const rivalGap=Math.hypot(point.x-attacker.x,point.y-attacker.y);
  const candidate={actorId:defender.id,opponentId:attacker.id,target,point,etaS:eta,
   reachable:d<=reachable&&rivalGap>=d+0.20,decisionOnly:true};
  if(candidate.reachable)return Object.freeze(candidate);
  const score=Math.max(0,d-reachable)+eta*0.30;
  if(!best||score<best.score)best={candidate,score};
 }
 return best?Object.freeze(best.candidate):null;
}
export function chooseDuelInterceptionTouch({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}){
 if(!isOpposingDuelPair(attackingSide,attacker,defender)||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,b?.z,v?.x,v?.y].every(Number.isFinite))return null;
 const speed=Math.hypot(v.x,v.y),dir=attackingSide==='home'?1:-1;
 const gap=Math.hypot(defender.x-b.x,defender.y-b.y),rivalGap=Math.hypot(attacker.x-b.x,attacker.y-b.y);
 if(gap>0.85||rivalGap<=1.15||b.z<0.095||b.z>0.23||speed<0.70||speed>8||v.x*dir<0.45||
    ((defender.x-b.x)*v.x+(defender.y-b.y)*v.y)/speed< -0.55)return null;
 const release=planDefensiveBallRelease(attacker,defender,b,attackingSide);
 if(!release)return null;
 const desiredVelocity=Object.freeze({x:release.ux*1.6,y:release.uy*1.6});
 const dx=desiredVelocity.x-v.x,dy=desiredVelocity.y-v.y,magnitudeNs=Math.min(2.2,0.43*Math.hypot(dx,dy));
 if(magnitudeNs<0.025)return null;
 return Object.freeze({version:'me-628-interception-cushion-v1',kind:'interception',actorId:defender.id,opponentId:attacker.id,
  dx,dy,magnitudeNs,carrierGapM:rivalGap,defenderGapM:gap,release,desiredVelocity,
  nativeExclusiveShoeRequired:true,physicalAttemptOnly:true,interceptionConfirmed:false,officialPossession:false});
}
export const DUEL_TACKLE_PROFILES=Object.freeze(['mixed','standing','sliding','shoulder','interception']);
export const SLIDING_GET_UP_TACKLER_TICKS=30;
export const SLIDING_GET_UP_RIVAL_TICKS=36;
export function isSlideCollecting(state,id,tick){
 const impact=state?.lastIntervention;
 return impact?.effective===true&&impact.intervention==='sliding-tackle'&&impact.actorId===id&&state.candidateId===id&&
  tick>impact.tick&&tick<=impact.tick+SLIDING_GET_UP_RIVAL_TICKS+60;
}
export function isDuelGettingUp(state,id,tick){
 return Number.isSafeInteger(state?.getUpUntil?.[id])&&tick<=state.getUpUntil[id];
}
export function createDribbleTransitionObserver(side,profile='mixed'){
 if(!['home','away'].includes(side)||!DUEL_TACKLE_PROFILES.includes(profile))throw new TypeError('Original duel side and tackle profile required');
 const first=side+'-10',second=opposite(side)+'-2',ids=[first,second];
 let carrierId=first,candidateId=null,candidateTick=null,sourceTick=null,lastIntervention=null,recoveries=0,regains=0,changes=0;
 let getUpUntil=Object.freeze({}),lastShoulder=null,shoulderContacts=0,priorShoulderPair=null;
 let latest=Object.freeze({tick:0,profile,phase:'attack',carrierId,candidateId,sourceTick,lastIntervention,getUpUntil,lastShoulder,shoulderContacts,recoveries,regains,changes,recovered:false,regained:false,officialPossession:false});
 function observe({tick,starts,active,bodyStarts,bodyActive,action,ball,players=[],shoulderPlan=null,torsoPairs=[],bodies=[]}){
  if(tick!==latest.tick+1)throw new TypeError('Same original physics tick required');
  let recovered=false,regained=false;
  const touching=ids.filter(id=>active.includes(id)||bodyActive.includes(id));
  const started=ids.filter(id=>starts.includes(id)||bodyStarts.includes(id));
  const inField=Math.abs(ball.position.x)<52.39&&Math.abs(ball.position.y)<33.89;
  const real=action?.tick===tick&&ids.includes(action.playerId)&&
    starts.length===1&&starts[0]===action.playerId&&active.length===1&&active[0]===action.playerId&&
    action.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true&&touching.length===1;
  if(!inField||candidateId!==null&&tick-candidateTick>120){
   candidateId=null;candidateTick=null;
  }
  if(inField&&real&&['tackle','interception'].includes(action.action)){
   const actor=players.find(p=>p.id===action.playerId),rival=players.find(p=>ids.includes(p.id)&&p.id!==action.playerId);
   const effective=observeEffectiveDuelIntervention(actor,rival,ball.position,ball.velocity);
   lastIntervention=Object.freeze({tick,actorId:action.playerId,intervention:action.defensiveTarget?.intervention??action.action,effective});
   // Both the dedicated and mixed LABs use the same contested-slide recovery.
   // Trigger exclusively from the actual native strike, not slide intent.
   // This is a temporary movement/action lock, not an inferred foul or injury.
   if((profile==='sliding'||profile==='mixed')&&lastIntervention.intervention==='sliding-tackle'){
    const other=ids.find(id=>id!==action.playerId);
    getUpUntil=Object.freeze({[action.playerId]:tick+SLIDING_GET_UP_TACKLER_TICKS,[other]:tick+SLIDING_GET_UP_RIVAL_TICKS});
   }
   if(action.playerId!==carrierId){candidateId=action.playerId;candidateTick=tick;}
  }
  if(inField&&real&&action.action==='carry'){
   if(action.playerId!==carrierId){
    carrierId=action.playerId;changes++;sourceTick=tick;
    recovered=carrierId===second;regained=carrierId===first;
    if(recovered)recoveries++;if(regained)regains++;
   }
   candidateId=null;candidateTick=null;
  }else if(inField&&touching.length===1&&started.includes(touching[0])){
   if(touching[0]!==carrierId){candidateId=touching[0];candidateTick=tick;}
   else if(!(lastIntervention?.effective&&lastIntervention.actorId===candidateId&&tick-lastIntervention.tick<=(lastIntervention.intervention==='sliding-tackle'?SLIDING_GET_UP_RIVAL_TICKS+60:24))&&
     !(lastShoulder?.successful&&lastShoulder.actorId===candidateId&&tick-lastShoulder.tick<=SHOULDER_COLLECTION_TICKS)){
    candidateId=null;candidateTick=null;
   }
  }
  const shoulder=['shoulder','mixed'].includes(profile)&&inField?observeNativeShoulderChallenge({tick,plan:shoulderPlan,players,ball:ball.position,torsoPairs,bodies}):null;
  const shoulderPair=shoulder?[shoulder.actorId,shoulder.opponentId].sort().join('|'):null;
  const shoulderWindow=lastShoulder?.successful&&tick<=lastShoulder.tick+SHOULDER_COLLECTION_TICKS;
  if(shoulder&&shoulderPair!==priorShoulderPair){
   shoulderContacts++;
   if(!shoulderWindow)lastShoulder=shoulder;
  }else if(shoulder?.successful&&!lastShoulder?.successful&&shoulderPair===priorShoulderPair&&!shoulderWindow){lastShoulder=shoulder;}
  if(lastShoulder?.tick===tick&&lastShoulder.successful&&lastShoulder.actorId!==carrierId){
   candidateId=lastShoulder.actorId;candidateTick=tick;
  }
  if(lastShoulder?.successful&&candidateId===lastShoulder.actorId&&tick-lastShoulder.tick>SHOULDER_COLLECTION_TICKS){candidateId=null;candidateTick=null;}
  priorShoulderPair=shoulderPair;
  const phase=candidateId!==null?'recover':carrierId===first?'attack':'counter';
  latest=Object.freeze({tick,profile,phase,carrierId,candidateId,sourceTick,lastIntervention,getUpUntil,lastShoulder,shoulderContacts,recoveries,regains,changes,recovered,regained,officialPossession:false});
  return latest;
 }
 return Object.freeze({observe,snapshot:()=>latest});
}
// Same contact decision for both actors. Loose ball may be collected.
export function chooseSharedDuelTouch({player,opponent,ballPosition:b,ballVelocity:v,transition,slide,defensiveDecision=null,variantIndex,tick}){
 if(!isOpposingDuelPair(player?.team,player,opponent))throw new TypeError('Opposing physical actors required');
 if(slide?.phase==='recovery'||isDuelGettingUp(transition,player.id,tick)||planShoulderBalanceRecovery(player,transition,tick))return null;
 const opponentGap=Math.hypot(opponent.x-b.x,opponent.y-b.y);
 const shielded=observeDribbleShield(opponent,player,b);
 const current=transition?.carrierId===player.id;
 const collecting=transition?.candidateId===player.id;
 const collectingRelease=collecting&&transition?.lastIntervention?.actorId===player.id&&transition.lastIntervention.effective&&tick-transition.lastIntervention.tick<=90;
 const shoulderCollection=isShoulderCollecting(transition,player.id,tick);
 const slideCollection=isSlideCollecting(transition,player.id,tick);
 const canCarry=!shielded&&Math.hypot(v.x,v.y)<=(collectingRelease||shoulderCollection||slideCollection?7.5:5);
 const defensive=(sliding=false)=>chooseDribbleDefensiveTouch({attackingSide:opponent.team,attacker:opponent,defender:player,ballPosition:b,ballVelocity:v,sliding});
 const carry=()=>chooseDirectedDribbleTouch({attackingSide:player.team,attacker:player,defender:opponent,
  ballPosition:b,ballVelocity:v,variantIndex,tick});
 if(slide?.phase==='slide'){const touch=defensive(true);return touch?{defensive:touch,carry:null}:null;}
 // Re-evaluate the real post-solver contact; a planned shoulder never
 // authorizes a kick and never overrides a legitimate collecting carrier.
 if(transition?.profile==='mixed'&&!current&&!collectingRelease&&!shoulderCollection&&!slideCollection){
  const touch=defensive();
  const shoulder=defensiveDecision?.kind==='shoulder-challenge'?planDuelShoulderApproach({attackingSide:opponent.team,attacker:opponent,defender:player,ballPosition:b,ballVelocity:v}):null;
  const chosen=selectDefensiveIntervention({actorId:player.id,shoulder,standing:touch,ballGapM:Math.hypot(player.x-b.x,player.y-b.y)});
  if(chosen.kind==='shoulder-challenge')return null;
  if(touch&&['standing-tackle','interception'].includes(chosen.kind))return {defensive:touch,carry:null};
 }
 if(transition?.profile==='interception'&&!current){
  const previous=transition.lastIntervention;
  if(!(collecting&&previous?.actorId===player.id&&previous.intervention==='interception'&&tick-previous.tick<=90)){
   const touch=chooseDuelInterceptionTouch({attackingSide:opponent.team,attacker:opponent,defender:player,ballPosition:b,ballVelocity:v});
   if(touch)return {defensive:touch,carry:null};
  }
 }
 if(transition?.profile==='mixed'&&collecting&&!current&&!collectingRelease&&!slideCollection&&opponentGap<=1.15){
  const touch=defensive();if(touch)return {defensive:touch,carry:null};
 }
 if((current||collecting)&&canCarry)return {defensive:null,carry:carry()};
 const touch=['sliding','shoulder','interception'].includes(transition?.profile)?null:defensive();
 if(touch)return {defensive:touch,carry:null};
 if(opponentGap>1.15&&canCarry)return {defensive:null,carry:carry()};
 return null;
}
export function chooseDribbleRecoveryTouch({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}={}){
 if(!isOpposingDuelPair(attackingSide,attacker,defender)||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,b?.z,v?.x,v?.y,v?.z].every(Number.isFinite))return null;
 if(Math.hypot(defender.x-b.x,defender.y-b.y)>0.85||b.z<0.095||b.z>0.23||Math.hypot(v.x,v.y)>5||
    observeDribbleShield(attacker,defender,b))return null;
 const dir=attackingSide==='home'?-1:1;
 const dx=dir*2.2-v.x,dy=clamp((b.y-attacker.y)*0.6,-0.7,0.7)-v.y;
 const magnitudeNs=Math.min(0.30,0.43*Math.hypot(dx,dy));
 if(magnitudeNs<0.025)return null;
 return Object.freeze({version:'me-628-duel-recovery-touch-v1',kind:'carry',dx,dy,magnitudeNs,
  actorId:defender.id,opponentId:attacker.id,physicalAttemptOnly:true,officialPossession:false});
}
export function planDribbleTransitionTarget(player,opponent,b,v,originalAttackingSide,phase){
 const defenderSide=originalAttackingSide==='home'?'away':'home';
 if(!['recover','counter'].includes(phase))return null;
 if(player.id===defenderSide+'-2')
  return directedDribbleApproachTarget(player,b,v,defenderSide,opponent);
 const dir=originalAttackingSide==='home'?1:-1;
 const lead=clamp(Math.hypot(player.x-b.x,player.y-b.y)/12,0,0.30);
 const offset=phase==='counter'?0.75:0.22;
 return Object.freeze({x:clamp(b.x+v.x*lead-dir*offset,-51.99,51.99),
  y:clamp(b.y+v.y*lead,-33.49,33.49)});
}

// D-07: finite movement-only release from an observed stationary duel.
// The challenger gives space while the closer/last-touch-side actor
// approaches the rolling ball from an offset. No displacement or kick.
export function planDribbleContactRelease({attackingSide,attacker,defender,ball,phase='attack',variantIndex=0}={}){
 if(!['home','away'].includes(attackingSide)||!attacker||!defender||
    ![attacker.x,attacker.y,defender.x,defender.y,ball?.x,ball?.y].every(Number.isFinite))
  throw new TypeError('Original duel geometry required');
 const dir=attackingSide==='home'?1:-1;
 const ag=Math.hypot(attacker.x-ball.x,attacker.y-ball.y),dg=Math.hypot(defender.x-ball.x,defender.y-ball.y);
 const defenderFirst=phase==='counter'||(phase==='recover'&&dg<=ag+0.2)||dg+0.4<ag;
 const primary=defenderFirst?defender:attacker,other=defenderFirst?attacker:defender;
 const forward=defenderFirst?-dir:dir;
 const dx=other.x-primary.x,dy=other.y-primary.y,gap=Math.max(0.01,Math.hypot(dx,dy));
 // Choose an outward route based on actual relative position, stable
 // for the entire release. At a touchline favour the inside.
 const side=Math.abs(ball.y)>30?-Math.sign(ball.y):Math.abs(dy)>0.12?-Math.sign(dy):variantIndex%2===0?1:-1;
 const bound=(x,y)=>Object.freeze({x:clamp(x,-51.99,51.99),y:clamp(y,-33.49,33.49)});
 // First both back out along their actual separation axis. The player
 // pursuing the ball then gets a distinct re-approach; the challenger
 // waits outside the immediate contact corridor for this brief manoeuvre.
 const primaryTarget=bound(primary.x-0.65*dx/gap,primary.y-0.65*dy/gap+side*0.35);
 const otherTarget=bound(other.x+1.35*dx/gap,other.y+1.35*dy/gap-side*0.55);
 return Object.freeze({primaryId:primary.id,otherId:other.id,forward,side,
  targets:Object.freeze({[primary.id]:primaryTarget,[other.id]:otherTarget}),movementOnly:true});
}

// Re-approach the current ball after the release, never an obsolete fixed
// point beside it. Keep the foot within reach from the actual free side.
export function dribbleReleaseApproach(player,ball,release){
 const dx=ball.x-player.x,dy=ball.y-player.y,gap=Math.hypot(dx,dy);
 const ux=gap>0.05?dx/gap:release.forward,uy=gap>0.05?dy/gap:0;
 return Object.freeze({x:clamp(ball.x-0.20*ux,-51.99,51.99),
  y:clamp(ball.y-0.20*uy,-33.49,33.49)});
}
