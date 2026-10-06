/** QOL02.02: persist structured notifications, never permanently materialize translations.
 * Legacy string snapshots remain readable without guessing their meaning.
 */
import {t,formatNumber,plural,normalizeLanguage} from './localization.mjs';
import {formatMoney,currencyForCountry,convertMinor} from './currency.mjs';
export const EVENT_TYPES=Object.freeze({
 'match.final':['home','away','homeGoals','awayGoals'],
 'match.official':['round','home','away','homeGoals','awayGoals','outcome'],
 'season.new':['season','position','prizeEURMinor'],
 'youth.turnover':['retirements','promotions'],
 'training.progress':['players'],
 'welcome':['club','league'],
 'calendar.start':['clubs','rounds','opponent'],
 'season.champion':['club','league','season'],
 'contract.renewed':['player','until'],
 'contract.enabled':[],
 'contract.expired':['player'],
 'contract.promise':['player'],
 'contract.counter':['player'],
 'youth.promoted':['player','club'],
 'transfer.completed':['player','from','to','amountEURMinor'],
 'transfer.booked':['player','to','day'],
 'transfer.window_closing':['country','day'],
 'transfer.free_agent':['player','to'],
 'transfer.released':['player','from'],
 'scouting.updated':['club'],
 'cup.winner':['country','season','club'],
 'continental.winner':['club','season'],
 'divisions.changes':['season'],
 'injury.reported':['player','days'],
 'board.update':['reason','trust','status'],
 'finance.alert':['type','amountEUR'],
 'facilities.completed':['type','level'],
 'facilities.payroll':['amountEUR'],
 'personality.weekly':['player','change']
});
const bad=code=>{throw Error(`QOL02_EVENT_${code}`);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const id=x=>typeof x==='string'&&/^[-\w:.]{1,100}$/.test(x)&&!['__proto__','constructor','prototype'].includes(x);
export function makeEvent({id:eventId,type,params={},day=0}={}){
 if(!id(eventId)||!Object.hasOwn(EVENT_TYPES,type)||!obj(params)||!Number.isSafeInteger(day)||day<0||day>250000)bad('SCHEMA');
 const required=EVENT_TYPES[type];if(Object.keys(params).length!==required.length||!required.every(k=>Object.hasOwn(params,k)))bad('PARAMS');
 for(const [key,v] of Object.entries(params)){
  if(!required.includes(key)||typeof v!=='string'&&typeof v!=='number'||typeof v==='string'&&(v.length>150||!v.trim())||typeof v==='number'&&!Number.isSafeInteger(v))bad('PARAM_VALUE');
 }
 if((type==='match.final'||type==='match.official')&&(!['homeGoals','awayGoals'].every(k=>Number.isSafeInteger(params[k])&&params[k]>=0&&params[k]<=25)))bad('SCORE');
 if(type==='calendar.start'&&(!['clubs','rounds'].every(k=>Number.isSafeInteger(params[k])&&params[k]>0&&params[k]<2000)))bad('CALENDAR');
 if(type==='season.new'&&(!Number.isSafeInteger(params.season)||params.season<1||params.season>99999))bad('SEASON');
 if(type==='match.official'&&(!['win','draw','loss'].includes(params.outcome)||!Number.isSafeInteger(params.round)||params.round<1||params.round>1000))bad('OUTCOME');
 if(type==='season.new'&&(!Number.isSafeInteger(params.prizeEURMinor)||params.prizeEURMinor<0||params.prizeEURMinor>9e12||!Number.isSafeInteger(params.position)||params.position<1))bad('SEASON');
 if(type==='youth.turnover'&&(!['retirements','promotions'].every(k=>Number.isSafeInteger(params[k])&&params[k]>=0&&params[k]<100000)))bad('TURNOVER');
 if(type==='transfer.completed'&&(!Number.isSafeInteger(params.amountEURMinor)||params.amountEURMinor<0||params.amountEURMinor>9e12))bad('AMOUNT');
 if(type==='injury.reported'&&(!Number.isSafeInteger(params.days)||params.days<0||params.days>3650))bad('DAYS');
 return {schemaVersion:1,id:eventId,type,params:structuredClone(params),day};
}
export function validateNotification(item){
 if(obj(item)&&item.schemaVersion===1){
  if(JSON.stringify(item)!==JSON.stringify(makeEvent({id:item.id,type:item.type,params:item.params,day:item.day})))bad('TAMPER');return true;
 }
 if(obj(item)&&item.schemaVersion===0&&id(item.id)&&typeof item.text==='string'&&item.text.length<=500&&Number.isSafeInteger(item.day)&&item.day>=0&&Object.keys(item).sort().join(',')==='day,id,schemaVersion,text')return true;
 bad('LEGACY');
}
export function keepLegacyNotification({id:legacyId,text,day=0}={}){
 const n={schemaVersion:0,id:legacyId,text,day};validateNotification(n);return n;
}
export function appendNotification(items,item){
 if(!Array.isArray(items)||items.length>10000)bad('CAPACITY');validateNotification(item);
 for(const n of items)validateNotification(n);
 const existing=items.find(n=>n.id===item.id);
 if(existing){if(JSON.stringify(existing)!==JSON.stringify(item))bad('DUPLICATE');return structuredClone(items);}
 return [...structuredClone(items),structuredClone(item)];
}
export function renderNotification(item,{lang='it',currencyCountry='IT'}={}){
 validateNotification(item);lang=normalizeLanguage(lang);
 if(item.schemaVersion===0)return {text:item.text,legacy:true,translatable:false};
 const params={...item.params};
 if(item.type==='match.official'){
  params.round=formatNumber(params.round,{lang});params.outcome=t(`mail.outcome.${params.outcome}`,{},lang);
  params.homeGoals=formatNumber(params.homeGoals,{lang});params.awayGoals=formatNumber(params.awayGoals,{lang});
 }else if(item.type==='season.new'){
  const code=currencyForCountry(currencyCountry);params.prize=formatMoney(convertMinor(params.prizeEURMinor,'EUR',code),code,{lang});delete params.prizeEURMinor;params.position=lang==='it'?`${formatNumber(params.position,{lang})}º`:`${formatNumber(params.position,{lang})}${params.position%100>=11&&params.position%100<=13?'th':({1:'st',2:'nd',3:'rd'}[params.position%10]??'th')}`;params.season=formatNumber(params.season,{lang});
 }else if(item.type==='youth.turnover'){params.retirements=plural(params.retirements,'retirement',{lang});params.promotions=plural(params.promotions,'player',{lang});}
 else if(item.type==='calendar.start'){params.clubs=formatNumber(params.clubs,{lang});params.rounds=formatNumber(params.rounds,{lang});}
 else if(item.type==='transfer.completed'){
  const code=currencyForCountry(currencyCountry);params.amount=formatMoney(convertMinor(params.amountEURMinor,'EUR',code),code,{lang});delete params.amountEURMinor;
 }else if(item.type==='injury.reported'){
  params.days=formatNumber(params.days,{lang});params.daysLabel=plural(item.params.days,'day',{lang}).replace(/^\S+\s+/, '');
 }else if(item.type==='match.final'){
  params.homeGoals=formatNumber(params.homeGoals,{lang});params.awayGoals=formatNumber(params.awayGoals,{lang});
 }else if(item.type==='season.champion')params.season=formatNumber(params.season,{lang});
 else if(item.type==='contract.renewed')params.until=formatNumber(params.until,{lang});
 if(item.type==='finance.alert'){const key=params.type;params.type=t(`finance.alert.${key}`,{},lang);}
 if(item.type==='board.update'){
  const code=params.reason;params.reason=t(`board.reason.${code}`,{},lang);
  if(params.reason===`board.reason.${code}`)params.reason=code.replaceAll('_',' ');
  params.status=t(`board.status.${params.status}`,{},lang);
 }
 return {text:t(`event.${item.type}`,params,lang),legacy:false,translatable:true};
}
export function encodeNotifications(items){
 if(!Array.isArray(items)||items.length>10000)bad('CAPACITY');items.forEach(validateNotification);return JSON.stringify({schemaVersion:1,items});
}
export function decodeNotifications(value){
 if(typeof value!=='string'||value.length>2_000_000)bad('SIZE');
 let objValue;try{objValue=JSON.parse(value);}catch{bad('JSON');}
 if(!objValue||objValue.schemaVersion!==1||!Array.isArray(objValue.items)||objValue.items.length>10000)bad('SCHEMA');
 const ids=new Set();for(const x of objValue.items){validateNotification(x);if(ids.has(x.id))bad('DUPLICATES');ids.add(x.id);}
 return structuredClone(objValue.items);
}
