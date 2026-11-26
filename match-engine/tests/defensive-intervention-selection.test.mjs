import test from 'node:test';
import assert from 'node:assert/strict';
import {selectDefensiveIntervention} from '../src/defensive-intervention-selection.mjs';

test('D-14 contextual priorities, independent of team and shirt number',()=>{
 for(const actorId of ['home-10','away-2','home-7','away-11']){
  const choose=(fields)=>selectDefensiveIntervention({actorId,...fields});
  const shoulder={sideOn:true,parallel:true},standing={kind:'tackle'},sliding={target:{x:1,y:2}},
   interception={reachable:true,target:{x:3,y:4}},block={target:{x:5,y:6}};
  assert.equal(choose({shoulder,standing,sliding,ballGapM:0.5}).kind,'shoulder-challenge');
  assert.equal(choose({shoulder:{sideOn:true,parallel:false},standing,sliding,ballGapM:0.5}).kind,'standing-tackle');
  assert.equal(choose({standing,sliding,ballGapM:0.9}).kind,'sliding-tackle');
  assert.equal(choose({standing,ballGapM:0.8}).kind,'standing-tackle');
  assert.equal(choose({interception}).kind,'interception');
  assert.equal(choose({context:'pass',interception,standing,sliding,shoulder}).kind,'interception');
  assert.equal(choose({context:'shot',block,interception,standing,sliding,shoulder}).kind,'block');
  assert.equal(choose({context:'shot',standing,interception}).kind,'none');
  assert.equal(choose({context:'pass',standing,sliding}).kind,'none');
  assert.equal(choose({unavailable:true,shoulder,standing,sliding,interception,block}).kind,'none');
  assert.equal(choose({recovering:true,shoulder,standing,sliding}).kind,'recover');
  assert.equal(choose({activeSlide:true,shoulder,standing,sliding}).kind,'sliding-tackle');
  assert.equal(choose({interception:{reachable:false}}).kind,'none');
  assert.equal(choose({shoulder:{sideOn:false,parallel:true}}).kind,'none');
  const d=choose({context:'shot',block});
  assert.equal(d.actorId,actorId);assert.equal(d.decisionOnly,true);
  assert.equal(d.physicalContactProven,false);assert.equal(d.officialPossession,false);
  assert.equal(Object.isFrozen(d),true);
 }
});
