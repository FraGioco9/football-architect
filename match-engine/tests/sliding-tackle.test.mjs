import test from 'node:test';
import assert from 'node:assert/strict';
import {planSlidingTackle,advanceSlidingTackle,SLIDE_TICKS,SLIDE_RECOVERY_TICKS,EFFECTIVE_SLIDE_RECOVERY_TICKS,EFFECTIVE_SLIDE_BRAKE_TICKS,SLIDE_MAX_SPEED_MPS,SLIDE_ACCEL_MPS2,SLIDE_BRAKE_MPS2} from '../src/sliding-tackle.mjs';
import {advanceFreePlayerKinematics} from '../src/individual-kinematics.mjs';

for(const side of ['home','away']){
 const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
 const source={attackingSide:side,attacker:{id:side+'-10',x:dir*29.6,y:0},
  defender:{id:other+'-2',x:dir*30.8,y:0,vx:-dir,vy:0,facingRad:dir===1?Math.PI:0},
  ball:{x:dir*30,y:0,z:0.11},velocity:{x:dir,y:0}};
 test('D-08 '+side+' sliding tackle starts only for an exposed reachable ball',()=>{
  assert.ok(planSlidingTackle(source));
  for(const change of [
   {defender:{...source.defender,x:dir*30.4}},
   {defender:{...source.defender,x:dir*32}},
   {defender:{...source.defender,vx:0}},
   {defender:{...source.defender,facingRad:dir===1?0:Math.PI}},
   {defender:{...source.defender,x:dir*29.1,vx:dir,facingRad:dir===1?0:Math.PI}},
   {ball:{...source.ball,z:0.5}},
   {velocity:{x:0,y:0}},
   {attacker:{...source.attacker,x:dir*27}}
  ])assert.equal(planSlidingTackle({...source,...change}),null);
 });
 test('D-08 '+side+' rapid bounded player movement and finite recovery',()=>{
  let state=null,peak=0,normalPeak=0;
  let player={...source.defender},normal={...source.defender};
  const limits={dt:1/60,maxSpeed:SLIDE_MAX_SPEED_MPS,acceleration:SLIDE_ACCEL_MPS2,braking:SLIDE_BRAKE_MPS2,turnRate:6,maxX:51.99,maxY:33.49};
  for(let tick=1;tick<=SLIDE_TICKS+SLIDE_RECOVERY_TICKS+1;tick++){
   state=advanceSlidingTackle({tick,previous:state,source,allowLaunch:tick===1});
   if(tick<=SLIDE_TICKS){
    assert.equal(state.phase,'slide');
    const next=advanceFreePlayerKinematics(player,state.plan.target,limits);
    normal=advanceFreePlayerKinematics(normal,state.plan.target,{...limits,maxSpeed:4,acceleration:6,braking:9});
    assert.ok(Math.hypot(next.x-player.x,next.y-player.y)<=7/60+1e-8);
    player=next;peak=Math.max(peak,Math.hypot(player.vx,player.vy));
    normalPeak=Math.max(normalPeak,Math.hypot(normal.vx,normal.vy));
    assert.equal(state.physicalContactProven,false);
    assert.equal('extensionM' in state,false);
   }else if(tick<=SLIDE_TICKS+SLIDE_RECOVERY_TICKS){
    assert.equal(state.phase,'recovery');
   }else assert.equal(state,null);
  }
  assert.ok(peak>4&&peak>normalPeak&&peak<=SLIDE_MAX_SPEED_MPS+1e-8);
  assert.ok((player.x-source.defender.x)*dir<0);
  state=advanceSlidingTackle({tick:1,source});
  state=advanceSlidingTackle({tick:2,previous:state,source,cancel:true});
  assert.equal(state.phase,'recovery');assert.equal(state.officialPossession,false);
 });
 test('D-09c '+side+' effective slide begins recovery immediately and can pursue before action lock expires',()=>{
  let state=advanceSlidingTackle({tick:1,source});
  const contact={tick:1,actorId:source.defender.id,intervention:'sliding-tackle',effective:true};
  for(let tick=2;tick<=2+EFFECTIVE_SLIDE_RECOVERY_TICKS;tick++){
   state=advanceSlidingTackle({tick,previous:state,source,allowLaunch:false,contact});
   if(tick===2+EFFECTIVE_SLIDE_RECOVERY_TICKS)assert.equal(state,null);
   else{assert.equal(state.phase,'recovery');assert.equal(state.canPursueDuringRecovery,tick>=2+EFFECTIVE_SLIDE_BRAKE_TICKS);assert.equal(state.officialPossession,false);}
  }
 });
}
