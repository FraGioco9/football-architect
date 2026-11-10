// ME-PHYS-11: read-only evidence audit for ONE future universal ball.
// These are source-reported samples, NOT a fitted law, gameplay defaults,
// cross-ball validation, or transferable lift coefficients for topspin.
// All publication URLs are included so each number is auditable.
import {speedDependentDragCd} from './aerodynamics.mjs';
import {MAGNUS_CL_CAP,MAGNUS_CL_SLOPE} from './magnus.mjs';

export const CD_PUBLICATION='https://kjss.sports.re.kr/v.35/2/392/21';
export const CS_PUBLICATION='https://www.mdpi.com/2504-3900/49/1/88';
export const CD_EURO2024_ANCHORS=Object.freeze([
  Object.freeze({airspeedMps:19,measuredCd:0.21,
    source:'Hong (2024), Table 3, Euro 2024, Re≈3×10⁵; speed approximate'}),
  Object.freeze({airspeedMps:32,measuredCd:0.24,
    source:'Hong (2024), Table 3, Euro 2024, Re≈5×10⁵; speed approximate'})
]);
export const CS_CURVE_KICK_AVERAGES=Object.freeze([
  Object.freeze({meanSpinParameter:0.18,measuredMeanCs:0.21,
    source:'2020 curve-kick free-flight study, Discussion: trial-averaged paired values'}),
  Object.freeze({meanSpinParameter:0.22,measuredMeanCs:0.24,
    source:'2020 curve-kick free-flight study, Discussion: trial-averaged paired values'}),
  Object.freeze({meanSpinParameter:0.34,measuredMeanCs:0.29,
    source:'2020 curve-kick free-flight study, Discussion: trial-averaged paired values'})
]);

// The current solver treats Cl as a nonnegative *directional* Magnus proxy,
// not the measured side-force Cs. This is an indicative comparison ONLY in
// pure transverse (vertical-axis) spin, and not a prediction of these trials.
export const currentMagnusProxyAtSp=sp=>{
  if(typeof sp!=='number'||!Number.isFinite(sp)||sp<0)
    throw new RangeError('Invalid nonnegative spin parameter');
  return Math.min(MAGNUS_CL_CAP,MAGNUS_CL_SLOPE*sp);
};

export function readAerodynamicCalibrationEvidence(){
  const dragAnchors=Object.freeze(CD_EURO2024_ANCHORS.map(point=>{
    const prototypeCd=speedDependentDragCd(point.airspeedMps);
    return Object.freeze({...point,prototypeCd,
      signedDifference:prototypeCd-point.measuredCd});
  }));
  const sideAnchors=Object.freeze(CS_CURVE_KICK_AVERAGES.map(point=>{
    const currentProxyCl=currentMagnusProxyAtSp(point.meanSpinParameter);
    return Object.freeze({...point,currentProxyCl,
      signedDifference:currentProxyCl-point.measuredMeanCs,
      absoluteDifference:Math.abs(currentProxyCl-point.measuredMeanCs)});
  }));
  const meanAbsSideDifference=sideAnchors.reduce((sum,p)=>sum+p.absoluteDifference,0)/
    sideAnchors.length;
  const maxAbsDragDifference=Math.max(...dragAnchors.map(p=>Math.abs(p.signedDifference)));
  return Object.freeze({
    stage:'RESEARCH AUDIT — NOT CALIBRATED',
    dragSource:CD_PUBLICATION,
    spinSource:CS_PUBLICATION,
    dragAnchors,sideAnchors,meanAbsSideDifference,maxAbsDragDifference,
    currentMagnusSlope:MAGNUS_CL_SLOPE,currentMagnusCap:MAGNUS_CL_CAP,
    referenceBall:'Euro 2024 drag anchors only; curved-kick side-force study is not a matched Euro 2024 specimen',
    keyFinding:'The current capped Cl proxy is below the reported mean Cs for all three sampled spin parameters; these are different types of quantities, so this is not a validated error of a shared ball model.',
    blockers:Object.freeze([
      'Only two measured Euro 2024 Cd anchors: insufficient to identify the drag-crisis curve and low-speed Cd.',
      'The three published Cs values are trial-averaged side-force coefficients, not time-resolved lift Cl of one selected universal ball.',
      'Sources use different footballs and protocols, so fitting Cd(v) and Cs(Sp) together would not calibrate a single specimen.',
      'No matched 3D trajectories, spin decay/torque, topspin lift, negative-Magnus regime or uncertainty intervals for this fictional reference ball.'
    ]),
    suggestedGate:'Obtain a compatible, measured speed × spin coefficient dataset for one ball and independent held-out flight trajectories before selecting one universal game coefficient law.',
    unchanged:Object.freeze({gameplayAerodynamics:false,defaultCd:0,defaultMagnus:false,
      oneUniversalGrassDecelerationMps2:0.8,noWind:true})
  });
}
