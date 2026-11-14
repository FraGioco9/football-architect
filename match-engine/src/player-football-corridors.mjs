// P2 observation-only corridor measurements from a P1 canonical-shaped frame.
// This is NOT a pass-lane eligibility check or an action authorization.
// No scoring weights, simulated touches, contact claims or ball writes.
import {chooseObservedFootballIntent}
 from './player-football-intent.mjs';

export const FOOTBALL_CORRIDOR_MEASUREMENT_VERSION=
 'me-p2-raw-passing-corridor-observation-v1';

const compareId=(a,b)=>a<b?-1:a>b?1:0;
const segmentFoot=(start,end,point)=>{
 const dx=end.x-start.x,dy=end.y-start.y;
 const lengthSquared=dx*dx+dy*dy;
 const fraction=lengthSquared===0?0:Math.max(0,Math.min(1,
  ((point.x-start.x)*dx+(point.y-start.y)*dy)/lengthSquared));
 return Object.freeze({
  segmentFraction:fraction,
  distanceToSegmentM:Math.hypot(
   point.x-(start.x+fraction*dx),point.y-(start.y+fraction*dy))
 });
};
const nearestBody=(players,start,end)=>{
 let nearest=null;
 for(const player of players){
  const distance=segmentFoot(start,end,player);
  const candidate={
   playerId:player.id,
   distanceToSegmentM:distance.distanceToSegmentM,
   segmentFraction:distance.segmentFraction
  };
  if(!nearest||
     candidate.distanceToSegmentM<nearest.distanceToSegmentM||
     (candidate.distanceToSegmentM===nearest.distanceToSegmentM&&
      compareId(candidate.playerId,nearest.playerId)<0))
   nearest=candidate;
 }
 return nearest?Object.freeze(nearest):null;
};

// DESCRIPTIVE geometry only: 10 same-team receiver directions from the
// current observed BALL position, not a projected foot/trajectory.
// Accepts only a zero-affordance P1 observation; a forged frame cannot
// authenticate physics and must never be passed from an external API.
export function measureObservedPassingCorridors(observation){
 if(!observation||observation.phase!=='ball-opportunity'||
    !Array.isArray(observation.affordances)||
    observation.affordances.length!==0)
  throw new TypeError('Untrusted or non-ball-opportunity observation');
 // Reuse the complete P1 bounded-frame validator, not a second policy.
 if(chooseObservedFootballIntent(observation)!==null)
  throw new TypeError('This read-only observer cannot accept action intents');
 const {playerId,team,frame}=observation;
 const origin=Object.freeze({x:frame.ball.x,y:frame.ball.y});
 const receivers=frame.players.filter(p=>p.team===team&&p.id!==playerId)
  .sort((a,b)=>compareId(a.id,b.id));
 const corridors=Object.freeze(receivers.map(receiver=>{
  const end=Object.freeze({x:receiver.x,y:receiver.y});
  const otherBodies=frame.players.filter(p=>
   p.id!==playerId&&p.id!==receiver.id);
  return Object.freeze({
   targetPlayerId:receiver.id,target:Object.freeze(end),
   segmentLengthM:Math.hypot(end.x-origin.x,end.y-origin.y),
   degenerateSegment:end.x===origin.x&&end.y===origin.y,
   nearestOpponent:nearestBody(
    otherBodies.filter(p=>p.team!==team),origin,end),
   nearestOtherTeammate:nearestBody(
    otherBodies.filter(p=>p.team===team),origin,end),
   passEligible:null,passExecuted:false,
   physicalContactProven:false
  });
 }));
 return Object.freeze({
  version:FOOTBALL_CORRIDOR_MEASUREMENT_VERSION,
  physicsTick:observation.physicsTick,playerId,team,origin,
  corridors,readOnly:true,physicalActionExecuted:false,
  authorizedAffordances:Object.freeze([]),
  officialMatchAction:false
 });
}

// Compare two strictly consecutive *observed* completed 60Hz frames, never
// extrapolate a ball or player. Changes can be caused by the ball, receiver,
// opponent or teammate moving; they are not evidence of future pass safety.
// The input must be source-bound by its future internal fixture runtime caller.
export function measureObservedPassingCorridorChanges(previous,current){
 const older=measureObservedPassingCorridors(previous);
 const newer=measureObservedPassingCorridors(current);
 if(previous.physicsTick!==previous.frame.tick||
    current.physicsTick!==current.frame.tick||
    !Number.isSafeInteger(previous.physicsTick+1)||
    current.physicsTick!==previous.physicsTick+1||
    previous.playerId!==current.playerId||
    previous.team!==current.team||
    previous.phase!==current.phase)
  throw new TypeError('Consecutive full 60Hz actor observations required');
 // An observed player ID must not silently switch teams or disappear.
 const currentTeams=new Map(current.frame.players.map(p=>[p.id,p.team]));
 if(previous.frame.players.some(p=>currentTeams.get(p.id)!==p.team))
  throw new TypeError('Identical observed actor/team identities required');
 const byId=new Map(older.corridors.map(c=>[c.targetPlayerId,c]));
 const changes=Object.freeze(newer.corridors.map(next=>{
  const before=byId.get(next.targetPlayerId);
  if(!before)throw new TypeError('Matching observed receivers required');
  return Object.freeze({
   targetPlayerId:next.targetPlayerId,
   receiverDisplacementM:Math.hypot(next.target.x-before.target.x,
    next.target.y-before.target.y),
   segmentLengthDeltaM:next.segmentLengthM-before.segmentLengthM,
   nearestOpponentPreviousId:before.nearestOpponent?.playerId??null,
   nearestOpponentCurrentId:next.nearestOpponent?.playerId??null,
   nearestOpponentChanged:before.nearestOpponent?.playerId!==
    next.nearestOpponent?.playerId,
   nearestOpponentCenterlineDistanceDeltaM:
    next.nearestOpponent&&before.nearestOpponent?
     next.nearestOpponent.distanceToSegmentM-
      before.nearestOpponent.distanceToSegmentM:null,
   nearestTeammatePreviousId:before.nearestOtherTeammate?.playerId??null,
   nearestTeammateCurrentId:next.nearestOtherTeammate?.playerId??null,
   nearestTeammateChanged:before.nearestOtherTeammate?.playerId!==
    next.nearestOtherTeammate?.playerId,
   nearestTeammateCenterlineDistanceDeltaM:
    next.nearestOtherTeammate&&before.nearestOtherTeammate?
     next.nearestOtherTeammate.distanceToSegmentM-
      before.nearestOtherTeammate.distanceToSegmentM:null,
   passEligible:null,physicalContactProven:false,passExecuted:false
  });
 }));
 return Object.freeze({
  version:'me-p2-consecutive-corridor-change-observation-v1',
  previousTick:previous.physicsTick,currentTick:current.physicsTick,
  playerId:current.playerId,team:current.team,
  ballDisplacementM:Math.hypot(
   newer.origin.x-older.origin.x,newer.origin.y-older.origin.y),
  changes,readOnly:true,physicalActionExecuted:false,
  authorizedAffordances:Object.freeze([]),officialMatchAction:false
 });
}
