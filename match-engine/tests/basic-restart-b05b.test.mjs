// #628 B05b — original same-world native LAST shoe START, full ball
// crossing and physical restart ticket. Never invent an earlier contact.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_MIN_SEPARATION_M,PLAYER_MAX_SPEED_MPS}
 from '../src/player-movement.mjs';
import {B05B_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {basicSourcePositiveRestartSetup,B05B_SOURCE_VERSION}
 from '../src/basic-restart-source-lineup-b05b.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {initializeRapier,createEngine} from '../src/core.mjs';
import {NATIVE_RESTART_TYPES,createNativeRestartMask,nativeRestartAllowed,planNativeGroundRestartImpulse,nativeGroundRestartContactReady} from '../src/native-restart-policy.mjs';

test('B05b authentic last-shoe and restart taker are the original ordered 22, pre-tick zero only',()=>{
 assert.deepEqual(ACTION_LAB_SCENARIOS.filter(s=>
  ['throw-in','corner','goal-kick'].includes(s.id)).map(s=>s.id),
  ['throw-in','corner','goal-kick']);
 for(const kind of ['throw-in','corner','goal-kick'])
  for(const side of ['home','away']){
   const ball=B05B_LAB_STARTS[
    kind==='throw-in'?'throwIn':kind==='goal-kick'?'goalKick':kind][side];
   const setup=basicSourcePositiveRestartSetup(INITIAL_PLAYERS,side,ball,kind);
   assert.equal(setup.version,B05B_SOURCE_VERSION);
   assert.equal(setup.players.length,22);
   assert.equal(setup.sourceId,setup.lastTeam+'-10');
   assert.equal(setup.takerId,setup.restartTeam+'-9');
   assert.notEqual(setup.lastTeam,setup.restartTeam);
   assert.equal(setup.beforeTickZeroOnly,true);
   assert.equal(setup.actualShoeStartRequired,true);
   assert.equal(setup.physicalBallImpulse,false);
   assert.deepEqual(setup.players.map(x=>x.id),INITIAL_PLAYERS.map(x=>x.id));
   for(let i=0;i<22;i++)for(let j=i+1;j<22;j++)
    assert.ok(Math.hypot(setup.players[i].x-setup.players[j].x,
     setup.players[i].y-setup.players[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
  }
 assert.throws(()=>basicSourcePositiveRestartSetup(INITIAL_PLAYERS,
  'home',{...B05B_LAB_STARTS.corner.home,vx:2},'corner'),TypeError);
});
test('B05b private restart staging is not available in default or unrelated physics worlds',async()=>{
 const R=await initializeRapier(rapier);
 const normal=createEngine(R,{preset:'roll'});
 try{assert.equal(normal.applyBasicRestartAtBoundary,undefined);}
 finally{normal.dispose();}
 assert.throws(()=>createEngine(R,B05B_LAB_STARTS.corner.home,{
  diagnosticBasicRestartSource:'corner',
  diagnosticBasicRestartAttackSide:'home',
  diagnosticPlayerFootContactsEnabled:true
 }),TypeError);
 assert.throws(()=>createEngine(R,B05B_LAB_STARTS.corner.home,{
  diagnosticBasicRestartEnabled:true,
  diagnosticBasicRestartSource:'corner',
  diagnosticPlayerFootContactsEnabled:true
 }),TypeError);
 assert.throws(()=>createControlledActionLab(R,'corner',{shotSide:'invalid'}),TypeError);
});
test('B05b HOME/AWAY true initial native shoe START sets real last-touch owner before physically observed ball exit and same-world restart',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const kind of ['throw-in','corner','goal-kick'])
  for(const side of ['home','away']){
   const a=createControlledActionLab(R,kind,{shotSide:side});
   const b=createControlledActionLab(R,kind,{shotSide:side});
   try{
    const initial=a.snapshot();
    assert.equal(initial.physicsTick,0);
    assert.equal(initial.refereeEvidence.lastVerifiedTouch,null);
    assert.equal(initial.physicalRestart,null);
    let event=null;
    let started=[];
    let sourceKick=null,lastBall=null,peakOutbound=-Infinity,take=null;
    let lastLive=null;
    for(let tick=1;tick<=65;tick++){
     const x=a.step(),y=b.step();
     lastBall=x.ball;
     peakOutbound=Math.max(peakOutbound,kind==='throw-in'?
       x.ball.position.y*(side==='home'?1:-1):
       x.ball.position.x*(side==='home'?1:-1));
     assert.deepEqual(x.ball,y.ball);
     assert.deepEqual(x.starts,y.starts);
     assert.deepEqual(x.refereeEvidence,y.refereeEvidence);
     assert.deepEqual(x.physicalRestart,y.physicalRestart);
     assert.equal(x.officialMatchResult,null);
     assert.equal(x.officialMatchPossession,false);
     assert.equal(x.scoreChanged,false);
     if(x.starts.length)
      started.push({tick,ids:x.starts});
     if(x.b05bOutKick&&!sourceKick){
      sourceKick=x.b05bOutKick;
      assert.equal(sourceKick.tick,tick);
      assert.deepEqual(x.starts,[sourceKick.actorId]);
      assert.equal(sourceKick.genuineExclusiveNativeShoeStart,true);
      assert.equal(sourceKick.nativeSolverGeometricContact,true);
      assert.equal(sourceKick.appliedByOriginalRapierBody,true);
      assert.equal(sourceKick.officialPossession,false);
     }
     if(x.b05bTake&&!take){
      take=x.b05bTake;
      assert.equal(take.tick,tick);
      assert.equal(take.type,kind);
      assert.equal(take.singleOriginalRapierBall,true);
      assert.equal(take.physicalImpulseApplied,true);
      assert.equal(take.officialMatchAction,false);
      assert.equal(take.officialMatchResult,null);
      assert.equal(take.officialPossession,false);
      assert.equal(take.actorId,(kind==='corner'?side:
       side==='home'?'away':'home')+'-9');
      if(kind==='throw-in'){
       assert.equal(take.originalNativeShoeStart,false);
       assert.equal(take.provisionalHandReleaseWithoutHandCollider,true);
       assert.equal(take.legalThrowConfirmed,false);
      }else{
       assert.equal(take.originalNativeShoeStart,true);
       assert.deepEqual(x.starts,[take.actorId]);
       assert.equal(take.provisionalHandReleaseWithoutHandCollider,false);
      }
     }
     if(!event&&x.refereeEvidence.lastEvent){
      event=x.refereeEvidence.lastEvent;
      lastLive=x;
     }
     for(const p of x.observedMovementPlayers)
      assert.ok(Math.hypot(p.vx,p.vy)<=PLAYER_MAX_SPEED_MPS+1e-8);
    }
    assert.ok(sourceKick,'first original native shoe START must kick real ball');
    assert.ok(event,
     'must truly cross full-ball line: '+kind+' '+side+' starts='+JSON.stringify(started)+' kick='+JSON.stringify(sourceKick)+' max='+peakOutbound+' last='+JSON.stringify(lastBall));
    const expectedLast=(kind==='corner'?
      side==='home'?'away':'home':side)+'-10';
    const expectedTeam=expectedLast.split('-')[0]==='home'?'away':'home';
    assert.equal(event.lastVerifiedTouch?.playerId,expectedLast,
     'real native original last-touch required '+kind+' '+side+
     '; starts='+JSON.stringify(started));
    assert.equal(event.lastVerifiedTouch?.nativeExclusiveShoeStart,true);
    assert.ok(event.lastVerifiedTouch.tick<event.tick);
    assert.equal(event.restart.type,kind);
    assert.equal(event.restart.team,expectedTeam);
    assert.equal(event.restart.ready,true);
    assert.equal(event.scoringTeam,null);
    assert.equal(event.officialResult,false);
    assert.equal(lastLive.physicalRestart?.originalRapierBallRepositioned,true);
    assert.equal(lastLive.physicalRestart.assignedTeam,expectedTeam);
    assert.equal(lastLive.refereeEvidence.restartApplied,true);
    assert.ok(take,
     'B05b must attempt physical set-piece from original taker: '+
      kind+' '+side+' starts='+JSON.stringify(started));
    assert.ok(take.tick>event.tick);
    assert.equal(a.snapshot().eventCount,2);
    assert.equal(a.snapshot().refereeEvidence.provisionalGoals.home,0);
    assert.equal(a.snapshot().refereeEvidence.provisionalGoals.away,0);
    process.stdout.write('ME_628_B05B_'+kind.toUpperCase()+'_'+side.toUpperCase()+' '+
     JSON.stringify({lastTouchTick:event.lastVerifiedTouch.tick,
      lastTouchPlayer:event.lastVerifiedTouch.playerId,
      eventTick:event.tick,owner:event.restart.team,
      restart:event.restart.type,sameOriginalBallRepositioned:true,
      nativeShoeStartTicks:started,nativeOutboundKick:sourceKick.impulseNs,
      setPieceTick:take.tick,setPieceActor:take.actorId,
      setPieceTrueShoe:take.originalNativeShoeStart,
      handUnmodelled:take.provisionalHandReleaseWithoutHandCollider,
      officialPossession:false})+'\\n');
   }finally{a.dispose();b.dispose();}
  }
});

test('ME-01-QA U-01F6: common restart permissions, direction and exclusive physical witness',()=>{
 const all=createNativeRestartMask({fullField:true});
 assert.deepEqual(all,NATIVE_RESTART_TYPES);
 assert.deepEqual(createNativeRestartMask(),[]);
 assert.deepEqual(createNativeRestartMask({kickoffEnabled:true}),['kickoff']);
 for(const kind of ['corner','goal-kick','throw-in']){
  const only=createNativeRestartMask({boundaryEnabled:true,boundaryType:kind});
  assert.deepEqual(only,[kind]);
  for(const k of NATIVE_RESTART_TYPES)assert.equal(nativeRestartAllowed(only,k),k===kind);
 }
 for(const team of ['home','away'])for(const attackPolarity of [1,-1]){
  const dir=(team==='home'?1:-1)*attackPolarity;
  for(const y of [-33.89,33.89]){
   assert.deepEqual(planNativeGroundRestartImpulse({mask:all,kind:'corner',team,spot:{x:dir*52,y,z:.11},attackPolarity}),{x:-dir*1.85,y:-Math.sign(y)*1.15,z:.42});
  }
  assert.deepEqual(planNativeGroundRestartImpulse({mask:all,kind:'goal-kick',team,spot:{x:-dir*47,y:5.5,z:.11},attackPolarity}),{x:dir*2.5,y:0,z:.30});
  const args={mask:all,kind:'kickoff',team,spot:{x:0,y:0,z:.11},attackPolarity};
  assert.deepEqual(planNativeGroundRestartImpulse(args),{x:dir*.65,y:0,z:.04});
  assert.equal(planNativeGroundRestartImpulse({...args,kind:'throw-in'}),null);
  assert.equal(planNativeGroundRestartImpulse({...args,mask:[]}),null);
  assert.equal(planNativeGroundRestartImpulse({...args,spot:{x:1,y:0,z:.11}}),null);
  const takerId=team+'-10',tick=2,foot={tick,started:[takerId],active:[takerId]},solver={tick,pairs:[{id:takerId,beganThisTick:true,collisionActive:true,manifolds:[{geometricContacts:1}]}]};
  const witness={mask:all,kind:'kickoff',tick,takerId,foot,solver,exclusive:true};
  assert.equal(nativeGroundRestartContactReady(witness),true);
  for(const patch of [{mask:[]},{exclusive:false},{otherBody:true},{kind:'throw-in'},{tick:3},{foot:{...foot,active:[takerId,'other']}},{solver:{tick,pairs:[]}}])
   assert.equal(nativeGroundRestartContactReady({...witness,...patch}),false);
 }
});
