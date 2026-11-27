// #628 ACTIONS-B05: original 60Hz Rapier ball crossing and minimal referee
// restarts. DEV read-only source auditor; never fabricates an action, possession,
// a touch, or a result in the world competitions database.
import {BALL_RADIUS,FIXED_DT} from './core.mjs';
import {PLAYER_PITCH,INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
export const B05_REFEREE_VERSION='actions-b05-native-boundary-referee-v1';
export const B05_GOAL_WIDTH_M=7.32;
export const B05_GOAL_HEIGHT_M=2.44;
const freeze=Object.freeze,finite=Number.isFinite;
const knownIds=new Set(INITIAL_PLAYERS.map(p=>p.id));
const halfX=PLAYER_PITCH.lengthM/2,halfY=PLAYER_PITCH.widthM/2;
const inside=(n,min,max)=>Math.max(min,Math.min(max,n));
const fixed=Object.freeze;
function restartFor({edge,side,intersection,lastTouchTeam,scoringTeam}){
 if(edge==='goal'){
  const team=scoringTeam==='home'?'away':'home';
  return freeze({type:'kickoff',team,spot:freeze({x:0,y:0,z:BALL_RADIUS}),
   ready:true,source:'verified-real-goal-line-crossing',
   sameBallRapierRestart:true});
 }
 if(edge==='touchline'){
  const team=lastTouchTeam===null?null:
   lastTouchTeam==='home'?'away':'home';
  return freeze({type:team?'throw-in':'unresolved-throw-in',
   team,spot:freeze({x:inside(intersection.x,-halfX+BALL_RADIUS,halfX-BALL_RADIUS),
    y:side*(halfY-BALL_RADIUS),z:BALL_RADIUS}),
   ready:team!==null,source:team?'native-sole-shoe-last-touch':'no-verified-last-touch',
   sameBallRapierRestart:team!==null});
 }
 const defending=side===1?'away':'home';
 const attacking=side===1?'home':'away';
 if(lastTouchTeam===null)
  return freeze({type:'unresolved-goal-line',team:null,spot:null,
   ready:false,candidates:freeze(['corner','goal-kick']),
   source:'no-verified-last-touch',sameBallRapierRestart:false});
 if(lastTouchTeam===defending){
  return freeze({type:'corner',team:attacking,
   spot:freeze({x:side*(halfX-0.46),
    y:(intersection.y>=0?1:-1)*(halfY-0.55),z:BALL_RADIUS}),
   ready:true,source:'native-sole-shoe-last-touch',
   sameBallRapierRestart:true});
 }
 return freeze({type:'goal-kick',team:defending,
  spot:freeze({x:side*(halfX-5.5),y:(intersection.y>=0?1:-1)*5.5,z:BALL_RADIUS}),
  ready:true,source:'native-sole-shoe-last-touch',
  sameBallRapierRestart:true});
}
export function detectFirstFullyOutBallB05(previous,current){
 if(!previous||!current||
  !['x','y','z'].every(k=>finite(previous[k])&&finite(current[k])))
  throw new TypeError('B05 needs original consecutive finite Rapier ball centres');
 const candidates=[];
 for(const [axis,limit] of [['x',halfX+BALL_RADIUS],['y',halfY+BALL_RADIUS]]){
  for(const sign of [-1,1]){
   const before=sign*previous[axis],after=sign*current[axis];
   if(before<=limit&&after>limit&&after>before){
    const t=(limit-before)/(after-before);
    if(t>=0&&t<1){
     candidates.push({axis,sign,t,point:freeze({
      x:previous.x+(current.x-previous.x)*t,
      y:previous.y+(current.y-previous.y)*t,
      z:previous.z+(current.z-previous.z)*t
     })});
    }
   }
  }
 }
 candidates.sort((a,b)=>a.t-b.t||a.axis.localeCompare(b.axis));
 const first=candidates[0];
 if(!first)return null;
 const goal=first.axis==='x'&&
  Math.abs(first.point.y)<=B05_GOAL_WIDTH_M/2-BALL_RADIUS+1e-8&&
  first.point.z>=BALL_RADIUS-0.02&&
  first.point.z<=B05_GOAL_HEIGHT_M-BALL_RADIUS+1e-8;
 return freeze({axis:first.axis,side:first.sign,
  segmentFraction:first.t,intersection:first.point,
  edge:goal?'goal':first.axis==='x'?'goal-line':'touchline',
  goal,fullBallCrossed:true,source:'real-consecutive-rapier-centres'});
}
export function createBasicMatchRefereeB05(){
 let tick=-1,last=null,previous=null,lastTouch=null,
  event=null,restarted=false,score={home:0,away:0};
 function snapshot(){
  return freeze({version:B05_REFEREE_VERSION,tick,
   lastVerifiedTouch:lastTouch,lastEvent:event,
   restartApplied:restarted,provisionalGoals:freeze({...score}),
   original22Source:true,readOnlyObservation:true,
   matchAuthority:false,officialMatchResult:null,
   officialPossession:false});
 }
 function observe({physics,playerFrame,foot,solver,action=null,keeperDive=null}={}){
  const next=physics?.tick,ball=physics?.ball;
  if(!Number.isSafeInteger(next)||next!==tick+1||next<0||
    playerFrame?.tick!==next||foot?.tick!==next||
    !Array.isArray(playerFrame?.players)||playerFrame.players.length!==22||
    !INITIAL_PLAYERS.every((p,i)=>{
      const q=playerFrame.players[i];
      return q?.id===p.id&&q.team===p.team&&q.role===p.role&&
       [q.x,q.y,q.vx,q.vy].every(finite);
    })||
    !['x','y','z'].every(k=>
      finite(ball?.position?.[k])&&finite(ball?.velocity?.[k]))||
    !Array.isArray(foot.started)||!Array.isArray(foot.active)||
    new Set(foot.started).size!==foot.started.length||
    foot.started.some(id=>!knownIds.has(id))||
    foot.active.some(id=>!knownIds.has(id)))
   throw new TypeError('B05 requires consecutive original 22-player Rapier ball and shoe samples');
  if(next===0){
   if(solver!==null||action!==null||foot.started.length||
      foot.active.length||Math.abs(ball.position.x)>halfX||
      Math.abs(ball.position.y)>halfY)
    throw new TypeError('B05 cannot start outside field or from synthetic foot events');
  }else if(solver?.version!==FOOT_SOLVER_EVIDENCE_VERSION||
    solver.tick!==next||!Array.isArray(solver.pairs)||
    foot.started.some(id=>!solver.pairs.some(pair=>
      pair.id===id&&pair.beganThisTick&&pair.collisionActive&&
      pair.manifolds.some(m=>m.geometricContacts>0))))
   throw new TypeError('B05 native Rapier solver and collision queue must agree');
  if(action!==null&&(
    action.tick!==next||action.appliedByRapier!==true||
    action.actualPhysicsImpulseApplied!==true||
    action.officialMatchAction!==false||
    foot.started.length!==1||foot.started[0]!==action.playerId))
   throw new TypeError('B05 last touch requires authenticated original action');
  // A native sole START is touch evidence even without a uniform kick.
  // Simultaneous STARTs cannot be assigned to either team.
  const gloveStart=keeperDive?.contactStarted===true;
  if(gloveStart&&(keeperDive.version!=='me-628-native-keeper-dive-v1'||keeperDive.tick!==next||
     keeperDive.contact!==true||keeperDive.source!=='native-rapier-solver-manifold'||
     !playerFrame.players.some(p=>p.id===keeperDive.keeperId&&p.role==='goalkeeper')))
   throw new TypeError('B05 keeper glove touch requires same-tick native evidence');
  if(gloveStart&&foot.started.length===0)
   lastTouch=freeze({tick:next,playerId:keeperDive.keeperId,team:keeperDive.keeperId.split('-')[0],nativeGloveContact:true});
  else if(gloveStart&&foot.started.some(id=>id!==keeperDive.keeperId))lastTouch=null;
  else if(foot.started.length===1)
   lastTouch=freeze({tick:next,playerId:foot.started[0],
    team:foot.started[0].split('-')[0],
    nativeExclusiveShoeStart:true});
  else if(foot.started.length>1)lastTouch=null;
  // A source-verified, physically restarted dead ball can begin a NEW
  // independent phase. Unresolved dead balls cannot create repeated
  // phantom exits or goals.
  if(previous&&(!event||restarted)){
   const crossing=detectFirstFullyOutBallB05(previous,ball.position);
   if(crossing){
    restarted=false;
    const scoringTeam=crossing.edge==='goal'?
     crossing.side===1?'home':'away':null;
    const restart=restartFor({edge:crossing.edge,side:crossing.side,
     intersection:crossing.intersection,lastTouchTeam:lastTouch?.team??null,
     scoringTeam});
    if(scoringTeam)score={...score,[scoringTeam]:score[scoringTeam]+1};
    event=freeze({
     tick:next,gameClockS:next*FIXED_DT,kind:crossing.edge,
     crossing,scoringTeam,
     lastVerifiedTouch:lastTouch,restart,
     provisionalGoalScored:scoringTeam!==null,
     goalCountedOnlyInDevLab:scoringTeam!==null,
     officialResult:false,officialMatchPossession:false,
     originalRapierSource:true
    });
   }
  }
  previous=freeze({...ball.position});last=freeze({...ball});
  tick=next;return snapshot();
 }
 function acknowledgeRestart(ticket){
  if(!event||restarted||ticket!==event.restart||!ticket.ready||
    !ticket.sameBallRapierRestart)
   throw new TypeError('B05 cannot restart without original scored/out event and verified restart team');
  restarted=true;
  // Previous-phase last touch cannot be reused for a new throw/corner.
  lastTouch=null;
  return snapshot();
 }
 function clearTouchForPeriod(currentTick){
  if(currentTick!==tick||tick<1||event&&!restarted)
   throw new TypeError('B05 period reset requires current resolved boundary');
  lastTouch=null;
  return snapshot();
 }
 function recordNativeThrowIn(take){
  if(!restarted||event?.restart?.type!=='throw-in'||take?.sourceEventTick!==event.tick||
     take.tick!==tick||take.team!==event.restart.team||!knownIds.has(take.actorId)||
     !take.actorId.startsWith(take.team+'-')||take.originalNativeHandContact!==true||
     take.nativeTwoHandSolverContact!==true||take.nativeGripReleased!==true||
     take.physicalImpulseApplied!==true||take.legalThrowConfirmed!==false)
   throw new TypeError('B05 requires authenticated current native throw release');
  lastTouch=freeze({tick,playerId:take.actorId,team:take.team,nativeHandRelease:true});
  return snapshot();
 }
 return freeze({observe,snapshot,acknowledgeRestart,recordNativeThrowIn,clearTouchForPeriod});
}
