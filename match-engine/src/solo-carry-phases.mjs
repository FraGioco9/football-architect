// #628 solo Carry: evidence-only phase selection at fixed 60Hz.
// No timed script, fake collision, possession, teleport or ball speed clamp.
export const SOLO_CARRY_PHASES=Object.freeze(['control','moderate','sprint']);
const profiles=Object.freeze({
 control:Object.freeze({
  label:'Control',maxSpeedMps:3.0,accelerationMps2:6,brakingMps2:10,
  ballTargetOffsetM:-0.14,shoeFrequencyBaseHz:1.25,
  shoeFrequencySpeedHz:0.08,shoeForwardStrokeM:0.075
 }),
 moderate:Object.freeze({
  label:'Moderate',maxSpeedMps:4.0,accelerationMps2:6,brakingMps2:9,
  ballTargetOffsetM:-0.10,shoeFrequencyBaseHz:1.35,
  shoeFrequencySpeedHz:0.35,shoeForwardStrokeM:0.075
 }),
 sprint:Object.freeze({
  label:'Sprint',maxSpeedMps:4.5,accelerationMps2:8,brakingMps2:11,
  ballTargetOffsetM:-0.04,shoeFrequencyBaseHz:1.17,
  shoeFrequencySpeedHz:0.24,shoeForwardStrokeM:0.055
 })
});
export function soloCarryPhaseConfiguration(phase){
 if(!SOLO_CARRY_PHASES.includes(phase))
  throw new TypeError('Unknown solo Carry physical phase');
 return profiles[phase];
}
export function advanceSoloCarryPhase({previousPhase='control',tick,
 playerSpeedMps,ballSpeedMps,ballGapM}={}){
 if(!SOLO_CARRY_PHASES.includes(previousPhase)||
    !Number.isSafeInteger(tick)||tick<1||
    ![playerSpeedMps,ballSpeedMps,ballGapM].every(n=>
     typeof n==='number'&&Number.isFinite(n)&&n>=0))
  throw new TypeError('Solo Carry phase requires original nonnegative 60Hz speed/gap');
 // Hysteresis uses current physical evidence, not time-in-scenario.
 let phase=previousPhase;
 if(previousPhase==='control'){
  if(playerSpeedMps>=1.45&&ballSpeedMps>=0.90&&ballGapM>=0.40)
   phase='moderate';
 }else if(previousPhase==='moderate'){
  if(playerSpeedMps<1.0||ballSpeedMps<0.55||ballGapM<0.31)
   phase='control';
  else if(playerSpeedMps>=2.58&&ballSpeedMps>=2.20&&ballGapM>=0.46)
   phase='sprint';
 }else if(playerSpeedMps<2.45||ballSpeedMps<1.75||ballGapM<0.38){
  phase='moderate';
 }
 return Object.freeze({
  tick,phase,previousPhase,changed:phase!==previousPhase,
  playerSpeedMps,ballSpeedMps,ballGapM,...profiles[phase],
  originalCanonicalPlayer:true,originalRapierBall:true,
  nativeShoeEventCreated:false,ballImpulseCreated:false,
  officialPossession:false
 });
}
