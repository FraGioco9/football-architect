// ME-PHYS-21 — static, reproducible comparison of two RESEARCH-ONLY
// parameterizations. No Rapier worlds, fit, environment knobs or gameplay
// activation. The original models remain unchanged.
import {magnusLift} from './magnus.mjs';
import {literatureCandidateForces} from './literature-aero-candidate.mjs';
import {SINGLE_BALL_SPEC} from './universal-ball-readiness.mjs';

export const AERO_REVIEW_SPEEDS_MPS=Object.freeze([7,15,30]);
export const AERO_REVIEW_SPINS_RPS=Object.freeze([0,3,6]);
export const AERO_REVIEW_DECISION='RETAIN BOTH DIAGNOSTIC MODELS — NO GLOBAL CALIBRATION';
export const AERO_REVIEW_LIMITATIONS=
  'These are instantaneous, horizontal, launch-state coefficient comparisons, '+
  'not new flights, measured physical trajectories, best-fit coefficients, '+
  'a realism score or a threshold for activation. Old lift uses spin parameter '+
  'Sp=omega*R/speed; the candidate saturates with perpendicular spin rev/s. '+
  'Both depend on assumptions and incomplete ball-specific evidence.';

export function reviewAerodynamicCandidate(){
  const radiusM=SINGLE_BALL_SPEC.radiusM;
  const rows=[];
  for(const speedMps of AERO_REVIEW_SPEEDS_MPS){
    for(const spinRps of AERO_REVIEW_SPINS_RPS){
      const velocity={x:speedMps,y:0,z:0};
      const omega={x:0,y:0,z:spinRps*2*Math.PI};
      const old=magnusLift(velocity,omega,{radiusM});
      const candidate=literatureCandidateForces(velocity,omega,{radiusM});
      const spinParameter=radiusM*spinRps*2*Math.PI/speedMps;
      rows.push(Object.freeze({
        speedMps,spinRps,spinParameter,
        previousCl:old.liftCoefficient,
        candidateCl:candidate.cl,
        previousLiftN:old.magnitudeN,
        candidateLiftN:Math.hypot(
          candidate.lift.x,candidate.lift.y,candidate.lift.z
        ),
        previousCd:candidate.cdBase,
        candidateCd:candidate.cd,
        dragIncrease:candidate.cdSpinIncrement,
        liftRatio:old.magnitudeN>1e-12?
          Math.hypot(candidate.lift.x,candidate.lift.y,candidate.lift.z)/
          old.magnitudeN:null
      }));
    }
  }
  const highSpeed=rows.find(r=>r.speedMps===30&&r.spinRps===6);
  return Object.freeze({
    label:'ME-PHYS-21 — parameterization audit (instantaneous 3D force)',
    decision:AERO_REVIEW_DECISION,
    limitation:AERO_REVIEW_LIMITATIONS,
    rows:Object.freeze(rows),
    highSpeed,
    speedDependenceExplainsExtraBend:
      highSpeed.candidateCl>2*highSpeed.previousCl,
    parameterFitPerformed:false,
    scientificallyCalibrated:false,
    approvedForGameplay:false,
    selectedUniversalBallModel:null,
    worldPhysicsVersion:SINGLE_BALL_SPEC.physicsVersion,
    grassDecelerationMps2:SINGLE_BALL_SPEC.standardGrassDecelerationMps2
  });
}
