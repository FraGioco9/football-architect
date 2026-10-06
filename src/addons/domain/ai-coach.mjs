/** SIM05.01: persistent, original, deterministic AI manager identity. Pure JSON. */
import {STYLE_NAMES} from './team-tactics.mjs';
import {FORMATIONS} from './matchday.mjs';
export const AI_COACH_SCHEMA = 1;
const validId = x => (typeof x==='string'&&x.trim().length>0)||(Number.isSafeInteger(x)&&x>0);
const bad = code => {throw Error('SIM05_'+code);};
const isRating = x=>Number.isInteger(x)&&x>=0&&x<=100;
const pool = Object.freeze({
 IT:[['Elio','Neri'],['Matteo','Valenti'],['Nicola','Sereni'],['Luca','Ferrari']],
 ENG:[['Oliver','Weston'],['Harvey','Marlow'],['Lewis','Bennett'],['Ethan','Mills']],
 ESP:[['Adrián','Solera'],['Mateo','Robledo'],['Álvaro','Vidal']],
 GER:[['Jonas','Weber'],['Timo','Brandt'],['Felix','Seidel']],
 FRA:[['Luc','Mercier'],['Noé','Laurent'],['Hugo','Giraud']],
 POR:[['Tiago','Almeida'],['Rui','Figueira'],['André','Ramos']],
 NED:[['Bram','Visser'],['Daan','Kramer'],['Sven','Mulder']],
 BRA:[['Caio','Lima'],['André','Barreto'],['Rafael','Monteiro']],
});
/** Stable 32-bit mix, no call to the match RNG. */
export function coachHash(...values){
 let hash=2166136261;
 for(const c of values.map(String).join('|')){hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;}
 return hash>>>0;
}
export function validateCoach(coach){
 if(!coach||typeof coach!=='object'||Array.isArray(coach)||coach.schemaVersion!==AI_COACH_SCHEMA)bad('COACH_SCHEMA');
 if(!validId(coach.id)||!validId(coach.teamId)||typeof coach.name!=='string'||!coach.name.trim()||coach.name.length>100)bad('COACH_IDENTITY');
 if(!(coach.preferredFormation in FORMATIONS)||!STYLE_NAMES.includes(coach.style))bad('COACH_STYLE');
 if(!isRating(coach.risk)||!isRating(coach.adaptability)||!isRating(coach.rotation))bad('COACH_RATING');
 if(!Number.isInteger(coach.seed)||coach.seed<0||coach.seed>0xffffffff)bad('COACH_SEED');
 return true;
}
export function makeCoach({teamId,worldSeed=0,country='IT',id, name,preferredFormation,style,risk,adaptability,rotation}={}){
 if(!validId(teamId)||!Number.isInteger(worldSeed)||worldSeed<0||worldSeed>0xffffffff)bad('COACH_INPUT');
 const seed=coachHash(worldSeed,teamId,'coach');const names=pool[country]||pool.IT;
 const person=names[seed%names.length],styles=STYLE_NAMES,formations=Object.keys(FORMATIONS);
 const result={schemaVersion:AI_COACH_SCHEMA,id:id??`coach:${String(teamId)}`,teamId,
  name:name??person.join(' '),seed,preferredFormation:preferredFormation??formations[coachHash(seed,'formation')%formations.length],
  style:style??styles[coachHash(seed,'style')%styles.length],risk:risk??25+coachHash(seed,'risk')%61,
  adaptability:adaptability??25+coachHash(seed,'adapt')%71,rotation:rotation??20+coachHash(seed,'rotate')%61};
 validateCoach(result);return structuredClone(result);
}
/** Deterministic compatibility adapter; a legacy team is NOT mutated or saved implicitly. */
export function coachFromLegacy(team,{worldSeed=0,country='IT'}={}){
 if(!team||!validId(team.id))bad('LEGACY_TEAM');
 return makeCoach({teamId:team.id,worldSeed,country});
}
