import test from 'node:test';
import assert from 'node:assert/strict';
import {planSlidingTackle,advanceSlidingTackle,slidingShoePose,SLIDE_TICKS,SLIDE_RECOVERY_TICKS,SLIDE_MAX_EXTENSION_M} from '../src/sliding-tackle.mjs';

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
 test('D-08 '+side+' extended physical shoe pose retracts and defender recovers',()=>{
  let state=null,peak=0;
  const foot={x:source.defender.x,y:0,facingRad:source.defender.facingRad};
  for(let tick=1;tick<=SLIDE_TICKS+SLIDE_RECOVERY_TICKS+1;tick++){
   state=advanceSlidingTackle({tick,previous:state,source,allowLaunch:tick===1});
   if(tick<=SLIDE_TICKS){
    assert.equal(state.phase,'slide');
    const shifted=slidingShoePose(foot,state);
    assert.ok((shifted.x-foot.x)*dir<0);
    peak=Math.max(peak,Math.hypot(shifted.x-foot.x,shifted.y-foot.y));
    assert.equal(state.physicalContactProven,false);
   }else if(tick<=SLIDE_TICKS+SLIDE_RECOVERY_TICKS){
    assert.equal(state.phase,'recovery');assert.equal(state.extensionM,0);
    assert.equal(slidingShoePose(foot,state),foot);
   }else assert.equal(state,null);
  }
  assert.ok(Math.abs(peak-SLIDE_MAX_EXTENSION_M)<1e-8);
  state=advanceSlidingTackle({tick:1,source});
  state=advanceSlidingTackle({tick:2,previous:state,source,cancel:true});
  assert.equal(state.phase,'recovery');assert.equal(state.extensionM,0);
  assert.equal(state.officialPossession,false);
 });
}
