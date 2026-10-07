/** SIM02.03/.05: seeded causal match windows; proof-of-concept independent of official SIM01.
 * Fixed 30-second windows. Speed has no effect on RNG, all stats derive from events.
 * Tactics can be edited at the current cursor, and affect only subsequent windows.
 */
import {validateTactics,replaceTacticalPhase} from './team-tactics.mjs';
import {validateRolePlan,updateRolePlan} from './player-role-plan.mjs';
import {ROLE_BY_ID} from './player-roles.mjs';
export const TACTIC_MATCH_SCHEMA=1;
export const MATCH_STEPS=180;
export const STEP_SECONDS=30;
const fail=(valid,code)=>{if(!valid)throw new Error(`TACTIC_MATCH_${code}`);};
const clone=v=>structuredClone(v);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const scaled=v=>(v-50)/50;
const num=v=>Number.isFinite(v);
const key=v=>typeof v==='string'?v:String(v);
const identity=v=>(typeof v==='string'&&v.trim().length>0)||(Number.isSafeInteger(v)&&v>0);
function randomAt(seed,step){
  let h=(seed ^ Math.imul(step+1,0x9e3779b1))>>>0;
  h=Math.imul(h^(h>>>16),0x85ebca6b)>>>0;
  h=Math.imul(h^(h>>>13),0xc2b2ae35)>>>0;
  h=(h^(h>>>16))>>>0;
  return ()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return (h>>>0)/4294967296;};
}
function phaseFor(step){return step<90?'first_half':'second_half';}
function validTeam(t){
  fail(t&&identity(t.id)&&num(t.strength)&&t.strength>=1&&t.strength<=100,'TEAM');
  validateTactics(t.tactics);
  if(t.rolePlan!==undefined)validateRolePlan(t.rolePlan);
}
/** Optional role layer: teams without role plans keep SIM02 RNG and events unchanged. */
function roleProfile(team){
  if(!team.rolePlan)return null;
  const rows=team.rolePlan.assignments.filter(x=>x.position!=='GK');
  const accum={passing:0,shooting:0,cover:0,press:0};
  for(const a of rows){
    const intensity=(a.fit??75)/100;
    for(const k of Object.keys(accum))accum[k]+=ROLE_BY_ID[a.role].effect[k]*intensity;
    if(a.duty==='attack'){accum.shooting+=0.7*intensity;accum.cover-=0.45*intensity;}
    if(a.duty==='defend'){accum.cover+=0.65*intensity;accum.shooting-=0.35*intensity;}
  }
  return Object.fromEntries(Object.entries(accum).map(([k,v])=>[k,v/rows.length]));
}
function chooseActor(rnd,team,kind,exclude){
  const rows=team.rolePlan.assignments.filter(a=>a.position!=='GK'&&String(a.playerId)!==String(exclude));
  const field=kind==='shot'?'shooting':kind==='recover'?'cover':'passing';
  const weights=rows.map(a=>Math.max(0.05,1+(ROLE_BY_ID[a.role].effect[field]||0)*0.34+(a.duty==='attack'&&kind==='shot'?0.3:0)));
  const total=weights.reduce((a,b)=>a+b,0);let roll=rnd()*total;
  for(let i=0;i<rows.length;i++){roll-=weights[i];if(roll<=0)return rows[i];}
  return rows.at(-1);
}
/** Coefficients intentionally modest to prevent single tactics winning regardless of opposition. */
function stepEvents(s,step,homeT,awayT,fitness){
  const rnd=randomAt(s.seed,step);
  const teams=[homeT,awayT];
  const profiles=teams.map(roleProfile);
  const powers=teams.map((team,i)=>{
    const p=team.tactics.inPossession,d=team.tactics.outOfPossession,x=team.tactics.transition;
    return {
      possession:-0.10*scaled(p.passingDirectness)+0.08*scaled(p.width)+0.06*scaled(p.tempo)-0.05*scaled(d.pressing),
      aggression:0.20*scaled(p.mentality)+0.13*scaled(p.tempo)+0.10*scaled(x.transitionSpeed),
      pressing:scaled(d.pressing)*(0.65+0.35*d.intensity/100)*(0.5+fitness[i]/200)+(x.counterPress?0.08:0),
      exposure:scaled(d.defensiveLine)*0.26+scaled(p.mentality)*0.10-(x.counterPress?0.06:0),
      quality:(team.strength-65)*0.0075+(0.10*scaled(p.width)-0.08*Math.abs(p.passingDirectness-42)/58),
      staminaCost:(0.10+0.070*d.pressing/100+0.080*d.intensity/100+0.028*p.tempo/100+(x.counterPress?0.018:0))*(1+(100-fitness[i])*0.004),
      tempo:p.tempo,
      direct:p.passingDirectness,
      counter:x.counterAttack,
      transition:x.transitionSpeed,
    };
  });
  const rolePossession=(profiles[0]?.passing??0)-(profiles[1]?.passing??0);
  const bias=clamp((homeT.strength-awayT.strength)*0.0053 + powers[0].possession-powers[1].possession+0.035+0.016*rolePossession, -0.31,0.31);
  let attack=rnd()<0.5+bias?0:1;
  let defense=1-attack;
  const events=[];
  const make=(type,side,extra={})=>({id:`${key(s.matchId)}:${step}:${events.length}`,step,second:step*STEP_SECONDS+15,period:phaseFor(step),type,teamId:teams[side].id,side:side===0?'home':'away',...extra});
  events.push(make('possession',attack));
  // More opponent pressure + direct passing increases turnover risk; technical quality counters it.
  const turnoverRisk=clamp(0.075+0.056*powers[defense].pressing + 0.027*scaled(powers[attack].direct)
    -0.021*(teams[attack].strength-teams[defense].strength)/35+0.018*(100-fitness[attack])/100,0.017,0.25);
  let counter=false;
  if(rnd()<clamp(turnoverRisk+0.011*(profiles[defense]?.press??0)-0.008*(profiles[attack]?.passing??0),0.017,0.25)){
    const actor=teams[defense].rolePlan?chooseActor(rnd,teams[defense],'recover'):null;
    events.push(make('recovery',defense,{opponentTeamId:teams[attack].id,...(actor?{playerId:actor.playerId,role:actor.role,duty:actor.duty}:{})}));
    const old=attack;attack=defense;defense=old;
    counter=Boolean(teams[attack].tactics.transition.counterAttack);
  }
  const off=powers[attack],def=powers[defense];
  if(teams[attack].rolePlan){
    const from=chooseActor(rnd,teams[attack],'pass');
    const to=chooseActor(rnd,teams[attack],'pass',from.playerId);
    const passQuality=clamp(0.78+0.10*(teams[attack].strength-teams[defense].strength)/35
      +0.025*(profiles[attack]?.passing??0)-0.035*powers[defense].pressing-0.035*scaled(powers[attack].direct),0.58,0.96);
    const completed=randomAt(s.seed^0x51a7c0de,step)()<passQuality;
    events.push(make('pass',attack,{playerId:from.playerId,targetPlayerId:to.playerId,completed,role:from.role,duty:from.duty}));
  }
  const fatigueDisadvantage=(fitness[defense]-fitness[attack])*0.0012;
  // A compact defense attacked with a fast/direct counter does not behave like a
  // high line caught behind a pressing wave: the latter leaves channels.
  const defensiveLine=teams[defense].tactics.outOfPossession.defensiveLine;
  const runBehind=Math.max(0,(defensiveLine-55)/45)
    * (teams[attack].tactics.transition.counterAttack?1:0.3)
    * (0.3+0.7*off.transition/100)
    * (0.30+0.70*off.direct/100);
  let shotChance=0.138+off.aggression*0.10+off.quality*0.08 -def.pressing*0.020
   + (counter ? off.transition/100*0.026+def.exposure*0.06:0) +0.23*runBehind +fatigueDisadvantage*0.04-0.020*(100-fitness[attack])/100;
  shotChance+=0.014*(profiles[attack]?.shooting??0)-0.015*(profiles[defense]?.cover??0);
  shotChance=clamp(shotChance,0.043,0.31);
  if(rnd()<shotChance){
    const baseXg=0.078+0.055*(rnd())+off.quality*0.06-def.quality*0.035;
    const counterBoost=counter?(0.027+def.exposure*0.11):0;
    const xg=Number(clamp(baseXg+counterBoost+0.045*runBehind-0.011*Math.max(0,scaled(off.direct))
      +0.005*(profiles[attack]?.shooting??0)-0.005*(profiles[defense]?.cover??0),0.012,0.45).toFixed(4));
    const goal=rnd()<xg;
    const actor=teams[attack].rolePlan?chooseActor(rnd,teams[attack],'shot'):null;
    const onTarget=s.analyticsMode?(goal||randomAt(s.seed^0x7a11a7cc,step)()<clamp(0.24+xg*1.35,0.2,0.75)):undefined;
    events.push(make(goal?'goal':'shot',attack,{xg,counterattack:counter||runBehind>0.12,
      ...(s.analyticsMode?{onTarget}:{}),
      ...(actor?{playerId:actor.playerId,role:actor.role,duty:actor.duty}:{})}));
    if(s.analyticsMode&&!goal&&onTarget&&teams[defense].rolePlan){
      const keeper=teams[defense].rolePlan.assignments.find(a=>a.position==='GK');
      events.push(make('save',defense,{opponentTeamId:teams[attack].id,...(keeper?{playerId:keeper.playerId,role:keeper.role,duty:keeper.duty}:{})}));
    }
  }
  const foulChance=clamp(0.118+def.pressing*0.037+scaled(teams[defense].tactics.outOfPossession.intensity)*0.032,0.045,0.25);
  if(rnd()<foulChance){
    const actor=s.analyticsMode&&teams[defense].rolePlan?chooseActor(randomAt(s.seed^0x667acc31,step),teams[defense],'recover'):null;
    events.push(make('foul',defense,{...(actor?{playerId:actor.playerId}: {})}));
    if(s.analyticsMode&&actor){
      const cardRoll=randomAt(s.seed^0x71c4ad55,step)();
      if(cardRoll<0.205)events.push(make('yellow_card',defense,{playerId:actor.playerId}));
    }
  }
  return {events,fitness:fitness.map((f,i)=>Number(clamp(f-powers[i].staminaCost,0,100).toFixed(4)))};
}
function applyStep(state){
  const step=state.cursor;
  const teams=state.teams.map(t=>clone(t));
  for(const change of state.changes.filter(c=>c.atStep===step)){
    const idx=teams.findIndex(t=>key(t.id)===key(change.teamId));
    teams[idx].tactics=clone(change.tactics);
  }
  for(const change of (state.roleChanges??[]).filter(c=>c.atStep===step)){
    const idx=teams.findIndex(t=>key(t.id)===key(change.teamId));
    teams[idx].rolePlan=clone(change.rolePlan);
  }
  for(const change of (state.lineupChanges??[]).filter(c=>c.atStep===step)){
    const idx=teams.findIndex(t=>key(t.id)===key(change.teamId));
    teams[idx].rolePlan=clone(change.rolePlan);teams[idx].strength=change.strength;
  }
  const batch=stepEvents(state,step,teams[0],teams[1],[state.fatigue.home,state.fatigue.away]);
  state.events.push(...batch.events);
  state.fatigue={home:batch.fitness[0],away:batch.fitness[1]};
  state.teams=teams;
  state.cursor++;
  return state;
}
export function createTacticalSession({matchId,seed,home,away,analyticsMode=false}){
  fail(identity(matchId)&&Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff,'IDENTITY');
  validTeam(home);validTeam(away);fail(key(home.id)!==key(away.id),'SAME_TEAM');
  fail(typeof analyticsMode==='boolean','ANALYTICS_MODE');
  const teams=[clone(home),clone(away)];
  return {schemaVersion:1,matchId,seed,...(analyticsMode?{analyticsMode:true}:{}),cursor:0,teams,initialTeams:clone(teams),
    changes:[],roleChanges:[],lineupChanges:[],events:[],fatigue:{home:100,away:100},revision:0};
}
export function advanceTacticalSession(session,count=1){
  validateTacticalSessionShape(session);
  fail(Number.isSafeInteger(count)&&count>=0,'ADVANCE_COUNT');
  const out=clone(session);
  const steps=Math.min(count,MATCH_STEPS-out.cursor);
  for(let i=0;i<steps;i++)applyStep(out);
  out.revision++;
  return out;
}
export function finishTacticalSession(session){return advanceTacticalSession(session,MATCH_STEPS-session.cursor);}
export function changeTacticalInstructions(session,{teamId,phase,patch,expectedRevision=session.revision}){
  validateTacticalSessionShape(session);
  fail(session.cursor<MATCH_STEPS,'FINISHED');
  fail(session.revision===expectedRevision,'REVISION_CONFLICT');
  const team=session.teams.find(t=>key(t.id)===key(teamId));fail(team,'TEAM_NOT_FOUND');
  const tactics=replaceTacticalPhase(team.tactics,phase,patch);
  const result=clone(session);
  result.teams.find(t=>key(t.id)===key(teamId)).tactics=tactics;
  // Multiple same-step edits coalesce; full snapshot for deterministic replay.
  const idx=result.changes.findIndex(c=>c.atStep===result.cursor&&key(c.teamId)===key(teamId));
  const change={atStep:result.cursor,second:result.cursor*STEP_SECONDS,teamId,phase,
    instructions:clone(patch),tactics:clone(tactics)};
  if(idx<0)result.changes.push(change);else result.changes[idx]=change;
  result.revision++;
  return result;
}
/** SIM02.05: one full tactical snapshot per team at the current event cursor.
 * The existing seeded SIM01 stream reads this before generating later windows;
 * no RNG, substitutions or earlier events are changed.
 */
export function replaceAllTacticalInstructions(session,{teamId,tactics,reason='manual',expectedRevision=session.revision}){
  validateTacticalSessionShape(session);
  fail(session.cursor<MATCH_STEPS,'FINISHED');fail(session.revision===expectedRevision,'REVISION_CONFLICT');
  validateTactics(tactics);
  const idx=session.teams.findIndex(t=>key(t.id)===key(teamId));fail(idx>=0,'TEAM_NOT_FOUND');
  fail(typeof reason==='string'&&reason.length<=80,'REASON');
  const result=clone(session);
  result.teams[idx].tactics=clone(tactics);
  const atStep=result.cursor;
  const index=result.changes.findIndex(c=>c.atStep===atStep&&key(c.teamId)===key(teamId));
  const entry={atStep,second:atStep*STEP_SECONDS,teamId,phase:'all',instructions:{},tactics:clone(tactics),reason};
  if(index<0)result.changes.push(entry);else result.changes[index]=entry;
  result.revision++;return result;
}
/** SIM03.03: event-time role edit, never retroactive. One snapshot per team per step. */
export function changePlayerRole(session,{teamId,slotId,role,duty,expectedRevision=session.revision}){
  validateTacticalSessionShape(session);
  fail(session.cursor<MATCH_STEPS,'FINISHED');
  fail(session.revision===expectedRevision,'REVISION_CONFLICT');
  const team=session.teams.find(t=>key(t.id)===key(teamId));
  fail(team&&team.rolePlan,'ROLE_PLAN_MISSING');
  const plan=updateRolePlan(team.rolePlan,{slotId,role,duty});
  const out=clone(session);out.teams.find(t=>key(t.id)===key(teamId)).rolePlan=plan;
  out.roleChanges??=[];
  const i=out.roleChanges.findIndex(c=>c.atStep===out.cursor&&key(c.teamId)===key(teamId));
  const item={atStep:out.cursor,second:out.cursor*STEP_SECONDS,teamId,rolePlan:clone(plan)};
  if(i<0)out.roleChanges.push(item);else out.roleChanges[i]=item;
  out.revision++;return out;
}
/** SIM05: synchronized, SIM04-approved substitutions affect only *future* actions. */
export function synchronizeTacticalLineup(session,{teamId,rolePlan,strength,expectedRevision=session.revision}){
  validateTacticalSessionShape(session);
  fail(session.cursor<MATCH_STEPS,'FINISHED');fail(session.revision===expectedRevision,'REVISION_CONFLICT');
  const team=session.teams.find(t=>key(t.id)===key(teamId));
  fail(team&&team.rolePlan,'LINEUP_TEAM');validateRolePlan(rolePlan);
  fail(num(strength)&&strength>=1&&strength<=100,'LINEUP_STRENGTH');
  fail(rolePlan.formation===team.rolePlan.formation,'LINEUP_FORMATION');
  const ids=new Set(team.rolePlan.assignments.map(a=>key(a.slotId)));
  fail(rolePlan.assignments.every(a=>ids.has(key(a.slotId))&&team.rolePlan.assignments.some(x=>key(x.slotId)===key(a.slotId)&&x.position===a.position&&x.role===a.role&&x.duty===a.duty)),'LINEUP_SLOTS');
  const result=clone(session);result.lineupChanges??=[];
  const previous=result.lineupChanges.findIndex(c=>c.atStep===result.cursor&&key(c.teamId)===key(teamId));
  const item={atStep:result.cursor,second:result.cursor*STEP_SECONDS,teamId,rolePlan:clone(rolePlan),strength};
  if(previous>=0)result.lineupChanges[previous]=item;else result.lineupChanges.push(item);
  const out=result.teams.find(t=>key(t.id)===key(teamId));out.rolePlan=clone(rolePlan);out.strength=strength;result.revision++;return result;
}
export function validateTacticalSessionShape(s){
  fail(s&&s.schemaVersion===1&&identity(s.matchId)&&Number.isInteger(s.seed)&&s.seed>=0&&s.seed<=0xffffffff,'CONTEXT');
  fail(s.analyticsMode===undefined||s.analyticsMode===true,'ANALYTICS_MODE');
  fail(Number.isInteger(s.cursor)&&s.cursor>=0&&s.cursor<=MATCH_STEPS&&Number.isSafeInteger(s.revision)&&s.revision>=0,'CURSOR');
  fail(Array.isArray(s.events)&&Array.isArray(s.changes)&&(s.roleChanges===undefined||Array.isArray(s.roleChanges))&&(s.lineupChanges===undefined||Array.isArray(s.lineupChanges))&&Array.isArray(s.teams)&&s.teams.length===2&&Array.isArray(s.initialTeams)&&s.initialTeams.length===2,'ARRAYS');
  s.teams.forEach(validTeam);s.initialTeams.forEach(validTeam);
  fail(s.fatigue&&num(s.fatigue.home)&&num(s.fatigue.away),'FATIGUE');
  for(const ch of s.changes){
    fail(ch&&Number.isSafeInteger(ch.atStep)&&ch.atStep>=0&&ch.atStep<=s.cursor&&ch.atStep<MATCH_STEPS&&ch.second===ch.atStep*STEP_SECONDS,'CHANGE');
    fail(s.initialTeams.some(t=>key(t.id)===key(ch.teamId)),'CHANGE_TEAM');
    validateTactics(ch.tactics);
  }
  for(const ch of s.roleChanges??[]){
    fail(ch&&Number.isSafeInteger(ch.atStep)&&ch.atStep>=0&&ch.atStep<=s.cursor&&ch.atStep<MATCH_STEPS&&ch.second===ch.atStep*STEP_SECONDS,'ROLE_CHANGE');
    const team=s.initialTeams.find(t=>key(t.id)===key(ch.teamId));fail(team&&team.rolePlan,'ROLE_CHANGE_TEAM');
    validateRolePlan(ch.rolePlan);
    const a=team.rolePlan.assignments,b=ch.rolePlan.assignments;
    fail(ch.rolePlan.formation===team.rolePlan.formation&&a.every(x=>b.some(y=>key(x.slotId)===key(y.slotId)&&key(x.playerId)===key(y.playerId)&&x.position===y.position)),'ROLE_CHANGE_XI');
  }
  for(const ch of s.lineupChanges??[]){
    fail(ch&&Number.isSafeInteger(ch.atStep)&&ch.atStep>=0&&ch.atStep<=s.cursor&&ch.atStep<MATCH_STEPS&&ch.second===ch.atStep*STEP_SECONDS,'LINEUP_CHANGE');
    const team=s.initialTeams.find(t=>key(t.id)===key(ch.teamId));fail(team&&team.rolePlan,'LINEUP_TEAM');
    validateRolePlan(ch.rolePlan);fail(num(ch.strength)&&ch.strength>=1&&ch.strength<=100,'LINEUP_STRENGTH');
    fail(ch.rolePlan.formation===team.rolePlan.formation&&team.rolePlan.assignments.every(a=>ch.rolePlan.assignments.some(b=>key(a.slotId)===key(b.slotId)&&a.position===b.position)),'LINEUP_SLOTS');
  }
  return true;
}
/** Strict replay-based validation prevents duplicated goals or altered events on JSON import. */
export function restoreTacticalSession(input){
  const s=typeof input==='string'?JSON.parse(input):clone(input);
  validateTacticalSessionShape(s);
  const state=createTacticalSession({matchId:s.matchId,seed:s.seed,home:s.initialTeams[0],away:s.initialTeams[1],analyticsMode:s.analyticsMode===true});
  for(const change of s.changes){
    fail(!state.changes.some(c=>c.atStep===change.atStep&&key(c.teamId)===key(change.teamId)),'CHANGE_DUPLICATE');
    state.changes.push(clone(change));
  }
  for(const change of s.roleChanges??[]){
    fail(!state.roleChanges.some(c=>c.atStep===change.atStep&&key(c.teamId)===key(change.teamId)),'ROLE_CHANGE_DUPLICATE');
    state.roleChanges.push(clone(change));
  }
  for(const change of s.lineupChanges??[]){
    fail(!state.lineupChanges.some(c=>c.atStep===change.atStep&&key(c.teamId)===key(change.teamId)),'LINEUP_CHANGE_DUPLICATE');
    state.lineupChanges.push(clone(change));
  }
  for(let step=0;step<s.cursor;step++)applyStep(state);
  for(const change of s.changes.filter(c=>c.atStep===s.cursor)){
    state.teams.find(t=>key(t.id)===key(change.teamId)).tactics=clone(change.tactics);
  }
  for(const change of (s.roleChanges??[]).filter(c=>c.atStep===s.cursor)){
    state.teams.find(t=>key(t.id)===key(change.teamId)).rolePlan=clone(change.rolePlan);
  }
  for(const change of (s.lineupChanges??[]).filter(c=>c.atStep===s.cursor)){
    const team=state.teams.find(t=>key(t.id)===key(change.teamId));team.rolePlan=clone(change.rolePlan);team.strength=change.strength;
  }
  fail(JSON.stringify(state.events)===JSON.stringify(s.events),'EVENTS_CHANGED');
  fail(JSON.stringify(state.fatigue)===JSON.stringify(s.fatigue),'FATIGUE_CHANGED');
  fail(JSON.stringify(state.teams)===JSON.stringify(s.teams),'TACTICS_CHANGED');
  state.revision=s.revision;return state;
}
export function summarizeTacticalSession(session){
  validateTacticalSessionShape(session);
  const sums=()=>({goals:0,shots:0,xg:0,possessions:0,recoveries:0,fouls:0});
  const out={home:sums(),away:sums(),step:session.cursor};
  for(const e of session.events){
    fail(e&&(e.side==='home'||e.side==='away'),'EVENT_SIDE');
    const s=out[e.side];
    if(e.type==='goal'||e.type==='shot'){s.shots++;s.xg+=e.xg;if(e.type==='goal')s.goals++;}
    if(e.type==='recovery')s.recoveries++;
    if(e.type==='foul')s.fouls++;
    if(e.type==='possession')s.possessions++;
  }
  for(const side of ['home','away'])out[side].xg=Number(out[side].xg.toFixed(3));
  const total=out.home.possessions+out.away.possessions;
  out.possessionPct={home:total?Math.round(out.home.possessions/total*100):50,
    away:total?100-Math.round(out.home.possessions/total*100):50};
  out.fatigue=clone(session.fatigue);
  return out;
}
