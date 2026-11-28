import {hasExclusiveNativeShoeStart} from './rapier-foot-contact-bridge.mjs';
import {exclusiveNativeAerialStart} from './small-sided-native-body-guard.mjs';
// #628 ACTIONS-B05: original 60Hz Rapier ball crossing and minimal referee
// restarts. DEV read-only source auditor; never fabricates an action, possession,
// a touch, or a result in the world competitions database.
import {BALL_RADIUS,FIXED_DT} from './core.mjs';
import {PLAYER_PITCH,INITIAL_PLAYERS} from './player-movement.mjs';
import {FOOT_SOLVER_EVIDENCE_VERSION} from './player-foot-contact-solver.mjs';
import {validateAttackPolarity,teamAttackingEnd,oppositeTeam} from './match-directions.mjs';
// Both referee callers consume the same native keeper evidence; no
// keeper identity is inferred when more than one new glove contact exists.
export function nativeRefereeKeeperEvidence(states){
 if(!Array.isArray(states))throw new TypeError('Native keeper states required');
 const contacts=states.filter(k=>k?.contact===true||k?.contactStarted===true||k?.catchState?.active===true);
 return Object.freeze({keeperDive:contacts.length===1?contacts[0]:null,keeperContactConflict:contacts.length>1});
}
// Undefined preserves prior evidence; null clears ambiguous attribution.
export function resolveNativeRefereeTouch({tick,foot,aerialEvidence=[],aerialConflict=false,bodyStarts=[],bodyActive=[],keeperDive=null,keeperContactConflict=false}={}){
 const aerial=(aerialEvidence??[]).filter(s=>s.contact);
 const glove=keeperDive?.contact===true||keeperDive?.contactStarted===true||keeperDive?.catchState?.active===true;
 const sources=Number(foot.active.length>0||foot.started.length>0)+Number(aerial.length>0)+Number(bodyActive.length>0)+Number(glove);
 if(keeperContactConflict||sources>1||aerial.length>1||bodyActive.length>1||foot.active.length>1||foot.started.length>1)return null;
 if(aerial.length){
  const hit=exclusiveNativeAerialStart(aerialEvidence,foot.started,foot.active,aerialConflict);
  if(hit)return Object.freeze({tick,playerId:hit.actorId,team:hit.team,...(hit.version==='me-628-native-aerial-head-v1'?{nativeHeadContact:true}:{nativeAerialControlContact:true,surface:hit.surface})});
  return aerialConflict||aerial.some(s=>s.contactStarted)?null:undefined;
 }
 if(glove)return keeperDive.contactStarted===true?Object.freeze({tick,playerId:keeperDive.keeperId,team:keeperDive.keeperId.split('-')[0],nativeGloveContact:true}):undefined;
 if(bodyActive.length)return bodyStarts.length===1&&bodyStarts[0]===bodyActive[0]?Object.freeze({tick,playerId:bodyStarts[0],team:bodyStarts[0].split('-')[0],nativeLowerLegContact:true}):bodyStarts.length?null:undefined;
 if(foot.started.length)return hasExclusiveNativeShoeStart(foot,foot.started[0])?Object.freeze({tick,playerId:foot.started[0],team:foot.started[0].split('-')[0],nativeExclusiveShoeStart:true}):null;
 return undefined;
}
export const B05_REFEREE_VERSION='actions-b05-native-boundary-referee-v1';
export const B05_GOAL_WIDTH_M=7.32;
export const B05_GOAL_HEIGHT_M=2.44;
const freeze=Object.freeze,finite=Number.isFinite;
const knownIds=new Set(INITIAL_PLAYERS.map(p=>p.id));
const halfX=PLAYER_PITCH.lengthM/2,halfY=PLAYER_PITCH.widthM/2;
const inside=(n,min,max)=>Math.max(min,Math.min(max,n));
const fixed=Object.freeze;
export function resolveB05BoundaryRestart({edge,side,intersection,lastTouchTeam,attackPolarity=1}){
 validateAttackPolarity(attackPolarity);
 if(!['goal','goal-line','touchline'].includes(edge)||![1,-1].includes(side)||
    !['x','y','z'].every(k=>finite(intersection?.[k]))||
    ![null,'home','away'].includes(lastTouchTeam))throw new TypeError('Original boundary geometry and last-touch identity required');
 const scoringTeam=edge==='goal'?teamAttackingEnd(side,attackPolarity):null;
 if(edge==='goal'){
  const team=oppositeTeam(scoringTeam);
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
 const attacking=teamAttackingEnd(side,attackPolarity);
 const defending=oppositeTeam(attacking);
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
export function createBasicMatchRefereeB05({attackPolarity=1}={}){
 validateAttackPolarity(attackPolarity);
 let periodSwitched=false,tick=-1,last=null,previous=null,lastTouch=null,
  event=null,restarted=false,score={home:0,away:0};
 function snapshot(){
  return freeze({version:B05_REFEREE_VERSION,tick,
   lastVerifiedTouch:lastTouch,lastEvent:event,
   restartApplied:restarted,provisionalGoals:freeze({...score}),
   ...(attackPolarity!==1?{attackPolarity}:{}),
   original22Source:true,readOnlyObservation:true,
   matchAuthority:false,officialMatchResult:null,
   officialPossession:false});
 }
 function observe({physics,playerFrame,foot,solver,action=null,keeperDive=null,keeperContactConflict=false,aerialEvidence=null,aerialConflict=false,bodyEvidence=null}={}){
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
  if(aerialEvidence!==null&&(!Array.isArray(aerialEvidence)||typeof aerialConflict!=='boolean'||
     aerialEvidence.some(s=>!['me-628-native-aerial-head-v1','me-628-native-aerial-control-v1'].includes(s.version)||s.tick!==next||
      s.sameOriginalRapierWorld!==true||s.actualNativeSolverContact!==s.contact||
      s.contactStarted&&!s.contact||!playerFrame.players.some(p=>p.id===s.actorId&&p.team===s.team&&p.role!=='goalkeeper'))))
   throw new TypeError('B05 head touch requires current original native evidence');
  if(bodyEvidence!==null&&(bodyEvidence.tick!==next||bodyEvidence.oneOriginalRapierWorld!==true||bodyEvidence.evidenceSource!=='native-rapier-solver-manifold'||
     !Array.isArray(bodyEvidence.lowerLegBallStarts)||!Array.isArray(bodyEvidence.lowerLegBallContacts)||
     bodyEvidence.lowerLegBallStarts.some(id=>!bodyEvidence.lowerLegBallContacts.includes(id))||
     bodyEvidence.lowerLegBallContacts.some(id=>!knownIds.has(id))))
   throw new TypeError('B05 lower-leg touch requires current original native evidence');
  const bodyStarts=bodyEvidence?.lowerLegBallStarts??[],bodyActive=bodyEvidence?.lowerLegBallContacts??[];
  const headStart=exclusiveNativeAerialStart(aerialEvidence,foot.started,foot.active,aerialConflict);
  const headerAction=action?.nativeExclusiveHeadStart===true&&headStart?.version==='me-628-native-aerial-head-v1'&&action.actualNativeSolverContact===true&&headStart?.actorId===action.playerId;
  const aerialControlAction=action?.nativeExclusiveAerialControlStart===true&&headStart?.version==='me-628-native-aerial-control-v1'&&action.surface===headStart.surface&&action.actualNativeSolverContact===true&&headStart.actorId===action.playerId;
  const aerialAction=action?.nativeExclusiveHeadStart===true||action?.nativeExclusiveAerialControlStart===true;
  if(action!==null&&(
    action.tick!==next||action.appliedByRapier!==true||
    action.actualPhysicsImpulseApplied!==true||
    action.officialMatchAction!==false||
    (aerialAction?(!headerAction&&!aerialControlAction):!hasExclusiveNativeShoeStart(foot,action.playerId))))
   throw new TypeError('B05 last touch requires authenticated original action');
  // A native sole START is touch evidence even without a uniform kick.
  // Simultaneous STARTs cannot be assigned to either team.
  if(typeof keeperContactConflict!=='boolean'||keeperContactConflict&&keeperDive!==null)throw new TypeError('Unambiguous native keeper evidence required');
  const gloveStart=keeperDive?.contactStarted===true;
  if(gloveStart&&(keeperDive.version!=='me-628-native-keeper-dive-v1'||keeperDive.tick!==next||
     keeperDive.contact!==true||keeperDive.source!=='native-rapier-solver-manifold'||
     !playerFrame.players.some(p=>p.id===keeperDive.keeperId&&p.role==='goalkeeper')))
   throw new TypeError('B05 keeper glove touch requires same-tick native evidence');
  const touch=resolveNativeRefereeTouch({tick:next,foot,aerialEvidence,aerialConflict,bodyStarts,bodyActive,keeperDive,keeperContactConflict});
  if(touch!==undefined)lastTouch=touch;
  // A source-verified, physically restarted dead ball can begin a NEW
  // independent phase. Unresolved dead balls cannot create repeated
  // phantom exits or goals.
  if(previous&&(!event||restarted)){
   const crossing=detectFirstFullyOutBallB05(previous,ball.position);
   if(crossing){
    restarted=false;
    const scoringTeam=crossing.edge==='goal'?teamAttackingEnd(crossing.side,attackPolarity):null;
    const restart=resolveB05BoundaryRestart({edge:crossing.edge,side:crossing.side,
     intersection:crossing.intersection,lastTouchTeam:lastTouch?.team??null,
     attackPolarity});
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
 function clearTouchForPeriod(currentTick,nextPolarity,centre){
  if(currentTick!==tick||tick<1||event&&!restarted||periodSwitched||attackPolarity!==1||
     nextPolarity!==-1||!centre||Math.hypot(centre.x,centre.y)>1e-8||Math.abs(centre.z-BALL_RADIUS)>1e-6)
   throw new TypeError('B05 period reset requires current resolved boundary and original centre placement');
  lastTouch=null;previous=freeze({...centre});attackPolarity=nextPolarity;periodSwitched=true;
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
