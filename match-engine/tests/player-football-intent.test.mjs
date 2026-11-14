// P1 candidate behavior-only decision contract; NO physical match actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FOOTBALL_INTENT_VERSION,FOOTBALL_INTENT_PRIORITIES,
 chooseObservedFootballIntent}
 from '../src/player-football-intent.mjs';
import {projectObservedFootballContext,FOOTBALL_OBSERVATION_PROJECTION_VERSION}
 from '../src/player-football-observation.mjs';
import {measureObservedPassingCorridors,measureObservedPassingCorridorChanges,
 FOOTBALL_CORRIDOR_MEASUREMENT_VERSION}
 from '../src/player-football-corridors.mjs';
import {inspectUniformPolicyGeometry,UNIFORM_POLICY_GEOMETRY_VERSION,
 selectUniformAutonomousContactAction,
 UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS}
 from '../src/player-ball-uniform-autonomous-action.mjs';
import {INITIAL_PLAYERS,PLAYER_VERSION} from '../src/player-movement.mjs';

const players=Object.freeze(['home','away'].flatMap((team,ti)=>
 Array.from({length:11},(_,i)=>Object.freeze({
  id:team+'-'+(i+1),team,x:ti*30+i,y:i-5
 }))));
const base=Object.freeze({
 physicsTick:20,playerId:'home-7',team:'home',phase:'ball-opportunity',
 frame:Object.freeze({tick:20,ball:Object.freeze({x:0,y:0,z:0.11}),
  players}),
 affordances:Object.freeze([])
});
const point=(kind,x,y,available=true,evidenceTick=20)=>
 ({kind,available,evidenceTick,target:{x,y}});
const player=(kind,id,available=true,evidenceTick=20)=>
 ({kind,targetPlayerId:id,available,evidenceTick});
const select=(affordances,phase='ball-opportunity',patch={})=>
 chooseObservedFootballIntent({...base,phase,affordances,...patch});

test('P1 candidate qualitative priorities are explicit, not scored geometry',()=>{
 assert.deepEqual(FOOTBALL_INTENT_PRIORITIES['ball-opportunity'],
  ['shoot','pass','advance','retain','reposition']);
 assert.deepEqual(FOOTBALL_INTENT_PRIORITIES['attack-off-ball'],
  ['support','reposition']);
 assert.deepEqual(FOOTBALL_INTENT_PRIORITIES['defend-off-ball'],
  ['press','cover','recover']);
 assert.equal(FOOTBALL_INTENT_VERSION,'me-p1-observed-intent-draft-v1');
});

test('P1 table-driven football intentions use only declared observed affordances',()=>{
 const cases=[
  {name:'eligible shot',phase:'ball-opportunity',
   options:[player('pass','home-2'),point('shoot',52.5,0)],
   expected:'shoot'},
  {name:'shot unavailable, pass open',phase:'ball-opportunity',
   options:[point('shoot',52.5,0,false),player('pass','home-2')],
   expected:'pass'},
  {name:'shot and pass unavailable, advance open',phase:'ball-opportunity',
   options:[point('shoot',52.5,0,false),
    player('pass','home-2',false),point('advance',8,2)],
   expected:'advance'},
  {name:'crowded ball: choose available retention over reposition',
   phase:'ball-opportunity',options:[
    player('pass','home-2',false),point('advance',8,2,false),
    {kind:'retain',available:true,evidenceTick:20},
    point('reposition',-2,4)],expected:'retain'},
  {name:'retention unavailable: reposition',
   phase:'ball-opportunity',options:[
    {kind:'retain',available:false,evidenceTick:20},
    point('reposition',-2,4)],expected:'reposition'},
  {name:'crowded ball: reposition instead of forcing a touch',
   phase:'ball-opportunity',
   options:[player('pass','home-2',false),
    point('advance',8,2,false),point('reposition',-2,4)],
   expected:'reposition'},
  {name:'no verified opportunity means NO invented act',
   phase:'ball-opportunity',options:[point('shoot',52,0,false)],
   expected:null},
  {name:'teammate support when attack is off-ball',
   phase:'attack-off-ball',
   options:[point('reposition',2,5),point('support',12,7)],
   expected:'support'},
  {name:'unavailable support falls back to reposition',
   phase:'attack-off-ball',
   options:[point('support',12,7,false),point('reposition',-3,7)],
   expected:'reposition'},
  {name:'defender can press real opponent',
   phase:'defend-off-ball',
   options:[point('cover',3,3),player('press','away-3')],
   expected:'press'},
  {name:'no press lane: cover',
   phase:'defend-off-ball',
   options:[player('press','away-3',false),point('cover',3,3)],
   expected:'cover'},
  {name:'fallback to defensive recovery',
   phase:'defend-off-ball',
   options:[player('press','away-3',false),
    point('cover',1,4,false),point('recover',-7,2)],
   expected:'recover'}
 ];
 for(const c of cases){
  const result=select(c.options,c.phase);
  assert.equal(result?.intent??null,c.expected,c.name);
  if(result){
   assert.equal(result.realShoeContactObserved,false,c.name);
   assert.equal(result.physicalActionExecuted,false,c.name);
   assert.equal(result.officialMatchAction,false,c.name);
   assert.equal(result.guaranteedFootballOutcome,false,c.name);
   assert.equal(result.fromDeclaredObservedAffordance,true,c.name);
   assert.equal(result.physicsTick,20,c.name);
   assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.target));
  }
 }
});

test('P1 RETAIN produces no target, physics authority or possession',()=>{
 const v=select([{kind:'retain',available:true,evidenceTick:20}]);
 assert.equal(v.intent,'retain');
 assert.equal(v.target,null);
 assert.equal(v.targetPlayerId,null);
 assert.equal(v.physicalActionExecuted,false);
 assert.equal(v.realShoeContactObserved,false);
 assert.equal(v.guaranteedFootballOutcome,false);
 assert.equal(Object.hasOwn(v,'possession'),false);
 assert.equal(Object.hasOwn(v,'impulseNs'),false);
 assert.equal(select([{kind:'retain',available:false,evidenceTick:20}]),null);
});

test('P1 selected teammate/opponent coordinates are from the observed frame',()=>{
 const pass=select([player('pass','home-2')]);
 const mate=players.find(p=>p.id==='home-2');
 assert.equal(pass.targetPlayerId,mate.id);
 assert.deepEqual(pass.target,{x:mate.x,y:mate.y});
 const press=select([player('press','away-3')],'defend-off-ball');
 const opponent=players.find(p=>p.id==='away-3');
 assert.equal(press.targetPlayerId,opponent.id);
 assert.deepEqual(press.target,{x:opponent.x,y:opponent.y});
});

test('P1 independent order, stable tie-break and unchanged input',()=>{
 const options=[player('pass','home-3'),player('pass','home-2')];
 const original=structuredClone(options);
 const first=select(options);
 const reverse=select(options.toReversed());
 assert.deepEqual(first,reverse);
 assert.equal(first.targetPlayerId,'home-2');
 assert.deepEqual(options,original);
 assert.equal(select([point('support',5,2),
  point('support',5,-2)],'attack-off-ball').target.y,-2);
});

test('P1 genuine different-side context remains symmetric',()=>{
 const away={playerId:'away-7',team:'away'};
 const pass=select([player('pass','away-2')],'ball-opportunity',away);
 assert.equal(pass.team,'away');
 assert.equal(pass.targetPlayerId,'away-2');
 const press=select([player('press','home-5')],'defend-off-ball',away);
 assert.equal(press.team,'away');
 assert.equal(press.targetPlayerId,'home-5');
});

test('P1 no-contact negatives cannot create a physical action or forced shot',()=>{
 assert.equal(select([]),null);
 assert.equal(select([point('shoot',50,0,false)]),null);
 const candidate=select([point('shoot',50,0)]);
 assert.equal(candidate.intent,'shoot');
 assert.equal(Object.hasOwn(candidate,'impulseNs'),false);
 assert.equal(Object.hasOwn(candidate,'contactStarted'),false);
 assert.equal(Object.hasOwn(candidate,'goalScored'),false);
 assert.equal(candidate.realShoeContactObserved,false);
 assert.equal(candidate.physicalActionExecuted,false);
});

test('P1 rejects future/stale frames, malformed teams and fake player targets',()=>{
 const alter=patch=>select([],patch.phase??'ball-opportunity',patch);
 const changedPlayers=players.map(p=>({...p}));
 const badCases=[
  {physicsTick:0},{physicsTick:2},
  {frame:{...base.frame,tick:22}},
  {frame:{...base.frame,tick:18}},
  {frame:{...base.frame,ball:{x:0,y:0,z:NaN}}},
  {frame:{...base.frame,players:players.slice(0,21)}},
  {frame:{...base.frame,players:[...players.slice(0,21),players[0]]}},
  {frame:{...base.frame,players:changedPlayers.map((p,i)=>
   i===0?{...p,x:Infinity}:p)}},
  {playerId:'home-40'},
  {team:'away'},
  {phase:'unrecognized'},
  {affordances:[point('shoot',1,1,true,21)]},
  {affordances:[point('shoot',1,1,true,18)]},
  {affordances:[player('pass','away-2')]},
  {affordances:[player('pass','home-7')]},
  {affordances:[player('press','home-2')],phase:'defend-off-ball'},
  {affordances:[point('press',4,4)],phase:'defend-off-ball'},
  {affordances:[point('support',4,4)],phase:'ball-opportunity'},
  {affordances:[point('advance',NaN,4)]},
  {affordances:[{kind:'retain',available:true,evidenceTick:20,target:{x:1,y:1}}]},
  {affordances:[{kind:'retain',available:true,evidenceTick:20,targetPlayerId:'home-2'}]},
  {affordances:[point('advance',0,1),
   point('advance',0,1)]},
  {affordances:[{kind:'shoot',available:1,evidenceTick:20,target:{x:1,y:1}}]},
  {affordances:[{kind:'shoot',available:true,evidenceTick:20}]},
  {affordances:[{kind:'pass',available:true,evidenceTick:20,
   targetPlayerId:'home-2',target:{x:3,y:4}}]}
 ];
 for(const bad of badCases)
  assert.throws(()=>alter(bad),TypeError,JSON.stringify(bad));
});

test('P2 preflight projects only live same-tick 22-player geometry, no affordances',()=>{
 const positions=Object.freeze(INITIAL_PLAYERS.map((p,i)=>Object.freeze({
  engineId:p.id,team:p.team,role:p.role,x:i+0.5,y:-i
 })));
 const frame={
  physicsTick:20,experimentalLocalOnly:true,matchRuntimeIntegrated:false,
  officialMatchAction:false,contactSource:'internal-real-rapier-60hz',
  footContact:{tick:20},autonomousMovement:{physicsTick:20},
  ball:{position:{x:3,y:-4,z:0.11}},
  physicalPlayerPositions:positions
 };
 const input=structuredClone({ball:frame.ball,physicsTick:frame.physicsTick});
 const home=projectObservedFootballContext(frame,{
  playerId:'home-7',phase:'ball-opportunity'
 });
 const away=projectObservedFootballContext(frame,{
  playerId:'away-7',phase:'defend-off-ball'
 });
 assert.equal(FOOTBALL_OBSERVATION_PROJECTION_VERSION,
  'me-p2-read-only-observed-frame-draft-v1');
 assert.equal(home.team,'home');
 assert.equal(away.team,'away');
 assert.equal(home.physicsTick,20);
 assert.deepEqual(home.frame.ball,{x:3,y:-4,z:0.11});
 assert.deepEqual(home.frame.players[6],{
  id:'home-7',team:'home',x:6.5,y:-6
 });
 assert.equal(home.affordances.length,0);
 assert.ok(Object.isFrozen(home)&&Object.isFrozen(home.frame)&&
  Object.isFrozen(home.frame.players)&&Object.isFrozen(home.frame.ball)&&
  Object.isFrozen(home.affordances));
 assert.equal(chooseObservedFootballIntent(home),null);
 assert.equal(chooseObservedFootballIntent(away),null);
 assert.deepEqual({ball:frame.ball,physicsTick:frame.physicsTick},input);
 assert.equal(Object.hasOwn(home,'contactStarted'),false);
 assert.equal(Object.hasOwn(home,'physicalActionExecuted'),false);
 assert.equal(Object.hasOwn(home,'possession'),false);
});

test('P2 preflight rejects inconsistent or forged-looking physical shapes',()=>{
 const positions=Object.freeze(INITIAL_PLAYERS.map((p,i)=>Object.freeze({
  engineId:p.id,team:p.team,role:p.role,x:i,y:0
 })));
 const baseFrame={
  physicsTick:20,experimentalLocalOnly:true,matchRuntimeIntegrated:false,
  officialMatchAction:false,contactSource:'internal-real-rapier-60hz',
  footContact:{tick:20},autonomousMovement:{physicsTick:20},
  ball:{position:{x:0,y:0,z:0.11}},physicalPlayerPositions:positions
 };
 const as=patch=>projectObservedFootballContext(
  {...baseFrame,...patch},{playerId:'home-7',phase:'ball-opportunity'});
 const invalid=[
  {physicsTick:0},{footContact:{tick:21}},
  {autonomousMovement:{physicsTick:19}},
  {contactSource:'client-supplied'},
  {experimentalLocalOnly:false},{matchRuntimeIntegrated:true},
  {officialMatchAction:true},
  {ball:{position:{x:Infinity,y:0,z:0.11}}},
  {ball:{position:{x:0,y:0,z:NaN}}},
  {physicalPlayerPositions:positions.slice()},
  {physicalPlayerPositions:Object.freeze(positions.slice(1))},
  {physicalPlayerPositions:Object.freeze(positions.map((p,i)=>
   i===4?Object.freeze({...p,engineId:'home-7'}):p))},
  {physicalPlayerPositions:Object.freeze(positions.map((p,i)=>
   i===4?Object.freeze({...p,team:'away'}):p))},
  {physicalPlayerPositions:Object.freeze(positions.map((p,i)=>
   i===4?Object.freeze({...p,x:NaN}):p))}
 ];
 for(const bad of invalid)assert.throws(()=>as(bad),TypeError);
 assert.throws(()=>projectObservedFootballContext(baseFrame,{
  playerId:'intruder',phase:'ball-opportunity'}),TypeError);
 assert.throws(()=>projectObservedFootballContext(baseFrame,{
  playerId:'home-7',phase:'unknown'}),TypeError);
});

test('P2 raw passing corridors measure HOME/AWAY blockers without authorizing pass',()=>{
 const contexts=['home','away'].map(team=>{
  const side=team==='home'?1:-1;
  const other=team==='home'?'away':'home';
  const positions=Object.freeze(INITIAL_PLAYERS.map((p,i)=>{
   let x=(p.team===team?-40-i:40+i)*side,y=14;
   if(p.id===team+'-7'){x=0;y=0;}
   if(p.id===team+'-8'){x=10*side;y=0;}
   if(p.id===team+'-1'){x=5*side;y=2;}
   if(p.id===other+'-1'){x=4*side;y=1;}
   return Object.freeze({engineId:p.id,team:p.team,role:p.role,x,y});
  }));
  const frame={
   physicsTick:30,experimentalLocalOnly:true,matchRuntimeIntegrated:false,
   officialMatchAction:false,contactSource:'internal-real-rapier-60hz',
   footContact:{tick:30},autonomousMovement:{physicsTick:30},
   ball:{position:{x:0,y:0,z:0.11}},physicalPlayerPositions:positions
  };
  const observation=projectObservedFootballContext(frame,{
   playerId:team+'-7',phase:'ball-opportunity'
  });
  return {observation,frame,team};
 });
 const results=contexts.map(({observation})=>
  measureObservedPassingCorridors(observation));
 for(let i=0;i<results.length;i++){
  const result=results[i],team=contexts[i].team;
  assert.equal(result.version,FOOTBALL_CORRIDOR_MEASUREMENT_VERSION);
  assert.equal(result.corridors.length,10);
  assert.equal(result.corridors[0].targetPlayerId,team+'-1');
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.corridors));
  assert.equal(result.authorizedAffordances.length,0);
  assert.equal(result.physicalActionExecuted,false);
  assert.equal(result.officialMatchAction,false);
  const target=result.corridors.find(c=>c.targetPlayerId===team+'-8');
  const other=team==='home'?'away':'home';
  assert.equal(target.segmentLengthM,10);
  assert.equal(target.degenerateSegment,false);
  assert.equal(target.nearestOpponent.playerId,other+'-1');
  assert.equal(target.nearestOpponent.distanceToSegmentM,1);
  assert.equal(target.nearestOpponent.segmentFraction,0.4);
  assert.equal(target.nearestOtherTeammate.playerId,team+'-1');
  assert.equal(target.nearestOtherTeammate.distanceToSegmentM,2);
  assert.equal(target.nearestOtherTeammate.segmentFraction,0.5);
  assert.equal(target.passEligible,null);
  assert.equal(target.passExecuted,false);
  assert.equal(target.physicalContactProven,false);
  assert.ok(Object.isFrozen(target)&&Object.isFrozen(target.nearestOpponent));
  assert.equal(chooseObservedFootballIntent(contexts[i].observation),null);
  const reordered={...contexts[i].observation,frame:{
   ...contexts[i].observation.frame,
   players:contexts[i].observation.frame.players.toReversed()
  }};
  assert.deepEqual(measureObservedPassingCorridors(reordered),result);
 }
 const h=results[0].corridors.find(c=>c.targetPlayerId==='home-8');
 const a=results[1].corridors.find(c=>c.targetPlayerId==='away-8');
 assert.equal(h.nearestOpponent.distanceToSegmentM,
  a.nearestOpponent.distanceToSegmentM);
 assert.equal(h.nearestOtherTeammate.distanceToSegmentM,
  a.nearestOtherTeammate.distanceToSegmentM);
});

test('P2 raw corridors reject action candidates and handle zero-length paths',()=>{
 const positions=Object.freeze(INITIAL_PLAYERS.map((p,i)=>Object.freeze({
  engineId:p.id,team:p.team,role:p.role,
  x:p.id==='home-7'||p.id==='home-8'?0:40+i,y:0
 })));
 const frame={
  physicsTick:42,experimentalLocalOnly:true,matchRuntimeIntegrated:false,
  officialMatchAction:false,contactSource:'internal-real-rapier-60hz',
  footContact:{tick:42},autonomousMovement:{physicsTick:42},
  ball:{position:{x:0,y:0,z:0.11}},physicalPlayerPositions:positions
 };
 const observed=projectObservedFootballContext(frame,{
  playerId:'home-7',phase:'ball-opportunity'
 });
 const raw=measureObservedPassingCorridors(observed);
 const sameSpot=raw.corridors.find(c=>c.targetPlayerId==='home-8');
 assert.equal(sameSpot.segmentLengthM,0);
 assert.equal(sameSpot.degenerateSegment,true);
 assert.equal(sameSpot.passEligible,null);
 assert.ok(Number.isFinite(sameSpot.nearestOpponent.distanceToSegmentM));
 assert.equal(sameSpot.nearestOpponent.segmentFraction,0);
 assert.throws(()=>measureObservedPassingCorridors({
  ...observed,affordances:[{
   kind:'pass',available:true,evidenceTick:42,targetPlayerId:'home-8'
  }]
 }),TypeError);
 assert.throws(()=>measureObservedPassingCorridors({
  ...observed,phase:'defend-off-ball'
 }),TypeError);
 assert.throws(()=>measureObservedPassingCorridors({
  ...observed,frame:{...observed.frame,tick:45}
 }),TypeError);
 assert.throws(()=>measureObservedPassingCorridors({
  ...observed,frame:{...observed.frame,players:[]}
 }),TypeError);
});

test('P2 consecutive passing corridors observe changed defender distance HOME/AWAY',()=>{
 for(const team of ['home','away']){
  const side=team==='home'?1:-1;
  const other=team==='home'?'away':'home';
  const getObservation=(tick,defenderY)=>projectObservedFootballContext({
   physicsTick:tick,experimentalLocalOnly:true,
   matchRuntimeIntegrated:false,officialMatchAction:false,
   contactSource:'internal-real-rapier-60hz',
   footContact:{tick},autonomousMovement:{physicsTick:tick},
   ball:{position:{x:0,y:0,z:0.11}},
   physicalPlayerPositions:Object.freeze(INITIAL_PLAYERS.map((p,i)=>{
    let x=(p.team===team?-40-i:40+i)*side,y=25;
    if(p.id===team+'-7'){x=0;y=0;}
    if(p.id===team+'-8'){x=10*side;y=0;}
    if(p.id===team+'-1'){x=5*side;y=2;}
    if(p.id===other+'-1'){x=4*side;y=defenderY;}
    return Object.freeze({engineId:p.id,team:p.team,role:p.role,x,y});
   }))
  },{playerId:team+'-7',phase:'ball-opportunity'});
  const before=getObservation(50,1);
  const after=getObservation(51,0.5);
  const result=measureObservedPassingCorridorChanges(before,after);
  const route=result.changes.find(c=>c.targetPlayerId===team+'-8');
  assert.equal(result.previousTick,50);
  assert.equal(result.currentTick,51);
  assert.equal(result.ballDisplacementM,0);
  assert.equal(result.changes.length,10);
  assert.equal(route.nearestOpponentPreviousId,other+'-1');
  assert.equal(route.nearestOpponentCurrentId,other+'-1');
  assert.equal(route.nearestOpponentChanged,false);
  assert.equal(route.nearestOpponentCenterlineDistanceDeltaM,-0.5);
  assert.equal(route.nearestTeammateCenterlineDistanceDeltaM,0);
  assert.equal(route.receiverDisplacementM,0);
  assert.equal(route.segmentLengthDeltaM,0);
  assert.equal(route.passEligible,null);
  assert.equal(route.physicalContactProven,false);
  assert.equal(route.passExecuted,false);
  assert.equal(result.authorizedAffordances.length,0);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.changes)&&
   Object.isFrozen(route));
  assert.equal(chooseObservedFootballIntent(after),null);
  assert.deepEqual(measureObservedPassingCorridorChanges(before,after),result);
 }
});

test('P2 corridor delta rejects stale, skipped, changed-team or candidate frames',()=>{
 const positionFrame=tick=>({
  physicsTick:tick,experimentalLocalOnly:true,matchRuntimeIntegrated:false,
  officialMatchAction:false,contactSource:'internal-real-rapier-60hz',
  footContact:{tick},autonomousMovement:{physicsTick:tick},
  ball:{position:{x:0,y:0,z:0.11}},
  physicalPlayerPositions:Object.freeze(INITIAL_PLAYERS.map((p,i)=>
   Object.freeze({engineId:p.id,team:p.team,role:p.role,x:i,y:i+1})))
 });
 const prev=projectObservedFootballContext(positionFrame(60),{
  playerId:'home-7',phase:'ball-opportunity'
 });
 const next=projectObservedFootballContext(positionFrame(61),{
  playerId:'home-7',phase:'ball-opportunity'
 });
 const compare=(a,b)=>measureObservedPassingCorridorChanges(a,b);
 assert.throws(()=>compare(next,prev),TypeError);
 assert.throws(()=>compare(prev,prev),TypeError);
 assert.throws(()=>compare(prev,{
  ...next,physicsTick:62,frame:{...next.frame,tick:62}
 }),TypeError);
 assert.throws(()=>compare(prev,{
  ...next,physicsTick:62,frame:{...next.frame,tick:61}
 }),TypeError);
 assert.throws(()=>compare({...prev,frame:{...prev.frame,tick:59}},next),
  TypeError);
 assert.throws(()=>compare(prev,{
  ...next,playerId:'home-8'
 }),TypeError);
 assert.throws(()=>compare(prev,{
  ...next,affordances:[{
   kind:'pass',available:true,evidenceTick:61,targetPlayerId:'home-8'
  }]
 }),TypeError);
 const shifted=next.frame.players.map(p=>({...p}));
 shifted[0].team='away';
 shifted[11].team='home';
 assert.throws(()=>compare(prev,{
  ...next,frame:{...next.frame,players:shifted}
 }),TypeError);
});

test('P0 existing-policy shot and PASS geometry is diagnostic only',()=>{
 const ball={x:40,y:0,z:0.11};
 const makePositions=blocked=>Object.freeze(INITIAL_PLAYERS.map((p,i)=>{
  let x=p.team==='home'?25: -30,y=20;
  if(p.id==='home-9'){x=40;y=0;}
  if(p.id==='home-10'){x=42;y=6;}
  if(blocked&&p.id==='away-1'){x=45;y=0;}
  return Object.freeze({engineId:p.id,team:p.team,role:p.role,x,y});
 }));
 const open=inspectUniformPolicyGeometry({
  tick:25,playerId:'home-9',ballPosition:ball,
  physicalPlayerPositions:makePositions(false)
 });
 assert.equal(open.version,UNIFORM_POLICY_GEOMETRY_VERSION);
 assert.equal(open.shotRange,true);
 assert.equal(open.shotLaneFound,true);
 assert.equal(open.shotLaneTarget.y,0);
 assert.equal(open.shotRangeShortfallM,0);
 assert.equal(open.actualShoeContactVerified,null);
 assert.equal(open.physicalActionAuthorized,false);
 assert.equal(open.physicalActionExecuted,false);
 assert.equal(open.officialMatchAction,false);
 assert.equal(open.authorizedAffordances.length,0);
 const blocked=inspectUniformPolicyGeometry({
  tick:25,playerId:'home-9',ballPosition:ball,
  physicalPlayerPositions:makePositions(true)
 });
 assert.equal(blocked.shotRange,true);
 assert.equal(blocked.shotLaneFound,false);
 assert.equal(blocked.passGeometryRecipientId,'home-10');
 assert.ok(blocked.passGeometryLaneClearanceM>0);
 assert.equal(blocked.physicalActionAuthorized,false);
 assert.deepEqual(inspectUniformPolicyGeometry({
  tick:25,playerId:'home-9',ballPosition:ball,
  physicalPlayerPositions:makePositions(true)
 }),blocked);
 const far=inspectUniformPolicyGeometry({
  tick:25,playerId:'away-9',ballPosition:ball,
  physicalPlayerPositions:makePositions(false)
 });
 assert.equal(far.shotRange,false);
 assert.equal(far.shotLaneFound,false);
 assert.equal(far.shotLaneTarget,null);
 assert.throws(()=>inspectUniformPolicyGeometry({
  tick:25,playerId:'unknown',ballPosition:ball,
  physicalPlayerPositions:makePositions(false)
 }),TypeError);
 assert.throws(()=>inspectUniformPolicyGeometry({
  tick:25,playerId:'home-9',ballPosition:ball,
  physicalPlayerPositions:makePositions(false).slice()
 }),TypeError);
 assert.throws(()=>inspectUniformPolicyGeometry({
  tick:25,playerId:'home-9',ballPosition:{...ball,x:NaN},
  physicalPlayerPositions:makePositions(false)
 }),TypeError);
});

test('P0 original physical selector input gates reject fabricated opportunities',()=>{
 const tick=30,id='home-9';
 const playerFrame={version:PLAYER_VERSION,tick,players:INITIAL_PLAYERS.map(p=>({
  ...p,x:p.id===id?0:p.x,y:p.id===id?0:p.y
 }))};
 const input={
  tick,contactStarted:[id],contactActive:[id],playerFrame,
  ballPosition:{x:0,y:0,z:0.11},
  ballVelocity:{x:0,y:0,z:0},lastActionTick:0,
  ballRadiusM:0.11,allowPhysicalCarry:false
 };
 // Pure selector accepts declared arrays, not proof of genuine Rapier.
 const selected=selectUniformAutonomousContactAction(input);
 assert.ok(selected&&selected.physicalPrerequisites);
 const evidence=selected.physicalPrerequisites;
 assert.equal(evidence.physicsTick,tick);
 assert.equal(evidence.actorId,id);
 assert.equal(evidence.exclusiveShoeStart,true);
 assert.equal(evidence.cooldownElapsedTicks,30);
 assert.equal(evidence.cooldownMinimumTicks,
  UNIFORM_AUTONOMOUS_ACTION_COOLDOWN_TICKS);
 assert.equal(evidence.shoeBallGapM,0);
 assert.equal(evidence.ballHeightM,0.11);
 assert.equal(evidence.ballHorizontalSpeedMps,0);
 assert.equal(evidence.originalPhysicalGuardsPassed,true);
 assert.equal(evidence.authorizesOfficialAction,false);
 assert.equal(evidence.contactAuthenticatedByShape,false);
 assert.ok(Object.isFrozen(evidence));
 for(const patch of [
  {contactStarted:[],contactActive:[]},
  {contactActive:[id,'away-1']},
  {lastActionTick:29},
  {ballPosition:{x:2,y:0,z:0.11}},
  {ballPosition:{x:0,y:0,z:0.25}},
  {ballVelocity:{x:15,y:0,z:0}}
 ])assert.equal(selectUniformAutonomousContactAction({
  ...input,...patch
 }),null);
 for(const patch of [
  {tick:31},{ballRadiusM:0},
  {contactStarted:[id,id]},
  {contactStarted:['unknown'],contactActive:['unknown']},
  {ballVelocity:{x:NaN,y:0,z:0}}
 ])assert.throws(()=>selectUniformAutonomousContactAction({
  ...input,...patch
 }),TypeError);
});
