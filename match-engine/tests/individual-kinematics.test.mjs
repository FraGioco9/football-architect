import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFreePlayerKinematics,advancePlayerOrientation} from '../src/individual-kinematics.mjs';
import {createPlayerMovement,PLAYER_DT,PLAYER_PITCH,PLAYER_RADIUS_M,
 PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS,PLAYER_ACCEL_MPS2,
 PLAYER_BRAKE_MPS2,PLAYER_TURN_RAD_PER_S} from '../src/player-movement.mjs';
const limits=Object.freeze({
 dt:PLAYER_DT,maxSpeed:PLAYER_MAX_SPEED_MPS,
 acceleration:PLAYER_ACCEL_MPS2,braking:PLAYER_BRAKE_MPS2,
 turnRate:PLAYER_TURN_RAD_PER_S,
 maxX:PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M,
 maxY:PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M
});
const close=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps,String(a)+' vs '+String(b));
const headingChange=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
test('ME-628 M1 mirrors HOME/AWAY free steps at 60 Hz without teleports',()=>{
 let home={x:-8,y:0,vx:0,vy:0},away={x:8,y:0,vx:0,vy:0};
 let homeFacing=0,awayFacing=Math.PI;
 let firstSpeed=0;
 for(let tick=0;tick<240;tick++){
  const oldHome=home,oldAway=away;
  home=advanceFreePlayerKinematics(home,{x:8,y:4},limits);
  away=advanceFreePlayerKinematics(away,{x:-8,y:4},limits);
  homeFacing=advancePlayerOrientation(homeFacing,home.vx,home.vy,limits);
  awayFacing=advancePlayerOrientation(awayFacing,away.vx,away.vy,limits);
  if(tick===0)firstSpeed=Math.hypot(home.vx,home.vy);
  close(home.x,-away.x);close(home.y,away.y);
  close(home.vx,-away.vx);close(home.vy,away.vy);
  assert.ok(Math.hypot(home.vx,home.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
  assert.ok(Math.hypot(home.x-oldHome.x,home.y-oldHome.y)<=
    PLAYER_MAX_SPEED_MPS*PLAYER_DT+1e-8);
  assert.ok(Math.hypot(home.vx-oldHome.vx,home.vy-oldHome.vy)<=
    PLAYER_BRAKE_MPS2*PLAYER_DT+1e-8);
  assert.ok(Object.isFrozen(home)&&Object.isFrozen(away));
  assert.ok(Math.hypot(away.vx-oldAway.vx,away.vy-oldAway.vy)<=
    PLAYER_BRAKE_MPS2*PLAYER_DT+1e-8);
 }
 close(firstSpeed,PLAYER_ACCEL_MPS2*PLAYER_DT);
 close(headingChange(homeFacing,Math.PI-awayFacing),0,1e-7);
});
test('ME-628 M1 brakes at target, stays inside pitch and keeps zero-speed facing',()=>{
 let p={x:0,y:0,vx:0,vy:0};
 for(let tick=0;tick<360;tick++)p=advanceFreePlayerKinematics(p,{x:2,y:0},limits);
 assert.ok(Math.abs(p.x-2)<0.04,'end x='+p.x);
 assert.ok(Math.hypot(p.vx,p.vy)<0.25);
 assert.equal(advancePlayerOrientation(-2,0,0,limits),-2);
 const edge=advanceFreePlayerKinematics({
  x:limits.maxX-0.001,y:limits.maxY-0.001,vx:7,vy:7
 },{x:limits.maxX+10,y:limits.maxY+10},limits);
 assert.equal(edge.x,limits.maxX);
 assert.equal(edge.y,limits.maxY);
 assert.equal(edge.vx,0);assert.equal(edge.vy,0);
});
test('ME-628 M1 turn bound and stationary heading rely on actual velocity',()=>{
 let facing=0;
 for(let tick=0;tick<30;tick++){
  const next=advancePlayerOrientation(facing,0,2,limits);
  assert.ok(Math.abs(headingChange(next,facing))<=PLAYER_TURN_RAD_PER_S*PLAYER_DT+1e-12);
  facing=next;
 }
 assert.ok(facing>1.4);
 assert.equal(advancePlayerOrientation(facing,0,0,limits),facing);
});
test('ME-628 M1 rejects invalid current samples and nonfinite kinematic limits',()=>{
 const body={x:0,y:0,vx:0,vy:0},target={x:1,y:0};
 assert.throws(()=>advanceFreePlayerKinematics({...body,vx:NaN},target,limits),TypeError);
 assert.throws(()=>advanceFreePlayerKinematics(body,{x:Infinity,y:0},limits),TypeError);
 assert.throws(()=>advanceFreePlayerKinematics(body,target,{...limits,dt:0}),TypeError);
 assert.throws(()=>advancePlayerOrientation(NaN,1,0,limits),TypeError);
 assert.throws(()=>advancePlayerOrientation(0,0,1,{...limits,turnRate:-1}),TypeError);
});
test('ME-628 M1 canonical 22-player runner deterministic with 0.98 m separation',()=>{
 const a=createPlayerMovement(),b=createPlayerMovement();
 for(let tick=0;tick<180;tick++){
  const ball={x:10*Math.sin(tick/30),y:7*Math.cos(tick/25)};
  const one=a.step(ball),two=b.step(ball);
  assert.deepEqual(one,two);
  assert.equal(one.players.length,22);
  assert.equal(one.tick,tick+1);
  for(const p of one.players){
   assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
   assert.ok(Math.abs(p.x)<=limits.maxX+1e-8);
   assert.ok(Math.abs(p.y)<=limits.maxY+1e-8);
  }
  for(let i=0;i<22;i++)for(let j=i+1;j<22;j++){
   const p=one.players[i],q=one.players[j];
   assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
  assert.equal('officialPossession' in one,false);
  assert.equal('officialMatchAction' in one,false);
 }
 assert.deepEqual(a.reset().snapshot(),createPlayerMovement().snapshot());
});
