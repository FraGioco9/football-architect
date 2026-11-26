// D-14: decision only. Candidate plans come from live canonical geometry;
// delivery state comes from the earlier real pass/shot in the same LAB.
// No shirt number, positional role, random outcome, impulse or possession.
export const DEFENSIVE_INTERVENTION_VERSION='me-628-contextual-defense-v1';
export function selectDefensiveIntervention({actorId,context='duel',unavailable=false,
 recovering=false,activeSlide=false,shoulder=null,standing=null,sliding=null,
 interception=null,block=null,ballGapM=Infinity}={}){
 if(typeof actorId!=='string'||!['duel','pass','shot'].includes(context))return null;
 const result=(kind,reason,plan=null)=>Object.freeze({version:DEFENSIVE_INTERVENTION_VERSION,
  actorId,kind,reason,plan,decisionOnly:true,physicalContactProven:false,officialPossession:false});
 if(unavailable)return result('none','movement-or-action-locked');
 if(activeSlide)return result('sliding-tackle','committed-slide',sliding);
 if(recovering)return result('recover','collect-real-loose-ball');
 if(context==='shot')return block?result('block','observed-shot-lane',block):result('none','shot-outside-reachable-lane');
 if(context==='pass')return interception?result('interception','observed-pass-lane',interception):result('none','pass-outside-reachable-lane');
 if(shoulder?.sideOn&&shoulder.parallel)return result('shoulder-challenge','naturally-adjacent-parallel-run',shoulder);
 if(standing?.kind==='tackle'&&ballGapM<=0.70)return result('standing-tackle','exposed-ball-within-standing-reach',standing);
 if(sliding)return result('sliding-tackle','reachable-ball-lunge',sliding);
 if(standing?.kind==='tackle')return result('standing-tackle','exposed-ball-within-shoe-reach',standing);
 if(interception?.reachable||standing?.kind==='interception')return result('interception','detached-inbound-ball',interception??standing);
 return result('none','hold-defensive-position');
}

// UME-04: a shot trajectory is an opportunity to block, never an observed
// block. Use the actual defending player, not a selected fixture shirt.
export function planNativeShotBlock({player,ball,velocity}={}){
 if(!player||player.role==='goalkeeper'||!['home','away'].includes(player.team)||
    ![player.x,player.y,ball?.x,ball?.y,velocity?.x,velocity?.y].every(Number.isFinite))return null;
 const dir=player.team==='home'?-1:1;
 if(dir*velocity.x<=2)return null;
 const eta=(player.x-ball.x)/velocity.x;
 if(eta<0||eta>0.65)return null;
 const y=Math.max(-33.49,Math.min(33.49,ball.y+velocity.y*eta));
 const reachable=0.48+Math.min(6.5*eta,Math.abs(player.vy??0)*eta+4.5*eta*eta);
 if(Math.abs(y-player.y)>reachable)return null;
 return Object.freeze({actorId:player.id,target:Object.freeze({x:player.x,y}),etaS:eta,decisionOnly:true,officialPossession:false});
}
