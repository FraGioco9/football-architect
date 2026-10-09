import {localToday,validDate} from './simulation.js';
// Complete ISO region dropdown; labels localize in Italian and English.
const REGIONS='AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW';
export const NATIONALITY_CODES=Object.freeze(REGIONS.split(' '));
export const isNationalityCode=code=>NATIONALITY_CODES.includes(code);
const locale=lang=>lang==='en'?'en':'it';
export function nationalityOptions(lang='it'){
 const display=new Intl.DisplayNames([locale(lang)],{type:'region'});
 const collator=new Intl.Collator(locale(lang),{sensitivity:'base'});
 return NATIONALITY_CODES.map(code=>({code,label:display.of(code)??code})).sort((a,b)=>collator.compare(a.label,b.label));
}
export function nationalityLabel(code,lang='it'){
 return nationalityOptions(lang).find(n=>n.code===code)?.label??'';
}
export function initialCalendarMonth(date,today=localToday()){
 if(validDate(date)&&date<=today)return date.slice(0,7);
 const year=Math.max(1900,Number(today.slice(0,4))-30);
 return year+'-01';
}
export function shiftCalendarMonth(month,delta,today=localToday()){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!Number.isInteger(delta))return initialCalendarMonth('',today);
 const n=Number(month.slice(0,4))*12+Number(month.slice(5))-1+delta;
 const bound=Math.min(Number(today.slice(0,4))*12+Number(today.slice(5,7))-1,Math.max(1900*12,n));
 return Math.floor(bound/12)+'-'+String(bound%12+1).padStart(2,'0');
}
export function calendarDays(month,today=localToday()){
 const match=/^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
 if(!match)return [];
 const year=Number(match[1]),monthNo=Number(match[2]);
 const offset=(new Date(Date.UTC(year,monthNo-1,1)).getUTCDay()+6)%7;
 const count=new Date(Date.UTC(year,monthNo,0)).getUTCDate();
 const items=Array.from({length:offset},()=>null);
 for(let day=1;day<=count;day++){
  const iso=month+'-'+String(day).padStart(2,'0');
  items.push({iso,day,disabled:iso>today});
 }
 return items;
}
export function calendarMonthNames(lang='it'){
 return Array.from({length:12},(_,i)=>new Intl.DateTimeFormat(locale(lang),{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,i,1))));
}
export function calendarWeekdays(lang='it'){
 return Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(locale(lang),{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,i+1))));
}
export function birthDateLabel(iso,lang='it'){
 if(!validDate(iso))return '';
 return new Intl.DateTimeFormat(locale(lang),{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
}
