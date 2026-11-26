// #628 LAB-VAR-02: PURE context discrimination and seeded reproducibility.
// This does NOT authorize a native Rapier shoe START or any score/possession.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseSmallSidedContextAction,chooseNativeFootballAction,SMALL_SIDED_CONTEXT_CHOICE_VERSION}
 from '../src/small-sided-context-choice.mjs';
const base=Object.freeze({
 situationId:'overload-2v1',tick:12,actorId:'home-10',
 team:'home',attackingSide:'home',
 goalDistanceM:20,nearestOpponentM:4.2,
 shotLaneClearanceM:3.6,passLaneClearanceM:3.5,
 recipientOpponentGapM:5,passForwardM:5,
 canShoot:true,canPass:true,canCarry:true
});
test('#628 contextual small-sided shot, safe-pass and carry choices are real eligible weighted options across seeds',()=>{
 const observed=new Set();
 for(let variantIndex=1;variantIndex<30;variantIndex++){
  const args={...base,variantIndex};
  const a=chooseSmallSidedContextAction(args);
  const b=chooseSmallSidedContextAction(args);
  assert.deepEqual(a,b,'same context and seed must reproduce an identical choice');
  assert.equal(a.version,SMALL_SIDED_CONTEXT_CHOICE_VERSION);
  assert.ok(a.weights.shot>0&&a.weights.pass>0&&a.weights.carry>0);
  assert.equal(a.officialMatchAction,false);
  assert.equal(a.officialPossession,false);
  assert.equal(a.officialGoal,false);
  const mirror=chooseSmallSidedContextAction({...args,
   team:'away',attackingSide:'away',actorId:'away-10'});
  assert.deepEqual(a,mirror,'mirrored HOME/AWAY shape must be decision identical');
  observed.add(a.selected);
 }
 assert.deepEqual([...observed].sort(),['carry','pass','shot'],
  'same basic situation can yield all three contextually feasible decisions');
});
test('#628 blocked affordances cannot be selected even with a favorable seeded draw',()=>{
 for(let variantIndex=1;variantIndex<30;variantIndex++){
  const carry=chooseSmallSidedContextAction({...base,variantIndex,
   canShoot:false,canPass:false,canCarry:true});
  assert.equal(carry.selected,'carry');
  assert.equal(carry.weights.shot,0);
  assert.equal(carry.weights.pass,0);
  const pass=chooseSmallSidedContextAction({...base,variantIndex,
   canShoot:false,canPass:true,canCarry:false});
  assert.equal(pass.selected,'pass');
  const shot=chooseSmallSidedContextAction({...base,variantIndex,
   canShoot:true,canPass:false,canCarry:false});
  assert.equal(shot.selected,'shot');
  assert.equal(chooseSmallSidedContextAction({...base,variantIndex,
   canShoot:false,canPass:false,canCarry:false}),null);
 }
});
test('#628 geometry changes preference by pressure, goal range and safe recipient',()=>{
 const far=chooseSmallSidedContextAction({...base,variantIndex:4,
  goalDistanceM:34,nearestOpponentM:7,passLaneClearanceM:3,
  recipientOpponentGapM:6});
 const near=chooseSmallSidedContextAction({...base,variantIndex:4,
  goalDistanceM:9,nearestOpponentM:1.8,passLaneClearanceM:3,
  recipientOpponentGapM:6});
 assert.ok(near.weights.shot>far.weights.shot,'close range boosts shooting');
 assert.ok(near.weights.pass>far.weights.pass,'pressure boosts safe passing');
 assert.ok(near.weights.carry<far.weights.carry,'pressure reduces dribbling');
});
test('#628 seed decision fails closed for untrusted scene, side, index or missing live geometry',()=>{
 for(const input of [
  {...base,variantIndex:0},{...base,variantIndex:30},
  {...base,variantIndex:1.3},{...base,variantIndex:2,team:'away'},
  {...base,variantIndex:2,actorId:'home-99'},
  {...base,variantIndex:2,situationId:'11v11'},
  {...base,variantIndex:2,passLaneClearanceM:0.3},
  {...base,variantIndex:2,shotLaneClearanceM:0.9},
  {...base,variantIndex:2,nearestOpponentM:NaN}
 ])assert.throws(()=>chooseSmallSidedContextAction(input));
});

 test('COL-03 collective choice is independent of initial shirt and side, including V01',()=>{
  for(let variantIndex=0;variantIndex<30;variantIndex++){
   const input={...base,variantIndex,collective:true};
   const choice=chooseSmallSidedContextAction(input);
   assert.deepEqual(choice,chooseSmallSidedContextAction({...input,actorId:'home-9'}));
   assert.deepEqual(choice,chooseSmallSidedContextAction({...input,team:'away',attackingSide:'away',actorId:'away-2'}));
   assert.equal(choice.sample,null);
   for(const kind of ['shot','pass','carry']){
    const only=chooseSmallSidedContextAction({...input,canShoot:kind==='shot',canPass:kind==='pass',canCarry:kind==='carry'});
    assert.equal(only.selected,kind);
   }
  }
 });

test('UME-02 native scoring matches the validated collective baseline without LAB metadata',()=>{
 for(const flags of [[true,true,true],[false,true,true],[true,false,false],[false,false,true],[false,false,false]]){
  const geometry={...base,canShoot:flags[0],canPass:flags[1],canCarry:flags[2]};
  const {situationId,tick,actorId,team,attackingSide,...affordances}=geometry;
  const shared=chooseNativeFootballAction(affordances);
  assert.deepEqual(shared,chooseSmallSidedContextAction({...geometry,variantIndex:0,collective:true}));
  assert.deepEqual(shared,chooseSmallSidedContextAction({...geometry,variantIndex:29,collective:true}));
 }
});
