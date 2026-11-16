// #628 B06b H2a - isolated LONG original-world physical 90 minute audit.
// Projections or abbreviated sessions may NEVER count as executed source ticks.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {createBasicRegulationSessionB06b} from '../src/basic-match-regulation-b06b.mjs';
import {B06_HALF_TICKS,B06_FULL_TICKS} from '../src/basic-match-clock-score-b06.mjs';
const R=await initializeRapier(rapier);
const session=createBasicRegulationSessionB06b(R);
const samples=[],started=Date.now();
let final=null;
try{
 const zero=session.snapshot();
 assert.equal(zero.physicsTick,0);
 assert.equal(zero.clockTicks,0);
 assert.equal(zero.realFull90MinutesVerified,false);
 for(let tick=1;tick<=B06_FULL_TICKS+7200;tick++){
  const s=session.step();
  assert.equal(s.physicsTick,tick);
  assert.equal(s.canonical22,true);
  assert.equal(s.matchAuthority,false);
  assert.equal(s.officialMatchResult,null);
  assert.equal(s.originalEventLedger.tick,tick);
  assert.equal(s.originalEventLedger.outstandingDeadBall,false);
  assert.ok(s.clockTicks<=B06_FULL_TICKS);
  if(tick%27000===0||s.halfTime?.physicsTick===tick||
    s.firstHalfKickoff?.tick===tick||s.secondHalfKickoff?.tick===tick||s.final){
    samples.push({physicalTick:tick,playedTicks:s.clockTicks,
     phase:s.phase,score:s.provisionalScore,
     events:s.originalEventLedger.matchEventCount});
    process.stdout.write('ME_628_B06B_H2A_PROGRESS '+JSON.stringify(samples.at(-1))+'\n');
  }
  if(s.final){final=s;break;}
 }
 assert.ok(final,'324000 really executed source ticks and true halftime restart required');
 assert.equal(final.clockTicks,B06_FULL_TICKS);
 assert.equal(final.clock.label,'90:00');
 assert.equal(final.firstHalfKickoff?.tick,1);
 assert.equal(final.firstHalfKickoff.genuineExclusiveOriginalShoeStart,true);
 assert.equal(final.halfTime?.physicsTick,B06_HALF_TICKS);
 assert.ok(final.secondHalfKickoff?.tick>B06_HALF_TICKS);
 assert.equal(final.secondHalfKickoff.genuineExclusiveOriginalShoeStart,true);
 assert.equal(final.final.complete90Minutes,true);
 assert.equal(final.realFull90MinutesVerified,true);
 assert.equal(final.fullFootballActionCoverageVerified,false);
 assert.equal(final.officialMatchResult,null);
 const report={
  source:'original-one-world-22-players-60hz-rapier',
  physicsSeconds:final.physicsTick*FIXED_DT,
  firstHalfKickoff:final.firstHalfKickoff,
  halfTime:final.halfTime,
  secondHalfKickoff:final.secondHalfKickoff,
  totalPhysicalTicks:final.physicsTick,totalPlayedTicks:final.clockTicks,
  pausedPhysicsTicks:final.physicsTick-final.clockTicks,
  score:final.provisionalScore,eventCount:final.originalEventLedger.matchEventCount,
  events:final.originalEventLedger.matchEvents,
  physical90MinutesVerified:true,completeFootballGameplayVerified:false,
  officialMatchResult:null,elapsedWallSeconds:(Date.now()-started)/1000,samples
 };
 writeFileSync('b06b-physical-90-report.json',JSON.stringify(report,null,2)+'\n');
 process.stdout.write('ME_628_B06B_H2A_COMPLETE '+JSON.stringify({
  realPlayedTicks:report.totalPlayedTicks,realPhysicsTicks:report.totalPhysicalTicks,
  firstKickoffTick:report.firstHalfKickoff.tick,
  secondKickoffTick:report.secondHalfKickoff.tick,
  completeFootballGameplayVerified:false,officialMatchResult:null})+'\n');
}finally{session.dispose();}
