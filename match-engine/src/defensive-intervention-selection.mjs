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
