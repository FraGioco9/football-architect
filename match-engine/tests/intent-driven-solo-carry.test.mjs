import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {chooseIntentSoloCarryTouch} from '../src/intent-driven-solo-carry.mjs';

const args={
 tick:1,lastTouchTick:-100,attackingSide:'home',phase:'control',
 player:{id:'home-10',team:'home',x:29.45,y:0,vx:1,vy:0},
 ballPosition:{x:30,y:0,z:0.11},ballVelocity:{x:0,y:0,z:0},
 ballRadiusM:0.11
};
test('#628 intentional Solo Carry uses real proximity and a stronger single Rapier impulse',()=>{
 const first=chooseIntentSoloCarryTouch(args);
 assert.ok(first);
 assert.equal(first.action,'carry');
 assert.equal(first.nativeShoeContactVerified,false);
 assert.ok(first.impulseNs.x>0.7);
 assert.equal(first.impulseNs.z,0);
 assert.equal(chooseIntentSoloCarryTouch({...args,tick:2,lastTouchTick:1}),null);
 assert.equal(chooseIntentSoloCarryTouch({...args,ballPosition:{
  ...args.ballPosition,x:31.7}}),null);
 assert.equal(chooseIntentSoloCarryTouch({...args,ballPosition:{
  ...args.ballPosition,z:0.5}}),null);
 assert.equal(chooseIntentSoloCarryTouch({...args,ballVelocity:{
  ...args.ballVelocity,x:4}}),null);
 const away=chooseIntentSoloCarryTouch({...args,attackingSide:'away',
  player:{...args.player,id:'away-10',team:'away',x:-29.45},
  ballPosition:{...args.ballPosition,x:-30}});
 assert.ok(away&&away.impulseNs.x<0);
 assert.equal(Math.abs(away.impulseNs.x),first.impulseNs.x);
 assert.throws(()=>chooseIntentSoloCarryTouch({...args,tick:0}),TypeError);
 assert.throws(()=>chooseIntentSoloCarryTouch({...args,
  player:{...args.player,id:'away-10'}}),TypeError);
});

test('#628 optional Intent Carry: fewer stronger GAMEPLAY pushes, real freely moving ball, no native shoe START', {timeout:40000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away'])for(const variantIndex of [0,3]){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex,intentDrivenSoloCarry:true
  });
  try{
   const initialBallX=lab.snapshot().ball.position.x;
   let kicks=0,maxSpeed=0,nativeStarts=0,lastTouch=null;
   const phases=new Set();
   let end;
   for(let tick=1;tick<=180;tick++){
    const f=lab.step();end=f;
    assert.equal(f.intentDrivenCarry,true);
    assert.equal(f.nativeShoeContactClaimed,false);
    nativeStarts+=f.soloNativeFeet?.started.length??0;
    phases.add(f.soloCarryPhase.phase);
    maxSpeed=Math.max(maxSpeed,Math.hypot(f.ball.velocity.x,f.ball.velocity.y));
    if(f.action){
     kicks++;
     assert.equal(f.action.action,'carry');
     assert.equal(f.action.nativeShoeContactVerified,false);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     assert.equal(f.action.decisionContext.intentDrivenSoloCarry,true);
     assert.equal(f.action.playerId,side+'-10');
     if(lastTouch!==null)assert.ok(tick-lastTouch>=24);
     lastTouch=tick;
    }
   }
   const advance=(side==='home'?1:-1)*
    (end.ball.position.x-initialBallX);
   process.stdout.write('ME_628_INTENT_CARRY '+JSON.stringify({
    side,variantIndex,kicks,nativeStarts,maxSpeed,advance,
    phases:[...phases]
   })+'\\n');
   assert.equal(nativeStarts,0,'No simulated native shoe contact is claimed');
   assert.ok(kicks>=1&&kicks<=4,'Fewer clear deliberate touches over 3 seconds');
   assert.ok(maxSpeed<=4.5,'Physical ball remains at plausible running speed');
   assert.ok(advance>3.5,'The player must truly move the original Rapier ball');
  }finally{lab.dispose();}
 }
});
