/* CAL-IMP-05A: read-only world clock adapter; no wall-clock inference or simulation writes. */
((root,factory)=>{
 const api=factory(root.faWorldCalendarModel);
 root.faWorldClockAdapter=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,model=>{
 'use strict';
 const unavailable=()=>Object.freeze({source:Object.freeze({kind:'unavailable',reference:null}),current:null,eventStates:Object.freeze([])});
 function normalize(input){
  if(input===null||input===undefined)return unavailable();
  if(!input||typeof input!=='object'||Array.isArray(input))throw TypeError('Invalid clock snapshot');
  const {source,current,eventStates=[]}=input;
  if(!source||!['dev','authoritative'].includes(source.kind)||typeof source.reference!=='string'||!source.reference.trim())throw TypeError('Invalid source provenance');
  if(!current||!Number.isSafeInteger(current.season)||current.season<1||!Number.isInteger(current.day)||current.day<1||current.day>56)throw TypeError('Invalid world day');
  if(!Array.isArray(eventStates)||eventStates.length)throw TypeError('Lifecycle data requires an independently authorized provider');
  if(!model||typeof model.projectSeason!=='function')throw TypeError('World Calendar model unavailable');
  model.projectSeason(current.season,{source,current,eventStates:[]});
  return Object.freeze({source:Object.freeze({kind:source.kind,reference:source.reference}),current:Object.freeze({season:current.season,day:current.day}),eventStates:Object.freeze([])});
 }
 function project(season,snapshot){
  const valid=normalize(snapshot);
  return model.projectSeason(season,valid);
 }
 function projectCompetition(season,competitionId,snapshot){
  const valid=normalize(snapshot);
  if(!model||typeof model.projectCompetition!=='function')throw TypeError('Competition projection unavailable');
  return model.projectCompetition(season,competitionId,valid);
 }
 return Object.freeze({normalize,unavailable,project,projectCompetition});
});
