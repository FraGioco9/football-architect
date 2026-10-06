import {applySubstitution, teamStrength, validateMatchday} from './matchday.mjs';
const group = (pos) => {
  if (pos==='GK') return 'GK';
  if (['CB'].includes(pos)) return 'CB';
  if (['RB','LB','RWB','LWB'].includes(pos)) return 'FB';
  if (['CM','CDM','CAM'].includes(pos)) return 'CM';
  if (['RW','LW','RM','LM'].includes(pos)) return 'W';
  return 'F';
};
const tie = (a,b) => String(a.id).localeCompare(String(b.id),'en',{numeric:true});
const findTeam = (state,teamId) => state.teams.find(t=>String(t.teamId)===String(teamId));
/** Deterministic proposals for a CPU team, assessed at a fixed match-second.
 * scoreDifference: goals for team minus opponent. No global RNG or side effects.
 */
export function planAISubstitutions(state,{teamId,second=state.currentSecond,phase=state.phase,scoreDifference=0,maxChanges=2,injuredPlayerIds=[]}={}) {
  validateMatchday(state);
  if (state.finished || phase==='full_time') return [];
  if (!Number.isInteger(second) || second < state.currentSecond || second > 135*60 || !Number.isFinite(scoreDifference)) throw new Error('MATCHDAY_AI_CONTEXT');
  const team=findTeam(state,teamId);
  if(!team) throw new Error('MATCHDAY_TEAM_NOT_FOUND');
  if (!Number.isInteger(maxChanges) || maxChanges<0 || maxChanges>11) throw new Error('MATCHDAY_AI_LIMIT');
  if (!Array.isArray(injuredPlayerIds)) throw new Error('MATCHDAY_AI_INJURIES');
  if (maxChanges===0) return [];
  const minute=second/60;
  const isInjured = p => injuredPlayerIds.some(pid=>String(pid)===String(p.id));
  const estimatedFitness = p => Math.max(0,p.fitness-Math.max(0,minute)*0.18);
  const isAttacker = p => ['RW','LW','RM','LM','CAM','CF','ST'].includes(p.position);
  const threshold = scoreDifference<0 ? 82 : scoreDifference>0 ? 74 : 77;
  const exhausted=team.onField.map(pid=>team.players.find(p=>String(p.id)===String(pid)))
    .filter(p=>p.position!=='GK' || p.fitness<20 || isInjured(p))
    .filter(p=>isInjured(p) || estimatedFitness(p)<27 || minute>=55 && (estimatedFitness(p)<58 || scoreDifference<0 && isAttacker(p) && estimatedFitness(p)<threshold) || minute>=72 && estimatedFitness(p)<threshold || minute>=82 && estimatedFitness(p)<87)
    .sort((a,b)=>Number(isInjured(b))-Number(isInjured(a)) || estimatedFitness(a)-estimatedFitness(b) || tie(a,b));
  const available=team.availableBench.map(pid=>team.players.find(p=>String(p.id)===String(pid))).filter(Boolean);
  const selected=[], used=new Set();
  for(const outgoing of exhausted) {
    const candidate=available
      .filter(p=> !used.has(String(p.id)) && (p.position===outgoing.position || group(p.position)===group(outgoing.position)))
      .sort((a,b)=>(b.position===outgoing.position)-(a.position===outgoing.position) || b.ovr-a.ovr || b.fitness-a.fitness || tie(a,b))[0];
    if(!candidate) continue;
    if(!isInjured(outgoing) && estimatedFitness(outgoing)>27 && minute<55) continue;
    selected.push({teamId,outgoing:outgoing.id,incoming:candidate.id,second,phase,reason:'ai'});
    used.add(String(candidate.id));
    if(selected.length>=maxChanges) break;
  }
  return selected;
}
export function applyAISubstitutions(state,options) {
  const proposals=planAISubstitutions(state,options);
  let result=state;
  for(const p of proposals) {
    try { result=applySubstitution(result,p); }
    catch(e) {
      if(['MATCHDAY_SUB_LIMIT','MATCHDAY_WINDOW_LIMIT'].includes(e.message)) break;
      throw e;
    }
  }
  return {state:result,proposalsApplied:result.events.length-state.events.length,
    strengthBefore:teamStrength(state,options.teamId),strengthAfter:teamStrength(result,options.teamId)};
}
