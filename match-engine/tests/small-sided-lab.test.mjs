// #628 LAB-SMALL-01: real 2–7 selected shoe-collider mini situations.
// Genuine Rapier sample and uniform policy only; no 11v11 match or authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {createEngine,initializeRapier} from '../src/core.mjs';
import {createPlayerMovement,INITIAL_PLAYERS,goalkeeperPosition} from '../src/player-movement.mjs';
import {SMALL_SIDED_LAB_SCENARIOS,smallSidedSetup,SMALL_SIDED_VARIANT_COUNT,
 keeperDuelAttackerTarget,keeperDuelGoalkeeperTarget}
 from '../src/small-sided-lab-scenarios.mjs';
import {createControlledActionLab,projectActiveLabDecisions} from '../src/action-labs.mjs';
import {SOLO_CARRY_PHASES,advanceSoloCarryPhase} from '../src/solo-carry-phases.mjs';

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
 assert.match(ui,/length!==13/);
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
 assert.match(js,/activeScene=\{kind,id,soloCarryLockedPhase\}/);
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
    soloShoeLengthScale:arm.length,
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
    soloSprintCadenceScale:arm.cadence,
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
