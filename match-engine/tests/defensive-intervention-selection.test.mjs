import test from 'node:test';
import assert from 'node:assert/strict';
import {selectDefensiveIntervention,planNativeShotBlock} from '../src/defensive-intervention-selection.mjs';

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

import {selectPermittedDefensiveTouch as sharedPermittedTouch} from '../src/defensive-intervention-selection.mjs';
import {createNativeDuelFundamentalMask,nativeDefensiveInterventionAllowed} from '../src/native-fundamental-mask.mjs';
test('ME-01-QA U-01F3c: shared defensive geometry and subtype contact filtering',()=>{
 for(const team of ['home','away'])for(const polarity of [1,-1]){
  const dir=team==='home'?-polarity:polarity;
  const player={id:team+'-2',team,role:'defender',x:dir*5,y:0,vx:0,vy:0};
  const ball={x:0,y:0},velocity={x:dir*10,y:0};
  const feasible=planNativeShotBlock({player,ball,velocity,attackPolarity:polarity});
  assert.equal(feasible.actorId,player.id);assert.equal(feasible.etaS,.5);
  assert.equal(planNativeShotBlock({player:{...player,y:10},ball,velocity,attackPolarity:polarity}),null);
  assert.equal(planNativeShotBlock({player,ball,velocity:{x:-velocity.x,y:0},attackPolarity:polarity}),null);
  for(const profile of ['standing','sliding','shoulder','interception','mixed']){
   const mask=createNativeDuelFundamentalMask(profile);
   for(const sliding of [false,true]){
    const touch=Object.freeze({kind:'tackle',actorId:player.id});
    assert.equal(sharedPermittedTouch(touch,mask,{sliding}),nativeDefensiveInterventionAllowed(mask,sliding?'sliding-tackle':'standing-tackle')?touch:null);
   }
   const touch=Object.freeze({kind:'interception',actorId:player.id});
   assert.equal(sharedPermittedTouch(touch,mask),nativeDefensiveInterventionAllowed(mask,'interception')?touch:null);
   assert.equal(sharedPermittedTouch(null,mask),null);
  }
 }
});
