// #628 M31 — genuine source-backed opponent shoe-ball race, never possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as wasm from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_MIN_SEPARATION_M,createPlayerMovement}
 from '../src/player-movement.mjs';
import {CONTROL_LAB_STARTS} from '../src/action-lab-scenarios.mjs';
import {initialResearchControlLineup,CONTROL_CONTEST_DEFENDER_INITIAL}
 from '../src/research-control-initial-lineup.mjs';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createRealOpponentBallContestAuditM31,M31_CONTEST_TICKS}
 from '../src/real-opponent-ball-contest-m31.mjs';

test('M31 original 22-identity before-tick-zero contest fixture, mirrored and bounded',()=>{
 for(const side of ['home','away']){
  const start=initialResearchControlLineup(INITIAL_PLAYERS,
   CONTROL_LAB_STARTS[side],{side,contestDefender:true});
  assert.deepEqual(start.map(p=>p.id),INITIAL_PLAYERS.map(p=>p.id));
  const opponent=start.find(p=>p.id===(side==='home'?'away-7':'home-7'));
  const receiver=start.find(p=>p.id===side+'-9');
  assert.equal(opponent.x,side==='home'?
   CONTROL_CONTEST_DEFENDER_INITIAL.x:-CONTROL_CONTEST_DEFENDER_INITIAL.x);
  assert.ok(Math.hypot(opponent.x-receiver.x,opponent.y-receiver.y)>2.5);
  for(let i=0;i<22;i++)for(let j=i+1;j<22;j++)
   assert.ok(Math.hypot(start[i].x-start[j].x,start[i].y-start[j].y)>=
    PLAYER_MIN_SEPARATION_M-1e-8,'only physical 22-player separation');
  for(const conflict of [{side,contestDefender:true,spaceDefender:true},
   {side,contestDefender:true,closeDefender:true},
   {side,contestDefender:true,opponentFirst:true}])
   assert.throws(()=>initialResearchControlLineup(INITIAL_PLAYERS,
    CONTROL_LAB_STARTS[side],conflict),TypeError);
  assert.throws(()=>createPlayerMovement({
   researchControlReceiver:true,researchControlSide:side,
   researchControlBall:CONTROL_LAB_STARTS[side],
   researchControlContestDefender:true,researchControlSpaceDefender:true
  }),TypeError);
 }
});

test('M31 source rejects fabricated player/ball and duplicate tick',()=>{
 const observer=createRealOpponentBallContestAuditM31();
 assert.throws(()=>observer.snapshot(),TypeError);
 assert.throws(()=>observer.observe({}),TypeError);
 const physics={tick:0,ball:{position:{x:0,y:0,z:0.11},
  velocity:{x:0,y:0,z:0}}};
 const frame={tick:0,players:INITIAL_PLAYERS.map(p=>({...p,vx:0,vy:0}))};
 const foot={tick:0,started:[],ended:[],active:[]};
 const m30={tick:0,active:null,latestCompleted:null,readOnly:true,
  matchAuthority:false,verifiedPossession:false};
 const empty=observer.observe({physics,playerFrame:frame,foot,solver:null,
  m30,tap:null});
 assert.equal(empty.tick,0);assert.equal(empty.active,null);
 assert.throws(()=>observer.observe({physics,playerFrame:frame,foot,
  solver:null,m30,tap:null}),TypeError);
 assert.equal(observer.snapshot().tick,0);
});

test('M31 core experiment has no access without genuine M30 source flags',
 {timeout:25000},async()=>{
 const R=await initializeRapier(wasm);
 for(const bad of [
  {diagnosticResearchControlContestDefender:true},
  {diagnosticResearchControlContestDefender:true,
   diagnosticResearchControlReceiver:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true},
  {diagnosticResearchControlContestDefender:true,
   diagnosticResearchControlReceiver:true,
   diagnosticResearchReceivingCushionEnabled:true,
   diagnosticResearchReceivingDecisionEnabled:true,
   diagnosticResearchReceiverTapEnabled:true,
   diagnosticResearchControlSpaceDefender:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true}
 ])assert.throws(()=>createEngine(R,CONTROL_LAB_STARTS.home,bad),TypeError);
 const normal=createControlledActionLab(R,'control',{controlScene:'receive'});
 try{assert.equal(normal.snapshot().realOpponentContest,undefined);}
 finally{normal.dispose();}
});

test('M31 original Rapier contested source and M30 baseline: mirrored deterministic native-only evidence',
 {timeout:120000},async()=>{
 const R=await initializeRapier(wasm);
 for(const side of ['home','away']){
  const baseline=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-release'
  });
  const contested=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-contest'
  });
  const replay=createControlledActionLab(R,'control',{
   controlSide:side,controlScene:'receive-contest'
  });
  try{
   let opponentStart=null,tapTick=null,completed=null;
   let baselineCompleted=null,minimumSourceOpponentGap=Infinity;
   assert.equal(baseline.snapshot().realOpponentContest.active,null);
   for(let t=1;t<=63+M31_CONTEST_TICKS;t++){
    const a=contested.step(),b=baseline.step(),c=replay.step();
    assert.deepEqual(a,c,'all 60Hz events and physical motion must replay');
    assert.equal(a.officialMatchPossession,false);
    assert.equal(a.realOpponentContest.tick,t);
    assert.equal(a.realOpponentContest.verifiedTackle,false);
    assert.equal(a.realOpponentContest.verifiedInterception,false);
    assert.equal(a.realOpponentContest.verifiedPossession,false);
    assert.equal(a.action?.officialMatchAction??false,false);
    assert.equal(b.realOpponentContest.verifiedPossession,false);
    if(a.physicalReceiverTap?.tick===t)tapTick=t;
    if(a.realOpponentContest.active){
     const q=a.realOpponentContest.active;
     minimumSourceOpponentGap=Math.min(minimumSourceOpponentGap,
      q.minimumRealOpponentToBallGapM);
     if(q.opposingShoeContactIsNative&&!opponentStart){
      opponentStart={tick:q.firstOpposingNativeShoeStartTick,
       id:q.firstOpposingNativeShoeStartPlayerId};
      assert.deepEqual(a.starts.includes(opponentStart.id),true,
       'opponent challenge must originate in current true Rapier shoe START');
     }
    }
    completed=a.realOpponentContest.latestCompleted??completed;
    baselineCompleted=b.realOpponentContest.latestCompleted??baselineCompleted;
   }
   assert.ok(baselineCompleted,'M30 original released receiver source retained');
   assert.equal(baselineCompleted.firstReceiverIndependentNativeRecontactTick,136);
   assert.equal(baselineCompleted.opposingShoeContactIsNative,false);
   assert.equal(baselineCompleted.verifiedPossession,false);
   if(completed){
    assert.equal(completed.observationComplete,true);
    assert.equal(completed.observedTicks,M31_CONTEST_TICKS);
    assert.equal(completed.actorId,side+'-9');
    assert.equal(completed.verifiedControl,false);
    assert.equal(completed.verifiedInterception,false);
    assert.equal(completed.verifiedTackle,false);
    assert.equal(completed.officialPossession,false);
    assert.equal(completed.opposingShoeContactIsNative,opponentStart!==null);
    if(opponentStart){
     assert.equal(completed.firstOpposingNativeShoeStartTick,opponentStart.tick);
     assert.equal(completed.firstOpposingNativeShoeStartPlayerId,opponentStart.id);
    }
   }else{
    assert.equal(tapTick,null,
     'no genuine M30 tap means M31 must not invent a physical contest episode');
   }
   process.stdout.write('ME_628_M31_TRUE_CONTEST_'+side.toUpperCase()+' '+
    JSON.stringify({tapTick,opponentStart,minimumSourceOpponentGap:
     Number.isFinite(minimumSourceOpponentGap)?minimumSourceOpponentGap:null,
     report:completed,officialPossession:false})+'\\n');
  }finally{baseline.dispose();contested.dispose();replay.dispose();}
 }
});
