// #628 B06a — 90-minute match clock boundary and source-gated
// provisional goals / restart / set-piece event ledger.
// Does NOT simulate 90 minutes, half-time kickoff or a final official result.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,ENGINE_VERSION,FIXED_DT} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {createBasicMatchTimelineB06,basicMatchClockB06,
 B06_HALF_TICKS,B06_FULL_TICKS,B06_TIMELINE_VERSION}
 from '../src/basic-match-clock-score-b06.mjs';

test('B06 clock counts only exact original 60Hz ticks; 45/90-minute boundaries are projections, not completed play',()=>{
 assert.equal(FIXED_DT,1/60);
 assert.equal(B06_HALF_TICKS,162000);
 assert.equal(B06_FULL_TICKS,324000);
 for(const [ticks,label,phase] of [
  [0,'00:00','first-half'],
  [60,'00:01','first-half'],
  [3600,'01:00','first-half'],
  [161999,'44:59','first-half'],
  [162000,'45:00','half-time-boundary'],
  [162001,'45:00','second-half-clock-projection'],
  [180000,'50:00','second-half-clock-projection'],
  [323999,'89:59','second-half-clock-projection'],
  [324000,'90:00','full-time-clock-boundary'],
  [324001,'90:00','full-time-clock-boundary']
 ]){
  const c=basicMatchClockB06(ticks);
  assert.equal(c.label,label);
  assert.equal(c.phase,phase);
  assert.equal(c.sourceTick,ticks);
  assert.equal(c.halfTimeRestartVerified,false);
  assert.equal(c.completedMatchVerified,false);
  assert.equal(c.readOnlyClock,true);
 }
 for(const input of [-1,1.2,NaN,Infinity,null,undefined,'60'])
  assert.throws(()=>basicMatchClockB06(input),TypeError);
});
test('B06 fails closed on absent B05 source, duplicate ticks, false goals, fake physics and invented restart',async()=>{
 const score=createBasicMatchTimelineB06();
 assert.equal(score.snapshot().provisionalScore.home,0);
 assert.equal(score.snapshot().officialMatchResult,null);
 assert.throws(()=>score.observe({}),TypeError);
 assert.throws(()=>score.recordRestart({physicsTick:0,
  refereeEvidence:{},physicalRestart:{}}),TypeError);
 assert.throws(()=>score.recordSetPiece({physicsTick:0,take:{}}),TypeError);
 const R=await initializeRapier(rapier);
 const a=createControlledActionLab(R,'goal',{shotSide:'home'});
 try{
  const first=a.snapshot();
  assert.equal(first.matchTimeline.tick,0);
  assert.equal(first.matchTimeline.provisionalScore.home,0);
  assert.equal(first.matchTimeline.matchEventCount,0);
  const fakeTick=Object.freeze({
   version:ENGINE_VERSION,tick:0,ball:first.ball
  });
  assert.throws(()=>score.observe({physics:fakeTick,
   refereeEvidence:{...first.refereeEvidence,provisionalGoals:{home:1,away:0}}}),
   /B06 score/);
  // Failed validation does not consume the expected original tick.
  score.observe({physics:fakeTick,refereeEvidence:first.refereeEvidence});
  assert.throws(()=>score.observe({physics:fakeTick,refereeEvidence:first.refereeEvidence}),
   /next exact/);
  let last;
  for(let t=1;t<=11;t++){
   last=a.step();
   const physical=Object.freeze({
    version:ENGINE_VERSION,tick:last.physicsTick,ball:last.ball
   });
   score.observe({physics:physical,refereeEvidence:last.refereeEvidence});
  }
  const genuine=a.step();
  assert.equal(genuine.refereeEvidence.lastEvent?.kind,'goal');
  const realPhysics=Object.freeze({version:ENGINE_VERSION,
   tick:genuine.physicsTick,ball:genuine.ball});
  const realRef=genuine.refereeEvidence;
  assert.throws(()=>score.observe({physics:realPhysics,
   refereeEvidence:{...realRef,lastEvent:{
    ...realRef.lastEvent,scoringTeam:'away'}}}),/forged goal/);
  assert.throws(()=>score.observe({physics:realPhysics,
   refereeEvidence:{...realRef,lastEvent:{
    ...realRef.lastEvent,crossing:{
     ...realRef.lastEvent.crossing,intersection:{
      ...realRef.lastEvent.crossing.intersection,x:0}}}}}),/re-observe/);
  const verified=score.observe({physics:realPhysics,refereeEvidence:realRef});
  assert.equal(verified.provisionalScore.home,1);
  assert.equal(verified.matchEventCount,1);
  assert.equal(verified.outstandingDeadBall,true);
  assert.throws(()=>score.recordRestart({
   physicsTick:12,refereeEvidence:realRef,
   physicalRestart:{tick:12,kind:'kickoff',
    assignedTeam:'home',sourceEventTick:12,
    originalRapierBallRepositioned:true,realShoeContact:false,
    officialMatchResult:null}}),/exact-tick/);
 }finally{a.dispose();}
});
test('B06 genuine HOME/AWAY match clock, provisional goals, unresolved dead balls and source-positive set-piece ledger',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const id of ['goal','touchline','goal-line-out','throw-in','corner','goal-kick'])
  for(const side of ['home','away']){
   const a=createControlledActionLab(R,id,{shotSide:side});
   const b=createControlledActionLab(R,id,{shotSide:side});
   try{
    const zero=a.snapshot().matchTimeline;
    assert.equal(zero.version,B06_TIMELINE_VERSION);
    assert.equal(zero.tick,0);
    assert.equal(zero.clock.label,'00:00');
    assert.equal(zero.provisionalScore.home,0);
    assert.equal(zero.provisionalScore.away,0);
    assert.equal(zero.matchEventCount,0);
    assert.equal(zero.matchAuthority,false);
    const sourceRestart=['throw-in','corner','goal-kick'].includes(id);
    const noOwner=['touchline','goal-line-out'].includes(id);
    let firstEvent=null,setPiece=null;
    for(let tick=1;tick<=60;tick++){
     const x=a.step(),y=b.step();
     const ledger=x.matchTimeline;
     assert.deepEqual(ledger,y.matchTimeline);
     assert.equal(x.physicsTick,tick);
     assert.equal(ledger.tick,tick);
     assert.equal(ledger.clock.sourceTick,tick);
     assert.equal(ledger.officialMatchScore,null);
     assert.equal(ledger.officialMatchResult,null);
     assert.equal(ledger.officialPossession,false);
     assert.equal(ledger.fullTimeVerified,false);
     assert.equal(x.officialMatchResult,null);
     assert.equal(x.scoreChanged,false);
     if(x.refereeEvidence.lastEvent&&!firstEvent){
      firstEvent=x.refereeEvidence.lastEvent;
      assert.equal(ledger.lastNativeBoundaryEvent.tick,tick);
      assert.equal(ledger.matchEvents[0].tick,tick);
      assert.equal(ledger.matchEvents[0].originalRapierCrossing,true);
      assert.equal(ledger.matchEvents[0].officialMatchEvent,false);
      assert.equal(ledger.provisionalScore.home,id==='goal'&&side==='home'?1:0);
      assert.equal(ledger.provisionalScore.away,id==='goal'&&side==='away'?1:0);
      assert.equal(ledger.outstandingDeadBall,noOwner);
      assert.equal(ledger.matchEventCount,noOwner?1:2);
      if(!noOwner){
       assert.equal(ledger.lastPhysicalRestart.tick,tick);
       assert.equal(ledger.lastPhysicalRestart.originalRapierBallRepositioned,true);
       assert.equal(ledger.matchEvents[1].type,'restart-placement');
       assert.equal(ledger.matchEvents[1].sameOriginalRapierBall,true);
      }
     }
     if(x.b05bTake&&!setPiece){
      setPiece=x.b05bTake;
      assert.equal(ledger.lastPhysicalSetPiece.tick,tick);
      assert.equal(ledger.matchEventCount,3);
      assert.equal(ledger.matchEvents[2].type,'set-piece-physical-attempt');
      assert.equal(ledger.matchEvents[2].actorId,setPiece.actorId);
      assert.equal(ledger.matchEvents[2].officialMatchEvent,false);
      assert.equal(ledger.matchEvents[2].unmodelledHandRelease,
       id==='throw-in');
      assert.equal(ledger.matchEvents[2].originalNativeShoeStart,
       id!=='throw-in');
     }
    }
    const final=a.snapshot().matchTimeline;
    assert.ok(firstEvent);
    assert.equal(final.matchEventCount,noOwner?1:sourceRestart?3:2);
    assert.equal(final.outstandingDeadBall,noOwner);
    if(sourceRestart)assert.ok(setPiece,
     'source-positive physical set piece required: '+id+' '+side);
    if(noOwner)assert.equal(final.lastPhysicalRestart,null);
    assert.equal(final.provisionalScore[side],id==='goal'?1:0);
    assert.equal(final.clock.phase,'first-half');
    assert.equal(final.officialMatchResult,null);
    process.stdout.write('ME_628_B06_'+id.toUpperCase()+'_'+side.toUpperCase()+' '+
     JSON.stringify({observedFullBallExit:firstEvent.tick,
      matchClock:final.clock.label,score:final.provisionalScore,
      types:final.matchEvents.map(e=>e.type),
      originalSetPieceShoe:setPiece?.originalNativeShoeStart??null,
      unmodelledHandRelease:setPiece?.provisionalHandReleaseWithoutHandCollider??null,
      fullTimeVerified:false,officialMatchResult:null})+'\\n');
   }finally{a.dispose();b.dispose();}
  }
});
