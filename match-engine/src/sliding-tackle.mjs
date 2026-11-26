// #628 D-08: bounded sliding tackle intent, not a successful tackle.
// Only the active directed 1v1 uses this state. The native shoe and
// original exclusive START gate remain the physical authority.
import {observeDribbleShield} from './isolated-dribble-touches.mjs';

export const SLIDE_TICKS=18;
export const SLIDE_RECOVERY_TICKS=32;
export const SLIDE_MAX_EXTENSION_M=0.30;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const target=(x,y)=>Object.freeze({x:clamp(x,-51.99,51.99),y:clamp(y,-33.49,33.49)});

// Launch only from an exposed, reachable rolling ball, on the goal side,
// while the defender is already moving toward the ball and facing it.
// Never launch from behind, through shielding, or from a stationary jam.
export function planSlidingTackle({attackingSide,attacker,defender,ball:b,velocity:v}={}){
 if(!['home','away'].includes(attackingSide)||
    attacker?.id!==attackingSide+'-10'||
    defender?.id!==(attackingSide==='home'?'away':'home')+'-2'||
    ![attacker.x,attacker.y,defender.x,defender.y,defender.vx,defender.vy,
      defender.facingRad,b?.x,b?.y,b?.z,v?.x,v?.y].every(Number.isFinite))return null;
 const dir=attackingSide==='home'?1:-1;
 const dx=b.x-defender.x,dy=b.y-defender.y,gap=Math.hypot(dx,dy);
 const carrierGap=Math.hypot(b.x-attacker.x,b.y-attacker.y);
 const speed=Math.hypot(v.x,v.y);
 if(gap<0.58||gap>1.15||carrierGap>1.15||b.z<0.095||b.z>0.23||
    speed<0.40||speed>4.5||dir*(defender.x-attacker.x)<0.20||
    dir*(defender.x-b.x)<-0.15||observeDribbleShield(attacker,defender,b))return null;
 const ux=dx/gap,uy=dy/gap;
 if(defender.vx*ux+defender.vy*uy<0.45||
    Math.cos(defender.facingRad)*ux+Math.sin(defender.facingRad)*uy<0.70)return null;
 const bx=b.x+v.x*0.12,by=b.y+v.y*0.12;
 if(Math.hypot(bx-defender.x,by-defender.y)>1.25)return null;
 return Object.freeze({actorId:defender.id,ux,uy,target:target(bx-0.48*ux,by-0.48*uy),
  officialPossession:false});
}

// Tick-driven finite extension/retraction and recovery. Cancellation by
// the liveness release retracts the shoe; it never synthesizes a contact.
export function advanceSlidingTackle({tick,previous=null,source,allowLaunch=true,cancel=false}){
 if(!Number.isSafeInteger(tick)||tick<1||
    previous!==null&&previous.tick!==tick-1)throw new TypeError('Consecutive slide ticks required');
 let plan=previous?.plan??null,start=previous?.startTick??null,recover=previous?.recoveryTick??null;
 if(previous&&recover===null&&(cancel||tick-start>=SLIDE_TICKS))recover=tick;
 if(recover!==null&&tick-recover>=SLIDE_RECOVERY_TICKS){plan=null;start=null;recover=null;}
 if(!plan&&allowLaunch&&!cancel){plan=planSlidingTackle(source);if(plan)start=tick;}
 if(!plan)return null;
 const age=tick-start;
 const phase=recover===null?'slide':'recovery';
 const extensionM=phase==='slide'?SLIDE_MAX_EXTENSION_M*Math.min(1,(age+1)/5,(SLIDE_TICKS-age)/6):0;
 return Object.freeze({tick,actorId:plan.actorId,plan,startTick:start,recoveryTick:recover,
  phase,started:start===tick,extensionM,officialPossession:false,physicalContactProven:false});
}

// A real kinematic shoe pose offset, not a new collider or teleport.
// The existing bridge additionally clamps the actual pose per tick.
export function slidingShoePose(foot,state){
 if(!state||state.phase!=='slide'||state.extensionM<=0)return foot;
 if(!Number.isFinite(state.extensionM)||state.extensionM>SLIDE_MAX_EXTENSION_M||
    !Number.isFinite(state.plan?.ux)||!Number.isFinite(state.plan?.uy)||
    Math.abs(Math.hypot(state.plan.ux,state.plan.uy)-1)>1e-6)
  throw new TypeError('Bounded slide pose required');
 return Object.freeze({...foot,x:foot.x+state.plan.ux*state.extensionM,
  y:foot.y+state.plan.uy*state.extensionM});
}
