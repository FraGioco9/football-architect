/** SIM05: optional, authoritative career integration of pre-existing pure AI coach.
 * Countries not playing through SIM01 retain their synthetic WRD01 results;
 * coach identity and opponent history are nevertheless persistent across all 8.
 */
import {makeCoach,validateCoach,coachHash} from '../addons/domain/ai-coach.mjs';
import {evaluateCoach} from '../addons/domain/ai-coach-match.mjs';
import {BUILT_IN_STYLES,TACTIC_FIELDS} from '../addons/domain/team-tactics.mjs';
import {FORMATIONS} from './rules.js';
import {makeDefaultLineup} from './lineups.js';
import {scoutingEnabled} from './career-scouting.js';
export const SIM05_SCHEMA=1;
const fail=code=>{throw Error(`SIM05_${code}`)};
const key=(country,id)=>`${country}:club:${id}`;
const mapping={'433':'4-3-3','4231':'4-2-3-1','442':'4-4-2','352':'3-5-2','4141':'4-1-4-1'};
export const careerCoachesEnabled=w=>w?.advancedV1?.coachesV1?.schemaVersion===SIM05_SCHEMA&&w.advancedV1.coachesV1.enabled===true;
function teams(w){
 const all=[...w.teams.map(c=>({countryId:w.countryId,id:c.id}))];
 for(const l of w.advancedV1?.worldV1?.leagues??[])if(!l.locked)for(const c of l.clubs)all.push({countryId:l.countryId,id:c.id});
 return all;
}
export function syncCareerCoachesWorld(w){
 if(!careerCoachesEnabled(w))return;
 const s=w.advancedV1.coachesV1;
 for(const club of teams(w)){
  const k=key(club.countryId,club.id);
  if(!s.coaches[k])s.coaches[k]=createOfficialCoach(w,k,club.countryId);
 }
}
function createOfficialCoach(w,k,country){
 const codes={EN:'ENG',ES:'ESP',DE:'GER',FR:'FRA',NL:'NED',PT:'POR',BR:'BRA'};
 return makeCoach({teamId:k,worldSeed:w.seed>>>0,country:codes[country]??country});
}
export function enableCareerCoaches(w){
 if(w?.advancedV1?.enabled!==true)fail('ADVANCED_REQUIRED');
 if(careerCoachesEnabled(w))return w;
 if(w.advancedV1.coachesV1!==undefined)fail('UNKNOWN_SCHEMA');
 const coaches={};for(const club of teams(w)){
  // Never override the human user's tactics or appointments.
  const k=key(club.countryId,club.id);
  coaches[k]=createOfficialCoach(w,k,club.countryId);
 }
 w.advancedV1.coachesV1={schemaVersion:SIM05_SCHEMA,enabled:true,coaches};
 if(!validateCareerCoaches(w))fail('INITIALIZATION');
 return w;
}
export function careerCoach(w,teamId,country=w.countryId){
 if(!careerCoachesEnabled(w)||country===w.countryId&&teamId===w.clubId)return null;
 const k=key(country,teamId);
 return w.advancedV1.coachesV1.coaches[k]??null;
}
/** Football decisions use public OVR/fitness/availability, not hidden potential. */
export function prepareCoachTeam(w,teamId,opponentId=null){
 const coach=careerCoach(w,teamId);if(!coach)return null;
 const candidates=['4-3-3','4-2-3-1','4-4-2','3-5-2','4-1-4-1'];
 const preferred=mapping[coach.preferredFormation]??'4-3-3';
 const squad=new Map(w.players.filter(p=>p.clubId===teamId).map(p=>[p.id,p]));
 let best=null;
 for(const f of candidates){
  const ids=makeDefaultLineup(w.players,teamId,f),rows=FORMATIONS[f];
  if(ids.length!==11||ids.some(id=>!id)||new Set(ids).size!==11)continue;
  const score=ids.reduce((total,id,i)=>{
   const p=squad.get(id);if(!p)return total-100;
   const exact=p.position===rows[i].p;
   return total+p.ovr+(exact?8:-10)+p.fitness/25;
  },0)/11+(f===preferred?2.5:0);
  if(!best||score>best.score)best={formation:f,ids,score};
 }
 if(!best)fail('NO_VALID_XI');
 // Public roster OVR and fitness, never private potential, steer cautious
 // opponents to counterattacks and ambitious favorites to higher pressing.
 const own=([...squad.values()].filter(p=>!p.injury).reduce((a,p)=>a+p.ovr,0))/Math.max(1,[...squad.values()].filter(p=>!p.injury).length);
 const opposition=w.players.filter(p=>p.clubId===opponentId&&!p.injury);
 const their=opposition.length?opposition.reduce((a,p)=>a+p.ovr,0)/opposition.length:own;
 let style=coach.style;
 if(opponentId!==null&&own<their-7&&coach.risk<65)style='counter';
 if(opponentId!==null&&own>their+7&&coach.risk>=55)style='highPress';
 // The opponent only sees public historical results, not the player's chosen
 // instructions or private attribute/potential profile.
 return {formation:best.formation,ids:best.ids,style,tactics:structuredClone(BUILT_IN_STYLES[style]),coachId:coach.id};
}
export function coachTacticalDecision(w,session,teamId){
 const coach=careerCoach(w,teamId);if(!coach)return null;
 // Use only observable match events; the current SIM01 event generator
 // does not yet emit cards, but recorded discipline can be consumed without
 // giving AI hypothetical knowledge or editing earlier actions.
 const onField=new Set(session.teams.find(t=>t.id===teamId)?.rolePlan?.assignments.map(a=>String(a.playerId))??[]);
 const ids=type=>[...new Set(session.events.filter(e=>e.type===type&&e.teamId===teamId&&onField.has(String(e.playerId))).map(e=>e.playerId))];
 return evaluateCoach({coach:{...coach,teamId},tactical:session,observations:{yellowPlayerIds:ids('yellow_card'),redPlayerIds:ids('red_card'),injuredPlayerIds:ids('injury')}});
}
export function opponentCoachReport(w){
 if(!careerCoachesEnabled(w))return null;
 const match=w.fixtures?.[w.round]?.matches?.find(m=>m.home===w.clubId||m.away===w.clubId);
 if(!match)return null;
 const opponentId=match.home===w.clubId?match.away:match.home;
 const coach=careerCoach(w,opponentId);if(!coach)return null;
 const club=w.teams.find(t=>t.id===opponentId);
 const history=w.fixtures.slice(0,w.round).flatMap(f=>f.matches).filter(m=>m.result&&(m.home===opponentId||m.away===opponentId));
 const recorded=history.map(m=>m.result?.advancedV1?.coachPreparation?.find(p=>p.teamId===opponentId)).filter(Boolean);
 const recent=recorded.slice(-5);
 const styles=recent.map(p=>p.style);
 const formations=recent.map(p=>p.formation);
 const frequent=a=>Object.entries(a.reduce((x,k)=>(x[k]=(x[k]??0)+1,x),{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;
 const evidence=recent.length;
 // The report never exposes any unplayed coach configuration or exact AI ratings.
 const coverage=scoutingEnabled(w)?w.advancedV1.scoutingV1.coverage[w.countryId]??0:0;
 const confidence=Math.min(85,Math.max(0,evidence*13+coverage*3));
 return {club:club?.name??'',coachName:coach.name,played:history.length,observed:evidence,confidence,
  suspectedStyle:evidence>=2?frequent(styles):null,suspectedFormation:evidence>=2?frequent(formations):null,
  warning:evidence<2?'insufficient':'inferred'};
}
export function validateCareerCoaches(w){
 const s=w?.advancedV1?.coachesV1;
 if(s===undefined)return true;
 if(s?.schemaVersion!==1||s.enabled!==true||!s.coaches||typeof s.coaches!=='object'||Array.isArray(s.coaches))return false;
 try{
  const present=new Set(teams(w).map(c=>key(c.countryId,c.id)));
  if(Object.keys(s.coaches).length>1000)return false;
  for(const [k,coach] of Object.entries(s.coaches)){
   if(!present.has(k)||coach.teamId!==k||coach.id!==`coach:${k}`||!validateCoach(coach))return false;
  }
  if(!Object.values(s.coaches).length)return false;
  // A world activated after coaches may add clubs lazily in future; existing
  // domestic coaches remain authoritative and cannot be silently rewritten.
  const domestic=w.teams;
  if(domestic.some(c=>!s.coaches[key(w.countryId,c.id)]))return false;
  for(const f of w.fixtures??[])for(const m of f.matches??[]){
   const a=m.result?.advancedV1;if(!a)continue;
   if(a.coachPreparation!==undefined){
    if(!Array.isArray(a.coachPreparation)||a.coachPreparation.length>2)return false;
    for(const p of a.coachPreparation)if(![m.home,m.away].includes(p.teamId)||!Object.hasOwn(FORMATIONS,p.formation)||!Object.hasOwn(BUILT_IN_STYLES,p.style)||typeof p.coachId!=='string'||p.coachId!==`coach:${key(w.countryId,p.teamId)}`)return false;
   }
   if(a.coachDecisions!==undefined){
    if(!Array.isArray(a.coachDecisions)||a.coachDecisions.length>12)return false;
    for(const d of a.coachDecisions)if(![m.home,m.away].includes(d.teamId)||![45,60,75].includes(d.minute)||!['tactics'].includes(d.type)||typeof d.reason!=='string'||!['inPossession','outOfPossession','transition'].includes(d.phase)||!d.patch||typeof d.patch!=='object'||Array.isArray(d.patch)||Object.keys(d.patch).length===0||Object.entries(d.patch).some(([k,v])=>!TACTIC_FIELDS[d.phase].includes(k)||!Number.isInteger(v)||v<0||v>100))return false;
   }
  }
  return true;
 }catch{return false;}
}
