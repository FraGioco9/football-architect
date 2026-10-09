/** Minimal, deterministic clock-aware simulation. No fixtures, results or matches. */
import {LEAGUES,getLeagueClubs} from './leagues.js';

export const SAVE_KEY='football-architect:minimal:v1';
export const DEFAULT_TIME='08:00';
export const MINUTES_PER_DAY=1440;
const DAY=86400000;
const MAX_DAYS=365000;
const isoPattern=/^\d{4}-\d{2}-\d{2}$/;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validDate(value){
 if(typeof value!=='string'||!isoPattern.test(value))return false;
 const d=new Date(value+'T12:00:00Z');
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function validTime(value){
 return typeof value==='string'&&timePattern.test(value);
}
export function localToday(date=new Date()){
 if(!(date instanceof Date)||Number.isNaN(date.getTime()))throw Error('Invalid current date');
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
/** The date's actual year remains internal. Visible seasons are career-relative. */
export function seasonLabel(date){
 if(!validDate(date))throw Error('Invalid season date');
 const y=Number(date.slice(0,4)),month=Number(date.slice(5,7));
 const first=month>=7?y:y-1;
 return first+'/'+String((first+1)%100).padStart(2,'0');
}
export function seasonNumber(state){
 if(!validSession(state))throw Error('Invalid season session');
 const opening=date=>Number(date.slice(0,4))-(Number(date.slice(5,7))<7?1:0);
 return opening(state.date)-opening(state.startedAt)+1;
}
export function sessionTime(state){
 return state?.time??DEFAULT_TIME;
}
export function clubFor(state){
 if(!state||typeof state!=='object')return null;
 return getLeagueClubs(state.countryId).find(t=>t.id===state.clubId)||null;
}
export function createSession(countryId,clubId,today=localToday(),time=DEFAULT_TIME){
 if(!LEAGUES.some(l=>l.id===countryId)||!getLeagueClubs(countryId).some(t=>t.id===clubId)||!validDate(today)||!validTime(time))throw Error('Invalid team, date or time');
 return {version:1,countryId,clubId,startedAt:today,date:today,daysElapsed:0,time};
}
export function validSession(s){
 if(!s||typeof s!=='object'||Array.isArray(s))return false;
 const keys=Object.keys(s).sort().join(',');
 const legacy=keys==='clubId,countryId,date,daysElapsed,startedAt,version';
 if(!legacy&&keys!=='clubId,countryId,date,daysElapsed,startedAt,time,version')return false;
 if(s.version!==1||!Number.isSafeInteger(s.daysElapsed)||s.daysElapsed<0||s.daysElapsed>MAX_DAYS||!validDate(s.date)||!validDate(s.startedAt))return false;
 if(!legacy&&!validTime(s.time))return false;
 if(!LEAGUES.some(l=>l.id===s.countryId)||!getLeagueClubs(s.countryId).some(t=>t.id===s.clubId))return false;
 const expected=Date.parse(s.startedAt+'T00:00:00Z')+s.daysElapsed*DAY;
 return Number.isFinite(expected)&&new Date(expected).toISOString().slice(0,10)===s.date;
}
/** Advance simulated minutes using a fixed 24h game day, independent from machine DST. */
export function advanceMinutes(s,minutes){
 if(!validSession(s)||!Number.isSafeInteger(minutes)||minutes<1||minutes>365*MINUTES_PER_DAY)throw Error('Invalid simulation advance');
 const current=sessionTime(s),ofDay=Number(current.slice(0,2))*60+Number(current.slice(3,5));
 const absolute=ofDay+minutes,addedDays=Math.floor(absolute/MINUTES_PER_DAY);
 if(s.daysElapsed+addedDays>MAX_DAYS)throw Error('Simulation limit exceeded');
 const date=new Date(Date.parse(s.date+'T00:00:00Z')+addedDays*DAY).toISOString().slice(0,10);
 const nextMinutes=absolute%MINUTES_PER_DAY;
 const time=String(Math.floor(nextMinutes/60)).padStart(2,'0')+':'+String(nextMinutes%60).padStart(2,'0');
 const next={...s,date,daysElapsed:s.daysElapsed+addedDays,time};
 if(!validSession(next))throw Error('Invalid resulting session');
 return next;
}
export function advanceSession(s,days){
 if(!Number.isSafeInteger(days)||days<1||days>365)throw Error('Invalid simulation advance');
 return advanceMinutes(s,days*MINUTES_PER_DAY);
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
