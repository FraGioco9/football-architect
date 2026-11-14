// P1 candidate behavior-only decision contract; NO physical match actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {FOOTBALL_INTENT_VERSION,FOOTBALL_INTENT_PRIORITIES,
 chooseObservedFootballIntent}
 from '../src/player-football-intent.mjs';

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
