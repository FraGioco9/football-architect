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

test('#628 small-sided catalog replaces only visible elementary exercise UI; archives remain for regression',()=>{
 const ids=SMALL_SIDED_LAB_SCENARIOS.map(s=>s.id);
 assert.deepEqual(ids,['dribble-1v1','keeper-1v1','defender-1v1','overload-2v1',
  'duel-2v2','duel-3v3','carry-solo']);
 assert.deepEqual(SMALL_SIDED_LAB_SCENARIOS.map(s=>s.focus.length),
  [2,2,3,4,5,7,1]);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/lab.mjs',import.meta.url),'utf8');
 for(const id of ids)
  assert.match(html,new RegExp('<option value="'+id+'">'),
   'original research scene stays in hidden regression catalog');
 for(const id of ['carry-solo','keeper-1v1','overload-2v1','duel-3v3'])
  assert.match(ui,new RegExp("'"+id+"'"));
 assert.match(ui,/length!==8/);
 assert.doesNotMatch(ui,/visibleMovement/);
 assert.match(ui,/Player exercises/);
 assert.match(html,/On-field decisions/);
 assert.match(html,/Original|Rapier/i);
 assert.match(html,/<option value="pass">/,'old scenes preserved as internal automated regression');
 for(const side of ['home','away'])for(const s of SMALL_SIDED_LAB_SCENARIOS){
  const scene=smallSidedSetup(s.id,side,INITIAL_PLAYERS);
  assert.ok(Object.isFrozen(scene)&&Object.isFrozen(scene.ball)&&
   Object.isFrozen(scene.staged));
  assert.equal(scene.genuinePhysicalPlayers,s.focus.length);
  assert.equal(scene.activeIds.length,s.focus.length);
  assert.equal(scene.ball.x,side==='home'?30:-30);
  assert.equal(scene.ball.vx,0);
  assert.equal(scene.ball.vy,0);
  assert.equal(scene.ball.vz,0);
  assert.equal(scene.staged.length,22);
  assert.equal(scene.staged.find(p=>p.id===side+'-10').role,'forward');
  assert.equal(scene.activeIds.includes((side==='home'?'away':'home')+'-1'),
    !['dribble-1v1','carry-solo'].includes(s.id));
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
 assert.match(html,/id="me-inline-observation"/);
 assert.match(html,/id="play"/);
 assert.match(html,/id="pause"/);
 assert.match(html,/id="step"/);
 assert.match(html,/id="reset"/);
 assert.ok(js.includes('createControlledActionLab(rapier,id,{shotSide:side,')&&
  js.includes('variantIndex:activeVariantIndex,bodyGuardEnabled:true}'),
  'visible LAB must always use original native physical bodies');
 assert.doesNotMatch(js,/me-inline-bodyguard|activeBodyGuardEnabled/);
 assert.doesNotMatch(html,/id="me-inline-bodyguard"/);
 assert.match(js,/createControlledMovementLab\(rapier,id,\{side\}\)/);
 assert.match(js,/activeScene=\{kind,id\}/);
 assert.match(js,/if\s*\(activeLab\)drawInlinePlayers/);
 assert.match(js,/if\s*\(\(engine\|\|activeLab\) && playing\)/);
 assert.match(js,/byId\('me-inline-side'\)\.addEventListener\('change'/);
 assert.doesNotMatch(js,/byId\(prefix\+'-open'\)\.click\(\)/,
  'A visible scenario MUST NOT launch any hidden modal runner');
 assert.match(css,/me-inline-side-control\[hidden\]/);
 assert.match(browser,/ME_628_INLINE_CHROME/);
 assert.match(browser,/ME_628_INLINE_MAIN_TRANSPORT/);
 assert.match(browser,/assert\.deepEqual\(actionNav,\{open:false/);
 assert.match(browser,/assert\.equal\(hiddenMovement,0/);
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
   for(let tick=1;tick<=180;tick++){
    const f=lab.step();
    assert.deepEqual(f.smallSidedParticipants,[side+'-10']);
    const actor=f.observedMovementPlayers.find(p=>p.id===side+'-10');
    const speed=Math.hypot(actor.vx,actor.vy);
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
   assert.ok(maximumBallSpeed<=3.5+1e-6,
    'Solo original Rapier ball must stay below established D-01 3.5m/s design guard');
   assert.ok(playerSpeedSum/180>=2.35,
    'Solo movement should no longer appear stalled at walking pace');
   process.stdout.write('ME_628_SOLO_CARRY_REAL '+JSON.stringify({
    side,variantIndex,activePhysicalPlayers:1,carries,releaseRecontacts,
    averagePlayerSpeedMps:playerSpeedSum/180,minimumObservedSpeed,
    maxBallSpeedMps:maximumBallSpeed,
    realBallForwardM:lab.snapshot().nativeDribbleAudit.ballForwardDistanceM
   })+'\\n');
  }finally{lab.dispose();}
 }
});
