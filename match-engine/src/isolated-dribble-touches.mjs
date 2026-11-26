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
 const attackerId=side+'-10',defenderId=(side==='home'?'away':'home')+'-2';
 let samples=0,retainedTouches=0,priorShieldTick=null,latest=null;
 return Object.freeze({observe({tick,players,ball,starts,bodyStarts,action}){
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
  latest=Object.freeze({tick,shielding,samples,retained,retainedTouches,opponentContact,officialPossession:false,shieldingOutcomeProven:false});
  return latest;
 }});
}

// D-04: defensive movement in the active 1v1 only. Read the current
// carrier/ball separation and rolling trajectory, contain a controlled
// ball from the goal side, close a loose ball, recover when bypassed.
// These are movement intents, not tackles or possession decisions.
export function planDribbleDefender({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}={}){
 if(!['home','away'].includes(attackingSide)||attacker?.id!==attackingSide+'-10'||
    defender?.id!==(attackingSide==='home'?'away':'home')+'-2'||
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

// D-05: grounded defensive intent, authorized only by the existing
// exclusive native shoe START gate. No automatic turnover.
export function chooseDribbleDefensiveTouch({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}={}){
 if(!['home','away'].includes(attackingSide)||attacker?.id!==attackingSide+'-10'||
    defender?.id!==(attackingSide==='home'?'away':'home')+'-2'||
    ![attacker.x,attacker.y,defender.x,defender.y,b?.x,b?.y,b?.z,v?.x,v?.y,v?.z].every(Number.isFinite))return null;
 const dir=attackingSide==='home'?1:-1;
 const gap=Math.hypot(defender.x-b.x,defender.y-b.y),carrierGap=Math.hypot(attacker.x-b.x,attacker.y-b.y);
 const speed=Math.hypot(v.x,v.y);
 if(gap>0.85||b.z<0.095||b.z>0.23||speed>8||observeDribbleShield(attacker,defender,b))return null;
 const incoming=dir*v.x>0.7&&(defender.x-b.x)*v.x+(defender.y-b.y)*v.y>=-0.10;
 const kind=carrierGap>1.15&&incoming?'interception':carrierGap<=1.15?'tackle':null;
 if(!kind)return null;
 const desiredX=-dir*(kind==='interception'?2.3:1.8);
 const desiredY=clamp((b.y-attacker.y)*1.2,-1.2,1.2);
 const dx=desiredX-v.x,dy=desiredY-v.y;
 const magnitudeNs=Math.min(1.25,0.43*Math.hypot(dx,dy));
 if(magnitudeNs<0.025)return null;
 return Object.freeze({version:'me-628-duel-defensive-touch-v1',kind,dx,dy,magnitudeNs,
  actorId:defender.id,opponentId:attacker.id,carrierGapM:carrierGap,defenderGapM:gap,
  nativeExclusiveShoeRequired:true,physicalAttemptOnly:true,tackleWon:false,interceptionConfirmed:false,officialPossession:false});
}

// D-06: native contacts open a recovery window, not possession.
export function createDribbleTransitionObserver(side){
 if(!['home','away'].includes(side))throw new TypeError('Original duel side required');
 const attackerId=side+'-10',defenderId=(side==='home'?'away':'home')+'-2';
 let phase='attack',sourceTick=null,lastDefenderTouch=null,recoveries=0,regains=0;
 let latest=Object.freeze({tick:0,phase,sourceTick,recoveries,regains,recovered:false,regained:false,officialPossession:false});
 function observe({tick,starts,active,bodyStarts,bodyActive,action,ball}){
  if(tick!==latest.tick+1)throw new TypeError('Same original physics tick required');
  let recovered=false,regained=false;
  const attackerContact=active.includes(attackerId)||bodyActive.includes(attackerId);
  const defenderContact=active.includes(defenderId)||bodyActive.includes(defenderId);
  const real=id=>action?.tick===tick&&action.playerId===id&&starts.length===1&&starts[0]===id&&
   active.length===1&&active[0]===id&&action.appliedByRapier===true&&action.actualPhysicsImpulseApplied===true;
  const defensiveStart=!attackerContact&&(starts.includes(defenderId)||bodyStarts.includes(defenderId));
  const inField=Math.abs(ball.position.x)<52.39&&Math.abs(ball.position.y)<33.89;
  if(!inField||attackerContact||phase!=='attack'&&tick-lastDefenderTouch>120){
   if(inField&&phase!=='attack'&&!defenderContact&&real(attackerId)&&action.action==='carry'){
    regained=true;regains++;
   }
   phase='attack';sourceTick=null;lastDefenderTouch=null;
  }else if(defensiveStart){
   if(phase==='attack'){
    phase='recover';sourceTick=tick;lastDefenderTouch=tick;
   }else{
    lastDefenderTouch=tick;
    if(tick>sourceTick&&real(defenderId)&&action.action==='carry'&&
       action.defensiveTarget?.version==='me-628-duel-recovery-touch-v1'&&phase==='recover'){
     phase='counter';recovered=true;recoveries++;
    }
   }
  }
  latest=Object.freeze({tick,phase,sourceTick,recoveries,regains,recovered,regained,officialPossession:false});
  return latest;
 }
 return Object.freeze({observe,snapshot:()=>latest});
}
export function chooseDribbleRecoveryTouch({attackingSide,attacker,defender,ballPosition:b,ballVelocity:v}={}){
 if(!['home','away'].includes(attackingSide)||attacker?.id!==attackingSide+'-10'||
    defender?.id!==(attackingSide==='home'?'away':'home')+'-2'||
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
 const primaryTarget=bound(ball.x-forward*0.35,ball.y+side*0.58);
 const otherTarget=bound(other.x+0.95*dx/gap,other.y+0.95*dy/gap-side*0.45);
 return Object.freeze({primaryId:primary.id,otherId:other.id,
  targets:Object.freeze({[primary.id]:primaryTarget,[other.id]:otherTarget}),movementOnly:true});
}
