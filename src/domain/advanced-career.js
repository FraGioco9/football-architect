/** Optional authoritative advanced mode for the actual career. The v1 engine is untouched
 * until the player explicitly enables this mode. No historical fixture is regenerated.
 */
import {validateCareerWorld} from './career-world.js';
import {validateCareerPersonality,personalityMatchMultiplier} from './career-personality.js';
import {validateCareerContracts} from './career-contracts.js';
import {validateCareerMarket} from './career-market.js';
import {validateCareerCalendar} from './career-calendar.js';
import {validateCareerScouting} from './career-scouting.js';
import {validateCareerAIMarket} from './career-ai-market.js';
import {validateCareerCups} from './career-cups.js';
import {validateCareerContinental} from './career-continental.js';
import {validateCareerDivisions} from './career-divisions.js';
import {validateCareerBoard} from './career-board.js';
import {validateManagerCareer} from './career-manager.js';
import {validateCareerFinance} from './career-finance.js';
import {validateCareerFacilities,facilityImpact} from './career-facilities.js';
import {careerTacticsEnabled,validateCareerTactics,clearCareerTacticPlans} from './career-tactics.js';
import {careerRolesEnabled,careerSlotRole,assessCareerSlotRole,buildAIRolePlan,validateCareerRoles} from './career-roles.js';
import {careerCoachesEnabled,prepareCoachTeam,coachTacticalDecision,validateCareerCoaches} from './career-coaches.js';
import {careerStatisticsEnabled,recordCareerStatistics,validateCareerStatistics} from './career-statistics.js';
import {FORMATIONS,clamp} from './rules.js';
import {substitutionsEnabled,validateCareerMatchday,careerMatchdayBench,matchKind} from './career-matchday.js';
import {createMatchSheet,createMatchday,advanceMatchday,applySubstitution,finishMatchday,matchAppearances} from '../addons/domain/matchday.mjs';
import {hasCareerTraining,validateCareerTraining,settleCareerTrainingDay,recordCareerMinutes,syncCareerTrainingRole} from './career-training.js';
import {validateCareerYouth} from './career-youth.js';
import {formationSlots} from './lineups.js';
import {clubPlayers,playerById} from './selectors.js';
import {scopedSeed} from './rng.js';
import {toAddonPosition} from '../addons/career-bridge.mjs';
import {copyPlayerWithAttributes,readPlayerAttributes} from '../addons/domain/player-generator.mjs';
import {ratePlayer} from '../addons/domain/player-ratings.mjs';
import {createRolePlan} from '../addons/domain/player-role-plan.mjs';
import {assessRoleFit} from '../addons/domain/player-role-fit.mjs';
import {validateRoleChoice,defaultRole} from '../addons/domain/player-roles.mjs';
import {BUILT_IN_STYLES,createTactics,validateTactics,replaceTacticalPhase} from '../addons/domain/team-tactics.mjs';
import {createTacticalSession,advanceTacticalSession,finishTacticalSession,summarizeTacticalSession,replaceAllTacticalInstructions,changeTacticalInstructions} from '../addons/domain/team-tactics-match.mjs';
import {initialMedical,startInjury,resolveLegacyAbsence,readMedical,recoverMedical,medicalAvailability,medicalMatchLoad,evaluateInjuryRisk,validateMedical} from '../addons/domain/player-medical.mjs';

export const ADVANCED_SCHEMA=1;
const invalid=code=>{throw Error(`ADVANCED_${code}`)};
const active=w=>w?.advancedV1?.schemaVersion===ADVANCED_SCHEMA&&w.advancedV1.enabled===true;
export const hasAdvancedCareer=active;
export function enableAdvancedCareer(w){
  if(!w||!Number.isSafeInteger(w.seed)||!w.clubId||!Array.isArray(w.players)||!Array.isArray(w.fixtures))invalid('WORLD');
  if(active(w))return w;
  if(w.advancedV1!==undefined)invalid('UNKNOWN_MODE');
  const prepared=w.players.map(p=>{
    const attr=copyPlayerWithAttributes({...p,position:toAddonPosition(p.position)},{seed:w.seed,countryId:w.countryId}).attributeProfile;
    const med=initialMedical({...p,unavailable:p.injury>0},{day:Number.isSafeInteger(w.careerDay)?w.careerDay:0});
    return {attributeProfile:attr,medicalV1:med};
  });
  // Allocate first, mutate only after every player and tactic has validated.
  const state={schemaVersion:ADVANCED_SCHEMA,enabled:true,clockDay:Number.isSafeInteger(w.careerDay)?w.careerDay:0,style:'balanced',tactics:structuredClone(BUILT_IN_STYLES.balanced),roles:{},legacyInjuryRounds:Object.fromEntries(w.players.filter(p=>p.injury>0).map(p=>[p.id,p.injury])),matchCount:0};
  for(let i=0;i<w.players.length;i++)Object.assign(w.players[i],prepared[i]);
  w.advancedV1=state;
  return w;
}
export function setAdvancedStyle(w,style){
  if(!active(w)||!Object.hasOwn(BUILT_IN_STYLES,style))invalid('STYLE');
  w.advancedV1.style=style;w.advancedV1.tactics=structuredClone(BUILT_IN_STYLES[style]);
  return w.advancedV1.tactics;
}
export function editAdvancedTactic(w,phase,field,value){
  if(!active(w))invalid('INACTIVE');
  const before=w.advancedV1.tactics;
  if(!Object.hasOwn(before,phase)||!Object.hasOwn(before[phase],field))invalid('FIELD');
  const next=replaceTacticalPhase(before,phase,{[field]:value});
  w.advancedV1.tactics=next;w.advancedV1.style='custom';return next;
}
export function setAdvancedPlayerRole(w,playerId,role,duty){
  if(!active(w))invalid('INACTIVE');
  const player=playerById(w,playerId);
  if(!player||player.clubId!==w.clubId||!w.lineup.includes(player.id))invalid('PLAYER');
  const position=toAddonPosition(FORMATIONS[w.formation][w.lineup.indexOf(player.id)].p);
  validateRoleChoice(position,role,duty);
  if(hasCareerTraining(w))syncCareerTrainingRole(w,player.id,role);
  w.advancedV1.roles[String(player.id)]={role,duty};
}
export function validateAdvancedCareer(w){
  if(!active(w))return w?.advancedV1===undefined;
  const a=w.advancedV1;
  if(!Number.isSafeInteger(a.clockDay)||a.clockDay<0||!Number.isSafeInteger(a.matchCount)||a.matchCount<0 || !a.roles||typeof a.roles!=='object'||Array.isArray(a.roles))return false;
  try{
    validateTactics(a.tactics);
    const ids=new Set();
    for(const p of w.players){
      if(ids.has(p.id))return false;ids.add(p.id);
      if(!p.attributeProfile)return false;
      readPlayerAttributes({...p,position:toAddonPosition(p.position)});
      if(!p.medicalV1||!validateMedical(p.medicalV1)||String(p.medicalV1.playerId)!==String(p.id)||p.medicalV1.lastDay!==a.clockDay)return false;
    }
    for(const [id,choice] of Object.entries(a.roles))if(!ids.has(Number(id))||typeof choice?.role!=='string'||typeof choice?.duty!=='string')return false;
    for(const [id,rounds] of Object.entries(a.legacyInjuryRounds))if(!ids.has(Number(id))||!Number.isSafeInteger(rounds)||rounds<1||rounds>365)return false;
  }catch{return false;}
  return validateCareerStatistics(w)&&validateCareerCoaches(w)&&validateCareerRoles(w)&&validateCareerTactics(w)&&validateCareerMatchday(w)&&validateCareerContracts(w)&&validateCareerPersonality(w)&&validateCareerTraining(w)&&validateCareerYouth(w)&&validateCareerWorld(w)&&validateCareerMarket(w)&&validateCareerCalendar(w)&&validateCareerScouting(w)&&validateCareerAIMarket(w)&&validateCareerCups(w)&&validateCareerContinental(w)&&validateCareerDivisions(w)&&validateCareerBoard(w)&&validateManagerCareer(w)&&validateCareerFinance(w)&&validateCareerFacilities(w);
}
/** Advance medical/training state by exactly one real calendar day. */
export function advanceAdvancedDay(w){
  if(!active(w))invalid('INACTIVE');
  const day=w.advancedV1.clockDay+1;
  if(hasCareerTraining(w)){
    const updates=w.players.filter(p=>p.clubId!==w.clubId).map(p=>({id:p.id,
      med:recoverMedical(readMedical(p),{day,rest:65,training:24,recovery:p.attributeProfile.values.recovery??50})}));
    w.advancedV1.clockDay=day;
    settleCareerTrainingDay(w,day);
    for(const {id,med} of updates){const p=playerById(w,id);
      p.medicalV1=trimMedicalForSave(med);
      p.fitness=Math.round(med.freshness);
      p.injury=w.advancedV1.legacyInjuryRounds[String(p.id)]??(med.injury?.stage==='recovering'?Math.max(1,Math.ceil(med.injury.daysRemaining/7)):0);
    }
    return day;
  }
  const updates=w.players.map(p=>recoverMedical(readMedical(p),{day,rest:65,training:24,recovery:p.attributeProfile.values.recovery??50}));
  w.advancedV1.clockDay=day;
  for(let i=0;i<w.players.length;i++){
    const p=w.players[i],med=updates[i];p.medicalV1=trimMedicalForSave(med);
    p.fitness=Math.round(med.freshness);p.injury=w.advancedV1.legacyInjuryRounds[String(p.id)]??(med.injury?.stage==='recovering'?Math.max(1,Math.ceil(med.injury.daysRemaining/7)):0);
  }
  return day;
}

/** Compatibility path for callers that still advance a whole match week. */
export function prepareAdvancedRound(w,{days=7}={}){
  if(!active(w)||!Number.isSafeInteger(days)||days<0||days>120)invalid('DAY_SPAN');
  for(let i=0;i<days;i++)advanceAdvancedDay(w);
}
export function settleAdvancedLegacyAbsences(w){
 if(!active(w))return;
 for(const [id,remaining] of Object.entries(w.advancedV1.legacyInjuryRounds)){
   const player=playerById(w,Number(id)),next=remaining-1;
   if(next===0){player.medicalV1=trimMedicalForSave(resolveLegacyAbsence(player.medicalV1,{day:w.advancedV1.clockDay,cleared:true}));player.injury=0;delete w.advancedV1.legacyInjuryRounds[id];}
   else {player.injury=next;w.advancedV1.legacyInjuryRounds[id]=next;}
 }
}
const getSeed=(w,m)=>scopedSeed(w.seed,'advanced-match',w.season,w.countryId,m.id);
/** Keep only a compact, chronological highlight reel in the authoritative
 * career save. The final score, scorers, xG and fitness are always computed
 * from ALL events before this selection. Full event sequences can be replayed
 * deterministically from the stored seed with the simulator; they must not
 * multiply on-device checkpoint space across a 38-round season. */
function matchHighlights(events,limit=6){
  const goals=events.filter(e=>e.type==='goal');
  const cards=events.filter(e=>e.type==='yellow_card'||e.type==='red_card');
  const essential=[...goals,...cards];
  const shots=events.filter(e=>e.type==='shot')
    .sort((a,b)=>(b.xg??0)-(a.xg??0)||a.second-b.second);
  const space=Math.max(0,limit-essential.length),shotCount=Math.ceil(space*0.65);
  const choices=essential.length>=limit?essential:[...essential,...shots.slice(0,shotCount),
    ...events.filter(e=>e.type==='recovery').slice(0,Math.max(0,space-shotCount))];
  return choices.sort((a,b)=>a.second-b.second);
}
function trimMedicalForSave(record){
  // Full current injury, fatigue/overload and recent loadHistory survive.
  // The much longer per-player event/id history is not needed to compute the
  // next week; historical injuries remain in the official match report.
  record.events=record.events.slice(-1);
  record.processedMatchIds=record.processedMatchIds.slice(-2);
  return record;
}
const top11=(w,teamId,opponentId=null)=>{
  const prep=careerCoachesEnabled(w)&&teamId!==w.clubId?prepareCoachTeam(w,teamId,opponentId):null;
  const ids=prep?.ids??formationSlots(w,teamId),formation=prep?.formation??(teamId===w.clubId?w.formation:'4-3-3');
  const slots=FORMATIONS[formation];
  if(ids.length!==11||new Set(ids).size!==11||ids.some(id=>!Number.isSafeInteger(id)))invalid('LINEUP');
  const assignments=ids.map((id,i)=>{
    const p=playerById(w,id);if(!p||p.clubId!==teamId||p.injury||!medicalAvailability(p.medicalV1).canStart)invalid('UNAVAILABLE');
    const position=toAddonPosition(slots[i].p),custom=teamId===w.clubId?(careerRolesEnabled(w)?careerSlotRole(w,i,formation):w.advancedV1.roles[String(id)]):null;
    const role=custom?.role??defaultRole(position),duty=custom?.duty??undefined;
    let usableRole=role,usableDuty=duty;
    try{validateRoleChoice(position,role,duty??(position==='GK'?'defend':position==='ST'||position==='LW'||position==='RW'?'attack':'support'));}
    catch{usableRole=defaultRole(position);usableDuty=undefined;}
    const familiarity=w.advancedV1.trainingV1?.playerStates[String(id)]?.familiarity;
    const formationKnown=familiarity?.formations?.[formation]??0;
    const roleKnown=familiarity?.roles?.[usableRole]??0;
    // Real MGT04 tactical sessions improve involvement/role fit, not hidden OVR.
    const fit=careerRolesEnabled(w)?assessCareerSlotRole(w,i,{player:p})?.overall:ratePlayer({...p,position},p.attributeProfile,position).derivedOvr;
    return {slotId:i+1,playerId:id,position,role:usableRole,...(usableDuty?{duty:usableDuty}:{}),fit:Math.round(clamp((fit??p.ovr)*(familiarity?.formations?(0.96+(formationKnown+roleKnown)/5000):1),1,100))};
  });
  const rolePlan=careerRolesEnabled(w)&&teamId!==w.clubId?buildAIRolePlan(formation,assignments,ids.map(id=>playerById(w,id))):createRolePlan(formation,assignments);
  return {ids,formation,rolePlan,coachPreparation:prep?{teamId,formation:prep.formation,style:prep.style,coachId:prep.coachId}:null};
};
function effectivePower(w,ids){
  const values=ids.map(id=>{const p=playerById(w,id);const derived=ratePlayer({...p,position:toAddonPosition(p.position)},p.attributeProfile).derivedOvr;
    return (p.ovr*.45+derived*.55)*(0.82+readMedical(p).freshness/100*.18);});
  return clamp(values.reduce((a,b)=>a+b,0)/values.length,20,95);
}
/** Read-only half-time simulation, seed-identical to the authoritative match.
 * No matchdays or medical events are committed until the manager confirms.
 */
export function previewAdvancedHalf(w,m){
 if(!active(w)||!substitutionsEnabled(w)||!m||m.result)invalid('HALF_PREVIEW');
 const candidate=structuredClone(w);prepareAdvancedRound(candidate);
 const home=top11(candidate,m.home,m.away),away=top11(candidate,m.away,m.home),seed=getSeed(candidate,m);
 const sides=[{teamId:m.home,...home},{teamId:m.away,...away}];
 const makeTeam=side=>({id:side.teamId,strength:effectivePower(candidate,side.ids)*personalityMatchMultiplier(candidate,side.teamId),tactics:side.teamId===candidate.clubId?candidate.advancedV1.tactics:(side.coachPreparation?BUILT_IN_STYLES[side.coachPreparation.style]:BUILT_IN_STYLES.balanced),rolePlan:side.rolePlan});
 const half=advanceTacticalSession(createTacticalSession({matchId:m.id,seed,home:makeTeam(sides[0]),away:makeTeam(sides[1]),analyticsMode:true}),90);
 return {matchId:m.id,round:w.round,home:m.home,away:m.away,
  homeGoals:half.events.filter(e=>e.type==='goal'&&e.side==='home').length,
  awayGoals:half.events.filter(e=>e.type==='goal'&&e.side==='away').length,
  minute:45};
}
/** Generates the actual competition result from the seeded tactical event stream. */
export function simulateAdvancedMatch(w,m){
  if(!active(w)||m.result)invalid('MATCH');
  const home=top11(w,m.home,m.away),away=top11(w,m.away,m.home),seed=getSeed(w,m),day=w.advancedV1.clockDay;
  const sides=[{teamId:m.home,...home},{teamId:m.away,...away}];
  const makeTeam=s=>({id:s.teamId,strength:effectivePower(w,s.ids)*personalityMatchMultiplier(w,s.teamId),tactics:s.teamId===w.clubId?w.advancedV1.tactics:(s.coachPreparation?BUILT_IN_STYLES[s.coachPreparation.style]:BUILT_IN_STYLES.balanced),rolePlan:s.rolePlan});
  let session=createTacticalSession({matchId:m.id,seed,home:makeTeam(sides[0]),away:makeTeam(sides[1]),analyticsMode:true});
  const sidesPlans=sides.map(side=>({side,bench:careerMatchdayBench(w,side.teamId,side.ids)}));
  let activeSeconds=new Map(sides.flatMap(s=>s.ids.map(id=>[id,5400])));
  const changes=[],medicalChanges=[];
  const sim04=substitutionsEnabled(w);
  let matchday=null;
  if(sim04){
    const rules=w.advancedV1.matchdayV1.rules[matchKind(m)];
    const sheets=sidesPlans.map(({side,bench})=>{
      // SIM04 validates the role occupied on the pitch, not only a player's
      // natural registry position. Project every starter to the formation
      // slot they actually occupies; bench players retain their natural role.
      // This guarantees exactly one goalkeeper slot even when a natural GK is
      // adapted outfield or an outfielder must serve as emergency goalkeeper.
      const starterPosition=new Map(side.rolePlan.assignments.map(a=>[String(a.playerId),a.position]));
      return createMatchSheet({teamId:side.teamId,
        players:clubPlayers(w,side.teamId).map(p=>({...p,
          position:starterPosition.get(String(p.id))??toAddonPosition(p.position),
          unavailable:p.injury>0||!medicalAvailability(p.medicalV1).eligible})),
        starters:side.ids,bench:bench.map(p=>p.id),
        unavailable:clubPlayers(w,side.teamId).filter(p=>p.injury>0||!medicalAvailability(p.medicalV1).eligible).map(p=>p.id),
        formation:side.rolePlan.assignments.map(x=>x.position),rules});
    });
    matchday=createMatchday({matchId:m.id,home:sheets[0],away:sheets[1],rules});
  }
  const sim02=careerTacticsEnabled(w) && (m.home===w.clubId||m.away===w.clubId);
  const tacticPlans=sim02?w.advancedV1.tacticPlannerV1.plans.filter(p=>p.matchId===m.id&&p.teamId===w.clubId):[];
  const sim05=careerCoachesEnabled(w);
  const checkpoints=sim04||tacticPlans.length||sim05?[45,60,75,90]:[45,90];
  const coachDecisions=[];
  const tacticalChanges=[];
  const doChange=(side,outgoing,incoming,minute,reason)=>{
    if(sim04){matchday=applySubstitution(matchday,{teamId:side.teamId,outgoing,incoming,second:minute*60,phase:minute===45?'half_time':'second_half',reason});}
    const assignment=side.rolePlan.assignments.find(x=>x.playerId===outgoing);
    if(!assignment)invalid('SUB_PLAYER');
    const changed=structuredClone(side.rolePlan);
    const replacement=changed.assignments.find(a=>a.slotId===assignment.slotId);
    replacement.playerId=incoming;
    if(careerRolesEnabled(w)){
      const entrant=playerById(w,incoming);
      replacement.fit=assessRoleFit({...entrant,position:toAddonPosition(entrant.position)},entrant.attributeProfile,{position:replacement.position,role:replacement.role,duty:replacement.duty??'support'}).overall;
    }
    const onField=side.ids.map(x=>x===outgoing?incoming:x);
    session=awaitSyncLineup(session,{teamId:side.teamId,rolePlan:changed,strength:effectivePower(w,onField)});
    side.ids=onField;side.rolePlan=changed;
    changes.push({teamId:side.teamId,out:outgoing,in:incoming,minute,reason});
    activeSeconds.set(outgoing,minute*60);activeSeconds.set(incoming,(90-minute)*60);
  };
  for(const minute of checkpoints){
    session=advanceTacticalSession(session,minute*2-session.cursor);
    if(minute===90)break;
    for(const plan of tacticPlans.filter(p=>p.minute===minute)){
      session=replaceAllTacticalInstructions(session,{teamId:w.clubId,tactics:plan.tactics,reason:plan.presetId});
      tacticalChanges.push({teamId:w.clubId,minute,presetId:plan.presetId,tactics:structuredClone(plan.tactics)});
    }
    // SIM05 observes only the score/fatigue/events already played, and edits
    // tactics at the current cursor. It cannot rewrite an earlier event/RNG.
    if(sim05)for(const side of sides){
      if(side.teamId===w.clubId)continue;
      const decision=coachTacticalDecision(w,session,side.teamId);
      if(!decision)continue;
      session=changeTacticalInstructions(session,{teamId:side.teamId,phase:decision.phase,patch:decision.patch});
      coachDecisions.push({type:'tactics',teamId:side.teamId,minute,reason:decision.reason,phase:decision.phase,patch:decision.patch});
    }
    if(sim04)matchday=advanceMatchday(matchday,{second:minute*60,phase:minute===45?'half_time':'second_half'});
    // Persisted human decisions take priority. They are checked transactionally.
    if(sim04&&sides.some(s=>s.teamId===w.clubId)){
      const mySide=sides.find(s=>s.teamId===w.clubId);
      for(const plan of w.advancedV1.matchdayV1.plans.filter(p=>p.matchId===m.id&&p.minute===minute)){
        const incoming=playerById(w,plan.incoming);
        if(!incoming||!mySide.ids.includes(plan.outgoing)||mySide.ids.includes(plan.incoming)||
          !careerMatchdayBench(w,w.clubId,mySide.ids).some(p=>p.id===plan.incoming)||
          medicalAvailability(incoming.medicalV1).minutesLimit<90-minute)invalid('MANUAL_PLAN_STALE');
        doChange(mySide,plan.outgoing,plan.incoming,minute,'manual');
      }
    }
    for(const side of sides){
      const squad=clubPlayers(w,side.teamId);
      const bench=squad.filter(p=>(!sim04||matchday.teams.find(t=>t.teamId===side.teamId).availableBench.includes(p.id))&&!side.ids.includes(p.id)&&!p.injury&&medicalAvailability(p.medicalV1).eligible&&
        medicalAvailability(p.medicalV1).minutesLimit>=90-minute).sort((a,b)=>b.ovr-a.ovr||a.id-b.id);
      if(!bench.length)continue;
      // Forced injury changes happen after prior minutes, never as post-hoc edits.
      if(minute===45){
        for(const slot of side.rolePlan.assignments.filter(a=>a.position!=='GK')){
          const p=playerById(w,slot.playerId);
          const risk=evaluateInjuryRisk(p.medicalV1,{matchId:m.id,minutes:45,pressing:session.teams.find(t=>t.id===side.teamId).tactics.outOfPossession.pressing,age:p.age,seed});
          if(!risk.occurred)continue;
          const incoming=bench.find(x=>x.position!=='POR');if(!incoming)break;
          doChange(side,p.id,incoming.id,45,'injury');
          p.medicalV1=startInjury(p.medicalV1,{day,kind:risk.kind,durationDays:risk.durationDays,matchId:m.id});
          medicalChanges.push({playerId:p.id,kind:risk.kind,durationDays:risk.durationDays,minute:45});break;
        }
      }
      if(sim04&&side.teamId!==w.clubId&&minute>=60){
        const count=changes.filter(c=>c.teamId===side.teamId).length;
        if(count>=matchday.rules.maxSubstitutions)continue;
        const starterRows=side.rolePlan.assignments
          .filter(a=>a.position!=='GK')
          .map(a=>({assignment:a,player:playerById(w,a.playerId)}))
          .filter(x=>x.player);
        const ownSide=side.teamId===m.home?'home':'away';
        const goals={home:0,away:0};
        for(const event of session.events)if(event.type==='goal')goals[event.side]++;
        const trailing=goals[ownSide]<goals[ownSide==='home'?'away':'home'];
        const attack=starterRows.filter(x=>['ST','LW','RW','CAM','CF'].includes(x.assignment.position));
        const candidates=trailing&&attack.length?attack:starterRows;
        const tiredRow=[...candidates].sort((a,b)=>a.player.fitness-b.player.fitness||a.player.id-b.player.id)[0];
        if(tiredRow){
          const tired=tiredRow.player,slotPosition=tiredRow.assignment.position;
          const incoming=bench.find(p=>toAddonPosition(p.position)===slotPosition&&p.ovr>=tired.ovr-15)
            ||bench.find(p=>toAddonPosition(p.position)!=='GK'&&p.ovr>=tired.ovr-15);
          if(incoming)doChange(side,tired.id,incoming.id,minute,'ai');
        }
      }
    }
  }
  session=finishTacticalSession(session);
  if(sim02)clearCareerTacticPlans(w);
  if(sim04){
    matchday=finishMatchday(matchday,{second:5400});
    activeSeconds=new Map(sides.flatMap(s=>matchAppearances(matchday,s.teamId).map(row=>[row.playerId,row.seconds])));
    if(m.home===w.clubId||m.away===w.clubId)w.advancedV1.matchdayV1.plans=[];
  }
  const summary=summarizeTacticalSession(session);
  const goals=session.events.filter(e=>e.type==='goal').map(e=>{
    const lastPass=session.events.filter(x=>x.type==='pass'&&x.side===e.side&&x.second<e.second&&x.second>=e.second-90&&x.playerId!==e.playerId).at(-1);
    return {side:e.side,minute:Math.floor(e.second/60)+1,scorerId:e.playerId,assistId:lastPass?.playerId??null};
  });
  const isMyMatch=m.home===w.clubId||m.away===w.clubId;
  const advancedV1={schemaVersion:1,seed,injuries:medicalChanges,substitutions:changes,...(tacticalChanges.length?{tacticalChanges}:{}),
    ...(sim05?{coachPreparation:sides.map(s=>s.coachPreparation).filter(Boolean),coachDecisions}:{}),
    formations:{home:sides[0].formation,away:sides[1].formation},
    cards:session.events.filter(e=>e.type==='yellow_card'||e.type==='red_card').map(e=>({type:e.type,teamId:e.teamId,playerId:e.playerId??null,minute:Math.floor(e.second/60)+1})),
    events:isMyMatch?matchHighlights(session.events):[],...(sim04?{matchday:{schemaVersion:1,changes,minutes:sides.map(side=>({teamId:side.teamId,players:matchAppearances(matchday,side.teamId)})),rules:matchday.rules}}:{})};
  if(isMyMatch){advancedV1.homeTactics=session.initialTeams[0].tactics;advancedV1.awayTactics=session.initialTeams[1].tactics;}
  const result={homeGoals:summary.home.goals,awayGoals:summary.away.goals,goals,xgHome:+summary.home.xg.toFixed(2),xgAway:+summary.away.xg.toFixed(2),possessionHome:summary.possessionPct.home,shotsHome:summary.home.shots,shotsAway:summary.away.shots,advancedV1};
  if(careerStatisticsEnabled(w)){
    // WRD03/WRD04 managed ties reuse this engine, but they are NOT league
    // fixtures. Label their reports by competition to preserve the archive
    // integrity check and prevent cup statistics contaminating league totals.
    const competitionId=m.id?.startsWith('cup:')?`cup:${w.countryId}`:
      m.id?.startsWith('continental:')?'continental:constellations':`league:${w.countryId}`;
    const reference=recordCareerStatistics(w,session,{matchday,fixture:m,competitionId});
    if(reference)advancedV1.statistics=reference;
  }
  for(const g of goals){const p=playerById(w,g.scorerId);if(p)p.goals++;const a=playerById(w,g.assistId);if(a)a.assists++;}
  const avgPressing=(teamId,from,to)=>{
    const original=session.initialTeams.find(t=>t.id===teamId).tactics;
    const changesForTeam=[...tacticalChanges.filter(c=>c.teamId===teamId).map(c=>({...c,kind:'manual'})),
      ...coachDecisions.filter(c=>c.teamId===teamId).map(c=>({...c,kind:'ai'}))].sort((a,b)=>a.minute-b.minute);
    let effective=original;
    const segments=[{second:0,pressing:original.outOfPossession.pressing}];
    for(const ch of changesForTeam){
      effective=ch.kind==='manual'?ch.tactics:{...effective,[ch.phase]:{...effective[ch.phase],...ch.patch}};
      segments.push({second:ch.minute*60,pressing:effective.outOfPossession.pressing});
    }
    let weighted=0;for(let i=0;i<segments.length;i++){const start=Math.max(from,segments[i].second),end=Math.min(to,segments[i+1]?.second??5400);if(end>start)weighted+=(end-start)*segments[i].pressing;}
    return Math.round(weighted/Math.max(1,to-from));
  };
  for(const side of sides){
    const conceded=side.teamId===m.home?summary.away.goals:summary.home.goals;
    for(const id of new Set([...side.ids,...changes.filter(c=>c.teamId===side.teamId).flatMap(c=>[c.in,c.out])])){
      const p=playerById(w,id),secs=activeSeconds.get(id)??(sim04?0:5400);
      if(secs===0)continue;
      const current=readMedical(p);
      const status=medicalMatchLoad(current,{matchId:m.id,day,seconds:secs,pressing:avgPressing(side.teamId,sim04?(matchday.teams.find(t=>t.teamId===side.teamId)?.minutesLedger.find(s=>s.playerId===id)?.from??0):0,sim04?(matchday.teams.find(t=>t.teamId===side.teamId)?.minutesLedger.find(s=>s.playerId===id)?.to??5400):5400),position:toAddonPosition(p.position),age:p.age,stamina:p.attributeProfile.values.stamina??50,recovery:p.attributeProfile.values.recovery??50,injuredThisMatch:medicalChanges.some(x=>x.playerId===id)});
      p.medicalV1=trimMedicalForSave(status);p.fitness=Math.round(status.freshness);
      p.injury=status.injury?.stage==='recovering'?Math.max(1,Math.ceil(status.injury.daysRemaining/7)):0;
      if(sim04)p.minutesPlayed=Math.round(((p.minutesPlayed??0)+secs/60)*100)/100;
      p.apps++;p.form=clamp(+(6.5+((side.teamId===m.home?result.homeGoals-result.awayGoals:result.awayGoals-result.homeGoals)*.22)).toFixed(1),4,10);
      recordCareerMinutes(w,id,secs,p.form);
      p.morale=clamp(p.morale+(side.teamId===m.home?result.homeGoals-result.awayGoals:result.awayGoals-result.homeGoals)*2,20,100);
      if(p.position==='POR'&&conceded===0&&secs===5400)p.cleanSheets++;
    }
  }
  m.result=result;w.advancedV1.matchCount++;
  return result;
}
import {synchronizeTacticalLineup} from '../addons/domain/team-tactics-match.mjs';
function awaitSyncLineup(session,args){return synchronizeTacticalLineup(session,args);}
/** Season rollover keeps persisted profiles, and the recovery clock is monotonically increasing. */
export function settleAdvancedSeason(w,{days=21}={}){
  if(!active(w))return;
  if(!Number.isSafeInteger(days)||days<0||days>180)invalid('SEASON_BREAK_DAYS');
  clearCareerTacticPlans(w);
  const day=w.advancedV1.clockDay+days;
  for(const p of w.players){p.medicalV1=trimMedicalForSave(recoverMedical(p.medicalV1,{day,rest:90,training:5,recovery:p.attributeProfile.values.recovery??50}));p.injury=p.medicalV1.injury?.stage==='recovering'?Math.max(1,Math.ceil(p.medicalV1.injury.daysRemaining/7)):0;p.fitness=Math.round(p.medicalV1.freshness);}
  w.advancedV1.clockDay=day;
  for(const id of Object.keys(w.advancedV1.legacyInjuryRounds)){const p=playerById(w,Number(id));p.medicalV1=trimMedicalForSave(resolveLegacyAbsence(p.medicalV1,{day,cleared:true}));p.injury=0;}
  w.advancedV1.legacyInjuryRounds={};
}
