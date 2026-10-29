/* Configurable tournament rules: pure validation and normalization, browser + Node. */
((root,factory)=>{const api=factory(()=>root.faWorldCalendarModel||(typeof module!=="undefined"&&module.exports?require("./world-calendar-model.js"):null));root.faCompetitionRules=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(typeof window!=="undefined"?window:globalThis,getCalendarModel=>{
"use strict";
const isObject=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const clone=x=>JSON.parse(JSON.stringify(x));
const freeze=x=>{if(x&&typeof x==="object"&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
const tieBreakers=new Set(["points","headToHeadPointsReapply","headToHeadGoalDifferenceReapply","headToHeadGoalsForReapply","goalDifference","goalsFor","wins","reproducibleDraw","awayGoals","awayWins","opponentsPoints","opponentsGoalDifference","opponentsGoalsFor","compositeClubId"]);
const outcomes=new Set(["champion","remain","relegated","playout","promoted","promotionPlayoffs","quarterfinals","knockouts","eliminated"]);
const policies=new Set(["none","int24ChampionAwareV1"]),drawPolicies=new Set(["int24SixOpponentsV1"]);
const homePolicies=new Set(["higherOriginalTableRank","neutral"]),resolutions=new Set(["aggregateExtraTimePenalties","singleExtraTimePenalties"]);
const calendarEvent=(event,category)=>category==="international"?/^(I0[1-9]|I1[0-2]|SOVEREIGN-FINAL|FEDERATION-FINAL)$/.test(event):/^N(0[1-9]|[12][0-9]|3[0-3])$/.test(event);
function withCalendarBindings(input){
 if(!isObject(input)||!Array.isArray(input.rules?.phases)||!['domestic-top-v1','domestic-second-v1'].includes(input.rules.version)||input.capacity!==16)return input;
 const missing=input.rules.phases.some(p=>isObject(p)&&!Object.hasOwn(p,'calendarEvents'));
 if(!missing)return input;
 const calendar=getCalendarModel();
 if(!calendar?.domesticPhaseMarkers)return input;
 return {...input,rules:{...input.rules,phases:input.rules.phases.map(p=>{
  if(!isObject(p)||Object.hasOwn(p,'calendarEvents'))return p;
  try{const {id,type,labelKey,...rest}=p;return {id,type,labelKey,calendarEvents:calendar.domesticPhaseMarkers(input.id,id),...rest}}catch{return p}
 })}};
}
function validateCompetition(input){
input=withCalendarBindings(input);
const errors=[],err=(path,message)=>errors.push({path,message});
if(!isObject(input))return {valid:false,errors:[{path:"",message:"Expected competition object"}]};
const {id,capacity,rules}=input;
if(typeof id!=="string"||!id)err("id","Expected nonempty ID");
if(!integer(capacity)||capacity<2||capacity%2)err("capacity","Expected even participant count >= 2");
const category=input.category|| (input.countryId?"domestic":null);
if(!["domestic","international"].includes(category))err("category","Unsupported category");
if(!isObject(rules))return {valid:false,errors:[...errors,{path:"rules",message:"Missing rules object"}]};
if(rules.schemaVersion!==1)err("rules.schemaVersion","Unsupported schema version");
if(typeof rules.version!=="string"||!rules.version)err("rules.version","Missing immutable rules version");
if(!policies.has(rules.qualificationPolicyId))err("rules.qualificationPolicyId","Unsupported policy");
if(!Array.isArray(rules.awards)||rules.awards.some(x=>typeof x!=="string"||!x))err("rules.awards","Invalid awards");
if(!Array.isArray(rules.phases)||!rules.phases.length)return {valid:false,errors:[...errors,{path:"rules.phases",message:"Expected nonempty phases"}]};
const phases=new Map(),ties=new Map(),allEvents=new Set();
rules.phases.forEach((p,i)=>{const path="rules.phases["+i+"]";if(!isObject(p)){err(path,"Expected phase");return}
if(typeof p.id!=="string"||!p.id||phases.has(p.id))err(path+".id","Duplicate or missing phase ID");else phases.set(p.id,i);
if(!["roundRobin","leaguePhase","knockout"].includes(p.type))err(path+".type","Unsupported phase type");
if(typeof p.labelKey!=="string"||!p.labelKey)err(path+".labelKey","Missing label key");
if(!Array.isArray(p.calendarEvents)||!p.calendarEvents.length)err(path+".calendarEvents","Missing calendar events");else for(const e of p.calendarEvents){if(typeof e!=="string"||!calendarEvent(e,category))err(path+".calendarEvents","Invalid calendar event "+e);if(allEvents.has(e))err(path+".calendarEvents","Duplicate calendar event "+e);allEvents.add(e)}
if(p.type==="roundRobin"||p.type==="leaguePhase"){
if(p.type==="roundRobin"&&(!integer(p.meetingsPerPair)||p.meetingsPerPair<1))err(path+".meetingsPerPair","Invalid meeting count");
if(p.type==="leaguePhase"){if(!integer(p.rounds)||!integer(p.matchesPerClub)||!integer(p.homeMatchesPerClub)||!integer(p.awayMatchesPerClub)||p.rounds!==p.matchesPerClub||p.homeMatchesPerClub+p.awayMatchesPerClub!==p.matchesPerClub||!drawPolicies.has(p.drawPolicyId))err(path,"Invalid league phase schedule/draw policy")}
if(!isObject(p.points)||["win","draw","loss"].some(k=>!integer(p.points[k])))err(path+".points","Points must be nonnegative integers");
if(!Array.isArray(p.tiebreakers)||!p.tiebreakers.length||p.tiebreakers.some(k=>!tieBreakers.has(k))||new Set(p.tiebreakers).size!==p.tiebreakers.length)err(path+".tiebreakers","Unsupported or duplicate tiebreaker");
if(!Array.isArray(p.rankOutcomes))err(path+".rankOutcomes","Missing rank outcomes");else {let positions=new Set();p.rankOutcomes.forEach((o,j)=>{const op=path+".rankOutcomes["+j+"]";if(!isObject(o)||!integer(o.from)||!integer(o.to)||o.from<1||o.to<o.from||o.to>capacity||!outcomes.has(o.kind)){err(op,"Invalid outcome range/kind");return}for(let k=o.from;k<=o.to;k++){if(positions.has(k))err(op,"Overlapping rank "+k);positions.add(k)}});if(positions.size!==capacity)err(path+".rankOutcomes","Incomplete rank coverage")}
if(p.type==="roundRobin"&&(!Array.isArray(p.calendarEvents)||p.calendarEvents.length!==(capacity-1)*p.meetingsPerPair))err(path+".calendarEvents","Round-robin rounds do not match capacity");if(p.type==="leaguePhase"&&(!Array.isArray(p.calendarEvents)||p.calendarEvents.length!==p.rounds||capacity*p.matchesPerClub%2))err(path+".calendarEvents","League phase rounds incompatible with participants");
}else if(p.type==="knockout"){if(!Array.isArray(p.ties)||!p.ties.length)err(path+".ties","Missing ties");else p.ties.forEach((t,j)=>{const tp=path+".ties["+j+"]";if(!isObject(t)||typeof t.id!=="string"||!t.id||ties.has(t.id)){err(tp+".id","Duplicate/missing tie ID");return}ties.set(t.id,{phase:i,index:j});for(const field of ["winnerOutcome","loserOutcome"])if(t[field]!==undefined&&!outcomes.has(t[field]))err(tp+"."+field,"Unsupported tie outcome");if(![1,2].includes(t.legs)||!homePolicies.has(t.homePolicy)||!resolutions.has(t.resolution)||!Array.isArray(t.participants)||t.participants.length!==2)err(tp,"Invalid knockout structure");if(t.legs===1&&t.resolution!=="singleExtraTimePenalties"||t.legs===2&&t.resolution!=="aggregateExtraTimePenalties")err(tp+".resolution","Resolution incompatible with legs")});}
});
rules.phases.forEach((p,i)=>{if(!isObject(p))return;const path="rules.phases["+i+"]";
if(Array.isArray(p.rankOutcomes))p.rankOutcomes.forEach((o,j)=>{if(o.targetPhaseId!==undefined&&(!phases.has(o.targetPhaseId)||phases.get(o.targetPhaseId)<=i))err(path+".rankOutcomes["+j+"].targetPhaseId","Target must be a later phase")});
if(p.type==="knockout"&&Array.isArray(p.ties)){p.ties.forEach((t,j)=>{if(!isObject(t)||!Array.isArray(t.participants))return;t.participants.forEach((ref,k)=>{const rp=path+".ties["+j+"].participants["+k+"]";if(!isObject(ref)){err(rp,"Expected participant reference");return}if(typeof ref.tieId==="string"){const src=ties.get(ref.tieId);if(!src||src.phase>i||src.phase===i&&src.index>=j)err(rp,"Unknown, later or cyclic tie");}else if(typeof ref.phaseId==="string"){const phaseIndex=phases.get(ref.phaseId);const target=rules.phases[phaseIndex];if(phaseIndex===undefined||phaseIndex>=i||!target||!["roundRobin","leaguePhase"].includes(target.type)||!integer(ref.rank)||ref.rank<1||ref.rank>capacity)err(rp,"Invalid ranked participant reference")}else err(rp,"Unknown participant reference")})})}
});
if(category==="international"){
  const expectedFinal=id==="int-1"?"SOVEREIGN-FINAL":id==="int-2"?"FEDERATION-FINAL":null;
  if(!expectedFinal)err("id","Unsupported international competition identity");
  if(capacity!==24)err("capacity","INT-24 requires 24 participants");
  const finalPhase=rules.phases.find(p=>p&&p.id==="final");
  if(!finalPhase||finalPhase.type!=="knockout"||!Array.isArray(finalPhase.calendarEvents)||finalPhase.calendarEvents.length!==1||finalPhase.calendarEvents[0]!==expectedFinal)err("rules.phases.final.calendarEvents","Final must use its canonical cup event");
  for(const p of rules.phases){if(!isObject(p)||!Array.isArray(p.calendarEvents))continue;
    for(const event of p.calendarEvents)if((event==="SOVEREIGN-FINAL"||event==="FEDERATION-FINAL")&&event!==expectedFinal)err("rules.phases."+p.id+".calendarEvents","Other cup's final is forbidden");
  }
}
return {valid:errors.length===0,errors};
}
function phaseMetrics(definition,phaseId){const p=definition.rules.phases.find(p=>p.id===phaseId);if(!p)return null;const n=definition.capacity;if(p.type==="roundRobin"){const rounds=(n-1)*p.meetingsPerPair;return freeze({rounds,matchesPerRound:n/2,matches:rounds*n/2})}if(p.type==="leaguePhase")return freeze({rounds:p.rounds,matchesPerRound:n/2,matches:n*p.matchesPerClub/2});return freeze({rounds:p.calendarEvents.length,matchesPerRound:null,matches:p.ties.reduce((a,t)=>a+t.legs,0)})}
function normalizeCompetition(record){const check=validateCompetition(record);if(!check.valid)throw new TypeError(check.errors.map(x=>x.path+": "+x.message).join("; "));const value=clone(withCalendarBindings(record));value.category=value.category||(value.countryId?"domestic":"international");value.slug=value.slug||String(value.id).toLowerCase();const phaseTotals={};let totalMatches=0;for(const p of value.rules.phases){const m=phaseMetrics(value,p.id);phaseTotals[p.id]=m;totalMatches+=m.matches}value.metrics={phases:phaseTotals,totalMatches};value.capabilities={phaseIds:value.rules.phases.map(p=>p.id),awardIds:[...value.rules.awards]};return freeze(value)}
function outcomeAt(definition,phaseId,rank){const phase=definition.rules.phases.find(p=>p.id===phaseId);return phase&&Array.isArray(phase.rankOutcomes)?phase.rankOutcomes.find(x=>rank>=x.from&&rank<=x.to)||null:null}
const clubKey=club=>club&&typeof club.countryId==='string'&&Number.isInteger(club.clubId)?club.countryId+'-'+club.clubId:null;
const tableClub=row=>row?.club||row;
function fixtureChoices(definition){
 const choices=[];
 for(const phase of definition.rules.phases){
  if(phase.type!=='knockout'){
   for(let round=1;round<=phaseMetrics(definition,phase.id).rounds;round++)choices.push({value:round,phaseId:phase.id,round,labelKey:'fixturesMatchday',labelParams:{round}});
  }else if(definition.category==='domestic'){
   if(!choices.some(c=>typeof c.value==='string'))choices.push({value:phase.labelKey==='playout'?'playout':'playoffs',phaseId:phase.id,round:null,labelKey:phase.labelKey,labelParams:{}});
  }else for(let leg=1;leg<=Math.max(...phase.ties.map(t=>t.legs));leg++)choices.push({value:phase.id+':'+leg,phaseId:phase.id,round:leg,labelKey:phase.labelKey,labelParams:{leg}});
 }
 return freeze(choices);
}
function findTie(definition,id){const tie=definition.rules.phases.flatMap(p=>p.ties||[]).find(t=>t.id===id);if(!tie)throw Error('Unknown configured tie');return tie}
function tieParticipants(definition,tieId,table,completedTies=[]){
 if(!Array.isArray(table)||!Array.isArray(completedTies))throw Error('Invalid tie participants');
 const tie=findTie(definition,tieId),lookup=new Map(table.map(row=>[clubKey(tableClub(row)),tableClub(row)]));
 if(lookup.has(null)||lookup.size!==table.length)throw Error('Invalid participant identity');
 return tie.participants.map(ref=>{
  if(!ref.tieId)return tableClub(table[ref.rank-1])||null;
  const records=completedTies.filter(t=>(t.id||t.tieId)===ref.tieId);
  if(records.length>1)throw Error('Duplicate completed tie');
  const result=records[0];if(result?.winnerId==null)return null;
  const source=tieParticipants(definition,ref.tieId,table,completedTies);
  const winner=source.find(club=>club&&(clubKey(club)===result.winnerId||definition.category==='domestic'&&club.clubId===result.winnerId));
  if(!winner||!lookup.has(clubKey(winner)))throw Error('Invalid completed tie winner participant');
  return winner;
 });
}
// Return home/away order for the first leg. Return legs reverse it; ranks never transfer after an upset.
function homeOrder(definition,tieId,clubs,originalTable){
 const tie=findTie(definition,tieId);
 if(!Array.isArray(clubs)||clubs.length!==2)throw Error('Invalid tie clubs');
 if(tie.homePolicy==='neutral'||clubs.some(c=>c===null))return [...clubs];
 const rank=club=>originalTable.findIndex(row=>clubKey(tableClub(row))===clubKey(club));
 if(clubs.some(club=>rank(club)<0))throw Error('Unknown original participant rank');
 const ordered=[...clubs].sort((a,b)=>rank(a)-rank(b));return tie.legs===2?ordered.reverse():ordered;
}
const outcomeStyle=kind=>kind==='promotionPlayoffs'||kind==='knockouts'?'playoff':kind==='remain'||kind==='eliminated'?'':kind||'';
function currentFixtureChoice(definition,calendar,snapshot){
 const current=snapshot?.current;
 if(!current||current.season!==calendar.season||!Number.isInteger(current.day)||current.day<1||current.day>56)return null;
 for(const day of calendar.days.filter(day=>day.day>current.day))for(const event of day.events){
  if(!event.competitionIds.includes(definition.id))continue;
  const phase=definition.rules.phases.find(p=>p.calendarEvents.includes(event.marker));if(!phase)continue;
  if(phase.type!=='knockout')return phase.calendarEvents.indexOf(event.marker)+1;
  if(definition.category==='domestic')return fixtureChoices(definition).find(c=>typeof c.value==='string')?.value||null;
  return phase.id+':'+(phase.calendarEvents.indexOf(event.marker)+1);
 }
 return null;
}
return freeze({validateCompetition,normalizeCompetition,phaseMetrics,outcomeAt,fixtureChoices,tieParticipants,homeOrder,clubKey,outcomeStyle,currentFixtureChoice});
});
