// ME-PHYS-02: deterministic vertical-bounce observables, independent of DOM/renderer.
// A 2m underside-to-surface drop mirrors the FIFA 2024-01 turf test setup.
// Reference 0.60–0.85 m is FIFA Quality Pro for certified *artificial turf*,
// not a certification of Football Architect's experimental natural-grass proxy.
import {toGroundClearance} from './core.mjs';

export const BOUNCE_TEST_DROP_HEIGHT_M = 2;
export const FIFA_TURF_QUALITY_PRO_REFERENCE_M = Object.freeze({min:0.60,max:0.85});

export function measureBounceHistory(samples) {
  if (!Array.isArray(samples)) throw new TypeError('Expected snapshots');
  const impacts=[];
  for(let i=1;i<samples.length;i++){
    const before=samples[i-1],after=samples[i];
    const clearance=toGroundClearance(after.ball.position.z);
    if(before.ball.velocity.z < -0.1 && after.ball.velocity.z > 0.1 &&
       clearance < 0.08){
      impacts.push({index:i,tick:after.tick,time:after.time});
    }
  }
  let firstReboundHeightM=null;
  if(impacts.length){
    const first=impacts[0].index;
    const stop=impacts.length>1?impacts[1].index:samples.length;
    let max=0,hasApex=false;
    for(let i=first;i<stop;i++){
      const s=samples[i];
      max=Math.max(max,toGroundClearance(s.ball.position.z));
      if(i>first && s.ball.velocity.z<=0 && toGroundClearance(s.ball.position.z)>0.08)
        hasApex=true;
    }
    if(hasApex)firstReboundHeightM=max;
  }
  return Object.freeze({
    impactCount:impacts.length,
    firstImpactTimeS:impacts[0]?.time??null,
    firstReboundHeightM
  });
}
