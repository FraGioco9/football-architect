// #628 B06b H1: real original Rapier 22-player half-time and resumed
// second half, with bounded mini-period only for fast CI acceptance.
// Mini-period success is NEVER evidence that 90 minutes ran.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,createEngine,BALL_RADIUS} from '../src/core.mjs';
import {INITIAL_PLAYERS,createPlayerMovement,
 PLAYER_MAX_SPEED_MPS,PLAYER_MIN_SEPARATION_M}
 from '../src/player-movement.mjs';
import {createBasicRegulationSessionB06b,B06B_SESSION_VERSION}
 from '../src/basic-match-regulation-b06b.mjs';
import {B06_HALF_TICKS,B06_FULL_TICKS}
 from '../src/basic-match-clock-score-b06.mjs';
import {initialB06bOpeningLineup}
 from '../src/basic-opening-kickoff-lineup-b06b.mjs';

test('B06b H1 isolated original-world halftime source rejects unrelated action modes, short/synthetic intervals and frames',async()=>{
 const R=await initializeRapier(rapier);
 for(const n of [0,1,30,-1,1.3,Infinity])
  assert.throws(()=>createBasicRegulationSessionB06b(R,{
   researchHalfTicks:n
  }),TypeError);
 assert.throws(()=>createEngine(R,{preset:'roll'},{
  diagnosticB06bHalftimeTick:120
 }),/B06b/);
 assert.throws(()=>createEngine(R,{preset:'roll'},{
  diagnosticB06bHalftimeTick:120,
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true
 }),/B06b/);
 assert.throws(()=>createPlayerMovement({researchB06bHalftimeTick:119}),TypeError);
 const ordinary=createEngine(R,{preset:'roll'});
 try{
  assert.equal(ordinary.b06bOriginalHalftimePlacement,undefined);
  assert.equal(ordinary.b06bOriginalSecondHalfKickoff,undefined);
 }finally{ordinary.dispose();}
 const guarded=createEngine(R,{preset:'roll'},{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticB06bHalftimeTick:120
 });
 try{
  assert.throws(()=>guarded.b06bOriginalHalftimePlacement({
   tick:120,players:INITIAL_PLAYERS
  }),/halftime/);
  assert.throws(()=>guarded.b06bOriginalSecondHalfKickoff({
   tick:121,players:INITIAL_PLAYERS
  }),/kickoff/);
 }finally{guarded.dispose();}
});

test('B06b H1 true HOME/AWAY 22-player 60Hz continuous two-half MINIATURE: halftime paused only for genuine same-ball AWAY #10 native kickoff',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const a=createBasicRegulationSessionB06b(R,{researchHalfTicks:120});
 const b=createBasicRegulationSessionB06b(R,{researchHalfTicks:120});
 try{
  let fa=a.snapshot(),fb=b.snapshot(),pauseTicks=0;
  assert.equal(fa.version,B06B_SESSION_VERSION);
  assert.equal(fa.physicsTick,0);
  assert.equal(fa.clockTicks,0);
  assert.equal(fa.phase,'first-half');
  assert.equal(fa.canonical22,true);
  assert.equal(fa.halfTime,null);
  assert.equal(fa.secondHalfKickoff,null);
  assert.equal(fa.realFull90MinutesVerified,false);
  assert.equal(fa.officialMatchResult,null);
  let halftime=null,kickoff=null,full=null;
  for(let t=1;t<=900;t++){
   fa=a.step();fb=b.step();
   assert.deepEqual(fa.physicsBall,fb.physicsBall,
    'same original Rapier physical ball deterministic');
   assert.equal(fa.physicsTick,t);
   assert.equal(fa.canonical22,true);
   assert.equal(fa.matchAuthority,false);
   assert.equal(fa.officialMatchResult,null);
   assert.equal(fa.originalEventLedger.officialMatchResult,null);
   assert.deepEqual(fa.provisionalScore,fb.provisionalScore);
   if(!halftime&&fa.halfTime){
    halftime=fa.halfTime;
    assert.equal(t,120);
    assert.equal(halftime.phase,'half-time');
    assert.equal(halftime.physicsTick,120);
    assert.equal(halftime.restartTeam,'away');
    assert.equal(halftime.actualOriginalRapierBallPlaced,true);
    assert.equal(halftime.realShoesNotFabricated,true);
    assert.equal(halftime.playerTeleports,false);
    assert.equal(halftime.ball.position.x,0);
    assert.equal(halftime.ball.position.y,0);
    assert.ok(Math.abs(halftime.ball.position.z-BALL_RADIUS)<1e-8);
    assert.equal(fa.clockTicks,120);
   }
   if(halftime&&!kickoff){
    assert.equal(fa.clockTicks,120,
     'the game clock freezes for genuine on-field player approach');
    pauseTicks++;
   }
   if(!kickoff&&fa.secondHalfKickoff){
    kickoff=fa.secondHalfKickoff;
    assert.equal(kickoff.tick,t);
    assert.ok(kickoff.tick>120);
    assert.equal(kickoff.team,'away');
    assert.equal(kickoff.actorId,'away-10');
    assert.equal(kickoff.genuineExclusiveOriginalShoeStart,true);
    assert.equal(kickoff.currentRapierContactManifold,true);
    assert.equal(kickoff.originalBallImpulseApplied,true);
    assert.equal(kickoff.sameRapierWorldAsFirstHalf,true);
    assert.equal(kickoff.officialMatchAction,false);
    assert.equal(fa.clockTicks,120);
    assert.equal(fa.phase,'second-half');
   }
   if(fa.final){full=fa.final;break;}
  }
  assert.ok(halftime,'physical half-time ball placement expected');
  assert.ok(kickoff,'second-half original AWAY shoe START required');
  assert.ok(full,'must physically advance ALL 120 extra second-half game ticks');
  assert.ok(pauseTicks>=1);
  assert.equal(full.gameClockTicks,240);
  assert.equal(full.physicsTick,239+pauseTicks);
  assert.equal(fa.phase,'full-time');
  assert.equal(fa.clockTicks,240);
  assert.equal(fa.clock.label,'00:04');
  assert.equal(fa.clock.completedMatchVerified,false);
  assert.equal(fa.realFull90MinutesVerified,false,
   'abbreviated genuine replay cannot be described as a 90-minute match');
  assert.equal(full.twoPhysicalHalvesAndNativeKickoff,true);
  assert.equal(full.complete90Minutes,false);
  assert.equal(full.officialMatchResult,null);
  assert.equal(fa.provisionalScore.home,0);
  assert.equal(fa.provisionalScore.away,0);
  assert.equal(full.winner,'draw');
  assert.throws(()=>a.step(),/cannot step/);
  process.stdout.write('ME_628_B06B_AUTHENTIC_MINI_REPLAY '+
   JSON.stringify({halfStart:120,actualHalftimeTick:halftime.physicsTick,
    nativeSecondHalfKickoffTick:kickoff.tick,realPhysicsTicks:full.physicsTick,
    actualActiveGameTicks:full.gameClockTicks,
    excludedRealHalftimePhysicsTicks:pauseTicks,
    score:fa.provisionalScore,originalShoe:true,
    full90MinuteMatchVerified:false,officialResult:null})+'\\n');
 }finally{a.dispose();b.dispose();}
});

test('B06b H2a original opening requires true HOME shoe and 22 canonical players',async()=>{
 const staged=initialB06bOpeningLineup(INITIAL_PLAYERS);
 assert.deepEqual(staged.map(p=>p.id),INITIAL_PLAYERS.map(p=>p.id));
 assert.equal(staged.find(p=>p.id==='home-10').x,-0.28);
 assert.equal(INITIAL_PLAYERS.find(p=>p.id==='home-10').x,-5);
 for(let i=0;i<staged.length;i++)for(let j=i+1;j<staged.length;j++)
  assert.ok(Math.hypot(staged[i].x-staged[j].x,staged[i].y-staged[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
 const R=await initializeRapier(rapier);
 assert.throws(()=>createEngine(R,{preset:'roll'},{diagnosticB06bOpeningKickoffEnabled:true}),/B06b opening/);
 assert.throws(()=>createPlayerMovement({researchB06bOpeningKickoffEnabled:true}),TypeError);
 const ordinary=createBasicRegulationSessionB06b(R,{researchHalfTicks:120});
 const actual=createBasicRegulationSessionB06b(R,{researchHalfTicks:120,researchOpeningKickoff:true});
 try{
  assert.equal(ordinary.snapshot().firstHalfKickoff,null);
  assert.equal(actual.snapshot().phase,'opening-kickoff');
  const first=actual.step();
  assert.equal(first.physicsTick,1);
  assert.equal(first.clockTicks,1);
  assert.equal(first.phase,'first-half');
  assert.equal(first.firstHalfKickoff?.tick,1);
  assert.equal(first.firstHalfKickoff.actorId,'home-10');
  assert.equal(first.firstHalfKickoff.genuineExclusiveOriginalShoeStart,true);
  assert.equal(first.firstHalfKickoff.currentRapierContactManifold,true);
  assert.equal(first.firstHalfKickoff.originalBallImpulseApplied,true);
  assert.equal(first.firstHalfKickoff.officialMatchResult,null);
  assert.equal(first.canonical22,true);
 }finally{ordinary.dispose();actual.dispose();}
});

test('B06b H2a two real physical kickoffs in a mini replay are NOT a complete 90m match',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const run=createBasicRegulationSessionB06b(R,{researchHalfTicks:120,researchOpeningKickoff:true});
 try{
  let last=null;
  for(let i=0;i<900;i++){
   const s=run.step();
   if(s.final){last=s;break;}
  }
  assert.ok(last);
  assert.equal(last.clockTicks,240);
  assert.equal(last.firstHalfKickoff?.actorId,'home-10');
  assert.equal(last.secondHalfKickoff?.actorId,'away-10');
  assert.equal(last.halfTime?.physicsTick,120);
  assert.equal(last.final.firstHalfNativeKickoffVerified,true);
  assert.equal(last.final.complete90Minutes,false);
  assert.equal(last.realFull90MinutesVerified,false);
  assert.equal(last.fullFootballActionCoverageVerified,false);
  assert.equal(last.officialMatchResult,null);
 }finally{run.dispose();}
});

test('B06b H2b1 rejects invented goal restart modes and authority outside the isolated private source',async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['invalid','HOME',42])
  assert.throws(()=>createBasicRegulationSessionB06b(R,{
   researchHalfTicks:1200,researchGoalCrossingSide:side
  }),TypeError);
 assert.throws(()=>createBasicRegulationSessionB06b(R,{
  researchGoalCrossingSide:'home'
 }),/bounded/);
 assert.throws(()=>createBasicRegulationSessionB06b(R,{
  researchHalfTicks:1200,researchGoalCrossingSide:'away',
  researchOpeningKickoff:true
 }),/non-opening/);
 assert.throws(()=>createEngine(R,{preset:'roll'},{
  diagnosticB06bGoalRestartEnabled:true
 }),/goal restart/);
 assert.throws(()=>createPlayerMovement({
  researchB06bGoalRestartEnabled:true
 }),TypeError);
 const ordinary=createEngine(R,{preset:'roll'});
 try{
  assert.equal(ordinary.b06bOriginalPlaceGoalRestart,undefined);
  assert.equal(ordinary.b06bOriginalTakeGoalRestart,undefined);
 }finally{ordinary.dispose();}
});

test('B06b H2b1 HOME and AWAY genuine whole-ball GOAL -> same original ball placement -> independent native opposing #10 kickoff',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const one=createBasicRegulationSessionB06b(R,{
   researchHalfTicks:1200,researchGoalCrossingSide:side
  });
  const two=createBasicRegulationSessionB06b(R,{
   researchHalfTicks:1200,researchGoalCrossingSide:side
  });
  try{
   let crossed=null,kicked=null,holdTicks=0;
   for(let n=1;n<=800;n++){
    const a=one.step(),b=two.step();
    assert.equal(a.physicsTick,n);
    assert.deepEqual(a.physicsBall,b.physicsBall,
      'only the original same-world deterministic Rapier ball is integrated');
    assert.deepEqual(a.provisionalScore,b.provisionalScore);
    assert.equal(a.canonical22,true);
    assert.equal(a.matchAuthority,false);
    assert.equal(a.officialMatchResult,null);
    assert.equal(a.realFull90MinutesVerified,false);
    if(!crossed&&a.goalRestartPlacements.length){
     crossed=a;
     assert.equal(a.goalRestartPlacements.length,1);
     const placement=a.goalRestartPlacements[0];
     assert.equal(placement.sourceEventTick,n);
     assert.equal(placement.tick,n);
     assert.equal(placement.kind,'kickoff');
     assert.equal(placement.assignedTeam,side==='home'?'away':'home');
     assert.equal(placement.originalRapierBallRepositioned,true);
     assert.equal(placement.realShoeContact,false);
     assert.equal(placement.ball.position.x,0);
     assert.equal(placement.ball.position.y,0);
     assert.ok(Math.abs(placement.ball.position.z-BALL_RADIUS)<1e-8);
     assert.equal(a.physicsBall.position.x,0);
     assert.equal(a.physicsBall.position.y,0);
     assert.equal(a.refereeSource.lastEvent.kind,'goal');
     assert.equal(a.refereeSource.lastEvent.scoringTeam,side);
     assert.equal(a.refereeSource.lastEvent.crossing.fullBallCrossed,true);
     assert.equal(a.refereeSource.restartApplied,true);
     assert.equal(a.originalEventLedger.matchEventCount,2);
     assert.deepEqual(a.originalEventLedger.matchEvents.map(e=>e.type),
      ['goal','restart-placement']);
     assert.equal(a.originalEventLedger.outstandingDeadBall,false);
     assert.equal(a.provisionalScore[side],1);
     assert.equal(a.provisionalScore[side==='home'?'away':'home'],0);
     assert.equal(a.phase,'goal-kickoff');
    }
    if(crossed&&!a.genuineGoalKickoffs.length){
     holdTicks++;
     assert.equal(a.clockTicks,crossed.clockTicks,
      'goal restart cannot consume football match time before genuine taker');
    }
    if(a.genuineGoalKickoffs.length){
     kicked=a;
     const take=a.genuineGoalKickoffs[0];
     assert.equal(take.tick,n);
     assert.ok(n>crossed.physicsTick);
     assert.equal(take.team,side==='home'?'away':'home');
     assert.equal(take.actorId,take.team+'-10');
     assert.equal(take.sourceEventTick,crossed.physicsTick);
     assert.equal(take.genuineExclusiveOriginalShoeStart,true);
     assert.equal(take.currentRapierContactManifold,true);
     assert.equal(take.originalBallImpulseApplied,true);
     assert.equal(take.sameOriginalRapierWorld,true);
     assert.equal(take.officialMatchResult,null);
     assert.equal(a.pausedGoalPhysicsTicks,n-crossed.physicsTick);
     assert.equal(a.clockTicks,crossed.clockTicks);
     assert.equal(a.phase,'first-half');
     break;
    }
   }
   assert.ok(crossed,side+' original full-ball goal crossing was not observed');
   assert.ok(kicked,side+' original opposition foot kickoff never happened');
   assert.ok(holdTicks>=1,'goal dead ball must pause live time');
   for(let n=0;n<5;n++){
    const x=one.step();
    assert.equal(x.clockTicks,kicked.clockTicks+n+1);
    assert.equal(x.originalEventLedger.outstandingDeadBall,false);
    assert.equal(x.provisionalScore[side],1);
    assert.equal(x.genuineGoalKickoffs.length,1);
   }
   process.stdout.write('ME_628_B06B_H2B1_GOAL_NATIVE_RESTART '+
    JSON.stringify({side,goalTick:crossed.physicsTick,
     realKickoffTick:kicked.physicsTick,
     pausedPhysicsTicks:kicked.pausedGoalPhysicsTicks,
     provisionalScore:kicked.provisionalScore,
     source:'real-original-rapier-22',actualShotActorVerified:false,
     officialResult:null})+'\\n');
  }finally{one.dispose();two.dispose();}
 }
});
