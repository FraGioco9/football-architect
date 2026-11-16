// #628 M19: independent read-only same-Rapier-source movement/encounter
// telemetry. Never changes position, targets, events or official authority.
import {INITIAL_PLAYERS,PLAYER_MAX_SPEED_MPS,
 PLAYER_MIN_SEPARATION_M} from './player-movement.mjs';

const freeze=Object.freeze;
const thresholds=freeze([1.5,3,5,8]);
const canonicalIds=new Set(INITIAL_PLAYERS.map(p=>p.id));
const teams=new Map(INITIAL_PLAYERS.map(p=>[p.id,p.team]));
const uniquePair=(a,b)=>[a,b].sort().join('|');
const median=values=>values.length===0?null:values.slice().sort(
 (a,b)=>a-b)[Math.floor(values.length/2)];
const rounded=n=>Math.round(n*1000)/1000;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const disjoint=(a,b)=>a.a!==b.a&&a.a!==b.b&&
 a.b!==b.a&&a.b!==b.b;
const twoDisjoint=edges=>{
 for(let i=0;i<edges.length;i++)
  for(let j=i+1;j<edges.length;j++)
   if(disjoint(edges[i],edges[j]))return true;
 return false;
};
const smallestTwoDisjointBottleneck=edges=>{
 const sorted=edges.slice().sort((a,b)=>a.gap-b.gap);
 for(let i=1;i<sorted.length;i++)
  for(let j=0;j<i;j++)
   if(disjoint(sorted[i],sorted[j]))return sorted[i].gap;
 return null;
};

export function createNativeEncounterTelemetry(){
 let lastTick=0;
 const close=Object.fromEntries(thresholds.map(x=>[String(x),{
  anyOpponentTicks:0,twoDisjointOpponentTicks:0,
  anyTeammateTicks:0,twoDisjointAllBodiesTicks:0,
  totalOpposingPairs:0
 }]));
 const minOpposing=[],minDisjoint=[],bodyPairLifetimes=[];
 let nativeBodyStarts=0,nativeBodyEnds=0,nativeActivePeak=0;
 let crossTeamStarts=0,sameTeamStarts=0;
 let twoAssignedPressersTicks=0,opposingConvergenceTicks=0;
 let blockedByOpposingTicks=0,blockedByTeammateTicks=0;
 let actualPlayersNearBall5=0,actualPlayersNearBall10=0;
 let ballNearBothTeams5Ticks=0,ballNearBothTeams10Ticks=0;
 let totalPlayersMoving=0,totalSpeedMps=0,stepsAtSpeedLimit=0;
 let firstNativeStart=null,minRealOpponentGap=Infinity;
 const open=new Map(),firstCloseness={};
 const eventWindows=[];
 function record({tick,frame,native,ball}){
  if(!Number.isSafeInteger(tick)||tick!==lastTick+1||
     !frame||frame.tick!==tick||
     !Array.isArray(frame.players)||frame.players.length!==22||
     !native||native.tick!==tick||
     native.sameOriginalRapierBallWorld!==true||
     native.controlledEncounter!==false||
     native.collisionColliderRadiusM!==PLAYER_MIN_SEPARATION_M/2||
     !Array.isArray(native.physicalActors)||
     native.physicalActors.length!==22||
     !Array.isArray(native.activePairs)||!Array.isArray(native.events)||
     !ball||![ball.x,ball.y].every(Number.isFinite))
   throw new TypeError('M19 requires 22 original current physical Rapier players');
  const bodies=native.physicalActors,actors=frame.players;
  const seen=new Set();
  for(let i=0;i<22;i++){
   const p=actors[i],q=bodies[i],original=INITIAL_PLAYERS[i];
   if(p?.id!==original.id||p.team!==original.team||
      q?.id!==p.id||q.team!==p.team||seen.has(p.id)||
      ![p.x,p.y,p.vx,p.vy,q.position?.x,q.position?.y].every(Number.isFinite)||
      Math.hypot(p.vx,p.vy)>PLAYER_MAX_SPEED_MPS+1e-7||
      (p.blockedBy!==null&&p.blockedBy!==undefined&&
       !canonicalIds.has(p.blockedBy)))
    throw new TypeError('M19 can measure only unmodified original body identities');
   seen.add(p.id);
   const s=Math.hypot(p.vx,p.vy);
   totalSpeedMps+=s;
   if(s>0.2)totalPlayersMoving++;
   if(s>PLAYER_MAX_SPEED_MPS-0.01)stepsAtSpeedLimit++;
   if(p.blockedBy!==null&&p.blockedBy!==undefined){
    if(teams.get(p.id)===teams.get(p.blockedBy))
     blockedByTeammateTicks++;
    else blockedByOpposingTicks++;
   }
  }
  const edges=[],opposing=[],teamEdges=[];
  for(let i=0;i<22;i++)for(let j=i+1;j<22;j++){
   const a=bodies[i],b=bodies[j];
   const gap=distance(a.position,b.position);
   const edge={a:a.id,b:b.id,gap};
   edges.push(edge);
   if(a.team!==b.team)opposing.push(edge);
   else teamEdges.push(edge);
  }
  const bestOpposing=Math.min(...opposing.map(e=>e.gap));
  const disjointGap=smallestTwoDisjointBottleneck(opposing);
  minOpposing.push(bestOpposing);
  if(disjointGap!==null)minDisjoint.push(disjointGap);
  minRealOpponentGap=Math.min(minRealOpponentGap,bestOpposing);
  for(const threshold of thresholds){
   const slot=close[String(threshold)];
   const opp=opposing.filter(x=>x.gap<=threshold);
   const mates=teamEdges.filter(x=>x.gap<=threshold);
   const all=edges.filter(x=>x.gap<=threshold);
   if(opp.length)slot.anyOpponentTicks++;
   if(mates.length)slot.anyTeammateTicks++;
   if(twoDisjoint(opp)){
    slot.twoDisjointOpponentTicks++;
    if(firstCloseness[threshold]===undefined)
     firstCloseness[threshold]=freeze({tick,
      pairs:freeze(opp.map(x=>freeze({pair:uniquePair(x.a,x.b),
       gapM:rounded(x.gap)})).slice(0,8))});
   }
   if(twoDisjoint(all))slot.twoDisjointAllBodiesTicks++;
   slot.totalOpposingPairs+=opp.length;
  }
  const near5={home:0,away:0},near10={home:0,away:0};
  for(const p of bodies){
   const d=distance(p.position,ball);
   if(d<=5)near5[p.team]++;
   if(d<=10)near10[p.team]++;
  }
  actualPlayersNearBall5+=near5.home+near5.away;
  actualPlayersNearBall10+=near10.home+near10.away;
  if(near5.home>0&&near5.away>0)ballNearBothTeams5Ticks++;
  if(near10.home>0&&near10.away>0)ballNearBothTeams10Ticks++;
  if(frame.pressers?.home!==null&&frame.pressers?.home!==undefined&&
     frame.pressers?.away!==null&&frame.pressers?.away!==undefined)
   twoAssignedPressersTicks++;
  if(frame.originalOpposingPressConvergence?.active===true)
   opposingConvergenceTicks++;
  const currentEvents=native.events.filter(e=>e.tick===tick&&
   ['rapier-body-start','rapier-body-end'].includes(e.type));
  const begins=currentEvents.filter(e=>e.type==='rapier-body-start');
  const ends=currentEvents.filter(e=>e.type==='rapier-body-end');
  if(begins.length!==native.currentTickStarts||
     ends.length!==native.currentTickEnds||
     native.actualNativeStarts!==nativeBodyStarts+begins.length||
     native.actualNativeEnds!==nativeBodyEnds+ends.length)
   throw new TypeError('M19 native event totals must come from current Rapier queue');
  for(const e of currentEvents){
   const ids=e.pair?.split('|')??[];
   if(e.source!=='native-rapier-collision-event'||ids.length!==2||
      ids[0]>=ids[1]||!ids.every(id=>canonicalIds.has(id)))
    throw new TypeError('M19 rejects invented or non-original native body event');
   if(e.type==='rapier-body-start'){
    if(open.has(e.pair))
     throw new TypeError('M19 duplicate Rapier body START');
    open.set(e.pair,tick);
    if(!firstNativeStart)firstNativeStart=freeze({tick,pair:e.pair});
    if(teams.get(ids[0])===teams.get(ids[1]))sameTeamStarts++;
    else crossTeamStarts++;
   }else{
    if(!open.has(e.pair))
     throw new TypeError('M19 END must match earlier real Rapier START');
    bodyPairLifetimes.push(tick-open.get(e.pair));
    open.delete(e.pair);
   }
  }
  nativeBodyStarts+=begins.length;nativeBodyEnds+=ends.length;
  nativeActivePeak=Math.max(nativeActivePeak,open.size);
  if(JSON.stringify([...open.keys()].sort())!==
     JSON.stringify(native.activePairs))
   throw new TypeError('M19 true same-tick active body ledger must reconcile');
  if((begins.length||ends.length)&&eventWindows.length<50)
   eventWindows.push(freeze({tick,
    starts:freeze(begins.map(x=>x.pair)),
    ends:freeze(ends.map(x=>x.pair)),
    active:freeze([...open.keys()].sort()),
    physicalClosestOpposingM:rounded(bestOpposing),
    closestDisjointOpposingM:disjointGap===null?null:rounded(disjointGap)
   }));
  lastTick=tick;
 }
 function snapshot(){
  if(!lastTick)throw new TypeError('M19 requires observed real frames');
  return freeze({
   version:'m19-read-only-original-native-contact-dynamics-v1',
   ticks:lastTick,originalPlayers:22,
   nativeSourceOnly:true,matchAuthority:false,
   realNativeStarts:nativeBodyStarts,realNativeEnds:nativeBodyEnds,
   realNativeActivePeak:nativeActivePeak,
   opposingNativeStarts:crossTeamStarts,
   teammateNativeStarts:sameTeamStarts,
   firstNativeStart,
   completedNativeContactDurationsTicks:freeze([...bodyPairLifetimes]),
   stillActiveNativePairs:freeze([...open.keys()].sort()),
   proximity:freeze(Object.fromEntries(thresholds.map(x=>[
    String(x),freeze({...close[String(x)]})
   ]))),
   firstTwoDisjointOpponentProximity:freeze({...firstCloseness}),
   closestOpponentGapM:rounded(minRealOpponentGap),
   medianClosestOpponentGapM:rounded(median(minOpposing)),
   medianSecondDisjointOpponentGapM:rounded(median(minDisjoint)),
   minimumSecondDisjointOpponentGapM:minDisjoint.length?
    rounded(Math.min(...minDisjoint)):null,
   bothPressersAssignedTicks:twoAssignedPressersTicks,
   opposingConvergenceTicks,
   nearBall:freeze({
    avgOriginalPlayersWithin5M:rounded(actualPlayersNearBall5/lastTick),
    avgOriginalPlayersWithin10M:rounded(actualPlayersNearBall10/lastTick),
    ticksWithBothTeamsWithin5M:ballNearBothTeams5Ticks,
    ticksWithBothTeamsWithin10M:ballNearBothTeams10Ticks
   }),
   movement:freeze({
    avgPlayersMovingPerTick:rounded(totalPlayersMoving/lastTick),
    meanSpeedAll22Mps:rounded(totalSpeedMps/(lastTick*22)),
    physicalSpeedLimitPlayerTicks:stepsAtSpeedLimit,
    opposingBlockedPlayerTicks:blockedByOpposingTicks,
    teammateBlockedPlayerTicks:blockedByTeammateTicks
   }),
   nativeEventWindows:freeze([...eventWindows])
  });
 }
 return freeze({record,snapshot});
}
