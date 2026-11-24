// #628 M22 — read-only continuity of the REAL M20 secondary defender.
// This observer cannot select, move, teleport or stage a player; it only
// reads original 22-player movement and the already-audited Rapier queue.
import {INITIAL_PLAYERS} from './player-movement.mjs';

const freeze=Object.freeze;
const canonicalIds=new Map(INITIAL_PLAYERS.map(p=>[p.id,p]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const sortedPair=(a,b)=>[a,b].sort().join('|');
const round=n=>Math.round(n*1000)/1000;
const teams=['home','away'];
const newState=()=>({
 selectedTeamTicks:0,firstAcquisitions:0,reacquisitions:0,releases:0,
 playerHandoffs:0,opponentRetargets:0,completedEpisodes:[],
 countWithin1_5M:0,countWithin3M:0,countWithin5M:0,
 contactWithSelectedOpponentTicks:0,anyRealNativeMarkerContactTicks:0,
 totalSelectedMarkGapM:0,minimumSelectedMarkGapM:Infinity,
 assignedWithoutRealContestTicks:0,transitionCount:0,
 last:null,episodeStart:null,everSelected:false
});
const median=nums=>!nums.length?null:
 nums.slice().sort((a,b)=>a-b)[Math.floor(nums.length/2)];

export function createOriginalSecondaryDutyContinuity(){
 let lastTick=0;
 const states={home:newState(),away:newState()};
 function record({tick,frame,native}){
  if(!Number.isSafeInteger(tick)||tick!==lastTick+1||
     frame?.tick!==tick||native?.tick!==tick||
     !Array.isArray(frame.players)||frame.players.length!==22||
     !Array.isArray(native.physicalActors)||native.physicalActors.length!==22||
     !Array.isArray(native.activePairs)||
     !frame.secondaryPressSupport||!frame.secondaryPressSwitches||
     !frame.secondaryPressActiveTicks||
     !frame.pressers||!frame.originalOpposingPressConvergence)
   throw new TypeError('M22 accepts only real M20 original 22-player current frames');
  const players=new Map(frame.players.map(p=>[p.id,p]));
  const bodies=new Map(native.physicalActors.map(p=>[p.id,p]));
  if(players.size!==22||bodies.size!==22||
     !INITIAL_PLAYERS.every((p,i)=>
      frame.players[i].id===p.id&&
      native.physicalActors[i].id===p.id))
   throw new TypeError('M22 rejects replaced, reordered or fake players');
  const genuinePairs=new Set(native.activePairs);
  for(const team of teams){
   const state=states[team],other=team==='home'?'away':'home';
   const support=frame.secondaryPressSupport[team];
   const ownPress=frame.pressers[team],theirPress=frame.pressers[other];
   if(!Number.isSafeInteger(frame.secondaryPressSwitches[team])||
      !Number.isSafeInteger(frame.secondaryPressActiveTicks[team])||
      frame.secondaryPressSwitches[team]<0||
      frame.secondaryPressActiveTicks[team]<0||
      (support!==null&&typeof support!=='object'))
    throw new TypeError('M22 invalid source role accounting');
   let selected=null;
   if(support){
    const p=players.get(support.playerId),
     opponent=players.get(support.opponentId),
     physicsP=bodies.get(support.playerId),
     physicsOpponent=bodies.get(support.opponentId);
    if(!p||!opponent||!physicsP||!physicsOpponent||
       canonicalIds.get(p.id)?.team!==team||
       canonicalIds.get(opponent.id)?.team!==other||
       canonicalIds.get(p.id)?.role==='goalkeeper'||
       canonicalIds.get(opponent.id)?.role==='goalkeeper'||
       p.id===ownPress||opponent.id===theirPress||
       !support.target||
       ![support.target.x,support.target.y,
         physicsP.position?.x,physicsP.position?.y,
         physicsOpponent.position?.x,physicsOpponent.position?.y]
         .every(Number.isFinite))
     throw new TypeError('M22 requires an observed actual M20 secondary/outfield threat');
    selected={playerId:p.id,opponentId:opponent.id};
    const gap=distance(physicsP.position,physicsOpponent.position);
    state.selectedTeamTicks++;
    state.totalSelectedMarkGapM+=gap;
    state.minimumSelectedMarkGapM=Math.min(state.minimumSelectedMarkGapM,gap);
    if(gap<=1.5)state.countWithin1_5M++;
    if(gap<=3)state.countWithin3M++;
    if(gap<=5)state.countWithin5M++;
    const actualPair=sortedPair(p.id,opponent.id);
    if(genuinePairs.has(actualPair))state.contactWithSelectedOpponentTicks++;
    if([...genuinePairs].some(pair=>pair.split('|').includes(p.id)))
     state.anyRealNativeMarkerContactTicks++;
    if(frame.originalOpposingPressConvergence.active!==true)
     state.assignedWithoutRealContestTicks++;
   }
   const before=state.last;
   const changed=before?.playerId!==selected?.playerId||
    before?.opponentId!==selected?.opponentId;
   if(changed){
    state.transitionCount++;
    if(before!==null){
     state.completedEpisodes.push(freeze({
      playerId:before.playerId,opponentId:before.opponentId,
      startTick:state.episodeStart,
      durationTicks:tick-state.episodeStart
     }));
     state.episodeStart=null;
    }
    if(selected!==null){
     if(before===null){
      if(state.everSelected)state.reacquisitions++;
      else state.firstAcquisitions++;
     }else if(before.playerId!==selected.playerId)state.playerHandoffs++;
     else state.opponentRetargets++;
     state.episodeStart=tick;
     state.everSelected=true;
    }else if(before!==null)state.releases++;
   }
   state.last=selected;
   if(state.transitionCount!==frame.secondaryPressSwitches[team]||
      state.selectedTeamTicks!==frame.secondaryPressActiveTicks[team])
    throw new TypeError('M22 current role timeline must reconcile to original M20 mover counters');
  }
  lastTick=tick;
 }
 function snapshot(){
  if(!lastTick)throw new TypeError('M22 requires real observed current frames');
  const results={};
  for(const team of teams){
   const state=states[team];
   const durations=state.completedEpisodes.map(x=>x.durationTicks);
   const pending=state.last?freeze({
    playerId:state.last.playerId,opponentId:state.last.opponentId,
    startTick:state.episodeStart,
    observedTicks:lastTick-state.episodeStart+1,
    rightCensored:true
   }):null;
   results[team]=freeze({
    selectedTeamTicks:state.selectedTeamTicks,
    acquisitionCount:state.firstAcquisitions+state.reacquisitions,
    initialAcquisitions:state.firstAcquisitions,
    reacquisitions:state.reacquisitions,
    releases:state.releases,
    playerHandoffs:state.playerHandoffs,
    opponentRetargets:state.opponentRetargets,
    sourceRoleSwitches:state.transitionCount,
    closedEpisodeCount:durations.length,
    closedEpisodeDurationsTicks:freeze([...durations]),
    medianClosedEpisodeTicks:median(durations),
    shortestClosedEpisodeTicks:durations.length?Math.min(...durations):null,
    longestClosedEpisodeTicks:durations.length?Math.max(...durations):null,
    completedEpisodesAtMost15Ticks:durations.filter(x=>x<=15).length,
    pendingEpisode:pending,
    realPhysicalMarkerOpponentGapM:freeze({
     mean:state.selectedTeamTicks?
      round(state.totalSelectedMarkGapM/state.selectedTeamTicks):null,
     minimum:Number.isFinite(state.minimumSelectedMarkGapM)?
      round(state.minimumSelectedMarkGapM):null,
     within1_5MTeamTicks:state.countWithin1_5M,
     within3MTeamTicks:state.countWithin3M,
     within5MTeamTicks:state.countWithin5M
    }),
    activeNativeMarkedPairTicks:state.contactWithSelectedOpponentTicks,
    activeNativeAnyMarkerPairTicks:state.anyRealNativeMarkerContactTicks,
    assignedWithoutRealContestTicks:state.assignedWithoutRealContestTicks
   });
  }
  return freeze({
   version:'m22-real-m20-secondary-role-continuity-v1',
   ticks:lastTick,originalPlayers:22,
   nativeOnly:true,readOnly:true,matchAuthority:false,
   home:results.home,away:results.away
  });
 }
 return freeze({record,snapshot});
}
