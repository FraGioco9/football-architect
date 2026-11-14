// C3.3g: deterministic read-only foot facing geometry. These are
// mathematical bounds, NOT 3D solver contacts, kick or possession claims.
import test from 'node:test';
import assert from 'node:assert/strict';
import {measureOrientedCarryShoeBallGeometry}
 from '../src/player-ball-carry-oriented-shoe-geometry.mjs';
import {FOOT_CONTACT_FORWARD_OFFSET_M,FOOT_CONTACT_CENTER_HEIGHT_M,
 FOOT_CONTACT_HALF_LENGTH_M,FOOT_CONTACT_ROUNDING_M}
 from '../src/player-foot-contact.mjs';
import {BALL_RADIUS} from '../src/core.mjs';
const near=(x,y)=>assert.ok(Math.abs(x-y)<=1e-9,`${x} vs ${y}`);

test('C3.3g true rotated Rapier shoe pose changes *estimated* geometry only',()=>{
 const a={id:'home-9',team:'home',x:0,y:0,facingRad:0};
 const forward=measureOrientedCarryShoeBallGeometry(a,{
  x:FOOT_CONTACT_FORWARD_OFFSET_M+FOOT_CONTACT_HALF_LENGTH_M+
   FOOT_CONTACT_ROUNDING_M+BALL_RADIUS+0.1,
  y:0,z:FOOT_CONTACT_CENTER_HEIGHT_M
 });
 near(forward.estimatedStaticSurfaceClearanceM,0.1);
 near(forward.relativeBallLateralM,0);
 near(forward.shoeCenter.x,FOOT_CONTACT_FORWARD_OFFSET_M);
 assert.equal(forward.actualRapierCollisionInferred,false);
 assert.equal(forward.officialMatchPossession,false);
 const sameBall={x:0,y:0.65,z:BALL_RADIUS};
 const alongX=measureOrientedCarryShoeBallGeometry(a,sameBall);
 const facingY=measureOrientedCarryShoeBallGeometry({
  ...a,facingRad:Math.PI/2
 },sameBall);
 assert.ok(facingY.estimatedStaticSurfaceClearanceM<
  alongX.estimatedStaticSurfaceClearanceM,
  'turning the true 22cm-oriented foot changes clearance without touch');
 assert.ok(facingY.shoeBallCenter3DGapM<
  alongX.shoeBallCenter3DGapM);
 assert.equal(facingY.engineId,'home-9');
 assert.equal(Object.isFrozen(facingY),true);
 assert.equal(Object.isFrozen(facingY.shoeCenter),true);
});
test('C3.3g mirror HOME/AWAY and reject inauthentic input',()=>{
 for(const team of ['home','away']){
  const x=team==='home'?1:-1;
  const g=measureOrientedCarryShoeBallGeometry({
   id:team+'-10',team,x:0,y:0,facingRad:team==='home'?0:Math.PI
  },{x:x*0.45,y:0,z:BALL_RADIUS});
  near(g.estimatedStaticSurfaceClearanceM,0);
  near(g.bodyBallXYGapM,0.45);
  assert.equal(g.ballControlConfirmed,null);
  assert.equal(g.dribbleConfirmed,null);
 }
 assert.throws(()=>measureOrientedCarryShoeBallGeometry({
  id:'away-2',team:'away',x:0,y:0,facingRad:Infinity
 },{x:0,y:0,z:0.11}),/oriented shoe/);
 assert.throws(()=>measureOrientedCarryShoeBallGeometry({
  id:'home-1',team:'home',x:0,y:0,facingRad:0
 },{x:0,y:0,z:-0.01}),/real ball centers/);
});
