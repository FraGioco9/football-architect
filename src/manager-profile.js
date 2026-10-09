import {validDate,localToday} from './simulation.js';

export const MANAGER_PROFILE_FIELDS=Object.freeze(['firstName','lastName','birthDate','nationality','birthPlace']);
export const blankManagerProfile=()=>({firstName:'',lastName:'',birthDate:'',nationality:'',birthPlace:''});
export function normalizeManagerProfile(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 return Object.fromEntries(MANAGER_PROFILE_FIELDS.map(field=>[
  field,typeof source[field]==='string'?source[field].trim():''
 ]));
}
export function managerFullName(profile){
 const p=normalizeManagerProfile(profile);
 return [p.firstName,p.lastName].filter(Boolean).join(' ');
}
export function managerProfileIssues(value,today=localToday()){
 const p=normalizeManagerProfile(value);
 const result={};
 if(!p.firstName)result.firstName='FIELD_FIRST_REQUIRED';
 else if(p.firstName.length>40)result.firstName='FIELD_FIRST_LENGTH';
 if(!p.lastName)result.lastName='FIELD_LAST_REQUIRED';
 else if(p.lastName.length>40||managerFullName(p).length>80)result.lastName='FIELD_LAST_LENGTH';
 if(!validDate(p.birthDate)||p.birthDate>today)result.birthDate='FIELD_BIRTH_INVALID';
 if(!p.nationality)result.nationality='FIELD_NATIONALITY_REQUIRED';
 else if(p.nationality.length>80)result.nationality='FIELD_NATIONALITY_LENGTH';
 if(!p.birthPlace)result.birthPlace='FIELD_BIRTHPLACE_REQUIRED';
 else if(p.birthPlace.length>80)result.birthPlace='FIELD_BIRTHPLACE_LENGTH';
 return result;
}
export function validManagerProfile(value,today=localToday()){
 return Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&
  MANAGER_PROFILE_FIELDS.every(field=>typeof value[field]==='string')&&
  Object.keys(managerProfileIssues(value,today)).length===0);
}

export function managerAge(profile,date=localToday()){
 const birthday=normalizeManagerProfile(profile).birthDate;
 if(!validDate(birthday)||!validDate(date)||birthday>date)return null;
 const year=Number(date.slice(0,4))-Number(birthday.slice(0,4));
 return year-(date.slice(5)<birthday.slice(5)?1:0);
}
