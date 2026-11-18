/** #690 — independent, read-only validation of v2 frozen event evidence.
 * No calls to current affiliations, wall clock, RNG or simulation. Throws closed.
 * Must run only for eventModelVersion === lineup-events-v1; never retrofit v1.
 */
export const VERIFIED_EVENT_MODEL_VERSION='lineup-events-v1';
const valid=id=>Number.isSafeInteger(id)&&id>0;
const reject=reason=>{throw new TypeError('Invalid frozen match events: '+reason)};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sideNames=['home','away'];
const allowedRoles=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
function player(id,role,started,minute){
 return {playerId:id,role,started,entered:minute,minutes:0,goals:0,
  assists:0,redCards:0,gkMinutes:0,intervals:[]};
}
function startSide(record,duration){
 if(record.kind==='team_fallback'){
  if(record.starters!==null||record.appearances?.length!==0||
   !Array.isArray(record.bench)||record.bench.length)reject('fallback attribution');
  return {fallback:true,on:new Map(),people:new Map(),bench:new Set(),seen:new Set(),last:0,
   yellow:new Map(),red:0,subs:0,regulationSubs:0,windows:new Set(),pending:new Map(),otherYellows:0,secondTarget:null,secondComplete:false};
 }
 if(record.kind!=='real_xi'||!Array.isArray(record.starters)||record.starters.length!==11||
  !Array.isArray(record.bench)||record.bench.length>9||
  !Array.isArray(record.appearances))reject('real XI/bench evidence');
 const on=new Map(),people=new Map(),seen=new Set();
 for(const starter of record.starters){
  if(!valid(starter?.playerId)||seen.has(starter.playerId)||!allowedRoles.has(starter.role))
   reject('starters');
  seen.add(starter.playerId);on.set(starter.playerId,starter.role);
  people.set(starter.playerId,player(starter.playerId,starter.role,true,0));
 }
 if([...on.values()].filter(r=>r==='GK').length!==1)reject('starting keeper');
 const bench=new Set();
 for(const p of record.bench){
  if(!valid(p?.playerId)||seen.has(p.playerId)||bench.has(p.playerId)||
   !allowedRoles.has(p.primaryPosition)||!Array.isArray(p.secondaryPositions)||
   p.secondaryPositions.some(r=>!allowedRoles.has(r))||!p.attributes)
   reject('bench identity/roles');
  bench.add(p.playerId);
 }
 return {fallback:false,on,people,seen,bench,last:0,yellow:new Map(),
  red:0,subs:0,regulationSubs:0,windows:new Set(),pending:new Map(),otherYellows:0,secondTarget:null,secondComplete:false,duration};
}
function advance(state,minute){
 if(minute<state.last||minute>state.duration)reject('timeline order');
 const dt=minute-state.last;
 for(const [id,role]of state.on){
  const p=state.people.get(id);p.minutes+=dt;if(role==='GK')p.gkMinutes+=dt;
 }
 state.last=minute;
}
function close(state,id,minute){
 const p=state.people.get(id),role=state.on.get(id);
 if(!p||!role)reject('inactive interval');
 if(minute<=p.entered)reject('zero/negative duration');
 p.intervals.push({from:p.entered,to:minute,role});p.entered=minute;
}
function finish(state,record,duration){
 if(state.fallback)return;
 advance(state,duration);
 for(const id of state.on.keys())close(state,id,duration);
 if(state.on.size!==11-state.red||state.red>1||
  state.subs>5+(duration===120?1:0)||state.regulationSubs>5)
  reject('headcount/sub limit');
 const regulationWindows=[...state.windows].filter(m=>m<90&&m!==45);
 const extraWindows=[...state.windows].filter(m=>m>90&&m!==105);
 if(regulationWindows.length>3||extraWindows.length>1||
  state.windows.has(105)&&duration!==120||state.pending.size||
  state.secondTarget!==null&&!state.secondComplete||
  [...state.on.values()].filter(r=>r==='GK').length!==1)
  reject('window/unpaired final pass or keeper');
 const derived=[...state.people.values()].map(p=>({
  playerId:p.playerId,role:p.role,started:p.started,
  minutes:p.minutes,goals:p.goals,assists:p.assists,redCards:p.redCards,
  gkMinutes:p.gkMinutes,intervals:p.intervals
 })).sort((a,b)=>a.playerId-b.playerId);
 const claimed=record.appearances.map(p=>({
  playerId:p.playerId,role:p.role,started:p.started,
  minutes:p.minutes,goals:p.goals,assists:p.assists,redCards:p.redCards,
  gkMinutes:p.gkMinutes,intervals:p.intervals
 })).sort((a,b)=>a.playerId-b.playerId);
 if(!same(derived,claimed)||claimed.some(p=>p.minutes<1||p.minutes>duration||
  p.gkMinutes>p.minutes||!allowedRoles.has(p.role)))reject('appearance/minutes projection');
}
/** Verifies score-linked goal/pass/card/substitution evidence independently.
 * A valid digest does not excuse fabricated player participation.
 */
export function validateRecordedMatchTimelineV1(result){
 if(result?.eventModelVersion!==VERIFIED_EVENT_MODEL_VERSION||
  !result.home||!result.away||!Array.isArray(result.events))reject('event schema');
 const duration=result.extraTime===null?90:120;
 const states={home:startSide(result.home,duration),away:startSide(result.away,duration)};
 const all=new Set();
 for(const name of sideNames){
  const rec=result[name];
  for(const id of [
   ...(rec.kind==='real_xi'?rec.starters.map(x=>x.playerId):[]),
   ...rec.bench.map(x=>x.playerId)
  ]){if(all.has(id))reject('cross-side actor');all.add(id)}
 }
 const goals={home:0,away:0},regGoals={home:0,away:0},etGoals={home:0,away:0},goalIds=new Set();
 let priorMinute=0,pendingGlobal=null;
 for(const [ordinal,event]of result.events.entries()){
  const name=event?.side;
  if(!sideNames.includes(name)||event.ordinal!==ordinal||
   !Number.isInteger(event.minute)||event.minute<1||
   event.minute>duration||event.minute<priorMinute||
   event.period!==(event.minute<=90?'regulation':'extra-time'))reject('event clock/ordinal');
  priorMinute=event.minute;
  if(pendingGlobal){
   if(name!==pendingGlobal.side||event.minute!==pendingGlobal.minute||
    event.type!==pendingGlobal.type||
    (pendingGlobal.playerId!==undefined&&event.playerId!==pendingGlobal.playerId)||
    (pendingGlobal.goalId!==undefined&&event.goalId!==pendingGlobal.goalId))
    reject('unpaired adjacent event');
   pendingGlobal=null;
  }
  const state=states[name];if(state.fallback)reject('fallback player event');
  advance(state,event.minute);
  const on=id=>valid(id)&&state.on.has(id);
  const side=name;
  if(event.type==='yellow'){
   if(!on(event.playerId))reject('yellow actor');
   const n=state.yellow.get(event.playerId)??0;
   if(n>=2)reject('third yellow');
   if(n===0&&event.secondYellowSequence===true){
    if(state.secondTarget!==null)reject('duplicate second-yellow candidate');
    state.secondTarget=event.playerId;
   }else if(n===0&&event.secondYellowSequence===undefined){
    state.otherYellows++;
    if(state.otherYellows>3)reject('unrelated yellow-card limit');
   }else if(n===1&&event.secondYellowSequence===true&&
    state.secondTarget===event.playerId){
    pendingGlobal={side:name,minute:event.minute,type:'red',playerId:event.playerId};
   }else reject('yellow sequence linkage');
   state.yellow.set(event.playerId,n+1);
  }else if(event.type==='red'){
   if(!on(event.playerId)||state.red>=1||
    !['direct','second_yellow'].includes(event.reason))reject('red actor/reason');
   if(event.reason==='second_yellow'&&
    (state.yellow.get(event.playerId)!==2||state.secondTarget!==event.playerId))
    reject('second yellow linkage');
   if(event.reason==='direct'&&state.yellow.get(event.playerId)===2)
    reject('misclassified second yellow');
   if(event.reason==='second_yellow')state.secondComplete=true;
   const lostKeeper=state.on.get(event.playerId)==='GK';
   state.red++;
   close(state,event.playerId,event.minute);
   state.on.delete(event.playerId);
   state.people.get(event.playerId).redCards++;
   if(lostKeeper)pendingGlobal={side:name,minute:event.minute,type:'role_change'};
  }else if(event.type==='role_change'){
   if(state.red===0||!on(event.playerId)||event.fromRole!==state.on.get(event.playerId)||
    event.toRole!=='GK'||event.reason!=='emergency_goalkeeper'||
    [...state.on.values()].includes('GK'))reject('emergency goalkeeper');
   close(state,event.playerId,event.minute);
   state.on.set(event.playerId,'GK');
  }else if(event.type==='substitution'){
   if(event.playerId!==event.outPlayerId||!on(event.outPlayerId)||!state.bench.has(event.inPlayerId)||
    state.seen.has(event.inPlayerId)||state.subs>=5+(duration===120?1:0)||
    !allowedRoles.has(event.inRole)||event.inRole!==event.outRole||
    event.outRole!==state.on.get(event.outPlayerId))reject('substitution actors');
   if(event.inRole==='GK'){
    const incoming=result[name].bench.find(x=>x.playerId===event.inPlayerId);
    if(incoming.primaryPosition!=='GK'&&!incoming.secondaryPositions.includes('GK'))
     reject('keeper substitution eligibility');
   }
   const w=event.minute===45?'half-time':event.minute===105?'extra-time':'in-play';
   if(event.window!==w||w==='extra-time'&&duration!==120||
    w==='in-play'&&event.minute===90)reject('substitution window');
   state.windows.add(event.minute);
   if(event.minute<=90)state.regulationSubs++;
   state.subs++;close(state,event.outPlayerId,event.minute);
   state.on.delete(event.outPlayerId);state.on.set(event.inPlayerId,event.inRole);
   state.seen.add(event.inPlayerId);
   state.people.set(event.inPlayerId,player(event.inPlayerId,event.inRole,false,event.minute));
  }else if(event.type==='pass'){
   if(event.playerId!==event.fromPlayerId||!on(event.fromPlayerId)||!on(event.toPlayerId)||
    event.fromPlayerId===event.toPlayerId||
    typeof event.goalId!=='string'||!event.goalId.startsWith(name+':')||
    event.purpose!=='deliberate_final_pass'||state.pending.has(event.goalId))
    reject('final pass provenance');
   state.pending.set(event.goalId,{minute:event.minute,
    from:event.fromPlayerId,to:event.toPlayerId});
   pendingGlobal={side:name,minute:event.minute,type:'goal',goalId:event.goalId};
  }else if(event.type==='goal'){
   if(!on(event.playerId)||typeof event.goalId!=='string'||
    !event.goalId.startsWith(name+':')||
    !['open_play_solo','open_play_pass'].includes(event.creation))
    reject('goal scorer/creation');
   if(goalIds.has(event.goalId))reject('duplicate goal ID');goalIds.add(event.goalId);
   const pending=state.pending.get(event.goalId);
   if(event.creation==='open_play_pass'){
    if(!pending||pending.minute!==event.minute||pending.to!==event.playerId||
     pending.from!==event.assistingPlayerId||!on(pending.from))reject('goal assist linkage');
    state.people.get(pending.from).assists++;
    state.pending.delete(event.goalId);
   }else if(event.assistingPlayerId!==null||pending)reject('solo goal assist');
   state.people.get(event.playerId).goals++;goals[side]++;
   if(event.period==='regulation')regGoals[side]++;
   else etGoals[side]++;
  }else reject('unknown match event');
  if(state.on.size>11||state.on.size<10|| // at most one dismissal per side
    [...state.on.values()].filter(role=>role==='GK').length>1)
   reject('on-pitch participant count');
 }
 if(pendingGlobal)reject('unfinished adjacent event');
 for(const name of sideNames){
  const side=result[name],n=goals[name];
  if(side.kind==='real_xi'&&
   (regGoals[name]!==result.regulation?.[name]||
    etGoals[name]!==(result.extraTime?.[name]??0)))
   reject('regulation/extra-time scoring attribution');
  if(!Number.isSafeInteger(side.unattributedGoals)||side.unattributedGoals<0||
   n+side.unattributedGoals!==result[name+'Goals'])reject('score reconciliation');
  finish(states[name],side,duration);
 }
 return true;
}
