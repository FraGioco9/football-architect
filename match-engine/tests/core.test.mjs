import test from 'node:test';
import assert from 'node:assert/strict';
import * as moduleNamespace from '@dimforge/rapier3d-deterministic-compat';
import {
  initializeRapier, createEngine, canonicalSnapshot, normalizeScenario, FIXED_DT, BALL_RADIUS, GRASS_ROLL_DECELERATION, ROLL_STOP_SPEED, ENGINE_VERSION,
  toCenterHeight, toGroundClearance, BALL_MASS_KG, BALL_INERTIA_KG_M2,
  GROUND_RESTITUTION, BALL_RESTITUTION
} from '../src/core.mjs';

const RAPIER = await initializeRapier(moduleNamespace);
import {measureBounceHistory,BOUNCE_TEST_DROP_HEIGHT_M,FIFA_TURF_QUALITY_PRO_REFERENCE_M} from '../src/rebound-metrics.mjs';

test('ME-01 inputs are bounded, versioned, and reject invalid fields', () => {
  assert.equal(normalizeScenario({preset:'drop'}).z, 3);
  assert.equal(normalizeScenario({preset:'launch'}).vx, 11);
  assert.throws(() => normalizeScenario({preset:'made-up'}), /preset/);
  assert.throws(() => normalizeScenario({z:-3}), /z|surface/);
  assert.throws(() => normalizeScenario({vx:Infinity}), /vx/);
  assert.throws(() => normalizeScenario({seed:'bad seed'}), /seed/);
  assert.throws(() => normalizeScenario({clubId:'IT-1'}), /Unknown scenario field/);
  assert.equal(FIXED_DT, 1/60);
});

test('LAB-01 ball falls, contacts ground, and remains finite', () => {
  const e = createEngine(RAPIER, {preset:'drop'});
  try {
    const p0=e.snapshot().ball.position;
    const first=e.step().ball;
    assert.ok(first.position.z < p0.z, 'gravity must decrease height');
    assert.ok(first.velocity.z < 0, 'vertical speed must point down');
    let minZ=100, grounded=false;
    for(let i=0;i<480;i++){
      const s=e.step(), p=s.ball.position, v=s.ball.velocity;
      for(const n of [p.x,p.y,p.z,v.x,v.y,v.z]) assert.ok(Number.isFinite(n));
      minZ=Math.min(minZ,p.z);
      grounded ||= s.nearGround;
    }
    assert.ok(minZ>=BALL_RADIUS-0.04, 'ball must not tunnel through floor');
    assert.ok(grounded, 'ball must make contact');
  } finally {e.dispose();}
});

test('LAB-02 launch moves in XY while Z follows an airborne trajectory', () => {
  const e=createEngine(RAPIER,{preset:'launch'});
  try {
    const initial=e.snapshot(), first=e.step();
    assert.ok(first.ball.position.x>initial.ball.position.x);
    let maxZ=initial.ball.position.z;
    for(let i=0;i<180;i++)maxZ=Math.max(maxZ,e.step().ball.position.z);
    assert.ok(maxZ>initial.ball.position.z+1, 'launch must rise');
  } finally {e.dispose();}
});

test('LAB-03 same engine build/scenario/ticks produces identical canonical snapshots', () => {
  const input={preset:'launch',seed:'fa-replay-01',x:-12,y:3,z:1,vx:14,vy:2,vz:8};
  const a=createEngine(RAPIER,input), b=createEngine(RAPIER,input);
  try{
    for(let i=0;i<900;i++){
      const snapshotA=a.step(),snapshotB=b.step();
      if(i%37===0||i===899)
        assert.equal(canonicalSnapshot(snapshotA),canonicalSnapshot(snapshotB),'tick '+(i+1));
    }
    const reset=a.reset();
    try {
      for(let i=0;i<900;i++)reset.step();
      assert.equal(canonicalSnapshot(reset.snapshot()),canonicalSnapshot(b.snapshot()));
    }finally{reset.dispose();}
    assert.throws(()=>a.step(), /disposed/);
  }finally{a.dispose();b.dispose();}
});

test('scenario changes remain isolated and produce a different physical trajectory', () => {
  const a=createEngine(RAPIER,{preset:'launch',vx:5});
  const b=createEngine(RAPIER,{preset:'launch',vx:13});
  try{
    for(let i=0;i<150;i++){a.step();b.step();}
    assert.notEqual(canonicalSnapshot(a.snapshot()),canonicalSnapshot(b.snapshot()));
  }finally{a.dispose();b.dispose();}
});

test('LAB-04 on grass, a rolling ball slows measurably and reaches rest', () => {
  assert.equal(GRASS_ROLL_DECELERATION,0.8,'documented initial turf deceleration');
  assert.ok(ROLL_STOP_SPEED>0 && ROLL_STOP_SPEED<0.1);
  assert.equal(normalizeScenario({preset:'roll'}).z,0);
  const e=createEngine(RAPIER,{preset:'roll'});
  try {
    const horizontal = s => Math.hypot(s.ball.velocity.x,s.ball.velocity.y);
    const initial=e.snapshot(),v0=horizontal(initial);
    let v1=NaN, stoppedAt=null, maxRollHeight=0;
    for(let i=1;i<=660;i++){
      const s=e.step(),v=horizontal(s);
      maxRollHeight=Math.max(maxRollHeight,s.ball.position.z);
      if(i===60) v1=v;
      if(stoppedAt===null && v<0.06 && s.nearGround)stoppedAt=i;
      if(i>500)assert.ok(v<0.1,'ball must stay at rest near end, tick '+i+' speed '+v);
    }
    const end=e.snapshot();
    assert.ok(v1<v0-0.35,'grass must visibly reduce ball speed after 1s: '+v0+'→'+v1);
    assert.ok(stoppedAt!==null && stoppedAt<=480,'ball must stop within 8s, got '+stoppedAt);
    assert.ok(end.ball.position.x>0.8 && end.ball.position.x<15,
      'rolling travel must be plausible, x='+end.ball.position.x);
    assert.ok(maxRollHeight<0.4,'rolling input should stay near turf: '+maxRollHeight);
  }finally{e.dispose();}
});

test('grass rolling resistance does not erroneously brake an airborne ball', () => {
  const e=createEngine(RAPIER,{preset:'roll',z:5,vx:6,vy:2,vz:0});
  try{
    const start=e.snapshot().ball.velocity;
    const s=e.step();
    assert.ok(s.ball.position.z>4.9,'ball must still be airborne');
    assert.ok(Math.abs(s.ball.velocity.x-start.x)<0.005,'no ground roll brake in air: vx');
    assert.ok(Math.abs(s.ball.velocity.y-start.y)<0.005,'no ground roll brake in air: vy');
  }finally{e.dispose();}
});

test('grass rolling loss preserves deterministic same-tick replay', () => {
  const input={preset:'roll',seed:'grass-rolling-01',vx:5.5,vy:1.25};
  const a=createEngine(RAPIER,input),b=createEngine(RAPIER,input);
  try{
    for(let tick=1;tick<=480;tick++){
      const x=a.step(),y=b.step();
      if(tick===1||tick%60===0)assert.equal(canonicalSnapshot(x),canonicalSnapshot(y),'rolling tick '+tick);
    }
    assert.ok(Math.hypot(a.snapshot().ball.velocity.x,a.snapshot().ball.velocity.y)<0.1,
      'rolling replay should reach rest within 8s');
  }finally{a.dispose();b.dispose();}
});

test('ME-Z-01 scenario Z measures underside clearance; Rapier Z remains center height',()=>{
  assert.equal(ENGINE_VERSION,'me-01-physics-v4','mass and inertia revision must change canonical replay version');
  assert.equal(normalizeScenario({preset:'roll'}).z,0);
  assert.equal(normalizeScenario({preset:'drop'}).z,3);
  assert.equal(toCenterHeight(0),BALL_RADIUS);
  assert.equal(toGroundClearance(BALL_RADIUS),0);
  assert.equal(toGroundClearance(BALL_RADIUS-0.005),0,'contact penetration cannot display negative ground clearance');
  for(const clearance of [0,0.01,0.5,2,3,5]){
    assert.ok(Math.abs(toGroundClearance(toCenterHeight(clearance))-clearance)<1e-10,
      'clearance must round-trip '+clearance);
  }
  assert.throws(()=>normalizeScenario({preset:'roll',z:-0.001}),/below the surface/);
  const rolling=createEngine(RAPIER,{preset:'roll',z:0});
  const airborne=createEngine(RAPIER,{preset:'drop',z:2});
  try{
    const rs=rolling.snapshot(),as=airborne.snapshot();
    assert.ok(Math.abs(rs.ball.position.z-BALL_RADIUS)<1e-5,'grounded center should be at radius');
    assert.equal(toGroundClearance(rs.ball.position.z),0);
    assert.equal(rs.nearGround,true);
    assert.ok(Math.abs(as.ball.position.z-(2+BALL_RADIUS))<1e-5,'airborne center must add radius once');
    assert.ok(Math.abs(toGroundClearance(as.ball.position.z)-2)<1e-5);
    assert.equal(as.nearGround,false);
  }finally{rolling.dispose();airborne.dispose();}
});

test('ME-PHYS-02 physical ball mass and thin-shell moment of inertia are measured in Rapier',()=>{
  assert.equal(ENGINE_VERSION,'me-01-physics-v4','physics mass and inertia revision must invalidate old replay identity');
  assert.ok(BALL_MASS_KG>=0.410&&BALL_MASS_KG<=0.450,'IFAB legal match-ball mass (kg)');
  assert.equal(BALL_MASS_KG,0.43);
  assert.ok(Math.abs(BALL_INERTIA_KG_M2 - (2/3)*BALL_MASS_KG*BALL_RADIUS**2)<1e-12);
  assert.equal(GROUND_RESTITUTION,0.62);
  assert.equal(BALL_RESTITUTION,0.62);
  const oldDensityMassKg=0.4*(4/3)*Math.PI*BALL_RADIUS**3;
  assert.ok(oldDensityMassKg>0.002 && oldDensityMassKg<0.0025,'old density was ~2.23g, not 430g');
  const e=createEngine(RAPIER,{preset:'bounce'});
  try{
    assert.ok(Math.abs(e.ballProperties.massKg-BALL_MASS_KG)<1e-4,
      'verify ACTUAL Rapier body mass, not just the collider description');
    for(const axis of ['x','y','z'])
      assert.ok(Math.abs(e.ballProperties.principalInertiaKgM2[axis]-BALL_INERTIA_KG_M2)<1e-5,
        'actual Rapier principal angular inertia mismatch '+axis);
    assert.equal(e.scenario.z,BOUNCE_TEST_DROP_HEIGHT_M);
    const center=e.snapshot().ball.position.z;
    assert.ok(Math.abs(center-(BOUNCE_TEST_DROP_HEIGHT_M+BALL_RADIUS))<1e-5);
  }finally{e.dispose();}
});

test('LAB-05 2m drop rebound is finite, loses energy and falls in provisional FIFA-turf reference range',()=>{
  const e=createEngine(RAPIER,{preset:'bounce'});
  const history=[e.snapshot()];
  try{
    for(let i=0;i<420;i++){
      const next=e.step();
      history.push(next);
      for(const value of [...Object.values(next.ball.position),...Object.values(next.ball.velocity)])
        assert.ok(Number.isFinite(value),'nonfinite bounce trajectory at tick '+next.tick);
    }
    const metrics=measureBounceHistory(history);
    assert.ok(metrics.impactCount>=1,'2m falling ball must hit the grass and rebound');
    assert.ok(metrics.firstImpactTimeS>0.45&&metrics.firstImpactTimeS<0.8,
      '2m drop should reach ground after ~0.64s: '+JSON.stringify(metrics));
    assert.ok(metrics.firstReboundHeightM!==null,'must observe first rebound apex');
    assert.ok(metrics.firstReboundHeightM<BOUNCE_TEST_DROP_HEIGHT_M,
      'must not rebound higher than release height');
    assert.ok(metrics.firstReboundHeightM>=FIFA_TURF_QUALITY_PRO_REFERENCE_M.min &&
              metrics.firstReboundHeightM<=FIFA_TURF_QUALITY_PRO_REFERENCE_M.max,
      'first apex outside provisional 2024 artificial-turf reference: '+JSON.stringify(metrics));
    assert.ok(history.every(s=>s.ball.position.z>=BALL_RADIUS-0.045),'no ground tunneling');
    process.stdout.write('ME_PHYS02_BOUNCE '+JSON.stringify(metrics)+'\n');
  }finally{e.dispose();}
});

test('LAB-05 bounce and mass/inertia revision remain deterministic across reset',()=>{
  const a=createEngine(RAPIER,{preset:'bounce',seed:'physics-02-bounce'});
  const b=createEngine(RAPIER,{preset:'bounce',seed:'physics-02-bounce'});
  try{
    for(let tick=1;tick<=420;tick++){
      const left=a.step(),right=b.step();
      if(tick===1||tick%30===0)
        assert.equal(canonicalSnapshot(left),canonicalSnapshot(right),'bounce replay mismatch tick '+tick);
    }
    const restarted=a.reset();
    try {
      for(let tick=1;tick<=420;tick++) restarted.step();
      assert.equal(canonicalSnapshot(restarted.snapshot()),canonicalSnapshot(b.snapshot()));
      assert.deepEqual(restarted.ballProperties,b.ballProperties);
    }finally{restarted.dispose();}
  }finally{a.dispose();b.dispose();}
});
