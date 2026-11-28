// #628 LAB-SMALL-01: real 2–7 selected shoe-collider mini situations.
// Genuine Rapier sample and uniform policy only; no 11v11 match or authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,goalkeeperPosition,planNativeThrowInClearance} from '../src/player-movement.mjs';
import {SMALL_SIDED_LAB_SCENARIOS,smallSidedSetup,SMALL_SIDED_VARIANT_COUNT,
 keeperDuelAttackerTarget,keeperDuelGoalkeeperTarget,planCollectiveApproaches,planCollectiveSupport,planCollectiveDefense,planNativeFootballMovement,supportsNativeOpenPlay,planNativeKeeperCloseDown,planNativeKeeperHighIntercept,NATIVE_HIGH_HAND_MAX_Z,planNativeAerialContest}
 from '../src/small-sided-lab-scenarios.mjs';
import {createControlledActionLab,projectActiveLabDecisions,createNativeFullFieldSession} from '../src/action-labs.mjs';
import {createCollectiveBallControlObserver,createNativeBallControlObserver,createDribbleTransitionObserver,chooseCollectiveDefensiveTouch,planNativeDefensiveIntervention,isNativeRecoveryLocked,applyNativeSlideRecovery} from '../src/isolated-dribble-touches.mjs';
import {observeNativeShotBlock,planNativeShotBlock} from '../src/defensive-intervention-selection.mjs';
import {selectUniformAutonomousContactAction,chooseRecipient,eligibleLiveKeeperSave,chooseNativeHeaderIntent,chooseNativeLoftedRecipient,chooseNativeVolleyIntent} from '../src/player-ball-uniform-autonomous-action.mjs';
import {planNativeCarryTouch,chooseNativePassInterceptionTouch} from '../src/isolated-dribble-touches.mjs';
import {planNativeKeeperDive,planNativeKeeperHighClaim,planNativeHighHandAction,planNativeKeeperChallenge,eligibleKeeperGrip,planNativeKeeperDistribution,createNativeAerialHead,planNativeAerialJump,aerialHeadHeight,AERIAL_JUMP_TICKS,planNativeAerialControl,planNativeAerialCushion,createNativeAerialControl,exclusiveNativeAerialStart,observeNativeAerialDuel} from '../src/small-sided-native-body-guard.mjs';
import {planSlidingTackle} from '../src/sliding-tackle.mjs';
import {detectFirstFullyOutBallB05} from '../src/basic-match-referee-b05.mjs';
import {createNativeFundamentalMask,nativeObservedActionAllowed} from '../src/native-fundamental-mask.mjs';
import {SOLO_CARRY_PHASES,advanceSoloCarryPhase} from '../src/solo-carry-phases.mjs';

test('COL-01 both teams pursue the real ball without a shirt-number runner or inferred possession',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const a={id:side+'-10',team:side,x:dir*26,y:-3};
  const b={id:side+'-9',team:side,x:dir*29,y:1};
  const d={id:other+'-2',team:other,x:dir*31,y:0};
  const ball={x:dir*30,y:1},velocity={x:dir,y:0};
  const plan=planCollectiveApproaches([a,b,d],ball,velocity);
  assert.deepEqual(plan,planCollectiveApproaches([d,b,a],ball,velocity));
  assert.equal(plan[b.id].kind,'approach-ball');assert.equal(plan[a.id].kind,'support-run');
  assert.ok(['press-ball','approach-ball'].includes(plan[d.id].kind));
  const moved={...a,x:dir*29.9,y:1};
  const switched=planCollectiveApproaches([moved,{...b,x:dir*25},d],ball,velocity);
  assert.equal(switched[a.id].kind,'approach-ball');assert.equal(switched[b.id].kind,'support-run');
  for(const entry of Object.values(switched)){assert.equal(entry.decisionOnly,true);assert.equal(entry.officialPossession,false);}
 }
});
test('COL-02 native control releases on pass and contest, never on intended recipient alone',()=>{
 for(const side of ['home','away']){
  const other=side==='home'?'away':'home',dir=side==='home'?1:-1;
  const a={id:side+'-10',team:side,x:dir*29.6,y:0},b={id:side+'-9',team:side,x:dir*27,y:2},d={id:other+'-2',team:other,x:dir*30.6,y:0};
  const players=[a,b,d],ids=players.map(p=>p.id),keeper=other+'-1';
  const obs=createCollectiveBallControlObserver([...ids,keeper],ids);
  const ball={position:{x:dir*30,y:0,z:0.11},velocity:{x:dir,y:0,z:0}};
  const action=(tick,playerId,kind)=>({tick,playerId,action:kind,appliedByRapier:true,actualPhysicsImpulseApplied:true});
  const step=(tick,starts=[],active=starts,act=null,bodyActive=[])=>obs.observe({tick,players,ball,starts,active,action:act,bodyActive});
  assert.equal(obs.snapshot().kind,'loose');
  assert.equal(step(1,[a.id]).kind,'loose');
  assert.equal(step(2,[a.id],[a.id],action(2,a.id,'carry')).playerId,a.id);
  const plan=planCollectiveApproaches(players,ball.position,ball.velocity,obs.snapshot());
  assert.equal(plan[a.id].kind,'carry-ball');assert.equal(plan[b.id].kind,'support-run');
  assert.equal(plan[d.id].kind,'press-ball');
  const released=step(3,[a.id],[a.id],{...action(3,a.id,'pass'),recipientId:b.id});
  assert.equal(released.kind,'loose');assert.equal(released.delivery.recipientId,b.id);
  assert.equal(step(4,[b.id]).kind,'loose');
  assert.equal(step(5,[d.id],[d.id],action(5,d.id,'carry')).playerId,d.id);
  assert.equal(step(6,[],[d.id],null,[keeper]).kind,'loose');
  assert.equal(step(7).kind,'loose');
 }
});
test('UME-05H keeper delivery requires prior confirmed grip and does not assign receiver control',()=>{
 for(const team of ['home','away']){
  const other=team==='home'?'away':'home',dir=team==='home'?1:-1;
  const k={id:team+'-1',team,role:'goalkeeper',x:-dir*48,y:0};
  const mate={id:team+'-4',team,role:'defender',x:-dir*36,y:3};
  const rival={id:other+'-7',team:other,role:'midfielder',x:-dir*44,y:0};
  const players=[k,mate,rival],ids=players.map(p=>p.id);
  const obs=createNativeBallControlObserver(ids,[mate.id,rival.id]);
  const ball={position:{x:-dir*46,y:0,z:0.11},velocity:{x:dir*2,y:0,z:0}};
  assert.ok(planNativeKeeperCloseDown(k,rival,ball.position,ball.velocity));
  assert.equal(planNativeKeeperCloseDown(k,mate,ball.position,ball.velocity),null);
  const grip={keeperId:k.id,tick:1,catchState:{active:true,confirmedTick:1}};
  const d={keeperId:k.id,team,recipientId:mate.id,kind:'pass',tick:2,confirmedGripTick:1,appliedByRapier:true,actualPhysicsImpulseApplied:true,nativeGripReleased:true};
  const state={keeperId:k.id,tick:2,distribution:d,catchState:{active:false,released:true}};
  const base={players,ball,starts:[],active:[],action:null};
  const invalid=createNativeBallControlObserver(ids,[mate.id,rival.id]);
  invalid.observe({...base,tick:1});
  assert.equal(invalid.observe({...base,tick:2,keeperStates:[state]}).delivery,null);
  assert.equal(obs.observe({...base,tick:1,keeperStates:[grip]}).keeperHold.keeperId,k.id);
  const released=obs.observe({...base,tick:2,keeperStates:[state]});
  assert.equal(released.keeperHold,null);assert.equal(released.kind,'loose');
  assert.equal(released.delivery.source,'native-keeper-grip-release');assert.equal(released.delivery.recipientId,mate.id);
  assert.equal(released.playerId,null);assert.equal(released.officialPossession,false);
  const received=obs.observe({...base,tick:3,starts:[mate.id],active:[mate.id]});
  assert.equal(received.delivery,null);assert.equal(received.kind,'loose');
 }
});
test('UME-01 identical native control lifecycle regardless of number of participants',()=>{
 assert.equal(createCollectiveBallControlObserver,createNativeBallControlObserver);
 for(const side of ['home','away']){
  const other=side==='home'?'away':'home',dir=side==='home'?1:-1;
  const a={id:side+'-10',team:side,x:dir*29.6,y:0};
  const d={id:other+'-2',team:other,x:dir*30.6,y:0};
  const teammate={id:side+'-9',team:side,x:dir*24,y:4};
  const ball={position:{x:dir*30,y:0,z:0.11},velocity:{x:dir,y:0,z:0}};
  const duel=createDribbleTransitionObserver(side);
  const pair=createNativeBallControlObserver([a.id,d.id],[a.id,d.id]);
  const group=createNativeBallControlObserver([a.id,d.id,teammate.id],[a.id,d.id,teammate.id]);
  const field=Array.from({length:22},(_,n)=>({id:(n<11?'home':'away')+'-'+(n%11+1),team:n<11?'home':'away',x:0,y:0})).map(p=>p.id===a.id?a:p.id===d.id?d:p.id===teammate.id?teammate:p);
  const full=createNativeBallControlObserver(field.map(p=>p.id),field.filter(p=>!p.id.endsWith('-1')).map(p=>p.id));
  const core=x=>({kind:x.kind,playerId:x.playerId,sourceTick:x.sourceTick,officialPossession:x.officialPossession});
  for(const [tick,contact,kind] of [[1,a.id,'carry'],[2,a.id,null],[3,d.id,'carry'],[4,d.id,'pass'],[5,a.id,null],[6,a.id,'carry']]){
   const action=kind?{tick,playerId:contact,action:kind,appliedByRapier:true,actualPhysicsImpulseApplied:true}:null;
   const sample={tick,ball,starts:[contact],active:[contact],bodyStarts:[],bodyActive:[],action};
   const x=pair.observe({...sample,players:[a,d]});
   assert.deepEqual(core(x),core(group.observe({...sample,players:[a,d,teammate]})));
   assert.deepEqual(core(x),core(full.observe({...sample,players:field})));
   assert.deepEqual(core(x),duel.observe({...sample,players:[a,d]}).ballControl);
   assert.equal(x.kind,kind==='carry'||tick===2?'controlled':'loose');
  }
  const sample={tick:7,ball,starts:[],active:[],action:null,players:[a,d],physicalChallengeReleased:true};
  assert.equal(pair.observe(sample).kind,'loose');
 }
});
test('COL-04 support opens a real passing lane and mirrors without shirt preference',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const ball={x:dir*30,y:0};
  const player={id:side+'-9',team:side,x:dir*34,y:0};
  const opponents=[{id:other+'-2',team:other,x:dir*32,y:0},{id:other+'-1',team:other,x:dir*51,y:0}];
  const support=planCollectiveSupport({player,ball,opponents});
  assert.equal(support.safeLane,true);
  assert.ok(support.laneClearanceM>=1.9&&support.opponentGapM>=1.6);
  assert.ok(Math.abs(support.target.y)>0.1,'leave the blocked straight lane');
  assert.deepEqual(support,planCollectiveSupport({player:{...player,id:side+'-10'},ball,opponents:[...opponents].reverse()}));
  assert.equal(support.officialPossession,false);
  const boundary=planCollectiveSupport({player:{...player,y:32},ball:{...ball,y:33},opponents});
  assert.ok(Math.abs(boundary.target.y)<=33.49&&Math.abs(boundary.target.x)<=51.99);
 }
});
test('COL-05 defending team presses and covers without formation-role restriction',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const owner={id:side+'-2',team:side,role:'defender',x:dir*30,y:0};
  const defender={id:other+'-10',team:other,role:'forward',x:dir*31.0,y:0.3};
  const cover={id:other+'-9',team:other,role:'forward',x:dir*34,y:3};
  const ball={x:dir*30.4,y:0,z:0.11},velocity={x:0.2*dir,y:0,z:0};
  const players=[owner,defender,cover],control={kind:'controlled',playerId:owner.id};
  const plan=planCollectiveApproaches(players,ball,velocity,control);
  assert.equal(plan[owner.id].kind,'carry-ball');
  assert.equal(plan[defender.id].kind,'press-ball');
  assert.equal(plan[cover.id].kind,'cover-pass');
  assert.ok(dir*(plan[defender.id].target.x-ball.x)>0);
  assert.ok(Math.hypot(plan[defender.id].target.x-plan[cover.id].target.x,plan[defender.id].target.y-plan[cover.id].target.y)>1);
  assert.equal(planCollectiveDefense({player:defender,ball,velocity,opponents:[owner],owner}).officialPossession,false);
  const touch=chooseCollectiveDefensiveTouch({player:defender,players,ballPosition:ball,ballVelocity:velocity,control,tick:5});
  assert.equal(touch?.kind,'tackle');assert.equal(touch.officialPossession,false);
  assert.equal(chooseCollectiveDefensiveTouch({player:defender,players,ballPosition:ball,ballVelocity:velocity,control:{kind:'loose'},tick:5}),null);
  const passer={...owner,x:dir*26};
  const incoming={x:dir*2,y:0,z:0};
  const recipient={id:side+'-8',team:side,x:dir*37,y:0};
  const pass={kind:'loose',delivery:{kind:'pass',team:side,playerId:passer.id,recipientId:recipient.id,tick:4}};
  const interception=chooseCollectiveDefensiveTouch({player:defender,players:[passer,recipient,defender,cover],ballPosition:ball,ballVelocity:incoming,control:pass,tick:5});
  assert.equal(interception?.kind,'interception');assert.equal(interception.officialPossession,false);
 }
});
test('UME-04 native defense uses shared eligibility and real delivery trajectories',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const a={id:side+'-9',team:side,x:dir*30,y:0};
  const d={id:other+'-10',team:other,role:'forward',x:dir*31,y:0.3};
  const ballPosition={x:dir*30.4,y:0,z:0.11},ballVelocity={x:dir*0.2,y:0,z:0};
  const source={attacker:a,defender:d,ballPosition,ballVelocity};
  const standing=planNativeDefensiveIntervention(source);
  assert.equal(standing.decision.kind,'standing-tackle');
  assert.equal(standing.decision.physicalContactProven,false);
  assert.equal(planNativeDefensiveIntervention({...source,unavailable:true}).decision.kind,'none');
  assert.equal(planNativeDefensiveIntervention({...source,recovering:true}).decision.kind,'recover');
  assert.equal(planNativeDefensiveIntervention({...source,activeSlide:true}).decision.kind,'sliding-tackle');
  const shot={...source,attacker:{...a,x:dir*26},ballVelocity:{x:dir*10,y:0,z:0},context:'shot'};
  const block=planNativeDefensiveIntervention(shot);
  assert.equal(block.decision.kind,'block');assert.equal(block.decision.officialPossession,false);
  assert.equal(planNativeDefensiveIntervention({...shot,defender:{...d,y:8}}).decision.kind,'none');
  assert.equal(planNativeDefensiveIntervention({...shot,ballVelocity:{x:-dir*10,y:0,z:0}}).decision.kind,'none');
  assert.equal(planNativeDefensiveIntervention({...source,defender:{...d,role:'goalkeeper'}}),null);
 }
});
test('UME-04B native slide recovery is pair-scoped and needs a real impulse',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const a={id:side+'-10',team:side,x:dir*29.6,y:0};
  const d={id:other+'-2',team:other,x:dir*30.6,y:0};
  const extra={id:side+'-9',team:side,x:dir*25,y:3};
  const players=[a,d,extra],ids=players.map(p=>p.id);
  const ball={position:{x:dir*30,y:0,z:0.11},velocity:{x:dir,y:0,z:0}};
  const observer=createNativeBallControlObserver(ids,ids);
  const action=(tick,playerId,kind,extra={})=>({tick,playerId,action:kind,appliedByRapier:true,actualPhysicsImpulseApplied:true,...extra});
  observer.observe({tick:1,players,ball,starts:[a.id],active:[a.id],action:action(1,a.id,'carry')});
  const fake=observer.observe({tick:2,players,ball,starts:[],active:[],action:action(2,d.id,'tackle',{defensiveTarget:{intervention:'sliding-tackle',opponentId:a.id}})});
  assert.deepEqual(fake.getUpUntil,{});
  const real=observer.observe({tick:3,players,ball,starts:[d.id],active:[d.id],action:action(3,d.id,'tackle',{defensiveTarget:{intervention:'sliding-tackle',opponentId:a.id}})});
  assert.equal(real.kind,'loose');assert.equal(real.playerId,null);
  assert.equal(real.getUpUntil[d.id],33);assert.equal(real.getUpUntil[a.id],39);
  assert.equal(isNativeRecoveryLocked(real,d.id,4),true);assert.equal(isNativeRecoveryLocked(real,a.id,4),true);
  assert.equal(isNativeRecoveryLocked(real,extra.id,4),false);assert.equal(isNativeRecoveryLocked(real,d.id,34),false);
  assert.deepEqual(applyNativeSlideRecovery({[extra.id]:20},{tick:3,actorId:d.id,opponentId:a.id,intervention:'sliding-tackle'}),{[extra.id]:20,[d.id]:33,[a.id]:39});
 }
});
test('UME-04C native block needs opposing contact, live shot provenance and physical velocity change',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const shooter={id:side+'-10',team:side,x:dir*25,y:0};
  const defender={id:other+'-9',team:other,role:'forward',x:dir*30,y:0};
  const keeper={id:other+'-1',team:other,role:'goalkeeper',x:dir*50,y:0};
  const extra={id:side+'-9',team:side,x:dir*24,y:3};
  const players=[shooter,defender,keeper,extra],ids=players.map(p=>p.id);
  const before={x:dir*10,y:0,z:0},after={x:dir*2,y:3,z:0};
  const sample={tick:2,delivery:{kind:'shot',tick:1,team:side,playerId:shooter.id},players,starts:[defender.id],before,after};
  assert.equal(observeNativeShotBlock(sample).blocked,true);
  assert.equal(observeNativeShotBlock({...sample,starts:[],bodyStarts:[defender.id]}).contactSource,'native-leg-solver');
  assert.equal(observeNativeShotBlock({...sample,after:before}).blocked,false);
  for(const invalid of [{starts:[]},{starts:[shooter.id]},{starts:[keeper.id]},{starts:[defender.id,extra.id]},{delivery:{...sample.delivery,kind:'pass'}},{tick:1}])
   assert.equal(observeNativeShotBlock({...sample,...invalid}),null);
  const obs=createNativeBallControlObserver(ids,ids.filter(id=>id!==keeper.id));
  const ball={position:{x:dir*30,y:0,z:0.11},velocity:before};
  obs.observe({tick:1,players,ball,starts:[shooter.id],active:[shooter.id],action:{tick:1,playerId:shooter.id,action:'shot',appliedByRapier:true,actualPhysicsImpulseApplied:true}});
  const contact=obs.observe({tick:2,players,ball:{...ball,velocity:after},starts:[defender.id],active:[defender.id],beforeBallVelocity:before,afterSolverVelocity:after,action:null});
  assert.equal(contact.blockCount,1);assert.equal(contact.lastBlock.actorId,defender.id);
  assert.equal(contact.kind,'loose');assert.equal(contact.playerId,null);
  assert.equal(obs.observe({tick:3,players,ball,starts:[],active:[],action:null}).blockCount,1);
 }
});
test('UME-03 movement uses the same participant geometry for pair, groups and full field',()=>{
 assert.equal(planCollectiveApproaches,planNativeFootballMovement);
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,other=side==='home'?'away':'home';
  const owner={id:side+'-10',team:side,x:dir*29.6,y:0};
  const rival={id:other+'-2',team:other,x:dir*31.0,y:0.3};
  const ball={x:dir*30,y:0},velocity={x:dir*0.2,y:0};
  const control={kind:'controlled',playerId:owner.id};
  for(const n of [1,2,3,10]){
   const own=[owner,...Array.from({length:n-1},(_,j)=>({id:side+'-extra-'+j,team:side,x:dir*(20-j),y:5+j*2}))];
   const away=[rival,...Array.from({length:n-1},(_,j)=>({id:other+'-extra-'+j,team:other,x:dir*(35+j),y:-5-j*2}))];
   const players=[...own,...away];
   const plan=planNativeFootballMovement(players,ball,velocity,control);
   assert.deepEqual(plan,planNativeFootballMovement([...players].reverse(),ball,velocity,control));
   assert.equal(Object.keys(plan).length,2*n);
   assert.equal(plan[owner.id].kind,'carry-ball');
   assert.equal(plan[rival.id].kind,'press-ball');
   for(const p of own.slice(1))assert.equal(plan[p.id].kind,'support-run');
   for(const p of away.slice(1))assert.equal(plan[p.id].kind,'cover-pass');
   for(const entry of Object.values(plan))assert.ok(entry.decisionOnly&&!entry.officialPossession&&Math.abs(entry.target.x)<=51.99&&Math.abs(entry.target.y)<=33.49);
   if(n===3)for(const group of [own,away])for(let j=0;j<group.length;j++)for(let k=j+1;k<group.length;k++){
    const a=plan[group[j].id].target,b=plan[group[k].id].target;
    assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=1.8,'support/cover waypoints must not converge');
   }
  }
  assert.equal(planNativeFootballMovement([owner],ball,velocity,control)[owner.id].kind,'carry-ball');
 }
});
test('COL-01 opt-in guarded 2v1 advances with canonical movement',async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,'overload-2v1',{shotSide:side,bodyGuardEnabled:true,collectiveApproaches:true});
  try{
   for(let k=0;k<120;k++){
    const f=lab.step();
    const decisions=f.smallSidedMovementDecisions;
    assert.equal(decisions.length,4);
    assert.equal(f.collectiveControl.tick,f.physicsTick);
    assert.equal(f.collectiveControl.officialPossession,false);
    if(f.collectiveControl.kind==='controlled')assert.ok(lab.focus.includes(f.collectiveControl.playerId));
    assert.ok(decisions.every(p=>p.originalCanonicalMover&&p.actionConfirmed===false));
    assert.ok(decisions.some(p=>p.kind==='goalkeeping'));
    if(f.refereeEvidence?.lastEvent)break;
   }
  }finally{lab.dispose();}
 }
});
// UME-06: record observed evidence only; an unobserved outcome remains
// a coverage gap, never a successful action assigned by the fixture.
function nativeReplayAudit(active){
 const activeSet=new Set(active);
 let previous=null,contacts=0,controlled=0,holds=0,distributions=0,receptions=0,keeperReceptions=0,slides=0,shoulders=0,blocks=0,minSeparation=Infinity,peakSpeed=0;
 const actions={},keeperPasses=new Map();
 return {
  observe({tick,ball,players,starts,action,control,keepers,reception}){
   assert.equal(control.tick,tick);
   assert.equal(control.officialPossession,false);
   assert.ok([...Object.values(ball.position),...Object.values(ball.velocity)].every(Number.isFinite));
   const actors=players.filter(p=>activeSet.has(p.id));
   assert.equal(actors.length,active.length);
   for(let i=0;i<actors.length;i++){
    const p=actors[i];
    assert.ok([p.x,p.y,p.vx,p.vy].every(Number.isFinite));
    peakSpeed=Math.max(peakSpeed,Math.hypot(p.vx,p.vy));
    assert.ok(Math.hypot(p.vx,p.vy)<=7+1e-5,'canonical player speed bound');
    for(let j=i+1;j<actors.length;j++){
     const gap=Math.hypot(p.x-actors[j].x,p.y-actors[j].y);
     minSeparation=Math.min(minSeparation,gap);
     assert.ok(gap>=0.98-1e-5,'canonical player separation');
    }
   }
   assert.ok(starts.every(id=>activeSet.has(id)));contacts+=starts.length;
   if(action?.tick===tick){
    assert.ok(activeSet.has(action.playerId));
    assert.deepEqual(starts,[action.playerId]);
    assert.equal(action.appliedByRapier,true);assert.equal(action.actualPhysicsImpulseApplied,true);
    assert.equal(action.officialMatchAction,false);
    actions[action.action]=(actions[action.action]??0)+1;
   }
   if(control.kind==='controlled'){
    controlled++;
    assert.ok(activeSet.has(control.playerId));
    if(previous?.sourceTick!==control.sourceTick||previous?.playerId!==control.playerId){
     assert.equal(action?.action,'carry');assert.equal(action.playerId,control.playerId);assert.equal(control.sourceTick,tick);
    }
   }else assert.equal(control.playerId,null);
   assert.ok(keepers.every(k=>k.tick===tick&&activeSet.has(k.keeperId)&&k.officialSave===false));
   if(control.keeperHold){
    holds++;
    assert.ok(keepers.some(k=>k.keeperId===control.keeperHold.keeperId&&k.catchState?.active));
    assert.equal(control.kind,'loose');assert.equal(control.playerId,null);
   }
   const d=control.keeperDistribution;
   if(d?.tick===tick){
    distributions++;
    assert.equal(previous?.keeperHold?.keeperId,d.keeperId);
    assert.equal(previous.keeperHold.confirmedTick,d.confirmedGripTick);
    assert.equal(d.nativeGripReleased,true);assert.equal(d.actualPhysicsImpulseApplied,true);
    assert.equal(control.playerId,null);
    if(d.kind==='pass'){
     assert.ok(activeSet.has(d.recipientId));
     keeperPasses.set(tick,d);
    }
   }
   if(reception?.tick===tick){
    receptions++;
    assert.deepEqual(starts,[reception.actorId]);
    assert.equal(reception.actualPhysicsImpulseApplied,true);
    assert.equal(reception.nativeExclusiveShoeStart,true);
    assert.equal(reception.officialPossession,false);
    const source=keeperPasses.get(reception.originalPassTick);
    if(source){keeperReceptions++;assert.equal(reception.actorId,source.recipientId);assert.equal(reception.originalPassActorId,source.keeperId);}
   }
   slides+=Object.values(control.lastInterventions??{}).filter(x=>x.tick===tick&&x.intervention==='sliding-tackle').length;
   shoulders+=Object.values(control.shoulderByPlayer??{}).filter(x=>x.tick===tick&&x.successful).length;
   assert.ok(control.blockCount>=blocks);blocks=control.blockCount;
   previous=control;
  },
  report:()=>({contacts,actions,controlled,holds,distributions,receptions,keeperReceptions,slides,shoulders,blocks,minSeparation,peakSpeed})
 };
}

test('UME-06A/B full field native 22-player deterministic replay from midfield and final-third geometries',{timeout:180000},async()=>{
 const R=await initializeRapier(rapier),id='full-field-native',results=[],failures=[];
 for(const side of ['home','away'])for(const variantIndex of [0,1,2,3]){
  const fixture=smallSidedSetup(id,side,INITIAL_PLAYERS,{variantIndex});
  assert.equal(fixture.activeIds.length,22);
  if(variantIndex>0){
   const source=smallSidedSetup(['keeper-1v1','duel-3v3','defender-1v1'][variantIndex-1],side,INITIAL_PLAYERS);
   assert.deepEqual(fixture.staged,source.staged);
   assert.equal(fixture.ball.x,source.ball.x);assert.equal(fixture.ball.y,source.ball.y);
   assert.ok(Math.abs(fixture.ball.x)>20);
  }
  const options={diagnosticSmallSidedSituation:id,diagnosticSmallSidedSide:side,diagnosticSmallSidedVariantIndex:variantIndex,diagnosticPlayerFootContactsEnabled:true,diagnosticAutonomousFixtureActionEnabled:true,diagnosticSmallSidedBodyGuardEnabled:true,diagnosticSmallSidedBodyFeedbackEnabled:true,diagnosticCollectiveActions:true,diagnosticLatestLabDynamics:true};
  assert.throws(()=>createEngine(R,fixture.ball,{...options,diagnosticCollectiveActions:false}),/Full field requires/);
  const x=createNativeFullFieldSession(R,{side,variantIndex}),y=createNativeFullFieldSession(R,{side,variantIndex}),audit=nativeReplayAudit(fixture.activeIds);
  try{
   assert.deepEqual(x.snapshot().activeIds,fixture.activeIds);
   assert.deepEqual(x.snapshot().body.selectedColliderIds,fixture.activeIds);
   assert.equal(x.snapshot().playedTicks,0);
   assert.deepEqual(x.snapshot().allowedFundamentals,['carry','pass','cross','shot','save','tackle','interception','clearance','reception','aerial-control','header','volley','standing-tackle','sliding-tackle','shoulder-challenge','block','header-shot','header-pass','header-clearance']);
   assert.deepEqual(x.snapshot().permittedAerialSurfaces,['head','chest','foot']);
   assert.throws(()=>x.placeRestart(),/verified ready boundary ticket/);
   let prior=x.snapshot().ball.position,pathM=0,ticks=0,boundary=null;
   for(let k=1;k<=600;k++){
    const a=x.step(),b=y.step();
    assert.deepEqual(a.referee,b.referee);assert.deepEqual(a.timeline,b.timeline);
    assert.equal(a.playedTicks,k);assert.equal(a.clock.originalPhysicsSourceTick,k);
    assert.equal(a.officialMatchResult,null);assert.equal(a.matchAuthority,false);
    assert.equal(a.realFull90MinutesVerified,false);
    assert.equal(a.tick,k);assert.deepEqual(a.ball,b.ball);assert.deepEqual(a.players,b.players);
    assert.deepEqual(a.starts,b.starts);assert.deepEqual(a.action,b.action);
    assert.deepEqual(a.allowedFundamentals,b.allowedFundamentals);
    assert.deepEqual(a.permittedAerialSurfaces,['head','chest','foot']);
    assert.deepEqual(a.control,b.control);assert.deepEqual(a.keepers,b.keepers);assert.deepEqual(a.reception,b.reception);
    assert.deepEqual(a.body.selectedColliderIds,fixture.activeIds);assert.equal(a.body.bodies.length,22);
    assert.equal(a.body.oneOriginalRapierWorld,true);assert.equal(a.decisions.length,22);
    assert.equal(a.decisions.filter(d=>d.kind==='goalkeeping').length,2);
    assert.deepEqual(a.keepers.map(d=>d.keeperId),['home-1','away-1']);
    assert.ok(a.keepers.filter(d=>d.catchState?.active).length<=1);
    audit.observe(a);ticks=k;
    pathM+=Math.hypot(a.ball.position.x-prior.x,a.ball.position.y-prior.y);
    boundary=detectFirstFullyOutBallB05(prior,a.ball.position);
    prior=a.ball.position;
    // Do not simulate an invented restart or a live action after dead ball.
    if(boundary){
     assert.equal(boundary.fullBallCrossed,true);
     assert.equal(a.referee.lastEvent.kind,boundary.edge);
     assert.equal(a.referee.lastEvent.tick,k);
     assert.equal(a.timeline.outstandingDeadBall,true);
     assert.equal(a.phase,'dead-ball-awaiting-native-restart');
     assert.deepEqual(a.pendingRestart,a.referee.lastEvent.restart);
     assert.equal(a.provisionalScore.home+a.provisionalScore.away,boundary.goal?1:0);
     assert.throws(()=>x.step(),/paused pending authenticated restart/);
     assert.equal(x.snapshot(),a);
     if(a.pendingRestart.ready){
      const placed=x.placeRestart(),replayed=y.placeRestart();
      assert.deepEqual(placed,replayed);
      assert.equal(placed.tick,k);assert.equal(placed.playedTicks,k);
      assert.equal(placed.phase,'dead-ball-placed-awaiting-native-take');
      assert.equal(placed.referee.restartApplied,true);
      assert.equal(placed.timeline.outstandingDeadBall,false);
      assert.equal(placed.timeline.lastPhysicalRestart.originalRapierBallRepositioned,true);
      assert.equal(placed.physicalRestart.sameOriginalRapierWorld,true);
      assert.equal(placed.physicalRestart.realShoeContact,false);
      assert.equal(placed.physicalRestart.playerTeleports,false);
      assert.deepEqual(placed.players,a.players);
      for(const axis of ['x','y','z'])assert.ok(Math.abs(placed.ball.position[axis]-a.pendingRestart.spot[axis])<1e-5);
      assert.equal(Math.hypot(...Object.values(placed.ball.velocity)),0,'placed ball is exactly stationary (including IEEE signed zero)');
      assert.equal(placed.control.kind,'loose');assert.equal(placed.control.playerId,null);
      assert.equal(placed.control.delivery,null);assert.equal(placed.control.keeperHold,null);
      assert.ok(placed.keepers.every(p=>!p.catchState?.active));
      assert.equal(placed.action,null);assert.equal(placed.reception,null);
      assert.throws(()=>x.placeRestart(),/verified ready boundary ticket/);
      assert.throws(()=>x.step(),/paused pending authenticated restart/);
      assert.equal(x.snapshot(),placed);
      {
       const throwIn=placed.physicalRestart.kind==='throw-in';
       let taken=null,sawGrip=false;
       for(let n=1;n<=1800;n++){
        const u=x.advanceRestart(),v=y.advanceRestart();
        assert.deepEqual(u,v);
        assert.equal(u.tick,k+n);assert.equal(u.playedTicks,k);
        assert.equal(u.action,null);
        if(u.restartTake?.tick===u.tick){taken=u;break;}
        assert.equal(u.phase,'dead-ball-placed-awaiting-native-take');
        if(throwIn&&u.throwHands?.active)sawGrip=true;
        else assert.equal(Math.hypot(...Object.values(u.ball.velocity)),0,'unheld dead ball is exactly stationary');
       }
       if(!taken){
        const f=x.snapshot(),p=f.players.find(p=>p.id===placed.physicalRestart.takerId);
        process.stdout.write('ME_628_UME06_RESTART_STALLED '+JSON.stringify({side,variantIndex,kind:placed.physicalRestart.kind,
         tick:f.tick,playedTicks:f.playedTicks,spot:placed.physicalRestart.spot,taker:p,ball:f.ball,starts:f.starts,throwHands:f.throwHands})+'\n');
       }
       assert.ok(taken,'the original restart taker must complete an authenticated physical take');
       assert.equal(taken.phase,'first-half');
       assert.equal(taken.restartTake.actorId,placed.physicalRestart.takerId);
       if(throwIn){
        assert.ok(sawGrip);assert.deepEqual(taken.starts,[]);
        assert.equal(taken.restartTake.nativeTwoHandSolverContact,true);
        assert.equal(taken.restartTake.nativeGripReleased,true);
        assert.equal(taken.restartTake.originalNativeShoeStart,false);
        assert.equal(taken.restartTake.legalThrowConfirmed,false);
        assert.ok(taken.restartTake.origin.z>=1.65);
        assert.equal(taken.referee.lastVerifiedTouch.nativeHandRelease,true);
       }else{
        assert.deepEqual(taken.starts,[taken.restartTake.actorId]);
        assert.equal(taken.restartTake.currentRapierContactManifold,true);
       }
       assert.equal(taken.restartTake.physicalImpulseApplied,true);
       assert.equal(taken.timeline.lastPhysicalSetPiece.tick,taken.tick);
       assert.equal(taken.officialMatchResult,null);
       assert.throws(()=>x.advanceRestart(),/Native restart requires/);
       const resumed=x.step();assert.deepEqual(resumed,y.step());
       assert.equal(resumed.playedTicks,k+1);assert.equal(resumed.tick,taken.tick+1);
       process.stdout.write('ME_628_UME06_RESTART_TAKE '+JSON.stringify({side,variantIndex,kind:taken.restartTake.type,approachTicks:taken.tick-k,actorId:taken.restartTake.actorId})+'\n');
      }
      process.stdout.write('ME_628_UME06_RESTART_PLACEMENT '+JSON.stringify({side,variantIndex,tick:k,kind:placed.physicalRestart.kind,team:placed.physicalRestart.assignedTeam,clock:placed.clock.label})+'\n');
     }else assert.throws(()=>x.placeRestart(),/verified ready boundary ticket/);
     break;
    }
    assert.equal(a.phase,'first-half');assert.equal(a.pendingRestart,null);
    assert.equal(a.timeline.outstandingDeadBall,false);
   }
   const report=audit.report();
   assert.ok(report.contacts>0);assert.ok(Object.values(report.actions).some(n=>n>0));
   const result={side,variantIndex,players:22,ticks,pathM,boundary:boundary?.edge??null,deterministic:true,...report};
   results.push(result);
   process.stdout.write('ME_628_UME06_FULL '+JSON.stringify(result)+'\n');
  }catch(error){
   failures.push(new Error('UME-06 full field '+side+' variant '+variantIndex+' failed: '+error.message,{cause:error}));
   process.stdout.write('ME_628_UME06_CASE_FAIL '+JSON.stringify({side,variantIndex,message:error.message,stack:error.stack})+'\n');
  }finally{x.dispose();y.dispose();}
 }
 if(failures.length)throw new AggregateError(failures,'Independent native full-field cases failed: '+failures.map(e=>e.message).join('; '));
 assert.equal(results.length,8);
 assert.ok(results.some(r=>r.boundary==='goal'),'must independently observe an actual full-ball goal');
 assert.ok(results.some(r=>r.boundary==='touchline'),'must independently observe a real touchline exit');
});
test('UME-06D3 bounded native two halves with authentic second-half kickoff and terminal live gate',{timeout:180000},async()=>{
 const R=await initializeRapier(rapier);
 assert.throws(()=>createNativeFullFieldSession(R,{researchHalfTicks:119}),/bounded physical half/);
 for(const side of ['home','away']){
  const session=createNativeFullFieldSession(R,{side,researchHalfTicks:120});
  try{
   assert.equal(session.snapshot().phase,'first-half');
   assert.throws(()=>session.placeSecondHalf(),/exact half-time/);
   for(let k=1;k<=120;k++)assert.equal(session.step().playedTicks,k);
   const stopped=session.snapshot();
   assert.equal(stopped.phase,'half-time-awaiting-native-restart');
   assert.equal(stopped.clock.label,'00:02');assert.equal(stopped.clock.abbreviatedResearchRun,true);
   assert.equal(stopped.pendingRestart,null);assert.equal(stopped.timeline.outstandingDeadBall,false);
   assert.equal(stopped.clock.halfTimeRestartVerified,false);
   assert.equal(stopped.realFull90MinutesVerified,false);
   assert.throws(()=>session.step(),/paused pending authenticated restart/);
   assert.throws(()=>session.placeRestart(),/verified ready boundary ticket/);
   assert.equal(session.snapshot(),stopped);
   const placed=session.placeSecondHalf();
   assert.equal(placed.playedTicks,120);assert.equal(placed.tick,120);
   assert.equal(placed.physicalRestart.periodRestart,'second-half');
   assert.equal(placed.attackPolarity,-1);assert.equal(placed.referee.attackPolarity,-1);assert.equal(placed.timeline.attackPolarity,-1);
   assert.equal(placed.physicalRestart.sameOriginalRapierWorld,true);
   assert.deepEqual(placed.players,stopped.players);
   assert.throws(()=>session.placeSecondHalf(),/exact half-time/);
   let taken=null;
   const phases=new Set();
   let priorPlayers=placed.players;
   for(let n=1;n<=3600;n++){
    const f=session.advanceRestart();
    assert.equal(f.playedTicks,120);assert.equal(f.tick,120+n);
    phases.add(f.nativeHalfFormationPhase);
    for(let i=0;i<f.players.length;i++){
     const p=f.players[i],q=priorPlayers[i];
     assert.equal(p.id,q.id);assert.equal(p.team,q.team);
     assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<=7/60+1e-6,'bounded physical period movement');
     for(let k=0;k<i;k++)assert.ok(Math.hypot(p.x-f.players[k].x,p.y-f.players[k].y)>=0.98-1e-6,'native minimum player separation');
    }
    priorPlayers=f.players;
    if(f.restartTake?.tick===f.tick){taken=f;break;}
    assert.equal(f.phase,'dead-ball-placed-awaiting-native-take');
    assert.equal(Math.hypot(...Object.values(f.ball.velocity)),0);
   }
   if(!taken)process.stdout.write('ME_628_UME06_HALF_STALLED '+JSON.stringify({side,phases:[...phases],formationPhase:session.snapshot().nativeHalfFormationPhase,players:session.snapshot().players,ball:session.snapshot().ball,decisions:session.snapshot().decisions})+'\n');
   assert.ok(taken,'actual second-half kickoff required');
   assert.ok(phases.has('enter-lanes')&&phases.has('cross-field')&&phases.has('ready'));
   assert.equal(taken.phase,'second-half');assert.equal(taken.restartTake.actorId,'away-10');
   assert.equal(taken.directionSwitchVerified,true);assert.equal(taken.restartTake.formationReady,true);
   assert.ok(taken.restartTake.impulseNs.x>0);
   assert.ok(taken.players.every(p=>p.id==='away-10'||(p.team==='home'?p.x>=1:p.x<=-1)));
   assert.ok(taken.players.filter(p=>p.role==='goalkeeper').every(p=>Math.abs(p.x)>=36));
   assert.deepEqual(taken.starts,['away-10']);assert.equal(taken.clock.halfTimeRestartVerified,true);
   assert.equal(taken.timeline.nativeHalfTake.tick,taken.tick);
   for(let k=121;k<=240;k++)assert.equal(session.step().playedTicks,k);
   const end=session.snapshot();
   assert.equal(end.phase,'full-time');assert.equal(end.clock.label,'00:04');
   assert.equal(end.boundedTwoPeriodsVerified,true);assert.equal(end.timeline.fullTimeVerified,true);
   assert.equal(end.directionSwitchVerified,true);assert.equal(end.realFull90MinutesVerified,false);
   assert.equal(end.officialMatchResult,null);
   assert.throws(()=>session.step(),/full-time/);
   assert.throws(()=>session.advanceRestart(),/Native restart requires/);
   assert.equal(session.snapshot(),end);
   process.stdout.write('ME_628_UME06_TWO_PERIODS '+JSON.stringify({side,playedTicks:end.playedTicks,physicsTicks:end.tick,
    pausedTicks:end.tick-end.playedTicks,halfTakeTick:taken.tick,score:end.provisionalScore})+'\n');
  }finally{session.dispose();}
  assert.throws(()=>session.snapshot(),/disposed/);
 }
});
test('UME-06A same guarded native replay matrix for 1v1 through 3v3 plus goalkeeper',{timeout:180000},async()=>{
 const R=await initializeRapier(rapier),results=[];
 for(const [id,n] of [['dribble-1v1',2],['keeper-1v1',2],['defender-1v1',3],['overload-2v1',4],['duel-2v2',5],['duel-3v3',7]]){
  assert.equal(supportsNativeOpenPlay(id),true);
  for(const side of ['home','away'])for(const variantIndex of [0,9]){
   const options={shotSide:side,variantIndex,bodyGuardEnabled:true,collectiveApproaches:true};
   const lab=createControlledActionLab(R,id,options),replay=createControlledActionLab(R,id,options);
   try{
    const active=lab.focus,audit=nativeReplayAudit(active);
    assert.equal(active.length,n);
    assert.equal(lab.snapshot().collectiveControl.tick,0);
    const keeperIds=active.filter(id=>INITIAL_PLAYERS.find(p=>p.id===id).role==='goalkeeper');
    assert.deepEqual(lab.snapshot().nativeKeeperStates.map(x=>x.keeperId),keeperIds);
    let ticks=0,boundary=null;
    for(let k=1;k<=360;k++){
     const f=lab.step(),g=replay.step();ticks=k;
     assert.equal(f.physicsTick,k);assert.equal(f.genuinePhysicalPlayerCount,n);
     for(const key of ['ball','observedMovementPlayers','starts','action','collectiveControl','nativeKeeperStates','latestOrientedReception','refereeEvidence'])assert.deepEqual(f[key],g[key],id+' '+side+' '+key+' tick '+k);
     assert.deepEqual(f.smallSidedNativeBodyGuard.selectedColliderIds,active);
     assert.equal(f.smallSidedNativeBodyGuard.oneOriginalRapierWorld,true);
     assert.deepEqual(f.nativeKeeperStates.map(x=>x.keeperId),keeperIds);
     assert.equal(projectActiveLabDecisions(f,active).length,n);
     assert.equal(f.officialMatchResult,null);assert.equal(f.officialMatchPossession,false);
     audit.observe({tick:k,ball:f.ball,players:f.observedMovementPlayers,starts:f.starts,action:f.action,control:f.collectiveControl,keepers:f.nativeKeeperStates,reception:f.latestOrientedReception});
     if(f.refereeEvidence?.lastEvent){boundary=f.refereeEvidence.lastEvent.kind;break;}
    }
    const report=audit.report();assert.ok(report.contacts>0,'native contact must occur in each selected replay');
    results.push({id,side,variant:variantIndex+1,players:n,ticks,boundary,deterministic:true,...report});
   }finally{lab.dispose();replay.dispose();}
  }
 }
 assert.equal(results.length,24);
 process.stdout.write('ME_628_UME06_MATRIX '+JSON.stringify(results)+'\n');
 for(const id of ['carry-solo','pass-pair','cross-pair','shot-solo']){
  assert.equal(supportsNativeOpenPlay(id),false);
  assert.throws(()=>createControlledActionLab(R,id,{bodyGuardEnabled:true,collectiveApproaches:true}),/Native open play/);
 }
 assert.throws(()=>createControlledActionLab(R,'dribble-1v1',{bodyGuardEnabled:true,collectiveApproaches:true,directedDribble:true}),/Native open play/);
 assert.throws(()=>createControlledActionLab(R,'keeper-1v1',{bodyGuardEnabled:true,collectiveApproaches:true,keeperSingleShot:true}),/Native open play/);
 assert.throws(()=>createControlledActionLab(R,'defender-1v1',{bodyGuardEnabled:true,collectiveApproaches:true,duelTackleProfile:'block'}),/Native open play/);
});
test('UME-05B free duel observes only the shared control and action policy',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const results=[];
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,collectiveApproaches:true});
  try{
   let contacts=0,controlled=0,actions=0,path=0,prior=lab.snapshot().ball.position,slideStrikes=0,shoulders=0;
   for(let k=1;k<=360;k++){
    const f=lab.step(),control=f.collectiveControl;
    assert.equal(control.tick,f.physicsTick);
    assert.equal(f.duelTransition,undefined);assert.equal(f.nativeDribbleAudit,undefined);
    assert.equal(f.genuinePhysicalPlayerCount,2);
    assert.equal(control.officialPossession,false);
    assert.equal(projectActiveLabDecisions(f,lab.focus).length,2);
    contacts+=f.starts.length;
    if(control.kind==='controlled'){controlled++;assert.ok(lab.focus.includes(control.playerId));}
    if(f.action){actions++;assert.ok(lab.focus.includes(f.action.playerId));assert.equal(f.action.appliedByRapier,true);assert.equal(f.action.actualPhysicsImpulseApplied,true);}
    slideStrikes+=Object.values(control.lastInterventions??{}).filter(x=>x.tick===k&&x.intervention==='sliding-tackle').length;
    shoulders+=Object.values(control.shoulderByPlayer??{}).filter(x=>x.tick===k&&x.successful).length;
    path+=Math.hypot(f.ball.position.x-prior.x,f.ball.position.y-prior.y);prior=f.ball.position;
    if(f.refereeEvidence?.lastEvent)break;
   }
   assert.ok(contacts>0,'free duel must reach a real contact');
   results.push({side,variant:variantIndex+1,contacts,controlled,actions,path,slideStrikes,shoulders});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_UME05B '+JSON.stringify(results)+'\n');
 assert.equal(results.length,60);
 for(const side of ['home','away']){
  const cases=results.filter(x=>x.side===side);
  assert.ok(cases.some(x=>x.controlled>0),'real carry control on each mirrored side');
  assert.ok(cases.some(x=>x.actions>0),'native impulses on each mirrored side');
 }
});
test('COL-06 all 60 guarded 2v1 variants preserve native actions and observed control',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const results=[];
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,'overload-2v1',{shotSide:side,variantIndex,bodyGuardEnabled:true,collectiveApproaches:true});
  try{
   const active=lab.focus,counts={carry:0,pass:0,shot:0,tackle:0,interception:0,save:0,other:0};
   let previous=lab.snapshot().collectiveControl,observedControl=0,starts=0,pathM=0,prior=lab.snapshot().ball.position;
   let slides=0,shoulders=0,blocks=0;
   for(let k=1;k<=360;k++){
    const f=lab.step(),control=f.collectiveControl;
    assert.equal(f.physicsTick,k);assert.equal(control.tick,k);
    assert.equal(f.genuinePhysicalPlayerCount,4);assert.equal(f.officialMatchPossession,false);assert.equal(f.officialMatchResult,null);
    assert.ok(f.starts.every(id=>active.includes(id)));starts+=f.starts.length;
    assert.equal(projectActiveLabDecisions(f,active).length,4);
    assert.equal(control.officialPossession,false);
    if(f.action){
     assert.ok(active.includes(f.action.playerId));assert.equal(f.action.appliedByRapier,true);assert.equal(f.action.actualPhysicsImpulseApplied,true);
     assert.equal(f.action.officialMatchAction,false);
     assert.deepEqual(f.starts,[f.action.playerId]);
     const kind=Object.hasOwn(counts,f.action.action)?f.action.action:'other';counts[kind]++;
    }
    assert.deepEqual(f.collectiveCounts,counts);
    if(control.kind==='controlled'){
     observedControl++;assert.ok(active.includes(control.playerId));
     if(previous.sourceTick!==control.sourceTick||previous.playerId!==control.playerId){
      assert.equal(f.action?.action,'carry');assert.equal(f.action.playerId,control.playerId);assert.equal(control.sourceTick,k);
     }
    }else assert.equal(control.playerId,null);
    slides+=Object.values(control.lastInterventions??{}).filter(x=>x.tick===k&&x.intervention==='sliding-tackle').length;
    shoulders+=Object.values(control.shoulderByPlayer??{}).filter(x=>x.tick===k&&x.successful).length;
    assert.ok(control.blockCount>=blocks);blocks=control.blockCount;
    previous=control;
    pathM+=Math.hypot(f.ball.position.x-prior.x,f.ball.position.y-prior.y);prior=f.ball.position;
    if(f.refereeEvidence?.lastEvent)break;
   }
   assert.ok(starts>0,'variant must reach a real shoe contact');
   results.push({side,variant:variantIndex+1,counts,observedControl,starts,pathM,slides,shoulders,blocks});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_COL06 '+JSON.stringify(results)+'\n');
 assert.equal(results.length,60);
 for(const side of ['home','away']){
  const cases=results.filter(x=>x.side===side);
  assert.ok(cases.some(x=>x.observedControl>0),'observed control must occur on each mirrored side');
  assert.ok(cases.some(x=>x.counts.pass>0),'native pass must occur on each mirrored side');
  assert.ok(cases.some(x=>x.counts.shot>0),'native shot must occur on each mirrored side');
  assert.ok(cases.some(x=>x.counts.carry>0),'native carry must occur on each mirrored side');
 }
});
test('#628 small-sided catalog replaces only visible elementary exercise UI; archives remain for regression',()=>{
 const ids=SMALL_SIDED_LAB_SCENARIOS.map(s=>s.id);
 assert.deepEqual(ids,['dribble-1v1','keeper-1v1','defender-1v1','overload-2v1',
  'duel-2v2','duel-3v3','carry-solo','pass-pair','cross-pair','shot-solo']);
 assert.deepEqual(SMALL_SIDED_LAB_SCENARIOS.map(s=>s.focus.length),
  [2,2,3,4,5,7,1,2,2,1]);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 for(const id of ids)
  assert.match(html,new RegExp('<option value="'+id+'">'),
   'original research scene stays in hidden regression catalog');
 for(const id of ['keeper-1v1','overload-2v1','duel-3v3'])
  assert.match(ui,new RegExp("'action:"+id+"'"));
 assert.match(ui,/renderedValues\.length!==expectedValues\.length/);
 assert.match(ui,/renderedValues\.some\(\(value,index\)=>value!==expectedValues\[index\]\)/);
 assert.match(ui,/new Set\(expectedValues\)\.size!==expectedValues\.length/);
 assert.doesNotMatch(ui,/visibleMovement/);
 assert.match(ui,/Carry phases/);
 assert.match(ui,/Small-sided situations/);
 for(const phase of SOLO_CARRY_PHASES)
  assert.match(ui,new RegExp("'action:carry-solo:"+phase+"'"));
 assert.doesNotMatch(ui,/\['action:carry-solo','Carry/);
 assert.match(html,/On-field decisions/);
 assert.match(html,/Original|Rapier/i);
 assert.match(html,/<option value="pass">/,'old scenes preserved as internal automated regression');
 for(const side of ['home','away'])for(const s of SMALL_SIDED_LAB_SCENARIOS){
  const scene=smallSidedSetup(s.id,side,INITIAL_PLAYERS);
  assert.ok(Object.isFrozen(scene)&&Object.isFrozen(scene.ball)&&
   Object.isFrozen(scene.staged));
  assert.equal(scene.genuinePhysicalPlayers,s.focus.length);
  assert.equal(scene.activeIds.length,s.focus.length);
  assert.equal(scene.ball.x,(side==='home'?1:-1)*(s.id==='pass-pair'?-12:30));
  assert.equal(scene.ball.vx,0);
  assert.equal(scene.ball.vy,0);
  assert.equal(scene.ball.vz,0);
  assert.equal(scene.staged.length,22);
  assert.equal(scene.staged.find(p=>p.id===side+'-10').role,'forward');
  assert.equal(scene.activeIds.includes((side==='home'?'away':'home')+'-1'),
    !['dribble-1v1','carry-solo','pass-pair','cross-pair','shot-solo'].includes(s.id));
  for(let i=0;i<scene.staged.length;i++)for(let j=i+1;j<scene.staged.length;j++)
   assert.ok(Math.hypot(scene.staged[i].x-scene.staged[j].x,
     scene.staged[i].y-scene.staged[j].y)>=0.98-1e-8);
 }
 assert.throws(()=>smallSidedSetup('not-a-scene','home',INITIAL_PLAYERS),RangeError);
 assert.throws(()=>smallSidedSetup('keeper-1v1','bad',INITIAL_PLAYERS),TypeError);
 assert.throws(()=>createPlayerMovement({
  researchSmallSidedSituation:'duel-2v2'
 }),TypeError);
 assert.throws(()=>createPlayerMovement({
  researchSmallSidedSituation:'duel-2v2',researchSmallSidedSide:'home',
  researchBodyEncounter:true
 }),TypeError);
});

test('#628 five genuine small-sided scenes HOME/AWAY have only physical participants, deterministic native ball and source-only actions',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const s of SMALL_SIDED_LAB_SCENARIOS)for(const side of ['home','away']){
  const a=createControlledActionLab(R,s.id,{shotSide:side});
  const b=createControlledActionLab(R,s.id,{shotSide:side});
  try{
   const zero=a.snapshot(),expected=smallSidedSetup(s.id,side,INITIAL_PLAYERS);
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.players.length,22);
   assert.equal(zero.genuinePhysicalPlayerCount,expected.activeIds.length);
   assert.equal(zero.activeCollisionSource,'native-colliders-only');
   assert.equal(zero.no11v11Authority,true);
   assert.deepEqual(zero.smallSidedParticipants,expected.activeIds);
   assert.deepEqual(a.focus,expected.activeIds);
   assert.equal(zero.ball.velocity.x,0);
   assert.equal(zero.officialMatchResult,null);
   assert.equal(zero.officialMatchPossession,false);
   assert.equal(zero.eventCount,0);
   let starts=0,actions=0,refereeEvent=null;
   for(let tick=1;tick<=100;tick++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x.ball,y.ball,'same 60Hz Rapier seed and active shoe colliders');
    assert.deepEqual(x.starts,y.starts);
    assert.deepEqual(x.action,y.action);
    assert.equal(x.physicsTick,tick);
    assert.equal(x.no11v11Authority,true);
    assert.equal(x.genuinePhysicalPlayerCount,expected.activeIds.length);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialMatchPossession,false);
    assert.equal(x.scoreChanged,false);
    assert.equal(x.readOnlyEvidence,true);
    assert.ok(x.starts.every(id=>expected.activeIds.includes(id)),
      'inactive 22-member background cannot have physical shoe collision');
    for(const id of x.starts)starts++;
    if(x.action){
     actions++;
     assert.ok(expected.activeIds.includes(x.action.playerId));
     assert.equal(x.action.appliedByRapier,true);
     assert.equal(x.action.actualPhysicsImpulseApplied,true);
     assert.equal(x.action.officialMatchAction,false);
     assert.deepEqual(x.starts,[x.action.playerId]);
    }
    if(x.refereeEvidence.lastEvent?.tick===tick){
     refereeEvent=x.refereeEvidence.lastEvent;
     assert.equal(refereeEvent.originalRapierSource,true);
     assert.equal(refereeEvent.officialResult,false);
     assert.equal(x.matchTimeline.matchEvents.at(-1)?.originalRapierCrossing,true);
     break; // no fake restart after the real first boundary
    }
   }
   assert.ok(starts>=1,'one actual selected shoe must contact real ball '+s.id+' '+side);
   assert.ok(actions>=1,'original active actor must produce a physical attempt '+s.id+' '+side);
   process.stdout.write('ME_628_SMALL_SIDED_NATIVE '+
    JSON.stringify({scenario:s.id,side,activeShoes:expected.activeIds,
     nativeStarts:starts,originalActions:actions,
     firstBoundary:refereeEvent?.kind??null,officialResult:null})+'\\n');
  }finally{a.dispose();b.dispose();}
 }
});

test('#628 small-sided source must remain private and fail closed without real Rapier and canonical paired options',async()=>{
 const R=await initializeRapier(rapier);
 const ball={preset:'roll',seed:'small-negative',x:30,y:0,z:0,vx:0,vy:0,vz:0};
 assert.throws(()=>createEngine(R,ball,{
  diagnosticSmallSidedSituation:'keeper-1v1',
  diagnosticSmallSidedSide:'home'
 }),/Small-sided exercise exclusively/);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticSmallSidedSituation:'keeper-1v1',
  diagnosticSmallSidedSide:'home',
  diagnosticB06bHalftimeTick:1200
 }),/Small-sided exercise exclusively/);
 assert.throws(()=>createEngine(R,ball,{
  diagnosticPlayerFootContactsEnabled:true,
  diagnosticAutonomousFixtureActionEnabled:true,
  diagnosticSmallSidedSituation:'keeper-1v1'
 }),/must be paired/);
 const plain=createEngine(R,ball);
 try{
  assert.equal(plain.originalSmallSidedPhysicalShoeIds,undefined);
 }finally{plain.dispose();}
});

test('#628 selected situations reuse main field/elevation and original transport without opening the modal',()=>{
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 const css=readFileSync(new URL('../lab/lab.css',import.meta.url),'utf8');
 const browser=readFileSync(new URL('./action-labs-browser.test.mjs',import.meta.url),'utf8');
 assert.match(html,/id="pitch"/);
 assert.match(html,/id="elevation"/);
 assert.match(html,/id="me-inline-side-control"/);
 assert.match(html,/id="me-inline-rating-control"/);
 assert.match(html,/data-me-dropdown="inline-rating"/);
 assert.match(js,/soloCarryPlayerAttributes/);
 assert.match(html,/id="me-inline-observation"/);
 assert.match(html,/id="play"/);
 assert.match(html,/id="pause"/);
 assert.match(html,/id="step"/);
 assert.match(html,/id="reset"/);
 assert.ok(js.includes('createControlledActionLab(rapier,id,{shotSide:side,')&&
  js.includes("bodyGuardEnabled:id!=='carry-solo'")&&
  js.includes("nativeFixedCarryResearch:id==='carry-solo'")&&
  js.includes("carryRunwayStart:id==='carry-solo'"),
  'Visible LAB must isolate native shoe-authenticated Solo Carry and preserve native bodies in opposed scenes');
 assert.doesNotMatch(js,/me-inline-bodyguard|activeBodyGuardEnabled/);
 assert.doesNotMatch(html,/id="me-inline-bodyguard"/);
 assert.match(js,/createControlledMovementLab\(rapier,id,\{side\}\)/);
 assert.match(js,/activeScene=\{kind,id,soloCarryLockedPhase,shotProfile,firstTimeShot,duelTackleProfile\}/);
 assert.match(js,/if\s*\(activeLab\)drawInlinePlayers/);
 assert.match(js,/if\s*\(\(engine\|\|activeLab\) && playing\)/);
 assert.match(js,/byId\('me-inline-side'\)\.addEventListener\('change'/);
 assert.doesNotMatch(js,/byId\(prefix\+'-open'\)\.click\(\)/,
  'A visible scenario MUST NOT launch any hidden modal runner');
 assert.match(css,/me-inline-side-control\[hidden\]/);
 assert.match(browser,/ME_628_INLINE_CHROME/);
 assert.match(browser,/ME_628_INLINE_MAIN_TRANSPORT/);
 assert.match(browser,/assert\.deepEqual\(actionNav,\{open:false/);
 assert.match(browser,/assert\.deepEqual\(visibleMovement,\[\],/);
});


test('#628 goalkeeper 1v1 real 60Hz running approach and mirrored seed intent',()=>{
 for(const side of ['home','away'])for(const index of [0,1,2,3,8,15,29]){
  const scene=smallSidedSetup('keeper-1v1',side,INITIAL_PLAYERS,{variantIndex:index});
  const actor=scene.staged.find(p=>p.id===side+'-10');
  const dir=side==='home'?1:-1;
  const runUp=keeperDuelAttackerTarget(side,index,actor,scene.ball);
  assert.ok(dir*(runUp.x-scene.ball.x)>1,'run-up target passes real ball');
  const base=goalkeeperPosition(side==='home'?'away':'home',scene.ball);
  const keeper=keeperDuelGoalkeeperTarget(side,index,actor,scene.ball,base);
  assert.ok(dir*(base.x-keeper.x)>=0,'keeper advances toward ball only');
  const other=side==='home'?'away':'home';
  const mirror=smallSidedSetup('keeper-1v1',other,INITIAL_PLAYERS,{variantIndex:index});
  const mirrored=keeperDuelAttackerTarget(other,index,
   mirror.staged.find(p=>p.id===other+'-10'),mirror.ball);
  assert.equal(runUp.x,-mirrored.x);assert.equal(runUp.y,mirrored.y);
  const mover=createPlayerMovement({researchSmallSidedSituation:'keeper-1v1',
   researchSmallSidedSide:side,...(index?{researchSmallSidedVariantIndex:index}:{})});
  let peak=0;
  for(let tick=0;tick<24;tick++){
   const frame=mover.step({x:scene.ball.x,y:scene.ball.y});
   const moving=frame.players.find(p=>p.id===side+'-10');
   peak=Math.max(peak,Math.hypot(moving.vx,moving.vy));
  }
  assert.ok(peak>2&&peak<=7+1e-8,'running pace through actual 60Hz movement');
 }
 assert.throws(()=>keeperDuelAttackerTarget('home',30,{},{}),TypeError);
});

test('#628 goalkeeper 1v1 V01 replay fixed, other styles differ and D-01 start unchanged',()=>{
 const positions=new Set();
 for(let index=0;index<30;index++){
  const s=smallSidedSetup('keeper-1v1','home',INITIAL_PLAYERS,{variantIndex:index});
  const actor=s.staged.find(p=>p.id==='home-10');
  const base=goalkeeperPosition('away',s.ball);
  const keeper=keeperDuelGoalkeeperTarget('home',index,actor,s.ball,base);
  if(index===0)assert.deepEqual([keeper.x,keeper.y],[base.x,base.y]);
  else positions.add((keeper.x-s.ball.x).toFixed(3)+'|'+keeper.y.toFixed(3));
  assert.ok(Math.hypot(actor.x-s.ball.x,actor.y-s.ball.y)<0.85);
 }
 assert.ok(positions.size>=20,'V02–V30 differ in actual goalie targets');
 assert.equal(smallSidedSetup('dribble-1v1','home',INITIAL_PLAYERS)
  .staged.find(p=>p.id==='home-10').x,29.45);
});

test('#628 LAB-VAR-01 thirty deterministic geometries per scene are physically separated, mirrored and seed-identical',()=>{
 assert.equal(SMALL_SIDED_VARIANT_COUNT,30);
 for(const scenario of SMALL_SIDED_LAB_SCENARIOS){
  const seen=new Set();
  for(let variantIndex=0;variantIndex<SMALL_SIDED_VARIANT_COUNT;variantIndex++){
   const options={variantIndex};
   const home=smallSidedSetup(scenario.id,'home',INITIAL_PLAYERS,options);
   const again=smallSidedSetup(scenario.id,'home',INITIAL_PLAYERS,options);
   const away=smallSidedSetup(scenario.id,'away',INITIAL_PLAYERS,options);
   assert.deepEqual(home,again,'same seed must produce identical canonical setup');
   assert.equal(home.variantIndex,variantIndex);
   assert.equal(away.variantIndex,variantIndex);
   assert.equal(home.ball.x,-away.ball.x);
   assert.equal(home.ball.y,away.ball.y);
   assert.equal(home.ball.vx,0);assert.equal(home.ball.vy,0);
   assert.equal(home.activeIds.length,scenario.focus.length);
   assert.equal(away.activeIds.length,scenario.focus.length);
   const homeMain=home.staged.find(p=>p.id==='home-10');
   assert.ok(Math.hypot(homeMain.x-home.ball.x,homeMain.y-home.ball.y)<0.85,
    'authentic actor must start within original physical contact eligibility');
   for(const source of [home,away]){
    assert.ok(source.staged.every(p=>Math.abs(p.x)<52&&Math.abs(p.y)<34));
    for(let i=0;i<22;i++)for(let j=i+1;j<22;j++){
     const a=source.staged[i],b=source.staged[j];
     assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=0.98-1e-8,
      scenario.id+' V'+(variantIndex+1)+' '+source.side+
      ': canonical 0.98m separation for all 22 IDs');
    }
   }
   for(const [number,team] of [
    ...scenario.attackers.map(n=>[n,'home']),
    ...scenario.defenders.map(n=>[n,'away']),[1,'away']
   ]){
    const from=home.staged.find(p=>p.id===team+'-'+number);
    const mirror=away.staged.find(p=>p.id===
     (team==='home'?'away':'home')+'-'+number);
    assert.equal(from.x,-mirror.x);
    assert.equal(from.y,mirror.y);
   }
   seen.add(home.ball.x.toFixed(6)+'|'+home.ball.y.toFixed(6));
  }
  assert.ok(seen.size>=25,scenario.id+' must have actual distinct starts');
 }
 for(const invalid of [-1,30,1.2,'1',Infinity,NaN])
  assert.throws(()=>smallSidedSetup('keeper-1v1','home',INITIAL_PLAYERS,
   {variantIndex:invalid}),RangeError);
});

test('#628 LAB-VAR-01 variants preserve real Rapier native shoes and original-action provenance', 
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const s of SMALL_SIDED_LAB_SCENARIOS)
 for(const side of ['home','away'])
 for(const variantIndex of [1,9,21]){
  const a=createControlledActionLab(R,s.id,{shotSide:side,variantIndex});
  const b=createControlledActionLab(R,s.id,{shotSide:side,variantIndex});
  try{
   const setup=smallSidedSetup(s.id,side,INITIAL_PLAYERS,{variantIndex});
   const zero=a.snapshot();
   assert.equal(zero.smallSidedVariantIndex,variantIndex);
   assert.equal(zero.physicsTick,0);
   assert.ok(Math.abs(zero.ball.position.x-setup.ball.x)<1e-5,
    'Rapier float32 X must preserve the seeded physical ball start');
   assert.ok(Math.abs(zero.ball.position.y-setup.ball.y)<1e-5,
    'Rapier float32 Y must preserve the seeded physical ball start');
   assert.deepEqual(zero.smallSidedParticipants,setup.activeIds);
   let realStarts=0,realAttempts=0;
   for(let i=1;i<=60;i++){
    const x=a.step(),y=b.step();
    assert.deepEqual(x.ball,y.ball,'deterministic native Rapier seed');
    assert.deepEqual(x.starts,y.starts);
    assert.deepEqual(x.action,y.action);
    assert.equal(x.physicsTick,i);
    assert.equal(x.officialMatchResult,null);
    assert.equal(x.officialMatchPossession,false);
    assert.ok(x.starts.every(id=>setup.activeIds.includes(id)));
    realStarts+=x.starts.length;
    if(x.action){
     realAttempts++;
     assert.equal(x.action.appliedByRapier,true);
     assert.equal(x.action.actualPhysicsImpulseApplied,true);
     assert.equal(x.action.officialMatchAction,false);
    }
    if(x.refereeEvidence?.lastEvent)break;
   }
   assert.ok(realStarts>0,'variant must preserve a true physical shoe START');
   assert.ok(realAttempts>0,'variant must preserve an authentic action impulse');
  }finally{a.dispose();b.dispose();}
 }
});

test('#628 LAB-VAR-02 live small-sided choices vary across 29 seeds and still require real Rapier exclusive shoe impulses',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 for(const sId of ['keeper-1v1','overload-2v1']){
  const observed=new Set(),counts={shot:0,pass:0,carry:0,other:0};
  for(const side of ['home','away'])for(let variantIndex=1;variantIndex<30;variantIndex++){
   // Source matrix for HOME, plus mirrored AWAY sample (VAR-04 covers
   // the exhaustive two-side distribution and longer real-play sequences).
   if(side==='away'&&![1,9,21].includes(variantIndex))continue;
   const scene=createControlledActionLab(R,sId,{shotSide:side,variantIndex});
   try{
    const zero=scene.snapshot();
    assert.equal(zero.smallSidedVariantIndex,variantIndex);
    let first=null;
    for(let tick=1;tick<=90;tick++){
     const frame=scene.step();
     assert.ok(frame.starts.every(id=>frame.smallSidedParticipants.includes(id)),
      'Only existing small-sided native Rapier shoes can start a contact');
     if(frame.action?.team===side){
      first=frame.action;
      assert.deepEqual(frame.starts,[first.playerId]);
      assert.equal(first.appliedByRapier,true);
      assert.equal(first.actualPhysicsImpulseApplied,true);
      assert.equal(first.physicalTrigger,'same-tick-real-rapier-shoe-start');
      assert.equal(first.decisionContext.smallSidedChoice?.selected,
       first.action,'applied impulse must correspond to live eligible choice');
      assert.equal(first.officialMatchAction,false);
      assert.equal(first.officialMatchPossession,false);
      assert.equal(frame.officialMatchResult,null);
      break;
     }
     if(frame.refereeEvidence?.lastEvent)break;
    }
    assert.ok(first,sId+' '+side+' V'+(variantIndex+1)+
     ' must produce an actual attacking Rapier shoe impulse');
    observed.add(first.action);
    counts[first.action in counts?first.action:'other']++;
   }finally{scene.dispose();}
  }
  if(sId==='keeper-1v1'){
   assert.ok(observed.has('shot'),'1v1 must actually shoot through an open live lane');
   assert.ok(observed.has('carry'),'1v1 can also make a native short touch');
  }else{
   // The lone real defender often blocks ALL shot lanes; never force a
   // false shot merely to fill a category. Passing and short carry remain.
   assert.ok(observed.has('pass'),'2v1 live safe recipient must be selectable');
   assert.ok(observed.has('carry'),'2v1 must also select an authentic short touch');
  }
  process.stdout.write('ME_628_LIVE_CONTEXT_VARIATION '+JSON.stringify({
   situationId:sId,counts,distinct:[...observed].sort(),
   requiresNativeRapier:true,officialResult:null
  })+'\\n');
 }
});

test('#628 LAB-VAR-02 local preview must serve actual seed-choice module before Chrome Ready',()=>{
 const server=readFileSync(new URL('../../tools/dev-standings-preview.mjs',
  import.meta.url),'utf8');
 assert.ok(server.includes("'/__fa_match_engine__/small-sided-context-choice.mjs':"),
  'new LAB module must be in the local preview server allowlist');
 const nodePolicy=readFileSync(new URL('../src/player-ball-uniform-autonomous-action.mjs',
  import.meta.url),'utf8');
 assert.ok(nodePolicy.includes("from './small-sided-context-choice.mjs'"));
});

test('#628 every actual on-field small-sided player has exactly one current mover decision',
 {timeout:60000},async()=>{
 const R=await initializeRapier(rapier);
 for(const [scene,count] of [['carry-solo',1],['dribble-1v1',2],['keeper-1v1',2],
  ['overload-2v1',4],['duel-3v3',7]])
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,scene,{shotSide:side,
   variantIndex:0,bodyGuardEnabled:true});
  try{
   let frame=lab.snapshot();
   assert.deepEqual(projectActiveLabDecisions(frame,lab.focus),[],
    'no fake decisions before original step');
   for(let i=0;i<15;i++){
    frame=lab.step();
    const decisions=projectActiveLabDecisions(frame,lab.focus);
    assert.equal(decisions.length,count);
    assert.deepEqual(decisions.map(d=>d.id),lab.focus);
    for(const d of decisions){
     assert.equal(d.tick,frame.physicsTick);
     assert.equal(d.originalCanonicalMover,true);
     assert.equal(d.readOnly,true);
     assert.equal(d.officialResult,false);
     assert.ok(Number.isFinite(d.target.x)&&Number.isFinite(d.target.y));
     assert.ok(Number.isFinite(d.speedMps));
     const original=frame.observedMovementPlayers.find(p=>p.id===d.id);
     assert.ok(Math.abs(d.speedMps-Math.hypot(original.vx,original.vy))<1e-9);
     if(d.actualAction!==null){
      assert.equal(frame.action?.playerId,d.id);
      assert.equal(frame.action?.appliedByRapier,true);
      assert.equal(frame.action?.actualPhysicsImpulseApplied,true);
     }
    }
   }
   assert.throws(()=>projectActiveLabDecisions(frame,['home-10','home-10']),TypeError);
   assert.throws(()=>projectActiveLabDecisions({...frame,
    smallSidedMovementDecisions:[]},lab.focus),TypeError);
  }finally{lab.dispose();}
 }
});

// The three visible QA variants reuse the same original Rapier ball/mover
// and genuinely differ ONLY by a DEV-local fixed movement profile.
test('#628 three fixed solo Carry LABs retain source physics and never alter automatic phase policy',
 {timeout:90000},async()=>{
 const auto=advanceSoloCarryPhase({
  previousPhase:'control',tick:1,playerSpeedMps:2,
  ballSpeedMps:1.5,ballGapM:0.5
 });
 assert.equal(auto.phase,'moderate');
 assert.equal(Object.hasOwn(auto,'lockedPhase'),false);
 for(const lockedPhase of SOLO_CARRY_PHASES){
  const forced=advanceSoloCarryPhase({previousPhase:lockedPhase,tick:1,
   playerSpeedMps:0,ballSpeedMps:0,ballGapM:0,lockedPhase});
  assert.equal(forced.phase,lockedPhase);
  assert.equal(forced.changed,false);
  assert.equal(forced.lockedPhase,lockedPhase);
  assert.throws(()=>advanceSoloCarryPhase({previousPhase:'control',tick:1,
   playerSpeedMps:0,ballSpeedMps:0,ballGapM:0,
   lockedPhase:'not-a-phase'}),TypeError);
 }
 assert.throws(()=>createPlayerMovement({
  researchSmallSidedSituation:'carry-solo',researchSmallSidedSide:'home',
  researchSoloCarryLockedPhase:'nope'
 }),TypeError);
 assert.throws(()=>createPlayerMovement({
  researchSmallSidedSituation:'keeper-1v1',researchSmallSidedSide:'home',
  researchSoloCarryLockedPhase:'control'
 }),TypeError);
 const R=await initializeRapier(rapier);
 assert.throws(()=>createControlledActionLab(R,'keeper-1v1',{
  intentDrivenSoloCarry:false,soloCarryLockedPhase:'moderate'
 }),TypeError);
 assert.throws(()=>createControlledActionLab(R,'carry-solo',{
  soloCarryLockedPhase:'sprint'
 }),TypeError);
 for(const lockedPhase of SOLO_CARRY_PHASES)for(const shotSide of ['home','away']){
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide,variantIndex:3,intentDrivenSoloCarry:true,
   soloCarryLockedPhase:lockedPhase
  });
  try{
   let impulses=0,first=null,latest=null;
   const startBallX=lab.snapshot().ball.position.x;
   let firstImpulseTick=null,peakBallSpeedMps=0,maxPlayerSpeedMps=0;
   assert.equal(lab.snapshot().soloCarryPhase,null);
   for(let tick=1;tick<=120;tick++){
    const f=lab.step();
    if(tick===1)first=f;
    latest=f;
    peakBallSpeedMps=Math.max(peakBallSpeedMps,
     Math.hypot(f.ball.velocity.x,f.ball.velocity.y));
    const runner=f.observedMovementPlayers.find(p=>p.id===shotSide+'-10');
    maxPlayerSpeedMps=Math.max(maxPlayerSpeedMps,
     Math.hypot(runner.vx,runner.vy));
    assert.equal(f.physicsTick,tick);
    assert.equal(f.soloCarryPhase.phase,lockedPhase);
    assert.equal(f.soloCarryPhase.lockedPhase,lockedPhase);
    assert.equal(f.soloCarryPhase.changed,false);
    assert.equal(f.soloCarryPhase.previousPhase,lockedPhase);
    assert.equal(f.soloCarryLockedPhase,lockedPhase);
    assert.equal(f.genuinePhysicalPlayerCount,1);
    assert.equal(f.intentDrivenCarry,true);
    assert.equal(f.nativeShoeContactClaimed,false);
    assert.equal(f.eventCount,0);
    assert.equal(f.officialMatchPossession,false);
    assert.ok(Number.isFinite(f.soloCarryPhase.playerSpeedMps));
    assert.ok(Number.isFinite(f.soloCarryPhase.ballSpeedMps));
    assert.ok(Number.isFinite(f.soloCarryPhase.ballGapM));
    assert.deepEqual(f.smallSidedParticipants,[shotSide+'-10']);
    if(f.action?.action==='carry'){
     assert.equal(f.action.appliedByRapier,true);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     impulses++;
     firstImpulseTick??=tick;
    }
    assert.equal(f.intentCarryImpulseCount,impulses);
   }
   assert.equal(first.soloCarryPhase.phase,lockedPhase);
   assert.equal(latest.soloCarryPhase.phase,lockedPhase);
   // Rapier ball travels from its own original initial state, not an
   // assigned target or an invented dribble/reception result.
   assert.equal(latest.eventCount,0);
   const forwardDistanceM=(shotSide==='home'?1:-1)*
    (latest.ball.position.x-startBallX);
   process.stdout.write('ME_628_LOCKED_SOLO_CARRY '+
    JSON.stringify({lockedPhase,shotSide,ticks:120,impulses,
     firstImpulseTick,forwardDistanceM,peakBallSpeedMps,maxPlayerSpeedMps,
     ballX:latest.ball.position.x})+'\\n');
   if(lockedPhase!=='control'){
    assert.ok(firstImpulseTick!==null&&firstImpulseTick<=6,
     'Moderate and Sprint kick the stationary ball immediately');
    assert.ok(forwardDistanceM>2.5,
     'Moderate and Sprint move the real Rapier ball forward in two seconds');
    assert.ok(maxPlayerSpeedMps>2.5,
     'Fixed-phase runner must accelerate rather than stall over the ball');
    assert.ok(peakBallSpeedMps<=(lockedPhase==='sprint'?8.7:6.2),
     'Real Rapier ball speed remains bounded by phase-specific design envelope');
   }
  }finally{lab.dispose();}
 }
});

// Solo means one original player has native colliders, not a hidden defender.
test('#628 solo Carry has one Rapier actor and repeated genuine shoe actions, HOME/AWAY',
 {timeout:100000},async()=>{
 const R=await initializeRapier(rapier);
 for(const side of ['home','away'])for(const variantIndex of [0,3]){
  const setup=smallSidedSetup('carry-solo',side,INITIAL_PLAYERS,{variantIndex});
  assert.deepEqual(setup.activeIds,[side+'-10']);
  const lab=createControlledActionLab(R,'carry-solo',{
   shotSide:side,variantIndex,bodyGuardEnabled:true
  });
  try{
   let carries=0,releaseRecontacts=0,playerSpeedSum=0,maximumBallSpeed=0,
    minimumObservedSpeed=Infinity;
   const observedPhases=new Set(),phaseTransitions=[];
   let maxObservedActorSpeedMps=0,maxObservedGapM=0,maxObservedBallSpeedMps=0;
   let paceEligibleTicks=0,spaceEligibleTicks=0;
   for(let tick=1;tick<=180;tick++){
    const f=lab.step();
    assert.deepEqual(f.smallSidedParticipants,[side+'-10']);
    const actor=f.observedMovementPlayers.find(p=>p.id===side+'-10');
    const speed=Math.hypot(actor.vx,actor.vy);
    assert.equal(f.soloCarryPhase.tick,f.physicsTick);
    assert.equal(f.soloCarryPhase.originalCanonicalPlayer,true);
    assert.equal(f.soloCarryPhase.originalRapierBall,true);
    maxObservedActorSpeedMps=Math.max(maxObservedActorSpeedMps,f.soloCarryPhase.playerSpeedMps);
    maxObservedGapM=Math.max(maxObservedGapM,f.soloCarryPhase.ballGapM);
    maxObservedBallSpeedMps=Math.max(maxObservedBallSpeedMps,f.soloCarryPhase.ballSpeedMps);
    if(f.soloCarryPhase.playerSpeedMps>=2.85)paceEligibleTicks++;
    if(f.soloCarryPhase.ballGapM>=0.46)spaceEligibleTicks++;
    observedPhases.add(f.soloCarryPhase.phase);
    if(f.soloCarryPhase.changed)
     phaseTransitions.push({tick:f.physicsTick,to:f.soloCarryPhase.phase});
    playerSpeedSum+=speed;minimumObservedSpeed=Math.min(minimumObservedSpeed,speed);
    maximumBallSpeed=Math.max(maximumBallSpeed,Math.hypot(f.ball.velocity.x,f.ball.velocity.y));
    assert.equal(f.genuinePhysicalPlayerCount,1);
    assert.deepEqual(f.smallSidedNativeBodyGuard.selectedColliderIds,[side+'-10']);
    assert.deepEqual(f.smallSidedNativeBodyGuard.nativeOpposingTorsoPairs,[]);
    assert.ok(f.starts.every(id=>id===side+'-10'));
    assert.equal(f.nativeDribbleAudit.soloCarry,true);
    assert.equal(f.nativeDribbleAudit.defenderShoeStarts,0);
    assert.equal(f.nativeDribbleAudit.minimumRealDefenderBallGapM,null);
    assert.equal(f.nativeDribbleAudit.measuredPressureTicks,null);
    assert.equal(f.nativeDribbleAudit.minimumCanonicalSeparationM,null,
     'No fake 22-player separation in a true one-body LAB');
    assert.equal(f.officialMatchPossession,false);
    const decisions=projectActiveLabDecisions(f,lab.focus);
    assert.equal(decisions.length,1);
    assert.equal(decisions[0].id,side+'-10');
    assert.equal(decisions[0].kind,'carry-ball');
    assert.equal(decisions[0].carryPhase,f.soloCarryPhase.phase);
    assert.equal(decisions[0].blockedBy,null,
     'No ghost keeper or defender from inactive 22-player identities');
    if(f.action){
     carries++;
     assert.equal(f.action.playerId,side+'-10');
     assert.equal(f.action.action,'carry');
     assert.equal(f.action.appliedByRapier,true);
     assert.equal(f.action.actualPhysicsImpulseApplied,true);
     assert.equal(f.action.decisionContext.isolatedDribbleTouch.soloCarry,true);
     assert.equal(f.action.decisionContext.isolatedDribbleTouch.fromLiveOpponent,false);
    }
    releaseRecontacts=f.nativeDribbleAudit.independentRecontacts;
    if(f.refereeEvidence?.lastEvent)break;
   }
   assert.ok(carries>=2,'One actor must truly carry using repeated Rapier impulses');
   assert.ok(releaseRecontacts>=1,'One actor must release and recontact the ball');
   assert.ok(observedPhases.has('control')&&observedPhases.has('moderate')&&
    observedPhases.has('sprint'),
    'Every genuine 3s solo carry trial should reach Control, Moderate, Sprint');
   assert.ok(phaseTransitions.length>=2&&phaseTransitions.length<=12,
    'Physical phases must switch with bounded, hysteretic motion');
   process.stdout.write('ME_628_SOLO_CARRY_SPEED_GUARD '+JSON.stringify({
    side,variantIndex,maxBallSpeedMps:maximumBallSpeed,
    meanPlayerSpeedMps:playerSpeedSum/180,carries,releaseRecontacts,
    peakSpeedWitness:lab.snapshot().nativeDribbleAudit.peakBallSpeedWitness
   })+'\\n');
   assert.ok(maximumBallSpeed<=3.5+1e-6,
    'Solo original Rapier ball must stay below established D-01 3.5m/s design guard');
   assert.ok(playerSpeedSum/180>=2.35,
    'Solo movement should no longer appear stalled at walking pace');
   process.stdout.write('ME_628_SOLO_CARRY_REAL '+JSON.stringify({
    side,variantIndex,activePhysicalPlayers:1,carries,releaseRecontacts,
    averagePlayerSpeedMps:playerSpeedSum/180,minimumObservedSpeed,
    maxBallSpeedMps:maximumBallSpeed,
    phases:[...observedPhases],phaseTransitions,
    maxObservedActorSpeedMps,maxObservedGapM,maxObservedBallSpeedMps,
    paceEligibleTicks,spaceEligibleTicks,
    realBallForwardM:lab.snapshot().nativeDribbleAudit.ballForwardDistanceM
   })+'\\n');
  }finally{lab.dispose();}
 }
});


test('#628 60 native solo Carry variants preserve real speed, contact and phase safety',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier);
 const samples=[];
 for(let variantIndex=0;variantIndex<30;variantIndex++)
 for(const side of ['home','away']){
  const lab=createControlledActionLab(R,'carry-solo',{shotSide:side,
   variantIndex,bodyGuardEnabled:true});
  try{
   let maxBallSpeedMps=0,carries=0,maxLiftM=0,blockedTicks=0;
   const phases=new Set();let transitions=0,latest=null;
   for(let tick=1;tick<=180;tick++){
    const f=lab.step();latest=f;
    const actor=f.observedMovementPlayers.find(p=>p.id===side+'-10');
    if(actor.blockedBy!==null)blockedTicks++;
    const speed=Math.hypot(f.ball.velocity.x,f.ball.velocity.y);
    maxBallSpeedMps=Math.max(maxBallSpeedMps,speed);
    maxLiftM=Math.max(maxLiftM,f.nativeDribbleAudit.peakGroundClearanceM);
    phases.add(f.soloCarryPhase.phase);
    if(f.soloCarryPhase.changed)transitions++;
    assert.deepEqual(f.smallSidedParticipants,[side+'-10']);
    assert.deepEqual(f.smallSidedNativeBodyGuard.nativeOpposingTorsoPairs,[]);
    assert.ok(f.starts.every(x=>x===side+'-10'));
    if(f.action?.appliedByRapier===true&&f.action?.actualPhysicsImpulseApplied===true)
     carries++;
   }
   samples.push({side,variantIndex,carries,maxBallSpeedMps,maxLiftM,
    blockedTicks,transitions,phases:[...phases],
    recontacts:latest.nativeDribbleAudit.independentRecontacts,
    ballForwardM:latest.nativeDribbleAudit.ballForwardDistanceM,
    peakSpeedWitness:latest.nativeDribbleAudit.peakBallSpeedWitness,
    maxRealActorBallGapM:latest.nativeDribbleAudit.maximumRealAttackerBallGapM,
    bothFeetActiveTicks:latest.nativeDribbleAudit.nativeBothFeetActiveTicks,
    physicalStartsWithoutCarry:latest.nativeDribbleAudit.nativeShoeStartsWithoutCarryImpulse,
    nonActionWithForceEvents:latest.nativeDribbleAudit.nonActionStartsWithNativeForceEvents,
    nonActionWithSolverContacts:latest.nativeDribbleAudit.nonActionStartsWithSolverContacts,
    nonActionWithGeometricContacts:latest.nativeDribbleAudit.nonActionStartsWithGeometricContacts,
    peakUnconvertedWorldDelta:latest.nativeDribbleAudit.peakNonActionWorldStepBallDeltaMps,
    physicalFootStarts:latest.nativeDribbleAudit.nativeLeftFootStarts+
     latest.nativeDribbleAudit.nativeRightFootStarts,
    actionTicks:latest.nativeDribbleAudit.actionTicks,
    realActionFeet:latest.nativeDribbleAudit.realActionFeet});
  }finally{lab.dispose();}
 }
 const maxBallSpeedMps=Math.max(...samples.map(x=>x.maxBallSpeedMps));
 const maxGroundLiftM=Math.max(...samples.map(x=>x.maxLiftM));
 const sprintSamples=samples.filter(x=>x.phases.includes('sprint')).length;
 const maxTransitions=Math.max(...samples.map(x=>x.transitions));
 const blockedSamples=samples.filter(x=>x.blockedTicks>0).length;
 const meanCarries=samples.reduce((t,x)=>t+x.carries,0)/samples.length;
 const distinctTouchIntervals=new Set(samples.flatMap(x=>x.actionTicks.slice(1)
  .map((tick,j)=>tick-x.actionTicks[j])));
 const meanPhysicalFootStarts=samples.reduce((t,x)=>t+x.physicalFootStarts,0)/
  samples.length;
 const weakSamples=samples.filter(x=>x.carries<2||x.recontacts<1||
  x.ballForwardM<4).map(x=>({side:x.side,variantIndex:x.variantIndex,
   carries:x.carries,recontacts:x.recontacts,forward:x.ballForwardM}));
 process.stdout.write('ME_628_SOLO_CARRY_60_TRIAL_MATRIX '+
  JSON.stringify({trials:samples.length,maxBallSpeedMps,maxGroundLiftM,
   sprintSamples,maxTransitions,blockedSamples,weakSamples,
   minimumForwardM:Math.min(...samples.map(x=>x.ballForwardM)),
   meanCarries,meanPhysicalFootStarts,
   meanPhysicalStartsWithoutCarry:samples.reduce((t,x)=>t+
    x.physicalStartsWithoutCarry,0)/samples.length,
   meanUnconvertedWithForceEvents:samples.reduce((t,x)=>t+
    x.nonActionWithForceEvents,0)/samples.length,
   meanUnconvertedWithSolverContacts:samples.reduce((t,x)=>t+
    x.nonActionWithSolverContacts,0)/samples.length,
   meanUnconvertedWithGeometricContacts:samples.reduce((t,x)=>t+
    x.nonActionWithGeometricContacts,0)/samples.length,
   maxUnconvertedWorldStepBallDeltaMps:Math.max(...samples.map(x=>
    x.peakUnconvertedWorldDelta)),
   meanBothFeetActiveTicks:samples.reduce((t,x)=>t+x.bothFeetActiveTicks,0)/
    samples.length,
   maxRealActorBallGapM:Math.max(...samples.map(x=>x.maxRealActorBallGapM)),
   distinctTouchIntervals:distinctTouchIntervals.size,
   fastest:samples.toSorted((a,b)=>b.maxBallSpeedMps-a.maxBallSpeedMps).slice(0,5)})+'\\n');
 assert.equal(samples.length,60);
 assert.equal(blockedSamples,0,'Inactive canonical identities must never block solo Carry');
 assert.ok(sprintSamples>=45,'Sprint must emerge from genuine speed/gap cues in most variants');
 assert.ok(maxTransitions<=12,'Solo Carry phases must not flicker uncontrollably');
 assert.ok(maxBallSpeedMps<=3.5+1e-6,
  'All 60 real Rapier trials must respect 3.5m/s ground Carry ball guard');
 assert.ok(maxGroundLiftM<=0.015+1e-6,
  'All 60 real Rapier trials must keep ground ball lift below 1.5cm');
 assert.equal(weakSamples.length,0,'Every variant should physically carry with recontacts');
 assert.ok(meanCarries<5,'Native open-running contacts must be meaningfully less frequent than the prior ~6.05 actions/3s');
 assert.ok(distinctTouchIntervals.size>=3,
  'Real ball distance/relative speed must vary inter-touch timing, not act like a metronome');
 assert.ok(samples.every(x=>x.physicalFootStarts>=x.carries&&
  x.physicalFootStarts-x.carries===x.physicalStartsWithoutCarry),
  'Audit must reconcile all real physical STARTs and actual applied actions');
 assert.ok(samples.every(x=>x.nonActionWithForceEvents>=0&&
  x.nonActionWithForceEvents<=x.physicalStartsWithoutCarry&&
  x.nonActionWithSolverContacts>=0&&
  x.nonActionWithSolverContacts<=x.physicalStartsWithoutCarry&&
  x.nonActionWithGeometricContacts>=0&&
  x.nonActionWithGeometricContacts<=x.physicalStartsWithoutCarry&&
  Number.isFinite(x.peakUnconvertedWorldDelta)),
  'Read-only per-foot solver and world-step witnesses must reconcile for all 60 variants');
});

test('#628 paired real Rapier worlds: combined toe-length and recovery controls', 
 {timeout:240000,
  skip:process.env.FA_MATCH_ENGINE_DEEP_RESEARCH!=='1'},async()=>{
 const R=await initializeRapier(rapier);
 // The original and the known one-weak long-toe experiment are anchors.
 // Each combined trial modifies TWO genuine physical sources at once;
 // no nonphysical START suppression, post-step velocity cap or fake impulse.
 const arms=Object.freeze([
  {id:'baseline',length:1,recovery:1},
  {id:'long-toe-anchor',length:1.1,recovery:1},
  {id:'long-toe-short-recovery',length:1.1,recovery:0.85},
  {id:'long-toe-mild-short-recovery',length:1.1,recovery:0.925},
  {id:'long-toe-long-recovery',length:1.1,recovery:1.15},
  {id:'medium-toe-mild-short-recovery',length:1.075,recovery:0.925},
  {id:'medium-toe-short-recovery',length:1.075,recovery:0.85},
  {id:'small-toe-short-recovery',length:1.05,recovery:0.85},
  {id:'small-toe-default-recovery',length:1.05,recovery:1},
  {id:'small-toe-long-recovery',length:1.05,recovery:1.15}
 ]);
 const stats=Object.fromEntries(arms.map(v=>[v.id,{
  trials:0,starts:0,nonAction:0,actions:0,solverNonAction:0,
  forceNonAction:0,bothFeetTicks:0,peakSpeed:0,peakLift:0,
  minForward:Infinity,weakCases:[],speedCases:[],liftCases:[],
  maxGap:0,changedEndpoints:0,totalEndpointDelta:0,
  maxShoeStarts:0,realRecontacts:0
 }]));
 // Pair by actual initial state (ball + canonical 22-player frame), not by
 // imagined 'same subsequent ball path': separate original Rapier worlds
 // are allowed to diverge via real shoe->ball->player feedback.
 for(let variantIndex=0;variantIndex<30;variantIndex++)
 for(const side of ['home','away']){
  let baselineInitial=null,baselineEndpoint=null;
  for(const arm of arms){
   const lab=createControlledActionLab(R,'carry-solo',{
    shotSide:side,variantIndex,bodyGuardEnabled:true,
    historicalCarryPhysics:true,soloShoeLengthScale:arm.length,
    soloRecoveryStepScale:arm.recovery
   });
   try{
    const initial=lab.snapshot(),s=stats[arm.id];
    if(baselineInitial===null)baselineInitial=initial;
    else{
     assert.deepEqual(initial.ball,baselineInitial.ball,
      'One original ball start for all paired Rapier arms');
     assert.deepEqual(initial.observedMovementPlayers,
      baselineInitial.observedMovementPlayers,
      'One original canonical player start for all Rapier arms');
    }
    let actions=0,peakSpeed=0,peakLift=0,last=null;
    for(let tick=1;tick<=180;tick++){
     const f=lab.step();last=f;
     assert.equal(f.physicsTick,tick);
     const shoe=f.soloNativeFeet,dyn=shoe?.dynamics;
     assert.equal(shoe.independentColliders,2);
     assert.equal(dyn.tick,tick);
     assert.equal(shoe.geometrySource,'native-rapier-collider-width');
     assert.ok(Math.abs(shoe.physicalColliderHalfLengthM-
      0.105*arm.length)<1e-12);
     assert.ok(Math.abs(shoe.physicalColliderHalfWidthM-0.052)<1e-12);
     assert.equal(shoe.recoveryStepScale,arm.recovery);
     assert.equal(f.genuinePhysicalPlayerCount,1);
     assert.deepEqual(f.smallSidedParticipants,[side+'-10']);
     assert.deepEqual(f.smallSidedNativeBodyGuard.nativeOpposingTorsoPairs,[]);
     const speed=Math.hypot(f.ball.velocity.x,f.ball.velocity.y);
     peakSpeed=Math.max(peakSpeed,speed);
     peakLift=Math.max(peakLift,f.nativeDribbleAudit.peakGroundClearanceM);
     if(f.action?.action==='carry'){
      assert.equal(shoe.exclusivePhysicalStart,true);
      assert.equal(f.action.appliedByRapier,true);
      assert.equal(f.action.actualPhysicsImpulseApplied,true);
      actions++;
     }
    }
    const a=last.nativeDribbleAudit,non=a.nativeShoeStartsWithoutCarryImpulse;
    assert.equal(a.appliedCarryActions,actions);
    assert.equal(a.nativePhysicalShoeStarts,actions+non);
    assert.ok(a.nonActionStartsWithSolverContacts<=non);
    assert.ok(a.nonActionStartsWithNativeForceEvents<=non);
    s.trials++;
    s.starts+=a.nativePhysicalShoeStarts;
    s.nonAction+=non;
    s.actions+=actions;
    s.solverNonAction+=a.nonActionStartsWithSolverContacts;
    s.forceNonAction+=a.nonActionStartsWithNativeForceEvents;
    s.bothFeetTicks+=a.nativeBothFeetActiveTicks;
    s.peakSpeed=Math.max(s.peakSpeed,peakSpeed);
    s.peakLift=Math.max(s.peakLift,peakLift);
    s.minForward=Math.min(s.minForward,a.ballForwardDistanceM);
    s.maxGap=Math.max(s.maxGap,a.maximumRealAttackerBallGapM);
    s.maxShoeStarts=Math.max(s.maxShoeStarts,a.nativePhysicalShoeStarts);
    s.realRecontacts+=a.independentRecontacts;
    const caseId={side,variantIndex,actualCarries:actions,
     independentRecontacts:a.independentRecontacts,
     realBallForwardM:a.ballForwardDistanceM,
     peakBallSpeedMps:peakSpeed};
    if(actions<2||a.independentRecontacts<1||a.ballForwardDistanceM<4)
     s.weakCases.push(caseId);
    if(peakSpeed>3.5+1e-6)s.speedCases.push(caseId);
    if(peakLift>0.015+1e-6)s.liftCases.push(caseId);
    if(arm.id==='baseline')baselineEndpoint=last.ball;
    else{
     const d=Math.hypot(
      last.ball.position.x-baselineEndpoint.position.x,
      last.ball.position.y-baselineEndpoint.position.y);
     s.totalEndpointDelta+=d;
     if(d>0.0001)s.changedEndpoints++;
    }
   }finally{lab.dispose();}
  }
 }
 const base=stats.baseline;
 const summary=Object.fromEntries(arms.map(arm=>{
  const s=stats[arm.id],n=s.trials;
  return [arm.id,{
   trials:n,realToeLengthScale:arm.length,realRecoveryScale:arm.recovery,
   meanPhysicalShoeStarts:s.starts/n,
   meanAppliedCarryImpulses:s.actions/n,
   meanShoeStartsWithoutCarry:s.nonAction/n,
   meanSolverNonActionStarts:s.solverNonAction/n,
   meanForceEventNonActionStarts:s.forceNonAction/n,
   meanBothShoesActiveTicks:s.bothFeetTicks/n,
   meanIndependentRecontacts:s.realRecontacts/n,
   maxNativeShoeStarts:s.maxShoeStarts,
   peakBallSpeedMps:s.peakSpeed,maxGroundBallLiftM:s.peakLift,
   minBallForwardM:s.minForward,maxActorBallGapM:s.maxGap,
   weakCases:s.weakCases,speedBreaches:s.speedCases.length,
   liftBreaches:s.liftCases.length,
   meanEndpointDeltaM:s.totalEndpointDelta/n,
   changedEndpointTrials:s.changedEndpoints,
   eligibleForVisualReview:
    s.weakCases.length===0&&s.speedCases.length===0&&
    s.liftCases.length===0&&s.starts<base.starts&&
    s.actions<base.actions&&s.nonAction<=base.nonAction
  }];
 }));
 process.stdout.write('ME_628_SOLO_COMBINED_TOE_RECOVERY_COUNTERFACTUAL '+
  JSON.stringify(summary)+'\n');
 assert.equal(summary.baseline.trials,60);
 assert.equal(summary.baseline.weakCases.length,0);
 assert.equal(summary.baseline.speedBreaches,0);
 assert.equal(summary.baseline.liftBreaches,0);
 assert.ok(Math.abs(summary.baseline.meanPhysicalShoeStarts-9.1)<0.05);
 assert.ok(Math.abs(summary.baseline.meanAppliedCarryImpulses-
  4.866666666666666)<0.05);
 assert.equal(summary['long-toe-anchor'].weakCases.length,1,
  'Single-variable toe-length failure must be reproducible');
 for(const arm of arms.slice(1)){
  const s=summary[arm.id],data=stats[arm.id];
  assert.equal(s.trials,60);
  assert.equal(data.starts,data.actions+data.nonAction);
  assert.ok(s.changedEndpointTrials>0,
   'Counterfactual original Rapier ball trajectory should differ');
  assert.ok(s.meanEndpointDeltaM>0);
  assert.ok(s.meanSolverNonActionStarts<=s.meanShoeStartsWithoutCarry);
  assert.ok(s.meanForceEventNonActionStarts<=s.meanShoeStartsWithoutCarry);
 }
});


test('#628 genuine Sprint cadence/lateral-track 6s counterfactuals preserve default LAB',
 {timeout:300000,
  skip:process.env.FA_MATCH_ENGINE_DEEP_RESEARCH!=='1'},async()=>{
 const R=await initializeRapier(rapier);
 // 7 independent Rapier worlds from the exact same canonical player/ball
 // source, per selected HOME/AWAY V01-V30. Only the Sprint-phase physical
 // gait changes; Control/Moderate, shoe shape, actual ball, original player
 // movement, single action source, collision/force solver all remain real.
 const arms=Object.freeze([
  {id:'baseline',cadence:1,track:1},
  {id:'cadence-90',cadence:0.9,track:1},
  {id:'cadence-110',cadence:1.1,track:1},
  {id:'track-90',cadence:1,track:0.9},
  {id:'track-110',cadence:1,track:1.1},
  {id:'slow-wide',cadence:0.9,track:1.1},
  {id:'fast-narrow',cadence:1.1,track:0.9}
 ]);
 const fresh=()=>({
  trials:0,earlyStarts:0,earlyActions:0,earlyUnconverted:0,
  lateStarts:0,lateActions:0,lateUnconverted:0,
  overlaps:0,peakSpeed:0,peakLift:0,minForward:Infinity,
  meanGapSum:0,maxGap:0,lateForwardSum:0,firstHalfWeak:[],
  secondHalfWeak:[],speedBreaches:[],liftBreaches:[],stalls:[],
  earlyPhases:new Set(),latePhases:new Set(),endpointDeltas:[],
  nativeForceStarts:0,solverStarts:0,alternations:0,
  startReasonTotals:{
   simultaneousFootStarts:0,otherFootAlreadyActive:0,
   exclusiveActorStartNoImpulse:0,unreleasedSingleFootStart:0
  },handoffTotals:{
   oppositeFootEndStartSameTick:0,sameFootEndRestartSameTick:0,
   multipleFootEndStartSameTick:0,startWithoutMatchingSameTickEnd:0
  },actorOnsetTotal:0,completeReleaseTotal:0,releaseGapTotal:0,
  maxActualObservedGaitFrequencyHz:0,sprintPhaseCount:0
 });
 const stats=Object.fromEntries(arms.map(arm=>[arm.id,fresh()]));
 for(let variantIndex=0;variantIndex<30;variantIndex++)
 for(const side of ['home','away']){
  let expectedInitial=null,baselineEnd=null;
  for(const arm of arms){
   const lab=createControlledActionLab(R,'carry-solo',{
    shotSide:side,variantIndex,bodyGuardEnabled:true,
    historicalCarryPhysics:true,soloSprintCadenceScale:arm.cadence,
    soloSprintLateralTrackScale:arm.track
   });
   try{
    const start=lab.snapshot();
    if(expectedInitial===null)expectedInitial=start;
    else{
     assert.deepEqual(start.ball,expectedInitial.ball,
      'Paired real Rapier worlds start at exact same ball state');
     assert.deepEqual(start.observedMovementPlayers,
      expectedInitial.observedMovementPlayers,
      'Paired canonical 22-player frames start identically');
    }
    const st=stats[arm.id];
    let first=null,end=null,last=null,peakSpeed=0,peakLift=0,
     maxGap=0,earlyPhases=new Set(),latePhases=new Set();
    for(let tick=1;tick<=360;tick++){
     const f=lab.step();
     last=f;
     assert.equal(f.physicsTick,tick);
     assert.equal(f.nativeDribbleAudit.tick,tick);
     const foot=f.soloNativeFeet;
     assert.equal(foot.source,'rapier-physical-collider-events');
     assert.equal(foot.dynamics.tick,tick);
     assert.equal(foot.independentColliders,2);
     assert.equal(foot.sprintCadenceScale,arm.cadence);
     assert.equal(foot.sprintLateralTrackScale,arm.track);
     assert.equal(foot.physicalColliderHalfLengthM,0.105);
     assert.equal(foot.physicalColliderHalfWidthM,0.052);
     assert.equal(foot.recoveryStepScale,1);
     assert.ok(Number.isFinite(foot.nativeObservedGaitFrequencyHz));
     assert.equal(f.genuinePhysicalPlayerCount,1);
     assert.deepEqual(f.smallSidedParticipants,[side+'-10']);
     assert.deepEqual(f.smallSidedNativeBodyGuard.nativeOpposingTorsoPairs,[]);
     const phase=f.soloCarryPhase.phase;
     (tick<=180?earlyPhases:latePhases).add(phase);
     if(phase==='sprint')st.sprintPhaseCount++;
     st.maxActualObservedGaitFrequencyHz=Math.max(
      st.maxActualObservedGaitFrequencyHz,
      foot.nativeObservedGaitFrequencyHz);
     if(f.action?.action==='carry'){
      assert.equal(f.action.appliedByRapier,true);
      assert.equal(f.action.actualPhysicsImpulseApplied,true);
      assert.equal(foot.exclusivePhysicalStart,true);
     }
     const ballV=f.ball.velocity,speed=Math.hypot(ballV.x,ballV.y);
     peakSpeed=Math.max(peakSpeed,speed);
     peakLift=Math.max(peakLift,
      f.nativeDribbleAudit.peakGroundClearanceM);
     maxGap=Math.max(maxGap,
      f.nativeDribbleAudit.maximumRealAttackerBallGapM);
     if(tick===180){
      const a=f.nativeDribbleAudit;
      first={
       starts:a.nativePhysicalShoeStarts,
       actions:a.appliedCarryActions,
       nonAction:a.nativeShoeStartsWithoutCarryImpulse,
       recontacts:a.independentRecontacts,
       forward:a.ballForwardDistanceM
      };
      assert.equal(first.starts,first.actions+first.nonAction);
     }
    }
    const a=last.nativeDribbleAudit;
    end={
     starts:a.nativePhysicalShoeStarts,
     actions:a.appliedCarryActions,
     nonAction:a.nativeShoeStartsWithoutCarryImpulse,
     recontacts:a.independentRecontacts,
     forward:a.ballForwardDistanceM
    };
    assert.equal(end.starts,end.actions+end.nonAction);
    assert.ok(a.nonActionStartsWithNativeForceEvents<=end.nonAction);
    assert.ok(a.nonActionStartsWithSolverContacts<=end.nonAction);
    // 360-tick source-level diagnosis must reconcile each physical shoe
    // START and each phase with the actual original action authority.
    assert.equal(Object.values(a.nonActionStartReasons)
     .reduce((sum,n)=>sum+n,0),end.nonAction);
    assert.equal(Object.values(a.unreleasedSingleFootEndStartKinds)
     .reduce((sum,n)=>sum+n,0),
     a.nonActionStartReasons.unreleasedSingleFootStart);
    for(const phase of ['control','moderate','sprint'])
     assert.equal(Object.values(a.unreleasedHandoffKindsByPhase[phase])
      .reduce((sum,n)=>sum+n,0),
      a.nonActionReasonsByPhase[phase].unreleasedSingleFootStart);
    assert.equal(a.nativeActorContactOnsets>=end.actions,true);
    assert.equal(a.nativeActorFullReleaseEvents<=
     a.nativeActorContactOnsets,true);
    assert.equal(a.nativeActorStartsAfterFullRelease<=
     a.nativeActorFullReleaseEvents,true);
    assert.equal(['control','moderate','sprint'].reduce((sum,phase)=>
     sum+a.nativeStartsByPhase[phase].nativeShoeStarts,0),end.starts);
    assert.equal(['control','moderate','sprint'].reduce((sum,phase)=>
     sum+a.nativeStartsByPhase[phase].appliedCarry,0),end.actions);
    const later={
     starts:end.starts-first.starts,
     actions:end.actions-first.actions,
     nonAction:end.nonAction-first.nonAction,
     recontacts:end.recontacts-first.recontacts,
     forward:end.forward-first.forward
    };
    assert.equal(later.starts,later.actions+later.nonAction);
    const witness={side,variantIndex,earlyActions:first.actions,
     lateActions:later.actions,earlyRecontacts:first.recontacts,
     lateRecontacts:later.recontacts,earlyForwardM:first.forward,
     lateForwardM:later.forward,peakSpeedMps:peakSpeed};
    if(first.actions<2||first.recontacts<1||first.forward<4)
     st.firstHalfWeak.push(witness);
    if(later.actions<2||later.recontacts<1||later.forward<4)
     st.secondHalfWeak.push(witness);
    if(peakSpeed>3.5+1e-6)st.speedBreaches.push(witness);
    if(peakLift>0.015+1e-6)st.liftBreaches.push(witness);
    if(later.forward<=0||later.actions===0)st.stalls.push(witness);
    st.trials++;
    st.earlyStarts+=first.starts;
    st.earlyActions+=first.actions;
    st.earlyUnconverted+=first.nonAction;
    st.lateStarts+=later.starts;
    st.lateActions+=later.actions;
    st.lateUnconverted+=later.nonAction;
    st.overlaps+=a.nativeBothFeetActiveTicks;
    st.peakSpeed=Math.max(st.peakSpeed,peakSpeed);
    st.peakLift=Math.max(st.peakLift,peakLift);
    st.maxGap=Math.max(st.maxGap,maxGap);
    st.meanGapSum+=a.averageRealAttackerBallGapM;
    st.minForward=Math.min(st.minForward,end.forward);
    st.lateForwardSum+=later.forward;
    st.nativeForceStarts+=a.nonActionStartsWithNativeForceEvents;
    st.solverStarts+=a.nonActionStartsWithSolverContacts;
    st.alternations+=a.verifiedFootAlternations;
    for(const reason of Object.keys(st.startReasonTotals))
     st.startReasonTotals[reason]+=a.nonActionStartReasons[reason];
    for(const kind of Object.keys(st.handoffTotals))
     st.handoffTotals[kind]+=a.unreleasedSingleFootEndStartKinds[kind];
    st.actorOnsetTotal+=a.nativeActorContactOnsets;
    st.completeReleaseTotal+=a.nativeActorFullReleaseEvents;
    st.releaseGapTotal+=a.nativeActorStartsAfterFullRelease;
    for(const x of earlyPhases)st.earlyPhases.add(x);
    for(const x of latePhases)st.latePhases.add(x);
    if(arm.id==='baseline')baselineEnd=last.ball;
    else st.endpointDeltas.push(Math.hypot(
     last.ball.position.x-baselineEnd.position.x,
     last.ball.position.y-baselineEnd.position.y));
   }finally{lab.dispose();}
  }
 }
 const baseline=stats.baseline;
 const summary=Object.fromEntries(arms.map(arm=>{
  const st=stats[arm.id],n=st.trials;
  const starts=st.earlyStarts+st.lateStarts;
  const actions=st.earlyActions+st.lateActions;
  const nonAction=st.earlyUnconverted+st.lateUnconverted;
  return [arm.id,{
   trials:n,durationS:6,sprintCadenceScale:arm.cadence,
   sprintLateralTrackScale:arm.track,
   meanNativeStarts6s:starts/n,meanCarryActions6s:actions/n,
   meanNonActionStarts6s:nonAction/n,
   meanNativeStartsFirst3s:st.earlyStarts/n,
   meanCarryActionsFirst3s:st.earlyActions/n,
   meanNativeStartsLast3s:st.lateStarts/n,
   meanCarryActionsLast3s:st.lateActions/n,
   meanNonActionStartsLast3s:st.lateUnconverted/n,
   meanBothShoesActiveTicks:st.overlaps/n,
   meanNonActionWithForceEvent:st.nativeForceStarts/n,
   meanNonActionWithSolverContacts:st.solverStarts/n,
   meanVerifiedFootAlternations:st.alternations/n,
   meanNonActionReasons:Object.fromEntries(
    Object.entries(st.startReasonTotals).map(([reason,total])=>[
     reason,total/n
    ])),
   meanUnreleasedSingleFootEndStartKinds:Object.fromEntries(
    Object.entries(st.handoffTotals).map(([kind,total])=>[
     kind,total/n
    ])),
   meanNativeActorContactOnsets:st.actorOnsetTotal/n,
   meanCompleteNativeReleases:st.completeReleaseTotal/n,
   meanActorStartsAfterCompleteRelease:st.releaseGapTotal/n,
   maxGaitFrequencyHz:st.maxActualObservedGaitFrequencyHz,
   min6sBallForwardM:st.minForward,
   meanLateBallForwardM:st.lateForwardSum/n,
   peakBallSpeedMps:st.peakSpeed,peakGroundLiftM:st.peakLift,
   maxActorBallGapM:st.maxGap,meanActorBallGapM:st.meanGapSum/n,
   earlyPhases:[...st.earlyPhases],latePhases:[...st.latePhases],
   firstHalfWeakCount:st.firstHalfWeak.length,
   secondHalfWeakCount:st.secondHalfWeak.length,
   speedBreachCount:st.speedBreaches.length,
   liftBreachCount:st.liftBreaches.length,
   stallCount:st.stalls.length,
   weakExamples:st.firstHalfWeak.concat(st.secondHalfWeak).slice(0,5),
   speedExamples:st.speedBreaches.slice(0,5),
   meanEndpointDeltaFromDefaultM:st.endpointDeltas.length?
    st.endpointDeltas.reduce((x,y)=>x+y,0)/n:0,
   eligibleForVisualQA:st.firstHalfWeak.length===0&&
    st.secondHalfWeak.length===0&&st.speedBreaches.length===0&&
    st.liftBreaches.length===0&&st.stalls.length===0&&
    starts<baseline.earlyStarts+baseline.lateStarts&&
    actions<baseline.earlyActions+baseline.lateActions&&
    nonAction<=baseline.earlyUnconverted+baseline.lateUnconverted
  }];
 }));
 process.stdout.write('ME_628_SOLO_SPRINT_CADENCE_TRACK_6S '+JSON.stringify(summary)+'\n');
 assert.equal(summary.baseline.trials,60);
 assert.equal(summary.baseline.firstHalfWeakCount,0);
 assert.equal(summary.baseline.secondHalfWeakCount,0);
 assert.equal(summary.baseline.speedBreachCount,0);
 assert.equal(summary.baseline.liftBreachCount,0);
 assert.equal(summary.baseline.stallCount,0);
 assert.ok(Math.abs(summary.baseline.meanNativeStarts6s-17.1)<0.05);
 assert.ok(Math.abs(summary.baseline.meanCarryActions6s-10.4)<0.05);
 assert.ok(Math.abs(summary.baseline.meanNativeStartsLast3s-8.0)<0.05);
 for(const arm of arms){
  const st=stats[arm.id],s=summary[arm.id];
  assert.equal(s.trials,60);
  assert.equal(st.earlyStarts+st.lateStarts,
   st.earlyActions+st.lateActions+
   st.earlyUnconverted+st.lateUnconverted);
  assert.ok(s.meanNonActionWithSolverContacts<=s.meanNonActionStarts6s);
  assert.ok(s.meanNonActionWithForceEvent<=s.meanNonActionStarts6s);
  assert.ok(Math.abs(Object.values(s.meanNonActionReasons)
   .reduce((sum,n)=>sum+n,0)-s.meanNonActionStarts6s)<1e-8);
  assert.ok(Math.abs(Object.values(s.meanUnreleasedSingleFootEndStartKinds)
   .reduce((sum,n)=>sum+n,0)-
   s.meanNonActionReasons.unreleasedSingleFootStart)<1e-8);
  assert.ok(s.meanNativeActorContactOnsets>=s.meanCarryActions6s);
  assert.ok(s.meanCompleteNativeReleases<=s.meanNativeActorContactOnsets);
  assert.ok(s.earlyPhases.includes('sprint'));
  assert.ok(s.latePhases.includes('sprint'));
  if(arm.id!=='baseline'){
   assert.ok(s.meanEndpointDeltaFromDefaultM>0,
    'Changed native Sprint gait should change an actual Rapier ball replay');
  }
 }
});

 test('#628 recovery state stays internal and both tackle profiles remain selectable',()=>{
  const ui=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
  assert.match(ui,/action:dribble-1v1:standing/);assert.match(ui,/action:dribble-1v1:sliding/);assert.match(ui,/action:dribble-1v1:shoulder/);assert.match(ui,/action:pass-pair:interception/);assert.match(ui,/action:defender-1v1:block/);
  assert.doesNotMatch(ui,/Getting up/i);
 });

test('UME-05M witnessed pass movement shares one direction-independent rolling interception planner',async()=>{
 const {planNativePassInterception,planDuelInterception}=await import('../src/isolated-dribble-touches.mjs');
 for(const team of ['home','away']){
  const dir=team==='home'?1:-1,other=team==='home'?'away':'home';
  const ballPosition={x:0,y:0,z:0.11};
  for(const [vx,vy] of [[dir*4,0],[-dir*4,0],[0,4],[0,-4]]){
   const ballVelocity={x:vx,y:vy,z:0};
   const passer={id:team+'-7',team,x:-vx,y:-vy};
   const recipient={id:team+'-9',team,x:vx*3,y:vy*3};
   const defender={id:other+'-8',team:other,x:vx*0.4,y:vy*0.4,vx:0,vy:0};
   const input={passer,recipient,defender,ballPosition,ballVelocity};
   const isolated=planNativePassInterception(input);
   const open=planNativeDefensiveIntervention({attacker:passer,recipient,defender,ballPosition,ballVelocity,context:'pass'});
   assert.ok(isolated?.reachable);
   assert.deepEqual(open.interception,isolated);
   assert.equal(open.decision.kind,'interception');
   assert.equal(open.decision.physicalContactProven,false);
   assert.ok(isolated.point.x*vx+isolated.point.y*vy>0);
   assert.ok(isolated.etaS>0&&isolated.etaS<=0.8);
   assert.equal(isolated.decisionOnly,true);
   assert.equal(planNativePassInterception({...input,recipient:null}),null);
   assert.equal(planNativePassInterception({...input,recipient:{...recipient,team:other}}),null);
   assert.equal(planNativePassInterception({...input,ballVelocity:{x:0,y:0,z:0}}),null);
   assert.equal(planNativePassInterception({...input,defender:{...defender,x:-vx,y:-vy}}),null);
   assert.equal(planNativeDefensiveIntervention({attacker:passer,defender,ballPosition,ballVelocity,context:'pass'}).decision.kind,'none');
   if(vx*dir<0.45)assert.equal(planDuelInterception({attackingSide:team,attacker:passer,defender,ballPosition,ballVelocity}),null);
  }
 }
});

test('UME-06D4B collective targets and goalkeeper geometry reflect X without swapping team or player identity',()=>{
 const players=[
  {id:'home-10',team:'home',role:'forward',x:27,y:1},
  {id:'home-9',team:'home',role:'forward',x:24,y:6},
  {id:'away-2',team:'away',role:'defender',x:31,y:2},
  {id:'away-3',team:'away',role:'defender',x:34,y:-4}];
 const keepers=[{id:'away-1',team:'away',role:'goalkeeper',x:48,y:1}];
 const mirror=p=>({...p,x:-p.x}),ball={x:28,y:1},v={x:2,y:0.4};
 for(const control of [null,{kind:'controlled',playerId:'home-10'},{kind:'controlled',playerId:'away-2'}]){
  const a=planNativeFootballMovement(players,ball,v,control,keepers);
  const b=planNativeFootballMovement(players.map(mirror),mirror(ball),mirror(v),control,keepers.map(mirror),-1);
  assert.deepEqual(Object.keys(a),Object.keys(b));
  for(const id of Object.keys(a)){
   assert.equal(a[id].kind,b[id].kind);
   assert.ok(Math.abs(a[id].target.x+b[id].target.x)<1e-8);
   assert.ok(Math.abs(a[id].target.y-b[id].target.y)<1e-8);
   assert.equal(a[id].coveredReceiverId,b[id].coveredReceiverId);
   assert.equal(b[id].officialPossession,false);
  }
 }
 for(const team of ['home','away']){
  const a=goalkeeperPosition(team,ball),b=goalkeeperPosition(team,mirror(ball),-1);
  assert.equal(a.x,-b.x);assert.equal(a.y,b.y);assert.equal(a.depthM,b.depthM);
 }
 const keeper={id:'away-1',team:'away',x:47,y:1},actor={id:'home-10',team:'home',x:45,y:1};
 const p={x:45.5,y:1,z:0.11},vel={x:1,y:0,z:0};
 const a=planNativeKeeperCloseDown(keeper,actor,p,vel),b=planNativeKeeperCloseDown(mirror(keeper),mirror(actor),mirror(p),mirror(vel),-1);
 assert.ok(a&&b);assert.equal(a.x,-b.x);assert.equal(a.y,b.y);
 assert.throws(()=>planNativeFootballMovement(players,ball,v,null,keepers,0),/polarity/);
});
test('UME-06D4B original mover reversed formation preparation is bounded and identity preserving; normal engine is not switched',()=>{
 const options={researchSmallSidedSituation:'full-field-native',researchSmallSidedSide:'home',researchCollectiveApproaches:true,researchSmallSidedBodyFeedback:true};
 const mover=createPlayerMovement(options);
 const before=mover.snapshot(),control={tick:0,kind:'loose',officialPossession:false};
 const placement={kind:'kickoff',assignedTeam:'away',takerId:'away-10',tick:0,spot:{x:0,y:0,z:0.11},deadBallPlacementOnly:true};
 const ball={x:0,y:0,z:0.11},v={x:0,y:0,z:0};
 const frame=mover.step(ball,null,null,v,null,false,false,null,null,null,control,placement,-1);
 assert.equal(frame.tick,1);
 for(const [i,p] of frame.players.entries()){
  assert.equal(p.id,before.players[i].id);assert.equal(p.team,before.players[i].team);
  assert.ok(Math.hypot(p.x-before.players[i].x,p.y-before.players[i].y)<=7/60+1e-7);
  const target=frame.smallSidedMovementDecisions.find(d=>d.id===p.id).target;
  const base=INITIAL_PLAYERS.find(q=>q.id===p.id);
  assert.ok(Math.abs(target.x-(p.id==='away-10'?0.10:-base.x))<1e-9);
  assert.equal(target.y,p.id==='away-10'?0:base.y);
 }
 assert.throws(()=>createPlayerMovement(options).step(ball,null,null,v,null,false,false,null,null,null,{tick:0,kind:'controlled',playerId:'home-10',officialPossession:false},null,-1),/Reversed movement/);
 assert.throws(()=>mover.step(ball,null,null,v,null,false,false,null,null,null,{tick:1,kind:'loose',officialPossession:false},placement,-1),/prior tick acknowledgment/);
});

test('UME-06D4C1 native action and defensive touch direction preserves actor and mirrored geometry',()=>{
 const mirror=p=>({...p,x:-p.x,...(Number.isFinite(p.vx)?{vx:-p.vx}:{})});
 const actor={id:'home-10',team:'home',role:'forward',x:29.6,y:0,vx:0,vy:0};
 const receiver={id:'home-9',team:'home',role:'forward',x:38,y:5,vx:0,vy:0};
 const rival={id:'away-2',team:'away',role:'defender',x:34,y:9,vx:0,vy:0};
 const ball={x:30,y:0,z:0.11},v={x:1,y:0,z:0};
 const actors=[actor,receiver,rival];
 const pass=chooseRecipient(actor,ball,actors),rev=chooseRecipient(mirror(actor),mirror(ball),actors.map(mirror),-1);
 assert.ok(pass&&rev);assert.equal(pass.player.id,rev.player.id);assert.equal(pass.forward,rev.forward);
 const a=planNativeCarryTouch({attacker:actor,attackingSide:'home',defender:rival,ballPosition:ball,ballVelocity:v});
 const b=planNativeCarryTouch({attacker:mirror(actor),attackingSide:'home',defender:mirror(rival),ballPosition:mirror(ball),ballVelocity:mirror(v),attackPolarity:-1});
 assert.ok(Math.abs(a.dx+b.dx)<1e-9);assert.ok(Math.abs(a.dy-b.dy)<1e-9);assert.equal(a.magnitudeNs,b.magnitudeNs);
 const keeper={id:'away-1',team:'away',role:'goalkeeper',x:48,y:0};
 const incoming={x:46,y:0,z:0.11},shot={x:10,y:0,z:0};
 assert.equal(eligibleLiveKeeperSave(keeper,incoming,shot),true);
 assert.equal(eligibleLiveKeeperSave(mirror(keeper),mirror(incoming),mirror(shot),-1),true);
 const blocker={...rival,x:32,y:0};
 const block=planNativeShotBlock({player:blocker,ball,velocity:shot}),reverseBlock=planNativeShotBlock({player:mirror(blocker),ball:mirror(ball),velocity:mirror(shot),attackPolarity:-1});
 assert.ok(block&&reverseBlock);assert.equal(block.actorId,reverseBlock.actorId);assert.equal(block.target.x,-reverseBlock.target.x);
 const defender={...rival,x:30.3,y:0.2},passer={...actor,x:25},recipient={...receiver,x:36};
 const touch=chooseNativePassInterceptionTouch({passer,recipient,defender,ballPosition:ball,ballVelocity:shot});
 const reverseTouch=chooseNativePassInterceptionTouch({passer:mirror(passer),recipient:mirror(recipient),defender:mirror(defender),ballPosition:mirror(ball),ballVelocity:mirror(shot),attackPolarity:-1});
 assert.ok(touch&&reverseTouch);assert.equal(touch.actorId,reverseTouch.actorId);
 assert.ok(Math.abs(touch.dx+reverseTouch.dx)<1e-9);assert.ok(Math.abs(touch.dy-reverseTouch.dy)<1e-9);
 // Pure selector inputs, NOT physical contact evidence.
 const players=INITIAL_PLAYERS.map(p=>p.id===actor.id?{...p,...actor}:p.id===receiver.id?{...p,...receiver}:{...p,x:p.team==='home'?-20:10,y:p.y});
 const frame=createPlayerMovement().snapshot();
 const select=(polarity,contacts=[actor.id])=>selectUniformAutonomousContactAction({tick:1,contactStarted:contacts,contactActive:contacts,
  playerFrame:{...frame,tick:1,players:polarity===1?players:players.map(mirror)},ballPosition:polarity===1?ball:mirror(ball),
  ballVelocity:polarity===1?v:mirror(v),ballRadiusM:0.11,allowPhysicalCarry:true,
  activePlayerIds:players.map(p=>p.id),nativeActionPolicy:true,collectiveControl:{tick:0,kind:'loose',officialPossession:false},
  attackPolarity:polarity});
 const normal=select(1),reversed=select(-1);
 assert.ok(normal&&reversed);assert.equal(normal.playerId,reversed.playerId);assert.equal(normal.action,reversed.action);
 assert.ok(Math.abs(normal.impulseNs.x+reversed.impulseNs.x)<1e-9);
 assert.ok(Math.abs(normal.impulseNs.y-reversed.impulseNs.y)<1e-9);
 assert.equal(normal.impulseNs.z,reversed.impulseNs.z);
 assert.equal(select(-1,[]),null);assert.equal(select(-1,[actor.id,receiver.id]),null);
});

test('UME-06D4C2 mirrored keeper hand geometry, distribution, slide and observed block preserve original team',()=>{
 const mirror=p=>({...p,x:-p.x,...(Number.isFinite(p.vx)?{vx:-p.vx}:{})});
 const keeper={id:'away-1',team:'away',role:'goalkeeper',x:48,y:0};
 const shot={position:{x:43,y:1,z:0.8},velocity:{x:18,y:0,z:3}};
 const reverseBall=b=>({position:mirror(b.position),velocity:mirror(b.velocity)});
 const a=planNativeKeeperDive(keeper,shot),b=planNativeKeeperDive(mirror(keeper),reverseBall(shot),-1);
 assert.ok(a&&b);assert.equal(a.target.x,-b.target.x);assert.equal(a.target.y,b.target.y);assert.equal(a.target.z,b.target.z);
 const attacker={id:'home-10',team:'home',role:'forward',x:47,y:0.2};
 const loose={position:{x:47.2,y:0.2,z:0.11},velocity:{x:1,y:0,z:0}};
 const q=planNativeKeeperChallenge(keeper,attacker,loose),s=planNativeKeeperChallenge(mirror(keeper),mirror(attacker),reverseBall(loose),-1);
 assert.ok(q&&s);assert.equal(q.target.x,-s.target.x);assert.equal(q.target.y,s.target.y);
 const evidence={team:'away',contact:true,ballPosition:{x:47.5,y:0,z:0.8},before:{x:2,y:0,z:0},after:{x:0.2,y:0,z:0},glovePosition:{x:47.5,y:0,z:0.8},gloveVelocity:{x:0,y:0,z:0}};
 const reversed={...evidence,...Object.fromEntries(['ballPosition','before','after','glovePosition','gloveVelocity'].map(k=>[k,mirror(evidence[k])])),attackPolarity:-1};
 assert.equal(eligibleKeeperGrip(evidence),true);assert.equal(eligibleKeeperGrip(reversed),true);
 assert.equal(eligibleKeeperGrip({...reversed,attackPolarity:1}),false);
 const dist=planNativeKeeperDistribution(keeper,evidence.ballPosition,[keeper]),rev=planNativeKeeperDistribution(mirror(keeper),reversed.ballPosition,[mirror(keeper)],-1);
 assert.equal(dist.kind,'clearance');assert.equal(rev.kind,'clearance');
 assert.equal(dist.desiredVelocity.x,-rev.desiredVelocity.x);assert.equal(dist.desiredVelocity.z,rev.desiredVelocity.z);
 const player={id:'away-2',team:'away',role:'defender',x:31,y:0.4,vx:-2,vy:-0.8,facingRad:Math.atan2(-0.8,-2)};
 const carrier={id:'home-10',team:'home',x:29.6,y:0};
 const ball={x:30,y:0,z:0.11},velocity={x:1,y:0,z:0};
 const slide=planSlidingTackle({attackingSide:'home',attacker:carrier,defender:player,ball,velocity});
 const reverseSlide=planSlidingTackle({attackingSide:'home',attacker:mirror(carrier),defender:{...mirror(player),facingRad:Math.atan2(player.vy,-player.vx)},ball:mirror(ball),velocity:mirror(velocity),attackPolarity:-1});
 assert.ok(slide&&reverseSlide);assert.equal(slide.actorId,reverseSlide.actorId);assert.equal(slide.target.x,-reverseSlide.target.x);
 const delivery={tick:1,kind:'shot',team:'home',playerId:carrier.id},pre={x:12,y:0,z:0},post={x:2,y:1,z:0};
 const block=observeNativeShotBlock({tick:2,delivery,players:[player],starts:[player.id],before:pre,after:post});
 const reverseBlock=observeNativeShotBlock({tick:2,delivery,players:[mirror(player)],starts:[player.id],before:mirror(pre),after:mirror(post),attackPolarity:-1});
 assert.ok(block?.blocked);assert.deepEqual(reverseBlock,block);
 assert.equal(observeNativeShotBlock({tick:2,delivery,players:[mirror(player)],starts:[],before:mirror(pre),after:mirror(post),attackPolarity:-1}),null);
});

test('AERIAL-01 bounded native head reach: actual same-world descending ball solver contact, no invented heading',async()=>{
 const R=await initializeRapier(rapier);
 const actor={id:'home-10',team:'home',role:'forward',x:0,y:0,vx:0,vy:0};
 assert.equal(planNativeAerialJump(actor,{position:{x:0,y:0,z:0.11},velocity:{x:0,y:0,z:0}}),null);
 assert.equal(planNativeAerialJump(actor,{position:{x:8,y:0,z:3},velocity:{x:0,y:0,z:-2}}),null);
 assert.equal(aerialHeadHeight(0),aerialHeadHeight(AERIAL_JUMP_TICKS));
 assert.ok(Math.abs(aerialHeadHeight(21)-2.27)<1e-9);
 function run(side,deadBall=false){
  const world=new R.World({x:0,y:0,z:-9.81});world.timestep=1/60;
  try{
   const p={...actor,id:side+'-10',team:side};
   const ball=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,0,3).setLinvel(0,0,-2).setCcdEnabled(true));
   const collider=world.createCollider(R.ColliderDesc.ball(0.11).setMass(0.43),ball);
   const head=createNativeAerialHead(R,world,collider,p),samples=[];
   let contact=null;
   for(let t=1;t<=60;t++){
    head.prepare(p,t,{position:ball.translation(),velocity:ball.linvel()},deadBall);
    world.step();
    const state=head.observe(t);samples.push(state);
    assert.equal(state.physicalHeaderActionApplied,false);assert.equal(state.officialPossession,false);
    assert.ok(state.headPosition.z>=1.72-1e-6&&state.headPosition.z<=2.27+1e-6);
    if(state.contactStarted&&!contact)contact=state;
   }
   if(deadBall){assert.ok(samples.every(s=>!s.jumping&&!s.contact));return null;}
   assert.ok(contact?.actualNativeSolverContact,'actual original Rapier head solver contact required');
   assert.equal(contact.actorId,p.id);assert.ok(samples.some(s=>s.jumpStarted));
   assert.ok(samples.some(s=>s.tick>42&&!s.jumping));
   return contact.tick;
  }finally{world.free();}
 }
 const home=run('home'),away=run('away');assert.equal(home,away);assert.equal(run('home',true),null);
 process.stdout.write('ME_628_AERIAL01_HEAD '+JSON.stringify({homeContactTick:home,awayContactTick:away})+'\n');
});
test('AERIAL-01 core integration enables native heads only on guarded collective research; grounded replay stays grounded',async()=>{
 const R=await initializeRapier(rapier),id='full-field-native',side='home';
 const fixture=smallSidedSetup(id,side,INITIAL_PLAYERS);
 assert.throws(()=>createEngine(R,fixture.ball,{diagnosticNativeAerialEnabled:true}),/guarded collective/);
 const engine=createEngine(R,fixture.ball,{diagnosticSmallSidedSituation:id,diagnosticSmallSidedSide:side,
  diagnosticPlayerFootContactsEnabled:true,diagnosticAutonomousFixtureActionEnabled:true,diagnosticSmallSidedBodyGuardEnabled:true,
  diagnosticSmallSidedBodyFeedbackEnabled:true,diagnosticCollectiveActions:true,diagnosticLatestLabDynamics:true,diagnosticNativeAerialEnabled:true});
 try{
  const mover=createPlayerMovement({researchSmallSidedSituation:id,researchSmallSidedSide:side,researchSmallSidedBodyFeedback:true,researchCollectiveApproaches:true});
  const initial=engine.snapshot(),frame=mover.step(initial.ball.position,null,null,initial.ball.velocity,null,false,false,null,null,null,engine.collectiveControlSnapshot());
  engine.step(frame);
  const body=engine.smallSidedBodyGuardSnapshot();
  assert.equal(body.aerial.length,60);
  const head=body.aerial.filter(s=>s.version==='me-628-native-aerial-head-v1');
  assert.equal(head.length,20);
  for(const surface of ['chest','foot']){
   const samples=body.aerial.filter(s=>s.surface===surface);
   assert.equal(samples.length,20);
   assert.deepEqual(new Set(samples.map(s=>s.actorId)),new Set(head.map(s=>s.actorId)));
  }
  assert.deepEqual(body.headBallContacts,[]);assert.deepEqual(body.headBallStarts,[]);
  assert.deepEqual(body.aerialControlContacts,[]);assert.deepEqual(body.aerialControlStarts,[]);
  assert.ok(body.aerial.every(s=>s.tick===1&&!s.jumping&&!s.contact&&s.sameOriginalRapierWorld));
  mover.reconcileSmallSidedNativeBodyResponse(body);engine.acknowledgeSmallSidedBodyFeedback(mover.snapshot());
 }finally{engine.dispose();}
});

test('AERIAL-02 common header decision uses live goal/pass/clearance geometry and mirrored ends',()=>{
 const ball={x:45,y:0,z:2.1},v={x:0,y:0,z:-2};
 const actor={id:'home-10',team:'home',role:'forward',x:45,y:0};
 const shot=chooseNativeHeaderIntent(actor,ball,v,[actor]);
 assert.equal(shot.action,'shot');assert.equal(shot.target.x,52.5);assert.ok(shot.desiredVelocity.x>0);
 const mate={id:'home-9',team:'home',role:'forward',x:14,y:5};
 const mid={...actor,x:0},pass=chooseNativeHeaderIntent(mid,{...ball,x:0},v,[mid,mate]);
 assert.equal(pass.action,'pass');assert.equal(pass.recipientId,mate.id);
 const defender={...actor,x:-42},rival={id:'away-10',team:'away',role:'forward',x:-41,y:2};
 const clear=chooseNativeHeaderIntent(defender,{...ball,x:-42},v,[defender,rival]);
 assert.equal(clear.action,'clearance');assert.ok(clear.desiredVelocity.x>0);
 const mirror=p=>({...p,x:-p.x});
 const reversed=chooseNativeHeaderIntent(mirror(actor),mirror(ball),mirror(v),[mirror(actor)],-1);
 assert.equal(reversed.action,'shot');assert.equal(reversed.target.x,-shot.target.x);assert.equal(reversed.desiredVelocity.x,-shot.desiredVelocity.x);
 assert.equal(chooseNativeHeaderIntent(actor,{...ball,z:0.11},v,[actor]),null);
});
test('AERIAL-02 original full-field core consumes a descending ball head START with one bounded native redirect',async()=>{
 const R=await initializeRapier(rapier),id='full-field-native',side='home';
 const fixture=smallSidedSetup(id,side,INITIAL_PLAYERS),actor=fixture.staged.find(p=>p.id==='home-10');
 const engine=createEngine(R,{preset:'drop',seed:'aerial02-native',x:actor.x,y:actor.y,z:2.89,vx:0,vy:0,vz:-2},{
  diagnosticSmallSidedSituation:id,diagnosticSmallSidedSide:side,
  diagnosticPlayerFootContactsEnabled:true,diagnosticAutonomousFixtureActionEnabled:true,diagnosticSmallSidedBodyGuardEnabled:true,
  diagnosticSmallSidedBodyFeedbackEnabled:true,diagnosticCollectiveActions:true,diagnosticLatestLabDynamics:true,diagnosticNativeAerialEnabled:true});
 try{
  const mover=createPlayerMovement({researchSmallSidedSituation:id,researchSmallSidedSide:side,researchSmallSidedBodyFeedback:true,researchCollectiveApproaches:true});
  let hit=null;
  for(let tick=1;tick<=90;tick++){
   const prior=engine.snapshot(),frame=mover.step(prior.ball.position,null,null,prior.ball.velocity,null,false,false,null,null,null,engine.collectiveControlSnapshot());
   const physics=engine.step(frame),body=engine.smallSidedBodyGuardSnapshot(),action=engine.uniformAutonomousActionSnapshot();
   mover.reconcileSmallSidedNativeBodyResponse(body);engine.acknowledgeSmallSidedBodyFeedback(mover.snapshot());
   if(action?.nativeExclusiveHeadStart){
    assert.deepEqual(body.headBallStarts,[action.playerId]);assert.deepEqual(body.headBallContacts,[action.playerId]);
    assert.deepEqual(engine.footContactSnapshot().active,[]);
    assert.equal(action.tick,tick);assert.equal(action.actualPhysicsImpulseApplied,true);
    assert.ok(Math.hypot(...Object.values(action.impulseNs))<=5+1e-8);
    assert.ok(Math.hypot(action.after.x-action.before.x,action.after.y-action.before.y,action.after.z-action.before.z)>0.01);
    assert.deepEqual(physics.ball.velocity,action.after);
    assert.equal(engine.nativeMatchRefereeSnapshot().lastVerifiedTouch?.playerId??engine.nativeMatchRefereeSnapshot().lastTouch?.playerId,action.playerId);
    hit=action;break;
   }
  }
  assert.ok(hit,'genuine full-field head redirect required');
  process.stdout.write('ME_628_AERIAL02_HEADER '+JSON.stringify({tick:hit.tick,actor:hit.playerId,action:hit.action,impulse:hit.impulseNs})+'\n');
 }finally{engine.dispose();}
});

test('AERIAL-02C empty opposing team has finite open lanes, not invalid affordances',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1;
  const ids=[side+'-10',side+'-9'];
  const players=INITIAL_PLAYERS.map(p=>p.id===ids[0]?{...p,x:dir*27,y:28}:p.id===ids[1]?{...p,x:dir*45,y:4}:p);
  const mover=createPlayerMovement();
  const frame={...mover.snapshot(),tick:1,players};
  const input={tick:1,contactStarted:[ids[0]],contactActive:[ids[0]],playerFrame:frame,
   ballPosition:{x:dir*27,y:28,z:0.11},ballVelocity:{x:0,y:0,z:0},ballRadiusM:0.11,
   allowPhysicalCarry:true,nativeActionPolicy:true,activePlayerIds:ids,
   collectiveControl:{tick:0,kind:'loose',officialPossession:false}};
  const cross=selectUniformAutonomousContactAction(input);
  assert.equal(cross.action,'cross');assert.equal(cross.recipientId,ids[1]);
  assert.equal(cross.crossTarget.laneClearanceM,150);
  assert.equal(selectUniformAutonomousContactAction({...input,contactStarted:[],contactActive:[]}),null);
  assert.equal(selectUniformAutonomousContactAction({...input,contactStarted:ids,contactActive:ids}),null);
  const blockedPlayers=players.map(q=>q.id===(side==='home'?'away-2':'home-2')?{...q,x:dir*36,y:16}:q);
  const blocked=selectUniformAutonomousContactAction({...input,playerFrame:{...frame,players:blockedPlayers},activePlayerIds:[...ids,side==='home'?'away-2':'home-2']});
  assert.notEqual(blocked?.action,'cross','real opposing obstruction must remain effective');
 }
});
test('AERIAL-02 LAB all 30 mirrored starts require a genuine cross before the recipient head redirect', {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),counts={cross:0,header:0,shot:0,pass:0,clearance:0},misses=[];
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const fixture=smallSidedSetup('header-pair',side,INITIAL_PLAYERS,{variantIndex});
  const lab=createControlledActionLab(R,'header-pair',{shotSide:side,variantIndex});
  const replay=createControlledActionLab(R,'header-pair',{shotSide:side,variantIndex});
  try{
   assert.equal(lab.snapshot().genuinePhysicalPlayerCount,2);assert.deepEqual(lab.focus,fixture.activeIds);
   assert.equal(fixture.ball.z,0);assert.equal(lab.snapshot().ball.velocity.z,0);
   const target=fixture.staged.find(p=>p.id===side+'-9'),dir=side==='home'?1:-1;
   assert.ok(dir*(target.x-fixture.ball.x)>=17,'deeper goalward delivery');
   assert.ok(target.y*fixture.ball.y<0,'cross towards opposite side of goal');
   assert.ok(Math.hypot(target.x-fixture.ball.x,target.y-fixture.ball.y)>=33);
   let cross=null,header=null,airborne=false,descending=false;
   for(let tick=1;tick<=240;tick++){
    const a=lab.step(),b=replay.step();assert.deepEqual(a.ball,b.ball);assert.deepEqual(a.action,b.action);
    assert.equal(a.officialMatchResult,null);
    if(a.action?.action==='cross'&&!cross){
     assert.equal(a.action.playerId,side+'-10');assert.equal(a.action.recipientId,side+'-9');
     assert.deepEqual(a.starts,[a.action.playerId]);assert.equal(a.action.actualPhysicsImpulseApplied,true);
     assert.equal(a.action.isolatedCrossCalibration.targetZ,1.95);
     cross=a.action;counts.cross++;
    }
    if(cross&&a.ball.position.z>1.55)airborne=true;
    if(airborne&&a.ball.velocity.z<0)descending=true;
    if(a.headerAudit){
     assert.ok(cross&&airborne&&descending);assert.ok(a.headerAudit.tick>cross.tick);
     assert.equal(a.action.playerId,side+'-9');assert.equal(a.starts.length,0);
     assert.deepEqual(a.smallSidedNativeBodyGuard.headBallStarts,[a.action.playerId]);
     assert.equal(a.action.actualPhysicsImpulseApplied,true);header=a.action;counts.header++;counts[header.action]++;break;
    }
   }
   if(!cross||!header)misses.push({side,variantIndex,cross:cross?.tick??null,airborne,descending});
  }finally{lab.dispose();replay.dispose();}
 }
 process.stdout.write('ME_628_HEADER_FROM_CROSS '+JSON.stringify({counts,misses})+'\n');
 assert.deepEqual(misses,[],'all original cross-to-header sequences required');
});

// AERIAL-03: decision evidence, native surface contact and one bounded cushion.
test('AERIAL-03 shared chest and raised foot reject unreachable, ascending and dead-ball contacts',async()=>{
 const R=await initializeRapier(rapier);
 for(const surface of ['chest','foot']){
  const z=surface==='chest'?1.35:0.85,actor={id:'home-10',team:'home',role:'forward',x:0,y:0,vx:0,vy:0};
  const sample={position:{x:0.12,y:0,z:z+0.25},velocity:{x:0,y:0,z:-2}};
  assert.ok(planNativeAerialControl(actor,sample,surface));
  assert.equal(planNativeAerialControl(actor,{...sample,position:{...sample.position,x:10}},surface),null);
  assert.equal(planNativeAerialControl(actor,{...sample,velocity:{...sample.velocity,z:2}},surface),null);
  const cushion=planNativeAerialCushion({surface,incoming:sample.velocity,velocity:{x:3,y:0,z:-2},massKg:0.43,actor});
  assert.ok(cushion);assert.ok(Math.hypot(...Object.values(cushion.impulseNs))<=5+1e-8);assert.equal(cushion.officialPossession,false);
  assert.equal(planNativeAerialCushion({surface,incoming:{x:0,y:0,z:2},velocity:{x:3,y:0,z:-2},massKg:0.43,actor}),null);
 }
});
test('AERIAL-08C slow descending foot reach adapts height within the original 3D extension budget',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,actor={id:side+'-10',team:side,role:'forward',x:0,y:0,vx:dir*2.55,vy:0};
  const ball={position:{x:dir*0.546,y:0,z:1.193},velocity:{x:dir*2.898,y:0,z:-1.463}};
  const plan=planNativeAerialControl(actor,ball,'foot');
  assert.ok(plan);assert.ok(plan.targetZ>0.92&&plan.targetZ<=0.97+1e-8);
  assert.ok(Math.hypot(plan.dx,plan.dy,plan.targetZ-0.85)<=0.62+1e-8);
  assert.ok(dir*plan.dx>0);
  // Same instantaneous ball position but a fast delivery and similarly
  // moving receiver: retain the normal raised-foot contact height.
  const fast=planNativeAerialControl({...actor,vx:dir*12},{...ball,velocity:{x:dir*12,y:0,z:-1.463}},'foot');
  assert.ok(fast);assert.equal(fast.targetZ,0.85);
  assert.equal(planNativeAerialControl(actor,{...ball,velocity:{...ball.velocity,z:1}},'foot'),null);
 }
});
test('AERIAL-03 LABs use actual mirrored cross/chest and descending foot contacts, no granted possession',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const id of ['chest-control','aerial-foot-control'])for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,id,{shotSide:side,variantIndex});
  try{
   if(id==='aerial-foot-control'){
    const setup=smallSidedSetup(id,side,INITIAL_PLAYERS,{variantIndex});
    const dir=side==='home'?1:-1;
    assert.ok(Math.hypot(dir*52.5-setup.ball.x,setup.ball.y)>30,'isolated reception starts outside shooting range');
   }
   let hit=null;
   const trace={reachTicks:0,solverStarts:0,ambiguousStarts:0,exclusiveWithoutImpulse:0,firstStart:null,closestPlanned:null,closestDescending:null,firstCompetingContact:null};
   for(let tick=1;tick<=300;tick++){
    const a=lab.step(),body=a.smallSidedNativeBodyGuard;
    const actorId=side+(id==='chest-control'?'-9':'-10');
    const sample=body.aerial.find(s=>s.actorId===actorId&&s.surface===(id==='chest-control'?'chest':'foot'));
    if(sample){
     assert.ok(Number.isFinite(sample.centreGapM)&&sample.centreGapM>=0);
     const detail=()=>({tick,gapM:sample.centreGapM,planned:sample.reachPlanned,preBall:sample.incomingPosition,
      incoming:sample.incomingVelocity,surface:sample.surfacePosition,ball:sample.ballCentre,
      actor:a.observedMovementPlayers.find(p=>p.id===actorId),shoeStarts:a.starts,lowerLegContacts:body.lowerLegBallContacts,
      action:a.action?.action??null});
     if(sample.reachPlanned){
      trace.reachTicks++;
      if(!trace.closestPlanned||sample.centreGapM<trace.closestPlanned.gapM)trace.closestPlanned=detail();
     }
     if(sample.incomingVelocity.z<-0.15&&Math.abs(sample.incomingPosition.z-(id==='chest-control'?1.35:0.85))<=0.4){
      if(!trace.closestDescending||sample.centreGapM<trace.closestDescending.gapM)trace.closestDescending=detail();
      if(!trace.firstCompetingContact&&(a.starts.length||body.lowerLegBallContacts.length))trace.firstCompetingContact=detail();
     }
    }
    if(sample?.contactStarted){
     trace.solverStarts++;
     const ambiguous=body.aerial.filter(s=>s.contact).length!==1||a.starts.length>0||body.lowerLegBallContacts.length>0;
     if(ambiguous)trace.ambiguousStarts++;
     else if(!a.action?.nativeExclusiveAerialControlStart)trace.exclusiveWithoutImpulse++;
     if(!trace.firstStart)trace.firstStart={tick,incoming:sample.incomingVelocity,ball:a.ball.position,velocity:a.ball.velocity,ambiguous,action:a.action?.action??null};
    }
    if(a.aerialControlAudit){
     hit=a.aerialControlAudit;
     assert.equal(hit.surface,id==='chest-control'?'chest':'foot');
     assert.equal(hit.playerId,side+(id==='chest-control'?'-9':'-10'));
     assert.equal(hit.nativeExclusiveAerialControlStart,true);assert.equal(hit.actualNativeSolverContact,true);
     assert.equal(hit.actualPhysicsImpulseApplied,true);assert.equal(hit.officialPossession,false);
     assert.equal(a.collectiveControl.kind,'loose');assert.deepEqual(a.starts,[]);
     assert.ok(Math.hypot(...Object.values(hit.impulseNs))<=5+1e-8);
     if(id==='chest-control')assert.ok(a.headerCrossAudit&&a.headerCrossAudit.tick<hit.tick);
     break;
    }
   }
   rows.push({id,side,variantIndex,tick:hit?.tick??null,...(hit?{}:{trace})});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_AERIAL_CONTROL '+JSON.stringify(rows)+'\\n');
 assert.ok(rows.every(r=>r.tick!==null),JSON.stringify(rows.filter(r=>r.tick===null)));
});

test('AERIAL-04 pursuit and exclusive contact arbitration are independent of team and input order',()=>{
 const players=[{id:'home-10',team:'home',role:'forward',x:-0.7,y:0,vx:0,vy:0},{id:'away-2',team:'away',role:'defender',x:1.2,y:0,vx:0,vy:0}];
 const p={x:0,y:0,z:3.8},v={x:0,y:0,z:-0.4};
 const plans=planNativeAerialContest(players,p,v);
 assert.deepEqual(plans,planNativeAerialContest([...players].reverse(),p,v));
 assert.equal(Object.keys(plans).length,2);
 assert.deepEqual(plans['home-10'].target,plans['away-2'].target);
 const hit=id=>({version:'me-628-native-aerial-head-v1',actorId:id,team:id.split('-')[0],tick:10,contact:true,contactStarted:true,actualNativeSolverContact:true,sameOriginalRapierWorld:true});
 const a=hit('home-10'),b=hit('away-2');
 assert.equal(exclusiveNativeAerialStart([a]),a);
 assert.equal(exclusiveNativeAerialStart([a,b]),null);
 assert.equal(exclusiveNativeAerialStart([a],['away-2'],['away-2']),null);
 assert.equal(exclusiveNativeAerialStart([a],[],[],true),null);
 const close=[players[0],{...players[1],x:0.7}];
 const action={tick:10,playerId:a.actorId,nativeExclusiveHeadStart:true,appliedByRapier:true,actualPhysicsImpulseApplied:true};
 assert.equal(observeNativeAerialDuel({tick:10,evidence:[a],players:close,action}).actorId,a.actorId);
 assert.equal(observeNativeAerialDuel({tick:10,evidence:[a,b],players:close,action}).actorId,null);
 assert.equal(observeNativeAerialDuel({tick:10,evidence:[a],players:close,action:null}).actorId,null);
});
test('AERIAL-04 mirrored native duel variants never award an unobserved winner',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,'aerial-duel',{shotSide:side,variantIndex});
  try{
   assert.equal(lab.snapshot().genuinePhysicalPlayerCount,2);
   assert.deepEqual(new Set(lab.focus),new Set([side+'-10',(side==='home'?'away':'home')+'-2']));
   let observed=null,attempts=new Set();
   for(let tick=1;tick<=120;tick++){
    const frame=lab.step(),body=frame.smallSidedNativeBodyGuard;
    for(const sample of body.aerial)if(sample.jumpStarted)attempts.add(sample.actorId);
    if(frame.action?.nativeExclusiveHeadStart){
     assert.deepEqual(body.headBallStarts,[frame.action.playerId]);
     assert.deepEqual(body.headBallContacts,[frame.action.playerId]);
     assert.deepEqual(frame.starts,[]);
    }
    if(frame.aerialDuelAudit){
     observed=frame.aerialDuelAudit;
     assert.equal(observed.officialPossession,false);
     assert.equal(observed.officialMatchResult,null);
     if(observed.actorId)assert.equal(frame.action.playerId,observed.actorId);
     break;
    }
   }
   rows.push({side,variantIndex,attempts:[...attempts],observed});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_AERIAL_DUEL '+JSON.stringify(rows)+'\\n');
 assert.ok(rows.some(r=>r.observed?.kind==='exclusive-header'&&r.observed.team==='home'));
 assert.ok(rows.some(r=>r.observed?.kind==='exclusive-header'&&r.observed.team==='away'));
});

test('AERIAL-05 long aerial pass recipient uses live forward geometry and safe receiving space',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,actor={id:side+'-10',team:side,role:'forward',x:dir*-20,y:0};
  const receiver={id:side+'-9',team:side,role:'forward',x:dir*17,y:3};
  const ball={x:actor.x,y:0,z:0.11};
  assert.equal(chooseNativeLoftedRecipient(actor,ball,[actor,receiver]).player.id,receiver.id);
  assert.equal(chooseNativeLoftedRecipient(actor,ball,[actor,{...receiver,x:dir*-10}]),null);
  assert.equal(chooseNativeLoftedRecipient(actor,ball,[actor,receiver,{...receiver,id:(side==='home'?'away':'home')+'-2',team:side==='home'?'away':'home',x:receiver.x+0.5}]),null);
 }
});
test('AERIAL-05 physical mirrored long pass journeys launch once from a real shoe, then observe receipt',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,'lofted-pass',{shotSide:side,variantIndex});
  try{
   let audit=null;
   for(let i=0;i<300;i++){
    const frame=lab.step();audit=frame.loftedPassAudit;
    if(frame.action?.passTarget?.deliveryProfile==='lofted'){
     assert.equal(frame.action.action,'pass');assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     assert.deepEqual(frame.starts,[frame.action.playerId]);
     assert.ok(frame.action.impulseNs.z>0);assert.ok(Math.hypot(...Object.values(frame.action.impulseNs))<=12+1e-8);
     assert.ok(frame.action.nativeLoftedPassCalibration.distanceM>=26);
    }
    if(audit?.receiverContact)break;
   }
   rows.push({side,variantIndex,launch:!!audit,peak:audit?.peakZM??0,receipt:!!audit?.receiverContact});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_LOFTED_PASS '+JSON.stringify(rows)+'\\n');
 assert.ok(rows.every(r=>r.launch&&r.peak>2&&r.receipt),JSON.stringify(rows.filter(r=>!r.receipt)));
});

test('AERIAL-06 live volley intent is mirrored and rejects rising, low, distant and blocked balls',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,actor={id:side+'-10',team:side,role:'forward',x:dir*39.7,y:0};
  const ball={x:dir*40,y:0,z:0.85},v={x:0,y:0,z:-3};
  const plan=chooseNativeVolleyIntent(actor,ball,v,[actor]);
  assert.ok(plan);assert.equal(plan.action,'shot');assert.equal(plan.target.x,dir*52.5);assert.ok(dir*plan.desiredVelocity.x>0);
  assert.equal(chooseNativeVolleyIntent(actor,ball,{...v,z:1},[actor]),null);
  assert.equal(chooseNativeVolleyIntent(actor,{...ball,z:0.11},v,[actor]),null);
  assert.equal(chooseNativeVolleyIntent(actor,{...ball,x:0},v,[actor]),null);
  const defender={id:(side==='home'?'away':'home')+'-2',team:side==='home'?'away':'home',role:'defender',x:dir*40.5,y:0};
  assert.equal(chooseNativeVolleyIntent(actor,ball,v,[actor,defender]),null);
 }
});
test('AERIAL-06 mirrored physical volley LAB requires a real cross before exclusive raised foot strike',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,'volley-solo',{shotSide:side,variantIndex});
  try{
   assert.equal(lab.snapshot().genuinePhysicalPlayerCount,2);
   assert.deepEqual(new Set(lab.focus),new Set([side+'-10',side+'-9']));
   const fixture=smallSidedSetup('volley-solo',side,INITIAL_PLAYERS,{variantIndex});
   assert.equal(fixture.ball.z,0);assert.equal(fixture.ball.vz,0);
   let hit=null,cross=null,airborne=false;
   for(let tick=1;tick<=300;tick++){
    const frame=lab.step();
    if(frame.action?.action==='cross'&&!cross){
     cross=frame.action;assert.equal(cross.playerId,side+'-10');assert.equal(cross.recipientId,side+'-9');
     assert.deepEqual(frame.starts,[cross.playerId]);assert.equal(cross.actualPhysicsImpulseApplied,true);
    }
    if(cross&&frame.ball.position.z>1.15)airborne=true;
    if(frame.volleyAudit){
     hit=frame.volleyAudit.launch;
     assert.equal(hit.action,'shot');assert.equal(hit.nativeVolley,true);
     assert.ok(cross&&airborne&&cross.tick<hit.tick);assert.equal(frame.volleyAudit.cross.tick,cross.tick);
     assert.equal(hit.playerId,side+'-9');assert.equal(hit.surface,'foot');assert.ok(hit.incomingVelocity.z<0);
     assert.equal(hit.actualPhysicsImpulseApplied,true);assert.equal(hit.officialPossession,false);
     assert.deepEqual(frame.starts,[]);
     assert.deepEqual(frame.smallSidedNativeBodyGuard.aerialControlStarts,[hit.playerId]);
     assert.ok(Math.hypot(...Object.values(hit.impulseNs))<=12+1e-8);
     assert.ok((side==='home'?1:-1)*hit.after.x>0);
     break;
    }
   }
   rows.push({side,variantIndex,tick:hit?.tick??null});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_VOLLEY '+JSON.stringify(rows)+'\\n');
 assert.ok(rows.every(r=>r.tick!==null),JSON.stringify(rows.filter(r=>r.tick===null)));
});

test('AERIAL-07 high claim prediction is mirrored and rejects unreachable or outside-box balls',()=>{
 for(const team of ['home','away']){
  const dir=team==='home'?1:-1,keeper={id:team+'-1',team,role:'goalkeeper',x:-dir*46,y:0,vx:0,vy:0};
  const ball={position:{x:-dir*45.65,y:0.2,z:3.0},velocity:{x:0,y:0,z:-2}};
  const plan=planNativeKeeperHighClaim(keeper,ball);
  assert.ok(plan);assert.equal(plan.kind,'high-claim');assert.ok(plan.target.z<=NATIVE_HIGH_HAND_MAX_Z+1e-8);
  const early={position:{...ball.position,z:4},velocity:{x:0,y:0,z:-1}};
  const earlyPlan=planNativeKeeperHighClaim(keeper,early);
  assert.ok(earlyPlan);assert.ok(earlyPlan.target.z>2.05);assert.ok(earlyPlan.target.z<=NATIVE_HIGH_HAND_MAX_Z+1e-8);
  const lower=planNativeKeeperHighClaim(keeper,{position:{...ball.position,z:2.3},velocity:{x:0,y:0,z:-0.5}});
  assert.ok(lower);assert.ok(lower.target.z<=2.05+1e-8);
  assert.equal(planNativeKeeperHighClaim(keeper,{...ball,position:{...ball.position,x:0}}),null);
  assert.equal(planNativeKeeperHighClaim(keeper,{...ball,position:{...ball.position,y:21}}),null);
 }
});
test('AERIAL-07 real cross precedes native high-claim attempts and observed hand contacts',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const id of ['keeper-high-cross','keeper-high-intercept'])for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,id,{shotSide:side,variantIndex});
  try{
   const keeper=(side==='home'?'away':'home')+'-1';
   assert.equal(lab.snapshot().genuinePhysicalPlayerCount,3);
   assert.ok(lab.focus.includes(keeper));
   let cross=null,audit=null,handDiagnostic=null,catchAttempt=null,gripFailure=null;
   const flight={peakZM:0,forecastTicks:0,reachTicks:0,actualHighStarts:0,firstForecast:null,firstReach:null};
   for(let tick=1;tick<=300;tick++){
    const frame=lab.step(),k=frame.nativeKeeperStates.find(x=>x.keeperId===keeper);
    if(k.highHandDiagnostic&&!handDiagnostic)handDiagnostic=k.highHandDiagnostic;
    if(k.highHandAction?.kind==='catch-attempt')catchAttempt=k.tick;
    if(catchAttempt!==null&&k.catchState?.released&&k.catchState.confirmedTick===null&&!gripFailure)gripFailure={tick:k.tick,errorM:k.catchState.errorM,relativeSpeedMps:k.catchState.relativeSpeedMps};
    if(frame.action?.action==='cross'&&!cross){cross=frame.action;assert.deepEqual(frame.starts,[cross.playerId]);assert.equal(cross.actualPhysicsImpulseApplied,true);}
    if(cross){
     const actor=frame.observedMovementPlayers.find(p=>p.id===keeper);
     const ball=frame.ball;
     flight.peakZM=Math.max(flight.peakZM,ball.position.z);
     const forecast=planNativeKeeperHighIntercept(actor,ball.position,ball.velocity);
     const reach=planNativeKeeperHighClaim(actor,ball);
     if(forecast){flight.forecastTicks++;if(!flight.firstForecast)flight.firstForecast={tick,point:forecast.point,eta:forecast.eta,actor:{x:actor.x,y:actor.y}};}
     if(reach){flight.reachTicks++;if(!flight.firstReach)flight.firstReach={tick,target:reach.target,eta:reach.eta,actor:{x:actor.x,y:actor.y}};}
     if(k.started&&k.plan?.kind==='high-claim')flight.actualHighStarts++;
    }
    if(frame.highClaimAudit){
     audit=frame.highClaimAudit;assert.ok(cross&&cross.tick<audit.attemptTick);
     if(audit.contactTick===tick){assert.equal(k.contactStarted,true);assert.equal(k.source,'native-rapier-solver-manifold');}
     if(audit.confirmedTick===tick){assert.equal(k.catchState.active,true);assert.equal(k.catchState.confirmedTick,tick);}
     if(audit.punchTick===tick){assert.equal(k.contactStarted,true);assert.equal(k.highHandAction.kind,'punch');assert.equal(k.highHandAction.actualPhysicsImpulseApplied,true);assert.equal(k.highHandAction.officialPossession,false);assert.ok(Math.hypot(...Object.values(k.highHandAction.impulseNs))<=8+1e-8);}
    }
    if(audit?.confirmedTick!=null)break;
   }
   rows.push({id,side,variantIndex,cross:!!cross,attempt:!!audit,contact:audit?.contactTick??null,confirmed:audit?.confirmedTick??null,punch:audit?.punchTick??null,catchAttempt,gripFailure,handDiagnostic,flight});
  }finally{lab.dispose();}
 }
 for(const id of ['keeper-high-cross','keeper-high-intercept'])for(const side of ['home','away'])
 process.stdout.write('ME_628_HIGH_CLAIM '+JSON.stringify(rows.filter(r=>r.id===id&&r.side===side))+'\\n');
 for(const side of ['home','away']){
  const group=rows.filter(r=>r.side===side);
  assert.ok(group.every(r=>r.cross),JSON.stringify(group));
  assert.ok(group.some(r=>r.attempt&&r.contact!==null),JSON.stringify(group));
  const contested=group.filter(r=>r.id==='keeper-high-cross'),intercept=group.filter(r=>r.id==='keeper-high-intercept');
  assert.equal(contested.length,30);assert.equal(intercept.length,30);
  assert.ok(contested.some(r=>r.punch!==null), 'Observed punch must occur in original cross on '+side);
  assert.ok(intercept.some(r=>r.contact!==null&&r.handDiagnostic?.nearestOpponentM>=1.5),'Measured unpressured native hand contact required on '+side);
  assert.ok(intercept.some(r=>r.confirmed!==null&&r.catchAttempt!==null), 'Observed high grip from real interception cross must confirm on '+side);
 }
});

test('AERIAL-07B high hand decision catches reachable unpressured deliveries or punches under pressure; no ambiguous or illegal contact',()=>{
 for(const team of ['home','away']){
  const dir=team==='home'?1:-1,keeper={id:team+'-1',team,role:'goalkeeper',x:-dir*45,y:0,vx:0,vy:0};
  const ballPosition={x:-dir*44.8,y:0,z:2.05},handPosition={...ballPosition};
  const input={keeper,players:[keeper],ballPosition,handPosition,incoming:{x:-dir*12,y:1,z:-5},velocity:{x:-dir*8,y:1,z:-3},handVelocity:{x:0,y:0,z:0},massKg:0.43,contact:true};
  const caught=planNativeHighHandAction(input);
  assert.equal(caught.kind,'catch');assert.ok(Math.hypot(...Object.values(caught.impulseNs))<=6+1e-8);
  const rival={id:(team==='home'?'away':'home')+'-10',team:team==='home'?'away':'home',x:ballPosition.x,y:0.8};
  const punch=planNativeHighHandAction({...input,players:[keeper,rival]});
  assert.equal(punch.kind,'punch');assert.ok(Math.hypot(...Object.values(punch.impulseNs))<=8+1e-8);
  assert.ok(dir*(input.velocity.x+punch.impulseNs.x/input.massKg)>0);
  assert.equal(planNativeHighHandAction({...input,contact:false}),null);
  assert.equal(planNativeHighHandAction({...input,conflict:true}),null);
  assert.equal(planNativeHighHandAction({...input,ballPosition:{...ballPosition,x:0},handPosition:{...handPosition,x:0}}),null);
  const gripEvidence={team,contact:true,ballPosition,before:input.incoming,after:{x:0,y:0,z:0},glovePosition:handPosition,gloveVelocity:input.handVelocity};
  assert.equal(eligibleKeeperGrip(gripEvidence),false);
  assert.equal(eligibleKeeperGrip({...gripEvidence,highClaim:true}),true);
  const highCentre={...ballPosition,z:2.29};
  assert.equal(eligibleKeeperGrip({...gripEvidence,ballPosition:highCentre,highClaim:true}),true);
  const extended={...ballPosition,z:NATIVE_HIGH_HAND_MAX_Z+0.20},extendedHand={...handPosition,z:NATIVE_HIGH_HAND_MAX_Z};
  assert.equal(eligibleKeeperGrip({...gripEvidence,ballPosition:extended,glovePosition:extendedHand,highClaim:true}),true);
  assert.equal(eligibleKeeperGrip({...gripEvidence,ballPosition:{...extended,z:NATIVE_HIGH_HAND_MAX_Z+0.33},glovePosition:extendedHand,highClaim:true}),false);
  assert.equal(planNativeHighHandAction({...input,ballPosition:highCentre}).kind,'catch');
  assert.equal(eligibleKeeperGrip({...gripEvidence,highClaim:true,after:{x:5,y:0,z:0}}),false);
 }
});

test('AERIAL-05B short loft requires middle-lane obstruction; switch selects opposite flank',()=>{
 for(const side of ['home','away']){
  const dir=side==='home'?1:-1,actor={id:side+'-10',team:side,role:'forward',x:dir*-20,y:0};
  const receiver={id:side+'-9',team:side,role:'forward',x:dir*-4,y:0},ball={x:actor.x,y:0,z:0.11};
  const blocker={id:(side==='home'?'away':'home')+'-2',team:side==='home'?'away':'home',x:dir*-12,y:0};
  assert.equal(chooseNativeLoftedRecipient(actor,ball,[actor,receiver]),null);
  assert.equal(chooseNativeLoftedRecipient(actor,ball,[actor,receiver,blocker]).profile,'short');
  assert.equal(chooseNativeLoftedRecipient(actor,ball,[actor,receiver,{...blocker,x:dir*-5}]),null);
  const wide={...actor,y:19},far={...receiver,x:dir*-17,y:-19};
  assert.equal(chooseNativeLoftedRecipient(wide,{...ball,y:19},[wide,far]).profile,'switch');
 }
});
test('AERIAL-05B mirrored short loft and switch require genuine same-world launch and receipt',{timeout:120000},async()=>{
 const R=await initializeRapier(rapier),rows=[];
 for(const [id,profile] of [['lofted-short','short'],['lofted-switch','switch']])for(const side of ['home','away'])for(let variantIndex=0;variantIndex<30;variantIndex++){
  const lab=createControlledActionLab(R,id,{shotSide:side,variantIndex});
  try{
   let audit=null;
   for(let tick=1;tick<=300;tick++){
    const frame=lab.step();audit=frame.loftedPassAudit;
    if(frame.action?.passTarget?.loftedProfile===profile){
     assert.equal(frame.action.action,'pass');assert.equal(frame.action.actualPhysicsImpulseApplied,true);
     assert.deepEqual(frame.starts,[frame.action.playerId]);assert.ok(frame.action.impulseNs.z>0);
     assert.equal(frame.action.nativeLoftedPassCalibration.profile,profile);
    }
    if(audit?.receiverContact)break;
   }
   rows.push({id,side,variantIndex,profile:audit?.launch.passTarget.loftedProfile??null,receipt:!!audit?.receiverContact,peak:audit?.peakZM??0});
  }finally{lab.dispose();}
 }
 process.stdout.write('ME_628_LOFTED_VARIANTS '+JSON.stringify(rows)+'\\n');
 assert.ok(rows.every(r=>r.profile===(r.id==='lofted-short'?'short':'switch')&&r.receipt&&r.peak>2),JSON.stringify(rows.filter(r=>!r.receipt)));
});

test('ME-01-QA U-01C-R1: a real throw-in blocker yields without changing the taker or contact authority',()=>{
 for(const sign of [-1,1])for(const lateral of [-1,1]){
  const taker={id:'home-8',x:sign*10.606741437789038,y:lateral*32.06366156229924,blockedBy:'away-8'};
  const blocker={id:'away-8',x:taker.x,y:taker.y+lateral*0.98,blockedBy:taker.id};
  const base={x:sign*20,y:lateral*16},target=planNativeThrowInClearance(blocker,taker,base);
  assert.ok(Math.abs(target.x-taker.x)>=1.8-1e-9);
  assert.equal(target.y,blocker.y);
  assert.ok(Math.hypot(target.x-taker.x,target.y-taker.y)>0.98);
  assert.deepEqual(planNativeThrowInClearance({...blocker,x:sign*30},taker,base),base);
  assert.deepEqual(planNativeThrowInClearance(taker,taker,base),base);
  const nearEnd={...taker,x:sign*51};
  const endBlocker={...blocker,x:nearEnd.x};
  const endTarget=planNativeThrowInClearance(endBlocker,nearEnd,{x:sign*52,y:base.y});
  assert.ok(Math.abs(endTarget.x)<Math.abs(nearEnd.x));
 }
});

// Synthetic observer inputs test rejection logic, not physical contact claims.
test('ME-01-QA U-02d3: capability gate also protects native control and delivery observers',()=>{
 for(const side of ['home','away']){
  const other=side==='home'?'away':'home',dir=side==='home'?1:-1;
  const a={id:side+'-10',team:side,x:dir*29.6,y:0},b={id:side+'-9',team:side,x:dir*27,y:2},k={id:side+'-1',team:side,role:'goalkeeper',x:0,y:0};
  const players=[a,b,k],ids=players.map(p=>p.id),ball={position:{x:dir*30,y:0,z:.11},velocity:{x:dir,y:0,z:0}};
  const observe=(obs,tick,action=null,extra={})=>obs.observe({tick,players,ball,starts:action?[a.id]:[],active:action?[a.id]:[],action:action?{tick,playerId:a.id,team:side,appliedByRapier:true,actualPhysicsImpulseApplied:true,...action}:null,...extra});
  const make=mask=>createNativeBallControlObserver(ids,[a.id,b.id],mask);
  const onlyPass=make(['pass']);
  assert.equal(observe(onlyPass,1,{action:'carry'}).kind,'loose');
  assert.equal(observe(onlyPass,2,{action:'shot'}).delivery,null);
  assert.equal(observe(onlyPass,3,{action:'pass',recipientId:b.id}).delivery.recipientId,b.id);
  assert.equal(observe(onlyPass,4,{action:'carry'}).delivery,null);
  const onlyCarry=make(['carry']);
  assert.equal(observe(onlyCarry,1,{action:'carry'}).playerId,a.id);
  assert.equal(observe(onlyCarry,2,{action:'shot'}).kind,'loose');
  const head={action:'pass',recipientId:b.id,nativeExclusiveHeadStart:true,actualNativeSolverContact:true};
  const aerial={starts:[],active:[],bodyStarts:[a.id],bodyActive:[a.id],headStarts:[a.id],headActive:[a.id]};
  assert.equal(observe(make(['pass']),1,head,aerial).delivery,null);
  assert.equal(observe(make(['header','header-pass']),1,head,aerial).delivery.recipientId,b.id);
  const volley={action:'shot',surface:'foot',nativeVolley:true,nativeExclusiveAerialControlStart:true,actualNativeSolverContact:true};
  const foot={starts:[],active:[],bodyStarts:[a.id],bodyActive:[a.id],aerialControlStarts:[a.id],aerialControlActive:[a.id]};
  assert.equal(observe(make(['shot']),1,volley,foot).delivery,null);
  assert.equal(observe(make(['volley']),1,volley,foot).delivery.kind,'shot');
  const grip={tick:1,keeperId:k.id,catchState:{active:true,confirmedTick:1}};
  const release={tick:2,keeperId:k.id,catchState:{active:false,released:true},distribution:{tick:2,keeperId:k.id,team:side,kind:'pass',recipientId:b.id,confirmedGripTick:1,nativeGripReleased:true,appliedByRapier:true,actualPhysicsImpulseApplied:true}};
  for(const [mask,hold,pass] of [[[],false,false],[['pass'],false,false],[['save'],true,false],[['save','pass'],true,true]]){
   const obs=make(mask);
   assert.equal(!!observe(obs,1,null,{keeperStates:[grip]}).keeperHold,hold);
   assert.equal(!!observe(obs,2,null,{keeperStates:[release]}).keeperDistribution,pass);
  }
 }
});
test('ME-01-QA U-02d3: observed aerial kind is distinct from ground permission',()=>{
 const head={action:'shot',nativeExclusiveHeadStart:true};
 const volley={action:'shot',nativeExclusiveAerialControlStart:true,nativeVolley:true,surface:'foot'};
 const control={action:'aerial-control',nativeExclusiveAerialControlStart:true,surface:'chest'};
 for(const [action,allowed] of [[head,['header','header-shot']],[volley,['volley']],[control,['aerial-control']],[{action:'shot'},['shot']]]){
  assert.equal(nativeObservedActionAllowed(createNativeFundamentalMask(allowed),action),true);
  assert.equal(nativeObservedActionAllowed([],action),false);
 }
 assert.equal(nativeObservedActionAllowed(['shot'],head),false);
 assert.equal(nativeObservedActionAllowed(['header-shot'],head),false);
 assert.equal(nativeObservedActionAllowed(['shot'],volley),false);
 assert.equal(nativeObservedActionAllowed(['aerial-control'],{action:'aerial-control'}),false);
 assert.equal(nativeObservedActionAllowed(['volley'],{...volley,surface:'chest'}),false);
 assert.equal(nativeObservedActionAllowed(['header','header-shot'],{...head,nativeVolley:true}),false);
 assert.equal(nativeObservedActionAllowed(['shot'],{}),false);
});
