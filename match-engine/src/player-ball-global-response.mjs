// ME-PB-47 — ONE global, shared, uncalibrated match-ball response value.
// This is a strictly opt-in research facade. No UI, world settings, club,
// player, shoe or pitch-specific tuning; the normal core path is unchanged.
import {createEngine,resolveUniversalBallTechnicalParams} from './core.mjs';

export const GLOBAL_BALL_RESPONSE_VERSION='me-pb-47-one-global-ball-response-v1';
export const DEFAULT_GLOBAL_BALL_RESPONSE=1;
export const GLOBAL_BALL_RESPONSE_RANGE=Object.freeze({min:0.75,max:1.25});

// The only adjustable PHYSICAL input is this one number. Foot material
// friction, shape, terrain identities and all other Rapier coefficients
// remain fixed technical constants. Larger response means (a) higher
// common shoe restitution and (b) lower common roll deceleration.
// No independent material/grass variables or per-player coefficients.
// These ratios are research proxies, NOT calibrated football physics.
export function resolveGlobalBallResponse(value=DEFAULT_GLOBAL_BALL_RESPONSE){
 const technical=resolveUniversalBallTechnicalParams(value);
 const response=technical.response;
 return Object.freeze({
  version:GLOBAL_BALL_RESPONSE_VERSION,
  value:response,
  sameForAllShoes:true,
  sameForAllPlayers:true,
  sameForAllPitches:true,
  // Internal derived constants are observable for QA, NOT knobs.
  internalFootRestitution:technical.footRestitution,
  internalGrassRollDecelerationMps2:technical.grassRollDecelerationMps2,
  internalFootFriction:technical.footFriction,
  officialPossession:false,
  calibratedForGameplay:false
 });
}

// Opt-in diagnostic Rapier constructor. Its sole physics parameter is
// globalResponse; omittedShoeId is a controlled *ablation locator*, not
// another physical tuning value. Strict key checks prohibit passing the
// historic independently variable foot/grass diagnostic coefficients.
// Actual regular engines are still created by core.createEngine as before.
export function createGlobalResponseResearchEngine(
 RAPIER,scenario,globalResponse=DEFAULT_GLOBAL_BALL_RESPONSE,
 experimental={omittedShoeId:null}
){
 const profile=resolveGlobalBallResponse(globalResponse);
 if(!experimental||typeof experimental!=='object'||
    Array.isArray(experimental)||
    Object.keys(experimental).some(key=>key!=='omittedShoeId')||
    (experimental.omittedShoeId!==undefined&&
     experimental.omittedShoeId!==null&&
     typeof experimental.omittedShoeId!=='string'))
   throw new TypeError('Only an optional ablated shoe ID is supported');
 const omittedShoeId=experimental.omittedShoeId??null;
 if(!scenario||scenario.preset!=='roll'||
    (scenario.z!==undefined&&scenario.z!==0)||
    (scenario.vz!==undefined&&scenario.vz!==0))
   throw new RangeError('Shared response research requires grounded roll');
 return createEngine(RAPIER,scenario,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticOmittedFootId:omittedShoeId,
  diagnosticFootRestitution:profile.internalFootRestitution,
  diagnosticGrassRollDecelerationMps2:
   profile.internalGrassRollDecelerationMps2
 });
}
