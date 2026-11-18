/** #690 — deterministic future-match event proposal, pure and NOT a second score authority.
 * The legacy simulator decides scores/ET/shootouts. This module only schedules
 * eligible participant events, preserving that score and historical receipts.
 * Wired into official receipts only after the v2 replay validator is ready.
 */
import {calculatePositionSuitability} from './players-generator-core.mjs';

export const MATCH_EVENT_MODEL_VERSION='lineup-events-v1';
const roleSet=new Set('GK RB CB LB RWB LWB DM CM AM RM LM RW LW ST'.split(' '));
const sortId=(a,b)=>a.id-b.id;
const fail=(reason)=>{throw new TypeError('Invalid recorded match timeline: '+reason)};
const validId=id=>Number.isSafeInteger(id)&&id>0;
async function draw(seed,key){
 const data=new TextEncoder().encode(JSON.stringify([MATCH_EVENT_MODEL_VERSION,seed,key]));
 const hash=await crypto.subtle.digest('SHA-256',data);
 return new DataView(hash).getUint32(0,false)/4294967296;
}
function candidateRoster(roster,side){
 if(!Array.isArray(roster))fail('roster');
 const all=roster.filter(p=>p.career_status==='active').sort(sortId);
 if(all.some(p=>!validId(p.id)||!roleSet.has(p.primary_position))||
    new Set(all.map(p=>p.id)).size!==all.length)fail('real player roster');
 const eleven=new Set(side.starters.map(p=>p.playerId));
 if(eleven.size!==11||side.starters.some(p=>!all.some(r=>r.id===p.playerId)))fail('starting eligibility');
 // Bench is selected from real affiliated eligible players only, deterministic
 // regardless of input order; natural/secondary GK cover takes precedence.
 const score=p=>calculatePositionSuitability(p.attributes,p.primary_position);
 return all.filter(p=>!eleven.has(p.id)).sort((a,b)=>{
  const gk=p=>p.primary_position==='GK'||p.secondary_positions?.includes('GK')?0:1;
  return gk(a)-gk(b)||score(b)-score(a)||a.id-b.id;
 }).slice(0,9).map(p=>({playerId:p.id,primaryPosition:p.primary_position,
  secondaryPositions:[...(p.secondary_positions??[])],attributes:{...p.attributes}}));
}
function period(minute){return minute>90?'extra-time':'regulation'}
function newState(side,roster,duration){
 if(side.kind==='team_fallback')return {fallback:true,bench:[],on:new Map(),people:new Map(),used:new Set()};
 if(side.kind!=='real_xi'||!Array.isArray(side.starters)||side.starters.length!==11)fail('XI');
 const bench=candidateRoster(roster,side),on=new Map(),people=new Map();
 for(const p of side.starters){
  const person={playerId:p.playerId,role:p.role,started:true,entered:0,exited:null,
   minutes:0,goals:0,assists:0,redCards:0,gkMinutes:0,
   intervals:[],rating:null};
  on.set(p.playerId,p.role);people.set(p.playerId,person);
 }
 return {fallback:false,bench,on,people,used:new Set(),duration,
  dismissed:new Set(),windows:new Set(),subCount:0,redCount:0,secondTarget:null,
  cardCount:0,lastElapsed:0};
}
function advance(state,to){
 if(state.fallback)return;
 if(to<state.lastElapsed||to>state.duration)fail('event clock');
 const dt=to-state.lastElapsed;
 for(const [id,role] of state.on){
  const p=state.people.get(id);p.minutes+=dt;
  if(role==='GK')p.gkMinutes+=dt;
 }
 state.lastElapsed=to;
}
function select(active,unit,weights=null){
 if(!active.length)return null;
 const values=active.map((p,i)=>Math.max(.001,weights?weights(p):1));
 let amount=unit*values.reduce((a,b)=>a+b,0);
 for(let i=0;i<active.length;i++){amount-=values[i];if(amount<0)return active[i]}
 return active.at(-1);
}
function closeInterval(state,id,minute){
 const p=state.people.get(id),role=state.on.get(id);
 if(!p||!role)fail('interval actor');
 p.intervals.push({from:p.entered,to:minute,role});
 p.entered=minute;
}
function keeperRecovery(state,minute,side,sideName,events){
 if([...state.on.values()].includes('GK'))return;
 const active=[...state.on.keys()].sort((a,b)=>a-b);
 if(!active.length)fail('dismissed last player');
 const strength=id=>{
  const starter=side.starters.find(p=>p.playerId===id);
  const bench=state.bench.find(p=>p.playerId===id);
  const attrs=starter?.attributes??bench?.attributes;
  return calculatePositionSuitability(attrs,'GK');
 };
 const selected=[...active].sort((a,b)=>strength(b)-strength(a)||a-b)[0];
 const prior=state.on.get(selected);
 closeInterval(state,selected,minute);state.on.set(selected,'GK');
 events.push({type:'role_change',side:sideName,minute,period:period(minute),playerId:selected,
  fromRole:prior,toRole:'GK',reason:'emergency_goalkeeper'});
}
function finish(state){
 if(state.fallback)return {bench:[],appearances:[]};
 advance(state,state.duration);
 for(const id of state.on.keys())closeInterval(state,id,state.duration);
 const players=[...state.people.values()].sort((a,b)=>a.playerId-b.playerId);
 for(const p of players){
  if(!validId(p.playerId)||p.minutes<1||p.minutes>state.duration||
   p.intervals.some(x=>x.from>=x.to)||p.intervals.reduce((n,x)=>n+x.to-x.from,0)!==p.minutes||
   p.intervals.filter(x=>x.role==='GK').reduce((n,x)=>n+x.to-x.from,0)!==p.gkMinutes)
   fail('participation intervals');
  p.exited=p.intervals.at(-1).to;
  delete p.entered;
 }
 return {bench:state.bench,appearances:players};
}
function slots(count,extra){
 // Three in-play windows, one free half-time window; separate extra-time window.
 const regular=[45,58,70,82,58];
 return Array.from({length:count},(_,i)=>regular[i]).concat(extra?[105]:[]).sort((a,b)=>a-b);
}
/** Returns a detached timeline projection. Does NOT mutate result/roster or write receipts.
 * The old goal draw and aggregate resolution remain authoritative.
 */
export async function planRecordedMatchTimelineV1({result,homeRoster,awayRoster}){
 if(!result||result.algorithmVersion!=='temporary-lineup-v1'||!Array.isArray(result.events)||
  typeof result.sourceSeedHash!=='string'||!result.matchKey)fail('canonical score');
 const duration=result.extraTime===null?90:120,states={
  home:newState(result.home,homeRoster,duration),away:newState(result.away,awayRoster,duration)
 };
 const seed=JSON.stringify([result.matchKey,result.sourceSeedHash,
  result.regulation,result.extraTime,result.homeGoals,result.awayGoals]);
 const agenda=[];
 for(const name of ['home','away']){
  const state=states[name];if(state.fallback)continue;
  const d=async label=>draw(seed,name+':'+label);
  const count=Math.min(state.bench.length,Math.floor((await d('sub-count'))*6));
  const extra=duration===120&&state.bench.length>count&&(await d('extra-sub'))<.5;
  for(const [idx,minute] of slots(count,extra).entries())
   agenda.push({minute,rank:2,side:name,kind:'sub',idx});
  const yellowCount=Math.floor((await d('yellow-count'))*4);
  for(let i=0;i<yellowCount;i++)
   agenda.push({minute:[19,40,63][i],rank:0,side:name,kind:'yellow',idx:i});
  const verdict=await d('red-type');
  if(verdict<.03)agenda.push({minute:77,rank:0,side:name,kind:'direct-red'});
  else if(verdict<.05){
   agenda.push({minute:64,rank:0,side:name,kind:'second-first'});
   agenda.push({minute:77,rank:0,side:name,kind:'second-red'});
  }
 }
 for(const [idx,goal] of result.events.entries()){
  if(goal.type!=='goal'||!['home','away'].includes(goal.side)||!Number.isInteger(goal.minute)||
   goal.minute<1||goal.minute>duration)fail('legacy goals');
  agenda.push({minute:goal.minute,rank:3,side:goal.side,kind:'goal',goal,idx});
 }
 agenda.sort((a,b)=>a.minute-b.minute||a.rank-b.rank||
  a.side.localeCompare(b.side,'en')||a.idx-b.idx);
 const events=[],goalsBySide={home:0,away:0};
 for(const item of agenda){
  const state=states[item.side],side=result[item.side];
  if(state.fallback){if(item.kind!=='goal')fail('fallback player event');continue}
  advance(state,item.minute);
  const d=async label=>draw(seed,item.side+':'+item.kind+':'+item.minute+':'+(item.idx??0)+':'+label);
  const active=()=>[...state.on.keys()].sort((a,b)=>a-b);
  const push=(event)=>events.push({...event,side:item.side,minute:item.minute,period:period(item.minute)});
  if(item.kind==='sub'){
   if(state.subCount>=6||state.bench.length<=state.used.size)continue;
   const available=state.bench.filter(p=>!state.used.has(p.playerId));
   const newcomer=select(available,await d('in'));
   if(!newcomer)continue;
   const current=active().filter(id=>id!==state.secondTarget);
   const gkEligible=newcomer.primaryPosition==='GK'||newcomer.secondaryPositions.includes('GK');
   const outgoing=current.filter(id=>state.on.get(id)!=='GK'||gkEligible);
   if(!outgoing.length)continue;
   const out=select(outgoing,await d('out'));
   const role=state.on.get(out);
   if(!role)fail('sub outgoing');
   closeInterval(state,out,item.minute);state.on.delete(out);state.used.add(newcomer.playerId);
   state.on.set(newcomer.playerId,role);
   state.people.set(newcomer.playerId,{playerId:newcomer.playerId,role,started:false,
    entered:item.minute,exited:null,minutes:0,goals:0,assists:0,redCards:0,
    gkMinutes:0,intervals:[],rating:null});
   state.subCount++;
   if(item.minute!==45&&item.minute!==105)state.windows.add(item.minute);
   push({type:'substitution',outPlayerId:out,inPlayerId:newcomer.playerId,
    outRole:role,inRole:role,window:item.minute===45?'half-time':
    item.minute===105?'extra-time':'in-play'});
  }else if(item.kind==='yellow'){
   const id=select(active(),await d('actor'));if(id===null)continue;
   push({type:'yellow',playerId:id});
  }else if(item.kind==='second-first'){
   const candidates=active().filter(id=>state.on.get(id)!=='GK');
   const id=select(candidates.length?candidates:active(),await d('actor'));
   if(id===null)continue;
   state.secondTarget=id;push({type:'yellow',playerId:id,secondYellowSequence:true});
  }else if(item.kind==='direct-red'||item.kind==='second-red'){
   const id=item.kind==='second-red'?state.secondTarget:select(active(),await d('actor'));
   if(id===null||!state.on.has(id))fail('red eligibility');
   if(item.kind==='second-red')push({type:'yellow',playerId:id,secondYellowSequence:true});
   push({type:'red',playerId:id,reason:item.kind==='second-red'?'second_yellow':'direct'});
   state.people.get(id).redCards++;state.dismissed.add(id);state.redCount++;
   closeInterval(state,id,item.minute);state.on.delete(id);
   keeperRecovery(state,item.minute,side,item.side,events);
  }else if(item.kind==='goal'){
   const people=active(),preferred=item.goal.playerId;
   const scorer=state.on.has(preferred)?preferred:select(people,await d('scorer'));
   if(scorer===null)fail('goal has no active scorer');
   const others=people.filter(id=>id!==scorer);
   const hasPass=others.length>0&&(await d('final-pass'))<.65;
   const weight=id=>{
    const starter=side.starters.find(p=>p.playerId===id);
    const reserve=state.bench.find(p=>p.playerId===id);
    const a=starter?.attributes??reserve?.attributes;
    return (a.passing+a.vision)/2;
   };
   const passer=hasPass?select(others,await d('assister'),weight):null;
   const goalId=item.side+':'+item.idx;
   if(passer!==null){
    push({type:'pass',fromPlayerId:passer,toPlayerId:scorer,goalId,
     purpose:'deliberate_final_pass'});
    state.people.get(passer).assists++;
   }
   push({type:'goal',playerId:scorer,assistingPlayerId:passer,goalId,
    creation:passer===null?'open_play_solo':'open_play_pass'});
   state.people.get(scorer).goals++;
   goalsBySide[item.side]++;
  }
 }
 const home=finish(states.home),away=finish(states.away);
 for(const name of ['home','away']){
  const scored=goalsBySide[name],unattributed=result[name].unattributedGoals;
  if(scored+unattributed!==result[name+'Goals'])fail('score reconciliation');
  const s=states[name];
  if(!s.fallback&&(s.windows.size>3+(duration===120?1:0)||
   s.subCount>5+(duration===120?1:0)||s.on.size!==11-s.redCount))fail('substitution/dismissal limits');
 }
 return {eventModelVersion:MATCH_EVENT_MODEL_VERSION,events:events.map((e,ordinal)=>({...e,ordinal})),home,away};
}
