// ME-PHYS-15: deterministic, OFFLINE trajectory error metrics.
// A small numerical error alone never verifies measurement provenance,
// rights, coordinate frame, specimen identity or physical ball calibration.
// Observed/predicted coordinates MUST already be in matching xyz axes and
// metres, with a shared absolute time origin. No hidden rotation/scale fit.
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const TOL=1e-10;
const MAX_POINTS=10000;
function samples(value,name){
  if(!Array.isArray(value)||value.length<2||value.length>MAX_POINTS)
    throw new RangeError(name+' requires 2..10000 time-ordered samples');
  let last=-Infinity,track,trackIdPresent=null;
  for(const [i,v] of value.entries()){
    if(!v||typeof v!=='object'||Array.isArray(v)||
       ![v.timeS,v.xM,v.yM,v.zM].every(finite)||
       v.timeS<0||v.timeS<=last||
       [v.xM,v.yM,v.zM].some(n=>Math.abs(n)>1000))
      throw new RangeError(name+' invalid frame '+i);
    const present=v.trackId!==undefined;
    if(trackIdPresent!==null&&trackIdPresent!==present)
      throw new RangeError(name+' mixes ID and no-ID frames');
    trackIdPresent=present;
    if(present){
      if(typeof v.trackId!=='string'||!v.trackId||v.trackId.length>128)
        throw new RangeError(name+' invalid track ID');
      if(track===undefined)track=v.trackId;
      else if(track!==v.trackId)
        throw new RangeError(name+' mixes separate tracks');
    }else if(track!==undefined)throw new RangeError(name+' mixes ID and no-ID frames');
    last=v.timeS;
  }
  return value;
}
function interpolate(predicted,t,cursor,maxGapS){
  while(cursor.index<predicted.length-2&&
    predicted[cursor.index+1].timeS<t-TOL)cursor.index++;
  const a=predicted[cursor.index],b=predicted[cursor.index+1];
  if(t<a.timeS-TOL||t>b.timeS+TOL)
    throw new RangeError('Timestamp outside predictor window; no extrapolation');
  const gap=b.timeS-a.timeS;
  if(gap>maxGapS+TOL)
    throw new RangeError('Predictor gap exceeds maximum permitted interval');
  const f=Math.max(0,Math.min(1,(t-a.timeS)/gap));
  return {xM:a.xM+(b.xM-a.xM)*f,
    yM:a.yM+(b.yM-a.yM)*f,zM:a.zM+(b.zM-a.zM)*f};
}
function pointDistance(a,b){
  return Math.hypot(a.xM-b.xM,a.yM-b.yM,a.zM-b.zM);
}
export function evaluateFlightTrajectory({
  observed,predicted,maxGapS=0.05,coordinateConvention='unverified'
}={}){
  samples(observed,'observed');samples(predicted,'predicted');
  if(!finite(maxGapS)||maxGapS<=0||maxGapS>1)
    throw new RangeError('Invalid max interpolation gap');
  if(!['unverified','externally-confirmed-same-xyz-meters'].includes(coordinateConvention))
    throw new RangeError('Invalid coordinate convention declaration');
  if(observed[0].timeS<predicted[0].timeS-TOL||
     observed.at(-1).timeS>predicted.at(-1).timeS+TOL)
    throw new RangeError('Observed samples outside predictor time domain');
  const cursor={index:0},pairs=[];
  for(const row of observed){
    pairs.push({observed:row,estimated:interpolate(predicted,row.timeS,cursor,maxGapS)});
  }
  const firstObserved=pairs[0].observed,firstPred=pairs[0].estimated;
  let sumAbs=0,sumSquared=0,relativeSquared=0,max=0;
  let x2=0,y2=0,z2=0;
  const checkpoints=[];
  for(const {observed:a,estimated:b} of pairs){
    const dx=b.xM-a.xM,dy=b.yM-a.yM,dz=b.zM-a.zM;
    const distance=Math.hypot(dx,dy,dz);
    const relative=Math.hypot(
      (b.xM-firstPred.xM)-(a.xM-firstObserved.xM),
      (b.yM-firstPred.yM)-(a.yM-firstObserved.yM),
      (b.zM-firstPred.zM)-(a.zM-firstObserved.zM));
    sumAbs+=distance;sumSquared+=distance**2;
    relativeSquared+=relative**2;max=Math.max(max,distance);
    x2+=dx*dx;y2+=dy*dy;z2+=dz*dz;
    checkpoints.push(Object.freeze({
      timeS:a.timeS,
      absoluteErrorM:distance,
      relativeDisplacementErrorM:relative
    }));
  }
  const n=pairs.length;const rmse=Math.sqrt(sumSquared/n);
  return Object.freeze({
    label:'OFFLINE 3D METRIC — NOT SCIENTIFICALLY VALIDATED',
    count:n,observedTrack:observed[0].trackId??null,
    observedDurationS:observed.at(-1).timeS-observed[0].timeS,
    mae3dM:sumAbs/n,rmse3dM:rmse,
    rmseX_M:Math.sqrt(x2/n),rmseY_M:Math.sqrt(y2/n),
    rmseZ_M:Math.sqrt(z2/n),
    maximumErrorM:max,
    endpointErrorM:pointDistance(pairs.at(-1).estimated,pairs.at(-1).observed),
    relativeDisplacementRmseM:Math.sqrt(relativeSquared/n),
    checkpoints:Object.freeze(checkpoints),
    interpolation:'linear prediction sampled at real observation times; strictly no extrapolation',
    coordinateConventionClaim:coordinateConvention,
    scientificVerificationComplete:false,licensePermissionVerified:false,
    approvedForGameplay:false,
    limitations:'Absolute errors require externally verified common axes, origin, units and clock. Relative displacement removes only constant translation, never axis rotation, clock offset or calibration bias. Errors alone cannot validate a force law, measured spin or same-ball specimen.'
  });
}

// A disposable 60Hz model prediction, never the user's current LAB world.
// The snapshot stores CENTER height in metres, not underside clearance.
// No spin can be inferred from observed ball positions.
export function generateDisposableBallPrediction(RAPIER,createEngine,{scenario,options={},seconds=2}={}){
  if(!finite(seconds)||seconds<1/60||seconds>4)
    throw new RangeError('Prediction duration must be 1/60..4 seconds');
  if(typeof createEngine!=='function')
    throw new TypeError('A Rapier engine factory is required');
  const engine=createEngine(RAPIER,scenario,options);
  try{
    const samples=[];
    const point=()=>{
      const snap=engine.snapshot(),p=snap.ball.position;
      return Object.freeze({timeS:snap.time,xM:p.x,yM:p.y,zM:p.z});
    };
    samples.push(point());
    for(let i=0;i<Math.ceil(seconds*60);i++){
      engine.step();samples.push(point());
    }
    return Object.freeze(samples);
  }finally{engine.dispose();}
}
