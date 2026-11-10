// ME-PLAYER-01/24 — autonomous movement and current handoff-corridor safety.
// 22 tactical placeholders at fixed 60Hz, using the actual ball XY position.
// Research LAB only. No Rapier bodies, ball contact, official world or club data.
export const PLAYER_VERSION='me-player-34-observed-duty-measured-pace-v1';
export const PLAYER_DT=1/60;
export const PLAYER_PITCH=Object.freeze({lengthM:105,widthM:68});
export const PLAYER_RADIUS_M=0.44;
export const PLAYER_MIN_SEPARATION_M=2*PLAYER_RADIUS_M+0.10;
export const PLAYER_MAX_SPEED_MPS=7;
export const PLAYER_ACCEL_MPS2=9;
export const PLAYER_BRAKE_MPS2=12;
export const PLAYER_TURN_RAD_PER_S=6;
export const PLAYER_PRESS_OFFSET_M=1.8;
export const PLAYER_PRESS_SWITCH_ADVANTAGE_M=3;
export const PLAYER_PRESS_START_RANGE_M=30;
export const PLAYER_PRESS_HOLD_RANGE_M=34;
export const PLAYER_FLANK_NARROW_MAX=0.16;
export const PLAYER_COVER_GOALSIDE_OFFSET_M=6;
export const PLAYER_COVER_LANE_OFFSET_M=3;
export const PLAYER_COVER_SWITCH_ADVANTAGE_M=3;
export const PLAYER_OWN_THIRD_NARROW_DEFENDERS=0.12;
export const PLAYER_OWN_THIRD_NARROW_MIDFIELDERS=0.06;
export const PLAYER_SCREEN_THREAT_RANGE_M=22;
export const PLAYER_SCREEN_HALF_ADVANCE_M=10;
export const PLAYER_SCREEN_SWITCH_ADVANTAGE_M=3;
export const PLAYER_SCREEN_GOALSIDE_OFFSET_M=4;
export const PLAYER_SCREEN_CHANNEL_OFFSET_M=2.5;
export const PLAYER_SUPPORT_DEPTH_M=8;
export const PLAYER_SUPPORT_LANE_OFFSET_M=11;
export const PLAYER_SUPPORT_ASSIGNMENT_HYSTERESIS_M=3;
export const PLAYER_SUPPORT_LANE_HYSTERESIS_M=2.5;
export const PLAYER_SUPPORT_TEAM_SPACING_M=6;
export const PLAYER_SUPPORT_TEAM_CROWD_PENALTY=2;
export const PLAYER_SUPPORT_TEAM_CLEARANCE_WEIGHT=0.4;
export const PLAYER_KEEPER_MIN_DEPTH_M=2.5;
export const PLAYER_KEEPER_MAX_DEPTH_M=9;
export const PLAYER_KEEPER_DEPTH_GAIN=0.075;
export const PLAYER_KEEPER_MAX_LATERAL_M=5.5;
export const PLAYER_RECOVERY_GOALSIDE_M=4;
export const PLAYER_RECOVERY_LANE_GAIN=0.14;
export const PLAYER_RECOVERY_MAX_LATERAL_M=3;
export const PLAYER_BALANCE_GOALSIDE_M=2;
export const PLAYER_BALANCE_MAX_LATERAL_M=2;
export const PLAYER_BALANCE_LANE_GAIN=0.10;
export const PLAYER_BALANCE_MIN_LANE_DISTANCE_M=10;
export const PLAYER_BALANCE_SWITCH_ADVANTAGE_M=3;
export const PLAYER_LINE_DEFENDER_MAX_EXTRA_M=1.5;
export const PLAYER_LINE_MIDFIELDER_MAX_EXTRA_M=2.5;
export const PLAYER_LINE_DEFENDER_LANE_GAIN=0.06;
export const PLAYER_LINE_MIDFIELDER_LANE_GAIN=0.10;
export const PLAYER_LINE_EXTRA_LANE_MAX_M=1.5;
export const PLAYER_LINE_INTENT_EASE_MPS=8;
export const PLAYER_LINE_INTENT_SETTLED_EPS_M=1e-8;
export const PLAYER_COHESION_MIN_GAP_M=10;
export const PLAYER_COHESION_MAX_GAP_M=19;
export const PLAYER_COHESION_DEFENDER_DEPTH_GAIN=0.22;
export const PLAYER_COHESION_MIDFIELDER_DEPTH_GAIN=0.33;
export const PLAYER_COHESION_DEFENDER_MAX_X_M=1.5;
export const PLAYER_COHESION_MIDFIELDER_MAX_X_M=2.5;
export const PLAYER_COHESION_LATERAL_TOLERANCE_M=6;
export const PLAYER_COHESION_DEFENDER_LATERAL_GAIN=0.16;
export const PLAYER_COHESION_MIDFIELDER_LATERAL_GAIN=0.22;
export const PLAYER_COHESION_DEFENDER_MAX_Y_M=1;
export const PLAYER_COHESION_MIDFIELDER_MAX_Y_M=1.5;
export const PLAYER_TEAMMATE_CLEARANCE_M=5;
export const PLAYER_TEAMMATE_CLEARANCE_GAIN=0.5;
export const PLAYER_TEAMMATE_CLEARANCE_MAX_SHIFT_M=1.25;
export const PLAYER_TEAMMATE_CLEARANCE_SWITCH_ADVANTAGE_M=0.75;
export const PLAYER_CROSSING_LOOKAHEAD_S=1.5;
export const PLAYER_CROSSING_GUARD_M=2.5;
export const PLAYER_CROSSING_MAX_SHIFT_M=0.9;
export const PLAYER_CROSSING_MIN_REL_SPEED_MPS=1;
export const PLAYER_CROSSING_MAX_ABS_HEADING_COS=0.85;
export const PLAYER_CROSSING_MIN_ETA_S=0.1;
export const PLAYER_CROSSING_MAX_NEIGHBOR_M=22;
export const PLAYER_CROSSING_INTENT_EASE_MPS=4;
export const PLAYER_CROSSING_INTENT_SETTLED_EPS_M=1e-8;
export const PLAYER_STALL_CONFIRM_TICKS=12;
export const PLAYER_DETOUR_RELEASE_DISTANCE_M=3.2;
export const PLAYER_DETOUR_WAYPOINT_LATERAL_M=1.8;
export const PLAYER_DETOUR_WAYPOINT_BACK_M=0.25;
export const PLAYER_DETOUR_RETRY_COOLDOWN_TICKS=30;
export const PLAYER_DETOUR_SIDE_CLEARANCE_ADVANTAGE_M=0.25;
export const PLAYER_DETOUR_PROGRESS_MIN_STEP_M=0.005;
export const PLAYER_DETOUR_STAGNANT_WARNING_TICKS=12;
export const PLAYER_DETOUR_STAGNANT_ABORT_TICKS=24;
export const PLAYER_DETOUR_MAX_ACTIVE_TICKS=180;
export const PLAYER_DETOUR_OFF_COURSE_MIN_MOVEMENT_M=0.005;
export const PLAYER_DETOUR_COMPLETION_RADIUS_M=0.65;
export const PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M=1.25;
export const PLAYER_DETOUR_REJOIN_LOOKAHEAD_M=3;
export const PLAYER_REJOIN_HANDOFF_TICKS=24;
export const PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M=2.5;
export const PLAYER_REJOIN_HANDOFF_MIN_SPEED_MPS=0.5;
export const PLAYER_REJOIN_HANDOFF_MAX_BLEND=0.7;
export const PLAYER_OBSERVED_MOTION_THRESHOLD_MPS=0.2;
export const PLAYER_OBSERVED_VECTOR_SECONDS=0.4;
export const PLAYER_OBSERVED_PATH_WINDOW_TICKS=120;
const baseFormation=Object.freeze([
 [-48,0],[-35,-22],[-35,-8],[-35,8],[-35,22],
 [-20,-16],[-20,0],[-20,16],[-5,-18],[-5,0],[-5,18]
]);
const role=i=>i===0?'goalkeeper':i<5?'defender':i<8?'midfielder':'forward';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const INITIAL_PLAYERS=Object.freeze(['home','away'].flatMap(team=>
 baseFormation.map(([x,y],i)=>Object.freeze({
  id:team+'-'+(i+1),team,number:i+1,role:role(i),
  baseX:team==='home'?x:-x,baseY:y,
  x:team==='home'?x:-x,y,
  vx:0,vy:0,blockedBy:null,facingRad:team==='home'?0:Math.PI
 }))
));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function ballXY(input){
 if(!input||!finite(input.x)||!finite(input.y))
   throw new TypeError('Finite ball XY state required');
 return Object.freeze({x:clamp(input.x,-PLAYER_PITCH.lengthM/2,PLAYER_PITCH.lengthM/2),
  y:clamp(input.y,-PLAYER_PITCH.widthM/2,PLAYER_PITCH.widthM/2)});
}
// Position-only goalkeeper intent: choose a conservative goal-line depth and
// cover the angle towards the REAL ball XY, never claiming a save, interception
// or goalkeeper ball touch. Both goals use the same mirrored 105 m pitch.
export function goalkeeperPosition(team,ballPosition){
 if(team!=='home'&&team!=='away')throw new TypeError('Known goalkeeper team required');
 const ball=ballXY(ballPosition),goalX=team==='home'?
  -PLAYER_PITCH.lengthM/2:PLAYER_PITCH.lengthM/2;
 const distanceX=Math.abs(ball.x-goalX);
 const depthM=clamp(
  PLAYER_KEEPER_MIN_DEPTH_M+distanceX*PLAYER_KEEPER_DEPTH_GAIN,
  PLAYER_KEEPER_MIN_DEPTH_M,PLAYER_KEEPER_MAX_DEPTH_M);
 const x=goalX+(team==='home'?depthM:-depthM);
 // Project the direction goal-centre -> ball onto the keeper's depth
 // and cap lateral patrol. Never let the target pass the goal line.
 const y=clamp(ball.y*depthM/Math.max(distanceX,PLAYER_KEEPER_MIN_DEPTH_M),
  -PLAYER_KEEPER_MAX_LATERAL_M,PLAYER_KEEPER_MAX_LATERAL_M);
 return Object.freeze({x,y,depthM});
}
// Pre-existing presser remains assigned until a challenger has a meaningful
// formation-proximity advantage. Avoid 60Hz press ping-pong on lane boundaries.
function pressingPlayer(players,team,ball,incumbentId){
 const candidates=players.filter(p=>p.team===team&&p.role!=='goalkeeper');
 let best=null,bestDist=Infinity;
 for(const p of candidates){
  const d=Math.hypot(p.baseX-ball.x,p.baseY-ball.y);
  if(d<bestDist){best=p;bestDist=d;}
 }
 const incumbent=candidates.find(p=>p.id===incumbentId);
 if(incumbent){
  const incumbentDist=Math.hypot(incumbent.baseX-ball.x,incumbent.baseY-ball.y);
  if(incumbentDist<=PLAYER_PRESS_HOLD_RANGE_M&&
    incumbentDist<=bestDist+PLAYER_PRESS_SWITCH_ADVANTAGE_M)return incumbent;
 }
 // A returning presser can remain until the wider hold threshold; only
 // a newly assigned presser must satisfy the narrower start threshold.
 if(bestDist>PLAYER_PRESS_START_RANGE_M)return null;
 return best;
}
// A dedicated defensive screen follows the ball on the goal-facing side
// only in the team's own third. Selection is deterministic and hysteretic;
// no possession/contact event or ball ownership is inferred.
function coveringDefender(players,team,ball,presserId,incumbentId){
 const ownThird=team==='home'?'home-third':'away-third';
 if(ballSector(ball).third!==ownThird)return null;
 const desiredX=clamp(ball.x+(team==='home'?
   -PLAYER_COVER_GOALSIDE_OFFSET_M:PLAYER_COVER_GOALSIDE_OFFSET_M),
   -PLAYER_PITCH.lengthM/2+PLAYER_RADIUS_M,
   PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M);
 const eligible=players.filter(p=>p.team===team&&
   p.role==='defender'&&p.id!==presserId);
 let best=null,bestDist=Infinity;
 for(const p of eligible){
  const d=Math.hypot(p.baseX-desiredX,p.baseY-ball.y);
  if(d<bestDist){best=p;bestDist=d;}
 }
 if(!best)return null;
 const incumbent=eligible.find(p=>p.id===incumbentId);
 if(incumbent){
  const incumbentDist=Math.hypot(incumbent.baseX-desiredX,incumbent.baseY-ball.y);
  if(incumbentDist<=bestDist+PLAYER_COVER_SWITCH_ADVANTAGE_M)return incumbent;
 }
 return best;
}
// Opponent-aware *zonal screen*, not marking/tackle/possession.
// A real opponent must have entered our own third and be within the ball's
// local 22m neighborhood. Pick at most one visible threat per defending team.
// Incumbent hysteresis avoids assignment flicker at 60Hz.
function advancedOppositionThreat(players,team,ball,incumbentId){
 const defendingHome=team==='home';
 // An opposing player must have travelled at least 10m into our own
 // half. Require the BALL to be in our own third separately in zonalScreen.
 const threats=players.filter(p=>
  p.team!==team&&p.role!=='goalkeeper'&&
  (defendingHome?p.x< -PLAYER_SCREEN_HALF_ADVANCE_M:
    p.x>PLAYER_SCREEN_HALF_ADVANCE_M)&&
  Math.hypot(p.x-ball.x,p.y-ball.y)<=PLAYER_SCREEN_THREAT_RANGE_M);
 if(!threats.length)return null;
 let best=null,bestDist=Infinity;
 for(const p of threats){
  const d=Math.hypot(p.x-ball.x,p.y-ball.y);
  if(d<bestDist){bestDist=d;best=p;}
 }
 const incumbent=threats.find(p=>p.id===incumbentId);
 if(incumbent){
  const d=Math.hypot(incumbent.x-ball.x,incumbent.y-ball.y);
  if(d<=bestDist+PLAYER_SCREEN_SWITCH_ADVANTAGE_M)return incumbent;
 }
 return best;
}
function zonalScreen(players,team,ball,presserId,covererId,incumbent){
 const ownThird=team==='home'?'home-third':'away-third';
 if(ballSector(ball).third!==ownThird)return null;
 const opponent=advancedOppositionThreat(players,team,ball,incumbent?.opponentId);
 if(!opponent)return null;
 // A different defender from pressing / goal-side covering screens
 // the goal-facing space behind one actual opposing outfield player.
 const defenders=players.filter(p=>p.team===team&&p.role==='defender'&&
  p.id!==presserId&&p.id!==covererId);
 let best=null,bestScore=Infinity;
 const score=p=>Math.abs(p.baseY-opponent.y)+0.2*Math.abs(p.baseX-opponent.x);
 for(const p of defenders){
  const current=score(p);
  if(current<bestScore){bestScore=current;best=p;}
 }
 const incumbentMarker=defenders.find(p=>p.id===incumbent?.defenderId);
 if(incumbentMarker&&score(incumbentMarker)<=
   bestScore+PLAYER_SCREEN_SWITCH_ADVANTAGE_M)best=incumbentMarker;
 return best?Object.freeze({defenderId:best.id,opponentId:opponent.id}):null;
}
// Space occupation is not a possession, pass-receiving, or dribbling event.
// In the opponent's third, one free midfielder/forward per side searches two
// channels behind the ball. All scoring uses real opposing player positions.
// Pure spatial preference with no game authority or player steering.
export function scoreCooperativeSupportSlot(opponentClearanceM,teammateClearanceM,formationOffsetM){
 if(![opponentClearanceM,teammateClearanceM,formationOffsetM].every(
   n=>typeof n==='number'&&Number.isFinite(n)&&n>=0))
  throw new TypeError('Finite nonnegative support distances required');
 return opponentClearanceM-0.12*formationOffsetM+
  PLAYER_SUPPORT_TEAM_CLEARANCE_WEIGHT*Math.min(
   PLAYER_SUPPORT_TEAM_SPACING_M,teammateClearanceM)-
  PLAYER_SUPPORT_TEAM_CROWD_PENALTY*Math.max(
   0,PLAYER_SUPPORT_TEAM_SPACING_M-teammateClearanceM);
}
function supportSpace(players,team,ball,presserId,covererId,screen,incumbent){
 const territory=ballSector(ball).third;
 const otherThird=team==='home'?'away-third':'home-third';
 if(territory!==otherThird)return null;
 const eligible=players.filter(p=>p.team===team&&
  (p.role==='midfielder'||p.role==='forward')&&
  p.id!==presserId&&p.id!==covererId&&p.id!==screen?.defenderId);
 if(!eligible.length)return null;
 let chosen=null,nearest=Infinity;
 const formationDistance=p=>Math.hypot(p.baseX-ball.x,p.baseY-ball.y);
 for(const p of eligible){
  const d=formationDistance(p);
  if(d<nearest){chosen=p;nearest=d;}
 }
 const previous=eligible.find(p=>p.id===incumbent?.playerId);
 if(previous&&formationDistance(previous)<=
   nearest+PLAYER_SUPPORT_ASSIGNMENT_HYSTERESIS_M)chosen=previous;
 const x=clamp(ball.x+(team==='home'?-PLAYER_SUPPORT_DEPTH_M:PLAYER_SUPPORT_DEPTH_M),
  -PLAYER_PITCH.lengthM/2+PLAYER_RADIUS_M,
  PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M);
 const opposition=players.filter(p=>p.team!==team);
 const teammates=players.filter(p=>p.team===team&&p.id!==chosen.id);
 const options=[-1,1].map(sign=>{
  const y=clamp(ball.y+sign*PLAYER_SUPPORT_LANE_OFFSET_M,
    -PLAYER_PITCH.widthM/2+PLAYER_RADIUS_M,
    PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M);
  const clearanceM=Math.min(...opposition.map(p=>Math.hypot(p.x-x,p.y-y)));
  const teammateClearanceM=Math.min(...teammates.map(p=>Math.hypot(p.x-x,p.y-y)));
  // Score actual opponents and teammates using one testable policy;
  // these are positional intentions, not an intervention or contact event.
  const score=scoreCooperativeSupportSlot(
   clearanceM,teammateClearanceM,Math.abs(y-chosen.baseY));
  return {lane:sign<0?'negative-y':'positive-y',x,y,clearanceM,
   teammateClearanceM,score};
 });
 let best=options[0];
 if(options[1].score>best.score)best=options[1];
 const held=options.find(o=>o.lane===incumbent?.lane);
 if(previous===chosen&&held&&held.score>=
   best.score-PLAYER_SUPPORT_LANE_HYSTERESIS_M)best=held;
 return Object.freeze({
  playerId:chosen.id,lane:best.lane,
  target:Object.freeze({x:best.x,y:best.y}),
  clearanceM:best.clearanceM,
  teammateClearanceM:best.teammateClearanceM
 });
}
// Weak-side duty requires a REAL observed opponent in our own third.
// Preserves a defender in the far lane instead of overloading recovery.
function weakSideDefender(players,team,screen,presserId,covererId,incumbent){
 if(!screen)return null;
 const opponent=players.find(p=>p.id===screen.opponentId&&
  p.team!==team&&p.role!=='goalkeeper');
 if(!opponent)return null;
 const eligible=players.filter(p=>p.team===team&&p.role==='defender'&&
  p.id!==presserId&&p.id!==covererId&&p.id!==screen.defenderId);
 const gap=p=>Math.abs(p.baseY-opponent.y);
 let best=null,bestGap=-Infinity;
 for(const p of eligible)if(gap(p)>bestGap){best=p;bestGap=gap(p);}
 if(!best||bestGap<PLAYER_BALANCE_MIN_LANE_DISTANCE_M)return null;
 const held=eligible.find(p=>p.id===incumbent?.playerId);
 if(held&&gap(held)>=PLAYER_BALANCE_MIN_LANE_DISTANCE_M&&
  gap(held)>=bestGap-PLAYER_BALANCE_SWITCH_ADVANTAGE_M)best=held;
 return Object.freeze({playerId:best.id,opponentId:opponent.id});
}
// Position-only, collective defensive recovery: help the existing zonal
// screen by moving otherwise unassigned defenders/midfielders goal-side.
// It activates ONLY for a real opposing outfielder already observed by the
// zonal screen, never from ball territory alone or imagined possession.
function defensiveRecovery(players,team,screen,presserId,covererId,balancerId){
 if(!screen)return null;
 const playerIds=players.filter(p=>p.team===team&&
  (p.role==='defender'||p.role==='midfielder')&&
  p.id!==presserId&&p.id!==covererId&&p.id!==screen.defenderId&&
  p.id!==balancerId
 ).map(p=>p.id);
 if(!playerIds.length)return null;
 return Object.freeze({
  opponentId:screen.opponentId,playerIds:Object.freeze(playerIds)
 });
}
// Testable unassigned support target that deliberately preserves the
// existing goal-side shift / lane narrowing without affecting ball physics.
export function recoverySupportTarget(normalTarget,team,opponentPosition){
 if(team!=='home'&&team!=='away')throw new TypeError('Known team required');
 if(!normalTarget||!finite(normalTarget.x)||!finite(normalTarget.y)||
    !opponentPosition||!finite(opponentPosition.x)||!finite(opponentPosition.y))
  throw new TypeError('Finite recovery support target and opponent required');
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 return Object.freeze({
  x:clamp(normalTarget.x+(team==='home'?
    -PLAYER_RECOVERY_GOALSIDE_M:PLAYER_RECOVERY_GOALSIDE_M),-halfX,halfX),
  y:clamp(normalTarget.y+clamp(
   (opponentPosition.y-normalTarget.y)*PLAYER_RECOVERY_LANE_GAIN,
   -PLAYER_RECOVERY_MAX_LATERAL_M,PLAYER_RECOVERY_MAX_LATERAL_M),-halfY,halfY)
 });
}
// Threat progress is measured from the ACTUAL tracked opponent's XY, not
// possession or any invented match phase. The own-half admission is owned
// by zonalScreen; these pure helpers merely turn an observation into intent.
export function observedThreatProgress(team,opponentPosition){
 if(team!=='home'&&team!=='away')throw new TypeError('Known line-response team required');
 if(!opponentPosition||!finite(opponentPosition.x)||!finite(opponentPosition.y))
  throw new TypeError('Finite observed opponent XY required');
 const depth=team==='home'?-opponentPosition.x:opponentPosition.x;
 return clamp((depth-PLAYER_SCREEN_HALF_ADVANCE_M)/
   (PLAYER_PITCH.lengthM/2-PLAYER_SCREEN_HALF_ADVANCE_M),0,1);
}
function lineExtraDepth(role,progress){
 return (role==='defender'?PLAYER_LINE_DEFENDER_MAX_EXTRA_M:
   PLAYER_LINE_MIDFIELDER_MAX_EXTRA_M)*progress;
}
// Retain ME-PLAYER-08 recovery shift while distinguishing the two lines.
// Free defenders/midfielders share the same true opponent sample but respond
// with separate depth and lane gains; all movement remains bounded kinematic.
export function coordinatedLineTarget(normalTarget,team,role,opponentPosition){
 if(role!=='defender'&&role!=='midfielder')
  throw new TypeError('Only eligible recovery lines can coordinate');
 const base=recoverySupportTarget(normalTarget,team,opponentPosition);
 const progress=observedThreatProgress(team,opponentPosition);
 const direction=team==='home'?-1:1;
 const laneGain=role==='defender'?PLAYER_LINE_DEFENDER_LANE_GAIN:
   PLAYER_LINE_MIDFIELDER_LANE_GAIN;
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 return Object.freeze({
  x:clamp(base.x+direction*lineExtraDepth(role,progress),-halfX,halfX),
  y:clamp(base.y+clamp(
    (opponentPosition.y-base.y)*laneGain,
    -PLAYER_LINE_EXTRA_LANE_MAX_M,PLAYER_LINE_EXTRA_LANE_MAX_M),-halfY,halfY)
 });
}
// Limit the 60Hz CHANGE in each formation-relative tactical offset.
// After screen loss, only the old offset decays: no unobserved opponent
// identity or stale opposing XY is reused as a new tactical source.
export function advanceLineIntentOffset(previous,desired){
 if(!previous||!desired||
  ![previous.x,previous.y,desired.x,desired.y].every(finite))
  throw new TypeError('Finite line-intent offsets required');
 const dx=desired.x-previous.x,dy=desired.y-previous.y;
 const distance=Math.hypot(dx,dy);
 const maxDelta=PLAYER_LINE_INTENT_EASE_MPS*PLAYER_DT;
 if(distance<=maxDelta)return Object.freeze({
  x:Math.abs(desired.x)<=PLAYER_LINE_INTENT_SETTLED_EPS_M?0:desired.x,
  y:Math.abs(desired.y)<=PLAYER_LINE_INTENT_SETTLED_EPS_M?0:desired.y
 });
 const ratio=maxDelta/distance;
 return Object.freeze({x:previous.x+dx*ratio,y:previous.y+dy*ratio});
}
function lineTransitionSummary(players,offsets,recoveries,team){
 let engaging=0,releasing=0,maxOffsetM=0;
 const active=recoveries[team]?.playerIds||[];
 for(const p of players){
  if(p.team!==team||!(p.id in offsets))continue;
  const current=offsets[p.id],m=Math.hypot(current.x,current.y);
  if(m<=PLAYER_LINE_INTENT_SETTLED_EPS_M)continue;
  maxOffsetM=Math.max(maxOffsetM,m);
  if(active.includes(p.id))engaging++;
  else releasing++;
 }
 return Object.freeze({engaging,releasing,maxOffsetM});
}
// Snapshot only the line responsibilities selected from real screen evidence.
// These are target offsets, NOT measured player positions or possession.
function coordinatedLineResponse(players,team,recovery){
 if(!recovery)return null;
 const opponent=players.find(p=>p.id===recovery.opponentId&&
   p.team!==team&&p.role!=='goalkeeper');
 if(!opponent)return null;
 const progress=observedThreatProgress(team,opponent);
 const helpers=recovery.playerIds.map(id=>players.find(p=>p.id===id));
 return Object.freeze({
  opponentId:opponent.id,progress,
  defenders:helpers.filter(p=>p?.role==='defender').length,
  midfielders:helpers.filter(p=>p?.role==='midfielder').length,
  defenderExtraM:lineExtraDepth('defender',progress),
  midfielderExtraM:lineExtraDepth('midfielder',progress)
 });
}
// Pure, read-only positional intent; no physical contact or possession.
export function weakSideBalanceTarget(normalTarget,team,opponentPosition){
 if(team!=='home'&&team!=='away')throw new TypeError('Known balance team required');
 if(!normalTarget||!finite(normalTarget.x)||!finite(normalTarget.y)||
  !opponentPosition||!finite(opponentPosition.x)||!finite(opponentPosition.y))
  throw new TypeError('Finite weak-side target and opponent required');
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 const dy=normalTarget.y-opponentPosition.y;
 return Object.freeze({
  x:clamp(normalTarget.x+(team==='home'?-PLAYER_BALANCE_GOALSIDE_M:
    PLAYER_BALANCE_GOALSIDE_M),-halfX,halfX),
  y:clamp(normalTarget.y+(dy>=0?1:-1)*Math.min(
    PLAYER_BALANCE_MAX_LATERAL_M,Math.abs(dy)*PLAYER_BALANCE_LANE_GAIN),-halfY,halfY)
 });
}
function tacticalTarget(p,ball,isPressing,isCovering,screenOpponent,supportTarget,balanceOpponent){
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 // Dedicated keeper intent takes priority over generic shape shifting.
 if(p.role==='goalkeeper')return goalkeeperPosition(p.team,ball);
 if(isPressing){
  // The two teams occupy opposite sides of the ball, not the same point.
  return {x:clamp(ball.x+(p.team==='home'?-PLAYER_PRESS_OFFSET_M:PLAYER_PRESS_OFFSET_M),-halfX,halfX),
    y:clamp(ball.y,-halfY,halfY)};
 }
 if(isCovering){
  // Cover the goal-facing side, in a distinct channel from the ball presser.
  const goalside=p.team==='home'?-1:1;
  const laneSide=p.baseY<=ball.y?-1:1;
  return {
   x:clamp(ball.x+goalside*PLAYER_COVER_GOALSIDE_OFFSET_M,-halfX,halfX),
   y:clamp(ball.y+laneSide*PLAYER_COVER_LANE_OFFSET_M,-halfY,halfY)
  };
 }
 if(screenOpponent){
  // Intercept the *space* between an opponent and our goal, not their
  // collider. The lateral channel stays separate from direct cover intent.
  const goalside=p.team==='home'?-1:1;
  const laneSide=p.baseY<=screenOpponent.y?-1:1;
  return {
   x:clamp(screenOpponent.x+goalside*PLAYER_SCREEN_GOALSIDE_OFFSET_M,
     -halfX,halfX),
   y:clamp(screenOpponent.y+laneSide*PLAYER_SCREEN_CHANNEL_OFFSET_M,
     -halfY,halfY)
  };
 }
 if(supportTarget)return {...supportTarget};
 const factor=p.role==='goalkeeper'?0.045:p.role==='defender'?0.14:
   p.role==='midfielder'?0.24:0.32;
 const x=p.baseX+ball.x*factor;
 // Supporting players narrow their horizontal shape near the touchline,
 // while maintaining their distinct formation lanes and a lateral ball shift.
 const flank=Math.min(1,Math.abs(ball.y)/(PLAYER_PITCH.widthM/2));
 const ownThird=p.team==='home'?'home-third':'away-third';
 const defendingHere=ballSector(ball).third===ownThird;
 const narrowedOwnThird=defendingHere?(
   p.role==='defender'?PLAYER_OWN_THIRD_NARROW_DEFENDERS:
   p.role==='midfielder'?PLAYER_OWN_THIRD_NARROW_MIDFIELDERS:0):0;
 const y=p.baseY*(1-PLAYER_FLANK_NARROW_MAX*flank-narrowedOwnThird)+ball.y*factor;
 const normal={x:clamp(x,-halfX,halfX),y:clamp(y,-halfY,halfY)};
 if(balanceOpponent)return weakSideBalanceTarget(normal,p.team,balanceOpponent);
 return normal;
}
function ballSector(ball){
 // Ball territory ≠ possession: no collision or owner information is present.
 const third=PLAYER_PITCH.lengthM/6; // 17.5 m from halfway
 const lane=PLAYER_PITCH.widthM/6; // 11.33 m from centre
 return Object.freeze({
  third:ball.x< -third?'home-third':ball.x>third?'away-third':'middle-third',
  lane:ball.y< -lane?'negative-y':ball.y>lane?'positive-y':'central'
 });
}
// Soft line compactness: use ONLY actual teammate outfield XY samples.
// No fictional opponent, possession, or tactical phase. A bounded two-line
// correction is intentional, not a guaranteed spacing constraint: assigned
// pressers, coverers, screeners and balancers keep their higher priorities.
export function measureLineCohesion(players,team){
 if(team!=='home'&&team!=='away')throw new TypeError('Known cohesion team required');
 if(!Array.isArray(players))throw new TypeError('Line players array required');
 const defenders=[],midfielders=[];
 for(const p of players){
  if(p.team!==team||!(p.role==='defender'||p.role==='midfielder'))continue;
  if(!finite(p.x)||!finite(p.y))
   throw new TypeError('Finite teammate XY required');
  (p.role==='defender'?defenders:midfielders).push(p);
 }
 if(!defenders.length||!midfielders.length)return null;
 const mean=(line,axis)=>line.reduce((sum,p)=>sum+p[axis],0)/line.length;
 const defenseX=mean(defenders,'x'),midfieldX=mean(midfielders,'x');
 const defenseY=mean(defenders,'y'),midfieldY=mean(midfielders,'y');
 const direction=team==='home'?1:-1;
 const gapM=direction*(midfieldX-defenseX);
 const lateralDriftM=midfieldY-defenseY;
 const depthError=gapM>PLAYER_COHESION_MAX_GAP_M?
   gapM-PLAYER_COHESION_MAX_GAP_M:
   gapM<PLAYER_COHESION_MIN_GAP_M?gapM-PLAYER_COHESION_MIN_GAP_M:0;
 const lateralError=Math.sign(lateralDriftM)*Math.max(
  0,Math.abs(lateralDriftM)-PLAYER_COHESION_LATERAL_TOLERANCE_M);
 const defenderShift=Object.freeze({
  x:direction*clamp(depthError*PLAYER_COHESION_DEFENDER_DEPTH_GAIN,
   -PLAYER_COHESION_DEFENDER_MAX_X_M,PLAYER_COHESION_DEFENDER_MAX_X_M),
  y:clamp(lateralError*PLAYER_COHESION_DEFENDER_LATERAL_GAIN,
   -PLAYER_COHESION_DEFENDER_MAX_Y_M,PLAYER_COHESION_DEFENDER_MAX_Y_M)
 });
 const midfielderShift=Object.freeze({
  x:-direction*clamp(depthError*PLAYER_COHESION_MIDFIELDER_DEPTH_GAIN,
   -PLAYER_COHESION_MIDFIELDER_MAX_X_M,PLAYER_COHESION_MIDFIELDER_MAX_X_M),
  y:-clamp(lateralError*PLAYER_COHESION_MIDFIELDER_LATERAL_GAIN,
   -PLAYER_COHESION_MIDFIELDER_MAX_Y_M,PLAYER_COHESION_MIDFIELDER_MAX_Y_M)
 });
 return Object.freeze({gapM,lateralDriftM,defenders:defenders.length,
  midfielders:midfielders.length,defenderShift,midfielderShift});
}
// Pure XY target adjustment with explicit role and pitch-bound validation.
// Null evidence -> unchanged target: never fabricate missing line anchors.
export function lineCohesionTarget(normal,team,role,cohesion){
 if(team!=='home'&&team!=='away')throw new TypeError('Known cohesion team required');
 if(role!=='defender'&&role!=='midfielder')
  throw new TypeError('Only eligible line roles can receive cohesion');
 if(!normal||!finite(normal.x)||!finite(normal.y))
  throw new TypeError('Finite cohesion target required');
 const shift=cohesion==null?{x:0,y:0}:
  role==='defender'?cohesion.defenderShift:cohesion.midfielderShift;
 if(!shift||!finite(shift.x)||!finite(shift.y))
  throw new TypeError('Finite cohesion shift required');
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 return Object.freeze({x:clamp(normal.x+shift.x,-halfX,halfX),
  y:clamp(normal.y+shift.y,-halfY,halfY)});
}
// ME-PLAYER-13: evaluate ONLY live, same-team outfield XY from the same
// 60Hz snapshot. One deterministic nearest teammate is sufficient for a
// soft avoidance intention; the independent hard collision rejection stays.
// Select a *currently observed* same-team outfielder, not an inferred
// tactical opponent. Keep the incumbent only while it is STILL within the
// strict 5m clearance zone and no new candidate is at least 0.75m closer.
// Current XY is resampled every tick; no stored/predicted XY is involved.
export function selectTeammateClearanceNeighbor(player,players,incumbentId=null){
 if(!player||!['home','away'].includes(player.team)||player.role==='goalkeeper'||
   !['defender','midfielder','forward'].includes(player.role)||
   typeof player.id!=='string'||!player.id||!finite(player.x)||!finite(player.y))
  throw new TypeError('Valid outfield teammate-clearance player required');
 if(!Array.isArray(players))
  throw new TypeError('Teammate-clearance player array required');
 if(incumbentId!==null&&(typeof incumbentId!=='string'||!incumbentId))
  throw new TypeError('Valid incumbent teammate ID required');
 let best=null,bestDistance=Infinity,incumbent=null,incumbentDistance=Infinity;
 for(const p of players){
  if(p.team!==player.team||p.id===player.id||p.role==='goalkeeper')continue;
  if(typeof p.id!=='string'||!p.id||!finite(p.x)||!finite(p.y))
   throw new TypeError('Finite observed teammate XY required');
  const d=Math.hypot(player.x-p.x,player.y-p.y);
  if(d>=PLAYER_TEAMMATE_CLEARANCE_M)continue;
  if(d<bestDistance-1e-9||
    (Math.abs(d-bestDistance)<=1e-9&&(!best||p.id<best.id))){
   best=p;bestDistance=d;
  }
  if(p.id===incumbentId){incumbent=p;incumbentDistance=d;}
 }
 if(!best)return null;
 const held=incumbent&&incumbentDistance<=
  bestDistance+PLAYER_TEAMMATE_CLEARANCE_SWITCH_ADVANTAGE_M?
   incumbent:best;
 return Object.freeze({id:held.id,distanceM:held===incumbent?
  incumbentDistance:bestDistance});
}
// Existing ME-PLAYER-13 bounded nudge, now with optional hysteretic mate
// selection. Default null preserves the standalone deterministic tie rules.
export function teammateClearanceTarget(normal,player,players,incumbentId=null){
 if(!normal||!finite(normal.x)||!finite(normal.y))
  throw new TypeError('Finite teammate-clearance target required');
 const selection=selectTeammateClearanceNeighbor(player,players,incumbentId);
 if(!selection)return Object.freeze({x:normal.x,y:normal.y});
 const nearest=players.find(p=>p.id===selection.id&&p.team===player.team);
 const dist=selection.distanceM;
 const amount=Math.min(PLAYER_TEAMMATE_CLEARANCE_MAX_SHIFT_M,
   (PLAYER_TEAMMATE_CLEARANCE_M-dist)*PLAYER_TEAMMATE_CLEARANCE_GAIN);
 // A coincident pair uses opposed stable IDs and mirrored directions.
 const dx=dist>1e-9?(player.x-nearest.x)/dist:
   (player.id<nearest.id?-1:1)*(player.team==='home'?1:-1);
 const dy=dist>1e-9?(player.y-nearest.y)/dist:0;
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 return Object.freeze({
  x:clamp(normal.x+dx*amount,-halfX,halfX),
  y:clamp(normal.y+dy*amount,-halfY,halfY)
 });
}
// Short, non-authoritative constant-velocity forecast from CURRENT positions
// and velocities only. No proposed destination, possession or invented
// match event enters this calculation. Local <5m clearance remains dominant.
export function forecastTeammateCrossing(player,players){
 if(!player||!['home','away'].includes(player.team)||
  !['defender','midfielder','forward'].includes(player.role)||
  typeof player.id!=='string'||!player.id||
  ![player.x,player.y,player.vx,player.vy].every(finite))
  throw new TypeError('Finite moving outfield player required');
 if(!Array.isArray(players))
  throw new TypeError('Crossing players array required');
 let best=null,withinClearance=false;
 for(const mate of players){
  if(mate.team!==player.team||mate.id===player.id||mate.role==='goalkeeper')
   continue;
  if(typeof mate.id!=='string'||!mate.id||
    ![mate.x,mate.y,mate.vx,mate.vy].every(finite))
   throw new TypeError('Finite observed moving teammate required');
  const rx=player.x-mate.x,ry=player.y-mate.y;
  const distance=Math.hypot(rx,ry);
  if(distance<PLAYER_TEAMMATE_CLEARANCE_M){
   withinClearance=true;
   continue;
  }
  if(distance>PLAYER_CROSSING_MAX_NEIGHBOR_M)continue;
  // A real crossing must have two moving paths with a meaningful
  // intersection angle. Following/merging in parallel or passing head-on
  // belongs to the existing observed-distance clearance and collision guard.
  const ownSpeed=Math.hypot(player.vx,player.vy);
  const mateSpeed=Math.hypot(mate.vx,mate.vy);
  if(ownSpeed<PLAYER_CROSSING_MIN_REL_SPEED_MPS||
    mateSpeed<PLAYER_CROSSING_MIN_REL_SPEED_MPS)continue;
  const headingCos=(player.vx*mate.vx+player.vy*mate.vy)/
    (ownSpeed*mateSpeed);
  if(Math.abs(headingCos)>PLAYER_CROSSING_MAX_ABS_HEADING_COS)continue;
  const rvx=player.vx-mate.vx,rvy=player.vy-mate.vy;
  const relativeSpeedSq=rvx*rvx+rvy*rvy;
  if(relativeSpeedSq<PLAYER_CROSSING_MIN_REL_SPEED_MPS**2)continue;
  const closing=rx*rvx+ry*rvy;
  if(closing>=0)continue;
  const etaS=-closing/relativeSpeedSq;
  if(etaS<PLAYER_CROSSING_MIN_ETA_S||
    etaS>PLAYER_CROSSING_LOOKAHEAD_S)continue;
  const closestM=Math.hypot(rx+rvx*etaS,ry+rvy*etaS);
  if(closestM>=PLAYER_CROSSING_GUARD_M)continue;
  const candidate={id:mate.id,etaS,closestM};
  if(!best||etaS<best.etaS-1e-9||
    (Math.abs(etaS-best.etaS)<=1e-9&&
      (closestM<best.closestM-1e-9||
       (Math.abs(closestM-best.closestM)<=1e-9&&mate.id<best.id))))
   best=candidate;
 }
 return withinClearance||!best?null:Object.freeze(best);
}
// At most 0.9m *target* offset away from projected closest approach.
// Zero projected separation takes the perpendicular of REAL relative
// velocity: opposed between mirrored players, without randomness.
// No change to Rapier, physical step, or hard collision rejection.
export function teammateCrossingTarget(normal,player,players){
 if(!normal||!finite(normal.x)||!finite(normal.y))
  throw new TypeError('Finite crossing target required');
 const crossing=forecastTeammateCrossing(player,players);
 if(!crossing)return Object.freeze({x:normal.x,y:normal.y});
 const mate=players.find(p=>p.id===crossing.id&&p.team===player.team);
 const rvx=player.vx-mate.vx,rvy=player.vy-mate.vy;
 const px=player.x-mate.x+rvx*crossing.etaS;
 const py=player.y-mate.y+rvy*crossing.etaS;
 const r=Math.hypot(px,py);
 const speed=Math.hypot(rvx,rvy);
 // Mirror the fallback's handedness across the Home/Away X reflection.
 const side=player.team==='home'?1:-1;
 const dx=r>1e-9?px/r:side*-rvy/speed;
 const dy=r>1e-9?py/r:side*rvx/speed;
 const amount=PLAYER_CROSSING_MAX_SHIFT_M*
  (1-crossing.closestM/PLAYER_CROSSING_GUARD_M);
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 return Object.freeze({x:clamp(normal.x+dx*amount,-halfX,halfX),
  y:clamp(normal.y+dy*amount,-halfY,halfY)});
}
// Bounded changes in tactical *target offsets*, not a force or a player
// velocity update. A desired 0 gradually releases the OLD spatial offset
// after observed closing-velocity evidence vanishes; no teammate ID or
// previous velocity sample is reused as a source of a new correction.
export function advanceCrossingIntentOffset(previous,desired){
 if(!previous||!desired||
   ![previous.x,previous.y,desired.x,desired.y].every(finite))
  throw new TypeError('Finite crossing-intent offsets required');
 const length=Math.hypot(desired.x,desired.y);
 const cap=length>PLAYER_CROSSING_MAX_SHIFT_M?
   PLAYER_CROSSING_MAX_SHIFT_M/length:1;
 const dx=desired.x*cap-previous.x;
 const dy=desired.y*cap-previous.y;
 const d=Math.hypot(dx,dy);
 const maxStep=PLAYER_CROSSING_INTENT_EASE_MPS*PLAYER_DT;
 const fraction=d>maxStep?maxStep/d:1;
 const x=previous.x+dx*fraction,y=previous.y+dy*fraction;
 return Object.freeze({
  x:Math.abs(x)<=PLAYER_CROSSING_INTENT_SETTLED_EPS_M?0:x,
  y:Math.abs(y)<=PLAYER_CROSSING_INTENT_SETTLED_EPS_M?0:y
 });
}
function crossingTransitionSummary(players,offsets,activeIds,team){
 let engaging=0,releasing=0,maxOffsetM=0;
 for(const p of players){
  if(p.team!==team||!(p.id in offsets))continue;
  const v=offsets[p.id],m=Math.hypot(v.x,v.y);
  if(m<=PLAYER_CROSSING_INTENT_SETTLED_EPS_M)continue;
  maxOffsetM=Math.max(maxOffsetM,m);
  if(activeIds.has(p.id))engaging++;
  else releasing++;
 }
 return Object.freeze({engaging,releasing,maxOffsetM});
}
// Read-only measured proximity (not a hard distance promise). Count
// unordered outfield pairs once; goalkeeper / opponent collisions are
// handled by the pre-existing non-overlap controller, not this metric.
export function measureTeammateProximity(players,team){
 if(team!=='home'&&team!=='away')
  throw new TypeError('Known teammate-proximity team required');
 if(!Array.isArray(players))
  throw new TypeError('Teammate-proximity player array required');
 const mates=players.filter(p=>p.team===team&&p.role!=='goalkeeper');
 for(const p of mates)if(!finite(p.x)||!finite(p.y))
  throw new TypeError('Finite observed teammate XY required');
 let closePairs=0,minimumM=Infinity;
 for(let i=0;i<mates.length;i++)for(let j=i+1;j<mates.length;j++){
  const d=Math.hypot(mates[i].x-mates[j].x,mates[i].y-mates[j].y);
  minimumM=Math.min(minimumM,d);
  if(d<PLAYER_TEAMMATE_CLEARANCE_M)closePairs++;
 }
 return Object.freeze({closePairs,minimumM:minimumM===Infinity?null:minimumM});
}
// ME-PLAYER-17. The only stall signal is a REAL rejected 60Hz step
// (blockedBy) against the same currently observed teammate. An opponent,
// keeper, absent blocker or changed ID never counts toward confirmation.
export function advanceObservedStall(previous,blockerId){
 if(!previous||!Number.isInteger(previous.ticks)||
   previous.ticks<0||previous.ticks>PLAYER_STALL_CONFIRM_TICKS||
   (previous.blockerId!==null&&
    (typeof previous.blockerId!=='string'||!previous.blockerId)))
  throw new TypeError('Valid observed stall state required');
 if(blockerId!==null&&(typeof blockerId!=='string'||!blockerId))
  throw new TypeError('Valid observed teammate blocker ID required');
 if(blockerId===null)
  return Object.freeze({blockerId:null,ticks:0});
 return Object.freeze({blockerId,ticks:blockerId===previous.blockerId?
  Math.min(PLAYER_STALL_CONFIRM_TICKS,previous.ticks+1):1});
}
// Return a real-blocker-relative *waypoint* to request the ordinary
// kinematic controller approach around the obstruction. Null = release.
// Position is never set directly, no blocker XY is cached, and a stopped
// blocker does not become a fake moving or possession target.
export function observedTeammateDetourTarget(target,player,blocker,side=null){
 if(!target||![target.x,target.y].every(finite))
  throw new TypeError('Finite detour target required');
 if(!player||!['home','away'].includes(player.team)||
   !['defender','midfielder','forward'].includes(player.role)||
   typeof player.id!=='string'||!player.id||
   ![player.x,player.y].every(finite))
  throw new TypeError('Valid moving outfield detour player required');
 if(side!==null&&(side!==1&&side!==-1))
  throw new TypeError('Valid detour side required');
 if(blocker===null)return null;
 if(!blocker||blocker.team!==player.team||
   blocker.id===player.id||typeof blocker.id!=='string'||!blocker.id||
   ![blocker.x,blocker.y].every(finite))
  throw new TypeError('Valid observed same-team detour blocker required');
 const bx=blocker.x-player.x,by=blocker.y-player.y;
 const blockerDistance=Math.hypot(bx,by);
 if(blockerDistance>PLAYER_DETOUR_RELEASE_DISTANCE_M)return null;
 const tx=target.x-player.x,ty=target.y-player.y;
 const targetDistance=Math.hypot(tx,ty);
 if(targetDistance<PLAYER_MIN_SEPARATION_M)return null;
 const ux=tx/targetDistance,uy=ty/targetDistance;
 const along=bx*ux+by*uy;
 // Never orbit a teammate who is already behind the intended direction
 // or whose observed position is beyond the tactical target itself.
 if(along<=0||along>=targetDistance)return null;
 const orientation=(side??(player.id<blocker.id?1:-1))*
  (player.team==='home'?1:-1);
 const nx=-uy*orientation,ny=ux*orientation;
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 const waypoint={x:clamp(blocker.x-ux*PLAYER_DETOUR_WAYPOINT_BACK_M+
   nx*PLAYER_DETOUR_WAYPOINT_LATERAL_M,-halfX,halfX),
  y:clamp(blocker.y-uy*PLAYER_DETOUR_WAYPOINT_BACK_M+
   ny*PLAYER_DETOUR_WAYPOINT_LATERAL_M,-halfY,halfY)};
 // No meaningful way around a pitch boundary or no free displacement.
 if(Math.hypot(waypoint.x-player.x,waypoint.y-player.y)<1e-8)
  return null;
 return Object.freeze(waypoint);
}
// The waypoint has genuinely been reached only if the outfielder's
// CURRENT physical XY is within a small radius of the CURRENT detour
// waypoint, and the currently observed same-team blocker is still at
// least 1.25m away. Neither a previously proposed target nor a phantom
// teammate counts as successful navigation. This is not ball interaction.
export function reachedObservedDetourWaypoint(player,blocker,waypoint){
 if(!player||!['home','away'].includes(player.team)||
  !['defender','midfielder','forward'].includes(player.role)||
  typeof player.id!=='string'||!player.id||
  ![player.x,player.y].every(finite))
  throw new TypeError('Valid observed detour-completion outfielder required');
 if(!blocker||blocker.team!==player.team||blocker.id===player.id||
  typeof blocker.id!=='string'||!blocker.id||
  ![blocker.x,blocker.y].every(finite))
  throw new TypeError('Valid real teammate detour-completion blocker required');
 if(!waypoint||![waypoint.x,waypoint.y].every(finite))
  throw new TypeError('Finite observed detour-completion waypoint required');
 return Math.hypot(player.x-waypoint.x,player.y-waypoint.y)<=
   PLAYER_DETOUR_COMPLETION_RADIUS_M&&
  Math.hypot(player.x-blocker.x,player.y-blocker.y)>=
   PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M;
}
// Short, observed-XY safety check of only the REAL teammate who caused
// the hard blockedBy stall. The next 3m toward this tick's tactical goal
// is a geometric corridor, not a prediction of teammate motion or a
// guarantee about other players. No remembered positions are accepted.
export function measureObservedDetourRejoinCorridor(player,blocker,tacticalTarget){
 if(!player||!['home','away'].includes(player.team)||
  !['defender','midfielder','forward'].includes(player.role)||
  typeof player.id!=='string'||!player.id||
  ![player.x,player.y].every(finite))
  throw new TypeError('Valid observed detour-rejoin outfielder required');
 if(!blocker||blocker.team!==player.team||blocker.id===player.id||
  typeof blocker.id!=='string'||!blocker.id||
  ![blocker.x,blocker.y].every(finite))
  throw new TypeError('Valid observed same-team rejoin blocker required');
 if(!tacticalTarget||![tacticalTarget.x,tacticalTarget.y].every(finite))
  throw new TypeError('Finite observed rejoin tactical target required');
 const dx=tacticalTarget.x-player.x,dy=tacticalTarget.y-player.y;
 const distance=Math.hypot(dx,dy);
 const observedM=Math.min(PLAYER_DETOUR_REJOIN_LOOKAHEAD_M,distance);
 // Nearest point on a CURRENT finite segment from the actual outfielder
 // toward the currently requested tactical target, clamped to 0–3m.
 const ux=distance>1e-9?dx/distance:0;
 const uy=distance>1e-9?dy/distance:0;
 const along=observedM>1e-9?clamp(
  (blocker.x-player.x)*ux+(blocker.y-player.y)*uy,0,observedM):0;
 const closestX=player.x+ux*along,closestY=player.y+uy*along;
 const minimumGapM=Math.hypot(blocker.x-closestX,blocker.y-closestY);
 return Object.freeze({
  observedM,
  minimumGapM,
  safe:minimumGapM>=PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M
 });
}
// ME-PLAYER-23. Short, temporary direction cue after a REAL safely reached
// detour. Only the outfielder's current measured VX/VY and this tick's
// tactical destination are used, never a cached absolute waypoint, old
// teammate coordinates, or a scripted trajectory. Hard collision and
// 60Hz turning/acceleration remain authoritative.
export function observedVelocityRejoinTarget(player,tacticalTarget,remainingTicks){
 if(!player||!['home','away'].includes(player.team)||
  !['defender','midfielder','forward'].includes(player.role)||
  typeof player.id!=='string'||!player.id||
  ![player.x,player.y,player.vx,player.vy].every(finite))
  throw new TypeError('Valid current rejoin outfielder XY/velocity required');
 if(!tacticalTarget||![tacticalTarget.x,tacticalTarget.y].every(finite))
  throw new TypeError('Finite current rejoin tactical goal required');
 if(!Number.isInteger(remainingTicks)||remainingTicks<0||
  remainingTicks>PLAYER_REJOIN_HANDOFF_TICKS)
  throw new TypeError('Valid remaining rejoin handoff ticks required');
 const dx=tacticalTarget.x-player.x,dy=tacticalTarget.y-player.y;
 const dist=Math.hypot(dx,dy),speed=Math.hypot(player.vx,player.vy);
 const normal=Object.freeze({x:tacticalTarget.x,y:tacticalTarget.y});
 if(remainingTicks===0||dist<=PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M||
   speed<PLAYER_REJOIN_HANDOFF_MIN_SPEED_MPS||dist<1e-8)
  return normal;
 const nx=dx/dist,ny=dy/dist,ux=player.vx/speed,uy=player.vy/speed;
 // A backwards or perpendicular observed heading cannot generate a
 // detour cue back toward the just-avoided body; use normal tactics.
 const dot=nx*ux+ny*uy;
 if(dot<=0)return normal;
 const mix=PLAYER_REJOIN_HANDOFF_MAX_BLEND*
  remainingTicks/PLAYER_REJOIN_HANDOFF_TICKS;
 const bx=nx*(1-mix)+ux*mix,by=ny*(1-mix)+uy*mix;
 const length=Math.hypot(bx,by);
 if(length<1e-8)return normal;
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 return Object.freeze({
  x:clamp(player.x+PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M*bx/length,
   -halfX,halfX),
  y:clamp(player.y+PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M*by/length,
   -halfY,halfY)
 });
}
// ME-PLAYER-24: evaluate the short CURRENT cue against all REAL player
// bodies, including both teams and goalkeepers. No projected trajectories.
export function measureObservedHandoffCorridor(player,bodies,cue){
 if(!player||!['home','away'].includes(player.team)||
  !['defender','midfielder','forward'].includes(player.role)||
  typeof player.id!=='string'||!player.id||
  ![player.x,player.y].every(finite))
  throw new TypeError('Valid current handoff outfielder required');
 if(!cue||![cue.x,cue.y].every(finite))
  throw new TypeError('Finite current handoff cue required');
 if(!Array.isArray(bodies)||!bodies.length)
  throw new TypeError('Actual observed handoff bodies required');
 const d=Math.hypot(cue.x-player.x,cue.y-player.y);
 const observedM=Math.min(PLAYER_REJOIN_HANDOFF_LOOKAHEAD_M,d);
 const ux=d>1e-9?(cue.x-player.x)/d:0;
 const uy=d>1e-9?(cue.y-player.y)/d:0;
 const ids=new Set();
 let selfObserved=false,nearestId=null,minimumGapM=null;
 for(const body of bodies){
  if(!body||!['home','away'].includes(body.team)||
   typeof body.id!=='string'||!body.id||ids.has(body.id)||
   ![body.x,body.y].every(finite))
   throw new TypeError('Unique finite actual player bodies required');
  ids.add(body.id);
  if(body.id===player.id){
   if(body.team!==player.team||
    Math.hypot(body.x-player.x,body.y-player.y)>1e-9)
    throw new TypeError('Handoff player must match observed body');
   selfObserved=true;
   continue;
  }
  const along=observedM>1e-9?clamp(
   (body.x-player.x)*ux+(body.y-player.y)*uy,0,observedM):0;
  const gap=Math.hypot(body.x-player.x-along*ux,
   body.y-player.y-along*uy);
  if(minimumGapM===null||gap<minimumGapM){
   minimumGapM=gap;nearestId=body.id;
  }
 }
 if(!selfObserved)throw new TypeError('Actual handoff player body missing');
 return Object.freeze({observedM,nearestId,minimumGapM,
  safe:minimumGapM===null||
   minimumGapM>=PLAYER_DETOUR_COMPLETION_BLOCKER_GAP_M});
}
// Choose one of two deterministic detour sides using current observed body
// clearance and field boundaries, then keep that side throughout one detour.
// The old ID-based side is the exact tie fallback and 3-arg helper default.
export function selectObservedDetourSide(target,player,blocker,players){
 if(!Array.isArray(players))
  throw new TypeError('Observed detour bodies array required');
 const preference=player?.id<blocker?.id?1:-1;
 const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 const candidates=[1,-1].map(side=>{
  const waypoint=observedTeammateDetourTarget(target,player,blocker,side);
  if(!waypoint)return null;
  let nearest=Infinity;
  for(const observed of players){
   if(observed.id===player.id)continue;
   if(![observed.x,observed.y].every(finite))
    throw new TypeError('Finite observed detour body XY required');
   const d=Math.hypot(waypoint.x-observed.x,waypoint.y-observed.y);
   nearest=Math.min(nearest,d);
  }
  const fieldSpace=Math.max(0,Math.min(halfX-Math.abs(waypoint.x),
   halfY-Math.abs(waypoint.y)));
  return {side,nearest,score:Math.min(nearest,2*fieldSpace)};
 });
 const a=candidates[0],b=candidates[1];
 if(!a&&!b)return null;
 const qualifying=candidates.filter(Boolean);
 const viable=qualifying.filter(c=>c.nearest>=PLAYER_MIN_SEPARATION_M);
 if(!viable.length)return null;
 const preferred=viable.find(c=>c.side===preference);
 const other=viable.find(c=>c.side!==preference);
 const winner=!preferred?other:other&&
  other.score>preferred.score+PLAYER_DETOUR_SIDE_CLEARANCE_ADVANTAGE_M?
  other:preferred;
 return winner.side;
}
// A released route cannot immediately re-arm on the same real blocker.
// No stale spatial data is retained; the ID only guards an observed re-try.
// New unrelated blockers can still be confirmed and handled independently.
export function advanceDetourRetryCooldown(previous,releasedBlockerId=null){
 if(!previous||!Number.isInteger(previous.remaining)||
  previous.remaining<0||previous.remaining>PLAYER_DETOUR_RETRY_COOLDOWN_TICKS||
  (previous.blockerId!==null&&
   (typeof previous.blockerId!=='string'||!previous.blockerId))||
  (previous.remaining===0&&previous.blockerId!==null)||
  (previous.remaining>0&&previous.blockerId===null))
  throw new TypeError('Valid detour retry state required');
 if(releasedBlockerId!==null&&
  (typeof releasedBlockerId!=='string'||!releasedBlockerId))
  throw new TypeError('Valid released blocker ID required');
 if(releasedBlockerId!==null)
  return Object.freeze({blockerId:releasedBlockerId,
   remaining:PLAYER_DETOUR_RETRY_COOLDOWN_TICKS});
 return previous.remaining>1?
  Object.freeze({blockerId:previous.blockerId,remaining:previous.remaining-1}):
  Object.freeze({blockerId:null,remaining:0});
}
// ME-PLAYER-20: calculate actual signed progress toward this tick's
// genuinely selected waypoint. A sideways or backward real displacement
// must not be misclassified as forward progress by its path length.
// Current waypoint is sampled only for this physical step; it is not
// cached as next tick's teammate prediction or a scripted player route.
export function measureObservedDetourAdvance(start,end,waypoint){
 if(!start||!end||!waypoint||
   ![start.x,start.y,end.x,end.y,waypoint.x,waypoint.y].every(finite))
  throw new TypeError('Finite observed detour positions and waypoint required');
 const before=Math.hypot(start.x-waypoint.x,start.y-waypoint.y);
 const after=Math.hypot(end.x-waypoint.x,end.y-waypoint.y);
 const signed=before-after;
 const movedM=Math.hypot(end.x-start.x,end.y-start.y);
 return Object.freeze({
  movedM,
  advanceM:Math.max(0,signed),
  awayM:Math.max(0,-signed)
 });
}
// ME-PLAYER-19/20: progress depends ONLY on actual physical XY displacement
// in the direction of the current waypoint, after the hard physics guard.
// after collision rejection, never on requested waypoint motion or guessed
// teammate velocity. A sufficiently moving player resets stagnation.
export function advanceObservedDetourProgress(previous,movedM){
 if(!previous||!Number.isInteger(previous.activeTicks)||
  !Number.isInteger(previous.stagnantTicks)||
  previous.activeTicks<0||previous.stagnantTicks<0||
  previous.stagnantTicks>previous.activeTicks||
  previous.activeTicks>PLAYER_DETOUR_MAX_ACTIVE_TICKS||
  !finite(movedM)||movedM<0)
  throw new TypeError('Valid observed detour progress and toward-waypoint advance required');
 return Object.freeze({
  activeTicks:Math.min(PLAYER_DETOUR_MAX_ACTIVE_TICKS,
   previous.activeTicks+1),
  stagnantTicks:movedM<PLAYER_DETOUR_PROGRESS_MIN_STEP_M?
   previous.stagnantTicks+1:0
 });
}
export function shouldAbortObservedDetour(progress){
 if(!progress||!Number.isInteger(progress.activeTicks)||
  !Number.isInteger(progress.stagnantTicks)||
  progress.activeTicks<0||
  progress.stagnantTicks<0||
  progress.stagnantTicks>progress.activeTicks)
  throw new TypeError('Valid observed detour progress required');
 return progress.stagnantTicks>=PLAYER_DETOUR_STAGNANT_ABORT_TICKS||
  progress.activeTicks>=PLAYER_DETOUR_MAX_ACTIVE_TICKS;
}
// ME-PLAYER-26: bounded, actual 60Hz body-position observations.
// There is no velocity extrapolation, waypoint caching or ball coupling.
// This observer stores only immutable historical X/Y/tick samples.
export function createObservedPlayerTrails(maxTicks=PLAYER_OBSERVED_PATH_WINDOW_TICKS){
 if(!Number.isInteger(maxTicks)||maxTicks<1||
    maxTicks>PLAYER_OBSERVED_PATH_WINDOW_TICKS)
  throw new RangeError('Bounded positive observed trail window required');
 let lastTick=null;
 const paths=new Map(INITIAL_PLAYERS.map(p=>[p.id,[]]));
 function record(sample){
  if(!sample||!Number.isInteger(sample.tick)||sample.tick<0||
     !Array.isArray(sample.players)||sample.players.length!==22)
   throw new TypeError('Exactly 22 current player samples with tick required');
  if(lastTick!==null&&sample.tick!==lastTick+1)
   throw new RangeError('Observed player ticks must be contiguous');
  const bodies=new Map();
  const maxX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
  const maxY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
  for(const p of sample.players){
   const original=INITIAL_PLAYERS.find(x=>x.id===p?.id);
   if(!original||p.team!==original.team||bodies.has(p.id)||
      !finite(p.x)||!finite(p.y)||
      Math.abs(p.x)>maxX+1e-8||Math.abs(p.y)>maxY+1e-8)
    throw new TypeError('Unique real player identities and finite pitch XY required');
   bodies.set(p.id,p);
  }
  if(bodies.size!==INITIAL_PLAYERS.length)
   throw new TypeError('Missing observed player body');
  // Commit only after every sample validates: malformed calls are atomic.
  for(const player of INITIAL_PLAYERS){
   const p=bodies.get(player.id),series=paths.get(player.id);
   series.push(Object.freeze({tick:sample.tick,x:p.x,y:p.y}));
   if(series.length>maxTicks+1)series.shift();
  }
  lastTick=sample.tick;
 }
 function snapshot(){
  return Object.freeze({
   tick:lastTick,maxTicks,
   paths:Object.freeze(INITIAL_PLAYERS.map(p=>Object.freeze({
    id:p.id,team:p.team,
    points:Object.freeze(paths.get(p.id).slice())
   })))
  });
 }
 return Object.freeze({record,snapshot,reset:()=>createObservedPlayerTrails(maxTicks)});
}
// ME-PLAYER-27: audit past PHYSICAL distance vs net displacement.
// No steering, future points, ball interaction or movement state mutation.
export function summarizeObservedTrailDistances(history,team){
 if(!history||!['home','away'].includes(team)||
   !Number.isInteger(history.maxTicks)||history.maxTicks<1||
   history.maxTicks>PLAYER_OBSERVED_PATH_WINDOW_TICKS||
   !(history.tick===null||(Number.isInteger(history.tick)&&history.tick>=0))||
   !Array.isArray(history.paths)||history.paths.length!==INITIAL_PLAYERS.length)
  throw new TypeError('Valid bounded observed path history required');
 let sampleCount=null,firstTick=null,travelM=0,netM=0;
 const maxX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const maxY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 for(let i=0;i<INITIAL_PLAYERS.length;i++){
  const path=history.paths[i],expected=INITIAL_PLAYERS[i];
  if(!path||path.id!==expected.id||path.team!==expected.team||
     !Array.isArray(path.points)||path.points.length>history.maxTicks+1)
   throw new TypeError('Canonical 22-body path identities and bounds required');
  const points=path.points;
  if(sampleCount===null)sampleCount=points.length;
  if(sampleCount!==points.length||
     (history.tick===null)!==(points.length===0))
   throw new TypeError('Synchronized physical path samples required');
  let measured=0;
  for(let j=0;j<points.length;j++){
   const p=points[j],previous=points[j-1];
   if(!p||!Number.isInteger(p.tick)||p.tick<0||
      !finite(p.x)||!finite(p.y)||
      Math.abs(p.x)>maxX+1e-8||Math.abs(p.y)>maxY+1e-8)
    throw new TypeError('Finite actual pitch XY and tick required');
   if(firstTick===null)firstTick=p.tick;
   if(p.tick!==firstTick+j||
      (j>0&&p.tick!==previous.tick+1))
    throw new RangeError('No stale, skipped or future physical samples');
   if(previous)measured+=Math.hypot(p.x-previous.x,p.y-previous.y);
  }
  if(points.length&&points.at(-1).tick!==history.tick)
   throw new RangeError('Historical path must end at current tick');
  if(expected.team!==team)continue;
  travelM+=measured;
  if(points.length>1){
   const start=points[0],end=points.at(-1);
   netM+=Math.hypot(end.x-start.x,end.y-start.y);
  }
 }
 return Object.freeze({
  observedTicks:Math.max(0,(sampleCount??0)-1),
  meanTravelM:travelM/11,
  meanDisplacementM:netM/11,
  meanExtraMotionM:Math.max(0,travelM-netM)/11
 });
}
// ME-PLAYER-28: isolated per-player inspection of canonical CURRENT body
// and measured PAST samples. Inspecting never steers or advances the world.
export function inspectObservedPlayer(snapshot,history,id){
 const expected=INITIAL_PLAYERS.find(p=>p.id===id);
 if(!expected||!snapshot||!Array.isArray(snapshot.players)||
    snapshot.players.length!==INITIAL_PLAYERS.length||
    !Number.isInteger(snapshot.tick)||snapshot.tick<0||
    !history||history.tick!==snapshot.tick)
  throw new TypeError('Real current player, tick, and synchronized history required');
 // Validate every recorded body before trusting any individual history.
 summarizeObservedTrailDistances(history,expected.team);
 const matches=snapshot.players.filter(p=>p?.id===id);
 if(matches.length!==1)throw new TypeError('Unique current player required');
 const player=matches[0];
 if(player.team!==expected.team||player.role!==expected.role||
    player.number!==expected.number||
    (player.blockedBy!=null&&
      (!INITIAL_PLAYERS.some(x=>x.id===player.blockedBy)||player.blockedBy===id)))
  throw new TypeError('Canonical player identity and observed blocker required');
 observedPlayerVelocityVector(player);
 const path=history.paths.find(p=>p.id===id);
 if(!path||path.team!==expected.team||!path.points.length||
    path.points.at(-1).tick!==snapshot.tick||
    Math.hypot(path.points.at(-1).x-player.x,
      path.points.at(-1).y-player.y)>1e-8)
  throw new TypeError('Player path must end at actual current XY');
 let travelM=0;
 for(let i=1;i<path.points.length;i++){
  travelM+=Math.hypot(path.points[i].x-path.points[i-1].x,
                       path.points[i].y-path.points[i-1].y);
 }
 const start=path.points[0],end=path.points.at(-1);
 return Object.freeze({
  id,team:expected.team,number:expected.number,role:expected.role,
  x:player.x,y:player.y,
  speedMps:Math.hypot(player.vx,player.vy),
  blockedBy:player.blockedBy??null,
  observedTicks:path.points.length-1,
  travelM,netM:Math.hypot(end.x-start.x,end.y-start.y)
 });
}
// ME-PLAYER-29: read-only assignment labels from the exact current 11v11
// snapshot, never extrapolated intentions or motion. No in-engine writes.
export function currentObservedPlayerAssignments(snapshot,id){
 const original=INITIAL_PLAYERS.find(p=>p.id===id);
 if(!original)throw new TypeError('Known canonical player ID required');
 const side=original.team,other=side==='home'?'away':'home';
 const ids=new Set(INITIAL_PLAYERS.filter(p=>p.team===side).map(p=>p.id));
 const opponentIds=new Set(INITIAL_PLAYERS.filter(p=>p.team===other).map(p=>p.id));
 const tables=['pressers','coverers','screens','supports','balances','recoveries'];
 if(tables.some(name=>!snapshot[name]||
     !Object.prototype.hasOwnProperty.call(snapshot[name],side)))
  throw new TypeError('Complete current tactical assignments required');
 const same=id=>id===null||ids.has(id);
 const against=id=>opponentIds.has(id);
 const press=snapshot.pressers[side],cover=snapshot.coverers[side];
 const screen=snapshot.screens[side],support=snapshot.supports[side];
 const balance=snapshot.balances[side],recovery=snapshot.recoveries[side];
 if(!same(press)||!same(cover))throw new TypeError('Observed team duties must have real teammate IDs');
 if(screen!==null&&(!screen||!ids.has(screen.defenderId)||
    !against(screen.opponentId)))throw new TypeError('Observed screen must name real sides');
 if(support!==null&&(!support||!ids.has(support.playerId)))
  throw new TypeError('Observed support must name real teammate');
 if(balance!==null&&(!balance||!ids.has(balance.playerId)||
    !against(balance.opponentId)))
  throw new TypeError('Observed balance must name real sides');
 if(recovery!==null&&(!recovery||!Array.isArray(recovery.playerIds)||
    !recovery.playerIds.every(x=>ids.has(x))||
    new Set(recovery.playerIds).size!==recovery.playerIds.length||
    !against(recovery.opponentId)))
  throw new TypeError('Observed recovery must name real distinct teammates and opponent');
 const assignments=[],opponents=[];
 if(press===id)assignments.push('Pressing');
 if(cover===id)assignments.push('Covering');
 if(screen?.defenderId===id){assignments.push('Zonal screen');opponents.push(screen.opponentId);}
 if(support?.playerId===id)assignments.push('Space support');
 if(balance?.playerId===id){assignments.push('Weak-side balance');opponents.push(balance.opponentId);}
 if(recovery?.playerIds.includes(id)){assignments.push('Defensive recovery');opponents.push(recovery.opponentId);}
 return Object.freeze({
  id,team:side,
  assignments:Object.freeze(assignments),
  observedOpponents:Object.freeze([...new Set(opponents)]),
  fallback:assignments.length?'':original.role==='goalkeeper'?
   'Goalkeeper role':'No explicit assignment'
 });
}
export function inspectObservedPlayerAssignments(snapshot,history,id){
 inspectObservedPlayer(snapshot,history,id);
 return currentObservedPlayerAssignments(snapshot,id);
}
// ME-PLAYER-30: bounded 60Hz evidence of ACTUAL assignment transitions.
// Records every canonical player, independently of whether a player is selected.
// The observer never controls or alters assignments, positions or physics.
export function createObservedAssignmentTimeline(maxTicks=PLAYER_OBSERVED_PATH_WINDOW_TICKS){
 if(!Number.isInteger(maxTicks)||maxTicks<1||
    maxTicks>PLAYER_OBSERVED_PATH_WINDOW_TICKS)
  throw new RangeError('Bounded positive observed assignment window required');
 const samples=[];
 function record(snapshot){
  if(!snapshot||!Number.isInteger(snapshot.tick)||snapshot.tick<0||
     !Array.isArray(snapshot.players)||snapshot.players.length!==INITIAL_PLAYERS.length)
   throw new TypeError('Exactly 22 canonical live player bodies and tick required');
  if(samples.length&&snapshot.tick!==samples.at(-1).tick+1)
   throw new RangeError('Assignments must be observed at contiguous 60Hz ticks');
  // Atomic validation: malformed current bodies or cross-team duties
  // cannot leave a partial player/tick record.
  for(let i=0;i<INITIAL_PLAYERS.length;i++){
   const p=snapshot.players[i],original=INITIAL_PLAYERS[i];
   if(!p||p.id!==original.id||p.team!==original.team||
      p.role!==original.role||p.number!==original.number)
    throw new TypeError('Canonical ordered physical bodies required');
   observedPlayerVelocityVector(p);
  }
  const assignments=Object.freeze(INITIAL_PLAYERS.map(p=>
   currentObservedPlayerAssignments(snapshot,p.id)));
  samples.push(Object.freeze({tick:snapshot.tick,assignments}));
  if(samples.length>maxTicks+1)samples.shift();
 }
 function snapshot(){
  return Object.freeze({
   tick:samples.length?samples.at(-1).tick:null,maxTicks,
   samples:Object.freeze(samples.slice())
  });
 }
 return Object.freeze({record,snapshot,reset:()=>createObservedAssignmentTimeline(maxTicks)});
}
export function summarizeObservedAssignmentTransitions(timeline,id){
 const expected=INITIAL_PLAYERS.find(p=>p.id===id);
 if(!expected||!timeline||
    !Number.isInteger(timeline.maxTicks)||timeline.maxTicks<1||
    timeline.maxTicks>PLAYER_OBSERVED_PATH_WINDOW_TICKS||
    !Array.isArray(timeline.samples)||
    timeline.samples.length>timeline.maxTicks+1||
    !(timeline.tick===null||
      (Number.isInteger(timeline.tick)&&timeline.tick>=0)))
  throw new TypeError('Valid bounded canonical assignment timeline required');
 const samples=timeline.samples;
 if((timeline.tick===null)!==(samples.length===0))
  throw new TypeError('Synchronized observed assignment ticks required');
 let previous=null,changes=0,lastChange=null;
 const allowed=new Set(['Pressing','Covering','Zonal screen','Space support',
  'Weak-side balance','Defensive recovery']);
 for(let i=0;i<samples.length;i++){
  const sample=samples[i];
  if(!sample||!Number.isInteger(sample.tick)||sample.tick<0||
     sample.tick!==timeline.tick-(samples.length-1-i)||
     !Array.isArray(sample.assignments)||
     sample.assignments.length!==INITIAL_PLAYERS.length)
   throw new TypeError('Contiguous complete real 22-player assignment samples required');
  const seen=new Set();
  for(let j=0;j<INITIAL_PLAYERS.length;j++){
   const a=sample.assignments[j],original=INITIAL_PLAYERS[j];
   if(!a||a.id!==original.id||a.team!==original.team||
      !Array.isArray(a.assignments)||!Array.isArray(a.observedOpponents)||
      typeof a.fallback!=='string'||
      !a.assignments.every(label=>allowed.has(label))||
      new Set(a.assignments).size!==a.assignments.length||
      !a.observedOpponents.every(opp=>INITIAL_PLAYERS.some(p=>
        p.id===opp&&p.team!==original.team))||
      new Set(a.observedOpponents).size!==a.observedOpponents.length||
      seen.has(a.id))
    throw new TypeError('Canonical, unique observed duties and opponent IDs required');
   seen.add(a.id);
  }
  const current=sample.assignments[INITIAL_PLAYERS.indexOf(expected)];
  if(previous){
   const oldKey=JSON.stringify([previous.assignments,previous.observedOpponents]);
   const newKey=JSON.stringify([current.assignments,current.observedOpponents]);
   if(oldKey!==newKey){
    changes++;
    lastChange=Object.freeze({
     tick:sample.tick,
     from:Object.freeze(previous.assignments.slice()),
     to:Object.freeze(current.assignments.slice()),
     fromOpponents:Object.freeze(previous.observedOpponents.slice()),
     toOpponents:Object.freeze(current.observedOpponents.slice())
    });
   }
  }
  previous=current;
 }
 return Object.freeze({
  id,team:expected.team,
  observedTicks:Math.max(0,samples.length-1),
  changes,lastChange
 });
}
// ME-PLAYER-31: strictly elapsed 60Hz intervals from real observed duties.
// The first/oldest sample is a baseline; multiple simultaneous assignments
// each accrue their own interval, without double-counting elapsed seconds.
export function summarizeObservedDutyOccupancy(timeline,id){
 const verified=summarizeObservedAssignmentTransitions(timeline,id);
 const index=INITIAL_PLAYERS.findIndex(p=>p.id===id);
 const labels=['Pressing','Covering','Zonal screen','Space support',
  'Weak-side balance','Defensive recovery'];
 const counts=new Map(labels.map(label=>[label,0]));
 let assignedTicks=0,unassignedTicks=0;
 const entries=timeline.samples;
 for(let i=1;i<entries.length;i++){
  const active=entries[i].assignments[index].assignments;
  if(active.length===0)unassignedTicks++;
  else{
   assignedTicks++;
   for(const label of active)counts.set(label,counts.get(label)+1);
  }
 }
 let currentStreakTicks=0;
 if(entries.length>1){
  const key=a=>JSON.stringify([a.assignments,a.observedOpponents]);
  const recent=key(entries.at(-1).assignments[index]);
  for(let i=entries.length-1;i>=1;i--){
   if(key(entries[i].assignments[index])!==recent)break;
   currentStreakTicks++;
  }
 }
 if(assignedTicks+unassignedTicks!==verified.observedTicks)
  throw new RangeError('Observed 60Hz duty intervals must cover real elapsed ticks');
 return Object.freeze({
  id,team:verified.team,observedTicks:verified.observedTicks,
  assignedTicks,unassignedTicks,currentStreakTicks,
  duties:Object.freeze(labels.filter(label=>counts.get(label)>0)
   .map(label=>Object.freeze({label,ticks:counts.get(label),
    seconds:counts.get(label)*PLAYER_DT})))
 });
}
// ME-PLAYER-32: actual physical distance travelled WHILE each real
// assignment was present; no assertion that a duty CAUSED any motion.
// The measured (previous,current] XY segment belongs to the assignment
// actually recorded at its current tick. Overlapping real duties each
// receive that segment without double-counting total travelled distance.
export function summarizeObservedDutyTravel(timeline,history,id){
 const occupancy=summarizeObservedDutyOccupancy(timeline,id);
 const physical=summarizeObservedTrailDistances(history,occupancy.team);
 const index=INITIAL_PLAYERS.findIndex(p=>p.id===id);
 if(history.tick!==timeline.tick||
    history.maxTicks!==timeline.maxTicks||
    physical.observedTicks!==occupancy.observedTicks||
    history.paths[index]?.id!==id||
    history.paths[index].team!==occupancy.team||
    history.paths[index].points.length!==timeline.samples.length)
  throw new TypeError('Identical bounded real 60Hz duty and XY windows required');
 const points=history.paths[index].points;
 const samples=timeline.samples;
 const meters=new Map(['Pressing','Covering','Zonal screen','Space support',
  'Weak-side balance','Defensive recovery'].map(label=>[label,0]));
 let totalM=0,assignedM=0,unassignedM=0;
 for(let i=0;i<samples.length;i++){
  if(points[i].tick!==samples[i].tick)
   throw new TypeError('Duty and physical XY samples must share every real tick');
  if(!i)continue;
  const d=Math.hypot(points[i].x-points[i-1].x,
                     points[i].y-points[i-1].y);
  totalM+=d;
  const active=samples[i].assignments[index].assignments;
  if(!active.length)unassignedM+=d;
  else{
   assignedM+=d;
   for(const label of active)meters.set(label,meters.get(label)+d);
  }
 }
 const tolerance=1e-8;
 if(Math.abs(assignedM+unassignedM-totalM)>tolerance||
    !Number.isFinite(totalM))
  throw new RangeError('Real interval distance must reconcile without duplication');
 const duties=Object.freeze(occupancy.duties.map(d=>Object.freeze({
  label:d.label,ticks:d.ticks,meters:meters.get(d.label)
 })));
 return Object.freeze({
  id,team:occupancy.team,observedTicks:occupancy.observedTicks,
  totalM,assignedM,unassignedM,duties
 });
}
// ME-PLAYER-33: observed directional COMPONENTS, not additional path
// metres, tactical intent or motion commands. Home attacks +X; Away -X.
// Each real (previous,current] XY segment is assigned to labels at its
// ending tick. Orthogonal components do not sum to Euclidean path metres.
export function summarizeObservedDutyDirections(timeline,history,id){
 const verified=summarizeObservedDutyTravel(timeline,history,id);
 const index=INITIAL_PLAYERS.findIndex(p=>p.id===id);
 const points=history.paths[index].points;
 const samples=timeline.samples;
 const blank=()=>({forwardM:0,backwardM:0,lateralM:0});
 const total=blank(),assigned=blank(),unassigned=blank();
 const perDuty=new Map(verified.duties.map(d=>[d.label,blank()]));
 const direction=verified.team==='home'?1:-1;
 const add=(bucket,components)=>{
  bucket.forwardM+=components.forwardM;
  bucket.backwardM+=components.backwardM;
  bucket.lateralM+=components.lateralM;
 };
 for(let i=1;i<points.length;i++){
  const attackingDx=(points[i].x-points[i-1].x)*direction;
  const components={
   forwardM:Math.max(0,attackingDx),
   backwardM:Math.max(0,-attackingDx),
   lateralM:Math.abs(points[i].y-points[i-1].y)
  };
  add(total,components);
  const duties=samples[i].assignments[index].assignments;
  if(!duties.length)add(unassigned,components);
  else{
   add(assigned,components);
   for(const duty of duties)add(perDuty.get(duty),components);
  }
 }
 for(const name of ['forwardM','backwardM','lateralM']){
  if(!Number.isFinite(total[name])||
     Math.abs(assigned[name]+unassigned[name]-total[name])>1e-8)
   throw new RangeError('Observed component totals must match real segments');
 }
 const freeze=x=>Object.freeze({...x});
 return Object.freeze({
  id,team:verified.team,observedTicks:verified.observedTicks,
  total:freeze(total),assigned:freeze(assigned),
  unassigned:freeze(unassigned),
  duties:Object.freeze(verified.duties.map(d=>Object.freeze({
   label:d.label,ticks:d.ticks,...perDuty.get(d.label)
  })))
 });
}
// ME-PLAYER-34: observed per-tick XY segment speed, not instantaneous
// velocity, sprint effort, physical workload or tactical effectiveness.
// Each real interval is correlated only to the duties recorded at its end.
// Multiple actual labels may share an interval, never the overall time.
export function summarizeObservedDutyPace(timeline,history,id){
 const physical=summarizeObservedDutyTravel(timeline,history,id);
 const index=INITIAL_PLAYERS.findIndex(p=>p.id===id);
 const points=history.paths[index].points,samples=timeline.samples;
 const blank=()=>({ticks:0,movingTicks:0,meters:0,peakMps:0});
 const total=blank(),assigned=blank(),unassigned=blank();
 const perDuty=new Map(physical.duties.map(d=>[d.label,blank()]));
 const add=(bucket,meters,speed)=>{
  bucket.ticks++;
  bucket.meters+=meters;
  if(speed>=PLAYER_OBSERVED_MOTION_THRESHOLD_MPS)bucket.movingTicks++;
  bucket.peakMps=Math.max(bucket.peakMps,speed);
 };
 for(let i=1;i<points.length;i++){
  const meters=Math.hypot(points[i].x-points[i-1].x,
   points[i].y-points[i-1].y);
  const speed=meters/PLAYER_DT;
  if(!Number.isFinite(speed))
   throw new RangeError('Finite actual 60Hz physical step speed required');
  add(total,meters,speed);
  const active=samples[i].assignments[index].assignments;
  if(active.length){
   add(assigned,meters,speed);
   for(const label of active)add(perDuty.get(label),meters,speed);
  }else add(unassigned,meters,speed);
 }
 if(total.ticks!==physical.observedTicks||
    assigned.ticks+unassigned.ticks!==total.ticks||
    assigned.movingTicks+unassigned.movingTicks!==total.movingTicks||
    Math.abs(total.meters-physical.totalM)>1e-8||
    Math.abs(assigned.meters-physical.assignedM)>1e-8||
    Math.abs(unassigned.meters-physical.unassignedM)>1e-8)
  throw new RangeError('Measured motion must reconcile with real duty travel');
 const freeze=b=>Object.freeze({
  ticks:b.ticks,movingTicks:b.movingTicks,
  meanMps:b.ticks?b.meters/(b.ticks*PLAYER_DT):0,
  peakMps:b.peakMps
 });
 return Object.freeze({
  id,team:physical.team,observedTicks:physical.observedTicks,
  total:freeze(total),assigned:freeze(assigned),unassigned:freeze(unassigned),
  duties:Object.freeze(physical.duties.map(d=>{
   const pace=perDuty.get(d.label);
   if(pace.ticks!==d.ticks||Math.abs(pace.meters-d.meters)>1e-8)
    throw new RangeError('Per-duty interval pace must match recorded distance');
   return Object.freeze({label:d.label,...freeze(pace)});
  }))
 });
}
export function observedPlayerVelocityVector(p){
 if(!p||!['home','away'].includes(p.team)||
  !finite(p.x)||!finite(p.y)||!finite(p.vx)||!finite(p.vy))
  throw new TypeError('Finite current player XY/VX/VY required');
 const maxX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
 const maxY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
 if(Math.abs(p.x)>maxX+1e-8||Math.abs(p.y)>maxY+1e-8)
  throw new RangeError('Player outside pitch');
 const speedMps=Math.hypot(p.vx,p.vy);
 if(speedMps<PLAYER_OBSERVED_MOTION_THRESHOLD_MPS)return null;
 const toX=clamp(p.x+p.vx*PLAYER_OBSERVED_VECTOR_SECONDS,-maxX,maxX);
 const toY=clamp(p.y+p.vy*PLAYER_OBSERVED_VECTOR_SECONDS,-maxY,maxY);
 if(Math.hypot(toX-p.x,toY-p.y)<1e-8)return null;
 return Object.freeze({x:p.x,y:p.y,toX,toY,speedMps});
}
export function summarizeObservedPlayerMotion(players,team){
 if(!Array.isArray(players)||!['home','away'].includes(team))
  throw new TypeError('Valid observed team required');
 const side=players.filter(p=>p?.team===team);
 if(side.length!==11||new Set(side.map(p=>p.id)).size!==11)
  throw new TypeError('Exactly eleven distinct physical team bodies required');
 let moving=0,blocked=0,total=0;
 for(const p of side){
  if(typeof p.id!=='string'||!p.id.startsWith(team+'-')||
   (p.blockedBy!=null&&typeof p.blockedBy!=='string'))
   throw new TypeError('Valid player ID and blocker required');
  observedPlayerVelocityVector(p);
  const speed=Math.hypot(p.vx,p.vy);
  if(speed>=PLAYER_OBSERVED_MOTION_THRESHOLD_MPS)moving++;
  if(p.blockedBy!=null)blocked++;
  total+=speed;
 }
 return Object.freeze({moving,stopped:11-moving,blocked,meanSpeedMps:total/11});
}
function teamShape(players,team,presserId){
 const supporters=players.filter(p=>p.team===team&&p.role!=='goalkeeper'&&p.id!==presserId);
 const xs=supporters.map(p=>p.x),ys=supporters.map(p=>p.y);
 const mean=role=>{
  const line=players.filter(p=>p.team===team&&p.role===role&&p.id!==presserId);
  return line.length?line.reduce((sum,p)=>sum+p.x,0)/line.length:null;
 };
 return Object.freeze({
  supporters:supporters.length,
  widthM:Math.max(...ys)-Math.min(...ys),
  depthM:Math.max(...xs)-Math.min(...xs),
  defenderLineX:mean('defender'),
  midfieldLineX:mean('midfielder'),
  forwardLineX:mean('forward')
 });
}
export function createPlayerMovement(){
 let tick=0;
 const players=INITIAL_PLAYERS.map(p=>({...p}));
 let lastBall={x:0,y:0};
 let pressers={home:'home-10',away:'away-10'};
 let pressSwitches={home:0,away:0};
 let coverers={home:null,away:null};
 let coverSwitches={home:0,away:0};
 let screens={home:null,away:null};
 let screenSwitches={home:0,away:0};
 let supports={home:null,away:null};
 let supportSwitches={home:0,away:0};
 let recoveries={home:null,away:null};
 let recoverySwitches={home:0,away:0};
 let balances={home:null,away:null};
 let balanceSwitches={home:0,away:0};
 let lineResponses={home:null,away:null};
 let clearanceNeighbors=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,null]));
 let clearanceSwitches={home:0,away:0};
 const stallEvidence=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,
  Object.freeze({blockerId:null,ticks:0})]));
 const detourBlockers=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,null]));
 const detourSides=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,null]));
 const detourProgress=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,
   Object.freeze({activeTicks:0,stagnantTicks:0})]));
 const detourLastMovement=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,
   Object.freeze({offCourse:false})]));
 let detourBackwardTicks={home:0,away:0};
 let detourCompletions={home:0,away:0};
 const rejoinHandoffTicks=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,0]));
 let rejoinHandoffStarts={home:0,away:0};
 let handoffCrowding=Object.freeze({
  home:Object.freeze({blocked:0,cancelled:0}),
  away:Object.freeze({blocked:0,cancelled:0})
 });
 let handoffCrowdingCancels={home:0,away:0};
 let detourRejoin=Object.freeze({
  home:Object.freeze({blocked:0}),
  away:Object.freeze({blocked:0})
 });
 let detourAbandons={home:0,away:0};
 const detourCooldown=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,
   Object.freeze({blockerId:null,remaining:0})]));
 let detourActivations={home:0,away:0};
 let alternateDetourRoutes={home:0,away:0};
 const crossingOffsets=Object.fromEntries(players.filter(p=>
  p.role!=='goalkeeper').map(p=>[p.id,Object.freeze({x:0,y:0})]));
 let activeCrossingIds=new Set();
 let crossingIntent=Object.freeze({
  home:Object.freeze({active:0,nearestEtaS:null}),
  away:Object.freeze({active:0,nearestEtaS:null})
 });
 const lineOffsets=Object.fromEntries(players.filter(p=>
  p.role==='defender'||p.role==='midfielder').map(p=>[p.id,
  Object.freeze({x:0,y:0})]));
 function snapshot(){
  return Object.freeze({
   version:PLAYER_VERSION,tick,timeS:tick*PLAYER_DT,
   ball:Object.freeze({...lastBall}),
   observedMotion:Object.freeze({
    home:summarizeObservedPlayerMotion(players,'home'),
    away:summarizeObservedPlayerMotion(players,'away')
   }),
   pressers:Object.freeze({...pressers}),
   pressSwitches:Object.freeze({...pressSwitches}),
   coverers:Object.freeze({...coverers}),
   coverSwitches:Object.freeze({...coverSwitches}),
   screens:Object.freeze({...screens}),
   screenSwitches:Object.freeze({...screenSwitches}),
   supports:Object.freeze({...supports}),
   supportSwitches:Object.freeze({...supportSwitches}),
   recoveries:Object.freeze({...recoveries}),
   recoverySwitches:Object.freeze({...recoverySwitches}),
   balances:Object.freeze({...balances}),
   balanceSwitches:Object.freeze({...balanceSwitches}),
   lineResponses:Object.freeze({...lineResponses}),
   detourCompletions:Object.freeze({...detourCompletions}),
   detourRejoin,
    handoffCrowding,
   rejoinHandoffs:Object.freeze({
    home:Object.freeze({
     active:players.filter(p=>p.team==='home'&&
      rejoinHandoffTicks[p.id]>0).length,
     starts:rejoinHandoffStarts.home
    }),
    away:Object.freeze({
     active:players.filter(p=>p.team==='away'&&
      rejoinHandoffTicks[p.id]>0).length,
     starts:rejoinHandoffStarts.away
    })
   }),
   detourStability:Object.freeze({
    home:Object.freeze({
     guarding:players.filter(p=>p.team==='home'&&
      detourCooldown[p.id]?.remaining>0).length,
     alternateRoutes:alternateDetourRoutes.home
    }),
    away:Object.freeze({
     guarding:players.filter(p=>p.team==='away'&&
      detourCooldown[p.id]?.remaining>0).length,
     alternateRoutes:alternateDetourRoutes.away
    })
   }),
   detourAlignment:Object.freeze({
    home:Object.freeze({
     offCourse:players.filter(p=>p.team==='home'&&
      detourBlockers[p.id]!=null&&detourLastMovement[p.id].offCourse).length,
     backwardTicks:detourBackwardTicks.home
    }),
    away:Object.freeze({
     offCourse:players.filter(p=>p.team==='away'&&
      detourBlockers[p.id]!=null&&detourLastMovement[p.id].offCourse).length,
     backwardTicks:detourBackwardTicks.away
    })
   }),
   detourProgress:Object.freeze({
    home:Object.freeze({
     slow:players.filter(p=>p.team==='home'&&detourBlockers[p.id]!=null&&
      detourProgress[p.id].stagnantTicks>=
      PLAYER_DETOUR_STAGNANT_WARNING_TICKS).length,
     abandoned:detourAbandons.home
    }),
    away:Object.freeze({
     slow:players.filter(p=>p.team==='away'&&detourBlockers[p.id]!=null&&
      detourProgress[p.id].stagnantTicks>=
      PLAYER_DETOUR_STAGNANT_WARNING_TICKS).length,
     abandoned:detourAbandons.away
    })
   }),
   detourRecovery:Object.freeze({
    home:Object.freeze({active:players.filter(p=>p.team==='home'&&
     detourBlockers[p.id]!=null).length,
     blocked:players.filter(p=>p.team==='home'&&p.blockedBy&&
      players.some(m=>m.id===p.blockedBy&&m.team==='home')).length,
     activations:detourActivations.home}),
    away:Object.freeze({active:players.filter(p=>p.team==='away'&&
     detourBlockers[p.id]!=null).length,
     blocked:players.filter(p=>p.team==='away'&&p.blockedBy&&
      players.some(m=>m.id===p.blockedBy&&m.team==='away')).length,
     activations:detourActivations.away})
   }),
   crossingIntent,
   crossingTransitions:Object.freeze({
    home:crossingTransitionSummary(players,crossingOffsets,activeCrossingIds,'home'),
    away:crossingTransitionSummary(players,crossingOffsets,activeCrossingIds,'away')
   }),
   teammateAvoidance:Object.freeze({
    home:Object.freeze({active:players.filter(p=>p.team==='home'&&
      clearanceNeighbors[p.id]!=null).length,switches:clearanceSwitches.home}),
    away:Object.freeze({active:players.filter(p=>p.team==='away'&&
      clearanceNeighbors[p.id]!=null).length,switches:clearanceSwitches.away})
   }),
   teammateProximity:Object.freeze({
    home:measureTeammateProximity(players,'home'),
    away:measureTeammateProximity(players,'away')
   }),
   lineCohesion:Object.freeze({
    home:measureLineCohesion(players,'home'),
    away:measureLineCohesion(players,'away')
   }),
   lineTransitions:Object.freeze({
    home:lineTransitionSummary(players,lineOffsets,recoveries,'home'),
    away:lineTransitionSummary(players,lineOffsets,recoveries,'away')
   }),
   keeperTargets:Object.freeze({
    home:goalkeeperPosition('home',lastBall),
    away:goalkeeperPosition('away',lastBall)
   }),
   ballSector:ballSector(lastBall),
   shape:Object.freeze({
    home:teamShape(players,'home',pressers.home),
    away:teamShape(players,'away',pressers.away)
   }),
   players:Object.freeze(players.map(p=>Object.freeze({...p})))
  });
 }
 function step(ballPosition={x:0,y:0}){
  const ball=ballXY(ballPosition);
  const home=pressingPlayer(players,'home',ball,pressers.home);
  const away=pressingPlayer(players,'away',ball,pressers.away);
  const nextPressers={home:home?.id??null,away:away?.id??null};
  const coveringHome=coveringDefender(
   players,'home',ball,nextPressers.home,coverers.home);
  const coveringAway=coveringDefender(
   players,'away',ball,nextPressers.away,coverers.away);
  const nextCoverers={home:coveringHome?.id??null,away:coveringAway?.id??null};
  const nextScreens={
   home:zonalScreen(players,'home',ball,nextPressers.home,nextCoverers.home,screens.home),
   away:zonalScreen(players,'away',ball,nextPressers.away,nextCoverers.away,screens.away)
  };
  const nextBalances={
   home:weakSideDefender(players,'home',nextScreens.home,nextPressers.home,
    nextCoverers.home,balances.home),
   away:weakSideDefender(players,'away',nextScreens.away,nextPressers.away,
    nextCoverers.away,balances.away)
  };
  const nextRecoveries={
   home:defensiveRecovery(players,'home',nextScreens.home,nextPressers.home,
    nextCoverers.home,nextBalances.home?.playerId),
   away:defensiveRecovery(players,'away',nextScreens.away,nextPressers.away,
    nextCoverers.away,nextBalances.away?.playerId)
  };
  const nextLineResponses={
   home:coordinatedLineResponse(players,'home',nextRecoveries.home),
   away:coordinatedLineResponse(players,'away',nextRecoveries.away)
  };
  const nextSupports={
   home:supportSpace(players,'home',ball,nextPressers.home,nextCoverers.home,
     nextScreens.home,supports.home),
   away:supportSpace(players,'away',ball,nextPressers.away,nextCoverers.away,
     nextScreens.away,supports.away)
  };
  // Real teammate positions from the start of this tick; all 22 targets
  // see the same immutable line sample regardless of player update order.
  const cohesion={
   home:measureLineCohesion(players,'home'),
   away:measureLineCohesion(players,'away')
  };
  const nextClearanceNeighbors={...clearanceNeighbors};
  // All cooldowns age exactly one 60Hz tick; no background clock.
  for(const id of Object.keys(detourCooldown))
   detourCooldown[id]=advanceDetourRetryCooldown(detourCooldown[id]);
  const freeOutfielderIds=new Set();
  const releaseDetour=(p)=>{
   const old=detourBlockers[p.id];
   if(old!==null)
    detourCooldown[p.id]=advanceDetourRetryCooldown(detourCooldown[p.id],old);
   detourBlockers[p.id]=null;
   detourSides[p.id]=null;
   detourProgress[p.id]=Object.freeze({activeTicks:0,stagnantTicks:0});
   detourLastMovement[p.id]=Object.freeze({offCourse:false});
   rejoinHandoffTicks[p.id]=0;
  };
  const crowdedHandoffsThisTick={home:0,away:0};
   const continueRejoin=(p,target)=>{
   const remaining=rejoinHandoffTicks[p.id];
   if(!remaining)return target;
   const blockerId=detourCooldown[p.id].blockerId;
   const blocker=players.find(q=>q.id===blockerId&&q.team===p.team);
   const cue=observedVelocityRejoinTarget(p,target,remaining);
   // Moving blockers are always rechecked at CURRENT actual XY.
   // If the cue points into that teammate, or there is no observed
   // blocker or compatible measured velocity, cancel smoothing.
   if(!blocker||(cue.x===target.x&&cue.y===target.y)||
     !measureObservedDetourRejoinCorridor(p,blocker,cue).safe){
    rejoinHandoffTicks[p.id]=0;
    return target;
   }
   if(!measureObservedHandoffCorridor(p,players,cue).safe){
     crowdedHandoffsThisTick[p.team]++;
     handoffCrowdingCancels[p.team]++;
     rejoinHandoffTicks[p.id]=0;
     return target;
    }
    rejoinHandoffTicks[p.id]=remaining-1;
   return cue;
  };
  const blockedRejoinsThisTick={home:0,away:0};
  const detourTarget=(p,target)=>{
   freeOutfielderIds.add(p.id);
   const blockerId=detourBlockers[p.id];
   if(blockerId===null)return continueRejoin(p,target);
   const blocker=players.find(q=>q.id===blockerId&&q.team===p.team);
   if(!blocker){
    releaseDetour(p);
    stallEvidence[p.id]=Object.freeze({blockerId:null,ticks:0});
    return target;
   }
   const waypoint=observedTeammateDetourTarget(target,p,blocker,
    detourSides[p.id]);
   if(!waypoint){
    releaseDetour(p);
    // A stale saturated counter must never immediately re-arm a failed path.
    stallEvidence[p.id]=Object.freeze({blockerId:null,ticks:0});
    return target;
   }
   if(reachedObservedDetourWaypoint(p,blocker,waypoint)){
    const corridor=measureObservedDetourRejoinCorridor(p,blocker,target);
    if(!corridor.safe){
     // The lateral waypoint is physically reached, but a direct
     // return would still pass near the ACTUAL blocker this tick.
     // Retain the detour subject to the normal 24/180-tick watchdog,
     // rather than claiming an unsafe or imagined successful bypass.
     blockedRejoinsThisTick[p.team]++;
     return waypoint;
    }
    // Safe current arrival AND actual short rejoin corridor.
    // Release using the existing same-blocker cooldown path.
    releaseDetour(p);
    stallEvidence[p.id]=Object.freeze({blockerId:null,ticks:0});
    detourCompletions[p.team]++;
    // Brief observed-heading handoff only for otherwise-free outfielders.
    // The same teammate's CURRENT XY must also clear the cue corridor.
    // Duration never exceeds 24 simulated 60Hz ticks.
    const cue=observedVelocityRejoinTarget(p,target,
     PLAYER_REJOIN_HANDOFF_TICKS);
    if((cue.x!==target.x||cue.y!==target.y)&&
      measureObservedDetourRejoinCorridor(p,blocker,cue).safe){
     if(!measureObservedHandoffCorridor(p,players,cue).safe){
       crowdedHandoffsThisTick[p.team]++;
       return target;
      }
      rejoinHandoffTicks[p.id]=PLAYER_REJOIN_HANDOFF_TICKS;
     rejoinHandoffStarts[p.team]++;
     return continueRejoin(p,target);
    }
    return target;
   }
   return waypoint;
  };
  const nextActiveCrossingIds=new Set();
  const clearCrossing=(p)=>{
   if(p.id in crossingOffsets)
    crossingOffsets[p.id]=Object.freeze({x:0,y:0});
  };
  const crossingSummary={home:{active:0,nearestEtaS:null},
   away:{active:0,nearestEtaS:null}};
  const applyClearance=(p,target)=>{
   const chosen=selectTeammateClearanceNeighbor(p,players,
    clearanceNeighbors[p.id]);
   nextClearanceNeighbors[p.id]=chosen?.id??null;
   if(chosen){
    clearCrossing(p);
    return teammateClearanceTarget(target,p,players,chosen.id);
   }
   const crossing=forecastTeammateCrossing(p,players);
   // Only CURRENT evidence creates desired spatial crossing offset.
   // No evidence -> zero desired, easing out any previous offset.
   const current=crossing?teammateCrossingTarget(target,p,players):target;
   const next=advanceCrossingIntentOffset(crossingOffsets[p.id],{
    x:current.x-target.x,y:current.y-target.y
   });
   crossingOffsets[p.id]=next;
   if(crossing){
    nextActiveCrossingIds.add(p.id);
    const summary=crossingSummary[p.team];
    summary.active++;
    summary.nearestEtaS=summary.nearestEtaS===null?crossing.etaS:
     Math.min(summary.nearestEtaS,crossing.etaS);
   }
   const halfX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
   const halfY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
   return Object.freeze({
    x:clamp(target.x+next.x,-halfX,halfX),
    y:clamp(target.y+next.y,-halfY,halfY)
   });
  };
  const targets=players.map(p=>{
   const screen=nextScreens[p.team];
   const observedOpponent=screen?.defenderId===p.id?
     players.find(other=>other.id===screen.opponentId):null;
   const space=nextSupports[p.team];
   const supportTarget=space?.playerId===p.id?space.target:null;
   const recovery=nextRecoveries[p.team];
   const recoveryOpponent=recovery?.playerIds.includes(p.id)?
     players.find(other=>other.id===recovery.opponentId):null;
   const pressing=p.id===nextPressers.home||p.id===nextPressers.away;
   const covering=p.id===nextCoverers.home||p.id===nextCoverers.away;
   const balance=nextBalances[p.team];
   const balanceOpponent=balance?.playerId===p.id?
     players.find(other=>other.id===balance.opponentId):null;
   const normal=tacticalTarget(p,ball,pressing,covering,
     observedOpponent,supportTarget,balanceOpponent);
   if(!(p.id in lineOffsets)){
    // Free forwards also maintain space; keepers and higher-priority
    // support, pressing and covering already returned their own target.
    if(p.role==='forward'&&!pressing&&!covering&&!supportTarget)
     return detourTarget(p,applyClearance(p,normal));
    if(p.role!=='goalkeeper'){
     nextClearanceNeighbors[p.id]=null;
     clearCrossing(p);
    }
    if(p.id in detourBlockers)releaseDetour(p);
    return normal;
   }
   // Higher-priority assignments immediately cancel residual recovery
   // intent; never damp pressing, cover, screening, balance or support.
   if(pressing||covering||observedOpponent||supportTarget||balanceOpponent){
    lineOffsets[p.id]=Object.freeze({x:0,y:0});
    nextClearanceNeighbors[p.id]=null;
    clearCrossing(p);
    releaseDetour(p);
    return normal;
   }
   // Soft compactness is sampled only from REAL teammates, and
   // applied only to unassigned defenders/midfielders. A screen still
   // exclusively controls the recovery offset; compactness does not
   // count as a new or persisting observed opponent.
   const compact=lineCohesionTarget(normal,p.team,p.role,cohesion[p.team]);
   const intended=recoveryOpponent?
     coordinatedLineTarget(compact,p.team,p.role,recoveryOpponent):compact;
   const next=advanceLineIntentOffset(lineOffsets[p.id],{
    x:intended.x-compact.x,y:intended.y-compact.y
   });
   lineOffsets[p.id]=next;
   const maxX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
   const maxY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
   const recovered={x:clamp(compact.x+next.x,-maxX,maxX),
    y:clamp(compact.y+next.y,-maxY,maxY)};
   // A single secondary clearance intent comes AFTER current real-threat
   // recovery and line cohesion. It never displaces dedicated duties.
   return detourTarget(p,applyClearance(p,recovered));
  });
  detourRejoin=Object.freeze({
   home:Object.freeze({blocked:blockedRejoinsThisTick.home}),
   away:Object.freeze({blocked:blockedRejoinsThisTick.away})
  });
  handoffCrowding=Object.freeze({
    home:Object.freeze({blocked:crowdedHandoffsThisTick.home,
     cancelled:handoffCrowdingCancels.home}),
    away:Object.freeze({blocked:crowdedHandoffsThisTick.away,
     cancelled:handoffCrowdingCancels.away})
   });
   // Capture current actual XY and this SAME tick's real chosen target;
  // only a shorter actual physical distance to that waypoint counts.
  const detourStartXY=new Map(players.filter(p=>detourBlockers[p.id]!=null)
   .map(p=>[p.id,Object.freeze({
    x:p.x,y:p.y,waypoint:targets[players.indexOf(p)]
   })]));
  // Fixed ordering and collision rejection make every replay byte-stable.
  for(let i=0;i<players.length;i++){
   const p=players[i],target=targets[i];
   const dx=target.x-p.x,dy=target.y-p.y,dist=Math.hypot(dx,dy);
   const previousSpeed=Math.hypot(p.vx,p.vy);
   const speedLimit=Math.min(PLAYER_MAX_SPEED_MPS,Math.sqrt(2*PLAYER_BRAKE_MPS2*dist));
   const targetVx=dist>1e-8?dx/dist*speedLimit:0;
   const targetVy=dist>1e-8?dy/dist*speedLimit:0;
   const dvx=targetVx-p.vx,dvy=targetVy-p.vy,dv=Math.hypot(dvx,dvy);
   const maxDelta=(speedLimit<previousSpeed?PLAYER_BRAKE_MPS2:PLAYER_ACCEL_MPS2)*PLAYER_DT;
   const ratio=dv>maxDelta?maxDelta/dv:1;
   let vx=p.vx+dvx*ratio,vy=p.vy+dvy*ratio;
   if(Math.hypot(vx,vy)<1e-9){vx=0;vy=0;}
   const maxX=PLAYER_PITCH.lengthM/2-PLAYER_RADIUS_M;
   const maxY=PLAYER_PITCH.widthM/2-PLAYER_RADIUS_M;
   const nextX=clamp(p.x+vx*PLAYER_DT,-maxX,maxX);
   const nextY=clamp(p.y+vy*PLAYER_DT,-maxY,maxY);
   if(Math.abs(nextX-(p.x+vx*PLAYER_DT))>1e-9)vx=0;
   if(Math.abs(nextY-(p.y+vy*PLAYER_DT))>1e-9)vy=0;
   const blocker=players.find(other=>other!==p&&
     (nextX-other.x)**2+(nextY-other.y)**2<
      PLAYER_MIN_SEPARATION_M**2-1e-9);
   // A rejected kinematic step is a hard stop, not physical collision
   // dynamics. Record the blocker explicitly: zeroing velocity here can
   // exceed free-space braking, and must never be mistaken for normal
   // bounded acceleration or an impulse imparted to the real match ball.
   p.blockedBy=blocker?.id??null;
   if(blocker){p.vx=0;p.vy=0;}
   else{p.x=nextX;p.y=nextY;p.vx=vx;p.vy=vy;}
   const speed=Math.hypot(p.vx,p.vy);
   if(speed>0.05){
    const desired=Math.atan2(p.vy,p.vx),angle=wrap(desired-p.facingRad);
    p.facingRad=wrap(p.facingRad+clamp(angle,
      -PLAYER_TURN_RAD_PER_S*PLAYER_DT,PLAYER_TURN_RAD_PER_S*PLAYER_DT));
   }
  }
  // Evaluate progress only after the existing hard kinematic collision
  // guard. A failed path is dropped and enters the ME-PLAYER-18 cooldown.
  for(const p of players){
   if(!(p.id in detourProgress)||detourBlockers[p.id]===null)continue;
   const start=detourStartXY.get(p.id);
   if(!start)continue; // just activated after physics in the previous tick
   const measured=measureObservedDetourAdvance(start,p,start.waypoint);
   detourProgress[p.id]=advanceObservedDetourProgress(
    detourProgress[p.id],measured.advanceM);
   const offCourse=measured.movedM>=
    PLAYER_DETOUR_OFF_COURSE_MIN_MOVEMENT_M&&
    measured.advanceM<PLAYER_DETOUR_PROGRESS_MIN_STEP_M;
   detourLastMovement[p.id]=Object.freeze({offCourse});
   if(measured.awayM>=PLAYER_DETOUR_PROGRESS_MIN_STEP_M)
    detourBackwardTicks[p.team]++;
   if(shouldAbortObservedDetour(detourProgress[p.id])){
    releaseDetour(p);
    stallEvidence[p.id]=Object.freeze({blockerId:null,ticks:0});
    detourAbandons[p.team]++;
   }
  }
  // Confirmation consumes only the just-observed hard collision result.
  // A new obstruction must last 12 consecutive ticks for a free outfielder.
  for(const p of players){
   if(!(p.id in detourBlockers))continue;
   if(!freeOutfielderIds.has(p.id)){
    stallEvidence[p.id]=Object.freeze({blockerId:null,ticks:0});
    releaseDetour(p);
    continue;
   }
   const sameSideBlocker=players.find(q=>
    q.id===p.blockedBy&&q.team===p.team);
   stallEvidence[p.id]=advanceObservedStall(stallEvidence[p.id],
    sameSideBlocker?.id??null);
   if(detourBlockers[p.id]===null&&sameSideBlocker&&
    stallEvidence[p.id].ticks===PLAYER_STALL_CONFIRM_TICKS&&
    !(detourCooldown[p.id].blockerId===sameSideBlocker.id&&
      detourCooldown[p.id].remaining>0)){
    // The target was already determined from this tick's actual teammate
    // data. Side selection is made ONCE, using the new real body positions.
    const side=selectObservedDetourSide(targets[players.indexOf(p)],
     p,sameSideBlocker,players);
    if(side!==null){
     detourBlockers[p.id]=sameSideBlocker.id;
     detourSides[p.id]=side;
     rejoinHandoffTicks[p.id]=0;
     detourActivations[p.team]++;
     if(side!==(p.id<sameSideBlocker.id?1:-1))
      alternateDetourRoutes[p.team]++;
    }
   }
  }
  for(const p of players){
   if(!(p.id in clearanceNeighbors))continue;
   if(clearanceNeighbors[p.id]!==nextClearanceNeighbors[p.id])
    clearanceSwitches[p.team]++;
  }
  clearanceNeighbors=nextClearanceNeighbors;
  activeCrossingIds=nextActiveCrossingIds;
  crossingIntent=Object.freeze({
   home:Object.freeze({...crossingSummary.home}),
   away:Object.freeze({...crossingSummary.away})
  });
  if(pressers.home!==nextPressers.home)pressSwitches.home++;
  if(pressers.away!==nextPressers.away)pressSwitches.away++;
  if(coverers.home!==nextCoverers.home)coverSwitches.home++;
  if(coverers.away!==nextCoverers.away)coverSwitches.away++;
  for(const team of ['home','away']){
   const previous=screens[team],current=nextScreens[team];
   if(previous?.defenderId!==current?.defenderId||
      previous?.opponentId!==current?.opponentId)screenSwitches[team]++;
  }
  for(const team of ['home','away']){
   const previous=supports[team],current=nextSupports[team];
   if(previous?.playerId!==current?.playerId||
      previous?.lane!==current?.lane)supportSwitches[team]++;
  }
  for(const team of ['home','away']){
   if(recoveries[team]?.opponentId!==nextRecoveries[team]?.opponentId)
    recoverySwitches[team]++;
  }
  for(const team of ['home','away']){
   if(balances[team]?.playerId!==nextBalances[team]?.playerId||
      balances[team]?.opponentId!==nextBalances[team]?.opponentId)
    balanceSwitches[team]++;
  }
  tick+=1;lastBall=ball;pressers=nextPressers;coverers=nextCoverers;
  screens=nextScreens;supports=nextSupports;recoveries=nextRecoveries;
  balances=nextBalances;lineResponses=nextLineResponses;
  return snapshot();
 }
 return Object.freeze({snapshot,step,reset:createPlayerMovement});
}
