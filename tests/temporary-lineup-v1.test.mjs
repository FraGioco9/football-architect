import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {LINEUP_V1_SLOTS,selectAutomaticXiV1,simulateRegulationV1} from '../backend/src/temporary-lineup-v1.mjs';

const player=(id,role='CM',skill=61)=>({id,primary_position:role,secondary_positions:[],career_status:'active',
 attributes:Object.fromEntries(ATTRIBUTES.map(attr=>[attr,skill]))});
const roles=['GK','RB','CB','CB','LB','CM','DM','CM','RW','ST','LW'];
const roster=(skill=61)=>roles.map((role,index)=>player(index+1,role,skill));
const play=(homeRoster,awayRoster,neutral=false)=>simulateRegulationV1({homeRoster,awayRoster,neutral,matchKey:'season:1:match:17',seed:'temporary-sim-v1-test-seed'});

test('0, 10, 11 and 12 eligible; real XI is never invented',()=>{
 assert.equal(selectAutomaticXiV1([]).kind,'team_fallback');
 assert.equal(selectAutomaticXiV1(roster().slice(0,10)).starters,null);
 const exact=selectAutomaticXiV1(roster());
 assert.equal(exact.kind,'real_xi');
 assert.deepEqual(exact.starters.map(p=>p.playerId).sort((a,b)=>a-b),roles.map((_,i)=>i+1));
 assert.deepEqual(exact.starters.map(p=>p.role),LINEUP_V1_SLOTS);
 assert.equal(selectAutomaticXiV1([...roster(),player(12,'ST',95)]).starters.length,11);
 assert.ok(selectAutomaticXiV1([...roster(),player(12,'ST',95)]).starters.some(x=>x.playerId===12));
});

test('retired players excluded and invalid active data fails closed',()=>{
 const retired={...player(12),career_status:'retired'};
 assert.equal(selectAutomaticXiV1([...roster().slice(0,10),retired]).kind,'team_fallback');
 assert.throws(()=>selectAutomaticXiV1([...roster(),roster()[0]]),/identity/);
 assert.throws(()=>selectAutomaticXiV1([...roster(),{...player(12),attributes:{shooting:61}}]),/attributes/);
});

test('real emergency GK only when a natural GK is unavailable',()=>{
 const noKeeper=roster().map((p,i)=>i? p : player(1,'ST',61));
 const side=selectAutomaticXiV1(noKeeper);
 assert.equal(side.starters[0].emergencyGoalkeeper,true);
 assert.ok(side.starters.some(p=>p.role==='GK'&&p.playerId>0));
 assert.equal(selectAutomaticXiV1(roster()).starters[0].emergencyGoalkeeper,false);
});

test('XI and output invariant under input row order, and ignores hidden aptitude and preferred foot',async()=>{
 const a=[...roster(),player(12,'ST',70),player(13,'AM',72)],b=[...a].reverse();
 assert.deepEqual(selectAutomaticXiV1(a),selectAutomaticXiV1(b));
 const withHidden=a.map(p=>({...p,development_aptitude:99,preferred_foot:'left'}));
 assert.deepEqual(selectAutomaticXiV1(a),selectAutomaticXiV1(withHidden));
 assert.deepEqual(await play(a,[]),await play(b,[]));
});

test('neutral/strength models are deterministic, bounded and have directionally plausible xG',async()=>{
 const weak=await play(roster(45),roster(80)),strong=await play(roster(80),roster(45));
 assert.ok(strong.expectedGoals.home>weak.expectedGoals.home);
 assert.ok(strong.expectedGoals.away<weak.expectedGoals.away);
 assert.ok(strong.expectedGoals.home>=.40&&strong.expectedGoals.home<=2.80);
 assert.ok(strong.regulation.homeGoals<=6&&strong.regulation.awayGoals<=6);
 assert.deepEqual(strong,await play(roster(80),roster(45)));
 const neutral=await play(roster(61),roster(61),true);
 assert.deepEqual(neutral.expectedGoals,{home:1.25,away:1.25});
});

test('mixed mode only attributes goals to actual XI, reconciles appearances',async()=>{
 for(const [homeRoster,awayRoster] of [[roster(),[]],[[],roster()],[roster(),roster()]]){
  const result=await play(homeRoster,awayRoster);
  const goals=result.regulation;
  assert.equal(result.events.filter(e=>e.side==='home').length+result.home.unattributedGoals,goals.homeGoals);
  assert.equal(result.events.filter(e=>e.side==='away').length+result.away.unattributedGoals,goals.awayGoals);
  for(const side of ['home','away']){
   const data=result[side],events=result.events.filter(e=>e.side===side);
   assert.equal(data.appearances.length,data.kind==='real_xi'?11:0);
   assert.equal(data.appearances.reduce((sum,p)=>sum+p.goals,0),events.length);
   assert.ok(events.every(e=>e.minute>=1&&e.minute<=90&&data.starters.some(p=>p.playerId===e.playerId)));
  }
 }
});

test('both fallback sides delegate to unchanged temporary-score-v1',async()=>{
 assert.deepEqual(await play([],[]),{kind:'use_existing_temporary_score_v1',mode:'fallback_vs_fallback'});
 assert.deepEqual(await play(roster().slice(0,10),roster().slice(0,10)),{kind:'use_existing_temporary_score_v1',mode:'fallback_vs_fallback'});
});
