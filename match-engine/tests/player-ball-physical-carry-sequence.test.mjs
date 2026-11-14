// Match Physics C3.1 — consecutive genuine shoe STARTs and measured
// ball paths. Pure vectors below are CONTRACT tests, never Rapier proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';
import {createPhysicalCarryContactSequenceObserver,
 PHYSICAL_CARRY_SEQUENCE_VERSION}
 from '../src/player-ball-physical-carry-sequence.mjs';

const id='season:1:IT-1:N01:IT-1:IT-2';
const actor=name=>Object.freeze({
 engineId:name,team:name.split('-')[0],clubId:name.startsWith('home')?'IT-1':'IT-2',
 temporary:true,playerId:null
});
const raw=(tick,{x=0,started=[],active=[],ended=[],action=null}={})=>({
 physicsTick:tick,
 ballSnapshot:{tick,ball:{position:{x,y:0,z:0.11},
  velocity:{x:0,y:0,z:0}}},
 physicalContactFeed:{physicsTick:tick,fixtureId:id,
  contactSource:'same-step-real-rapier-shoe-ball-collider',
  realFootEventsOnly:true,officialMatchAction:false,
  officialMatchPossession:false,multipleActive:active.length>1,
  started:started.map(actor),active:active.map(actor),ended:ended.map(actor)},
 localAutonomousAction:action
});

test('C3.1 synthetic contact-sequence GEOMETRY only: same shoe, same team, then opponent',()=>{
 const o=createPhysicalCarryContactSequenceObserver(id).observe;
 assert.equal(o(raw(0)).latestPair,null);
 assert.equal(o(raw(1,{started:['home-10'],active:['home-10']})).shoeStartCount,1);
 o(raw(2,{x:0.3,ended:['home-10']}));
 const same=o(raw(3,{x:1,started:['home-10'],active:['home-10']}));
 assert.equal(same.version,PHYSICAL_CARRY_SEQUENCE_VERSION);
 assert.equal(same.sameTeamPairs,1);
 assert.equal(same.samePlayerRecontacts,1);
 assert.equal(same.latestPair.elapsedPhysicsTicks,2);
 assert.equal(same.latestPair.ballNetAttackingDirectionM,1);
 assert.equal(same.latestPair.netBallTravel3DM,1);
 assert.equal(same.latestPair.totalMeasuredBallPath3DM,1);
 assert.equal(same.latestPair.sameTeam,true);
 assert.equal(same.latestPair.samePlayerPhysicalRecontact,true);
 assert.equal(same.latestPair.dribbleConfirmed,null);
 assert.equal(same.carryConfirmed,null);
 assert.equal(same.officialMatchResult,null);
 assert.ok(Object.isFrozen(same.latestPair)&&Object.isFrozen(same));
 o(raw(4,{x:1.2,ended:['home-10']}));
 const opponent=o(raw(5,{x:2,started:['away-9'],active:['away-9']}));
 assert.equal(opponent.sameTeamPairs,1);
 assert.equal(opponent.opponentPairs,1);
 assert.equal(opponent.latestPair.opponentTouch,true);
 assert.equal(opponent.latestPair.ballNetAttackingDirectionM,1);
 assert.equal(opponent.measuredForwardPairs,1);
 assert.equal(opponent.dribbleConfirmed,null);
});

test('C3.1 rejected malformed, off-clock, ambiguous or forged shoe/action vectors',()=>{
 const fresh=()=>createPhysicalCarryContactSequenceObserver(id).observe;
 assert.throws(()=>fresh()(raw(1)),/Consecutive authentic/);
 for(const invalid of [
  {physicalContactFeed:{...raw(0).physicalContactFeed,realFootEventsOnly:false}},
  {ballSnapshot:{tick:0,ball:{position:{x:NaN,y:0,z:0},velocity:{x:0,y:0,z:0}}}},
  {physicalContactFeed:{...raw(0).physicalContactFeed,fixtureId:'other'}},
  {localAutonomousAction:{action:'pass',tick:0}},
  {physicalContactFeed:{...raw(0).physicalContactFeed,
   started:[actor('home-10')],active:[actor('home-10')]}}
 ])assert.throws(()=>fresh()({...raw(0),...invalid}),/Consecutive authentic/);
 const o=fresh();o(raw(0));
 const malformed=raw(1,{started:['home-10'],active:['home-10']});
 assert.throws(()=>o({...malformed,
  physicalContactFeed:{...malformed.physicalContactFeed,
   started:[{...actor('home-10'),team:'away'}]}
 }),/Consecutive authentic/);
 const ok=fresh();ok(raw(0));
 const ambiguous=ok(raw(1,{started:['home-10','away-9'],
  active:['home-10','away-9']}));
 assert.equal(ambiguous.ambiguousStarts,1);
 assert.equal(ambiguous.latestPair,null);
 assert.equal(ambiguous.sameTeamPairs,0);
});

test('C3.1 independent real 11v11 Rapier: successive teammates and true opposition, no invented dribble',async()=>{
 const R=await initializeRapier(rapier);
 const output=[];
 for(const c of [
  {team:'home',country:'IT',x:-4.96,vx:0.3},
  {team:'away',country:'DE',x:4.96,vx:-0.3}
 ]){
  const fixture={
   id:'season:1:'+c.country+'-1:N01:'+c.country+'-1:'+c.country+'-2',
   competitionId:c.country+'-1',marker:'N01',
   day:1,round:1,homeClubId:c.country+'-1',awayClubId:c.country+'-2'
  };
  const scene={preset:'roll',seed:'c3-1-canonical-'+c.team,
   x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0};
  const opt={autonomousActions:true};
  const a=createPhysicalFixtureStepRuntime(R,fixture,scene,opt);
  const independent=createPhysicalFixtureStepRuntime(R,fixture,scene,opt);
  let actualStarts=0,firstSameTeam=null,firstOpponent=null,starts=[];
  try{
   const first=a.snapshot();
   assert.equal(first.physicalCarryContactSequence.shoeStartCount,0);
   assert.equal(first.physicalCarryContactSequence.latestPair,null);
   for(let i=0;i<22;i++){
    assert.equal(first.physicalPlayerPositions[i].engineId,INITIAL_PLAYERS[i].id);
    assert.equal(first.physicalPlayerPositions[i].x,INITIAL_PLAYERS[i].x);
    assert.equal(first.physicalPlayerPositions[i].y,INITIAL_PLAYERS[i].y);
   }
   for(let tick=1;tick<=250;tick++){
    const x=a.step(),y=independent.step();
    const s=x.physicalCarryContactSequence;
    // Adversarial real-contact negative: genuine teammates/opponents touch
    // the same Rapier ball, but with carry opt-in OFF there are no carry
    // windows, no player possession and no invented dribble.
    assert.equal(x.physicalCarryProximity.measuredWindows,0);
    assert.equal(x.physicalCarryProximity.interruptedWindows,0);
    assert.equal(x.physicalCarryProximity.activeMeasurement,null);
    assert.equal(x.physicalCarryProximity.dribbleConfirmed,null);
    assert.deepEqual(s,y.physicalCarryContactSequence,
     'two independent authentic Rapier worlds must yield identical shoe/path audit');
    assert.equal(s.physicsTick,tick);
    assert.equal(x.officialMatchResult,null);
    assert.equal(s.dribbleConfirmed,null);
    assert.equal(s.carryConfirmed,null);
    assert.equal(s.officialMatchPossession,false);
    assert.ok(Math.abs(x.elapsedSeconds-tick*FIXED_DT)<1e-8);
    actualStarts+=x.physicalContactFeed.started.length;
    assert.equal(s.shoeStartCount,actualStarts);
    if(x.physicalContactFeed.started.length){
     const foot=x.physicalContactFeed.started[0];
     starts.push({tick,player:foot.engineId});
     assert.equal(s.latestShoe?.engineId,foot.engineId);
     if(x.localAutonomousAction){
      assert.equal(x.localAutonomousAction.appliedByRapier,true);
      assert.equal(s.latestShoe?.action,x.localAutonomousAction.action);
     }
    }
    const pair=s.latestPair;
    if(pair&&pair.to.physicsTick===tick){
     assert.ok(pair.from.physicsTick<pair.to.physicsTick);
     assert.ok(pair.totalMeasuredBallPath3DM>=pair.netBallTravel3DM-1e-7);
     assert.ok(pair.physicalDisplacementObserved);
     assert.equal(pair.dribbleConfirmed,null);
     if(pair.sameTeam&&!firstSameTeam)firstSameTeam=pair;
     if(pair.opponentTouch&&!firstOpponent)firstOpponent=pair;
    }
   }
   assert.ok(firstSameTeam,'two real '+c.team+' shoes must meet the ball on separate physics ticks');
   assert.equal(firstSameTeam.from.team,c.team);
   assert.equal(firstSameTeam.to.team,c.team);
   assert.notEqual(firstSameTeam.from.engineId,firstSameTeam.to.engineId,
    'teammate relay is NOT same-player dribbling');
   assert.ok(firstOpponent,'a later real opposing shoe must be observed');
   assert.equal(firstOpponent.from.team,c.team);
   assert.notEqual(firstOpponent.to.team,c.team);
   assert.equal(a.snapshot().physicalCarryContactSequence.samePlayerRecontacts,0,
    'do not invent a same-player follow-up when only teammates touched');
   const reset=a.reset();
   try{
    for(let tick=1;tick<=Math.min(firstSameTeam.to.physicsTick+2,170);tick++){
     const frame=reset.step();
     if(tick===firstSameTeam.to.physicsTick)
      assert.deepEqual(frame.physicalCarryContactSequence.latestPair,firstSameTeam);
    }
   }finally{reset.dispose();}
  }finally{a.dispose();independent.dispose();}
  output.push({team:c.team,starts,from:firstSameTeam.from.engineId,
   to:firstSameTeam.to.engineId,pairTick:firstSameTeam.to.physicsTick,
   netAdvanceM:firstSameTeam.ballNetAttackingDirectionM,
   opponentAt:firstOpponent.to.physicsTick});
 }
 console.log('C3_1_ACTUAL_RAPIER_SUCCESSIVE_SHOES_NOT_DRIBBLE',
  JSON.stringify(output));
});

test('C3.2b synthetic END then genuine same-shoe START contract, never a Rapier witness',()=>{
 const carry=(team,tick=1)=>({
  action:'carry',tick,playerId:team+'-10',team,
  physicalTrigger:'same-tick-real-rapier-shoe-start',
  appliedByRapier:true,actualPhysicsImpulseApplied:true,
  officialMatchAction:false,
  carryTarget:{actorId:team+'-10',team,physicsTick:tick,
   shortGroundTouchOnly:true,physicalRecontactObserved:false,
   dribbleConfirmed:null},
  impulseNs:{x:team==='home'?0.42:-0.42,y:0,z:0}
 });
 for(const team of ['home','away']){
  const sign=team==='home'?1:-1,shoe=team+'-10';
  const fresh=()=>createPhysicalCarryContactSequenceObserver(id).observe;
  const o=fresh();
  o(raw(0));
  o(raw(1,{started:[shoe],active:[shoe],action:carry(team)}));
  o(raw(2,{x:sign*0.14,ended:[shoe]}));
  const proof=o(raw(3,{x:sign*0.35,started:[shoe],active:[shoe],
   action:carry(team,3)}));
  assert.equal(proof.verifiedGroundCarryRecontacts,1);
  assert.equal(proof.latestVerifiedGroundCarryRecontact.shoeEndTick,2);
  assert.equal(proof.latestVerifiedGroundCarryRecontact.secondShoeTick,3);
  assert.ok(proof.latestVerifiedGroundCarryRecontact.measuredAttackingProgressM>=0.2);
  assert.equal(proof.latestVerifiedGroundCarryRecontact.dribbleConfirmed,null);
  assert.equal(proof.latestVerifiedGroundCarryRecontact.secondRealBoundedCarryImpulseApplied,true);
  const noEnd=fresh();
  noEnd(raw(0));
  noEnd(raw(1,{started:[shoe],active:[shoe],action:carry(team)}));
  assert.equal(noEnd(raw(2,{x:sign*0.5,
   started:[shoe],active:[shoe]})).verifiedGroundCarryRecontacts,0);
  const wrongFoot=fresh();
  wrongFoot(raw(0));
  wrongFoot(raw(1,{started:[shoe],active:[shoe],action:carry(team)}));
  wrongFoot(raw(2,{x:sign*0.3,ended:[shoe]}));
  assert.equal(wrongFoot(raw(3,{x:sign*0.5,
   started:[team==='home'?'away-9':'home-9'],
   active:[team==='home'?'away-9':'home-9']}))
   .verifiedGroundCarryRecontacts,0);
  const short=fresh();
  short(raw(0));
  short(raw(1,{started:[shoe],active:[shoe],action:carry(team)}));
  short(raw(2,{x:sign*0.04,ended:[shoe]}));
  assert.equal(short(raw(3,{x:sign*0.1,
   started:[shoe],active:[shoe]})).verifiedGroundCarryRecontacts,0);
 }
});

test('C3.1 genuine no-contact Rapier ball cannot create physical carry evidence',async()=>{
 const R=await initializeRapier(rapier);
 const f={id:'season:1:FR-1:N01:FR-1:FR-2',
  competitionId:'FR-1',marker:'N01',day:1,round:1,
  homeClubId:'FR-1',awayClubId:'FR-2'};
 const s={preset:'drop',seed:'c3-1-no-contact',x:0,y:28,z:4,
  vx:0,vy:0,vz:0};
 const run=createPhysicalFixtureStepRuntime(R,f,s,{autonomousActions:true});
 try{
  for(let tick=1;tick<=75;tick++){
   const x=run.step(),c=x.physicalCarryContactSequence;
   assert.equal(c.shoeStartCount,0);
   assert.equal(c.latestPair,null);
   assert.equal(c.sameTeamPairs,0);
   assert.equal(c.dribbleConfirmed,null);
   assert.equal(x.officialMatchResult,null);
  }
 }finally{run.dispose();}
});
