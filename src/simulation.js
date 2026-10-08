/** Minimal, deterministic date simulation. No fixtures, football matches or scores. */
import {LEAGUES,getLeagueClubs} from './leagues.js';

export const SAVE_KEY='football-architect:minimal:v1';
const DAY=86400000;
const isoPattern=/^\d{4}-\d{2}-\d{2}$/;
export function validDate(value){
 if(typeof value!=='string'||!isoPattern.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function localToday(date=new Date()){
 if(!(date instanceof Date)||Number.isNaN(date.getTime()))throw Error('Invalid current date');
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function seasonLabel(date){
 if(!validDate(date))throw Error('Invalid season date');
 const y=Number(date.slice(0,4)),month=Number(date.slice(5,7));
 const first=month>=7?y:y-1;
 return first+'/'+String((first+1)%100).padStart(2,'0');
}
export function clubFor(state){
 if(!state||typeof state!=='object')return null;
 return getLeagueClubs(state.countryId).find(t=>t.id===state.clubId)||null;
}
export function createSession(countryId,clubId,today=localToday()){
 if(!LEAGUES.some(l=>l.id===countryId)||!getLeagueClubs(countryId).some(t=>t.id===clubId)||!validDate(today))throw Error('Invalid team or date');
 return {version:1,countryId,clubId,startedAt:today,date:today,daysElapsed:0};
}
export function validSession(s){
 if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).sort().join(',')!=='clubId,countryId,date,daysElapsed,startedAt,version')return false;
 if(s.version!==1||!Number.isSafeInteger(s.daysElapsed)||s.daysElapsed<0||s.daysElapsed>365000||!validDate(s.date)||!validDate(s.startedAt))return false;
 if(!LEAGUES.some(l=>l.id===s.countryId)||!getLeagueClubs(s.countryId).some(t=>t.id===s.clubId))return false;
 const expected=new Date(s.startedAt+'T12:00:00Z').getTime()+s.daysElapsed*DAY;
 return Number.isFinite(expected)&&new Date(expected).toISOString().slice(0,10)===s.date;
}
export function advanceSession(s,days){
 if(!validSession(s)||!Number.isSafeInteger(days)||days<1||days>365||s.daysElapsed+days>365000)throw Error('Invalid simulation advance');
 const time=new Date(s.date+'T12:00:00Z').getTime()+days*DAY;
 const next={...s,date:new Date(time).toISOString().slice(0,10),daysElapsed:s.daysElapsed+days};
 if(!validSession(next))throw Error('Invalid resulting session');
 return next;
}
export function readSession(storage){
 try{
  const raw=storage.getItem(SAVE_KEY);
  if(!raw)return null;
  const state=JSON.parse(raw);
  return validSession(state)?state:null;
 }catch{return null;}
}
export function writeSession(storage,state){
 if(!validSession(state))throw Error('Invalid persisted session');
 storage.setItem(SAVE_KEY,JSON.stringify(state));
 return state;
}
