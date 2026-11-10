// ME-PHYS-12: calibration eligibility for one universal Football Architect ball.
// Research-only evidence ledger; NEVER a gameplay force selection or a model fit.
// Exact reported numbers come from two separate Trionda papers and a 2020
// curve-kick paper; the three sources are not a common specimen-level dataset.
export const SINGLE_BALL_SPEC=Object.freeze({
  id:'fa-universal-ball-research',massKg:0.43,radiusM:0.11,
  standardGrassDecelerationMps2:0.80,
  gameplayDragEnabled:false,gameplayMagnusEnabled:false,
  environmentProfiles:1,physicsVersion:'me-01-physics-v4'
});
export const SINGLE_BALL_SOURCES=Object.freeze([
  Object.freeze({id:'euro2024',label:'Euro 2024 · Cd anchors (2024)',
    url:'https://kjss.sports.re.kr/v.35/2/392/21',
    specimen:'euro2024-reference',kind:'wind-tunnel Cd anchors',
    coverage:'Two published Cd anchors near 19/32 m/s; low-speed and transition Cd remain insufficiently measured here'}),
  Object.freeze({id:'trionda2026',label:'Trionda · six orientations (2026)',
    url:'https://www.mdpi.com/2311-5521/11/5/128',
    specimen:'trionda-one-specimen',kind:'wind-tunnel fixed-orientation drag/lift/side force',
    coverage:'Single Trionda specimen, six fixed orientations, three repeats per condition. No spin, spin decay or measured holdout flight trajectories'}),
  Object.freeze({id:'curvekick2020',label:'2020 · spinning curve-kick side force',
    url:'https://www.mdpi.com/2504-3900/49/1/88',
    specimen:'curvekick-other',kind:'free-flight mean side force vs mean spin',
    coverage:'Three trial-averaged Cs/Sp values, not same specimen as Euro 2024 or Trionda and not a 3D time-resolved Cl law'})
]);
export const TRIONDA_ORIENTATION_COMPARISON=Object.freeze({
  specimen:'trionda-one-specimen',
  sourceId:'trionda2026',
  launchSpeedMps:30,launchAngleDeg:30,
  condition:'2D NONSPIN simulated range, sea level, Cd(v) from wind tunnel',
  measuredTrajectories:false,
  orientations:Object.freeze([
    Object.freeze({key:'A-90',rangeM:48.65,
      subcriticalMeanCd:0.348,supercriticalMeanCd:0.241,fullRangeMeanCd:0.266}),
    Object.freeze({key:'B-90',rangeM:51.68,
      subcriticalMeanCd:0.330,supercriticalMeanCd:0.201,fullRangeMeanCd:0.231})
  ])
});
export const UNIVERSAL_CALIBRATION_GATES=Object.freeze([
  Object.freeze({key:'single-specimen',name:'Single specimen shared by drag and spin',state:'missing',reason:'For the selected universal ball, a complete authenticated shared-specimen drag+spin dataset is missing; Ward et al. (2023) measured both on experimental specimens, not the selected game reference'}),
  Object.freeze({key:'speed-resolved-cd',name:'Subcritical / crisis / supercritical Cd(v)',state:'partial',reason:'Euro 2024 has two anchors; Trionda has measured multi-speed non-spin Cd by orientation, not a validated one-ball spin model'}),
  Object.freeze({key:'spin-map',name:'Spin-axis and speed resolved Cs/Cl',state:'missing',reason:'Ward et al. (2023) measured spinning side forces and reverse Magnus on test specimens, but no complete authenticated speed × spin-axis / side/top/back coefficient map for the selected universal ball'}),
  Object.freeze({key:'uncertainty',name:'Coefficient confidence / reproducibility bounds',state:'missing',reason:'No matched uncertainty intervals or raw same-ball coefficient matrix; Trionda repeated three times but not a complete spin uncertainty map'}),
  Object.freeze({key:'holdout',name:'Independent measured 3D flight holdout',state:'missing',reason:'Published Trionda ranges are simulations, not observed free-flight trajectory holdouts'}),
  Object.freeze({key:'rotation',name:'Spin decay, attitude and negative-Magnus validation',state:'missing',reason:'No compatible measured rotational torque/decay and low-spin reversal coverage'}),
  Object.freeze({key:'world-invariants',name:'One ball, one field, unchanged official world',state:'available',reason:'Existing universal 430g/11cm/0.80m/s² configuration remains frozen; no gameplay aerodynamic activation'})
]);
function validateEvidenceConsistency(sources){
  if(!Array.isArray(sources)||sources.length<2||sources.some(s=>
    !s||typeof s.specimen!=='string'||s.specimen.length===0||
    typeof s.kind!=='string'))throw new TypeError('Invalid calibration evidence sources');
  const wind=sources.filter(s=>s.kind.includes('wind-tunnel'));
  const spin=sources.filter(s=>s.kind.includes('free-flight')||s.kind.includes('spin-resolved'));
  const physicallyMatched=wind.some(w=>spin.some(t=>t.specimen===w.specimen));
  return Object.freeze({physicallyMatched,
    windSpecimens:Object.freeze([...new Set(wind.map(s=>s.specimen))]),
    spinSpecimens:Object.freeze([...new Set(spin.map(s=>s.specimen))])});
}
export function assessUniversalBallReadiness(sources=SINGLE_BALL_SOURCES){
  const coverage=validateEvidenceConsistency(sources);
  // Labels are metadata, not verified specimen provenance. Even an apparent
  // string-level match CANNOT improve evidence gates, which require manually
  // reviewed measurements and held-out trajectories for the same ball.
  const gates=UNIVERSAL_CALIBRATION_GATES;
  const summary=Object.freeze({
    available:gates.filter(g=>g.state==='available').length,
    partial:gates.filter(g=>g.state==='partial').length,
    missing:gates.filter(g=>g.state==='missing').length
  });
  const ranges=TRIONDA_ORIENTATION_COMPARISON.orientations.map(o=>o.rangeM);
  const spanM=Math.max(...ranges)-Math.min(...ranges);
  const averageM=ranges.reduce((a,b)=>a+b,0)/ranges.length;
  return Object.freeze({
    stage:'CALIBRATION HOLD — EVIDENCE INCOMPLETE',
    approvedForGameplay:false,scientificallyCalibrated:false,
    ball:SINGLE_BALL_SPEC,sourceStudies:sources===SINGLE_BALL_SOURCES?
      SINGLE_BALL_SOURCES:Object.freeze(sources.map(s=>Object.freeze({...s}))),
    specimenCoverage:coverage,
    gates:Object.freeze(gates),summary,orientationEvidence:TRIONDA_ORIENTATION_COMPARISON,
    orientationSpanM:spanM,
    orientationSpanPercentOfMean:100*spanM/averageM,
    researchObservation:'A-90 and B-90 are two static orientations of ONE Trionda specimen; these are simulation outputs based on measured nonspinning Cd(v), NOT real measured ranges, NOT two surface profiles.',
    nextEvidenceRequest:'Same specimen: machine-readable Cd(speed), Cs/Cl(speed,spin,axis), uncertainty intervals, rotational decay and independent high-speed-camera 3D flight tracks with initial states.',
    note:'One physical ball model for every Football Architect match is the design goal, NOT a claim that any retrieved paper already validates global Cd(v)+Magnus. No orientation/altitude or weather gameplay profiles are authorized.'
  });
}
