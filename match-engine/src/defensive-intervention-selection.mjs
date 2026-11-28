import {attackDirection,validateAttackPolarity} from './match-directions.mjs';
import {createNativeFundamentalMask,nativeDefensiveInterventionAllowed} from './native-fundamental-mask.mjs';
// D-14: decision only. Candidate plans come from live canonical geometry;
// delivery state comes from the earlier real pass/shot in the same LAB.
// No shirt number, positional role, random outcome, impulse or possession.
export const DEFENSIVE_INTERVENTION_VERSION='me-628-contextual-defense-v1';
export function selectDefensiveIntervention({actorId,context='duel',unavailable=false,
 recovering=false,activeSlide=false,shoulder=null,standing=null,sliding=null,
 interception=null,block=null,ballGapM=Infinity,allowedFundamentals=null}={}){
 const mask=createNativeFundamentalMask(allowedFundamentals),permits=kind=>nativeDefensiveInterventionAllowed(mask,kind);
 if(typeof actorId!=='string'||!['duel','pass','shot'].includes(context))return null;
 const result=(kind,reason,plan=null)=>Object.freeze({version:DEFENSIVE_INTERVENTION_VERSION,
  actorId,kind,reason,plan,decisionOnly:true,physicalContactProven:false,officialPossession:false});
 if(unavailable)return result('none','movement-or-action-locked');
 if(activeSlide)return permits('sliding-tackle')?result('sliding-tackle','committed-slide',sliding):result('none','intervention-not-permitted');
 if(recovering)return result('recover','collect-real-loose-ball');
 if(context==='shot')return permits('block')&&block?result('block','observed-shot-lane',block):result('none','shot-outside-reachable-lane');
 if(context==='pass')return permits('interception')&&interception?result('interception','observed-pass-lane',interception):result('none','pass-outside-reachable-lane');
 if(permits('shoulder-challenge')&&shoulder?.sideOn&&shoulder.parallel)return result('shoulder-challenge','naturally-adjacent-parallel-run',shoulder);
 if(permits('standing-tackle')&&standing?.kind==='tackle'&&ballGapM<=0.70)return result('standing-tackle','exposed-ball-within-standing-reach',standing);
 if(permits('sliding-tackle')&&sliding)return result('sliding-tackle','reachable-ball-lunge',sliding);
 if(permits('standing-tackle')&&standing?.kind==='tackle')return result('standing-tackle','exposed-ball-within-shoe-reach',standing);
 if(permits('interception')&&(interception?.reachable||standing?.kind==='interception'))return result('interception','detached-inbound-ball',interception??standing);
 return result('none','hold-defensive-position');
}

// UME-04: a shot trajectory is an opportunity to block, never an observed
// block. Use the actual defending player, not a selected fixture shirt.
export function planNativeShotBlock({player,ball,velocity,attackPolarity=1}={}){
 validateAttackPolarity(attackPolarity);
 if(!player||player.role==='goalkeeper'||!['home','away'].includes(player.team)||
    ![player.x,player.y,ball?.x,ball?.y,velocity?.x,velocity?.y].every(Number.isFinite))return null;
 const dir=-attackDirection(player.team,attackPolarity);
 if(dir*velocity.x<=2)return null;
 const eta=(player.x-ball.x)/velocity.x;
 if(eta<0||eta>0.65)return null;
 const y=Math.max(-33.49,Math.min(33.49,ball.y+velocity.y*eta));
 const reachable=0.48+Math.min(6.5*eta,Math.abs(player.vy??0)*eta+4.5*eta*eta);
 if(Math.abs(y-player.y)>reachable)return null;
 return Object.freeze({actorId:player.id,target:Object.freeze({x:player.x,y}),etaS:eta,decisionOnly:true,officialPossession:false});
}

// UME-04C: observe a native trajectory change following a genuine shot.
// This read-only classifier does not award a save, possession or official
// result. Ambiguous simultaneous player contacts cannot identify a blocker.
export function observeNativeShotBlock({tick,delivery,players,starts=[],bodyStarts=[],before,after,attackPolarity=1}={}){
 validateAttackPolarity(attackPolarity);
 if(!Number.isSafeInteger(tick)||delivery?.kind!=='shot'||!Number.isSafeInteger(delivery.tick)||
    tick<=delivery.tick||tick-delivery.tick>180||!['home','away'].includes(delivery.team)||
    !Array.isArray(players)||!Array.isArray(starts)||!Array.isArray(bodyStarts)||
    ![before?.x,before?.y,before?.z,after?.x,after?.y,after?.z].every(Number.isFinite))return null;
 const contactIds=[...new Set([...starts,...bodyStarts])];
 if(contactIds.length!==1)return null;
 const actor=players.find(p=>p.id===contactIds[0]);
 if(!actor||actor.team===delivery.team||actor.role==='goalkeeper'||!['home','away'].includes(actor.team))return null;
 const pre=Math.hypot(before.x,before.y,before.z),post=Math.hypot(after.x,after.y,after.z);
 const change=Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z);
 const dir=attackDirection(delivery.team,attackPolarity);
 const incoming=pre>=0.6&&before.x*dir>0.25;
 const blocked=incoming&&change>=0.6&&(post<pre*0.85||
    before.x*after.x+before.y*after.y+before.z*after.z<pre*post*0.92);
 return Object.freeze({tick,shotTick:delivery.tick,contactTick:tick,actorId:actor.id,
  contactSource:bodyStarts.includes(actor.id)?'native-leg-solver':'native-shoe-start',
  incomingSpeedMps:pre,outgoingSpeedMps:post,velocityChangeMps:change,blocked,officialPossession:false});
}
