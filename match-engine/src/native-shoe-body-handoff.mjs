// #628 M16: real shoe/body 60Hz continuation, not an event source.
// Shoe XY and heading come from the LAST pre-Rapier kinematic shoe pose.
// A native solver correction must never retroactively teleport the shoe.
const finite=Number.isFinite;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const gap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function projectNativeShoeBodyStep(prior,shoe,free,{dt,maxSpeed}={}){
 if(![dt,maxSpeed].every(v=>finite(v)&&v>0)||
    ![prior?.x,prior?.y,shoe?.x,shoe?.y,free?.x,free?.y]
     .every(finite))
  throw new TypeError('M16 needs original consecutive body and shoe XY');
 const radius=dt*maxSpeed;
 if(gap(prior,shoe)>radius+1e-8)
  throw new TypeError('M16 prior shoe cannot reach corrected canonical body');
 if(gap(prior,free)>radius+1e-7)
  throw new TypeError('M16 cannot bypass original player speed bound');
 let fraction=1;
 if(gap(free,shoe)>radius){
  // The prior canonical position lies inside the genuine shoe-reachable
  // disk; the final reachable point on its original movement segment
  // is found deterministically without adding motion.
  let lo=0,hi=1;
  for(let i=0;i<48;i++){
   const mid=(lo+hi)/2;
   const q={x:prior.x+(free.x-prior.x)*mid,
    y:prior.y+(free.y-prior.y)*mid};
   if(gap(q,shoe)<=radius)lo=mid;
   else hi=mid;
  }
  fraction=lo;
 }
 const x=prior.x+(free.x-prior.x)*fraction;
 const y=prior.y+(free.y-prior.y)*fraction;
 return Object.freeze({x,y,vx:(x-prior.x)/dt,vy:(y-prior.y)/dt,
  clippedM:gap({x,y},free)});
}
export function projectNativeShoeBodyFacing(prior,shoe,desired,maxTurn){
 if(![prior,shoe,desired,maxTurn].every(finite)||
    maxTurn<=0||maxTurn>=Math.PI/2)
  throw new TypeError('M16 needs original bounded shoe and body headings');
 const offset=wrap(shoe-prior);
 if(Math.abs(offset)>2*maxTurn+1e-8)
  throw new TypeError('M16 previous shoe/body heading not jointly reachable');
 const lower=Math.max(-maxTurn,offset-maxTurn);
 const upper=Math.min(maxTurn,offset+maxTurn);
 if(lower>upper+1e-10)
  throw new TypeError('M16 source heading intersection absent');
 const next=wrap(prior+clamp(wrap(desired-prior),lower,upper));
 return Object.freeze({facingRad:next,clippedRad:Math.abs(wrap(next-desired))});
}
