// C2.3e exploratory physical baseline: natural 22-player progression only.
// A ball drop is allowed; NO player initialization override, injected shoe,
// scripted action, score, or out-of-play result. Witnesses require Rapier.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier,FIXED_DT} from '../src/core.mjs';
import {INITIAL_PLAYERS,PLAYER_PITCH} from '../src/player-movement.mjs';
import {SHOT_MAX_RANGE_M,SHOT_HALF_GOAL_AIM_Y_M}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {createPhysicalFixtureStepRuntime}
 from '../src/physical-fixture-step-runtime.mjs';

const cases=Object.freeze([
 {team:'home',country:'IT',x:-4.96,vx:0.3,ticks:480},
 {team:'away',country:'DE',x:4.96,vx:-0.3,ticks:480},
 {team:'home',country:'ES',x:19.96,vx:0.3,ticks:480},
 {team:'away',country:'FR',x:-19.96,vx:-0.3,ticks:480}
]);
const fixture=country=>Object.freeze({
 id:'season:1:'+country+'-1:N01:'+country+'-1:'+country+'-2',
 competitionId:country+'-1',marker:'N01',day:1,round:1,
 homeClubId:country+'-1',awayClubId:country+'-2'
});
const scene=c=>Object.freeze({
 preset:'roll',seed:'c2-3e-natural-physical-'+c.team+'-'+c.country,
 x:c.x,y:0,z:0,vx:c.vx,vy:0,vz:0
});

// C2.3h: POST-step geometry audit only. Never invokes the action policy,
// guesses a same-tick pre-impulse decision, nor produces a football result.
const shotGeometryAtMeasuredFrame=(frame,team)=>{
 const attack=team==='home'?1:-1;
 const ball=frame.ball.position;
 const goalX=attack*PLAYER_PITCH.lengthM/2;
 const distanceToGoalM=PLAYER_PITCH.lengthM/2-attack*ball.x;
 const requiredAdvanceM=Math.max(0,distanceToGoalM-SHOT_MAX_RANGE_M);
 const rangeNow=distanceToGoalM<=SHOT_MAX_RANGE_M&&
  distanceToGoalM>0&&Math.abs(ball.y)<=20;
 const actors=frame.physicalPlayerPositions.map((p,i)=>({
  ...p,id:INITIAL_PLAYERS[i].id,team:INITIAL_PLAYERS[i].team,
  role:INITIAL_PLAYERS[i].role
 }));
 const members=actors.filter(p=>p.team===team&&p.role!=='goalkeeper');
 const rivals=actors.filter(p=>p.team!==team);
 const nearest=members.map(p=>({
  id:p.id,gapM:Math.hypot(p.x-ball.x,p.y-ball.y)
 })).sort((a,b)=>a.gapM-b.gapM||
  INITIAL_PLAYERS.findIndex(x=>x.id===a.id)-
  INITIAL_PLAYERS.findIndex(x=>x.id===b.id))[0];
 const laneClearances=[0,-SHOT_HALF_GOAL_AIM_Y_M,
  SHOT_HALF_GOAL_AIM_Y_M].map(targetY=>{
  const dx=goalX-ball.x,dy=targetY-ball.y,den=dx*dx+dy*dy;
  return Object.freeze({targetY,minRivalGapM:den<=1e-8?0:
   Math.min(...rivals.map(p=>{
    const t=Math.max(0,Math.min(1,
     ((p.x-ball.x)*dx+(p.y-ball.y)*dy)/den));
    return Math.hypot(p.x-(ball.x+t*dx),p.y-(ball.y+t*dy));
   }))});
 });
 const firstOpenLane=laneClearances.find(l=>l.minRivalGapM>=2.4)??null;
 return Object.freeze({
  team,physicsTick:frame.physicsTick,
  distanceToGoalM,requiredAdvanceM,rangeNow,
  nearestOutfielder:nearest,
  centreLaneGapM:laneClearances[0].minRivalGapM,
  bestLaneGapM:Math.max(...laneClearances.map(x=>x.minRivalGapM)),
  firstOpenLaneY:firstOpenLane?.targetY??null,
  laneThresholdM:2.4,
  ballY:ball.y,
  postStepGeometryOnly:true,physicalShoeStartNotImplied:true,
  eligibleShotNotClaimed:true,officialMatchResult:null
 });
};
const rounded=n=>Number(n.toFixed(3));

test('C2.3e natural formation 60Hz research scan rejects fake shots and exposes real progression',async()=>{
 const R=await initializeRapier(rapier),results=[];
 for(const c of cases){
  const run=createPhysicalFixtureStepRuntime(R,fixture(c.country),scene(c),
   {autonomousActions:true});
  const summary={team:c.team,country:c.country,seedX:c.x,
   contacts:0,actions:[],firstPass:null,shotWindowFrames:0,
   ballAttackingThirdFrames:0,minAttackRunnerGapM:null,
   firstApproachTick:null,firstGenuineShot:null,samples:[]};
  const forward=c.team==='home'?1:-1;
  try{
   const first=run.snapshot();
   assert.equal(first.localAutonomousAction,null);
   assert.equal(first.physicsTick,0);
   for(let i=0;i<22;i++){
    assert.equal(first.physicalPlayerPositions[i].engineId,
     INITIAL_PLAYERS[i].id);
    assert.equal(first.physicalPlayerPositions[i].x,
     INITIAL_PLAYERS[i].x);
    assert.equal(first.physicalPlayerPositions[i].y,
     INITIAL_PLAYERS[i].y);
   }
   for(let tick=1;tick<=c.ticks;tick++){
    const f=run.step(),ball=f.ball.position;
    assert.equal(f.physicsTick,tick);
    assert.ok(Math.abs(f.elapsedSeconds-tick*FIXED_DT)<1e-8);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.productionScoringConnected,false);
    assert.equal(f.officialGoalEvidence,false);
    assert.equal(f.physicalBallVolumeBoundary.goalScored,null);
    assert.equal(f.physicalShotBoundary.goalScored,null);
    summary.contacts+=f.physicalContactFeed.started.length;
    if(forward*ball.x>=17.5&&Math.abs(ball.y)<=20)
     summary.ballAttackingThirdFrames++;
    const a=f.localAutonomousAction;
    if(a){
     assert.equal(a.appliedByRapier,true);
     assert.equal(a.actualPhysicsImpulseApplied,true);
     assert.equal(a.physicalTrigger,'same-tick-real-rapier-shoe-start');
     assert.equal(a.officialMatchAction,false);
     assert.equal(a.tick,tick);
     assert.equal(f.physicalContactFeed.started.length,1);
     assert.equal(f.physicalContactFeed.active.length,1);
     assert.equal(f.physicalContactFeed.started[0].engineId,a.playerId);
     assert.equal(f.physicalContactFeed.active[0].engineId,a.playerId);
     if(summary.actions.length<20)summary.actions.push({
      tick,team:a.team,player:a.playerId,kind:a.action,
      ballX:Number(ball.x.toFixed(2)),ballY:Number(ball.y.toFixed(2)),
      intentY:a.shotTarget?.targetY??null
     });
     if(!summary.firstPass&&a.team===c.team&&a.action==='pass')
      summary.firstPass=tick;
     if(!summary.firstGenuineShot&&a.team===c.team&&a.action==='shot'){
      assert.equal(f.physicalShotBoundary.active?.shotTick,tick);
      assert.equal(f.physicalShotBoundary.active?.team,c.team);
      summary.firstGenuineShot={tick,player:a.playerId,
       ballX:ball.x,ballY:ball.y,targetY:a.shotTarget.targetY};
     }
    }
    const support=f.contactDecisionObservation.attackSupportRun;
    if(support&&support.team===c.team){
     assert.equal(support.physicalShoeStartObserved,false);
     assert.equal(support.shotExecuted,false);
     assert.equal(support.officialMatchResult,null);
     const p=f.physicalPlayerPositions.find(x=>x.engineId===support.playerId);
     const gap=Math.hypot(p.x-ball.x,p.y-ball.y);
     if(summary.minAttackRunnerGapM===null||
        gap<summary.minAttackRunnerGapM)
      summary.minAttackRunnerGapM=gap;
     if(support.possibleShotWindow){
      summary.shotWindowFrames++;
      if(summary.firstApproachTick===null)summary.firstApproachTick=tick;
     }
    }
    if(tick%120===0)summary.samples.push({
     tick,x:Number(ball.x.toFixed(2)),
     y:Number(ball.y.toFixed(2)),
     speed:Number(Math.hypot(f.ball.velocity.x,f.ball.velocity.y).toFixed(2)),
     supporting:support?.phase??null
    });
   }
   assert.ok(summary.contacts>0,'real fixture must feature physical contact');
   const again=run.reset();
   try{
    for(let tick=1;tick<=60;tick++){
     const f=again.step();
     assert.equal(f.officialMatchResult,null);
     if(tick===1&&summary.firstPass===1)
      assert.equal(f.localAutonomousAction?.action,'pass');
    }
   }finally{again.dispose();}
  }finally{run.dispose();}
  if(summary.minAttackRunnerGapM!==null)
   summary.minAttackRunnerGapM=Number(summary.minAttackRunnerGapM.toFixed(2));
  results.push(summary);
 }
 console.log('C2_3E_NATURAL_REAL_RAPIER_PROGRESSION',JSON.stringify(results));
 // Physical shot acceptance belongs to C2.3, not to this diagnostic scan.
 // A zero-shot sample must be reported honestly rather than mocked.
 for(const r of results){
  assert.equal(typeof r.contacts,'number');
  assert.ok(r.samples.length===4);
 }
});

test('C2.3f/g natural 22-player real PASS/carry-to-shot extended 720-tick replay',async()=>{
 const R=await initializeRapier(rapier);
 const observations=[];
 // Exactly the two previously measured C2.3e midfield kickoffs:
 // no player repositioning, researchShotAttacker, injected contact,
 // scripted kick, ball attachment or production result.
 for(const c of cases.slice(0,2)){
  const fxt=fixture(c.country),ballScene=scene(c);
  const settings={autonomousActions:true,autonomousCarry:true};
  const a=createPhysicalFixtureStepRuntime(R,fxt,ballScene,settings);
  const b=createPhysicalFixtureStepRuntime(R,fxt,ballScene,settings);
  const start=a.snapshot(),forward=c.team==='home'?1:-1;
  const trial={team:c.team,country:c.country,
   startBallX:c.x,firstPassTick:null,carryTouches:0,
   carryActorIds:[],opponentShoeStarts:0,
   genuineShots:[],maxBallAdvanceM:0,
   finalBall:null,checkpoint480:null,postPassSupportFrames:0,
   attackingShotRangeFrames:0,physicalContacts:0,
   physicalCarryWindows:0,finalTick:0,
   eligibilityAudit:{
    closestToShotRangeM:null,closestToShotRangeTick:null,
    minAttackerBallGapM:null,openLaneFrames:0,
    inShotRangeFrames:0,within5mOfRangeFrames:0,
    genuineShoeStartsByTeam:{home:0,away:0},
    policyShoesSelectedForShot:0,lastRealShoeEvents:[],
    checkpoints:[],finalGeometry:null,
    raceWindow:{fromTick:680,toTick:704,frames:[]},
    // C2.3j: fixed genuine tick checkpoints, never projected tactics.
    dutyAudit:{checkTicks:[520,530,532,533,546,567,600,640,680,
     690,693,694,695,700,720],checkpoints:[],sameTeamSupportFrames:0,
     sameTeamSupportLatestSourcePassTick:null}
   }};
  try{
   assert.deepEqual(start,b.snapshot());
   assert.equal(start.physicsTick,0);
   assert.equal(start.localAutonomousAction,null);
   for(let i=0;i<INITIAL_PLAYERS.length;i++){
    assert.equal(start.physicalPlayerPositions[i].engineId,
     INITIAL_PLAYERS[i].id);
    assert.equal(start.physicalPlayerPositions[i].x,INITIAL_PLAYERS[i].x);
    assert.equal(start.physicalPlayerPositions[i].y,INITIAL_PLAYERS[i].y);
   }
   const extendedTicks=720;
   for(let tick=1;tick<=extendedTicks;tick++){
    const actual=a.step(),replay=b.step();
    assert.deepEqual(actual,replay,
     'C2.3f independent actual 60Hz canonical Rapier world tick '+tick);
    assert.equal(actual.physicsTick,tick);
    assert.equal(actual.officialMatchResult,null);
    assert.equal(actual.officialMatchPossession,false);
    assert.equal(actual.productionScoringConnected,false);
    assert.equal(actual.physicalShotBoundary.goalScored,null);
    assert.equal(actual.physicalBallVolumeBoundary.goalScored,null);
    const live=actual.ball.position,act=actual.localAutonomousAction;
    assert.ok([live.x,live.y,live.z].every(Number.isFinite));
    trial.physicalContacts+=actual.physicalContactFeed.started.length;
    trial.maxBallAdvanceM=Math.max(trial.maxBallAdvanceM,
     forward*(live.x-c.x));
    const geom=shotGeometryAtMeasuredFrame(actual,c.team);
    const audit=trial.eligibilityAudit;
    // C2.3j: read the actual autonomous duty at precise previous
    // 60Hz source-physics ticks; no AI role or intent is injected.
    const dutyAudit=audit.dutyAudit;
    const realDuties=actual.contactDecisionObservation.duties;
    assert.equal(realDuties.length,22,
     'C2.3j must use all original 22 closed real movement duties');
    const liveSupport=actual.contactDecisionObservation.attackSupportRun;
    if(liveSupport?.team===c.team){
     dutyAudit.sameTeamSupportFrames++;
     dutyAudit.sameTeamSupportLatestSourcePassTick=
      liveSupport.sourcePassTick;
    }
    if(dutyAudit.checkTicks.includes(tick)){
     const opponent=c.team==='home'?'away':'home';
     const ids=[c.team+'-9',c.team+'-10',opponent+'-7'];
     const focus=ids.map(id=>{
      const body=actual.physicalPlayerPositions.find(x=>x.engineId===id);
      const duty=realDuties.find(x=>x.engineId===id);
      assert.ok(body&&duty,'C2.3j actual physics + canonical duty required');
      assert.ok(INITIAL_PLAYERS.some(x=>x.id===id&&x.team===duty.team),
       'C2.3j rejects fabricated actor/duty team');
      return Object.freeze({
       id,team:duty.team,role:duty.tacticalRole,
       movementDuty:duty.movementDuty,
       x:rounded(body.x),y:rounded(body.y),
       bodyBallGapM:rounded(Math.hypot(body.x-live.x,body.y-live.y))
      });
     });
     const support=liveSupport?Object.freeze({
      team:liveSupport.team,playerId:liveSupport.playerId,
      sourcePassTick:liveSupport.sourcePassTick,
      ageTicks:tick-liveSupport.sourcePassTick,
      phase:liveSupport.phase,
      target:Object.freeze({x:rounded(liveSupport.target.x),
       y:rounded(liveSupport.target.y)}),
      liveBallGapM:rounded(liveSupport.liveBallGapM),
      physicalShoeStartObserved:false,shotExecuted:false
     }):null;
     if(support){
      assert.ok(support.sourcePassTick<tick&&support.ageTicks<=240);
      assert.ok(realDuties.some(d=>d.engineId===support.playerId&&
       d.movementDuty==='attack-support-intent'&&d.team===support.team));
     }
     dutyAudit.checkpoints.push(Object.freeze({
      tick,ballX:rounded(live.x),ballY:rounded(live.y),
      shotZoneShortfallM:rounded(geom.requiredAdvanceM),
      focus:Object.freeze(focus),
      support,realShoeStarts:Object.freeze(
       actual.physicalContactFeed.started.map(x=>x.engineId)),
      realAction:act?Object.freeze({id:act.playerId,kind:act.action}):null,
      actualMovementDutyOnly:true,tacticalSuccessNotInferred:true,
      officialMatchResult:null
     }));
    }
    // C2.3i: observe real-source player / defender race for 25 ticks.
    // Post-step body gaps are NOT physical shoe contacts or shot eligibility.
    if(tick>=audit.raceWindow.fromTick&&tick<=audit.raceWindow.toTick){
     const bodies=actual.physicalPlayerPositions.map(p=>{
      const identity=INITIAL_PLAYERS.find(x=>x.id===p.engineId);
      assert.ok(identity,'real mover body must have canonical ID');
      return {id:p.engineId,team:identity.team,role:identity.role,
       gapM:Math.hypot(p.x-live.x,p.y-live.y)};
     });
     const nearest=team=>bodies.filter(p=>p.team===team&&
      p.role!=='goalkeeper').sort((p,q)=>p.gapM-q.gapM||
       INITIAL_PLAYERS.findIndex(x=>x.id===p.id)-
       INITIAL_PLAYERS.findIndex(x=>x.id===q.id))[0];
     const defenderTeam=c.team==='home'?'away':'home';
     const starts=actual.physicalContactFeed.started.map(s=>{
      assert.ok(actual.physicalContactFeed.active.some(x=>
       x.engineId===s.engineId&&x.team===s.team),
       'source shoe START must be genuinely active');
      return Object.freeze({id:s.engineId,team:s.team,
       action:act?.playerId===s.engineId?act.action:null});
     });
     audit.raceWindow.frames.push(Object.freeze({
      tick,ballX:rounded(live.x),ballY:rounded(live.y),
      ballVx:rounded(actual.ball.velocity.x),
      distanceToShotZoneM:rounded(geom.requiredAdvanceM),
      insideShotZone:geom.rangeNow,
      postStepOpenGoalLane:geom.firstOpenLaneY!==null,
      bestPostStepLaneGapM:rounded(geom.bestLaneGapM),
      attacker:Object.freeze({id:nearest(c.team).id,
       bodyBallGapM:rounded(nearest(c.team).gapM)}),
      defender:Object.freeze({id:nearest(defenderTeam).id,
       bodyBallGapM:rounded(nearest(defenderTeam).gapM)}),
      authenticShoeStarts:Object.freeze(starts),
      realAction:act?Object.freeze({id:act.playerId,
       team:act.team,kind:act.action}):null,
      geometryIsPostStepOnly:true,shotEligibilityNotClaimed:true,
      officialMatchResult:null
     }));
    }
    if(audit.closestToShotRangeM===null||
       geom.requiredAdvanceM<audit.closestToShotRangeM){
     audit.closestToShotRangeM=geom.requiredAdvanceM;
     audit.closestToShotRangeTick=tick;
    }
    const gap=geom.nearestOutfielder.gapM;
    if(audit.minAttackerBallGapM===null||gap<audit.minAttackerBallGapM)
     audit.minAttackerBallGapM=gap;
    if(geom.firstOpenLaneY!==null)audit.openLaneFrames++;
    if(geom.rangeNow)audit.inShotRangeFrames++;
    if(geom.requiredAdvanceM<=5&&Math.abs(live.y)<=20)
     audit.within5mOfRangeFrames++;
    if(tick===480||tick===600||tick===720)
     audit.checkpoints.push(Object.freeze({
      tick,ballX:rounded(live.x),ballY:rounded(live.y),
      distanceFromShotRangeM:rounded(geom.requiredAdvanceM),
      nearestAttacker:geom.nearestOutfielder.id,
      attackerBallGapM:rounded(gap),
      firstOpenLaneY:geom.firstOpenLaneY,
      bestLaneClearanceM:rounded(geom.bestLaneGapM),
      rangeNow:geom.rangeNow
     }));
    for(const shoe of actual.physicalContactFeed.started){
     assert.ok(actual.physicalContactFeed.active.some(p=>
      p.engineId===shoe.engineId&&p.team===shoe.team),
      'forensic actual shoe START must also be physically ACTIVE');
     const owner=shoe.team;
     audit.genuineShoeStartsByTeam[owner]++;
     const shoeGeometry=owner===c.team?geom:
      shotGeometryAtMeasuredFrame(actual,owner);
     audit.lastRealShoeEvents.push(Object.freeze({
      tick,engineId:shoe.engineId,team:owner,
      ballX:rounded(live.x),ballY:rounded(live.y),
      requiredAdvanceToShotM:rounded(shoeGeometry.requiredAdvanceM),
      firstOpenLaneY:shoeGeometry.firstOpenLaneY,
      nearestOwnerOutfielder:shoeGeometry.nearestOutfielder.id,
      ownerBallGapM:rounded(shoeGeometry.nearestOutfielder.gapM),
      actionSelected:act?.playerId===shoe.engineId?act.action:null,
      postStepGeometryOnly:true
     }));
     if(audit.lastRealShoeEvents.length>12)
      audit.lastRealShoeEvents.shift();
    }
    if(act?.action==='shot')audit.policyShoesSelectedForShot++;
    if(forward*live.x>=17.5&&Math.abs(live.y)<=20)
     trial.attackingShotRangeFrames++;
    const support=actual.contactDecisionObservation.attackSupportRun;
    if(support?.team===c.team){
     assert.equal(support.physicalShoeStartObserved,false);
     assert.equal(support.shotExecuted,false);
     assert.equal(support.footballActionExecuted,false);
     if(trial.firstPassTick!==null)trial.postPassSupportFrames++;
    }
    if(tick===480)trial.checkpoint480=Object.freeze({
     ballX:Number(live.x.toFixed(3)),ballY:Number(live.y.toFixed(3)),
     maxBallAdvanceM:Number(trial.maxBallAdvanceM.toFixed(3)),
     carryTouches:trial.carryTouches,
     genuineShots:trial.genuineShots.length
    });
    if(!act)continue;
    // No physics from intention: every action requires a UNIQUE real
    // same-tick shoe START+ACTIVE and a bounded Rapier impulse.
    assert.equal(actual.physicalContactFeed.started.length,1);
    assert.equal(actual.physicalContactFeed.active.length,1);
    assert.equal(actual.physicalContactFeed.started[0].engineId,act.playerId);
    assert.equal(actual.physicalContactFeed.active[0].engineId,act.playerId);
    assert.equal(act.physicalTrigger,'same-tick-real-rapier-shoe-start');
    assert.equal(act.actualPhysicsImpulseApplied,true);
    assert.equal(act.appliedByRapier,true);
    assert.equal(act.officialMatchAction,false);
    assert.equal(act.tick,tick);
    if(act.team===c.team&&act.action==='pass'&&
       trial.firstPassTick===null)trial.firstPassTick=tick;
    if(act.team!==c.team)trial.opponentShoeStarts++;
    if(act.action==='carry'){
     trial.carryTouches++;
     if(!trial.carryActorIds.includes(act.playerId))
      trial.carryActorIds.push(act.playerId);
     assert.equal(act.carryTarget?.actorId,act.playerId);
     assert.equal(act.carryTarget?.physicalRecontactObserved,false);
     assert.equal(act.carryTarget?.dribbleConfirmed,null);
     assert.ok(Math.abs(Math.hypot(act.impulseNs.x,act.impulseNs.y,
      act.impulseNs.z)-0.42)<1e-6);
    }
    if(act.action==='shot'){
     assert.equal(actual.physicalShotBoundary.active?.shotTick,tick);
     assert.equal(actual.physicalShotBoundary.active?.shooterId,
      act.playerId);
     assert.equal(actual.physicalShotBoundary.active?.goalScored,null);
     assert.equal(act.shotTarget?.shooterId,act.playerId);
     trial.genuineShots.push({
      tick,team:act.team,playerId:act.playerId,
      ballX:Number(live.x.toFixed(3)),
      ballY:Number(live.y.toFixed(3)),
      goalLaneClearanceM:Number(act.shotTarget.laneClearanceM.toFixed(3))
     });
    }
   }
   trial.finalTick=extendedTicks;
   const finalAudit=shotGeometryAtMeasuredFrame(a.snapshot(),c.team);
   trial.eligibilityAudit.finalGeometry=Object.freeze({
    distanceToShotRangeM:rounded(finalAudit.requiredAdvanceM),
    nearestAttacker:finalAudit.nearestOutfielder.id,
    attackerBallGapM:rounded(finalAudit.nearestOutfielder.gapM),
    laneClearanceM:rounded(finalAudit.bestLaneGapM),
    firstOpenLaneY:finalAudit.firstOpenLaneY,
    postStepGeometryOnly:true
   });
   trial.eligibilityAudit.closestToShotRangeM=
    rounded(trial.eligibilityAudit.closestToShotRangeM);
   trial.eligibilityAudit.minAttackerBallGapM=
    rounded(trial.eligibilityAudit.minAttackerBallGapM);
   assert.equal(trial.eligibilityAudit.checkpoints.length,3);
   const duty=trial.eligibilityAudit.dutyAudit;
   assert.deepEqual(duty.checkpoints.map(x=>x.tick),duty.checkTicks);
   assert.ok(duty.checkpoints.every(x=>x.focus.length===3&&
    x.actualMovementDutyOnly&&x.tacticalSuccessNotInferred&&
    x.officialMatchResult===null));
   const race=trial.eligibilityAudit.raceWindow;
   assert.deepEqual(race.frames.map(x=>x.tick),
    Array.from({length:25},(_,i)=>i+680));
   assert.ok(race.frames.every(x=>x.geometryIsPostStepOnly&&
    x.shotEligibilityNotClaimed&&x.officialMatchResult===null));
   if(c.team==='away'){
    const t694=race.frames.find(x=>x.tick===694);
    assert.ok(t694.authenticShoeStarts.some(s=>s.id==='home-7'&&
     s.team==='home'&&s.action==='pass'),
     'AWAY natural race must conserve the authentic HOME-7 pass');
    assert.equal(t694.insideShotZone,false);
   }
   assert.equal(trial.eligibilityAudit.genuineShoeStartsByTeam.home+
    trial.eligibilityAudit.genuineShoeStartsByTeam.away,
    trial.physicalContacts,
    'all real shoe START events must remain conserved');
   assert.equal(trial.eligibilityAudit.policyShoesSelectedForShot,
    trial.genuineShots.length,
    'observed genuine policy shots never inferred from open lanes');
   trial.finalBall={x:Number(a.snapshot().ball.position.x.toFixed(3)),
    y:Number(a.snapshot().ball.position.y.toFixed(3))};
   trial.physicalCarryWindows=a.snapshot().physicalCarryProximity.measuredWindows;
   assert.ok(trial.physicalContacts>0,
    'natural 22-player formation must produce real shoe contacts');
   assert.ok(trial.firstPassTick!==null,
    'natural midfield source passes must still be genuine and same-team');
   assert.ok(trial.maxBallAdvanceM>=0);
   // The real subsequent Rapier 3D ball, not merely movement support,
   // decides whether shot and C2.3 positive acceptance are available.
   observations.push(trial);
  }finally{a.dispose();b.dispose();}
 }
 console.log('C2_3F_NATURAL_RAPIER_PASS_CARRY_SHOT_AUDIT',
  JSON.stringify(observations));
 assert.equal(observations.length,2);
 assert.ok(observations.every(x=>x.finalTick===720&&
  x.checkpoint480!==null),
  'C2.3g retains and validates the 480-tick baseline checkpoint');
 console.log('C2_3J_NATURAL_ROLE_DUTY_SUPPORT_EXPIRY',
  JSON.stringify(observations.map(x=>({
   team:x.team,...x.eligibilityAudit.dutyAudit
  }))));
 console.log('C2_3I_NATURAL_SHOE_ACTOR_DEFENDER_RACE',
  JSON.stringify(observations.map(x=>({
   team:x.team,...x.eligibilityAudit.raceWindow
  }))));
 console.log('C2_3H_NATURAL_SHOE_AND_SHOT_GEOMETRY',
  JSON.stringify(observations.map(x=>({
   team:x.team,
   ...x.eligibilityAudit
  }))));
 console.log('C2_3G_NATURAL_720_TICK_RAPIER_CONTINUATION',
  JSON.stringify(observations.map(x=>({
   team:x.team,at480:x.checkpoint480,
   at720:{ball:x.finalBall,carryTouches:x.carryTouches,
    goalwardMaxM:Number(x.maxBallAdvanceM.toFixed(3)),
    shots:x.genuineShots},
   extraGoalwardAdvanceM:Number((x.maxBallAdvanceM-
    x.checkpoint480.maxBallAdvanceM).toFixed(3))
  }))));
});
