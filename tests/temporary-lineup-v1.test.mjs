import test from 'node:test';
import assert from 'node:assert/strict';
import {ATTRIBUTES} from '../backend/src/players-generator-core.mjs';
import {LINEUP_V1_SLOTS,selectAutomaticXiV1,simulateRegulationV1,simulateMatchV1,buildCandidateMatchReceiptV1} from '../backend/src/temporary-lineup-v1.mjs';

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


const opponentRoster=(skill=61)=>roster(skill).map(p=>({...p,id:p.id+100}));
const contextPlay=(homeRoster,awayRoster,context,seed='temporary-sim-v1-test-seed')=>
 simulateMatchV1({homeRoster,awayRoster,context,seed,matchKey:'season:1:IT-1:N01:IT-1:IT-2',
  homeClubId:'IT-1',awayClubId:'IT-2'});
const receiptMatch={matchId:17,season:1,day:13,generation:'world-test-generation',
 competitionId:'IT-1',fixtureId:'season:1:IT-1:N01:IT-1:IT-2',
 homeClubId:'IT-1',awayClubId:'IT-2',sourceHash:'a'.repeat(64)};
const assertReconciled=(outcome)=>{
 if(outcome.kind==='use_existing_temporary_score_v1')return;
 assert.equal(outcome.regulation.home+(outcome.extraTime?.home??0),outcome.homeGoals);
 assert.equal(outcome.regulation.away+(outcome.extraTime?.away??0),outcome.awayGoals);
 for(const sideName of ['home','away']){
  const side=outcome[sideName],goals=outcome[sideName+'Goals'];
  const scored=outcome.events.filter(e=>e.side===sideName);
  assert.equal(scored.length+side.unattributedGoals,goals);
  assert.equal(side.appearances.reduce((sum,p)=>sum+p.goals,0),scored.length);
  assert.ok(scored.every(e=>e.period==='regulation'?e.minute<=90:e.period==='extra-time'&&e.minute>=91&&e.minute<=120));
  assert.ok(side.appearances.every(p=>p.minutes===(outcome.extraTime?120:90)));
 }
};
test('full match regulation-only returns stable compatible match-level fields and candidate receipt',async()=>{
 const result=await contextPlay(roster(),[],{mode:'regulation'});
 assert.equal(result.algorithmVersion,'temporary-lineup-v1');
 assert.equal(result.context.mode,'regulation');
 assert.equal(result.resolution,'regulation');
 assert.equal(result.extraTime,null);
 assert.equal(result.penalties,null);
 assertReconciled(result);
 const receipt=await buildCandidateMatchReceiptV1(receiptMatch,result);
 assert.equal(receipt.authority,'candidate-only');
 assert.match(receipt.receiptDigest,/^[a-f0-9]{64}$/);
 assert.equal(Object.isFrozen(receipt.result.home.starters),true);
 assert.deepEqual(receipt,await buildCandidateMatchReceiptV1(receiptMatch,result));
 assert.throws(()=>{receipt.result.homeGoals=99;},TypeError);
 const changed={...receiptMatch,sourceHash:'b'.repeat(64)};
 assert.notEqual((await buildCandidateMatchReceiptV1(changed,result)).receiptDigest,receipt.receiptDigest);
});

test('single knockout reaches regulation, extra time, and shootouts with real XI or mixed mode',async()=>{
 const paths=new Set();
 for(let i=0;i<120;i++){
  const result=await contextPlay(roster(),[],{mode:'single-knockout'},'knockout-simple-'+String(i).padStart(4,'0'));
  assertReconciled(result);
  assert.equal(['IT-1','IT-2'].includes(result.winnerClubId),true);
  if(result.extraTime){
   assert.equal(result.home.appearances.length,11);
   assert.ok(result.home.appearances.every(p=>p.minutes===120));
  }
  if(result.penalties){
   assert.equal(result.resolution,'penalties');
   assert.equal(Math.abs(result.penalties.home-result.penalties.away),1);
   assert.equal(result.homeGoals,result.regulation.home+result.extraTime.home);
  }
  await buildCandidateMatchReceiptV1(receiptMatch,result);
  paths.add(result.resolution);
 }
 assert.deepEqual([...paths].sort(),['extra-time','penalties','regulation']);
});
test('second-leg uses aggregate and not away goals; neutral final removes home advantage',async()=>{
 const seen=new Set();
 for(let i=0;i<60;i++){
  const seed='return-match-simple-'+String(i).padStart(4,'0');
  const regulation=await contextPlay(roster(),opponentRoster(),{mode:'regulation'},seed);
  const {home,away}=regulation.regulation;
  const result=await contextPlay(roster(),opponentRoster(),{mode:'second-leg',
   firstLegHomeGoals:home,firstLegAwayGoals:away},seed);
  assert.ok(result.extraTime);
  assertReconciled(result);
  await buildCandidateMatchReceiptV1(receiptMatch,result);
  seen.add(result.resolution);
 }
 assert.ok(seen.has('extra-time')&&seen.has('penalties'));
 const neutral=await contextPlay(roster(),opponentRoster(),{mode:'single-knockout',neutral:true});
 assert.deepEqual(neutral.expectedGoals,{home:1.25,away:1.25});
 assertReconciled(neutral);
 await buildCandidateMatchReceiptV1(receiptMatch,neutral);
});
test('no fabricated identities across sides, invalid contexts fail closed, and dual fallback delegates',async()=>{
 const both=await contextPlay([],[],{mode:'single-knockout'});
 assert.deepEqual(both,{kind:'use_existing_temporary_score_v1',mode:'fallback_vs_fallback',
   context:{mode:'single-knockout'}});
 await assert.rejects(()=>contextPlay(roster(),roster().slice(0,1),null),/context/);
 await assert.rejects(()=>contextPlay(roster(),[],{mode:'second-leg',firstLegHomeGoals:-1,firstLegAwayGoals:0}),/context/);
 await assert.rejects(()=>contextPlay(roster(),[],{mode:'regulation',neutral:true}),/context/);
 await assert.rejects(()=>contextPlay(roster(),roster(),{mode:'regulation'}),/both clubs/);
 await assert.rejects(()=>buildCandidateMatchReceiptV1(receiptMatch,both),/receipt inputs/);
});
test('candidate receipt rejects mismatched provenance, scorer ghost, and score tampering',async()=>{
 const result=await contextPlay(roster(),[],{mode:'regulation'});
 await assert.rejects(()=>buildCandidateMatchReceiptV1({...receiptMatch,matchId:0},result),/fixture evidence/);
 await assert.rejects(()=>buildCandidateMatchReceiptV1({...receiptMatch,homeClubId:'IT-4'},result),/fixture evidence/);
 await assert.rejects(()=>buildCandidateMatchReceiptV1(receiptMatch,{...result,homeGoals:result.homeGoals+1}),/score reconciliation/);
 await assert.rejects(()=>buildCandidateMatchReceiptV1(receiptMatch,{...result,
  events:[...result.events,{side:'away',period:'regulation',minute:45,playerId:999,type:'goal'}]}),/scorer reconciliation/);
});
