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
  assert.equal(full.physicsTick,240+pauseTicks);
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
    90MinuteMatchVerified:false,officialResult:null})+'\\n');
 }finally{a.dispose();b.dispose();}
});
