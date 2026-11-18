import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {simulateMatchV1} from '../backend/src/temporary-lineup-v1.mjs';
import {planRecordedMatchTimelineV1,MATCH_EVENT_MODEL_VERSION} from '../backend/src/match-recorded-events-v1.mjs';

const roles=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'];
const player=(id,role='CM')=>({id,career_status:'active',primary_position:role,
 secondary_positions:[],attributes:Object.fromEntries(ATTRIBUTES.map(k=>[k,61]))});
const roster=(offset=0,extra=0)=>[
 ...roles.map((role,i)=>player(offset+i+1,role)),
 ...Array.from({length:extra},(_,i)=>player(offset+12+i,i===0?'GK':'CM'))
];
const play=(home,away,seed='match-events-01-testing-seed',mode='regulation')=>simulateMatchV1({
 homeRoster:home,awayRoster:away,matchKey:'season:1:IT-1:N01:IT-1:IT-2',
 seed,homeClubId:'IT-1',awayClubId:'IT-2',context:{mode}
});
const timeline=async(home,away,seed,mode)=>planRecordedMatchTimelineV1({
 result:await play(home,away,seed,mode),homeRoster:home,awayRoster:away
});
function check(t,homeRoster,awayRoster,duration){
 assert.equal(t.eventModelVersion,MATCH_EVENT_MODEL_VERSION);
 for(const [side,roster] of [['home',homeRoster],['away',awayRoster]]){
  const item=t[side],all=new Set(roster.map(p=>p.id));
  assert.ok(item.bench.length<=9);
  assert.ok(item.bench.every(p=>all.has(p.playerId)));
  for(const p of item.appearances){
   assert.ok(all.has(p.playerId));
   assert.equal(p.minutes,p.intervals.reduce((n,i)=>n+i.to-i.from,0));
   assert.equal(p.gkMinutes,p.intervals.filter(i=>i.role==='GK').reduce((n,i)=>n+i.to-i.from,0));
   assert.ok(p.minutes>=1&&p.minutes<=duration);
   assert.equal(p.started,p.intervals[0].from===0);
  }
  const subs=t.events.filter(e=>e.side===side&&e.type==='substitution');
  assert.ok(subs.length<=5+(duration===120?1:0));
  assert.ok(new Set(subs.filter(e=>e.window==='in-play').map(e=>e.minute)).size<=3);
  for(const e of t.events.filter(e=>e.side===side)){
   for(const id of [e.playerId,e.inPlayerId,e.outPlayerId,e.fromPlayerId,e.toPlayerId])
    if(id!==undefined)assert.ok(all.has(id));
  }
  assert.equal(item.appearances.reduce((n,p)=>n+p.goals,0),
   t.events.filter(e=>e.type==='goal'&&e.side===side).length);
  assert.equal(item.appearances.reduce((n,p)=>n+p.assists,0),
   t.events.filter(e=>e.type==='pass'&&e.side===side).length);
  assert.equal(item.appearances.reduce((n,p)=>n+p.redCards,0),
   t.events.filter(e=>e.type==='red'&&e.side===side).length);
  if(roster.length===0||roster.length<11)assert.deepEqual(item.appearances,[]);
 }
 for(const goal of t.events.filter(e=>e.type==='goal')){
  const players=t[goal.side].appearances;
  assert.ok(players.some(p=>p.playerId===goal.playerId&&
   p.intervals.some(i=>i.from<=goal.minute&&goal.minute<=i.to)));
  if(goal.assistingPlayerId!==null){
   assert.notEqual(goal.playerId,goal.assistingPlayerId);
   assert.ok(t.events.some(e=>e.type==='pass'&&e.goalId===goal.goalId&&
    e.toPlayerId===goal.playerId&&e.fromPlayerId===goal.assistingPlayerId));
  }
 }
}
test('pure future event planner is deterministic, input-order invariant and does not mutate score evidence',async()=>{
 const home=roster(0,6),away=roster(100,4);
 const original=await play(home,away);
 const preserved=structuredClone(original);
 const a=await planRecordedMatchTimelineV1({result:original,homeRoster:home,awayRoster:away});
 const b=await planRecordedMatchTimelineV1({result:original,homeRoster:[...home].reverse(),awayRoster:[...away].reverse()});
 assert.deepEqual(a,b);
 assert.deepEqual(original,preserved);
 check(a,home,away,90);
});
test('no invented fallback actors; a real XI can still receive events against fallback',async()=>{
 for(const [home,away] of [[[],[]],[roster(),[]],[[],roster(100)],[roster(0,9),roster(100,9)]]){
  const t=await timeline(home,away);check(t,home,away,90);
  if(home.length<11)assert.ok(t.events.every(e=>e.side!=='home'));
  if(away.length<11)assert.ok(t.events.every(e=>e.side!=='away'));
 }
});
test('ET, penalties and dismissals never introduce extra player goals or phantom minutes',async()=>{
 let seenRed=false,seenSub=false,seenPass=false,seenEt=false;
 const home=roster(0,9),away=roster(100,9);
 for(let i=0;i<80;i++){
  const seed='event-matrix-'+String(i).padStart(4,'0');
  const result=await play(home,away,seed,'single-knockout');
  const t=await planRecordedMatchTimelineV1({result,homeRoster:home,awayRoster:away});
  check(t,home,away,result.extraTime?120:90);
  assert.equal(t.events.filter(e=>e.type==='goal'&&e.side==='home').length,result.homeGoals);
  assert.equal(t.events.filter(e=>e.type==='goal'&&e.side==='away').length,result.awayGoals);
  seenRed||=t.events.some(e=>e.type==='red');
  seenSub||=t.events.some(e=>e.type==='substitution');
  seenPass||=t.events.some(e=>e.type==='pass');
  seenEt||=!!result.extraTime;
 }
 assert.ok(seenRed&&seenSub&&seenPass&&seenEt);
});
