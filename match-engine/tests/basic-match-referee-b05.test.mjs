// #628 ACTIONS-B05 — actual original Rapier 60Hz full-ball goal / line
// exits; provisional referee and same-world dead-ball kickoff.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,BALL_RADIUS}
 from '../src/core.mjs';
import {PLAYER_PITCH,PLAYER_MAX_SPEED_MPS,INITIAL_PLAYERS,
 createPlayerMovement} from '../src/player-movement.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {ACTION_LAB_SCENARIOS,B05_LAB_STARTS}
 from '../src/action-lab-scenarios.mjs';
import {B05_REFEREE_VERSION,detectFirstFullyOutBallB05,
 createBasicMatchRefereeB05} from '../src/basic-match-referee-b05.mjs';

test('B05 exact full-ball goal plane, posts, bar, corners and boundary ordering (pure geometry)',()=>{
 assert.deepEqual(ACTION_LAB_SCENARIOS.filter(s=>
  ['goal','touchline','goal-line-out'].includes(s.id)).map(s=>s.id),
  ['goal','touchline','goal-line-out']);
 assert.equal(BALL_RADIUS,0.11);
 const x=PLAYER_PITCH.lengthM/2+BALL_RADIUS;
 const y=PLAYER_PITCH.widthM/2+BALL_RADIUS;
 const goal=detectFirstFullyOutBallB05(
  {x:51.8,y:0,z:0.11},{x:53,y:0,z:0.11});
 assert.equal(goal.edge,'goal');
 assert.equal(goal.fullBallCrossed,true);
 assert.equal(goal.axis,'x');
 assert.equal(goal.side,1);
 assert.ok(Math.abs(goal.intersection.x-x)<1e-8);
 assert.equal(detectFirstFullyOutBallB05(
  {x:51.8,y:0,z:2.6},{x:53,y:0,z:2.6}).edge,'goal-line');
 assert.equal(detectFirstFullyOutBallB05(
  {x:51.8,y:3.7,z:0.11},{x:53,y:3.7,z:0.11}).edge,'goal-line');
 const throwIn=detectFirstFullyOutBallB05(
  {x:0,y:33.8,z:0.11},{x:0,y:34.4,z:0.11});
 assert.equal(throwIn.edge,'touchline');
 assert.ok(Math.abs(throwIn.intersection.y-y)<1e-8);
 assert.equal(detectFirstFullyOutBallB05(
  {x:52.7,y:0,z:0.11},{x:53,y:0,z:0.11}),null,
  'already out of play cannot score twice');
 assert.equal(detectFirstFullyOutBallB05(
  {x:52.4,y:0,z:0.11},{x:52.59,y:0,z:0.11}),null,
  'entire ball must pass the goal line');
 assert.throws(()=>detectFirstFullyOutBallB05(
  {x:0,y:NaN,z:0.11},{x:53,y:0,z:0.11}),TypeError);
});
test('B05 isolated original core denies external restart authority and source-free inferred touches',
 async()=>{
 const R=await initializeRapier(rapier);
 const regular=createEngine(R,{preset:'roll'});
 try{
  assert.equal(Object.hasOwn(regular,'applyBasicRestartAtBoundary'),false);
 }finally{regular.dispose();}
 assert.throws(()=>createEngine(R,{preset:'roll'},
  {diagnosticBasicRestartEnabled:true}),TypeError);
 assert.throws(()=>createEngine(R,{preset:'roll'},
  {diagnosticBasicRestartEnabled:true,
   diagnosticPlayerFootContactsEnabled:true,
   diagnosticAutonomousFixtureActionEnabled:true}),TypeError);
 const source=createBasicMatchRefereeB05();
 assert.throws(()=>source.acknowledgeRestart({ready:true}),TypeError);
 assert.throws(()=>source.observe({physics:{tick:1}}),TypeError);
});
test('B05 HOME/AWAY original physics verified full-ball exits and native same-world GOAL→KICKOFF',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const id of ['goal','touchline','goal-line-out'])
  for(const side of ['home','away']){
   const a=createControlledActionLab(R,id,{shotSide:side});
   const b=createControlledActionLab(R,id,{shotSide:side});
   try{
    const zero=a.snapshot();
    assert.equal(zero.physicsTick,0);
    assert.equal(zero.players.length,22);
    assert.equal(zero.refereeEvidence.version,B05_REFEREE_VERSION);
    assert.equal(zero.refereeEvidence.lastEvent,null);
    assert.equal(zero.physicalRestart,null);
    assert.equal(new Set(zero.players.map(p=>p.id)).size,22);
    let first=null,afterRestart=null,physicsFrames=0;
    for(let tick=1;tick<=60;tick++){
     const x=a.step(),y=b.step();
     assert.equal(x.physicsTick,tick);
     assert.deepEqual(x.ball,y.ball,'same original real Rapier replay');
     assert.deepEqual(x.refereeEvidence,y.refereeEvidence);
     assert.deepEqual(x.physicalRestart,y.physicalRestart);
     assert.deepEqual(x.starts,y.starts);
     assert.equal(x.officialMatchResult,null);
     assert.equal(x.officialMatchPossession,false);
     assert.equal(x.scoreChanged,false);
     assert.equal(x.refereeEvidence.officialMatchResult,null);
     assert.equal(x.refereeEvidence.officialPossession,false);
     assert.equal(x.refereeEvidence.original22Source,true);
     for(const p of x.observedMovementPlayers)
      assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
     physicsFrames++;
     const e=x.refereeEvidence.lastEvent;
     if(e&&!first){
      first=e;
      assert.equal(e.tick,tick);
      assert.equal(e.crossing.fullBallCrossed,true);
      assert.equal(e.crossing.source,'real-consecutive-rapier-centres');
      assert.equal(e.originalRapierSource,true);
      assert.ok(e.gameClockS>0);
      assert.equal(e.officialResult,false);
      if(id==='goal'){
       assert.equal(e.kind,'goal');
       assert.equal(e.scoringTeam,side);
       assert.equal(e.restart.type,'kickoff');
       assert.equal(e.restart.team,side==='home'?'away':'home');
       assert.equal(e.provisionalGoalScored,true);
       assert.ok(x.physicalRestart?.originalRapierBallRepositioned,
        'real dead-ball same-world kickoff required');
       assert.equal(x.physicalRestart.sourceEventTick,e.tick);
       assert.equal(x.physicalRestart.realShoeContact,false);
       assert.equal(x.refereeEvidence.restartApplied,true);
       assert.equal(x.refereeEvidence.provisionalGoals[side],1);
      }else{
       assert.equal(e.kind,id==='touchline'?'touchline':'goal-line');
       assert.equal(e.scoringTeam,null);
       assert.equal(e.provisionalGoalScored,false);
       assert.equal(x.refereeEvidence.provisionalGoals.home,0);
       assert.equal(x.refereeEvidence.provisionalGoals.away,0);
       if(e.lastVerifiedTouch===null){
        assert.equal(e.restart.ready,false);
        assert.equal(x.physicalRestart,null,
         'never forge a dead-ball restart owner when no native shoe START');
       }else{
        assert.equal(e.lastVerifiedTouch.nativeExclusiveShoeStart,true);
        assert.equal(e.restart.ready,true);
        assert.equal(x.physicalRestart?.originalRapierBallRepositioned,true);
       }
      }
     }
     if(first&&tick===first.tick+1&&id==='goal'){
      afterRestart=x.ball.position;
      assert.ok(Math.abs(afterRestart.x)<0.2&&
       Math.abs(afterRestart.y)<0.2,
       'actual next fixed Rapier step must originate at the midfield restart');
     }
    }
    assert.ok(first,'actual physical full-ball exit required: '+id+' '+side);
    assert.ok(physicsFrames>=60);
    assert.equal(a.snapshot().eventCount,1,
     'one genuine goal/out event, never multiple from an already-out ball');
    if(id==='goal')assert.ok(afterRestart);
    process.stdout.write('ME_628_B05_'+id.toUpperCase()+'_'+side.toUpperCase()+' '+
     JSON.stringify({eventTick:first.tick,kind:first.kind,
      scoringTeam:first.scoringTeam,restart:first.restart.type,
      team:first.restart.team,verifiedLastShoe:first.lastVerifiedTouch?.playerId??null,
      physicalRestart:a.snapshot().physicalRestart?.originalRapierBallRepositioned??false,
      provisionalGoals:a.snapshot().refereeEvidence.provisionalGoals,
      officialMatchResult:null})+'\\n');
   }finally{a.dispose();b.dispose();}
  }
});
