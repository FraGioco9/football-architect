// ME-PHYS-19 — deterministic, read-only playback of existing 60Hz Rapier
// diagnostics sampled every 0.1s. No physics stepping or coefficient fitting.
// Time coordinates are real seconds; positions are launch-relative metres.
// Display interpolation is strictly between pre-contact samples and the
// measured first-contact snapshot. A contacted ball stays at that snapshot.
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
const KEYS=['timeS','forwardM','lateralM','undersideM'];
const validPoint=(p)=>p&&typeof p==='object'&&
  KEYS.every(key=>numeric(p[key]));
function prepareRun(run,label){
  const trail=run?.preContactTrail;
  const impact=run?.firstContactPoint;
  if(!Array.isArray(trail)||trail.length<2||trail.length>1000||
      !validPoint(impact)||!trail.every(validPoint))
    throw new RangeError('Invalid '+label+' pre-contact flight');
  if(Math.abs(trail[0].timeS)>1e-9)
    throw new RangeError(label+' must start at t=0');
  let previous=-Infinity;
  for(const p of [...trail,impact]){
    if(p.timeS<=previous)throw new RangeError(label+' nonmonotonic flight time');
    previous=p.timeS;
  }
  if(impact.timeS>5||impact.timeS<=0)
    throw new RangeError(label+' invalid first contact');
  return Object.freeze({
    preContactTrail:trail,impact,
    points:Object.freeze([...trail,impact]),
    impactTimeS:impact.timeS
  });
}
export function prepareFlightPlaybackPair(caseRow){
  if(!caseRow||!numeric(caseRow.vxMps)||
      !['plus','minus'].includes(caseRow.spinKey))
    throw new TypeError('A paired ±Z spinning launch is required');
  const previous=prepareRun(caseRow.current,'previous');
  const candidate=prepareRun(caseRow.literature,'candidate');
  return Object.freeze({
    speedMps:caseRow.vxMps,spinKey:caseRow.spinKey,
    durationS:Math.max(previous.impactTimeS,candidate.impactTimeS),
    previous,candidate
  });
}
function sample(run,t){
  const pts=run.points,impact=run.impact;
  if(t>=impact.timeS){
    return Object.freeze({...impact,phase:'contact',interpolated:false});
  }
  if(t<=pts[0].timeS){
    return Object.freeze({...pts[0],phase:'airborne',interpolated:false});
  }
  for(let i=1;i<pts.length;i++){
    const a=pts[i-1],b=pts[i];
    if(t<=b.timeS){
      if(Math.abs(t-b.timeS)<1e-9)
        return Object.freeze({...b,phase:'airborne',interpolated:false});
      const fraction=(t-a.timeS)/(b.timeS-a.timeS);
      return Object.freeze({
        timeS:t,
        forwardM:a.forwardM+(b.forwardM-a.forwardM)*fraction,
        lateralM:a.lateralM+(b.lateralM-a.lateralM)*fraction,
        undersideM:a.undersideM+(b.undersideM-a.undersideM)*fraction,
        phase:'airborne',interpolated:true
      });
    }
  }
  throw new Error('Unreachable pre-impact playback frame');
}
// Shared monotonic presentation clock: never discard elapsed real time if
// browser drawing stalls. Visibility changes pause before a hidden tab can
// accumulate that elapsed time. This function is pure and independent of Rapier.
export function flightPlaybackWallTime({startedAtMs,nowMs,offsetS,durationS}={}){
  if(![startedAtMs,nowMs,offsetS,durationS].every(numeric)||
     startedAtMs<0||offsetS<0||durationS<=0||
     offsetS>durationS||nowMs<startedAtMs)
    throw new RangeError('Invalid monotonic flight playback clock');
  return Math.min(durationS,offsetS+(nowMs-startedAtMs)/1000);
}

export function sampleFlightPlaybackPair(pair,timeS){
  if(!numeric(timeS)||timeS<0)
    throw new RangeError('Playback timestamp must be finite and non-negative');
  if(!pair||!numeric(pair.durationS)||!pair.previous?.points||!pair.candidate?.points)
    throw new TypeError('Prepared flight playback pair required');
  const t=Math.min(timeS,pair.durationS);
  return Object.freeze({
    timeS:t,durationS:pair.durationS,spinKey:pair.spinKey,
    previous:sample(pair.previous,t),
    candidate:sample(pair.candidate,t),
    finished:t>=pair.durationS
  });
}
