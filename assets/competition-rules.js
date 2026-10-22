/* Configurable tournament rules: pure validation and normalization, browser + Node. */
((root,factory)=>{const api=factory();root.faCompetitionRules=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;})(typeof window!=="undefined"?window:globalThis,()=>{
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
function validateCompetition(input){
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
if(p.type==="roundRobin"&&p.calendarEvents.length!==(capacity-1)*p.meetingsPerPair)err(path+".calendarEvents","Round-robin rounds do not match capacity");if(p.type==="leaguePhase"&&(p.calendarEvents.length!==p.rounds||capacity*p.matchesPerClub%2))err(path+".calendarEvents","League phase rounds incompatible with participants");
}else if(p.type==="knockout"){if(!Array.isArray(p.ties)||!p.ties.length)err(path+".ties","Missing ties");else p.ties.forEach((t,j)=>{const tp=path+".ties["+j+"]";if(!isObject(t)||typeof t.id!=="string"||!t.id||ties.has(t.id)){err(tp+".id","Duplicate/missing tie ID");return}ties.set(t.id,{phase:i,index:j});if(![1,2].includes(t.legs)||!homePolicies.has(t.homePolicy)||!resolutions.has(t.resolution)||!Array.isArray(t.participants)||t.participants.length!==2)err(tp,"Invalid knockout structure");if(t.legs===1&&t.resolution!=="singleExtraTimePenalties"||t.legs===2&&t.resolution!=="aggregateExtraTimePenalties")err(tp+".resolution","Resolution incompatible with legs")});}
});
rules.phases.forEach((p,i)=>{if(!isObject(p))return;const path="rules.phases["+i+"]";
if(Array.isArray(p.rankOutcomes))p.rankOutcomes.forEach((o,j)=>{if(o.targetPhaseId!==undefined&&(!phases.has(o.targetPhaseId)||phases.get(o.targetPhaseId)<=i))err(path+".rankOutcomes["+j+"].targetPhaseId","Target must be a later phase")});
if(p.type==="knockout"&&Array.isArray(p.ties)){p.ties.forEach((t,j)=>{if(!isObject(t)||!Array.isArray(t.participants))return;t.participants.forEach((ref,k)=>{const rp=path+".ties["+j+"].participants["+k+"]";if(!isObject(ref)){err(rp,"Expected participant reference");return}if(typeof ref.tieId==="string"){const src=ties.get(ref.tieId);if(!src||src.phase>i||src.phase===i&&src.index>=j)err(rp,"Unknown, later or cyclic tie");}else if(typeof ref.phaseId==="string"){const phaseIndex=phases.get(ref.phaseId);const target=rules.phases[phaseIndex];if(phaseIndex===undefined||phaseIndex>=i||!target||!["roundRobin","leaguePhase"].includes(target.type)||!integer(ref.rank)||ref.rank<1||ref.rank>capacity)err(rp,"Invalid ranked participant reference")}else err(rp,"Unknown participant reference")})})}
});
if(category==="international"){
  const expectedFinal=id==="sovereign-cup"?"SOVEREIGN-FINAL":id==="federation-cup"?"FEDERATION-FINAL":null;
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
function normalizeCompetition(record){const check=validateCompetition(record);if(!check.valid)throw new TypeError(check.errors.map(x=>x.path+": "+x.message).join("; "));const value=clone(record);value.category=value.category||(value.countryId?"domestic":"international");value.slug=value.slug||String(value.id).toLowerCase();const phaseTotals={};let totalMatches=0;for(const p of value.rules.phases){const m=phaseMetrics(value,p.id);phaseTotals[p.id]=m;totalMatches+=m.matches}value.metrics={phases:phaseTotals,totalMatches};value.capabilities={phaseIds:value.rules.phases.map(p=>p.id),awardIds:[...value.rules.awards]};return freeze(value)}
function outcomeAt(definition,phaseId,rank){const phase=definition.rules.phases.find(p=>p.id===phaseId);return phase&&Array.isArray(phase.rankOutcomes)?phase.rankOutcomes.find(x=>rank>=x.from&&rank<=x.to)||null:null}
return freeze({validateCompetition,normalizeCompetition,phaseMetrics,outcomeAt});
});
