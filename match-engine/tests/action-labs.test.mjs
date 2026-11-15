// #620: real controlled-action LABs reuse existing shoe physics.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as rapier from '@dimforge/rapier3d-deterministic-compat';
import {initializeRapier} from '../src/core.mjs';
import {ACTION_LAB_SCENARIOS,getActionLabScenario,
 classifyActionLabEvidence} from '../src/action-lab-scenarios.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';

test('Action LAB catalog is clean, isolated, explicit and truthful',()=>{
 assert.deepEqual(ACTION_LAB_SCENARIOS.map(s=>s.id),
  ['pass','shot','challenge','control','carry']);
 assert.equal(new Set(ACTION_LAB_SCENARIOS.map(s=>s.initial.seed)).size,5);
 for(const spec of ACTION_LAB_SCENARIOS){
  assert.ok(Object.isFrozen(spec)&&Object.isFrozen(spec.initial));
  assert.ok(Object.isFrozen(spec.focus));
  assert.equal(spec.officialResult,false);
  assert.equal(getActionLabScenario(spec.id),spec);
  const initial=classifyActionLabEvidence(spec,{
   tick:0,action:null,starts:[],events:[]
  });
  assert.equal(initial.witnessed,false);
  assert.equal(initial.officialGoal,false);
  assert.equal(initial.officialPossession,false);
  assert.equal(initial.tackleConfirmed,null);
  assert.equal(initial.dribbleConfirmed,null);
  assert.equal(initial.passCompleted,null);
 }
 assert.throws(()=>getActionLabScenario('official-goal'),RangeError);
 const pass=getActionLabScenario('pass');
 assert.throws(()=>classifyActionLabEvidence(pass,{
  tick:1,action:{action:'pass',tick:1,playerId:'home-10',
   appliedByRapier:false,actualPhysicsImpulseApplied:true,
   officialMatchAction:false},starts:['home-10']
 }),TypeError);
 assert.throws(()=>classifyActionLabEvidence(pass,{
  tick:1,action:{action:'pass',tick:1,playerId:'home-10',
   appliedByRapier:true,actualPhysicsImpulseApplied:true,
   officialMatchAction:false},starts:['home-10','away-10']
 }),TypeError);
 const html=readFileSync(new URL('../lab/index.html',import.meta.url),'utf8');
 const dev=readFileSync(new URL('../../tools/dev-standings-preview.mjs',import.meta.url),'utf8');
 for(const spec of ACTION_LAB_SCENARIOS)
  assert.match(html,new RegExp('<option value="'+spec.id+'">'));
 assert.match(html,/id="action-labs-dialog"/);
 assert.match(html,/id="action-labs-open"/);
 assert.match(dev,/__fa_match_engine__\/action-labs\.mjs/);
 assert.match(dev,/__fa_match_engine__\/action-lab-scenarios\.mjs/);
});

test('Controlled action LABs retain REAL 60Hz shoe contacts, separate positive from pending',async()=>{
 const R=await initializeRapier(rapier);
 const horizons={pass:80,shot:115,challenge:420,control:430,carry:260};
 const witnessed={};
 for(const spec of ACTION_LAB_SCENARIOS){
  const lab=createControlledActionLab(R,spec.id);
  try{
   const zero=lab.snapshot();
   assert.equal(zero.physicsTick,0);
   assert.equal(zero.players.length,22);
   assert.equal(zero.officialMatchResult,null);
   assert.equal(zero.officialMatchPossession,false);
   let positive=null,physicalStarts=0;
   for(let tick=1;tick<=horizons[spec.id];tick++){
    const frame=lab.step();
    assert.equal(frame.physicsTick,tick);
    assert.equal(frame.players.length,22);
    assert.equal(frame.officialMatchResult,null);
    assert.equal(frame.officialMatchPossession,false);
    assert.equal(frame.scoreChanged,false);
    assert.equal(frame.evidence.officialGoal,false);
    assert.equal(frame.evidence.officialPossession,false);
    assert.equal(frame.evidence.tackleConfirmed,null);
    assert.equal(frame.evidence.dribbleConfirmed,null);
    assert.equal(frame.evidence.passCompleted,null);
    physicalStarts+=frame.starts.length;
    if(frame.evidence.witnessed&&!positive){
     positive={tick,action:frame.action?.action??null,
      actor:frame.action?.playerId??frame.starts[0]??null};
    }
    if(positive&&spec.id!=='challenge')break;
   }
   witnessed[spec.id]={positive,physicalStarts};
   // The challenges LAB intentionally reports opposing physical events,
   // never a completed tackle if the controlled window has none.
   if(['pass','shot','control','carry'].includes(spec.id))
    assert.ok(positive,spec.id+' never produced an authenticated controlled witness');
   if(positive&&['pass','shot','carry'].includes(spec.id))
    assert.equal(positive.action,spec.goal);
  }finally{lab.dispose();}
  assert.throws(()=>lab.step(),/disposed/);
 }
 process.stdout.write('ME_ACTION_LABS_REAL '+JSON.stringify(witnessed)+'\n');
});
