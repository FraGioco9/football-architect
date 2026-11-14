// ME-PB-48: unified, real 60Hz Rapier V1 PHYSICS ACCEPTANCE baseline.
// Research-only fixture; does not activate gameplay contacts, ownership,
// passes, dribbles, shots, Magnus, UI, or new tuning parameters.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as physicsModule from '@dimforge/rapier3d-deterministic-compat';
import {
  createEngine,initializeRapier,canonicalSnapshot,normalizeScenario,
  BALL_RADIUS,BALL_MASS_KG,GRASS_ROLL_DECELERATION,ROLL_STOP_SPEED,
  FIXED_DT,GRAVITY
} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {measureBounceHistory,BOUNCE_TEST_DROP_HEIGHT_M}
  from '../src/rebound-metrics.mjs';
import {
  resolveGlobalBallResponse,createGlobalResponseResearchEngine,
  DEFAULT_GLOBAL_BALL_RESPONSE
} from '../src/player-ball-global-response.mjs';

const Rapier=await initializeRapier(physicsModule);
const finite3=v=>v&&['x','y','z'].every(k=>Number.isFinite(v[k]));
const speed=s=>Math.hypot(s.ball.velocity.x,s.ball.velocity.y);
const physicalScenario=Object.freeze({
  preset:'roll',seed:'me-pb-48-locked-v1',x:4.96,y:0,z:0,
  vx:-0.3,vy:0,vz:0
});

test('ME-PB-48/A1 inventory: one fixed ball and unchanged universal 1.00 research baseline (not yet game enabled)',()=>{
  assert.equal(FIXED_DT,1/60);
  assert.equal(BALL_MASS_KG,0.43);
  assert.equal(BALL_RADIUS,0.11);
  assert.equal(GRASS_ROLL_DECELERATION,0.8);
  assert.equal(GRAVITY.z,-9.81);
  assert.equal(DEFAULT_GLOBAL_BALL_RESPONSE,1);
  const profile=resolveGlobalBallResponse();
  assert.equal(profile.value,1);
  assert.equal(profile.sameForAllPlayers,true);
  assert.equal(profile.sameForAllShoes,true);
  assert.equal(profile.sameForAllPitches,true);
  assert.equal(profile.calibratedForGameplay,false);
  assert.ok(Object.isFrozen(profile));
  const normal=createEngine(Rapier,physicalScenario);
  try {
    assert.equal(normal.footContactSnapshot,undefined,
      'foot colliders are NOT authoritative production gameplay yet');
    assert.ok(finite3(normal.snapshot().ball.position));
    assert.ok(finite3(normal.snapshot().ball.velocity));
    assert.throws(()=>normalizeScenario({preset:'roll',z:-0.01}),/surface|below/);
  }finally{normal.dispose();}
});

test('ME-PB-48/A2: normal Rapier rolling decelerates, stops, stays near turf, and replays exactly',()=>{
  const initial={preset:'roll',seed:'me-pb-48-roll',vx:4,vy:0};
  const a=createEngine(Rapier,initial),b=createEngine(Rapier,initial);
  let speedAt1=null,speedAt60=null,stopTick=null;
  let travelledAtStop=null,maxHeight=0,postStopMaxSpeed=0;
  try {
    for(let tick=1;tick<=480;tick++){
      const sa=a.step(),sb=b.step();
      assert.equal(canonicalSnapshot(sa),canonicalSnapshot(sb),
        'deterministic bounded standard ball at tick '+tick);
      assert.ok(finite3(sa.ball.position)&&finite3(sa.ball.velocity));
      const velocity=speed(sa);
      if(tick===1)speedAt1=velocity;
      if(tick===60)speedAt60=velocity;
      if(stopTick===null&&tick>=60&&velocity<ROLL_STOP_SPEED+0.02){
        stopTick=tick;travelledAtStop=sa.ball.position.x;
      }
      if(tick>390)postStopMaxSpeed=Math.max(postStopMaxSpeed,velocity);
      maxHeight=Math.max(maxHeight,sa.ball.position.z);
    }
    assert.ok(speedAt60<speedAt1-0.45);
    assert.ok(stopTick!==null&&stopTick<390);
    assert.ok(travelledAtStop>3&&travelledAtStop<15);
    assert.ok(maxHeight<0.4);
    assert.ok(postStopMaxSpeed<0.08);
    assert.ok(Object.isFrozen(a.snapshot()));
    process.stdout.write('ME_PB_48_A2_ROLL '+
      JSON.stringify({speedAt1,speedAt60,stopTick,
        travelledAtStop,maxHeight,postStopMaxSpeed})+'\n');
  }finally{a.dispose();b.dispose();}
});

test('ME-PB-48/A3: launch under gravity and measured bounce obey simple V1 ballistic/rebound contract',()=>{
  const shot={preset:'launch',seed:'me-pb-48-flight',z:1,vx:10,vy:1,vz:6};
  const flight=createEngine(Rapier,shot),replay=createEngine(Rapier,shot);
  let peak=0,first=flight.snapshot(),nonfinite=0;
  try{
    for(let i=0;i<240;i++){
      const s=flight.step(),r=replay.step();
      assert.equal(canonicalSnapshot(s),canonicalSnapshot(r));
      peak=Math.max(peak,s.ball.position.z);
      if(!finite3(s.ball.position)||!finite3(s.ball.velocity))nonfinite++;
      assert.ok(s.ball.position.z>=BALL_RADIUS-0.055,
        'no floor tunneling during flight');
      if(i===0){
        assert.ok(s.ball.position.x>first.ball.position.x);
        assert.ok(s.ball.velocity.z<first.ball.velocity.z,
          'gravity changes upward speed');
      }
    }
    assert.ok(peak>first.ball.position.z+1);
    assert.equal(nonfinite,0);
  }finally{flight.dispose();replay.dispose();}
  const bounce=createEngine(Rapier,{
    preset:'bounce',seed:'me-pb-48-bounce'
  });
  try{
    const samples=[bounce.snapshot()];
    for(let tick=1;tick<=360;tick++){
      const s=bounce.step();
      assert.ok(finite3(s.ball.position)&&finite3(s.ball.velocity));
      assert.ok(s.ball.position.z>=BALL_RADIUS-0.055);
      samples.push(s);
    }
    const m=measureBounceHistory(samples);
    assert.ok(m.impactCount>=1);
    assert.ok(m.firstReboundHeightM!==null&&m.firstReboundHeightM>0.25);
    assert.ok(m.firstReboundHeightM<BOUNCE_TEST_DROP_HEIGHT_M);
    process.stdout.write('ME_PB_48_A3_FLIGHT_BOUNCE '+
      JSON.stringify({peak,impactCount:m.impactCount,
        firstReboundHeightM:m.firstReboundHeightM})+'\n');
  }finally{bounce.dispose();}
});

test('ME-PB-48/A4 evidence only: 22 physical shoes provide actual START/END and ball response but are still opt-in',()=>{
  const e=createGlobalResponseResearchEngine(Rapier,physicalScenario,1);
  const noHome10=createGlobalResponseResearchEngine(Rapier,physicalScenario,1,
    {omittedShoeId:'home-10'});
  const sham=createGlobalResponseResearchEngine(Rapier,physicalScenario,1,
    {omittedShoeId:'home-1'});
  const mover=createPlayerMovement({experimentalAiKickApproach:true});
  const started=[],ended=[];
  let previouslyIdentical=true,shamIdentical=true;
  let firstDifferentTick=null;
  try {
    for(let tick=1;tick<=155;tick++){
      const prior=e.snapshot();
      const playerFrame=mover.step(prior.ball.position);
      assert.equal(playerFrame.tick,tick);
      assert.equal(playerFrame.players.length,INITIAL_PLAYERS.length);
      const a=e.step(playerFrame),b=noHome10.step(playerFrame),
        c=sham.step(playerFrame);
      const fa=e.footContactSnapshot(),fb=noHome10.footContactSnapshot(),
        fc=sham.footContactSnapshot();
      assert.equal(fa.tick,tick);
      for(const id of fa.started)started.push({tick,id});
      for(const id of fa.ended)ended.push({tick,id});
      if(firstDifferentTick===null&&canonicalSnapshot(a)!==canonicalSnapshot(b))
        firstDifferentTick=tick;
      if(tick<127&&canonicalSnapshot(a)!==canonicalSnapshot(b))
        previouslyIdentical=false;
      if(canonicalSnapshot(a)!==canonicalSnapshot(c))shamIdentical=false;
      assert.ok(![fb.started,fb.ended,fb.active].some(ids=>ids.includes('home-10')));
      assert.ok(![fc.started,fc.ended,fc.active].some(ids=>ids.includes('home-1')));
    }
    assert.ok(started.some(e=>e.tick===1&&e.id==='away-10'));
    assert.ok(ended.some(e=>e.tick===19&&e.id==='away-10'));
    assert.ok(started.some(e=>e.tick===127&&e.id==='home-10'));
    assert.ok(ended.some(e=>e.tick===130&&e.id==='home-10'));
    assert.equal(firstDifferentTick,127);
    assert.equal(previouslyIdentical,true);
    assert.equal(shamIdentical,true);
    assert.ok(Object.isFrozen(e.snapshot()));
    process.stdout.write('ME_PB_48_A4_REAL_SHOE_EVIDENCE '+
      JSON.stringify({originalStart:1,originalEnd:19,
        secondStart:127,secondEnd:130,firstDifferentTick,
        shamIdentical,officialPossession:false,
        experimentOnly:true})+'\n');
  }finally{e.dispose();noHome10.dispose();sham.dispose();}
});

test('ME-PB-48/A5 negative: a distant ball produces no player contact or invented football action',()=>{
  const scene={preset:'roll',seed:'me-pb-48-negative',x:30,y:20,z:0,
    vx:0,vy:0,vz:0};
  const e=createGlobalResponseResearchEngine(Rapier,scene,1);
  const mover=createPlayerMovement({experimentalAiKickApproach:true});
  const allStarts=[],allEnds=[];
  try{
    for(let tick=1;tick<=70;tick++){
      const f=mover.step(e.snapshot().ball.position);
      const state=e.step(f),contacts=e.footContactSnapshot();
      assert.ok(finite3(state.ball.position)&&finite3(state.ball.velocity));
      allStarts.push(...contacts.started);allEnds.push(...contacts.ended);
    }
    assert.deepEqual(allStarts,[]);
    assert.deepEqual(allEnds,[]);
  }finally{e.dispose();}
});
