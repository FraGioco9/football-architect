/** SIM05.03: tactical decisions made at the event cursor.
 * Tactical events already played never change; substitutions use SIM04's real limits.
 */
import {validateCoach} from './ai-coach.mjs';
import {changeTacticalInstructions,validateTacticalSessionShape,summarizeTacticalSession,synchronizeTacticalLineup,MATCH_STEPS} from './team-tactics-match.mjs';
import {advanceMatchday,validateMatchday,teamStrength} from './matchday.mjs';
import {applyAISubstitutions} from './matchday-ai.mjs';
export const AI_CONTROLLER_SCHEMA=1;
const fail=code=>{throw Error('SIM05_'+code)};
const clone=structuredClone;
const same=(a,b)=>String(a)===String(b);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function teamSide(tactical,teamId){const i=tactical.teams.findIndex(t=>same(t.id,teamId));if(i<0)fail('TEAM_MISSING');return i===0?'home':'away';}
function validateObservation(o,tactical,teamId){
 if(!o||typeof o!=='object'||Array.isArray(o))fail('OBSERVATION');
 const keys=['yellowPlayerIds','redPlayerIds','injuredPlayerIds'];
 if(Object.keys(o).some(k=>!keys.includes(k)))fail('UNKNOWN_OBSERVATION');
 for(const k of keys){
  if(o[k]===undefined)continue;
  if(!Array.isArray(o[k])||new Set(o[k].map(String)).size!==o[k].length)fail('OBSERVATION_IDS');
  const team=tactical.teams.find(t=>same(t.id,teamId));
  if(!team.rolePlan)fail('OBSERVATION_WITHOUT_XI');
  const allowed=new Set(team.rolePlan.assignments.map(a=>String(a.playerId)));
  if(!o[k].every(id=>allowed.has(String(id))))fail('OBSERVATION_UNKNOWN_PLAYER');
 }
 return {yellowPlayerIds:[...(o.yellowPlayerIds??[])],redPlayerIds:[...(o.redPlayerIds??[])],injuredPlayerIds:[...(o.injuredPlayerIds??[])]};
}
export function createCoachController({coach,tactical,matchday=null}={}){
 validateCoach(coach);validateTacticalSessionShape(tactical);teamSide(tactical,coach.teamId);
 if(matchday){validateMatchday(matchday);if(!matchday.teams.some(t=>same(t.teamId,coach.teamId))||!same(matchday.matchId,tactical.matchId))fail('MATCHDAY_MISMATCH');}
 return {schemaVersion:AI_CONTROLLER_SCHEMA,coach:clone(coach),tactical:clone(tactical),matchday:matchday?clone(matchday):null,
  decisions:[],revision:0,lastStep:-1};
}
export function validateCoachController(c){
 if(!c||c.schemaVersion!==AI_CONTROLLER_SCHEMA||!Number.isSafeInteger(c.revision)||c.revision<0||!Array.isArray(c.decisions))fail('CONTROLLER');
 validateCoach(c.coach);validateTacticalSessionShape(c.tactical);teamSide(c.tactical,c.coach.teamId);
 if(c.matchday){validateMatchday(c.matchday);if(!same(c.matchday.matchId,c.tactical.matchId))fail('MATCHDAY_MISMATCH');}
 if(!Number.isInteger(c.lastStep)||c.lastStep>c.tactical.cursor||c.lastStep< -1)fail('LAST_STEP');
 if(c.decisions.some(d=>!Number.isInteger(d.step)||d.step<0||d.step>c.lastStep||!['tactics','substitution'].includes(d.type)))fail('DECISIONS');
 return true;
}
/** Decision inputs are observable score, fitness, cards and injuries. No hidden scouting stats. */
export function evaluateCoach({coach,tactical,observations={}}={}){
 validateCoach(coach);validateTacticalSessionShape(tactical);
 const side=teamSide(tactical,coach.teamId),team=tactical.teams.find(t=>same(t.id,coach.teamId));
 const obs=validateObservation(observations,tactical,coach.teamId);
 if(tactical.cursor>=MATCH_STEPS)return null;
 const summary=summarizeTacticalSession(tactical),ours=summary[side].goals,theirs=summary[side==='home'?'away':'home'].goals;
 const minute=tactical.cursor/2;const fitness=summary.fatigue[side];
 const scoreDifference=ours-theirs;
 const current=team.tactics;const hasRed=obs.redPlayerIds.length>0;
 const hasYellow=obs.yellowPlayerIds.length>0;
 let reason=null,phase='inPossession',patch=null;
 if(hasRed && current.outOfPossession.intensity>45){
  phase='outOfPossession';reason='redCard';patch={intensity:45,pressing:Math.min(55,current.outOfPossession.pressing)};
 } else if(fitness<65&&current.outOfPossession.intensity>55){
  phase='outOfPossession';reason='fatigue';patch={intensity:Math.max(35,current.outOfPossession.intensity-13)};
 } else if(hasYellow&&current.outOfPossession.intensity>75){
  phase='outOfPossession';reason='yellowCard';patch={intensity:70};
 } else if(minute>=55&&scoreDifference<0&&current.inPossession.mentality<80){
  reason='trailing';patch={mentality:clamp(current.inPossession.mentality+Math.round(5+coach.risk/13),0,80)};
 } else if(minute>=65&&scoreDifference>0&&current.inPossession.mentality>33){
  reason='protectLead';patch={mentality:clamp(current.inPossession.mentality-Math.round(5+(100-coach.risk)/16),33,100)};
 } else if(minute>=70&&scoreDifference===0&&coach.risk>=70&&current.inPossession.mentality<66){
  reason='latePush';patch={mentality:66};
 }
 // Low-adaptability managers are slower to change, except for a red card / severe fatigue.
 if(reason&&['trailing','protectLead','latePush'].includes(reason)&&minute<65+(100-coach.adaptability)/5)return null;
 if(!reason)return null;
 return {type:'tactics',reason,atStep:tactical.cursor,teamId:coach.teamId,phase,patch,
  context:{minute,scoreDifference,fitness:Number(fitness.toFixed(2)),yellowCards:obs.yellowPlayerIds.length,redCards:obs.redPlayerIds.length}};
}
/** Only one tactical edit per call at the current step, plus rules-compliant SIM04 substitutions.
 * Duplicate calls at a step do nothing; rejected changes leave the previous JSON untouched.
 */
export function takeCoachTurn(controller,{observations={},expectedRevision=controller?.revision,allowSubstitutions=true}={}){
 validateCoachController(controller);
 if(expectedRevision!==controller.revision)fail('REVISION_CONFLICT');
 if(controller.tactical.cursor>=MATCH_STEPS||controller.lastStep===controller.tactical.cursor)return clone(controller);
 const result=clone(controller),step=result.tactical.cursor;
 const side=teamSide(result.tactical,result.coach.teamId);
 const obs=validateObservation(observations,result.tactical,result.coach.teamId);
 const summary=summarizeTacticalSession(result.tactical);
 const goals=summary[side].goals-summary[side==='home'?'away':'home'].goals;
 // Clock is advanced only forward and substitutions are made before future match windows.
 if(result.matchday&&allowSubstitutions&&step>0&&(step%20===0||obs.injuredPlayerIds.length>0)){
  const second=step*30,phase=step<90?'first_half':'second_half';
  if(result.matchday.currentSecond<=second){
   const md=advanceMatchday(result.matchday,{second,phase});
   const applied=applyAISubstitutions(md,{teamId:result.coach.teamId,second,phase,scoreDifference:goals,
    injuredPlayerIds:obs.injuredPlayerIds,maxChanges:result.coach.rotation>=65?2:1});
   result.matchday=applied.state;
   if(applied.proposalsApplied>0){
     const newSubs=applied.state.events.slice(md.events.length).filter(e=>e.type==='substitution'&&same(e.teamId,result.coach.teamId));
     const old=result.tactical.teams.find(t=>same(t.id,result.coach.teamId));
     if(old.rolePlan&&newSubs.length){
       const next=clone(old.rolePlan);
       for(const sub of newSubs){const row=next.assignments.find(a=>same(a.playerId,sub.playerId));
         if(!row)fail('LINEUP_OUTGOING_MISSING');row.playerId=sub.relatedPlayerId;}
       next.revision++;
       result.tactical=synchronizeTacticalLineup(result.tactical,{teamId:result.coach.teamId,rolePlan:next,
         strength:clamp(teamStrength(result.matchday,result.coach.teamId),1,100)});
     }
   }
   if(applied.proposalsApplied>0)result.decisions.push({step,type:'substitution',teamId:result.coach.teamId,count:applied.proposalsApplied,reason:'fitnessOrInjury'});
  }
 }
 const emergency=obs.redPlayerIds.length>0||obs.injuredPlayerIds.length>0;
 // Every ten minutes, apart from observed emergencies. Avoid tactical whiplash.
 if(step>=60&&(step%20===0||emergency)){
  const lastTactic=[...result.decisions].reverse().find(d=>d.type==='tactics');
  if(!lastTactic||step-lastTactic.step>=20||emergency&&step>lastTactic.step){
   const decision=evaluateCoach({coach:result.coach,tactical:result.tactical,observations:obs});
   if(decision){
    result.tactical=changeTacticalInstructions(result.tactical,{teamId:result.coach.teamId,phase:decision.phase,patch:decision.patch});
    result.decisions.push({step,type:'tactics',teamId:result.coach.teamId,reason:decision.reason,phase:decision.phase,patch:decision.patch,context:decision.context});
   }
  }
 }
 result.lastStep=step;result.revision++;
 return result;
}
