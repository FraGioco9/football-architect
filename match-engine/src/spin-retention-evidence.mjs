// ME-PHYS-24 — conservative observed-spin retention cross-check.
// One published 2020 free-flight trial, approximate values from the paper's
// text. These are NOT an entire raw trajectory, a ball-specific calibration,
// a measured torque curve, or permission to select a gameplay decay constant.
// https://www.mdpi.com/2504-3900/49/1/88
import {SPIN_DECAY_RATES_PER_S} from './spin-decay-qa.mjs';

export const SPIN_RETENTION_PUBLISHED_TRIAL=Object.freeze({
 source:'https://www.mdpi.com/2504-3900/49/1/88',
 label:'2020 spinning-soccer-ball free-flight trial 1 (approximate)',
 spinInitialRevS:5.8,
 spinLaterRevS:5.7,
 spinIntervalS:0.8,
 speedInitialMps:18.8,
 speedLaterMps:14.7,
 speedIntervalS:1,
 axesSupported:'vertical-axis sidespin; do not extrapolate to topspin/backspin',
 timeSeriesAvailable:false,
 specimenMatched:false
});

export const SPIN_RETENTION_DECISION=
 'HOLD — single approximate published observation cannot calibrate universal angular damping';

export function reviewSpinRetentionEvidence(spinDecayReport){
 if(!spinDecayReport || !Array.isArray(spinDecayReport.cases))
   throw new TypeError('Spin-decay Rapier diagnostics required');
 const source=SPIN_RETENTION_PUBLISHED_TRIAL;
 const retention=source.spinLaterRevS/source.spinInitialRevS;
 const observedLoss=1-retention;
 const observation=Object.freeze({
   spinRetainedFraction:retention,
   spinLostFraction:observedLoss,
   speedRetainedFraction:source.speedLaterMps/source.speedInitialMps,
   // Only the exponential equivalent for this one approximate two-point
   // observation, NOT a fitted law or recommended gameplay parameter.
   equivalentExponentialRatePerS:-Math.log(retention)/source.spinIntervalS,
   source
 });
 const rows=SPIN_DECAY_RATES_PER_S.map(rate=>{
   const trial=spinDecayReport.cases.find(c=>
     c.axis==='side-plus' && c.decayRatePerS===rate);
   if(!trial)throw new RangeError('Missing measured +Z spin-decay trial');
   const measured={};
   for(const model of ['previous','candidate']){
     const data=trial[model];
     const atObservation=data?.checkpoints?.find(point=>
       point!==null && Math.abs(point.timeS-source.spinIntervalS)<1e-9);
     if(!atObservation || !(data.initialSpinRevS>0) ||
        !(data.firstContactTimeS>source.spinIntervalS))
       throw new RangeError('Missing actual pre-contact Rapier spin checkpoint');
     const retained=atObservation.spinRevS/data.initialSpinRevS;
     if(!Number.isFinite(retained)||retained<0)
       throw new RangeError('Nonfinite measured spin retention');
     // Rapier can report slight angular roundoff at λ=0. The published
     // table displays percentages to 2 decimal places: any fractional loss
     // below 0.00005 rounds to 0.00%, so normalize just that display-scale
     // numerical zero, never a materially measurable spin change.
     const rawLoss=1-retained;
     const lost=Math.abs(rawLoss)<5e-5?0:rawLoss;
     measured[model]=Object.freeze({
       spinRetainedFraction:retained,
       spinLostFraction:lost,
       deviationFromPublishedLossFraction:lost-observedLoss,
       lossRatioToPublished:lost/observedLoss
     });
   }
   return Object.freeze({ratePerS:rate,
     previous:measured.previous,candidate:measured.candidate});
 });
 return Object.freeze({
  label:'ME-PHYS-24 — published trial vs experimental spin-loss rates',
  observation,rows:Object.freeze(rows),
  referenceIsApproximate:true,
  referenceTrialCount:1,
  rawTrajectoryAvailable:false,coefficientFitPerformed:false,
  scientificallyCalibrated:false,gameplayApproved:false,
  decision:SPIN_RETENTION_DECISION,
  note:'One approximate observational reference from a different, '+
   'unmatched football: measured vertical-axis spin lost about '+ 
   (100*observedLoss).toFixed(1)+'% in 0.8s while its translational '+
   'speed lost about '+(100*(1-observation.speedRetainedFraction)).toFixed(1)+
   '% in 1s. The paper attributes most side-force weakening to ball '+
   'speed reduction, not spin reduction. These periods differ. '+
   'The observed spin retention does not establish an exponential decay law; '+
   'no rates are fitted or enabled for gameplay.'
 });
}
