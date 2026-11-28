// #628 — ISOLATED DEV native fixed-phase counterfactual.
// Can change the impulse of an already-selected ORIGINAL action *only*
// following the same-world authentic exclusive Rapier shoe START. It never
// creates shoe events, applies impulses, sets ball velocity or possession.
import {SOLO_CARRY_PHASES,planNativeCarryPhaseImpulse} from './solo-carry-phases.mjs';
import {INITIAL_PLAYERS} from './player-movement.mjs';

export function chooseNativeFixedCarryImpulse({
 phase,playerAttributes,player,attackingSide,ballVelocity,
 verifiedNativeExclusiveShoeStart,contactActorId,nativeFixedSprintLongStride=false
}={}){
 if(typeof nativeFixedSprintLongStride!=='boolean'||
    (nativeFixedSprintLongStride&&phase!=='sprint'))
  throw new TypeError('Long stride requires fixed native Sprint');
 if(!SOLO_CARRY_PHASES.includes(phase)||
    !['home','away'].includes(attackingSide)||
    verifiedNativeExclusiveShoeStart!==true||
    player?.team!==attackingSide||
    player?.id!==contactActorId||
    !INITIAL_PLAYERS.some(p=>p.id===contactActorId&&p.team===attackingSide)||
    ![player.vx,player.vy,player.x,player.y,
      ballVelocity?.x,ballVelocity?.y,ballVelocity?.z]
      .every(Number.isFinite))
  throw new TypeError('Real exclusive Rapier shoe and current canonical player required');
 const proposal=planNativeCarryPhaseImpulse({phase,playerAttributes,player,attackingSide,ballVelocity,nativeFixedSprintLongStride});
 return Object.freeze({
  source:'authentic-native-two-shoe-calibrated-impulse',
  ...proposal,
  nativeShoeContactVerified:true,
  // One native-foot-start may be deliberately left to its true Rapier
  // solver collision without a second independently scripted impulse.
  originalFootEventOnly:proposal.impulseNs===null,
  noExtraShoeEvent:true,officialPossession:false,
  originalRapierBall:true
 });
}
