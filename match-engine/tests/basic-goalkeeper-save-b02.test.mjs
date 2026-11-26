// #628 ACTIONS-B02: native goalkeeper parry + canonical lateral dive approach.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {INITIAL_PLAYERS,PLAYER_VERSION,PLAYER_MIN_SEPARATION_M,PLAYER_TURN_RAD_PER_S}
 from '../src/player-movement.mjs';
import {SAVE_LAB_STARTS,ACTION_LAB_SCENARIOS}
 from '../src/action-lab-scenarios.mjs';
import {initialResearchGoalkeeperSaveLineup,chooseBasicGoalkeeperDiveTarget,createKeeperShotObserver,observeKeeperDeflection}
 from '../src/goalkeeper-save-foundation-b02.mjs';
import {eligibleLiveKeeperSave,selectUniformAutonomousContactAction}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {advanceGoalkeeperBallOrientation} from '../src/individual-kinematics.mjs';
import {keeperDuelReboundTarget} from '../src/small-sided-lab-scenarios.mjs';
import {planNativeKeeperDive,planNativeKeeperChallenge,createNativeKeeperDive,eligibleKeeperGrip,createNativeKeeperGrip} from '../src/small-sided-native-body-guard.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

function candidate(side,players,ball,active=[side+'-1'],started=active){
 return selectUniformAutonomousContactAction({
  tick:1,contactStarted:started,contactActive:active,
  playerFrame:{version:PLAYER_VERSION,tick:1,players},
  ballPosition:{x:ball.x,y:ball.y,z:0.11},
  ballVelocity:{x:ball.vx,y:ball.vy,z:ball.vz},
  ballRadiusM:0.11
 });
}
test('ACTIONS-B02 live original keeper computes grounded lateral approach, not automatic save',()=>{
 for(const side of ['home','away']){
  const ball=SAVE_LAB_STARTS[side];
  const players=initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,side,ball);
  assert.equal(players.length,22);
  assert.deepEqual(players.map(p=>p.id),INITIAL_PLAYERS.map(p=>p.id));
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)
   assert.ok(Math.hypot(players[i].x-players[j].x,
    players[i].y-players[j].y)>=PLAYER_MIN_SEPARATION_M-1e-8);
  const keeper=players.find(p=>p.id===side+'-1');
  const target=chooseBasicGoalkeeperDiveTarget({
   keeper,ballPosition:{...ball,z:0.11},
   ballVelocity:{x:ball.vx,y:ball.vy,z:0}
  });
  assert.ok(target,'live inbound ball must produce a goalkeeper movement target');
  assert.equal(target.attemptOnly,true);
  assert.equal(target.officialSave,false);
  assert.ok((target.y-keeper.y)*(side==='home'?1:-1)>0,
   'goalkeeper should actually change lateral heading toward predicted arrival');
  assert.equal(eligibleLiveKeeperSave(keeper,
   {x:ball.x,y:ball.y,z:0.11},
   {x:ball.vx,y:ball.vy,z:0}),true);
  const pick=candidate(side,players,ball);
  assert.equal(pick.action,'save');
  assert.equal(pick.playerId,keeper.id);
  assert.equal(pick.recipientId,null);
  assert.equal(pick.saveTarget.nativeExclusiveShoeRequired,true);
  assert.equal(pick.saveTarget.saveConfirmed,false);
  assert.equal(pick.saveTarget.officialSave,false);
  assert.equal(pick.officialMatchAction,false);
  assert.ok(pick.impulseNs.x*(side==='home'?1:-1)>0);
  assert.ok(pick.impulseNs.z>0);
 }
});
test('ACTIONS-B02 no fake save without real exclusive START or inbound goalkeeper threat',()=>{
 const side='home',ball=SAVE_LAB_STARTS[side];
 const p=initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,side,ball);
 assert.equal(candidate(side,p,ball,['home-1','away-1']),null);
 assert.equal(candidate(side,p,{...ball,vx:3})?.action==='save',false);
 assert.equal(candidate(side,p,{...ball,y:14})?.action==='save',false);
 assert.equal(candidate(side,p,ball,['home-10'],['home-10'])?.action==='save',false);
 assert.equal(chooseBasicGoalkeeperDiveTarget({
  keeper:p[0],ballPosition:{x:ball.x,y:ball.y,z:0.11},
  ballVelocity:{x:3,y:0,z:0}
 }),null);
 assert.throws(()=>chooseBasicGoalkeeperDiveTarget({
  keeper:p[0],ballPosition:{x:NaN,y:0,z:0.11},
  ballVelocity:{x:-2,y:0,z:0}
 }),/original goalkeeper/);
 assert.throws(()=>initialResearchGoalkeeperSaveLineup(INITIAL_PLAYERS,'home',{
  ...ball,vx:2
 }),/Goalward/);
 assert.equal(ACTION_LAB_SCENARIOS.filter(s=>s.id==='save').length,1);
});
test('ACTIONS-B02 real HOME/AWAY original Rapier keeper shoe START, parry, dive approach and deterministic ball trajectory',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const a=createControlledActionLab(R,'save',{shotSide:side});
  const b=createControlledActionLab(R,'save',{shotSide:side});
  let first=null,realDiveTicks=0,observedFlight=false;
  try{
   const zero=a.snapshot(),keeper0=zero.players.find(p=>p.id===side+'-1');
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.action,null);
   assert.equal(zero.players.length,22);
   assert.equal(zero.goalkeeperDiveIntent,null);
   for(let t=1;t<=60;t++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x.ball,y.ball);
    assert.deepEqual(x.starts,y.starts);
    assert.deepEqual(x.action,y.action);
    assert.deepEqual(x.goalkeeperDiveIntent,y.goalkeeperDiveIntent);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.evidence.officialGoal,false);
    assert.equal(x.evidence.tackleConfirmed,null);
    realDiveTicks=Math.max(realDiveTicks,x.goalkeeperDiveIntentTicks);
    if(t===1){
     const keeper=x.observedMovementPlayers.find(p=>p.id===side+'-1');
     assert.ok((keeper.y-keeper0.y)*(side==='home'?1:-1)>0,
      'original accelerated keeper must begin moving laterally');
     assert.ok(Math.hypot(keeper.vx,keeper.vy)<=7+1e-8);
    }
    if(x.action?.action==='save'&&!first){
     first=x.action;
     assert.deepEqual(x.starts,[side+'-1']);
     assert.equal(x.evidence.witnessed,true);
     assert.equal(x.evidence.verifiedShoeImpulse,true);
     assert.equal(first.appliedByRapier,true);
     assert.equal(first.actualPhysicsImpulseApplied,true);
     assert.equal(first.saveTarget.actorId,side+'-1');
     assert.equal(first.saveTarget.saveConfirmed,false);
     assert.equal(first.saveTarget.officialSave,false);
    }
    if(x.shotFlight?.actionType==='save'&&
       x.shotFlight.observed3DFlight)
     observedFlight=true;
   }
   assert.ok(realDiveTicks>=1,'a live original keeper movement target is required');
   assert.ok(first,'genuine exclusive Rapier goalkeeper shoe START is required');
   assert.ok(observedFlight,'native keeper parry must move the original ball in real 3D');
   process.stdout.write('ME_628_KEEPER_SAVE_'+side.toUpperCase()+' '+
    JSON.stringify({tick:first.tick,actor:first.playerId,
     nativeExclusiveStart:true,impulse:first.impulseNs,
     lateralApproachTicks:realDiveTicks,real3DFlight:observedFlight,
     saveConfirmed:false,officialPossession:false})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});

 test('SHOT-06 witness does not award saves for contact or parry, and records actual full-ball crossing only',()=>{
  const witness=createKeeperShotObserver('home'),ball={velocity:{x:20,y:0,z:0}};
  const real=(tick,playerId,action)=>({tick,playerId,action,appliedByRapier:true,actualPhysicsImpulseApplied:true});
  const step=(tick,starts=[],action=null,event=null)=>witness.observe({tick,ball,starts,action,event});
  assert.equal(step(1,[],real(1,'home-10','shot')).shots,0);
  assert.equal(step(2,['home-10'],real(2,'home-10','shot')).shots,1);
  assert.equal(step(3,['away-1']).keeperContactTick,3);
  assert.equal(step(4,['away-1'],real(4,'away-1','save')).parryTick,4);
  assert.equal(step(5,[],null,{tick:5,kind:'goal',crossing:{fullBallCrossed:false}}).crossing,null);
  const goal=step(6,[],null,{tick:6,kind:'goal',scoringTeam:'home',crossing:{fullBallCrossed:true}});
  assert.equal(goal.crossing.kind,'goal');assert.equal(goal.officialSave,false);
  assert.equal(goal.officialGoal,false);
 });
 test('SHOT-06 real keeper duel baseline across 30 mirrored variants', {timeout:240000},async()=>{
  const R=await initializeRapier(rapier),counts={shots:0,contacts:0,parries:0,goals:0,otherExit:0,unresolved:0,noShot:0,diveAttempts:0,limitedDives:0,gloveContacts:0,catches:0,deflections:0,rebounds:0,secondShots:0};
  const bySide={home:{dives:0,contacts:0},away:{dives:0,contacts:0}};
  for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
   const scene=createControlledActionLab(R,'keeper-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true});
   try{
    let f=scene.snapshot();assert.equal(f.keeperShotAudit.shots,0);
    const shots=new Set(),contacts=new Set(),parries=new Set();
    let previousFacing=f.observedMovementPlayers.find(p=>p.id===f.keeperShotAudit.keeperId).facingRad;
    for(let n=0;n<600;n++){
     f=scene.step();const audit=f.keeperShotAudit;
     if(f.keeperDive?.started){counts.diveAttempts++;bySide[side].dives++;if(f.keeperDive.plan?.limited)counts.limitedDives++;}
     if(f.keeperDive?.contactStarted){counts.gloveContacts++;bySide[side].contacts++;}
     if(f.keeperDive?.catchState?.confirmedTick===f.physicsTick)counts.catches++;
     if(audit.deflection?.tick===f.physicsTick)counts.deflections++;
     if(audit.reboundTick===f.physicsTick)counts.rebounds++;
     if(audit.secondShotTick===f.physicsTick)counts.secondShots++;
     const keeper=f.observedMovementPlayers.find(p=>p.id===audit.keeperId);
     const change=Math.atan2(Math.sin(keeper.facingRad-previousFacing),Math.cos(keeper.facingRad-previousFacing));
     assert.ok(Math.abs(change)<=PLAYER_TURN_RAD_PER_S*FIXED_DT+1e-8,'one capped keeper turn per tick');
     assert.ok(Math.cos(keeper.facingRad)*(side==='home'?-1:1)>=-1e-8,'keeper faces the field, not its own goal');
     previousFacing=keeper.facingRad;
     if(f.action?.action==='shot'&&f.action.team===side&&f.action.actualPhysicsImpulseApplied)shots.add(f.physicsTick);
     if(f.starts.includes(audit.keeperId)||f.keeperDive?.contactStarted)contacts.add(f.physicsTick);
     if(f.action?.playerId===audit.keeperId&&f.action.action==='save'&&f.action.actualPhysicsImpulseApplied)parries.add(f.physicsTick);
     assert.equal(audit.officialSave,false);assert.equal(audit.officialGoal,false);
     assert.equal(f.officialMatchResult,null);
     if(f.refereeEvidence?.lastEvent)break;
    }
    const audit=f.keeperShotAudit;assert.equal(audit.shots,shots.size);
    if(audit.shots===0)counts.noShot++;
    else{
     counts.shots+=audit.shots;assert.ok(shots.has(audit.shotTick));
     if(audit.keeperContactTick!==null){assert.ok(contacts.has(audit.keeperContactTick));counts.contacts++;}
     if(audit.parryTick!==null){assert.ok(parries.has(audit.parryTick));counts.parries++;}
     if(audit.crossing){assert.equal(f.refereeEvidence.lastEvent.crossing.fullBallCrossed,true);
      assert.equal(audit.crossing.tick,f.refereeEvidence.lastEvent.tick);
      counts[audit.crossing.kind==='goal'?'goals':'otherExit']++;
     }else counts.unresolved++;
    }
   }finally{scene.dispose();}
  }
  assert.ok(counts.shots>0,'existing live context must generate genuine shots');
  process.stdout.write('ME_628_SHOT_06_BASELINE '+JSON.stringify({...counts,bySide})+'\n');
  // GK-07 is a functional integration gate, NOT a calibrated save rate.
  for(const side of ['home','away']){
   assert.ok(bySide[side].dives>0,side+' integrated shooter must provoke a real dive');
   assert.ok(bySide[side].contacts>0,side+' integrated dive must physically contact the original ball at least once');
  }
 });

 test('GK-01 keeper watches the ball instead of spinning with lateral or backward velocity',()=>{
  const limits={dt:FIXED_DT,maxSpeed:7,acceleration:8,braking:8,turnRate:PLAYER_TURN_RAD_PER_S,maxX:51.99,maxY:33.49};
  const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1;
   const keeper={team,x:-dir*48,y:0,facingRad:team==='home'?0:Math.PI,vx:-dir,vy:2};
   const target={x:keeper.x+dir*15,y:4};
   const ideal=Math.atan2(4,dir*15);
   for(let tick=0;tick<60;tick++){
    const prior=keeper.facingRad;
    keeper.facingRad=advanceGoalkeeperBallOrientation(keeper,target,limits);
    assert.ok(Math.abs(delta(keeper.facingRad,prior))<=PLAYER_TURN_RAD_PER_S*FIXED_DT+1e-9);
   }
   assert.ok(Math.abs(delta(keeper.facingRad,ideal))<1e-9);
   // Ball passing behind the keeper must not cause a 180-degree reversal.
   for(let tick=0;tick<60;tick++){
    const prior=keeper.facingRad;
    keeper.facingRad=advanceGoalkeeperBallOrientation(keeper,{x:keeper.x-dir,y:0},limits);
    assert.ok(Math.abs(delta(keeper.facingRad,prior))<=PLAYER_TURN_RAD_PER_S*FIXED_DT+1e-9);
    assert.ok(Math.cos(keeper.facingRad)*dir>=-1e-9);
   }
  }
 });

 test('GK-03 dive uses mirrored inbound shot trajectory and rejects unreachable or outbound balls',()=>{
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1,keeper={id:team+'-1',team,x:-dir*48,y:0};
   const ball={position:{x:keeper.x+dir*6,y:1.2,z:0.11},velocity:{x:-dir*18,y:0,z:0}};
   const plan=planNativeKeeperDive(keeper,ball);assert.ok(plan);
   assert.ok(plan.target.y>keeper.y);assert.ok(plan.eta>0);
   assert.equal(planNativeKeeperDive(keeper,{...ball,velocity:{x:dir*18,y:0,z:0}}),null);
   assert.equal(planNativeKeeperDive(keeper,{...ball,position:{...ball.position,y:9}}),null);
  }
 });
 test('GK-03 real Rapier glove reaches and deflects a live shot; no synthetic save', {timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1,keeper={id:team+'-1',team,x:-dir*48,y:0};
   const world=new R.World({x:0,y:0,z:0});world.timestep=FIXED_DT;
   const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(keeper.x+dir*6,1.2,0.21)
    .setLinvel(-dir*18,0,0).setCcdEnabled(true));
   const ballCollider=world.createCollider(R.ColliderDesc.ball(0.11).setMass(0.43),body);
   const dive=createNativeKeeperDive(R,world,ballCollider,keeper);
   let started=0,hit=0,changed=false;
   try{
    for(let tick=1;tick<=90;tick++){
     const prior={position:body.translation(),velocity:body.linvel()};
     dive.prepare({players:[keeper]},tick,prior,tick===1?{tick:0,action:'shot',team:team==='home'?'away':'home',appliedByRapier:true,actualPhysicsImpulseApplied:true}:null);
     world.step();const snap=dive.observe(tick,body.linvel());
     if(snap.contact)assert.deepEqual(snap.contactMotion.after,{...body.linvel()});
     if(snap.started)started++;
     if(snap.contactStarted)hit++;
     if(Math.abs(body.linvel().x+dir*18)>0.1||Math.abs(body.linvel().y)>0.1)changed=true;
     assert.equal(snap.officialSave,false);
    }
    assert.equal(started,1);assert.ok(hit>0,'actual glove solver contact required');
    assert.ok(changed,'native ball velocity must change');
    assert.equal(dive.snapshot().phase,'ready');
   }finally{world.free();}
  }
 });

 test('GK-04 measures only real contact response and leaves the second ball live',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,keeperId=(side==='home'?'away':'home')+'-1';
   const witness=createKeeperShotObserver(side),ball={position:{x:dir*48,y:0,z:0.11},velocity:{x:dir*18,y:0,z:0}};
   const real=(tick)=>({tick,playerId:side+'-10',action:'shot',appliedByRapier:true,actualPhysicsImpulseApplied:true});
   const contact={tick:2,keeperId,contact:true,contactStarted:true,source:'native-rapier-solver-manifold',
    contactMotion:{before:{x:dir*18,y:0,z:0},after:{x:-dir*6,y:2,z:0}}};
   assert.equal(observeKeeperDeflection(side,{...contact,contact:false}),null);
   assert.equal(observeKeeperDeflection(side,{...contact,contactMotion:{before:contact.contactMotion.before,
    after:{x:dir*17.99,y:0.01,z:0}}}),null);
   assert.equal(observeKeeperDeflection(side,contact).kind,'reversed');
   const sample=(tick,velocity,extra={})=>witness.observe({tick,ball:{...ball,velocity},starts:[],action:null,event:null,...extra});
   sample(1,ball.velocity,{starts:[side+'-10'],action:real(1)});
   const deflected=sample(2,contact.contactMotion.after,{keeperDive:contact});
   assert.equal(deflected.deflection.kind,'reversed');assert.equal(deflected.reboundTick,null);
   const live=sample(3,contact.contactMotion.after);
   assert.equal(live.reboundTick,3);assert.equal(live.crossing,null);assert.equal(live.officialSave,false);
   const follow=sample(4,ball.velocity,{starts:[side+'-10'],action:real(4)});
   assert.equal(follow.shots,2);assert.equal(follow.secondShots,1);
   assert.equal(follow.reboundTick,null);assert.equal(follow.deflection,null);
  }
 });
 test('GK-04 a glove deflection can still result in a goal or a boundary exit',()=>{
  for(const kind of ['goal','goal-line','touchline']){
   const w=createKeeperShotObserver('home'),ball={position:{x:52,y:0,z:0.11},velocity:{x:18,y:0,z:0}};
   w.observe({tick:1,ball,starts:['home-10'],action:{tick:1,playerId:'home-10',action:'shot',appliedByRapier:true,actualPhysicsImpulseApplied:true}});
   const result=w.observe({tick:2,ball,starts:[],action:null,keeperDive:{
    tick:2,keeperId:'away-1',contact:true,contactStarted:true,source:'native-rapier-solver-manifold',
    contactMotion:{before:{x:18,y:0,z:0},after:{x:15,y:2,z:0}}},
    event:{tick:2,kind,crossing:{fullBallCrossed:true},scoringTeam:kind==='goal'?'home':null}});
   assert.equal(result.deflection.kind,'redirected');assert.equal(result.crossing.kind,kind);
   assert.equal(result.reboundTick,null);assert.equal(result.officialSave,false);
  }
 });

 test('GK-05 grip requires real contact, reachable slow ball and own penalty area',()=>{
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1;
   const e={team,contact:true,ballPosition:{x:-dir*48,y:0,z:1},glovePosition:{x:-dir*48,y:0.30,z:1},
    before:{x:-dir*5,y:0,z:0},after:{x:-dir*0.5,y:0,z:0},gloveVelocity:{x:0,y:0,z:0}};
   assert.equal(eligibleKeeperGrip(e),true);
   assert.equal(eligibleKeeperGrip({...e,contact:false}),false);
   assert.equal(eligibleKeeperGrip({...e,before:{x:-dir*22,y:0,z:0}}),false);
   assert.equal(eligibleKeeperGrip({...e,after:{x:-dir*9,y:0,z:0}}),false);
   assert.equal(eligibleKeeperGrip({...e,ballPosition:{...e.ballPosition,x:-dir*30},glovePosition:{...e.glovePosition,x:-dir*30}}),false);
  }
 });
 test('GK-05 original dynamic ball stays constrained after native glove contact; release restores free flight',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1,world=new R.World({x:0,y:0,z:0});world.timestep=FIXED_DT;
   const hand=world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(-dir*48,0,1));
   const glove=world.createCollider(R.ColliderDesc.ball(0.21).setRestitution(0),hand);
   const ball=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(-dir*47.5,0,1).setLinvel(-dir*3,0,0).setCcdEnabled(true));
   const collider=world.createCollider(R.ColliderDesc.ball(0.11).setMass(0.43).setRestitution(0),ball);
   const grip=createNativeKeeperGrip(R,world,hand,ball,team);
   try{
    let started=null,confirmed=null;
    for(let tick=1;tick<=40;tick++){
     const before={...ball.linvel()};world.step();
     let contact=false;world.contactPair(collider,glove,m=>{if(m.numContacts()>0&&m.numSolverContacts()>0)contact=true;});
     if(started===null&&contact&&grip.tryGrip(tick,{contact,ballPosition:ball.translation(),before,after:ball.linvel(),glovePosition:hand.translation(),gloveVelocity:hand.linvel()}))started=tick;
     const state=grip.observe(tick);
     assert.equal(state.officialPossession,false);assert.equal(state.officialSave,false);
     if(state.confirmedTick!==null){confirmed=state.confirmedTick;break;}
    }
    assert.ok(started!==null,'requires a real native contact');assert.ok(confirmed>=started+6);
    const before={...ball.translation()};
    for(let n=1;n<=10;n++){hand.setNextKinematicTranslation({x:-dir*48,y:n*0.02,z:1});world.step();assert.equal(grip.observe(confirmed+n).active,true);}
    assert.ok(ball.translation().y-before.y>0.10);
    grip.release();assert.equal(grip.active(),false);
    const released={...ball.translation()};
    hand.setNextKinematicTranslation({x:-dir*48,y:0.8,z:1});world.step();
    assert.ok(Math.abs(ball.translation().y-released.y)<0.1);
   }finally{world.free();}
  }
 });

 test('GK-06 actual loose-ball pursuit is mirrored, leads lateral rebounds and remains in field',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,attacker={id:side+'-10',x:dir*42,y:0};
   const ball={x:dir*46,y:2},velocity={x:-dir*5,y:3};
   const target=keeperDuelReboundTarget(side,0,attacker,ball,velocity);
   assert.ok(target.x*dir<ball.x*dir);
   assert.ok(target.y>ball.y);
   const edge=keeperDuelReboundTarget(side,0,attacker,{x:dir*51.9,y:33.4},{x:dir*20,y:20});
   assert.ok(Math.abs(edge.x)<=51.99&&Math.abs(edge.y)<=33.49);
  }
 });
 test('GK-06 sideways loose ball, authentic recovery, follow-up shot and held-ball negatives',()=>{
  for(const side of ['home','away']){
   const dir=side==='home'?1:-1,keeperId=(side==='home'?'away':'home')+'-1',shooterId=side+'-10';
   const w=createKeeperShotObserver(side),position={x:dir*48,y:0,z:0.11};
   const real=tick=>({tick,playerId:shooterId,action:'shot',appliedByRapier:true,actualPhysicsImpulseApplied:true});
   const sample=(tick,velocity,extra={})=>w.observe({tick,ball:{position,velocity},starts:[],action:null,event:null,...extra});
   const launch={x:dir*18,y:0,z:0},lateral={x:dir*1,y:4,z:0};
   sample(1,launch,{starts:[shooterId],action:real(1)});
   const glove={tick:2,keeperId,contact:true,contactStarted:true,source:'native-rapier-solver-manifold',contactMotion:{before:launch,after:lateral}};
   sample(2,lateral,{keeperDive:glove});
   assert.equal(sample(3,lateral,{keeperDive:{tick:3,keeperId,catchState:{active:true,confirmedTick:null}}}).reboundTick,null);
   assert.equal(sample(4,lateral,{keeperDive:{tick:4,keeperId,catchState:{active:false,released:true}}}).reboundTick,null);
   assert.equal(sample(5,lateral).reboundTick,5);
   assert.equal(sample(6,lateral,{starts:[shooterId,keeperId]}).reboundRecoveryTick,null);
   assert.equal(sample(7,lateral,{starts:[shooterId]}).reboundRecoveryTick,7);
   assert.equal(sample(8,launch,{action:real(8)}).secondShots,0);
   const shot=sample(9,launch,{starts:[shooterId],action:real(9)});
   assert.equal(shot.secondShots,1);assert.equal(shot.secondShotTick,9);
   assert.equal(shot.officialGoal,false);assert.equal(shot.officialSave,false);
  }
 });

 test('GK-07 corner shots trigger bounded full-body extension or a genuine limited attempt',()=>{
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1,keeper={id:team+'-1',team,x:-dir*48,y:0};
   const make=(y,dist,speed)=>({position:{x:keeper.x+dir*dist,y,z:0.11},velocity:{x:-dir*speed,y:0,z:0}});
   const corner=planNativeKeeperDive(keeper,make(2.4,6,9));assert.ok(corner);
   assert.ok(Math.hypot(corner.target.y-corner.start.y,corner.target.z-corner.start.z)>1.85);
   const fast=planNativeKeeperDive(keeper,make(3.1,4,24));assert.ok(fast?.limited);
   const travel=Math.hypot(fast.target.y-fast.start.y,fast.target.z-fast.start.z);
   assert.ok(travel<=2.65+1e-8);assert.ok(travel/(fast.reachTicks*FIXED_DT)<=8.5+1e-8);
   assert.equal(planNativeKeeperDive(keeper,make(9,6,9)),null);
  }
 });

 test('GK-07 close keeper challenge needs real nearby attacker and reachable ball in penalty area',()=>{
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1,keeper={id:team+'-1',team,x:-dir*48,y:0};
   const attacker={id:(team==='home'?'away':'home')+'-10',team:team==='home'?'away':'home',x:keeper.x+dir*1.5,y:0};
   const ball={position:{x:keeper.x+dir*0.8,y:0,z:0.11},velocity:{x:0,y:0,z:0}};
   assert.ok(planNativeKeeperChallenge(keeper,attacker,ball));
   assert.equal(planNativeKeeperChallenge(keeper,{...attacker,y:6},ball),null);
   assert.equal(planNativeKeeperChallenge(keeper,attacker,{...ball,velocity:{x:-dir*18,y:0,z:0}}),null);
   assert.equal(planNativeKeeperChallenge({...keeper,x:-dir*30},attacker,ball),null);
  }
 });
 test('GK-07 native pre-shot keeper challenge makes physical contact without a shot',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const team of ['home','away']){
   const dir=team==='home'?1:-1,keeper={id:team+'-1',team,x:-dir*48,y:0};
   const attacker={id:(team==='home'?'away':'home')+'-10',team:team==='home'?'away':'home',x:keeper.x+dir*1.5,y:0};
   const world=new R.World({x:0,y:0,z:0});world.timestep=FIXED_DT;
   const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(keeper.x+dir*0.8,0,0.21).setCcdEnabled(true));
   const collider=world.createCollider(R.ColliderDesc.ball(0.11).setMass(0.43),body);
   const dive=createNativeKeeperDive(R,world,collider,keeper,null,{closeChallengeEnabled:true});
   let attempt=false,contact=false;
   try{
    for(let tick=1;tick<=40;tick++){
     dive.prepare({players:[keeper,attacker]},tick,{position:body.translation(),velocity:body.linvel()},null);
     world.step();const f=dive.observe(tick,body.linvel());
     if(f.started){assert.equal(f.plan.kind,'challenge');attempt=true;}
     if(f.contactStarted)contact=true;
     assert.equal(f.officialSave,false);
    }
    assert.ok(attempt);assert.ok(contact,'real solver contact without prior shot');
   }finally{world.free();}
  }
 });
 test('GK-07 active single-shot duel never executes a second attacking shot',{timeout:120000},async()=>{
  const R=await initializeRapier(rapier);
  for(const side of ['home','away']){
   let observedShots=0;
   for(const variantIndex of [0,4,11,19]){
    const scene=createControlledActionLab(R,'keeper-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,keeperSingleShot:true});
    try{
     let shotTick=null;
     for(let n=0;n<600;n++){
      const f=scene.step();
      if(f.action?.action==='shot'&&f.action.playerId===side+'-10'){
       assert.equal(shotTick,null,'only one authentic attacking strike');shotTick=f.physicsTick;observedShots++;
      }
      assert.ok(f.keeperShotAudit.shots<=1);
      if(f.refereeEvidence?.lastEvent||f.keeperDive?.catchState?.confirmedTick!=null)break;
     }
    }finally{scene.dispose();}
   }
   assert.ok(observedShots>0,side+' active duel must preserve authentic shots');
  }
 });
