import test from 'node:test';
import assert from 'node:assert/strict';
import rapier from '@dimforge/rapier3d-compat';
import {initializeRapier} from '../src/core.mjs';
import {createControlledActionLab} from '../src/action-labs.mjs';
import {INITIAL_PLAYERS} from '../src/player-movement.mjs';
import {smallSidedSetup} from '../src/small-sided-lab-scenarios.mjs';
import {chooseIsolatedDribbleTouch} from '../src/isolated-dribble-touches.mjs';
test('#628 1v1 pure varied native-ground-touch intent is reproducible and mirrored',()=>{
 const b={x:30,y:2},d={team:'away',x:33,y:1};
 const params={variantIndex:7,tick:10,attackingSide:'home',ballPosition:b,defender:d};
 const a=chooseIsolatedDribbleTouch(params);
 assert.deepEqual(a,chooseIsolatedDribbleTouch(params));
 const mirror=chooseIsolatedDribbleTouch({...params,attackingSide:'away',
  ballPosition:{x:-30,y:2},defender:{team:'home',x:-33,y:1}});
 assert.equal(a.dx,-mirror.dx);assert.equal(a.dy,mirror.dy);
 assert.equal(a.magnitudeNs,mirror.magnitudeNs);
 assert.notEqual(a.magnitudeNs,chooseIsolatedDribbleTouch({...params,variantIndex:9}).magnitudeNs);
 assert.ok(a.magnitudeNs>=0.30&&a.magnitudeNs<=0.54);
 assert.equal(a.officialPossession,false);assert.equal(a.verifiedSecondTouch,false);
 assert.equal(chooseIsolatedDribbleTouch({...params,variantIndex:0}).magnitudeNs,0.42);
 assert.throws(()=>chooseIsolatedDribbleTouch({...params,variantIndex:30}),TypeError);
});
test('#628 actual 1v1 native source: only attacker physical carry, 2 colliders, both sides and Bodies A/B',
 {timeout:120000},async()=>{
 const R=await initializeRapier(rapier),magnitudes=new Set();
 for(const side of ['home','away'])for(const variantIndex of [0,1,9,21]){
  const enemy=side==='home'?'away':'home';
  const setup=smallSidedSetup('dribble-1v1',side,INITIAL_PLAYERS,{variantIndex});
  assert.deepEqual([...setup.activeIds].sort(),[side+'-10',enemy+'-2'].sort());
  for(const bodyGuardEnabled of [false,true]){
   const lab=createControlledActionLab(R,'dribble-1v1',{shotSide:side,variantIndex,bodyGuardEnabled});
   try{
    assert.equal(lab.snapshot().genuinePhysicalPlayerCount,2);
    let touched=0;
    for(let tick=1;tick<=90;tick++){
     const frame=lab.step();
     assert.equal(frame.officialMatchResult,null);
     assert.equal(frame.officialMatchPossession,false);
     assert.ok(frame.starts.every(id=>setup.activeIds.includes(id)));
     if(frame.action){
      touched++;
      assert.equal(frame.action.action,'carry');
      assert.equal(frame.action.playerId,side+'-10');
      assert.deepEqual(frame.starts,[side+'-10']);
      assert.equal(frame.action.appliedByRapier,true);
      assert.equal(frame.action.actualPhysicsImpulseApplied,true);
      assert.equal(frame.action.officialMatchAction,false);
      const touch=frame.action.decisionContext.isolatedDribbleTouch;
      assert.equal(touch?.tick,tick);assert.equal(touch?.variantIndex,variantIndex);
      assert.equal(touch?.verifiedDribble,false);
      assert.ok(touch?.magnitudeNs>=0.30&&touch?.magnitudeNs<=0.54);
      magnitudes.add(touch.magnitudeNs.toFixed(6));
     }
     if(frame.refereeEvidence?.lastEvent)break;
    }
    assert.ok(touched>=1,'Native attacker shoe must touch '+side+' V'+variantIndex);
   }finally{lab.dispose();}
  }
 }
 assert.ok(magnitudes.size>=4,'real Rapier impulses should vary');
});
