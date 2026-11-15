// #620 clean-stack action scenes: real same-world Rapier source only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {ACTION_LAB_SCENARIOS,getActionLabScenario,
 classifyActionLabEvidence} from '../src/action-lab-scenarios.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

test('five clean Action LABs retain negative authorization boundaries',()=>{
 assert.deepEqual(ACTION_LAB_SCENARIOS.map(s=>s.id),
  ['pass','shot','challenge','control','carry']);
 assert.equal(new Set(ACTION_LAB_SCENARIOS.map(s=>s.initial.seed)).size,5);
 for(const spec of ACTION_LAB_SCENARIOS){
  assert.ok(Object.isFrozen(spec)&&Object.isFrozen(spec.initial));
  assert.equal(spec.officialResult,false);
  assert.equal(getActionLabScenario(spec.id),spec);
  const zero=classifyActionLabEvidence(spec,{tick:0,starts:[]});
  assert.equal(zero.witnessed,false);
  assert.equal(zero.officialMatchAction,false);
  assert.equal(zero.officialPossession,false);
  assert.equal(zero.officialGoal,false);
  assert.equal(zero.tackleConfirmed,null);
  assert.equal(zero.dribbleConfirmed,null);
  assert.equal(zero.passCompleted,null);
 }
 assert.throws(()=>getActionLabScenario('official-goal'),RangeError);
 const pass=getActionLabScenario('pass'),action={
  action:'pass',tick:1,playerId:'home-10',
  appliedByRapier:true,actualPhysicsImpulseApplied:true,
  officialMatchAction:false
 };
 assert.equal(classifyActionLabEvidence(pass,{
  tick:1,starts:['home-10'],action
 }).verifiedShoeImpulse,true);
 for(const bad of [
  {tick:1,starts:[],action},
  {tick:1,starts:['home-10','away-10'],action},
  {tick:1,starts:['home-10'],action:{...action,appliedByRapier:false}},
  {tick:1,starts:['home-10'],action:{...action,tick:0}},
  {tick:1,starts:['home-10'],action:{...action,officialMatchAction:true}}
 ])assert.throws(()=>classifyActionLabEvidence(pass,bad),TypeError);
 const control=getActionLabScenario('control');
 const priorPass={tick:1,playerId:'home-10',team:'home'};
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['away-10'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-10'],priorPass
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(control,{
  tick:2,starts:['home-9'],priorPass
 }).verifiedReceivingShoeContact,true);
 const challenge=getActionLabScenario('challenge');
 assert.equal(classifyActionLabEvidence(challenge,{
  tick:1,starts:['home-10']
 }).witnessed,false);
 assert.equal(classifyActionLabEvidence(challenge,{
  tick:1,starts:['away-10']
 }).observedOpponentShoeContact,true);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const dev=readFileSync(new URL('../../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/action-labs.mjs',import.meta.url),'utf8');
 for(const spec of ACTION_LAB_SCENARIOS)
  assert.match(html,new RegExp('<option value="'+spec.id+'">'));
 assert.match(html,/id="action-labs-dialog"/);
 assert.match(dev,/__fa_match_engine__\/action-labs\.mjs/);
 assert.match(dev,/__fa_match_engine__\/action-lab-scenarios\.mjs/);
 assert.doesNotMatch(client,/player-ball-universal-world|LocalAiPassReceive|LocalAiExchange/);
});

test('same-world clean Action LAB 22-player actual physics, PASS positive, no unearned outcomes',
 {timeout:45000},async()=>{
 const R=await initializeRapier(rapier);
 const results={};
 for(const spec of ACTION_LAB_SCENARIOS){
  const lab=createControlledActionLab(R,spec.id);
  try{
   const zero=lab.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.players.length,22);
   assert.equal(zero.officialMatchPossession,false);
   assert.equal(zero.eventCount,0);
   let first=null,shoeStartCount=0;
   const horizon=spec.id==='pass'?1:spec.id==='challenge'?45:80;
   for(let tick=1;tick<=horizon;tick++){
    const f=lab.step();
    assert.equal(f.physicsTick,tick);
    assert.equal(f.players.length,22);
    assert.equal(f.officialMatchResult,null);
    assert.equal(f.officialMatchPossession,false);
    assert.equal(f.scoreChanged,false);
    assert.equal(f.evidence.officialGoal,false);
    assert.equal(f.evidence.tackleConfirmed,null);
    assert.equal(f.evidence.dribbleConfirmed,null);
    assert.equal(f.evidence.passCompleted,null);
    shoeStartCount+=f.starts.length;
    if(f.evidence.witnessed&&!first)
     first={tick,actor:f.action?.playerId??f.starts[0],kind:f.action?.action??spec.goal};
   }
   results[spec.id]={first,shoeStartCount};
   if(spec.id==='pass'){
    assert.deepEqual(first,{tick:1,actor:'home-10',kind:'pass'});
    assert.equal(shoeStartCount>=1,true);
   }
  }finally{lab.dispose();}
  assert.throws(()=>lab.step(),/disposed/);
 }
 process.stdout.write('ME_CLEAN_ACTION_LABS '+JSON.stringify(results)+'\n');
});
